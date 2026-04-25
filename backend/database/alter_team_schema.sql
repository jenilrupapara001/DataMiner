-- Enhance TeamMembers table with role and resourceAccess
IF COL_LENGTH('TeamMembers', 'Role') IS NULL
BEGIN
    ALTER TABLE TeamMembers ADD Role NVARCHAR(50) DEFAULT 'member';
    PRINT '✅ Added Role column to TeamMembers';
END
GO

IF COL_LENGTH('TeamMembers', 'ResourceAccess') IS NULL
BEGIN
    ALTER TABLE TeamMembers ADD ResourceAccess NVARCHAR(MAX) NULL;
    PRINT '✅ Added ResourceAccess column to TeamMembers';
END
GO

-- Add CurrentTeam column to Users if not exists
IF COL_LENGTH('Users', 'CurrentTeam') IS NULL
BEGIN
    ALTER TABLE Users ADD CurrentTeam VARCHAR(24) NULL;
    CREATE INDEX IX_Users_CurrentTeam ON Users(CurrentTeam);
    PRINT '✅ Added CurrentTeam column to Users';
END
GO

PRINT '✅ Team schema enhancements completed';
GO
