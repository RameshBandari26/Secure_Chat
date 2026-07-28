const express = require('express');
const dotenv = require('dotenv');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const connectDB = require('./config/db'); // <-- Mongoose connection helper


dotenv.config();

// -----------------------------------------------------------------
// 1. Connect to MongoDB using Mongoose (see config/db.js for details)
// -----------------------------------------------------------------
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Raised from the default ~100kb since profile-picture uploads are sent
// as base64 data URLs (see components/SettingsModal.jsx), which are
// roughly 33% larger than the original image file.
app.use(express.json({ limit: "5mb" }));
app.use(cors());

// Routes
const userRoutes = require('./routes/userRoutes');
const messageRoutes = require('./routes/messageRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/connections', connectionRoutes);

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'ChatApp API is running' });
});

// -----------------------------------------------------------------
// 2. Wrap the Express app in a plain http.Server so Socket.IO can
//    attach to the *same* port as the REST API.
// -----------------------------------------------------------------
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // tighten this to your frontend URL in production
    methods: ['GET', 'POST'],
  },
});

// Make io available inside controllers via req.app.get('io')
app.set('io', io);

// -----------------------------------------------------------------
// 3. Real-time chat events
// -----------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Client tells us who they are (their logged-in user id) right after
  // connecting, so we can push them personal events - new chat
  // requests, request-accepted notifications - regardless of which
  // conversation room they currently have open.
  socket.on('registerUser', (userId) => {
    if (userId) socket.join(`user_${userId}`);
  });

  // Client tells us which room (chat) it wants to join
  socket.on('joinRoom', (room = 'global') => {
    socket.join(room);
  });

  // Client tells us it's switching away from a conversation, so we
  // stop delivering that room's events to it (used when a user opens
  // a different 1-on-1 chat from the sidebar).
  socket.on('leaveRoom', (room) => {
    if (room) socket.leave(room);
  });

  // Optional: allow sending messages purely over the socket instead
  // of the REST endpoint. The REST route (POST /api/messages) is the
  // recommended path since it also persists to MongoDB via Mongoose.
  socket.on('typing', ({ room = 'global', user }) => {
    socket.to(room).emit('typing', { user });
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export the app for testing purposes
module.exports = app;
