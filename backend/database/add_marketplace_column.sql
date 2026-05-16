IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'Marketplace')
    ALTER TABLE Asins ADD Marketplace NVARCHAR(100)
