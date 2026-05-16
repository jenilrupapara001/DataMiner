-- Change SubBsr and BSR columns to NVARCHAR(MAX) to handle string ranks
ALTER TABLE Asins ALTER COLUMN SubBsr NVARCHAR(MAX);
ALTER TABLE Asins ALTER COLUMN BSR NVARCHAR(MAX);
