const { getPool } = require('./database/db');
const sql = require('mssql');

async function run() {
  try {
    const pool = await getPool();
    console.log("Testing COUNT query...");
    const countRes = await pool.request().query("SELECT COUNT(*) as total FROM Asins a WHERE 1=1");
    console.log("Total: ", countRes.recordset[0].total);

    console.log("Testing DATA query...");
    const dataRes = await pool.request()
        .input('offset', sql.Int, 0)
        .input('limit', sql.Int, 25)
        .query(`
        SELECT 
          a.Id as _id, a.*, 
          s.Name as sellerName, s.Marketplace as sellerMarketplace
        FROM Asins a
        LEFT JOIN Sellers s ON a.SellerId = s.Id
        WHERE 1=1
        ORDER BY a.LastScrapedAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);
    console.log("Returned rows: ", dataRes.recordset.length);

    console.log("Testing FILTERS query...");
    const catRes = await pool.request().query(`SELECT DISTINCT Category FROM Asins WHERE 1=1 AND Category IS NOT NULL AND Category != '' ORDER BY Category ASC`);
    console.log("Categories: ", catRes.recordset.length);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
