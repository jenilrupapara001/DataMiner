const syncUserToCometChat = async (user) => {
    return { success: true, uid: 'disabled' };
};

const syncSellerToCometChat = async (seller) => {
    return { success: true, uid: 'disabled' };
};

const syncAllToCometChat = async () => {
    return { success: true };
};

const deleteFromCometChat = async (uid) => {
    return { success: true };
};

const sanitizeUid = (id) => {
    return 'disabled';
};

module.exports = {
    syncUserToCometChat,
    syncSellerToCometChat,
    syncAllToCometChat,
    deleteFromCometChat,
    sanitizeUid
};

