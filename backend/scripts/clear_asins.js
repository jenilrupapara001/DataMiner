'use strict';

const { sql, getPool } = require('../database/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function clearAsinData() {
    console.log('\n🚀 Starting robust deletion process (Batched Delete)...');

    try {
        const pool = await getPool();

        const tables = [
            { name: 'AsinWeekHistory', type: 'simple' },
            { name: 'AsinHistory', type: 'simple' },
            { name: 'RevenueCalculators', type: 'simple' },
            { name: 'MonthlyPerformance', type: 'simple' },
            { name: 'AdsPerformance', type: 'batched' },
            { name: 'Orders', type: 'simple' },
            { name: 'CalculatorAsins', type: 'simple' },
            { name: 'Alerts', type: 'linked', query: 'DELETE FROM Alerts WHERE AsinId IS NOT NULL' },
            { name: 'Files', type: 'linked', query: "DELETE FROM Files WHERE RelatedTo = 'ASIN'" },
            { name: 'Asins', type: 'batched' }
        ];

        for (const table of tables) {
            console.log(`   - 🧹 Clearing ${table.name}...`);
            try {
                if (table.type === 'batched') {
                    let totalDeleted = 0;
                    let rowsInBatch = -1;
                    while (rowsInBatch !== 0) {
                        const res = await pool.request().query(`DELETE TOP (2000) FROM ${table.name}`);
                        rowsInBatch = res.rowsAffected[0];
                        totalDeleted += rowsInBatch;
                        if (rowsInBatch > 0) process.stdout.write(`.`);
                    }
                    console.log(`\n     ✅ Done (${totalDeleted} rows deleted).`);
                } else if (table.type === 'linked') {
                    const result = await pool.request().query(table.query);
                    console.log(`     ✅ Done (${result.rowsAffected[0]} rows deleted).`);
                } else {
                    const result = await pool.request().query(`DELETE FROM ${table.name}`);
                    console.log(`     ✅ Done (${result.rowsAffected[0]} rows deleted).`);
                }
            } catch (err) {
                if (err.message.includes('Invalid object name')) {
                    console.log(`     ⚠️  Skipped: Table does not exist.`);
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
