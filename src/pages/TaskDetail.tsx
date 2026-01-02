import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
  User,
  Download,
  MessageSquare,
  Send,
  FileText,
  Upload,
  Loader2,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  History,
} from 'lucide-react';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ApprovalStatus, TaskChange, TaskStatus } from '@/types';
import { cn } from '@/lib/utils';

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

const changeFieldLabels: Record<string, string> = {
  staff_note: 'staff note',
  approval_status: 'approval status',
  deadline_request: 'deadline request',
};

const formatChangeField = (field: string) => changeFieldLabels[field] || field.replace(/_/g, ' ');

type ChangeInput = Pick<TaskChange, 'type' | 'field' | 'oldValue' | 'newValue' | 'note'>;

const glassPanelClass =
  'bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl border border-[#C9D7FF] ring-1 ring-black/5 rounded-2xl shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)]';
const fileRowClass =
  'flex items-center justify-between rounded-lg border border-[#D7E3FF] bg-gradient-to-r from-[#F4F8FF]/90 via-[#EEF4FF]/70 to-[#E6F1FF]/80 px-4 py-3 supports-[backdrop-filter]:bg-[#EEF4FF]/60 backdrop-blur-xl';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as
    | { task?: typeof mockTasks[number]; highlightChangeId?: string }
    | null;
  const { user } = useAuth();
  const apiUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:4000'
      : undefined);
  const stateTask = locationState?.task;
  const highlightChangeId = locationState?.highlightChangeId;
  const initialTask = stateTask || mockTasks.find((t) => t.id === id);
  const [taskState, setTaskState] = useState<typeof mockTasks[number] | undefined>(initialTask);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
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
      const time = new Date(entry.createdAt ?? 0).getTime();
      return latestFinalApprovalAt ? time > latestFinalApprovalAt : true;
    }).length;
  }, [changeHistory]);
  const approvalLockedForStaff = user?.role === 'staff' && approvalStatus === 'pending';
  const staffChangeLabel = staffChangeCount === 1 ? '1 change updated' : `${staffChangeCount} changes updated`;
  const canSendForApproval =
    user?.role === 'staff' && staffChangeCount >= 3 && approvalStatus !== 'pending';
  const staffChangeLimitReached = user?.role === 'staff' && staffChangeCount >= 3;

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    const taskKey = taskState?.id || id;
    if (!taskKey) return;
    localStorage.setItem(`designhub.task.viewed.${user.id}.${taskKey}`, 'true');
  }, [user, taskState?.id, id]);

  useEffect(() => {
    if (!highlightChangeId || typeof document === 'undefined') return;
    const target = document.getElementById(`change-${highlightChangeId}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightChangeId, changeHistory.length]);

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
      files: raw.files?.map((file, index) => ({
        ...file,
        id: file.id ?? `file-${index}-${file.name || 'attachment'}`,
        uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
      })),
      comments: raw.comments?.map((comment) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
      })),
      changeHistory: raw.changeHistory?.map((entry) => ({
        ...entry,
        createdAt: new Date(entry.createdAt),
      })),
    };
  };

  const persistTask = (nextTask: typeof taskState, nextHistory?: TaskChange[]) => {
    if (!nextTask || !storageKey) return;
    const payload = {
      ...nextTask,
      changeHistory: nextHistory ?? nextTask.changeHistory,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  };

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
  const inputFiles = taskState.files.filter((f) => f.type === 'input');
  const outputFiles = taskState.files.filter((f) => f.type === 'output');

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

    const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
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
    if (apiUrl) return;
    if (!storageKey) return;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      const hydrated = hydrateTask(parsed);
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
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    toast.success('Comment added');
    setNewComment('');
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
              note: 'Final file uploaded',
            },
          ],
          { files: [...taskState.files, newFile] }
        );
      }
      toast.success('Final files uploaded.');
    } catch (error) {
      toast.error('File upload failed');
    } finally {
      setIsUploadingFinal(false);
      e.target.value = '';
    }
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
    } catch (error) {
      toast.error('File upload failed');
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

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
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
            <Badge variant={status.variant}>{status.label}</Badge>
            {taskState.urgency === 'urgent' && <Badge variant="urgent">Urgent</Badge>}
            <Badge variant="secondary">Changes: {changeCount}</Badge>
            {approvalStatus && (
              <Badge
                variant={
                  approvalStatus === 'approved'
                    ? 'completed'
                    : approvalStatus === 'rejected'
                      ? 'urgent'
                      : 'pending'
                }
              >
                {approvalStatus === 'approved'
                  ? 'Approved'
                  : approvalStatus === 'rejected'
                    ? 'Rejected'
                    : 'Awaiting Approval'}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
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
                        className="mt-2"
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
                          className="mt-2"
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
                            className="mt-2 max-w-xs"
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
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {canEditTask && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={approvalLockedForStaff || staffChangeLimitReached}
                              onClick={() => handleRemoveFile(file.id, file.name)}
                            >
                                <Trash2 className="h-4 w-4 text-status-urgent" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={!file.url || file.url === '#'}
                            onClick={() => {
                              if (file.url && file.url !== '#') {
                                window.open(file.url, '_blank', 'noopener,noreferrer');
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
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
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-status-completed" />
                          <span className="text-sm font-medium">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {canEditTask && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              disabled={approvalLockedForStaff || staffChangeLimitReached}
                              onClick={() => handleRemoveFile(file.id, file.name)}
                            >
                                <Trash2 className="h-4 w-4 text-status-urgent" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={!file.url || file.url === '#'}
                            onClick={() => {
                              if (file.url && file.url !== '#') {
                                window.open(file.url, '_blank', 'noopener,noreferrer');
                              }
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
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
                      className="flex-1 min-w-[180px]"
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
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center mt-6">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Upload Final Files</p>
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
                    className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground"
                  >
                    {isUploadingFinal ? 'Uploading...' : 'Select files'}
                  </label>
                </div>
              )}
            </div>

            {/* Comments */}
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments ({taskState.comments.length})
              </h2>

              {/* Comment List */}
              {taskState.comments.length > 0 && (
                <div className="space-y-4 mb-6">
                  {taskState.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium flex-shrink-0">
                        {comment.userName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {comment.userName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(comment.createdAt, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment */}
              <div className="flex gap-3">
                <Textarea
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                  className="flex-1"
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

            {/* Status Timeline (simplified) */}
            <div className={`${glassPanelClass} p-6 animate-slide-up`}>
              <h2 className="font-semibold text-foreground mb-4">Status</h2>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-4">
                  {(['pending', 'in_progress', 'under_review', 'completed'] as TaskStatus[]).map(
                    (s, index) => {
                      const isCurrent = taskState.status === s;
                      const isPast =
                        ['pending', 'in_progress', 'under_review', 'completed'].indexOf(
                          taskState.status
                        ) > index;
                      return (
                        <div key={s} className="flex items-center gap-3 relative">
                          <div
                            className={cn(
                              'h-6 w-6 rounded-full border-2 flex items-center justify-center z-10',
                              isCurrent
                                ? 'bg-primary border-primary'
                                : isPast
                                  ? 'bg-status-completed border-status-completed'
                                  : 'bg-card border-border'
                            )}
                          >
                            {(isPast || isCurrent) && (
                              <CheckCircle2
                                className={cn(
                                  'h-3 w-3',
                                  isCurrent
                                    ? 'text-primary-foreground'
                                    : 'text-status-completed-foreground'
                                )}
                              />
                            )}
                          </div>
                          <span
                            className={cn(
                              'text-sm',
                              isCurrent
                                ? 'font-medium text-foreground'
                                : isPast
                                  ? 'text-muted-foreground'
                                  : 'text-muted-foreground/50'
                            )}
                          >
                            {statusConfig[s].label}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

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
    </DashboardLayout>
  );
}
