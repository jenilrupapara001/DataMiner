const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();

    console.log('--- FINDING SELLERS WITH BOTH TARGETS AND ADS DATA ---');
    const query = `
        SELECT DISTINCT 
            t.SellerId as targetSellerHexId,
            s.SellerId as sellerCode,
            s.Name as sellerName,
            (SELECT COUNT(*) FROM GmsTargets WHERE SellerId = t.SellerId) as targetCount,
            (SELECT SUM(AdSpend) FROM AdsPerformance p INNER JOIN Asins a ON p.Asin = a.AsinCode WHERE a.SellerId = t.SellerId) as totalAdSpend
        FROM GmsTargets t
        INNER JOIN Sellers s ON t.SellerId = s.Id
        WHERE (SELECT SUM(AdSpend) FROM AdsPerformance p INNER JOIN Asins a ON p.Asin = a.AsinCode WHERE a.SellerId = t.SellerId) > 0
    `;
    const result = await pool.request().query(query);
    console.table(result.recordset);
}

main().catch(console.error);
