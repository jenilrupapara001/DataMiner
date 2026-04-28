const { getPool } = require('./database/db');
const sql = require('mssql');

async function test() {
  try {
    const pool = await getPool();
    const catRes = await pool.request().query("SELECT TOP 5 value as cat FROM Asins a CROSS APPLY OPENJSON(a.SubBsrCategories) WHERE a.SubBsrCategories IS NOT NULL AND ISJSON(a.SubBsrCategories) > 0");
    console.log("Categories found from OPENJSON:", catRes.recordset);
    
    for (let r of catRes.recordset) {
      const cat = r.cat;
      const countRes = await pool.request()
        .input('cat', sql.NVarChar, `%"${cat}"%`)
        .query("SELECT COUNT(*) as total FROM Asins a WHERE a.SubBsrCategories LIKE @cat");
      console.log(`Cat: "${cat}", Count matching: ${countRes.recordset[0].total}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
test();
