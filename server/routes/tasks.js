import express from "express";
import Task from "../models/Task.js";
import Activity from "../models/Activity.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { status, category, urgency, requesterId, assignedToId, limit } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category) query.category = category;
    if (urgency) query.urgency = urgency;
    if (requesterId) query.requesterId = requesterId;
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
    const { userId, userName, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required." });
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { userId, userName, content } } },
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

    res.json(updatedTask);
  } catch (error) {
    res.status(400).json({ error: "Failed to record change." });
  }
});

export default router;
