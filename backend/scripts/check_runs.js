const { getPool } = require('../database/db');
async function run() {
    try {
        const pool = await getPool();
        const res = await pool.request().query("SELECT TOP 5 * FROM ScheduledRuns ORDER BY StartTime DESC");
        console.log(res.recordset);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
