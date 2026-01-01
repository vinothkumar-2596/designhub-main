import { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
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
  default: 'bg-[#F3F7FF] border-[#D9E6FF]',
  primary: 'bg-[#F3F7FF] border-[#D9E6FF]',
  warning: 'bg-[#F3F7FF] border-[#D9E6FF]',
  success: 'bg-[#F3F7FF] border-[#D9E6FF]',
  urgent: 'bg-[#F3F7FF] border-[#D9E6FF]',
};

const iconStyles = {
  default: 'bg-gradient-to-br from-[#b16cff] to-[#7c3aed] text-white shadow-sm',
  primary: 'bg-gradient-to-br from-[#60a5fa] to-[#2563eb] text-white shadow-sm',
  warning: 'bg-gradient-to-br from-[#fbbf24] to-[#f97316] text-white shadow-sm',
  success: 'bg-gradient-to-br from-[#34d399] to-[#10b981] text-white shadow-sm',
  urgent: 'bg-gradient-to-br from-[#f87171] to-[#ef4444] text-white shadow-sm',
};

export function StatsCard({ title, value, icon, trend, variant = 'default' }: StatsCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border p-4 shadow-[0_12px_24px_-16px_hsl(var(--foreground)_/_0.2)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card-hover animate-slide-up',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconStyles[variant])}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-sm font-medium text-foreground/80">
            <span>{title}</span>
          </div>
          <p className="mt-2 text-[22px] font-semibold tracking-tight text-foreground">{value}</p>
          {trend && (
            <div
              className={cn(
                'mt-1 flex items-center gap-1 text-xs font-medium',
                trend.isPositive ? 'text-status-completed' : 'text-status-urgent'
              )}
            >
              {trend.isPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-muted-foreground">from last quarter</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
