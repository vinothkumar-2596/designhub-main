import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { google } from "googleapis";
import User from "../models/User.js";
import { sendPasswordResetEmail } from "../lib/notifications.js";

const router = express.Router();

const getJwtSecret = () => process.env.JWT_SECRET || "dev-secret";

const signToken = (user) => {
  const secret = getJwtSecret();
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    secret,
    { expiresIn: "7d" }
  );
};

const requireAdmin = (req, res, next) => {
  const token = req.header("x-admin-token");
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  return next();
};

const requireAuth = (req, res, next) => {
  const header = req.header("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  const token = header.replace("Bearer ", "");
  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.auth = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token." });
  }
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

const hashToken = (value) => {
  return crypto.createHash("sha256").update(value).digest("hex");
};

const buildResetUrl = (token) => {
  const base =
    process.env.RESET_PASSWORD_URL ||
    `${process.env.FRONTEND_URL || "http://localhost:8080"}/reset-password`;
  const url = new URL(base);
  url.searchParams.set("token", token);
  return url.toString();
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }
    if (user.authProvider === "google" && !user.password) {
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
      return res.status(401).json({ error: "Invalid credentials." });
    }

    res.json({ token: signToken(user), user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: "Login failed." });
  }
});

router.post("/signup", async (req, res) => {
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

    res.status(201).json({ token: signToken(user), user: user.toJSON() });
  } catch (error) {
    res.status(400).json({ error: "Failed to create account." });
  }
});

router.post("/password/forgot", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
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

    const token = signToken(user);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:8080";
    const redirectUrl = new URL("/login", frontendUrl);
    redirectUrl.searchParams.set("token", token);
    redirectUrl.searchParams.set("provider", "google");
    res.redirect(redirectUrl.toString());
  } catch (error) {
    res.status(500).json({ error: "Google OAuth login failed." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.sub);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: "Failed to load user." });
  }
});

router.post("/users", requireAdmin, async (req, res) => {
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

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    res.status(400).json({ error: "Failed to create user." });
  }
});

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users.map((user) => user.toJSON()));
  } catch (error) {
    res.status(500).json({ error: "Failed to load users." });
  }
});

export default router;
