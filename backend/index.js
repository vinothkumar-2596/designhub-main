import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import connectDB from './lib/db.js';
import { initSocket } from './socket.js';

// Load environment variables
dotenv.config();

// Mandatory Database Connection
connectDB();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 10000;

// Socket.io Initialization
initSocket(server);

// Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(cors({
  origin: [
    "https://antigravity.vercel.app",
    process.env.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081"
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());

// Routes
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import fileRoutes from './routes/files.js';
import aiRoutes from './routes/ai.js';
import activityRoutes from './routes/activity.js';
import driveAuthRoutes from './routes/drive-auth.js';

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/drive', driveAuthRoutes);

app.get('/', (req, res) => {
  res.send('Antigravity API is running!');
});

// Start Server
server.listen(port, "0.0.0.0", () => {
  console.log(`Antigravity API listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => console.log('Server closed'));
});
