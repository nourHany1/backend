const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIO = require('./socket');
require('dotenv').config();

// Import routes
const driverRoutes = require('./routes/drivers');
const rideRoutes = require('./routes/rides');
const notificationRoutes = require('./routes/notifications');
const aiRoutes = require('./routes/ai'); // New AI routes

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/trips', require('./routes/trips'));
app.use('/api/users', require('./routes/users'));
app.use('/api/drivers', driverRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes); // Use new AI routes

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('تم الاتصال بقاعدة البيانات'))
  .catch(err => console.error('خطأ في الاتصال بقاعدة البيانات:', err));

// تهيئة Socket.IO
const io = socketIO.init(server);

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('updateLocation', (data) => {
    socket.broadcast.emit('locationUpdated', data);
  });

  socket.on('tripStatusChanged', (data) => {
    socket.broadcast.emit('tripStatusUpdated', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'حدث خطأ في الخادم' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`الخادم يعمل على المنفذ ${PORT}`);
});


