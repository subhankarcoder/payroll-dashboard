/**
 * Standard API error contract conforming to AGENTS.md Rule 43.
 */
export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown> | readonly string[];
  };
  readonly meta: {
    readonly timestamp: string;
    readonly requestId: string;
  };
}

/**
 * Standard API success contract.
 */
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta: {
    readonly timestamp: string;
    readonly requestId: string;
  };
}
