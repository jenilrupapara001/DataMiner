const { getPool } = require('./database/db');

async function checkTables() {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");
        console.log(result.recordset.map(r => r.TABLE_NAME));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTables();
