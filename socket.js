const socketIO = require('socket.io');

let io;

module.exports = {
  init: (server) => {
    io = socketIO(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    io.on('connection', (socket) => {
      console.log("New user connected:", socket.id);

      // Join user to their private room
      socket.on("join", (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined their private room`);
      });

      // User leaves their room
      socket.on("leave", (userId) => {
        socket.leave(userId);
        console.log(`User ${userId} left their room`);
      });

      // Disconnect
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.IO not initialized');
    }
    return io;
  }
}; 