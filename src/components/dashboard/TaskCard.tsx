import { Task, TaskStatus } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, UserCheck, Paperclip, MessageSquare, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface TaskCardProps {
  task: Task;
  showRequester?: boolean;
  showAssignee?: boolean;
}

const statusConfig: Record<TaskStatus, { label: string; variant: 'pending' | 'progress' | 'review' | 'completed' | 'clarification' }> = {
  pending: { label: 'Pending', variant: 'pending' },
  in_progress: { label: 'In Progress', variant: 'progress' },
  clarification_required: { label: 'Clarification Required', variant: 'clarification' },
  under_review: { label: 'Under Review', variant: 'review' },
  completed: { label: 'Completed', variant: 'completed' },
};

const categoryLabels: Record<string, string> = {
  banner: 'Banner',
  campaign_or_others: 'Campaign or others',
  social_media_creative: 'Social Media Creative',
  website_assets: 'Website Assets',
  ui_ux: 'UI/UX',
  led_backdrop: 'LED Backdrop',
  brochure: 'Brochure',
  flyer: 'Flyer',
};

export function TaskCard({ task, showRequester = true, showAssignee = false }: TaskCardProps) {
  const { user } = useAuth();
  const taskId = task.id || (task as unknown as { _id?: string })._id || '';
  const status = statusConfig[task.status];
  const isOverdue = isPast(task.deadline) && task.status !== 'completed';
  const deadlineText = isPast(task.deadline)
    ? `${formatDistanceToNow(task.deadline)} overdue`
    : `Due ${formatDistanceToNow(task.deadline, { addSuffix: true })}`;
  const assignedToId =
    (task as { assignedTo?: string; assignedToId?: string }).assignedTo ||
    (task as { assignedToId?: string }).assignedToId;
  const assignedToName = task.assignedToName || '';
  const normalizedAssignedName = assignedToName.trim().toLowerCase();
  const normalizedUserName = user?.name?.trim().toLowerCase() || '';
  const normalizedUserEmail = user?.email?.trim().toLowerCase() || '';
  const emailPrefix = normalizedUserEmail.split('@')[0];
  const nameMatches =
    normalizedAssignedName &&
    normalizedUserName &&
    (normalizedAssignedName === normalizedUserName ||
      normalizedAssignedName.includes(normalizedUserName) ||
      normalizedUserName.includes(normalizedAssignedName));
  const emailMatches =
    normalizedAssignedName && emailPrefix && normalizedAssignedName.includes(emailPrefix);
  const isAssignedToUser =
    Boolean(user) && (assignedToId === user?.id || nameMatches || emailMatches);
  const viewedKey =
    user && taskId ? `designhub.task.viewed.${user.id}.${taskId}` : '';
  const hasViewed =
    typeof window !== 'undefined' && viewedKey
      ? localStorage.getItem(viewedKey) === 'true'
      : true;
  const isHighlighted =
    user?.role === 'designer' && isAssignedToUser && !hasViewed;

  return (
    <div
      className={cn(
        'group rounded-2xl border p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover animate-slide-up',
        isHighlighted ? 'border-[#A9BFFF] bg-[#F3F7FF]' : 'border-[#D9E6FF] bg-white'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {task.urgency === 'urgent' && <Badge variant="urgent">Urgent</Badge>}
        {task.approvalStatus === 'pending' && (
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
        {showAssignee && (
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5" />
            <span>
              {task.assignedToName ? `Assigned to ${task.assignedToName}` : 'Unassigned'}
            </span>
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

      <div className="mt-4 flex items-center justify-between border-t border-[#D9E6FF] pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Created {format(task.createdAt, 'MMM d, yyyy h:mm a')}</span>
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-1 font-semibold text-primary hover:text-foreground">
          <Link to={`/task/${taskId}`} state={{ task }}>
            View Details
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
