const { getPool } = require('./database/db');
require('dotenv').config();

async function run() {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT Id, Status, Details, StartTime, EndTime FROM ScheduledRuns ORDER BY StartTime DESC
        `);
        console.log("Total runs:", result.recordset.length);
        if (result.recordset.length > 0) {
            console.log("Sample Details from latest:", result.recordset[0].Details);
        }
    } catch(err) {
        console.error(err);
    }
    process.exit(0);
}
run();
