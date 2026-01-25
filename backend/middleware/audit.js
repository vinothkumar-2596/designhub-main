import { logAuditFromRequest } from "../lib/audit.js";

const methodToAction = (method) => {
  switch (method) {
    case "POST":
      return "DATA_CREATED";
    case "DELETE":
      return "DATA_DELETED";
    default:
      return "DATA_UPDATED";
  }
};

export const auditWriteActions = (req, res, next) => {
  if (req.skipAudit) {
    return next();
  }

  const isWrite = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  if (!isWrite) {
    return next();
  }

  res.on("finish", () => {
    if (res.statusCode >= 400 || req.skipAudit) {
      return;
    }

    const action = req.auditAction || methodToAction(req.method);
    const targetId = req.auditTargetId || req.params?.id || "";
    logAuditFromRequest(req, action, targetId).catch(() => {});
  });

  next();
};
