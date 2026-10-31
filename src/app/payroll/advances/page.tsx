'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Banknote,
  Plus,
  Search,
  Filter,
  FileText,
  Printer,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRightCircle,
  DollarSign,
  TrendingUp,
  RotateCcw,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { StatCard } from '@/components/atoms/stat-card';
import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Modal } from '@/components/molecules/modal';
import { Drawer } from '@/components/molecules/drawer';
import { EmptyState } from '@/components/molecules/empty-state';
import { SalaryAdvanceService as salaryAdvanceApi } from '@/features/payroll/services/salary-advance.service';
import { EmployeeLookupService } from '@/features/employees/services/employee-lookup.service';
import type {
  SalaryAdvance,
  SalaryAdvanceSummaryMetrics,
  SalaryAdvanceSlipData,
  SalaryAdvanceStatus,
  SalaryAdvanceSettlementType,
} from '@/types/salary-advance';
import type { EmployeeSummary } from '@/types/payroll';
import { formatCurrency, formatIndianNumber } from '@/lib/format-currency';

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

export default function SalaryAdvanceManagementPage() {
  // Main Data States
  const [metrics, setMetrics] = useState<SalaryAdvanceSummaryMetrics | null>(null);
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SalaryAdvanceStatus | 'ALL'>('ALL');
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(10); // October 2026
  const [page, setPage] = useState(1);
  const limit = 15;
  const [totalCount, setTotalCount] = useState(0);

  // Modal / Drawer UI States
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);
  const [activeSlip, setActiveSlip] = useState<SalaryAdvanceSlipData | null>(null);
  const [isLoadingSlip, setIsLoadingSlip] = useState(false);

  const [isLedgerDrawerOpen, setIsLedgerDrawerOpen] = useState(false);
  const [activeAdvance, setActiveAdvance] = useState<SalaryAdvance | null>(null);
  const [isLoadingAdvanceDetails, setIsLoadingAdvanceDetails] = useState(false);

  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settlingAdvance, setSettlingAdvance] = useState<SalaryAdvance | null>(null);
  const [settleType, setSettleType] = useState<SalaryAdvanceSettlementType>('FULL_RECOVERY');
  const [settleAmount, setSettleAmount] = useState<number | ''>('');
  const [settleNotes, setSettleNotes] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  const [cancellingAdvance, setCancellingAdvance] = useState<SalaryAdvance | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Issue Advance Form State
  const [issueEmployeeId, setIssueEmployeeId] = useState('');
  const [issuePrincipal, setIssuePrincipal] = useState<number | ''>(50000);
  const [issueMonthlyDeduction, setIssueMonthlyDeduction] = useState<number | ''>(10000);
  const [issueDisbursementDate, setIssueDisbursementDate] = useState(
    new Date().toISOString().split('T')[0] || '2026-10-29',
  );
  const [issueFirstYear, setIssueFirstYear] = useState<number>(2026);
  const [issueFirstMonth, setIssueFirstMonth] = useState<number>(11); // November
  const [issueRemarks, setIssueRemarks] = useState('');
  const [issueConflictError, setIssueConflictError] = useState<string | null>(null);
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);

  // Employee Map for quick lookup
  const employeeMap = useMemo(() => {
    const map = new Map<string, EmployeeSummary>();
    for (const emp of employees) {
      map.set(emp.id, emp);
    }
    return map;
  }, [employees]);

  // Load Data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch Metrics & Advances in parallel
      const [metricsData, advancesRes, employeesList] = await Promise.all([
        salaryAdvanceApi.getMetrics(selectedYear, selectedMonth).catch((err) => {
          console.warn('Failed to load advance metrics:', err);
          return null;
        }),
        salaryAdvanceApi.listAdvances({
          page,
          limit,
          status: statusFilter,
          search: searchQuery.trim() || undefined,
          periodYear: selectedYear,
        }),
        EmployeeLookupService.searchEmployees('', 100).catch((err) => {
          console.warn('Failed to load employee list:', err);
          return [];
        }),
      ]);

      setMetrics(metricsData);
      setAdvances(advancesRes.data || []);
      setTotalCount(advancesRes.total || advancesRes.data?.length || 0);
      setEmployees(employeesList || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch salary advances';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, statusFilter, searchQuery, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-dismiss temporary feedback
  useEffect(() => {
    if (feedbackMessage) {
      const timer = setTimeout(() => setFeedbackMessage(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [feedbackMessage]);

  // Calculated duration for issue form
  const estimatedDurationMonths = useMemo(() => {
    const p = typeof issuePrincipal === 'number' ? issuePrincipal : 0;
    const m = typeof issueMonthlyDeduction === 'number' ? issueMonthlyDeduction : 0;
    if (p > 0 && m > 0) {
      return Math.ceil(p / m);
    }
    return 0;
  }, [issuePrincipal, issueMonthlyDeduction]);

  const targetCompletionDate = useMemo(() => {
    if (estimatedDurationMonths <= 0) return '';
    const totalMonths = issueFirstYear * 12 + (issueFirstMonth - 1) + (estimatedDurationMonths - 1);
    const targetY = Math.floor(totalMonths / 12);
    const targetM = (totalMonths % 12) + 1;
    return `${MONTH_NAMES[targetM - 1]} ${targetY}`;
  }, [issueFirstYear, issueFirstMonth, estimatedDurationMonths]);

  // Action Handlers
  const handleOpenIssueModal = () => {
    setIssueConflictError(null);
    setIssueEmployeeId(employees[0]?.id || '');
    setIssuePrincipal(50000);
    setIssueMonthlyDeduction(10000);
    setIssueDisbursementDate(new Date().toISOString().split('T')[0] || '2026-10-29');
    setIssueFirstYear(2026);
    setIssueFirstMonth(11);
    setIssueRemarks('');
    setIsIssueModalOpen(true);
  };

  const handleCreateAdvance = async (autoApprove = false) => {
    if (!issueEmployeeId) {
      setIssueConflictError('Please select an employee.');
      return;
    }
    const principal = Number(issuePrincipal);
    const deduction = Number(issueMonthlyDeduction);

    if (isNaN(principal) || principal <= 0) {
      setIssueConflictError('Please enter a valid principal amount.');
      return;
    }
    if (isNaN(deduction) || deduction <= 0) {
      setIssueConflictError('Please enter a valid monthly deduction amount.');
      return;
    }
    if (deduction > principal) {
      setIssueConflictError('Monthly deduction cannot exceed total principal amount.');
      return;
    }

    setIsSubmittingIssue(true);
    setIssueConflictError(null);

    try {
      const created = await salaryAdvanceApi.createAdvance({
        employeeId: issueEmployeeId,
        principalAmount: principal,
        monthlyDeduction: deduction,
        disbursementDate: issueDisbursementDate,
        firstDeductionYear: issueFirstYear,
        firstDeductionMonth: issueFirstMonth,
        remarks: issueRemarks.trim() || undefined,
      });

      if (autoApprove && created.id) {
        await salaryAdvanceApi.approveAdvance(created.id);
      }

      setIsIssueModalOpen(false);
      setFeedbackMessage({
        type: 'success',
        text: autoApprove
          ? `Advance ${created.advanceReference} created and approved successfully.`
          : `Advance ${created.advanceReference} drafted successfully.`,
      });
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to issue advance';
      if (
        msg.toLowerCase().includes('active advance') ||
        msg.toLowerCase().includes('already has') ||
        msg.toLowerCase().includes('conflict') ||
        msg.toLowerCase().includes('409')
      ) {
        setIssueConflictError(
          'Conflict: This employee already has an active advance with an outstanding balance. Complete or settle existing advances before issuing a new one.',
        );
      } else {
        setIssueConflictError(msg);
      }
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleApproveAdvance = async (advance: SalaryAdvance) => {
    try {
      await salaryAdvanceApi.approveAdvance(advance.id);
      setFeedbackMessage({
        type: 'success',
        text: `Advance ${advance.advanceReference} approved. Ready for disbursement.`,
      });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to approve advance');
    }
  };

  const handleIssueDisburseAdvance = async (advance: SalaryAdvance) => {
    try {
      await salaryAdvanceApi.issueAdvance(advance.id);
      setFeedbackMessage({
        type: 'success',
        text: `Advance ${advance.advanceReference} marked as ACTIVE (disbursed). Recovery will start in ${MONTH_NAMES[advance.firstDeductionMonth - 1]} ${advance.firstDeductionYear}.`,
      });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to disburse advance');
    }
  };

  const handleOpenCancelModal = (advance: SalaryAdvance) => {
    setCancellingAdvance(advance);
    setCancelReason('');
  };

  const handleConfirmCancel = async () => {
    if (!cancellingAdvance) return;
    setIsSubmittingCancel(true);
    try {
      await salaryAdvanceApi.cancelAdvance(cancellingAdvance.id, cancelReason.trim() || undefined);
      setFeedbackMessage({
        type: 'success',
        text: `Advance ${cancellingAdvance.advanceReference} has been cancelled.`,
      });
      setCancellingAdvance(null);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to cancel advance');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleOpenSettleModal = (advance: SalaryAdvance) => {
    setSettlingAdvance(advance);
    setSettleType('FULL_RECOVERY');
    setSettleAmount(advance.remainingBalance);
    setSettleNotes('');
    setSettleError(null);
    setIsSettleModalOpen(true);
  };

  const handleConfirmSettle = async () => {
    if (!settlingAdvance) return;
    const amount = Number(settleAmount);
    if (isNaN(amount) || amount < 0) {
      setSettleError('Please specify a valid recovery amount.');
      return;
    }
    if (!settleNotes.trim()) {
      setSettleError('Settlement notes/reference are required for audit trail.');
      return;
    }

    setIsSubmittingSettle(true);
    setSettleError(null);

    try {
      await salaryAdvanceApi.settleAdvance(settlingAdvance.id, {
        settlementType: settleType,
        amountRecovered: amount,
        notes: settleNotes.trim(),
      });
      setIsSettleModalOpen(false);
      setFeedbackMessage({
        type: 'success',
        text: `Advance ${settlingAdvance.advanceReference} successfully settled (${settleType}).`,
      });
      fetchData();
    } catch (err: unknown) {
      setSettleError(err instanceof Error ? err.message : 'Failed to settle advance');
    } finally {
      setIsSubmittingSettle(false);
    }
  };

  const handleViewSlip = async (advance: SalaryAdvance) => {
    setIsLoadingSlip(true);
    setIsSlipModalOpen(true);
    try {
      const slipData = await salaryAdvanceApi.getAdvanceSlip(advance.id);
      setActiveSlip(slipData);
    } catch (err: unknown) {
      console.warn('Failed to load slip:', err);
      // Construct fallback slip from advance + employee map
      const emp = employeeMap.get(advance.employeeId);
      setActiveSlip({
        companyName: 'Urgent Manpower Services',
        advanceReference: advance.advanceReference,
        disbursementDate: advance.disbursementDate,
        employee: {
          id: advance.employeeId,
          fullName: emp
            ? `${emp.firstName} ${emp.lastName}`
            : advance.employee?.fullName || 'Employee',
          employeeCode: emp?.employeeCode || advance.employee?.employeeCode,
          department: emp?.department || advance.employee?.department,
          designation: emp?.designation || advance.employee?.designation,
        },
        financials: {
          principalAmount: advance.principalAmount,
          interestRatePercent: 0,
          plannedMonthlyDeduction: advance.monthlyDeduction,
          firstDeductionPeriod: `${advance.firstDeductionYear}-${String(advance.firstDeductionMonth).padStart(2, '0')}`,
          estimatedDurationMonths:
            advance.monthlyDeduction > 0
              ? Math.ceil(advance.principalAmount / advance.monthlyDeduction)
              : 1,
          openingOutstandingBalance: advance.principalAmount,
          currentOutstandingBalance: advance.remainingBalance,
          totalRecovered: advance.totalRecovered,
        },
        status: advance.status,
        remarks: advance.remarks,
        recoveryHistory: (advance.recoveries || []).map((r) => ({
          periodYear: r.periodYear,
          periodMonth: r.periodMonth,
          openingBalance: r.openingBalance,
          amount: r.amount,
          closingBalance: r.closingBalance,
          status: r.status,
          postedAt: r.postedAt,
        })),
      });
    } finally {
      setIsLoadingSlip(false);
    }
  };

  const handleOpenLedgerDrawer = async (advance: SalaryAdvance) => {
    setActiveAdvance(advance);
    setIsLedgerDrawerOpen(true);
    setIsLoadingAdvanceDetails(true);
    try {
      const full = await salaryAdvanceApi.getAdvanceById(advance.id);
      setActiveAdvance(full);
    } catch {
      // Keep existing row state
    } finally {
      setIsLoadingAdvanceDetails(false);
    }
  };

  // Derive Aggregate metrics
  const totalOutstanding =
    metrics?.totalOutstandingBalance ??
    advances.reduce((acc, a) => acc + (Number(a.remainingBalance) || 0), 0);
  const deductionsThisMonth = metrics?.periodDeductionsAmount ?? 0;
  const advancesIssuedPeriod = metrics?.periodIssuedAmount ?? 0;
  const advancesIssuedCount = metrics?.periodIssuedCount ?? 0;
  const activeAdvancesCount =
    metrics?.activeAdvancesCount ?? advances.filter((a) => a.status === 'ACTIVE').length;

  const totalPrincipalAll = advances.reduce((acc, a) => acc + (Number(a.principalAmount) || 0), 0);
  const totalRecoveredAll = advances.reduce((acc, a) => acc + (Number(a.totalRecovered) || 0), 0);
  const overallRecoveryRate =
    totalPrincipalAll > 0 ? Math.round((totalRecoveredAll / totalPrincipalAll) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Print Specific CSS */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #advance-slip-print-container,
          #advance-slip-print-container * {
            visibility: visible !important;
          }
          #advance-slip-print-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            background: #ffffff !important;
            color: #0f172a !important;
            z-index: 999999 !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Header & Page Title */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <h1
              style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 700,
                color: 'hsl(var(--text-primary))',
                letterSpacing: '-0.02em',
              }}
            >
              Salary Advance Management
            </h1>
            <Badge variant="purple">0% Interest Benefit</Badge>
          </div>
          <p
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'hsl(var(--text-muted))',
              marginTop: 'var(--space-1)',
            }}
          >
            Issue lump-sum salary advances, configure fixed monthly payroll recoveries, and track
            amortization ledgers.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Button
            variant="secondary"
            size="md"
            onClick={fetchData}
            leftIcon={<RotateCcw size={16} />}
            disabled={isLoading}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={handleOpenIssueModal}
            leftIcon={<Plus size={16} />}
            style={{
              backgroundColor: 'hsl(var(--color-brand-accent))',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            + Issue Salary Advance
          </Button>
        </div>
      </div>

      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor:
              feedbackMessage.type === 'success'
                ? 'hsl(var(--color-success-bg))'
                : 'hsl(var(--color-danger-bg))',
            border: `1px solid ${
              feedbackMessage.type === 'success'
                ? 'hsl(var(--color-success) / 0.3)'
                : 'hsl(var(--color-danger) / 0.3)'
            }`,
            borderRadius: 'var(--radius-md)',
            color:
              feedbackMessage.type === 'success'
                ? 'hsl(var(--color-success))'
                : 'hsl(var(--color-danger))',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Error alert if any */}
      {error && (
        <div
          style={{
            padding: 'var(--space-4)',
            backgroundColor: 'hsl(var(--color-danger-bg))',
            border: '1px solid hsl(var(--color-danger) / 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'hsl(var(--color-danger))',
            fontSize: 'var(--font-size-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      )}

      {/* 5 Summary KPI Cards (Component A) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <StatCard
          title="Active Advances"
          value={formatIndianNumber(activeAdvancesCount)}
          icon={<Banknote size={22} />}
          theme="blue"
          subtext="Under active monthly recovery"
        />
        <StatCard
          title="Total Outstanding"
          value={formatCurrency(totalOutstanding)}
          icon={<TrendingUp size={22} />}
          theme="amber"
          subtext="Pending company recoveries"
        />
        <StatCard
          title="Deductions This Month"
          value={formatCurrency(deductionsThisMonth)}
          icon={<DollarSign size={22} />}
          theme="green"
          trend={{ value: 'Scheduled', isPositive: true, label: 'in current run' }}
        />
        <StatCard
          title="Advances Issued (Period)"
          value={formatCurrency(advancesIssuedPeriod)}
          icon={<Sparkles size={22} />}
          theme="cyan"
          subtext={`${advancesIssuedCount} advances disbursed`}
        />
        <StatCard
          title="Overall Recovery Rate"
          value={`${overallRecoveryRate}%`}
          icon={<CheckCircle2 size={22} />}
          theme="purple"
          subtext={`${formatCurrency(totalRecoveredAll)} total recovered`}
        />
      </div>

      {/* Filter Bar (Component B) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-3)',
          backgroundColor: 'hsl(var(--bg-surface))',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid hsl(var(--border-subtle))',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '420px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 'var(--space-3)',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--text-muted))',
            }}
          />
          <Input
            placeholder="Search by Employee, Code, or Ref (e.g. ADV-2026)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{ paddingLeft: 'var(--space-8)' }}
          />
        </div>

        {/* Status Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Filter size={16} color="hsl(var(--text-muted))" />
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'hsl(var(--text-muted))',
            }}
          >
            Status:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as SalaryAdvanceStatus | 'ALL');
              setPage(1);
            }}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid hsl(var(--border-subtle))',
              backgroundColor: 'hsl(var(--bg-secondary))',
              color: 'hsl(var(--text-primary))',
              fontSize: 'var(--font-size-sm)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active (Disbursed)</option>
            <option value="APPROVED">Approved (Pending Disbursement)</option>
            <option value="DRAFT">Draft</option>
            <option value="COMPLETED">Completed (Settled)</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Month & Year Filter Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Calendar size={16} color="hsl(var(--text-muted))" />
          <select
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(Number(e.target.value));
              setPage(1);
            }}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid hsl(var(--border-subtle))',
              backgroundColor: 'hsl(var(--bg-secondary))',
              color: 'hsl(var(--text-primary))',
              fontSize: 'var(--font-size-sm)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(Number(e.target.value));
              setPage(1);
            }}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid hsl(var(--border-subtle))',
              backgroundColor: 'hsl(var(--bg-secondary))',
              color: 'hsl(var(--text-primary))',
              fontSize: 'var(--font-size-sm)',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2027}>2027</option>
          </select>
        </div>
      </div>

      {/* Main Advances Table (Component B) */}
      <div
        style={{
          backgroundColor: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'hsl(var(--bg-secondary))',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                }}
              >
                <th
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontWeight: 600,
                    color: 'hsl(var(--text-secondary))',
                  }}
                >
                  Employee
                </th>
                <th
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontWeight: 600,
                    color: 'hsl(var(--text-secondary))',
                  }}
                >
                  Advance Ref
                </th>
                <th
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontWeight: 600,
                    color: 'hsl(var(--text-secondary))',
                  }}
                >
                  Principal (0% Int)
                </th>
                <th
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontWeight: 600,
                    color: 'hsl(var(--text-secondary))',
                  }}
                >
                  Monthly Deduction
                </th>
                <th
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontWeight: 600,
                    color: 'hsl(var(--text-secondary))',
                  }}
                >
                  First Deduction
                </th>
                <th
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontWeight: 600,
                    color: 'hsl(var(--text-secondary))',
                    minWidth: '220px',
                  }}
                >
                  Recovery Progress
                </th>
                <th
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontWeight: 600,
                    color: 'hsl(var(--text-secondary))',
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontWeight: 600,
                    color: 'hsl(var(--text-secondary))',
                    textAlign: 'right',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: '3px solid hsl(var(--border-subtle))',
                          borderTopColor: 'hsl(var(--color-brand-accent))',
                          animation: 'spin 1s linear infinite',
                        }}
                      />
                      <span
                        style={{
                          color: 'hsl(var(--text-muted))',
                          fontSize: 'var(--font-size-sm)',
                        }}
                      >
                        Loading salary advances...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : advances.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 'var(--space-8)' }}>
                    <EmptyState
                      title="No Salary Advances Found"
                      description={
                        searchQuery || statusFilter !== 'ALL'
                          ? 'Try adjusting your filters or search keywords.'
                          : 'No salary advances have been issued yet. Click "+ Issue Salary Advance" to disburse the first advance.'
                      }
                      actionLabel="+ Issue Advance"
                      onAction={handleOpenIssueModal}
                    />
                  </td>
                </tr>
              ) : (
                advances.map((advance) => {
                  const emp = employeeMap.get(advance.employeeId);
                  const fullName = emp
                    ? `${emp.firstName} ${emp.lastName}`
                    : advance.employee?.fullName || 'Employee';
                  const initials = fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  const empCode = emp?.employeeCode || advance.employee?.employeeCode || '—';
                  const dept = emp?.department || advance.employee?.department || 'General';

                  const principal = Number(advance.principalAmount) || 0;
                  const recovered = Number(advance.totalRecovered) || 0;
                  const remaining = Number(advance.remainingBalance) || 0;
                  const progressPct =
                    principal > 0 ? Math.min(100, Math.round((recovered / principal) * 100)) : 0;

                  return (
                    <tr
                      key={advance.id}
                      style={{
                        borderBottom: '1px solid hsl(var(--border-subtle))',
                        transition: 'background-color var(--transition-fast)',
                      }}
                    >
                      {/* Employee Cell */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}
                        >
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--radius-full)',
                              backgroundColor: 'hsl(var(--color-brand-accent) / 0.15)',
                              color: 'hsl(var(--color-brand-accent))',
                              fontWeight: 700,
                              fontSize: 'var(--font-size-xs)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div
                              style={{
                                fontWeight: 600,
                                color: 'hsl(var(--text-primary))',
                                lineHeight: 1.2,
                              }}
                            >
                              {fullName}
                            </div>
                            <div
                              style={{
                                fontSize: '0.6875rem',
                                color: 'hsl(var(--text-muted))',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-1)',
                                marginTop: '2px',
                              }}
                            >
                              <span style={{ fontFamily: 'monospace' }}>{empCode}</span>
                              <span>•</span>
                              <span>{dept}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Advance Reference */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            fontSize: 'var(--font-size-xs)',
                            backgroundColor: 'hsl(var(--bg-secondary))',
                            padding: '2px var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid hsl(var(--border-subtle))',
                            color: 'hsl(var(--text-primary))',
                          }}
                        >
                          {advance.advanceReference}
                        </span>
                      </td>

                      {/* Principal Amount */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div>
                          <div
                            className="tabular-nums"
                            style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}
                          >
                            {formatCurrency(principal)}
                          </div>
                          <div
                            style={{
                              fontSize: '0.6875rem',
                              color: 'hsl(var(--color-success))',
                              fontWeight: 600,
                            }}
                          >
                            0% Interest Free
                          </div>
                        </div>
                      </td>

                      {/* Monthly Deduction */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div
                          className="tabular-nums"
                          style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}
                        >
                          {formatCurrency(advance.monthlyDeduction)}
                          <span
                            style={{
                              fontSize: '0.6875rem',
                              color: 'hsl(var(--text-muted))',
                              fontWeight: 400,
                              marginLeft: '2px',
                            }}
                          >
                            / mo
                          </span>
                        </div>
                      </td>

                      {/* First Deduction */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500 }}>
                          {MONTH_NAMES[advance.firstDeductionMonth - 1]}{' '}
                          {advance.firstDeductionYear}
                        </div>
                        <div
                          style={{
                            fontSize: '0.6875rem',
                            color: 'hsl(var(--text-muted))',
                            marginTop: '2px',
                          }}
                        >
                          Disbursed: {advance.disbursementDate}
                        </div>
                      </td>

                      {/* Recovery Progress Bar */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--space-1)',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: '0.6875rem',
                            }}
                          >
                            <span style={{ fontWeight: 600, color: 'hsl(var(--color-success))' }}>
                              ₹{formatIndianNumber(recovered)} ({progressPct}%)
                            </span>
                            <span style={{ color: 'hsl(var(--text-muted))' }}>
                              Bal: ₹{formatIndianNumber(remaining)}
                            </span>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: '6px',
                              backgroundColor: 'hsl(var(--bg-secondary))',
                              borderRadius: 'var(--radius-full)',
                              overflow: 'hidden',
                              border: '1px solid hsl(var(--border-subtle))',
                            }}
                          >
                            <div
                              style={{
                                width: `${progressPct}%`,
                                height: '100%',
                                backgroundColor:
                                  progressPct === 100
                                    ? 'hsl(var(--color-purple))'
                                    : 'hsl(var(--color-brand-accent))',
                                transition: 'width 300ms ease',
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge status={advance.status} />
                      </td>

                      {/* Action Buttons */}
                      <td
                        style={{
                          padding: 'var(--space-3) var(--space-4)',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 'var(--space-1)',
                          }}
                        >
                          {/* Slip Preview Button */}
                          <button
                            title="Preview / Print Advance Slip"
                            onClick={() => handleViewSlip(advance)}
                            style={{
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'hsl(var(--bg-secondary))',
                              border: '1px solid hsl(var(--border-subtle))',
                              color: 'hsl(var(--text-secondary))',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            <FileText size={14} />
                            <span>Slip</span>
                          </button>

                          {/* Ledger Drawer Button */}
                          <button
                            title="View Recovery Ledger & Amortization"
                            onClick={() => handleOpenLedgerDrawer(advance)}
                            style={{
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--radius-md)',
                              backgroundColor: 'hsl(var(--bg-secondary))',
                              border: '1px solid hsl(var(--border-subtle))',
                              color: 'hsl(var(--text-secondary))',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: 'var(--font-size-xs)',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            <History size={14} />
                            <span>Ledger</span>
                          </button>

                          {/* Contextual Actions based on status */}
                          {advance.status === 'DRAFT' && (
                            <>
                              <button
                                title="Approve Advance"
                                onClick={() => handleApproveAdvance(advance)}
                                style={{
                                  padding: 'var(--space-1) var(--space-2)',
                                  borderRadius: 'var(--radius-md)',
                                  backgroundColor: 'hsl(var(--color-success-bg))',
                                  border: '1px solid hsl(var(--color-success) / 0.3)',
                                  color: 'hsl(var(--color-success))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <CheckCircle2 size={14} />
                                <span>Approve</span>
                              </button>
                              <button
                                title="Cancel Advance"
                                onClick={() => handleOpenCancelModal(advance)}
                                style={{
                                  padding: 'var(--space-1) var(--space-2)',
                                  borderRadius: 'var(--radius-md)',
                                  backgroundColor: 'hsl(var(--color-danger-bg))',
                                  border: '1px solid hsl(var(--color-danger) / 0.3)',
                                  color: 'hsl(var(--color-danger))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontSize: 'var(--font-size-xs)',
                                  cursor: 'pointer',
                                }}
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}

                          {advance.status === 'APPROVED' && (
                            <>
                              <button
                                title="Disburse & Issue Advance"
                                onClick={() => handleIssueDisburseAdvance(advance)}
                                style={{
                                  padding: 'var(--space-1) var(--space-2)',
                                  borderRadius: 'var(--radius-md)',
                                  backgroundColor: 'hsl(var(--color-brand-accent))',
                                  border: 'none',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: 'var(--font-size-xs)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <ArrowRightCircle size={14} />
                                <span>Disburse</span>
                              </button>
                              <button
                                title="Cancel Advance"
                                onClick={() => handleOpenCancelModal(advance)}
                                style={{
                                  padding: 'var(--space-1) var(--space-2)',
                                  borderRadius: 'var(--radius-md)',
                                  backgroundColor: 'hsl(var(--color-danger-bg))',
                                  border: '1px solid hsl(var(--color-danger) / 0.3)',
                                  color: 'hsl(var(--color-danger))',
                                  display: 'flex',
                                  alignItems: 'center',
                                  fontSize: 'var(--font-size-xs)',
                                  cursor: 'pointer',
                                }}
                              >
                                <XCircle size={14} />
                              </button>
                            </>
                          )}

                          {advance.status === 'ACTIVE' && (
                            <button
                              title="Settle Advance Manually"
                              onClick={() => handleOpenSettleModal(advance)}
                              style={{
                                padding: 'var(--space-1) var(--space-2)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'hsl(var(--bg-secondary))',
                                border: '1px solid hsl(var(--border-subtle))',
                                color: 'hsl(var(--color-brand-accent))',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <DollarSign size={14} />
                              <span>Settle</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Summary & Pagination */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid hsl(var(--border-subtle))',
            backgroundColor: 'hsl(var(--bg-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 'var(--font-size-xs)',
            color: 'hsl(var(--text-muted))',
          }}
        >
          <span>
            Showing <strong>{advances.length}</strong> of <strong>{totalCount}</strong> advances
          </span>
          {totalCount > limit && (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page * limit >= totalCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Component C: Issue Salary Advance Modal                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => !isSubmittingIssue && setIsIssueModalOpen(false)}
        title="Issue Salary Advance"
        maxWidth="600px"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateAdvance(false);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        >
          {/* Conflict Alert Banner (Section 3 of Guide) */}
          {issueConflictError && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'hsl(var(--color-danger-bg))',
                border: '1px solid hsl(var(--color-danger) / 0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'hsl(var(--color-danger))',
                fontSize: 'var(--font-size-sm)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2)',
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Action Blocked:</strong>
                <p style={{ marginTop: '2px', lineHeight: 1.4 }}>{issueConflictError}</p>
              </div>
            </div>
          )}

          {/* Employee Selection */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'hsl(var(--text-secondary))',
                marginBottom: 'var(--space-1)',
              }}
            >
              Select Employee <span style={{ color: 'hsl(var(--color-danger))' }}>*</span>
            </label>
            <select
              value={issueEmployeeId}
              onChange={(e) => setIssueEmployeeId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid hsl(var(--border-subtle))',
                backgroundColor: 'hsl(var(--bg-surface))',
                color: 'hsl(var(--text-primary))',
                fontSize: 'var(--font-size-sm)',
                outline: 'none',
              }}
            >
              <option value="">-- Choose an Employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeCode}) —{' '}
                  {emp.department || 'General'}
                </option>
              ))}
            </select>
          </div>

          {/* Principal & Monthly Deduction Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--space-3)',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Principal Amount (₹) <span style={{ color: 'hsl(var(--color-danger))' }}>*</span>
              </label>
              <Input
                type="number"
                min="1000"
                step="500"
                placeholder="50000"
                value={issuePrincipal}
                onChange={(e) =>
                  setIssuePrincipal(e.target.value === '' ? '' : Number(e.target.value))
                }
                required
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Monthly Deduction (₹) <span style={{ color: 'hsl(var(--color-danger))' }}>*</span>
              </label>
              <Input
                type="number"
                min="500"
                step="500"
                placeholder="10000"
                value={issueMonthlyDeduction}
                onChange={(e) =>
                  setIssueMonthlyDeduction(e.target.value === '' ? '' : Number(e.target.value))
                }
                required
              />
            </div>
          </div>

          {/* Disbursement Date & First Deduction Period Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 'var(--space-3)',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Disbursement Date
              </label>
              <Input
                type="date"
                value={issueDisbursementDate}
                onChange={(e) => setIssueDisbursementDate(e.target.value)}
                required
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: 'var(--space-1)',
                }}
              >
                First Deduction Cycle <span style={{ color: 'hsl(var(--color-danger))' }}>*</span>
              </label>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <select
                  value={issueFirstMonth}
                  onChange={(e) => setIssueFirstMonth(Number(e.target.value))}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid hsl(var(--border-subtle))',
                    backgroundColor: 'hsl(var(--bg-surface))',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={issueFirstYear}
                  onChange={(e) => setIssueFirstYear(Number(e.target.value))}
                  style={{
                    width: '90px',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid hsl(var(--border-subtle))',
                    backgroundColor: 'hsl(var(--bg-surface))',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                  <option value={2028}>2028</option>
                </select>
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'hsl(var(--text-secondary))',
                marginBottom: 'var(--space-1)',
              }}
            >
              Remarks / Purpose (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Medical contingency, Festival advance, Relocation expense..."
              value={issueRemarks}
              onChange={(e) => setIssueRemarks(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid hsl(var(--border-subtle))',
                backgroundColor: 'hsl(var(--bg-surface))',
                color: 'hsl(var(--text-primary))',
                fontSize: 'var(--font-size-sm)',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          {/* Live Repayment Callout & Verification Summary */}
          {estimatedDurationMonths > 0 && (
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'hsl(var(--bg-secondary))',
                border: '1px solid hsl(var(--border-subtle))',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--color-brand-accent))',
                }}
              >
                <span>Repayment Summary (0% Interest Free)</span>
                <span>{estimatedDurationMonths} Payroll Cycles</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-2)',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <div>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Principal:</span>
                  <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                    {formatCurrency(Number(issuePrincipal))}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Deduction / Mo:</span>
                  <div style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                    {formatCurrency(Number(issueMonthlyDeduction))}
                  </div>
                </div>
                <div>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Target Clearance:</span>
                  <div style={{ fontWeight: 700, color: 'hsl(var(--color-success))' }}>
                    {targetCompletionDate}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-2)',
            }}
          >
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsIssueModalOpen(false)}
              disabled={isSubmittingIssue}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              disabled={isSubmittingIssue}
              isLoading={isSubmittingIssue}
            >
              Save as Draft
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => handleCreateAdvance(true)}
              disabled={isSubmittingIssue}
              isLoading={isSubmittingIssue}
              style={{ backgroundColor: 'hsl(var(--color-brand-accent))' }}
            >
              Save & Approve
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* Component D: Printable Advance Slip Modal (Voucher)                       */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isSlipModalOpen}
        onClose={() => setIsSlipModalOpen(false)}
        title="Advance Salary Voucher"
        maxWidth="720px"
      >
        {isLoadingSlip || !activeSlip ? (
          <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
            <span style={{ color: 'hsl(var(--text-muted))' }}>Generating voucher preview...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* The Printable Container */}
            <div
              id="advance-slip-print-container"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-6)',
                color: '#0f172a',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-5)',
              }}
            >
              {/* Slip Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderBottom: '2px solid #0f172a',
                  paddingBottom: 'var(--space-4)',
                }}
              >
                <div>
                  <h2
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {activeSlip.companyName}
                  </h2>
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: '#4f46e5',
                      letterSpacing: '0.05em',
                      marginTop: '2px',
                    }}
                  >
                    SALARY ADVANCE DISBURSEMENT & RECOVERY VOUCHER
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    0% Interest Free Employee Welfare Advance
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.9375rem',
                      color: '#0f172a',
                    }}
                  >
                    {activeSlip.advanceReference}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Disbursed: {activeSlip.disbursementDate}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <Badge status={activeSlip.status} />
                  </div>
                </div>
              </div>

              {/* Employee & Financial Schedule Details */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 'var(--space-4)',
                  backgroundColor: '#f8fafc',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.8125rem',
                }}
              >
                {/* Employee details */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      fontSize: '0.6875rem',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Employee Information
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Name: </span>
                    <strong>{activeSlip.employee.fullName}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Employee Code: </span>
                    <strong style={{ fontFamily: 'monospace' }}>
                      {activeSlip.employee.employeeCode || '—'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Department: </span>
                    <span>{activeSlip.employee.department || 'General'}</span>
                  </div>
                </div>

                {/* Financial details */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      fontSize: '0.6875rem',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Financial Terms
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Principal Amount: </span>
                    <strong>{formatCurrency(activeSlip.financials.principalAmount)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Monthly Deduction: </span>
                    <strong>
                      {formatCurrency(activeSlip.financials.plannedMonthlyDeduction)} / mo
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Amortization Plan: </span>
                    <span>
                      {activeSlip.financials.estimatedDurationMonths} Cycles (First Cycle:{' '}
                      {activeSlip.financials.firstDeductionPeriod})
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Outstanding Balance: </span>
                    <strong style={{ color: '#dc2626' }}>
                      {formatCurrency(activeSlip.financials.currentOutstandingBalance)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Recovery History Table */}
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    color: '#0f172a',
                    marginBottom: 'var(--space-2)',
                  }}
                >
                  Recovery Amortization Ledger
                </div>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.75rem',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                      <th style={{ padding: '6px 8px' }}>Period</th>
                      <th style={{ padding: '6px 8px' }}>Opening Bal</th>
                      <th style={{ padding: '6px 8px' }}>Deducted</th>
                      <th style={{ padding: '6px 8px' }}>Closing Bal</th>
                      <th style={{ padding: '6px 8px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSlip.recoveryHistory && activeSlip.recoveryHistory.length > 0 ? (
                      activeSlip.recoveryHistory.map((rec, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '6px 8px' }}>
                            {MONTH_NAMES[rec.periodMonth - 1]} {rec.periodYear}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            {formatCurrency(rec.openingBalance)}
                          </td>
                          <td
                            style={{
                              padding: '6px 8px',
                              fontWeight: 600,
                              color: '#059669',
                            }}
                          >
                            -{formatCurrency(rec.amount)}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            {formatCurrency(rec.closingBalance)}
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <Badge status={rec.status} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            padding: '12px 8px',
                            textAlign: 'center',
                            color: '#64748b',
                            fontStyle: 'italic',
                          }}
                        >
                          No deductions have been posted yet. Deductions will commence in{' '}
                          {activeSlip.financials.firstDeductionPeriod}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Remarks */}
              {activeSlip.remarks && (
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#64748b',
                    borderTop: '1px dashed #cbd5e1',
                    paddingTop: 'var(--space-2)',
                  }}
                >
                  <strong>Remarks: </strong> {activeSlip.remarks}
                </div>
              )}

              {/* Signatures */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 'var(--space-8)',
                  paddingTop: 'var(--space-4)',
                }}
              >
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderTop: '1px solid #0f172a', marginBottom: '4px' }} />
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#0f172a' }}>
                    EMPLOYEE SIGNATURE
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#64748b' }}>
                    I acknowledge receipt and agree to monthly deductions
                  </div>
                </div>

                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ borderTop: '1px solid #0f172a', marginBottom: '4px' }} />
                  <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#0f172a' }}>
                    AUTHORIZED SIGNATORY
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#64748b' }}>
                    For {activeSlip.companyName}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Buttons (Hidden on Print) */}
            <div
              className="no-print"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 'var(--space-2)',
              }}
            >
              <Button variant="secondary" onClick={() => setIsSlipModalOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                leftIcon={<Printer size={16} />}
                onClick={() => window.print()}
                style={{ backgroundColor: 'hsl(var(--color-brand-accent))' }}
              >
                Print Voucher
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* Component E: Settle Advance Modal                                          */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => !isSubmittingSettle && setIsSettleModalOpen(false)}
        title="Settle Salary Advance"
        maxWidth="500px"
      >
        {settlingAdvance && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmSettle();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
          >
            {settleError && (
              <div
                style={{
                  padding: 'var(--space-3)',
                  backgroundColor: 'hsl(var(--color-danger-bg))',
                  border: '1px solid hsl(var(--color-danger) / 0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: 'hsl(var(--color-danger))',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {settleError}
              </div>
            )}

            {/* Outstanding Summary Callout */}
            <div
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: 'hsl(var(--bg-secondary))',
                borderRadius: 'var(--radius-md)',
                border: '1px solid hsl(var(--border-subtle))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'hsl(var(--text-muted))' }}>
                  Advance Reference
                </div>
                <strong style={{ fontFamily: 'monospace' }}>
                  {settlingAdvance.advanceReference}
                </strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'hsl(var(--text-muted))' }}>
                  Outstanding Balance
                </div>
                <strong
                  style={{
                    fontSize: 'var(--font-size-lg)',
                    color: 'hsl(var(--color-danger))',
                  }}
                >
                  {formatCurrency(settlingAdvance.remainingBalance)}
                </strong>
              </div>
            </div>

            {/* Settlement Type */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Settlement Method / Type{' '}
                <span style={{ color: 'hsl(var(--color-danger))' }}>*</span>
              </label>
              <select
                value={settleType}
                onChange={(e) => setSettleType(e.target.value as SalaryAdvanceSettlementType)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid hsl(var(--border-subtle))',
                  backgroundColor: 'hsl(var(--bg-surface))',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                <option value="FULL_RECOVERY">
                  FULL_RECOVERY (Full payment recovered via Bank/Cash)
                </option>
                <option value="PARTIAL_RECOVERY">
                  PARTIAL_RECOVERY (Partial payment recovered)
                </option>
                <option value="APPROVED_WRITEOFF">
                  APPROVED_WRITEOFF (Management approved debt write-off)
                </option>
                <option value="FINAL_SETTLEMENT">
                  FINAL_SETTLEMENT (Full & Final Separation Clearance)
                </option>
              </select>
            </div>

            {/* Amount Recovered */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Amount Recovered (₹) <span style={{ color: 'hsl(var(--color-danger))' }}>*</span>
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                value={settleAmount}
                onChange={(e) =>
                  setSettleAmount(e.target.value === '' ? '' : Number(e.target.value))
                }
                required
              />
            </div>

            {/* Notes / Reason */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Settlement Notes & Reference{' '}
                <span style={{ color: 'hsl(var(--color-danger))' }}>*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Bank NEFT transaction ref #123456 or Board approval memo dated Oct 28..."
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid hsl(var(--border-subtle))',
                  backgroundColor: 'hsl(var(--bg-surface))',
                  fontSize: 'var(--font-size-sm)',
                  resize: 'none',
                }}
              />
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)',
              }}
            >
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsSettleModalOpen(false)}
                disabled={isSubmittingSettle}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmittingSettle}
                isLoading={isSubmittingSettle}
                style={{ backgroundColor: 'hsl(var(--color-brand-accent))' }}
              >
                Confirm Settlement
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* Component F: Recovery Ledger Drawer                                        */}
      {/* ========================================================================= */}
      <Drawer
        isOpen={isLedgerDrawerOpen}
        onClose={() => setIsLedgerDrawerOpen(false)}
        title="Recovery Ledger & Amortization"
        subtitle={
          activeAdvance
            ? `${activeAdvance.advanceReference} · ${
                employeeMap.get(activeAdvance.employeeId)?.firstName || 'Employee'
              }`
            : undefined
        }
        width="560px"
      >
        {activeAdvance && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Overview Card */}
            <div
              style={{
                backgroundColor: 'hsl(var(--bg-secondary))',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-4)',
                border: '1px solid hsl(var(--border-subtle))',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'hsl(var(--text-muted))' }}>
                    Principal
                  </div>
                  <strong
                    style={{
                      fontSize: 'var(--font-size-lg)',
                      color: 'hsl(var(--text-primary))',
                    }}
                  >
                    {formatCurrency(activeAdvance.principalAmount)}
                  </strong>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'hsl(var(--text-muted))' }}>
                    Recovered
                  </div>
                  <strong
                    style={{
                      fontSize: 'var(--font-size-lg)',
                      color: 'hsl(var(--color-success))',
                    }}
                  >
                    {formatCurrency(activeAdvance.totalRecovered)}
                  </strong>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'hsl(var(--text-muted))' }}>
                    Remaining
                  </div>
                  <strong
                    style={{
                      fontSize: 'var(--font-size-lg)',
                      color: 'hsl(var(--color-danger))',
                    }}
                  >
                    {formatCurrency(activeAdvance.remainingBalance)}
                  </strong>
                </div>
              </div>

              {/* Progress */}
              <div>
                <div
                  style={{
                    height: '8px',
                    width: '100%',
                    backgroundColor: 'hsl(var(--bg-surface))',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                    border: '1px solid hsl(var(--border-subtle))',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${
                        activeAdvance.principalAmount > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (activeAdvance.totalRecovered / activeAdvance.principalAmount) *
                                  100,
                              ),
                            )
                          : 0
                      }%`,
                      backgroundColor: 'hsl(var(--color-brand-accent))',
                    }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                    fontSize: '0.6875rem',
                    color: 'hsl(var(--text-muted))',
                  }}
                >
                  <span>Monthly Plan: {formatCurrency(activeAdvance.monthlyDeduction)} / mo</span>
                  <span>
                    Status: <Badge status={activeAdvance.status} />
                  </span>
                </div>
              </div>
            </div>

            {/* Recovery History Log */}
            <div>
              <h4
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 700,
                  color: 'hsl(var(--text-primary))',
                  marginBottom: 'var(--space-2)',
                }}
              >
                Payroll Recovery Transactions
              </h4>

              {isLoadingAdvanceDetails ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center' }}>
                  <span
                    style={{ fontSize: 'var(--font-size-sm)', color: 'hsl(var(--text-muted))' }}
                  >
                    Loading transactions...
                  </span>
                </div>
              ) : activeAdvance.recoveries && activeAdvance.recoveries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {activeAdvance.recoveries.map((rec) => (
                    <div
                      key={rec.id}
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'hsl(var(--bg-surface))',
                        border: '1px solid hsl(var(--border-subtle))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: 'var(--font-size-xs)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                          {MONTH_NAMES[rec.periodMonth - 1]} {rec.periodYear} Cycle
                        </div>
                        <div
                          style={{
                            color: 'hsl(var(--text-muted))',
                            marginTop: '2px',
                            display: 'flex',
                            gap: 'var(--space-2)',
                          }}
                        >
                          <span>Opening: {formatCurrency(rec.openingBalance)}</span>
                          <span>→</span>
                          <span>Closing: {formatCurrency(rec.closingBalance)}</span>
                        </div>
                        {rec.notes && (
                          <div style={{ color: 'hsl(var(--text-secondary))', marginTop: '2px' }}>
                            {rec.notes}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: 'hsl(var(--color-success))',
                            fontSize: 'var(--font-size-sm)',
                          }}
                        >
                          -{formatCurrency(rec.amount)}
                        </div>
                        <div style={{ marginTop: '2px' }}>
                          <Badge status={rec.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: 'var(--space-6)',
                    textAlign: 'center',
                    backgroundColor: 'hsl(var(--bg-secondary))',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-muted))',
                    fontSize: 'var(--font-size-xs)',
                  }}
                >
                  <p>No recovery deductions have been posted yet.</p>
                  <p style={{ marginTop: '4px' }}>
                    Scheduled to begin automatically during the{' '}
                    <strong>
                      {MONTH_NAMES[activeAdvance.firstDeductionMonth - 1]}{' '}
                      {activeAdvance.firstDeductionYear}
                    </strong>{' '}
                    payroll run.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Cancel Confirmation Modal */}
      {cancellingAdvance && (
        <Modal
          isOpen={!!cancellingAdvance}
          onClose={() => setCancellingAdvance(null)}
          title="Cancel Salary Advance"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'hsl(var(--text-secondary))' }}>
              Are you sure you want to cancel salary advance{' '}
              <strong>{cancellingAdvance.advanceReference}</strong>? This will revoke the request.
            </p>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-secondary))',
                  marginBottom: 'var(--space-1)',
                }}
              >
                Cancellation Reason (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid hsl(var(--border-subtle))',
                  fontSize: 'var(--font-size-sm)',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 'var(--space-2)',
              }}
            >
              <Button
                variant="secondary"
                onClick={() => setCancellingAdvance(null)}
                disabled={isSubmittingCancel}
              >
                Close
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmCancel}
                isLoading={isSubmittingCancel}
                disabled={isSubmittingCancel}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
