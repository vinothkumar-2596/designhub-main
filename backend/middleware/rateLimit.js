import rateLimit from "express-rate-limit";

const defaultHandler = (_req, res) => {
  res.status(429).json({ error: "Too many requests." });
};

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  keyGenerator: (req) => req.clientIp || req.ip
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: defaultHandler,
  keyGenerator: (req) => req.clientIp || req.ip
});
