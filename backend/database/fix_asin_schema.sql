-- Add missing columns to Asins and AsinHistory tables
-- Target: Microsoft SQL Server

-- ============================================
-- 1. Fix Asins Table
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Sku')
    ALTER TABLE Asins ADD Sku NVARCHAR(100);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SubBsr')
    ALTER TABLE Asins ADD SubBsr INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SubBSRs')
    ALTER TABLE Asins ADD SubBSRs NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Images')
    ALTER TABLE Asins ADD Images NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ImagesCount')
    ALTER TABLE Asins ADD ImagesCount INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'VideoCount')
    ALTER TABLE Asins ADD VideoCount INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BulletPoints')
    ALTER TABLE Asins ADD BulletPoints NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BulletPointsText')
    ALTER TABLE Asins ADD BulletPointsText NVARCHAR(MAX);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'StockLevel')
    ALTER TABLE Asins ADD StockLevel INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SoldBy')
    ALTER TABLE Asins ADD SoldBy NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BuyBoxWin')
    ALTER TABLE Asins ADD BuyBoxWin BIT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'BuyBoxSellerId')
    ALTER TABLE Asins ADD BuyBoxSellerId NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SecondAsp')
    ALTER TABLE Asins ADD SecondAsp DECIMAL(18, 2);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'SoldBySec')
    ALTER TABLE Asins ADD SoldBySec NVARCHAR(255);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AspDifference')
    ALTER TABLE Asins ADD AspDifference DECIMAL(18, 2);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'HasAplus')
    ALTER TABLE Asins ADD HasAplus BIT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AvailabilityStatus')
    ALTER TABLE Asins ADD AvailabilityStatus NVARCHAR(100);

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AplusAbsentSince')
    ALTER TABLE Asins ADD AplusAbsentSince DATETIME2;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AplusPresentSince')
    ALTER TABLE Asins ADD AplusPresentSince DATETIME2;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'AllOffers')
    ALTER TABLE Asins ADD AllOffers NVARCHAR(MAX);

-- ============================================
-- 2. Fix AsinHistory Table
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AsinHistory') AND name = 'StockLevel')
    ALTER TABLE AsinHistory ADD StockLevel INT;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('AsinHistory') AND name = 'LQS')
    ALTER TABLE AsinHistory ADD LQS DECIMAL(5, 2);

GO
PRINT '✅ Asins and AsinHistory schema updated';
