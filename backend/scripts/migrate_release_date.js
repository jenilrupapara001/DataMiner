const { sql, getPool } = require('../database/db');

async function migrate() {
    try {
        const pool = await getPool();
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Asins' AND COLUMN_NAME = 'ReleaseDate')
            BEGIN
                ALTER TABLE Asins ADD ReleaseDate DATETIME2 NULL;
                CREATE INDEX IX_Asins_ReleaseDate ON Asins(ReleaseDate);
                print 'Migration successful';
            END
            ELSE BEGIN
                print 'Already migrated';
            END
        `);
        console.log("Migration script complete");
    } catch (e) {
        console.error("Migration error", e);
    }
    process.exit(0);
}
migrate();
