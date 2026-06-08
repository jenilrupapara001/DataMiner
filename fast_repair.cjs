const { sql, getPool } = require('./backend/database/db');

async function run() {
  try {
    const pool = await getPool();
    console.log("Running fast SQL JSON replacement...");
    
    const result = await pool.request().query(`
      UPDATE Asins 
      SET History = REPLACE(CAST(History AS VARCHAR(MAX)), '"date":"2026-06-07"', '"date":"2026-06-08"')
      WHERE UpdatedAt > '2026-06-08 00:00:00'
        AND CAST(History AS VARCHAR(MAX)) LIKE '%"date":"2026-06-07"%'
    `);
    
    console.log(`✅ Fast Repair completed. Fixed History array for ${result.rowsAffected[0]} ASINs.`);
  } catch (err) {
    console.error("Error during fast repair:", err);
  } finally {
    process.exit(0);
  }
}

run();
