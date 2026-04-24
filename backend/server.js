require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Memory monitoring - Log memory usage every 5 minutes
setInterval(() => {
  const mem = process.memoryUsage();
  const heapUsed = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(mem.heapTotal / 1024 / 1024);
  const percent = Math.round((heapUsed / heapTotal) * 100);
  
  console.log(`📊 Memory: ${heapUsed}MB / ${heapTotal}MB (${percent}%)`);
  
  // Auto-GC if memory above 80%
  if (percent > 80 && global.gc) {
    console.log('🧹 Running garbage collection...');
    global.gc();
  }
}, 5 * 60 * 1000);

const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'https://retailops.vercel.app',
    'https://retail-ops.onrender.com',
    'https://data.brandcentral.in',
    'http://data.brandcentral.in',
    /\.brandcentral\.in$/,
    process.env.FRONTEND_URL,
    /\.vercel\.app$/
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection options
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

// Connect MongoDB
console.log('🔄 Connecting to MongoDB...');
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/easysell', mongoOptions)
  .then(() => {
    console.log('✅ MongoDB Connected successfully');
    console.log(`📦 Database: ${mongoose.connection.name}`);
    initializeDefaults();
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️  Server will run without database connection');
    console.log('💡 Make sure MongoDB is running or check your MONGO_URI');
  });

// MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes
const dataRoutes = require('./routes/dataRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const alertsRoutes = require('./routes/alertsRoutes');
const exportRoutes = require('./routes/exportRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const asinRoutes = require('./routes/asinRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const roleRoutes = require('./routes/roleRoutes');
const seedRoutes = require('./routes/seedRoutes');
const revenueCalculatorRoutes = require('./routes/revenueCalculatorRoutes');
const actionRoutes = require('./routes/actionRoutes');
const fileRoutes = require('./routes/fileRoutes');
const apiKeyRoutes = require('./routes/apiKeyRoutes');
const teamRoutes = require('./routes/teamRoutes');
const rulesetRoutes = require('./routes/rulesetRoutes');

app.use('/api', dataRoutes);
app.use('/api', uploadRoutes);
app.use('/api', alertsRoutes);
app.use('/api', exportRoutes);
app.use('/api', rulesetRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/asins', asinRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/revenue', revenueCalculatorRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/teams', teamRoutes);
const objectiveRoutes = require('./routes/objectiveRoutes');
app.use('/api/objectives', objectiveRoutes);
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const marketSyncRoutes = require('./routes/marketDataSyncRoutes');
const growthExecutionRoutes = require('./routes/growthExecutionRoutes');
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/market-sync', marketSyncRoutes);
app.use('/api', growthExecutionRoutes);

const systemLogRoutes = require('./routes/systemLogRoutes');
const systemSettingRoutes = require('./routes/systemSettingRoutes');
app.use('/api/logs', systemLogRoutes);
app.use('/api/settings', systemSettingRoutes);

// Brandcentral AI Strategy Routes
const aiRoutes = require('./routes/aiRoutes');
app.use('/api/strategy', aiRoutes);

// Keepa Seller ASIN Tracker Routes
const sellerAsinTrackerRoutes = require('./routes/sellerAsinTrackerRoutes');
app.use('/api/seller-tracker', sellerAsinTrackerRoutes);

// Unified Revenue Engine Routes
const revenueRoutes = require('./routes/revenueRoutes');
app.use('/api/revenue-engine', revenueRoutes);

// GMS Goal Tracking Routes
const goalRoutes = require('./routes/goalRoutes');
app.use('/api/goals', goalRoutes);

// Unified ASIN Table Routes
const asinTableRoutes = require('./routes/asinTableRoutes');
app.use('/api/asins-table', asinTableRoutes);


// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbState,
    uptime: process.uptime()
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('🚨 [GLOBAL ERROR]:', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

const PORT = process.env.PORT || 3001;
const http = require('http');
console.log('📡 Creating HTTP server...');
const server = http.createServer(app);

// --- Socket.io Integration ---
console.log('📡 Initializing Socket.io...');
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
      origin: [
      'http://localhost:5173',
      'http://localhost:5175',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'https://data.brandcentral.in',
      'http://data.brandcentral.in',
      'https://retailops.vercel.app', // Production Frontend
      process.env.FRONTEND_URL,
      /\.vercel\.app$/,
      /\.brandcentral\.in$/
    ].filter(Boolean),
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Initialize global SocketService
const SocketService = require('./services/socketService');
SocketService.init(io);

if (io) {
  console.log('✅ Socket.io initialized successfully');
} else {
  console.error('❌ Socket.io failed to initialize');
}

app.set('io', io);

server.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);

  // Start recurring task scheduler
  const recurringTaskScheduler = require('./services/recurringTaskScheduler');
  recurringTaskScheduler.start();

  // Start Keepa ASIN Sync Scheduler
  const schedulerService = require('./services/schedulerService');
  schedulerService.init();
  
  // Start ASIN Auto-Scraper (only if Octoparse automation is disabled)
  if (process.env.AUTOMATION_ENABLED !== 'true') {
    console.log('🌐 Direct Scraper initialized (Simple mode)');
    const autoScrape = require('./cron/autoScrape');
    autoScrape.init();
  } else {
    console.log('🤖 Octoparse Automation enabled - Direct scraper disabled');
  }
  
  console.log('⏰ Recurring task scheduler initialized');

  // Trigger initial CometChat sync on startup
  try {
    const { syncAllToCometChat } = require('./services/cometChatService');
    syncAllToCometChat(); // Fire and forget
  } catch (err) {
    // console.error('Initial CometChat sync failed:', err);
  }
});

const onlineUsers = new Map(); // userId -> socketId

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('join', async (userId) => {
    try {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);

      // Update user status in DB
      const User = require('./models/User');
      await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: Date.now() });

      // Join personal room
      socket.join(userId);

      // Join rooms for all active conversations
      const Conversation = require('./models/Conversation');
      const conversations = await Conversation.find({ participants: userId, isActive: true });
      conversations.forEach(conv => {
        socket.join(conv._id.toString());
      });

      console.log(`👤 User ${userId} joined their rooms`);
      io.emit('user_status_change', { userId, status: 'online' });
    } catch (err) {
      console.error('Socket join error:', err);
    }
  });

  socket.on('join_room', (roomId) => {
    if (typeof roomId === 'string') {
      socket.join(roomId);
      console.log(`🔌 Socket ${socket.id} joined room: ${roomId}`);
    }
  });

  socket.on('typing', ({ conversationId, senderId, isTyping }) => {
    socket.to(conversationId).emit('typing', { conversationId, senderId, isTyping });
  });

  socket.on('send_message', async (data) => {
    try {
      const Message = require('./models/Message');
      const Conversation = require('./models/Conversation');

      const { conversationId, senderId, content, type, fileUrl, replyTo } = data;

      const message = await Message.create({
        conversationId,
        sender: senderId,
        type: type || 'TEXT',
        content,
        fileUrl,
        replyTo
      });

      const populatedMessage = await Message.findById(message._id)
        .populate('sender', 'firstName lastName avatar')
        .populate('replyTo');

      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        updatedAt: Date.now()
      });

      io.to(conversationId).emit('receive_message', populatedMessage);
    } catch (err) {
      console.error('Socket send_message error:', err);
    }
  });

  socket.on('add_reaction', async ({ messageId, emoji, userId }) => {
    try {
      const Message = require('./models/Message');
      const message = await Message.findByIdAndUpdate(
        messageId,
        { $push: { reactions: { userId, emoji } } },
        { new: true }
      ).populate('sender', 'firstName lastName avatar');

      io.to(message.conversationId.toString()).emit('message_reaction_updated', { messageId, reactions: message.reactions });
    } catch (err) {
      console.error('Socket add_reaction error:', err);
    }
  });

  socket.on('message_read', async ({ messageId, userId }) => {
    try {
      const Message = require('./models/Message');
      const message = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { 'status.readBy': userId } },
        { new: true }
      );

      if (message) {
        io.to(message.conversationId.toString()).emit('message_status_updated', {
          messageId,
          status: message.status
        });
      }
    } catch (err) {
      console.error('Socket message_read error:', err);
    }
  });

  // Calling Signaling
  socket.on('invite_to_call', async ({ conversationId, callerId, type, receiverId }) => {
    try {
      const Call = require('./models/Call');
      const call = await Call.create({
        conversationId,
        callerId,
        receiverId,
        type,
        status: 'INITIATED'
      });

      const populatedCall = await Call.findById(call._id).populate('callerId', 'firstName lastName avatar');

      // Notify the receiver
      io.to(receiverId).emit('incoming_call', populatedCall);
      // Notify the caller (confirmation)
      socket.emit('call_initiated', populatedCall);
    } catch (err) {
      console.error('Socket invite_to_call error:', err);
    }
  });

  socket.on('accept_call', async ({ callId }) => {
    try {
      const Call = require('./models/Call');
      const call = await Call.findByIdAndUpdate(callId, {
        status: 'ONGOING',
        startedAt: new Date()
      }, { new: true }).populate('callerId receiverId');

      if (call) {
        io.to(call.callerId._id.toString()).emit('call_accepted', call);
        io.to(call.receiverId._id.toString()).emit('call_accepted', call);
      }
    } catch (err) {
      console.error('Socket accept_call error:', err);
    }
  });

  socket.on('reject_call', async ({ callId }) => {
    try {
      const Call = require('./models/Call');
      const call = await Call.findByIdAndUpdate(callId, { status: 'REJECTED' }, { new: true });
      if (call) {
        io.to(call.callerId.toString()).emit('call_rejected', { callId });
      }
    } catch (err) {
      console.error('Socket reject_call error:', err);
    }
  });

  socket.on('end_call', async ({ callId }) => {
    try {
      const Call = require('./models/Call');
      const call = await Call.findById(callId);
      if (call && call.status !== 'ENDED') {
        const endedAt = new Date();
        const duration = call.startedAt ? Math.floor((endedAt - call.startedAt) / 1000) : 0;

        const updatedCall = await Call.findByIdAndUpdate(callId, {
          status: 'ENDED',
          endedAt,
          duration
        }, { new: true });

        io.to(call.callerId.toString()).emit('call_ended', { callId, duration });
        if (call.receiverId) {
          io.to(call.receiverId.toString()).emit('call_ended', { callId, duration });
        }
      }
    } catch (err) {
      console.error('Socket end_call error:', err);
    }
  });

  // WebRTC Signaling Passthrough
  socket.on('webrtc_signal', ({ targetId, signal, callId }) => {
    io.to(targetId).emit('webrtc_signal', { fromId: socket.userId, signal, callId });
  });

  socket.on('disconnect', async () => {
    console.log('🔌 Socket disconnected:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      const User = require('./models/User');
      await User.findByIdAndUpdate(socket.userId, { isOnline: false, lastSeen: Date.now() });
      io.emit('user_status_change', { userId: socket.userId, status: 'offline' });
    }
  });
});

// Initialize defaults
const initializeDefaults = async () => {
  try {
    // Initialize default alert rules
    const { AlertRule } = require('./models/AlertModel');
    const existingRules = await AlertRule.countDocuments();

    if (existingRules === 0) {
      console.log('🔧 Initializing default alert rules');

      const defaultRules = [
        {
          name: 'Revenue Drop Alert',
          type: 'revenue',
          condition: { metric: 'revenue', operator: 'decrease', value: 10, period: '7d' },
          severity: 'warning',
          active: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          name: 'Low Inventory Alert',
          type: 'inventory',
          condition: { metric: 'stock', operator: '<', value: 50, period: '1d' },
          severity: 'critical',
          active: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        },
        {
          name: 'High ACOS Alert',
          type: 'ads',
          condition: { metric: 'acos', operator: '>', value: 25, period: '7d' },
          severity: 'warning',
          active: true,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01')
        }
      ];

      await AlertRule.insertMany(defaultRules);
      console.log('✅ Default alert rules initialized');
    }

    // Initialize roles and permissions
    const Role = require('./models/Role');
    const Permission = require('./models/Permission');
    const existingRoles = await Role.countDocuments();

    if (existingRoles === 0) {
      console.log('🔧 Initializing roles and permissions');
      await Role.seedDefaultRoles(Permission);
      console.log('✅ Default roles and permissions initialized');
    }

    // Create admin user if not exists
    const User = require('./models/User');
    const existingAdmin = await User.findOne({ email: 'admin@gms.com' });

    if (!existingAdmin) {
      console.log('🔧 Creating admin user');
      const adminRole = await Role.findOne({ name: 'admin' });
      if (adminRole) {
        await User.create({
          email: 'admin@gms.com',
          password: 'admin123',
          firstName: 'Admin',
          lastName: 'User',
          role: adminRole._id,
          isEmailVerified: true,
        });
        console.log('✅ Admin user created (email: admin@gms.com, password: admin123)');
      }
    }

    // Initialize Revenue Calculator data
    const { seedInitialData } = require('./models/RevenueCalculatorModel');
    await seedInitialData();
  } catch (error) {
    console.error('❌ Error initializing defaults:', error);
  }
};
