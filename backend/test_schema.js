const { getPool } = require('./database/db');
async function test() {
  const pool = await getPool();
  const res = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Sellers'");
  console.log(res.recordset);
  process.exit(0);
}
test();
