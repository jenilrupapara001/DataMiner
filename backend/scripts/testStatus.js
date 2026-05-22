const marketDataSyncService = require('../services/marketDataSyncService');
require('dotenv').config();

async function run() {
    try {
        console.log("Authenticating...");
        await marketDataSyncService.authenticate();
        
        const taskId = '41533f7b-185d-4425-a73e-99962df80a40';
        console.log(`Checking status for task: ${taskId}`);
        const statusInfo = await marketDataSyncService.getStatus(taskId);
        console.log("Status Info:", JSON.stringify(statusInfo, null, 2));
        console.log("Normalized status:", marketDataSyncService.normalizeStatus(statusInfo));
        
        const rawStatuses = await marketDataSyncService.getStatuses([taskId]);
        console.log("Raw Statuses V2 response for task:", JSON.stringify(rawStatuses, null, 2));
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
run();
