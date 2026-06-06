const { getPool } = require('../database/db');

async function run() {
    try {
        const pool = await getPool();
        console.log("Connected to database.");

        const result = await pool.request().query(`
            SELECT a.AsinCode, a.Id,
                   (SELECT SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) FROM AdsPerformance WHERE Asin = a.AsinCode) as TotalOrders
            FROM Asins a
            WHERE (SELECT SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) FROM AdsPerformance WHERE Asin = a.AsinCode) = 141
        `);
        console.log("Matching ASINs with 141 orders:");
        console.log(result.recordset);

        if (result.recordset.length > 0) {
            const targetAsin = result.recordset[0].AsinCode;
            console.log(`\nInspecting orders detail for ASIN: ${targetAsin}`);

            const details = await pool.request().query(`
                SELECT Date, Month, Orders, OrganicOrders, ReportType
                FROM AdsPerformance
                WHERE Asin = '${targetAsin}'
                ORDER BY Date ASC, Month ASC
            `);
            console.log(details.recordset);
        }

        process.exit(0);
    } catch (err) {
        console.error("Error inspecting:", err);
        process.exit(1);
    }
}

run();
