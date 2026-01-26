import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
import { TaskStatus, TaskCategory, TaskUrgency } from '@/types';
import { ListTodo, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { mergeLocalTasks } from '@/lib/taskStorage';
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { buildSearchItemsFromTasks, matchesSearch } from '@/lib/search';

import { API_URL, authFetch } from '@/lib/api';

export default function MyRequests() {
  const { user } = useAuth();
  const { query, setQuery, setItems, setScopeLabel } = useGlobalSearch();
  const apiUrl = API_URL;
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<TaskUrgency | 'all'>('all');
  const [tasks, setTasks] = useState(mockTasks);
  const [isLoading, setIsLoading] = useState(false);
  const [storageTick, setStorageTick] = useState(0);
  const [useLocalData, setUseLocalData] = useState(!apiUrl);

  useEffect(() => {
    if (!apiUrl || (!user?.id && !user?.email)) return;
    const loadTasks = async () => {
      setIsLoading(true);
      try {
        const emailValue = user?.email ? encodeURIComponent(user.email) : '';
        const idValue = user?.id ? encodeURIComponent(user.id) : '';
        const params = new URLSearchParams();
        if (emailValue) params.set('requesterEmail', emailValue);
        if (idValue) params.set('requesterId', idValue);
        const response = await authFetch(`${apiUrl}/api/tasks?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to load requests');
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
        toast.error('Failed to load requests');
        setUseLocalData(true);
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [apiUrl, user?.id]);

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
    const handleTaskUpdated = (event: Event) => {
      const payload = (event as CustomEvent).detail;
      if (!payload) return;
      const id = payload.id || payload._id;
      if (!id) return;
      const hydrated = {
        ...payload,
        id,
        deadline: new Date(payload.deadline),
        createdAt: new Date(payload.createdAt),
        updatedAt: new Date(payload.updatedAt),
        proposedDeadline: payload.proposedDeadline ? new Date(payload.proposedDeadline) : undefined,
        deadlineApprovedAt: payload.deadlineApprovedAt ? new Date(payload.deadlineApprovedAt) : undefined,
        files: payload.files?.map((file: any) => ({
          ...file,
          uploadedAt: new Date(file.uploadedAt),
        })),
        comments: payload.comments?.map((comment: any) => ({
          ...comment,
          createdAt: new Date(comment.createdAt),
        })),
        changeHistory: payload.changeHistory?.map((entry: any) => ({
          ...entry,
          createdAt: new Date(entry.createdAt),
        })),
      };
      setTasks((prev) => {
        const index = prev.findIndex((task) => (task.id || (task as any)._id) === id);
        if (index === -1) return prev;
        const next = [...prev];
        next[index] = hydrated;
        return next;
      });
    };
    window.addEventListener('designhub:task:updated', handleTaskUpdated);
    return () => window.removeEventListener('designhub:task:updated', handleTaskUpdated);
  }, [apiUrl]);

  const hydratedTasks = useMemo(() => {
    if (!useLocalData) return tasks;
    if (typeof window === 'undefined') return mockTasks;
    return mergeLocalTasks(mockTasks);
  }, [useLocalData, storageTick, tasks]);

  // Filter to only show user's own requests
  const userTasks = useMemo(() => {
    return hydratedTasks.filter((task) => task.requesterId === user?.id);
  }, [hydratedTasks, user?.id]);

  useEffect(() => {
    setScopeLabel('My Requests');
    setItems(buildSearchItemsFromTasks(userTasks));
  }, [setItems, setScopeLabel, userTasks]);

  const filteredTasks = useMemo(() => {
    return userTasks.filter((task) => {
      // Search filter
      if (
        !matchesSearch(query, [
          task.title,
          task.description,
          task.category,
          task.status,
        ])
      ) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;

      // Urgency filter
      if (urgencyFilter !== 'all' && task.urgency !== urgencyFilter) return false;

      return true;
    });
  }, [userTasks, query, statusFilter, categoryFilter, urgencyFilter]);

  const clearFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setUrgencyFilter('all');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Requests</h1>
            <p className="text-muted-foreground mt-1">
              Track the status of your design requests
            </p>
          </div>
          <Button
            asChild
            size="default"
            className="border border-white/35 bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-white shadow-[0_20px_40px_-22px_hsl(var(--primary)/0.55)] backdrop-blur-xl ring-1 ring-white/20 hover:bg-primary/85 hover:shadow-[0_22px_44px_-22px_hsl(var(--primary)/0.6)] transition-all duration-200"
          >
            <Link to="/new-request">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Request
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <TaskFilters
          search={query}
          onSearchChange={setQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          urgencyFilter={urgencyFilter}
          onUrgencyChange={setUrgencyFilter}
          onClearFilters={clearFilters}
        />

        {/* Results Count */}
        <p className="text-sm text-muted-foreground">
          Showing {filteredTasks.length} of {userTasks.length} requests
        </p>

        {/* Task Grid */}
        {isLoading ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <p className="text-sm text-muted-foreground">Loading requests...</p>
          </div>
        ) : filteredTasks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredTasks.map((task, index) => (
              <div key={task.id} className="h-full" style={{ animationDelay: `${index * 50}ms` }}>
                <TaskCard task={task} showRequester={false} />
              </div>
            ))}
          </div>
        ) : userTasks.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground">No requests yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Submit your first design request to get started
            </p>
            <Button asChild size="default" className="border border-white/35 bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-white shadow-[0_20px_40px_-22px_hsl(var(--primary)/0.55)] backdrop-blur-xl ring-1 ring-white/20 hover:bg-primary/85 hover:shadow-[0_22px_44px_-22px_hsl(var(--primary)/0.6)] transition-all duration-200">
              <Link to="/new-request">Create Your First Request</Link>
            </Button>
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground">No matching requests</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try adjusting your filters or search terms
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
