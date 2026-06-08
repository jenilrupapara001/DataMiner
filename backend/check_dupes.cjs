const { getPool } = require('./database/db');

async function run() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT AsinCode, COUNT(*) as Count 
        FROM Asins 
        WHERE SellerId = '69e8612f1e4de9e2dc81f78d'
        GROUP BY AsinCode 
        HAVING COUNT(*) > 1
    `);
    console.table(result.recordset);
    
    const totalCount = await pool.request().query(`
        SELECT COUNT(*) as Count FROM Asins WHERE SellerId = '69e8612f1e4de9e2dc81f78d'
    `);
    console.log("Total ASINs for 101-BHARVITA:", totalCount.recordset[0].Count);
    process.exit(0);
}
run();
