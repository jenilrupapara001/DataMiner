const { getPool } = require('./backend/database/db.js');

async function fixDates() {
    try {
        const pool = await getPool();
        console.log("Fixing AsinHistory and SubBsrHistory dates...");
        
        // Fix AsinHistory
        const histResult = await pool.request().query(`
            UPDATE ah
            SET ah.Date = '2026-06-08'
            FROM AsinHistory ah
            INNER JOIN Asins a ON ah.AsinId = a.Id
            WHERE ah.Date = '2026-06-07' AND a.UpdatedAt >= '2026-06-08 00:00:00'
        `);
        console.log(`✅ Fixed AsinHistory for ${histResult.rowsAffected[0]} rows.`);

        // Fix SubBsrHistory
        const subResult = await pool.request().query(`
            UPDATE sh
            SET sh.Date = '2026-06-08'
            FROM SubBsrHistory sh
            INNER JOIN Asins a ON sh.AsinId = a.Id
            WHERE sh.Date = '2026-06-07' AND a.UpdatedAt >= '2026-06-08 00:00:00'
        `);
        console.log(`✅ Fixed SubBsrHistory for ${subResult.rowsAffected[0]} rows.`);
        
        process.exit(0);
    } catch (err) {
        console.error("Error fixing database dates:", err);
        process.exit(1);
    }
}

fixDates();
