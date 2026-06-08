const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const db = require('../database/db');
const { sql, generateId } = db;

// Path to the updated sellers CSV
const CSV_PATH = '/Users/jenilrupapara/Downloads/Database_backup/sellers.csv';

async function importSellersOctoparseIds() {
    console.log('🚀 Starting Octoparse ID import from CSV...');
    
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV file not found at: ${CSV_PATH}`);
        process.exit(1);
    }

    try {
        console.log(`Reading CSV file: ${CSV_PATH}`);
        const workbook = XLSX.readFile(CSV_PATH);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert sheet to JSON
        const data = XLSX.utils.sheet_to_json(sheet);
        console.log(`📊 Found ${data.length} rows in CSV.`);

        let updatedCount = 0;
        let poolUpdatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const row of data) {
            const sellerId = row.Id;
            const octoparseId = row.OctoparseId;
            const sellerName = row.Name;

            if (!sellerId || !octoparseId || octoparseId === 'NULL' || octoparseId === '') {
                skippedCount++;
                continue;
            }

            try {
                // 1. Update the OctoparseId in the Sellers table
                const updateSellerQuery = `
                    UPDATE Sellers 
                    SET OctoparseId = @param0, 
                        UpdatedAt = dbo.GetEnvDate()
                    WHERE Id = @param1
                `;
                
                await db.query(updateSellerQuery, [octoparseId, sellerId]);
                updatedCount++;

                // 2. Sync with OctoTasks pool
                // We want to ensure this task exists in OctoTasks and is marked as assigned
                const pool = await db.getPool();
                const taskCheck = await pool.request()
                    .input('taskId', sql.VarChar, octoparseId)
                    .query("SELECT Id FROM OctoTasks WHERE TaskId = @taskId");

                if (taskCheck.recordset.length === 0) {
                    // Insert new task into pool
                    await pool.request()
                        .input('id', sql.VarChar, generateId())
                        .input('taskId', sql.VarChar, octoparseId)
                        .input('taskName', sql.NVarChar, `Task for ${sellerName}`)
                        .input('sellerId', sql.VarChar, sellerId)
                        .query(`
                            INSERT INTO OctoTasks (Id, TaskId, TaskName, GroupName, IsAssigned, SellerId, LastAssignedAt, CreatedAt, UpdatedAt)
                            VALUES (@id, @taskId, @taskName, 'Imported', 1, @sellerId, dbo.GetEnvDate(), dbo.GetEnvDate(), dbo.GetEnvDate())
                        `);
                } else {
                    // Update existing task in pool
                    await pool.request()
                        .input('taskId', sql.VarChar, octoparseId)
                        .input('sellerId', sql.VarChar, sellerId)
                        .query(`
                            UPDATE OctoTasks 
                            SET IsAssigned = 1, 
                                SellerId = @sellerId, 
                                LastAssignedAt = dbo.GetEnvDate(),
                                UpdatedAt = dbo.GetEnvDate()
                            WHERE TaskId = @taskId
                        `);
                }
                poolUpdatedCount++;
                
                if (updatedCount % 50 === 0) {
                    console.log(`✅ Processed ${updatedCount} sellers...`);
                }
            } catch (err) {
                console.error(`❌ Error updating seller ${sellerId}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n✨ Import Summary:');
        console.log(`Total Rows processed: ${data.length}`);
        console.log(`Successfully Updated Sellers: ${updatedCount}`);
        console.log(`Successfully Synced Pool Tasks: ${poolUpdatedCount}`);
        console.log(`Skipped (missing ID): ${skippedCount}`);
        console.log(`Errors: ${errorCount}`);

    } catch (error) {
        console.error('❌ Fatal error during import:', error);
    } finally {
        // Exit process
        setTimeout(() => process.exit(0), 1000);
    }
}

// Run the import
importSellersOctoparseIds();
