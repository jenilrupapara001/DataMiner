const axios = require('axios');
const marketDataSyncService = require('../services/marketDataSyncService');
require('dotenv').config();

async function run() {
    try {
        console.log("Authenticating...");
        const token = await marketDataSyncService.authenticate();
        
        const uuid = '41533f7b-185d-4425-a73e-99962df80a40';
        console.log(`Checking status for task: ${uuid} directly with UUID...`);
        
        const response = await axios.post(`${marketDataSyncService.baseUrl}/cloudextraction/statuses/v2`, {
            taskIds: [uuid]
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log("Direct UUID Response:", JSON.stringify(response.data, null, 2));
    } catch (e) {
        console.error("Direct UUID Error:", e.response?.data || e.message);
    }
    process.exit(0);
}
run();
