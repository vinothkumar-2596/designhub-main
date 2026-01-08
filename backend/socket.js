import { Server } from "socket.io";

let io;

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
    socket.on("task:join", ({ taskId }) => {
      if (!taskId) return;
      socket.join(taskId);
    });

    socket.on("task:leave", ({ taskId }) => {
      if (!taskId) return;
      socket.leave(taskId);
    });

    socket.on("comment:typing", (payload) => {
      if (!payload?.taskId) return;
      socket.to(payload.taskId).emit("comment:typing", payload);
    });
  });

  return io;
};

export const getSocket = () => io;
