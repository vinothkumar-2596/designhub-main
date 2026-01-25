import express from "express";
import Task from "../models/Task.js";
import { getDriveClient } from "../lib/drive.js";
import Activity from "../models/Activity.js";
import {
  sendFinalFilesEmail,
  sendFinalFilesSms,
  sendTaskCreatedSms,
  sendCommentNotificationSms,
  sendStatusUpdateSms,
  sendSms,
} from "../lib/notifications.js";
import { getSocket } from "../socket.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();
const TASK_ROLES = ["staff", "designer", "treasurer"];
router.use(requireRole(TASK_ROLES));

const getUserId = (req) => (req.user?._id ? req.user._id.toString() : "");

const canAccessTask = (task, user) => {
  if (!user) return false;
  if (user.role === "admin" || user.role === "treasurer") return true;
  const userId = user._id?.toString?.() || user._id;
  if (user.role === "staff") {
    return Boolean(task?.requesterId && task.requesterId === userId);
  }
  if (user.role === "designer") {
    return Boolean(task?.assignedToId && task.assignedToId === userId);
  }
  return false;
};

const ensureTaskAccess = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
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
      query.requesterId = userId;
    } else if (userRole === "designer") {
      query.assignedToId = userId;
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
    const task = await Task.create(payload);
    req.auditTargetId = task.id || task._id?.toString?.() || "";

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "created",
      userId: requesterId || "",
      userName: requesterName || ""
    });

    const baseUrl = process.env.FRONTEND_URL || "";
    const taskUrl = baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/task/${task.id || task._id}`
      : "";

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

router.patch("/:id", ensureTaskAccess, async (req, res) => {
  try {
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

    // Notify recipients via WhatsApp/SMS
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
    const { assignedToId, assignedToName, userName } = req.body;
    const role = req.user?.role || "";

    if (!["staff", "treasurer", "admin"].includes(role)) {
      return res.status(403).json({ error: "Only staff or treasurer can assign tasks." });
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { assignedToId: assignedToId || "", assignedToName: assignedToName || "" },
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

    const task = req.task;

    const nextCount = (task.changeCount || 0) + changes.length;
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
    const finalChangeEntries =
      userRole === "designer"
        ? changeEntries.filter(
          (change) =>
            change?.type === "file_added" &&
            change?.field === "files" &&
            change?.note === "Final file uploaded"
        )
        : [];

    const updateDoc = {
      $inc: { changeCount: changes.length },
      $push: { changeHistory: { $each: changeEntries } }
    };

    if (Object.keys(updates).length > 0) {
      updateDoc.$set = updates;
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

    const finalFileChanges =
      userRole === "designer"
        ? changes.filter(
          (change) =>
            change?.type === "file_added" &&
            change?.field === "files" &&
            change?.note === "Final file uploaded"
        )
        : [];

    if (finalFileChanges.length > 0) {
      const baseUrl = process.env.FRONTEND_URL || "";
      const taskUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/task/${updatedTask.id || updatedTask._id}`
        : undefined;

      // Notify on status updates
      const statusChange = changes.find(c => c.field === "status");
      if (statusChange) {
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

      if (task.requesterEmail) {
        try {
          await sendFinalFilesEmail({
            to: task.requesterEmail,
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
              requesterEmail: updatedTask.requesterEmail,
              requesterDepartment: updatedTask.requesterDepartment,
            },
          });
        } catch (error) {
          console.error("Final files notification error:", error?.message || error);
        }
      }

      const recipients = [
        updatedTask.requesterPhone,
        ...(Array.isArray(updatedTask.secondaryPhones) ? updatedTask.secondaryPhones : [])
      ].filter((p) => p && p.trim() !== "");

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

    // Notify on deadline changes
    const deadlineChange = changes.find(c => c.field === "deadline" || (c.field === "deadline_request" && c.newValue === "Approved"));
    if (deadlineChange) {
      const recipients = [
        updatedTask.requesterPhone,
        ...(Array.isArray(updatedTask.secondaryPhones) ? updatedTask.secondaryPhones : [])
      ].filter((p) => p && p.trim() !== "");

      if (recipients.length > 0) {
        const newDeadline = updatedTask.deadline ? new Date(updatedTask.deadline).toLocaleDateString() : "n/a";
        const body = `DesignDesk Update: The deadline for "${updatedTask.title}" has been updated to ${newDeadline}.`;

        // Non-blocking notification
        Promise.all(recipients.map(to => sendSms({ to, body })))
          .catch(err => console.error("Background Notification Error (Deadline Change):", err));
      }
    }

    const io = getSocket();
    if (io) {
      io.to(updatedTask.id || updatedTask._id?.toString?.()).emit("task:updated", {
        taskId: updatedTask.id || updatedTask._id?.toString?.(),
        task: updatedTask
      });
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
