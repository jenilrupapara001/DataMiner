const { getPool } = require('./backend/database/db.js');

async function check() {
    try {
        const pool = await getPool();
        const res = await pool.request().query(`
            SELECT AsinId, Date, COUNT(*) as cnt
            FROM AsinHistory
            WHERE Date = '2026-06-08'
            GROUP BY AsinId, Date
            HAVING COUNT(*) > 1
        `);
        console.log(`Found ${res.recordset.length} ASINs with duplicate 2026-06-08 history entries!`);
        
        const jsonRes = await pool.request().query(`
            SELECT COUNT(*) as cnt
            FROM Asins
            WHERE CAST(History AS VARCHAR(MAX)) LIKE '%"date":"2026-06-08"%"date":"2026-06-08"%'
        `);
        console.log(`Found ${jsonRes.recordset[0].cnt} ASINs with duplicate 2026-06-08 JSON array entries!`);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
check();
