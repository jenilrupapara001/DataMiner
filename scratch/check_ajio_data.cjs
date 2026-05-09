const { getPool } = require('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/database/db');

async function checkData() {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT TOP 5 AsinCode, Title, Brand, Category, CurrentPrice, Mrp, SecondAsp, DiscountPercentage, AvailabilityStatus, ImagesCount
            FROM Asins
            WHERE SellerId = '04f6d6304f1e4153aad48d65'
            ORDER BY UpdatedAt DESC
        `);
        console.log('Sample Saved Ajio Products:');
        console.log(JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
