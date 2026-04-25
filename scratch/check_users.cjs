const { getPool } = require('../backend/database/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

async function check() {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT TOP 5 * FROM Users');
        console.log('Users:', JSON.stringify(result.recordset, null, 2));
        
        const supResult = await pool.request().query('SELECT TOP 5 * FROM UserSupervisors');
        console.log('UserSupervisors:', JSON.stringify(supResult.recordset, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
