/**
 * update_octoparse_ids_from_csv.js
 * 
 * Reads octoparse_tasks.csv (fetched live from Octoparse API) and updates
 * the Sellers.OctoparseId column in the database by matching seller names.
 * 
 * Usage:
 *   Dry run (default):  node scripts/update_octoparse_ids_from_csv.js
 *   Execute:            node scripts/update_octoparse_ids_from_csv.js --run
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { sql } = db;
require('dotenv').config();

const CSV_PATH = path.join(__dirname, '../../octoparse_tasks.csv');

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    // Skip header row
    const rows = lines.slice(1);
    return rows.map(line => {
        // Parse quoted CSV: "taskId","taskName","groupName"
        const match = line.match(/^"([^"]+)","([^"]+)","([^"]+)"/);
        if (!match) return null;
        return {
            taskId: match[1].trim(),
            taskName: match[2].trim(),
            groupName: match[3].trim()
        };
    }).filter(Boolean);
}

function normalizeName(name) {
    return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

async function updateOctoparseIds() {
    const isExecution = process.argv.includes('--run');
    
    console.log('\n======================================================');
    console.log(`🚀 Octoparse ID Sync from CSV — ${isExecution ? 'EXECUTION MODE' : 'DRY RUN'}`);
    console.log('======================================================\n');

    if (!isExecution) {
        console.log('💡 TIP: Run with --run flag to apply changes.\n');
    }

    // 1. Parse CSV
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌ CSV file not found at: ${CSV_PATH}`);
        console.error('   Run: cd backend/scripts && node fetch_tasks_to_csv.js');
        process.exit(1);
    }

    const csvTasks = parseCSV(CSV_PATH);
    // Only use RetailOps-Production tasks (filter out test/other groups)
    const productionTasks = csvTasks.filter(t => t.groupName === 'RetailOps-Production');
    console.log(`📄 CSV loaded: ${csvTasks.length} total tasks, ${productionTasks.length} from RetailOps-Production\n`);

    // 2. Build lookup map: normalized name → taskId
    const csvNameToTaskId = new Map();
    productionTasks.forEach(t => {
        csvNameToTaskId.set(normalizeName(t.taskName), t.taskId);
    });

    // 3. Fetch all sellers from DB
    const pool = await db.getPool();
    const sellersResult = await pool.request().query(`
        SELECT Id, Name, OctoparseId, Marketplace
        FROM Sellers
        ORDER BY Name
    `);
    const sellers = sellersResult.recordset;
    console.log(`🗄️  Database has ${sellers.length} sellers.\n`);

    let matched = 0;
    let alreadyCurrent = 0;
    let noMatch = 0;
    let updated = 0;
    let errors = 0;

    const noMatchList = [];
    const updateList = [];

    for (const seller of sellers) {
        const normalized = normalizeName(seller.Name);
        const csvTaskId = csvNameToTaskId.get(normalized);

        if (!csvTaskId) {
            noMatch++;
            noMatchList.push(seller.Name);
            continue;
        }

        matched++;

        if (seller.OctoparseId === csvTaskId) {
            alreadyCurrent++;
            continue;
        }

        updateList.push({ seller, newTaskId: csvTaskId });
    }

    // Show update plan
    console.log(`📊 Match Summary:`);
    console.log(`   ✅ Matched in CSV:    ${matched}`);
    console.log(`   🔄 Need update:       ${updateList.length}`);
    console.log(`   ⏭️  Already current:   ${alreadyCurrent}`);
    console.log(`   ❌ Not found in CSV:  ${noMatch}`);

    if (updateList.length > 0) {
        console.log('\n📋 Updates to apply:');
        updateList.forEach(({ seller, newTaskId }) => {
            console.log(`   [${seller.Name}]`);
            console.log(`      OLD: ${seller.OctoparseId || '(empty)'}`);
            console.log(`      NEW: ${newTaskId}`);
        });
    }

    if (noMatchList.length > 0) {
        console.log('\n⚠️  Sellers with NO matching CSV task (will not be updated):');
        noMatchList.forEach(name => console.log(`   - ${name}`));
    }

    if (!isExecution) {
        console.log('\n✅ Dry run complete. Run with --run to apply changes.');
        process.exit(0);
    }

    // 4. Apply updates
    if (updateList.length === 0) {
        console.log('\n✅ All sellers already have current Octoparse IDs. Nothing to update.');
        process.exit(0);
    }

    console.log('\n🔄 Applying database updates...\n');

    for (const { seller, newTaskId } of updateList) {
        try {
            // Update Sellers table
            await pool.request()
                .input('newTaskId', sql.VarChar, newTaskId)
                .input('sellerId', sql.VarChar, seller.Id)
                .query('UPDATE Sellers SET OctoparseId = @newTaskId, UpdatedAt = dbo.GetEnvDate() WHERE Id = @sellerId');

            // Upsert OctoTasks table to keep it in sync
            const taskCheck = await pool.request()
                .input('taskId', sql.VarChar, newTaskId)
                .query('SELECT Id FROM OctoTasks WHERE TaskId = @taskId');

            if (taskCheck.recordset.length === 0) {
                // New task ID - insert it
                await pool.request()
                    .input('id', sql.VarChar, db.generateId())
                    .input('taskId', sql.VarChar, newTaskId)
                    .input('taskName', sql.NVarChar, `Task for ${seller.Name}`)
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query(`
                        INSERT INTO OctoTasks (Id, TaskId, TaskName, GroupName, IsAssigned, SellerId, LastAssignedAt, CreatedAt, UpdatedAt)
                        VALUES (@id, @taskId, @taskName, 'RetailOps-Production', 1, @sellerId, dbo.GetEnvDate(), dbo.GetEnvDate(), dbo.GetEnvDate())
                    `);
            } else {
                // Existing entry - update assignment
                await pool.request()
                    .input('taskId', sql.VarChar, newTaskId)
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query(`
                        UPDATE OctoTasks
                        SET IsAssigned = 1, SellerId = @sellerId, LastAssignedAt = dbo.GetEnvDate(), UpdatedAt = dbo.GetEnvDate()
                        WHERE TaskId = @taskId
                    `);
            }

            console.log(`   ✅ Updated: ${seller.Name} → ${newTaskId}`);
            updated++;
        } catch (err) {
            console.error(`   ❌ Failed for ${seller.Name}: ${err.message}`);
            errors++;
        }
    }

    console.log('\n======================================================');
    console.log('✨ Update Complete!');
    console.log('======================================================');
    console.log(`   Successfully updated: ${updated}`);
    console.log(`   Errors:               ${errors}`);
    console.log(`   Already current:      ${alreadyCurrent}`);
    console.log(`   Not in CSV:           ${noMatch}`);
    console.log('======================================================\n');

    process.exit(0);
}

updateOctoparseIds().catch(e => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
});
