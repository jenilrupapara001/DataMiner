const { getPool } = require('../database/db');

async function addIndexes() {
    try {
        const pool = await getPool();
        console.log('✅ Connected to SQL Server. Adding indexes...');

        await pool.request().query(`
            -- Index for SellerId (filtering)
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Asins_SellerId' AND object_id = OBJECT_ID('Asins'))
            CREATE INDEX IX_Asins_SellerId ON Asins(SellerId);

            -- Index for ParentAsin (grouping)
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Asins_ParentAsin' AND object_id = OBJECT_ID('Asins'))
            CREATE INDEX IX_Asins_ParentAsin ON Asins(ParentAsin);

            -- Index for Status (filtering)
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Asins_Status' AND object_id = OBJECT_ID('Asins'))
            CREATE INDEX IX_Asins_Status ON Asins(Status);

            -- Index for AsinCode (fast lookup)
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Asins_AsinCode' AND object_id = OBJECT_ID('Asins'))
            CREATE INDEX IX_Asins_AsinCode ON Asins(AsinCode);

            -- Index for Ratings and LQS (performance sorting/filtering)
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Asins_Rating' AND object_id = OBJECT_ID('Asins'))
            CREATE INDEX IX_Asins_Rating ON Asins(Rating) INCLUDE (Id, AsinCode, ParentAsin);

            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Asins_LQS' AND object_id = OBJECT_ID('Asins'))
            CREATE INDEX IX_Asins_LQS ON Asins(LQS) INCLUDE (Id, AsinCode, ParentAsin);
        `);

        console.log('✅ Indexes added successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to add indexes:', err.message);
        process.exit(1);
    }
}

addIndexes();
