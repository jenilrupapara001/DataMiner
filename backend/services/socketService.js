let io;

module.exports = {
    init: (socketIoInstance) => {
        io = socketIoInstance;
        // console.log('🔌 SocketService initialized');
        return io;
    },
    getIo: () => {
        if (!io) {
            console.warn('⚠️ SocketService accessed before initialization');
        }
        return io;
    },
    emitToUser: (userId, event, data) => {
        if (io) {
            io.to(userId.toString()).emit(event, data);
            return true;
        }
        return false;
    },
    emitExportUpdate: (downloadId, data) => {
        if (io) {
            io.emit('export_progress', { downloadId, ...data });
            return true;
        }
        return false;
    }
};
