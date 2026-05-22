const axios = require('axios');
const marketDataSyncService = require('../services/marketDataSyncService');
require('dotenv').config();

async function run() {
    try {
        console.log("Authenticating...");
        const token = await marketDataSyncService.authenticate();
        
        const uuid = '41533f7b-185d-4425-a73e-99962df80a40';
        console.log(`Searching for task: ${uuid} in all groups...`);
        
        const groups = await marketDataSyncService.getTaskGroupList();
        console.log(`Found ${groups.length} groups.`);
        
        let foundTask = null;
        for (const group of groups) {
            const id = group.categoryId || group.id || group.taskGroupId;
            if (!id) continue;
            
            console.log(`Searching in group: ${group.categoryName || group.name} (${id})...`);
            for (let offset = 0; offset <= 200; offset += 50) {
                const response = await axios.get(`${marketDataSyncService.baseUrl}/task/search`, {
                    params: { taskGroupId: id, size: 50, offset },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const tasks = response.data?.data || [];
                const task = tasks.find(t => t.taskId === uuid || t.id?.toString() === uuid);
                if (task) {
                    foundTask = task;
                    console.log("🎯 FOUND TASK:", JSON.stringify(task, null, 2));
                    break;
                }
                if (tasks.length < 50) break;
            }
            if (foundTask) break;
        }
        
        if (!foundTask) {
            console.log("❌ Task not found in any group.");
        }
    } catch (e) {
        console.error("Error searching task:", e.response?.data || e.message);
    }
    process.exit(0);
}
run();
