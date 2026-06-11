const { getPool } = require('../backend/database/db');

async function check() {
  try {
    const pool = await getPool();
    const countResult = await pool.request().query('SELECT COUNT(*) as count FROM SystemLogs');
    const typesResult = await pool.request().query('SELECT DISTINCT Type FROM SystemLogs');
    console.log('Total logs:', countResult.recordset[0].count);
    console.log('Log types in DB:', typesResult.recordset);
    
    const sampleLogs = await pool.request().query('SELECT TOP 50 Type, EntityType, EntityTitle, Description, CreatedAt FROM SystemLogs ORDER BY CreatedAt DESC');
    console.log('Sample logs:', sampleLogs.recordset);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

check();
