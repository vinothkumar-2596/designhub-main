import { Task, TaskStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, UserCheck, Paperclip, MessageSquare, ArrowRight, CheckCircle2, AlertTriangle, Tag } from 'lucide-react';
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
  const chipBase =
    'inline-flex items-center gap-2 rounded-full border border-[#C9D7FF] bg-[#F5F8FF] px-3 py-1 text-xs font-medium text-[#2F3A56] min-w-0 max-w-full';
  const chipLabel = 'min-w-0 truncate';
  const chipCount =
    'ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[#C9D7FF] bg-white px-1 text-[11px] font-semibold text-[#2F3A56] shrink-0';
  const chipIcon = 'h-3.5 w-3.5 shrink-0';
  const renderChip = (Icon: typeof CheckCircle2, label: string, count = 0) => (
    <span className={chipBase}>
      <Icon className={chipIcon} />
      <span className={chipLabel}>{label}</span>
      <span className={chipCount}>{count}</span>
    </span>
  );
  const isOverdue = isPast(task.deadline) && task.status !== 'completed';
  const deadlineText = isPast(task.deadline)
    ? `${formatDistanceToNow(task.deadline)} overdue`
    : `Due ${formatDistanceToNow(task.deadline, { addSuffix: true })}`;
  const emergencyStatus = task.emergencyApprovalStatus;
  const emergencyLabel =
    emergencyStatus === 'approved'
      ? 'Emergency Approved'
      : emergencyStatus === 'rejected'
        ? 'Emergency Rejected'
        : 'Emergency Pending';
  const emergencyVariant =
    emergencyStatus === 'approved'
      ? 'completed'
      : emergencyStatus === 'rejected'
        ? 'destructive'
        : 'urgent';

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
      : false;
  const isHighlighted = Boolean(user) && !hasViewed;

  return (
    <div
      className={cn(
        'group relative rounded-3xl border p-6 bg-white transition-all duration-300 isolate',
        'hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5',
        isHighlighted
          ? 'border-[#C9D7FF] bg-[#F6F8FF]/95 ring-1 ring-[#D9E6FF]'
          : 'border-slate-100 hover:border-slate-200'
      )}
    >
        <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {renderChip(CheckCircle2, status.label)}
          {task.urgency === 'urgent' && (
            renderChip(AlertTriangle, 'Urgent')
          )}
          {task.approvalStatus === 'pending' && (
            renderChip(Clock, 'Awaiting Approval')
          )}
          {(task.isEmergency || emergencyStatus) && (
            renderChip(AlertTriangle, emergencyLabel)
          )}
        </div>
        <div className="max-w-[45%] min-w-0 flex justify-end">
          {renderChip(Tag, categoryLabels[task.category])}
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary transition-colors tracking-tight line-clamp-2">
          {task.title}
        </h3>
        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-6 text-xs text-slate-500 font-medium">
        {showRequester && (
          <div className="flex items-center gap-2 group/item">
            <div className="p-1 rounded-full bg-slate-50 text-slate-400 group-hover/item:text-primary group-hover/item:bg-primary/5 transition-colors">
              <User className="h-3.5 w-3.5" />
            </div>
            <span>{task.requesterName}</span>
          </div>
        )}
        {showAssignee && (
          <div className="flex items-center gap-2 group/item">
            <div className="p-1 rounded-full bg-slate-50 text-slate-400 group-hover/item:text-primary group-hover/item:bg-primary/5 transition-colors">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
            <span>
              {task.assignedToName ? task.assignedToName : <span className="text-slate-400 italic">Unassigned</span>}
            </span>
          </div>
        )}
        <div className={cn('flex items-center gap-2 group/item', isOverdue && 'text-red-500')}>
          <div className={cn("p-1 rounded-full bg-slate-50 text-slate-400 group-hover/item:text-primary group-hover/item:bg-primary/5 transition-colors", isOverdue && "bg-red-50 text-red-500")}>
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <span>{deadlineText}</span>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50">
        <div className="flex items-center gap-3">
          {task.files.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
              <Paperclip className="h-3.5 w-3.5" />
              <span>{task.files.length}</span>
            </div>
          )}
          {task.comments.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{task.comments.length}</span>
            </div>
          )}
          <div className="w-px h-3 bg-slate-200 mx-1" />
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span>{format(task.createdAt, 'MMM d')}</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-8 gap-2 pl-3 pr-2 text-primary hover:text-primary hover:bg-primary/5 rounded-full font-semibold text-xs group/btn"
        >
          <Link to={`/task/${taskId}`} state={{ task }}>
            View Details
            <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
