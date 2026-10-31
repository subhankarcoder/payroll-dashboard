'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  RefreshCw,
  CheckCircle,
  Lock,
  XCircle,
  Search,
  Edit3,
  CalendarCheck,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Drawer } from '@/components/molecules/drawer';
import { ConfirmDialog } from '@/components/molecules/confirm-dialog';
import { EmptyState } from '@/components/molecules/empty-state';
import { DataTable, type Column } from '@/components/organisms/data-table';
import { PayrollRunService } from '@/features/payroll/services/payroll-run.service';
import {
  PayrollItemService,
  type CorrectPayrollItemInput,
} from '@/features/payroll/services/payroll-item.service';
import { EmployeeLookupService } from '@/features/employees/services/employee-lookup.service';
import { SalaryStructureService } from '@/features/payroll/services/salary-structure.service';
import type {
  PayrollRun,
  PayrollRunItem,
  EmployeeSummary,
  ItemBreakdownEntry,
} from '@/types/payroll';
import { formatCurrency } from '@/lib/format-currency';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

import {
  evaluateRunItemWithStructure,
  isAttendanceExempt,
} from '@/features/payroll/utils/payroll-calculator';

export default function PayrollRunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const runId = resolvedParams.runId;

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [isRunLoading, setIsRunLoading] = useState(true);
  const [runNotFound, setRunNotFound] = useState(false);
  const [items, setItems] = useState<PayrollRunItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<
    'calculate' | 'approve' | 'finalize' | 'cancel' | null
  >(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [cancelReason] = useState('');

  // Item Detail & Adjustment Drawer
  const [selectedItem, setSelectedItem] = useState<PayrollRunItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);
  const [correctionForm, setCorrectionForm] = useState<CorrectPayrollItemInput>({
    payableDays: 30,
    presentDays: 30,
    lopDays: 0,
    manualEarnings: 0,
    manualDeductions: 0,
    manualAdjustment: 0,
    remarks: '',
    notes: '',
  });
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);

  const periodYear = run?.periodYear || 2026;
  const periodMonth = run?.periodMonth || 9;

  const fetchRun = useCallback(async () => {
    setIsRunLoading(true);
    setRunNotFound(false);
    try {
      const data = await PayrollRunService.getRunById(runId);
      setRun(data);
    } catch (err: unknown) {
      console.warn('Failed to load run details:', err);
      const is404 =
        err &&
        typeof err === 'object' &&
        'status' in err &&
        (err as { status?: number }).status === 404;
      if (is404) {
        setRunNotFound(true);
      }
    } finally {
      setIsRunLoading(false);
    }
  }, [runId]);

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const [data, employeesList] = await Promise.all([
        PayrollItemService.listItems(runId, {
          page,
          limit,
          search: searchQuery || undefined,
        }),
        EmployeeLookupService.searchEmployees('', 100).catch(() => []),
      ]);

      const empMap = new Map<string, EmployeeSummary>();
      for (const emp of employeesList) {
        empMap.set(emp.id, emp);
      }

      const rawItems = data.data || [];
      const daysInPeriod = new Date(periodYear, periodMonth, 0).getDate();

      // Fallback: If any employee in the payroll run items is not in empMap, fetch by ID
      const missingEmpIds = Array.from(
        new Set(rawItems.map((item) => item.employeeId).filter((id) => id && !empMap.has(id))),
      );

      if (missingEmpIds.length > 0) {
        await Promise.all(
          missingEmpIds.map(async (empId) => {
            try {
              const emp = await EmployeeLookupService.getEmployeeById(empId);
              if (emp) {
                empMap.set(emp.id, emp);
                empMap.set(empId, emp);
              }
            } catch {
              // Ignore individual lookup errors
            }
          }),
        );
      }

      // Fetch active structures for each employee in batch
      const structurePromises = rawItems.map((item) =>
        SalaryStructureService.getActiveStructure(item.employeeId)
          .catch(() => null)
          .then(async (act) => {
            if (act && act.components && act.components.length > 0) return act;
            const hist = await SalaryStructureService.getHistoricalStructures(
              item.employeeId,
            ).catch(() => []);
            return hist.find((s) => s.components && s.components.length > 0) || null;
          }),
      );
      const structures = await Promise.all(structurePromises);

      const enrichedItems = rawItems.map((item, idx) => {
        const emp = empMap.get(item.employeeId);
        const struct = structures[idx] || null;
        const evaluated = evaluateRunItemWithStructure(item, struct, daysInPeriod);

        return {
          ...evaluated,
          employee: emp
            ? {
                firstName: emp.firstName,
                lastName: emp.lastName,
                employeeCode: emp.employeeCode,
                email: emp.email,
              }
            : evaluated.employee,
        };
      });

      // Also apply client-side search filtering if searchQuery is provided
      let finalItems = enrichedItems;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        finalItems = enrichedItems.filter((it) => {
          const fn = it.employee?.firstName?.toLowerCase() || '';
          const ln = it.employee?.lastName?.toLowerCase() || '';
          const code = it.employee?.employeeCode?.toLowerCase() || '';
          const email = it.employee?.email?.toLowerCase() || '';
          return (
            fn.includes(q) ||
            ln.includes(q) ||
            code.includes(q) ||
            email.includes(q) ||
            it.employeeId.toLowerCase().includes(q)
          );
        });
      }

      setItems(finalItems);
      setTotal(data.meta?.total || finalItems.length);
    } catch (err) {
      console.warn('Failed to load run items:', err);
    } finally {
      setItemsLoading(false);
    }
  }, [runId, periodYear, periodMonth, page, limit, searchQuery]);

  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAction = async () => {
    if (!confirmAction) return;
    setIsActionLoading(true);
    try {
      if (confirmAction === 'calculate') {
        const updated = await PayrollRunService.calculateRun(runId);
        setRun(updated);
        await fetchItems();
      } else if (confirmAction === 'approve') {
        const updated = await PayrollRunService.approveRun(runId);
        setRun(updated);
      } else if (confirmAction === 'finalize') {
        const updated = await PayrollRunService.finalizeRun(runId);
        setRun(updated);
      } else if (confirmAction === 'cancel') {
        const updated = await PayrollRunService.cancelRun(runId, cancelReason);
        setRun(updated);
      }
      setConfirmAction(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleOpenItemDrawer = async (item: PayrollRunItem, editMode: boolean = false) => {
    const daysInPeriod = run ? new Date(run.periodYear, run.periodMonth, 0).getDate() : 30;
    const initialLop = item.lopDays !== undefined ? Number(item.lopDays) : 0;
    const initialPresent =
      item.presentDays !== undefined && Number(item.presentDays) > 0
        ? Number(item.presentDays)
        : Math.max(0, daysInPeriod - initialLop);
    const initialPayable =
      item.payableDays !== undefined && Number(item.payableDays) > 0
        ? Number(item.payableDays)
        : Math.max(0, daysInPeriod - initialLop);

    setSelectedItem(item);
    setIsEditing(editMode);
    setCorrectionError(null);
    setCorrectionSuccess(null);
    setCorrectionForm({
      payableDays: initialPayable,
      presentDays: initialPresent,
      lopDays: initialLop,
      overtimeHours: Number(item.overtimeHours) || 0,
      manualEarnings: Number(item.manualEarnings) || 0,
      manualDeductions: Number(item.manualDeductions) || 0,
      manualAdjustment:
        Number(item.manualAdjustment) ||
        (Number(item.manualEarnings) || 0) - (Number(item.manualDeductions) || 0),
      remarks: item.remarks || item.notes || '',
      notes: item.notes || item.remarks || '',
    });
    setIsDrawerOpen(true);

    // Fetch freshest single item detail while preserving resolved employee details and structure
    try {
      const [freshItem, actStruct] = await Promise.all([
        PayrollItemService.getItemById(runId, item.id),
        SalaryStructureService.getActiveStructure(item.employeeId).catch(() => null),
      ]);

      const evaluated = evaluateRunItemWithStructure(freshItem, actStruct, daysInPeriod);

      setSelectedItem({
        ...evaluated,
        employee: evaluated.employee || item.employee,
      });

      setCorrectionForm((prev) => ({
        ...prev,
        payableDays: evaluated.payableDays,
        presentDays: evaluated.presentDays,
        lopDays: evaluated.lopDays,
        overtimeHours: Number(freshItem.overtimeHours) || 0,
        manualEarnings:
          Number(freshItem.manualEarnings ?? evaluated.manualEarnings ?? prev.manualEarnings) || 0,
        manualDeductions:
          Number(
            freshItem.manualDeductions ?? evaluated.manualDeductions ?? prev.manualDeductions,
          ) || 0,
        manualAdjustment:
          Number(
            freshItem.manualAdjustment ?? evaluated.manualAdjustment ?? prev.manualAdjustment,
          ) || 0,
        notes: freshItem.notes || evaluated.notes || prev.notes || '',
        remarks: freshItem.remarks || evaluated.remarks || prev.remarks || '',
      }));
    } catch (e) {
      console.warn('Could not fetch fresh item detail:', e);
    }
  };

  const handleSaveCorrection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedItem) return;

    const manualEarnings = Number(correctionForm.manualEarnings) || 0;
    const manualDeductions = Number(correctionForm.manualDeductions) || 0;
    const manualAdjustment = manualEarnings - manualDeductions;
    const notesText = (correctionForm.notes || correctionForm.remarks || '').trim();

    // Validation: Adjustment Remarks / Notes are mandatory when manual adjustment is non-zero
    if (manualAdjustment !== 0 || manualEarnings > 0 || manualDeductions > 0) {
      if (!notesText) {
        setCorrectionError(
          'Adjustment Remarks / Notes are mandatory when manual adjustment is non-zero.',
        );
        return;
      }
    }

    setCorrectionError(null);
    setIsSavingCorrection(true);
    try {
      const payload: CorrectPayrollItemInput = {
        ...correctionForm,
        manualEarnings,
        manualDeductions,
        manualAdjustment,
        notes: notesText,
        remarks: notesText,
      };

      const updatedItem = await PayrollItemService.correctItem(runId, selectedItem.id, payload);

      const daysInPeriod = run ? new Date(run.periodYear, run.periodMonth, 0).getDate() : 30;
      const actStruct = await SalaryStructureService.getActiveStructure(
        selectedItem.employeeId,
      ).catch(() => null);
      const evaluated = evaluateRunItemWithStructure(updatedItem, actStruct, daysInPeriod);

      const mergedItem: PayrollRunItem = {
        ...evaluated,
        manualEarnings,
        manualDeductions,
        manualAdjustment,
        notes: notesText,
        remarks: notesText,
        netPay:
          updatedItem.netSalary ??
          updatedItem.netPay ??
          evaluated.grossEarnings + manualEarnings - evaluated.totalDeductions - manualDeductions,
        employee: evaluated.employee || selectedItem.employee,
      };

      // Instantly update the table items state and recalculated Net Salary!
      setItems((prevItems) => prevItems.map((it) => (it.id === selectedItem.id ? mergedItem : it)));
      setSelectedItem(mergedItem);
      setIsEditing(false);
      setCorrectionSuccess(
        'Manual adjustment saved successfully. Table row and Net Salary recalculated.',
      );

      // Refresh items list and run totals
      await fetchItems();
      await fetchRun();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save correction';
      setCorrectionError(msg);
    } finally {
      setIsSavingCorrection(false);
    }
  };

  const isFinalized = run?.status === 'FINALIZED';
  const isCancelled = run?.status === 'CANCELLED';

  const daysInPeriod = run ? new Date(run.periodYear, run.periodMonth, 0).getDate() : 30;

  const columns: Column<PayrollRunItem>[] = [
    {
      key: 'employee',
      header: 'Employee',
      render: (item) => {
        const firstName = item.employee?.firstName || 'Employee';
        const lastName = item.employee?.lastName || '';
        const code = item.employee?.employeeCode || item.employeeId.slice(0, 8);
        const email = item.employee?.email || '';
        const isExempt =
          item.isExempt ?? item.attendanceExempt ?? isAttendanceExempt(item, daysInPeriod);

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isExempt ? '#ecfdf5' : '#eef2ff',
                color: isExempt ? '#059669' : '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {firstName[0] || 'E'}
            </div>
            <div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
              >
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {firstName} {lastName}
                </span>
                {isExempt && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      backgroundColor: '#ecfdf5',
                      color: '#047857',
                      border: '1px solid #a7f3d0',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      lineHeight: '1rem',
                    }}
                  >
                    <ShieldCheck size={11} />
                    Attendance Exempt (100% Full Pay)
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                {code} {email && `• ${email}`}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'presentDays',
      header: 'Present / Pay Days',
      align: 'center',
      render: (item) => {
        const isExempt =
          item.isExempt ?? item.attendanceExempt ?? isAttendanceExempt(item, daysInPeriod);

        return (
          <div style={{ fontSize: '0.8125rem', color: '#334155' }}>
            <div>
              <span style={{ fontWeight: 600 }}>{item.presentDays}</span> / {item.payableDays}
            </div>
            {isExempt && (
              <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>
                100% Full Pay
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'lopDays',
      header: 'LOP',
      align: 'center',
      render: (item) => {
        const isExempt =
          item.isExempt ?? item.attendanceExempt ?? isAttendanceExempt(item, daysInPeriod);

        return (
          <div>
            <span
              style={{
                fontWeight: item.lopDays > 0 ? 700 : 500,
                color: item.lopDays > 0 ? '#dc2626' : '#64748b',
              }}
            >
              {item.lopDays} d
            </span>
            {isExempt && (
              <div style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 600 }}>Exempt</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'overtimeHours',
      header: 'OT Hours',
      align: 'center',
      render: (item) => (
        <span style={{ color: item.overtimeHours > 0 ? '#2563eb' : '#64748b', fontWeight: 500 }}>
          {item.overtimeHours} hrs
        </span>
      ),
    },
    {
      key: 'grossEarnings',
      header: 'Gross Pay',
      align: 'right',
      render: (item) => (
        <span className="tabular-nums" style={{ fontWeight: 500, color: '#0f172a' }}>
          {formatCurrency(item.grossEarnings)}
        </span>
      ),
    },
    {
      key: 'totalDeductions',
      header: 'Deductions',
      align: 'right',
      render: (item) => (
        <span className="tabular-nums" style={{ fontWeight: 500, color: '#dc2626' }}>
          {formatCurrency(item.totalDeductions)}
        </span>
      ),
    },
    {
      key: 'netPay',
      header: 'Net Pay',
      align: 'right',
      render: (item) => {
        const manualAdj =
          item.manualAdjustment !== undefined && item.manualAdjustment !== null
            ? Number(item.manualAdjustment)
            : (Number(item.manualEarnings) || 0) - (Number(item.manualDeductions) || 0);

        return (
          <div>
            <span className="tabular-nums" style={{ fontWeight: 700, color: '#059669' }}>
              {formatCurrency(item.netPay)}
            </span>
            {manualAdj !== 0 && (
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: manualAdj > 0 ? '#047857' : '#dc2626',
                }}
              >
                {manualAdj > 0
                  ? `+${formatCurrency(manualAdj)} manual`
                  : `${formatCurrency(manualAdj)} manual`}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'totalEmployerCost',
      header: 'Employer Cost',
      align: 'right',
      render: (item) => (
        <span className="tabular-nums" style={{ fontWeight: 600, color: '#0f172a' }}>
          {formatCurrency(item.totalEmployerCost)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (item) => <Badge status={item.status} />,
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      render: (item) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.375rem',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleOpenItemDrawer(item, false);
            }}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid #e2e8f0',
            }}
          >
            Review
          </button>
          {!isFinalized && !isCancelled && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenItemDrawer(item, true);
              }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#eef2ff',
                color: '#4f46e5',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid #c7d2fe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Edit3 size={12} />
              <span>Adjust Item</span>
            </button>
          )}
        </div>
      ),
    },
  ];

  if (runNotFound) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <Link
          href="/payroll/runs"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8125rem',
            color: '#64748b',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={15} />
          <span>Back to Payroll Runs</span>
        </Link>
        <EmptyState
          title="Payroll Run Not Found"
          description={`The payroll run with ID "${runId}" does not exist in the active workspace. It may have been deleted, cancelled, or belongs to a different workspace.`}
          actionLabel="View All Payroll Runs"
          onAction={() => router.push('/payroll/runs')}
        />
      </div>
    );
  }

  if (isRunLoading && !run) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <Link
          href="/payroll/runs"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8125rem',
            color: '#64748b',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={15} />
          <span>Back to Payroll Runs</span>
        </Link>
        <div
          style={{
            padding: 'var(--space-12) var(--space-6)',
            textAlign: 'center',
            backgroundColor: 'hsl(var(--bg-surface))',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid hsl(var(--border-subtle))',
          }}
        >
          <RefreshCw
            size={28}
            className="animate-spin"
            style={{ margin: '0 auto var(--space-3)', color: '#4f46e5' }}
          />
          <p
            style={{ margin: 0, color: 'hsl(var(--text-muted))', fontSize: 'var(--font-size-sm)' }}
          >
            Loading payroll run details...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Back link & Top Run Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Link
          href="/payroll/runs"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.8125rem',
            color: '#64748b',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={15} />
          <span>Back to Payroll Runs</span>
        </Link>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              {run
                ? `${MONTH_NAMES[run.periodMonth - 1]} ${run.periodYear} Payroll`
                : 'Payroll Run'}
            </h1>
            {run && <Badge status={run.status} />}
          </div>

          {/* Action Buttons governed by lifecycle state */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {run?.status === 'DRAFT' && (
              <>
                <Button
                  variant="primary"
                  onClick={() => setConfirmAction('calculate')}
                  style={{ backgroundColor: '#4f46e5' }}
                >
                  <Play size={15} fill="#ffffff" />
                  <span>Calculate Payroll</span>
                </Button>
                <Button variant="danger" onClick={() => setConfirmAction('cancel')}>
                  <XCircle size={15} />
                  <span>Cancel Run</span>
                </Button>
              </>
            )}

            {(run?.status === 'CALCULATED' || run?.status === 'UNDER_REVIEW') && (
              <>
                <Button variant="secondary" onClick={() => setConfirmAction('calculate')}>
                  <RefreshCw size={15} />
                  <span>Recalculate</span>
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setConfirmAction('approve')}
                  style={{ backgroundColor: '#059669' }}
                >
                  <CheckCircle size={15} />
                  <span>Approve Run</span>
                </Button>
                <Button variant="danger" onClick={() => setConfirmAction('cancel')}>
                  <XCircle size={15} />
                  <span>Cancel</span>
                </Button>
              </>
            )}

            {run?.status === 'APPROVED' && (
              <>
                <Button
                  variant="primary"
                  onClick={() => setConfirmAction('finalize')}
                  style={{ backgroundColor: '#4f46e5' }}
                >
                  <Lock size={15} />
                  <span>Finalize & Publish</span>
                </Button>
                <Button variant="danger" onClick={() => setConfirmAction('cancel')}>
                  <span>Cancel Run</span>
                </Button>
              </>
            )}

            {isFinalized && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.875rem',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 'var(--radius-md)',
                  color: '#059669',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                <Lock size={15} />
                <span>Finalized & Immutable (Read-Only)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Aggregate Stats Summary Cards */}
      {run &&
        (() => {
          const liveGross =
            items.length > 0
              ? items.reduce((sum, it) => sum + (parseFloat(String(it.grossEarnings)) || 0), 0)
              : run.totalGross || 0;
          const liveDeductions =
            items.length > 0
              ? items.reduce((sum, it) => sum + (parseFloat(String(it.totalDeductions)) || 0), 0)
              : run.totalDeductions || 0;
          const liveNet =
            items.length > 0
              ? items.reduce((sum, it) => sum + (parseFloat(String(it.netPay)) || 0), 0)
              : run.totalNet || 0;
          const liveCost =
            items.length > 0
              ? items.reduce((sum, it) => sum + (parseFloat(String(it.totalEmployerCost)) || 0), 0)
              : run.totalEmployerCost || 0;

          return (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
              }}
            >
              <div className="card-base" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                  Total Employees
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: '0.25rem',
                  }}
                >
                  {run.totalEmployees}
                </div>
              </div>

              <div className="card-base" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                  Gross Earnings
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: '0.25rem',
                  }}
                >
                  {formatCurrency(liveGross)}
                </div>
              </div>

              <div className="card-base" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                  Total Deductions
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#dc2626',
                    marginTop: '0.25rem',
                  }}
                >
                  {formatCurrency(liveDeductions)}
                </div>
              </div>

              <div className="card-base" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                  Total Net Payout
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#059669',
                    marginTop: '0.25rem',
                  }}
                >
                  {formatCurrency(liveNet)}
                </div>
              </div>

              <div className="card-base" style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                  Total Employer Cost (CTC)
                </div>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginTop: '0.25rem',
                  }}
                >
                  {formatCurrency(liveCost)}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Items Filter Bar */}
      <div
        className="card-base"
        style={{
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '320px' }}>
          <Search size={16} color="#64748b" />
          <input
            type="text"
            placeholder="Search employee name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '0.875rem',
              color: '#0f172a',
            }}
          />
        </div>
      </div>

      {/* Items Table */}
      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(item) => item.id}
        isLoading={itemsLoading}
        page={page}
        limit={limit}
        total={total}
        onPageChange={setPage}
        onRowClick={handleOpenItemDrawer}
        emptyMessage="No employee items calculated"
        emptySubtext={
          run?.status === 'DRAFT'
            ? "Click 'Calculate Payroll' to process attendance and generate employee line items."
            : 'No matching items found.'
        }
      />

      {/* Item Breakdown & Manual Adjustment Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={
          selectedItem
            ? `${selectedItem.employee?.firstName || 'Employee'} ${selectedItem.employee?.lastName || ''}`.trim()
            : 'Employee Payroll Line Item'
        }
        subtitle={
          selectedItem
            ? `${selectedItem.employee?.employeeCode || selectedItem.employeeId}${selectedItem.employee?.email ? ` • ${selectedItem.employee.email}` : ''}`
            : undefined
        }
        width="560px"
        footer={
          !isFinalized && !isCancelled ? (
            isEditing ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveCorrection}
                  isLoading={isSavingCorrection}
                  style={{ backgroundColor: '#4f46e5' }}
                >
                  Save Manual Adjustment
                </Button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                <Edit3 size={14} />
                <span>Manual Adjustment / Correction</span>
              </Button>
            )
          ) : undefined
        }
      >
        {selectedItem &&
          (() => {
            const rawSelected = selectedItem as unknown as Record<string, unknown>;
            const earningsList: ItemBreakdownEntry[] = selectedItem.earningsJson?.length
              ? selectedItem.earningsJson
              : Array.isArray(rawSelected.earnings)
                ? (rawSelected.earnings as ItemBreakdownEntry[])
                : Array.isArray(rawSelected.earnings_json)
                  ? (rawSelected.earnings_json as ItemBreakdownEntry[])
                  : [];

            const deductionsList: ItemBreakdownEntry[] = selectedItem.deductionsJson?.length
              ? selectedItem.deductionsJson
              : Array.isArray(rawSelected.deductions)
                ? (rawSelected.deductions as ItemBreakdownEntry[])
                : Array.isArray(rawSelected.deductions_json)
                  ? (rawSelected.deductions_json as ItemBreakdownEntry[])
                  : [];

            const employerContributionsList: ItemBreakdownEntry[] = selectedItem
              .employerContributionsJson?.length
              ? selectedItem.employerContributionsJson
              : Array.isArray(rawSelected.employerContributions)
                ? (rawSelected.employerContributions as ItemBreakdownEntry[])
                : Array.isArray(rawSelected.employer_contributions)
                  ? (rawSelected.employer_contributions as ItemBreakdownEntry[])
                  : Array.isArray(rawSelected.employer_contributions_json)
                    ? (rawSelected.employer_contributions_json as ItemBreakdownEntry[])
                    : [];

            const grossVal =
              parseFloat(String(selectedItem.grossEarnings ?? rawSelected.gross_earnings ?? 0)) ||
              0;
            const dedVal =
              parseFloat(
                String(selectedItem.totalDeductions ?? rawSelected.total_deductions ?? 0),
              ) || 0;
            const netVal =
              parseFloat(String(selectedItem.netPay ?? rawSelected.net_pay ?? grossVal - dedVal)) ||
              0;

            const isExempt =
              selectedItem.isExempt ??
              selectedItem.attendanceExempt ??
              isAttendanceExempt(selectedItem, daysInPeriod);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Attendance Snapshot */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <CalendarCheck size={16} color="#4f46e5" />
                    <span>Attendance & Work Days Snapshot</span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '0.75rem',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Payable</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                        {selectedItem.payableDays}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>Present</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#059669' }}>
                        {selectedItem.presentDays}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>LOP Days</div>
                      <div
                        style={{
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: selectedItem.lopDays > 0 ? '#dc2626' : '#059669',
                        }}
                      >
                        {selectedItem.lopDays}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>OT Hours</div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: '#2563eb' }}>
                        {selectedItem.overtimeHours}
                      </div>
                    </div>
                  </div>

                  {/* Executive Attendance Exemption Callout */}
                  {isExempt && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.625rem 0.875rem',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        color: '#065f46',
                        fontSize: '0.75rem',
                      }}
                    >
                      <ShieldCheck size={16} color="#059669" style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700 }}>Attendance Exempt (100% Full Pay)</div>
                        <div style={{ color: '#047857', marginTop: '0.125rem' }}>
                          Executive leadership is exempt from daily punch attendance. 100% base
                          salary is disbursed without Loss of Pay (LOP) deductions.
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Manual Adjustment Form when in Editing Mode */}
                {isEditing && (
                  <form
                    onSubmit={handleSaveCorrection}
                    style={{
                      backgroundColor: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: 'var(--radius-md)',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.875rem',
                          fontWeight: 700,
                          color: '#0f172a',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <Edit3 size={15} color="#4f46e5" />
                        <span>Manual Wage & Line-Item Adjustment</span>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: '#64748b', fontWeight: 600 }}>
                        Cycle: {daysInPeriod} Days
                      </span>
                    </div>

                    {correctionError && (
                      <div
                        style={{
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          color: '#991b1b',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        {correctionError}
                      </div>
                    )}

                    {correctionSuccess && (
                      <div
                        style={{
                          padding: '0.625rem 0.875rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#065f46',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        {correctionSuccess}
                      </div>
                    )}

                    {/* Adjustment Inputs */}
                    <div
                      style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}
                    >
                      <div>
                        <label
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#334155',
                            display: 'block',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Manual Additions / Earnings (₹)
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={correctionForm.manualEarnings || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setCorrectionForm((prev) => ({
                              ...prev,
                              manualEarnings: val,
                              manualAdjustment: val - (prev.manualDeductions || 0),
                            }));
                            if (correctionError) setCorrectionError(null);
                          }}
                        />
                        <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                          e.g. bonus, reimbursement
                        </span>
                      </div>
                      <div>
                        <label
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#334155',
                            display: 'block',
                            marginBottom: '0.25rem',
                          }}
                        >
                          Manual Deductions (₹)
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={correctionForm.manualDeductions || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setCorrectionForm((prev) => ({
                              ...prev,
                              manualDeductions: val,
                              manualAdjustment: (prev.manualEarnings || 0) - val,
                            }));
                            if (correctionError) setCorrectionError(null);
                          }}
                        />
                        <span style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                          e.g. voluntary deduction, recovery
                        </span>
                      </div>
                    </div>

                    {/* Live Recalculation Preview Card */}
                    {(() => {
                      const manualAdd = Number(correctionForm.manualEarnings) || 0;
                      const manualDed = Number(correctionForm.manualDeductions) || 0;
                      const netAdj = manualAdd - manualDed;
                      const baseGross = parseFloat(String(selectedItem.grossEarnings || 0));
                      const baseDed = parseFloat(String(selectedItem.totalDeductions || 0));
                      const recalcNet = Math.max(0, baseGross + manualAdd - baseDed - manualDed);

                      return (
                        <div
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.375rem',
                            fontSize: '0.75rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              color: '#64748b',
                            }}
                          >
                            <span>Base Gross: {formatCurrency(baseGross)}</span>
                            <span>Base Deductions: -{formatCurrency(baseDed)}</span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingTop: '0.35rem',
                              borderTop: '1px dashed #e2e8f0',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: '#334155' }}>
                              Net Manual Adjustment:
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: netAdj > 0 ? '#059669' : netAdj < 0 ? '#dc2626' : '#64748b',
                              }}
                            >
                              {netAdj > 0 ? `+${formatCurrency(netAdj)}` : formatCurrency(netAdj)}
                            </span>
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              paddingTop: '0.35rem',
                              borderTop: '1px solid #e2e8f0',
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>
                              Recalculated Net Salary:
                            </span>
                            <span
                              style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#059669' }}
                            >
                              {formatCurrency(recalcNet)}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Adjustment Remarks / Notes */}
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.25rem',
                        }}
                      >
                        <label
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#334155',
                          }}
                        >
                          Adjustment Remarks / Notes
                        </label>
                        {((Number(correctionForm.manualEarnings) || 0) > 0 ||
                          (Number(correctionForm.manualDeductions) || 0) > 0 ||
                          (Number(correctionForm.manualAdjustment) || 0) !== 0) && (
                          <span
                            style={{ fontSize: '0.6875rem', color: '#dc2626', fontWeight: 600 }}
                          >
                            * Mandatory for adjustments
                          </span>
                        )}
                      </div>
                      <Input
                        placeholder="e.g. Executive performance incentive approved by Board"
                        value={correctionForm.notes || correctionForm.remarks || ''}
                        onChange={(e) => {
                          setCorrectionForm({
                            ...correctionForm,
                            notes: e.target.value,
                            remarks: e.target.value,
                          });
                          if (correctionError) setCorrectionError(null);
                        }}
                      />
                    </div>

                    {/* Attendance Day Overrides (Optional) */}
                    <div
                      style={{
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '0.75rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#64748b',
                          marginBottom: '0.5rem',
                        }}
                      >
                        Attendance Day Corrections (Optional)
                      </div>
                      <div
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}
                      >
                        <div>
                          <label
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              color: '#64748b',
                              display: 'block',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Override LOP Days
                          </label>
                          <Input
                            type="number"
                            value={correctionForm.lopDays ?? 0}
                            onChange={(e) => {
                              const newLop = parseFloat(e.target.value) || 0;
                              const newPresent = Math.max(0, daysInPeriod - newLop);
                              setCorrectionForm((prev) => ({
                                ...prev,
                                lopDays: newLop,
                                presentDays: newPresent,
                                payableDays: newPresent,
                              }));
                            }}
                          />
                        </div>
                        <div>
                          <label
                            style={{
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              color: '#64748b',
                              display: 'block',
                              marginBottom: '0.25rem',
                            }}
                          >
                            Present / Payable Days
                          </label>
                          <Input
                            type="number"
                            value={correctionForm.presentDays ?? 0}
                            onChange={(e) => {
                              const newPresent = parseFloat(e.target.value) || 0;
                              const newLop = Math.max(0, daysInPeriod - newPresent);
                              setCorrectionForm((prev) => ({
                                ...prev,
                                presentDays: newPresent,
                                payableDays: newPresent,
                                lopDays: newLop,
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                )}

                {/* Earnings Breakdown */}
                <div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Earnings Breakdown
                  </div>
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                    }}
                  >
                    {earningsList.length > 0 ? (
                      earningsList.map((entry, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.625rem 0.875rem',
                            borderBottom:
                              idx < earningsList.length - 1 ||
                              (selectedItem.manualEarnings && selectedItem.manualEarnings > 0)
                                ? '1px solid #f1f5f9'
                                : 'none',
                            backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <span style={{ color: '#334155' }}>{entry.name}</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>
                            {formatCurrency(entry.amount)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          padding: '0.75rem',
                          color: '#94a3b8',
                          fontSize: '0.8125rem',
                          textAlign: 'center',
                        }}
                      >
                        No earnings calculated
                      </div>
                    )}

                    {/* Manual Earnings Display Entry */}
                    {selectedItem.manualEarnings && selectedItem.manualEarnings > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.625rem 0.875rem',
                          backgroundColor: '#f0fdf4',
                          borderTop: earningsList.length > 0 ? '1px solid #bbf7d0' : 'none',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div>
                          <div style={{ color: '#166534', fontWeight: 600 }}>
                            Manual Additional Earnings
                          </div>
                          {selectedItem.notes && (
                            <div
                              style={{
                                fontSize: '0.6875rem',
                                color: '#15803d',
                                marginTop: '0.125rem',
                              }}
                            >
                              Note: {selectedItem.notes}
                            </div>
                          )}
                        </div>
                        <span style={{ fontWeight: 700, color: '#16a34a' }}>
                          + {formatCurrency(selectedItem.manualEarnings)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Deductions Breakdown */}
                <div>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      marginBottom: '0.5rem',
                    }}
                  >
                    Deductions Breakdown
                  </div>
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Explicitly show that no LOP deduction was applied */}
                    {selectedItem.lopDays === 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.625rem 0.875rem',
                          borderBottom: deductionsList.length > 0 ? '1px solid #dcfce7' : 'none',
                          backgroundColor: '#f0fdf4',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <span
                          style={{
                            color: '#166534',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <CheckCircle size={14} color="#16a34a" />
                          <span>Loss of Pay (LOP) Deduction</span>
                          <span
                            style={{ fontSize: '0.6875rem', color: '#15803d', fontWeight: 500 }}
                          >
                            {isExempt ? '(Attendance Exempt - 100% Full Pay)' : '(0 Days LOP)'}
                          </span>
                        </span>
                        <span style={{ fontWeight: 600, color: '#16a34a' }}>₹0 (None)</span>
                      </div>
                    )}

                    {deductionsList.length > 0
                      ? deductionsList.map((entry, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.625rem 0.875rem',
                              borderBottom:
                                idx < deductionsList.length - 1 ||
                                (selectedItem.manualDeductions && selectedItem.manualDeductions > 0)
                                  ? '1px solid #f1f5f9'
                                  : 'none',
                              backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                              fontSize: '0.8125rem',
                            }}
                          >
                            <span style={{ color: '#334155' }}>
                              {entry.name} {entry.isStatutory && '(Statutory)'}
                            </span>
                            <span style={{ fontWeight: 600, color: '#dc2626' }}>
                              - {formatCurrency(entry.amount)}
                            </span>
                          </div>
                        ))
                      : selectedItem.lopDays !== 0 && (
                          <div
                            style={{
                              padding: '0.75rem',
                              color: '#94a3b8',
                              fontSize: '0.8125rem',
                              textAlign: 'center',
                            }}
                          >
                            No deductions
                          </div>
                        )}

                    {/* Manual Deductions Display Entry */}
                    {selectedItem.manualDeductions && selectedItem.manualDeductions > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.625rem 0.875rem',
                          backgroundColor: '#fef2f2',
                          borderTop: '1px solid #fecaca',
                          fontSize: '0.8125rem',
                        }}
                      >
                        <div>
                          <div style={{ color: '#991b1b', fontWeight: 600 }}>
                            Manual Special Deductions
                          </div>
                          {selectedItem.notes && (
                            <div
                              style={{
                                fontSize: '0.6875rem',
                                color: '#b91c1c',
                                marginTop: '0.125rem',
                              }}
                            >
                              Note: {selectedItem.notes}
                            </div>
                          )}
                        </div>
                        <span style={{ fontWeight: 700, color: '#dc2626' }}>
                          - {formatCurrency(selectedItem.manualDeductions)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Employer Contributions */}
                {employerContributionsList.length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        marginBottom: '0.5rem',
                      }}
                    >
                      Employer Contributions (CTC)
                    </div>
                    <div
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                      }}
                    >
                      {employerContributionsList.map((entry, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.625rem 0.875rem',
                            borderBottom:
                              idx < employerContributionsList.length - 1
                                ? '1px solid #f1f5f9'
                                : 'none',
                            backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <span style={{ color: '#334155' }}>{entry.name}</span>
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>
                            {formatCurrency(entry.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final Totals Summary Card */}
                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                  }}
                >
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}
                  >
                    <span>Gross Earnings</span>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>
                      {formatCurrency(grossVal)}
                    </span>
                  </div>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}
                  >
                    <span>Total Deductions</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>
                      - {formatCurrency(dedVal)}
                    </span>
                  </div>

                  {/* Show Net Manual Adjustment if non-zero */}
                  {selectedItem.manualAdjustment !== undefined &&
                    selectedItem.manualAdjustment !== 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: (selectedItem.manualAdjustment || 0) > 0 ? '#059669' : '#dc2626',
                          fontWeight: 600,
                        }}
                      >
                        <span>Net Manual Adjustment</span>
                        <span>
                          {(selectedItem.manualAdjustment || 0) > 0 ? '+' : ''}
                          {formatCurrency(selectedItem.manualAdjustment || 0)}
                        </span>
                      </div>
                    )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '0.5rem',
                      borderTop: '1px solid #e2e8f0',
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#059669',
                    }}
                  >
                    <span>Net Pay</span>
                    <span>{formatCurrency(netVal)}</span>
                  </div>

                  {selectedItem.notes && (
                    <div
                      style={{
                        marginTop: '0.35rem',
                        paddingTop: '0.35rem',
                        borderTop: '1px dashed #e2e8f0',
                        fontSize: '0.75rem',
                        color: '#64748b',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Adjustment Note:</span> {selectedItem.notes}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
      </Drawer>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        isLoading={isActionLoading}
        title={
          confirmAction === 'calculate'
            ? 'Calculate Payroll Batch?'
            : confirmAction === 'approve'
              ? 'Approve Payroll Run?'
              : confirmAction === 'finalize'
                ? 'Finalize & Lock Payroll Run?'
                : 'Cancel Payroll Run?'
        }
        description={
          confirmAction === 'calculate'
            ? 'This will fetch attendance records and evaluate contractual salary structures for all eligible employees.'
            : confirmAction === 'approve'
              ? 'This will mark the payroll batch as approved and prepare it for final disbursement.'
              : confirmAction === 'finalize'
                ? 'FINALIZING IS IMMUTABLE. Once finalized, no further edits, calculations, or adjustments can be made. Employee payslips will be generated.'
                : 'Are you sure you want to cancel this payroll batch? You can create a fresh draft run afterwards.'
        }
        confirmLabel={
          confirmAction === 'calculate'
            ? 'Start Calculation'
            : confirmAction === 'approve'
              ? 'Approve Run'
              : confirmAction === 'finalize'
                ? 'Finalize Run'
                : 'Yes, Cancel Run'
        }
        isDestructive={confirmAction === 'cancel' || confirmAction === 'finalize'}
      />
    </div>
  );
}
