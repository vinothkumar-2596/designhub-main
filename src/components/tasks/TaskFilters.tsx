import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TaskStatus, TaskCategory, TaskUrgency } from '@/types';

interface TaskFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: TaskStatus | 'all';
  onStatusChange: (value: TaskStatus | 'all') => void;
  categoryFilter: TaskCategory | 'all';
  onCategoryChange: (value: TaskCategory | 'all') => void;
  urgencyFilter: TaskUrgency | 'all';
  onUrgencyChange: (value: TaskUrgency | 'all') => void;
  onClearFilters: () => void;
}

export function TaskFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  categoryFilter,
  onCategoryChange,
  urgencyFilter,
  onUrgencyChange,
  onClearFilters,
}: TaskFiltersProps) {
  const hasActiveFilters =
    search || statusFilter !== 'all' || categoryFilter !== 'all' || urgencyFilter !== 'all';

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as TaskStatus | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="clarification_required">Clarification</SelectItem>
              <SelectItem value="under_review">Under Review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={(v) => onCategoryChange(v as TaskCategory | 'all')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="poster">Poster</SelectItem>
              <SelectItem value="social_media">Social Media</SelectItem>
              <SelectItem value="banner">Banner</SelectItem>
              <SelectItem value="brochure">Brochure</SelectItem>
              <SelectItem value="others">Others</SelectItem>
            </SelectContent>
          </Select>

          <Select value={urgencyFilter} onValueChange={(v) => onUrgencyChange(v as TaskUrgency | 'all')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-1">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {search && (
            <Badge variant="secondary" className="gap-1">
              Search: "{search}"
              <button onClick={() => onSearchChange('')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Status: {statusFilter.replace('_', ' ')}
              <button onClick={() => onStatusChange('all')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {categoryFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Category: {categoryFilter.replace('_', ' ')}
              <button onClick={() => onCategoryChange('all')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {urgencyFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Urgency: {urgencyFilter}
              <button onClick={() => onUrgencyChange('all')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
