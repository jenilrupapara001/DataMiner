-- Add missing columns to Sellers table for Keepa integration
IF COL_LENGTH('Sellers', 'KeepaSellerId') IS NULL
BEGIN
    ALTER TABLE Sellers ADD KeepaSellerId NVARCHAR(100) NULL;
    CREATE INDEX IX_Sellers_KeepaSellerId ON Sellers(KeepaSellerId);
    PRINT '✅ Added KeepaSellerId column to Sellers table';
END
GO

IF COL_LENGTH('Sellers', 'KeepaDomainId') IS NULL
BEGIN
    ALTER TABLE Sellers ADD KeepaDomainId INT NULL;
    PRINT '✅ Added KeepaDomainId column to Sellers table';
END
GO

IF COL_LENGTH('Sellers', 'LastKeepaSync') IS NULL
BEGIN
    ALTER TABLE Sellers ADD LastKeepaSync DATETIME2 NULL;
    PRINT '✅ Added LastKeepaSync column to Sellers table';
END
GO

IF COL_LENGTH('Sellers', 'KeepaAsinCount') IS NULL
BEGIN
    ALTER TABLE Sellers ADD KeepaAsinCount INT DEFAULT 0;
    PRINT '✅ Added KeepaAsinCount column to Sellers table';
END
GO

-- Create Notifications table
IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE Notifications (
        Id VARCHAR(24) PRIMARY KEY,
        RecipientId VARCHAR(24) NOT NULL,
        Type NVARCHAR(50) NOT NULL, -- 'ALERT', 'ACTION_ASSIGNED', 'CHAT_MENTION', 'CHAT_MESSAGE', 'SYSTEM'
        ReferenceModel NVARCHAR(100),
        ReferenceId VARCHAR(24),
        Message NVARCHAR(MAX) NOT NULL,
        IsRead BIT DEFAULT 0,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_Notifications_Recipient FOREIGN KEY (RecipientId) REFERENCES Users(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_Notifications_RecipientId ON Notifications(RecipientId);
    CREATE INDEX IX_Notifications_CreatedAt ON Notifications(CreatedAt DESC);
    CREATE INDEX IX_Notifications_IsRead ON Notifications(IsRead);

    PRINT '✅ Created Notifications table';
END
GO

PRINT '✅ Schema migration completed successfully';
GO
