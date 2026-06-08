const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT COUNT(DISTINCT A1.AsinCode) as Count
        FROM Asins A1
        JOIN Asins A2 ON A1.AsinCode = A2.AsinCode AND A1.Id != A2.Id
        WHERE A1.SellerId = '69e8612f1e4de9e2dc81f78d' 
        AND A1.CreatedAt > '2026-06-01'
    `);
    console.log("Number of June 5th BHARVITA ASINs that also exist under another seller:", result.recordset[0].Count);
    process.exit(0);
}
run();
