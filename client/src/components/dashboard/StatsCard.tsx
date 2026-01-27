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
  default: 'bg-[#F3F7FF] border-[#D9E6FF] dark:bg-card/80 dark:border-border',
  primary: 'bg-[#F3F7FF] border-[#D9E6FF] dark:bg-card/80 dark:border-border',
  warning: 'bg-[#F3F7FF] border-[#D9E6FF] dark:bg-card/80 dark:border-border',
  success: 'bg-[#F3F7FF] border-[#D9E6FF] dark:bg-card/80 dark:border-border',
  urgent: 'bg-[#F3F7FF] border-[#D9E6FF] dark:bg-card/80 dark:border-border',
};

const iconBase =
  'relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/95 bg-white/45 dark:bg-slate-800/80 dark:border-slate-700/60 shadow-[0_20px_40px_-18px_rgba(15,23,42,0.35)] backdrop-blur-2xl overflow-hidden before:absolute before:inset-0 before:rounded-xl before:bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,255,255,0.55)_42%,rgba(255,255,255,0.25)_68%)] before:opacity-85 after:absolute after:inset-0 after:rounded-xl after:bg-[radial-gradient(circle_at_18%_12%,_rgba(255,255,255,0.98),_transparent_55%)] after:opacity-80 dark:before:opacity-0 dark:after:opacity-0';

const iconStyles = {
  default: `${iconBase} text-[#7c3aed]`,
  primary: `${iconBase} text-[#2563eb]`,
  warning: `${iconBase} text-[#f97316]`,
  success: `${iconBase} text-[#10b981]`,
  urgent: `${iconBase} text-[#ef4444]`,
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
        <div className={cn(iconStyles[variant])}>
          <span className="relative z-10">{icon}</span>
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
