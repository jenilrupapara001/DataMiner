-- Add CometChatUid to Users and Sellers

IF COL_LENGTH('dbo.Users', 'CometChatUid') IS NULL
    ALTER TABLE Users ADD CometChatUid NVARCHAR(100);

IF COL_LENGTH('dbo.Sellers', 'CometChatUid') IS NULL
    ALTER TABLE Sellers ADD CometChatUid NVARCHAR(100);
