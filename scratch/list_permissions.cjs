const { getPool } = require('./backend/database/db');
require('dotenv').config();

async function listPermissions() {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT Name FROM Permissions');
        console.log('Permissions found:', result.recordset.map(r => r.Name));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listPermissions();
