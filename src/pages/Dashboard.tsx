import { useEffect, useMemo, useRef, useState } from 'react';
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
  ArrowUpRight,
  XCircle,
  Eye,
  User,
  UserCheck,
  Calendar,
  Paperclip,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  designer: 'Designer',
  staff: 'Staff',
  treasurer: 'Treasurer',
  other: 'Member',
};

export default function Dashboard() {
  const { user } = useAuth();
  const apiUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:4000'
      : undefined);
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [storageTick, setStorageTick] = useState(0);
  const [showNotifications, setShowNotifications] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [tasks, setTasks] = useState(mockTasks);
  const [isLoading, setIsLoading] = useState(false);
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null);
  const [appreciationMessage, setAppreciationMessage] = useState('');
  const autoPreviewShownRef = useRef(false);
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewOpenDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNotificationsRef = useRef(false);

  if (!user) {
    return (
      <DashboardLayout>
        <div className="py-6" />
      </DashboardLayout>
    );
  }

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
    if (apiUrl) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('designhub.task.')) {
        setStorageTick((prev) => prev + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [apiUrl]);

  useEffect(() => {
    if (!apiUrl) return;
    const loadTasks = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${apiUrl}/api/tasks`);
        if (!response.ok) {
          throw new Error('Failed to load tasks');
        }
        const data = await response.json();
        const hydrated = data.map((task: any) => ({
          ...task,
          id: task.id || task._id,
          deadline: new Date(task.deadline),
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          proposedDeadline: task.proposedDeadline ? new Date(task.proposedDeadline) : undefined,
          deadlineApprovedAt: task.deadlineApprovedAt ? new Date(task.deadlineApprovedAt) : undefined,
          files: task.files?.map((file) => ({
            ...file,
            uploadedAt: new Date(file.uploadedAt),
          })),
          comments: task.comments?.map((comment) => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
          })),
          changeHistory: task.changeHistory?.map((entry) => ({
            ...entry,
            createdAt: new Date(entry.createdAt),
          })),
        }));
        setTasks(hydrated);
      } catch (error) {
        toast.error('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [apiUrl]);

  const hydratedTasks = useMemo(() => {
    if (apiUrl) return tasks;
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
  }, [apiUrl, storageTick, tasks]);

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
        return dateFilteredTasks.filter((t) => t.approvalStatus === 'pending');
      default:
        return dateFilteredTasks;
    }
  };

  const relevantTasks = getRelevantTasks();
  const recentTasks = relevantTasks.slice(0, 4);
  const treasurerRecentTasks = useMemo(() => {
    if (user.role !== 'treasurer') return [];
    return [...dateFilteredTasks]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 4);
  }, [dateFilteredTasks, user.role]);
  const pendingApprovals = useMemo(() => {
    return hydratedTasks.filter((task) => task.approvalStatus === 'pending');
  }, [hydratedTasks]);
  const assignedDesignTasks = useMemo(
    () => dateFilteredTasks.filter((task) => Boolean(task.assignedTo)),
    [dateFilteredTasks]
  );
  const assignedDesignPreview = assignedDesignTasks.slice(0, 4);
  const assignedDesignBreakdown = useMemo(() => {
    const completed = assignedDesignTasks.filter((task) => task.status === 'completed').length;
    const inProgress = assignedDesignTasks.filter((task) =>
      ['in_progress', 'under_review'].includes(task.status)
    ).length;
    const pending = assignedDesignTasks.filter((task) =>
      ['pending', 'clarification_required'].includes(task.status)
    ).length;
    return {
      total: assignedDesignTasks.length,
      completed,
      inProgress,
      pending,
    };
  }, [assignedDesignTasks]);

  const staffNotifications = useMemo(() => {
    if (user.role !== 'staff') return [];
    return hydratedTasks
      .filter((task) => task.requesterId === user.id)
      .flatMap((task) =>
        (task.changeHistory || [])
          .filter(
            (entry) => {
              const isDesignerCompletion =
                entry.userRole === 'designer' &&
                entry.field === 'status' &&
                (entry.newValue === 'Completed' || entry.newValue === 'completed');
              const isDesignerDeadlineApproval =
                entry.userRole === 'designer' &&
                entry.field === 'deadline_request' &&
                entry.newValue === 'Approved';
              const isTreasurerApproval =
                entry.userRole === 'treasurer' && entry.field === 'approval_status';
              return isDesignerCompletion || isDesignerDeadlineApproval || isTreasurerApproval;
            }
          )
          .map((entry) => ({ ...entry, taskId: task.id, taskTitle: task.title, task }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user.role]);

  const designerNotifications = useMemo(() => {
    if (user.role !== 'designer') return [];
    return hydratedTasks
      .flatMap((task) =>
        (task.changeHistory || [])
          .filter(
            (entry) => {
              const isStaffUpdate =
                entry.userRole === 'staff' &&
                ['description', 'files', 'deadline_request', 'status', 'staff_note'].includes(
                  entry.field
                );
              const isTreasurerApproval =
                entry.userRole === 'treasurer' && entry.field === 'approval_status';
              return isStaffUpdate || isTreasurerApproval;
            }
          )
          .map((entry) => ({ ...entry, taskId: task.id, taskTitle: task.title, task }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user.role]);

  const activeNotifications =
    user.role === 'staff'
      ? staffNotifications
      : user.role === 'designer'
        ? designerNotifications
        : [];

  const hasNotifications = activeNotifications.length > 0;

  useEffect(() => {
    hasNotificationsRef.current = hasNotifications;
  }, [hasNotifications]);

  useEffect(() => {
    if (user.role !== 'designer' || !hasNotifications || autoPreviewShownRef.current) {
      return;
    }
    autoPreviewShownRef.current = true;
    if (previewOpenDelayRef.current) {
      clearTimeout(previewOpenDelayRef.current);
    }
    previewOpenDelayRef.current = setTimeout(() => {
      if (!hasNotificationsRef.current) {
        previewOpenDelayRef.current = null;
        return;
      }
      setNotificationsOpen(true);
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
      previewTimeoutRef.current = setTimeout(() => {
        setNotificationsOpen(false);
        previewTimeoutRef.current = null;
      }, 30000);
      previewOpenDelayRef.current = null;
    }, 5000);
    return () => {
      if (previewOpenDelayRef.current) {
        clearTimeout(previewOpenDelayRef.current);
        previewOpenDelayRef.current = null;
      }
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    };
  }, [hasNotifications, user.role]);

  const closeNotificationsPreview = () => {
    if (previewOpenDelayRef.current) {
      clearTimeout(previewOpenDelayRef.current);
      previewOpenDelayRef.current = null;
    }
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    setNotificationsOpen(false);
  };

  const toggleNotifications = () => {
    setNotificationsOpen((prev) => {
      const next = !prev;
      if (previewOpenDelayRef.current) {
        clearTimeout(previewOpenDelayRef.current);
        previewOpenDelayRef.current = null;
      }
      if (!next && previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
      return next;
    });
  };

  const getNotificationTitle = (entry: any) => {
    if (user.role === 'staff') {
      if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
        const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
          ? 'rejected'
          : 'approved';
        return `Treasurer ${decision} ${entry.taskTitle}`;
      }
      return `Designer completed ${entry.taskTitle}`;
    }
    if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
      const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
        ? 'rejected'
        : 'approved';
      return `Treasurer ${decision} ${entry.taskTitle}`;
    }
    return `Staff updated ${entry.taskTitle}`;
  };

  const getNotificationNote = (entry: any) => {
    if (user.role === 'staff') {
      if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
        const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
          ? 'rejected'
          : 'approved';
        return entry.note || `Approval ${decision}`;
      }
      return entry.note || 'Status updated to completed';
    }
    if (entry.userRole === 'treasurer' && entry.field === 'approval_status') {
      const decision = `${entry.newValue || ''}`.toLowerCase().includes('reject')
        ? 'rejected'
        : 'approved';
      return entry.note || `Approval ${decision}`;
    }
    return entry.note || `${entry.userName} updated ${entry.field}`;
  };

  const getStaffUpdatePreview = (task: typeof hydratedTasks[number]) => {
    const history = [...(task.changeHistory || [])].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
    for (const entry of history) {
      if (entry.userRole !== 'staff') continue;
      if (entry.field === 'approval_status') continue;
      if (entry.field === 'staff_note' && entry.newValue) {
        return entry.newValue;
      }
      if (entry.field === 'description' && entry.newValue) {
        return entry.newValue;
      }
      if (entry.note) {
        return entry.note;
      }
      if (entry.newValue) {
        return entry.newValue;
      }
    }
    return '';
  };

  const updateApprovalStatus = async (
    taskId: string,
    decision: 'approved' | 'rejected'
  ) => {
    const currentTask = hydratedTasks.find((task) => task.id === taskId);
    const oldValue = currentTask?.approvalStatus ?? 'pending';
    const newValue = decision === 'approved' ? 'Approved' : 'Rejected';
    const approvalNote = `Approval ${decision} by ${user?.name || 'Treasurer'}`;
    if (apiUrl) {
      const response = await fetch(`${apiUrl}/api/tasks/${taskId}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            approvalStatus: decision,
            approvedBy: user?.name || '',
            approvalDate: new Date(),
          },
          changes: [
            {
              type: 'status',
              field: 'approval_status',
              oldValue,
              newValue,
              note: approvalNote,
            },
          ],
          userId: user?.id || '',
          userName: user?.name || '',
          userRole: user?.role || '',
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update approval');
      }
      const updated = await response.json();
      const hydrated = hydrateTask({
        ...updated,
        id: updated.id || updated._id,
      });
      setTasks((prev) =>
        prev.map((task) => (task.id === hydrated.id ? hydrated : task))
      );
      return;
    }

    if (!currentTask) return;
    const entry = {
      id: `ch-${Date.now()}-0`,
      type: 'status',
      field: 'approval_status',
      oldValue,
      newValue,
      note: approvalNote,
      userId: user?.id || '',
      userName: user?.name || 'Treasurer',
      userRole: user?.role || 'treasurer',
      createdAt: new Date(),
    };
    const updated = {
      ...currentTask,
      approvalStatus: decision,
      approvedBy: user?.name || '',
      approvalDate: new Date(),
      updatedAt: new Date(),
      changeHistory: [entry, ...(currentTask.changeHistory || [])],
    };
    localStorage.setItem(`designhub.task.${taskId}`, JSON.stringify(updated));
    setStorageTick((prev) => prev + 1);
  };

  const handleApprove = async (taskId: string) => {
    setProcessingApprovalId(taskId);
    try {
      await updateApprovalStatus(taskId, 'approved');
      toast.success('Request approved', {
        description: 'The requester has been notified.',
      });
    } catch (error) {
      toast.error('Failed to approve request');
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleReject = async (taskId: string) => {
    setProcessingApprovalId(taskId);
    try {
      await updateApprovalStatus(taskId, 'rejected');
      toast.success('Request rejected', {
        description: 'The requester has been notified.',
      });
    } catch (error) {
      toast.error('Failed to reject request');
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleSendAppreciation = async () => {
    const message = appreciationMessage.trim();
    if (!message) return;
    await new Promise((resolve) => setTimeout(resolve, 600));
    toast.success('Appreciation sent', {
      description: 'The design team has been notified.',
    });
    setAppreciationMessage('');
  };

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
        return 'Welcome to DesignDesk';
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
            {(user.role === 'staff' || user.role === 'designer') && (
              <div className="relative">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-9 w-9"
                  onClick={toggleNotifications}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                {hasNotifications && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
                )}
                {notificationsOpen && hasNotifications && (
                  <div className="absolute right-0 mt-2 w-72 rounded-xl border border-primary/15 bg-white/80 backdrop-blur-md p-3 shadow-card z-50 animate-dropdown origin-top-right">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
                        Notifications
                      </span>
                      <button
                        className="text-primary/60 hover:text-primary"
                        onClick={closeNotificationsPreview}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {activeNotifications.map((entry) => (
                        <Link
                          key={entry.id}
                          to={`/task/${entry.taskId}`}
                          state={{ task: entry.task, highlightChangeId: entry.id }}
                          onClick={closeNotificationsPreview}
                          className="block rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 transition hover:bg-primary/10"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {getNotificationTitle(entry)}
                            </p>
                            <ArrowUpRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getNotificationNote(entry)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                          </p>
                        </Link>
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
        <div className="grid gap-5 lg:grid-cols-[1.6fr,1fr]">
          <div className="relative overflow-hidden rounded-2xl border bg-card pt-5 pl-5 pr-4 pb-4 shadow-card">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)_/_0.12),_transparent_55%)]" />
            <div className="relative z-10 flex h-full flex-col justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex w-fit items-center rounded-full border border-border/70 bg-secondary/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {roleLabels[user.role] || 'Member'}
                </span>
                <div>
                  <h1 className="text-3xl font-semibold text-foreground">
                    Welcome back, {user.name.split(' ')[0]}!
                  </h1>
                  <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{getWelcomeMessage()}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {user.role === 'staff' || user.role === 'treasurer' ? (
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

          <div className="relative overflow-hidden rounded-2xl border border-[#D9E6FF] bg-white p-5 shadow-card">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#E9F1FF] blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FF] text-primary ring-1 ring-[#D9E6FF]">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Important Notice
                </p>
                <h3 className="text-base font-semibold text-foreground">Submission standards</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  All design requests must include complete data and reference files. Minimum deadline is 3 working days.
                  Modifications require Treasurer approval.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-[#D9E6FF] bg-[#F9FBFF] px-4 py-3"
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
          {user.role === 'treasurer' && (
            <StatsCard
              title="Assigned to Designers"
              value={assignedDesignTasks.length}
              icon={<UserCheck className="h-5 w-5" />}
              variant="primary"
            />
          )}
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
                    ? 'Recent Requests'
                    : 'Recent Tasks'}
              </h2>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to={user.role === 'staff' ? '/my-requests' : user.role === 'treasurer' ? '/tasks' : '/tasks'}>
                View All
              </Link>
            </Button>
          </div>

          {(user.role === 'staff' || user.role === 'designer') &&
            activeNotifications.length > 0 &&
            showNotifications && (
            <div className="mb-4 rounded-2xl border border-primary/10 bg-primary/5 p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowNotifications(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {activeNotifications.map((entry) => (
                  <Link
                    key={entry.id}
                    to={`/task/${entry.taskId}`}
                    state={{ task: entry.task, highlightChangeId: entry.id }}
                    className="block rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 transition hover:bg-primary/10"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {getNotificationTitle(entry)}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-[0.2em] bg-red-100 text-red-700 border border-red-200"
                      >
                        New
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getNotificationNote(entry)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(entry.createdAt), 'MMM d, yyyy h:mm a')}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border shadow-card">
              <p className="text-sm text-muted-foreground">Loading tasks...</p>
            </div>
          ) : user.role === 'treasurer' ? (
            <>
              {treasurerRecentTasks.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {treasurerRecentTasks.map((task, index) => (
                    <div key={task.id} style={{ animationDelay: `${index * 50}ms` }}>
                      <TaskCard task={task} showRequester showAssignee />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 bg-card rounded-2xl border border-border shadow-card">
                  <ListTodo className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-medium text-foreground">No recent requests yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    New requests will appear here once available
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Pending Approvals
                  </p>
                  <h3 className="text-lg font-semibold text-foreground">
                    {pendingApprovals.length} request{pendingApprovals.length === 1 ? '' : 's'} awaiting review
                  </h3>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/approvals">View All</Link>
                </Button>
              </div>

              {pendingApprovals.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pendingApprovals.slice(0, 4).map((task) => {
                    const staffPreview = getStaffUpdatePreview(task);
                    return (
                      <div key={task.id} className="bg-white border border-[#D9E6FF] rounded-2xl p-5 shadow-card">
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge
                                variant="pending"
                                className="border border-primary/20 bg-primary/10 text-primary"
                              >
                                Awaiting Approval
                              </Badge>
                              {task.urgency === 'urgent' && <Badge variant="urgent">Urgent</Badge>}
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">{task.title}</h3>
                            {staffPreview ? (
                              <div className="mb-4 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                                  Staff update
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                  {staffPreview}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <User className="h-4 w-4" />
                                <span>
                                  {task.requesterName}
                                  {task.requesterDepartment && (
                                    <span className="text-xs ml-1">({task.requesterDepartment})</span>
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-4 w-4" />
                                <span>Due {format(task.deadline, 'MMM d, yyyy')}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Paperclip className="h-4 w-4" />
                                <span>{task.files.length} files attached</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-row lg:flex-col gap-2 lg:w-36">
                            <Button
                              variant="default"
                              className="flex-1 gap-2"
                              onClick={() => handleApprove(task.id)}
                              disabled={processingApprovalId === task.id}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 gap-2 border-primary/30 text-primary hover:bg-primary/5"
                              onClick={() => handleReject(task.id)}
                              disabled={processingApprovalId === task.id}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                            <Button variant="ghost" size="sm" asChild className="gap-2 text-primary hover:bg-primary/5">
                              <Link to={`/task/${task.id}`} state={{ task }}>
                                <Eye className="h-4 w-4" />
                                Details
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  No pending approvals at the moment.
                </div>
              )}

              <div className="mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Assigned Projects
                    </p>
                    <h3 className="text-lg font-semibold text-foreground">
                      Assigned to Designers
                    </h3>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/tasks">View All</Link>
                  </Button>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground">{assignedDesignBreakdown.total}</span> assigned
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">{assignedDesignBreakdown.inProgress}</span> in progress
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">{assignedDesignBreakdown.completed}</span> completed
                  </span>
                  <span>
                    <span className="font-semibold text-foreground">{assignedDesignBreakdown.pending}</span> pending
                  </span>
                </div>

                {assignedDesignPreview.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {assignedDesignPreview.map((task, index) => (
                      <div key={task.id} style={{ animationDelay: `${index * 50}ms` }}>
                        <TaskCard task={task} showRequester showAssignee />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                    No assigned projects yet.
                  </div>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-[#D9E6FF] bg-white p-5 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF3FF] text-primary ring-1 ring-[#D9E6FF]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Appreciation
                    </p>
                    <h3 className="text-base font-semibold text-foreground">Share positive feedback</h3>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Send a quick note to recognize the design team's effort.
                </p>
                <div className="mt-4 space-y-3">
                  <Textarea
                    value={appreciationMessage}
                    onChange={(event) => setAppreciationMessage(event.target.value)}
                    placeholder="Write a short appreciation message..."
                    className="min-h-[90px] border-[#D9E6FF] bg-[#F9FBFF]"
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSendAppreciation} disabled={!appreciationMessage.trim()}>
                      Send Appreciation
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : recentTasks.length > 0 ? (
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
