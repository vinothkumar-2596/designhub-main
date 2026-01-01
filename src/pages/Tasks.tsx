import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { mockTasks, calculateStats } from '@/data/mockTasks';
import { TaskStatus, TaskCategory, TaskUrgency } from '@/types';
import { ListTodo, Clock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { DateRangeOption, getDateRange, isWithinRange } from '@/lib/dateRange';
import { toast } from 'sonner';

export default function Tasks() {
  const apiUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:4000'
      : undefined);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<TaskUrgency | 'all'>('all');
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [tasks, setTasks] = useState(mockTasks);
  const [isLoading, setIsLoading] = useState(false);

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
        toast.error('Failed to load tasks');
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [apiUrl]);

  const activeRange = useMemo(
    () => getDateRange(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  );

  const dateFilteredTasks = useMemo(
    () => tasks.filter((task) => isWithinRange(task.createdAt, activeRange)),
    [activeRange, tasks]
  );

  const filteredTasks = useMemo(() => {
    return dateFilteredTasks.filter((task) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          task.title.toLowerCase().includes(searchLower) ||
          task.description.toLowerCase().includes(searchLower) ||
          task.requesterName.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;

      // Urgency filter
      if (urgencyFilter !== 'all' && task.urgency !== urgencyFilter) return false;

      return true;
    });
  }, [search, statusFilter, categoryFilter, urgencyFilter, dateFilteredTasks]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setUrgencyFilter('all');
  };

  const stats = calculateStats(dateFilteredTasks);

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

        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          startDate={customStart}
          endDate={customEnd}
          onStartDateChange={setCustomStart}
          onEndDateChange={setCustomEnd}
        />

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
          <StatsCard
            title="Urgent Tasks"
            value={stats.urgentTasks}
            icon={<AlertTriangle className="h-5 w-5" />}
            variant="urgent"
          />
        </div>

        {/* Filters */}
        <TaskFilters
          search={search}
          onSearchChange={setSearch}
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
          Showing {filteredTasks.length} of {dateFilteredTasks.length} tasks
        </p>

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
      </div>
    </DashboardLayout>
  );
}
