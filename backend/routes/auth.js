import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { google } from "googleapis";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import { sendPasswordResetEmail } from "../lib/notifications.js";
import { signAccessToken, requireAuth, requireRole } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { logAudit, logAuditFromRequest } from "../lib/audit.js";

const router = express.Router();

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret";
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || "refreshToken";

const hashToken = (value) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};

const createRefreshToken = async (user, req) => {
  const rawToken = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt,
    createdByIp: req.clientIp || "",
    userAgent: req.userAgent || ""
  });
  return { rawToken, tokenHash, expiresAt };
};

const setRefreshCookie = (res, token, expiresAt) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    expires: expiresAt,
    path: "/api/auth"
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
};

const getRefreshTokenFromRequest = (req) => {
  const headerToken = req.header("x-refresh-token");
  if (headerToken) return headerToken;
  if (req.body?.refreshToken) return req.body.refreshToken;
  const cookieHeader = req.headers?.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.split("=");
    acc[key.trim()] = decodeURIComponent(rest.join("=").trim());
    return acc;
  }, {});
  return cookies[REFRESH_COOKIE_NAME] || null;
};

const getGoogleClient = () => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth is not configured");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const normalizeRole = (role) => {
  const allowedRoles = ["staff", "treasurer", "designer", "other", "admin"];
  return role && allowedRoles.includes(role) ? role : "staff";
};

const buildResetUrl = (token) => {
  const base =
    process.env.RESET_PASSWORD_URL ||
    `${process.env.FRONTEND_URL || "http://localhost:8080"}/reset-password`;
  const url = new URL(base);
  url.searchParams.set("token", token);
  return url.toString();
};

const getTwoFactorApiKey = () =>
  process.env.TWO_FACTOR_API_KEY || process.env.TWOFACTOR_API_KEY || "";

const normalizeOtpPhone = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.startsWith("91") && digits.length >= 12) {
    return `+${digits}`;
  }
  return `+${digits}`;
};

router.post("/login", authLimiter, async (req, res) => {
  req.skipAudit = true;
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || user.isActive === false) {
      await logAudit({
        actorUserId: user?._id,
        actorRole: user?.role || "",
        action: "LOGIN_FAILED",
        targetId: user?._id?.toString?.() || "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { email: normalizedEmail }
      });
      return res.status(401).json({ error: "Invalid credentials." });
    }
    if (user.authProvider === "google" && !user.password) {
      await logAudit({
        actorUserId: user._id,
        actorRole: user.role,
        action: "LOGIN_FAILED",
        targetId: user._id.toString(),
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { email: normalizedEmail }
      });
      return res.status(401).json({ error: "Use Google sign-in for this account." });
    }

    const storedPassword = user.password || "";
    let passwordMatch = false;
    if (storedPassword.startsWith("$2")) {
      passwordMatch = await bcrypt.compare(password, storedPassword);
    } else {
      passwordMatch = storedPassword === password;
      if (passwordMatch) {
        user.password = await bcrypt.hash(password, 10);
        await user.save();
      }
    }

    if (!passwordMatch) {
      await logAudit({
        actorUserId: user._id,
        actorRole: user.role,
        action: "LOGIN_FAILED",
        targetId: user._id.toString(),
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { email: normalizedEmail }
      });
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const accessToken = signAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshToken(user, req);
    setRefreshCookie(res, rawToken, expiresAt);

    await logAudit({
      actorUserId: user._id,
      actorRole: user.role,
      action: "LOGIN_SUCCESS",
      targetId: user._id.toString(),
      ipAddress: req.clientIp || "",
      userAgent: req.userAgent || "",
      meta: { email: normalizedEmail }
    });

    res.json({ token: accessToken, user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: "Login failed." });
  }
});

router.post("/refresh", authLimiter, async (req, res) => {
  req.skipAudit = true;
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      await logAudit({
        actorUserId: null,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "missing" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    const tokenHash = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({ tokenHash });

    if (!storedToken) {
      await logAudit({
        actorUserId: null,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "not_found" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    if (storedToken.revokedAt || storedToken.replacedByTokenHash) {
      await logAudit({
        actorUserId: storedToken.userId,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: storedToken.userId?.toString?.() || "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "reused" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    if (storedToken.expiresAt && storedToken.expiresAt <= new Date()) {
      await logAudit({
        actorUserId: storedToken.userId,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: storedToken.userId?.toString?.() || "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "expired" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    const user = await User.findById(storedToken.userId);
    if (!user || user.isActive === false) {
      await logAudit({
        actorUserId: storedToken.userId,
        actorRole: "",
        action: "REFRESH_REUSED_DETECTED",
        targetId: storedToken.userId?.toString?.() || "",
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { reason: "user_inactive" }
      });
      return res.status(401).json({ error: "Unauthorized." });
    }

    const { rawToken, tokenHash: newHash, expiresAt } = await createRefreshToken(user, req);
    storedToken.revokedAt = new Date();
    storedToken.replacedByTokenHash = newHash;
    storedToken.revokedReason = "rotated";
    await storedToken.save();

    setRefreshCookie(res, rawToken, expiresAt);

    await logAudit({
      actorUserId: user._id,
      actorRole: user.role,
      action: "REFRESH_ROTATED",
      targetId: user._id.toString(),
      ipAddress: req.clientIp || "",
      userAgent: req.userAgent || "",
      meta: { refreshTokenId: storedToken.id }
    });

    res.json({ token: signAccessToken(user) });
  } catch (error) {
    res.status(500).json({ error: "Failed to refresh session." });
  }
});

router.post("/signup", requireRole(["admin"]), async (req, res) => {
  try {
    const { email, password, role, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedRole = normalizeRole(role);
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "Email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      password: passwordHash,
      role: normalizedRole,
      name: name || email.split("@")[0],
      authProvider: "local",
    });
    req.auditTargetId = user.id || user._id?.toString?.() || "";

    const accessToken = signAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshToken(user, req);
    setRefreshCookie(res, rawToken, expiresAt);

    res.status(201).json({ token: accessToken, user: user.toJSON() });
  } catch (error) {
    res.status(400).json({ error: "Failed to create account." });
  }
});

router.post("/password/forgot", async (req, res) => {
  try {
    const { email, phone, sessionId, otp } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }
    if (!phone || !sessionId || !otp) {
      return res.status(400).json({ error: "Phone, session ID, and OTP are required." });
    }

    const apiKey = getTwoFactorApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: "OTP service is not configured." });
    }

    const normalizedPhone = normalizeOtpPhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: "Invalid phone number." });
    }

    const verifyUrl = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${encodeURIComponent(
      sessionId
    )}/${encodeURIComponent(otp)}`;
    const verifyResponse = await fetch(verifyUrl, { method: "POST" });
    const verifyData = await verifyResponse.json().catch(() => ({}));
    const verifyStatus = String(verifyData?.Status || "").toLowerCase();
    if (!verifyResponse.ok || verifyStatus !== "success") {
      return res
        .status(400)
        .json({ error: verifyData?.Details || "OTP verification failed." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      user.passwordResetTokenHash = hashToken(token);
      user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();

      const resetUrl = buildResetUrl(token);
      await sendPasswordResetEmail({ to: user.email, resetUrl });
    }

    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to start password reset." });
  }
});

router.post("/password/otp/send", authLimiter, async (req, res) => {
  req.skipAudit = true;
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required." });
    }
    const apiKey = getTwoFactorApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: "OTP service is not configured." });
    }
    const normalized = normalizeOtpPhone(phone);
    if (!normalized) {
      return res.status(400).json({ error: "Invalid phone number." });
    }
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/${encodeURIComponent(
      normalized
    )}/AUTOGEN/OTP1`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    const status = String(data?.Status || "").toLowerCase();
    if (!response.ok || status !== "success") {
      return res
        .status(400)
        .json({ error: data?.Details || "Failed to send OTP." });
    }
    return res.json({ success: true, sessionId: data?.Details || "" });
  } catch (error) {
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

router.post("/password/otp/verify", authLimiter, async (req, res) => {
  req.skipAudit = true;
  try {
    const { sessionId, otp } = req.body;
    if (!sessionId || !otp) {
      return res.status(400).json({ error: "Session ID and OTP are required." });
    }
    const apiKey = getTwoFactorApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: "OTP service is not configured." });
    }
    const url = `https://2factor.in/API/V1/${apiKey}/SMS/VERIFY/${encodeURIComponent(
      sessionId
    )}/${encodeURIComponent(otp)}`;
    const response = await fetch(url, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    const status = String(data?.Status || "").toLowerCase();
    if (!response.ok || status !== "success") {
      return res
        .status(400)
        .json({ error: data?.Details || "OTP verification failed." });
    }
    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to verify OTP." });
  }
});

router.post("/password/reset", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required." });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token." });
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset password." });
  }
});

router.get("/google/start", (req, res) => {
  try {
    const role = req.query.role === "staff" ? "staff" : "staff";
    const stateToken = jwt.sign(
      { role, purpose: "google" },
      getJwtSecret(),
      { expiresIn: "10m" }
    );
    const oauthClient = getGoogleClient();
    const url = oauthClient.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      prompt: "select_account",
      state: stateToken,
    });
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: "Google OAuth is not configured." });
  }
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).json({ error: "Missing OAuth code." });
    }

    let statePayload;
    try {
      statePayload = jwt.verify(state, getJwtSecret());
    } catch (error) {
      return res.status(400).json({ error: "Invalid OAuth state." });
    }

    if (!statePayload || statePayload.purpose !== "google") {
      return res.status(400).json({ error: "Invalid OAuth state." });
    }

    const oauthClient = getGoogleClient();
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: oauthClient, version: "v2" });
    const { data } = await oauth2.userinfo.get();

    if (!data?.email || data.verified_email === false) {
      return res.status(400).json({ error: "Google account email is not verified." });
    }

    const normalizedEmail = data.email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      user = await User.create({
        email: normalizedEmail,
        name: data.name || normalizedEmail.split("@")[0],
        role: normalizeRole(statePayload.role),
        authProvider: "google",
        googleId: data.id,
        avatar: data.picture,
      });
    } else {
      const updates = {};
      if (!user.googleId && data.id) updates.googleId = data.id;
      if (!user.avatar && data.picture) updates.avatar = data.picture;
      if (!user.name && data.name) updates.name = data.name;
      if (Object.keys(updates).length > 0) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        user = await User.findById(user._id);
      }
    }

    if (user.isActive === false) {
      await logAudit({
        actorUserId: user._id,
        actorRole: user.role,
        action: "LOGIN_FAILED",
        targetId: user._id.toString(),
        ipAddress: req.clientIp || "",
        userAgent: req.userAgent || "",
        meta: { email: normalizedEmail, provider: "google", reason: "inactive" }
      });
      return res.status(401).json({ error: "Account is inactive." });
    }

    const token = signAccessToken(user);
    const { rawToken, expiresAt } = await createRefreshToken(user, req);
    setRefreshCookie(res, rawToken, expiresAt);

    await logAudit({
      actorUserId: user._id,
      actorRole: user.role,
      action: "LOGIN_SUCCESS",
      targetId: user._id.toString(),
      ipAddress: req.clientIp || "",
      userAgent: req.userAgent || "",
      meta: { email: normalizedEmail, provider: "google" }
    });
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    const redirectUrl = new URL("/login", frontendUrl);
    redirectUrl.searchParams.set("token", token);
    redirectUrl.searchParams.set("provider", "google");
    res.redirect(redirectUrl.toString());
  } catch (error) {
    res.status(500).json({ error: "Google OAuth login failed." });
  }
});

router.post("/logout", requireAuth, async (req, res) => {
  req.skipAudit = true;
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      await RefreshToken.updateOne(
        { tokenHash, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date(), revokedReason: "logout" } }
      );
    }
    clearRefreshCookie(res);
    await logAuditFromRequest(req, "LOGOUT", req.user?._id?.toString?.() || "");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to logout." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: "Failed to load user." });
  }
});

router.get("/preferences", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ preferences: user.notificationPreferences || {} });
  } catch (error) {
    res.status(500).json({ error: "Failed to load preferences." });
  }
});

router.patch("/preferences", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    const current = user.notificationPreferences || {};
    const next = { ...current };
    if (typeof req.body?.emailNotifications === "boolean") {
      next.emailNotifications = req.body.emailNotifications;
    }
    if (typeof req.body?.whatsappNotifications === "boolean") {
      next.whatsappNotifications = req.body.whatsappNotifications;
    }
    if (typeof req.body?.deadlineReminders === "boolean") {
      next.deadlineReminders = req.body.deadlineReminders;
    }
    user.notificationPreferences = next;
    await user.save();
    res.json({ preferences: user.notificationPreferences });
  } catch (error) {
    res.status(500).json({ error: "Failed to update preferences." });
  }
});

router.post("/users", requireRole(["admin"]), async (req, res) => {
  try {
    const { email, password, role, name } = req.body;
    const allowedRoles = ["staff", "treasurer", "designer", "other", "admin"];

    if (!email || !password || !role) {
      return res.status(400).json({ error: "Email, password, and role are required." });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "Email already exists." });
    }

    const user = await User.create({
      email,
      password,
      role,
      name: name || ""
    });
    req.auditTargetId = user.id || user._id?.toString?.() || "";

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    res.status(400).json({ error: "Failed to create user." });
  }
});

router.get("/users", requireRole(["admin"]), async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users.map((user) => user.toJSON()));
  } catch (error) {
    res.status(500).json({ error: "Failed to load users." });
  }
});

export default router;
