-- Create Target v/s Achievement Tables
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[GmsTargets]') AND type in (N'U'))
BEGIN
    CREATE TABLE [GmsTargets] (
        [Id] VARCHAR(24) PRIMARY KEY,
        [SellerId] NVARCHAR(100) NOT NULL,
        [BrandManager] NVARCHAR(100) NULL,
        [TargetType] VARCHAR(10) NOT NULL, -- 'YEARLY' or 'MONTHLY'
        [Year] INT NOT NULL,
        [Month] INT NULL,
        [TotalTargetValue] DECIMAL(18, 2) NOT NULL,
        [CreatedAt] DATETIME DEFAULT GETDATE(),
        [UpdatedAt] DATETIME DEFAULT GETDATE()
    );
    CREATE INDEX IX_GmsTargets_SellerId ON GmsTargets(SellerId);
    CREATE INDEX IX_GmsTargets_Type ON GmsTargets(TargetType);
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[GmsTargetBreakdowns]') AND type in (N'U'))
BEGIN
    CREATE TABLE [GmsTargetBreakdowns] (
        [Id] VARCHAR(24) PRIMARY KEY,
        [TargetId] VARCHAR(24) NOT NULL FOREIGN KEY REFERENCES GmsTargets(Id) ON DELETE CASCADE,
        [PeriodType] VARCHAR(10) NOT NULL, -- 'MONTH', 'WEEK', 'DAY'
        [PeriodValue] INT NOT NULL, -- Month (1-12), Week (1-5), or Day
        [SpecificDate] DATE NULL,
        [TargetValue] DECIMAL(18, 2) NOT NULL,
        [AchievedValue] DECIMAL(18, 2) NULL, -- Manual override GMS
        [PercentageContribution] DECIMAL(5, 2) NULL,
        [CreatedAt] DATETIME DEFAULT GETDATE()
    );
    CREATE INDEX IX_GmsTargetBreakdowns_TargetId ON GmsTargetBreakdowns(TargetId);
    CREATE INDEX IX_GmsTargetBreakdowns_Period ON GmsTargetBreakdowns(PeriodType, PeriodValue);
    CREATE INDEX IX_GmsTargetBreakdowns_Date ON GmsTargetBreakdowns(SpecificDate);
END
