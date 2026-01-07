import express from "express";
import http from "http";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import taskRoutes from "./routes/tasks.js";
import activityRoutes from "./routes/activity.js";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import driveAuthRoutes from "./routes/drive-auth.js";
import aiRoutes from "./routes/ai.js";
import User from "./models/User.js";
import { initSocket } from "./socket.js";
import { startReminderService } from "./lib/reminders.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: new URL("../.env", import.meta.url) });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/tasks", taskRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/drive", driveAuthRoutes);
app.use("/api/ai", aiRoutes);

// Serve static files from the React app
app.use(express.static(path.join(__dirname, "../dist")));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

const port = process.env.PORT || 4000;
const mongoUri = process.env.MONGODB_URI;
const demoEmail = process.env.DEMO_USER_EMAIL || "demo@designhub";
const demoPassword = process.env.DEMO_USER_PASSWORD || "design@123";
const demoRole = process.env.DEMO_USER_ROLE || "staff";

if (!mongoUri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

const dbName = process.env.MONGODB_DB || undefined;

const ensureDemoUser = async () => {
  const email = demoEmail.toLowerCase().trim();
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      email,
      password: demoPassword,
      role: demoRole,
      name: "Demo User"
    });
    return;
  }
  const nextRole = demoRole;
  const nextPassword = demoPassword;
  const nextName = "Demo User";
  if (
    existing.password !== nextPassword ||
    existing.role !== nextRole ||
    existing.name !== nextName
  ) {
    existing.password = nextPassword;
    existing.role = nextRole;
    existing.name = nextName;
    await existing.save();
  }
};

mongoose
  .connect(mongoUri, dbName ? { dbName } : undefined)
  .then(async () => {
    console.log("Connected to MongoDB successfully");
    await ensureDemoUser();
    const server = http.createServer(app);
    initSocket(server);
    startReminderService();
    server.listen(port, "0.0.0.0", () => {
      console.log(`API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Mongo connection failed:", error);
    process.exit(1);
  });
