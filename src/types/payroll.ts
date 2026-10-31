export type PayBasis = 'MONTHLY' | 'DAILY' | 'HOURLY';

export type SalaryComponentCategory = 'EARNING' | 'DEDUCTION' | 'EMPLOYER_CONTRIBUTION';

export type CalculationType =
  'FIXED_AMOUNT' | 'PERCENTAGE' | 'PER_DAY' | 'PER_HOUR' | 'MULTIPLIER' | 'STATUTORY_RULE';

export type SalaryStructureStatus = 'ACTIVE' | 'REVISED' | 'ARCHIVED';

export type PayrollRunStatus =
  'DRAFT' | 'CALCULATED' | 'UNDER_REVIEW' | 'APPROVED' | 'FINALIZED' | 'CANCELLED';

export type LopCalculationBasis = 'CALENDAR_DAYS' | 'FIXED_26' | 'WORKING_DAYS' | 'CUSTOM_DAYS';

export interface PayrollConfig {
  id: string;
  workspaceId: string;
  lopCalculationBasis: LopCalculationBasis;
  customLopDivisor: number | null;
  overtimeCalculationBasis: string;
  defaultOvertimeMultiplier: number;
  roundOffNetPay: boolean;
  payCycleStartDay: number;
  configJson?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryComponent {
  id: string;
  workspaceId?: string;
  code: string;
  name: string;
  category: SalaryComponentCategory;
  calculationType: CalculationType;
  percentageOf?: string | null;
  isTaxable: boolean;
  isPfApplicable: boolean;
  isEsiApplicable: boolean;
  isEnabled: boolean;
  sortOrder?: number;
}

export interface SalaryStructureComponent {
  componentCode: string;
  category: SalaryComponentCategory;
  calculationType: CalculationType;
  amount?: number;
  percentage?: number;
  percentageOf?: string;
  isActive: boolean;
}

export interface SalaryStructure {
  id: string;
  workspaceId: string;
  employeeId: string;
  payBasis: PayBasis;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: SalaryStructureStatus;
  notes?: string | null;
  components: SalaryStructureComponent[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PayrollRun {
  id: string;
  workspaceId?: string;
  periodYear: number;
  periodMonth: number;
  status: PayrollRunStatus;
  totalEmployees: number;
  totalGross: string | number;
  totalDeductions: string | number;
  totalNet: string | number;
  totalEmployerCost: string | number;
  notes?: string | null;
  processedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ItemBreakdownEntry {
  code: string;
  name: string;
  category: SalaryComponentCategory;
  calculationType?: CalculationType;
  amount: number;
  declaredAmount?: number;
  isStatutory?: boolean;
}

export interface PayrollRunItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employee?: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    email: string;
    designation?: string;
    role?: string;
    roles?: string[];
    jobRoleName?: string;
    isSuperAdmin?: boolean;
    isExecutive?: boolean;
    isExempt?: boolean;
    attendanceExempt?: boolean;
  };
  baseSalary?: number;
  grossSalary?: number;
  netSalary?: number;
  payableDays: number;
  presentDays: number;
  absentDays: number;
  lopDays: number;
  halfDays: number;
  overtimeHours: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  employerContributions: number;
  totalEmployerCost: number;
  status: string;
  earningsJson: ItemBreakdownEntry[];
  deductionsJson: ItemBreakdownEntry[];
  employerContributionsJson: ItemBreakdownEntry[];
  manualEarnings?: number;
  manualDeductions?: number;
  manualAdjustment?: number;
  remarks?: string;
  notes?: string;
  isExecutive?: boolean;
  isExempt?: boolean;
  attendanceExempt?: boolean;
}

export interface Payslip {
  id: string;
  periodYear: number;
  periodMonth: number;
  payableDays: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  earningsJson: ItemBreakdownEntry[];
  deductionsJson: ItemBreakdownEntry[];
  companySnapshot?: {
    name: string;
    address?: string;
  };
  employee?: {
    firstName: string;
    lastName: string;
    employeeCode: string;
    email?: string;
    pan?: string;
    uan?: string;
    bankAccount?: string;
  };
}

export interface EmployeeSummary {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  email: string;
  department?: string;
  designation?: string;
  jobRoleName?: string;
  role?: string;
  roles?: string[];
  isSuperAdmin?: boolean;
  isExecutive?: boolean;
  isExempt?: boolean;
  attendanceExempt?: boolean;
  status?: string;
}
