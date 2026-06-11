-- Add missing columns to Rulesets table
-- Target: Microsoft SQL Server

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'Type')
    ALTER TABLE Rulesets ADD Type VARCHAR(50) DEFAULT 'ASIN';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'SellerId')
    ALTER TABLE Rulesets ADD SellerId VARCHAR(24);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'UsingDataFrom')
    ALTER TABLE Rulesets ADD UsingDataFrom VARCHAR(100) DEFAULT 'Last 14 days';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'ExcludeDays')
    ALTER TABLE Rulesets ADD ExcludeDays VARCHAR(100) DEFAULT 'Latest day';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'IsAutomated')
    ALTER TABLE Rulesets ADD IsAutomated BIT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'RunFrequency')
    ALTER TABLE Rulesets ADD RunFrequency VARCHAR(50) DEFAULT 'Daily';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'RunTime')
    ALTER TABLE Rulesets ADD RunTime VARCHAR(50) DEFAULT '08 AM';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'Scope')
    ALTER TABLE Rulesets ADD Scope NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'ConflictResolution')
    ALTER TABLE Rulesets ADD ConflictResolution VARCHAR(50) DEFAULT 'first';

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'EmailOnRun')
    ALTER TABLE Rulesets ADD EmailOnRun BIT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'EmailOnAction')
    ALTER TABLE Rulesets ADD EmailOnAction BIT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'EmailAddress')
    ALTER TABLE Rulesets ADD EmailAddress NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'LastRunAt')
    ALTER TABLE Rulesets ADD LastRunAt DATETIME2;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'TotalRunCount')
    ALTER TABLE Rulesets ADD TotalRunCount INT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Rulesets') AND name = 'LastRunSummary')
    ALTER TABLE Rulesets ADD LastRunSummary NVARCHAR(MAX);

GO
PRINT '✅ Rulesets schema updated';
