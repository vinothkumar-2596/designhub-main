import express from "express";
import Task from "../models/Task.js";
import mongoose from "mongoose";
import { getDriveClient } from "../lib/drive.js";
import Activity from "../models/Activity.js";
import User from "../models/User.js";
import {
  sendFinalFilesEmail,
  sendFinalFilesSms,
  sendTaskCreatedSms,
  sendCommentNotificationSms,
  sendStatusUpdateSms,
  sendSms,
} from "../lib/notifications.js";
import {
  createNotification,
  createNotificationsForUsers,
} from "../lib/notificationService.js";
import { getSocket } from "../socket.js";
import { requireRole } from "../middleware/auth.js";
import { globalLimiter } from "../middleware/rateLimit.js";
import {
  buildDesignerPortalId,
  getDesignerScope,
  hasMainDesignerConfig,
  isMainDesignerUser,
} from "../lib/designerAccess.js";

const router = express.Router();
const TASK_ROLES = ["staff", "designer", "treasurer", "admin", "other", "manager"];
router.use(requireRole(TASK_ROLES));

const getUserId = (req) => (req.user?._id ? req.user._id.toString() : "");
const normalizeValue = (value) => (value ? String(value).trim().toLowerCase() : "");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EMPTY_ID_VALUES = new Set([
  "",
  "null",
  "undefined",
  "none",
  "na",
  "n/a",
  "unassigned",
  "false"
]);
const normalizeId = (value) => {
  if (value === undefined || value === null) return "";
  const normalized = String(value).trim();
  if (!normalized) return "";
  if (EMPTY_ID_VALUES.has(normalized.toLowerCase())) return "";
  return normalized;
};
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const isObjectIdLike = (value) => mongoose.Types.ObjectId.isValid(String(value || ""));
const resolveAssignedIdentifier = (task) => {
  const assignedToId = normalizeId(task?.assignedToId);
  if (assignedToId) return assignedToId;
  const legacyAssigned = normalizeId(task?.assignedTo);
  if (!legacyAssigned) return "";
  // Ignore legacy name-like values carried in old assignedTo fields.
  if (isObjectIdLike(legacyAssigned) || EMAIL_REGEX.test(legacyAssigned)) {
    return legacyAssigned;
  }
  return "";
};
const normalizeEmailList = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => normalizeValue(entry))
        .filter(Boolean)
    )
  );
};
const toObjectId = (value) => {
  if (!value) return null;
  const raw = String(value);
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};
const buildTaskLink = (taskId) => (taskId ? `/task/${taskId}` : "");
const ASSIGNMENT_META_FIELDS = new Set([
  "assigned_designer",
  "task_status",
  "cc_emails"
]);
const defaultNotificationPreferences = {
  emailNotifications: true,
  whatsappNotifications: false,
  deadlineReminders: true,
};

const emitNotification = (notification) => {
  if (!notification) return;
  const io = getSocket();
  if (!io) return;
  const data = typeof notification.toJSON === "function" ? notification.toJSON() : notification;
  if (!data?.userId) return;
  io.to(String(data.userId)).emit("notification:new", data);
};

const emitNotifications = (notifications) => {
  if (!Array.isArray(notifications)) return;
  notifications.forEach((note) => emitNotification(note));
};

const getUserIdsByRole = async (roles = []) => {
  if (!roles.length) return [];
  const users = await User.find({
    role: { $in: roles },
    isActive: { $ne: false }
  }).select("_id");
  return users.map((user) => user._id.toString());
};

const getActiveDesignerUsers = async () =>
  User.find({
    role: "designer",
    isActive: { $ne: false }
  })
    .sort({ name: 1, email: 1 })
    .select("_id name email role");

const splitDesignersByScope = (designers = []) => {
  const mainDesigners = [];
  const juniorDesigners = [];
  designers.forEach((designer) => {
    if (getDesignerScope(designer) === "main") {
      mainDesigners.push(designer);
      return;
    }
    juniorDesigners.push(designer);
  });
  return { mainDesigners, juniorDesigners };
};

const getQueueDesignerUserIds = async () => {
  const designers = await getActiveDesignerUsers();
  if (!hasMainDesignerConfig()) {
    return designers.map((designer) => designer._id?.toString?.() || "").filter(Boolean);
  }
  const { mainDesigners } = splitDesignersByScope(designers);
  return mainDesigners.map((designer) => designer._id?.toString?.() || "").filter(Boolean);
};

const resolveUserIdByEmail = async (email) => {
  const normalized = normalizeValue(email);
  if (!normalized) return "";
  const user = await User.findOne({ email: normalized });
  return user?._id?.toString?.() || "";
};

const resolveNotificationPreferences = async ({ userId, email, fallbackUser }) => {
  if (fallbackUser && userId) {
    const fallbackId =
      typeof fallbackUser._id === "string"
        ? fallbackUser._id
        : fallbackUser._id?.toString?.();
    if (fallbackId && fallbackId === userId) {
      return { ...defaultNotificationPreferences, ...(fallbackUser.notificationPreferences || {}) };
    }
  }
  let user = null;
  if (userId) {
    user = await User.findById(userId).select("notificationPreferences");
  } else if (email) {
    const normalized = normalizeValue(email);
    if (normalized) {
      user = await User.findOne({ email: normalized }).select("notificationPreferences");
    }
  }
  return { ...defaultNotificationPreferences, ...(user?.notificationPreferences || {}) };
};

const normalizeAssignedName = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  return raw.replace(/\(.*?\)/g, "").trim();
};

const mapOutputFileToFinal = (file) => ({
  name: file?.name || "",
  url: file?.url || "",
  size: typeof file?.size === "number" ? file.size : undefined,
  mime: file?.mime || "",
  thumbnailUrl: file?.thumbnailUrl || "",
  uploadedAt: file?.uploadedAt || new Date(),
  uploadedBy: file?.uploadedBy || ""
});

const buildLegacyFinalVersion = (task) => {
  const files = Array.isArray(task?.files)
    ? task.files.filter((file) => file?.type === "output")
    : [];
  if (files.length === 0) return null;
  const uploadedAt =
    files.find((file) => file?.uploadedAt)?.uploadedAt ||
    task.updatedAt ||
    task.createdAt ||
    new Date();
  const uploadedBy =
    files.find((file) => file?.uploadedBy)?.uploadedBy || task.assignedToId || "";
  return {
    version: 1,
    uploadedAt,
    uploadedBy,
    note: "",
    files: files.map(mapOutputFileToFinal)
  };
};

const normalizeFinalDeliverableVersions = (task) => {
  const versions = Array.isArray(task?.finalDeliverableVersions)
    ? task.finalDeliverableVersions
    : [];
  if (versions.length > 0) {
    return versions.slice().sort((a, b) => (b.version || 0) - (a.version || 0));
  }
  const legacy = buildLegacyFinalVersion(task);
  return legacy ? [legacy] : [];
};

const ensureFinalDeliverableVersions = async (task) => {
  if (!task) return task;
  const existing = Array.isArray(task.finalDeliverableVersions)
    ? task.finalDeliverableVersions
    : [];
  if (existing.length > 0) return task;
  const legacy = buildLegacyFinalVersion(task);
  if (!legacy) return task;
  task.finalDeliverableVersions = [legacy];
  task.markModified("finalDeliverableVersions");
  await task.save();
  return task;
};

const resolveAssignedUser = async ({
  assignedToId,
  assignedTo,
  assignedToName,
  assignedToEmail
} = {}) => {
  let resolvedId = assignedToId || assignedTo || "";
  let resolvedName = assignedToName || "";
  const cleanedName = normalizeAssignedName(resolvedName);
  const normalizedEmail = normalizeValue(assignedToEmail);
  let user = null;

  if (!resolvedId && normalizedEmail) {
    resolvedId = await resolveUserIdByEmail(normalizedEmail);
  }

  if (resolvedId) {
    user = await User.findById(resolvedId).select("_id name email role isActive");
  }

  if (!user && normalizedEmail) {
    user = await User.findOne({
      email: normalizedEmail,
      role: "designer",
      isActive: { $ne: false }
    }).select("_id name email role isActive");
  }

  if (!user && cleanedName) {
    user = await User.findOne({
      name: new RegExp(`^${escapeRegExp(cleanedName)}$`, "i"),
      role: "designer",
      isActive: { $ne: false }
    }).select("_id name email role isActive");
  }

  if (user) {
    resolvedId = resolvedId || user._id?.toString?.() || "";
    if (user.name) {
      resolvedName = user.name;
    } else if (!resolvedName && user.email) {
      resolvedName = user.email.split("@")[0] || "";
    }
  } else if (!resolvedName && cleanedName) {
    resolvedName = cleanedName;
  }

  return {
    assignedToId: resolvedId || "",
    assignedToName: resolvedName || ""
  };
};

const isManagerRole = (role) =>
  ["manager", "treasurer", "admin"].includes(normalizeValue(role));

const normalizeTaskRole = (role) => {
  const normalizedRole = normalizeValue(role);
  if (normalizedRole === "other") return "staff";
  if (normalizedRole === "manager") return "treasurer";
  return normalizedRole;
};

const getLatestChangeValue = (task, fieldName) => {
  const targetField = normalizeValue(fieldName);
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizeValue(entry?.field) === targetField) {
      return String(entry?.newValue || "").trim();
    }
  }
  return "";
};

const parseAssignmentCcEmails = (rawValue) => {
  if (!rawValue) return [];
  const text = String(rawValue).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return normalizeEmailList(parsed);
    }
  } catch {
    // Fall through to delimited parsing.
  }
  return normalizeEmailList(text.split(/[,\n;]/g));
};

const extractTaskCcEmails = (task) => {
  const taskData = typeof task?.toObject === "function" ? task.toObject() : task || {};
  const directCc = normalizeEmailList(taskData?.cc_emails || taskData?.ccEmails || []);
  if (directCc.length > 0) return directCc;
  const rawFromHistory = getLatestChangeValue(task, "cc_emails");
  return parseAssignmentCcEmails(rawFromHistory);
};

const hasAssignedDesignerAccessMetadata = (task) => {
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  if (history.some((entry) => ASSIGNMENT_META_FIELDS.has(normalizeValue(entry?.field)))) {
    return true;
  }
  const taskData = typeof task?.toObject === "function" ? task.toObject() : task || {};
  return (
    Array.isArray(taskData?.cc_emails) ||
    Array.isArray(taskData?.ccEmails)
  );
};

const isTaskAssignedByUser = (task, user) => {
  if (!user) return false;
  const userId = normalizeId(user._id?.toString?.() || user._id);
  const userEmail = normalizeValue(user.email);
  if (!userId && !userEmail) return false;
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizeValue(entry?.field) !== "assigned_designer") continue;
    const assignerId = normalizeId(entry?.userId);
    if (userId && assignerId && userId === assignerId) return true;
    const assignerEmail = normalizeValue(entry?.userName);
    if (userEmail && assignerEmail && userEmail === assignerEmail) return true;
    return false;
  }
  return false;
};

const resolveAssignedDesignerEmail = async (task) => {
  const assignedId = resolveAssignedIdentifier(task);
  if (assignedId) {
    if (EMAIL_REGEX.test(assignedId)) {
      return normalizeValue(assignedId);
    }
    if (isObjectIdLike(assignedId)) {
      const assignedUser = await User.findById(assignedId).select("email");
      const assignedEmail = normalizeValue(assignedUser?.email);
      if (EMAIL_REGEX.test(assignedEmail)) {
        return assignedEmail;
      }
    }
  }
  const assignedName = normalizeValue(task?.assignedToName);
  if (EMAIL_REGEX.test(assignedName)) {
    return assignedName;
  }
  const rawAssigned = normalizeValue(getLatestChangeValue(task, "assigned_designer"));
  if (EMAIL_REGEX.test(rawAssigned)) {
    return rawAssigned;
  }
  return "";
};

const isTaskEffectivelyUnassigned = async (task) => {
  const assignedId = normalizeId(task?.assignedToId);
  if (!assignedId) return true;
  if (EMAIL_REGEX.test(assignedId)) {
    const assignedEmail = normalizeValue(assignedId);
    const assignedUser = await User.findOne({ email: assignedEmail }).select("role isActive");
    const assignedRole = normalizeTaskRole(assignedUser?.role);
    return !assignedUser || assignedUser.isActive === false || assignedRole !== "designer";
  }
  if (!isObjectIdLike(assignedId)) {
    return true;
  }
  const assignedUser = await User.findById(assignedId).select("role isActive");
  const assignedRole = normalizeTaskRole(assignedUser?.role);
  return !assignedUser || assignedUser.isActive === false || assignedRole !== "designer";
};

const resolveTaskAccessContext = async (task, user) => {
  const fallback = {
    mode: "none",
    assignedDesignerEmail: "",
    ccEmails: []
  };
  if (!user) return fallback;
  const userRole = normalizeTaskRole(user.role);
  const isMainDesigner = userRole === "designer" && isMainDesignerUser(user);
  const userId = normalizeId(user._id?.toString?.() || user._id);
  const userEmail = normalizeValue(user.email);
  const ccEmails = extractTaskCcEmails(task);
  const assignedDesignerEmail = await resolveAssignedDesignerEmail(task);
  const assignedId = resolveAssignedIdentifier(task);
  let effectiveAssignedId = assignedId;
  if (effectiveAssignedId && isObjectIdLike(effectiveAssignedId)) {
    const assignedUser = await User.findById(effectiveAssignedId).select("role isActive");
    const assignedRole = normalizeTaskRole(assignedUser?.role);
    if (!assignedUser || assignedUser.isActive === false || assignedRole !== "designer") {
      effectiveAssignedId = "";
    }
  }
  if (isManagerRole(userRole)) {
    return {
      mode: "view_only",
      assignedDesignerEmail,
      ccEmails
    };
  }
  const hasPrimaryTaskAccess = canAccessTask(task, user);

  // Authenticated users who already own/are assigned to the task should keep full access.
  if (hasPrimaryTaskAccess) {
    return {
      mode: "full",
      assignedDesignerEmail,
      ccEmails
    };
  }
  // Designers can work from the unassigned queue and self-assign via change updates.
  if (userRole === "designer" && isMainDesigner && !effectiveAssignedId) {
    return {
      mode: "full",
      assignedDesignerEmail: userEmail || assignedDesignerEmail,
      ccEmails
    };
  }
  if (effectiveAssignedId && userId && effectiveAssignedId === userId) {
    return {
      mode: "full",
      assignedDesignerEmail: userEmail || assignedDesignerEmail,
      ccEmails
    };
  }
  if (userEmail && assignedDesignerEmail && userEmail === assignedDesignerEmail) {
    return {
      mode: "full",
      assignedDesignerEmail,
      ccEmails
    };
  }
  // Junior designers can access only the tasks explicitly assigned to them.
  if (userRole === "designer" && !isMainDesigner) {
    return fallback;
  }
  if (userEmail && ccEmails.includes(userEmail)) {
    return {
      mode: "view_only",
      assignedDesignerEmail,
      ccEmails
    };
  }
  if (isTaskAssignedByUser(task, user)) {
    return {
      mode: "view_only",
      assignedDesignerEmail,
      ccEmails
    };
  }
  return {
    mode: "view_only",
    assignedDesignerEmail,
    ccEmails
  };
};

const findLatestAssignmentEntry = (task) => {
  const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (normalizeValue(entry?.field) === "assigned_designer") {
      return entry;
    }
  }
  return null;
};

const resolveAssignmentManagerRecipient = async (task) => {
  const assignmentEntry = findLatestAssignmentEntry(task);
  if (!assignmentEntry) return null;
  const assignedByUserId = normalizeId(assignmentEntry.userId);
  if (assignedByUserId) {
    const managerUser = await User.findById(assignedByUserId)
      .select("_id name email role isActive");
    const managerEmail = normalizeValue(managerUser?.email);
    if (managerUser && managerUser.isActive !== false && EMAIL_REGEX.test(managerEmail)) {
      return {
        id: managerUser._id?.toString?.() || assignedByUserId,
        name: managerUser.name || managerEmail.split("@")[0] || "Manager",
        email: managerEmail
      };
    }
  }
  const fallbackEmail = normalizeValue(assignmentEntry?.userName);
  if (EMAIL_REGEX.test(fallbackEmail)) {
    return {
      id: "",
      name: fallbackEmail.split("@")[0] || "Manager",
      email: fallbackEmail
    };
  }
  return null;
};

const canAccessTask = (task, user) => {
  if (!user) return false;
  const userRole = normalizeTaskRole(user.role);
  if (userRole === "admin" || userRole === "treasurer") return true;
  const userId = user._id?.toString?.() || user._id;
  if (userRole === "staff") {
    const userEmail = normalizeValue(user.email);
    const requesterEmail = normalizeValue(task?.requesterEmail);
    const userName = normalizeValue(user.name);
    const requesterName = normalizeValue(task?.requesterName);
    const emailPrefix = userEmail.split("@")[0];
    const requesterId = normalizeId(task?.requesterId);
    if (
      (requesterId && requesterId === userId) ||
      (userEmail && requesterEmail && requesterEmail === userEmail) ||
      (requesterName && userName && (requesterName === userName || requesterName.includes(userName) || userName.includes(requesterName))) ||
      (requesterName && emailPrefix && requesterName.includes(emailPrefix))
    ) {
      return true;
    }
    const history = Array.isArray(task?.changeHistory) ? task.changeHistory : [];
    const createdEntry = history.find((entry) => entry?.field === "created");
    const createdUserId = normalizeId(createdEntry?.userId);
    if (createdUserId && createdUserId === userId) return true;
    const creatorName = normalizeValue(createdEntry?.userName);
    if (
      creatorName &&
      userName &&
      (creatorName === userName || creatorName.includes(userName) || userName.includes(creatorName))
    ) {
      return true;
    }
    if (creatorName && emailPrefix && creatorName.includes(emailPrefix)) {
      return true;
    }
    if (history.some((entry) => normalizeId(entry?.userId) === userId)) return true;
    return false;
  }
  if (userRole === "designer") {
    const assignedName = normalizeValue(task?.assignedToName);
    const assignedId = resolveAssignedIdentifier(task);
    const userName = normalizeValue(user.name);
    const userEmail = normalizeValue(user.email);
    const emailPrefix = userEmail.split("@")[0];
    const nameMatches =
      assignedName &&
      userName &&
      (assignedName === userName ||
        assignedName.includes(userName) ||
        userName.includes(assignedName));
    const emailMatches = assignedName && emailPrefix && assignedName.includes(emailPrefix);
    const assignedEmailMatches =
      assignedId && EMAIL_REGEX.test(assignedId) && userEmail && normalizeValue(assignedId) === userEmail;
    return Boolean(
      (assignedId && assignedId === userId) ||
      assignedEmailMatches ||
      nameMatches ||
      emailMatches
    );
  }
  return false;
};

const ensureTaskAccess = async (req, res, next) => {
  try {
    const rawTaskParam = String(req.params.id || "").trim();
    const isReadOnly =
      req.method === "GET" ||
      req.method === "HEAD";
    let task = null;
    if (mongoose.Types.ObjectId.isValid(rawTaskParam)) {
      task = await Task.findById(rawTaskParam);
    }
    // Backward compatibility: some older links may carry task code/title instead of ObjectId.
    if (!task && isReadOnly && rawTaskParam) {
      task = await Task.findOne({ title: rawTaskParam }).sort({ createdAt: -1 });
    }
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }
    const userRole = normalizeTaskRole(req.user?.role);
    const isMainDesigner = userRole === "designer" && isMainDesignerUser(req.user);
    const isUnassigned = await isTaskEffectivelyUnassigned(task);
    const isCommentWrite =
      req.method === "POST" && typeof req.path === "string" && req.path.endsWith("/comments");
    const isChangeWrite =
      req.method === "POST" && typeof req.path === "string" && req.path.endsWith("/changes");
    const isAssignDesignerWrite =
      req.method === "POST" && typeof req.path === "string" && req.path.endsWith("/assign-designer");
    const isLegacyAssignWrite =
      req.method === "POST" && typeof req.path === "string" && req.path.endsWith("/assign");
    const isFinalDeliverablesWrite =
      req.method === "POST" && typeof req.path === "string" && req.path.endsWith("/final-deliverables");
    const isFinalDeliverableNoteWrite =
      req.method === "PATCH" && typeof req.path === "string" && req.path.endsWith("/note");
    const isAcceptWrite =
      req.method === "POST" && typeof req.path === "string" && req.path.endsWith("/accept");
    const isCommentsSeenWrite =
      req.method === "POST" && typeof req.path === "string" && req.path.endsWith("/comments/seen");
    const usesAssignedAccessRules = hasAssignedDesignerAccessMetadata(task);

    if (usesAssignedAccessRules) {
      const accessContext = await resolveTaskAccessContext(task, req.user);
      const canAssignDesignerFromUnassigned =
        userRole === "designer" &&
        isMainDesigner &&
        isUnassigned &&
        isAssignDesignerWrite;
      const canAssignDesignerAsManager =
        isAssignDesignerWrite &&
        (userRole === "admin" || (userRole === "designer" && isMainDesigner));
      const canLegacyAssignAsManager =
        isLegacyAssignWrite &&
        (userRole === "admin" || (userRole === "designer" && isMainDesigner));
      const managerApprovalFields = new Set([
        "approval_status",
        "deadline_request",
        "emergency_approval",
      ]);
      const managerApprovalUpdateKeys = new Set([
        "approvalStatus",
        "approvedBy",
        "approvalDate",
        "deadlineApprovalStatus",
        "deadlineApprovedBy",
        "deadlineApprovedAt",
        "emergencyApprovalStatus",
        "emergencyApprovedBy",
        "emergencyApprovedAt",
        "updatedAt",
      ]);
      const bodyChanges = Array.isArray(req.body?.changes) ? req.body.changes : [];
      const bodyUpdates = req.body?.updates && typeof req.body.updates === "object" ? req.body.updates : {};
      const hasManagerApprovalChanges =
        bodyChanges.length > 0 &&
        bodyChanges.every((change) =>
          managerApprovalFields.has(normalizeValue(change?.field))
        );
      const hasOnlyManagerApprovalUpdates =
        Object.keys(bodyUpdates).length === 0 ||
        Object.keys(bodyUpdates).every((key) => managerApprovalUpdateKeys.has(key));
      const canManagerApprovalWrite =
        isChangeWrite &&
        ["treasurer", "admin"].includes(userRole) &&
        hasManagerApprovalChanges &&
        hasOnlyManagerApprovalUpdates;
      const canManagerCommentWrite =
        isCommentWrite &&
        isManagerRole(userRole) &&
        accessContext.mode !== "none";

      if (isReadOnly) {
        if (accessContext.mode === "none") {
          return res.status(403).json({ error: "Forbidden." });
        }
        req.task = task;
        req.taskAccessMode = accessContext.mode;
        req.taskAccessContext = accessContext;
        return next();
      }

      if (
        isAssignDesignerWrite &&
        (accessContext.mode === "full" || canAssignDesignerFromUnassigned || canAssignDesignerAsManager)
      ) {
        req.task = task;
        req.taskAccessMode = accessContext.mode === "none" ? "full" : accessContext.mode;
        req.taskAccessContext = accessContext;
        return next();
      }

      if (canLegacyAssignAsManager) {
        req.task = task;
        req.taskAccessMode = accessContext.mode;
        req.taskAccessContext = accessContext;
        return next();
      }

      if (canManagerApprovalWrite) {
        req.task = task;
        req.taskAccessMode = "full";
        req.taskAccessContext = accessContext;
        return next();
      }

      if (canManagerCommentWrite) {
        req.task = task;
        req.taskAccessMode = accessContext.mode;
        req.taskAccessContext = accessContext;
        return next();
      }

      if (accessContext.mode !== "full") {
        return res.status(403).json({ error: "Forbidden." });
      }

      req.task = task;
      req.taskAccessMode = accessContext.mode;
      req.taskAccessContext = accessContext;
      return next();
    }

    if (userRole === "staff" && isReadOnly) {
      req.task = task;
      return next();
    }
    if (
      userRole === "designer" &&
      isMainDesigner &&
      isUnassigned &&
      (isReadOnly ||
        isCommentWrite ||
        isChangeWrite ||
        isAssignDesignerWrite ||
        isFinalDeliverablesWrite ||
        isFinalDeliverableNoteWrite ||
        isAcceptWrite ||
        isCommentsSeenWrite)
    ) {
      req.task = task;
      req.taskAccessMode = "full";
      req.taskAccessContext = {
        mode: "full",
        assignedDesignerEmail: normalizeValue(req.user?.email),
        ccEmails: extractTaskCcEmails(task)
      };
      return next();
    }
    if (userRole === "staff" && isChangeWrite) {
      const bodyChanges = Array.isArray(req.body?.changes) ? req.body.changes : [];
      const isFileOnly =
        bodyChanges.length > 0 &&
        bodyChanges.every(
          (change) =>
            (change?.type === "file_added" && change?.field === "files") ||
            (change?.type === "update" && change?.field === "design_version")
        );
      const updates = req.body?.updates || {};
      const allowedKeys = ["files", "designVersions", "activeDesignVersionId", "updatedAt"];
      const updatesOk =
        updates && Object.keys(updates).every((key) => allowedKeys.includes(key));
      if (isFileOnly && updatesOk) {
        req.task = task;
        return next();
      }
    }
    if (!canAccessTask(task, req.user)) {
      if (userRole === "designer" && !isMainDesigner) {
        return res.status(403).json({ error: "Forbidden." });
      }
      if (isReadOnly) {
        req.task = task;
        req.taskAccessMode = "view_only";
        req.taskAccessContext = {
          mode: "view_only",
          assignedDesignerEmail: await resolveAssignedDesignerEmail(task),
          ccEmails: extractTaskCcEmails(task)
        };
        return next();
      }
      return res.status(403).json({ error: "Forbidden." });
    }
    req.task = task;
    return next();
  } catch (error) {
    return res.status(400).json({ error: "Invalid task id." });
  }
};

router.get("/", globalLimiter, async (req, res) => {
  try {
    const { status, category, urgency, requesterId, requesterEmail, assignedToId, limit } = req.query;
    const query = {};
    const userRole = normalizeTaskRole(req.user?.role);
    const userId = getUserId(req);
    const userEmail = normalizeValue(req.user?.email);
    const userName = normalizeValue(req.user?.name);
    const userIsMainDesigner = userRole === "designer" && isMainDesignerUser(req.user);

    if (status) query.status = status;
    if (category) query.category = category;
    if (urgency) query.urgency = urgency;
    if (requesterId && requesterEmail) {
      query.$or = [
        { requesterId },
        { requesterEmail }
      ];
    } else {
      if (requesterId) query.requesterId = requesterId;
      if (requesterEmail) query.requesterEmail = requesterEmail;
    }
    if (assignedToId) query.assignedToId = assignedToId;

    if (userRole === "staff") {
      const orClauses = [{ requesterId: userId }];
      const userObjectId = toObjectId(userId);
      if (userObjectId) {
        orClauses.push({ requesterId: userObjectId });
      }
      if (userEmail) {
        orClauses.push({ requesterEmail: userEmail });
        orClauses.push({
          changeHistory: {
            $elemMatch: {
              field: "cc_emails",
              newValue: new RegExp(escapeRegExp(userEmail), "i")
            }
          }
        });
      }
      if (userName) {
        const nameRegex = new RegExp(escapeRegExp(userName), "i");
        orClauses.push({ requesterName: nameRegex });
        orClauses.push({
          changeHistory: {
            $elemMatch: { field: "created", userName: nameRegex }
          }
        });
      }
      if (userId) {
        orClauses.push({
          changeHistory: {
            $elemMatch: { field: "created", userId }
          }
        });
      }
      query.$or = orClauses;
    } else if (userRole === "designer") {
      // Main designers can monitor the unassigned queue; junior designers are limited to assigned tasks.
    } else if (userRole !== "treasurer" && userRole !== "admin") {
      return res.status(403).json({ error: "Forbidden." });
    }

    const safeLimit = Math.min(parseInt(limit || "100", 10), 500);
    const tasks = await Task.find(query).sort({ createdAt: -1 }).limit(safeLimit);
    const filteredTasks =
      userRole === "designer"
        ? (
          await Promise.all(
            tasks.map(async (task) => {
              if (!userIsMainDesigner) {
                return canAccessTask(task, req.user) ? task : null;
              }
              if (!hasAssignedDesignerAccessMetadata(task)) {
                if (await isTaskEffectivelyUnassigned(task)) return task;
                return canAccessTask(task, req.user) ? task : null;
              }
              if (await isTaskEffectivelyUnassigned(task)) return task;
              const assignedId = resolveAssignedIdentifier(task);
              if (assignedId && userId && assignedId === userId) return task;
              if (assignedId && EMAIL_REGEX.test(assignedId) && userEmail && normalizeValue(assignedId) === userEmail) {
                return task;
              }
              const ccEmails = extractTaskCcEmails(task);
              if (isTaskAssignedByUser(task, req.user)) return task;
              if (userEmail && ccEmails.includes(userEmail)) return task;
              return task;
            })
          )
        ).filter(Boolean)
        : tasks;
    res.json(filteredTasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to load tasks." });
  }
});

router.get("/designers", async (req, res) => {
  try {
    const role = normalizeTaskRole(req.user?.role);
    const canViewAssignableDesigners =
      role === "admin" || (role === "designer" && isMainDesignerUser(req.user));
    if (!canViewAssignableDesigners) {
      return res.status(403).json({ error: "Only the main designer can view assignable designers." });
    }

    const designers = await getActiveDesignerUsers();
    const assignableDesigners = hasMainDesignerConfig()
      ? splitDesignersByScope(designers).juniorDesigners
      : designers;

    res.json(
      assignableDesigners.map((designer) => {
        const email = normalizeValue(designer.email);
        const fallbackName = email ? email.split("@")[0] : "Designer";
        const designerScope = getDesignerScope(designer) || "junior";
        return {
          id: designer._id?.toString?.() || "",
          name: designer.name || fallbackName,
          email,
          role: designer.role || "designer",
          designerScope,
          portalId: buildDesignerPortalId(designer)
        };
      })
    );
  } catch (error) {
    res.status(500).json({ error: "Failed to load designers." });
  }
});

router.post("/", requireRole(["staff", "treasurer"]), async (req, res) => {
  try {
    const now = new Date();
    const actorId = getUserId(req);
    const actorRole = req.user?.role || "staff";
    const requesterName = req.body.requesterName || req.user?.name || "";
    const requesterId = actorRole === "staff" ? actorId : (req.body.requesterId || actorId);
    const requesterEmail = actorRole === "staff" ? (req.user?.email || "") : (req.body.requesterEmail || req.user?.email || "");
    const createdEntry = {
      type: "status",
      field: "created",
      oldValue: "",
      newValue: "Created",
      note: `New request submitted by ${requesterName || "Staff"}`,
      userId: requesterId || "",
      userName: requesterName || "",
      userRole: actorRole || "staff",
      createdAt: now
    };
    const payload = {
      ...req.body,
      requesterId,
      requesterEmail,
      changeHistory: [createdEntry, ...(Array.isArray(req.body.changeHistory) ? req.body.changeHistory : [])]
    };
    if (!payload.deadline) {
      return res.status(400).json({ error: "Deadline is required." });
    }
    const parsedDeadline = new Date(payload.deadline);
    if (Number.isNaN(parsedDeadline.getTime())) {
      return res.status(400).json({ error: "Invalid deadline." });
    }
    payload.deadline = parsedDeadline;
    if (payload.isEmergency) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const deadlineStart = new Date(parsedDeadline);
      deadlineStart.setHours(0, 0, 0, 0);
      if (deadlineStart < todayStart) {
        return res.status(400).json({ error: "Emergency deadline cannot be before today." });
      }
    }
    // Staff/treasurer cannot directly assign designers while creating a task.
    payload.assignedToId = "";
    payload.assignedToName = "";
    payload.assignedTo = "";
    payload.assignedToEmail = "";
    const dedupeWindowMs = Number(process.env.TASK_DEDUPE_WINDOW_MS || 120000);
    const dedupeSince = new Date(Date.now() - dedupeWindowMs);
    const baseDedupeQuery = {
      title: payload.title,
      description: payload.description,
      category: payload.category,
      urgency: payload.urgency,
      deadline: payload.deadline,
      createdAt: { $gte: dedupeSince },
    };
    const dedupeQuery = requesterId
      ? { ...baseDedupeQuery, requesterId }
      : requesterEmail
        ? { ...baseDedupeQuery, requesterEmail }
        : null;
    if (dedupeQuery) {
      const existingTask = await Task.findOne(dedupeQuery).sort({ createdAt: -1 });
      if (existingTask) {
        return res.status(200).json(existingTask);
      }
    }
    const task = await Task.create(payload);
    req.auditTargetId = task.id || task._id?.toString?.() || "";

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "created",
      userId: requesterId || "",
      userName: requesterName || ""
    });

    const io = getSocket();
    const taskId = task.id || task._id?.toString?.();
    console.log("Request created:", taskId);
    const taskLink = buildTaskLink(taskId);
    const createdEventId = `task:${taskId}:created`;
    getUserIdsByRole(["treasurer"]).then((userIds) => {
      if (userIds.length === 0) return;
      return createNotificationsForUsers(userIds, {
        title: `New request: ${task.title}`,
        message: `Submitted by ${requesterName || "Staff"}`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: createdEventId,
      }).then(emitNotifications);
    }).catch((error) => {
      console.error("Notification error (task created):", error?.message || error);
    });

    if (requesterId) {
      createNotification({
        userId: requesterId,
        title: `Request submitted: ${task.title}`,
        message: "Your request has been submitted.",
        type: "task",
        link: taskLink,
        taskId,
        eventId: `requester:${taskId}:created`,
      })
        .then(emitNotification)
        .catch((error) => {
          console.error("Notification error (requester created):", error?.message || error);
        });
    }

    if (task.assignedToId) {
      createNotification({
        userId: task.assignedToId,
        title: `New task assigned: ${task.title}`,
        message: `${requesterName || "Staff"} assigned a task to you.`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: `assign:${taskId}:${task.assignedToId}:${now.toISOString()}`,
      })
        .then(emitNotification)
        .catch((error) => {
          console.error("Notification error (assign on create):", error?.message || error);
        });
    }

    if (io) {
      const payloadTask = typeof task.toJSON === "function" ? task.toJSON() : task;
      const targetRoom = task.assignedToId ? String(task.assignedToId) : "designers:queue";
      io.to(targetRoom).emit("request:new", payloadTask);
      console.log(`Emitted request:new to room: ${targetRoom}`);
      getUserIdsByRole(["treasurer"]).then((userIds) => {
        userIds.forEach((treasurerId) => {
          io.to(String(treasurerId)).emit("request:new", payloadTask);
        });
        if (userIds.length > 0) {
          console.log(`Emitted request:new to ${userIds.length} treasurer rooms`);
        }
      }).catch((error) => {
        console.error("Request emit error (treasurer rooms):", error?.message || error);
      });
      if (!task.assignedToId) {
        getQueueDesignerUserIds().then((userIds) => {
          userIds.forEach((designerId) => {
            io.to(String(designerId)).emit("request:new", payloadTask);
          });
          if (userIds.length > 0) {
            console.log(`Emitted request:new to ${userIds.length} designer rooms`);
          }
        }).catch((error) => {
          console.error("Request emit error (designer rooms):", error?.message || error);
        });
      }
    }

    if (!task.assignedToId) {
      getQueueDesignerUserIds().then((userIds) => {
        if (userIds.length === 0) return;
        return createNotificationsForUsers(userIds, {
          title: `New request: ${task.title}`,
          message: `Submitted by ${requesterName || "Staff"}`,
          type: "task",
          link: taskLink,
          taskId,
          eventId: `queue:${taskId}:created`,
        }).then(emitNotifications);
      }).catch((error) => {
        console.error("Notification error (designer queue):", error?.message || error);
      });
    }

    const baseUrl = process.env.FRONTEND_URL || "";
    const taskUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/task/${task.id || task._id}`
      : "";

    const requesterPrefs = await resolveNotificationPreferences({
      userId: task.requesterId,
      email: task.requesterEmail,
      fallbackUser: req.user,
    });

    if (requesterPrefs.whatsappNotifications) {
      const recipients = [
        task.requesterPhone,
        ...(Array.isArray(task.secondaryPhones) ? task.secondaryPhones : [])
      ].filter((p) => p && p.trim() !== "");

      if (recipients.length === 0 && process.env.TWILIO_DEFAULT_TO) {
        recipients.push(process.env.TWILIO_DEFAULT_TO);
      }

      // Non-blocking notification
      Promise.all(recipients.map(to =>
        sendTaskCreatedSms({
          to,
          taskTitle: task.title,
          taskUrl,
          deadline: task.deadline,
          requesterName: task.requesterName,
          taskId: task.id || task._id?.toString?.()
        })
      )).catch(err => console.error("Background Notification Error (Create Task):", err));
    }

    res.status(201).json(task);
  } catch (error) {
    console.error("Failed to create task:", error);
    res.status(400).json({ error: "Failed to create task." });
  }
});

const extractDriveId = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("drive.google.com")) return null;
    const idFromQuery = parsed.searchParams.get("id");
    if (idFromQuery) return idFromQuery;
    const match = parsed.pathname.match(/\/file\/d\/([^/]+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
};

const hydrateMissingFileMeta = async (task) => {
  if (!task?.files?.length) return task;
  const pending = task.files.filter(
    (file) =>
      (file.size === undefined || !file.thumbnailUrl) && extractDriveId(file.url)
  );
  if (pending.length === 0) return task;
  try {
    const drive = getDriveClient();
    let changed = false;
    for (const file of pending) {
      const fileId = extractDriveId(file.url);
      if (!fileId) continue;
      const response = await drive.files.get({
        fileId,
        fields: "id,size,thumbnailLink",
      });
      const sizeValue = response?.data?.size ? Number(response.data.size) : undefined;
      if (!Number.isFinite(sizeValue)) continue;
      if (Number.isFinite(sizeValue)) {
        file.size = sizeValue;
        changed = true;
      }
      if (response?.data?.thumbnailLink && !file.thumbnailUrl) {
        file.thumbnailUrl = response.data.thumbnailLink;
        changed = true;
      }
    }
    if (changed) {
      task.markModified("files");
      await task.save();
    }
  } catch (error) {
    console.error("Drive metadata hydration failed:", error?.message || error);
  }
  return task;
};

router.get("/:id", ensureTaskAccess, async (req, res) => {
  try {
    let task = req.task;
    task = await hydrateMissingFileMeta(task);
    const accessContext =
      req.taskAccessContext || await resolveTaskAccessContext(task, req.user);
    const payload = typeof task.toJSON === "function" ? task.toJSON() : task;
    payload.finalDeliverableVersions = normalizeFinalDeliverableVersions(task);
    payload.accessMode = req.taskAccessMode || accessContext?.mode || "full";
    payload.viewOnly = payload.accessMode === "view_only";
    if (accessContext?.assignedDesignerEmail) {
      payload.assignedDesignerEmail = accessContext.assignedDesignerEmail;
    }
    if (accessContext?.ccEmails && accessContext.ccEmails.length > 0) {
      payload.ccEmails = accessContext.ccEmails;
      payload.cc_emails = accessContext.ccEmails;
    }
    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: "Invalid task id." });
  }
});

router.get("/:id/changes", ensureTaskAccess, async (req, res) => {
  try {
    const task = req.task;
    res.json(Array.isArray(task?.changeHistory) ? task.changeHistory : []);
  } catch (error) {
    res.status(400).json({ error: "Invalid task id." });
  }
});

router.get("/:id/final-deliverables", ensureTaskAccess, async (req, res) => {
  try {
    const task = req.task;
    const versions = normalizeFinalDeliverableVersions(task);
    res.json(versions);
  } catch (error) {
    res.status(400).json({ error: "Invalid task id." });
  }
});

router.patch("/:id/final-deliverables/:versionId/note", ensureTaskAccess, async (req, res) => {
  try {
    const userRole = req.user?.role || "";
    if (userRole !== "designer" && userRole !== "admin" && userRole !== "staff") {
      return res.status(403).json({ error: "Only designers or staff can update final deliverable notes." });
    }
    const taskId = req.params.id;
    const versionId = String(req.params.versionId || "").trim();
    const note = req.body?.note ? String(req.body.note).trim() : "";
    if (!versionId) {
      return res.status(400).json({ error: "Version id is required." });
    }

    let task = req.task;
    task = await ensureFinalDeliverableVersions(task);
    const versions = Array.isArray(task.finalDeliverableVersions) ? task.finalDeliverableVersions : [];
    const targetVersion = versions.find((version) => String(version?._id || version?.id || "") === versionId);
    if (!targetVersion) {
      return res.status(404).json({ error: "Final deliverable version not found." });
    }

    const oldNote = String(targetVersion.note || "");
    if (oldNote === note) {
      const payload = typeof task.toJSON === "function" ? task.toJSON() : task;
      payload.finalDeliverableVersions = normalizeFinalDeliverableVersions(task);
      return res.json(payload);
    }

    targetVersion.note = note;
    const changedAt = new Date();
    const userId = getUserId(req);
    const resolvedUserName = req.user?.name || "";
    task.changeHistory.push({
      type: "update",
      field: "final_deliverable_note",
      oldValue: oldNote,
      newValue: note,
      note: `Updated final deliverable note (v${targetVersion.version || "?"})`,
      userId: userId || "",
      userName: resolvedUserName || "",
      userRole: userRole || "",
      createdAt: changedAt
    });
    task.markModified("finalDeliverableVersions");
    task.markModified("changeHistory");
    task.updatedAt = changedAt;
    await task.save();

    req.auditTargetId = task.id || task._id?.toString?.() || taskId;

    const io = getSocket();
    if (io) {
      const payloadTask = typeof task.toJSON === "function" ? task.toJSON() : task;
      payloadTask.finalDeliverableVersions = normalizeFinalDeliverableVersions(task);
      const updatedTaskId = payloadTask?.id || task.id || task._id?.toString?.();
      const updatePayload = {
        taskId: updatedTaskId,
        task: payloadTask
      };
      io.to(updatedTaskId).emit("task:updated", updatePayload);
    }

    const responsePayload = typeof task.toJSON === "function" ? task.toJSON() : task;
    responsePayload.finalDeliverableVersions = normalizeFinalDeliverableVersions(task);
    res.json(responsePayload);
  } catch (error) {
    console.error("Final deliverable note update error:", error?.message || error);
    res.status(400).json({ error: "Failed to update final deliverable note." });
  }
});

router.post("/:id/final-deliverables", ensureTaskAccess, async (req, res) => {
  try {
    const userRole = req.user?.role || "";
    if (userRole !== "designer" && userRole !== "admin" && userRole !== "staff") {
      return res.status(403).json({ error: "Only designers or staff can upload final deliverables." });
    }
    const taskId = req.params.id;
    const userId = getUserId(req);
    const resolvedUserName = req.user?.name || "";
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    const note = req.body?.note ? String(req.body.note).trim() : "";
    if (files.length === 0) {
      return res.status(400).json({ error: "Final deliverable files are required." });
    }

    let task = req.task;
    task = await ensureFinalDeliverableVersions(task);
    const existingVersions = Array.isArray(task.finalDeliverableVersions)
      ? task.finalDeliverableVersions
      : [];
    const maxVersion = existingVersions.reduce(
      (max, version) => Math.max(max, Number(version?.version) || 0),
      0
    );
    const nextVersion = maxVersion + 1;
    const uploadedAt = new Date();
    const versionFiles = files.map((file) => ({
      name: file?.name || "",
      url: file?.url || "",
      size: typeof file?.size === "number" ? file.size : undefined,
      mime: file?.mime || "",
      thumbnailUrl: file?.thumbnailUrl || "",
      uploadedAt,
      uploadedBy: userId || ""
    }));

    const newVersion = {
      version: nextVersion,
      uploadedAt,
      uploadedBy: userId || "",
      note,
      files: versionFiles
    };

    const outputFiles = versionFiles.map((file) => ({
      name: file.name,
      url: file.url,
      type: "output",
      uploadedAt: file.uploadedAt,
      uploadedBy: file.uploadedBy,
      size: file.size,
      mime: file.mime,
      thumbnailUrl: file.thumbnailUrl
    }));

    const changeEntries = versionFiles.map((file) => ({
      type: "file_added",
      field: "files",
      oldValue: "",
      newValue: file.name,
      note: `Final files uploaded (v${nextVersion})`,
      userId: userId || "",
      userName: resolvedUserName || "",
      userRole: userRole || "",
      createdAt: uploadedAt
    }));

    const updateDoc = {
      $push: {
        finalDeliverableVersions: newVersion,
        files: { $each: outputFiles },
        changeHistory: { $each: changeEntries }
      },
      $set: { updatedAt: uploadedAt }
    };

    const updatedTask = await Task.findByIdAndUpdate(taskId, updateDoc, {
      new: true,
      runValidators: true
    });

    if (!updatedTask) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = updatedTask.id || updatedTask._id?.toString?.() || "";

    await Activity.create({
      taskId: updatedTask._id,
      taskTitle: updatedTask.title,
      action: "updated",
      userId: userId || "",
      userName: resolvedUserName || ""
    });

    const baseUrl = process.env.FRONTEND_URL || "";
    const taskUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/task/${updatedTask.id || updatedTask._id}`
      : undefined;
    const taskLink = buildTaskLink(updatedTask.id || updatedTask._id?.toString?.());

    let requesterUserId =
      updatedTask.requesterId ||
      task.requesterId ||
      (updatedTask.requesterEmail
        ? await resolveUserIdByEmail(updatedTask.requesterEmail)
        : "");
    if (!requesterUserId) {
      const history = Array.isArray(updatedTask.changeHistory)
        ? updatedTask.changeHistory
        : [];
      const createdEntry = history.find((entry) => entry?.field === "created");
      if (createdEntry?.userId) {
        requesterUserId = createdEntry.userId;
      } else if (createdEntry?.userName) {
        const requesterUser = await User.findOne({
          name: new RegExp(`^${escapeRegExp(createdEntry.userName)}$`, "i"),
          isActive: { $ne: false }
        });
        requesterUserId = requesterUser?._id?.toString?.() || "";
      }
    }

    let resolvedRequesterEmail =
      updatedTask.requesterEmail || task.requesterEmail || "";
    if (!resolvedRequesterEmail && updatedTask.requesterId) {
      const requesterUser = await User.findById(updatedTask.requesterId);
      resolvedRequesterEmail = requesterUser?.email || "";
    }
    if (!resolvedRequesterEmail && requesterUserId) {
      const requesterUser = await User.findById(requesterUserId);
      resolvedRequesterEmail = requesterUser?.email || "";
    }

    const requesterPrefs = await resolveNotificationPreferences({
      userId: requesterUserId,
      email: resolvedRequesterEmail
    });

    const filesForEmail = versionFiles.map((file) => ({
      name: file.name,
      url: file.url
    }));

    if (resolvedRequesterEmail && requesterPrefs.emailNotifications) {
      const emailSent = await sendFinalFilesEmail({
        to: resolvedRequesterEmail,
        taskTitle: updatedTask.title,
        files: filesForEmail,
        designerName: resolvedUserName,
        taskUrl,
        submittedAt: uploadedAt,
        taskDetails: {
          id: updatedTask.id || updatedTask._id?.toString?.() || updatedTask._id,
          status: updatedTask.status,
          category: updatedTask.category,
          deadline: updatedTask.deadline,
          requesterName: updatedTask.requesterName,
          requesterEmail: resolvedRequesterEmail,
          requesterDepartment: updatedTask.requesterDepartment,
        },
      });
      if (!emailSent) {
        console.warn("Final files email failed to send. Check SMTP configuration.");
      }
    }

    if (requesterUserId) {
      createNotification({
        userId: requesterUserId,
        title: `Final files uploaded: ${updatedTask.title}`,
        message: `${resolvedUserName || "Designer"} shared final deliverables.`,
        type: "file",
        link: taskLink,
        taskId: updatedTask.id || updatedTask._id?.toString?.(),
        eventId: `final:${taskId}:${uploadedAt.toISOString()}`
      })
        .then((note) => emitNotification(note))
        .catch((error) => {
          console.error("Notification error:", error?.message || error);
        });
    }

    const io = getSocket();
    if (io) {
      const payloadTask = typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
      payloadTask.finalDeliverableVersions = normalizeFinalDeliverableVersions(updatedTask);
      const updatedTaskId = payloadTask?.id || updatedTask.id || updatedTask._id?.toString?.();
      const updatePayload = {
        taskId: updatedTaskId,
        task: payloadTask
      };
      io.to(updatedTaskId).emit("task:updated", updatePayload);
      if (requesterUserId) {
        io.to(String(requesterUserId)).emit("task:updated", updatePayload);
      }
    }

    const responsePayload =
      typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
    responsePayload.finalDeliverableVersions = normalizeFinalDeliverableVersions(updatedTask);
    res.json(responsePayload);
  } catch (error) {
    console.error("Final deliverable upload error:", error?.message || error);
    res.status(400).json({ error: "Failed to upload final deliverables." });
  }
});

router.patch("/:id", ensureTaskAccess, async (req, res) => {
  try {
    const userRole = req.user?.role || "";
    if (
      req.body?.status &&
      String(req.body.status).toLowerCase() === "completed" &&
      userRole !== "designer" &&
      userRole !== "admin"
    ) {
      return res.status(403).json({ error: "Only designers can complete tasks." });
    }
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = task.id || task._id?.toString?.() || "";

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "updated",
      userId: getUserId(req),
      userName: req.user?.name || req.body.userName || ""
    });

    const io = getSocket();
    if (io) {
      io.to(task.id || task._id?.toString?.()).emit("task:updated", {
        taskId: task.id || task._id?.toString?.(),
        task
      });
    }

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to update task." });
  }
});

router.post("/:id/comments", ensureTaskAccess, async (req, res) => {
  try {
    const { content, receiverRoles, parentId, mentions } = req.body;
    const userId = getUserId(req);
    const userName = req.user?.name || req.body.userName || "";
    const userRole = req.user?.role || "";

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required." });
    }

    const validRoles = ["staff", "treasurer", "designer", "admin"];
    const normalizedUserRole = normalizeTaskRole(userRole);
    const senderRole = validRoles.includes(normalizedUserRole) ? normalizedUserRole : "";
    const normalizedMentions = Array.isArray(mentions)
      ? mentions.filter((role) => validRoles.includes(role))
      : [];
    const normalizedReceivers = Array.isArray(receiverRoles)
      ? receiverRoles.filter((role) => validRoles.includes(role))
      : [];
    const resolvedReceivers =
      normalizedMentions.length > 0
        ? normalizedMentions
        : normalizedReceivers.length > 0
          ? normalizedReceivers
          : senderRole
            ? validRoles.filter((role) => role !== senderRole)
            : validRoles;
    const uniqueReceivers = [
      ...new Set(
        senderRole
          ? resolvedReceivers.filter((role) => role !== senderRole)
          : resolvedReceivers
      ),
    ];

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          comments: {
            userId,
            userName,
            userRole: senderRole,
            content,
            parentId: parentId || "",
            mentions: normalizedMentions,
            receiverRoles: uniqueReceivers
          }
        }
      },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    const createdComment = Array.isArray(task.comments)
      ? task.comments[task.comments.length - 1]
      : null;
    const taskId = task.id || task._id?.toString?.();

    // Comment save succeeded. Return immediately and run side effects in background.
    res.json(task);

    void (async () => {
      try {
        await Activity.create({
          taskId: task._id,
          taskTitle: task.title,
          action: "commented",
          userId: userId || "",
          userName: userName || ""
        });
      } catch (error) {
        console.error("Activity error (comment):", error?.message || error);
      }

      if (createdComment) {
        try {
          const requesterUserId =
            task.requesterId ||
            (task.requesterEmail ? await resolveUserIdByEmail(task.requesterEmail) : "");
          const designerUserId = task.assignedToId || "";
          const treasurerUserIds = await getUserIdsByRole(["treasurer"]);
          const allRecipients = new Set([
            requesterUserId,
            designerUserId,
            ...treasurerUserIds,
          ]);
          const finalRecipients = Array.from(allRecipients).filter(Boolean);
          if (finalRecipients.length > 0) {
            const snippet =
              content.length > 140 ? `${content.slice(0, 137)}...` : content;
            const commentEventId = createdComment._id
              ? `comment:${createdComment._id.toString()}`
              : undefined;
            createNotificationsForUsers(finalRecipients, {
              title: `New message on ${task.title}`,
              message: `${userName || "Staff"}: ${snippet}`,
              type: "comment",
              link: buildTaskLink(taskId),
              taskId,
              eventId: commentEventId,
            })
              .then(emitNotifications)
              .catch((error) => {
                console.error("Notification error (comment):", error?.message || error);
              });
          }
        } catch (error) {
          console.error("Notification setup error (comment):", error?.message || error);
        }
      }

      try {
        const requesterPrefs = await resolveNotificationPreferences({
          userId: task.requesterId,
          email: task.requesterEmail,
        });

        if (requesterPrefs.whatsappNotifications) {
          const recipients = [
            task.requesterPhone,
            ...(Array.isArray(task.secondaryPhones) ? task.secondaryPhones : [])
          ].filter((p) => p && p.trim() !== "");

          if (recipients.length > 0) {
            const baseUrl = process.env.FRONTEND_URL || "";
            const taskUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/task/${task.id || task._id}` : "";

            Promise.all(recipients.map(to =>
              sendCommentNotificationSms({
                to,
                taskTitle: task.title,
                userName: userName,
                content: content,
                taskUrl: taskUrl
              })
            )).catch(err => console.error("Background Notification Error (Comment):", err));
          }
        }
      } catch (error) {
        console.error("WhatsApp notification error (comment):", error?.message || error);
      }

      try {
        const io = getSocket();
        if (io && createdComment) {
          io.to(taskId).emit("comment:new", {
            taskId,
            comment: createdComment
          });
        }
      } catch (error) {
        console.error("Socket emit error (comment):", error?.message || error);
      }
    })();
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error && error.message ? error.message : "Failed to add comment."
    });
  }
});

router.post("/:id/comments/seen", ensureTaskAccess, async (req, res) => {
  try {
    const role = normalizeTaskRole(req.user?.role);
    const validRoles = ["staff", "treasurer", "designer", "admin"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }
    const task = req.task;

    let updated = false;
    const now = new Date();
    task.comments = task.comments.map((comment) => {
      const receivers =
        Array.isArray(comment.receiverRoles) && comment.receiverRoles.length > 0
          ? comment.receiverRoles
          : comment.userRole
            ? validRoles.filter((validRole) => validRole !== comment.userRole)
            : validRoles;
      if (!receivers.includes(role)) {
        return comment;
      }
      const seenBy = Array.isArray(comment.seenBy) ? comment.seenBy : [];
      if (seenBy.some((entry) => entry.role === role)) {
        return comment;
      }
      comment.seenBy = [...seenBy, { role, seenAt: now }];
      updated = true;
      return comment;
    });

    if (updated) {
      task.markModified("comments");
      await task.save();
    }

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to update comment status." });
  }
});

router.post("/:id/assign", ensureTaskAccess, async (req, res) => {
  try {
    const { assignedToId, assignedToName, assignedTo, assignedToEmail, userName } = req.body;
    const role = normalizeTaskRole(req.user?.role);
    const canAssign =
      role === "admin" || (role === "designer" && isMainDesignerUser(req.user));

    if (!canAssign) {
      return res.status(403).json({ error: "Only the main designer can assign tasks." });
    }

    const resolvedAssignment = await resolveAssignedUser({
      assignedToId,
      assignedTo,
      assignedToName,
      assignedToEmail
    });
    if (resolvedAssignment.assignedToId) {
      const assignedDesigner = await User.findById(resolvedAssignment.assignedToId)
        .select("_id name email role isActive");
      if (
        !assignedDesigner ||
        assignedDesigner.role !== "designer" ||
        assignedDesigner.isActive === false
      ) {
        return res.status(404).json({ error: "Assigned designer not found." });
      }
      if (hasMainDesignerConfig() && getDesignerScope(assignedDesigner) !== "junior") {
        return res.status(400).json({ error: "Only junior designers can be assigned." });
      }
      if (!resolvedAssignment.assignedToName) {
        const assignedEmail = normalizeValue(assignedDesigner.email);
        resolvedAssignment.assignedToName =
          assignedDesigner.name || (assignedEmail ? assignedEmail.split("@")[0] : "Designer");
      }
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { assignedToId: resolvedAssignment.assignedToId, assignedToName: resolvedAssignment.assignedToName },
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = task.id || task._id?.toString?.() || "";

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "assigned",
      userId: getUserId(req),
      userName: req.user?.name || userName || ""
    });

    if (resolvedAssignment.assignedToId) {
      const taskId = task.id || task._id?.toString?.();
      const taskLink = buildTaskLink(taskId);
      createNotification({
        userId: resolvedAssignment.assignedToId,
        title: `Task assigned: ${task.title}`,
        message: `${req.user?.name || userName || "Staff"} assigned this task to you.`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: `assign:${taskId}:${resolvedAssignment.assignedToId}:${new Date().toISOString()}`,
      })
        .then(emitNotification)
        .catch((error) => {
          console.error("Notification error (assign):", error?.message || error);
        });
    }

    const io = getSocket();
    if (io) {
      const payloadTask = typeof task.toJSON === "function" ? task.toJSON() : task;
      const targetRoom = resolvedAssignment.assignedToId
        ? String(resolvedAssignment.assignedToId)
        : "designers:queue";
      io.to(targetRoom).emit("request:new", payloadTask);
      console.log(`Emitted request:new to room: ${targetRoom}`);
    }

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to assign task." });
  }
});

router.post("/:id/assign-designer", ensureTaskAccess, async (req, res) => {
  try {
    const role = normalizeTaskRole(req.user?.role);
    const canAssign =
      role === "admin" || (role === "designer" && isMainDesignerUser(req.user));
    if (!canAssign) {
      return res.status(403).json({ error: "Only the main designer can assign designers." });
    }

    const assignedDesignerRaw = req.body?.assigned_designer_id;
    if (typeof assignedDesignerRaw !== "string" || !assignedDesignerRaw.trim()) {
      return res.status(400).json({ error: "assigned_designer_id is required." });
    }

    if (req.body?.cc_emails !== undefined && !Array.isArray(req.body.cc_emails)) {
      return res.status(400).json({ error: "cc_emails must be an array of email addresses." });
    }

    const ccEmails = normalizeEmailList(req.body?.cc_emails || []);
    const invalidCcEmail = ccEmails.find((email) => !EMAIL_REGEX.test(email));
    if (invalidCcEmail) {
      return res.status(400).json({ error: `Invalid CC email: ${invalidCcEmail}` });
    }

    const assignmentMessage =
      typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const assignedDesignerInput = assignedDesignerRaw.trim();
    const inputLooksLikeEmail = assignedDesignerInput.includes("@");
    const resolvedAssignment = await resolveAssignedUser({
      assignedToId: inputLooksLikeEmail ? "" : assignedDesignerInput,
      assignedToEmail: inputLooksLikeEmail ? assignedDesignerInput : ""
    });

    if (!resolvedAssignment.assignedToId) {
      return res.status(404).json({ error: "Assigned designer not found." });
    }

    const assignedDesigner = await User.findById(resolvedAssignment.assignedToId)
      .select("_id name email role isActive");
    if (
      !assignedDesigner ||
      assignedDesigner.role !== "designer" ||
      assignedDesigner.isActive === false
    ) {
      return res.status(404).json({ error: "Assigned designer not found." });
    }
    if (hasMainDesignerConfig() && getDesignerScope(assignedDesigner) !== "junior") {
      return res.status(400).json({ error: "Only junior designers can be assigned." });
    }

    const assignedDesignerEmail = normalizeValue(assignedDesigner.email);
    if (!EMAIL_REGEX.test(assignedDesignerEmail)) {
      return res.status(400).json({ error: "Assigned designer does not have a valid email." });
    }

    const task = req.task;
    const previousCcEmails = extractTaskCcEmails(task);
    const assignedAt = new Date();
    const assignedBy = req.user?.name || req.user?.email || "Manager";
    const assignedById = getUserId(req);
    const assignedDesignerName =
      resolvedAssignment.assignedToName ||
      assignedDesigner.name ||
      assignedDesignerEmail.split("@")[0] ||
      "";

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          assignedToId: resolvedAssignment.assignedToId,
          assignedToName: assignedDesignerName,
          status: "assigned"
        },
        $push: {
          changeHistory: {
            $each: [
              {
                type: "update",
                field: "assigned_designer",
                oldValue: task.assignedToName || task.assignedToId || "",
                newValue: assignedDesignerName || assignedDesignerEmail,
                note: assignmentMessage || `Assigned by ${assignedBy}.`,
                userId: assignedById || "",
                userName: assignedBy || "",
                userRole: role || "",
                createdAt: assignedAt
              },
              {
                type: "status",
                field: "task_status",
                oldValue: task.status || "",
                newValue: "Assigned",
                note: assignmentMessage || "",
                userId: assignedById || "",
                userName: assignedBy || "",
                userRole: role || "",
                createdAt: assignedAt
              },
              {
                type: "update",
                field: "cc_emails",
                oldValue: JSON.stringify(previousCcEmails),
                newValue: JSON.stringify(ccEmails),
                note: ccEmails.length > 0
                  ? `CC recipients: ${ccEmails.join(", ")}`
                  : "CC recipients cleared.",
                userId: assignedById || "",
                userName: assignedBy || "",
                userRole: role || "",
                createdAt: assignedAt
              }
            ]
          }
        }
      },
      { new: true, runValidators: true }
    );

    if (!updatedTask) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = updatedTask.id || updatedTask._id?.toString?.() || "";

    await Activity.create({
      taskId: updatedTask._id,
      taskTitle: updatedTask.title,
      action: "assigned",
      userId: assignedById || "",
      userName: assignedBy || ""
    });

    const taskId = updatedTask.id || updatedTask._id?.toString?.();
    const taskLink = taskId ? `/task/${taskId}` : buildTaskLink(taskId);

    createNotification({
      userId: resolvedAssignment.assignedToId,
      title: `Task assigned: ${updatedTask.title}`,
      message: `${assignedBy} assigned this task to you.`,
      type: "task",
      link: taskLink,
      taskId,
      eventId: `assign-designer:${taskId}:${resolvedAssignment.assignedToId}:${assignedAt.toISOString()}`,
    })
      .then(emitNotification)
      .catch((error) => {
        console.error("Notification error (assign-designer):", error?.message || error);
      });

    const baseUrl = process.env.FRONTEND_URL || "";
    const taskUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/task/${taskId}`
      : undefined;

    const emailSent = await sendFinalFilesEmail({
      to: assignedDesignerEmail,
      cc: ccEmails,
      taskTitle: updatedTask.title,
      files: [],
      designerName: assignedDesignerName,
      assignedByName: assignedBy,
      taskUrl,
      submittedAt: assignedAt,
      taskDetails: {
        id: taskId,
        status: "assigned",
        category: updatedTask.category,
        deadline: updatedTask.deadline,
        requesterName: updatedTask.requesterName,
        requesterEmail: updatedTask.requesterEmail,
        requesterDepartment: updatedTask.requesterDepartment,
      },
      emailType: "TASK_ASSIGNED",
      assignmentMessage,
    });
    if (!emailSent) {
      console.warn("Task assignment email failed to send. Check SMTP configuration.");
    }

    const io = getSocket();
    if (io) {
      const payloadTask =
        typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
      if (resolvedAssignment.assignedToId) {
        io.to(String(resolvedAssignment.assignedToId)).emit("request:new", payloadTask);
      }
      if (taskId) {
        io.to(String(taskId)).emit("task:updated", {
          taskId,
          task: payloadTask
        });
      }
    }

    const responsePayload =
      typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
    res.json({
      ...responsePayload,
      emailSent,
      accessMode: "full",
      viewOnly: false,
      ccEmails,
      cc_emails: ccEmails
    });
  } catch (error) {
    console.error("Assign designer error:", error?.message || error);
    res.status(400).json({ error: "Failed to assign designer." });
  }
});

router.post("/:id/accept", ensureTaskAccess, async (req, res) => {
  try {
    const task = req.task;
    const accessContext =
      req.taskAccessContext || await resolveTaskAccessContext(task, req.user);
    if (accessContext.mode !== "full") {
      return res.status(403).json({ error: "Only the assigned designer can accept this task." });
    }

    const acceptedAt = new Date();
    const actorId = getUserId(req);
    const actorName = req.user?.name || req.user?.email || "Designer";
    const actorRole = req.user?.role || "designer";
    const acceptedStatus = "accepted";
    const acceptedStatusLabel = "Accepted";
    const taskId = task.id || task._id?.toString?.() || req.params.id;
    const previousStatus = task.status || "";

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: acceptedStatus,
          accepted_at: acceptedAt,
          updatedAt: acceptedAt
        },
        $push: {
          changeHistory: {
            type: "status",
            field: "task_status",
            oldValue: previousStatus,
            newValue: acceptedStatusLabel,
            note: `Accepted by ${actorName}`,
            userId: actorId || "",
            userName: actorName,
            userRole: actorRole,
            createdAt: acceptedAt
          }
        }
      },
      {
        new: true,
        runValidators: false,
        strict: false
      }
    );

    if (!updatedTask) {
      return res.status(404).json({ error: "Task not found." });
    }

    req.auditTargetId = updatedTask.id || updatedTask._id?.toString?.() || "";

    await Activity.create({
      taskId: updatedTask._id,
      taskTitle: updatedTask.title,
      action: "updated",
      userId: actorId || "",
      userName: actorName
    });

    const managerRecipient = await resolveAssignmentManagerRecipient(updatedTask);
    const taskLink = taskId ? `/tasks/${taskId}` : buildTaskLink(taskId);
    if (managerRecipient?.id) {
      createNotification({
        userId: managerRecipient.id,
        title: `Task accepted: ${updatedTask.title}`,
        message: `${actorName} accepted this task.`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: `task-accepted:${taskId}:${actorId}:${acceptedAt.toISOString()}`
      })
        .then(emitNotification)
        .catch((error) => {
          console.error("Notification error (task accepted):", error?.message || error);
        });
    }

    const managerEmail = normalizeValue(managerRecipient?.email);
    if (EMAIL_REGEX.test(managerEmail)) {
      const baseUrl = process.env.FRONTEND_URL || "";
      const taskUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/task/${taskId}`
        : undefined;
      const acceptedEmailSent = await sendFinalFilesEmail({
        to: managerEmail,
        taskTitle: updatedTask.title,
        files: [],
        designerName: actorName,
        assignedByName: managerRecipient?.name || "",
        taskUrl,
        submittedAt: acceptedAt,
        taskDetails: {
          id: taskId,
          status: acceptedStatus,
          category: updatedTask.category,
          deadline: updatedTask.deadline,
          requesterName: updatedTask.requesterName,
          requesterEmail: updatedTask.requesterEmail,
          requesterDepartment: updatedTask.requesterDepartment
        },
        emailType: "TASK_ACCEPTED"
      });
      if (!acceptedEmailSent) {
        console.warn("Task accepted email failed to send. Check SMTP configuration.");
      }
    }

    const io = getSocket();
    if (io) {
      const payloadTask = typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
      io.to(String(taskId)).emit("task:updated", {
        taskId,
        task: payloadTask
      });
      if (managerRecipient?.id) {
        io.to(String(managerRecipient.id)).emit("task:updated", {
          taskId,
          task: payloadTask
        });
      }
    }

    const responsePayload = typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
    res.json(responsePayload);
  } catch (error) {
    console.error("Task accept error:", error?.message || error);
    res.status(400).json({ error: "Failed to accept task." });
  }
});

router.post("/:id/changes", ensureTaskAccess, async (req, res) => {
  try {
    const { updates = {}, changes = [], userName } = req.body;
    const userId = getUserId(req);
    const userRole = req.user?.role || "";
    const resolvedUserName = req.user?.name || userName || "";

    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: "Change list is required." });
    }
    const statusChangeInput = changes.find((change) => change?.field === "status");
    const nextStatus =
      updates?.status || statusChangeInput?.newValue || statusChangeInput?.newValue?.toString?.();
    if (
      nextStatus &&
      String(nextStatus).toLowerCase() === "completed" &&
      userRole !== "designer" &&
      userRole !== "admin"
    ) {
      return res.status(403).json({ error: "Only designers can complete tasks." });
    }
    const emergencyDecisionChange = changes.find(
      (change) => normalizeValue(change?.field) === "emergency_approval"
    );
    if (emergencyDecisionChange) {
      const decisionValue = normalizeValue(emergencyDecisionChange?.newValue);
      if (decisionValue === "approved" || decisionValue === "rejected") {
        if (userRole !== "designer" && userRole !== "admin") {
          return res.status(403).json({ error: "Only designers can decide emergency overrides." });
        }
        const decisionNote = String(emergencyDecisionChange?.note || "").trim();
        if (!decisionNote) {
          return res.status(400).json({ error: "Emergency approval reason is required." });
        }
      }
    }
    const hasFileRemovalChange = changes.some(
      (change) => change?.type === "file_removed" && change?.field === "files"
    );
    if (hasFileRemovalChange && userRole !== "designer") {
      return res.status(403).json({ error: "Only designers can remove files." });
    }

    const task = req.task;

    const changeEntries = changes.map((change) => ({
      type: change.type || "update",
      field: change.field || "",
      oldValue: change.oldValue ?? "",
      newValue: change.newValue ?? "",
      note: change.note || "",
      userId: userId || "",
      userName: resolvedUserName || "",
      userRole: userRole || "",
      createdAt: new Date()
    }));
    const hasFileUploadChange = changes.some(
      (change) => change?.type === "file_added" && change?.field === "files"
    );
    const sanitizedEntries = hasFileUploadChange
      ? changeEntries.filter((entry) => entry.field !== "status")
      : changeEntries;
    const sanitizedChanges = hasFileUploadChange
      ? changes.filter((change) => change?.field !== "status")
      : changes;
    const nextCount = (task.changeCount || 0) + sanitizedEntries.length;
    const isFinalFileChange = (change) => {
      if (!change) return false;
      if (change.type !== "file_added" || change.field !== "files") return false;
      const note = String(change.note || "").toLowerCase();
      return /final\s*file/.test(note);
    };

    const finalChangeEntries = sanitizedEntries.filter(isFinalFileChange);

    const updateDoc = {
      $inc: { changeCount: sanitizedEntries.length },
      $push: { changeHistory: { $each: sanitizedEntries } }
    };

    const nextSet = { ...(Object.keys(updates).length > 0 ? updates : {}) };
    if (hasFileUploadChange) {
      delete nextSet.status;
      delete nextSet.assignedToId;
      delete nextSet.assignedToName;
      delete nextSet.assignedTo;
      delete nextSet.assignedToEmail;
    }
    const isUnassigned = !normalizeId(task.assignedToId);
    if (userRole === "designer" && isUnassigned) {
      nextSet.assignedToId = userId || "";
      nextSet.assignedToName = resolvedUserName || "";
    }
    if (Object.keys(nextSet).length > 0) {
      updateDoc.$set = nextSet;
    }

    if (nextCount >= 3 && task.approvalStatus !== "pending") {
      updateDoc.$set = { ...(updateDoc.$set || {}), approvalStatus: "pending" };
    }

    const updatedTask = await Task.findByIdAndUpdate(req.params.id, updateDoc, {
      new: true,
      runValidators: true
    });

    req.auditTargetId = updatedTask?.id || updatedTask?._id?.toString?.() || "";

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "updated",
      userId: userId || "",
      userName: resolvedUserName || ""
    });

    const finalFileChanges = sanitizedChanges.filter(isFinalFileChange);

    if (finalFileChanges.length > 0) {
      const baseUrl = process.env.FRONTEND_URL || "";
      const taskUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/task/${updatedTask.id || updatedTask._id}`
        : undefined;
      const requesterPrefs = await resolveNotificationPreferences({
        userId: updatedTask.requesterId,
        email: updatedTask.requesterEmail || task.requesterEmail,
      });

      // Notify on status updates
      const statusChange = sanitizedChanges.find(c => c.field === "status");
      if (statusChange && requesterPrefs.whatsappNotifications) {
        const recipients = [
          updatedTask.requesterPhone,
          ...(Array.isArray(updatedTask.secondaryPhones) ? updatedTask.secondaryPhones : [])
        ].filter((p) => p && p.trim() !== "");

        if (recipients.length > 0) {
          // Non-blocking notification
          Promise.all(recipients.map(to =>
            sendStatusUpdateSms({
              to,
              taskTitle: updatedTask.title,
              newStatus: statusChange.newValue,
              taskUrl: taskUrl,
              requesterName: updatedTask.requesterName,
              taskId: updatedTask.id || updatedTask._id?.toString?.()
            })
          )).catch(err => console.error("Background Notification Error (Status Update):", err));
        }
      }

      const updatedFiles = Array.isArray(updatedTask.files) ? updatedTask.files : [];
      const newNames = new Set(
        finalFileChanges
          .map((change) => change?.newValue)
          .filter((name) => Boolean(name))
      );
      const files = updatedFiles
        .filter((file) => file?.type === "output" && newNames.has(file.name))
        .map((file) => ({ name: file.name, url: file.url }));
      if (files.length === 0) {
        newNames.forEach((name) => {
          files.push({ name, url: "" });
        });
      }
      const submittedAt = finalChangeEntries[0]?.createdAt;

    let resolvedRequesterEmail = updatedTask.requesterEmail || task.requesterEmail;
    if (!resolvedRequesterEmail && updatedTask.requesterId) {
      const requesterUser = await User.findById(updatedTask.requesterId);
      resolvedRequesterEmail = requesterUser?.email || "";
    }
    if (!resolvedRequesterEmail) {
      const history = Array.isArray(updatedTask.changeHistory) ? updatedTask.changeHistory : [];
      const createdEntry = history.find((entry) => entry?.field === "created");
      if (createdEntry?.userId) {
        const requesterUser = await User.findById(createdEntry.userId);
        resolvedRequesterEmail = requesterUser?.email || "";
      } else if (createdEntry?.userName) {
        const requesterUser = await User.findOne({
          name: new RegExp(`^${escapeRegExp(createdEntry.userName)}$`, "i"),
          isActive: { $ne: false }
        });
        resolvedRequesterEmail = requesterUser?.email || "";
      }
    }

      if (resolvedRequesterEmail && requesterPrefs.emailNotifications) {
        const emailSent = await sendFinalFilesEmail({
          to: resolvedRequesterEmail,
          taskTitle: task.title,
          files,
          designerName: resolvedUserName,
          taskUrl,
          submittedAt,
          taskDetails: {
            id: updatedTask.id || updatedTask._id?.toString?.() || updatedTask._id,
            status: updatedTask.status,
            category: updatedTask.category,
            deadline: updatedTask.deadline,
            requesterName: updatedTask.requesterName,
            requesterEmail: resolvedRequesterEmail,
            requesterDepartment: updatedTask.requesterDepartment,
          },
        });
        if (!emailSent) {
          console.warn("Final files email failed to send. Check SMTP configuration.");
        }
      } else {
        console.warn("Final files email skipped: requester email missing.");
      }

      const recipients = [
        updatedTask.requesterPhone,
        ...(Array.isArray(updatedTask.secondaryPhones) ? updatedTask.secondaryPhones : [])
      ].filter((p) => p && p.trim() !== "");

      if (requesterPrefs.whatsappNotifications) {
        if (recipients.length === 0 && process.env.TWILIO_DEFAULT_TO) {
          recipients.push(process.env.TWILIO_DEFAULT_TO);
        }

        // Non-blocking notification
        Promise.all(recipients.map(to =>
          sendFinalFilesSms({
            to,
            taskTitle: updatedTask.title,
            files,
            designerName: resolvedUserName,
            taskUrl,
            deadline: updatedTask.deadline,
            taskId: updatedTask.id || updatedTask._id?.toString?.(),
            requesterName: updatedTask.requesterName
          })
        )).catch(err => console.error("Background Notification Error (Final Files):", err));
      }
    }

    const taskId = updatedTask?.id || updatedTask?._id?.toString?.();
    const taskLink = buildTaskLink(taskId);
    const changeStamp = changeEntries[0]?.createdAt
      ? new Date(changeEntries[0].createdAt).toISOString()
      : new Date().toISOString();

    let requesterUserId =
      updatedTask.requesterId ||
      task.requesterId ||
      (updatedTask.requesterEmail
        ? await resolveUserIdByEmail(updatedTask.requesterEmail)
        : "");
    if (!requesterUserId) {
      const history = Array.isArray(updatedTask.changeHistory) ? updatedTask.changeHistory : [];
      const createdEntry = history.find((entry) => entry?.field === "created");
      if (createdEntry?.userId) {
        requesterUserId = createdEntry.userId;
      } else if (createdEntry?.userName) {
        const requesterUser = await User.findOne({
          name: new RegExp(`^${escapeRegExp(createdEntry.userName)}$`, "i"),
          isActive: { $ne: false }
        });
        requesterUserId = requesterUser?._id?.toString?.() || "";
      }
    }
    const designerUserId = updatedTask.assignedToId || task.assignedToId || "";

    const notifyUser = (userId, payload) => {
      if (!userId) return;
      createNotification({ userId, ...payload })
        .then((note) => emitNotification(note))
        .catch((error) => {
          console.error("Notification error:", error?.message || error);
        });
    };

    if (finalFileChanges.length > 0 && requesterUserId) {
      notifyUser(requesterUserId, {
        title: `Final files uploaded: ${updatedTask.title}`,
        message: `${resolvedUserName || "Designer"} shared final deliverables.`,
        type: "file",
        link: taskLink,
        taskId,
        eventId: `final:${taskId}:${changeStamp}`,
      });
    }

    const statusEntry = sanitizedEntries.find((entry) => entry.field === "status");
    if (statusEntry && requesterUserId) {
      const nextStatus = String(statusEntry.newValue || "").toLowerCase();
      if (nextStatus.includes("completed")) {
        notifyUser(requesterUserId, {
          title: `Task completed: ${updatedTask.title}`,
          message: `${resolvedUserName || "Designer"} marked this task as completed.`,
          type: "task",
          link: taskLink,
          taskId,
          eventId: `status:${taskId}:${nextStatus}:${changeStamp}`,
        });
      }
    }

    const deadlineEntry = changeEntries.find((entry) => entry.field === "deadline_request");
    if (deadlineEntry && requesterUserId) {
      const decision = String(deadlineEntry.newValue || "").toLowerCase();
      if (decision.includes("approved")) {
        notifyUser(requesterUserId, {
          title: `Deadline approved: ${updatedTask.title}`,
          message: deadlineEntry.note || "Your deadline request was approved.",
          type: "task",
          link: taskLink,
          taskId,
          eventId: `deadline:${taskId}:${decision}:${changeStamp}`,
        });
      } else if (decision.includes("rejected")) {
        notifyUser(requesterUserId, {
          title: `Deadline update: ${updatedTask.title}`,
          message: deadlineEntry.note || "Your deadline request was rejected.",
          type: "task",
          link: taskLink,
          taskId,
          eventId: `deadline:${taskId}:${decision}:${changeStamp}`,
        });
      }
    }

    const emergencyEntry = changeEntries.find((entry) => entry.field === "emergency_approval");
    if (emergencyEntry && requesterUserId) {
      notifyUser(requesterUserId, {
        title: `Emergency ${String(emergencyEntry.newValue || "").toLowerCase()}: ${updatedTask.title}`,
        message: emergencyEntry.note || "Emergency request updated.",
        type: "task",
        link: taskLink,
        taskId,
        eventId: `emergency:${taskId}:${changeStamp}`,
      });
    }

    const approvalEntry = sanitizedEntries.find((entry) => entry.field === "approval_status");
    if (approvalEntry && userRole === "treasurer") {
      const decision = String(approvalEntry.newValue || "").toLowerCase();
      const payload = {
        title: `Approval ${decision}: ${updatedTask.title}`,
        message: approvalEntry.note || `Treasurer ${decision} this request.`,
        type: "task",
        link: taskLink,
        taskId,
        eventId: `approval:${taskId}:${decision}:${changeStamp}`,
      };
      if (requesterUserId) notifyUser(requesterUserId, payload);
      if (designerUserId) notifyUser(designerUserId, payload);
    }

    if (userRole === "staff" && designerUserId) {
      const staffFields = new Set([
        "description",
        "files",
        "deadline_request",
        "status",
        "staff_note",
        "created",
      ]);
      const staffEntry = changeEntries.find((entry) => staffFields.has(entry.field));
      if (staffEntry) {
        notifyUser(designerUserId, {
          title: `Task updated: ${updatedTask.title}`,
          message: staffEntry.note || `${resolvedUserName || "Staff"} updated ${staffEntry.field.replace(/_/g, " ")}`,
          type: "task",
          link: taskLink,
          eventId: `staff:${taskId}:${staffEntry.field}:${changeStamp}`,
        });
      }
    }

    // Notify on deadline changes
    const deadlineChange = changes.find(c => c.field === "deadline" || (c.field === "deadline_request" && c.newValue === "Approved"));
    if (deadlineChange) {
      const recipients = [
        updatedTask.requesterPhone,
        ...(Array.isArray(updatedTask.secondaryPhones) ? updatedTask.secondaryPhones : [])
      ].filter((p) => p && p.trim() !== "");

      if (recipients.length > 0) {
        const newDeadline = updatedTask.deadline ? new Date(updatedTask.deadline).toLocaleDateString() : "n/a";
        const body = `DesignDesk-Official Update: The deadline for "${updatedTask.title}" has been updated to ${newDeadline}.`;

        // Non-blocking notification
        Promise.all(recipients.map(to => sendSms({ to, body })))
          .catch(err => console.error("Background Notification Error (Deadline Change):", err));
      }
    }

    const io = getSocket();
    if (io) {
      const payloadTask = typeof updatedTask.toJSON === "function" ? updatedTask.toJSON() : updatedTask;
      const updatedTaskId = payloadTask?.id || updatedTask.id || updatedTask._id?.toString?.();
      const updatePayload = {
        taskId: updatedTaskId,
        task: payloadTask,
      };
      io.to(updatedTaskId).emit("task:updated", updatePayload);
      if (requesterUserId) {
        io.to(String(requesterUserId)).emit("task:updated", updatePayload);
      }
      const requesterEmail = payloadTask?.requesterEmail || updatedTask.requesterEmail || task.requesterEmail;
      if (requesterEmail) {
        io.to(String(requesterEmail)).emit("task:updated", updatePayload);
      }
      if (designerUserId) {
        io.to(String(designerUserId)).emit("task:updated", updatePayload);
      }
      console.log(`Emitted task:updated for ${updatedTaskId}`);
    }

    const approvalChange = changes.find((change) =>
      ["approvalStatus", "deadlineApprovalStatus", "emergencyApprovalStatus"].includes(change.field)
    );
    if (approvalChange) {
      const nextValue = String(approvalChange.newValue || "").toLowerCase();
      if (nextValue === "approved") {
        req.auditAction = approvalChange.field === "emergencyApprovalStatus"
          ? "EMERGENCY_OVERRIDE"
          : "REQUEST_APPROVED";
      } else if (nextValue === "rejected") {
        req.auditAction = "REQUEST_REJECTED";
      }
    }
    if (changes.some((change) => String(change.field || "").toLowerCase().includes("emergency") && String(change.note || "").toLowerCase().includes("override"))) {
      req.auditAction = "EMERGENCY_OVERRIDE";
    }

    res.json(updatedTask);
  } catch (error) {
    console.error("Failed to record change:", error);
    res.status(400).json({ error: "Failed to record change." });
  }
});

export default router;

