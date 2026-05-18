const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();
    
    const countRange = await pool.request().query(`
        SELECT COUNT(*) as cnt 
        FROM AdsPerformance 
        WHERE UploadedAt >= '2026-05-18T00:00:00Z' AND Date >= '2026-04-18'
    `);
    console.log('Uploaded today and Date >= April 18:', countRange.recordset[0].cnt);
    
    const countMatchedRange = await pool.request().query(`
        SELECT COUNT(*) as cnt 
        FROM AdsPerformance p
        INNER JOIN Asins a ON p.Asin = a.AsinCode
        WHERE p.UploadedAt >= '2026-05-18T00:00:00Z' AND p.Date >= '2026-04-18'
    `);
    console.log('Matched and Date >= April 18:', countMatchedRange.recordset[0].cnt);
}

main().catch(console.error);
