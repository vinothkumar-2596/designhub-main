import { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FeatureCard } from '@/components/ui/animated-card';

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

const truncateByCount = (value: string, maxChars: number) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}...` : text;
};

const variantStyles = {
  default: 'bg-white border-[#D9E6FF] dark:bg-card dark:border-border',
  primary: 'bg-white border-[#D9E6FF] dark:bg-card dark:border-border',
  warning: 'bg-white border-[#D9E6FF] dark:bg-card dark:border-border',
  success: 'bg-white border-[#D9E6FF] dark:bg-card dark:border-border',
  urgent: 'bg-white border-[#D9E6FF] dark:bg-card dark:border-border',
};

const iconBase =
  'relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/95 bg-white/45 dark:bg-slate-800/80 dark:border-slate-700/60 shadow-[0_20px_40px_-18px_rgba(15,23,42,0.35)] backdrop-blur-2xl overflow-hidden before:absolute before:inset-0 before:rounded-xl before:bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,255,255,0.55)_42%,rgba(255,255,255,0.25)_68%)] before:opacity-85 after:absolute after:inset-0 after:rounded-xl after:bg-[radial-gradient(circle_at_18%_12%,_rgba(255,255,255,0.98),_transparent_55%)] after:opacity-80 dark:before:opacity-0 dark:after:opacity-0';

const iconStyles = {
  default: `${iconBase} text-[#3b82f6]`,
  primary: `${iconBase} text-[#3b82f6]`,
  warning: `${iconBase} text-[#3b82f6]`,
  success: `${iconBase} text-[#3b82f6]`,
  urgent: `${iconBase} text-[#3b82f6]`,
};

export function StatsCard({ title, value, icon, trend, variant = 'default' }: StatsCardProps) {
  const mobileTitle = truncateByCount(title, 13);

  return (
    <FeatureCard
      containerClassName="animate-slide-up"
      className={cn(
        'relative overflow-hidden rounded-2xl border p-3 sm:p-3.5 shadow-none min-h-[92px]',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start gap-2 sm:gap-2.5">
        <div className={cn(iconStyles[variant])}>
          <span className="relative z-10">{icon}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-sm font-medium text-foreground/80 leading-tight">
            <span className="block max-w-full sm:hidden truncate" title={title}>{mobileTitle}</span>
            <span className="hidden sm:block max-w-full truncate" title={title}>{title}</span>
          </div>
          <p className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">{value}</p>
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
    </FeatureCard>
  );
}
