import { DateRangeOption } from '@/lib/dateRange';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DateRangeFilterProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export function DateRangeFilter({
  value,
  onChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  showLabel = true,
  compact = false,
  className,
}: DateRangeFilterProps) {
  return (
    <div className={cn('flex flex-wrap items-end', compact ? 'gap-2' : 'gap-3', className)}>
      <div className="space-y-1">
        {showLabel && (
          <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Date Range</Label>
        )}
        <Select value={value} onValueChange={(next) => onChange(next as DateRangeOption)}>
          <SelectTrigger
            className={cn(
              compact
                ? 'h-8 min-w-[148px] rounded-xl border border-[#D9E6FF] bg-[#F8FBFF] text-[#1E2A5A] shadow-none hover:bg-[#EEF4FF] focus:ring-2 focus:ring-primary/20 focus:ring-offset-0 dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:hover:bg-slate-900/80'
                : 'h-9 min-w-[160px]'
            )}
          >
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value === 'custom' && (
        <div className={cn('flex flex-wrap items-end', compact ? 'gap-2' : 'gap-3')}>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Start</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              className={cn(compact ? 'h-8' : 'h-9')}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">End</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              className={cn(compact ? 'h-8' : 'h-9')}
            />
          </div>
        </div>
      )}
    </div>
  );
}
