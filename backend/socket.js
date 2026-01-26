import { Server } from "socket.io";

let io;
const presenceByTask = new Map();

const ensurePresenceStore = (taskId) => {
  if (!presenceByTask.has(taskId)) {
    presenceByTask.set(taskId, new Map());
  }
  return presenceByTask.get(taskId);
};

const getPresenceSnapshot = (taskId) => {
  const store = presenceByTask.get(taskId);
  if (!store) return [];
  return Array.from(store.values()).map((entry) => ({
    userId: entry.userId,
    userName: entry.userName,
    userRole: entry.userRole,
    userEmail: entry.userEmail,
    lastSeenAt: entry.lastSeenAt,
  }));
};

const removeSocketFromPresence = (taskId, socketId) => {
  const store = presenceByTask.get(taskId);
  if (!store) return;
  for (const [userId, entry] of store.entries()) {
    if (!entry.sockets.has(socketId)) continue;
    entry.sockets.delete(socketId);
    if (entry.sockets.size === 0) {
      store.delete(userId);
    }
    break;
  }
  if (store.size === 0) {
    presenceByTask.delete(taskId);
  }
};

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    path: "/socket.io/",
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join", ({ userId }) => {
      if (!userId) return;
      socket.join(String(userId));
      console.log(`Designer joined room: ${userId}`);
    });

    socket.on("task:join", ({ taskId }) => {
      if (!taskId) return;
      socket.join(taskId);
    });

    socket.on("task:leave", ({ taskId }) => {
      if (!taskId) return;
      socket.leave(taskId);
    });

    socket.on("presence:join", ({ taskId, userId, userName, userRole, userEmail }) => {
      if (!taskId || !userId) return;
      socket.join(taskId);
      const store = ensurePresenceStore(taskId);
      const key = String(userId);
      const now = new Date().toISOString();
      const existing = store.get(key) || {
        userId: key,
        userName: userName || "Unknown",
        userRole: userRole || "",
        userEmail: userEmail || "",
        sockets: new Set(),
        lastSeenAt: now,
      };
      existing.userName = userName || existing.userName;
      existing.userRole = userRole || existing.userRole;
      existing.userEmail = userEmail || existing.userEmail;
      existing.lastSeenAt = now;
      existing.sockets.add(socket.id);
      store.set(key, existing);
      socket.data.presenceTasks = socket.data.presenceTasks || new Set();
      socket.data.presenceTasks.add(taskId);
      io.to(taskId).emit("presence:update", {
        taskId,
        viewers: getPresenceSnapshot(taskId),
      });
    });

    socket.on("presence:leave", ({ taskId }) => {
      if (!taskId) return;
      removeSocketFromPresence(taskId, socket.id);
      const snapshot = getPresenceSnapshot(taskId);
      io.to(taskId).emit("presence:update", { taskId, viewers: snapshot });
      if (socket.data.presenceTasks?.has(taskId)) {
        socket.data.presenceTasks.delete(taskId);
      }
    });

    socket.on("comment:typing", (payload) => {
      if (!payload?.taskId) return;
      socket.to(payload.taskId).emit("comment:typing", payload);
    });

    socket.on("notifications:join", ({ userId }) => {
      if (!userId) return;
      socket.join(String(userId));
    });

    socket.on("notifications:leave", ({ userId }) => {
      if (!userId) return;
      socket.leave(String(userId));
    });

    socket.on("disconnect", () => {
      if (socket.data.presenceTasks && socket.data.presenceTasks.size > 0) {
        const tasks = Array.from(socket.data.presenceTasks);
        tasks.forEach((taskId) => {
          removeSocketFromPresence(taskId, socket.id);
          io.to(taskId).emit("presence:update", {
            taskId,
            viewers: getPresenceSnapshot(taskId),
          });
        });
        socket.data.presenceTasks.clear();
      }
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};

export const getSocket = () => io;
