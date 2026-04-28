const { getPool } = require('./database/db');
async function run() {
  try {
    const pool = await getPool();
    const res = await pool.request().query("SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('Asins')");
    console.log(res.recordset);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
