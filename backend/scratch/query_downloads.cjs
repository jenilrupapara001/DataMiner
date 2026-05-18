const { getPool } = require('../database/db');

async function main() {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT TOP 10 * 
                FROM Downloads 
                ORDER BY CreatedAt DESC
            `);
        console.log('--- LATEST DOWNLOADS ---');
        result.recordset.forEach((dl, idx) => {
            console.log(`\n[${idx + 1}] Id: ${dl.Id}`);
            console.log(`UserId: ${dl.UserId}`);
            console.log(`FileName: ${dl.FileName}`);
            console.log(`FilePath: ${dl.FilePath}`);
            console.log(`Status: ${dl.Status} | RowCount: ${dl.RowCount}`);
            console.log(`ExpiresAt: ${dl.ExpiresAt}`);
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

main();
