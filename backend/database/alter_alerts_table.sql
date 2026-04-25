-- Enhance Alerts table with additional fields from Alert model
IF COL_LENGTH('Alerts', 'RuleId') IS NULL
BEGIN
    ALTER TABLE Alerts ADD RuleId VARCHAR(24) NULL;
    CREATE INDEX IX_Alerts_RuleId ON Alerts(RuleId);
    PRINT '✅ Added RuleId column to Alerts';
END
GO

IF COL_LENGTH('Alerts', 'AsinId') IS NULL
BEGIN
    ALTER TABLE Alerts ADD AsinId VARCHAR(24) NULL;
    CREATE INDEX IX_Alerts_AsinId ON Alerts(AsinId);
    PRINT '✅ Added AsinId column to Alerts';
END
GO

IF COL_LENGTH('Alerts', 'Acknowledged') IS NULL
BEGIN
    ALTER TABLE Alerts ADD Acknowledged BIT DEFAULT 0;
    CREATE INDEX IX_Alerts_Acknowledged ON Alerts(Acknowledged);
    PRINT '✅ Added Acknowledged column to Alerts';
END
GO

IF COL_LENGTH('Alerts', 'AcknowledgedBy') IS NULL
BEGIN
    ALTER TABLE Alerts ADD AcknowledgedBy NVARCHAR(255) NULL;
    PRINT '✅ Added AcknowledgedBy column to Alerts';
END
GO

IF COL_LENGTH('Alerts', 'AcknowledgedAt') IS NULL
BEGIN
    ALTER TABLE Alerts ADD AcknowledgedAt DATETIME2 NULL;
    PRINT '✅ Added AcknowledgedAt column to Alerts';
END
GO

PRINT '✅ Alerts table enhanced successfully';
GO
