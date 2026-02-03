import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { ActivityFeed, type ActivityItem } from '@/components/dashboard/ActivityFeed';
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
  X,
  XCircle,
  Eye,
  User,
  UserCheck,
  Calendar,
  Paperclip,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { mergeLocalTasks } from '@/lib/taskStorage';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { buildSearchItemsFromTasks, matchesSearch } from '@/lib/search';
import { filterTasksForUser } from '@/lib/taskVisibility';
import { DotBackground } from '@/components/ui/background';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

import { API_URL, authFetch } from '@/lib/api';

const roleLabels: Record<string, string> = {
  designer: 'Designer',
  staff: 'Staff',
  treasurer: 'Treasurer',
  other: 'Member',
};

const EmptyState = () => (
  <div className="text-center py-10 bg-white rounded-[32px] border border-slate-100 shadow-sm h-full flex flex-col items-center justify-center dark:bg-card dark:border-border dark:shadow-card">
    <DotLottieReact
      src="https://lottie.host/0e85a89f-d869-4f1e-a9c0-6b12a6d53c58/H4LEyOPsA3.lottie"
      loop
      autoplay
      className="h-40 w-40 mb-3 dark:hidden"
    />
    <div className="hidden dark:flex items-center justify-center h-20 w-20 mb-3">
      <ListTodo className="h-12 w-12 text-slate-500" />
    </div>
    <h3 className="font-semibold text-slate-900 dark:text-slate-100">No recent activity</h3>
    <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto dark:text-slate-400">
      New requests and tasks will appear here once you get started.
    </p>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const { query, setItems, setScopeLabel } = useGlobalSearch();
  const apiUrl = API_URL;
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [storageTick, setStorageTick] = useState(0);
  const [showNotifications, setShowNotifications] = useState(true);
  const [tasks, setTasks] = useState(mockTasks);
  const [isLoading, setIsLoading] = useState(false);
  const [useLocalData, setUseLocalData] = useState(!apiUrl);
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null);

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
    if (!useLocalData) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('designhub.task.')) {
        setStorageTick((prev) => prev + 1);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [useLocalData]);

  useEffect(() => {
    if (!apiUrl) return;
    const loadTasks = async () => {
      setIsLoading(true);
      try {
        const response = await authFetch(`${apiUrl}/api/tasks`);
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
        setUseLocalData(false);
      } catch (error) {
        console.error('❌ Dashboard load error:', error);
        toast.error('Failed to load dashboard data');
        setUseLocalData(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [apiUrl]);

  useEffect(() => {
    if (!apiUrl) return;
    const handleNewRequest = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (!payload) return;
      const id = payload.id || payload._id;
      if (!id) return;
      setTasks((prev) => {
        if (prev.some((task) => (task.id || (task as any)._id) === id)) {
          return prev;
        }
        const hydrated = hydrateTask({ ...payload, id });
        return [hydrated, ...prev];
      });
    };
    const handleTaskUpdated = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (!payload) return;
      const id = payload.id || payload._id;
      if (!id) return;
      setTasks((prev) => {
        const index = prev.findIndex((task) => (task.id || (task as any)._id) === id);
        if (index === -1) return prev;
        const hydrated = hydrateTask({ ...payload, id });
        const next = [...prev];
        next[index] = hydrated;
        return next;
      });
    };
    window.addEventListener('designhub:request:new', handleNewRequest);
    window.addEventListener('designhub:task:updated', handleTaskUpdated);
    return () => {
      window.removeEventListener('designhub:request:new', handleNewRequest);
      window.removeEventListener('designhub:task:updated', handleTaskUpdated);
    };
  }, [apiUrl]);

  const hydratedTasks = useMemo(() => {
    if (!useLocalData) return tasks;
    if (typeof window === 'undefined') return mockTasks;
    return mergeLocalTasks(mockTasks);
  }, [useLocalData, storageTick, tasks]);

  const activeRange = useMemo(
    () => getDateRange(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  );

  const dateFilteredTasks = useMemo(
    () => hydratedTasks.filter((task) => isWithinRange(task.createdAt, activeRange)),
    [activeRange, hydratedTasks]
  );

  const stats = calculateStats(dateFilteredTasks, user.id, user.role);

  const visibleTasks = useMemo(
    () => filterTasksForUser(dateFilteredTasks, user),
    [dateFilteredTasks, user]
  );

  const relevantTasks = useMemo(() => {
    if (user.role === 'treasurer') {
      return visibleTasks.filter((t) => t.approvalStatus === 'pending');
    }
    return visibleTasks;
  }, [user.role, visibleTasks]);
  const searchFilteredTasks = useMemo(
    () =>
      relevantTasks.filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.assignedToName,
          task.category,
          task.status,
        ])
      ),
    [query, relevantTasks]
  );
  const recentTasks = searchFilteredTasks.slice(0, 4);
  const treasurerRecentTasks = useMemo(() => {
    if (user.role !== 'treasurer') return [];
    return [...dateFilteredTasks]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.category,
          task.status,
        ])
      )
      .slice(0, 4);
  }, [dateFilteredTasks, query, user.role]);
  const showViewAll = useMemo(() => {
    if (user.role === 'treasurer') {
      const total = [...dateFilteredTasks].filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.category,
          task.status,
        ])
      ).length;
      return total > 4;
    }
    return searchFilteredTasks.length > 4;
  }, [dateFilteredTasks, query, searchFilteredTasks.length, user.role]);
  const pendingApprovals = useMemo(() => {
    return hydratedTasks.filter((task) => task.approvalStatus === 'pending');
  }, [hydratedTasks]);
  const filteredApprovals = useMemo(
    () =>
      pendingApprovals.filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.category,
          task.status,
        ])
      ),
    [pendingApprovals, query]
  );
  const assignedDesignTasks = useMemo(
    () => dateFilteredTasks.filter((task) => Boolean(task.assignedTo)),
    [dateFilteredTasks]
  );

  useEffect(() => {
    setScopeLabel('Dashboard');
    setItems(buildSearchItemsFromTasks(relevantTasks));
  }, [relevantTasks, setItems, setScopeLabel]);

  const getLatestEntry = (entries: any[]) => {
    if (entries.length === 0) return null;
    return entries.reduce((latest, current) => {
      const latestTime = new Date(latest.createdAt ?? 0).getTime();
      const currentTime = new Date(current.createdAt ?? 0).getTime();
      return currentTime > latestTime ? current : latest;
    }, entries[0]);
  };

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
              const isEmergencyApproval =
                entry.userRole === 'designer' && entry.field === 'emergency_approval';
              return (
                isDesignerCompletion ||
                isDesignerDeadlineApproval ||
                isTreasurerApproval ||
                isEmergencyApproval
              );
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
      .flatMap((task) => {
        const history = task.changeHistory || [];
        const treasurerEntries = history.filter(
          (entry) => entry.userRole === 'treasurer' && entry.field === 'approval_status'
        );
        if (treasurerEntries.length > 0) {
          const latestTreasurer = getLatestEntry(treasurerEntries);
          return latestTreasurer
            ? [{ ...latestTreasurer, taskId: task.id, taskTitle: task.title, task }]
            : [];
        }
        const staffEntries = history.filter(
          (entry) =>
            entry.userRole === 'staff' &&
            [
              'description',
              'files',
              'deadline_request',
              'status',
              'staff_note',
              'created',
            ].includes(entry.field)
        );
        const latestStaff = getLatestEntry(staffEntries);
        return latestStaff
          ? [{ ...latestStaff, taskId: task.id, taskTitle: task.title, task }]
          : [];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user.role]);

  const treasurerNotifications = useMemo(() => {
    if (user.role !== 'treasurer') return [];
    return hydratedTasks
      .flatMap((task) => {
        const history = task.changeHistory || [];
        const createdEntries = history.filter(
          (entry) => entry.userRole === 'staff' && entry.field === 'created'
        );
        if (createdEntries.length === 0) {
          return [];
        }
        const latestCreated = getLatestEntry(createdEntries);
        return latestCreated
          ? [{ ...latestCreated, taskId: task.id, taskTitle: task.title, task }]
          : [];
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [hydratedTasks, user.role]);

  const activeNotifications =
    user.role === 'staff'
      ? staffNotifications
      : user.role === 'designer'
        ? designerNotifications
        : user.role === 'treasurer'
          ? treasurerNotifications
          : [];

  const getNotificationTitle = (entry: any) => {
    if (entry.field === 'created') {
      return `New request: ${entry.taskTitle}`;
    }
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
    if (entry.field === 'created') {
      return entry.note || `Submitted by ${entry.userName}`;
    }
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
      const response = await authFetch(`${apiUrl}/api/tasks/${taskId}/changes`, {
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

  const getWelcomeMessage = () => {
    switch (user.role) {
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

  if (user.role === 'treasurer') {
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
    <DashboardLayout
      background={
        <DotBackground className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[32px]">
          <div className="pointer-events-none absolute inset-0 bg-white dark:bg-transparent overflow-hidden rounded-[32px]">
            <div className="absolute left-1/2 top-[-22%] h-[680px] w-[780px] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(77,92,218,0.6),_rgba(120,190,255,0.4)_45%,_transparent_72%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(59,130,246,0.15),_rgba(37,99,235,0.1)_45%,_transparent_72%)] blur-[90px] opacity-90 dark:opacity-40" />
            <div className="absolute left-[10%] bottom-[-20%] h-[520px] w-[620px] rounded-[50%] bg-[radial-gradient(ellipse_at_center,_rgba(120,190,255,0.35),_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(139,92,246,0.12),_transparent_70%)] blur-[110px] opacity-70 dark:opacity-30" />
          </div>
        </DotBackground>
      }
    >
      <div className="space-y-8 relative z-10 pt-8">
        <div className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Dashboard Overview
              </p>
            </div>
            <div className="flex items-center gap-2">
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
        </div>

        {/* Hero + Notice */}
        <div className="grid gap-5 lg:grid-cols-[1.6fr,1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-[#D9E6FF] bg-white dark:bg-card dark:border-border p-5 min-h-[242px] lg:min-h-[264px]">
            <div className="relative z-10 flex h-full flex-col justify-between gap-4">
              <div className="space-y-2">
                <span className="inline-flex w-fit items-center rounded-full border border-border/70 bg-secondary/60 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {roleLabels[user.role] || 'Member'}
                </span>
                <div>
                  <h1 className="text-3xl font-semibold text-foreground">
                    Welcome back,{' '}
                    <span className="gradient-name bg-gradient-to-r from-sky-300 via-indigo-400 to-pink-300 dark:from-sky-200 dark:via-indigo-400 dark:to-pink-300 bg-clip-text text-transparent">
                      {user.name.split(' ')[0]}!
                    </span>
                  </h1>
                  <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{getWelcomeMessage()}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {user.role === 'staff' || user.role === 'treasurer' ? (
                  <Button
                    asChild
                    size="default"
                    className="border border-white/35 bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-white shadow-[0_20px_40px_-22px_hsl(var(--primary)/0.55)] backdrop-blur-xl ring-1 ring-white/20 hover:bg-primary/85 hover:shadow-[0_22px_44px_-22px_hsl(var(--primary)/0.6)] transition-all duration-200 dark:border-transparent dark:ring-0"
                  >
                    <Link to="/new-request">
                      <PlusCircle className="h-4 w-4 mr-2" />
                      New Request
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" asChild className="shadow-sm">
                    <Link to={(user.role as any) === 'treasurer' ? '/approvals' : '/tasks'}>
                      View Tasks
                    </Link>
                  </Button>
                )}
                <Button
                  asChild
                  className="border border-white/35 bg-white/85 text-foreground shadow-[0_8px_16px_-8px_rgba(0,0,0,0.1)] backdrop-blur-xl ring-1 ring-white/20 hover:bg-white/90 hover:shadow-[0_10px_20px_-8px_rgba(0,0,0,0.15)] transition-all duration-200 dark:border-white/10 dark:bg-slate-900/70 dark:text-white dark:ring-white/10 dark:hover:bg-slate-900/80"
                >
                  <Link to="/tasks">Dashboard Overview</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[#D9E6FF] bg-white dark:bg-card dark:border-border p-5 min-h-[242px] lg:min-h-[264px]">
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#E9F1FF] dark:bg-muted/60 blur-2xl" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EEF3FF] dark:bg-muted text-primary ring-1 ring-[#D9E6FF] dark:ring-border">
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
            <div className="mt-5 hidden" aria-hidden="true">
              {summaryItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl border border-[#D9E6FF] bg-[#F9FBFF] dark:bg-card/80 dark:border-border px-4 py-3 opacity-0 pointer-events-none select-none"
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
          {user.role === 'treasurer' && (
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



        {/* Activity Feed Section */}
        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1 h-full">
            <ActivityFeed
              notifications={activeNotifications.map(entry => {
                let type: 'attachment' | 'message' | 'system' = 'system';
                if (entry.field === 'files') type = 'attachment';
                else if (entry.field === 'comment' || entry.field === 'staff_note') type = 'message';

                return {
                  id: entry.id || Math.random().toString(),
                  title: getNotificationTitle(entry),
                  subtitle: getNotificationNote(entry),
                  time: format(new Date(entry.createdAt), 'h:mm a'),
                  type,
                  link: `/task/${entry.taskId}`
                };
              })}
            />
          </div>

          <div className="lg:col-span-2">
            {isLoading ? (
              <div className="text-center py-12 bg-card rounded-[32px] border border-border shadow-card h-full flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Loading tasks...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {user.role === 'staff' ? 'Your Requests' : 'Recent Tasks'}
                    </p>
                  </div>
                  {showViewAll && (
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="rounded-full hover:bg-slate-100"
                    >
                      <Link to={user.role === 'staff' ? '/my-requests' : '/tasks'}>
                        View All <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>

                {user.role === 'treasurer' ? (
                  treasurerRecentTasks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {treasurerRecentTasks.map((task, index) => (
                        <div key={task.id} style={{ animationDelay: `${index * 50}ms` }} className="h-full">
                          <TaskCard task={task} showRequester showAssignee />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState />
                  )
                ) : (
                  /* Reusing standard recent tasks logic if not treasurer (e.g. staff/designer/other) */
                  recentTasks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recentTasks.map((task, index) => (
                        <div key={task.id} style={{ animationDelay: `${index * 50}ms` }} className="h-full">
                          <TaskCard task={task} showRequester={user.role !== 'staff'} showAssignee={user.role !== 'designer'} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState />
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clean up old sections if needed, but for now just fitting into the layout. 
              The original structure had 'Recent Activity' title then 'Notifications' list then 'Loading/Grid'.
              I've replaced that block with a Grid: Left Col (ActivityFeed), Right Col (Task Grid).
          */}

      </div>
    </DashboardLayout >
  );
}


