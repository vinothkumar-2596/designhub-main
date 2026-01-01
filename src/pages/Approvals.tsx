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

  const handleApprove = async (taskId: string) => {
    setProcessingId(taskId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success('Request approved', {
      description: 'The request has been forwarded to the design team.',
    });
    setProcessingId(null);
  };

  const handleReject = async (taskId: string) => {
    setProcessingId(taskId);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.error('Request rejected', {
      description: 'The requester has been notified.',
    });
    setProcessingId(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">Pending Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve modification requests
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
            {pendingApprovals.map((task, index) => (
              <div
                key={task.id}
                className="bg-card border border-border rounded-xl p-6 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Task Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="pending">Awaiting Approval</Badge>
                      {task.urgency === 'urgent' && (
                        <Badge variant="urgent">Urgent</Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      {task.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {task.description}
                    </p>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
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
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>Due {format(task.deadline, 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Paperclip className="h-4 w-4" />
                        <span>{task.files.length} files attached</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row lg:flex-col gap-2 lg:w-36">
                    <Button
                      variant="default"
                      className="flex-1 gap-2 bg-status-completed hover:bg-status-completed/90"
                      onClick={() => handleApprove(task.id)}
                      disabled={processingId === task.id}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleReject(task.id)}
                      disabled={processingId === task.id}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="gap-2">
                      <Link to={`/task/${task.id}`}>
                        <Eye className="h-4 w-4" />
                        Details
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
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
