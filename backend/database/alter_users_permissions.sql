IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.Users') 
    AND name = 'ExtraPermissions'
)
BEGIN
    ALTER TABLE Users ADD ExtraPermissions NVARCHAR(MAX);
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.Users') 
    AND name = 'ExcludedPermissions'
)
BEGIN
    ALTER TABLE Users ADD ExcludedPermissions NVARCHAR(MAX);
END
GO
