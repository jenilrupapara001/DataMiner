const { getPool } = require('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/database/db');

async function testGetAsins() {
    try {
        const pool = await getPool();
        const asinsResult = await pool.request().query(`
            SELECT TOP 5 a.Id, a.AsinCode, a.Sku, a.Title, a.CurrentPrice, a.DiscountPercentage, a.Rating, a.ReviewCount, a.AvailabilityStatus, s.Marketplace
            FROM Asins a
            JOIN Sellers s ON a.SellerId = s.Id
            WHERE s.Marketplace = 'ajio'
        `);
        const asins = asinsResult.recordset;
        const asinIds = asins.map(a => `'${a.Id}'`).join(',');

        const dailyHistoryResult = await pool.request().query(`
            SELECT AsinId, Date, Price as price, BSR as bsr, 
                   Rating as rating, ReviewCount as reviews, 
                   StockLevel as stockLevel, LQS as lqs
            FROM AsinHistory 
            WHERE AsinId IN (${asinIds}) 
            ORDER BY Date ASC
        `);
        
        console.log('Daily History recordset sample:');
        console.log(JSON.stringify(dailyHistoryResult.recordset, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testGetAsins();
