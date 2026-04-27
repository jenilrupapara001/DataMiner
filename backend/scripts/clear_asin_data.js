const { getPool, sql } = require('../database/db');

/**
 * Cleanup ASIN Data
 * DANGER: This script will truncate/delete all ASIN-related data.
 * Usage: node backend/scripts/clear_asin_data.js
 */
async function clearAsinData() {
    try {
        console.log('🚀 Starting ASIN Data Cleanup...');
        const pool = await getPool();
        
        // 1. Delete ASIN Week History (The largest table)
        console.log('📦 Clearing ASIN Week History...');
        await pool.request().query('TRUNCATE TABLE ASINWeekHistory');
        
        // 2. Delete Tasks related to ASINs
        console.log('📋 Clearing Tasks...');
        await pool.request().query('DELETE FROM Tasks');
        
        // 3. Delete ASINs
        console.log('🏷️ Clearing ASINs...');
        // Using DELETE instead of TRUNCATE because of FK dependencies if any
        // If there are FKs, we might need to delete in specific order
        await pool.request().query('DELETE FROM Asins');
        
        // 4. Clear any pending uploads or tracking logs related to ASINs if needed
        // console.log('🔄 Clearing Seller ASIN Tracker...');
        // await pool.request().query('DELETE FROM SellerAsinTracker');

        console.log('✅ Cleanup Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Cleanup Failed:', err.message);
        process.exit(1);
    }
}

clearAsinData();
