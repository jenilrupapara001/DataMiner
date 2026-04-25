-- Create remaining tables needed for SQL migration

-- ============================================
-- Notifications table (already created in previous migration, just verify)
-- ============================================
IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE Notifications (
        Id VARCHAR(24) PRIMARY KEY,
        RecipientId VARCHAR(24) NOT NULL,
        Type NVARCHAR(50) NOT NULL,
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

-- ============================================
-- SystemSettings table
-- ============================================
IF OBJECT_ID(N'dbo.SystemSettings', N'U') IS NULL
BEGIN
    CREATE TABLE SystemSettings (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        [Key] NVARCHAR(100) NOT NULL UNIQUE,
        Value NVARCHAR(MAX),
        Description NVARCHAR(500),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX IX_SystemSettings_Key ON SystemSettings([Key]);

    -- Seed default settings
    INSERT INTO SystemSettings ([Key], Value, Description) VALUES
    ('minLqsScore', '80', 'Minimum LQS score for action generation'),
    ('minTitleLength', '100', 'Minimum title length in characters'),
    ('minImageCount', '7', 'Minimum number of images required'),
    ('minDescLength', '500', 'Minimum description length in characters'),
    ('defaultScrapeLimit', '100', 'Default scrape limit per seller');

    PRINT '✅ Created SystemSettings table with defaults';
END
GO

-- ============================================
-- Files table
-- ============================================
IF OBJECT_ID(N'dbo.Files', N'U') IS NULL
BEGIN
    CREATE TABLE Files (
        Id VARCHAR(24) PRIMARY KEY,
        FileName NVARCHAR(255) NOT NULL,
        OriginalName NVARCHAR(255) NOT NULL,
        FilePath NVARCHAR(MAX) NOT NULL,
        FileSize INT,
        MimeType NVARCHAR(100),
        UploadedBy VARCHAR(24),
        RelatedTo NVARCHAR(100), -- 'ASIN', 'Seller', 'Action', etc.
        RelatedId VARCHAR(24),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_Files_UploadedBy FOREIGN KEY (UploadedBy) REFERENCES Users(Id)
    );

    CREATE INDEX IX_Files_UploadedBy ON Files(UploadedBy);
    CREATE INDEX IX_Files_Related ON Files(RelatedTo, RelatedId);

    PRINT '✅ Created Files table';
END
GO

-- ============================================
-- ApiKeys table
-- ============================================
IF OBJECT_ID(N'dbo.ApiKeys', N'U') IS NULL
BEGIN
    CREATE TABLE ApiKeys (
        Id VARCHAR(24) PRIMARY KEY,
        [Key] NVARCHAR(255) NOT NULL UNIQUE,
        Name NVARCHAR(255) NOT NULL,
        OwnerId VARCHAR(24) NOT NULL,
        IsActive BIT DEFAULT 1,
        LastUsed DATETIME2,
        ExpiresAt DATETIME2,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_ApiKeys_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_ApiKeys_OwnerId ON ApiKeys(OwnerId);
    CREATE INDEX IX_ApiKeys_Key ON ApiKeys([Key]);

    PRINT '✅ Created ApiKeys table';
END
GO

-- ============================================
-- Rulesets table
-- ============================================
IF OBJECT_ID(N'dbo.Rulesets', N'U') IS NULL
BEGIN
    CREATE TABLE Rulesets (
        Id VARCHAR(24) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Rules NVARCHAR(MAX), -- JSON array of rules
        Conditions NVARCHAR(MAX), -- JSON
        Actions NVARCHAR(MAX), -- JSON
        IsActive BIT DEFAULT 1,
        CreatedBy VARCHAR(24),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_Rulesets_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );

    CREATE INDEX IX_Rulesets_CreatedBy ON Rulesets(CreatedBy);
    CREATE INDEX IX_Rulesets_IsActive ON Rulesets(IsActive);

    PRINT '✅ Created Rulesets table';
END
GO

-- ============================================
-- RulesetExecutionLogs table
-- ============================================
IF OBJECT_ID(N'dbo.RulesetExecutionLogs', N'U') IS NULL
BEGIN
    CREATE TABLE RulesetExecutionLogs (
        Id VARCHAR(24) PRIMARY KEY,
        RulesetId VARCHAR(24) NOT NULL,
        TriggeredBy NVARCHAR(100), -- 'SCHEDULED', 'MANUAL', 'EVENT'
        Status NVARCHAR(50), -- 'SUCCESS', 'FAILED', 'PARTIAL'
        MatchedCount INT DEFAULT 0,
        ActionedCount INT DEFAULT 0,
        ErrorMessage NVARCHAR(MAX),
        ExecutedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_RulesetExecutionLogs_Ruleset FOREIGN KEY (RulesetId) REFERENCES Rulesets(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_RulesetExecutionLogs_RulesetId ON RulesetExecutionLogs(RulesetId);
    CREATE INDEX IX_RulesetExecutionLogs_ExecutedAt ON RulesetExecutionLogs(ExecutedAt DESC);

    PRINT '✅ Created RulesetExecutionLogs table';
END
GO

-- ============================================
-- Alerts table (if not exists)
-- ============================================
IF OBJECT_ID(N'dbo.Alerts', N'U') IS NULL
BEGIN
    CREATE TABLE Alerts (
        Id VARCHAR(24) PRIMARY KEY,
        SellerId VARCHAR(24) NOT NULL,
        AsinId VARCHAR(24),
        Type NVARCHAR(50), -- 'LOW_STOCK', 'PRICE_DROP', 'RATING_DROP', etc.
        Severity NVARCHAR(20), -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
        Title NVARCHAR(255),
        Message NVARCHAR(MAX),
        IsResolved BIT DEFAULT 0,
        ResolvedAt DATETIME2,
        ResolvedBy VARCHAR(24),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_Alerts_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE,
        CONSTRAINT FK_Alerts_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE SET NULL,
        CONSTRAINT FK_Alerts_ResolvedBy FOREIGN KEY (ResolvedBy) REFERENCES Users(Id)
    );

    CREATE INDEX IX_Alerts_SellerId ON Alerts(SellerId);
    CREATE INDEX IX_Alerts_AsinId ON Alerts(AsinId);
    CREATE INDEX IX_Alerts_CreatedAt ON Alerts(CreatedAt DESC);
    CREATE INDEX IX_Alerts_IsResolved ON Alerts(IsResolved);

    PRINT '✅ Created Alerts table';
END
GO

-- ============================================
-- AlertRules table
-- ============================================
IF OBJECT_ID(N'dbo.AlertRules', N'U') IS NULL
BEGIN
    CREATE TABLE AlertRules (
        Id VARCHAR(24) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Type NVARCHAR(50) NOT NULL,
        Condition NVARCHAR(MAX), -- JSON: { metric, operator, value, period }
        Severity NVARCHAR(20),
        IsActive BIT DEFAULT 1,
        CreatedBy VARCHAR(24),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_AlertRules_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id)
    );

    CREATE INDEX IX_AlertRules_IsActive ON AlertRules(IsActive);
    CREATE INDEX IX_AlertRules_Type ON AlertRules(Type);

    PRINT '✅ Created AlertRules table';
END
GO

-- ============================================
-- RevenueCalculator table (for fee calculations)
-- ============================================
IF OBJECT_ID(N'dbo.RevenueCalculators', N'U') IS NULL
BEGIN
    CREATE TABLE RevenueCalculators (
        Id VARCHAR(24) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        AsinId VARCHAR(24),
        SellerId VARCHAR(24) NOT NULL,
        ReferralFee DECIMAL(18, 4) DEFAULT 0,
        ClosingFee DECIMAL(18, 4) DEFAULT 0,
        ShippingFee DECIMAL(18, 4) DEFAULT 0,
        FbaFee DECIMAL(18, 4) DEFAULT 0,
        StorageFee DECIMAL(18, 4) DEFAULT 0,
        Tax DECIMAL(18, 4) DEFAULT 0,
        TotalFees DECIMAL(18, 4) DEFAULT 0,
        NetRevenue DECIMAL(18, 4) DEFAULT 0,
        Margin DECIMAL(18, 4) DEFAULT 0,
        CalculatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_RevenueCalculators_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE,
        CONSTRAINT FK_RevenueCalculators_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_RevenueCalculators_AsinId ON RevenueCalculators(AsinId);
    CREATE INDEX IX_RevenueCalculators_SellerId ON RevenueCalculators(SellerId);

    PRINT '✅ Created RevenueCalculators table';
END
GO

PRINT '✅ All missing tables created successfully';
GO
