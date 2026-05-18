const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();
    
    const sellersSummary = await pool.request().query(`
        SELECT 
            a.SellerId,
            s.Name as SellerName,
            COUNT(DISTINCT p.Asin) as distinctAsins,
            COUNT(*) as totalRecords
        FROM AdsPerformance p
        INNER JOIN Asins a ON p.Asin = a.AsinCode
        LEFT JOIN Sellers s ON a.SellerId = s.Id
        GROUP BY a.SellerId, s.Name
    `);
    console.log('Sellers for matched ASINs in AdsPerformance:', sellersSummary.recordset);
}

main().catch(console.error);
