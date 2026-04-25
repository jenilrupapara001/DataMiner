-- Finalize Revenue Calculator Schema

-- 1. Fix Asins table missing columns
IF COL_LENGTH('dbo.Asins', 'StapleLevel') IS NULL
    ALTER TABLE Asins ADD StapleLevel NVARCHAR(50) DEFAULT 'Standard';

IF COL_LENGTH('dbo.Asins', 'Weight') IS NULL
    ALTER TABLE Asins ADD Weight DECIMAL(18, 3) DEFAULT 0;

IF COL_LENGTH('dbo.Asins', 'LossPerReturn') IS NULL
    ALTER TABLE Asins ADD LossPerReturn DECIMAL(18, 2) DEFAULT 0;

-- 2. Create CalculatorAsins table (if not exists)
IF OBJECT_ID(N'dbo.CalculatorAsins', N'U') IS NULL
BEGIN
    CREATE TABLE CalculatorAsins (
        Id VARCHAR(24) PRIMARY KEY,
        AsinCode VARCHAR(50),
        Title NVARCHAR(MAX),
        Category NVARCHAR(255),
        Price DECIMAL(18, 2),
        Weight DECIMAL(18, 3),
        StapleLevel NVARCHAR(50) DEFAULT 'Standard',
        Status NVARCHAR(50) DEFAULT 'pending',
        FeePreview NVARCHAR(MAX), -- JSON
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE()
    );
    PRINT '✅ Created CalculatorAsins table';
END
GO
