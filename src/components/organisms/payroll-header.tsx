'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Bell, Check, LogOut } from 'lucide-react';
import { SearchBar } from '@/components/molecules/search-bar';
import {
  fetchApi,
  getAuthToken,
  clearAuthTokens,
  setWorkspaceId,
  getWorkspaceId,
} from '@/lib/client/api-client';

interface WorkspaceItem {
  id: string;
  name: string;
  slug?: string;
  role?: string;
}

interface StoredUser {
  id?: string;
  email?: string;
  name?: string | null;
  role?: string;
  isSuperAdmin?: boolean;
}

export function PayrollHeader() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('Urgent Manpower');
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);

  const workspaceMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Load user from storage and fetch live workspaces
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedUserJson = localStorage.getItem('payroll_user');
        if (storedUserJson) {
          setUser(JSON.parse(storedUserJson));
        }
        const savedWsName = localStorage.getItem('payroll_workspace_name');
        if (savedWsName) {
          setSelectedWorkspace(savedWsName);
        }
      } catch {
        // Ignore parse error
      }
    }

    const loadWorkspaces = async () => {
      const token = getAuthToken();
      if (!token) return;

      try {
        const res = await fetchApi<WorkspaceItem[] | { data?: WorkspaceItem[] }>(
          '/api/v1/workspaces',
        );
        const list: WorkspaceItem[] = Array.isArray(res)
          ? res
          : Array.isArray((res as { data?: WorkspaceItem[] })?.data)
            ? (res as { data: WorkspaceItem[] }).data
            : [];

        if (list.length > 0) {
          setWorkspaces(list);
          const currentId = getWorkspaceId();
          const match = list.find((w) => w.id === currentId);
          if (match) {
            setSelectedWorkspace(match.name);
            if (typeof window !== 'undefined') {
              localStorage.setItem('payroll_workspace_name', match.name);
            }
          } else if (list[0]) {
            setSelectedWorkspace(list[0].name);
            setWorkspaceId(list[0].id);
            if (typeof window !== 'undefined') {
              localStorage.setItem('payroll_workspace_name', list[0].name);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch user workspaces:', err);
      }
    };

    loadWorkspaces();
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (workspaceMenuRef.current && !workspaceMenuRef.current.contains(e.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectWorkspace = (ws: WorkspaceItem) => {
    setSelectedWorkspace(ws.name);
    setWorkspaceId(ws.id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('payroll_workspace_name', ws.name);
    }
    setIsWorkspaceMenuOpen(false);
    // Reload page to re-fetch all domain items for the new workspace
    window.location.reload();
  };

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

  const userDisplayName = user?.name || user?.email?.split('@')[0] || 'anubhab.19518';
  const userRole = user?.isSuperAdmin ? 'Super Admin' : 'Workspace Admin';
  const initial = userDisplayName.charAt(0).toUpperCase();

  return (
    <header
      style={{
        height: '64px',
        backgroundColor: 'hsl(var(--bg-surface))',
        borderBottom: '1px solid hsl(var(--border-subtle))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-6)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      {/* Left: Dynamic Workspace Selector */}
      <div ref={workspaceMenuRef} style={{ position: 'relative', width: '280px' }}>
        <button
          onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid hsl(var(--border-subtle))',
            backgroundColor: 'hsl(var(--bg-surface))',
            color: 'hsl(var(--text-primary))',
            fontSize: 'var(--font-size-sm)',
            fontWeight: 500,
            width: '100%',
            justifyContent: 'space-between',
            transition: 'border-color var(--transition-fast)',
            cursor: 'pointer',
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
            <Building2 size={16} color="hsl(var(--color-brand-accent))" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedWorkspace}
            </span>
          </div>
          <ChevronDown size={14} color="hsl(var(--text-muted))" />
        </button>

        {isWorkspaceMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              width: '100%',
              backgroundColor: 'hsl(var(--bg-surface))',
              borderRadius: 'var(--radius-md)',
              border: '1px solid hsl(var(--border-subtle))',
              boxShadow: 'var(--shadow-lg)',
              padding: 'var(--space-1)',
              zIndex: 40,
            }}
          >
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: 'hsl(var(--text-muted))',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: 'var(--space-2) var(--space-3) var(--space-1)',
              }}
            >
              Your Workspaces
            </div>
            {workspaces.length > 0 ? (
              workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSelectWorkspace(ws)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)',
                    color:
                      selectedWorkspace === ws.name
                        ? 'hsl(var(--color-brand-accent))'
                        : 'hsl(var(--text-secondary))',
                    backgroundColor:
                      selectedWorkspace === ws.name
                        ? 'hsl(var(--color-brand-accent-subtle))'
                        : 'transparent',
                    fontWeight: selectedWorkspace === ws.name ? 600 : 400,
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                >
                  <span>{ws.name}</span>
                  {selectedWorkspace === ws.name && <Check size={14} />}
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: 'var(--font-size-xs)',
                  color: 'hsl(var(--text-muted))',
                }}
              >
                {selectedWorkspace}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Middle: Global Search */}
      <div style={{ width: '440px', maxWidth: '40%' }}>
        <SearchBar placeholder="Search employees, payroll runs, components..." />
      </div>

      {/* Right: Notifications, User Profile & Sign Out */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            aria-label="Notifications"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'hsl(var(--text-muted))',
              backgroundColor: 'hsl(var(--bg-secondary))',
              border: '1px solid hsl(var(--border-subtle))',
              cursor: 'pointer',
            }}
          >
            <Bell size={18} />
          </button>
        </div>

        {/* User Profile Dropdown */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-1) var(--space-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid hsl(var(--border-subtle))',
              backgroundColor: 'hsl(var(--bg-surface))',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'hsl(var(--color-brand-accent))',
                color: 'hsl(var(--text-primary))',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {initial}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--text-primary))',
                  maxWidth: '120px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {userDisplayName}
              </span>
              <span style={{ fontSize: '0.6875rem', color: 'hsl(var(--text-muted))' }}>
                {userRole}
              </span>
            </div>
            <ChevronDown size={14} color="hsl(var(--text-muted))" />
          </button>

          {isUserMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '220px',
                backgroundColor: 'hsl(var(--bg-surface))',
                borderRadius: 'var(--radius-md)',
                border: '1px solid hsl(var(--border-subtle))',
                boxShadow: 'var(--shadow-lg)',
                padding: 'var(--space-2)',
                zIndex: 40,
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-1)',
              }}
            >
              <div
                style={{
                  padding: 'var(--space-2)',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    color: 'hsl(var(--text-primary))',
                  }}
                >
                  {user?.email || 'anubhab.19518@gmail.com'}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'hsl(var(--text-muted))' }}>
                  Active in: {selectedWorkspace}
                </div>
              </div>

              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'hsl(var(--color-danger))',
                  backgroundColor: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  marginTop: 'var(--space-1)',
                  transition: 'background-color var(--transition-fast)',
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Dedicated Sign Out Button for direct 1-click access */}
        <button
          onClick={handleSignOut}
          title="Sign Out of Payroll"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid hsl(var(--color-danger) / 0.3)',
            backgroundColor: 'hsl(var(--color-danger-bg))',
            color: 'hsl(var(--color-danger))',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
