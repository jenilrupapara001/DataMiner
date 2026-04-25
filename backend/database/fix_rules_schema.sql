-- Add missing columns to Alerts, AlertRules, and Actions
-- Target: Microsoft SQL Server

-- ============================================
-- 1. Fix Alerts Table
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Alerts') AND name = 'Acknowledged')
    ALTER TABLE Alerts ADD Acknowledged BIT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Alerts') AND name = 'AcknowledgedAt')
    ALTER TABLE Alerts ADD AcknowledgedAt DATETIME2;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Alerts') AND name = 'AcknowledgedBy')
    ALTER TABLE Alerts ADD AcknowledgedBy NVARCHAR(100);

-- ============================================
-- 2. Fix AlertRules Table
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertRules') AND name = 'SellerId')
    ALTER TABLE AlertRules ADD SellerId VARCHAR(24);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertRules') AND name = 'Execution')
    ALTER TABLE AlertRules ADD Execution NVARCHAR(MAX); -- JSON: { lastRun, lastStatus, lastTriggered, triggerCount }

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AlertRules') AND name = 'Actions')
    ALTER TABLE AlertRules ADD Actions NVARCHAR(MAX); -- JSON: { createTask, notifyUser }

-- ============================================
-- 3. Fix Actions Table
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Actions') AND name = 'Source')
    ALTER TABLE Actions ADD Source NVARCHAR(100);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Actions') AND name = 'SourceId')
    ALTER TABLE Actions ADD SourceId VARCHAR(24);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Actions') AND name = 'AsinId')
    ALTER TABLE Actions ADD AsinId VARCHAR(24);

GO
PRINT '✅ Alerts, AlertRules and Actions schema updated';
