import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'warning' | 'success' | 'urgent';
}

const variantStyles = {
  default: 'bg-card border-border/70',
  primary: 'bg-primary/5 border-primary/20',
  warning: 'bg-status-pending-bg border-status-pending/25',
  success: 'bg-status-completed-bg border-status-completed/25',
  urgent: 'bg-status-urgent-bg border-status-urgent/25',
};

const iconStyles = {
  default: 'bg-secondary text-secondary-foreground',
  primary: 'bg-primary/15 text-primary',
  warning: 'bg-status-pending/15 text-status-pending',
  success: 'bg-status-completed/15 text-status-completed',
  urgent: 'bg-status-urgent/15 text-status-urgent',
};

const accentStyles = {
  default: 'bg-foreground/10',
  primary: 'bg-primary/60',
  warning: 'bg-status-pending/70',
  success: 'bg-status-completed/70',
  urgent: 'bg-status-urgent/70',
};

export function StatsCard({ title, value, icon, trend, variant = 'default' }: StatsCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover animate-slide-up',
        variantStyles[variant]
      )}
    >
      <div className={cn('absolute left-0 top-0 h-full w-1', accentStyles[variant])} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {title}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {trend && (
            <p
              className={cn(
                'mt-2 text-xs font-medium',
                trend.isPositive ? 'text-status-completed' : 'text-status-urgent'
              )}
            >
              {trend.isPositive ? '�+`' : '�+"'} {Math.abs(trend.value)}% from last week
            </p>
          )}
        </div>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', iconStyles[variant])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
