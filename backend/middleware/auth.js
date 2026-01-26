import jwt from "jsonwebtoken";

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret";

const PUBLIC_ROUTES = [
  { method: "POST", path: "/api/auth/login" },
  { method: "POST", path: "/api/auth/refresh" },
  { method: "GET", path: "/api/auth/google/start" },
  { method: "GET", path: "/api/auth/google/callback" },
  { method: "POST", path: "/api/auth/password/forgot" },
  { method: "POST", path: "/api/auth/password/reset" },
  { method: "POST", path: "/api/auth/password/otp/send" },
  { method: "POST", path: "/api/auth/password/otp/verify" }
];

const isPublicRoute = (req) =>
  PUBLIC_ROUTES.some(
    (route) => route.method === req.method && route.path === req.path
  );

export const signAccessToken = (user) => {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      sub: user.id || user._id?.toString?.() || user._id,
      email: user.email,
      name: user.name,
      role: user.role
    },
    secret,
    { expiresIn: process.env.ACCESS_TOKEN_TTL || "7d" }
  );
};

export const requireAuth = (req, res, next) => {
  if (isPublicRoute(req)) {
    return next();
  }

  const header = req.header("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const token = header.replace("Bearer ", "").trim();
  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = {
      _id: payload.sub,
      role: payload.role,
      email: payload.email
    };
    if (payload.name) {
      req.user.name = payload.name;
    }
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Unauthorized." });
  }
};

export const requireRole = (roles = []) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  if (req.user.role === "admin") {
    return next();
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: "Forbidden." });
  }

  return next();
};
