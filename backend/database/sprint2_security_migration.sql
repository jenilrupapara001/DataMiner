-- Sprint 2 Security: Password History + Force Reset columns
-- Run this migration on the retailops database

-- Add password security columns to Users table
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'ForcePasswordReset')
    ALTER TABLE Users ADD ForcePasswordReset BIT DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'PasswordChangedAt')
    ALTER TABLE Users ADD PasswordChangedAt DATETIME2 DEFAULT GETDATE();

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Users' AND COLUMN_NAME = 'PasswordExpiresAt')
    ALTER TABLE Users ADD PasswordExpiresAt DATETIME2 NULL;

-- Set initial password expiry for existing users (90 days from now)
UPDATE Users SET PasswordExpiresAt = DATEADD(day, 90, ISNULL(PasswordChangedAt, GETDATE()))
WHERE PasswordExpiresAt IS NULL;

-- Create PasswordHistory table
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PasswordHistory')
BEGIN
    CREATE TABLE PasswordHistory (
        Id VARCHAR(24) NOT NULL,
        UserId VARCHAR(24) NOT NULL,
        PasswordHash NVARCHAR(255) NOT NULL,
        ChangedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT PK_PasswordHistory PRIMARY KEY (Id)
    );
    
    CREATE INDEX IX_PasswordHistory_UserId ON PasswordHistory (UserId, ChangedAt DESC);
END
