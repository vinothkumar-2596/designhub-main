import type { Task, User } from '@/types';
import { isMainDesigner } from '@/lib/designerAccess';

const normalizeValue = (value?: string) => (value ? String(value).trim().toLowerCase() : '');
const assignmentMetaFields = new Set(['assigned_designer', 'task_status', 'cc_emails']);
const emptyAssignmentValues = new Set(['', 'null', 'undefined', 'none', 'na', 'n/a', 'unassigned', 'false']);
const looksLikeObjectId = (value: string) => /^[a-f0-9]{24}$/i.test(value);
const looksLikeEmail = (value: string) => value.includes('@');

const normalizeAssignmentRef = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (emptyAssignmentValues.has(normalized.toLowerCase())) return '';
  return normalized;
};

const getAssignedToId = (task: Task) => {
  const assignedToId = normalizeAssignmentRef((task as { assignedToId?: string }).assignedToId);
  if (assignedToId) return assignedToId;
  const legacyAssigned = normalizeAssignmentRef((task as { assignedTo?: string }).assignedTo);
  if (!legacyAssigned) return '';
  // Ignore legacy name-like values that were stored in assignedTo.
  if (looksLikeObjectId(legacyAssigned) || looksLikeEmail(legacyAssigned)) {
    return legacyAssigned;
  }
  return '';
};

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

const isStaffTaskOwnerOrCreator = (task: Task, user: User) => {
  const userEmail = normalizeValue(user.email);
  const emailPrefix = userEmail.split('@')[0];
  const requesterName = normalizeValue(task.requesterName || '');
  const userName = normalizeValue(user.name);

  if (task.requesterId === user.id) return true;
  if (userEmail && normalizeValue(task.requesterEmail || '') === userEmail) return true;
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
};

const isDesignerTask = (task: Task, user: User, allowUnassigned: boolean) => {
  const assignedId = getAssignedToId(task);
  if (assignedId && assignedId === user.id) return true;
  if (assignedId && looksLikeEmail(assignedId) && normalizeValue(assignedId) === normalizeValue(user.email)) {
    return true;
  }

  const assignedName = normalizeValue(task.assignedToName);
  const isUnassigned = !assignedId;
  if (isUnassigned) return allowUnassigned;

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
  const userIsMainDesigner = userRole === 'designer' && isMainDesigner(user);
  const assignedId = getAssignedToId(task);
  const ccEmails = getTaskCcEmails(task);
  const taskUsesAssignedAccess = hasAssignmentMetadata(task);

  if (userRole === 'treasurer' || userRole === 'admin' || userRole === 'manager') {
    return true;
  }

  if (taskUsesAssignedAccess) {
    if (userRole === 'staff' && isStaffTaskOwnerOrCreator(task, user)) return true;
    if (userRole === 'designer' && userIsMainDesigner && !assignedId) return true;
    if (assignedId && assignedId === user.id) return true;
    if (
      assignedId &&
      looksLikeEmail(assignedId) &&
      normalizeValue(assignedId) === normalizeValue(user.email)
    ) {
      return true;
    }
    if (userRole === 'designer' && !userIsMainDesigner) return false;
    if (userEmail && ccEmails.includes(userEmail)) return true;
    if (isTaskAssignedByUser(task, user)) return true;
    if (userRole === 'designer' && userIsMainDesigner) return true;
    return false;
  }

  if (userRole === 'staff') {
    return isStaffTaskOwnerOrCreator(task, user);
  }

  if (userRole === 'designer') {
    return isDesignerTask(task, user, userIsMainDesigner);
  }

  return true;
};

export const filterTasksForUser = (tasks: Task[], user?: User | null) =>
  user ? tasks.filter((task) => isTaskVisibleToUser(task, user)) : [];
