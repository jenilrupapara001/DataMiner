const { sql, getPool } = require('../database/db');

async function migrate() {
    try {
        const pool = await getPool();
        console.log('Connected to database. Running migration...');

        await pool.request().query(`
            -- Create TagsHistory table for audit trail
            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TagsHistory')
            BEGIN
                CREATE TABLE TagsHistory (
                    Id VARCHAR(24) PRIMARY KEY,
                    AsinId VARCHAR(24) NOT NULL,
                    UserId VARCHAR(24) NULL,
                    UserName NVARCHAR(255) NULL,
                    PreviousTags NVARCHAR(MAX) NULL, -- JSON array of previous tags
                    NewTags NVARCHAR(MAX) NULL,      -- JSON array of new tags
                    AddedTags NVARCHAR(MAX) NULL,    -- JSON array of newly added tags
                    RemovedTags NVARCHAR(MAX) NULL,  -- JSON array of removed tags
                    Action NVARCHAR(20) DEFAULT 'update', -- update, add, remove, bulk_upload, auto_tag
                    Source NVARCHAR(50) NULL,        -- 'manual', 'bulk_upload', 'auto_age', 'system'
                    Notes NVARCHAR(500) NULL,
                    CreatedAt DATETIME2 DEFAULT GETDATE(),
                    CONSTRAINT FK_TagsHistory_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id)
                );
                
                CREATE INDEX IX_TagsHistory_AsinId ON TagsHistory(AsinId, CreatedAt DESC);
                CREATE INDEX IX_TagsHistory_UserId ON TagsHistory(UserId);
                CREATE INDEX IX_TagsHistory_CreatedAt ON TagsHistory(CreatedAt DESC);
                
                PRINT 'TagsHistory table created successfully';
            END
            ELSE
            BEGIN
                PRINT 'TagsHistory table already exists';
            END
        `);

        console.log('Migration completed successfully');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
