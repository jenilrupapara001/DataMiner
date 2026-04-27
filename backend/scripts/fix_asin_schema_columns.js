const { getPool, sql } = require('../database/db');

async function fixSchema() {
    try {
        const pool = await getPool();
        console.log('--- Checking ASIN Schema for missing columns ---');
        
        // Add DiscountPercentage if missing
        try {
            await pool.request().query('ALTER TABLE Asins ADD DiscountPercentage INT DEFAULT 0');
            console.log('✅ Added DiscountPercentage column to Asins table');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('ℹ️ DiscountPercentage column already exists');
            } else {
                console.error('❌ Error adding DiscountPercentage:', e.message);
            }
        }

        // Add any other missing columns from fix_asin_schema.sql just in case
        const columns = [
            { name: 'SubBsr', type: 'INT' },
            { name: 'SubBSRs', type: 'NVARCHAR(MAX)' },
            { name: 'Images', type: 'NVARCHAR(MAX)' },
            { name: 'ImagesCount', type: 'INT' },
            { name: 'VideoCount', type: 'INT' },
            { name: 'BulletPoints', type: 'NVARCHAR(MAX)' },
            { name: 'BulletPointsText', type: 'NVARCHAR(MAX)' },
            { name: 'StockLevel', type: 'INT' },
            { name: 'SoldBy', type: 'NVARCHAR(255)' },
            { name: 'BuyBoxWin', type: 'BIT DEFAULT 0' },
            { name: 'BuyBoxSellerId', type: 'NVARCHAR(255)' },
            { name: 'SecondAsp', type: 'DECIMAL(18, 2)' },
            { name: 'SoldBySec', type: 'NVARCHAR(255)' },
            { name: 'AspDifference', type: 'DECIMAL(18, 2)' },
            { name: 'HasAplus', type: 'BIT DEFAULT 0' },
            { name: 'AvailabilityStatus', type: 'NVARCHAR(100)' }
        ];

        for (const col of columns) {
            try {
                await pool.request().query(`ALTER TABLE Asins ADD ${col.name} ${col.type}`);
                console.log(`✅ Added ${col.name} column`);
            } catch (e) {
                // Ignore if already exists
            }
        }

        console.log('--- Schema check completed ---');
        process.exit(0);
    } catch (error) {
        console.error('❌ Schema Fix Error:', error.message);
        process.exit(1);
    }
}

fixSchema();
