import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { useAuth } from '@/contexts/AuthContext';
import { mockTasks, calculateStats } from '@/data/mockTasks';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { DateRangeOption, getDateRange, isWithinRange } from '@/lib/dateRange';
import { Badge } from '@/components/ui/badge';
import {
  ListTodo,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Bell,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { format } from 'date-fns';

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  designer: 'Designer',
  staff: 'Staff',
  treasurer: 'Treasurer',
  other: 'Member',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [storageTick, setStorageTick] = useState(0);
  const [showNotifications, setShowNotifications] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  if (!user) return null;

  const hydrateTask = (raw: typeof mockTasks[number]) => {
    if (!raw) return raw;
    return {
      ...raw,
      deadline: new Date(raw.deadline),
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      proposedDeadline: raw.proposedDeadline ? new Date(raw.proposedDeadline) : undefined,
      deadlineApprovedAt: raw.deadlineApprovedAt ? new Date(raw.deadlineApprovedAt) : undefined,
      files: raw.files?.map((file) => ({
        ...file,
        uploadedAt: new Date(file.uploadedAt),
      })),
      comments: raw.comments?.map((comment) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
      })),
      changeHistory: raw.changeHistory?.map((entry) => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
      })),
    };
  };

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('designhub.task.')) {
        setStorageTick((prev) => prev + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const hydratedTasks = useMemo(() => {
    if (typeof window === 'undefined') return mockTasks;
    return mockTasks.map((task) => {
      const key = `designhub.task.${task.id}`;
      const stored = localStorage.getItem(key);
      if (!stored) return task;
      try {
        const parsed = JSON.parse(stored);
        return hydrateTask(parsed);
      } catch {
        return task;
      }
    });
  }, [storageTick]);

  const activeRange = useMemo(
    () => getDateRange(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  );

  const dateFilteredTasks = useMemo(
    () => hydratedTasks.filter((task) => isWithinRange(task.createdAt, activeRange)),
    [activeRange, hydratedTasks]
  );

  const stats = calculateStats(dateFilteredTasks, user.id, user.role);

  // Filter tasks based on role
  const getRelevantTasks = () => {
    switch (user.role) {
      case 'staff':
        return dateFilteredTasks.filter((t) => t.requesterId === user.id);
      case 'treasurer':
        return dateFilteredTasks.filter((t) => t.isModification && t.approvalStatus === 'pending');
      default:
        return dateFilteredTasks;
    }
  };

  const relevantTasks = getRelevantTasks();
  const recentTasks = relevantTasks.slice(0, 4);

  const staffNotifications = useMemo(() => {
    if (user.role !== 'staff') return [];
    return hydratedTasks
      .flatMap((task) =>
        (task.changeHistory || [])
          .filter(
            (entry) =>
              entry.field === 'status' &&
              (entry.newValue === 'Completed' || entry.newValue === 'completed') &&
              entry.userRole === 'designer'
          )
          .map((entry) => ({ ...entry, taskTitle: task.title }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user.role]);

  const hasNotifications = staffNotifications.length > 0;

  const getWelcomeMessage = () => {
    switch (user.role) {
      case 'admin':
        return 'Manage all design requests and team workflow';
      case 'designer':
        return 'View and complete assigned design tasks';
      case 'staff':
        return 'Submit and track your design requests';
      case 'treasurer':
        return 'Review and approve modification requests';
      default:
        return 'Welcome to DesignHub';
    }
  };

  const summaryItems = [
    {
      label: 'Open requests',
      value: stats.pendingTasks + stats.inProgressTasks,
    },
    {
      label: 'Completed this cycle',
      value: stats.completedTasks,
    },
  ];

  if (user.role === 'treasurer' || user.role === 'admin') {
    summaryItems.push({
      label: 'Pending approvals',
      value: stats.pendingApprovals,
    });
  }

  if (stats.urgentTasks > 0) {
    summaryItems.push({
      label: 'Urgent tasks',
      value: stats.urgentTasks,
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Dashboard Overview
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user.role === 'staff' && (
              <div className="relative">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setNotificationsOpen((prev) => !prev)}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                {hasNotifications && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
                )}
                {notificationsOpen && hasNotifications && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-border/60 bg-card p-3 shadow-card z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Notifications
                      </span>
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {staffNotifications.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
                          <p className="text-sm font-semibold text-foreground">
                            Designer completed {entry.taskTitle}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(entry.createdAt), 'MMM d, yyyy • h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              startDate={customStart}
              endDate={customEnd}
              onStartDateChange={setCustomStart}
              onEndDateChange={setCustomEnd}
              showLabel={false}
            />
          </div>
        </div>

        {/* Hero + Notice */}
        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="relative overflow-hidden rounded-2xl border bg-card p-6 shadow-card">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)_/_0.12),_transparent_55%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-6">
              <div className="space-y-3">
                <span className="inline-flex w-fit items-center rounded-full border border-border/70 bg-secondary/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {roleLabels[user.role] || 'Member'}
                </span>
                <div>
                  <h1 className="text-3xl font-semibold text-foreground">
                    Welcome back, {user.name.split(' ')[0]}!
                  </h1>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground">{getWelcomeMessage()}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {user.role === 'staff' ? (
                  <Button asChild className="shadow-sm">
                    <Link to="/new-request">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      New Request
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" asChild className="shadow-sm">
                    <Link to={user.role === 'treasurer' ? '/approvals' : '/tasks'}>
                      View Tasks
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" asChild>
                  <Link to="/tasks">Dashboard Overview</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Important Notice
                </p>
                <h3 className="mt-2 text-base font-semibold text-foreground">Submission standards</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  All design requests must include complete data and reference files. Minimum deadline is 3 working days.
                  Modifications require Treasurer approval.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/40 px-4 py-3"
                >
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-lg font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Tasks"
            value={stats.totalTasks}
            icon={<ListTodo className="h-5 w-5" />}
            variant="default"
          />
          <StatsCard
            title="Pending"
            value={stats.pendingTasks}
            icon={<Clock className="h-5 w-5" />}
            variant="warning"
          />
          <StatsCard
            title="In Progress"
            value={stats.inProgressTasks}
            icon={<Loader2 className="h-5 w-5" />}
            variant="primary"
          />
          <StatsCard
            title="Completed"
            value={stats.completedTasks}
            icon={<CheckCircle2 className="h-5 w-5" />}
            variant="success"
          />
          {(user.role === 'treasurer' || user.role === 'admin') && (
            <StatsCard
              title="Pending Approvals"
              value={stats.pendingApprovals}
              icon={<FileCheck className="h-5 w-5" />}
              variant="urgent"
            />
          )}
          {stats.urgentTasks > 0 && (
            <StatsCard
              title="Urgent Tasks"
              value={stats.urgentTasks}
              icon={<AlertTriangle className="h-5 w-5" />}
              variant="urgent"
            />
          )}
        </div>

        {/* Recent Tasks */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Recent Activity
              </p>
              <h2 className="text-lg font-semibold text-foreground">
                {user.role === 'staff'
                  ? 'Your Recent Requests'
                  : user.role === 'treasurer'
                    ? 'Pending Approvals'
                    : 'Recent Tasks'}
              </h2>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={user.role === 'staff' ? '/my-requests' : user.role === 'treasurer' ? '/approvals' : '/tasks'}>
                View All
              </Link>
            </Button>
          </div>

          {user.role === 'staff' && staffNotifications.length > 0 && showNotifications && (
            <div className="mb-4 rounded-2xl border border-border/60 bg-card p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowNotifications(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {staffNotifications.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        Designer completed {entry.taskTitle}
                      </p>
                      <Badge className="text-[10px] uppercase tracking-[0.2em] bg-primary/10 text-primary border border-primary/20">
                        New
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.note || 'Status updated to completed'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(entry.createdAt), 'MMM d, yyyy • h:mm a')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentTasks.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {recentTasks.map((task, index) => (
                <div key={task.id} style={{ animationDelay: `${index * 50}ms` }}>
                  <TaskCard task={task} showRequester={user.role !== 'staff'} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-2xl border border-border shadow-card">
              <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium text-foreground">No tasks yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {user.role === 'staff'
                  ? "You haven't submitted any requests yet"
                  : 'No tasks to display'}
              </p>
              {user.role === 'staff' && (
                <Button asChild className="mt-4">
                  <Link to="/new-request">Create Your First Request</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
