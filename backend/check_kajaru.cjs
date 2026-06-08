const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT COUNT(*) as Count 
        FROM Asins 
        WHERE SellerId = '69e8612e1e4de9e2dc81f777' AND CreatedAt < '2026-06-01'
    `);
    console.table(result.recordset);
    process.exit(0);
}
run();
