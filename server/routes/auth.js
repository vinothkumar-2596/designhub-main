import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

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
