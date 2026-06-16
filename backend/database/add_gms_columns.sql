-- Add GMS columns to Asins table if they don't exist
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Asins') AND name = N'OrderedRevenue')
ALTER TABLE Asins ADD OrderedRevenue DECIMAL(18, 2) DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Asins') AND name = N'OrderedUnits')
ALTER TABLE Asins ADD OrderedUnits INT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Asins') AND name = N'ShippedRevenue')
ALTER TABLE Asins ADD ShippedRevenue DECIMAL(18, 2) DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Asins') AND name = N'ShippedCOGS')
ALTER TABLE Asins ADD ShippedCOGS DECIMAL(18, 2) DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Asins') AND name = N'ShippedUnits')
ALTER TABLE Asins ADD ShippedUnits INT DEFAULT 0;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Asins') AND name = N'CustomerReturns')
ALTER TABLE Asins ADD CustomerReturns INT DEFAULT 0;
