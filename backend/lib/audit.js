import AuditLog from "../models/AuditLog.js";

export const logAudit = async ({
  actorUserId,
  actorRole,
  action,
  targetId,
  ipAddress,
  userAgent,
  meta
}) => {
  try {
    await AuditLog.create({
      actorUserId,
      actorRole,
      action,
      targetId,
      ipAddress,
      userAgent,
      meta
    });
  } catch (error) {
    console.error("Audit logging failed:", error?.message || error);
  }
};

export const logAuditFromRequest = async (req, action, targetId, meta) => {
  const actorUserId = req.user?._id;
  const actorRole = req.user?.role || "";
  const ipAddress = req.clientIp || "";
  const userAgent = req.userAgent || "";
  await logAudit({
    actorUserId,
    actorRole,
    action,
    targetId,
    ipAddress,
    userAgent,
    meta
  });
};
