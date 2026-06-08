const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT Sellers.Name, Asins.SellerId, CAST(Asins.CreatedAt AS DATE) as Date, COUNT(*) as Count 
        FROM Asins 
        LEFT JOIN Sellers ON Asins.SellerId = Sellers.Id
        WHERE Asins.CreatedAt > '2026-06-01'
        GROUP BY Asins.SellerId, Sellers.Name, CAST(Asins.CreatedAt AS DATE)
        HAVING COUNT(*) > 500
        ORDER BY Count DESC
    `);
    console.table(result.recordset);
    process.exit(0);
}
run();
