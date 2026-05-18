IF OBJECT_ID(N'dbo.Tasks', N'U') IS NULL
BEGIN
    CREATE TABLE Tasks (
        Id VARCHAR(100) PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(MAX),
        Category NVARCHAR(100),
        Priority NVARCHAR(50),
        Status NVARCHAR(50),
        Type NVARCHAR(100),
        AsinId VARCHAR(255),
        AsinCode NVARCHAR(255),
        SellerId VARCHAR(255),
        SellerName NVARCHAR(255),
        AssignedTo VARCHAR(255),
        CreatedBy VARCHAR(255),
        CompletedBy VARCHAR(255),
        ImpactScore INT,
        EffortEstimate NVARCHAR(100),
        IsAIGenerated BIT DEFAULT 0,
        AIReasoning NVARCHAR(MAX),
        StartTime DATETIME,
        CompletedAt DATETIME,
        CompletionRemarks NVARCHAR(MAX),
        Tags NVARCHAR(MAX),
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );
END
