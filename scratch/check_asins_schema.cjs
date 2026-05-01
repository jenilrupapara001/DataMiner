const { getPool } = require('./backend/database/db');
require('dotenv').config();

async function checkSchema() {
    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Asins'");
        console.log('Asins Columns:', result.recordset.map(r => r.COLUMN_NAME));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
