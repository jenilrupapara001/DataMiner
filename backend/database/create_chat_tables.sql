-- ============================================
-- MessageStatus table (for read receipts)
-- ============================================
IF OBJECT_ID(N'dbo.MessageStatus', N'U') IS NULL
BEGIN
    CREATE TABLE MessageStatus (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        MessageId VARCHAR(24) NOT NULL,
        UserId VARCHAR(24) NOT NULL,
        IsRead BIT DEFAULT 1,
        ReadAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_MessageStatus_Message FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
        CONSTRAINT FK_MessageStatus_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT UC_Message_User UNIQUE (MessageId, UserId)
    );

    CREATE INDEX IX_MessageStatus_UserId ON MessageStatus(UserId);
    CREATE INDEX IX_MessageStatus_MessageId ON MessageStatus(MessageId);

    PRINT '✅ Created MessageStatus table';
END
GO

-- ============================================
-- MessageReactions table (for emoji reactions)
-- ============================================
IF OBJECT_ID(N'dbo.MessageReactions', N'U') IS NULL
BEGIN
    CREATE TABLE MessageReactions (
        Id BIGINT IDENTITY(1,1) PRIMARY KEY,
        MessageId VARCHAR(24) NOT NULL,
        UserId VARCHAR(24) NOT NULL,
        Emoji NVARCHAR(20) NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_MessageReactions_Message FOREIGN KEY (MessageId) REFERENCES Messages(Id) ON DELETE CASCADE,
        CONSTRAINT FK_MessageReactions_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
        CONSTRAINT UC_Message_User_Emoji UNIQUE (MessageId, UserId, Emoji)
    );

    CREATE INDEX IX_MessageReactions_MessageId ON MessageReactions(MessageId);
    CREATE INDEX IX_MessageReactions_UserId ON MessageReactions(UserId);

    PRINT '✅ Created MessageReactions table';
END
GO

-- ============================================
-- CallLogs table (for call history)
-- ============================================
IF OBJECT_ID(N'dbo.CallLogs', N'U') IS NULL
BEGIN
    CREATE TABLE CallLogs (
        Id VARCHAR(24) PRIMARY KEY,
        ConversationId VARCHAR(24) NOT NULL,
        CallerId VARCHAR(24) NOT NULL,
        ReceiverId VARCHAR(24) NOT NULL,
        [Type] NVARCHAR(20), -- 'AUDIO', 'VIDEO'
        Status NVARCHAR(20), -- 'INITIATED', 'ONGOING', 'REJECTED', 'ENDED'
        StartedAt DATETIME2,
        EndedAt DATETIME2,
        Duration INT, -- in seconds
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_CallLogs_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
        CONSTRAINT FK_CallLogs_Caller FOREIGN KEY (CallerId) REFERENCES Users(Id),
        CONSTRAINT FK_CallLogs_Receiver FOREIGN KEY (ReceiverId) REFERENCES Users(Id)
    );

    CREATE INDEX IX_CallLogs_ConversationId ON CallLogs(ConversationId);
    CREATE INDEX IX_CallLogs_CallerId ON CallLogs(CallerId);
    CREATE INDEX IX_CallLogs_ReceiverId ON CallLogs(ReceiverId);
    CREATE INDEX IX_CallLogs_CreatedAt ON CallLogs(CreatedAt DESC);

    PRINT '✅ Created CallLogs table';
END
GO

-- Add LastMessage column to Conversations if it doesn't exist
IF COL_LENGTH('Conversations', 'LastMessageId') IS NULL
BEGIN
    ALTER TABLE Conversations ADD LastMessageId VARCHAR(24) NULL;
    PRINT '✅ Added LastMessageId to Conversations';
END
GO

-- Alter Messages table to add Reactions column if needed
IF COL_LENGTH('Messages', 'Reactions') IS NULL
BEGIN
    ALTER TABLE Messages ADD Reactions NVARCHAR(MAX) NULL;
    PRINT '✅ Added Reactions column to Messages';
END
GO

PRINT '✅ All chat/call supporting tables created';
GO
