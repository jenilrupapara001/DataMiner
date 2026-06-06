const { getPool } = require('../backend/database/db');

async function checkPredefinedTags() {
    try {
        const pool = await getPool();
        console.log('Querying PredefinedTags count...');
        const countRes = await pool.request().query('SELECT COUNT(*) as total FROM PredefinedTags');
        console.log('Total predefined tags in DB:', countRes.recordset[0].total);
        
        console.log('Querying top 5 predefined tags...');
        const topRes = await pool.request().query('SELECT TOP 5 Id, Name, Category FROM PredefinedTags');
        console.log('Top 5 tags:', topRes.recordset);
        
        process.exit(0);
    } catch (err) {
        console.error('Query failed:', err);
        process.exit(1);
    }
}

checkPredefinedTags();
