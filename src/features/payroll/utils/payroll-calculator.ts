import type {
  PayrollRun,
  PayrollRunItem,
  Payslip,
  SalaryStructure,
  SalaryStructureComponent,
  SalaryComponentCategory,
  CalculationType,
  ItemBreakdownEntry,
  EmployeeSummary,
} from '@/types/payroll';
import { SalaryStructureService } from '@/features/payroll/services/salary-structure.service';

/**
 * Cache for salary structures within the session to avoid redundant API calls
 */
const structureCache = new Map<string, SalaryStructure | null>();

/**
 * Detects whether an employee holds executive status (e.g. CEO, Director, or SUPER_ADMIN security role)
 */
export function isExecutiveEmployee(
  item: PayrollRunItem,
  employee?: EmployeeSummary | null,
): boolean {
  const rawItem = item as unknown as Record<string, unknown>;
  const rawEmp = (item.employee || employee || {}) as unknown as Record<string, unknown>;

  // 1. Explicit boolean flags on item or employee object
  if (
    rawItem.isExecutive === true ||
    rawItem.isExempt === true ||
    rawItem.attendanceExempt === true ||
    rawItem.is_executive === true ||
    rawItem.is_exempt === true ||
    rawItem.attendance_exempt === true ||
    rawEmp.isSuperAdmin === true ||
    rawEmp.is_super_admin === true ||
    rawEmp.isExecutive === true ||
    rawEmp.is_executive === true ||
    rawEmp.isExempt === true ||
    rawEmp.attendanceExempt === true ||
    rawEmp.attendance_exempt === true
  ) {
    return true;
  }

  // 2. Roles array or role string (SUPER_ADMIN, EXECUTIVE, CEO, ADMIN)
  const roleStr = String(rawEmp.role || rawItem.role || '').toUpperCase();
  const rolesArr: string[] = Array.isArray(rawEmp.roles)
    ? (rawEmp.roles as string[]).map((r) => String(r).toUpperCase())
    : [];

  if (
    roleStr === 'SUPER_ADMIN' ||
    roleStr === 'EXECUTIVE' ||
    roleStr.includes('SUPER_ADMIN') ||
    rolesArr.includes('SUPER_ADMIN') ||
    rolesArr.includes('EXECUTIVE')
  ) {
    return true;
  }

  // 3. Designation or job role title matching executive leadership titles
  const designation = String(
    rawEmp.designation ||
      rawEmp.jobRoleName ||
      rawEmp.job_role_name ||
      rawEmp.title ||
      rawItem.designation ||
      '',
  ).toUpperCase();

  const executiveKeywords = [
    'CEO',
    'CHIEF EXECUTIVE',
    'CHIEF EXECUTIVE OFFICER',
    'MANAGING DIRECTOR',
    'SUPER ADMIN',
    'SUPER_ADMIN',
    'EXECUTIVE',
    'PRESIDENT',
    'VICE PRESIDENT',
    'FOUNDER',
    'CO-FOUNDER',
    'CTO',
    'CFO',
    'COO',
  ];

  return executiveKeywords.some((kw) => designation === kw || designation.includes(kw));
}

/**
 * Checks if an employee is Attendance Exempt (100% Full Pay)
 * Condition: lopDays === 0 and payableDays === totalDays (or payableDays >= daysInPeriod) with executive status
 */
export function isAttendanceExempt(item: PayrollRunItem, daysInPeriod: number = 30): boolean {
  const rawItem = item as unknown as Record<string, unknown>;
  const lop = Number(item.lopDays ?? rawItem.lop_days ?? 0);
  const payable = Number(item.payableDays ?? rawItem.payable_days ?? 0);

  // If explicitly flagged as attendance exempt
  if (
    rawItem.attendanceExempt === true ||
    rawItem.isExempt === true ||
    item.attendanceExempt === true ||
    item.isExempt === true ||
    item.employee?.attendanceExempt === true ||
    item.employee?.isExempt === true
  ) {
    return lop === 0;
  }

  // Attendance exempt requires 0 LOP, 100% payable days (>= daysInPeriod), and executive status
  const hasFullAttendance = lop === 0 && payable >= daysInPeriod;
  return hasFullAttendance && isExecutiveEmployee(item);
}

/**
 * Dynamically evaluates a single run item with its contractual salary structure
 * and prorates earnings / statutory deductions against payable days.
 */
function normalizeBreakdownList(list: unknown): ItemBreakdownEntry[] {
  if (!list) return [];
  let parsed = list;
  if (typeof list === 'string') {
    try {
      parsed = JSON.parse(list);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((entry: Record<string, unknown>) => ({
    code: String(entry.code || entry.componentCode || 'UNKNOWN'),
    name: String(
      entry.name ||
        (entry.code || entry.componentCode || '').toString().replace(/_/g, ' ') ||
        'Component',
    ),
    category: (entry.category as SalaryComponentCategory) || 'EARNING',
    amount: typeof entry.amount === 'number' ? entry.amount : parseFloat(String(entry.amount)) || 0,
    isStatutory: Boolean(entry.isStatutory),
    calculationType: entry.calculationType as CalculationType | undefined,
  }));
}

/**
 * Dynamically evaluates a single run item with its contractual salary structure
 * and prorates earnings / statutory deductions against payable days.
 */
export function evaluateRunItemWithStructure(
  item: PayrollRunItem,
  struct: SalaryStructure | null,
  daysInPeriod: number,
): PayrollRunItem {
  const rawItem = item as unknown as Record<string, unknown>;
  const rawPayable = Number(item.payableDays);
  const rawPresent = Number(item.presentDays);
  const rawLop = Number(item.lopDays);

  let payableDays = daysInPeriod;
  let lopDays = 0;
  let presentDays = daysInPeriod;

  if (!isNaN(rawPayable) && rawPayable >= 0 && rawPayable <= daysInPeriod) {
    payableDays = rawPayable;
    lopDays = !isNaN(rawLop) && rawLop >= 0 ? rawLop : Math.max(0, daysInPeriod - payableDays);
    presentDays = !isNaN(rawPresent) && rawPresent >= 0 ? rawPresent : payableDays;
  } else if (!isNaN(rawLop) && rawLop > 0 && rawLop <= daysInPeriod) {
    lopDays = rawLop;
    payableDays = Math.max(0, daysInPeriod - lopDays);
    presentDays = !isNaN(rawPresent) && rawPresent >= 0 ? rawPresent : payableDays;
  } else {
    // Default to full calendar period (standard monthly contract)
    payableDays = daysInPeriod;
    lopDays = 0;
    presentDays = daysInPeriod;
  }

  // 1. Extract already calculated line items from the backend database
  const existingEarnings = normalizeBreakdownList(
    rawItem.earningsJson ?? rawItem.earnings ?? rawItem.earnings_json,
  );
  const existingDeductions = normalizeBreakdownList(
    rawItem.deductionsJson ?? rawItem.deductions ?? rawItem.deductions_json,
  );
  const existingContributions = normalizeBreakdownList(
    rawItem.employerContributionsJson ??
      rawItem.employerContributions ??
      rawItem.employer_contributions ??
      rawItem.employer_contributions_json,
  );

  const rawGross = parseFloat(
    String(rawItem.grossSalary ?? rawItem.grossEarnings ?? rawItem.gross_earnings ?? 0),
  );
  const rawDeductions = parseFloat(
    String(rawItem.totalDeductions ?? rawItem.total_deductions ?? 0),
  );
  const rawNet = parseFloat(String(rawItem.netSalary ?? rawItem.netPay ?? rawItem.net_pay ?? 0));
  const rawEmployerCost = parseFloat(
    String(rawItem.totalEmployerCost ?? rawItem.total_employer_cost ?? (rawGross || 0)),
  );
  const manualEarnings =
    parseFloat(String(rawItem.manualEarnings ?? rawItem.manual_earnings ?? 0)) || 0;
  const manualDeductions =
    parseFloat(String(rawItem.manualDeductions ?? rawItem.manual_deductions ?? 0)) || 0;
  const manualAdjustment =
    parseFloat(
      String(
        rawItem.manualAdjustment ?? rawItem.manual_adjustment ?? manualEarnings - manualDeductions,
      ),
    ) || 0;
  const notes =
    (rawItem.notes as string) || (rawItem.remarks as string) || item.notes || item.remarks;

  const isExempt = isAttendanceExempt({ ...item, lopDays, payableDays }, daysInPeriod);

  // If the run item already has calculated breakdown or non-zero gross from backend calculation engine,
  // we MUST preserve and display the actual calculated values!
  if (existingEarnings.length > 0 || rawGross > 0) {
    const gross = rawGross || existingEarnings.reduce((sum, e) => sum + e.amount, 0);
    const deductions = rawDeductions || existingDeductions.reduce((sum, d) => sum + d.amount, 0);
    // Recalculating netSalary = grossSalary + manualEarnings - totalDeductions - manualDeductions
    const net = rawNet || gross + manualEarnings - deductions - manualDeductions;
    const employerCost = rawEmployerCost || gross;

    return {
      ...item,
      payableDays,
      presentDays,
      lopDays,
      grossEarnings: gross,
      totalDeductions: deductions,
      netPay: net,
      manualEarnings,
      manualDeductions,
      manualAdjustment,
      notes,
      remarks: notes,
      isExecutive: isExecutiveEmployee(item),
      isExempt,
      attendanceExempt: isExempt,
      totalEmployerCost: employerCost,
      earningsJson: existingEarnings,
      deductionsJson: existingDeductions,
      employerContributionsJson: existingContributions,
    };
  }

  // If no contractual structure or 0 payable days
  if (!struct || !struct.components || struct.components.length === 0 || payableDays === 0) {
    return {
      ...item,
      payableDays,
      presentDays,
      lopDays,
      grossEarnings: 0,
      totalDeductions: 0,
      netPay: manualAdjustment,
      manualEarnings,
      manualDeductions,
      manualAdjustment,
      notes,
      remarks: notes,
      isExecutive: isExecutiveEmployee(item),
      isExempt,
      attendanceExempt: isExempt,
      totalEmployerCost: 0,
      earningsJson: [],
      deductionsJson: [],
      employerContributionsJson: [],
    };
  }

  const isDaily = struct.payBasis === 'DAILY';
  const basicComp = struct.components.find(
    (c: SalaryStructureComponent) => c.componentCode === 'BASIC',
  );
  const fullBasic = parseFloat(String(basicComp?.amount || 0)) || 0;
  // For DAILY pay basis: rate * payableDays; For MONTHLY: (fullBasic * payableDays) / daysInPeriod
  const proratedBasic = isDaily
    ? Math.round(fullBasic * payableDays)
    : Math.round((fullBasic * payableDays) / daysInPeriod);

  const computedEarnings: ItemBreakdownEntry[] = [];
  const computedDeductions: ItemBreakdownEntry[] = [];

  for (const comp of struct.components) {
    if (!comp.isActive) continue;
    if (comp.category === 'EARNING') {
      if (comp.componentCode === 'BASIC') {
        computedEarnings.push({
          code: 'BASIC',
          name: 'Basic Pay',
          category: 'EARNING',
          amount: proratedBasic,
        });
      } else if (comp.calculationType === 'PERCENTAGE' && comp.percentage) {
        const pct = parseFloat(String(comp.percentage)) || 0;
        const amt = Math.round((proratedBasic * pct) / 100);
        computedEarnings.push({
          code: comp.componentCode,
          name: comp.componentCode.replace(/_/g, ' '),
          category: 'EARNING',
          amount: amt,
        });
      } else {
        const rawAmt = parseFloat(String(comp.amount)) || 0;
        const amt = isDaily ? Math.round(rawAmt * payableDays) : rawAmt;
        computedEarnings.push({
          code: comp.componentCode,
          name: comp.componentCode.replace(/_/g, ' '),
          category: 'EARNING',
          amount: amt,
        });
      }
    } else if (comp.category === 'DEDUCTION') {
      if (comp.calculationType === 'STATUTORY_RULE' || comp.componentCode === 'PF') {
        const amt = Math.round(proratedBasic * 0.12);
        computedDeductions.push({
          code: comp.componentCode,
          name: comp.componentCode.replace(/_/g, ' '),
          category: 'DEDUCTION',
          amount: amt,
          isStatutory: true,
        });
      } else {
        const amt = parseFloat(String(comp.amount)) || 0;
        computedDeductions.push({
          code: comp.componentCode,
          name: comp.componentCode.replace(/_/g, ' '),
          category: 'DEDUCTION',
          amount: amt,
        });
      }
    }
  }

  const grossEarnings = computedEarnings.reduce((sum, e) => sum + e.amount, 0);
  const totalDeductions = computedDeductions.reduce((sum, d) => sum + d.amount, 0);
  const netPay = grossEarnings + manualEarnings - totalDeductions - manualDeductions;

  return {
    ...item,
    payableDays,
    presentDays,
    lopDays,
    grossEarnings,
    totalDeductions,
    netPay,
    manualEarnings,
    manualDeductions,
    manualAdjustment,
    notes,
    remarks: notes,
    isExecutive: isExecutiveEmployee(item),
    isExempt,
    attendanceExempt: isExempt,
    totalEmployerCost: grossEarnings,
    earningsJson: computedEarnings,
    deductionsJson: computedDeductions,
    employerContributionsJson: [],
  };
}

/**
 * Evaluates a payslip against an active employee salary structure
 */
export function evaluatePayslipWithStructure(
  payslip: Partial<Payslip> & { periodYear?: number; periodMonth?: number },
  struct: SalaryStructure | null,
  daysInPeriod: number,
): Payslip {
  const rawPayable = Number(payslip.payableDays);
  let payableDays = daysInPeriod;

  if (!isNaN(rawPayable) && rawPayable > 0 && rawPayable <= daysInPeriod) {
    payableDays = rawPayable;
  } else {
    payableDays = daysInPeriod;
  }

  if (!struct || !struct.components || struct.components.length === 0 || payableDays === 0) {
    const fixedEarnings = payslip.earningsJson || [];
    const fixedDeductions = payslip.deductionsJson || [];
    const gross = parseFloat(String(payslip.grossEarnings)) || 0;
    const deductions = parseFloat(String(payslip.totalDeductions)) || 0;
    return {
      id: payslip.id || 'preview',
      periodYear: payslip.periodYear || 2026,
      periodMonth: payslip.periodMonth || 9,
      payableDays,
      grossEarnings: gross,
      totalDeductions: deductions,
      netPay: gross - deductions,
      earningsJson: fixedEarnings,
      deductionsJson: fixedDeductions,
      companySnapshot: payslip.companySnapshot,
      employee: payslip.employee,
    };
  }

  const basicComp = struct.components.find(
    (c: SalaryStructureComponent) => c.componentCode === 'BASIC',
  );
  const fullBasic = parseFloat(String(basicComp?.amount || 0)) || 0;
  const proratedBasic = Math.round((fullBasic * payableDays) / daysInPeriod);

  const computedEarnings: ItemBreakdownEntry[] = [];
  const computedDeductions: ItemBreakdownEntry[] = [];

  for (const comp of struct.components) {
    if (!comp.isActive) continue;
    if (comp.category === 'EARNING') {
      if (comp.componentCode === 'BASIC') {
        computedEarnings.push({
          code: 'BASIC',
          name: 'Basic Pay',
          category: 'EARNING',
          amount: proratedBasic,
        });
      } else if (comp.calculationType === 'PERCENTAGE' && comp.percentage) {
        const pct = parseFloat(String(comp.percentage)) || 0;
        const amt = Math.round((proratedBasic * pct) / 100);
        computedEarnings.push({
          code: comp.componentCode,
          name: comp.componentCode.replace(/_/g, ' '),
          category: 'EARNING',
          amount: amt,
        });
      } else {
        const amt = parseFloat(String(comp.amount)) || 0;
        computedEarnings.push({
          code: comp.componentCode,
          name: comp.componentCode.replace(/_/g, ' '),
          category: 'EARNING',
          amount: amt,
        });
      }
    } else if (comp.category === 'DEDUCTION') {
      if (comp.calculationType === 'STATUTORY_RULE' || comp.componentCode === 'PF') {
        const amt = Math.round(proratedBasic * 0.12);
        computedDeductions.push({
          code: comp.componentCode,
          name: comp.componentCode.replace(/_/g, ' '),
          category: 'DEDUCTION',
          amount: amt,
          isStatutory: true,
        });
      } else {
        const amt = parseFloat(String(comp.amount)) || 0;
        computedDeductions.push({
          code: comp.componentCode,
          name: comp.componentCode.replace(/_/g, ' '),
          category: 'DEDUCTION',
          amount: amt,
        });
      }
    }
  }

  const grossEarnings = computedEarnings.reduce((sum, e) => sum + e.amount, 0);
  const totalDeductions = computedDeductions.reduce((sum, d) => sum + d.amount, 0);
  const netPay = grossEarnings - totalDeductions;

  return {
    id: payslip.id || 'preview',
    periodYear: payslip.periodYear || 2026,
    periodMonth: payslip.periodMonth || 9,
    payableDays,
    grossEarnings,
    totalDeductions,
    netPay,
    earningsJson: computedEarnings,
    deductionsJson: computedDeductions,
    companySnapshot: payslip.companySnapshot,
    employee: payslip.employee,
  };
}

/**
 * Batch evaluates a list of run items with their employee salary structures
 */
export async function evaluateRunItems(
  items: PayrollRunItem[],
  periodYear: number,
  periodMonth: number,
): Promise<PayrollRunItem[]> {
  if (!items || items.length === 0) return [];

  const daysInPeriod = new Date(periodYear, periodMonth, 0).getDate();

  // Find unique employee IDs that need structures fetched
  const uniqueEmpIds = Array.from(new Set(items.map((it) => it.employeeId)));

  await Promise.all(
    uniqueEmpIds.map(async (empId) => {
      if (structureCache.has(empId)) return;
      try {
        let act = await SalaryStructureService.getActiveStructure(empId).catch(() => null);
        if (!act || !act.components || act.components.length === 0) {
          const hist = await SalaryStructureService.getHistoricalStructures(empId).catch(() => []);
          act = hist.find((s) => s.components && s.components.length > 0) || null;
        }
        structureCache.set(empId, act);
      } catch {
        structureCache.set(empId, null);
      }
    }),
  );

  return items.map((item) => {
    const struct = structureCache.get(item.employeeId) || null;
    return evaluateRunItemWithStructure(item, struct, daysInPeriod);
  });
}

export interface RunAggregates {
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerCost: number;
  presentDays: number;
  payableDays: number;
  lopDays: number;
  overtimeHours: number;
  totalEmployees: number;
}

/**
 * Calculates sum aggregates from a list of evaluated run items
 */
export function computeRunAggregates(items: PayrollRunItem[]): RunAggregates {
  return items.reduce(
    (acc, item) => {
      const gross = parseFloat(String(item.grossEarnings || 0));
      const ded = parseFloat(String(item.totalDeductions || 0));
      const net = parseFloat(String(item.netPay || gross - ded));
      const cost = parseFloat(String(item.totalEmployerCost || gross));

      acc.totalGross += gross;
      acc.totalDeductions += ded;
      acc.totalNet += net;
      acc.totalEmployerCost += cost;
      acc.presentDays += Number(item.presentDays) || 0;
      acc.payableDays += Number(item.payableDays) || 0;
      acc.lopDays += Number(item.lopDays) || 0;
      acc.overtimeHours += Number(item.overtimeHours) || 0;
      acc.totalEmployees += 1;
      return acc;
    },
    {
      totalGross: 0,
      totalDeductions: 0,
      totalNet: 0,
      totalEmployerCost: 0,
      presentDays: 0,
      payableDays: 0,
      lopDays: 0,
      overtimeHours: 0,
      totalEmployees: 0,
    },
  );
}

/**
 * Enhances a PayrollRun with live aggregate totals calculated from its evaluated items
 */
export function enrichRunWithItemAggregates(run: PayrollRun, items: PayrollRunItem[]): PayrollRun {
  if (!items || items.length === 0) {
    return run;
  }
  const aggs = computeRunAggregates(items);
  return {
    ...run,
    totalGross: aggs.totalGross,
    totalDeductions: aggs.totalDeductions,
    totalNet: aggs.totalNet,
    totalEmployerCost: aggs.totalEmployerCost,
    totalEmployees: aggs.totalEmployees || run.totalEmployees,
  };
}
