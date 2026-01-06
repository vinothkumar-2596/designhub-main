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
    await ensureDemoUser();
    const server = http.createServer(app);
    initSocket(server);
    server.listen(port, () => {
      console.log(`API listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Mongo connection failed:", error);
    process.exit(1);
  });
