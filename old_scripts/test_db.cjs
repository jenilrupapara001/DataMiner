const { sql, getPool } = require('./backend/database/db');
async function run() {
  const pool = await getPool();
  
  const subBsr = await pool.request().query("SELECT TOP 5 AsinId, Date, CreatedAt FROM SubBsrHistory ORDER BY CreatedAt DESC");
  console.log("Recent SubBsrHistory:");
  console.table(subBsr.recordset);
  
  process.exit(0);
}
run().catch(console.error);
