const pool = require('./db');

async function runSql() {
    try {
        console.log('Executing migration to add Ads column to Asins...');
        
        // Check if column exists first
        const check = await pool.query(`
            IF NOT EXISTS (
                SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = 'Asins' AND COLUMN_NAME = 'Ads'
            )
            BEGIN
                ALTER TABLE Asins ADD Ads BIT DEFAULT 0;
                PRINT 'Column Ads added to Asins.';
            END
            ELSE
            BEGIN
                PRINT 'Column Ads already exists.';
            END
        `);
        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        process.exit();
    }
}

runSql();
