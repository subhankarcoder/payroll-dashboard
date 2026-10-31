import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateRunItemWithStructure,
  evaluatePayslipWithStructure,
  evaluateRunItems,
  computeRunAggregates,
  enrichRunWithItemAggregates,
  isExecutiveEmployee,
  isAttendanceExempt,
} from '../utils/payroll-calculator';
import { SalaryStructureService } from '../services/salary-structure.service';
import type { PayrollRun, PayrollRunItem, SalaryStructure } from '@/types/payroll';

describe('Payroll Calculator Utility', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseItem: PayrollRunItem = {
    id: 'item-1',
    payrollRunId: 'run-1',
    employeeId: 'emp-1',
    payableDays: 30,
    presentDays: 28,
    absentDays: 2,
    lopDays: 2,
    halfDays: 0,
    overtimeHours: 4,
    grossEarnings: 0,
    totalDeductions: 0,
    netPay: 0,
    employerContributions: 0,
    totalEmployerCost: 0,
    status: 'DRAFT',
    earningsJson: [],
    deductionsJson: [],
    employerContributionsJson: [],
  };

  const monthlyStructure: SalaryStructure = {
    id: 'str-monthly',
    workspaceId: 'ws-1',
    employeeId: 'emp-1',
    payBasis: 'MONTHLY',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'ACTIVE',
    components: [
      {
        componentCode: 'BASIC',
        category: 'EARNING',
        calculationType: 'FIXED_AMOUNT',
        amount: 30000,
        isActive: true,
      },
      {
        componentCode: 'HRA',
        category: 'EARNING',
        calculationType: 'PERCENTAGE',
        percentage: 40,
        isActive: true,
      },
      {
        componentCode: 'SPECIAL_ALLOWANCE',
        category: 'EARNING',
        calculationType: 'FIXED_AMOUNT',
        amount: 5000,
        isActive: true,
      },
      {
        componentCode: 'PF',
        category: 'DEDUCTION',
        calculationType: 'STATUTORY_RULE',
        isActive: true,
      },
      {
        componentCode: 'PROF_TAX',
        category: 'DEDUCTION',
        calculationType: 'FIXED_AMOUNT',
        amount: 200,
        isActive: true,
      },
    ],
  };

  const dailyStructure: SalaryStructure = {
    id: 'str-daily',
    workspaceId: 'ws-1',
    employeeId: 'emp-2',
    payBasis: 'DAILY',
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    status: 'ACTIVE',
    components: [
      {
        componentCode: 'BASIC',
        category: 'EARNING',
        calculationType: 'FIXED_AMOUNT',
        amount: 500,
        isActive: true,
      },
      {
        componentCode: 'HRA',
        category: 'EARNING',
        calculationType: 'PERCENTAGE',
        percentage: 10,
        isActive: true,
      },
      {
        componentCode: 'PF',
        category: 'DEDUCTION',
        calculationType: 'STATUTORY_RULE',
        isActive: true,
      },
    ],
  };

  describe('evaluateRunItemWithStructure', () => {
    it('preserves existing calculated line items and totals when provided in item', () => {
      const calculatedItem: PayrollRunItem = {
        ...baseItem,
        grossEarnings: 19035.63,
        totalDeductions: 1800,
        netPay: 17235.63,
        earningsJson: [
          { code: 'BASIC', name: 'Basic Pay', category: 'EARNING', amount: 15000 },
          { code: 'HRA', name: 'HRA', category: 'EARNING', amount: 1500 },
          { code: 'OVERTIME', name: 'Overtime', category: 'EARNING', amount: 1535.63 },
          {
            code: 'SPECIAL_ALLOWANCE',
            name: 'Special Allowance',
            category: 'EARNING',
            amount: 1000,
          },
        ],
        deductionsJson: [
          { code: 'PF', name: 'Provident Fund', category: 'DEDUCTION', amount: 1800 },
        ],
      };

      const result = evaluateRunItemWithStructure(calculatedItem, dailyStructure, 30);
      expect(result.grossEarnings).toBe(19035.63);
      expect(result.totalDeductions).toBe(1800);
      expect(result.netPay).toBe(17235.63);
      expect(result.earningsJson).toHaveLength(4);
    });

    it('calculates monthly salary structure prorated across payable days', () => {
      const item: PayrollRunItem = {
        ...baseItem,
        payableDays: 15,
        lopDays: 15,
      };

      const result = evaluateRunItemWithStructure(item, monthlyStructure, 30);
      // Prorated Basic: 30000 * 15 / 30 = 15000
      // HRA: 40% of 15000 = 6000
      // Special Allowance: 5000
      // Gross: 15000 + 6000 + 5000 = 26000
      // PF: 12% of 15000 = 1800
      // Prof Tax: 200
      // Total Deductions: 2000
      // Net: 24000
      expect(result.grossEarnings).toBe(26000);
      expect(result.totalDeductions).toBe(2000);
      expect(result.netPay).toBe(24000);
    });

    it('calculates daily salary structure by multiplying daily rate with payable days', () => {
      const item: PayrollRunItem = {
        ...baseItem,
        payableDays: 20,
      };

      const result = evaluateRunItemWithStructure(item, dailyStructure, 30);
      // Daily Basic: 500 * 20 = 10000
      // HRA: 10% of 10000 = 1000
      // Gross: 11000
      // PF: 12% of 10000 = 1200
      // Net: 9800
      expect(result.grossEarnings).toBe(11000);
      expect(result.totalDeductions).toBe(1200);
      expect(result.netPay).toBe(9800);
    });

    it('returns zero earnings when structure is empty or payable days is 0', () => {
      const item: PayrollRunItem = {
        ...baseItem,
        payableDays: 0,
      };

      const result = evaluateRunItemWithStructure(item, monthlyStructure, 30);
      expect(result.grossEarnings).toBe(0);
      expect(result.netPay).toBe(0);
    });

    it('handles JSON string for earningsJson/deductionsJson parsing', () => {
      const itemWithJsonStrings = {
        ...baseItem,
        grossEarnings: 10000,
        earningsJson: JSON.stringify([{ code: 'BASIC', name: 'Basic', amount: 10000 }]),
        deductionsJson: JSON.stringify([{ code: 'PF', name: 'PF', amount: 1200 }]),
      } as unknown as PayrollRunItem;

      const result = evaluateRunItemWithStructure(itemWithJsonStrings, null, 30);
      expect(result.grossEarnings).toBe(10000);
      expect(result.earningsJson).toHaveLength(1);
    });
  });

  describe('evaluatePayslipWithStructure', () => {
    it('evaluates payslip with monthly structure correctly', () => {
      const payslip = {
        id: 'ps-001',
        payableDays: 30,
        periodYear: 2026,
        periodMonth: 9,
      };

      const result = evaluatePayslipWithStructure(payslip, monthlyStructure, 30);
      expect(result.grossEarnings).toBe(30000 + 12000 + 5000); // 47000
      expect(result.totalDeductions).toBe(3600 + 200); // 3800
      expect(result.netPay).toBe(43200);
    });

    it('handles payslip without structure gracefully', () => {
      const payslip = {
        id: 'ps-002',
        payableDays: 30,
        grossEarnings: 25000,
        totalDeductions: 2000,
      };

      const result = evaluatePayslipWithStructure(payslip, null, 30);
      expect(result.grossEarnings).toBe(25000);
      expect(result.netPay).toBe(23000);
    });
  });

  describe('evaluateRunItems and Aggregates', () => {
    it('fetches structures and batches run items', async () => {
      vi.spyOn(SalaryStructureService, 'getActiveStructure').mockResolvedValue(monthlyStructure);

      const items = [baseItem, { ...baseItem, id: 'item-2', employeeId: 'emp-2' }];
      const evaluated = await evaluateRunItems(items, 2026, 9);

      expect(evaluated).toHaveLength(2);
      expect(evaluated[0]?.grossEarnings).toBeGreaterThan(0);
    });

    it('computes run aggregates across multiple items', () => {
      const items: PayrollRunItem[] = [
        {
          ...baseItem,
          grossEarnings: 50000,
          totalDeductions: 5000,
          netPay: 45000,
          totalEmployerCost: 55000,
          presentDays: 20,
          payableDays: 30,
          lopDays: 0,
          overtimeHours: 2,
        },
        {
          ...baseItem,
          id: 'item-2',
          grossEarnings: 30000,
          totalDeductions: 3000,
          netPay: 27000,
          totalEmployerCost: 33000,
          presentDays: 18,
          payableDays: 28,
          lopDays: 2,
          overtimeHours: 0,
        },
      ];

      const aggs = computeRunAggregates(items);
      expect(aggs.totalGross).toBe(80000);
      expect(aggs.totalDeductions).toBe(8000);
      expect(aggs.totalNet).toBe(72000);
      expect(aggs.totalEmployerCost).toBe(88000);
      expect(aggs.totalEmployees).toBe(2);
      expect(aggs.presentDays).toBe(38);
      expect(aggs.payableDays).toBe(58);
      expect(aggs.lopDays).toBe(2);
      expect(aggs.overtimeHours).toBe(2);
    });

    it('enriches a run object with item aggregate values', () => {
      const run: PayrollRun = {
        id: 'run-1',
        periodYear: 2026,
        periodMonth: 9,
        status: 'CALCULATED',
        totalEmployees: 0,
        totalGross: '0',
        totalDeductions: '0',
        totalNet: '0',
        totalEmployerCost: '0',
      };

      const items: PayrollRunItem[] = [
        {
          ...baseItem,
          grossEarnings: 40000,
          totalDeductions: 4000,
          netPay: 36000,
          totalEmployerCost: 44000,
        },
      ];

      const enriched = enrichRunWithItemAggregates(run, items);
      expect(enriched.totalGross).toBe(40000);
      expect(enriched.totalDeductions).toBe(4000);
      expect(enriched.totalNet).toBe(36000);
    });

    it('returns untouched run if item list is empty', () => {
      const run: PayrollRun = {
        id: 'run-1',
        periodYear: 2026,
        periodMonth: 9,
        status: 'DRAFT',
        totalEmployees: 0,
        totalGross: '0',
        totalDeductions: '0',
        totalNet: '0',
        totalEmployerCost: '0',
      };

      const enriched = enrichRunWithItemAggregates(run, []);
      expect(enriched).toEqual(run);
    });
  });

  describe('Executive Attendance Exemption and isAttendanceExempt', () => {
    it('identifies executive employees via role, designation, or boolean flag', () => {
      const execWithRole: PayrollRunItem = {
        ...baseItem,
        employee: {
          firstName: 'Alice',
          lastName: 'Leader',
          employeeCode: 'EXEC-001',
          email: 'alice@company.com',
          role: 'SUPER_ADMIN',
        },
      };
      expect(isExecutiveEmployee(execWithRole)).toBe(true);

      const execWithDesignation: PayrollRunItem = {
        ...baseItem,
        employee: {
          firstName: 'Bob',
          lastName: 'Boss',
          employeeCode: 'EXEC-002',
          email: 'bob@company.com',
          designation: 'Chief Executive Officer (CEO)',
        },
      };
      expect(isExecutiveEmployee(execWithDesignation)).toBe(true);

      const execWithFlag: PayrollRunItem = {
        ...baseItem,
        isExecutive: true,
      };
      expect(isExecutiveEmployee(execWithFlag)).toBe(true);

      const normalEmployee: PayrollRunItem = {
        ...baseItem,
        employee: {
          firstName: 'Charlie',
          lastName: 'Dev',
          employeeCode: 'DEV-001',
          email: 'charlie@company.com',
          role: 'EMPLOYEE',
          designation: 'Software Engineer',
        },
      };
      expect(isExecutiveEmployee(normalEmployee)).toBe(false);
    });

    it('confirms Attendance Exempt (100% Full Pay) when executive has 0 LOP and full payable days', () => {
      const exemptExec: PayrollRunItem = {
        ...baseItem,
        payableDays: 30,
        presentDays: 30,
        lopDays: 0,
        employee: {
          firstName: 'David',
          lastName: 'Executive',
          employeeCode: 'CEO-01',
          email: 'david@corp.com',
          role: 'SUPER_ADMIN',
          designation: 'CEO',
        },
      };

      expect(isAttendanceExempt(exemptExec, 30)).toBe(true);
    });

    it('returns false for attendance exemption if employee has non-zero LOP days', () => {
      const execWithLop: PayrollRunItem = {
        ...baseItem,
        payableDays: 28,
        lopDays: 2,
        employee: {
          firstName: 'David',
          lastName: 'Executive',
          employeeCode: 'CEO-01',
          email: 'david@corp.com',
          role: 'SUPER_ADMIN',
        },
      };

      expect(isAttendanceExempt(execWithLop, 30)).toBe(false);
    });

    it('returns false for attendance exemption if employee is not an executive even with 0 LOP', () => {
      const normalStaff: PayrollRunItem = {
        ...baseItem,
        payableDays: 30,
        lopDays: 0,
        employee: {
          firstName: 'Emma',
          lastName: 'Analyst',
          employeeCode: 'EMP-05',
          email: 'emma@corp.com',
          designation: 'HR Associate',
        },
      };

      expect(isAttendanceExempt(normalStaff, 30)).toBe(false);
    });
  });

  describe('Manual Line-Item Adjustments and Recalculations', () => {
    it('recalculates netSalary incorporating manual earnings, deductions, and adjustments', () => {
      const itemWithManualAdjustment: PayrollRunItem = {
        ...baseItem,
        grossEarnings: 100000,
        totalDeductions: 10000,
        manualEarnings: 5000,
        manualDeductions: 1000,
        manualAdjustment: 4000,
        notes: 'Executive performance incentive approved by Board',
      };

      const result = evaluateRunItemWithStructure(itemWithManualAdjustment, null, 30);
      // Net Salary = grossSalary + manualEarnings - totalDeductions - manualDeductions
      // 100000 + 5000 - 10000 - 1000 = 94000
      expect(result.netPay).toBe(94000);
      expect(result.manualAdjustment).toBe(4000);
      expect(result.manualEarnings).toBe(5000);
      expect(result.manualDeductions).toBe(1000);
      expect(result.notes).toBe('Executive performance incentive approved by Board');
    });

    it('correctly sets attendanceExempt and calculates executive item with structure', () => {
      const execItem: PayrollRunItem = {
        ...baseItem,
        payableDays: 30,
        presentDays: 30,
        lopDays: 0,
        employee: {
          firstName: 'Ashish',
          lastName: 'Kumar',
          employeeCode: 'DIR-01',
          email: 'ashish@das.com',
          role: 'SUPER_ADMIN',
          designation: 'Managing Director',
        },
      };

      const result = evaluateRunItemWithStructure(execItem, monthlyStructure, 30);
      expect(result.attendanceExempt).toBe(true);
      expect(result.isExempt).toBe(true);
      expect(result.lopDays).toBe(0);
      expect(result.grossEarnings).toBe(47000);
      expect(result.netPay).toBe(43200);
    });
  });
});
