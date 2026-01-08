// SYSTEM TRUTH: Staff-selected deadline is NOT fixed. Designer availability decides actual start.
// Tasks auto-shift earlier if a designer finishes early. Future-booked tasks auto-start when free.
// This system behaves like delivery tracking: delivery dates are estimates, dispatch starts when resources are free.
import { addDays, startOfDay } from 'date-fns';

export type Task = {
  id: string;
  title: string;
  designerId: string;
  requestedDeadline?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  estimatedDays: number;
  priority: 'VIP' | 'HIGH' | 'NORMAL';
  status: 'QUEUED' | 'WORK_STARTED' | 'COMPLETED' | 'EMERGENCY_PENDING';
  createdAt: Date;
};

export const DEFAULT_ESTIMATED_DAYS = 3;
export const DEFAULT_DESIGNER_ID = 'designer-1';

const STORAGE_KEY = 'designhub.schedule.tasks';
const REQUESTS_KEY = 'designhub.schedule.requests';
export const SCHEDULE_NOTIFICATIONS_PREFIX = 'designhub.schedule.notifications.';

const normalizeDate = (value: Date) => startOfDay(value);
const createScheduleId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `task_${Math.random().toString(36).slice(2, 10)}`;

const isSchedulableStatus = (status: Task['status']) =>
  status !== 'COMPLETED' && status !== 'EMERGENCY_PENDING';

const hydrateTask = (raw: Task) => ({
  ...raw,
  requestedDeadline: raw.requestedDeadline
    ? new Date(raw.requestedDeadline)
    : undefined,
  actualStartDate: raw.actualStartDate ? new Date(raw.actualStartDate) : undefined,
  actualEndDate: raw.actualEndDate ? new Date(raw.actualEndDate) : undefined,
  createdAt: new Date(raw.createdAt),
});

type ScheduleRequester = {
  taskId: string;
  requesterId: string;
  requesterName: string;
};

export type ScheduleNotification = {
  id: string;
  taskId: string;
  message: string;
  createdAt: Date;
};

const getNotificationKey = (userId: string) =>
  `${SCHEDULE_NOTIFICATIONS_PREFIX}${userId}`;

const loadJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
};

const saveJson = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const getDefaultDesignerId = (tasks: Task[]) =>
  tasks.find((task) => task.designerId)?.designerId ?? DEFAULT_DESIGNER_ID;

export const rescheduleDesignerTasks = (allTasks: Task[], designerId: string) => {
  const nextTasks = allTasks.map((task) => ({ ...task }));
  const pending = nextTasks
    .filter(
      (task) =>
        task.designerId === designerId && isSchedulableStatus(task.status)
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  let cursor = normalizeDate(new Date());

  for (const task of pending) {
    const duration = Math.max(task.estimatedDays || DEFAULT_ESTIMATED_DAYS, 1);
    task.actualStartDate = cursor;
    task.actualEndDate = addDays(cursor, duration - 1);

    if (task.status === 'QUEUED' && cursor.getTime() <= Date.now()) {
      task.status = 'WORK_STARTED';
    }

    cursor = addDays(task.actualEndDate, 1);
  }

  return nextTasks;
};

export const rescheduleAllDesigners = (allTasks: Task[]) => {
  const designerIds = Array.from(
    new Set(allTasks.map((task) => task.designerId))
  );
  return designerIds.reduce(
    (tasks, designerId) => rescheduleDesignerTasks(tasks, designerId),
    allTasks
  );
};

export const assignTask = (
  allTasks: Task[],
  designerId: string,
  title: string,
  deadline?: Date,
  priority: Task['priority'] = 'NORMAL',
  estimatedDays: number = DEFAULT_ESTIMATED_DAYS
) => {
  const nextTasks = [
    ...allTasks,
    {
      id: createScheduleId(),
      title,
      designerId,
      requestedDeadline: deadline ? normalizeDate(deadline) : undefined,
      estimatedDays,
      priority,
      status: 'QUEUED',
      createdAt: new Date(),
    },
  ];

  return rescheduleDesignerTasks(nextTasks, designerId);
};

export const assignEmergencyTask = (
  allTasks: Task[],
  designerId: string,
  title: string,
  deadline?: Date
) => [
  ...allTasks,
  {
    id: createScheduleId(),
    title,
    designerId,
    requestedDeadline: deadline ? normalizeDate(deadline) : undefined,
    estimatedDays: DEFAULT_ESTIMATED_DAYS,
    priority: 'VIP',
    status: 'EMERGENCY_PENDING',
    createdAt: new Date(),
  },
];

export const approveEmergencyTask = (allTasks: Task[], taskId: string) => {
  const task = allTasks.find((entry) => entry.id === taskId);
  if (!task) return allTasks;
  const updated = allTasks.map((entry) =>
    entry.id === taskId ? { ...entry, status: 'QUEUED' } : entry
  );
  return rescheduleDesignerTasks(updated, task.designerId);
};

export const completeTask = (allTasks: Task[], taskId: string) => {
  const task = allTasks.find((entry) => entry.id === taskId);
  if (!task) return allTasks;
  const updated = allTasks.map((entry) =>
    entry.id === taskId
      ? {
          ...entry,
          status: 'COMPLETED',
          actualEndDate: normalizeDate(new Date()),
        }
      : entry
  );
  return rescheduleDesignerTasks(updated, task.designerId);
};

export const buildInvalidRanges = (tasks: Task[], designerId: string) =>
  tasks
    .filter(
      (task) =>
        task.designerId === designerId &&
        task.actualStartDate &&
        task.actualEndDate &&
        task.status !== 'COMPLETED' &&
        task.status !== 'EMERGENCY_PENDING'
    )
    .map((task) => ({
      start: task.actualStartDate as Date,
      end: task.actualEndDate as Date,
      title: task.title,
    }));

export const recordScheduleRequest = (
  taskId: string,
  requesterId: string,
  requesterName: string
) => {
  const existing = loadJson<Record<string, ScheduleRequester>>(REQUESTS_KEY, {});
  const next = {
    ...existing,
    [taskId]: { taskId, requesterId, requesterName },
  };
  saveJson(REQUESTS_KEY, next);
};

export const getScheduleRequester = (taskId: string) => {
  const existing = loadJson<Record<string, ScheduleRequester>>(REQUESTS_KEY, {});
  return existing[taskId];
};

export const pushScheduleNotification = (
  userId: string,
  taskId: string,
  message: string
) => {
  const key = getNotificationKey(userId);
  const existing = loadJson<ScheduleNotification[]>(key, []);
  const next = [
    {
      id: createScheduleId(),
      taskId,
      message,
      createdAt: new Date(),
    },
    ...existing,
  ].slice(0, 20);
  saveJson(key, next);
};

export const loadScheduleNotifications = (userId: string) => {
  const key = getNotificationKey(userId);
  const existing = loadJson<ScheduleNotification[]>(key, []);
  return existing.map((note) => ({ ...note, createdAt: new Date(note.createdAt) }));
};

export const clearScheduleNotifications = (userId: string) => {
  const key = getNotificationKey(userId);
  saveJson(key, []);
};

export const toMobiscrollEvents = (tasks: Task[]) =>
  tasks
    .filter(
      (task) =>
        task.actualStartDate &&
        task.actualEndDate &&
        task.status !== 'EMERGENCY_PENDING'
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      start: task.actualStartDate as Date,
      end: addDays(task.actualEndDate as Date, 1),
      color:
        task.priority === 'VIP'
          ? '#ef4444'
          : task.priority === 'HIGH'
            ? '#f59e0b'
            : '#3b82f6',
    }));

export const loadScheduleTasks = (fallback: Task[] = []) => {
  if (typeof window === 'undefined') {
    return rescheduleAllDesigners(fallback);
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return rescheduleAllDesigners(fallback);
  }
  try {
    const parsed = JSON.parse(stored) as Task[];
    return rescheduleAllDesigners(parsed.map(hydrateTask));
  } catch {
    return rescheduleAllDesigners(fallback);
  }
};

export const saveScheduleTasks = (tasks: Task[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
};
