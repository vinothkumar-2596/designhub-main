import { useEffect, useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { mockTasks } from '@/data/mockTasks';
import { mergeLocalTasks } from '@/lib/taskStorage';
import { filterTasksForUser } from '@/lib/taskVisibility';
import { useAuth } from '@/contexts/AuthContext';
import { Search } from 'lucide-react';
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import type { Task as ScheduleTask } from '@/lib/designerSchedule';
import {
  DEFAULT_ESTIMATED_DAYS,
  buildScheduleFromTasks,
  getDefaultDesignerId,
} from '@/lib/designerSchedule';
import { API_URL, authFetch } from '@/lib/api';

const priorityClasses: Record<ScheduleTask['priority'], string> = {
  VIP: 'gantt-priority-vip',
  HIGH: 'gantt-priority-high',
  NORMAL: 'gantt-priority-normal',
};

export default function DesignerAvailability() {
  const apiUrl = API_URL;
  const { user } = useAuth();
  const [rawTasks, setRawTasks] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTrackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({ isDragging: false, startX: 0, startScrollLeft: 0 });
  const today = useMemo(() => startOfDay(new Date()), []);
  const [scrollState, setScrollState] = useState({
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    trackWidth: 0,
  });
  const normalizeDesignerAssignments = (tasks: any[]) => {
    if (!user || user.role !== 'designer') return tasks;
    return tasks.map((task) => {
      const assignedId = task?.assignedToId || task?.assignedTo || '';
      const assignedName = task?.assignedToName || '';
      if (!assignedId && !assignedName) {
        return { ...task, assignedToId: user.id };
      }
      return task;
    });
  };

  const getLocalTasks = () =>
    normalizeDesignerAssignments(
      filterTasksForUser(
        typeof window === 'undefined' ? mockTasks : mergeLocalTasks(mockTasks),
        user
      )
    );

  useEffect(() => {
    if (!apiUrl) {
      setRawTasks(getLocalTasks());
      return;
    }
    let isActive = true;
    const loadSchedule = async () => {
      try {
        const response = await authFetch(`${apiUrl}/api/tasks`);
        if (!response.ok) {
          throw new Error('Failed to load tasks');
        }
        const data = await response.json();
        if (!isActive) return;
        const visibleTasks = filterTasksForUser(data, user);
        setRawTasks(normalizeDesignerAssignments(visibleTasks));
      } catch {
        if (!isActive) return;
        setRawTasks(getLocalTasks());
      }
    };
    loadSchedule();
    return () => {
      isActive = false;
    };
  }, [apiUrl, user]);

  useEffect(() => {
    if (!apiUrl) return;
    const handleNewRequest = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (!payload) return;
      const id = payload.id || payload._id;
      if (!id) return;
      setRawTasks((prev) => {
        if (prev.some((task) => (task.id || task._id) === id)) {
          return prev;
        }
        return [payload, ...prev];
      });
    };
    window.addEventListener('designhub:request:new', handleNewRequest);
    return () => window.removeEventListener('designhub:request:new', handleNewRequest);
  }, [apiUrl]);

  const scheduleTasks = useMemo(
    () => buildScheduleFromTasks(rawTasks),
    [rawTasks]
  );

  const designerId = useMemo(
    () => getDefaultDesignerId(scheduleTasks),
    [scheduleTasks]
  );

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return scheduleTasks
      .filter(
        (task) =>
          task.designerId === designerId &&
          task.status !== 'COMPLETED' &&
          task.status !== 'EMERGENCY_PENDING' &&
          (!normalizedQuery ||
            task.title.toLowerCase().includes(normalizedQuery))
      )
      .sort(
        (a, b) =>
          (a.actualStartDate?.getTime() ?? 0) - (b.actualStartDate?.getTime() ?? 0)
      );
  }, [designerId, query, scheduleTasks]);

  const availabilityTasks = useMemo(() => {
    return filteredTasks
      .map((task) => {
        const start = task.actualStartDate
          ? startOfDay(new Date(task.actualStartDate))
          : null;
        const end = task.actualEndDate
          ? startOfDay(new Date(task.actualEndDate))
          : null;

        if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          return {
            id: task.id,
            title: task.title,
            start,
            end,
            priority: task.priority,
          };
        }

        const deadline = task.requestedDeadline
          ? startOfDay(new Date(task.requestedDeadline))
          : null;
        const duration = Math.max(
          Number(task.estimatedDays || DEFAULT_ESTIMATED_DAYS),
          1
        );

        if (deadline && !Number.isNaN(deadline.getTime())) {
          const derivedStart = addDays(deadline, -(duration - 1));
          return {
            id: task.id,
            title: task.title,
            start: derivedStart,
            end: deadline,
            priority: task.priority,
          };
        }

        if (start && !Number.isNaN(start.getTime())) {
          const derivedEnd = addDays(start, duration - 1);
          return {
            id: task.id,
            title: task.title,
            start,
            end: derivedEnd,
            priority: task.priority,
          };
        }

        if (end && !Number.isNaN(end.getTime())) {
          const derivedStart = addDays(end, -(duration - 1));
          return {
            id: task.id,
            title: task.title,
            start: derivedStart,
            end,
            priority: task.priority,
          };
        }

        return null;
      })
      .filter((task): task is NonNullable<typeof task> => Boolean(task));
  }, [filteredTasks]);

  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(today));
  const [activeDate, setActiveDate] = useState(() => today);

  useEffect(() => {
    setActiveDate((current) => {
      if (isSameMonth(current, activeMonth)) return current;
      return isSameMonth(today, activeMonth) ? today : startOfMonth(activeMonth);
    });
  }, [activeMonth, today]);

  const activeYear = activeMonth.getFullYear();
  const monthsInYear = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        startOfMonth(new Date(activeYear, index, 1))
      ),
    [activeYear]
  );

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(activeMonth);
    const end = endOfMonth(activeMonth);
    return eachDayOfInterval({ start, end });
  }, [activeMonth]);

  const monthStart = useMemo(() => startOfMonth(activeMonth), [activeMonth]);
  const monthEnd = useMemo(() => endOfMonth(activeMonth), [activeMonth]);

  const busyDayKeys = useMemo(() => {
    const set = new Set<string>();
    if (availabilityTasks.length === 0) return set;
    availabilityTasks.forEach((task) => {
      const start = task.start > monthStart ? task.start : monthStart;
      const end = task.end < monthEnd ? task.end : monthEnd;
      if (start > end) return;
      for (let day = start; day <= end; day = addDays(day, 1)) {
        set.add(format(day, 'yyyy-MM-dd'));
      }
    });
    return set;
  }, [availabilityTasks, monthEnd, monthStart]);

  const monthBars = useMemo(() => {
    return availabilityTasks
      .map((task) => {
        const rangeStart = task.start > monthStart ? task.start : monthStart;
        const rangeEnd = task.end < monthEnd ? task.end : monthEnd;
        if (rangeEnd < rangeStart) return null;
        const startIndex = differenceInCalendarDays(rangeStart, monthStart);
        const endIndex = differenceInCalendarDays(rangeEnd, monthStart);
        return {
          ...task,
          rangeStart,
          rangeEnd,
          startIndex,
          endIndex,
        };
      })
      .filter((task): task is NonNullable<typeof task> => Boolean(task));
  }, [availabilityTasks, monthEnd, monthStart]);

  const tasksForDate = useMemo(() => {
    if (!activeDate) return [];
    return availabilityTasks.filter((task) =>
      isWithinInterval(activeDate, { start: task.start, end: task.end })
    );
  }, [availabilityTasks, activeDate]);

  const busyMonthKeys = useMemo(() => {
    const set = new Set<string>();
    availabilityTasks.forEach((task) => {
      set.add(format(task.start, 'yyyy-MM'));
      set.add(format(task.end, 'yyyy-MM'));
    });
    return set;
  }, [availabilityTasks]);

  const dayWidth = 44;
  const gridTemplateStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${daysInMonth.length}, ${dayWidth}px)`,
      minWidth: `${daysInMonth.length * dayWidth}px`,
    }),
    [daysInMonth.length]
  );

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const index = daysInMonth.findIndex((day) => isSameDay(day, activeDate));
    if (index < 0) {
      container.scrollLeft = 0;
      return;
    }
    requestAnimationFrame(() => {
      const cells = container.querySelectorAll<HTMLElement>('.availability-daycell');
      const cell = cells[index];
      if (!cell) return;
      const containerRect = container.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      const offsetLeft = cellRect.left - containerRect.left + container.scrollLeft;
      const target = offsetLeft - (containerRect.width - cellRect.width) / 2;
      container.scrollLeft = Math.max(0, target);
    });
  }, [activeDate, daysInMonth]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const update = () => {
      const trackWidth = scrollTrackRef.current?.clientWidth ?? container.clientWidth;
      setScrollState({
        scrollLeft: container.scrollLeft,
        scrollWidth: container.scrollWidth,
        clientWidth: container.clientWidth,
        trackWidth,
      });
    };
    update();
    const onScroll = () => update();
    container.addEventListener('scroll', onScroll, { passive: true });
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(container);
      if (scrollTrackRef.current) {
        resizeObserver.observe(scrollTrackRef.current);
      }
    }
    return () => {
      container.removeEventListener('scroll', onScroll);
      resizeObserver?.disconnect();
    };
  }, [daysInMonth.length]);

  const thumbWidth = useMemo(() => {
    if (scrollState.scrollWidth <= 0) return 0;
    const ratio = scrollState.clientWidth / scrollState.scrollWidth;
    return Math.max(28, Math.round(scrollState.trackWidth * ratio));
  }, [scrollState.clientWidth, scrollState.scrollWidth, scrollState.trackWidth]);

  const thumbLeft = useMemo(() => {
    const maxScrollLeft = scrollState.scrollWidth - scrollState.clientWidth;
    const maxThumbLeft = Math.max(0, scrollState.trackWidth - thumbWidth);
    if (maxScrollLeft <= 0) return 0;
    return (scrollState.scrollLeft / maxScrollLeft) * maxThumbLeft;
  }, [scrollState.clientWidth, scrollState.scrollLeft, scrollState.scrollWidth, scrollState.trackWidth, thumbWidth]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragStateRef.current.isDragging) return;
      if (!scrollRef.current || !scrollTrackRef.current) return;
      const maxScrollLeft =
        scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
      const trackWidth = scrollTrackRef.current.clientWidth;
      const thumbTravel = Math.max(1, trackWidth - thumbWidth);
      const deltaX = event.clientX - dragStateRef.current.startX;
      const scrollDelta = (deltaX / thumbTravel) * maxScrollLeft;
      scrollRef.current.scrollLeft =
        dragStateRef.current.startScrollLeft + scrollDelta;
    };
    const handlePointerUp = () => {
      dragStateRef.current.isDragging = false;
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [thumbWidth]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#D9E6FF] bg-white/70 backdrop-blur-xl p-6 shadow-card dark:border-slate-700/60 dark:bg-slate-900/60">
          <div className="availability-top">
            <div>
              <p className="availability-top__kicker dark:text-slate-400">Availability</p>
              <h1 className="availability-top__title dark:text-slate-100">Designer availability</h1>
              <p className="availability-top__subtitle dark:text-slate-400">
                See which dates are busy and which tasks are committed.
              </p>
            </div>
            <div className="availability-top__actions">
              <div className="search-elastic group flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/95 px-3 py-2 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/80">
                <Search className="search-elastic-icon h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tasks"
                  aria-label="Search tasks"
                  className="search-elastic-input w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="availability-months dark:text-slate-400">
            {monthsInYear.map((month) => {
              const isActive = isSameMonth(month, activeMonth);
              const isBusy = busyMonthKeys.has(format(month, 'yyyy-MM'));
              return (
                <button
                  key={month.toISOString()}
                  type="button"
                  className="availability-month dark:text-slate-300 dark:data-[active=true]:bg-slate-800/70 dark:data-[active=true]:text-slate-50 dark:hover:text-slate-100"
                  data-active={isActive}
                  data-busy={isBusy}
                  onClick={() => setActiveMonth(month)}
                >
                  {format(month, 'MMM')}
                </button>
              );
            })}
          </div>

          <div className="availability-calendar">
            <div className="availability-calendar__meta dark:text-slate-200">
              {format(activeMonth, 'MMMM yyyy')}
            </div>
            <div className="availability-calendar__scroll dark:border-slate-700/60 dark:bg-slate-900/60 dark:shadow-none dark:before:bg-slate-900/60 dark:before:bg-none dark:after:bg-slate-900/60 dark:after:bg-none">
              <div className="availability-calendar__scroll-inner" ref={scrollRef}>
                <div className="availability-calendar__grid dark:border-slate-700/60" style={gridTemplateStyle}>
                  {daysInMonth.map((day) => {
                    const key = format(day, 'yyyy-MM-dd');
                    const isBusy = busyDayKeys.has(key);
                    const isActive = isSameDay(day, activeDate);
                    return (
                      <button
                        key={key}
                        type="button"
                        className="availability-daycell dark:bg-none dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-400 dark:shadow-none dark:data-[busy=true]:bg-amber-900/20 dark:data-[busy=true]:border-amber-500/30 dark:data-[busy=true]:text-amber-300 dark:data-[active=true]:bg-slate-800/70 dark:data-[active=true]:border-slate-600/60 dark:data-[active=true]:text-slate-50 dark:data-[active=true]:shadow-none"
                        data-busy={isBusy}
                        data-active={isActive}
                        onClick={() => setActiveDate(day)}
                      >
                        <span className="availability-daycell__num">
                          {format(day, 'd')}
                        </span>
                        <span className="availability-daycell__dow">
                          {format(day, 'EEE')}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="availability-bars">
                  {monthBars.length === 0 ? (
                    <div className="availability-bars__empty dark:text-slate-400">
                      No tasks scheduled this month.
                    </div>
                  ) : (
                    monthBars.map((task) => (
                      <div
                        key={task.id}
                        className="availability-bar-row"
                        style={gridTemplateStyle}
                      >
                        <div
                          className={`availability-bar ${priorityClasses[task.priority] || ''} dark:bg-none dark:bg-slate-800/70 dark:border-slate-700/60 dark:text-slate-100 dark:shadow-none`}
                          style={{
                            gridColumn: `${task.startIndex + 1} / ${task.endIndex + 2}`,
                          }}
                        >
                          <span className="availability-bar__label">{task.title}</span>
                          <span className="availability-bar__tooltip">
                            {task.title} - {format(task.rangeStart, 'MMM d')} -{' '}
                            {format(task.rangeEnd, 'MMM d')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="availability-scrollbar" aria-hidden="true">
                <div
                  className="availability-scrollbar__track dark:bg-slate-700/40"
                  ref={scrollTrackRef}
                  onPointerDown={(event) => {
                    if (!scrollRef.current || !scrollTrackRef.current) return;
                    const trackRect = scrollTrackRef.current.getBoundingClientRect();
                    const clickX = event.clientX - trackRect.left;
                    const maxScrollLeft =
                      scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
                    const travel = Math.max(1, trackRect.width - thumbWidth);
                    const ratio = Math.min(
                      1,
                      Math.max(0, (clickX - thumbWidth / 2) / travel)
                    );
                    scrollRef.current.scrollLeft = ratio * maxScrollLeft;
                  }}
                >
                  <div
                    className="availability-scrollbar__thumb dark:bg-slate-500/80 dark:shadow-none"
                    style={{
                      width: `${thumbWidth}px`,
                      transform: `translateX(${thumbLeft}px)`,
                    }}
                    onPointerDown={(event) => {
                      if (!scrollRef.current) return;
                      dragStateRef.current.isDragging = true;
                      dragStateRef.current.startX = event.clientX;
                      dragStateRef.current.startScrollLeft = scrollRef.current.scrollLeft;
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="availability-events dark:border-slate-700/60">
              <div className="availability-events__date dark:text-slate-200">
                {format(activeDate, 'MMMM d, yyyy')}
              </div>
              <div className="availability-events__list">
                {tasksForDate.length === 0 ? (
                  <div className="availability-events__empty dark:text-slate-400">
                    No tasks scheduled for this date.
                  </div>
                ) : (
                  tasksForDate.map((task) => (
                    <div
                      key={task.id}
                      className={`availability-event ${priorityClasses[task.priority] || ''} dark:bg-none dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-100 dark:shadow-none`}
                    >
                      <div className="availability-event__title dark:text-slate-100">{task.title}</div>
                      <div className="availability-event__meta dark:text-slate-400">
                        {format(task.start, 'MMM d')} - {format(task.end, 'MMM d')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}
