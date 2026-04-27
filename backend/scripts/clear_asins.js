'use strict';

const { sql, getPool } = require('../database/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function clearAsinData() {
    console.log('\n🚀 Starting robust deletion process (TRUNCATE + Batched)...');
    
    try {
        const pool = await getPool();
        
        const tables = [
            { name: 'AsinWeekHistory', type: 'truncate' },
            { name: 'AsinHistory', type: 'truncate' },
            { name: 'RevenueCalculators', type: 'truncate' },
            { name: 'MonthlyPerformance', type: 'truncate' },
            { name: 'AdsPerformance', type: 'truncate' },
            { name: 'Orders', type: 'truncate' },
            { name: 'CalculatorAsins', type: 'truncate' },
            { name: 'Alerts', type: 'linked', query: 'DELETE FROM Alerts WHERE AsinId IS NOT NULL' },
            { name: 'Files', type: 'linked', query: "DELETE FROM Files WHERE RelatedTo = 'ASIN'" },
            { name: 'Asins', type: 'batched' }
        ];

        for (const table of tables) {
            console.log(`   - 🧹 Clearing ${table.name}...`);
            try {
                if (table.type === 'truncate') {
                    await pool.request().query(`TRUNCATE TABLE ${table.name}`);
                    console.log(`     ✅ Truncated.`);
                } else if (table.type === 'batched') {
                    let totalDeleted = 0;
                    let rowsInBatch = -1;
                    while (rowsInBatch !== 0) {
                        try {
                            const res = await pool.request().query(`DELETE TOP (1000) FROM ${table.name}`);
                            rowsInBatch = res.rowsAffected[0];
                            totalDeleted += rowsInBatch;
                            if (rowsInBatch > 0) process.stdout.write(`.`);
                        } catch (batchErr) {
                            if (batchErr.message.includes('transaction log')) {
                                console.log('\n     ⚠️ Log full, waiting 2s for log clearing...');
                                await new Promise(r => setTimeout(r, 2000));
                                // retry same batch
                                rowsInBatch = -1; 
                            } else {
                                throw batchErr;
                            }
                        }
                    }
                    console.log(`\n     ✅ Done (${totalDeleted} rows deleted).`);
                } else if (table.type === 'linked') {
                    const result = await pool.request().query(table.query);
                    console.log(`     ✅ Done (${result.rowsAffected[0]} rows deleted).`);
                }
            } catch (err) {
                if (err.message.includes('Invalid object name')) {
                    console.log(`     ⚠️  Skipped: Table does not exist.`);
                } else if (err.message.includes('FOREIGN KEY constraint')) {
                    console.log(`     ⚠️  Truncate failed due to FK. Falling back to DELETE...`);
                    const res = await pool.request().query(`DELETE FROM ${table.name}`);
                    console.log(`     ✅ Done (${res.rowsAffected[0]} rows deleted).`);
                } else {
                    console.error(`     ❌ Error clearing ${table.name}:`, err.message);
                }
            }
        }
        
        console.log('\n🏁 Data purge finished. Your database is now clean of ASIN data.');
        
    } catch (err) {
        console.error('❌ Critical Error:', err.message);
        process.exit(1);
    } finally {
        setTimeout(() => process.exit(0), 100);
    }
}

clearAsinData();
