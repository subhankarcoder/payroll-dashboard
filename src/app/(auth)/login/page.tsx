import type { Metadata } from 'next';
import { LoginForm } from '@/features/authentication/components/login-form';

export const metadata: Metadata = {
  title: 'Sign In | Payroll Control Center',
  description: 'Sign into the Urgent Manpower HRMS Payroll Control Center.',
};

export default function LoginPage() {
  return (
    <div
      style={{
        backgroundColor: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-8)',
        boxShadow: 'var(--shadow-xl)',
        width: '100%',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: 'var(--space-6)',
        }}
      >
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'hsl(var(--color-brand-accent))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'hsl(var(--text-primary))',
            fontWeight: 800,
            fontSize: 'var(--font-size-xl)',
            marginBottom: 'var(--space-3)',
          }}
        >
          H
        </div>
        <h1
          style={{
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 800,
            color: 'hsl(var(--text-primary))',
            letterSpacing: '-0.02em',
          }}
        >
          Payroll Control Center
        </h1>
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'hsl(var(--text-muted))',
            marginTop: 'var(--space-1)',
          }}
        >
          Sign in to access your company workforce and payroll runs
        </p>
      </div>

      <LoginForm />
    </div>
  );
}
