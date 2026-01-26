import { Server } from "socket.io";

let io;
const presenceByTask = new Map();
const globalPresence = new Map();
const globalTyping = new Map();

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

const getGlobalPresenceSnapshot = () =>
  Array.from(globalPresence.values()).map((entry) => ({
    userId: entry.userId,
    userName: entry.userName,
    userRole: entry.userRole,
    userEmail: entry.userEmail,
    lastSeenAt: entry.lastSeenAt,
  }));

const removeSocketFromGlobalPresence = (userId, socketId) => {
  if (!userId) return;
  const entry = globalPresence.get(userId);
  if (!entry) return;
  entry.sockets.delete(socketId);
  if (entry.sockets.size === 0) {
    globalPresence.delete(userId);
  }
};

const getGlobalTypingSnapshot = () =>
  Array.from(globalTyping.values()).map((entry) => ({
    userId: entry.userId,
    userName: entry.userName,
    userRole: entry.userRole,
    userEmail: entry.userEmail,
    lastTypingAt: entry.lastTypingAt,
  }));

const removeSocketFromGlobalTyping = (userId, socketId) => {
  if (!userId) return;
  const entry = globalTyping.get(userId);
  if (!entry) return;
  entry.sockets.delete(socketId);
  if (entry.sockets.size === 0) {
    globalTyping.delete(userId);
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
      if (!payload.userId) return;
      const key = String(payload.userId);
      if (payload.isTyping) {
        const now = new Date().toISOString();
        const existing = globalTyping.get(key) || {
          userId: key,
          userName: payload.userName || "Unknown",
          userRole: payload.userRole || "",
          userEmail: payload.userEmail || "",
          sockets: new Set(),
          lastTypingAt: now,
        };
        existing.userName = payload.userName || existing.userName;
        existing.userRole = payload.userRole || existing.userRole;
        existing.userEmail = payload.userEmail || existing.userEmail;
        existing.lastTypingAt = now;
        existing.sockets.add(socket.id);
        globalTyping.set(key, existing);
      } else {
        removeSocketFromGlobalTyping(key, socket.id);
      }
      io.to("presence:global").emit("typing:global:update", {
        typers: getGlobalTypingSnapshot(),
      });
    });

    socket.on("notifications:join", ({ userId }) => {
      if (!userId) return;
      socket.join(String(userId));
    });

    socket.on("notifications:leave", ({ userId }) => {
      if (!userId) return;
      socket.leave(String(userId));
    });

    socket.on("presence:global:join", ({ userId, userName, userRole, userEmail }) => {
      if (!userId) return;
      const key = String(userId);
      const now = new Date().toISOString();
      const existing = globalPresence.get(key) || {
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
      globalPresence.set(key, existing);
      socket.data.globalPresenceUserId = key;
      socket.join("presence:global");
      io.to("presence:global").emit("presence:global:update", {
        viewers: getGlobalPresenceSnapshot(),
      });
    });

    socket.on("presence:global:leave", ({ userId }) => {
      const key = userId ? String(userId) : socket.data.globalPresenceUserId;
      if (!key) return;
      removeSocketFromGlobalPresence(key, socket.id);
      removeSocketFromGlobalTyping(key, socket.id);
      socket.leave("presence:global");
      io.to("presence:global").emit("presence:global:update", {
        viewers: getGlobalPresenceSnapshot(),
      });
      io.to("presence:global").emit("typing:global:update", {
        typers: getGlobalTypingSnapshot(),
      });
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
      if (socket.data.globalPresenceUserId) {
        removeSocketFromGlobalPresence(socket.data.globalPresenceUserId, socket.id);
        io.to("presence:global").emit("presence:global:update", {
          viewers: getGlobalPresenceSnapshot(),
        });
      }
      if (socket.data.globalPresenceUserId) {
        removeSocketFromGlobalTyping(socket.data.globalPresenceUserId, socket.id);
        io.to("presence:global").emit("typing:global:update", {
          typers: getGlobalTypingSnapshot(),
        });
      }
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};

export const getSocket = () => io;
