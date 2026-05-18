const { getPool } = require('../database/db');

async function main() {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT TOP 10 * 
                FROM SystemLogs 
                ORDER BY CreatedAt DESC
            `);
        console.log('--- LATEST SYSTEM LOGS ---');
        result.recordset.forEach((log, idx) => {
            console.log(`\n[${idx + 1}] Time: ${log.CreatedAt}`);
            console.log(`Type: ${log.Type} | EntityType: ${log.EntityType}`);
            console.log(`Description: ${log.Description}`);
            console.log(`Metadata:`, log.Metadata);
        });
    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}

main();
