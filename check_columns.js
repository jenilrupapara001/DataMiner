const { getPool, sql } = require('./backend/database/db');

async function checkTableColumns(tableName) {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = '${tableName}'
                ORDER BY ORDINAL_POSITION
            `);

        console.log(`Columns in ${tableName}:`);
        result.recordset.forEach(col => {
            console.log(`  ${col.COLUMN_NAME}: ${col.DATA_TYPE}${col.CHARACTER_MAXIMUM_LENGTH !== null ? `(${col.CHARACTER_MAXIMUM_LENGTH})` : ''}${col.IS_NULLABLE === 'YES' ? ' NULL' : ' NOT NULL'}`);
        });
    } catch (error) {
        console.error(`Error checking ${tableName}:`, error.message);
    }
}

checkTableColumns('Asins');
checkTableColumns('AsinHistory');
checkTableColumns('Sellers');