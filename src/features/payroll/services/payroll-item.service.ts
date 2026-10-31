import { fetchApi } from '@/lib/client/api-client';
import type { PayrollRunItem } from '@/types/payroll';

export interface ListPayrollItemsParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface ListPayrollItemsResponse {
  data: PayrollRunItem[];
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface CorrectPayrollItemInput {
  payableDays?: number;
  presentDays?: number;
  lopDays?: number;
  overtimeHours?: number;
  manualEarnings?: number;
  manualDeductions?: number;
  manualAdjustment?: number;
  remarks?: string;
  notes?: string;
}

export class PayrollItemService {
  /**
   * List paginated items in a payroll run
   */
  public static async listItems(
    runId: string,
    params: ListPayrollItemsParams = {},
  ): Promise<ListPayrollItemsResponse> {
    const search = new URLSearchParams();
    if (params.page) search.append('page', params.page.toString());
    if (params.limit) search.append('limit', params.limit.toString());
    if (params.status) search.append('status', params.status);
    if (params.search) search.append('search', params.search);

    const query = search.toString() ? `?${search.toString()}` : '';
    const result = await fetchApi<PayrollRunItem[] | ListPayrollItemsResponse>(
      `/api/v1/payroll/runs/${runId}/items${query}`,
    );

    if (Array.isArray(result)) {
      return {
        data: result,
        meta: { page: params.page || 1, limit: params.limit || 50, total: result.length },
      };
    }
    return result;
  }

  /**
   * Fetch ALL items across all pages for a run to perform accurate aggregate calculations
   */
  public static async fetchAllItems(
    runId: string,
    pageSize: number = 100,
  ): Promise<PayrollRunItem[]> {
    const firstPage = await this.listItems(runId, { page: 1, limit: pageSize });
    const allItems: PayrollRunItem[] = [...firstPage.data];

    const total = firstPage.meta?.total || allItems.length;
    const totalPages = Math.ceil(total / pageSize);

    if (totalPages > 1) {
      const pagePromises: Promise<ListPayrollItemsResponse>[] = [];
      for (let page = 2; page <= totalPages; page++) {
        pagePromises.push(this.listItems(runId, { page, limit: pageSize }));
      }
      const restPages = await Promise.all(pagePromises);
      for (const p of restPages) {
        allItems.push(...p.data);
      }
    }

    return allItems;
  }

  /**
   * Get single run item details
   */
  public static async getItemById(runId: string, itemId: string): Promise<PayrollRunItem> {
    return fetchApi<PayrollRunItem>(`/api/v1/payroll/runs/${runId}/items/${itemId}`);
  }

  /**
   * Apply manual line correction to a payroll item
   */
  public static async correctItem(
    runId: string,
    itemId: string,
    input: CorrectPayrollItemInput,
  ): Promise<PayrollRunItem> {
    return fetchApi<PayrollRunItem>(`/api/v1/payroll/runs/${runId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  }
}
