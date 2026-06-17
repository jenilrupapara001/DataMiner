const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();
    const result = await pool.request().query('SELECT TOP 10 Id, SellerId, Name, Marketplace FROM Sellers');
    console.table(result.recordset);
}

main().catch(console.error);
