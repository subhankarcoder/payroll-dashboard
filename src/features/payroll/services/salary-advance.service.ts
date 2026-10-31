import { fetchApi } from '@/lib/client/api-client';
import type {
  SalaryAdvance,
  SalaryAdvanceSummaryMetrics,
  SalaryAdvanceSlipData,
  CreateSalaryAdvancePayload,
  UpdateSalaryAdvancePayload,
  SettleSalaryAdvancePayload,
  ListSalaryAdvancesParams,
  ListSalaryAdvancesResponse,
} from '@/types/salary-advance';

export const SalaryAdvanceService = {
  /**
   * Fetch aggregate summary KPI metrics for salary advances
   */
  getMetrics: async (year?: number, month?: number): Promise<SalaryAdvanceSummaryMetrics> => {
    const params = new URLSearchParams();
    if (year) params.append('periodYear', year.toString());
    if (month) params.append('periodMonth', month.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchApi<SalaryAdvanceSummaryMetrics>(`/api/v1/payroll/advances/summary${query}`);
  },

  /**
   * List salary advances with filtering and search
   */
  listAdvances: async (
    params: ListSalaryAdvancesParams = {},
  ): Promise<ListSalaryAdvancesResponse> => {
    const searchParams = new URLSearchParams();
    if (params.employeeId) searchParams.append('employeeId', params.employeeId);
    if (params.status && params.status !== 'ALL') searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);
    if (params.periodYear) searchParams.append('periodYear', params.periodYear.toString());
    if (params.periodMonth) searchParams.append('periodMonth', params.periodMonth.toString());
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await fetchApi<
      SalaryAdvance[] | { data: SalaryAdvance[]; total?: number; count?: number }
    >(`/api/v1/payroll/advances${query}`);

    if (Array.isArray(res)) {
      return {
        data: res,
        total: res.length,
      };
    }

    if (res && Array.isArray(res.data)) {
      return {
        data: res.data,
        total: res.total ?? res.count ?? res.data.length,
      };
    }

    return {
      data: [],
      total: 0,
    };
  },

  /**
   * Create a new salary advance request (starts in DRAFT status)
   */
  createAdvance: async (payload: CreateSalaryAdvancePayload): Promise<SalaryAdvance> => {
    return fetchApi<SalaryAdvance>('/api/v1/payroll/advances', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Update a draft salary advance
   */
  updateDraftAdvance: async (
    id: string,
    payload: UpdateSalaryAdvancePayload,
  ): Promise<SalaryAdvance> => {
    return fetchApi<SalaryAdvance>(`/api/v1/payroll/advances/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Approve a draft salary advance (moves status from DRAFT -> APPROVED)
   */
  approveAdvance: async (id: string): Promise<SalaryAdvance> => {
    return fetchApi<SalaryAdvance>(`/api/v1/payroll/advances/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  /**
   * Disburse/issue an approved salary advance (moves status from APPROVED -> ACTIVE)
   */
  issueAdvance: async (id: string): Promise<SalaryAdvance> => {
    return fetchApi<SalaryAdvance>(`/api/v1/payroll/advances/${id}/issue`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  /**
   * Cancel an advance (from DRAFT or APPROVED)
   */
  cancelAdvance: async (id: string, reason?: string): Promise<SalaryAdvance> => {
    return fetchApi<SalaryAdvance>(`/api/v1/payroll/advances/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
    });
  },

  /**
   * Settle an active advance manually (e.g. final settlement, writeoff, or manual lump recovery)
   */
  settleAdvance: async (
    id: string,
    payload: SettleSalaryAdvancePayload,
  ): Promise<SalaryAdvance> => {
    return fetchApi<SalaryAdvance>(`/api/v1/payroll/advances/${id}/settle`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Get printable salary advance slip voucher data
   */
  getAdvanceSlip: async (id: string): Promise<SalaryAdvanceSlipData> => {
    return fetchApi<SalaryAdvanceSlipData>(`/api/v1/payroll/advances/${id}/slip`);
  },

  /**
   * Get single salary advance details by ID including recovery history
   */
  getAdvanceById: async (id: string): Promise<SalaryAdvance> => {
    return fetchApi<SalaryAdvance>(`/api/v1/payroll/advances/${id}`);
  },
};
