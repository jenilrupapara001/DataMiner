-- ============================================
-- TaskTemplates table
-- ============================================
IF OBJECT_ID(N'dbo.TaskTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE TaskTemplates (
        Id VARCHAR(24) PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Category NVARCHAR(100) DEFAULT 'GENERAL',
        Priority NVARCHAR(50) DEFAULT 'MEDIUM',
        Type NVARCHAR(100),
        TimeLimit INT DEFAULT 60,
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE()
    );

    CREATE INDEX IX_TaskTemplates_Category ON TaskTemplates(Category);
    CREATE INDEX IX_TaskTemplates_IsActive ON TaskTemplates(IsActive);

    PRINT '✅ Created TaskTemplates table';
END
GO

-- ============================================
-- GoalTemplates table
-- ============================================
IF OBJECT_ID(N'dbo.GoalTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE GoalTemplates (
        Id VARCHAR(24) PRIMARY KEY,
        Name NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        OwnerId VARCHAR(24),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT FK_GoalTemplates_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id)
    );

    CREATE INDEX IX_GoalTemplates_OwnerId ON GoalTemplates(OwnerId);

    PRINT '✅ Created GoalTemplates table';
END
GO

PRINT '✅ Template tables created successfully';
GO
