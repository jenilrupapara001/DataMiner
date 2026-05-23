const { sql, getPool } = require('./backend/database/db.js');
async function run() {
  const pool = await getPool();
  try {
    await pool.request().query("ALTER TABLE Sellers ADD IsPriority BIT DEFAULT 0");
    console.log("Column IsPriority added successfully.");
  } catch (err) {
    if (err.message.includes("already exists") || err.message.includes("already has")) {
      console.log("Column already exists.");
    } else {
      console.error(err);
    }
  }
  process.exit(0);
}
run();
