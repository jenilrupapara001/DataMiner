const { getPool } = require('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/database/db');

async function checkColumns() {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Asins'");
        console.log('Asins Columns and Types:');
        console.log(JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkColumns();
