const { sql, getPool } = require('./backend/database/db');
async function run() {
  const pool = await getPool();
  console.log("Fixing SubBsrHistory...");
  const res = await pool.request().query(`
    UPDATE SubBsrHistory 
    SET Date = '2026-06-08'
    WHERE Date = '2026-06-07' AND CreatedAt > '2026-06-08 00:00:00'
  `);
  console.log('Fixed SubBsrHistory rows:', res.rowsAffected[0]);
  process.exit(0);
}
run();
