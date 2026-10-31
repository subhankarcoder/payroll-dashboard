import { Check } from 'lucide-react';
import type { PayrollRunStatus } from '@/types/payroll';

interface StepItem {
  id: number;
  key: PayrollRunStatus;
  title: string;
  date?: string | null;
}

export interface StepperProps {
  currentStatus: PayrollRunStatus;
  processedAt?: string | null;
  createdAt?: string | null;
}

const STEPS: StepItem[] = [
  { id: 1, key: 'DRAFT', title: 'Draft' },
  { id: 2, key: 'CALCULATED', title: 'Calculated' },
  { id: 3, key: 'APPROVED', title: 'Approved' },
  { id: 4, key: 'FINALIZED', title: 'Finalized' },
];

function getStepIndex(status: PayrollRunStatus): number {
  switch (status) {
    case 'DRAFT':
      return 1;
    case 'CALCULATED':
    case 'UNDER_REVIEW':
      return 2;
    case 'APPROVED':
      return 3;
    case 'FINALIZED':
      return 4;
    default:
      return 1;
  }
}

export function Stepper({ currentStatus, processedAt, createdAt }: StepperProps) {
  const activeStep = getStepIndex(currentStatus);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', position: 'relative' }}>
      {STEPS.map((step, index) => {
        const isCompleted = activeStep > step.id;
        const isCurrent = activeStep === step.id;
        const isPending = activeStep < step.id;
        const isLast = index === STEPS.length - 1;

        let dateLabel = 'Pending';
        if (step.key === 'DRAFT' && (createdAt || isCompleted || isCurrent)) {
          dateLabel = createdAt
            ? new Date(createdAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '01 Sep 2026';
        } else if (step.key === 'CALCULATED' && (processedAt || isCompleted || isCurrent)) {
          dateLabel = processedAt
            ? new Date(processedAt).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : '10 Sep 2026';
        } else if (isCompleted) {
          dateLabel = 'Completed';
        }

        return (
          <div
            key={step.id}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              alignItems: isLast ? 'flex-end' : index === 0 ? 'flex-start' : 'center',
            }}
          >
            {/* Connecting Bar */}
            {!isLast && (
              <div
                style={{
                  position: 'absolute',
                  top: 'var(--space-3)',
                  left: index === 0 ? 'var(--space-4)' : '50%',
                  right: index === STEPS.length - 2 ? '-50%' : '-50%',
                  width: '100%',
                  height: '3px',
                  backgroundColor:
                    activeStep > step.id
                      ? 'hsl(var(--color-brand-primary))'
                      : 'hsl(var(--border-subtle))',
                  zIndex: 1,
                  transition: 'background-color var(--transition-smooth)',
                }}
              />
            )}

            {/* Step Circle */}
            <div
              style={{
                width: 'var(--space-6)',
                height: 'var(--space-6)',
                borderRadius: 'var(--radius-full)',
                backgroundColor:
                  isCompleted || isCurrent
                    ? 'hsl(var(--color-brand-primary))'
                    : 'hsl(var(--bg-primary))',
                border:
                  isCompleted || isCurrent
                    ? '2px solid hsl(var(--color-brand-primary))'
                    : '2px solid hsl(var(--border-medium))',
                color:
                  isCompleted || isCurrent ? 'hsl(var(--text-inverse))' : 'hsl(var(--text-muted))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                zIndex: 2,
                boxShadow: isCurrent ? '0 0 0 4px hsl(var(--color-brand-primary-light))' : 'none',
                transition: 'all var(--transition-fast)',
              }}
            >
              {isCompleted ? <Check size={14} strokeWidth={3} /> : step.id}
            </div>

            {/* Labels */}
            <div
              style={{
                marginTop: 'var(--space-2)',
                textAlign: isLast ? 'right' : index === 0 ? 'left' : 'center',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: isCurrent ? 700 : 600,
                  color: isCurrent
                    ? 'hsl(var(--color-brand-primary))'
                    : isCompleted
                      ? 'hsl(var(--text-primary))'
                      : 'hsl(var(--text-secondary))',
                }}
              >
                {step.title}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: isPending ? 'hsl(var(--text-muted))' : 'hsl(var(--text-secondary))',
                  marginTop: 'var(--space-1)',
                }}
              >
                {dateLabel}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
