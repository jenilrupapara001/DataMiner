const { getPool } = require('../database/db');
require('dotenv').config();

async function syncOldAvailability() {
    console.log('🚀 Starting Existing ASIN Availability Status Sync...');
    try {
        const pool = await getPool();
        
        // 1. Run update to mark any ASIN with CurrentPrice > 0 as 'Available' if it is currently marked as 'Currently unavailable.'
        console.log('🔄 Syncing ASINs with positive price to "Available"...');
        const updateResult = await pool.request().query(`
            UPDATE Asins
            SET AvailabilityStatus = 'Available',
                UpdatedAt = GETDATE()
            WHERE CurrentPrice > 0 
              AND (AvailabilityStatus = 'Currently unavailable.' OR AvailabilityStatus IS NULL)
        `);
        
        console.log(`✅ Successfully updated ${updateResult.rowsAffected[0]} ASINs to "Available".`);
        
        // 2. Run update to mark any ASIN with CurrentPrice = 0 as 'Currently unavailable.' if it was marked as 'Available' or is null
        console.log('🔄 Syncing ASINs with zero/null price to "Currently unavailable."...');
        const zeroPriceResult = await pool.request().query(`
            UPDATE Asins
            SET AvailabilityStatus = 'Currently unavailable.',
                UpdatedAt = GETDATE()
            WHERE (CurrentPrice = 0 OR CurrentPrice IS NULL)
              AND (AvailabilityStatus = 'Available' OR AvailabilityStatus IS NULL)
        `);
        
        console.log(`✅ Successfully updated ${zeroPriceResult.rowsAffected[0]} ASINs to "Currently unavailable."`);
        
        console.log('✨ Database sync complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error syncing availability status:', err.message);
        process.exit(1);
    }
}

syncOldAvailability();
