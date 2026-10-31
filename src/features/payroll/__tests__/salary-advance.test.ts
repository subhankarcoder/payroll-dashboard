import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SalaryAdvanceService as salaryAdvanceApi } from '../services/salary-advance.service';
import * as apiClient from '@/lib/client/api-client';
import type {
  SalaryAdvance,
  SalaryAdvanceSummaryMetrics,
  SalaryAdvanceSlipData,
} from '@/types/salary-advance';

describe('Salary Advance API Client & Domain Logic', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockAdvance: SalaryAdvance = {
    id: 'adv-123',
    workspaceId: 'ws-456',
    employeeId: 'emp-789',
    advanceReference: 'ADV-2026-0001',
    principalAmount: 50000,
    monthlyDeduction: 10000,
    firstDeductionYear: 2026,
    firstDeductionMonth: 11,
    disbursementDate: '2026-10-29',
    status: 'ACTIVE',
    totalRecovered: 20000,
    remainingBalance: 30000,
    remarks: 'Festival Advance',
    createdAt: '2026-10-29T10:00:00.000Z',
    updatedAt: '2026-10-29T10:00:00.000Z',
    recoveries: [
      {
        id: 'rec-1',
        advanceId: 'adv-123',
        employeeId: 'emp-789',
        payrollRunId: 'run-1',
        periodYear: 2026,
        periodMonth: 11,
        openingBalance: 50000,
        amount: 10000,
        closingBalance: 40000,
        status: 'POSTED',
        postedAt: '2026-11-30T18:00:00.000Z',
      },
    ],
  };

  const mockMetrics: SalaryAdvanceSummaryMetrics = {
    activeAdvancesCount: 5,
    totalOutstandingBalance: 150000,
    periodDeductionsAmount: 40000,
    periodIssuedCount: 2,
    periodIssuedAmount: 80000,
  };

  it('fetches summary KPI metrics with period parameters', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce(mockMetrics);

    const metrics = await salaryAdvanceApi.getMetrics(2026, 10);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/payroll/advances/summary?periodYear=2026&periodMonth=10',
    );
    expect(metrics.activeAdvancesCount).toBe(5);
    expect(metrics.totalOutstandingBalance).toBe(150000);
  });

  it('lists salary advances and parses array responses', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce([mockAdvance]);

    const result = await salaryAdvanceApi.listAdvances({ status: 'ACTIVE', page: 1, limit: 10 });
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/payroll/advances?status=ACTIVE&page=1&limit=10');
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0]?.advanceReference).toBe('ADV-2026-0001');
  });

  it('lists salary advances and parses object responses with total count', async () => {
    vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce({
      data: [mockAdvance],
      total: 15,
    });

    const result = await salaryAdvanceApi.listAdvances({ search: 'ADV-2026' });
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(15);
  });

  it('creates a new salary advance request', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce(mockAdvance);

    const created = await salaryAdvanceApi.createAdvance({
      employeeId: 'emp-789',
      principalAmount: 50000,
      monthlyDeduction: 10000,
      disbursementDate: '2026-10-29',
      firstDeductionYear: 2026,
      firstDeductionMonth: 11,
      remarks: 'Medical emergency',
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/payroll/advances', {
      method: 'POST',
      body: JSON.stringify({
        employeeId: 'emp-789',
        principalAmount: 50000,
        monthlyDeduction: 10000,
        disbursementDate: '2026-10-29',
        firstDeductionYear: 2026,
        firstDeductionMonth: 11,
        remarks: 'Medical emergency',
      }),
    });
    expect(created.advanceReference).toBe('ADV-2026-0001');
  });

  it('approves a salary advance request', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce({
      ...mockAdvance,
      status: 'APPROVED',
    });

    const approved = await salaryAdvanceApi.approveAdvance('adv-123');
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/payroll/advances/adv-123/approve', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(approved.status).toBe('APPROVED');
  });

  it('issues / disburses an approved salary advance', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce({
      ...mockAdvance,
      status: 'ACTIVE',
    });

    const issued = await salaryAdvanceApi.issueAdvance('adv-123');
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/payroll/advances/adv-123/issue', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect(issued.status).toBe('ACTIVE');
  });

  it('cancels a salary advance with optional reason', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce({
      ...mockAdvance,
      status: 'CANCELLED',
    });

    const cancelled = await salaryAdvanceApi.cancelAdvance(
      'adv-123',
      'Employee requested cancellation',
    );
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/payroll/advances/adv-123/cancel', {
      method: 'POST',
      body: JSON.stringify({ reason: 'Employee requested cancellation' }),
    });
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('settles an active advance manually', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce({
      ...mockAdvance,
      status: 'COMPLETED',
      remainingBalance: 0,
    });

    const settled = await salaryAdvanceApi.settleAdvance('adv-123', {
      settlementType: 'FULL_RECOVERY',
      amountRecovered: 30000,
      notes: 'NEFT Transfer ref #987654',
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/payroll/advances/adv-123/settle', {
      method: 'POST',
      body: JSON.stringify({
        settlementType: 'FULL_RECOVERY',
        amountRecovered: 30000,
        notes: 'NEFT Transfer ref #987654',
      }),
    });
    expect(settled.status).toBe('COMPLETED');
    expect(settled.remainingBalance).toBe(0);
  });

  it('fetches printable voucher slip data', async () => {
    const mockSlip: SalaryAdvanceSlipData = {
      companyName: 'Urgent Manpower Services',
      advanceReference: 'ADV-2026-0001',
      disbursementDate: '2026-10-29',
      employee: {
        id: 'emp-789',
        fullName: 'Anubhab Das',
        employeeCode: 'EMP-001',
        department: 'Engineering',
      },
      financials: {
        principalAmount: 50000,
        interestRatePercent: 0,
        plannedMonthlyDeduction: 10000,
        firstDeductionPeriod: '2026-11',
        estimatedDurationMonths: 5,
        openingOutstandingBalance: 50000,
        currentOutstandingBalance: 30000,
        totalRecovered: 20000,
      },
      status: 'ACTIVE',
      recoveryHistory: [],
    };

    vi.spyOn(apiClient, 'fetchApi').mockResolvedValueOnce(mockSlip);

    const slip = await salaryAdvanceApi.getAdvanceSlip('adv-123');
    expect(slip.companyName).toBe('Urgent Manpower Services');
    expect(slip.financials.estimatedDurationMonths).toBe(5);
    expect(slip.financials.interestRatePercent).toBe(0);
  });

  it('calculates repayment duration correctly based on principal and monthly deduction', () => {
    const calculateDuration = (principal: number, monthly: number) => {
      if (principal <= 0 || monthly <= 0) return 0;
      return Math.ceil(principal / monthly);
    };

    expect(calculateDuration(50000, 10000)).toBe(5);
    expect(calculateDuration(50000, 15000)).toBe(4);
    expect(calculateDuration(25000, 2500)).toBe(10);
    expect(calculateDuration(10000, 10000)).toBe(1);
    expect(calculateDuration(0, 5000)).toBe(0);
  });
});
