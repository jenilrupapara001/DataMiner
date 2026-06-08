const { sql, getPool } = require('./backend/database/db');

async function run() {
  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    console.log("Starting data repair job...");

    // 1. Fix SubBsrHistory
    const subBsrResult = await transaction.request()
      .query(`
        UPDATE SubBsrHistory 
        SET Date = '2026-06-08'
        WHERE Date = '2026-06-07' AND CreatedAt > '2026-06-08 00:00:00'
      `);
    console.log(`✅ Fixed ${subBsrResult.rowsAffected[0]} rows in SubBsrHistory.`);

    // 2. Fix Asins History JSON
    const asinsResult = await transaction.request()
      .query(`SELECT Id, AsinCode, History FROM Asins WHERE UpdatedAt > '2026-06-08 00:00:00'`);
    
    let fixedAsins = 0;
    for (const row of asinsResult.recordset) {
      if (row.History) {
        try {
          let history = JSON.parse(row.History);
          let modified = false;
          
          if (Array.isArray(history)) {
            for (let i = 0; i < history.length; i++) {
              if (history[i].date === '2026-06-07') {
                history[i].date = '2026-06-08';
                modified = true;
              }
            }
          }

          if (modified) {
            await transaction.request()
              .input('id', sql.VarChar, row.Id)
              .input('history', sql.NVarChar(sql.MAX), JSON.stringify(history))
              .query(`UPDATE Asins SET History = @history WHERE Id = @id`);
            fixedAsins++;
          }
        } catch (e) {
          // ignore parse error
        }
      }
    }
    console.log(`✅ Fixed History JSON for ${fixedAsins} ASINs.`);

    await transaction.commit();
    console.log("Repair job completed successfully.");
  } catch (err) {
    console.error("Error during repair:", err);
  } finally {
    process.exit(0);
  }
}

run();
