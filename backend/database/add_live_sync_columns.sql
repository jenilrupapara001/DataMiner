-- ============================================
-- Add Live Sync columns to Sellers table
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Sellers]') AND name = 'LiveSyncClientId')
BEGIN
    ALTER TABLE Sellers ADD LiveSyncClientId NVARCHAR(255) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Sellers]') AND name = 'LiveSyncClientSecret')
BEGIN
    ALTER TABLE Sellers ADD LiveSyncClientSecret NVARCHAR(500) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Sellers]') AND name = 'PartnerTag')
BEGIN
    ALTER TABLE Sellers ADD PartnerTag NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Sellers]') AND name = 'Marketplace')
BEGIN
    ALTER TABLE Sellers ADD Marketplace NVARCHAR(100) DEFAULT 'www.amazon.in';
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Sellers]') AND name = 'LiveSyncEnabled')
BEGIN
    ALTER TABLE Sellers ADD LiveSyncEnabled BIT DEFAULT 0;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Sellers]') AND name = 'LastLiveSyncAt')
BEGIN
    ALTER TABLE Sellers ADD LastLiveSyncAt DATETIME NULL;
END;

-- ============================================
-- Update Asins table with new fields
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'ParentAsin')
BEGIN
    ALTER TABLE Asins ADD ParentAsin NVARCHAR(20) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'SellerExternalId')
BEGIN
    ALTER TABLE Asins ADD SellerExternalId NVARCHAR(100) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'CategoryPath')
BEGIN
    ALTER TABLE Asins ADD CategoryPath NVARCHAR(500) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'BulletPoints')
BEGIN
    ALTER TABLE Asins ADD BulletPoints NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'VariantImages')
BEGIN
    ALTER TABLE Asins ADD VariantImages NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'Dimensions')
BEGIN
    ALTER TABLE Asins ADD Dimensions NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'BuyBoxes')
BEGIN
    ALTER TABLE Asins ADD BuyBoxes NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'HasDeal')
BEGIN
    ALTER TABLE Asins ADD HasDeal BIT DEFAULT 0;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'DealType')
BEGIN
    ALTER TABLE Asins ADD DealType NVARCHAR(50) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'DealEndTime')
BEGIN
    ALTER TABLE Asins ADD DealEndTime DATETIME NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'AplusContent')
BEGIN
    ALTER TABLE Asins ADD AplusContent NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'AplusModuleCount')
BEGIN
    ALTER TABLE Asins ADD AplusModuleCount INT DEFAULT 0;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'RatingBreakdown')
BEGIN
    ALTER TABLE Asins ADD RatingBreakdown NVARCHAR(MAX) NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'LastLiveSyncAt')
BEGIN
    ALTER TABLE Asins ADD LastLiveSyncAt DATETIME NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'LastOctoparseSyncAt')
BEGIN
    ALTER TABLE Asins ADD LastOctoparseSyncAt DATETIME NULL;
END;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Asins]') AND name = 'LastSyncSource')
BEGIN
    ALTER TABLE Asins ADD LastSyncSource NVARCHAR(20) NULL;
END;

-- ============================================
-- Update AsinHistory to track source
-- ============================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[AsinHistory]') AND name = 'Source')
BEGIN
    ALTER TABLE AsinHistory ADD Source NVARCHAR(20) NULL;
END;
