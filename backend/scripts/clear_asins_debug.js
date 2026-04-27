'use strict';

const { sql, getPool } = require('../database/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function clearAsinData() {
    console.log('\n🚀 Starting deletion process (No Transaction)...');
    
    try {
        const pool = await getPool();
        
        const tables = [
            { name: 'AsinWeekHistory', query: 'DELETE FROM AsinWeekHistory' },
            { name: 'AsinHistory', query: 'DELETE FROM AsinHistory' },
            { name: 'RevenueCalculators', query: 'DELETE FROM RevenueCalculators' },
            { name: 'CalculatorAsins', query: 'DELETE FROM CalculatorAsins' },
            { name: 'Alerts (Linked)', query: 'DELETE FROM Alerts WHERE AsinId IS NOT NULL' },
            { name: 'Files (Linked)', query: "DELETE FROM Files WHERE RelatedTo = 'ASIN'" },
            { name: 'Asins', query: 'DELETE FROM Asins' }
        ];

        for (const table of tables) {
            console.log(`   - 🧹 Clearing ${table.name}...`);
            try {
                await pool.request().query(table.query);
                console.log(`     ✅ Done.`);
            } catch (err) {
                console.error(`     ❌ Error clearing ${table.name}:`, err.message);
            }
        }
        
        console.log('\n🏁 Process finished.');
        
    } catch (err) {
        console.error('❌ Error details:', err.message);
        process.exit(1);
    } finally {
        setTimeout(() => process.exit(0), 100);
    }
}

clearAsinData();
