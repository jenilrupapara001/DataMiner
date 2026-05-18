const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();
    
    const countTotal = await pool.request().query(`
        SELECT COUNT(*) as cnt 
        FROM AdsPerformance 
        WHERE UploadedAt >= '2026-05-18T00:00:00Z'
    `);
    console.log('Total uploaded today:', countTotal.recordset[0].cnt);
    
    const countMatched = await pool.request().query(`
        SELECT COUNT(*) as cnt 
        FROM AdsPerformance p
        INNER JOIN Asins a ON p.Asin = a.AsinCode
        WHERE p.UploadedAt >= '2026-05-18T00:00:00Z'
    `);
    console.log('Matched ASINs uploaded today:', countMatched.recordset[0].cnt);
    
    const countUnmatched = await pool.request().query(`
        SELECT COUNT(*) as cnt 
        FROM AdsPerformance p
        LEFT JOIN Asins a ON p.Asin = a.AsinCode
        WHERE p.UploadedAt >= '2026-05-18T00:00:00Z' AND a.AsinCode IS NULL
    `);
    console.log('Unmatched ASINs uploaded today:', countUnmatched.recordset[0].cnt);
}

main().catch(console.error);
