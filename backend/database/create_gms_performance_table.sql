-- Create GmsDailyPerformance table
IF OBJECT_ID(N'dbo.GmsDailyPerformance', N'U') IS NULL
CREATE TABLE GmsDailyPerformance (
    Id VARCHAR(24) PRIMARY KEY,
    Asin VARCHAR(50) NOT NULL,
    Date DATE NOT NULL,
    Brand NVARCHAR(255),
    StoreCode NVARCHAR(50),
    OrderedRevenue DECIMAL(18, 2) DEFAULT 0,
    OrderedUnits INT DEFAULT 0,
    ShippedRevenue DECIMAL(18, 2) DEFAULT 0,
    ShippedCOGS DECIMAL(18, 2) DEFAULT 0,
    ShippedUnits INT DEFAULT 0,
    CustomerReturns INT DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT UC_GmsDailyPerformance_Asin_Date UNIQUE (Asin, Date)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_GmsDailyPerformance_Asin_Date' AND object_id = OBJECT_ID('GmsDailyPerformance'))
CREATE INDEX IX_GmsDailyPerformance_Asin_Date ON GmsDailyPerformance(Asin, Date);
