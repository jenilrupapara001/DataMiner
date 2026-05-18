const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();
    
    const countAdsPerformance = await pool.request().query('SELECT COUNT(*) as cnt FROM AdsPerformance');
    console.log('Total in AdsPerformance:', countAdsPerformance.recordset[0].cnt);
    
    const countAsins = await pool.request().query('SELECT COUNT(*) as cnt FROM Asins');
    console.log('Total in Asins:', countAsins.recordset[0].cnt);
    
    const innerJoinCount = await pool.request().query(`
        SELECT COUNT(*) as cnt 
        FROM AdsPerformance p
        INNER JOIN Asins a ON p.Asin = a.AsinCode
    `);
    console.log('Inner Join Count:', innerJoinCount.recordset[0].cnt);
    
    const unmatched = await pool.request().query(`
        SELECT DISTINCT TOP 10 p.Asin 
        FROM AdsPerformance p
        LEFT JOIN Asins a ON p.Asin = a.AsinCode
        WHERE a.AsinCode IS NULL
    `);
    console.log('Unmatched ASINs in AdsPerformance:', unmatched.recordset);
}

main().catch(console.error);
