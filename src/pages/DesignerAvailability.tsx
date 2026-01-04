import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task as ScheduleTask } from '@/lib/designerSchedule';
import { getDefaultDesignerId, loadScheduleTasks } from '@/lib/designerSchedule';
import { seedScheduleTasks } from '@/data/designerSchedule';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const priorityStyles: Record<ScheduleTask['priority'], { bar: string; dot: string }> = {
  VIP: { bar: 'bg-[#ef4444] text-white', dot: 'bg-[#ef4444]' },
  HIGH: { bar: 'bg-[#f59e0b] text-slate-900', dot: 'bg-[#f59e0b]' },
  NORMAL: { bar: 'bg-[#3b82f6] text-white', dot: 'bg-[#3b82f6]' },
};

export default function DesignerAvailability() {
  const [scheduleTasks, setScheduleTasks] = useState(() =>
    loadScheduleTasks(seedScheduleTasks)
  );
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'designhub.schedule.tasks') return;
      setScheduleTasks(loadScheduleTasks(seedScheduleTasks));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const designerId = useMemo(
    () => getDefaultDesignerId(scheduleTasks),
    [scheduleTasks]
  );
  const scheduledTasks = useMemo(
    () =>
      scheduleTasks
        .filter(
          (task) =>
            task.designerId === designerId &&
            task.status !== 'COMPLETED' &&
            task.status !== 'EMERGENCY_PENDING'
        )
        .sort((a, b) =>
          (a.actualStartDate?.getTime() ?? 0) - (b.actualStartDate?.getTime() ?? 0)
        ),
    [designerId, scheduleTasks]
  );
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);
  const weeks = useMemo(() => {
    const rows: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      rows.push(calendarDays.slice(i, i + 7));
    }
    return rows;
  }, [calendarDays]);
  const scheduleMap = useMemo(() => {
    const map = new Map<string, ScheduleTask>();
    scheduledTasks.forEach((task) => {
      if (!task.actualStartDate || !task.actualEndDate) return;
      eachDayOfInterval({
        start: task.actualStartDate,
        end: task.actualEndDate,
      }).forEach((day) => {
        map.set(format(day, 'yyyy-MM-dd'), task);
      });
    });
    return map;
  }, [scheduledTasks]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">
            Designer Availability
          </h1>
          <p className="text-muted-foreground mt-1">
            Review upcoming capacity and delivery windows
          </p>
        </div>

        <div className="rounded-2xl border border-[#D9E6FF] bg-white p-4 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Delivery schedule
              </p>
              <h2 className="text-lg font-semibold text-foreground">
                Designer availability calendar
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Requested deadlines are estimates. Actual starts follow availability.
              </p>
            </div>
            <Badge
              variant="outline"
              className="h-fit text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
            >
              Delivery Mode
            </Badge>
          </div>
          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalendarMonth(startOfMonth(new Date()))}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm font-semibold text-foreground">
                {format(calendarMonth, 'MMMM yyyy')}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-muted-foreground font-semibold">
              {weekdayLabels.map((label) => (
                <div key={label} className="text-center">
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-2">
              {weeks.map((week, rowIndex) => (
                <div key={`week-${rowIndex}`} className="grid grid-cols-7 gap-2">
                  {week.map((day) => {
                    const task = scheduleMap.get(format(day, 'yyyy-MM-dd'));
                    const isStart =
                      task?.actualStartDate &&
                      isSameDay(day, task.actualStartDate);
                    const isEnd =
                      task?.actualEndDate && isSameDay(day, task.actualEndDate);
                    const isToday = isSameDay(day, new Date());
                    const isOutside = !isSameMonth(day, calendarMonth);
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          'relative min-h-[96px] rounded-xl border border-[#E4ECFF] bg-[#F9FBFF] p-2',
                          isOutside && 'bg-white/70 text-muted-foreground',
                          isToday && 'ring-1 ring-primary/40'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <span
                            className={cn(
                              'text-xs font-semibold',
                              isToday && 'text-primary'
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          {task && (
                            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                              {task.priority}
                            </span>
                          )}
                        </div>
                        {task && (
                          <div
                            title={task.title}
                            className={cn(
                              'mt-3 h-6 w-full overflow-hidden text-ellipsis whitespace-nowrap px-2 text-[11px] font-semibold',
                              priorityStyles[task.priority].bar,
                              isStart && isEnd && 'rounded-md',
                              isStart && !isEnd && 'rounded-l-md',
                              !isStart && isEnd && 'rounded-r-md',
                              !isStart && !isEnd && 'rounded-none'
                            )}
                          >
                            {isStart ? task.title : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              {(['VIP', 'HIGH', 'NORMAL'] as ScheduleTask['priority'][]).map(
                (level) => (
                  <div key={level} className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        priorityStyles[level].dot
                      )}
                    />
                    <span>{level} Priority</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
