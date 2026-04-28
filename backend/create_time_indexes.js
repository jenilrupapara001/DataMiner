const { getPool } = require('./database/db');
async function run() {
  try {
    const pool = await getPool();
    console.log("Creating Index IX_Asins_LastScrapedAt...");
    await pool.request().query("CREATE INDEX IX_Asins_LastScrapedAt ON Asins(LastScrapedAt DESC)");
    console.log("Creating Index IX_Asins_CreatedAt...");
    await pool.request().query("CREATE INDEX IX_Asins_CreatedAt ON Asins(CreatedAt DESC)");
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
