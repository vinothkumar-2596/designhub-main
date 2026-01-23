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
import { buildScheduleFromTasks, getDefaultDesignerId } from '@/lib/designerSchedule';
import { API_URL } from '@/lib/api';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const priorityStyles: Record<ScheduleTask['priority'], { bar: string; dot: string }> = {
  VIP: { bar: 'bg-[#ef4444] text-white', dot: 'bg-[#ef4444]' },
  HIGH: { bar: 'bg-[#f59e0b] text-slate-900', dot: 'bg-[#f59e0b]' },
  NORMAL: { bar: 'bg-[#3b82f6] text-white', dot: 'bg-[#3b82f6]' },
};

export default function DesignerAvailability() {
  const apiUrl = API_URL;
  const [scheduleTasks, setScheduleTasks] = useState<ScheduleTask[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));

  useEffect(() => {
    if (!apiUrl) {
      setScheduleTasks([]);
      return;
    }
    let isActive = true;
    const loadSchedule = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/tasks`);
        if (!response.ok) {
          throw new Error('Failed to load tasks');
        }
        const data = await response.json();
        if (!isActive) return;
        setScheduleTasks(buildScheduleFromTasks(data));
      } catch {
        if (!isActive) return;
        setScheduleTasks([]);
      }
    };
    loadSchedule();
    return () => {
      isActive = false;
    };
  }, [apiUrl]);

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
              {weeks.map((week, weekIndex) => {
                const weekStart = week[0];
                const weekEnd = week[6];

                // Get tasks that overlap with this week
                const weekTasks = scheduledTasks.filter(task => {
                  if (!task.actualStartDate || !task.actualEndDate) return false;
                  return (
                    (task.actualStartDate <= weekEnd) &&
                    (task.actualEndDate >= weekStart)
                  );
                });

                // Sort tasks: Priority (VIP > HIGH > NORMAL) then Start Date
                const priorityOrder = { VIP: 0, HIGH: 1, NORMAL: 2 };
                weekTasks.sort((a, b) => {
                  const pA = priorityOrder[a.priority] ?? 2;
                  const pB = priorityOrder[b.priority] ?? 2;
                  if (pA !== pB) return pA - pB;
                  return (a.actualStartDate?.getTime() ?? 0) - (b.actualStartDate?.getTime() ?? 0);
                });

                // Calculate layout (stacking)
                const layout: { task: ScheduleTask; colStart: number; colSpan: number; row: number }[] = [];
                const occupied = new Set<string>(); // "row-col"

                weekTasks.forEach(task => {
                  if (!task.actualStartDate || !task.actualEndDate) return;

                  // Calculate column range (0-6) relative to weekStart
                  const startDiff = Math.floor((task.actualStartDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
                  let colStart = Math.max(0, startDiff);

                  const endDiff = Math.floor((task.actualEndDate.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
                  let colEnd = Math.min(6, endDiff);

                  if (colStart > 6 || colEnd < 0) return; // Should likely be caught by filter but safety first

                  const colSpan = colEnd - colStart + 1;

                  // Find first available row
                  let row = 0;
                  while (true) {
                    let isRowClear = true;
                    for (let c = colStart; c <= colEnd; c++) {
                      if (occupied.has(`${row}-${c}`)) {
                        isRowClear = false;
                        break;
                      }
                    }
                    if (isRowClear) {
                      // Mark occupied
                      for (let c = colStart; c <= colEnd; c++) {
                        occupied.add(`${row}-${c}`);
                      }
                      layout.push({ task, colStart: colStart + 1, colSpan, row }); // colStart is 1-based in grid
                      break;
                    }
                    row++;
                  }
                });

                // Determine min height based on max row index
                const maxRow = Math.max(-1, ...layout.map(l => l.row));
                const stackHeight = (maxRow + 1) * 30; // 28px height + 2px gap approx
                const headerHeight = 32; // Space for date header
                const minHeight = Math.max(96, stackHeight + headerHeight + 8); // Base height or dynamic

                // Calculate centering offset
                // Available space for events = minHeight - headerHeight
                // Centered top = headerHeight + (Available - stackHeight) / 2
                // We ensure it doesn't go above headerHeight (though math shouldn't allow it if minHeight is large enough)
                const centeredTop = headerHeight + (minHeight - headerHeight - stackHeight) / 2;

                return (
                  <div key={`week-${weekIndex}`} className="relative isolate">
                    {/* Background Grid (Day cells) */}
                    <div className="grid grid-cols-7 gap-2">
                      {week.map((day) => {
                        const isToday = isSameDay(day, new Date());
                        const isOutside = !isSameMonth(day, calendarMonth);
                        return (
                          <div
                            key={day.toISOString()}
                            style={{ height: minHeight }}
                            className={cn(
                              'relative rounded-xl border border-[#E4ECFF] bg-[#F9FBFF] p-2 transition-all',
                              isOutside && 'bg-white/70 text-muted-foreground',
                              isToday && 'ring-1 ring-primary/40 bg-primary/5'
                            )}
                          >
                            <div style={{zIndex:2,position:"absolute"}} className="flex items-start justify-between">
                              <span
                                className={cn(
                                  'text-xs font-semibold',
                                  isToday && 'text-primary'
                                )}
                              >
                                {format(day, 'd')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Events Overlay Grid */}
                    <div
                      className="absolute inset-0 grid grid-cols-7 gap-2 px-0 pb-2 pointer-events-none"
                      style={{ height: minHeight }}
                    >
                      {layout.map((item) => (
                        <div
                          key={`${item.task.id}-${weekIndex}`}
                          className={cn(
                            "relative h-7 flex items-center px-2 rounded-md text-[11px] h-[100%] font-semibold whitespace-nowrap overflow-hidden text-ellipsis shadow-sm pointer-events-auto",
                            priorityStyles[item.task.priority].bar,
                          )}
                          style={{
                            gridColumnStart: item.colStart,
                            gridColumnEnd: `span ${item.colSpan}`,
                            // marginTop: `${centeredTop + (item.row * 30)}px`,
                            zIndex: 0,
                            position: 'absolute',
                            left: 0,
                            right: 0,
                          }}
                        >
                          {item.task.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
