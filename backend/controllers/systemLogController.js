const SystemLogService = require('../services/SystemLogService');

exports.getLogs = async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 1000;
        const logs = await SystemLogService.getLogs({}, limit);
        res.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        res.status(500).json({ message: 'Failed to fetch activity logs' });
    }
};
