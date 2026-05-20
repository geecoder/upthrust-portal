'use client';
import React, { ReactNode } from 'react';
import clsx from 'clsx';

// ─── Button ──────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}
export function Button({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center gap-2 font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-ink text-paper hover:bg-amber-deep': variant === 'primary',
          'bg-transparent border border-ink text-ink hover:bg-ink hover:text-paper': variant === 'secondary',
          'bg-transparent text-ink-muted hover:text-ink': variant === 'ghost',
          'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2.5 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

// ─── Badge ───────────────────────────────────────────────────
interface BadgeProps { children: ReactNode; color?: 'default' | 'green' | 'amber' | 'red' | 'blue' | 'purple'; className?: string; }
export function Badge({ children, color = 'default', className }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 text-xs font-bold tracking-wider uppercase', {
      'bg-paper-line text-ink-muted': color === 'default',
      'bg-moss/10 text-moss': color === 'green',
      'bg-amber/10 text-amber-deep': color === 'amber',
      'bg-red-100 text-red-700': color === 'red',
      'bg-blue-100 text-blue-700': color === 'blue',
      'bg-purple-100 text-purple-700': color === 'purple',
    }, className)}>
      {children}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────
interface CardProps { children: ReactNode; className?: string; hover?: boolean; style?: React.CSSProperties; }
export function Card({ children, className, hover, style }: CardProps) {
  return (
    <div style={style} className={clsx('bg-white border border-paper-line', hover && 'transition-all duration-200 hover:border-ink hover:-translate-y-0.5 hover:shadow-lg', className)}>
      {children}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────
interface ProgressBarProps { value: number; max?: number; color?: string; height?: number; className?: string; }
export function ProgressBar({ value, max = 100, color = '#C5743A', height = 4, className }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={clsx('rounded-full overflow-hidden', className)} style={{ height, background: 'var(--paper-line)' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 600ms cubic-bezier(0.2,0.7,0.2,1)' }} />
    </div>
  );
}

// ─── Progress Ring ────────────────────────────────────────────
interface ProgressRingProps { value: number; size?: number; strokeWidth?: number; color?: string; label?: string; sublabel?: string; }
export function ProgressRing({ value, size = 80, strokeWidth = 6, color = '#C5743A', label, sublabel }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="progress-ring">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="var(--paper-line)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.2,0.7,0.2,1)' }}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-ink leading-none" style={{ fontSize: size * 0.2 }}>{label}</span>
          {sublabel && <span className="text-ink-muted leading-none mt-0.5" style={{ fontSize: size * 0.12 }}>{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────
export function Spinner({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <div style={{ width: size, height: size, border: `2px solid transparent`, borderTopColor: color, borderRadius: '50%', animation: 'spin 600ms linear infinite', flexShrink: 0 }} />
  );
}

// ─── Empty State ─────────────────────────────────────────────
export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="mb-4 text-paper-line">{icon}</div>}
      <p className="font-serif text-xl font-medium text-ink">{title}</p>
      {description && <p className="mt-2 text-sm text-ink-muted max-w-sm">{description}</p>}
    </div>
  );
}

// ─── Phase Badge ─────────────────────────────────────────────
export function PhaseBadge({ phase }: { phase: string }) {
  const labels: Record<string, string> = { foundation: 'Foundation', core: 'Core Skills', delivery: 'Delivery', capstone: 'Capstone' };
  return <span className={`phase-${phase} status-badge`}>{labels[phase] || phase}</span>;
}

// ─── Status Badge ─────────────────────────────────────────────
export function SubmissionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: BadgeProps['color'] }> = {
    not_submitted: { label: 'Not submitted', color: 'default' },
    submitted: { label: 'Submitted', color: 'blue' },
    in_review: { label: 'In review', color: 'amber' },
    needs_revision: { label: 'Needs revision', color: 'red' },
    approved: { label: 'Approved', color: 'green' },
    portfolio_ready: { label: 'Portfolio ready', color: 'purple' },
  };
  const { label, color } = config[status] || { label: status, color: 'default' as const };
  return <Badge color={color}>{label}</Badge>;
}

// ─── Risk Dot ────────────────────────────────────────────────
export function RiskDot({ status }: { status: 'green' | 'amber' | 'red' }) {
  const colors = { green: '#4F6A4A', amber: '#C5743A', red: '#B3382C' };
  return <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors[status] }} />;
}

// ─── Section Header ──────────────────────────────────────────
export function SectionHeader({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="font-serif text-3xl font-medium tracking-tight text-ink">{title}</h1>
      {description && <p className="mt-3 text-ink-muted max-w-2xl">{description}</p>}
    </div>
  );
}
