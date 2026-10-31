import type { HTMLAttributes, CSSProperties } from 'react';
import type { PayrollRunStatus, SalaryStructureStatus } from '@/types/payroll';

export type BadgeVariant =
  'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'slate';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  status?: PayrollRunStatus | SalaryStructureStatus | string;
}

const badgeVariants: Record<BadgeVariant, CSSProperties> = {
  default: {
    backgroundColor: 'hsl(var(--bg-secondary))',
    color: 'hsl(var(--text-secondary))',
    border: '1px solid hsl(var(--border-subtle))',
  },
  success: {
    backgroundColor: 'hsl(var(--color-success-bg))',
    color: 'hsl(var(--color-success))',
    border: '1px solid hsl(var(--color-success) / 0.3)',
  },
  warning: {
    backgroundColor: 'hsl(var(--color-warning-bg))',
    color: 'hsl(var(--color-warning))',
    border: '1px solid hsl(var(--color-warning) / 0.3)',
  },
  danger: {
    backgroundColor: 'hsl(var(--color-danger-bg))',
    color: 'hsl(var(--color-danger))',
    border: '1px solid hsl(var(--color-danger) / 0.3)',
  },
  info: {
    backgroundColor: 'hsl(var(--color-info-bg))',
    color: 'hsl(var(--color-info))',
    border: '1px solid hsl(var(--color-info) / 0.3)',
  },
  purple: {
    backgroundColor: 'hsl(var(--color-purple-bg))',
    color: 'hsl(var(--color-purple))',
    border: '1px solid hsl(var(--color-purple) / 0.3)',
  },
  slate: {
    backgroundColor: 'hsl(var(--bg-app))',
    color: 'hsl(var(--text-muted))',
    border: '1px solid hsl(var(--border-medium))',
  },
};

export function getStatusBadgeVariant(status?: string): BadgeVariant {
  switch (status) {
    case 'FINALIZED':
    case 'APPROVED':
    case 'ACTIVE':
    case 'POSTED':
      return 'success';
    case 'CALCULATED':
    case 'UNDER_REVIEW':
    case 'In Progress':
      return 'info';
    case 'DRAFT':
    case 'REVISED':
      return 'warning';
    case 'CANCELLED':
    case 'ARCHIVED':
    case 'REVERSED':
      return 'danger';
    case 'COMPLETED':
      return 'purple';
    default:
      return 'default';
  }
}

export function Badge({ children, variant, status, style, ...props }: BadgeProps) {
  const resolvedVariant = variant || (status ? getStatusBadgeVariant(status) : 'default');

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--space-1) var(--space-2)',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        ...badgeVariants[resolvedVariant],
        ...style,
      }}
      {...props}
    >
      {children || status}
    </span>
  );
}
