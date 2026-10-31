import type { UserSession } from '@/lib/auth/rbac';

export interface AuthUser {
  id: string;
  email?: string;
  employeeCode?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  isSuperAdmin?: boolean;
  status?: string;
  role?: string;
  roles?: string[];
}

export interface LoginResult {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
  forceChange?: boolean;
}

export type AuthActionResult =
  | { readonly success: true; readonly user: UserSession }
  | {
      readonly success: false;
      readonly error: string;
      readonly fieldErrors?: Record<string, string[]>;
    };
