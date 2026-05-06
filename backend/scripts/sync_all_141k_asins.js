const { getPool } = require('../database/db');
require('dotenv').config();

async function syncAll141kAsins() {
    console.log('🚀 Starting Deep Sync & Cleanup for all 141k ASIN records...');
    try {
        const pool = await getPool();

        // 1. Trim leading/trailing spaces from AvailabilityStatus across all rows
        console.log('🔄 Cleaning up leading/trailing whitespaces from statuses...');
        const trimResult = await pool.request().query(`
            UPDATE Asins 
            SET AvailabilityStatus = LTRIM(RTRIM(AvailabilityStatus))
            WHERE AvailabilityStatus IS NOT NULL
        `);
        console.log(`✅ Cleaned up whitespace for ${trimResult.rowsAffected[0]} records.`);

        // 2. Update all ASINs with positive price to "Available" if they are currently marked as unavailable
        console.log('🔄 Syncing all positive price ASINs to "Available"...');
        const positivePriceResult = await pool.request().query(`
            UPDATE Asins
            SET AvailabilityStatus = 'Available',
                UpdatedAt = GETDATE()
            WHERE CurrentPrice > 0 
              AND (AvailabilityStatus = 'Currently unavailable.' 
                   OR AvailabilityStatus = 'Temporarily out of stock.' 
                   OR AvailabilityStatus IS NULL 
                   OR AvailabilityStatus = '')
        `);
        console.log(`✅ Successfully updated ${positivePriceResult.rowsAffected[0]} positive-priced ASINs to "Available".`);

        // 3. Update all ASINs with zero/null price to "Currently unavailable." if they are currently marked as available/in stock
        console.log('🔄 Syncing all zero/null price ASINs to "Currently unavailable."...');
        const zeroPriceResult = await pool.request().query(`
            UPDATE Asins
            SET AvailabilityStatus = 'Currently unavailable.',
                UpdatedAt = GETDATE()
            WHERE (CurrentPrice = 0 OR CurrentPrice IS NULL)
              AND (AvailabilityStatus = 'Available' 
                   OR AvailabilityStatus = 'In stock' 
                   OR AvailabilityStatus IS NULL 
                   OR AvailabilityStatus = '')
        `);
        console.log(`✅ Successfully updated ${zeroPriceResult.rowsAffected[0]} zero/null-priced ASINs to "Currently unavailable."`);

        console.log('✨ Deep sync complete for all 141k records!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during deep sync:', err.message);
        process.exit(1);
    }
}

syncAll141kAsins();
