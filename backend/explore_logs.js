const { getPool } = require('./database/db');
require('dotenv').config();

async function run() {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT TOP 1 * FROM ScheduledRuns
        `);
        console.log(result.recordset);
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
}
run();
