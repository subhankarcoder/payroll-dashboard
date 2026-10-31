import { fetchApi } from '@/lib/client/api-client';
import type { EmployeeSummary } from '@/types/payroll';

export class EmployeeLookupService {
  /**
   * Search active employees in the HR system for salary structure assignment & payslips
   */
  public static async searchEmployees(
    query: string = '',
    limit: number = 20,
    status?: string,
  ): Promise<EmployeeSummary[]> {
    const trimmedQuery = query?.trim() || '';
    // Backend Zod schema strictly limits query parameter 'limit' to max 100
    const safeLimit = Math.min(100, Math.max(1, limit || 20));

    const params = new URLSearchParams();
    if (trimmedQuery) params.append('search', trimmedQuery);
    params.append('limit', safeLimit.toString());
    if (status && status !== 'ALL') params.append('status', status);

    try {
      const result = await fetchApi<
        | Record<string, unknown>[]
        | { data?: Record<string, unknown>[]; employees?: Record<string, unknown>[] }
      >(`/api/v1/hr/employees?${params.toString()}`);

      let list: Record<string, unknown>[] = [];
      if (Array.isArray(result)) {
        list = result;
      } else if (result && Array.isArray((result as { data?: Record<string, unknown>[] }).data)) {
        list = (result as { data: Record<string, unknown>[] }).data || [];
      } else if (
        result &&
        Array.isArray((result as { employees?: Record<string, unknown>[] }).employees)
      ) {
        list = (result as { employees: Record<string, unknown>[] }).employees || [];
      }

      // If caller requested more than 100 (e.g. 200) and we received a full page of 100, fetch page 2
      if (limit > 100 && list.length === safeLimit) {
        const remaining = limit - list.length;
        const page2Limit = Math.min(100, remaining);
        const p2Params = new URLSearchParams();
        if (trimmedQuery) p2Params.append('search', trimmedQuery);
        p2Params.append('page', '2');
        p2Params.append('limit', page2Limit.toString());
        if (status && status !== 'ALL') p2Params.append('status', status);

        const page2Res = await fetchApi<
          | Record<string, unknown>[]
          | { data?: Record<string, unknown>[]; employees?: Record<string, unknown>[] }
        >(`/api/v1/hr/employees?${p2Params.toString()}`).catch(() => []);

        const page2List = Array.isArray(page2Res)
          ? page2Res
          : Array.isArray((page2Res as { data?: Record<string, unknown>[] })?.data)
            ? (page2Res as { data: Record<string, unknown>[] }).data || []
            : [];
        list = [...list, ...page2List];
      }

      return list.map((e) => ({
        id: String(e['id'] || ''),
        firstName: String(e['firstName'] || e['first_name'] || ''),
        lastName: String(e['lastName'] || e['last_name'] || ''),
        employeeCode: String(e['employeeCode'] || e['employee_code'] || e['code'] || ''),
        email: String(e['email'] || ''),
        department: typeof e['department'] === 'string' ? e['department'] : undefined,
        designation: typeof e['designation'] === 'string' ? e['designation'] : undefined,
        status: typeof e['status'] === 'string' ? e['status'] : undefined,
      }));
    } catch (error) {
      console.warn('Failed to search HR employees via /api/v1/hr/employees:', error);
      throw error;
    }
  }

  /**
   * Get employee details by ID from HR
   */
  public static async getEmployeeById(employeeId: string): Promise<EmployeeSummary> {
    const res = await fetchApi<Record<string, unknown> | { data?: Record<string, unknown> }>(
      `/api/v1/hr/employees/${employeeId}`,
    );

    const raw =
      res &&
      typeof res === 'object' &&
      'data' in res &&
      (res as { data?: Record<string, unknown> }).data
        ? (res as { data: Record<string, unknown> }).data
        : (res as Record<string, unknown>);

    return {
      id: String(raw?.['id'] || employeeId),
      firstName: String(raw?.['firstName'] || raw?.['first_name'] || ''),
      lastName: String(raw?.['lastName'] || raw?.['last_name'] || ''),
      employeeCode: String(raw?.['employeeCode'] || raw?.['employee_code'] || raw?.['code'] || ''),
      email: String(raw?.['email'] || ''),
      department: typeof raw?.['department'] === 'string' ? raw['department'] : undefined,
      designation: typeof raw?.['designation'] === 'string' ? raw['designation'] : undefined,
      status: typeof raw?.['status'] === 'string' ? raw['status'] : undefined,
    };
  }
}
