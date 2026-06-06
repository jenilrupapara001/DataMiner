const { getPool, sql } = require('../database/db');
async function run() {
    try {
        const pool = await getPool();
        const res = await pool.request().query("SELECT [Key], Value FROM SystemSettings");
        console.log(res.recordset);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
run();
