const { sql, getPool, generateId } = require('../database/db');
const SocketService = require('../services/socketService');

/**
 * Get all conversations for the logged-in user (SQL Version)
 */
exports.getConversations = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        // Get conversations where user is a participant with participant details
        const convResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query(`
                SELECT c.*,
                       s.Name as sellerName, s.Marketplace as sellerMarketplace, s.SellerId as sellerSellerId
                FROM Conversations c
                LEFT JOIN Sellers s ON c.SellerId = s.Id
                WHERE c.Id IN (
                    SELECT ConversationId FROM ConversationParticipants
                    WHERE UserId = @userId
                )
                AND c.IsActive = 1
                ORDER BY c.UpdatedAt DESC
            `);

        const conversations = convResult.recordset;

        // Enhance each conversation with participants, last message, and unread count
        const enhancedConversations = await Promise.all(conversations.map(async (conv) => {
            // Get participants
            const partsResult = await pool.request()
                .input('convId', sql.VarChar, conv.Id)
                .query(`
                    SELECT u.Id, u.FirstName, u.LastName, u.Email, u.Avatar, u.Role, u.IsOnline, u.LastSeen
                    FROM ConversationParticipants cp
                    JOIN Users u ON cp.UserId = u.Id
                    WHERE cp.ConversationId = @convId
                `);

            // Get last message with sender
            const lastMsgResult = await pool.request()
                .input('convId', sql.VarChar, conv.Id)
                .query(`
                    SELECT TOP 1 m.*, u.FirstName as senderFirstName, u.LastName as senderLastName, u.Avatar as senderAvatar
                    FROM Messages m
                    LEFT JOIN Users u ON m.SenderId = u.Id
                    WHERE m.ConversationId = @convId
                    ORDER BY m.CreatedAt DESC
                `);

            const lastMessage = lastMsgResult.recordset[0] || null;

            // Count unread messages (messages not sent by user and not read)
            // Simplified: count messages where no MessageStatus entry exists for this user
            const unreadResult = await pool.request()
                .input('convId', sql.VarChar, conv.Id)
                .input('userId', sql.VarChar, userId)
                .query(`
                    SELECT COUNT(*) as cnt FROM Messages m
                    WHERE m.ConversationId = @convId
                      AND m.SenderId != @userId
                      AND NOT EXISTS (
                          SELECT 1 FROM MessageStatus ms
                          WHERE ms.MessageId = m.Id AND ms.UserId = @userId AND ms.IsRead = 1
                      )
                `);

            const unreadCount = unreadResult.recordset[0]?.cnt || 0;

            return {
                ...conv,
                participants: partsResult.recordset,
                lastMessage: lastMessage ? {
                    ...lastMessage,
                    sender: {
                        firstName: lastMessage.senderFirstName,
                        lastName: lastMessage.senderLastName,
                        avatar: lastMessage.senderAvatar
                    }
                } : null,
                unreadCount
            };
        }));

        res.json({ success: true, data: enhancedConversations });
    } catch (error) {
        console.error('Error fetching conversations:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get or Create a conversation between participants
exports.getOrCreateConversation = async (req, res) => {
    try {
        const { participantId, sellerId } = req.body;
        const currentUserId = req.user.Id || req.user._id;

        if (!participantId) {
            return res.status(400).json({ success: false, message: 'Participant ID is required' });
        }

        if (participantId === currentUserId.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot start a chat with yourself' });
        }

        const pool = await getPool();

        // Check if direct conversation already exists between these two users
        const existingResult = await pool.request()
            .input('userId1', sql.VarChar, currentUserId)
            .input('userId2', sql.VarChar, participantId)
            .input('sellerId', sql.VarChar, sellerId || null)
            .query(`
                SELECT c.*, s.Name as sellerName, s.Marketplace as sellerMarketplace
                FROM Conversations c
                LEFT JOIN Sellers s ON c.SellerId = s.Id
                WHERE c.Id IN (
                    SELECT ConversationId FROM ConversationParticipants WHERE UserId = @userId1
                    INTERSECT
                    SELECT ConversationId FROM ConversationParticipants WHERE UserId = @userId2
                )
                AND c.Type = 'DIRECT'
                AND (c.SellerId = @sellerId OR @sellerId IS NULL)
            `);

        if (existingResult.recordset.length > 0) {
            const conversation = existingResult.recordset[0];
            // Get participants
            const partsResult = await pool.request()
                .input('convId', sql.VarChar, conversation.Id)
                .query(`
                    SELECT u.Id, u.FirstName, u.LastName, u.Email, u.Avatar, u.Role, u.IsOnline, u.LastSeen
                    FROM ConversationParticipants cp
                    JOIN Users u ON cp.UserId = u.Id
                    WHERE cp.ConversationId = @convId
                `);
            conversation.participants = partsResult.recordset;
            return res.json({ success: true, data: conversation });
        }

        // Create new conversation
        const convId = generateId();

        await pool.request()
            .input('Id', sql.VarChar, convId)
            .input('Type', sql.NVarChar, 'DIRECT')
            .input('SellerId', sql.VarChar, sellerId || null)
            .query(`
                INSERT INTO Conversations (Id, Type, SellerId, IsActive, CreatedAt, UpdatedAt)
                VALUES (@Id, @Type, @SellerId, 1, GETDATE(), GETDATE())
            `);

        // Add participants
        await pool.request()
            .input('convId', sql.VarChar, convId)
            .input('userId', sql.VarChar, currentUserId)
            .query("INSERT INTO ConversationParticipants (ConversationId, UserId) VALUES (@convId, @userId)");

        await pool.request()
            .input('convId', sql.VarChar, convId)
            .input('userId', sql.VarChar, participantId)
            .query("INSERT INTO ConversationParticipants (ConversationId, UserId) VALUES (@convId, @userId)");

        // Fetch created conversation with details
        const newConvResult = await pool.request()
            .input('convId', sql.VarChar, convId)
            .query(`
                SELECT c.*, s.Name as sellerName, s.Marketplace as sellerMarketplace
                FROM Conversations c
                LEFT JOIN Sellers s ON c.SellerId = s.Id
                WHERE c.Id = @convId
            `);

        const conv = newConvResult.recordset[0];

        // Get participants
        const partsResult = await pool.request()
            .input('convId', sql.VarChar, convId)
            .query(`
                SELECT u.Id, u.FirstName, u.LastName, u.Email, u.Avatar, u.Role, u.IsOnline, u.LastSeen
                FROM ConversationParticipants cp
                JOIN Users u ON cp.UserId = u.Id
                WHERE cp.ConversationId = @convId
            `);
        conv.participants = partsResult.recordset;

        res.json({ success: true, data: conv });
    } catch (error) {
        console.error('Error in getOrCreateConversation:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Get messages for a specific conversation
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { limit = 50, skip = 0 } = req.query;
        const userId = req.user.Id || req.user._id;

        const pool = await getPool();

        // Verify user is participant
        const partCheck = await pool.request()
            .input('convId', sql.VarChar, conversationId)
            .input('userId', sql.VarChar, userId)
            .query(`
                SELECT 1 FROM ConversationParticipants
                WHERE ConversationId = @convId AND UserId = @userId
            `);

        if (partCheck.recordset.length === 0) {
            return res.status(403).json({ success: false, message: 'Not a participant' });
        }

        const messagesResult = await pool.request()
            .input('convId', sql.VarChar, conversationId)
            .input('skip', sql.Int, parseInt(skip))
            .input('limit', sql.Int, parseInt(limit))
            .query(`
                SELECT m.*,
                       u.FirstName as senderFirstName, u.LastName as senderLastName, u.Avatar as senderAvatar
                FROM Messages m
                LEFT JOIN Users u ON m.SenderId = u.Id
                WHERE m.ConversationId = @convId
                ORDER BY m.CreatedAt DESC
                OFFSET @skip ROWS FETCH NEXT @limit ROWS ONLY
            `);

        const messages = messagesResult.recordset.map(m => ({
            ...m,
            sender: {
                firstName: m.senderFirstName,
                lastName: m.senderLastName,
                avatar: m.senderAvatar
            }
        }));

        res.json({ success: true, data: messages.reverse() });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Send message in a conversation
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId, content, type = 'TEXT', fileUrl, replyTo } = req.body;
        const senderId = req.user.Id || req.user._id;

        if (!conversationId || !content) {
            return res.status(400).json({ success: false, message: 'Conversation ID and content required' });
        }

        const pool = await getPool();

        // Verify user is participant
        const partCheck = await pool.request()
            .input('convId', sql.VarChar, conversationId)
            .input('userId', sql.VarChar, senderId)
            .query(`
                SELECT 1 FROM ConversationParticipants
                WHERE ConversationId = @convId AND UserId = @userId
            `);

        if (partCheck.recordset.length === 0) {
            return res.status(403).json({ success: false, message: 'Not a participant' });
        }

        const messageId = generateId();

        // Create message
        await pool.request()
            .input('Id', sql.VarChar, messageId)
            .input('ConversationId', sql.VarChar, conversationId)
            .input('SenderId', sql.VarChar, senderId)
            .input('Type', sql.NVarChar, type)
            .input('Content', sql.NVarChar, content)
            .input('FileUrl', sql.NVarChar, fileUrl || null)
            .input('ReplyToId', sql.VarChar, replyTo || null)
            .query(`
                INSERT INTO Messages (Id, ConversationId, SenderId, Type, Content, FileUrl, ReplyToId, CreatedAt)
                VALUES (@Id, @ConversationId, @SenderId, @Type, @Content, @FileUrl, @ReplyToId, GETDATE())
            `);

        // Update conversation lastMessage
        await pool.request()
            .input('convId', sql.VarChar, conversationId)
            .input('msgId', sql.VarChar, messageId)
            .query(`UPDATE Conversations SET LastMessageId = @msgId, UpdatedAt = GETDATE() WHERE Id = @convId`);

        // Fetch created message with sender info
        const msgResult = await pool.request()
            .input('msgId', sql.VarChar, messageId)
            .query(`
                SELECT m.*, u.FirstName, u.LastName, u.Avatar
                FROM Messages m
                JOIN Users u ON m.SenderId = u.Id
                WHERE m.Id = @msgId
            `);

        const message = msgResult.recordset[0];

        // Mark as read for sender
        await pool.request()
            .input('msgId', sql.VarChar, messageId)
            .input('userId', sql.VarChar, senderId)
            .query(`
                INSERT INTO MessageStatus (MessageId, UserId, IsRead, ReadAt)
                VALUES (@msgId, @userId, 1, GETDATE())
            `);

        // Emit to conversation room
        SocketService.emitToRoom(conversationId, 'receive_message', message);

        res.json({ success: true, data: message });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Add reaction to message
exports.addReaction = async (req, res) => {
    try {
        const { messageId, emoji } = req.body;
        const userId = req.user.Id || req.user._id;

        const pool = await getPool();

        // Upsert reaction (unique per user+message+emoji)
        await pool.request()
            .input('msgId', sql.VarChar, messageId)
            .input('userId', sql.VarChar, userId)
            .input('emoji', sql.NVarChar, emoji)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM MessageReactions
                    WHERE MessageId = @msgId AND UserId = @userId AND Emoji = @emoji
                )
                BEGIN
                    INSERT INTO MessageReactions (MessageId, UserId, Emoji, CreatedAt)
                    VALUES (@msgId, @userId, @emoji, GETDATE())
                END
            `);

        // Get updated reactions list
        const reactionsResult = await pool.request()
            .input('msgId', sql.VarChar, messageId)
            .query(`
                SELECT Emoji, COUNT(*) as count, STRING_AGG(Id, ',') as userIds
                FROM MessageReactions
                WHERE MessageId = @msgId
                GROUP BY Emoji
            `);

        res.json({ success: true, reactions: reactionsResult.recordset });
    } catch (error) {
        console.error('Error adding reaction:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mark message as read
exports.markMessageRead = async (req, res) => {
    try {
        const { messageId } = req.body;
        const userId = req.user.Id || req.user._id;

        const pool = await getPool();

        await pool.request()
            .input('msgId', sql.VarChar, messageId)
            .input('userId', sql.VarChar, userId)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM MessageStatus
                    WHERE MessageId = @msgId AND UserId = @userId
                )
                BEGIN
                    INSERT INTO MessageStatus (MessageId, UserId, IsRead, ReadAt)
                    VALUES (@msgId, @userId, 1, GETDATE())
                END
                ELSE
                BEGIN
                    UPDATE MessageStatus
                    SET IsRead = 1, ReadAt = GETDATE()
                    WHERE MessageId = @msgId AND UserId = @userId
                END
            `);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// WebRTC signaling passthrough (same as before, just needs model updates in call handling)
exports.inviteToCall = async (req, res) => {
    try {
        const { conversationId, type, receiverId } = req.body;
        const callerId = req.user.Id || req.user._id;

        const pool = await getPool();
        const callId = generateId();

        // Create call log
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

        // Notify receiver via socket
        SocketService.emitToUser(receiverId, 'incoming_call', {
            callId,
            conversationId,
            callerId,
            type,
            status: 'INITIATED'
        });

        // Confirm to caller
        res.json({ success: true, callId });
    } catch (error) {
        console.error('Error inviting to call:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.acceptCall = async (req, res) => {
    try {
        const { callId } = req.body;
        const pool = await getPool();

        await pool.request()
            .input('callId', sql.VarChar, callId)
            .query(`
                UPDATE CallLogs
                SET Status = 'ONGOING', StartedAt = GETDATE()
                WHERE Id = @callId AND Status = 'INITIATED'
            `);

        // Get call details to notify both parties
        const callResult = await pool.request()
            .input('callId', sql.VarChar, callId)
            .query(`
                SELECT cl.*,
                       u1.FirstName + ' ' + u1.LastName as callerName,
                       u2.FirstName + ' ' + u2.LastName as receiverName
                FROM CallLogs cl
                JOIN Users u1 ON cl.CallerId = u1.Id
                JOIN Users u2 ON cl.ReceiverId = u2.Id
                WHERE cl.Id = @callId
            `);

        const call = callResult.recordset[0];

        // Notify both parties
        SocketService.emitToUser(call.CallerId, 'call_accepted', call);
        SocketService.emitToUser(call.ReceiverId, 'call_accepted', call);

        res.json({ success: true, call });
    } catch (error) {
        console.error('Error accepting call:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.rejectCall = async (req, res) => {
    try {
        const { callId } = req.body;
        const pool = await getPool();

        await pool.request()
            .input('callId', sql.VarChar, callId)
            .query(`UPDATE CallLogs SET Status = 'REJECTED' WHERE Id = @callId AND Status = 'INITIATED'`);

        // Get caller to notify
        const callResult = await pool.request()
            .input('callId', sql.VarChar, callId)
            .query(`SELECT CallerId FROM CallLogs WHERE Id = @callId`);

        if (callResult.recordset.length > 0) {
            SocketService.emitToUser(callResult.recordset[0].CallerId, 'call_rejected', { callId });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.endCall = async (req, res) => {
    try {
        const { callId } = req.body;
        const pool = await getPool();

        const callResult = await pool.request()
            .input('callId', sql.VarChar, callId)
            .query(`SELECT * FROM CallLogs WHERE Id = @callId AND Status = 'ONGOING'`);

        if (callResult.recordset.length === 0) {
            return res.json({ success: true });
        }

        const call = callResult.recordset[0];
        const endedAt = new Date();
        const duration = call.StartedAt ? Math.floor((endedAt - new Date(call.StartedAt)) / 1000) : 0;

        await pool.request()
            .input('callId', sql.VarChar, callId)
            .input('duration', sql.Int, duration)
            .query(`
                UPDATE CallLogs
                SET Status = 'ENDED', EndedAt = GETDATE(), Duration = @duration
                WHERE Id = @callId
            `);

        // Notify both parties
        SocketService.emitToUser(call.CallerId, 'call_ended', { callId, duration });
        if (call.ReceiverId) {
            SocketService.emitToUser(call.ReceiverId, 'call_ended', { callId, duration });
        }

        res.json({ success: true, duration });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// Additional chat features (stubs for chatRoutes)
// ─────────────────────────────────────────────────────────────

exports.getUsersForChat = async (req, res) => {
    try {
        const { search } = req.query;
        const pool = await getPool();
        let whereClause = "WHERE 1=1";
        const request = pool.request();

        if (search) {
            whereClause += " AND (FirstName LIKE @search OR LastName LIKE @search OR Email LIKE @search)";
            request.input('search', sql.NVarChar, `%${search}%`);
        }

        const result = await request.query(`
            SELECT Id, FirstName, LastName, Email, Avatar, Role, IsOnline, LastSeen
            FROM Users
            ${whereClause}
            ORDER BY FirstName, LastName
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSellersForChat = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query("SELECT Id, Name, Marketplace, SellerId FROM Sellers WHERE IsActive = 1 ORDER BY Name");
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();
        await pool.request()
            .input('convId', sql.VarChar, conversationId)
            .input('userId', sql.VarChar, userId)
            .query(`
                UPDATE Messages SET IsRead = 1
                WHERE ConversationId = @convId AND SenderId != @userId AND IsRead = 0
            `);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.searchMessages = async (req, res) => {
    try {
        const { q, conversationId } = req.query;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();
        let whereClause = "WHERE m.SenderId != @userId AND c.Id IN (SELECT ConversationId FROM ConversationParticipants WHERE UserId = @userId)";
        const request = pool.request().input('userId', sql.VarChar, userId);

        if (q) {
            whereClause += " AND m.Content LIKE @q";
            request.input('q', sql.NVarChar, `%${q}%`);
        }
        if (conversationId) {
            whereClause += " AND m.ConversationId = @convId";
            request.input('convId', sql.VarChar, conversationId);
        }

        const result = await request.query(`
            SELECT m.*, c.Type as ConversationType
            FROM Messages m
            JOIN Conversations c ON m.ConversationId = c.Id
            ${whereClause}
            ORDER BY m.CreatedAt DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, messageId)
            .input('userId', sql.VarChar, userId)
            .input('content', sql.NVarChar, content)
            .query(`
                UPDATE Messages SET Content = @content
                WHERE Id = @id AND SenderId = @userId
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Message not found or unauthorized' });
        }

        res.json({ success: true, message: 'Message edited' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, messageId)
            .input('userId', sql.VarChar, userId)
            .query("DELETE FROM Messages WHERE Id = @id AND SenderId = @userId");

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Message not found or unauthorized' });
        }

        res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.togglePinMessage = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.forwardMessage = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.getMessageReadReceipts = async (req, res) => {
    try {
        const { messageId } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input('msgId', sql.VarChar, messageId)
            .query("SELECT * FROM MessageStatus WHERE MessageId = @msgId");
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLinkPreview = async (req, res) => {
    res.json({ success: true, data: null });
};

exports.votePoll = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.createPoll = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.createGroup = async (req, res) => {
    try {
        const { name, participantIds, sellerId } = req.body;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();
        const convId = generateId();

        await pool.request()
            .input('Id', sql.VarChar, convId)
            .input('Type', sql.NVarChar, 'GROUP')
            .input('Title', sql.NVarChar, name || null)
            .input('SellerId', sql.VarChar, sellerId || null)
            .query("INSERT INTO Conversations (Id, Type, Title, SellerId, IsActive, CreatedAt, UpdatedAt) VALUES (@Id, @Type, @Title, @SellerId, 1, GETDATE(), GETDATE())");

        // Add participants
        const allParticipants = [...participantIds, userId];
        for (const pid of allParticipants) {
            await pool.request()
                .input('convId', sql.VarChar, convId)
                .input('userId', sql.VarChar, pid)
                .query("INSERT INTO ConversationParticipants (ConversationId, UserId) VALUES (@convId, @userId)");
        }

        res.status(201).json({ success: true, data: { id: convId, name, type: 'GROUP', participants: allParticipants } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addGroupMembers = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userIds } = req.body;
        const pool = await getPool();

        for (const uid of userIds) {
            await pool.request()
                .input('convId', sql.VarChar, conversationId)
                .input('userId', sql.VarChar, uid)
                .query("INSERT INTO ConversationParticipants (ConversationId, UserId) VALUES (@convId, @userId)");
        }

        res.json({ success: true, message: 'Members added' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.removeGroupMember = async (req, res) => {
    try {
        const { conversationId, userId } = req.params;
        const pool = await getPool();
        await pool.request()
            .input('convId', sql.VarChar, conversationId)
            .input('userId', sql.VarChar, userId)
            .query("DELETE FROM ConversationParticipants WHERE ConversationId = @convId AND UserId = @userId");
        res.json({ success: true, message: 'Member removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateMemberRole = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.getSharedMedia = async (req, res) => {
    res.json({ success: true, data: [] });
};

// ─────────────────────────────────────────────────────────────
// Additional chat features (stubs for chatRoutes)
// ─────────────────────────────────────────────────────────────

exports.getUsersForChat = async (req, res) => {
    try {
        const { search } = req.query;
        const pool = await getPool();
        let whereClause = "WHERE 1=1";
        const request = pool.request();

        if (search) {
            whereClause += " AND (FirstName LIKE @search OR LastName LIKE @search OR Email LIKE @search)";
            request.input('search', sql.NVarChar, `%${search}%`);
        }

        const result = await request.query(`
            SELECT Id, FirstName, LastName, Email, Avatar, Role, IsOnline, LastSeen
            FROM Users
            ${whereClause}
            ORDER BY FirstName, LastName
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSellersForChat = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query("SELECT Id, Name, Marketplace, SellerId FROM Sellers WHERE IsActive = 1 ORDER BY Name");
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();
        await pool.request()
            .input('convId', sql.VarChar, conversationId)
            .input('userId', sql.VarChar, userId)
            .query(`
                UPDATE Messages SET IsRead = 1
                WHERE ConversationId = @convId AND SenderId != @userId AND IsRead = 0
            `);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.searchMessages = async (req, res) => {
    try {
        const { q, conversationId } = req.query;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();
        let whereClause = "WHERE m.SenderId != @userId AND c.Id IN (SELECT ConversationId FROM ConversationParticipants WHERE UserId = @userId)";
        const request = pool.request().input('userId', sql.VarChar, userId);

        if (q) {
            whereClause += " AND m.Content LIKE @q";
            request.input('q', sql.NVarChar, `%${q}%`);
        }
        if (conversationId) {
            whereClause += " AND m.ConversationId = @convId";
            request.input('convId', sql.VarChar, conversationId);
        }

        const result = await request.query(`
            SELECT m.*, c.Type as ConversationType
            FROM Messages m
            JOIN Conversations c ON m.ConversationId = c.Id
            ${whereClause}
            ORDER BY m.CreatedAt DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, messageId)
            .input('userId', sql.VarChar, userId)
            .input('content', sql.NVarChar, content)
            .query(`
                UPDATE Messages SET Content = @content
                WHERE Id = @id AND SenderId = @userId
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Message not found or unauthorized' });
        }

        res.json({ success: true, message: 'Message edited' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, messageId)
            .input('userId', sql.VarChar, userId)
            .query("DELETE FROM Messages WHERE Id = @id AND SenderId = @userId");

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Message not found or unauthorized' });
        }

        res.json({ success: true, message: 'Message deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.togglePinMessage = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.forwardMessage = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.getMessageReadReceipts = async (req, res) => {
    try {
        const { messageId } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input('msgId', sql.VarChar, messageId)
            .query("SELECT * FROM MessageStatus WHERE MessageId = @msgId");
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getLinkPreview = async (req, res) => {
    res.json({ success: true, data: null });
};

exports.votePoll = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.createPoll = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.createGroup = async (req, res) => {
    try {
        const { name, participantIds, sellerId } = req.body;
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();
        const convId = generateId();

        await pool.request()
            .input('Id', sql.VarChar, convId)
            .input('Type', sql.NVarChar, 'GROUP')
            .input('Title', sql.NVarChar, name || null)
            .input('SellerId', sql.VarChar, sellerId || null)
            .query("INSERT INTO Conversations (Id, Type, Title, SellerId, IsActive, CreatedAt, UpdatedAt) VALUES (@Id, @Type, @Title, @SellerId, 1, GETDATE(), GETDATE())");

        // Add participants
        const allParticipants = [...participantIds, userId];
        for (const pid of allParticipants) {
            await pool.request()
                .input('convId', sql.VarChar, convId)
                .input('userId', sql.VarChar, pid)
                .query("INSERT INTO ConversationParticipants (ConversationId, UserId) VALUES (@convId, @userId)");
        }

        res.status(201).json({ success: true, data: { id: convId, name, type: 'GROUP', participants: allParticipants } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.addGroupMembers = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userIds } = req.body;
        const pool = await getPool();

        for (const uid of userIds) {
            await pool.request()
                .input('convId', sql.VarChar, conversationId)
                .input('userId', sql.VarChar, uid)
                .query("INSERT INTO ConversationParticipants (ConversationId, UserId) VALUES (@convId, @userId)");
        }

        res.json({ success: true, message: 'Members added' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.removeGroupMember = async (req, res) => {
    try {
        const { conversationId, userId } = req.params;
        const pool = await getPool();
        await pool.request()
            .input('convId', sql.VarChar, conversationId)
            .input('userId', sql.VarChar, userId)
            .query("DELETE FROM ConversationParticipants WHERE ConversationId = @convId AND UserId = @userId");
        res.json({ success: true, message: 'Member removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateMemberRole = async (req, res) => {
    res.json({ success: true, message: 'Not implemented' });
};

exports.getSharedMedia = async (req, res) => {
    res.json({ success: true, data: [] });
};
