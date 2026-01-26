import type { Task, User } from '@/types';

const normalizeValue = (value?: string) => (value ? String(value).trim().toLowerCase() : '');

const getAssignedToId = (task: Task) =>
  (task as { assignedTo?: string; assignedToId?: string }).assignedTo ||
  (task as { assignedToId?: string }).assignedToId ||
  '';

const isDesignerTask = (task: Task, user: User) => {
  const assignedId = getAssignedToId(task);
  if (assignedId && assignedId === user.id) return true;

  const assignedName = normalizeValue(task.assignedToName);
  const isUnassigned = !assignedId;
  if (isUnassigned) return true;

  const userName = normalizeValue(user.name);
  const userEmail = normalizeValue(user.email);
  const emailPrefix = userEmail.split('@')[0];

  if (
    assignedName &&
    userName &&
    (assignedName === userName ||
      assignedName.includes(userName) ||
      userName.includes(assignedName))
  ) {
    return true;
  }

  if (assignedName && emailPrefix && assignedName.includes(emailPrefix)) {
    return true;
  }

  return false;
};

export const isTaskVisibleToUser = (task: Task, user?: User | null) => {
  if (!user) return false;

  if (user.role === 'staff') {
    const requesterEmail = normalizeValue(task.requesterEmail || '');
    const userEmail = normalizeValue(user.email);
    const emailPrefix = userEmail.split('@')[0];
    const requesterName = normalizeValue(task.requesterName || '');
    const userName = normalizeValue(user.name);
    if (task.requesterId === user.id) return true;
    if (userEmail && requesterEmail === userEmail) return true;
    if (
      requesterName &&
      userName &&
      (requesterName === userName ||
        requesterName.includes(userName) ||
        userName.includes(requesterName))
    ) {
      return true;
    }
    if (requesterName && emailPrefix && requesterName.includes(emailPrefix)) return true;
    const history = Array.isArray(task.changeHistory) ? task.changeHistory : [];
    const createdEntry = history.find((entry) => entry?.field === 'created');
    if (createdEntry?.userId && createdEntry.userId === user.id) return true;
    const creatorName = normalizeValue(createdEntry?.userName);
    if (
      creatorName &&
      userName &&
      (creatorName === userName ||
        creatorName.includes(userName) ||
        userName.includes(creatorName))
    ) {
      return true;
    }
    if (creatorName && emailPrefix && creatorName.includes(emailPrefix)) return true;
    return false;
  }

  if (user.role === 'designer') {
    return isDesignerTask(task, user);
  }

  return true;
};

export const filterTasksForUser = (tasks: Task[], user?: User | null) =>
  user ? tasks.filter((task) => isTaskVisibleToUser(task, user)) : [];
