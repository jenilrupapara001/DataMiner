const MarketSyncService = require('../services/marketDataSyncService');
const { sql, getPool } = require('../database/db');
require('dotenv').config();

/**
 * Script to manually clear all cloud data for all active seller tasks in Octoparse.
 * This uses the official Octoparse Data Removal API.
 */
async function clearAllCloudData() {
    console.log('🧹 [CLEANUP] Starting global Octoparse cloud data cleanup...');
    
    try {
        const pool = await getPool();
        
        // 1. Fetch all sellers with Octoparse IDs
        const sellersResult = await pool.request()
            .query("SELECT Id, Name, OctoparseId FROM Sellers WHERE IsActive = 1 AND OctoparseId IS NOT NULL AND OctoparseId != ''");
        
        const sellers = sellersResult.recordset;
        console.log(`📊 Found ${sellers.length} active sellers with configured Octoparse tasks.`);

        if (sellers.length === 0) {
            console.log('ℹ️ No tasks to clear. Exiting.');
            process.exit(0);
        }

        let cleared = 0;
        let failed = 0;

        // 2. Iterate and process (Sequential to avoid 429s)
        for (const seller of sellers) {
            try {
                console.log(`\n🔄 [${seller.Name}] Starting cleanup and URL injection...`);
                
                // Step 1: Check status and STOP if running
                console.log(`   🛑 Checking task status: ${seller.OctoparseId}`);
                const status = await MarketSyncService.getStatus(seller.OctoparseId);
                const taskStatus = typeof status?.status === 'string' ? status.status.toLowerCase() : status?.status;
                
                if (taskStatus === 'running' || taskStatus === 1 || taskStatus === '1') {
                    console.log(`   🛑 Task is running. Sending STOP command...`);
                    await MarketSyncService.stopSync(seller.OctoparseId);
                    await new Promise(r => setTimeout(r, 5000)); // Wait for stop to finalize
                } else {
                    console.log(`   ℹ️ Task is already idle (${taskStatus || 'idle'}).`);
                }

                // Step 2: CLEAR all previous cloud data
                const clearSuccess = await MarketSyncService.clearTaskData(seller.OctoparseId);
                
                if (clearSuccess) {
                    cleared++;
                    
                    // Step 3: FETCH and INJECT latest ASIN URLs (do NOT start the task)
                    console.log(`   📥 Injecting latest ASIN URLs from database...`);
                    await MarketSyncService.syncSellerAsinsToOctoparse(seller.Id, { 
                        triggerScrape: false, // Ensure task DOES NOT start
                        forceReRun: false 
                    });
                    
                    console.log(`   ✅ Successfully reset and updated URLs for ${seller.Name}`);
                } else {
                    failed++;
                    console.log(`   ❌ Failed to clear cloud data for ${seller.Name}`);
                }
                
                // Small delay to respect rate limits between sellers
                await new Promise(r => setTimeout(r, 3000));
            } catch (err) {
                failed++;
                console.error(`   ❌ Error processing ${seller.Name}:`, err.message);
            }
        }

        console.log('\n✨ Cleanup Summary:');
        console.log(`   - Total Sellers: ${sellers.length}`);
        console.log(`   - Successfully Cleared: ${cleared}`);
        console.log(`   - Failed: ${failed}`);
        
        console.log('\n🚀 Cleanup complete.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Critical failure in cleanup script:', error.message);
        process.exit(1);
    }
}

// Run the script
clearAllCloudData();
