const { sql, getPool } = require('../database/db');
const notificationController = require('./notificationController');

exports.handleCometChatWebhook = async (req, res) => {
    try {
        const event = req.body;
        console.log('📬 CometChat Webhook Received:', JSON.stringify(event, null, 2));

        const { event: eventName, data } = event;

        if (!data || !data.receiver) {
            return res.status(200).json({ success: true, message: 'Not a message event' });
        }

        const senderUid = data.sender;
        const receiverUid = data.receiver;
        const receiverType = data.receiverType;
        const messageText = data.data?.text || 'Sent an attachment';

        const pool = await getPool();

        // Find the sender (could be a user or a seller)
        let sender = null;
        let senderName = 'Someone';
        let senderId = null;

        // Check Users
        const userResult = await pool.request()
            .input('uid', sql.VarChar, senderUid)
            .query("SELECT Id, FirstName, LastName FROM Users WHERE Id = @uid OR Email = @uid"); // Uid could be Email or Id

        if (userResult.recordset.length > 0) {
            sender = userResult.recordset[0];
            senderName = `${sender.FirstName} ${sender.LastName}`;
            senderId = sender.Id;
        } else {
            // Check Sellers
            const sellerResult = await pool.request()
                .input('uid', sql.VarChar, senderUid)
                .query("SELECT Id, Name FROM Sellers WHERE Id = @uid OR OctoparseId = @uid");
            
            if (sellerResult.recordset.length > 0) {
                sender = sellerResult.recordset[0];
                senderName = sender.Name;
                senderId = sender.Id;
            }
        }

        if (receiverType === 'user') {
            // Direct Message
            const recipientResult = await pool.request()
                .input('uid', sql.VarChar, receiverUid)
                .query("SELECT Id, Email FROM Users WHERE Id = @uid OR Email = @uid");

            if (recipientResult.recordset.length > 0) {
                const recipient = recipientResult.recordset[0];
                await notificationController.createNotification(
                    recipient.Id,
                    'CHAT_MESSAGE',
                    'User',
                    senderId,
                    `${senderName}: ${messageText}`
                );
                console.log(`🔔 Notification created for User: ${recipient.Email}`);
            }
        } else if (receiverType === 'group') {
            console.log('Group message received, skipping multi-user notification for now (requires group sync)');
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('❌ Webhook Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

