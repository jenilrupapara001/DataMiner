const { getPool } = require('./backend/database/db');
const sql = require('mssql');

async function listSellers() {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT Id, Name, Marketplace FROM Sellers');
        console.table(result.recordset);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

listSellers();
