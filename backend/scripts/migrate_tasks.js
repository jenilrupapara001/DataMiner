const { sql, getPool } = require('../database/db');

async function migrate() {
    try {
        const pool = await getPool();
        console.log('Connected to database for Tasks migration...');

        // Create Tasks table
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Tasks')
            BEGIN
                CREATE TABLE Tasks (
                    Id VARCHAR(24) PRIMARY KEY,
                    Title NVARCHAR(500) NOT NULL,
                    Description NVARCHAR(MAX) NULL,
                    Category NVARCHAR(100) NULL,
                    Priority NVARCHAR(20) DEFAULT 'Medium',
                    Status NVARCHAR(20) DEFAULT 'To-Do',
                    Type NVARCHAR(50) DEFAULT 'optimization',
                    
                    AsinId VARCHAR(24) NULL,
                    AsinCode NVARCHAR(10) NULL,
                    SellerId VARCHAR(24) NULL,
                    SellerName NVARCHAR(255) NULL,
                    
                    AssignedTo VARCHAR(24) NULL,
                    CreatedBy VARCHAR(24) NULL,
                    
                    CreatedAt DATETIME2 DEFAULT GETDATE(),
                    StartTime DATETIME2 NULL,
                    CompletedAt DATETIME2 NULL,
                    DueDate DATETIME2 NULL,
                    
                    CompletionRemarks NVARCHAR(MAX) NULL,
                    CompletedBy VARCHAR(24) NULL,
                    
                    IsAIGenerated BIT DEFAULT 0,
                    AIReasoning NVARCHAR(MAX) NULL,
                    SourceRule NVARCHAR(255) NULL,
                    
                    ImpactScore INT DEFAULT 0,
                    EffortEstimate NVARCHAR(20) NULL,
                    Tags NVARCHAR(MAX) NULL,
                    
                    UpdatedAt DATETIME2 DEFAULT GETDATE(),
                    
                    CONSTRAINT FK_Tasks_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id),
                    CONSTRAINT FK_Tasks_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id)
                );
                PRINT 'Tasks table created successfully.';
            END

        // Create indexes
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_Status')
            CREATE INDEX IX_Tasks_Status ON Tasks(Status);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_AsinId')
            CREATE INDEX IX_Tasks_AsinId ON Tasks(AsinId);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_SellerId')
            CREATE INDEX IX_Tasks_SellerId ON Tasks(SellerId);
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_AssignedTo')
            CREATE INDEX IX_Tasks_AssignedTo ON Tasks(AssignedTo);

        // Backfill assignments for existing tasks based on UserSellers mapping
        console.log('Backfilling assignments for existing tasks...');
        await pool.request().query(`
            UPDATE t 
            SET t.AssignedTo = us.UserId 
            FROM Tasks t 
            JOIN UserSellers us ON t.SellerId = us.SellerId 
            WHERE t.AssignedTo IS NULL
        `);

        console.log('Migration and assignment backfill completed successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
