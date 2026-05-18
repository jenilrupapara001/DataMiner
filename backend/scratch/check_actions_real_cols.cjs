const { getPool } = require('../database/db');
const sql = require('mssql');

async function main() {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'SystemLogs'
        `);
        console.log('Columns in Actions table:');
        console.dir(result.recordset, { depth: null });
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

main();
