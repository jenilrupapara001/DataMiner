const { sql, getPool } = require('./backend/database/db.js');
async function run() {
  const pool = await getPool();
  try {
    const res = await pool.request().query("SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Asins'");
    console.log(res.recordset);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
