import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { mockTasks } from '@/data/mockTasks';
import {
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
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
import type { Task as ScheduleTask } from '@/lib/designerSchedule';
import type { TaskStatus } from '@/types';
import {
  buildScheduleFromTasks,
  getDefaultDesignerId,
} from '@/lib/designerSchedule';
import { cn } from '@/lib/utils';
import { mergeLocalTasks } from '@/lib/taskStorage';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { buildSearchItemsFromTasks, matchesSearch } from '@/lib/search';
import { API_URL, authFetch } from '@/lib/api';

const scheduleStatusStyles: Record<ScheduleTask['status'], string> = {
  QUEUED: 'border border-border bg-secondary text-muted-foreground',
  WORK_STARTED: 'bg-status-progress-bg text-status-progress',
  COMPLETED: 'bg-status-completed-bg text-status-completed',
  EMERGENCY_PENDING: 'bg-status-urgent-bg text-status-urgent',
};

const priorityStyles: Record<ScheduleTask['priority'], { bar: string; dot: string }> = {
  VIP: { bar: 'bg-[#ef4444] text-white', dot: 'bg-[#ef4444]' },
  HIGH: { bar: 'bg-[#f59e0b] text-slate-900', dot: 'bg-[#f59e0b]' },
  NORMAL: { bar: 'bg-[#3b82f6] text-white', dot: 'bg-[#3b82f6]' },
};

const taskStatusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  clarification_required: 'Clarification Required',
  under_review: 'Under Review',
  completed: 'Completed',
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Tasks() {
  const { user } = useAuth();
  const { query, setItems, setScopeLabel } = useGlobalSearch();
  const apiUrl = API_URL;
  const [tasks, setTasks] = useState(mockTasks);
  const [storageTick, setStorageTick] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(new Date()));
  const [useLocalData, setUseLocalData] = useState(!apiUrl);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('designhub.task.')) {
        setStorageTick((prev) => prev + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const hydrateTask = (task: any) => ({
    ...task,
    id: task.id || task._id,
    deadline: new Date(task.deadline),
    createdAt: new Date(task.createdAt),
    updatedAt: new Date(task.updatedAt),
    proposedDeadline: task.proposedDeadline ? new Date(task.proposedDeadline) : undefined,
    deadlineApprovedAt: task.deadlineApprovedAt ? new Date(task.deadlineApprovedAt) : undefined,
    files: task.files?.map((file: any) => ({
      ...file,
      uploadedAt: new Date(file.uploadedAt),
    })),
    comments: task.comments?.map((comment: any) => ({
      ...comment,
      createdAt: new Date(comment.createdAt),
    })),
    changeHistory: task.changeHistory?.map((entry: any) => ({
      ...entry,
      createdAt: new Date(entry.createdAt),
    })),
  });

  const loadTasks = async () => {
    if (!apiUrl) return;
    setIsLoading(true);
    try {
      const response = await authFetch(`${apiUrl}/api/tasks`);
      if (!response.ok) {
        throw new Error('Failed to load tasks');
      }
      const data = await response.json();
      const hydrated = data.map(hydrateTask);
      setTasks(hydrated);
      setUseLocalData(false);
    } catch (error) {
      toast.error('Failed to load tasks');
      setUseLocalData(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!apiUrl) return;
    loadTasks();
  }, [apiUrl]);

  const hydratedTasks = useMemo(() => {
    if (!useLocalData) return tasks;
    if (typeof window === 'undefined') return mockTasks;
    return mergeLocalTasks(mockTasks);
  }, [useLocalData, storageTick, tasks]);

  const scheduleSourceTasks = useMemo(() => {
    if (!apiUrl || useLocalData) return [];
    return tasks;
  }, [apiUrl, tasks, useLocalData]);

  const scheduleTasks = useMemo(
    () => buildScheduleFromTasks(scheduleSourceTasks),
    [scheduleSourceTasks]
  );

  useEffect(() => {
    setScopeLabel('Requests');
    setItems(buildSearchItemsFromTasks(hydratedTasks));
  }, [hydratedTasks, setItems, setScopeLabel]);

  const filteredTasks = useMemo(
    () =>
      hydratedTasks.filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.assignedToName,
          task.category,
          task.status,
          task.urgency,
        ])
      ),
    [hydratedTasks, query]
  );

  const designerId = useMemo(
    () => getDefaultDesignerId(scheduleTasks),
    [scheduleTasks]
  );
  const designerScheduleTasks = useMemo(
    () =>
      scheduleTasks.filter((task) => task.designerId === designerId),
    [designerId, scheduleTasks]
  );
  const scheduledTasks = useMemo(
    () =>
      designerScheduleTasks
        .filter(
          (task) =>
            task.status !== 'COMPLETED' && task.status !== 'EMERGENCY_PENDING'
        )
        .sort((a, b) =>
          (a.actualStartDate?.getTime() ?? 0) - (b.actualStartDate?.getTime() ?? 0)
        ),
    [designerScheduleTasks]
  );
  const emergencyTasks = useMemo(
    () =>
      designerScheduleTasks.filter(
        (task) => task.status === 'EMERGENCY_PENDING'
      ),
    [designerScheduleTasks]
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

  const handleCompleteScheduleTask = (taskId: string) => {
    if (!apiUrl) {
      toast.error('API URL is not configured');
      return;
    }
    const linkedTask = tasks.find((task) => task.id === taskId);
    const now = new Date();
    const oldLabel = linkedTask?.status ? taskStatusLabels[linkedTask.status] : 'Pending';
    authFetch(`${apiUrl}/api/tasks/${taskId}/changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updates: { status: 'completed', updatedAt: now },
        changes: [
          {
            type: 'status',
            field: 'status',
            oldValue: oldLabel,
            newValue: taskStatusLabels.completed,
            note: `Completed by ${user?.name || 'Designer'}`,
          },
        ],
        userId: user?.id || '',
        userName: user?.name || '',
        userRole: user?.role || '',
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to update task');
        }
        toast.success('Task marked as completed.');
      })
      .then(() => loadTasks())
      .catch(() => {
        toast.error('Failed to update task status.');
      });
  };

  const handleApproveEmergency = (taskId: string) => {
    if (!apiUrl) {
      toast.error('API URL is not configured');
      return;
    }
    const now = new Date();
    authFetch(`${apiUrl}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isEmergency: true,
        emergencyApprovalStatus: 'approved',
        emergencyApprovedBy: user?.name || '',
        emergencyApprovedAt: now,
        updatedAt: now,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to approve emergency');
        }
        toast.success('Emergency task approved.');
      })
      .then(() => loadTasks())
      .catch(() => {
        toast.error('Failed to approve emergency task.');
      });
  };

  const handleRejectEmergency = (taskId: string) => {
    if (!apiUrl) {
      toast.error('API URL is not configured');
      return;
    }
    const now = new Date();
    authFetch(`${apiUrl}/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isEmergency: true,
        emergencyApprovalStatus: 'rejected',
        emergencyApprovedBy: user?.name || '',
        emergencyApprovedAt: now,
        updatedAt: now,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to reject emergency');
        }
        toast.message('Emergency request rejected.');
      })
      .then(() => loadTasks())
      .catch(() => {
        toast.error('Failed to reject emergency task.');
      });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">All Tasks</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all design requests
          </p>
        </div>

        {user?.role === 'designer' && (
          <div className="space-y-4">
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

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl border border-[#D9E6FF] bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Sequential queue
                    </p>
                    <h3 className="text-lg font-semibold text-foreground">
                      Auto-shifting workload
                    </h3>
                  </div>
                </div>
                {scheduledTasks.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {scheduledTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-[#E4ECFF] bg-[#F9FBFF] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-foreground">
                                {task.title}
                              </h4>
                              <Badge className={scheduleStatusStyles[task.status]}>
                                {task.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {task.actualStartDate && task.actualEndDate
                                ? `${format(task.actualStartDate, 'MMM d')} - ${format(
                                  task.actualEndDate,
                                  'MMM d'
                                )}`
                                : 'Scheduling...'}{' '}
                              | {task.estimatedDays} days
                              {task.requestedDeadline
                                ? ` | Requested ${format(
                                  task.requestedDeadline,
                                  'MMM d'
                                )}`
                                : ''}
                            </p>
                          </div>
                          {task.status === 'WORK_STARTED' && (
                            <Button
                              size="sm"
                              onClick={() => handleCompleteScheduleTask(task.id)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Complete today
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No scheduled tasks in the queue.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#D9E6FF] bg-white p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      Emergency approvals
                    </p>
                    <h3 className="text-lg font-semibold text-foreground">
                      Awaiting decision
                    </h3>
                  </div>
                  <AlertTriangle className="h-4 w-4 text-status-urgent" />
                </div>
                {emergencyTasks.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {emergencyTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-xl border border-[#F7D7D9] bg-[#FFF5F5] p-4"
                      >
                        <p className="text-sm font-semibold text-foreground">
                          {task.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Requested{' '}
                          {task.requestedDeadline
                            ? format(task.requestedDeadline, 'MMM d')
                            : 'ASAP'}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => handleApproveEmergency(task.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleRejectEmergency(task.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No emergency requests right now.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {user?.role !== 'designer' && (
          <>
            {/* Task Grid */}
            {isLoading ? (
              <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
                <p className="text-sm text-muted-foreground">Loading tasks...</p>
              </div>
            ) : filteredTasks.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredTasks.map((task, index) => (
                  <div key={task.id} style={{ animationDelay: `${index * 50}ms` }}>
                    <TaskCard task={task} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
                <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-medium text-foreground">No tasks found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters or search terms
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
