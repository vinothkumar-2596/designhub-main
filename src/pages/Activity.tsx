import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Clock, User, FileText, CheckCircle2, MessageSquare, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { DateRangeFilter } from '@/components/filters/DateRangeFilter';
import { DateRangeOption, getDateRange, isWithinRange } from '@/lib/dateRange';

interface ActivityItem {
  id: string;
  type: 'created' | 'status_change' | 'comment' | 'file_upload' | 'approval';
  taskId: string;
  taskTitle: string;
  userName: string;
  userRole: string;
  details: string;
  timestamp: Date;
}

const mockActivity: ActivityItem[] = [
  {
    id: '1',
    type: 'created',
    taskId: '4',
    taskTitle: 'Modify Approved Poster Design',
    userName: 'John Requester',
    userRole: 'staff',
    details: 'Created new modification request',
    timestamp: new Date(),
  },
  {
    id: '2',
    type: 'status_change',
    taskId: '1',
    taskTitle: 'Annual Report Cover Design',
    userName: 'Sarah Creative',
    userRole: 'designer',
    details: 'Changed status from Pending to In Progress',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: '3',
    type: 'comment',
    taskId: '3',
    taskTitle: 'Event Banner - Tech Conference',
    userName: 'Sarah Creative',
    userRole: 'designer',
    details: 'Added a comment requesting clarification',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    id: '4',
    type: 'file_upload',
    taskId: '5',
    taskTitle: 'Company Newsletter Template',
    userName: 'Sarah Creative',
    userRole: 'designer',
    details: 'Uploaded template_draft_v1.pdf',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
  {
    id: '5',
    type: 'status_change',
    taskId: '6',
    taskTitle: 'Product Launch Poster',
    userName: 'Sarah Creative',
    userRole: 'designer',
    details: 'Changed status to Completed',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: '6',
    type: 'approval',
    taskId: '6',
    taskTitle: 'Product Launch Poster',
    userName: 'Emily Finance',
    userRole: 'treasurer',
    details: 'Approved modification request',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
  },
];

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'created':
      return <FileText className="h-4 w-4" />;
    case 'status_change':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'comment':
      return <MessageSquare className="h-4 w-4" />;
    case 'file_upload':
      return <Upload className="h-4 w-4" />;
    case 'approval':
      return <CheckCircle2 className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getActivityColor = (type: ActivityItem['type']) => {
  switch (type) {
    case 'created':
      return 'bg-primary/10 text-primary';
    case 'status_change':
      return 'bg-status-progress/10 text-status-progress';
    case 'comment':
      return 'bg-status-pending/10 text-status-pending';
    case 'file_upload':
      return 'bg-accent/10 text-accent';
    case 'approval':
      return 'bg-status-completed/10 text-status-completed';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export default function Activity() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const activeRange = useMemo(
    () => getDateRange(dateRange, customStart, customEnd),
    [dateRange, customStart, customEnd]
  );

  const filteredActivity = useMemo(
    () => mockActivity.filter((activity) => isWithinRange(activity.timestamp, activeRange)),
    [activeRange]
  );

  // Group activities by date
  const groupedActivities = filteredActivity.reduce((acc, activity) => {
    const dateKey = format(activity.timestamp, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(activity);
    return acc;
  }, {} as Record<string, ActivityItem[]>);

  const sortedDates = Object.keys(groupedActivities).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
          <p className="text-muted-foreground mt-1">
            Track all actions and updates across the system
          </p>
        </div>

        <DateRangeFilter
          value={dateRange}
          onChange={setDateRange}
          startDate={customStart}
          endDate={customEnd}
          onStartDateChange={setCustomStart}
          onEndDateChange={setCustomEnd}
        />

        {/* Activity Timeline */}
        {sortedDates.length > 0 ? (
          <div className="space-y-8">
            {sortedDates.map((dateKey, dateIndex) => (
              <div key={dateKey} className="animate-slide-up" style={{ animationDelay: `${dateIndex * 100}ms` }}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-4 sticky top-0 bg-background py-2">
                  {format(new Date(dateKey), 'EEEE, MMMM d, yyyy')}
                </h2>
                <div className="space-y-4">
                  {groupedActivities[dateKey].map((activity) => (
                    <div
                      key={activity.id}
                      className="flex gap-4 bg-card border border-border rounded-xl p-4"
                    >
                      {/* Icon */}
                      <div
                        className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getActivityColor(
                          activity.type
                        )}`}
                      >
                        {getActivityIcon(activity.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {activity.details}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              on{' '}
                              <span className="font-medium text-foreground">
                                {activity.taskTitle}
                              </span>
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(activity.timestamp, 'h:mm a')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {activity.userName}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {activity.userRole}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-card rounded-2xl border border-border shadow-card">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium text-foreground">No activity found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different date range to see more updates.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
