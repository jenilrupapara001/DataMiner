const { getPool } = require('./database/db');
const sql = require('mssql');

async function checkSeller() {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('name', sql.VarChar, '101-BHARVITA')
            .query('SELECT * FROM Sellers WHERE Name = @name');
        console.dir(result.recordset[0], { depth: null });
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkSeller();
