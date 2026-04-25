const { getPool } = require('./database/db');

async function checkCometChatColumns() {
    try {
        const pool = await getPool();
        const tables = ['Users', 'Sellers'];
        for (const table of tables) {
            console.log(`--- ${table} ---`);
            const result = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}'`);
            console.log(result.recordset.map(r => r.COLUMN_NAME));
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCometChatColumns();
