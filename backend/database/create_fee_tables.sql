-- Create missing tables for Fees and Alerts
-- Target: Microsoft SQL Server

-- ============================================
-- ReferralFees table
-- ============================================
IF OBJECT_ID(N'dbo.ReferralFees', N'U') IS NULL
BEGIN
    CREATE TABLE ReferralFees (
        Id VARCHAR(24) PRIMARY KEY,
        Category NVARCHAR(255) NOT NULL,
        Tiers NVARCHAR(MAX), -- JSON array of { minPrice, maxPrice, percentage }
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT '✅ Created ReferralFees table';
END

-- ============================================
-- ClosingFees table
-- ============================================
IF OBJECT_ID(N'dbo.ClosingFees', N'U') IS NULL
BEGIN
    CREATE TABLE ClosingFees (
        Id VARCHAR(24) PRIMARY KEY,
        Category NVARCHAR(255),
        SellerType NVARCHAR(10) DEFAULT 'FC', -- 'FC', 'MN'
        MinPrice DECIMAL(18, 2),
        MaxPrice DECIMAL(18, 2),
        Fee DECIMAL(18, 2),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT '✅ Created ClosingFees table';
END

-- ============================================
-- ShippingFees table
-- ============================================
IF OBJECT_ID(N'dbo.ShippingFees', N'U') IS NULL
BEGIN
    CREATE TABLE ShippingFees (
        Id VARCHAR(24) PRIMARY KEY,
        SizeType NVARCHAR(50), -- 'Standard', 'Heavy', etc.
        WeightMin DECIMAL(18, 3),
        WeightMax DECIMAL(18, 3),
        Fee DECIMAL(18, 2),
        PickAndPackFee DECIMAL(18, 2),
        UseIncremental BIT DEFAULT 0,
        IncrementalStep DECIMAL(18, 3),
        IncrementalFee DECIMAL(18, 2),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT '✅ Created ShippingFees table';
END

-- ============================================
-- StorageFees table
-- ============================================
IF OBJECT_ID(N'dbo.StorageFees', N'U') IS NULL
BEGIN
    CREATE TABLE StorageFees (
        Id VARCHAR(24) PRIMARY KEY,
        Month NVARCHAR(20), -- 'Jan-Sep', 'Oct-Dec'
        Rate DECIMAL(18, 2),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT '✅ Created StorageFees table';
END

-- ============================================
-- CategoryMaps table
-- ============================================
IF OBJECT_ID(N'dbo.CategoryMaps', N'U') IS NULL
BEGIN
    CREATE TABLE CategoryMaps (
        Id VARCHAR(24) PRIMARY KEY,
        KeepaCategory NVARCHAR(255) NOT NULL,
        FeeCategory NVARCHAR(255) NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT '✅ Created CategoryMaps table';
END

-- ============================================
-- RefundFees table
-- ============================================
IF OBJECT_ID(N'dbo.RefundFees', N'U') IS NULL
BEGIN
    CREATE TABLE RefundFees (
        Id VARCHAR(24) PRIMARY KEY,
        Category NVARCHAR(255),
        MinPrice DECIMAL(18, 2),
        MaxPrice DECIMAL(18, 2),
        Basic DECIMAL(18, 2),
        Standard DECIMAL(18, 2),
        Advanced DECIMAL(18, 2),
        Premium DECIMAL(18, 2),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT '✅ Created RefundFees table';
END

-- ============================================
-- Ensure NodeMaps exists if needed (referenced in fee engine)
-- ============================================
IF OBJECT_ID(N'dbo.NodeMaps', N'U') IS NULL
BEGIN
    CREATE TABLE NodeMaps (
        Id VARCHAR(24) PRIMARY KEY,
        NodeId NVARCHAR(100) NOT NULL,
        Category NVARCHAR(255),
        CreatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT '✅ Created NodeMaps table';
END
GO
