const { getPool, sql } = require('../backend/database/db');

async function migrate() {
    try {
        const pool = await getPool();
        console.log('🚀 Starting migration: Adding Marketplace column to Asins table...');

        // 1. Add Marketplace column if it doesn't exist
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('Asins') AND name = 'Marketplace'
            )
            BEGIN
                ALTER TABLE Asins ADD Marketplace NVARCHAR(100);
                PRINT 'Added Marketplace column to Asins table';
            END
        `);

        // 2. Populate Marketplace from Sellers table for existing ASINs
        console.log('📊 Populating Marketplace for existing ASINs...');
        await pool.request().query(`
            UPDATE A
            SET A.Marketplace = S.Marketplace
            FROM Asins A
            JOIN Sellers S ON A.SellerId = S.Id
            WHERE A.Marketplace IS NULL OR A.Marketplace = ''
        `);

        console.log('✅ Migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
