-- Migration: Add PriceDispute column to Asins table
-- Target: Microsoft SQL Server

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'PriceDispute')
BEGIN
    ALTER TABLE Asins ADD PriceDispute BIT DEFAULT 0;
    PRINT '✅ PriceDispute column added to Asins table';
END
ELSE
BEGIN
    PRINT 'ℹ️ PriceDispute column already exists';
END

-- Update existing records based on current price logic
UPDATE Asins 
SET PriceDispute = 1 
WHERE UploadedPrice > 0 
  AND CurrentPrice > 0 
  AND ABS(UploadedPrice - CurrentPrice) > 0.01;

GO
