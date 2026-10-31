'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PayrollSidebar } from '@/components/organisms/payroll-sidebar';
import { PayrollHeader } from '@/components/organisms/payroll-header';
import {
  getWorkspaceId,
  getAuthToken,
  ensureValidAuthToken,
  clearAuthTokens,
} from '@/lib/client/api-client';
import { verifyPayrollAccess } from '@/lib/client/auth-guard';

export interface PayrollLayoutTemplateProps {
  children: ReactNode;
}

const PAYROLL_NAV_TABS = [
  { label: 'Overview', href: '/payroll' },
  { label: 'Payroll Runs', href: '/payroll/runs' },
  { label: 'Salary Structures', href: '/payroll/salary-structures' },
  { label: 'Salary Components', href: '/payroll/components' },
  { label: 'Configuration', href: '/payroll/configuration' },
  { label: 'Payslips', href: '/payroll/payslips' },
  { label: 'Advance Salary', href: '/payroll/advances' },
];

export function PayrollLayoutTemplate({ children }: PayrollLayoutTemplateProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Route protection and access verification
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      let token = getAuthToken();
      if (!token) {
        token = await ensureValidAuthToken();
      }
      if (!token) {
        if (isMounted) {
          router.push('/login');
        }
        return;
      }

      if (typeof window !== 'undefined') {
        const storedUserJson = localStorage.getItem('user') || localStorage.getItem('payroll_user');
        if (storedUserJson) {
          try {
            const user = JSON.parse(storedUserJson);
            const wsId = getWorkspaceId();
            const hasAccess = await verifyPayrollAccess(user, token, wsId);
            if (!hasAccess && isMounted) {
              clearAuthTokens();
              router.push('/login?error=access_denied');
            }
          } catch {
            // Ignore JSON parse errors
          }
        }
      }
    }

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router, pathname]);

  return (
    <div
      style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'hsl(var(--bg-secondary))' }}
    >
      {/* Left Persistent Navigation Sidebar */}
      <PayrollSidebar />

      {/* Main Right Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <PayrollHeader />

        {/* Sub-Navigation Tabs Bar */}
        <div
          style={{
            backgroundColor: 'hsl(var(--bg-surface))',
            borderBottom: '1px solid hsl(var(--border-subtle))',
            padding: '0 var(--space-8)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-6)',
            position: 'sticky',
            top: '64px',
            zIndex: 15,
          }}
        >
          {PAYROLL_NAV_TABS.map((tab) => {
            const isActive =
              tab.href === '/payroll' ? pathname === '/payroll' : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  padding: 'var(--space-3) var(--space-1)',
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'hsl(var(--color-brand-accent))' : 'hsl(var(--text-muted))',
                  borderBottom: isActive
                    ? '2px solid hsl(var(--color-brand-accent))'
                    : '2px solid transparent',
                  marginBottom: '-1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1)',
                  transition: 'color var(--transition-fast)',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Dynamic Page Content Slot */}
        <main
          style={{
            flex: 1,
            padding: 'var(--space-6) var(--space-8) var(--space-12)',
            maxWidth: '1600px',
            width: '100%',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
