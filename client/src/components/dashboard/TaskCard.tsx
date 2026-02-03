import { Task, TaskStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, UserCheck, Paperclip, MessageSquare, ArrowRight, CheckCircle2, AlertTriangle, Tag, Share2, MessageCircle, Mail, Copy } from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AnimatedCard } from '@/components/ui/animated-card';

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
  const taskUrl =
    typeof window !== 'undefined' && taskId
      ? `${window.location.origin}/task/${taskId}`
      : '';
  const taskShareText = `DesignDesk task: ${task.title}${taskId ? ` (ID: ${taskId})` : ''}`;
  const displayTaskId = taskId || 'N/A';
  const status = statusConfig[task.status];
  const chipBase =
    'inline-flex items-center gap-2 rounded-full border border-[#C9D7FF] bg-[#F5F8FF] dark:bg-muted dark:border-border px-3 py-1 text-xs font-medium text-[#2F3A56] dark:text-foreground min-w-0 max-w-full';
  const chipLabel = 'min-w-0 truncate';
  const chipCount =
    'ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-[#C9D7FF] bg-white dark:bg-card dark:border-border px-1 text-[11px] font-semibold text-[#2F3A56] dark:text-foreground shrink-0';
  const chipIcon = 'h-3.5 w-3.5 shrink-0';
  const renderChip = (Icon: typeof CheckCircle2, label: string, count = 0) => (
    <span className={chipBase} title={label}>
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

  const copyToClipboard = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      if (typeof document === 'undefined') return;
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const handleNativeShare = async () => {
    if (!taskUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: task.title,
          text: taskShareText,
          url: taskUrl
        });
        return;
      } catch {
        // Ignore user-cancelled share.
      }
    }
    await copyToClipboard(taskUrl);
  };

  const handleWhatsAppShare = () => {
    if (!taskUrl) return;
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(`${taskShareText} ${taskUrl}`)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEmailShare = () => {
    if (!taskUrl) return;
    const subject = encodeURIComponent(`DesignDesk Task: ${task.title}`);
    const body = encodeURIComponent(`${taskShareText}\n${taskUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <AnimatedCard
      containerClassName={cn(
        'h-full transition-all duration-300 dark:transition-none',
        isHighlighted && 'ring-1 ring-[#D9E6FF] dark:ring-border'
      )}
      className="p-6 h-full flex flex-col"
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
        <h3 className="text-lg font-bold text-slate-900 dark:text-foreground dark:transition-none group-hover:text-primary transition-colors tracking-tight line-clamp-2">
          {task.title}
        </h3>
        <p className="text-sm text-slate-500 dark:text-muted-foreground line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-muted-foreground">
          <span className="uppercase tracking-[0.2em] text-[10px] text-slate-400 dark:text-muted-foreground">Task ID</span>
          <span
            className="font-mono text-[12px] font-semibold text-slate-700 dark:text-foreground max-w-[180px] truncate"
            title={displayTaskId}
          >
            {displayTaskId}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleNativeShare}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE6FF] bg-white dark:bg-muted dark:border-border text-slate-400 dark:text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary hover:bg-primary/5 dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
            title="Share"
            aria-label="Share task"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE6FF] bg-white dark:bg-muted dark:border-border text-slate-400 dark:text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary hover:bg-primary/5 dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
            title="Share via WhatsApp"
            aria-label="Share via WhatsApp"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleEmailShare}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE6FF] bg-white dark:bg-muted dark:border-border text-slate-400 dark:text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary hover:bg-primary/5 dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
            title="Share via Email"
            aria-label="Share via Email"
          >
            <Mail className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => copyToClipboard(taskUrl)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#DCE6FF] bg-white dark:bg-muted dark:border-border text-slate-400 dark:text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary hover:bg-primary/5 dark:hover:bg-muted/80 dark:hover:text-foreground dark:transition-none"
            title="Copy link"
            aria-label="Copy task link"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-6 text-xs text-slate-500 dark:text-muted-foreground font-medium">
        {showRequester && (
          <div className="flex items-center gap-2 group/item">
            <div className="p-1 rounded-full bg-slate-50 dark:bg-slate-800/70 text-slate-400 dark:text-slate-400 group-hover/item:text-primary group-hover/item:bg-primary/5 transition-colors dark:transition-none">
              <User className="h-3.5 w-3.5" />
            </div>
            <span>{task.requesterName}</span>
          </div>
        )}
        {showAssignee && (
          <div className="flex items-center gap-2 group/item">
            <div className="p-1 rounded-full bg-slate-50 dark:bg-slate-800/70 text-slate-400 dark:text-slate-400 group-hover/item:text-primary group-hover/item:bg-primary/5 transition-colors dark:transition-none">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
            <span>
              {task.assignedToName ? task.assignedToName : <span className="text-slate-400 italic">Unassigned</span>}
            </span>
          </div>
        )}
        <div className={cn('flex items-center gap-2 group/item', isOverdue && 'text-red-500')}>
          <div className={cn("p-1 rounded-full bg-slate-50 dark:bg-slate-800/70 text-slate-400 dark:text-slate-400 group-hover/item:text-primary group-hover/item:bg-primary/5 transition-colors dark:transition-none", isOverdue && "bg-red-50 text-red-500 dark:bg-red-500/20 dark:text-red-300")}>
            <Calendar className="h-3.5 w-3.5" />
          </div>
          <span>{deadlineText}</span>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-50 dark:border-border">
        <div className="flex items-center gap-3">
          {task.files.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors dark:transition-none">
              <Paperclip className="h-3.5 w-3.5" />
              <span>{task.files.length}</span>
            </div>
          )}
          {task.comments.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors dark:transition-none">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>{task.comments.length}</span>
            </div>
          )}
          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-1" />
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-400">
            <Clock className="h-3.5 w-3.5" />
            <span>{format(task.createdAt, 'MMM d')}</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-8 gap-2 pl-3 pr-2 text-primary hover:text-primary hover:bg-primary/5 dark:text-slate-200 dark:hover:text-white dark:hover:bg-white/10 rounded-full font-semibold text-xs group/btn dark:transition-none"
        >
          <Link to={`/task/${taskId}`} state={{ task }}>
            View Details
            <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </AnimatedCard>
  );
}


