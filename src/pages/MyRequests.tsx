import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TaskCard } from '@/components/dashboard/TaskCard';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
import { TaskStatus, TaskCategory, TaskUrgency } from '@/types';
import { ListTodo, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function MyRequests() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<TaskUrgency | 'all'>('all');

  // Filter to only show user's own requests
  const userTasks = useMemo(() => {
    return mockTasks.filter((task) => task.requesterId === user?.id);
  }, [user?.id]);

  const filteredTasks = useMemo(() => {
    return userTasks.filter((task) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          task.title.toLowerCase().includes(searchLower) ||
          task.description.toLowerCase().includes(searchLower);
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
  }, [userTasks, search, statusFilter, categoryFilter, urgencyFilter]);

  const clearFilters = () => {
    setSearch('');
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
          <Button asChild>
            <Link to="/new-request">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Request
            </Link>
          </Button>
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
          Showing {filteredTasks.length} of {userTasks.length} requests
        </p>

        {/* Task Grid */}
        {filteredTasks.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredTasks.map((task, index) => (
              <div key={task.id} style={{ animationDelay: `${index * 50}ms` }}>
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
            <Button asChild>
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
