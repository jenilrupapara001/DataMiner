-- Create UserBrandManagers table if it doesn't exist
IF OBJECT_ID(N'dbo.UserBrandManagers', N'U') IS NULL
BEGIN
    CREATE TABLE UserBrandManagers (
        UserId VARCHAR(24) NOT NULL,
        BrandManagerId VARCHAR(24) NOT NULL,
        PRIMARY KEY (UserId, BrandManagerId),
        CONSTRAINT FK_UserBrandManagers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT FK_UserBrandManagers_BrandManager FOREIGN KEY (BrandManagerId) REFERENCES Users(Id)
    );
END
GO
