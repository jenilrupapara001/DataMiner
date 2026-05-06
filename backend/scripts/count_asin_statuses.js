const { getPool } = require('../database/db');
require('dotenv').config();

async function countAsins() {
    try {
        const pool = await getPool();
        const totalResult = await pool.request().query('SELECT COUNT(*) as Total FROM Asins');
        const breakdownResult = await pool.request().query(`
            SELECT AvailabilityStatus, COUNT(*) as Count 
            FROM Asins 
            GROUP BY AvailabilityStatus
        `);
        const priceZeroResult = await pool.request().query(`
            SELECT COUNT(*) as Count 
            FROM Asins 
            WHERE CurrentPrice = 0 OR CurrentPrice IS NULL
        `);
        const pricePositiveResult = await pool.request().query(`
            SELECT COUNT(*) as Count 
            FROM Asins 
            WHERE CurrentPrice > 0
        `);

        console.log('📊 --- ASIN DATABASE STATUS BREAKDOWN ---');
        console.log(`Total ASINs in Database: ${totalResult.recordset[0].Total}`);
        console.log(`ASINs with Price > 0: ${pricePositiveResult.recordset[0].Count}`);
        console.log(`ASINs with Price = 0 or Null: ${priceZeroResult.recordset[0].Count}`);
        console.log('\nGrouped by AvailabilityStatus:');
        breakdownResult.recordset.forEach(row => {
            console.log(`- ${row.AvailabilityStatus || 'NULL (No Status)'}: ${row.Count}`);
        });
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}
countAsins();
