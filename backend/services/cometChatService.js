const { sql, getPool } = require('../database/db');

const COMETCHAT_APP_ID = process.env.COMETCHAT_APP_ID || "1675623ba4da04e9e";
const COMETCHAT_REGION = process.env.COMETCHAT_REGION || "in";
const COMETCHAT_API_KEY = process.env.COMETCHAT_API_KEY || "d07adba4924933e6c9c6ab5d15ec2abe92704a5c"; // Auth Key if API Key not set
const COMETCHAT_API_URL = `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3.0/users`;

const getAvatar = (name) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
};

const sanitizeUid = (id) => {
    if (!id) return 'unknown';
    return id.replace(/[@.]/g, '_').toLowerCase();
};

const syncUserToCometChat = async (user) => {
    try {
        const uid = sanitizeUid(user.Email || user.email);
        const firstName = user.FirstName || user.firstName || '';
        const lastName = user.LastName || user.lastName || '';
        const name = `${firstName} ${lastName}`.trim() || 'User';
        const avatar = user.Avatar || user.avatar || getAvatar(name);

        const payload = {
            uid: uid,
            name: name,
            avatar: avatar,
            role: 'default',
            tags: ['gms-user']
        };

        const response = await fetch(COMETCHAT_API_URL, {
            method: 'POST',
            headers: {
                'apiKey': COMETCHAT_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const pool = await getPool();
        const userId = user.Id || user._id;

        if (response.ok || data.error?.code === 'ERR_UID_ALREADY_EXISTS') {
            if (data.error?.code === 'ERR_UID_ALREADY_EXISTS') {
                await fetch(`${COMETCHAT_API_URL}/${uid}`, {
                    method: 'PUT',
                    headers: {
                        'apiKey': COMETCHAT_API_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ name, avatar, tags: ['gms-user'] })
                });
            }
            
            if (userId) {
                await pool.request()
                    .input('id', sql.VarChar, userId)
                    .input('uid', sql.NVarChar, uid)
                    .query("UPDATE Users SET CometChatUid = @uid WHERE Id = @id");
            }
            return { success: true, uid };
        } else {
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ CometChat User Sync Error:', error);
        return { success: false, error: error.message };
    }
};

const syncSellerToCometChat = async (seller) => {
    try {
        const sellerId = seller.SellerId || seller.sellerId;
        if (!sellerId) return { success: false, error: 'No SellerId provided' };
        
        const uid = `seller_${sanitizeUid(sellerId)}`;
        const name = seller.Name || seller.name;
        const avatar = getAvatar(name);

        const payload = {
            uid: uid,
            name: name,
            avatar: avatar,
            role: 'default',
            tags: ['gms-user']
        };

        const response = await fetch(COMETCHAT_API_URL, {
            method: 'POST',
            headers: {
                'apiKey': COMETCHAT_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const pool = await getPool();
        const dbId = seller.Id || seller._id;

        if (response.ok || data.error?.code === 'ERR_UID_ALREADY_EXISTS') {
            if (data.error?.code === 'ERR_UID_ALREADY_EXISTS') {
                await fetch(`${COMETCHAT_API_URL}/${uid}`, {
                    method: 'PUT',
                    headers: {
                        'apiKey': COMETCHAT_API_KEY,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ name, avatar, tags: ['gms-user'] })
                });
            }
            
            if (dbId) {
                await pool.request()
                    .input('id', sql.VarChar, dbId)
                    .input('uid', sql.NVarChar, uid)
                    .query("UPDATE Sellers SET CometChatUid = @uid WHERE Id = @id");
            }
            return { success: true, uid };
        } else {
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ CometChat Seller Sync Error:', error);
        return { success: false, error: error.message };
    }
};

const syncAllToCometChat = async () => {
    try {
        const pool = await getPool();
        
        // Sync Users
        const usersResult = await pool.request().query("SELECT * FROM Users");
        for (const user of usersResult.recordset) {
            await syncUserToCometChat(user);
        }

        // Sync Sellers
        const sellersResult = await pool.request().query("SELECT * FROM Sellers");
        for (const seller of sellersResult.recordset) {
            await syncSellerToCometChat(seller);
        }

        return { success: true };
    } catch (error) {
        console.error('❌ Background CometChat Sync Failed:', error);
        return { success: false, error: error.message };
    }
};

const deleteFromCometChat = async (uid) => {
    try {
        const response = await fetch(`${COMETCHAT_API_URL}/${uid}`, {
            method: 'DELETE',
            headers: {
                'apiKey': COMETCHAT_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        const data = await response.json();
        if (response.ok || data.error?.code === 'ERR_UID_NOT_FOUND') {
            return { success: true };
        } else {
            return { success: false, error: data };
        }
    } catch (error) {
        console.error('❌ CometChat Deletion Error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    syncUserToCometChat,
    syncSellerToCometChat,
    syncAllToCometChat,
    deleteFromCometChat,
    sanitizeUid
};
