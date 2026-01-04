import { addDays, startOfDay } from 'date-fns';
import type { Task } from '@/lib/designerSchedule';
import { DEFAULT_ESTIMATED_DAYS } from '@/lib/designerSchedule';

const today = startOfDay(new Date());
const daysFromToday = (days: number) => addDays(today, days);

export const seedScheduleTasks: Task[] = [
  {
    id: 'sched-001',
    title: 'Launch Poster Refresh',
    designerId: 'designer-1',
    requestedDeadline: daysFromToday(7),
    estimatedDays: DEFAULT_ESTIMATED_DAYS,
    priority: 'HIGH',
    status: 'QUEUED',
    createdAt: daysFromToday(-6),
  },
  {
    id: 'sched-002',
    title: 'Student Orientation Brochure',
    designerId: 'designer-1',
    requestedDeadline: daysFromToday(10),
    estimatedDays: 4,
    priority: 'NORMAL',
    status: 'QUEUED',
    createdAt: daysFromToday(-4),
  },
  {
    id: 'sched-003',
    title: 'Emergency Event Backdrop',
    designerId: 'designer-1',
    requestedDeadline: daysFromToday(2),
    estimatedDays: 2,
    priority: 'VIP',
    status: 'EMERGENCY_PENDING',
    createdAt: daysFromToday(-1),
  },
];
