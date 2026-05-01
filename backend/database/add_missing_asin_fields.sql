-- Migration: Add missing fields to Asins table for catalog synchronization
-- Target: Microsoft SQL Server

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'UploadedPrice')
BEGIN
    ALTER TABLE Asins ADD UploadedPrice DECIMAL(18, 2);
    PRINT '✅ UploadedPrice column added to Asins table';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ReleaseDate')
BEGIN
    ALTER TABLE Asins ADD ReleaseDate DATETIME2;
    PRINT '✅ ReleaseDate column added to Asins table';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'ParentAsin')
BEGIN
    ALTER TABLE Asins ADD ParentAsin NVARCHAR(100);
    PRINT '✅ ParentAsin column added to Asins table';
END

-- Ensure PriceDispute exists and is correctly initialized
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'PriceDispute')
BEGIN
    ALTER TABLE Asins ADD PriceDispute BIT DEFAULT 0;
    PRINT '✅ PriceDispute column added to Asins table';
END

GO
