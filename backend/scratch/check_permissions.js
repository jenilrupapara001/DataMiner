const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();
    const result = await pool.request().query("SELECT Name, Category, Action FROM Permissions WHERE Category = 'GMS Tracker' OR Name LIKE '%gms%'");
    console.log("Permissions count matching 'gms':", result.recordset.length);
    console.table(result.recordset);
}

main().catch(console.error);
