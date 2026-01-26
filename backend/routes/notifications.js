import express from "express";
import Notification from "../models/Notification.js";
import { markAllNotificationsRead, markNotificationRead } from "../lib/notificationService.js";

const router = express.Router();

const getUserId = (req) => (req.user?._id ? req.user._id.toString() : "");

const parseAfterParam = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const numeric = Number(raw);
  const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized." });

    const limit = Math.min(parseInt(req.query.limit || "15", 10), 50);
    const after = parseAfterParam(req.query.after);

    const query = { userId, deletedAt: null };
    if (after) {
      query.createdAt = { $gt: after };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to load notifications." });
  }
});

router.get("/unread-count", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized." });
    const count = await Notification.countDocuments({ userId, readAt: null, deletedAt: null });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: "Failed to load unread count." });
  }
});

router.patch("/mark-all-read", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized." });
    const result = await markAllNotificationsRead(userId);
    res.json({ success: true, modifiedCount: result.modifiedCount || 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark notifications read." });
  }
});

router.patch("/:id/read", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized." });
    const notification = await markNotificationRead(req.params.id, userId);
    if (!notification) {
      return res.status(404).json({ error: "Notification not found." });
    }
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification." });
  }
});

export default router;
