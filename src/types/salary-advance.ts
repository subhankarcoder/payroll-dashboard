export type SalaryAdvanceStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type SalaryAdvanceRecoveryStatus = 'POSTED' | 'REVERSED';

export type SalaryAdvanceSettlementType =
  'FULL_RECOVERY' | 'PARTIAL_RECOVERY' | 'APPROVED_WRITEOFF' | 'FINAL_SETTLEMENT';

export interface SalaryAdvanceRecovery {
  id: string;
  advanceId: string;
  employeeId: string;
  payrollRunId: string;
  periodYear: number;
  periodMonth: number;
  openingBalance: number;
  amount: number;
  closingBalance: number;
  status: SalaryAdvanceRecoveryStatus;
  postedAt: string;
  notes?: string | null;
}

export interface SalaryAdvanceEmployeeInfo {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  employeeCode?: string;
  departmentId?: string;
  department?: string;
  designation?: string;
  avatarUrl?: string;
}

export interface SalaryAdvance {
  id: string;
  workspaceId: string;
  employeeId: string;
  advanceReference: string;
  principalAmount: number;
  monthlyDeduction: number;
  firstDeductionYear: number;
  firstDeductionMonth: number;
  disbursementDate: string;
  status: SalaryAdvanceStatus;
  totalRecovered: number;
  remainingBalance: number;
  remarks?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  issuedBy?: string | null;
  issuedAt?: string | null;
  completedAt?: string | null;
  recoveries?: SalaryAdvanceRecovery[];
  createdAt: string;
  updatedAt: string;
  employee?: SalaryAdvanceEmployeeInfo;
}

export interface SalaryAdvanceSummaryMetrics {
  activeAdvancesCount: number;
  totalOutstandingBalance: number;
  periodDeductionsAmount: number;
  periodIssuedCount: number;
  periodIssuedAmount: number;
}

export interface SalaryAdvanceSlipData {
  companyName: string;
  advanceReference: string;
  disbursementDate: string;
  employee: {
    id: string;
    fullName: string;
    employeeCode?: string;
    department?: string;
    designation?: string;
  };
  financials: {
    principalAmount: number;
    interestRatePercent: 0;
    plannedMonthlyDeduction: number;
    firstDeductionPeriod: string;
    estimatedDurationMonths: number;
    openingOutstandingBalance: number;
    currentOutstandingBalance: number;
    totalRecovered: number;
  };
  status: SalaryAdvanceStatus;
  remarks?: string | null;
  authorizedBy?: {
    approvedBy?: string | null;
    approvedAt?: string | null;
    issuedBy?: string | null;
    issuedAt?: string | null;
  };
  recoveryHistory: Array<{
    periodYear: number;
    periodMonth: number;
    openingBalance: number;
    amount: number;
    closingBalance: number;
    status: SalaryAdvanceRecoveryStatus;
    postedAt: string;
  }>;
}

export interface CreateSalaryAdvancePayload {
  employeeId: string;
  principalAmount: number;
  monthlyDeduction: number;
  disbursementDate: string;
  firstDeductionYear: number;
  firstDeductionMonth: number;
  remarks?: string | null;
}

export interface UpdateSalaryAdvancePayload {
  principalAmount?: number;
  monthlyDeduction?: number;
  disbursementDate?: string;
  firstDeductionYear?: number;
  firstDeductionMonth?: number;
  remarks?: string | null;
}

export interface SettleSalaryAdvancePayload {
  settlementType: SalaryAdvanceSettlementType;
  amountRecovered: number;
  notes: string;
}

export interface ListSalaryAdvancesParams {
  employeeId?: string;
  status?: SalaryAdvanceStatus | 'ALL';
  search?: string;
  periodYear?: number;
  periodMonth?: number;
  page?: number;
  limit?: number;
}

export interface ListSalaryAdvancesResponse {
  data: SalaryAdvance[];
  total: number;
}
