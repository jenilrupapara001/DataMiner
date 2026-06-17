const { sql, getPool } = require('../database/db');
async function main() {
    const pool = await getPool();
    const res = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Tasks'");
    console.log(res.recordset);
    process.exit(0);
}
main();
