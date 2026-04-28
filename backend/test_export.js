const { getPool, sql } = require('./database/db');
async function test() {
  try {
    const pool = await getPool();
    const res = await pool.request().query("SELECT COUNT(*) as cnt FROM Downloads");
    console.log("Downloads table has", res.recordset[0].cnt, "rows.");
  } catch (err) {
    console.error("Test failed", err);
  } finally {
    process.exit(0);
  }
}
test();
