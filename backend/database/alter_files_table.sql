-- Enhance Files table for fileController compatibility
IF COL_LENGTH('Files', 'Starred') IS NULL
BEGIN
    ALTER TABLE Files ADD Starred BIT DEFAULT 0;
    CREATE INDEX IX_Files_Starred ON Files(Starred);
    PRINT '✅ Added Starred column to Files';
END
GO

IF COL_LENGTH('Files', 'Trashed') IS NULL
BEGIN
    ALTER TABLE Files ADD Trashed BIT DEFAULT 0;
    CREATE INDEX IX_Files_Trashed ON Files(Trashed);
    PRINT '✅ Added Trashed column to Files';
END
GO

IF COL_LENGTH('Files', 'TrashedAt') IS NULL
BEGIN
    ALTER TABLE Files ADD TrashedAt DATETIME2 NULL;
    PRINT '✅ Added TrashedAt column to Files';
END
GO

IF COL_LENGTH('Files', 'Folder') IS NULL
BEGIN
    ALTER TABLE Files ADD Folder NVARCHAR(255) NULL;
    CREATE INDEX IX_Files_Folder ON Files(Folder);
    PRINT '✅ Added Folder column to Files';
END
GO

-- Optionally add StorageProvider column for future use
IF COL_LENGTH('Files', 'StorageProvider') IS NULL
BEGIN
    ALTER TABLE Files ADD StorageProvider NVARCHAR(50) DEFAULT 'local';
    PRINT '✅ Added StorageProvider column to Files';
END
GO

PRINT '✅ Files table enhanced successfully';
GO
