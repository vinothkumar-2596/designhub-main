import { Task, TaskStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, Paperclip, MessageSquare, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface TaskCardProps {
  task: Task;
  showRequester?: boolean;
}

const statusConfig: Record<TaskStatus, { label: string; variant: 'pending' | 'progress' | 'review' | 'completed' | 'clarification' }> = {
  pending: { label: 'Pending', variant: 'pending' },
  in_progress: { label: 'In Progress', variant: 'progress' },
  clarification_required: { label: 'Clarification Required', variant: 'clarification' },
  under_review: { label: 'Under Review', variant: 'review' },
  completed: { label: 'Completed', variant: 'completed' },
};

const categoryLabels: Record<string, string> = {
  poster: 'Poster',
  social_media: 'Social Media',
  banner: 'Banner',
  brochure: 'Brochure',
  others: 'Others',
};

export function TaskCard({ task, showRequester = true }: TaskCardProps) {
  const status = statusConfig[task.status];
  const isOverdue = isPast(task.deadline) && task.status !== 'completed';
  const deadlineText = isPast(task.deadline)
    ? `${formatDistanceToNow(task.deadline)} overdue`
    : `Due ${formatDistanceToNow(task.deadline, { addSuffix: true })}`;

  return (
    <div className="group rounded-2xl border border-border/70 bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover animate-slide-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {task.urgency === 'urgent' && <Badge variant="urgent">Urgent</Badge>}
          {task.isModification && task.approvalStatus === 'pending' && (
            <Badge variant="pending">Awaiting Approval</Badge>
          )}
        </div>
        <Badge variant="secondary" className="text-xs font-semibold">
          {categoryLabels[task.category]}
        </Badge>
      </div>

      <div className="mt-3 space-y-2">
        <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
          {task.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {showRequester && (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span>{task.requesterName}</span>
          </div>
        )}
        <div className={cn('flex items-center gap-1.5', isOverdue && 'text-status-urgent font-medium')}>
          <Calendar className="h-3.5 w-3.5" />
          <span>{deadlineText}</span>
        </div>
        {task.files.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Paperclip className="h-3.5 w-3.5" />
            <span>{task.files.length} files</span>
          </div>
        )}
        {task.comments.length > 0 && (
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{task.comments.length}</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Created {format(task.createdAt, 'MMM d, yyyy')}</span>
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-1 text-primary hover:text-primary">
          <Link to={`/task/${task.id}`}>
            View Details
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
