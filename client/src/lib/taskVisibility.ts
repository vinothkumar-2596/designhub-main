import type { Task, User } from '@/types';

const normalizeValue = (value?: string) => (value ? String(value).trim().toLowerCase() : '');
const assignmentMetaFields = new Set(['assigned_designer', 'task_status', 'cc_emails']);

const getAssignedToId = (task: Task) =>
  (task as { assignedTo?: string; assignedToId?: string }).assignedTo ||
  (task as { assignedToId?: string }).assignedToId ||
  '';

const parseCcEmails = (value: string) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return Array.from(new Set(parsed.map((entry) => normalizeValue(String(entry))).filter(Boolean)));
    }
  } catch {
    // Fallback to delimiter parsing.
  }
  return Array.from(
    new Set(
      value
        .split(/[,\n;]/g)
        .map((entry) => normalizeValue(entry))
        .filter(Boolean)
    )
  );
};

const getTaskCcEmails = (task: Task) => {
  const directCc =
    (task as { ccEmails?: string[]; cc_emails?: string[] }).ccEmails ||
    (task as { cc_emails?: string[] }).cc_emails ||
    [];
  if (Array.isArray(directCc) && directCc.length > 0) {
    return Array.from(new Set(directCc.map((entry) => normalizeValue(entry)).filter(Boolean)));
  }
  const history = Array.isArray(task.changeHistory) ? task.changeHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizeValue(entry?.field) !== 'cc_emails') continue;
    return parseCcEmails(String(entry?.newValue || ''));
  }
  return [];
};

const hasAssignmentMetadata = (task: Task) => {
  const history = Array.isArray(task.changeHistory) ? task.changeHistory : [];
  if (history.some((entry) => assignmentMetaFields.has(normalizeValue(entry?.field)))) {
    return true;
  }
  const rawTask = task as { ccEmails?: string[]; cc_emails?: string[] };
  return Array.isArray(rawTask.ccEmails) || Array.isArray(rawTask.cc_emails);
};

const isTaskAssignedByUser = (task: Task, user: User) => {
  const userId = String(user.id || '');
  const userEmail = normalizeValue(user.email);
  if (!userId && !userEmail) return false;
  const history = Array.isArray(task.changeHistory) ? task.changeHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizeValue(entry?.field) !== 'assigned_designer') continue;
    const assignerId = String(entry?.userId || '');
    if (userId && assignerId && userId === assignerId) return true;
    const assignerEmail = normalizeValue(entry?.userName);
    if (userEmail && assignerEmail && userEmail === assignerEmail) return true;
    return false;
  }
  return false;
};

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
  const userRole = normalizeValue(user.role);
  const userEmail = normalizeValue(user.email);
  const assignedId = getAssignedToId(task);
  const ccEmails = getTaskCcEmails(task);
  const taskUsesAssignedAccess = hasAssignmentMetadata(task);

  if (userRole === 'treasurer' || userRole === 'admin' || userRole === 'manager') {
    return true;
  }

  if (taskUsesAssignedAccess) {
    if (assignedId && assignedId === user.id) return true;
    if (userEmail && ccEmails.includes(userEmail)) return true;
    if (isTaskAssignedByUser(task, user)) return true;
    return false;
  }

  if (userRole === 'staff') {
    const requesterEmail = normalizeValue(task.requesterEmail || '');
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

  if (userRole === 'designer') {
    return isDesignerTask(task, user);
  }

  return true;
};

export const filterTasksForUser = (tasks: Task[], user?: User | null) =>
  user ? tasks.filter((task) => isTaskVisibleToUser(task, user)) : [];
