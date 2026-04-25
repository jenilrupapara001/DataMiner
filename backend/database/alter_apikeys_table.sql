-- Enhance ApiKeys table to match model schema
IF COL_LENGTH('ApiKeys', 'ServiceId') IS NULL
BEGIN
    ALTER TABLE ApiKeys ADD ServiceId NVARCHAR(100) NOT NULL DEFAULT '';
    CREATE UNIQUE INDEX IX_ApiKeys_ServiceId ON ApiKeys(ServiceId);
    PRINT '✅ Added ServiceId column to ApiKeys';
END
GO

IF COL_LENGTH('ApiKeys', 'Category') IS NULL
BEGIN
    ALTER TABLE ApiKeys ADD Category NVARCHAR(50) DEFAULT 'Other';
    CHECK (Category IN ('Scraping', 'Amazon Data', 'AI', 'Communication', 'Other'));
    PRINT '✅ Added Category column to ApiKeys';
END
GO

IF COL_LENGTH('ApiKeys', 'Description') IS NULL
BEGIN
    ALTER TABLE ApiKeys ADD Description NVARCHAR(MAX) NULL;
    PRINT '✅ Added Description column to ApiKeys';
END
GO

-- Rename 'Key' column to 'Value' to avoid reserved word confusion, or add Value column
IF COL_LENGTH('ApiKeys', 'Value') IS NULL
BEGIN
    ALTER TABLE ApiKeys ADD Value NVARCHAR(MAX) NULL;
    PRINT '✅ Added Value column to ApiKeys';
END
GO

-- Copy data from Key to Value if needed
UPDATE ApiKeys SET Value = [Key] WHERE Value IS NULL;
PRINT '✅ Migrated Key data to Value column';

-- Optionally drop Key column later after verification
-- ALTER TABLE ApiKeys DROP COLUMN [Key];

PRINT '✅ ApiKeys table enhanced successfully';
GO
