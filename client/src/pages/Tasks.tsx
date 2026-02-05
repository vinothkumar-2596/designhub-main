import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { mockTasks } from '@/data/mockTasks';
import { ListTodo, Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskCategory, TaskStatus, TaskUrgency } from '@/types';
import { mergeLocalTasks } from '@/lib/taskStorage';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { buildSearchItemsFromTasks, matchesSearch } from '@/lib/search';
import { filterTasksForUser } from '@/lib/taskVisibility';
import { API_URL, authFetch } from '@/lib/api';

const statusLabels: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  clarification_required: 'Clarification',
  under_review: 'Under Review',
  completed: 'Completed',
};

const categoryLabels: Record<TaskCategory, string> = {
  banner: 'Banner',
  campaign_or_others: 'Campaign or others',
  social_media_creative: 'Social Media Creative',
  website_assets: 'Website Assets',
  ui_ux: 'UI/UX',
  led_backdrop: 'LED Backdrop',
  brochure: 'Brochure',
  flyer: 'Flyer',
};

const urgencyLabels: Record<TaskUrgency, string> = {
  low: 'Low',
  normal: 'Normal',
  intermediate: 'Intermediate',
  urgent: 'Urgent',
};

const urgencyOrder: Record<TaskUrgency, number> = {
  urgent: 4,
  intermediate: 3,
  normal: 2,
  low: 1,
};

const normalizeText = (value?: string | null) => (value ? value.trim().toLowerCase() : '');

const isRequestedByUser = (
  task: {
    requesterId?: string;
    requesterEmail?: string;
    requesterName?: string;
  },
  user?: { id?: string; email?: string; name?: string } | null
) => {
  if (!user) return false;
  if (task.requesterId && user.id && task.requesterId === user.id) return true;
  const requesterEmail = normalizeText(task.requesterEmail);
  const userEmail = normalizeText(user.email);
  if (requesterEmail && userEmail && requesterEmail === userEmail) return true;
  const requesterName = normalizeText(task.requesterName);
  const userName = normalizeText(user.name);
  return Boolean(requesterName && userName && requesterName === userName);
};

export default function Tasks() {
  const { user } = useAuth();
  const { query, setItems, setScopeLabel } = useGlobalSearch();
  const apiUrl = API_URL;
  const [tasks, setTasks] = useState(mockTasks);
  const [storageTick, setStorageTick] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [useLocalData, setUseLocalData] = useState(!apiUrl);
  const [designerSearch, setDesignerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<TaskUrgency | 'all'>('all');
  const [requestScope, setRequestScope] = useState<'all' | 'mine'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'deadline' | 'priority'>('newest');
  const [page, setPage] = useState(1);
  const isAdvancedFilterPortal = user?.role === 'designer' || user?.role === 'treasurer';

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

  const visibleTasks = useMemo(() => {
    if (!user) return [];
    if (user.role === 'designer') return hydratedTasks;
    return filterTasksForUser(hydratedTasks, user);
  }, [hydratedTasks, user]);

  useEffect(() => {
    setScopeLabel('Requests');
    setItems(buildSearchItemsFromTasks(visibleTasks));
  }, [visibleTasks, setItems, setScopeLabel]);

  const searchMatchedTasks = useMemo(
    () =>
      visibleTasks.filter((task) =>
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
    [visibleTasks, query]
  );

  const scopedTasks = useMemo(
    () =>
      requestScope === 'mine'
        ? searchMatchedTasks.filter((task) => isRequestedByUser(task, user))
        : searchMatchedTasks,
    [requestScope, searchMatchedTasks, user]
  );

  const myRequestsCount = useMemo(
    () => searchMatchedTasks.filter((task) => isRequestedByUser(task, user)).length,
    [searchMatchedTasks, user]
  );

  const statusCounts = useMemo(
    () =>
      scopedTasks.reduce(
        (acc, task) => {
          acc[task.status] += 1;
          return acc;
        },
        {
          pending: 0,
          in_progress: 0,
          clarification_required: 0,
          under_review: 0,
          completed: 0,
        } as Record<TaskStatus, number>
      ),
    [scopedTasks]
  );

  const filteredTasks = useMemo(() => {
    const base = scopedTasks;
    const queryText = designerSearch.trim().toLowerCase();
    const next = base.filter((task) => {
      if (!isAdvancedFilterPortal) return true;
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;
      if (urgencyFilter !== 'all' && task.urgency !== urgencyFilter) return false;
      if (queryText) {
        const haystack = [
          task.title,
          task.description,
          task.requesterName,
          task.requesterDepartment,
          task.assignedToName,
          task.id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(queryText);
      }
      return true;
    });

    if (!isAdvancedFilterPortal) return next;

    const sorted = [...next];
    if (sortBy === 'deadline') {
      sorted.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    } else if (sortBy === 'priority') {
      sorted.sort((a, b) => urgencyOrder[b.urgency] - urgencyOrder[a.urgency]);
    } else {
      sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return sorted;
  }, [
    categoryFilter,
    designerSearch,
    isAdvancedFilterPortal,
    scopedTasks,
    sortBy,
    statusFilter,
    urgencyFilter,
  ]);

  const pageSize = isAdvancedFilterPortal ? 12 : filteredTasks.length || 1;
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedTasks = useMemo(
    () =>
      filteredTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredTasks, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [designerSearch, statusFilter, categoryFilter, urgencyFilter, requestScope, sortBy, query, isAdvancedFilterPortal]);

  const hasPortalFilters =
    designerSearch.trim().length > 0 ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    urgencyFilter !== 'all' ||
    requestScope !== 'all';
  const visibleStart = filteredTasks.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const visibleEnd = Math.min(currentPage * pageSize, filteredTasks.length);
  const statusFilterOptions: Array<{ value: TaskStatus | 'all'; label: string; count: number }> = [
    { value: 'all', label: 'All', count: scopedTasks.length },
    { value: 'pending', label: 'Pending', count: statusCounts.pending },
    { value: 'in_progress', label: 'In Progress', count: statusCounts.in_progress },
    { value: 'under_review', label: 'Under Review', count: statusCounts.under_review },
    { value: 'clarification_required', label: 'Clarification', count: statusCounts.clarification_required },
    { value: 'completed', label: 'Completed', count: statusCounts.completed },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground premium-headline">All Tasks</h1>
          <p className="text-muted-foreground mt-1 premium-body">
            View and manage all design requests
          </p>
        </div>

        {isAdvancedFilterPortal && (
          <div className="rounded-2xl border border-[#D9E6FF] bg-white/80 p-4 shadow-card dark:border-[#1E3A75]/55 dark:bg-[#0B1738]/85 dark:shadow-none">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground dark:text-slate-100">
                <SlidersHorizontal className="h-4 w-4 text-primary/80 dark:text-indigo-200" />
                Task filters
              </div>
              <p className="text-xs text-muted-foreground dark:text-slate-300">
                Showing {visibleStart}-{visibleEnd} of {filteredTasks.length} tasks
              </p>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_180px_200px_180px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter within tasks..."
                  value={designerSearch}
                  onChange={(event) => setDesignerSearch(event.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="deadline">Deadline (soonest)</SelectItem>
                  <SelectItem value="priority">Priority (urgent first)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as TaskCategory | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {Object.entries(categoryLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={urgencyFilter} onValueChange={(value) => setUrgencyFilter(value as TaskUrgency | 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All urgency</SelectItem>
                  {Object.entries(urgencyLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRequestScope((prev) => (prev === 'mine' ? 'all' : 'mine'))}
                className="search-chip"
                data-active={requestScope === 'mine'}
              >
                <span>My Requests</span>
                <span className="search-chip-count">{myRequestsCount}</span>
              </button>
              {statusFilterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className="search-chip"
                  data-active={statusFilter === option.value}
                >
                  <span>{option.label}</span>
                  <span className="search-chip-count">{option.count}</span>
                </button>
              ))}
            </div>

            {hasPortalFilters && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDesignerSearch('');
                    setStatusFilter('all');
                    setCategoryFilter('all');
                    setUrgencyFilter('all');
                    setRequestScope('all');
                  }}
                >
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Task Grid */}
        {isLoading ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <p className="text-sm text-muted-foreground">Loading tasks...</p>
          </div>
        ) : filteredTasks.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pagedTasks.map((task, index) => (
                <div key={task.id} className="h-full" style={{ animationDelay: `${index * 50}ms` }}>
                  <TaskCard task={task} />
                </div>
              ))}
            </div>
            {isAdvancedFilterPortal && totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D9E6FF] bg-white/70 px-4 py-3 text-sm text-muted-foreground dark:border-[#1E3A75]/55 dark:bg-[#0B1738]/70 dark:text-slate-300">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground">No tasks found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filters or search terms
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
