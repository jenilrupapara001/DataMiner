const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT AsinCode, COUNT(DISTINCT SellerId) as SellersCount
        FROM Asins
        GROUP BY AsinCode
        HAVING COUNT(DISTINCT SellerId) > 1
    `);
    console.log("Number of ASINs associated with multiple sellers:", result.recordset.length);
    process.exit(0);
}
run();
