import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";

const router = express.Router();

const signToken = (user) => {
  const secret = process.env.JWT_SECRET || "dev-secret";
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

const hashOtp = (otp) => crypto.createHash("sha256").update(otp).digest("hex");

const generateOtp = () => {
  const value = Math.floor(100000 + Math.random() * 900000);
  return String(value);
};

const buildMailer = () => {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_PASS;
  if (!user || !pass) {
    return null;
  }
  const allowSelfSigned = process.env.SMTP_ALLOW_SELF_SIGNED === "true";
  if (allowSelfSigned) {
    console.warn("SMTP_ALLOW_SELF_SIGNED enabled; TLS certificate validation is relaxed.");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    tls: { rejectUnauthorized: !allowSelfSigned },
  });
};

const sendOtpEmail = async ({ to, otp }) => {
  const transporter = buildMailer();
  if (!transporter) {
    console.warn("SMTP not configured; skipping email send.");
    return false;
  }

  const from = process.env.GMAIL_SMTP_FROM || process.env.GMAIL_SMTP_USER;
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: "DesignDesk password reset code",
      text: `Your DesignDesk OTP is ${otp}. It expires in 10 minutes.`,
    });
    console.log("SMTP sendMail success:", info?.response || info?.messageId || "ok");
    return true;
  } catch (error) {
    console.error("SMTP sendMail failed:", error?.message || error);
    if (error?.response) {
      console.error("SMTP response:", error.response);
    }
    return false;
  }
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.password !== password) {
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

    const allowedRoles = ["staff", "treasurer", "designer", "other", "admin"];
    const normalizedRole = role && allowedRoles.includes(role) ? role : "staff";
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ error: "Email already exists." });
    }

    const user = await User.create({
      email,
      password,
      role: normalizedRole,
      name: name || email.split("@")[0],
    });

    res.status(201).json({ token: signToken(user), user: user.toJSON() });
  } catch (error) {
    res.status(400).json({ error: "Failed to create account." });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log("Forgot password request for:", normalizedEmail);
    const user = await User.findOne({ email: normalizedEmail });
    const shouldExposeOtp = process.env.SHOW_RESET_OTP === "true";
    if (!user && !shouldExposeOtp) {
      return res.json({ message: "If an account exists, an OTP has been sent." });
    }

    await PasswordReset.deleteMany({ email: normalizedEmail, used: false });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await PasswordReset.create({
      email: normalizedEmail,
      otpHash: hashOtp(otp),
      expiresAt,
    });

    const emailSent = await sendOtpEmail({ to: normalizedEmail, otp });
    console.log("OTP email sent:", emailSent);

    if (shouldExposeOtp) {
      return res.json({ message: "OTP generated.", otp, emailSent });
    }

    return res.json({ message: "If an account exists, an OTP has been sent." });
  } catch (error) {
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: "Email, OTP, and new password are required." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const resetEntry = await PasswordReset.findOne({
      email: normalizedEmail,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!resetEntry || resetEntry.otpHash !== hashOtp(String(otp))) {
      return res.status(401).json({ error: "Invalid or expired OTP." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.password = newPassword;
    await user.save();
    resetEntry.used = true;
    await resetEntry.save();

    res.json({ message: "Password reset successful." });
  } catch (error) {
    res.status(500).json({ error: "Failed to reset password." });
  }
});

router.post("/oauth", async (req, res) => {
  try {
    const { email, name, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedRole = role === "staff" ? "staff" : "staff";
    let user = await User.findOne({ email: normalizedEmail });

    if (user && user.role !== "staff") {
      return res.status(403).json({ error: "Only staff accounts can use this sign-in." });
    }

    if (!user) {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      user = await User.create({
        email: normalizedEmail,
        password: randomPassword,
        role: normalizedRole,
        name: name || normalizedEmail.split("@")[0],
      });
    } else if (!user.name && name) {
      user.name = name;
      await user.save();
    }

    res.json({ token: signToken(user), user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: "OAuth login failed." });
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
