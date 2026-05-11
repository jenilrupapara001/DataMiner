const SystemLogService = require('../services/SystemLogService');

const activityLogger = (type, entityType, descriptionGenerator) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function (body) {
            res.send = originalSend;
            
            // Log only successful modification requests or defined explicitly
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const userId = req.userId; // From auth middleware
                    const description = typeof descriptionGenerator === 'function' 
                        ? descriptionGenerator(req) 
                        : descriptionGenerator || `${req.method} ${req.originalUrl}`;
                    
                    SystemLogService.log({
                        type: type || 'ACTIVITY',
                        entityType: entityType || 'SYSTEM',
                        userId: userId,
                        description: description,
                        metadata: {
                            method: req.method,
                            url: req.originalUrl,
                            ip: req.ip || req.headers['x-forwarded-for'],
                            body: req.method !== 'GET' ? req.body : undefined
                        }
                    });
                } catch (err) {
                    console.error('[ActivityLogger] Logging failure:', err);
                }
            }
            
            return originalSend.apply(this, arguments);
        };
        next();
    };
};

module.exports = activityLogger;
