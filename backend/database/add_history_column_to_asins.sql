-- Migration: Add History column to Asins table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Asins') AND name = 'History')
BEGIN
    ALTER TABLE Asins ADD History NVARCHAR(MAX)
END
