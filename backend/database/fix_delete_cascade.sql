-- Drop and recreate the foreign key with CASCADE
ALTER TABLE SubBsrHistory DROP CONSTRAINT FK_SubBsrHistory_Asins;
ALTER TABLE SubBsrHistory ADD CONSTRAINT FK_SubBsrHistory_Asins FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE;
