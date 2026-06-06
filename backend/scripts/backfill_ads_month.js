const { getPool } = require('../database/db');

async function backfill() {
    try {
        const pool = await getPool();
        console.log("Connected successfully to database!");

        console.log("Backfilling NULL Month columns in AdsPerformance based on Date column...");
        const result = await pool.request().query(`
            UPDATE AdsPerformance 
            SET Month = DATEFROMPARTS(YEAR(Date), MONTH(Date), 1)
            WHERE Month IS NULL AND Date IS NOT NULL;
        `);
        console.log(`Successfully updated ${result.rowsAffected[0]} rows in AdsPerformance.`);

        process.exit(0);
    } catch (err) {
        console.error("Error running backfill:", err);
        process.exit(1);
    }
}

backfill();
