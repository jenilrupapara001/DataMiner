const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT TOP 5 Title, AsinCode, ImageUrl, CurrentPrice 
        FROM Asins 
        WHERE SellerId = '69e8612f1e4de9e2dc81f792' AND CreatedAt > '2026-06-04'
    `);
    console.table(result.recordset);
    process.exit(0);
}
run();
