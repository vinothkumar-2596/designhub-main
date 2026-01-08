import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file if it exists (local development)
try {
  dotenv.config({ path: new URL("../.env", import.meta.url) });
} catch (err) {
  console.log("No .env file found, using environment variables");
}

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 4000;

// Request Logger
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});

// Minimal Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: "minimal" });
  console.log("[HEALTH] Response sent");
});

// Minimal Root Route
app.get("/", (req, res) => {
  res.send("Backend is running! Mode: Minimal");
});

// Use app.listen directly - Explicitly bind to 0.0.0.0 for Railway
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Minimal API listening on port ${port}`);
  console.log(`Server bound to 0.0.0.0:${port}`);
  console.log(`Environment PORT: ${process.env.PORT || 'not set'}`);
});

// Fix for 502 Bad Gateway errors behind proxies (Railway/AWS/Nginx)
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful Shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
