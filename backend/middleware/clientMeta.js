const parseClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "";
};

export const attachClientMeta = (req, _res, next) => {
  req.clientIp = parseClientIp(req);
  req.userAgent = req.get("user-agent") || "";
  next();
};
