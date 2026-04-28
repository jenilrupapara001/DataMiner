const { getPool } = require('../database/db');
async function run() {
    try {
        const pool = await getPool();
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Downloads')
            BEGIN
                CREATE TABLE Downloads (
                    Id VARCHAR(24) PRIMARY KEY,
                    UserId VARCHAR(24) NOT NULL,
                    FileName NVARCHAR(255) NOT NULL,
                    FilePath NVARCHAR(500) NULL,
                    FileSize BIGINT NULL,
                    Format NVARCHAR(10) DEFAULT 'csv',
                    Status NVARCHAR(20) DEFAULT 'processing',
                    Params NVARCHAR(MAX) NULL,
                    Progress INT DEFAULT 0,
                    [RowCount] INT NULL,
                    ErrorMessage NVARCHAR(MAX) NULL,
                    CreatedAt DATETIME2 DEFAULT GETDATE(),
                    CompletedAt DATETIME2 NULL,
                    ExpiresAt DATETIME2 NULL,
                    DownloadedAt DATETIME2 NULL,
                    DownloadCount INT DEFAULT 0
                );
                
                CREATE INDEX IX_Downloads_UserId ON Downloads(UserId);
                CREATE INDEX IX_Downloads_Status ON Downloads(Status);
            END
        `);
        console.log('Downloads table created successfully.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
