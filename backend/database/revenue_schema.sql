-- Revenue Calculator Tables
IF OBJECT_ID(N'dbo.ReferralFees', N'U') IS NULL
CREATE TABLE ReferralFees (
    Id VARCHAR(24) PRIMARY KEY,
    Category NVARCHAR(255) NOT NULL,
    Tiers NVARCHAR(MAX) -- JSON array of { minPrice, maxPrice, percentage }
);

IF OBJECT_ID(N'dbo.ClosingFees', N'U') IS NULL
CREATE TABLE ClosingFees (
    Id VARCHAR(24) PRIMARY KEY,
    Category NVARCHAR(255),
    SellerType NVARCHAR(50), -- e.g., 'FC'
    MinPrice DECIMAL(18, 2),
    MaxPrice DECIMAL(18, 2),
    Fee DECIMAL(18, 2)
);

IF OBJECT_ID(N'dbo.ShippingFees', N'U') IS NULL
CREATE TABLE ShippingFees (
    Id VARCHAR(24) PRIMARY KEY,
    SizeType NVARCHAR(100),
    WeightMin DECIMAL(18, 3),
    WeightMax DECIMAL(18, 3),
    Fee DECIMAL(18, 2),
    PickAndPackFee DECIMAL(18, 2)
);

IF OBJECT_ID(N'dbo.StorageFees', N'U') IS NULL
CREATE TABLE StorageFees (
    Id VARCHAR(24) PRIMARY KEY,
    MonthRange NVARCHAR(100), -- e.g., 'Jan-Sep'
    SizeType NVARCHAR(100),
    FeePerCubicFoot DECIMAL(18, 2)
);

IF OBJECT_ID(N'dbo.RefundFees', N'U') IS NULL
CREATE TABLE RefundFees (
    Id VARCHAR(24) PRIMARY KEY,
    Category NVARCHAR(255),
    FeePercentage DECIMAL(5, 2)
);

IF OBJECT_ID(N'dbo.CategoryMaps', N'U') IS NULL
CREATE TABLE CategoryMaps (
    Id VARCHAR(24) PRIMARY KEY,
    AmazonCategory NVARCHAR(255),
    InternalCategory NVARCHAR(255)
);

IF OBJECT_ID(N'dbo.NodeMaps', N'U') IS NULL
CREATE TABLE NodeMaps (
    Id VARCHAR(24) PRIMARY KEY,
    NodeId NVARCHAR(100),
    AmazonCategory NVARCHAR(255)
);

IF OBJECT_ID(N'dbo.CalculatorAsins', N'U') IS NULL
CREATE TABLE CalculatorAsins (
    Id VARCHAR(24) PRIMARY KEY,
    AsinCode VARCHAR(50) NOT NULL,
    Title NVARCHAR(MAX),
    Category NVARCHAR(255),
    Price DECIMAL(18, 2),
    Weight DECIMAL(18, 3),
    StapleLevel NVARCHAR(50), -- 'Standard', 'Premium', etc.
    Status NVARCHAR(50) DEFAULT 'pending',
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);
