import Notification from "../models/Notification.js";

const normalizeValue = (value) => (value ? String(value).trim() : "");

const buildNotificationPayload = (payload) => {
  const userId = normalizeValue(payload.userId);
  if (!userId) return null;
  const taskId = normalizeValue(payload.taskId);
  const linkValue = normalizeValue(payload.link);
  const link =
    linkValue ||
    (taskId ? `/task/${taskId}` : "");
  return {
    userId,
    title: normalizeValue(payload.title) || "Notification",
    message: normalizeValue(payload.message) || "",
    type: normalizeValue(payload.type) || "system",
    link,
    taskId,
    eventId: normalizeValue(payload.eventId) || undefined,
  };
};

export const createNotification = async (payload) => {
  const data = buildNotificationPayload(payload);
  if (!data) return null;
  if (data.eventId) {
    const existing = await Notification.findOne({
      userId: data.userId,
      eventId: data.eventId,
    });
    if (existing) return existing;
  }
  return Notification.create(data);
};

export const createNotificationsForUsers = async (userIds, payload) => {
  if (!Array.isArray(userIds) || userIds.length === 0) return [];
  const unique = Array.from(new Set(userIds.map((id) => normalizeValue(id)).filter(Boolean)));
  const results = await Promise.all(
    unique.map((userId) => createNotification({ ...payload, userId }))
  );
  return results.filter(Boolean);
};

export const markNotificationRead = async (notificationId, userId) => {
  if (!notificationId || !userId) return null;
  const now = new Date();
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId, readAt: null },
    { $set: { readAt: now } },
    { new: true }
  );
};

export const markAllNotificationsRead = async (userId) => {
  if (!userId) return { modifiedCount: 0 };
  const now = new Date();
  return Notification.updateMany(
    { userId, readAt: null },
    { $set: { readAt: now } }
  );
};
