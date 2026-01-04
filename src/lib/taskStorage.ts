import type { Task } from '@/types';

const TASK_LIST_KEY = 'designhub.task.list';
const TASK_ITEM_PREFIX = 'designhub.task.';

const canUseStorage = () => typeof window !== 'undefined';

const safeParse = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const toDate = (value?: string | Date) => (value ? new Date(value) : undefined);

const hydrateTask = (raw: Task): Task => ({
  ...raw,
  deadline: new Date(raw.deadline),
  createdAt: new Date(raw.createdAt),
  updatedAt: new Date(raw.updatedAt),
  proposedDeadline: toDate(raw.proposedDeadline),
  deadlineApprovedAt: toDate(raw.deadlineApprovedAt),
  approvalDate: toDate(raw.approvalDate),
  emergencyApprovedAt: toDate(raw.emergencyApprovedAt),
  emergencyRequestedAt: toDate(raw.emergencyRequestedAt),
  files: raw.files?.map((file) => ({
    ...file,
    uploadedAt: new Date(file.uploadedAt),
  })) ?? [],
  designVersions: raw.designVersions?.map((version) => ({
    ...version,
    uploadedAt: new Date(version.uploadedAt),
  })) ?? [],
  comments: raw.comments?.map((comment) => ({
    ...comment,
    createdAt: new Date(comment.createdAt),
    seenBy: comment.seenBy?.map((entry) => ({
      ...entry,
      seenAt: new Date(entry.seenAt),
    })) ?? [],
  })) ?? [],
  changeHistory: raw.changeHistory?.map((entry) => ({
    ...entry,
    createdAt: new Date(entry.createdAt),
  })) ?? [],
});

export const loadLocalTaskList = (): Task[] => {
  if (!canUseStorage()) return [];
  const stored = window.localStorage.getItem(TASK_LIST_KEY);
  if (!stored) return [];
  const parsed = safeParse<Task[]>(stored);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(hydrateTask);
};

export const saveLocalTaskList = (tasks: Task[]) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TASK_LIST_KEY, JSON.stringify(tasks));
};

export const upsertLocalTask = (task: Task) => {
  if (!canUseStorage()) return;
  const list = loadLocalTaskList();
  const next = [task, ...list.filter((item) => item.id !== task.id)];
  saveLocalTaskList(next);
  window.localStorage.setItem(`${TASK_ITEM_PREFIX}${task.id}`, JSON.stringify(task));
};

export const loadLocalTaskById = (taskId: string): Task | undefined => {
  if (!canUseStorage()) return undefined;
  const direct = window.localStorage.getItem(`${TASK_ITEM_PREFIX}${taskId}`);
  if (direct) {
    const parsed = safeParse<Task>(direct);
    return parsed ? hydrateTask(parsed) : undefined;
  }
  const list = loadLocalTaskList();
  return list.find((task) => task.id === taskId);
};

export const applyTaskOverrides = (tasks: Task[]): Task[] => {
  if (!canUseStorage()) return tasks;
  return tasks.map((task) => {
    const stored = window.localStorage.getItem(`${TASK_ITEM_PREFIX}${task.id}`);
    if (!stored) return task;
    const parsed = safeParse<Task>(stored);
    return parsed ? hydrateTask(parsed) : task;
  });
};

export const mergeLocalTasks = (baseTasks: Task[]): Task[] => {
  if (!canUseStorage()) return baseTasks;
  const stored = loadLocalTaskList();
  if (stored.length === 0) {
    return applyTaskOverrides(baseTasks);
  }
  const map = new Map(baseTasks.map((task) => [task.id, task]));
  stored.forEach((task) => map.set(task.id, task));
  return applyTaskOverrides(Array.from(map.values()));
};
