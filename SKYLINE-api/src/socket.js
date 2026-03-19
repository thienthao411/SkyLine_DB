const { Server } = require("socket.io");

let ioInstance = null;

function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE"]
    }
  });

  ioInstance.on("connection", (socket) => {
    socket.on("join_admin", () => {
      socket.join("admins");
    });

    socket.on("join_booking", (ticketCode) => {
      const code = String(ticketCode || "").trim();
      if (!code) return;
      socket.join(`booking:${code}`);
    });

    socket.on("join_user", (email) => {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      if (!normalizedEmail) return;
      socket.join(`user:${normalizedEmail}`);
    });
  });

  return ioInstance;
}

function getIO() {
  return ioInstance;
}

module.exports = {
  initSocket,
  getIO
};
