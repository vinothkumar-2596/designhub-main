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
import { useGlobalSearch } from '@/contexts/GlobalSearchContext';
import { buildSearchItemsFromTasks, matchesSearch } from '@/lib/search';

import { API_URL, authFetch } from '@/lib/api';

export default function Approvals() {
  const { user } = useAuth();
  const { query, setItems, setScopeLabel } = useGlobalSearch();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tasks, setTasks] = useState(mockTasks);
  const [isLoading, setIsLoading] = useState(false);
  const apiUrl = API_URL;

  useEffect(() => {
    if (!apiUrl) return;
    const loadTasks = async () => {
      setIsLoading(true);
      try {
        const response = await authFetch(`${apiUrl}/api/tasks`);
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

  useEffect(() => {
    setScopeLabel('Approvals');
    setItems(buildSearchItemsFromTasks(pendingApprovals));
  }, [pendingApprovals, setItems, setScopeLabel]);

  const filteredApprovals = useMemo(
    () =>
      pendingApprovals.filter((task) =>
        matchesSearch(query, [
          task.title,
          task.description,
          task.requesterName,
          task.requesterDepartment,
          task.category,
          task.status,
        ])
      ),
    [pendingApprovals, query]
  );

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

  const formatTaskText = (value?: string) => {
    const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  const getRequestSummary = (task: (typeof tasks)[number]) => {
    const title = String(task.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const description = String(task.description || '').replace(/\s+/g, ' ').trim();
    if (!description) return 'No additional request details were provided.';
    if (description.toLowerCase() === title) {
      return 'Details were not added beyond the request title.';
    }
    return description;
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
      const response = await authFetch(`${apiUrl}/api/tasks/${taskId}/changes`, {
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
          <h1 className="text-2xl font-bold text-foreground premium-headline">Pending Approvals</h1>
          <p className="text-muted-foreground mt-1 premium-body">
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
          {filteredApprovals.length} pending approval
          {filteredApprovals.length !== 1 ? 's' : ''}
        </p>

        {/* Approval Cards */}
        {isLoading ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border animate-fade-in">
            <p className="text-sm text-muted-foreground">Loading approvals...</p>
          </div>
        ) : filteredApprovals.length > 0 ? (
          <div className="space-y-4">
            {filteredApprovals.map((task, index) => {
              const staffPreview = getStaffUpdatePreview(task);
              const headline = formatTaskText(task.title) || 'Untitled request';
              const summary = getRequestSummary(task);
              const requesterInitials =
                task.requesterName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() || '')
                  .join('') || 'AP';
              return (
                <div
                  key={task.id}
                  className="relative overflow-hidden rounded-2xl border border-[#D9E6FF] bg-white p-4 md:p-5 animate-slide-up shadow-card dark:border-[#1E3A75]/55 dark:bg-[#0B1738]/92 dark:shadow-none"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(77,92,218,0.14),transparent_58%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.14),transparent_56%)]" />
                  <div className="relative grid gap-4 xl:grid-cols-[210px_minmax(0,1fr)_220px] xl:items-start">
                    <div className="flex items-center gap-3 rounded-xl border border-[#E4ECFF] bg-[#F8FBFF]/80 p-3 dark:border-[#1E3A75]/65 dark:bg-[#11234A]/55">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary font-semibold dark:border-primary/35 dark:bg-primary/20 dark:text-indigo-200">
                        {requesterInitials}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Submitted
                        </p>
                        <p className="text-sm font-semibold text-foreground dark:text-slate-100">
                          {format(task.createdAt, 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(task.createdAt, 'h:mm a')}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="pending"
                          className="border border-primary/25 bg-primary/10 text-primary dark:border-primary/35 dark:bg-primary/18 dark:text-indigo-200"
                        >
                          Awaiting Approval
                        </Badge>
                        {task.urgency === 'urgent' && (
                          <Badge variant="urgent">Urgent</Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold leading-tight text-foreground dark:text-slate-100">
                        {headline}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground dark:text-slate-300">
                        {summary}
                      </p>
                      {staffPreview && (
                        <div className="mt-3 rounded-lg border border-[#CFE0FF] bg-[#F5F9FF]/90 px-3 py-2 dark:border-[#1E3A75]/70 dark:bg-[#11234A]/70">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70 dark:text-indigo-200/80">
                            Staff update
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground dark:text-slate-300">
                            {staffPreview}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2 rounded-xl border border-[#E4ECFF] bg-[#F8FBFF]/80 p-3 text-sm text-muted-foreground dark:border-[#1E3A75]/65 dark:bg-[#11234A]/55 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary/80 dark:text-indigo-200" />
                        <span className="truncate">
                          {task.requesterName}
                          {task.requesterDepartment && (
                            <span className="ml-1 text-xs opacity-85">
                              ({task.requesterDepartment})
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary/80 dark:text-indigo-200" />
                        <span>Due {format(task.deadline, 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Paperclip className="h-4 w-4 text-primary/80 dark:text-indigo-200" />
                        <span>{task.files.length} files attached</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4ECFF] pt-4 dark:border-[#1E3A75]/55">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="default"
                        className="h-9 gap-2 rounded-lg px-4"
                        onClick={() => handleApprove(task.id)}
                        disabled={processingId === task.id}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {processingId === task.id ? 'Processing...' : 'Approve'}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-9 gap-2 rounded-lg border-primary/30 text-primary hover:bg-primary/5 dark:border-slate-600/70 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-white dark:hover:border-slate-500/80"
                        onClick={() => handleReject(task.id)}
                        disabled={processingId === task.id}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-9 gap-2 rounded-lg px-3 text-primary hover:bg-primary/5 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white"
                    >
                      <Link to={`/task/${task.id}`} state={{ task }}>
                        <Eye className="h-4 w-4" />
                        Details
                      </Link>
                    </Button>
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
