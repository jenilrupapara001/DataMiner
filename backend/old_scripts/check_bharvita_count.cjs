const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT COUNT(*) as Count 
        FROM Asins 
        WHERE SellerId = '69e8612f1e4de9e2dc81f78d'
    `);
    console.table(result.recordset);
    process.exit(0);
}
run();
