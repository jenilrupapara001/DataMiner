const { sql, getPool, generateId } = require('../database/db');

/**
 * Get notifications for the current user (SQL Version)
 */
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const unreadOnly = req.query.unreadOnly === 'true';

        const pool = await getPool();
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE RecipientId = @userId';
        if (unreadOnly) {
            whereClause += ' AND IsRead = 0';
        }

        // Count total
        const countResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query(`SELECT COUNT(*) as total FROM Notifications ${whereClause}`);
        const total = countResult.recordset[0].total;

        // Fetch paginated notifications
        const notificationsResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, limit)
            .query(`
                SELECT n.*,
                       u.FirstName + ' ' + u.LastName as recipientName,
                       u.Email as recipientEmail
                FROM Notifications n
                LEFT JOIN Users u ON n.RecipientId = u.Id
                ${whereClause}
                ORDER BY n.CreatedAt DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `);

        const notifications = notificationsResult.recordset;

        // Get unread count
        const unreadResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query("SELECT COUNT(*) as count FROM Notifications WHERE RecipientId = @userId AND IsRead = 0");
        const unreadCount = unreadResult.recordset[0].count;

        res.json({
            success: true,
            data: notifications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            unreadCount
        });
    } catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Mark notification(s) as read
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const { notificationId } = req.body;

        const pool = await getPool();

        if (notificationId === 'all') {
            await pool.request()
                .input('userId', sql.VarChar, userId)
                .query("UPDATE Notifications SET IsRead = 1 WHERE RecipientId = @userId AND IsRead = 0");
        } else {
            const result = await pool.request()
                .input('id', sql.VarChar, notificationId)
                .input('userId', sql.VarChar, userId)
                .query("UPDATE Notifications SET IsRead = 1 WHERE Id = @id AND RecipientId = @userId");

            if (result.rowsAffected[0] === 0) {
                return res.status(404).json({ success: false, message: 'Notification not found' });
            }
        }

        // Return updated unread count
        const unreadResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query("SELECT COUNT(*) as count FROM Notifications WHERE RecipientId = @userId AND IsRead = 0");

        res.json({
            success: true,
            message: 'Marked as read',
            unreadCount: unreadResult.recordset[0].count
        });
    } catch (error) {
        console.error('Mark Read Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Permanently delete a notification (dismiss)
exports.deleteNotification = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const { id } = req.params;

        const pool = await getPool();

        if (id === 'all-read') {
            const result = await pool.request()
                .input('userId', sql.VarChar, userId)
                .query("DELETE FROM Notifications WHERE RecipientId = @userId AND IsRead = 1");
            res.json({ success: true, deleted: result.rowsAffected[0] });
        } else {
            const result = await pool.request()
                .input('id', sql.VarChar, id)
                .input('userId', sql.VarChar, userId)
                .query("DELETE FROM Notifications WHERE Id = @id AND RecipientId = @userId");

            if (result.rowsAffected[0] === 0) {
                return res.status(404).json({ success: false, message: 'Notification not found' });
            }
            res.json({ success: true });
        }
    } catch (error) {
        console.error('Delete Notification Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * Internal helper to create notification (SQL Version)
 * Can be called from other controllers/services
 */
exports.createNotification = async (recipientId, type, referenceModel, referenceId, message) => {
    try {
        const pool = await getPool();
        const id = generateId();

        await pool.request()
            .input('Id', sql.VarChar, id)
            .input('RecipientId', sql.VarChar, recipientId)
            .input('Type', sql.NVarChar, type)
            .input('ReferenceModel', sql.NVarChar, referenceModel || null)
            .input('ReferenceId', sql.VarChar, referenceId || null)
            .input('Message', sql.NVarChar, message)
            .query(`
                INSERT INTO Notifications (Id, RecipientId, Type, ReferenceModel, ReferenceId, Message, CreatedAt)
                VALUES (@Id, @RecipientId, @Type, @ReferenceModel, @ReferenceId, @Message, GETDATE())
            `);

        // Emit via socket if available
        try {
            const SocketService = require('../services/socketService');
            const unreadResult = await pool.request()
                .input('recipientId', sql.VarChar, recipientId)
                .query("SELECT COUNT(*) as count FROM Notifications WHERE RecipientId = @recipientId AND IsRead = 0");
            const unreadCount = unreadResult.recordset[0].count;

            SocketService.emitToUser(recipientId, 'new-notification', {
                notification: { id, recipient: recipientId, type, referenceModel, referenceId, message, isRead: false, createdAt: new Date() },
                unreadCount
            });
        } catch (socketErr) {
            // Socket service might not be initialized yet, ignore
        }

        return { id };
    } catch (error) {
        console.error('Create Notification Error:', error.message);
        throw error;
    }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.Id || req.user._id;
        const pool = await getPool();

        const result = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query("SELECT COUNT(*) as count FROM Notifications WHERE RecipientId = @userId AND IsRead = 0");

        res.json({ success: true, unreadCount: result.recordset[0].count });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
