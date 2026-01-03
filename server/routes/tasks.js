import express from "express";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";
import { sendFinalFilesEmail } from "../lib/notifications.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { status, category, urgency, requesterId, requesterEmail, assignedToId, limit } = req.query;
    const query = {};

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

    const safeLimit = Math.min(parseInt(limit || "100", 10), 500);
    const tasks = await Task.find(query).sort({ createdAt: -1 }).limit(safeLimit);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to load tasks." });
  }
});

router.post("/", async (req, res) => {
  try {
    const task = await Task.create(req.body);
    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "created",
      userId: req.body.requesterId || "",
      userName: req.body.requesterName || ""
    });
    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to create task." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }
    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Invalid task id." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "updated",
      userId: req.body.userId || "",
      userName: req.body.userName || ""
    });

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to update task." });
  }
});

router.post("/:id/comments", async (req, res) => {
  try {
    const { userId, userName, userRole, content, receiverRoles } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required." });
    }

    const validRoles = ["staff", "treasurer", "designer"];
    const senderRole = validRoles.includes(userRole) ? userRole : "";
    const normalizedReceivers = Array.isArray(receiverRoles)
      ? receiverRoles.filter((role) => validRoles.includes(role))
      : [];
    const resolvedReceivers =
      normalizedReceivers.length > 0
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

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to add comment." });
  }
});

router.post("/:id/comments/seen", async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ["staff", "treasurer", "designer"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

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

router.post("/:id/assign", async (req, res) => {
  try {
    const { assignedToId, assignedToName, role, userId, userName } = req.body;

    if (!["staff", "treasurer"].includes(role)) {
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

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "assigned",
      userId: userId || "",
      userName: userName || ""
    });

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: "Failed to assign task." });
  }
});

router.post("/:id/changes", async (req, res) => {
  try {
    const { updates = {}, changes = [], userId, userName, userRole } = req.body;

    if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({ error: "Change list is required." });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: "Task not found." });
    }

    const nextCount = (task.changeCount || 0) + changes.length;
    const changeEntries = changes.map((change) => ({
      type: change.type || "update",
      field: change.field || "",
      oldValue: change.oldValue ?? "",
      newValue: change.newValue ?? "",
      note: change.note || "",
      userId: userId || "",
      userName: userName || "",
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

    await Activity.create({
      taskId: task._id,
      taskTitle: task.title,
      action: "updated",
      userId: userId || "",
      userName: userName || ""
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
    if (finalFileChanges.length > 0 && task.requesterEmail) {
      const baseUrl = process.env.FRONTEND_URL || "";
      const taskUrl = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/task/${updatedTask.id || updatedTask._id}`
        : undefined;
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
      try {
        await sendFinalFilesEmail({
          to: task.requesterEmail,
          taskTitle: task.title,
          files,
          designerName: userName,
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

    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ error: "Failed to record change." });
  }
});

export default router;
