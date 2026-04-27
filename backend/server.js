require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getPool, sql } = require('./database/db');

// Memory monitoring
setInterval(() => {
  const mem = process.memoryUsage();
  const heapUsed = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(mem.heapTotal / 1024 / 1024);
  const percent = Math.round((heapUsed / heapTotal) * 100);
  
  console.log(`📊 Memory: ${heapUsed}MB / ${heapTotal}MB (${percent}%)`);
  
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
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SQL Server connection verification
async function verifySqlConnection() {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as test');
    console.log('✅ SQL Server Connected successfully');
  } catch (err) {
    console.error('❌ SQL Server Connection Error:', err.message);
    console.log('⚠️  Server will continue, but SQL-dependent features will not work');
  }
}

verifySqlConnection();

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Routes (same as before)
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
const objectiveRoutes = require('./routes/objectiveRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const marketSyncRoutes = require('./routes/marketDataSyncRoutes');
const growthExecutionRoutes = require('./routes/growthExecutionRoutes');
const systemLogRoutes = require('./routes/systemLogRoutes');
const systemSettingRoutes = require('./routes/systemSettingRoutes');
const aiRoutes = require('./routes/aiRoutes');
const sellerAsinTrackerRoutes = require('./routes/sellerAsinTrackerRoutes');
const revenueRoutes = require('./routes/revenueRoutes');
const goalRoutes = require('./routes/goalRoutes');
const asinTableRoutes = require('./routes/asinTableRoutes');
const listingQualityRoutes = require('./routes/listingQualityRoutes');

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
app.use('/api/objectives', objectiveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/market-sync', marketSyncRoutes);
app.use('/api', growthExecutionRoutes);
app.use('/api/logs', systemLogRoutes);
app.use('/api/settings', systemSettingRoutes);
app.use('/api/strategy', aiRoutes);
app.use('/api/seller-tracker', sellerAsinTrackerRoutes);
app.use('/api/revenue-engine', revenueRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/asins-table', asinTableRoutes);
app.use('/api/listing-quality', listingQualityRoutes);

// Health check endpoint - SQL version
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 as test');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'sql-server-connected',
      uptime: process.uptime()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: err.message
    });
  }
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

// Increase timeouts for large data uploads (Octoparse ingestion)
server.timeout = 600000; // 10 minutes
server.keepAliveTimeout = 610000;
server.headersTimeout = 620000;

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
      process.env.FRONTEND_URL,
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

if (io) console.log('✅ Socket.io initialized successfully');
else console.error('❌ Socket.io failed to initialize');

app.set('io', io);

const onlineUsers = new Map();

io.on('connection', async (socket) => {
  console.log('🔌 New client connected:', socket.id);

  socket.on('join', async (userId) => {
    try {
      socket.userId = userId;
      onlineUsers.set(userId, socket.id);

      // Update user status in DB using SQL
      const pool = await getPool();
      await pool.request()
        .input('id', sql.VarChar, userId)
        .query("UPDATE Users SET IsOnline = 1, LastSeen = GETDATE() WHERE Id = @id");

      // Get user's assigned sellers to join rooms
      const sellersResult = await pool.request()
        .input('userId', sql.VarChar, userId)
        .query("SELECT SellerId FROM UserSellers WHERE UserId = @userId");

      // Join personal room
      socket.join(userId);

      // Join rooms for each seller
      sellersResult.recordset.forEach(row => {
        socket.join(`seller:${row.SellerId}`);
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
      const { conversationId, senderId, content, type, fileUrl, replyTo } = data;
      const pool = await getPool();

      // Check participant
      const partCheck = await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('userId', sql.VarChar, senderId)
        .query(`SELECT 1 FROM ConversationParticipants WHERE ConversationId = @convId AND UserId = @userId`);

      if (partCheck.recordset.length === 0) {
        return; // Not authorized
      }

      const messageId = require('crypto').randomUUID().replace(/-/g, '').substring(0, 24);

      await pool.request()
        .input('Id', sql.VarChar, messageId)
        .input('ConversationId', sql.VarChar, conversationId)
        .input('SenderId', sql.VarChar, senderId)
        .input('Type', sql.NVarChar, type || 'TEXT')
        .input('Content', sql.NVarChar, content)
        .input('FileUrl', sql.NVarChar, fileUrl || null)
        .input('ReplyToId', sql.VarChar, replyTo || null)
        .query(`
          INSERT INTO Messages (Id, ConversationId, SenderId, Type, Content, FileUrl, ReplyToId, CreatedAt)
          VALUES (@Id, @ConversationId, @SenderId, @Type, @Content, @FileUrl, @ReplyToId, GETDATE())
        `);

      await pool.request()
        .input('convId', sql.VarChar, conversationId)
        .input('msgId', sql.VarChar, messageId)
        .query(`UPDATE Conversations SET LastMessageId = @msgId, UpdatedAt = GETDATE() WHERE Id = @convId`);

      const msgResult = await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .query(`
          SELECT m.*, u.FirstName, u.LastName, u.Avatar
          FROM Messages m
          JOIN Users u ON m.SenderId = u.Id
          WHERE m.Id = @msgId
        `);

      const populatedMessage = msgResult.recordset[0];
      io.to(conversationId).emit('receive_message', populatedMessage);
    } catch (err) {
      console.error('Socket send_message error:', err);
    }
  });

  socket.on('add_reaction', async ({ messageId, emoji, userId }) => {
    try {
      const pool = await getPool();
      const { sql } = require('./database/db');

      await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .input('uid', sql.VarChar, userId)
        .input('emoji', sql.NVarChar, emoji)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM MessageReactions WHERE MessageId = @msgId AND UserId = @uid AND Emoji = @emoji
          )
          BEGIN
            INSERT INTO MessageReactions (MessageId, UserId, Emoji, CreatedAt)
            VALUES (@msgId, @uid, @emoji, GETDATE())
          END
        `);

      const reactionsResult = await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .query(`SELECT Emoji, COUNT(*) as count FROM MessageReactions WHERE MessageId = @msgId GROUP BY Emoji`);

      io.to(conversationIdFromMessage(messageId)).emit('message_reaction_updated', {
        messageId,
        reactions: reactionsResult.recordset
      });
    } catch (err) {
      console.error('Socket add_reaction error:', err);
    }
  });

  socket.on('message_read', async ({ messageId, userId }) => {
    try {
      const pool = await getPool();
      await pool.request()
        .input('msgId', sql.VarChar, messageId)
        .input('userId', sql.VarChar, userId)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM MessageStatus WHERE MessageId = @msgId AND UserId = @userId
          )
          BEGIN
            INSERT INTO MessageStatus (MessageId, UserId, IsRead, ReadAt)
            VALUES (@msgId, @userId, 1, GETDATE())
          END
        `);
    } catch (err) {
      console.error('Socket message_read error:', err);
    }
  });

  socket.on('invite_to_call', async ({ conversationId, callerId, type, receiverId }) => {
    try {
      const pool = await getPool();
      const { sql, generateId } = require('./database/db');
      const callId = generateId();

      await pool.request()
        .input('Id', sql.VarChar, callId)
        .input('ConversationId', sql.VarChar, conversationId)
        .input('CallerId', sql.VarChar, callerId)
        .input('ReceiverId', sql.VarChar, receiverId)
        .input('Type', sql.NVarChar, type)
        .input('Status', sql.NVarChar, 'INITIATED')
        .query(`
          INSERT INTO CallLogs (Id, ConversationId, CallerId, ReceiverId, Type, Status, StartedAt)
          VALUES (@Id, @ConversationId, @CallerId, @ReceiverId, @Type, @Status, GETDATE())
        `);

      io.to(receiverId).emit('incoming_call', { callId, conversationId, callerId, type, status: 'INITIATED' });
      socket.emit('call_initiated', { callId, conversationId, callerId, type, status: 'INITIATED' });
    } catch (err) {
      console.error('Socket invite_to_call error:', err);
    }
  });

  socket.on('accept_call', async ({ callId }) => {
    try {
      const pool = await getPool();
      await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`UPDATE CallLogs SET Status = 'ONGOING', StartedAt = GETDATE() WHERE Id = @callId AND Status = 'INITIATED'`);

      const callResult = await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`
          SELECT cl.*, u1.FirstName + ' ' + u1.LastName as callerName, u2.FirstName + ' ' + u2.LastName as receiverName
          FROM CallLogs cl
          JOIN Users u1 ON cl.CallerId = u1.Id
          JOIN Users u2 ON cl.ReceiverId = u2.Id
          WHERE cl.Id = @callId
        `);

      const call = callResult.recordset[0];
      if (call) {
        io.to(call.CallerId).emit('call_accepted', call);
        io.to(call.ReceiverId).emit('call_accepted', call);
      }
    } catch (err) {
      console.error('Socket accept_call error:', err);
    }
  });

  socket.on('reject_call', async ({ callId }) => {
    try {
      const pool = await getPool();
      await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`UPDATE CallLogs SET Status = 'REJECTED' WHERE Id = @callId AND Status = 'INITIATED'`);

      const callResult = await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`SELECT CallerId FROM CallLogs WHERE Id = @callId`);

      if (callResult.recordset.length > 0) {
        io.to(callResult.recordset[0].CallerId).emit('call_rejected', { callId });
      }
    } catch (err) {
      console.error('Socket reject_call error:', err);
    }
  });

  socket.on('end_call', async ({ callId }) => {
    try {
      const pool = await getPool();
      const callResult = await pool.request()
        .input('callId', sql.VarChar, callId)
        .query(`SELECT * FROM CallLogs WHERE Id = @callId AND Status = 'ONGOING'`);

      if (callResult.recordset.length === 0) return;

      const call = callResult.recordset[0];
      const endedAt = new Date();
      const duration = call.StartedAt ? Math.floor((endedAt - new Date(call.StartedAt)) / 1000) : 0;

      await pool.request()
        .input('callId', sql.VarChar, callId)
        .input('duration', sql.Int, duration)
        .query(`UPDATE CallLogs SET Status = 'ENDED', EndedAt = GETDATE(), Duration = @duration WHERE Id = @callId`);

      io.to(call.CallerId).emit('call_ended', { callId, duration });
      if (call.ReceiverId) {
        io.to(call.ReceiverId).emit('call_ended', { callId, duration });
      }
    } catch (err) {
      console.error('Socket end_call error:', err);
    }
  });

  socket.on('disconnect', async () => {
    console.log('🔌 Socket disconnected:', socket.id);
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      try {
        const pool = await getPool();
        await pool.request()
          .input('id', sql.VarChar, socket.userId)
          .query("UPDATE Users SET IsOnline = 0, LastSeen = GETDATE() WHERE Id = @id");
      } catch (e) {}
      io.emit('user_status_change', { userId: socket.userId, status: 'offline' });
    }
  });
});

// Make sql and getPool available globally for socket handlers
global.getPool = getPool;
global.sql = require('./database/db').sql;

server.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);

  const recurringTaskScheduler = require('./services/recurringTaskScheduler');
  recurringTaskScheduler.start();

  const schedulerService = require('./services/schedulerService');
  schedulerService.init();

  if (process.env.AUTOMATION_ENABLED !== 'true') {
    console.log('🌐 Direct Scraper initialized (Simple mode)');
    const autoScrape = require('./cron/autoScrape');
    autoScrape.init();
  } else {
    console.log('🤖 Octoparse Automation enabled - Direct scraper disabled');
  }

  try {
    const { syncAllToCometChat } = require('./services/cometChatService');
    syncAllToCometChat();
  } catch (err) {}
});

// Make getPool available globally for socket handlers
global.getPool = getPool;
global.sql = sql;

// Helper to get conversation ID from message ID
function conversationIdFromMessage(messageId) {
  return '';
}
