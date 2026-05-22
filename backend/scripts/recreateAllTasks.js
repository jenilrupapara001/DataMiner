const db = require('../database/db');
const { sql } = db;
const marketDataSyncService = require('../services/marketDataSyncService');
require('dotenv').config();

async function recreateAllTasks() {
    const isExecution = process.argv.includes('--run');
    console.log(`\n======================================================`);
    console.log(`🚀 Starting ${isExecution ? 'EXECUTION' : 'DRY RUN'} for Octoparse Task Recreation...`);
    console.log(`======================================================`);
    
    if (!isExecution) {
        console.log('\n💡 TIP: Run with "node scripts/recreateAllTasks.js --run" to execute the changes.\n');
    }

    try {
        const pool = await db.getPool();

        // 1. Fetch all active sellers who currently have an OctoparseId
        const sellersResult = await pool.request().query(`
            SELECT Id, Name, OctoparseId, Marketplace 
            FROM Sellers 
            WHERE OctoparseId IS NOT NULL AND OctoparseId != ''
        `);
        const sellers = sellersResult.recordset;

        console.log(`📊 Found ${sellers.length} active sellers with Octoparse tasks.`);

        if (sellers.length === 0) {
            console.log('✅ No sellers found to migrate. Exiting.');
            process.exit(0);
        }

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < sellers.length; i++) {
            const seller = sellers[i];
            const isAjio = seller.Marketplace && seller.Marketplace.toLowerCase() === 'ajio';
            
            console.log(`\n[${i + 1}/${sellers.length}] Seller: "${seller.Name}" (${isAjio ? 'Ajio' : 'Amazon'})`);
            console.log(`   - Current Task ID: ${seller.OctoparseId}`);

            if (!isExecution) {
                // Dry Run Action Description
                console.log(`   - [DRY RUN] Will duplicate master template, update Sellers & OctoTasks, and inject ASINs.`);
                successCount++;
                continue;
            }

            try {
                console.log('   - 🌀 Duplicating from master template...');
                const newTaskId = await marketDataSyncService.duplicateTask(seller.Name, isAjio);
                console.log(`   - ✅ Created new Task: ${newTaskId}`);

                // Update Seller Table
                await pool.request()
                    .input('newTaskId', sql.VarChar, newTaskId)
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query('UPDATE Sellers SET OctoparseId = @newTaskId, UpdatedAt = GETDATE() WHERE Id = @sellerId');
                console.log('   - 💾 Sellers database updated.');

                // Update/Insert OctoTasks Pool Table
                const taskCheck = await pool.request()
                    .input('taskId', sql.VarChar, newTaskId)
                    .query("SELECT Id FROM OctoTasks WHERE TaskId = @taskId");

                if (taskCheck.recordset.length === 0) {
                    await pool.request()
                        .input('id', sql.VarChar, db.generateId())
                        .input('taskId', sql.VarChar, newTaskId)
                        .input('taskName', sql.NVarChar, `Task for ${seller.Name}`)
                        .input('sellerId', sql.VarChar, seller.Id)
                        .query(`
                            INSERT INTO OctoTasks (Id, TaskId, TaskName, GroupName, IsAssigned, SellerId, LastAssignedAt, CreatedAt, UpdatedAt)
                            VALUES (@id, @taskId, @taskName, 'StandardModeMigration', 1, @sellerId, GETDATE(), GETDATE(), GETDATE())
                        `);
                } else {
                    await pool.request()
                        .input('taskId', sql.VarChar, newTaskId)
                        .input('sellerId', sql.VarChar, seller.Id)
                        .query(`
                            UPDATE OctoTasks 
                            SET IsAssigned = 1, SellerId = @sellerId, LastAssignedAt = GETDATE(), UpdatedAt = GETDATE() 
                            WHERE TaskId = @taskId
                        `);
                }
                console.log('   - 💾 OctoTasks pool database updated.');

                // Sync ASINs into the new task without starting scraping
                console.log('   - 📂 Syncing ASIN list to the new task...');
                await marketDataSyncService.syncSellerAsinsToOctoparse(seller.Id, { triggerScrape: false });
                console.log('   - 🚀 ASIN list synchronized successfully.');

                successCount++;
                // 2-second buffer between task setups to prevent API throttling
                await marketDataSyncService.wait(2000);

            } catch (err) {
                console.error(`   - ❌ Migration failed for seller ${seller.Name}:`, err.message);
                errorCount++;
            }
        }

        console.log(`\n======================================================`);
        console.log('✨ Recreation Summary:');
        console.log(`======================================================`);
        console.log(`Total Sellers Checked: ${sellers.length}`);
        console.log(`Successful:            ${successCount}`);
        console.log(`Errors/Failures:       ${errorCount}`);
        console.log(`======================================================\n`);
        
        process.exit(0);
    } catch (e) {
        console.error('❌ Fatal error in recreateAllTasks script:', e.message);
        process.exit(1);
    }
}

recreateAllTasks();
