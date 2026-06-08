const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT TABLE_NAME, COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME IN ('AsinHistory', 'AsinWeekHistory', 'AdsPerformance')
        AND COLUMN_NAME LIKE '%Asin%'
    `);
    console.table(result.recordset);
    process.exit(0);
}
run();
