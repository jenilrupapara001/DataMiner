const { sql, getPool } = require('../database/db');

async function main() {
    const pool = await getPool();
    console.log('Adding missing columns to Tasks table...');
    
    // Add DueDate
    try {
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'DueDate'
            )
            BEGIN
                ALTER TABLE Tasks ADD DueDate DATETIME2 NULL;
                PRINT 'DueDate column added to Tasks table.';
            END
        `);
    } catch (err) {
        console.error('Failed to add DueDate:', err);
    }
    
    // Add SourceRule
    try {
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'Tasks' AND COLUMN_NAME = 'SourceRule'
            )
            BEGIN
                ALTER TABLE Tasks ADD SourceRule NVARCHAR(255) NULL;
                PRINT 'SourceRule column added to Tasks table.';
            END
        `);
    } catch (err) {
        console.error('Failed to add SourceRule:', err);
    }

    console.log('Columns check complete.');
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
