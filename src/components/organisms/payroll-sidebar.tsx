'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Banknote,
  CalendarCheck,
  Building,
  FileSpreadsheet,
  Settings,
  HelpCircle,
  FileText,
  LogOut,
} from 'lucide-react';
import { clearAuthTokens } from '@/lib/client/api-client';

const MAIN_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Employees', href: '/employees', icon: Users },
  { label: 'Payroll', href: '/payroll', icon: Banknote },
  { label: 'Attendance & Tracking', href: '/attendance', icon: CalendarCheck },
  { label: 'Organization', href: '/organization', icon: Building },
  { label: 'Reports', href: '/reports', icon: FileSpreadsheet },
  { label: 'Settings', href: '/payroll/configuration', icon: Settings },
];

export function PayrollSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState('Urgent Manpower');
  const [userName, setUserName] = useState('anubhab.19518');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedWs = localStorage.getItem('payroll_workspace_name');
        if (savedWs) setWorkspaceName(savedWs);

        const storedUser = localStorage.getItem('payroll_user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          setUserName(parsed.name || parsed.email?.split('@')[0] || 'anubhab.19518');
        }
      } catch {
        // Ignore
      }
    }
  }, []);

  const handleSignOut = () => {
    clearAuthTokens();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('payroll_jwt_token');
      localStorage.removeItem('hr-dashboard-token');
      localStorage.removeItem('payroll_user');
      localStorage.removeItem('payroll_workspace_id');
      localStorage.removeItem('payroll_workspace_name');
      localStorage.removeItem('hr-dashboard-workspace-id');
    }
    router.push('/login');
  };

  return (
    <aside
      style={{
        width: '240px',
        backgroundColor: 'hsl(var(--bg-surface))',
        borderRight: '1px solid hsl(var(--border-subtle))',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100vh',
        position: 'sticky',
        top: 0,
        flexShrink: 0,
        zIndex: 20,
      }}
    >
      {/* Top Brand Logo */}
      <div>
        <div
          style={{
            height: '64px',
            padding: '0 var(--space-5)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            borderBottom: '1px solid hsl(var(--border-subtle))',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'hsl(var(--color-brand-accent))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--text-primary))',
              fontWeight: 800,
              fontSize: 'var(--font-size-lg)',
            }}
          >
            H
          </div>
          <div>
            <div
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 800,
                color: 'hsl(var(--text-primary))',
                lineHeight: 1.1,
              }}
            >
              HRMS
            </div>
            <div
              style={{ fontSize: '0.6875rem', color: 'hsl(var(--text-muted))', fontWeight: 500 }}
            >
              Workforce. Simplified.
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <div style={{ padding: 'var(--space-5) var(--space-3)' }}>
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'hsl(var(--text-muted))',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '0 var(--space-2) var(--space-2)',
            }}
          >
            Main Menu
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {MAIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/payroll'
                  ? pathname.startsWith('/payroll') || pathname.startsWith('/portal')
                  : pathname === item.href;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                    backgroundColor: isActive ? 'hsl(var(--color-brand-accent))' : 'transparent',
                    boxShadow: isActive ? 'var(--shadow-md)' : 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom User/Workspace Bar */}
      <div
        style={{
          padding: 'var(--space-4) var(--space-3)',
          borderTop: '1px solid hsl(var(--border-subtle))',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          backgroundColor: 'hsl(var(--bg-secondary))',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'hsl(var(--bg-surface))',
            border: '1px solid hsl(var(--border-subtle))',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              overflow: 'hidden',
            }}
          >
            <FileText size={16} color="hsl(var(--color-brand-accent))" />
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-primary))',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {workspaceName}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'hsl(var(--text-muted))' }}>
                {userName}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-1)',
          }}
        >
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 500,
              color: 'hsl(var(--text-muted))',
              padding: 'var(--space-1)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <HelpCircle size={14} />
            <span>Help</span>
          </button>

          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              color: 'hsl(var(--color-danger))',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-sm)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
