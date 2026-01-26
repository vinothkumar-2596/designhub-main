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

const router = express.Router();
const TASK_ROLES = ["staff", "designer", "treasurer", "admin"];
router.use(requireRole(TASK_ROLES));

const getUserId = (req) => (req.user?._id ? req.user._id.toString() : "");
const normalizeValue = (value) => (value ? String(value).trim().toLowerCase() : "");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeId = (value) => (value ? String(value) : "");
const toObjectId = (value) => {
  if (!value) return null;
  const raw = String(value);
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw);
};
const buildTaskLink = (taskId) => (taskId ? `/task/${taskId}` : "");
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

const canAccessTask = (task, user) => {
  if (!user) return false;
  if (user.role === "admin" || user.role === "treasurer") return true;
  const userId = user._id?.toString?.() || user._id;
  if (user.role === "staff") {
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
  if (user.role === "designer") {
    const assignedName = normalizeValue(task?.assignedToName);
    const assignedId = normalizeId(task?.assignedToId || task?.assignedTo);
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
    return Boolean(
      (assignedId && assignedId === userId) ||
      nameMatches ||
      emailMatches
    );
  }
  return false;
};

const ensureTaskAccess = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }
    const isReadOnly =
      req.method === "GET" ||
      req.method === "HEAD";
    const isUnassigned = !normalizeId(task.assignedToId);
    const isCommentWrite =
      req.method === "POST" && typeof req.path === "string" && req.path.endsWith("/comments");
    const isChangeWrite =
      req.method === "POST" && typeof req.path === "string" && req.path.endsWith("/changes");
    if (req.user?.role === "staff" && isReadOnly) {
      req.task = task;
      return next();
    }
    if (req.user?.role === "designer" && isReadOnly && isUnassigned) {
      req.task = task;
      return next();
    }
    if (req.user?.role === "staff" && isChangeWrite) {
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
    if (req.user?.role === "designer" && isUnassigned && isCommentWrite) {
      req.task = task;
      return next();
    }
    if (req.user?.role === "designer" && isUnassigned && isChangeWrite) {
      req.task = task;
      return next();
    }
    if (!canAccessTask(task, req.user)) {
      return res.status(403).json({ error: "Forbidden." });
    }
    req.task = task;
    return next();
  } catch (error) {
    return res.status(400).json({ error: "Invalid task id." });
  }
};

router.get("/", async (req, res) => {
  try {
    const { status, category, urgency, requesterId, requesterEmail, assignedToId, limit } = req.query;
    const query = {};
    const userRole = req.user?.role || "";
    const userId = getUserId(req);
    const userEmail = normalizeValue(req.user?.email);
    const userName = normalizeValue(req.user?.name);
    const emailPrefix = userEmail.split("@")[0];

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
      const orClauses = [{ assignedToId: userId }];
      const userObjectId = toObjectId(userId);
      if (userObjectId) {
        orClauses.push({ assignedToId: userObjectId });
      }
      const idUnsetClause = { $or: [{ assignedToId: "" }, { assignedToId: null }, { assignedToId: { $exists: false } }] };

      if (userName) {
        orClauses.push({
          $and: [
            idUnsetClause,
            { assignedToName: new RegExp(escapeRegExp(userName), "i") }
          ]
        });
      }
      if (emailPrefix) {
        orClauses.push({
          $and: [
            idUnsetClause,
            { assignedToName: new RegExp(escapeRegExp(emailPrefix), "i") }
          ]
        });
      }
      orClauses.push({
        $and: [
          idUnsetClause,
          { $or: [{ assignedToName: "" }, { assignedToName: null }, { assignedToName: { $exists: false } }] },
        ],
      });
      orClauses.push(idUnsetClause);
      query.$or = orClauses;
    } else if (userRole !== "treasurer" && userRole !== "admin") {
      return res.status(403).json({ error: "Forbidden." });
    }

    const safeLimit = Math.min(parseInt(limit || "100", 10), 500);
    const tasks = await Task.find(query).sort({ createdAt: -1 }).limit(safeLimit);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to load tasks." });
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
    const resolvedAssignment = await resolveAssignedUser({
      assignedToId: payload.assignedToId,
      assignedTo: payload.assignedTo,
      assignedToName: payload.assignedToName,
      assignedToEmail: payload.assignedToEmail
    });
    payload.assignedToId = resolvedAssignment.assignedToId;
    payload.assignedToName = resolvedAssignment.assignedToName;
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
      if (!task.assignedToId) {
        getUserIdsByRole(["designer"]).then((userIds) => {
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
      getUserIdsByRole(["designer"]).then((userIds) => {
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
    res.json(task);
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
    const senderRole = validRoles.includes(userRole) ? userRole : "";
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

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "commented",
      userId: userId || "",
      userName: userName || ""
    });

    const createdComment = Array.isArray(task.comments)
      ? task.comments[task.comments.length - 1]
      : null;

    if (createdComment) {
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
            link: buildTaskLink(task.id || task._id?.toString?.()),
            taskId: task.id || task._id?.toString?.(),
            eventId: commentEventId,
          })
            .then(emitNotifications)
            .catch((error) => {
            console.error("Notification error (comment):", error?.message || error);
          });
      }
    }

    const requesterPrefs = await resolveNotificationPreferences({
      userId: task.requesterId,
      email: task.requesterEmail,
    });

    // Notify recipients via WhatsApp/SMS
    if (requesterPrefs.whatsappNotifications) {
      const recipients = [
        task.requesterPhone,
        ...(Array.isArray(task.secondaryPhones) ? task.secondaryPhones : [])
      ].filter((p) => p && p.trim() !== "");

      if (recipients.length > 0) {
        const baseUrl = process.env.FRONTEND_URL || "";
        const taskUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/task/${task.id || task._id}` : "";

        // Non-blocking notification
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

    const io = getSocket();
    if (io && createdComment) {
      io.to(task.id || task._id?.toString?.()).emit("comment:new", {
        taskId: task.id || task._id?.toString?.(),
        comment: createdComment
      });
    }

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to add comment." });
  }
});

router.post("/:id/comments/seen", ensureTaskAccess, async (req, res) => {
  try {
    const role = req.user?.role || "";
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
    const role = req.user?.role || "";

    if (!["staff", "treasurer", "admin"].includes(role)) {
      return res.status(403).json({ error: "Only staff or treasurer can assign tasks." });
    }

    const resolvedAssignment = await resolveAssignedUser({
      assignedToId,
      assignedTo,
      assignedToName,
      assignedToEmail
    });

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

