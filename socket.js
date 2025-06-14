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
      console.log('مستخدم جديد متصل:', socket.id);

      // انضمام المستخدم إلى غرفة خاصة به
      socket.on('join', (userId) => {
        socket.join(userId);
        console.log(`المستخدم ${userId} انضم إلى غرفته الخاصة`);
      });

      // مغادرة المستخدم لغرفته
      socket.on('leave', (userId) => {
        socket.leave(userId);
        console.log(`المستخدم ${userId} غادر غرفته`);
      });

      // قطع الاتصال
      socket.on('disconnect', () => {
        console.log('مستخدم قطع الاتصال:', socket.id);
      });
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error('Socket.IO غير مهيأ');
    }
    return io;
  }
}; 