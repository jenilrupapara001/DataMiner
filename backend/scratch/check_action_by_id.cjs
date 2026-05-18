const { getPool } = require('../database/db');
const sql = require('mssql');

async function main() {
    try {
        const pool = await getPool();
        const id = '3ded7bada5b24e01ab05fa0d';
        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .query('SELECT * FROM Actions WHERE Id = @id');
        console.log('Action record:');
        console.dir(result.recordset[0], { depth: null });
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

main();
