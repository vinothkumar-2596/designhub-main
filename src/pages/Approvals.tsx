import { useState, useMemo } from 'react';
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
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function Approvals() {
  const { user } = useAuth();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filter to only show modification requests pending approval
  const pendingApprovals = useMemo(() => {
    return mockTasks.filter(
      (task) => task.isModification && task.approvalStatus === 'pending'
    );
  }, []);

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
                These requests involve modifications to previously approved designs.
                Review carefully before approving to ensure changes align with
                branding and budget requirements.
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
        {pendingApprovals.length > 0 ? (
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
