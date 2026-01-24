import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  dateFnsLocalizer,
  type Event as RBCEvent,
  type View,
  type ToolbarProps,
} from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Task as ScheduleTask } from '@/lib/designerSchedule';
import { buildScheduleFromTasks, getDefaultDesignerId } from '@/lib/designerSchedule';
import { API_URL } from '@/lib/api';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: {},
});

const priorityStyles: Record<ScheduleTask['priority'], { bg: string; border: string; text: string }> = {
  VIP: { bg: '#ef4444', border: '#dc2626', text: '#ffffff' },
  HIGH: { bg: '#f59e0b', border: '#d97706', text: '#0f172a' },
  NORMAL: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
};

type AvailabilityEvent = RBCEvent & {
  priority: ScheduleTask['priority'];
  taskId: string;
};

function AvailabilityToolbar({ label, onNavigate }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('PREV')}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('TODAY')}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onNavigate('NEXT')}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="text-sm font-semibold text-foreground">{label}</div>
    </div>
  );
}

export default function DesignerAvailability() {
  const apiUrl = API_URL;
  const [scheduleTasks, setScheduleTasks] = useState<ScheduleTask[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentView: View = 'month';

  useEffect(() => {
    if (!apiUrl) {
      setScheduleTasks([]);
      return;
    }
    let isActive = true;
    const loadSchedule = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/tasks`);
        if (!response.ok) {
          throw new Error('Failed to load tasks');
        }
        const data = await response.json();
        if (!isActive) return;
        setScheduleTasks(buildScheduleFromTasks(data));
      } catch {
        if (!isActive) return;
        setScheduleTasks([]);
      }
    };
    loadSchedule();
    return () => {
      isActive = false;
    };
  }, [apiUrl]);

  const designerId = useMemo(
    () => getDefaultDesignerId(scheduleTasks),
    [scheduleTasks]
  );

  const events = useMemo<AvailabilityEvent[]>(() => {
    return scheduleTasks
      .filter(
        (task) =>
          task.designerId === designerId &&
          task.status !== 'COMPLETED' &&
          task.status !== 'EMERGENCY_PENDING' &&
          task.actualStartDate &&
          task.actualEndDate
      )
      .sort((a, b) =>
        (a.actualStartDate?.getTime() ?? 0) - (b.actualStartDate?.getTime() ?? 0)
      )
      .map((task) => ({
        title: task.title,
        start: task.actualStartDate as Date,
        end: task.actualEndDate as Date,
        allDay: true,
        priority: task.priority,
        taskId: task.id,
      }));
  }, [designerId, scheduleTasks]);

  const eventPropGetter = (event: AvailabilityEvent) => {
    const style = priorityStyles[event.priority] || priorityStyles.NORMAL;
    return {
      style: {
        backgroundColor: style.bg,
        borderColor: style.border,
        color: style.text,
        borderRadius: '10px',
        padding: '2px 10px',
        boxShadow: '0 10px 22px -18px rgba(15, 23, 42, 0.45)',
      },
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground">
            Designer Availability
          </h1>
          <p className="text-muted-foreground mt-1">
            Review upcoming capacity and delivery windows
          </p>
        </div>

        <div className="rounded-2xl border border-[#D9E6FF] bg-white/70 backdrop-blur-xl p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Delivery schedule
              </p>
              <h2 className="text-lg font-semibold text-foreground">
                Designer availability calendar
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Requested deadlines are estimates. Actual starts follow availability.
              </p>
            </div>
            <Badge
              variant="outline"
              className="h-fit text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
            >
              Delivery Mode
            </Badge>
          </div>

          <div className="mt-5 availability-calendar">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              date={currentDate}
              onNavigate={setCurrentDate}
              view={currentView}
              views={{ month: true }}
              components={{
                toolbar: AvailabilityToolbar,
              }}
              eventPropGetter={eventPropGetter}
              popup
              className="availability-calendar__root"
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
