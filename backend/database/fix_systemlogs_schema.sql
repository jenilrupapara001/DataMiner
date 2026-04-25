-- Simplified Fix SystemLogs Schema

IF OBJECT_ID(N'dbo.SystemLogs', N'U') IS NOT NULL AND EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.SystemLogs') AND name = 'Id' AND system_type_id = 127) 
    DROP TABLE dbo.SystemLogs;

IF OBJECT_ID(N'dbo.SystemLogs', N'U') IS NULL 
    CREATE TABLE SystemLogs (
        Id VARCHAR(24) PRIMARY KEY,
        Type NVARCHAR(50),
        EntityType NVARCHAR(100),
        EntityId VARCHAR(24),
        EntityTitle NVARCHAR(255),
        UserId VARCHAR(24),
        Description NVARCHAR(MAX),
        Metadata NVARCHAR(MAX),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_SystemLogs_User FOREIGN KEY (UserId) REFERENCES Users(Id)
    );

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SystemLogs_CreatedAt' AND object_id = OBJECT_ID('SystemLogs'))
    CREATE INDEX IX_SystemLogs_CreatedAt ON SystemLogs(CreatedAt DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SystemLogs_UserId' AND object_id = OBJECT_ID('SystemLogs'))
    CREATE INDEX IX_SystemLogs_UserId ON SystemLogs(UserId);
