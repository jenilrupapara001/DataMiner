const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT SellerId, COUNT(*) as Count 
        FROM Asins 
        WHERE SellerId IN ('69e8612f1e4de9e2dc81f792', '69e861321e4de9e2dc81f7cc') AND CreatedAt < '2026-06-01'
        GROUP BY SellerId
    `);
    console.table(result.recordset);
    process.exit(0);
}
run();
