import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Lottie from 'lottie-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ClipboardCheck,
  User,
  Download,
  ShieldCheck,
  Tag,
  MessageSquare,
  Send,
  FileText,
  Edit3,
  Upload,
  Loader2,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  History,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ApprovalStatus, DesignVersion, TaskChange, TaskComment, TaskStatus, UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { loadLocalTaskById } from '@/lib/taskStorage';
import { createSocket } from '@/lib/socket';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import {
  approveEmergencyTask as approveScheduleEmergency,
  loadScheduleTasks,
  pushScheduleNotification,
  saveScheduleTasks,
} from '@/lib/designerSchedule';

const statusConfig: Record<TaskStatus, { label: string; variant: 'pending' | 'progress' | 'review' | 'completed' | 'clarification' }> = {
  pending: { label: 'Pending', variant: 'pending' },
  in_progress: { label: 'In Progress', variant: 'progress' },
  clarification_required: { label: 'Clarification Required', variant: 'clarification' },
  under_review: { label: 'Under Review', variant: 'review' },
  completed: { label: 'Completed', variant: 'completed' },
};

const statusDetails: Record<TaskStatus, string> = {
  pending: 'Request submitted',
  in_progress: 'Design work in motion',
  clarification_required: 'Waiting on clarifications',
  under_review: 'Review in progress',
  completed: 'Delivery complete',
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

const changeFieldLabels: Record<string, string> = {
  staff_note: 'staff note',
  approval_status: 'approval status',
  deadline_request: 'deadline request',
  emergency_approval: 'emergency approval',
  design_version: 'design version',
};

const formatChangeField = (field: string) => changeFieldLabels[field] || field.replace(/_/g, ' ');
const roleLabels: Record<UserRole, string> = {
  staff: 'Staff',
  treasurer: 'Treasurer',
  designer: 'Designer',
};
const allRoles: UserRole[] = ['staff', 'treasurer', 'designer'];
const normalizeUserRole = (role?: string) =>
  allRoles.includes(role as UserRole) ? (role as UserRole) : 'staff';

type ChangeInput = Pick<TaskChange, 'type' | 'field' | 'oldValue' | 'newValue' | 'note'>;

const glassPanelClass =
  'bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl border border-[#C9D7FF] ring-1 ring-black/5 rounded-2xl shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]';
const fileRowClass =
  'flex items-center justify-between rounded-lg border border-transparent bg-gradient-to-r from-[#F7FAFF]/90 via-[#EEF4FF]/60 to-[#EAF2FF]/80 px-4 py-1.5 supports-[backdrop-filter]:bg-[#EEF4FF]/55 backdrop-blur-xl';
const fileActionButtonClass =
  'border border-transparent hover:border-[#C9D7FF] hover:bg-[#E6F1FF]/70 hover:text-primary hover:backdrop-blur-md hover:shadow-[0_10px_22px_-16px_rgba(15,23,42,0.35)]';
const badgeGlassClass =
  'rounded-full border border-[#C9D7FF] bg-gradient-to-r from-white/80 via-[#E6F1FF]/85 to-[#D6E5FF]/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1E2A5A] shadow-[0_16px_30px_-22px_rgba(30,58,138,0.38)] backdrop-blur-xl';

import { API_URL } from '@/lib/api';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as
    | { task?: typeof mockTasks[number]; highlightChangeId?: string }
    | null;
  const { user } = useAuth();
  const apiUrl = API_URL;
  const stateTask = locationState?.task;
  const highlightChangeId = locationState?.highlightChangeId;
  const localTask = id ? loadLocalTaskById(id) : undefined;
  const initialTask = stateTask || localTask || mockTasks.find((t) => t.id === id);
  const [taskState, setTaskState] = useState<typeof mockTasks[number] | undefined>(initialTask);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; role: UserRole }>>(
    {}
  );
  const [newStatus, setNewStatus] = useState<TaskStatus | ''>('');
  const [changeCount, setChangeCount] = useState(initialTask?.changeCount ?? 0);
  const initialApprovalStatus: ApprovalStatus | undefined =
    initialTask?.approvalStatus ?? ((initialTask?.changeCount ?? 0) >= 3 ? 'pending' : undefined);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus | undefined>(
    initialApprovalStatus
  );
  const [changeHistory, setChangeHistory] = useState<TaskChange[]>(initialTask?.changeHistory ?? []);
  const [editedDescription, setEditedDescription] = useState(initialTask?.description ?? '');
  const [staffNote, setStaffNote] = useState('');
  const [editedDeadline, setEditedDeadline] = useState(
    initialTask ? format(initialTask.deadline, 'yyyy-MM-dd') : ''
  );
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [deadlineRequest, setDeadlineRequest] = useState(
    initialTask?.proposedDeadline ? format(initialTask.proposedDeadline, 'yyyy-MM-dd') : ''
  );
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState<'input' | 'output'>('input');
  const [isUploadingFinal, setIsUploadingFinal] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [isEmergencyUpdating, setIsEmergencyUpdating] = useState(false);
  const [finalLinkName, setFinalLinkName] = useState('');
  const [finalLinkUrl, setFinalLinkUrl] = useState('');
  const [isAddingFinalLink, setIsAddingFinalLink] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [handoverAnimation, setHandoverAnimation] = useState<object | null>(null);
  const sizeFetchRef = useRef(new Set<string>());
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const clientIdRef = useRef<string>('');
  const [compareLeftId, setCompareLeftId] = useState('');
  const [compareRightId, setCompareRightId] = useState('');
  const storageKey = id ? `designhub.task.${id}` : '';
  const staffChangeCount = useMemo(() => {
    const latestFinalApprovalAt = changeHistory.reduce((latest, entry) => {
      if (entry.field !== 'approval_status') return latest;
      const status = String(entry.newValue ?? '').toLowerCase();
      if (status === 'pending') return latest;
      const time = new Date(entry.createdAt ?? 0).getTime();
      return time > latest ? time : latest;
    }, 0);
    return changeHistory.filter((entry) => {
      if (entry.userRole !== 'staff') return false;
      if (entry.field === 'approval_status') return false;
      if (entry.field === 'created') return false;
      const time = new Date(entry.createdAt ?? 0).getTime();
      return latestFinalApprovalAt ? time > latestFinalApprovalAt : true;
    }).length;
  }, [changeHistory]);
  const approvalLockedForStaff = user?.role === 'staff' && approvalStatus === 'pending';
  const staffChangeLabel = staffChangeCount === 1 ? '1 change updated' : `${staffChangeCount} changes updated`;
  const canSendForApproval =
    user?.role === 'staff' && staffChangeCount >= 3 && approvalStatus !== 'pending';
  const staffChangeLimitReached = user?.role === 'staff' && staffChangeCount >= 3;
  const designVersions = taskState?.designVersions ?? [];
  const activeDesignVersionId =
    taskState?.activeDesignVersionId || designVersions[designVersions.length - 1]?.id;
  const activeDesignVersion = designVersions.find((version) => version.id === activeDesignVersionId);
  const canManageVersions = user?.role === 'designer';
  const compareLeft = designVersions.find((version) => version.id === compareLeftId);
  const compareRight = designVersions.find((version) => version.id === compareRightId);
  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const taskKey = taskState?.id || id;
    if (!taskKey) return;
    localStorage.setItem(`designhub.task.viewed.${user.id}.${taskKey}`, 'true');
  }, [user, taskState?.id, id]);

  useEffect(() => {
    let isActive = true;
    const fetchAnimation = async (path: string) => {
      const response = await fetch(path);
      return response.ok ? response.json() : null;
    };
    fetchAnimation('/lottie/thank-you.json')
      .then((data) => {
        if (!isActive) return;
        if (data) setHandoverAnimation(data);
      })
      .catch(() => { });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!highlightChangeId || typeof document === 'undefined') return;
    const target = document.getElementById(`change-${highlightChangeId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightChangeId, changeHistory.length]);

  useEffect(() => {
    if (designVersions.length < 2) return;
    if (!compareLeftId && designVersions.length >= 2) {
      setCompareLeftId(designVersions[Math.max(0, designVersions.length - 2)].id);
    }
    if (!compareRightId) {
      setCompareRightId(designVersions[designVersions.length - 1].id);
    }
  }, [compareLeftId, compareRightId, designVersions]);

  const hydrateTask = (raw: typeof taskState) => {
    if (!raw) return raw;
    const toDate = (value?: string | Date) => (value ? new Date(value) : undefined);
    return {
      ...raw,
      deadline: new Date(raw.deadline),
      createdAt: new Date(raw.createdAt),
      updatedAt: new Date(raw.updatedAt),
      proposedDeadline: raw.proposedDeadline ? toDate(raw.proposedDeadline as unknown as string) : undefined,
      deadlineApprovedAt: raw.deadlineApprovedAt ? toDate(raw.deadlineApprovedAt as unknown as string) : undefined,
      emergencyApprovedAt: raw.emergencyApprovedAt ? toDate(raw.emergencyApprovedAt as unknown as string) : undefined,
      emergencyRequestedAt: raw.emergencyRequestedAt ? toDate(raw.emergencyRequestedAt as unknown as string) : undefined,
      files: raw.files?.map((file, index) => ({
        ...file,
        id: file.id ?? `file-${index}-${file.name || 'attachment'}`,
        uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
      })),
      comments: raw.comments?.map((comment, index) => ({
        ...comment,
        id:
          comment.id ||
          (comment as { _id?: string })._id ||
          `comment-${index}-${comment.userId || 'user'}`,
        parentId: comment.parentId || '',
        mentions: comment.mentions?.filter((role) => allRoles.includes(role as UserRole)) ?? [],
        userRole: normalizeUserRole(comment.userRole),
        receiverRoles:
          comment.receiverRoles?.filter((role) => allRoles.includes(role)) ?? [],
        seenBy: comment.seenBy?.map((entry) => ({
          ...entry,
          role: normalizeUserRole(entry.role),
          seenAt: new Date(entry.seenAt),
        })) ?? [],
        createdAt: new Date(comment.createdAt),
      })),
      designVersions: raw.designVersions?.map((version, index) => ({
        ...version,
        id:
          version.id ||
          (version as { _id?: string })._id ||
          `version-${index}-${version.name || 'design'}`,
        uploadedAt: new Date(version.uploadedAt),
      })) ?? [],
      changeHistory: raw.changeHistory?.map((entry) => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
      })),
    };
  };

  const normalizeIncomingComment = (comment: any): TaskComment => ({
    ...comment,
    id:
      comment?.id ||
      comment?._id ||
      `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    parentId: comment?.parentId || '',
    mentions: comment?.mentions?.filter((role: string) => allRoles.includes(role as UserRole)) ?? [],
    userRole: normalizeUserRole(comment?.userRole),
    receiverRoles:
      comment?.receiverRoles?.filter((role: string) => allRoles.includes(role as UserRole)) ?? [],
    seenBy:
      comment?.seenBy?.map((entry: any) => ({
        ...entry,
        role: normalizeUserRole(entry.role),
        seenAt: new Date(entry.seenAt),
      })) ?? [],
    createdAt: new Date(comment?.createdAt ?? Date.now()),
  });

  const emitTyping = (isTyping: boolean) => {
    const roomId = taskState?.id || (taskState as { _id?: string } | undefined)?._id || id;
    if (!socketRef.current || !roomId || !user) return;
    socketRef.current.emit('comment:typing', {
      taskId: roomId,
      clientId: clientIdRef.current,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      isTyping,
    });
  };

  const clearTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    emitTyping(false);
  };

  useEffect(() => {
    const roomId = taskState?.id || (taskState as { _id?: string } | undefined)?._id || id;
    if (!apiUrl || !roomId || !user) return;
    if (!clientIdRef.current && typeof window !== 'undefined') {
      const stored = window.sessionStorage.getItem('designhub.clientId');
      const nextId =
        stored || `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      clientIdRef.current = nextId;
      window.sessionStorage.setItem('designhub.clientId', nextId);
    }
    const socket = createSocket(apiUrl);
    socketRef.current = socket;
    socket.emit('task:join', { taskId: roomId, userId: user.id });

    socket.on('comment:typing', (payload: any) => {
      if (!payload || payload.taskId !== roomId) return;
      if (payload.clientId && payload.clientId === clientIdRef.current) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        const key = payload.clientId || payload.userId;
        if (payload.isTyping && key) {
          next[key] = {
            name: payload.userName || 'Someone',
            role: normalizeUserRole(payload.userRole),
          };
        } else {
          if (key) {
            delete next[key];
          }
        }
        return next;
      });
      const timeoutKey = payload.clientId || payload.userId;
      if (!timeoutKey) return;
      const existingTimeout = typingTimeoutsRef.current.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      if (payload.isTyping) {
        const timeout = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[timeoutKey];
            return next;
          });
          typingTimeoutsRef.current.delete(timeoutKey);
        }, 2000);
        typingTimeoutsRef.current.set(timeoutKey, timeout);
      } else {
        typingTimeoutsRef.current.delete(timeoutKey);
      }
    });

    socket.on('comment:new', (payload: any) => {
      if (!payload || payload.taskId !== roomId || !payload.comment) return;
      const incoming = normalizeIncomingComment(payload.comment);
      setTaskState((prev) => {
        if (!prev) return prev;
        if (prev.comments.some((comment) => comment.id === incoming.id)) {
          return prev;
        }
        return {
          ...prev,
          comments: [...prev.comments, incoming],
          updatedAt: new Date(),
        };
      });
    });

    socket.on('task:updated', (payload: any) => {
      if (!payload || payload.taskId !== roomId || !payload.task) return;
      const hydrated = hydrateTask(payload.task);
      setTaskState(hydrated);
      setChangeHistory(hydrated?.changeHistory ?? []);
      setChangeCount(hydrated?.changeCount ?? 0);
      setApprovalStatus(hydrated?.approvalStatus);
    });

    return () => {
      clearTyping();
      socket.emit('task:leave', { taskId: roomId, userId: user.id });
      socket.disconnect();
      socketRef.current = null;
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
      setTypingUsers({});
    };
  }, [apiUrl, taskState?.id, taskState?._id, id, user?.id]);

  const persistTask = (nextTask: typeof taskState, nextHistory?: TaskChange[]) => {
    if (!nextTask || !storageKey) return;
    const payload = {
      ...nextTask,
      changeHistory: nextHistory ?? nextTask.changeHistory,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  };

  useEffect(() => {
    if (!apiUrl || !taskState) return;
    const missingSizes = taskState.files.filter(
      (file) => !file.size && file.url && getDriveFileId(file.url)
    );
    if (missingSizes.length === 0) return;
    let isActive = true;

    const loadSizes = async () => {
      const updates = new Map<string, { size?: number; thumbnailUrl?: string }>();
      await Promise.all(
        missingSizes.map(async (file) => {
          const driveId = getDriveFileId(file.url);
          if (!driveId) return;
          if (sizeFetchRef.current.has(driveId)) return;
          sizeFetchRef.current.add(driveId);
          try {
            const response = await fetch(`${apiUrl}/api/files/metadata`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileId: driveId }),
            });
            if (!response.ok) return;
            const data = await response.json();
            const sizeValue =
              typeof data.size === 'string' ? Number(data.size) : data.size;
            const thumbnailLink = data.thumbnailLink;
            if (Number.isFinite(sizeValue)) {
              updates.set(file.url, { size: sizeValue });
            }
            if (thumbnailLink) {
              const existing = updates.get(file.url) || {};
              updates.set(file.url, { ...existing, thumbnailUrl: thumbnailLink });
            }
          } catch {
            // no-op
          }
        })
      );

      if (!isActive || updates.size === 0) return;
      const updatedFiles = taskState.files.map((file) => {
        const nextMeta = updates.get(file.url);
        if (!nextMeta) return file;
        return {
          ...file,
          ...(nextMeta.size ? { size: nextMeta.size } : null),
          ...(nextMeta.thumbnailUrl ? { thumbnailUrl: nextMeta.thumbnailUrl } : null),
        };
      });
      setTaskState((prev) => {
        if (!prev) return prev;
        const nextTask = { ...prev, files: updatedFiles };
        persistTask(nextTask);
        return nextTask;
      });
      fetch(`${apiUrl}/api/tasks/${taskState.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: updatedFiles }),
      }).catch(() => { });
    };

    loadSizes();
    return () => {
      isActive = false;
    };
  }, [apiUrl, taskState]);

  const getReceiverRoles = (senderRole?: UserRole) =>
    senderRole ? allRoles.filter((role) => role !== senderRole) : allRoles;

  const resolveCommentReceivers = (comment: (typeof taskState)['comments'][number]) => {
    if (comment.receiverRoles && comment.receiverRoles.length > 0) {
      return comment.receiverRoles;
    }
    if (comment.mentions && comment.mentions.length > 0) {
      return comment.mentions;
    }
    if (comment.userRole) {
      return allRoles.filter((role) => role !== comment.userRole);
    }
    return allRoles;
  };

  const hasUnseenForRole = (task: typeof taskState, role?: UserRole) => {
    if (!task || !role) return false;
    return task.comments?.some((comment) => {
      const receivers = resolveCommentReceivers(comment);
      if (!receivers.includes(role)) return false;
      const seenBy = comment.seenBy ?? [];
      return !seenBy.some((entry) => entry.role === role);
    });
  };

  const mentionRoleMap: Record<string, UserRole> = {
    staff: 'staff',
    treasurer: 'treasurer',
    designer: 'designer',
  };

  const mentionTargetsByRole: Record<UserRole, string[]> = {
    staff: ['Designer', 'Treasurer'],
    designer: ['Staff', 'Treasurer'],
    treasurer: ['Designer', 'Staff'],
  };

  const getMentionList = (role?: UserRole) => {
    if (!role) return ['Designer', 'Treasurer', 'Staff'];
    return mentionTargetsByRole[role] ?? ['Designer', 'Treasurer', 'Staff'];
  };

  const getMentionPlaceholder = (role?: UserRole, prefix = 'Message') =>
    `${prefix} @${getMentionList(role).join(', @')}...`;

  const formatMentionList = (role?: UserRole) => {
    const list = getMentionList(role);
    if (list.length === 0) return '';
    if (list.length === 1) return `@${list[0]}`;
    if (list.length === 2) return `@${list[0]} or @${list[1]}`;
    return list
      .map((item, index) => {
        if (index === list.length - 1) return `or @${item}`;
        return `@${item}`;
      })
      .join(', ');
  };

  const extractMentions = (content: string) => {
    const matches = content.match(/@(?:Designer|Treasurer|Staff)/gi) ?? [];
    const roles = matches
      .map((match) => mentionRoleMap[match.replace('@', '').toLowerCase()])
      .filter(Boolean) as UserRole[];
    return Array.from(new Set(roles));
  };

  const buildReceiverRoles = (content: string) => {
    const mentions = extractMentions(content);
    return mentions.length > 0 ? mentions : getReceiverRoles(user?.role);
  };

  const renderCommentContent = (content: string) => {
    const parts = content.split(/(@(?:Designer|Treasurer|Staff))/gi);
    return parts.map((part, index) => {
      const key = part.replace('@', '').toLowerCase();
      if (mentionRoleMap[key as keyof typeof mentionRoleMap]) {
        return (
          <span
            key={`${part}-${index}`}
            className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
          >
            {part}
          </span>
        );
      }
      return <span key={`${part}-${index}`}>{part}</span>;
    });
  };

  const { topLevelComments, repliesByParent } = useMemo(() => {
    if (!taskState) {
      return { topLevelComments: [], repliesByParent: new Map<string, TaskComment[]>() };
    }
    const sorted = [...(taskState.comments ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    const replyMap = new Map<string, TaskComment[]>();
    sorted.forEach((comment) => {
      if (!comment.parentId) return;
      const existing = replyMap.get(comment.parentId) ?? [];
      existing.push(comment);
      replyMap.set(comment.parentId, existing);
    });
    const roots = sorted.filter((comment) => !comment.parentId);
    return { topLevelComments: roots, repliesByParent: replyMap };
  }, [taskState]);

  if (!taskState) {
    return (
      <DashboardLayout>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">
            {isLoading ? 'Loading task...' : 'Task not found'}
          </h2>
          <Button asChild className="mt-4">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const addWorkingDays = (start: Date, days: number) => {
    const result = new Date(start);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      if (result.getDay() !== 0) {
        added += 1;
      }
    }
    return result;
  };
  const status = statusConfig[taskState.status];
  const isOverdue = isPast(taskState.deadline) && taskState.status !== 'completed';
  const isDesignerOrAdmin = user?.role === 'designer';
  const canEditTask = user?.role === 'staff';
  const canApproveDeadline = user?.role === 'designer';
  const minDeadlineDate = addWorkingDays(new Date(), 3);
  const emergencyStatus =
    taskState.isEmergency || taskState.emergencyApprovalStatus
      ? taskState.emergencyApprovalStatus ?? 'pending'
      : undefined;
  const emergencyVariant =
    emergencyStatus === 'approved'
      ? 'completed'
      : emergencyStatus === 'rejected'
        ? 'destructive'
        : 'urgent';
  const emergencyLabel =
    emergencyStatus === 'approved'
      ? 'Emergency Approved'
      : emergencyStatus === 'rejected'
        ? 'Emergency Rejected'
        : 'Emergency Pending';
  const inputFiles = taskState.files.filter((f) => f.type === 'input');
  const outputFiles = taskState.files.filter((f) => f.type === 'output');
  const canHandover =
    isDesignerOrAdmin &&
    taskState.status !== 'completed' &&
    outputFiles.length > 0 &&
    !isUploadingFinal;

  const getVersionLabel = (version: DesignVersion) => `V${version.version}`;
  const isImageVersion = (version?: DesignVersion) => {
    if (!version?.name) return false;
    const ext = version.name.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  };
  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  };
  const getFileExtension = (fileName: string) => {
    const segments = fileName.split('.');
    if (segments.length < 2) return 'LINK';
    const ext = segments.pop();
    return ext ? ext.toUpperCase() : 'FILE';
  };
  const formatFileSize = (bytes?: number | string) => {
    if (bytes === undefined) return '';
    const numeric = typeof bytes === 'string' ? Number(bytes) : bytes;
    if (!Number.isFinite(numeric)) return '';
    if (numeric < 1024) return `${numeric} B`;
    const units = ['KB', 'MB', 'GB'];
    let size = numeric / 1024;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  };
  const toTitleCaseFileName = (name: string) => {
    const lastDot = name.lastIndexOf('.');
    const base = lastDot > 0 ? name.slice(0, lastDot) : name;
    const ext = lastDot > 0 ? name.slice(lastDot + 1) : '';
    const titledBase = base.replace(/[A-Za-z][A-Za-z0-9']*/g, (word) =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );
    if (!ext) return titledBase;
    return `${titledBase}.${ext.toLowerCase()}`;
  };
  const getDriveFileId = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('drive.google.com')) {
        const idFromQuery = parsed.searchParams.get('id');
        if (idFromQuery) return idFromQuery;
        const pathMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/);
        if (pathMatch?.[1]) return pathMatch[1];
      }
      return null;
    } catch {
      return null;
    }
  };
  const getPreviewUrl = (file: (typeof taskState)['files'][number]) => {
    if (file.thumbnailUrl) return file.thumbnailUrl;
    if (!file.url) return '';
    if (isImageFile(file.name)) return file.url;
    const driveId = getDriveFileId(file.url);
    if (driveId) {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w200-h200`;
    }
    return '';
  };
  const getDownloadUrl = (file: (typeof taskState)['files'][number]) => {
    if (!file.url) return '';
    const driveId = getDriveFileId(file.url);
    if (driveId) {
      return `https://drive.google.com/uc?export=download&id=${driveId}`;
    }
    return file.url;
  };
  const renderFilePreview = (file: (typeof taskState)['files'][number]) => {
    const extLabel = getFileExtension(file.name);
    const previewUrl = getPreviewUrl(file);
    return (
      <div className="relative h-9 w-12 overflow-hidden rounded-[6px] border border-transparent bg-[radial-gradient(circle_at_top_left,_rgba(191,214,255,0.6),_transparent_55%),linear-gradient(160deg,_rgba(236,244,255,0.85),_rgba(198,220,255,0.45))] shadow-[0_12px_26px_-18px_rgba(15,23,42,0.4)] backdrop-blur-xl">
        {!previewUrl && (
          <div className="absolute inset-0 rounded-[6px] border border-transparent bg-gradient-to-br from-white/85 via-[#EEF4FF]/75 to-[#D5E5FF]/65 backdrop-blur-sm">
            <div className="absolute left-2 top-2 h-1 w-6 rounded-full bg-[#D6E2FA]/70" />
            <div className="absolute left-2 top-4 h-1 w-8 rounded-full bg-[#DDE8FB]/70" />
            <div className="absolute left-2 top-6 h-1 w-5 rounded-full bg-[#DDE8FB]/70" />
          </div>
        )}
        {previewUrl && (
          <img
            src={previewUrl}
            alt={toTitleCaseFileName(file.name)}
            className="relative z-10 h-full w-full object-cover"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
        <span className="absolute bottom-1 left-1 z-20 rounded-[4px] border border-white/70 bg-white/55 px-1.5 py-0.5 text-[9px] font-semibold text-[#2C4A83] shadow-[0_6px_14px_-10px_rgba(15,23,42,0.28)] backdrop-blur-md">
          {extLabel}
        </span>
        <span className="absolute bottom-0 right-0 z-20 h-0 w-0 border-b-[12px] border-b-[#D8E4FF] border-l-[12px] border-l-transparent" />
      </div>
    );
  };

  const recordChanges = async (changes: ChangeInput[], updates: Partial<typeof taskState> = {}) => {
    if (changes.length === 0) return;

    const isStaffUser = user?.role === 'staff';
    const now = new Date();
    const entries: TaskChange[] = changes.map((change, index) => ({
      id: `ch-${Date.now()}-${index}`,
      type: change.type,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      note: change.note,
      userId: user?.id || '',
      userName: user?.name || 'Unknown',
      userRole: user?.role || 'staff',
      createdAt: now,
    }));
    const updatesWithMeta = { ...updates, updatedAt: now };

    const nextCount = changeCount + entries.length;
    const overrideApproval = updates.approvalStatus as ApprovalStatus | undefined;
    const nextApproval = overrideApproval ?? (isStaffUser ? approvalStatus : nextCount >= 3 ? 'pending' : approvalStatus);

    const nextHistory = [...entries, ...changeHistory];
    setChangeCount(nextCount);
    setApprovalStatus(nextApproval);
    setChangeHistory(nextHistory);
    setTaskState((prev) => {
      if (!prev) return prev;
      const nextTask = {
        ...prev,
        ...updatesWithMeta,
        changeHistory: nextHistory,
        changeCount: nextCount,
        approvalStatus: nextApproval,
      };
      persistTask(nextTask, nextHistory);
      return nextTask;
    });

    const apiUrl = API_URL;
    if (apiUrl) {
      try {
        const response = await fetch(`${apiUrl}/api/tasks/${taskState.id}/changes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            updates: updatesWithMeta,
            changes: entries.map((entry) => ({
              type: entry.type,
              field: entry.field,
              oldValue: entry.oldValue,
              newValue: entry.newValue,
              note: entry.note,
            })),
            userId: user?.id || '',
            userName: user?.name || '',
            userRole: user?.role || '',
          }),
        });
        if (response.ok) {
          const updated = await response.json();
          const hydrated = hydrateTask(updated);
          setTaskState(hydrated);
          setChangeHistory(hydrated?.changeHistory ?? []);
          persistTask(hydrated);
        }
      } catch (error) {
        toast.error('Backend update failed. Local changes kept.');
      }
    }

    if (!overrideApproval && isStaffUser && nextCount >= 3 && approvalStatus !== 'pending') {
      toast.message('Treasurer approval required after 3+ changes.');
      return;
    }

    toast.success('Changes recorded.');
  };

  useEffect(() => {
    if (!apiUrl || !id) return;
    const loadTask = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${apiUrl}/api/tasks/${id}`);
        if (!response.ok) {
          throw new Error('Task not found');
        }
        const data = await response.json();
        const hydrated = hydrateTask({
          ...data,
          id: data.id || data._id,
        });
        setTaskState(hydrated);
        setChangeHistory(hydrated?.changeHistory ?? []);
        setChangeCount(hydrated?.changeCount ?? 0);
        setApprovalStatus(hydrated?.approvalStatus);
        setEditedDescription(hydrated?.description ?? '');
        setEditedDeadline(hydrated ? format(hydrated.deadline, 'yyyy-MM-dd') : '');
        setDeadlineRequest(
          hydrated?.proposedDeadline ? format(hydrated.proposedDeadline, 'yyyy-MM-dd') : ''
        );
      } catch (error) {
        if (!initialTask) {
          setTaskState(undefined);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadTask();
  }, [apiUrl, id]);

  useEffect(() => {
    if (apiUrl || !id) return;
    const local = loadLocalTaskById(id);
    if (!local) return;
    const hydrated = hydrateTask(local);
    setTaskState(hydrated);
    setChangeHistory(hydrated?.changeHistory ?? []);
    setChangeCount(hydrated?.changeCount ?? 0);
    setApprovalStatus(hydrated?.approvalStatus);
    setEditedDescription(hydrated?.description ?? '');
    setEditedDeadline(hydrated ? format(hydrated.deadline, 'yyyy-MM-dd') : '');
    setDeadlineRequest(
      hydrated?.proposedDeadline ? format(hydrated.proposedDeadline, 'yyyy-MM-dd') : ''
    );
  }, [apiUrl, id]);

  useEffect(() => {
    if (!user || !taskState || !user.role) return;
    if (!hasUnseenForRole(taskState, user.role)) return;
    const markSeen = async () => {
      if (apiUrl) {
        try {
          const response = await fetch(`${apiUrl}/api/tasks/${taskState.id}/comments/seen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: user.role }),
          });
          if (!response.ok) return;
          const updated = await response.json();
          const hydrated = hydrateTask(updated);
          setTaskState(hydrated);
        } catch {
          // no-op
        }
        return;
      }

      const nextTask = {
        ...taskState,
        comments: taskState.comments.map((comment) => {
          const receivers = resolveCommentReceivers(comment);
          if (!receivers.includes(user.role)) return comment;
          const seenBy = comment.seenBy ?? [];
          if (seenBy.some((entry) => entry.role === user.role)) return comment;
          return {
            ...comment,
            seenBy: [...seenBy, { role: user.role, seenAt: new Date() }],
          };
        }),
      };
      setTaskState(nextTask);
      persistTask(nextTask);
    };
    markSeen();
  }, [apiUrl, taskState, user]);

  const submitComment = async (
    content: string,
    parentId?: string,
    onSuccess?: () => void
  ) => {
    if (!content.trim() || !taskState) return;
    const trimmed = content.trim();
    const mentions = extractMentions(trimmed);
    const receiverRoles = buildReceiverRoles(trimmed);

    if (apiUrl) {
      try {
        const response = await fetch(`${apiUrl}/api/tasks/${taskState.id}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id || '',
            userName: user?.name || 'User',
            userRole: user?.role || 'staff',
            content: trimmed,
            receiverRoles,
            parentId,
            mentions,
          }),
        });
        if (!response.ok) {
          throw new Error('Failed to add comment');
        }
        const updated = await response.json();
        const hydrated = hydrateTask(updated);
        setTaskState(hydrated);
        onSuccess?.();
        clearTyping();
        toast.success('Comment added');
        return;
      } catch {
        toast.error('Failed to add comment');
        return;
      }
    }

    const nextComment = {
      id: `comment-${Date.now()}`,
      taskId: taskState.id,
      userId: user?.id || '',
      userName: user?.name || 'User',
      userRole: user?.role || 'staff',
      content: trimmed,
      parentId: parentId || '',
      mentions,
      createdAt: new Date(),
      receiverRoles,
      seenBy: [],
    };
    const nextTask = {
      ...taskState,
      comments: [...taskState.comments, nextComment],
      updatedAt: new Date(),
    };
    setTaskState(nextTask);
    persistTask(nextTask);
    onSuccess?.();
    clearTyping();
    toast.success('Comment added');
  };

  const handleAddComment = () => {
    submitComment(newComment, undefined, () => setNewComment(''));
  };

  const handleReplySubmit = (parentId: string) => {
    submitComment(replyText, parentId, () => {
      setReplyText('');
      setReplyToId(null);
    });
  };

  const handleStatusChange = (status: TaskStatus) => {
    const isCompletion = status === 'completed';
    recordChanges(
      [
        {
          type: 'status',
          field: 'status',
          oldValue: statusConfig[taskState.status].label,
          newValue: statusConfig[status].label,
          note: isCompletion ? `Completed by ${user?.name || 'Designer'}` : undefined,
        },
      ],
      { status }
    );
    setNewStatus('');
  };

  const handleHandoverTask = async () => {
    if (!taskState || taskState.status === 'completed') return;
    if (outputFiles.length === 0) {
      toast.message('Upload final files before handing over the task.');
      return;
    }
    await recordChanges(
      [
        {
          type: 'status',
          field: 'status',
          oldValue: statusConfig[taskState.status].label,
          newValue: statusConfig.completed.label,
          note: `Completed by ${user?.name || 'Designer'}`,
        },
      ],
      { status: 'completed' }
    );
    setShowHandoverModal(true);
  };

  const handleHandoverClose = () => {
    setShowHandoverModal(false);
  };

  const handleEmergencyDecision = async (decision: 'approved' | 'rejected') => {
    if (!taskState) return;
    if (!user) return;
    setIsEmergencyUpdating(true);
    const now = new Date();
    const prevStatus = emergencyStatus ?? 'pending';
    const entry: TaskChange = {
      id: `ch-${Date.now()}-0`,
      type: 'status',
      field: 'emergency_approval',
      oldValue: prevStatus,
      newValue: decision === 'approved' ? 'Approved' : 'Rejected',
      note: `Emergency ${decision} by ${user.name || 'Designer'}`,
      userId: user.id,
      userName: user.name || 'Designer',
      userRole: user.role || 'designer',
      createdAt: now,
    };
    const nextTask = {
      ...taskState,
      isEmergency: true,
      emergencyApprovalStatus: decision,
      emergencyApprovedBy: user.name || 'Designer',
      emergencyApprovedAt: now,
      updatedAt: now,
      changeHistory: [entry, ...(taskState.changeHistory || [])],
    };
    const apiUpdates = {
      isEmergency: true,
      emergencyApprovalStatus: decision,
      emergencyApprovedBy: user.name || 'Designer',
      emergencyApprovedAt: now,
      updatedAt: now,
    };

    try {
      if (apiUrl) {
        const response = await fetch(`${apiUrl}/api/tasks/${taskState.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apiUpdates),
        });
        if (!response.ok) {
          throw new Error('Failed to update emergency status');
        }
        const updated = await response.json();
        const hydrated = hydrateTask({
          ...updated,
          changeHistory: nextTask.changeHistory,
        });
        setTaskState(hydrated);
        setChangeHistory(hydrated?.changeHistory ?? []);
        persistTask(hydrated);
      } else {
        setTaskState(nextTask);
        setChangeHistory(nextTask.changeHistory);
        persistTask(nextTask);
      }

      if (taskState.scheduleTaskId) {
        const scheduleTasks = loadScheduleTasks();
        const updatedSchedule =
          decision === 'approved'
            ? approveScheduleEmergency(scheduleTasks, taskState.scheduleTaskId)
            : scheduleTasks.filter((task) => task.id !== taskState.scheduleTaskId);
        saveScheduleTasks(updatedSchedule);
      }

      if (taskState.requesterId) {
        pushScheduleNotification(
          taskState.requesterId,
          taskState.id,
          `Emergency request ${decision} for "${taskState.title}".`
        );
      }

      toast.success(
        decision === 'approved'
          ? 'Emergency request approved.'
          : 'Emergency request rejected.'
      );
    } catch (error) {
      toast.error('Failed to update emergency status.');
    } finally {
      setIsEmergencyUpdating(false);
    }
  };

  const handleRequestApproval = () => {
    if (approvalStatus === 'pending') return;
    if (user?.role !== 'staff' || staffChangeCount < 3) {
      toast.message('Send for approval after 3 staff changes.');
      return;
    }
    recordChanges(
      [
        {
          type: 'status',
          field: 'approval_status',
          oldValue: approvalStatus ?? 'pending',
          newValue: 'Pending',
          note: `Approval requested - ${user?.name || 'Staff'}`,
        },
      ],
      { approvalStatus: 'pending' }
    );
    toast.message('Approval request sent to treasurer.');
  };

  const handleApprovalDecision = (decision: ApprovalStatus) => {
    const oldValue = approvalStatus ?? 'pending';
    recordChanges(
      [
        {
          type: 'status',
          field: 'approval_status',
          oldValue,
          newValue: decision === 'approved' ? 'Approved' : 'Rejected',
          note: `Approval ${decision} by ${user?.name || 'Treasurer'}`,
        },
      ],
      {
        approvalStatus: decision,
        approvedBy: user?.name || '',
        approvalDate: new Date(),
      }
    );
    toast.success(decision === 'approved' ? 'Request approved.' : 'Request rejected.');
  };

  const handleSaveUpdates = () => {
    if (approvalLockedForStaff) {
      toast.message('Approval pending. Changes are locked.');
      return;
    }
    if (staffChangeLimitReached) {
      toast.message('Change limit reached. Send for approval.');
      return;
    }
    const updates: Partial<typeof taskState> = {};
    const changes: ChangeInput[] = [];
    const isStaffUpdate = user?.role === 'staff';
    const staffNoteValue = staffNote.trim();

    if (editedDescription.trim() && editedDescription !== taskState.description) {
      changes.push({
        type: 'update',
        field: 'description',
        oldValue: taskState.description,
        newValue: editedDescription,
        note: isStaffUpdate ? staffNoteValue || 'Staff requested changes' : undefined,
      });
      updates.description = editedDescription;
    }

    if (!editedDescription.trim() || editedDescription === taskState.description) {
      if (isStaffUpdate && staffNoteValue) {
        changes.push({
          type: 'update',
          field: 'staff_note',
          oldValue: '',
          newValue: staffNoteValue,
          note: staffNoteValue,
        });
      }
    }

    if (changes.length === 0) {
      toast.message('No updates to save.');
      return;
    }

    recordChanges(changes, updates);
    if (isStaffUpdate) {
      setStaffNote('');
    }
  };

  const handleAddFile = () => {
    if (approvalLockedForStaff) {
      toast.message('Approval pending. Changes are locked.');
      return;
    }
    if (staffChangeLimitReached) {
      toast.message('Change limit reached. Send for approval.');
      return;
    }
    if (!newFileName.trim()) return;
    const newFile = {
      id: `f-${Date.now()}`,
      name: newFileName.trim(),
      url: '#',
      type: newFileType,
      uploadedAt: new Date(),
      uploadedBy: user?.id || '',
    };

    const updates = {
      files: [...taskState.files, newFile],
    };

    recordChanges(
      [
        {
          type: 'file_added',
          field: 'files',
          oldValue: '',
          newValue: newFile.name,
        },
      ],
      updates
    );

    setNewFileName('');
  };

  const handleRemoveFile = (fileId: string, fileName: string) => {
    if (approvalLockedForStaff) {
      toast.message('Approval pending. Changes are locked.');
      return;
    }
    if (staffChangeLimitReached) {
      toast.message('Change limit reached. Send for approval.');
      return;
    }
    const updates = {
      files: taskState.files.filter((file) => file.id !== fileId),
    };

    recordChanges(
      [
        {
          type: 'file_removed',
          field: 'files',
          oldValue: fileName,
          newValue: '',
        },
      ],
      updates
    );
  };

  const handleFinalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    if (!apiUrl) {
      toast.error('File upload requires the backend.');
      return;
    }

    setIsUploadingFinal(true);
    const uploads = Array.from(selectedFiles);
    let updatedFiles = [...taskState.files];
    let updatedVersions = [...designVersions];
    let nextVersion = updatedVersions.length;
    try {
      for (const file of uploads) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('taskTitle', taskState.title);
        const response = await fetch(`${apiUrl}/api/files/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Upload failed');
        }
        const newFile = {
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          url: data.webViewLink || data.webContentLink || '',
          type: 'output' as const,
          size: file.size,
          thumbnailUrl: data.thumbnailLink,
          uploadedAt: new Date(),
          uploadedBy: user?.id || '',
        };
        const previousActive =
          updatedVersions.find((version) => version.id === activeDesignVersionId) ??
          updatedVersions[updatedVersions.length - 1];
        nextVersion += 1;
        const newVersion = {
          id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          url: data.webViewLink || data.webContentLink || '',
          version: nextVersion,
          uploadedAt: new Date(),
          uploadedBy: user?.id || '',
        };
        updatedFiles = [...updatedFiles, newFile];
        updatedVersions = [...updatedVersions, newVersion];
        recordChanges(
          [
            {
              type: 'file_added',
              field: 'files',
              oldValue: '',
              newValue: newFile.name,
              note: 'Final file uploaded',
            },
            {
              type: 'update',
              field: 'design_version',
              oldValue: previousActive ? `${getVersionLabel(previousActive)} - ${previousActive.name}` : '',
              newValue: `${getVersionLabel(newVersion)} - ${newVersion.name}`,
              note: 'Design version uploaded',
            },
          ],
          {
            files: updatedFiles,
            designVersions: updatedVersions,
            activeDesignVersionId: newVersion.id,
          }
        );
      }
      toast.success('Final files uploaded.');
    } catch (error: any) {
      const errorMsg = error.message || "Upload failed";
      if (errorMsg.includes("Drive OAuth not connected")) {
        toast.error('Google Drive Disconnected', {
          description: 'Please authorize App to access Drive.',
          action: {
            label: 'Connect',
            onClick: async () => {
              try {
                const res = await fetch(`${apiUrl}/api/drive/auth-url`);
                const data = await res.json();
                if (data.url) {
                  window.open(data.url, '_blank');
                }
              } catch (e) {
                console.error(e);
              }
            }
          },
          duration: 10000,
        });
      } else {
        toast.error('File upload failed');
      }
    } finally {
      setIsUploadingFinal(false);
      e.target.value = '';
    }
  };

  const handleAddFinalLink = async () => {
    if (!finalLinkUrl.trim()) {
      toast.message('Add a Google Drive link first.');
      return;
    }
    const trimmedUrl = finalLinkUrl.trim();
    let inferredName = finalLinkName.trim();
    if (!inferredName) {
      try {
        const parsed = new URL(trimmedUrl);
        const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
        inferredName = lastSegment ? decodeURIComponent(lastSegment) : 'Shared file';
      } catch {
        inferredName = 'Shared file';
      }
    }

    setIsAddingFinalLink(true);
    const now = new Date();
    const newFile = {
      id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: inferredName,
      url: trimmedUrl,
      type: 'output' as const,
      uploadedAt: now,
      uploadedBy: user?.id || '',
    };
    const previousActive =
      designVersions.find((version) => version.id === activeDesignVersionId) ??
      designVersions[designVersions.length - 1];
    const nextVersionNumber =
      (designVersions[designVersions.length - 1]?.version ?? designVersions.length) + 1;
    const newVersion = {
      id: `ver-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: inferredName,
      url: trimmedUrl,
      version: nextVersionNumber,
      uploadedAt: now,
      uploadedBy: user?.id || '',
    };

    await recordChanges(
      [
        {
          type: 'file_added',
          field: 'files',
          oldValue: '',
          newValue: newFile.name,
          note: 'Final file link added',
        },
        {
          type: 'update',
          field: 'design_version',
          oldValue: previousActive ? `${getVersionLabel(previousActive)} - ${previousActive.name}` : '',
          newValue: `${getVersionLabel(newVersion)} - ${newVersion.name}`,
          note: 'Design version link added',
        },
      ],
      {
        files: [...taskState.files, newFile],
        designVersions: [...designVersions, newVersion],
        activeDesignVersionId: newVersion.id,
        updatedAt: now,
      }
    );

    setFinalLinkName('');
    setFinalLinkUrl('');
    setIsAddingFinalLink(false);
  };

  const handleRollbackVersion = (versionId: string) => {
    if (!canManageVersions) return;
    const selected = designVersions.find((version) => version.id === versionId);
    if (!selected) return;
    const current = activeDesignVersion ?? designVersions[designVersions.length - 1];
    recordChanges(
      [
        {
          type: 'update',
          field: 'design_version',
          oldValue: current ? `${getVersionLabel(current)} - ${current.name}` : '',
          newValue: `${getVersionLabel(selected)} - ${selected.name}`,
          note: `Rolled back to ${getVersionLabel(selected)}`,
        },
      ],
      { activeDesignVersionId: selected.id }
    );
    toast.message('Design version restored.');
  };

  const handleEditAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    if (approvalLockedForStaff) {
      toast.message('Approval pending. Changes are locked.');
      e.target.value = '';
      return;
    }
    if (!apiUrl) {
      toast.error('File upload requires the backend.');
      e.target.value = '';
      return;
    }

    setIsUploadingAttachment(true);
    const uploads = Array.from(selectedFiles);
    try {
      for (const file of uploads) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('taskTitle', taskState.title);
        const response = await fetch(`${apiUrl}/api/files/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Upload failed');
        }
        const newFile = {
          id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          url: data.webViewLink || data.webContentLink || '',
          type: 'input' as const,
          size: file.size,
          thumbnailUrl: data.thumbnailLink,
          uploadedAt: new Date(),
          uploadedBy: user?.id || '',
        };
        recordChanges(
          [
            {
              type: 'file_added',
              field: 'files',
              oldValue: '',
              newValue: newFile.name,
              note: 'Attachment uploaded',
            },
          ],
          { files: [...taskState.files, newFile] }
        );
      }
      toast.success('Attachments uploaded.');
    } catch (error: any) {
      const errorMsg = error.message || "Upload failed";
      if (errorMsg.includes("Drive OAuth not connected")) {
        toast.error('Google Drive Disconnected', {
          description: 'Please authorize App to access Drive.',
          action: {
            label: 'Connect',
            onClick: async () => {
              try {
                const res = await fetch(`${apiUrl}/api/drive/auth-url`);
                const data = await res.json();
                if (data.url) {
                  window.open(data.url, '_blank');
                }
              } catch (e) {
                console.error(e);
              }
            }
          },
          duration: 10000,
        });
      } else {
        toast.error('File upload failed');
      }
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleRequestDeadline = () => {
    if (approvalLockedForStaff) {
      toast.message('Approval pending. Changes are locked.');
      return;
    }
    if (staffChangeLimitReached) {
      toast.message('Change limit reached. Send for approval.');
      return;
    }
    if (!deadlineRequest) return;
    const minDate = minDeadlineDate;
    const requested = new Date(deadlineRequest);
    if (requested < minDate) {
      toast.error('Deadline must be at least 3 days from today.');
      return;
    }

    recordChanges(
      [
        {
          type: 'update',
          field: 'deadline_request',
          oldValue: taskState.proposedDeadline
            ? format(taskState.proposedDeadline, 'MMM d, yyyy')
            : '',
          newValue: format(requested, 'MMM d, yyyy'),
        },
      ],
      {
        proposedDeadline: requested,
        deadlineApprovalStatus: 'pending',
      }
    );
    toast.message('Deadline request sent to designer.');
  };

  const handleApproveDeadline = (decision: 'approved' | 'rejected') => {
    if (!taskState.proposedDeadline) return;
    if (decision === 'approved') {
      recordChanges(
        [
          {
            type: 'update',
            field: 'deadline',
            oldValue: format(taskState.deadline, 'MMM d, yyyy'),
            newValue: format(taskState.proposedDeadline, 'MMM d, yyyy'),
            note: `Approved by ${user?.name || 'Designer'}`,
          },
          {
            type: 'update',
            field: 'deadline_request',
            oldValue: '',
            newValue: 'Approved',
          },
        ],
        {
          deadline: taskState.proposedDeadline,
          proposedDeadline: undefined,
          deadlineApprovalStatus: 'approved',
          deadlineApprovedBy: user?.name || '',
          deadlineApprovedAt: new Date(),
        }
      );
      toast.success('Deadline approved.');
    } else {
      recordChanges(
        [
          {
            type: 'update',
            field: 'deadline_request',
            oldValue: taskState.proposedDeadline
              ? format(taskState.proposedDeadline, 'MMM d, yyyy')
              : '',
            newValue: 'Rejected',
            note: `Rejected by ${user?.name || 'Designer'}`,
          },
        ],
        {
          proposedDeadline: undefined,
          deadlineApprovalStatus: 'rejected',
          deadlineApprovedBy: user?.name || '',
          deadlineApprovedAt: new Date(),
        }
      );
      toast.message('Deadline request rejected.');
    }
  };

  const renderCommentThread = (comment: TaskComment, depth = 0) => {
    const replies = repliesByParent.get(comment.id) ?? [];
    const isReply = depth > 0;
    return (
      <div key={comment.id} className={cn('flex gap-3', isReply && 'pl-6 border-l border-border/60')}>
        <div
          className={cn(
            'rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium flex-shrink-0',
            isReply ? 'h-7 w-7 text-xs' : 'h-8 w-8 text-sm'
          )}
        >
          {comment.userName.charAt(0)}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm">{comment.userName}</span>
            {comment.userRole && (
              <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {roleLabels[comment.userRole] ?? comment.userRole}
              </span>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-1">
            {renderCommentContent(comment.content)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
            <span>{format(comment.createdAt, 'MMM d, yyyy - h:mm a')}</span>
            <button
              type="button"
              className="text-primary/80 hover:text-primary font-medium"
              onClick={() => {
                setReplyToId(comment.id);
                setReplyText('');
              }}
            >
              Reply
            </button>
            {comment.userId === user?.id && (
              <span>
                {(() => {
                  const receivers = resolveCommentReceivers(comment);
                  const seenBy = comment.seenBy ?? [];
                  const seenRoles = receivers.filter((role) =>
                    seenBy.some((entry) => entry.role === role)
                  );
                  const pendingRoles = receivers.filter(
                    (role) => !seenRoles.includes(role)
                  );
                  if (receivers.length === 0) {
                    return null;
                  }
                  if (seenRoles.length === 0) {
                    return 'Sent';
                  }
                  if (pendingRoles.length === 0) {
                    return `Seen by ${seenRoles
                      .map((role) => roleLabels[role] ?? role)
                      .join(', ')}`;
                  }
                  return `Seen by ${seenRoles
                    .map((role) => roleLabels[role] ?? role)
                    .join(', ')} - Pending ${pendingRoles
                      .map((role) => roleLabels[role] ?? role)
                      .join(', ')}`;
                })()}
              </span>
            )}
          </div>
          {replyToId === comment.id && (
            <div className="mt-3 flex gap-2">
              <Textarea
                placeholder={getMentionPlaceholder(user?.role, 'Reply with')}
                value={replyText}
                onChange={(e) => {
                  const value = e.target.value;
                  setReplyText(value);
                  if (!apiUrl) return;
                  emitTyping(true);
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }
                  typingTimeoutRef.current = setTimeout(() => {
                    emitTyping(false);
                  }, 1200);
                }}
                rows={2}
                className="flex-1 select-text"
              />
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => handleReplySubmit(comment.id)}
                  disabled={!replyText.trim()}
                  size="sm"
                >
                  Send
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplyToId(null);
                    setReplyText('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
          {replies.length > 0 && (
            <div className="mt-4 space-y-4">
              {replies.map((reply) => renderCommentThread(reply, depth + 1))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl select-none">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-2 animate-fade-in"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        {/* Header */}
        <div className="animate-slide-up">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant={status.variant} className={badgeGlassClass}>
              <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                <ClipboardCheck className="h-3 w-3" />
              </span>
              {status.label}
            </Badge>
            {taskState.urgency === 'urgent' && (
              <Badge variant="urgent" className={badgeGlassClass}>
                <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                  <AlertTriangle className="h-3 w-3" />
                </span>
                Urgent
              </Badge>
            )}
            <Badge variant="secondary" className={badgeGlassClass}>
              <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                <Edit3 className="h-3 w-3" />
              </span>
              Changes: {changeCount}
            </Badge>
            {approvalStatus && (
              <Badge
                variant={
                  approvalStatus === 'approved'
                    ? 'completed'
                    : approvalStatus === 'rejected'
                      ? 'urgent'
                      : 'pending'
                }
                className={badgeGlassClass}
              >
                <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                  <ShieldCheck className="h-3 w-3" />
                </span>
                {approvalStatus === 'approved'
                  ? 'Approved'
                  : approvalStatus === 'rejected'
                    ? 'Rejected'
                    : 'Awaiting Approval'}
              </Badge>
            )}
            <span className={badgeGlassClass}>
              <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center text-primary">
                <Tag className="h-3 w-3" />
              </span>
              {categoryLabels[taskState.category]}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{taskState.title}</h1>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-3">Description</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {taskState.description}
              </p>
            </div>

            {canEditTask && (
              <div className={`${glassPanelClass} p-6 animate-slide-up`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground">Edit Task</h2>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsEditingTask((prev) => !prev)}
                    disabled={approvalLockedForStaff}
                  >
                    {isEditingTask ? 'Close' : 'Edit'}
                  </Button>
                </div>
                {isEditingTask ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Description
                      </p>
                      <Textarea
                        value={editedDescription}
                        onChange={(event) => setEditedDescription(event.target.value)}
                        rows={4}
                        className="mt-2 select-text"
                        disabled={approvalLockedForStaff}
                      />
                    </div>
                    {user?.role === 'staff' && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Staff message to designer
                        </p>
                        <Textarea
                          value={staffNote}
                          onChange={(event) => setStaffNote(event.target.value)}
                          rows={3}
                          className="mt-2 select-text"
                          placeholder="Describe the change request for the designer and treasurer review."
                          disabled={approvalLockedForStaff}
                        />
                      </div>
                    )}
                    {user?.role !== 'staff' && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Deadline
                        </p>
                        <Input
                          type="date"
                          value={editedDeadline}
                          onChange={(event) => setEditedDeadline(event.target.value)}
                          className="mt-2 max-w-xs select-text"
                        />
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Attachments (optional)
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <input
                          type="file"
                          multiple
                          onChange={handleEditAttachmentUpload}
                          className="hidden"
                          id="edit-attachment-upload"
                          disabled={approvalLockedForStaff || isUploadingAttachment}
                        />
                        <label
                          htmlFor="edit-attachment-upload"
                          className="inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground"
                        >
                          {isUploadingAttachment ? 'Uploading...' : 'Select files'}
                        </label>
                        <span className="text-xs text-muted-foreground">
                          Add reference files if needed.
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {user?.role === 'staff' && (
                        <span className="text-sm font-semibold text-primary/80">{staffChangeLabel}</span>
                      )}
                      <Button
                        onClick={handleSaveUpdates}
                        disabled={
                          approvalLockedForStaff ||
                          (user?.role === 'staff' && staffChangeLimitReached) ||
                          isUploadingAttachment
                        }
                      >
                        {isUploadingAttachment && staffChangeCount < 3 ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                          </span>
                        ) : (
                          'Save Updates'
                        )}
                      </Button>
                      {canSendForApproval && (
                        <Button
                          variant="outline"
                          onClick={handleRequestApproval}
                          disabled={isUploadingAttachment}
                        >
                          {isUploadingAttachment ? (
                            <span className="inline-flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Sending...
                            </span>
                          ) : (
                            'Send to Treasurer'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/60 bg-secondary/30 p-4">
                    <p className="text-sm text-muted-foreground">
                      {taskState.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Status Update (Designer/Admin only) */}
            {isDesignerOrAdmin && taskState.status !== 'completed' && (
              <div className={`${glassPanelClass} p-6 animate-slide-up`}>
                <h2 className="font-semibold text-foreground mb-3">Update Status</h2>
                <div className="flex gap-3">
                  <Select
                    value={newStatus}
                    onValueChange={(v) => setNewStatus(v as TaskStatus)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="clarification_required">
                        Clarification Required
                      </SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => newStatus && handleStatusChange(newStatus)}
                    disabled={!newStatus}
                  >
                    Update
                  </Button>
                </div>
              </div>
            )}

            {/* <div className="bg-card border border-border rounded-xl p-6 animate-slide-up space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Deadline Request</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Staff must request deadlines at least 3 working days from today. Designer approval required.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Input
                    type="date"
                    value={deadlineRequest}
                    onChange={(event) => setDeadlineRequest(event.target.value)}
                    className="h-9 max-w-xs"
                    min={format(minDeadlineDate, 'yyyy-MM-dd')}
                    disabled={!canEditTask || approvalLockedForStaff || staffChangeLimitReached}
                  />
                  <Button
                    onClick={handleRequestDeadline}
                    disabled={
                      !canEditTask || !deadlineRequest || approvalLockedForStaff || staffChangeLimitReached
                    }
                  >
                    Request Deadline
                  </Button>
                  {taskState.deadlineApprovalStatus === 'pending' && canApproveDeadline && (
                    <>
                      <Button onClick={() => handleApproveDeadline('approved')}>Approve Deadline</Button>
                      <Button variant="destructive" onClick={() => handleApproveDeadline('rejected')}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
                {taskState.deadlineApprovalStatus && (
                  <Badge variant="secondary" className="mt-3">
                    Deadline {taskState.deadlineApprovalStatus}
                  </Badge>
                )}
              </div>
            </div> */}

            {/* Files */}
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4">Files</h2>

              {/* Input Files */}
              {inputFiles.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    Reference Files
                  </h3>
                  <div className="space-y-2">
                    {inputFiles.map((file) => (
                      <div
                        key={file.id}
                        className={fileRowClass}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {renderFilePreview(file)}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {toTitleCaseFileName(file.name)}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {(() => {
                                const sizeLabel = formatFileSize(file.size);
                                return sizeLabel || '';
                              })()}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {canEditTask && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={approvalLockedForStaff || staffChangeLimitReached}
                              className={fileActionButtonClass}
                              onClick={() => handleRemoveFile(file.id, file.name)}
                            >
                              <Trash2 className="h-4 w-4 text-status-urgent" />
                            </Button>
                          )}
                          {(() => {
                            const downloadUrl = getDownloadUrl(file);
                            return (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={!downloadUrl || downloadUrl === '#'}
                                className={fileActionButtonClass}
                                onClick={() => {
                                  if (downloadUrl && downloadUrl !== '#') {
                                    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
                                  }
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output Files */}
              {outputFiles.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-status-completed" />
                    Final Deliverables
                  </h3>
                  <div className="space-y-2">
                    {outputFiles.map((file) => (
                      <div
                        key={file.id}
                        className={fileRowClass}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {renderFilePreview(file)}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {toTitleCaseFileName(file.name)}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {(() => {
                                const sizeLabel = formatFileSize(file.size);
                                return sizeLabel || '';
                              })()}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {canEditTask && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={approvalLockedForStaff || staffChangeLimitReached}
                              className={fileActionButtonClass}
                              onClick={() => handleRemoveFile(file.id, file.name)}
                            >
                              <Trash2 className="h-4 w-4 text-status-urgent" />
                            </Button>
                          )}
                          {(() => {
                            const downloadUrl = getDownloadUrl(file);
                            return (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={!downloadUrl || downloadUrl === '#'}
                                className={fileActionButtonClass}
                                onClick={() => {
                                  if (downloadUrl && downloadUrl !== '#') {
                                    window.open(downloadUrl, '_blank', 'noopener,noreferrer');
                                  }
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {canEditTask && (
                <div className="rounded-lg border border-dashed border-border p-4">
                  <p className="text-sm font-medium text-foreground mb-3">Add Attachment</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      placeholder="file_name.pdf"
                      value={newFileName}
                      onChange={(event) => setNewFileName(event.target.value)}
                      className="flex-1 min-w-[180px] select-text"
                      disabled={approvalLockedForStaff || staffChangeLimitReached}
                    />
                    <Select
                      value={newFileType}
                      onValueChange={(v) => setNewFileType(v as 'input' | 'output')}
                      disabled={approvalLockedForStaff || staffChangeLimitReached}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="input">Reference</SelectItem>
                        <SelectItem value="output">Deliverable</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddFile} disabled={approvalLockedForStaff || staffChangeLimitReached}>
                      Add File
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload (Designer only) */}
              {isDesignerOrAdmin && (
                <>
                  <div className="mt-6 rounded-2xl border-2 border-dashed border-[#D9E6FF] bg-[#F8FAFF] p-6 text-center">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-semibold text-foreground">Upload Final Files</p>
                    <p className="text-xs text-muted-foreground">
                      Drag and drop or click to upload
                    </p>
                    <input
                      type="file"
                      multiple
                      onChange={handleFinalUpload}
                      className="hidden"
                      id="final-file-upload"
                      disabled={isUploadingFinal}
                    />
                    <label
                      htmlFor="final-file-upload"
                      className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-full border border-[#D9E6FF] bg-white px-4 py-2 text-xs font-semibold text-foreground shadow-sm hover:bg-[#F4F7FF]"
                    >
                      {isUploadingFinal ? 'Uploading...' : 'Select files'}
                    </label>
                    <div className="mt-5 rounded-xl border border-[#D9E6FF] bg-white/90 p-4 text-left shadow-[0_10px_24px_-18px_rgba(15,23,42,0.35)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        Or add a Google Drive link
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1.6fr_auto]">
                        <Input
                          placeholder="File name"
                          value={finalLinkName}
                          onChange={(event) => setFinalLinkName(event.target.value)}
                          className="h-10 select-text rounded-full border-[#D9E6FF] bg-[#F9FBFF] px-4"
                        />
                        <Input
                          placeholder="https://drive.google.com/..."
                          value={finalLinkUrl}
                          onChange={(event) => setFinalLinkUrl(event.target.value)}
                          className="h-10 select-text rounded-full border-[#D9E6FF] bg-[#F9FBFF] px-4"
                        />
                        <Button
                          type="button"
                          onClick={handleAddFinalLink}
                          disabled={!finalLinkUrl.trim() || isAddingFinalLink}
                          className="h-10 rounded-full px-5"
                        >
                          {isAddingFinalLink ? 'Adding...' : 'Add link'}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {taskState.status !== 'completed' && (
                    <div className="mt-4 flex flex-col items-center gap-2">
                      <Button
                        onClick={handleHandoverTask}
                        disabled={!canHandover}
                        className="min-w-[180px] px-6"
                      >
                        Submit
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Mark the task as completed after uploading final files.
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Internal Chat */}
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Internal Chat ({taskState.comments.length})
              </h2>

              {topLevelComments.length > 0 ? (
                <div className="space-y-5 mb-6">
                  {topLevelComments.map((comment) => renderCommentThread(comment))}
                </div>
              ) : (
                <div className="mb-6 text-sm text-muted-foreground">
                  No messages yet. Start a thread with {formatMentionList(user?.role)}.
                </div>
              )}

              <div className="flex gap-3">
                <Textarea
                  placeholder={getMentionPlaceholder(user?.role)}
                  value={newComment}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewComment(value);
                    if (!apiUrl) return;
                    emitTyping(true);
                    if (typingTimeoutRef.current) {
                      clearTimeout(typingTimeoutRef.current);
                    }
                    typingTimeoutRef.current = setTimeout(() => {
                      emitTyping(false);
                    }, 1200);
                  }}
                  rows={2}
                  className="flex-1 select-text"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!newComment.trim()}
                  size="icon"
                  className="self-end"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {Object.keys(typingUsers).length > 0 && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#D9E6FF] bg-white/80 px-3 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm">
                  <span>
                    {(() => {
                      const entries = Object.values(typingUsers);
                      const names = entries
                        .map((entry) =>
                          `${entry.name}${entry.role ? ` (${roleLabels[entry.role]})` : ''}`
                        )
                        .join(', ');
                      const verb = entries.length === 1 ? 'is' : 'are';
                      return `${names} ${verb} typing`;
                    })()}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Metadata */}
          <div className="space-y-6">
            {/* Task Info */}
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4">Details</h2>
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Requester
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{taskState.requesterName}</span>
                  </dd>
                  {taskState.requesterDepartment && (
                    <dd className="text-xs text-muted-foreground mt-0.5 ml-6">
                      {taskState.requesterDepartment}
                    </dd>
                  )}
                </div>

                {taskState.assignedToName && (
                  <div>
                    <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                      Assigned To
                    </dt>
                    <dd className="mt-1 flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{taskState.assignedToName}</span>
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Deadline
                  </dt>
                  <dd
                    className={cn(
                      'mt-1 flex items-center gap-2 text-sm',
                      isOverdue && 'text-status-urgent font-medium'
                    )}
                  >
                    <Calendar className="h-4 w-4" />
                    <span>{format(taskState.deadline, 'MMM d, yyyy')}</span>
                  </dd>
                  {isOverdue && (
                    <dd className="text-xs text-status-urgent mt-0.5 ml-6 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Overdue by {formatDistanceToNow(taskState.deadline)}
                    </dd>
                  )}
                </div>

                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Created
                  </dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(taskState.createdAt, 'MMM d, yyyy')}</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Last Updated
                  </dt>
                  <dd className="mt-1 text-sm text-muted-foreground">
                    {formatDistanceToNow(taskState.updatedAt, { addSuffix: true })}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Status Timeline */}
            <div className={`${glassPanelClass} p-6 overflow-hidden animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4">Status</h2>
              {(() => {
                const steps: TaskStatus[] = ['pending', 'in_progress', 'under_review', 'completed'];
                const currentIndex = steps.indexOf(taskState.status);
                return (
                  <div className="space-y-3 sm:space-y-4">
                    {steps.map((step, index) => {
                      const isCurrent = index === currentIndex;
                      const isPast = index < currentIndex;
                      const isUpcoming = index > currentIndex;
                      return (
                        <div key={step} className="flex items-start gap-3 sm:gap-4">
                          <div className="relative flex flex-col items-center">
                            <div className="flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center">
                              {isCurrent ? (
                                <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-full overflow-hidden bg-white">
                                  <DotLottieReact
                                    src="https://lottie.host/31b5d829-4d1f-42a6-ba16-3560e550c0ac/KTsiywVfWC.lottie"
                                    loop
                                    autoplay
                                    className="h-9 w-9 sm:h-12 sm:w-12"
                                  />
                                </div>
                              ) : (
                                <span
                                  className={cn(
                                    'h-4 w-4 sm:h-6 sm:w-6 rounded-full',
                                    isPast ? 'bg-primary/70' : 'bg-[#D6DFEF]'
                                  )}
                                />
                              )}
                            </div>
                            {index !== steps.length - 1 && (
                              <div
                                className={cn(
                                  'mt-1 h-8 sm:h-10 w-[2px]',
                                  isPast ? 'bg-primary' : 'bg-[#E6EEFF]'
                                )}
                              />
                            )}
                          </div>
                          <div className="w-full min-w-0 flex-1 rounded-2xl border border-[#D9E6FF] bg-gradient-to-br from-white/90 via-[#F2F7FF]/85 to-[#E8F0FF]/75 px-3 py-2 sm:px-4 sm:py-3 shadow-[0_16px_36px_-26px_rgba(15,23,42,0.35)] backdrop-blur">
                            <div
                              className={cn(
                                'min-w-0 text-xs sm:text-sm font-semibold',
                                isCurrent
                                  ? 'text-foreground'
                                  : isPast
                                    ? 'text-muted-foreground'
                                    : 'text-muted-foreground/60'
                              )}
                            >
                              {statusConfig[step].label}
                            </div>
                            <div
                              className={cn(
                                'mt-1 text-[11px] sm:text-xs',
                                isCurrent
                                  ? 'text-muted-foreground'
                                  : isPast
                                    ? 'text-muted-foreground/80'
                                    : 'text-muted-foreground/60'
                              )}
                            >
                              {statusDetails[step]}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            {emergencyStatus && (
              <div className={`${glassPanelClass} p-6 animate-slide-up`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground">Emergency Approval</h2>
                  <Badge variant={emergencyVariant}>{emergencyLabel}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Requested{' '}
                  {format(
                    taskState.emergencyRequestedAt || taskState.createdAt,
                    'MMM d, yyyy'
                  )}
                </div>
                {taskState.emergencyApprovedAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {emergencyStatus === 'approved' ? 'Approved' : 'Rejected'} by{' '}
                    {taskState.emergencyApprovedBy || 'Designer'} on{' '}
                    {format(taskState.emergencyApprovedAt, 'MMM d, yyyy')}
                  </p>
                )}
                {user?.role === 'designer' && emergencyStatus === 'pending' && (
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleEmergencyDecision('approved')}
                      disabled={isEmergencyUpdating}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEmergencyDecision('rejected')}
                      disabled={isEmergencyUpdating}
                    >
                      Reject
                    </Button>
                  </div>
                )}

                {designVersions.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      Version History
                    </h3>
                    <div className="space-y-2">
                      {designVersions.map((version) => (
                        <div key={version.id} className={fileRowClass}>
                          <div>
                            <div className="text-sm font-medium">
                              {getVersionLabel(version)} - {version.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Uploaded {format(version.uploadedAt, 'MMM d, yyyy')}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {activeDesignVersionId === version.id && (
                              <Badge variant="secondary">Active</Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={!version.url}
                              className={fileActionButtonClass}
                              onClick={() => {
                                if (version.url) {
                                  window.open(version.url, '_blank', 'noopener,noreferrer');
                                }
                              }}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {canManageVersions && activeDesignVersionId !== version.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRollbackVersion(version.id)}
                              >
                                Rollback
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {designVersions.length > 1 && (
                      <div className="mt-4 rounded-lg border border-border/60 bg-secondary/30 p-4">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              Compare Left
                            </span>
                            <Select value={compareLeftId} onValueChange={setCompareLeftId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select version" />
                              </SelectTrigger>
                              <SelectContent>
                                {designVersions.map((version) => (
                                  <SelectItem key={version.id} value={version.id}>
                                    {getVersionLabel(version)} - {version.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                              Compare Right
                            </span>
                            <Select value={compareRightId} onValueChange={setCompareRightId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select version" />
                              </SelectTrigger>
                              <SelectContent>
                                {designVersions.map((version) => (
                                  <SelectItem key={version.id} value={version.id}>
                                    {getVersionLabel(version)} - {version.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {compareLeft && compareRight && (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            {[compareLeft, compareRight].map((version) => (
                              <div
                                key={version.id}
                                className="rounded-lg border border-border/60 bg-background p-3"
                              >
                                <div className="text-xs font-semibold text-muted-foreground mb-2">
                                  {getVersionLabel(version)} - {version.name}
                                </div>
                                {version.url && isImageVersion(version) ? (
                                  <img
                                    src={version.url}
                                    alt={version.name}
                                    className="w-full rounded-md border border-border/40"
                                  />
                                ) : (
                                  <div className="text-sm text-muted-foreground">
                                    {version.url ? (
                                      <>
                                        Preview not available.{' '}
                                        <button
                                          type="button"
                                          className="text-primary hover:underline"
                                          onClick={() =>
                                            window.open(version.url, '_blank', 'noopener,noreferrer')
                                          }
                                        >
                                          Open file
                                        </button>
                                      </>
                                    ) : (
                                      'No file URL available for this version.'
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {user?.role === 'staff' && changeHistory.length > 0 && (
              <div className={`${glassPanelClass} p-6 animate-slide-up`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground">Notifications</h2>
                  <History className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  {changeHistory.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-border/60 bg-secondary/40 p-3">
                      <p className="text-sm font-medium text-foreground">
                        {entry.note || `${entry.userName} updated ${formatChangeField(entry.field)}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-foreground">Change History</h2>
                <History className="h-4 w-4 text-muted-foreground" />
              </div>
              {changeHistory.length > 0 ? (
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
                  {changeHistory.map((entry) => (
                    <div
                      key={entry.id}
                      id={`change-${entry.id}`}
                      className={cn(
                        'rounded-lg border border-border/60 bg-secondary/40 p-2.5 transition-colors',
                        entry.id === highlightChangeId && 'border-primary/40 bg-primary/10'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-foreground leading-snug">
                            {entry.userName} updated {formatChangeField(entry.field)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {entry.oldValue ? `From "${entry.oldValue}" to "${entry.newValue}"` : entry.newValue}
                          </p>
                          {entry.note && (
                            <p className="text-xs text-muted-foreground mt-1">{entry.note}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(entry.createdAt, { addSuffix: true })}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {entry.userRole}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {entry.type.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No updates recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <Dialog
        open={showHandoverModal}
        onOpenChange={(open) => {
          if (!open) handleHandoverClose();
        }}
      >
        <DialogContent className="max-w-md overflow-hidden p-0">
          <div className="relative h-44 bg-primary/10">
            {handoverAnimation && (
              <Lottie animationData={handoverAnimation} loop={6} className="h-full w-full" />
            )}
          </div>
          <div className="px-7 pb-7 pt-5 text-center">
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle className="text-2xl font-bold text-foreground">
                Thank you!
              </DialogTitle>
              <DialogDescription className="mt-2.5 text-sm text-muted-foreground">
                The handover has been successfully submitted.
                <br />
                The requester will be notified shortly.
              </DialogDescription>
            </DialogHeader>
            <Button className="mt-8 w-full" onClick={handleHandoverClose}>
              Close
            </Button>
            <div className="mt-6 border-t border-border/60 pt-4 pb-2 text-center text-[11px] text-muted-foreground">
              For assistance, please contact the coordinator at{' '}
              <a href="tel:+910000000000" className="font-medium text-foreground/80 hover:text-foreground">
                +91 0000000000
              </a>{' '}
              or{' '}
              <a
                href="mailto:support@designdesk.com"
                className="font-medium text-foreground/80 hover:text-foreground"
              >
                support@designdesk.com
              </a>
              .
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}


