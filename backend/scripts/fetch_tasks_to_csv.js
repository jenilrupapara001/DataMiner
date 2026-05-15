const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const marketDataSyncService = require('../services/marketDataSyncService');

async function main() {
    console.log('🚀 Initializing Octoparse Task Fetcher...');
    
    try {
        // Fetch all tasks using the existing service logic
        console.log('📡 Fetching task groups from Octoparse API...');
        const groups = await marketDataSyncService.getTaskGroupList();
        
        if (!groups || groups.length === 0) {
            console.error('❌ No task groups found.');
            process.exit(1);
        }

        let allTasks = [];
        console.log(`📂 Found ${groups.length} groups. Fetching tasks...`);

        for (const group of groups) {
            const groupId = group.categoryId || group.id || group.taskGroupId;
            const groupName = group.categoryName || group.name || group.taskGroupName;
            
            console.log(`   ∟ Reading Group: ${groupName}...`);
            const tasks = await marketDataSyncService.getTasksInGroup(groupId);
            
            if (Array.isArray(tasks)) {
                tasks.forEach(t => {
                    allTasks.push({
                        taskId: t.taskId || t.id,
                        taskName: t.taskName || t.name,
                        groupName: groupName
                    });
                });
            }
            
            // Sleep slightly to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (allTasks.length === 0) {
            console.warn('⚠️ No tasks found across all groups.');
            process.exit(0);
        }

        console.log(`✅ Total tasks fetched: ${allTasks.length}`);

        // Construct CSV string manually to avoid extra dependencies
        const header = 'TASK_ID,TASK_NAME,GROUP_NAME\n';
        const rows = allTasks.map(t => {
            // Escape double quotes and wrap in quotes to handle commas or quotes in content
            const taskId = `"${(t.taskId || '').toString().replace(/"/g, '""')}"`;
            const taskName = `"${(t.taskName || '').toString().replace(/"/g, '""')}"`;
            const groupName = `"${(t.groupName || '').toString().replace(/"/g, '""')}"`;
            return `${taskId},${taskName},${groupName}`;
        }).join('\n');

        const csvContent = header + rows;
        const csvPath = path.join(__dirname, '../../octoparse_tasks.csv');

        console.log(`📝 Writing data to ${csvPath}...`);
        fs.writeFileSync(csvPath, csvContent, 'utf8');
        
        console.log('✨ Success! CSV file created successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Critical Error during fetch:', error.message);
        process.exit(1);
    }
}

main();
