const { getPool, sql } = require('../database/db');

async function test() {
    try {
        const pool = await getPool();
        console.log("Connected to database.");

        // Fetch top 5 ASINs from Asins table
        const asinsResult = await pool.request().query(`
            SELECT TOP 5 a.*, s.Name as sellerName, s.Marketplace as sellerMarketplace,
                   (SELECT SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) FROM AdsPerformance WHERE Asin = a.AsinCode) as TotalOrders
            FROM Asins a
            JOIN Sellers s ON a.SellerId = s.Id
            WHERE (SELECT SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) FROM AdsPerformance WHERE Asin = a.AsinCode) > 0
        `);

        const asins = asinsResult.recordset;
        console.log(`Fetched ${asins.length} ASINs with orders > 0.`);

        if (asins.length === 0) {
            console.log("No ASINs found with orders > 0.");
            process.exit(0);
        }

        const asinIds = asins.map(a => `'${a.Id}'`).join(',');
        const asinCodes = asins.map(a => `'${a.AsinCode}'`).join(',');

        console.log("asinIds:", asinIds);
        console.log("asinCodes:", asinCodes);

        const monthsResult = await pool.request().query(`
          SELECT DISTINCT ISNULL(Month, DATEFROMPARTS(YEAR(Date), MONTH(Date), 1)) as Month 
          FROM AdsPerformance 
          WHERE Month IS NOT NULL OR Date IS NOT NULL
          ORDER BY Month ASC
        `);
        const availableMonths = monthsResult.recordset.map(r => {
          return r.Month instanceof Date ? r.Month.toISOString().split('T')[0] : r.Month;
        });
        console.log("availableMonths:", availableMonths);

        const monthlyOrdersMap = {};
        const monthlyOrdersResult = await pool.request().query(`
          SELECT Asin, ISNULL(Month, DATEFROMPARTS(YEAR(Date), MONTH(Date), 1)) as Month, SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) as Orders
          FROM AdsPerformance
          WHERE Asin IN (${asinCodes})
          AND (Month IS NOT NULL OR Date IS NOT NULL)
          GROUP BY Asin, ISNULL(Month, DATEFROMPARTS(YEAR(Date), MONTH(Date), 1))
        `);

        console.log("monthlyOrdersResult rows:", monthlyOrdersResult.recordset.length);

        monthlyOrdersResult.recordset.forEach(r => {
          if (!monthlyOrdersMap[r.Asin]) monthlyOrdersMap[r.Asin] = {};
          const monthStr = r.Month instanceof Date ? r.Month.toISOString().split('T')[0] : r.Month;
          monthlyOrdersMap[r.Asin][monthStr] = r.Orders;
        });

        asins.forEach(a => {
            console.log(`ASIN: ${a.AsinCode}`);
            console.log(`  TotalOrders (from subquery): ${a.TotalOrders}`);
            console.log(`  monthlyOrders Map:`, monthlyOrdersMap[a.AsinCode] || {});
        });

        process.exit(0);
    } catch (err) {
        console.error("Error inspecting:", err);
        process.exit(1);
    }
}

test();
