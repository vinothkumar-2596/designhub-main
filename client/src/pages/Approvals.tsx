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
  const [tasks, setTasks] = useState<typeof mockTasks>(API_URL ? [] : mockTasks);
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
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to update approval');
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
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to approve request';
      toast.error(message);
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
      const message =
        error instanceof Error && error.message ? error.message : 'Failed to reject request';
      toast.error(message);
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
        <div className="rounded-lg border border-border/45 bg-card p-4 shadow-none animate-slide-up">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
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
                  className="relative overflow-hidden rounded-2xl border border-[#D5E2FF]/55 bg-gradient-to-br from-white/85 via-white/70 to-[#E6F1FF]/75 supports-[backdrop-filter]:from-white/65 supports-[backdrop-filter]:via-white/55 supports-[backdrop-filter]:to-[#E6F1FF]/60 backdrop-blur-2xl ring-1 ring-[#E3ECFF]/45 p-4 md:p-5 animate-slide-up dark:border-[#2F4F8F]/45 dark:ring-[#3C5FA0]/20 dark:bg-card dark:shadow-none dark:bg-none dark:from-transparent dark:via-transparent dark:to-transparent"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#DCE8FF]/70 blur-3xl dark:bg-[#2C56B7]/20" />
                  <div className="pointer-events-none absolute -left-12 -bottom-14 h-40 w-40 rounded-full bg-[#EAF1FF]/80 blur-3xl dark:bg-[#2A49A6]/20" />
                  <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/50 dark:ring-white/5" />
                  <div className="relative min-w-0">
                    <div className="absolute right-0 top-0 inline-flex w-fit items-center gap-2.5 rounded-2xl border-none ring-0 bg-gradient-to-r from-white/90 via-[#F7FAFF]/88 to-[#EDF4FF]/84 supports-[backdrop-filter]:bg-[#F7FAFF]/72 backdrop-blur-xl px-3.5 py-2.5 shadow-none dark:bg-[linear-gradient(120deg,rgba(11,25,57,0.92),rgba(17,37,77,0.9),rgba(20,45,90,0.82))] dark:[box-shadow:inset_0_1px_0_rgba(166,188,236,0.10)] dark:backdrop-blur-xl">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-none ring-0 bg-gradient-to-br from-white/96 to-[#ECF3FF]/92 text-[#2D3F73] text-sm font-semibold dark:bg-[linear-gradient(145deg,rgba(68,99,165,0.95),rgba(33,58,112,0.92))] dark:text-[#EAF0FF]">
                        {requesterInitials}
                      </div>
                      <div className="pr-1 whitespace-nowrap leading-tight">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7B8EAF] dark:text-[#AFC2EA]">
                          Submitted
                        </p>
                        <p className="text-sm font-semibold text-foreground dark:text-slate-100 leading-tight">
                          {format(task.createdAt, 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-[#7B8EAF] dark:text-[#B6C7EA]">
                          {format(task.createdAt, 'h:mm a')}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0 pr-0 sm:pr-[220px]">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge
                          variant="pending"
                          className="border border-border bg-card/90 text-muted-foreground"
                        >
                          Awaiting Approval
                        </Badge>
                        {task.urgency === 'urgent' && (
                          <Badge variant="urgent">Urgent</Badge>
                        )}
                      </div>
                      <h3 className="text-2xl font-semibold leading-tight text-foreground dark:text-slate-100 premium-headline">
                        {headline}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground dark:text-[#A0B4DE] premium-body">
                        {summary}
                      </p>
                      {staffPreview && (
                        <div className="mt-3 rounded-xl border border-border/45 bg-card/80 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Staff update
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm text-foreground/85">
                            {staffPreview}
                          </p>
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#D9E6FF]/45 pt-4 dark:border-[#2F4F8E]/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="default"
                        className="h-9 gap-2 rounded-xl px-4 border border-white/35 bg-primary/80 bg-gradient-to-r from-white/15 via-primary/80 to-primary/90 text-white shadow-none hover:bg-primary/85 dark:border-transparent"
                        onClick={() => handleApprove(task.id)}
                        disabled={processingId === task.id}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {processingId === task.id ? 'Processing...' : 'Approve'}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-9 gap-2 rounded-xl border-transparent text-foreground hover:bg-muted/60 dark:border-transparent dark:bg-[#0D1C45]/75 dark:text-slate-100 dark:hover:bg-[#173267]/80"
                        onClick={() => handleReject(task.id)}
                        disabled={processingId === task.id}
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="group h-9 rounded-full border border-[#CADBFF]/55 bg-[#F5F8FF]/85 px-4 text-[#233A71] shadow-none transition-all duration-200 hover:border-[#AEC6FF]/70 hover:bg-[#EEF4FF] hover:text-[#162A5D] dark:border-[#3E5F9F]/55 dark:bg-[#10234F]/70 dark:text-[#DCE7FF] dark:hover:border-[#5D7EC0]/65 dark:hover:bg-[#17356B]/78"
                    >
                      <Link
                        to={`/task/${task.id}`}
                        state={{ task }}
                        className="inline-flex items-center gap-2 font-medium"
                      >
                        <Eye className="h-4 w-4" />
                        Review Details
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
