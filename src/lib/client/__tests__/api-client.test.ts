import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchApi,
  ApiClientError,
  setAuthToken,
  getAuthToken,
  setRefreshToken,
  getRefreshToken,
  clearAuthTokens,
  isTokenExpiring,
  ensureValidAuthToken,
} from '../api-client';

describe('Centralized API Client (AGENTS.md Rule 14)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearAuthTokens();
  });

  it('should unwrap successful data payload', async () => {
    const mockData = { message: 'ok' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockData }),
    } as unknown as Response);

    const result = await fetchApi<{ message: string }>('/api/test');
    expect(result).toEqual(mockData);
  });

  it('should throw ApiClientError on unsuccessful response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name is required' },
      }),
    } as unknown as Response);

    await expect(fetchApi('/api/test')).rejects.toThrow(ApiClientError);
    await expect(fetchApi('/api/test')).rejects.toThrow('Name is required');
  });

  it('should automatically refresh expired token on 401 and retry request transparently', async () => {
    setAuthToken('old_expired_access_token');
    setRefreshToken('valid_refresh_token');

    // 1st call: Returns 401 Unauthorized
    // 2nd call: POST /auth/refresh returns new tokens
    // 3rd call: Retried GET request returns 200 OK with data
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'jwt expired' },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          data: {
            accessToken: 'new_fresh_access_token',
            refreshToken: 'new_rotated_refresh_token',
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'success',
          data: { items: [1, 2, 3] },
        }),
      } as unknown as Response);

    global.fetch = fetchMock;

    const result = await fetchApi<{ items: number[] }>('/api/v1/payroll/runs');
    expect(result).toEqual({ items: [1, 2, 3] });
    expect(getAuthToken()).toBe('new_fresh_access_token');
    expect(getRefreshToken()).toBe('new_rotated_refresh_token');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should clear tokens and throw ApiClientError if token refresh fails', async () => {
    setAuthToken('expired_token');
    setRefreshToken('invalid_refresh_token');

    // 1st call: Returns 401
    // 2nd call: POST /auth/refresh returns 401 (refresh token expired)
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Token expired' },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          message: 'Invalid refresh token',
        }),
      } as unknown as Response);

    await expect(fetchApi('/api/v1/payroll/runs')).rejects.toThrow(ApiClientError);
    expect(getAuthToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('should correctly evaluate token expiration for opaque tokens and proactive refresh', async () => {
    // Set token with 1 second expiry
    setAuthToken('short_lived_opaque_token', 1);
    setRefreshToken('valid_refresh_token');

    // Should detect token is expiring
    expect(isTokenExpiring(5)).toBe(true);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        data: {
          accessToken: 'proactively_refreshed_token',
          refreshToken: 'rotated_refresh_token',
        },
      }),
    } as unknown as Response);

    const validToken = await ensureValidAuthToken();
    expect(validToken).toBe('proactively_refreshed_token');
    expect(getAuthToken()).toBe('proactively_refreshed_token');
  });
});
