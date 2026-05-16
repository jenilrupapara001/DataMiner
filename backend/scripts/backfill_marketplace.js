const { getPool, sql } = require('../database/db');
require('dotenv').config();

async function backfillMarketplace() {
    console.log('🚀 Starting Backfill for Marketplace column...');
    try {
        const pool = await getPool();

        // 1. Update Asins from Sellers
        console.log('🔄 Syncing Marketplace from Sellers to Asins...');
        const result = await pool.request().query(`
            UPDATE a
            SET a.Marketplace = s.Marketplace
            FROM Asins a
            JOIN Sellers s ON a.SellerId = s.Id
            WHERE a.Marketplace IS NULL OR a.Marketplace = ''
        `);
        console.log(`✅ Backfilled Marketplace for ${result.rowsAffected[0]} ASIN records.`);

        // 2. Set default to amazon.in for any remaining (safety)
        const safetyResult = await pool.request().query(`
            UPDATE Asins
            SET Marketplace = 'amazon.in'
            WHERE Marketplace IS NULL OR Marketplace = ''
        `);
        if (safetyResult.rowsAffected[0] > 0) {
            console.log(`✅ Applied default 'amazon.in' to ${safetyResult.rowsAffected[0]} records.`);
        }

        console.log('✨ Backfill complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during backfill:', err.message);
        process.exit(1);
    }
}

backfillMarketplace();
