const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT TOP 1 Asin FROM AdsPerformance
    `);
    console.table(result.recordset);
    process.exit(0);
}
run();
