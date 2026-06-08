const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT Sellers.Name, Asins.SellerId, COUNT(*) as Count 
        FROM Asins 
        LEFT JOIN Sellers ON Asins.SellerId = Sellers.Id 
        GROUP BY Asins.SellerId, Sellers.Name 
        ORDER BY Count DESC
    `);
    console.table(result.recordset);
    process.exit(0);
}
run();
