'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { setAuthToken, setRefreshToken, setWorkspaceId, fetchApi } from '@/lib/client/api-client';
import { AuthService } from '../services/auth-service';
import { Button } from '@/components/atoms/button';
import { ShieldCheck, Eye, EyeOff, User, Mail, Lock } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<'admin' | 'employee'>('admin');
  const [identifier, setIdentifier] = useState('anubhab.19518@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('error') === 'access_denied') {
        setErrorMessage('Access Denied: You do not have permissions to manage payroll.');
      } else if (urlParams.get('error') === 'session_expired') {
        setErrorMessage('Your session has expired. Please sign in again.');
      }
    }
  }, []);

  const handleModeChange = (mode: 'admin' | 'employee') => {
    setLoginMode(mode);
    setErrorMessage(null);
    setSuccessMessage(null);
    if (mode === 'admin') {
      if (!identifier.includes('@')) {
        setIdentifier('anubhab.19518@gmail.com');
      }
    } else {
      if (identifier.includes('@')) {
        setIdentifier('EMP001');
      }
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage(
        loginMode === 'admin'
          ? 'Please enter your work email address.'
          : 'Please enter your employee code.',
      );
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Authenticate via AuthService (auto-routes to /auth/login or /auth/employee/login)
      const result = await AuthService.login({
        identifier: cleanId,
        password,
      });

      const { accessToken, refreshToken, user } = result;

      // 2. Persist tokens & user session across storage keys (15m standard access TTL)
      setAuthToken(accessToken, 900);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('payroll_jwt_token', accessToken);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('payroll_user', JSON.stringify(user));
      }

      // 3. Fetch active workspace context
      let activeWsId = '43a1cac5-1d34-4488-9286-ba6ec6ac5587';
      try {
        const wsRes = await fetchApi<
          Array<{ id: string; name: string }> | { data?: Array<{ id: string; name: string }> }
        >('/api/v1/workspaces');
        const wsList = Array.isArray(wsRes)
          ? wsRes
          : Array.isArray((wsRes as { data?: Array<{ id: string; name: string }> })?.data)
            ? (wsRes as { data: Array<{ id: string; name: string }> }).data
            : [];

        if (wsList && wsList.length > 0 && wsList[0]) {
          activeWsId = wsList[0].id;
          setWorkspaceId(activeWsId);
          if (typeof window !== 'undefined') {
            localStorage.setItem('active_workspace_id', activeWsId);
            localStorage.setItem('payroll_workspace_name', wsList[0].name || 'Urgent Manpower');
          }
        } else {
          setWorkspaceId(activeWsId);
        }
      } catch {
        setWorkspaceId(activeWsId);
      }

      // 4. Verify RBAC / Payroll Permission
      const hasAccess = await AuthService.verifyPayrollAccess(user, accessToken, activeWsId);
      if (!hasAccess) {
        setAuthToken(null);
        setErrorMessage('Access Denied: You do not have permissions to manage payroll.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage('Authentication successful! Loading Payroll Dashboard...');
      setTimeout(() => {
        router.push('/payroll');
      }, 350);
    } catch (err: unknown) {
      console.warn('Login error:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Invalid credentials. Please check your username and password.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Mode Selector Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          backgroundColor: '#f1f5f9',
          padding: '4px',
          borderRadius: 'var(--radius-lg)',
          marginBottom: 'var(--space-5)',
        }}
      >
        <button
          type="button"
          onClick={() => handleModeChange('admin')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 12px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: loginMode === 'admin' ? '#ffffff' : 'transparent',
            color: loginMode === 'admin' ? '#4f46e5' : '#64748b',
            boxShadow: loginMode === 'admin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Mail size={14} />
          <span>Admin / Manager</span>
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('employee')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 12px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: loginMode === 'employee' ? '#ffffff' : 'transparent',
            color: loginMode === 'employee' ? '#4f46e5' : '#64748b',
            boxShadow: loginMode === 'employee' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all var(--transition-fast)',
          }}
        >
          <User size={14} />
          <span>Employee Login</span>
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
          width: '100%',
        }}
      >
        {errorMessage && (
          <div
            role="alert"
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
            }}
          >
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            style={{
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#059669',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
            }}
          >
            {successMessage}
          </div>
        )}

        {/* Identifier Input */}
        <div>
          <label
            htmlFor="login-identifier"
            style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            {loginMode === 'admin' ? 'Work Email Address' : 'Employee Code'}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="login-identifier"
              name="identifier"
              type={loginMode === 'admin' ? 'email' : 'text'}
              placeholder={loginMode === 'admin' ? 'e.g. admin@urgentmanpower.com' : 'e.g. EMP001'}
              autoComplete={loginMode === 'admin' ? 'email' : 'username'}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--radius-md)',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <label
            htmlFor="login-password"
            style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            Password
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              id="login-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 42px 10px 14px',
                fontSize: '0.875rem',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--radius-md)',
                outline: 'none',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ marginTop: 'var(--space-2)' }}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            style={{
              width: '100%',
              backgroundColor: '#4f46e5',
              fontWeight: 600,
              padding: '12px',
            }}
          >
            <Lock size={16} />
            <span>{isLoading ? 'Authenticating...' : 'Sign In to Payroll'}</span>
          </Button>
        </div>

        {/* Security / SSO Notice */}
        <div
          style={{
            marginTop: 'var(--space-2)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            fontSize: 'var(--font-size-xs)',
            color: '#64748b',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              color: '#334155',
              fontWeight: 600,
            }}
          >
            <ShieldCheck size={14} color="#4f46e5" />
            <span>Unified HRMS Authentication</span>
          </div>
          <p style={{ margin: 0, lineHeight: 1.4 }}>
            Sign in using your corporate email (for Admins) or Employee Code (for Staff).
            Authenticated sessions are secured with JWT and workspace authorization.
          </p>
        </div>
      </form>
    </div>
  );
}
