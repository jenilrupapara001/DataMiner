const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT COUNT(*) as RogueCount 
        FROM Asins 
        WHERE CreatedAt > '2026-06-01'
        AND Title IS NULL 
        AND ImageUrl IS NULL 
        AND CurrentPrice IS NULL
    `);
    console.log("Global rogue ASIN count:", result.recordset[0].RogueCount);
    process.exit(0);
}
run();
