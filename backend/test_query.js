const { getPool } = require('./database/db');
const sql = require('mssql');

async function test() {
  try {
    const pool = await getPool();
    const res = await pool.request().query("SELECT TOP 5 SubBsrCategories FROM Asins WHERE SubBsrCategories <> '[]' AND SubBsrCategories IS NOT NULL");
    console.log('Sample Data:', res.recordset);
    
    if(res.recordset.length > 0) {
      const catsStr = res.recordset.find(r => r.SubBsrCategories !== '[]')?.SubBsrCategories;
      if (catsStr) {
          const cats = JSON.parse(catsStr);
          if(cats.length > 0) {
            const cat = cats[0];
            console.log('Testing category:', cat);
            const countRes = await pool.request()
              .input('cat', sql.NVarChar, `%${cat}%`)
              .input('catJson', sql.NVarChar, `%"${cat}"%`)
              .query("SELECT COUNT(*) as c1 FROM Asins WHERE SubBsrCategories LIKE @cat; SELECT COUNT(*) as c2 FROM Asins WHERE SubBsrCategories LIKE @catJson");
            console.log('Counts:', countRes.recordsets);
          }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
      process.exit(0);
  }
}
test();
