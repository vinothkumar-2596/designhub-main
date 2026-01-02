import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockTasks } from '@/data/mockTasks';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  XCircle,
  FileCheck,
  Calendar,
  User,
  Paperclip,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function Approvals() {
  const { user } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tasks, setTasks] = useState(mockTasks);
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:4000'
      : undefined);

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
          files: task.files?.map((file: any) => ({
            ...file,
            uploadedAt: new Date(file.uploadedAt),
          })),
          comments: task.comments?.map((comment: any) => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
          })),
          changeHistory: task.changeHistory?.map((entry: any) => ({
            ...entry,
            createdAt: new Date(entry.createdAt),
          })),
        }));
        setTasks(hydrated);
      } catch (error) {
        toast.error('Failed to load approvals');
      } finally {
        setIsLoading(false);
      }
    };
    loadTasks();
  }, [apiUrl]);

  // Filter to only show requests pending approval
  const pendingApprovals = useMemo(() => {
    return tasks.filter((task) => task.approvalStatus === 'pending');
  }, [tasks]);

  const getStaffUpdatePreview = (task: (typeof tasks)[number]) => {
    const history = [...(task.changeHistory || [])].sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );
    for (const entry of history) {
      if (entry.userRole !== 'staff') continue;
      if (entry.field === 'approval_status') continue;
      if (entry.field === 'staff_note' && entry.newValue) {
        return entry.newValue;
      }
      if (entry.field === 'description' && entry.newValue) {
        return entry.newValue;
      }
      if (entry.note) {
        return entry.note;
      }
      if (entry.newValue) {
        return entry.newValue;
      }
    }
    return '';
  };

  const updateApprovalStatus = async (
    taskId: string,
    decision: 'approved' | 'rejected'
  ) => {
    const currentTask = tasks.find((task) => task.id === taskId);
    const oldValue = currentTask?.approvalStatus ?? 'pending';
    const newValue = decision === 'approved' ? 'Approved' : 'Rejected';
    const approvalNote = `Approval ${decision} by ${user?.name || 'Treasurer'}`;
    if (apiUrl) {
      const response = await fetch(`${apiUrl}/api/tasks/${taskId}/changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            approvalStatus: decision,
            approvedBy: user?.name || '',
            approvalDate: new Date(),
          },
          changes: [
            {
              type: 'status',
              field: 'approval_status',
              oldValue,
              newValue,
              note: approvalNote,
            },
          ],
          userId: user?.id || '',
          userName: user?.name || '',
          userRole: user?.role || '',
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to update approval');
      }
    }
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
            ...task,
            approvalStatus: decision,
            approvedBy: user?.name || '',
            approvalDate: new Date(),
            updatedAt: new Date(),
            changeHistory: [
              {
                id: `ch-${Date.now()}-0`,
                type: 'status',
                field: 'approval_status',
                oldValue,
                newValue,
                note: approvalNote,
                userId: user?.id || '',
                userName: user?.name || 'Treasurer',
                userRole: user?.role || 'treasurer',
                createdAt: new Date(),
              },
              ...(task.changeHistory || []),
            ],
          }
          : task
      )
    );
  };

  const handleApprove = async (taskId: string) => {
    setProcessingId(taskId);
    try {
      await updateApprovalStatus(taskId, 'approved');
      toast.success('Request approved', {
        description: 'The requester has been notified.',
      });
    } catch (error) {
      toast.error('Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (taskId: string) => {
    setProcessingId(taskId);
    try {
      await updateApprovalStatus(taskId, 'rejected');
      toast.success('Request rejected', {
        description: 'The requester has been notified.',
      });
    } catch (error) {
      toast.error('Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">Pending Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve staff change requests
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-foreground">Approval Guidelines</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Review incoming requests before approving to ensure the scope,
                timeline, and assets align with brand and budget expectations.
              </p>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-muted-foreground">
          {pendingApprovals.length} pending approval
          {pendingApprovals.length !== 1 ? 's' : ''}
        </p>

        {/* Approval Cards */}
        {isLoading ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <p className="text-sm text-muted-foreground">Loading approvals...</p>
          </div>
        ) : pendingApprovals.length > 0 ? (
          <div className="space-y-4">
            {pendingApprovals.map((task, index) => {
              const staffPreview = getStaffUpdatePreview(task);
              return (
                <div
                  key={task.id}
                  className="bg-white border border-[#D9E6FF] rounded-2xl p-4 md:p-5 animate-slide-up shadow-card"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center">
                    <div className="flex items-center gap-3 md:w-44 md:shrink-0 md:border-r md:border-[#E4ECFF] md:pr-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-semibold">
                        AP
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Submitted
                        </p>
                        <p className="text-sm font-semibold text-foreground">
                          {format(task.createdAt, 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(task.createdAt, 'h:mm a')}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge
                            variant="pending"
                            className="border border-primary/20 bg-primary/10 text-primary"
                          >
                            Awaiting Approval
                          </Badge>
                          {task.urgency === 'urgent' && (
                            <Badge variant="urgent">Urgent</Badge>
                          )}
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">{task.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {task.description}
                        </p>
                        {staffPreview && (
                          <div className="mt-3 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                              Staff update
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {staffPreview}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>
                            {task.requesterName}
                            {task.requesterDepartment && (
                              <span className="text-xs ml-1">
                                ({task.requesterDepartment})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>Due {format(task.deadline, 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          <span>{task.files.length} files attached</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row gap-2 md:flex-col md:w-36">
                      <Button
                        variant="default"
                        className="flex-1 gap-2"
                        onClick={() => handleApprove(task.id)}
                        disabled={processingId === task.id}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 border-primary/30 text-primary hover:bg-primary/5"
                        onClick={() => handleReject(task.id)}
                        disabled={processingId === task.id}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="gap-2 text-primary hover:bg-primary/5"
                      >
                        <Link to={`/task/${task.id}`} state={{ task }}>
                          <Eye className="h-4 w-4" />
                          Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <FileCheck className="h-12 w-12 text-status-completed mx-auto mb-3" />
            <h3 className="font-medium text-foreground">All caught up!</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No pending approvals at the moment
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
