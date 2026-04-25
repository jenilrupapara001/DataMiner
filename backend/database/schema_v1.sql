-- RetailOps Database Schema v1.0 (Idempotent)
-- Target: Microsoft SQL Server

-- 1. Roles and Permissions
IF OBJECT_ID(N'dbo.Roles', N'U') IS NULL
CREATE TABLE Roles (
    Id VARCHAR(24) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL UNIQUE,
    DisplayName NVARCHAR(255),
    Description NVARCHAR(500),
    Level INT DEFAULT 0,
    Color VARCHAR(20) DEFAULT '#4F46E5',
    IsSystem BIT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

IF OBJECT_ID(N'dbo.Permissions', N'U') IS NULL
CREATE TABLE Permissions (
    Id VARCHAR(24) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL UNIQUE,
    DisplayName NVARCHAR(255),
    Category NVARCHAR(100),
    Action NVARCHAR(100),
    Description NVARCHAR(500),
    CreatedAt DATETIME2 DEFAULT GETDATE()
);

IF OBJECT_ID(N'dbo.RolePermissions', N'U') IS NULL
CREATE TABLE RolePermissions (
    RoleId VARCHAR(24) NOT NULL,
    PermissionId VARCHAR(24) NOT NULL,
    PRIMARY KEY (RoleId, PermissionId),
    CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleId) REFERENCES Roles(Id) ON DELETE CASCADE,
    CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (PermissionId) REFERENCES Permissions(Id) ON DELETE CASCADE
);

-- 2. Users and Organizational Structure
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
CREATE TABLE Users (
    Id VARCHAR(24) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    Password NVARCHAR(255) NOT NULL,
    FirstName NVARCHAR(100),
    LastName NVARCHAR(100),
    Phone NVARCHAR(20),
    Avatar NVARCHAR(MAX),
    RoleId VARCHAR(24),
    IsEmailVerified BIT DEFAULT 0,
    IsActive BIT DEFAULT 1,
    IsOnline BIT DEFAULT 0,
    LastSeen DATETIME2,
    Preferences NVARCHAR(MAX), -- JSON
    RefreshToken NVARCHAR(MAX),
    LoginAttempts INT DEFAULT 0,
    LockUntil DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Users_Role FOREIGN KEY (RoleId) REFERENCES Roles(Id)
);

IF OBJECT_ID(N'dbo.UserSupervisors', N'U') IS NULL
CREATE TABLE UserSupervisors (
    UserId VARCHAR(24) NOT NULL,
    SupervisorId VARCHAR(24) NOT NULL,
    PRIMARY KEY (UserId, SupervisorId),
    CONSTRAINT FK_UserSupervisors_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_UserSupervisors_Supervisor FOREIGN KEY (SupervisorId) REFERENCES Users(Id)
);

IF OBJECT_ID(N'dbo.Teams', N'U') IS NULL
CREATE TABLE Teams (
    Id VARCHAR(24) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    ManagerId VARCHAR(24),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Teams_Manager FOREIGN KEY (ManagerId) REFERENCES Users(Id)
);

IF OBJECT_ID(N'dbo.TeamMembers', N'U') IS NULL
CREATE TABLE TeamMembers (
    TeamId VARCHAR(24) NOT NULL,
    UserId VARCHAR(24) NOT NULL,
    PRIMARY KEY (TeamId, UserId),
    CONSTRAINT FK_TeamMembers_Team FOREIGN KEY (TeamId) REFERENCES Teams(Id) ON DELETE CASCADE,
    CONSTRAINT FK_TeamMembers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

-- 3. Sellers and ASINs
IF OBJECT_ID(N'dbo.Sellers', N'U') IS NULL
CREATE TABLE Sellers (
    Id VARCHAR(24) PRIMARY KEY,
    Name NVARCHAR(255) NOT NULL UNIQUE,
    Marketplace NVARCHAR(100),
    SellerId NVARCHAR(100),
    OctoparseId NVARCHAR(100),
    IsActive BIT DEFAULT 1,
    [Plan] NVARCHAR(50) DEFAULT 'Starter',
    ScrapeLimit INT DEFAULT 100,
    ScrapeUsed INT DEFAULT 0,
    LastScrapedAt DATETIME2,
    OctoparseConfig NVARCHAR(MAX), -- JSON
    KeepaConfig NVARCHAR(MAX), -- JSON
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

IF OBJECT_ID(N'dbo.UserSellers', N'U') IS NULL
CREATE TABLE UserSellers (
    UserId VARCHAR(24) NOT NULL,
    SellerId VARCHAR(24) NOT NULL,
    PRIMARY KEY (UserId, SellerId),
    CONSTRAINT FK_UserSellers_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE,
    CONSTRAINT FK_UserSellers_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id) ON DELETE CASCADE
);

IF OBJECT_ID(N'dbo.Asins', N'U') IS NULL
CREATE TABLE Asins (
    Id VARCHAR(24) PRIMARY KEY,
    AsinCode VARCHAR(50) NOT NULL,
    SellerId VARCHAR(24) NOT NULL,
    Status NVARCHAR(50),
    ScrapeStatus NVARCHAR(50),
    Category NVARCHAR(255),
    Brand NVARCHAR(255),
    Title NVARCHAR(MAX),
    ImageUrl NVARCHAR(MAX),
    CurrentPrice DECIMAL(18, 2),
    BSR INT,
    Rating DECIMAL(3, 2),
    ReviewCount INT,
    LQS DECIMAL(5, 2),
    LqsDetails NVARCHAR(MAX), -- JSON
    CdqComponents NVARCHAR(MAX), -- JSON
    FeePreview NVARCHAR(MAX), -- JSON
    BuyBoxStatus BIT,
    LastScrapedAt DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Asins_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id),
    CONSTRAINT UC_Asin_Seller UNIQUE (AsinCode, SellerId)
);

-- 4. ASIN History (Normalized from MongoDB Arrays)
IF OBJECT_ID(N'dbo.AsinHistory', N'U') IS NULL
CREATE TABLE AsinHistory (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    AsinId VARCHAR(24) NOT NULL,
    Date DATE NOT NULL,
    Price DECIMAL(18, 2),
    BSR INT,
    Rating DECIMAL(3, 2),
    ReviewCount INT,
    BuyBoxStatus BIT,
    CONSTRAINT FK_AsinHistory_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AsinHistory_AsinId_Date' AND object_id = OBJECT_ID('AsinHistory'))
CREATE INDEX IX_AsinHistory_AsinId_Date ON AsinHistory(AsinId, Date);

IF OBJECT_ID(N'dbo.AsinWeekHistory', N'U') IS NULL
CREATE TABLE AsinWeekHistory (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    AsinId VARCHAR(24) NOT NULL,
    WeekStartDate DATE NOT NULL,
    AvgPrice DECIMAL(18, 2),
    AvgBSR INT,
    AvgRating DECIMAL(3, 2),
    TotalReviews INT,
    CONSTRAINT FK_AsinWeekHistory_Asin FOREIGN KEY (AsinId) REFERENCES Asins(Id) ON DELETE CASCADE
);

-- 5. Advertising and Sales Data
IF OBJECT_ID(N'dbo.AdsPerformance', N'U') IS NULL
CREATE TABLE AdsPerformance (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    Asin VARCHAR(50) NOT NULL,
    AdvertisedSku VARCHAR(100),
    Date DATE,
    Month DATE,
    ReportType VARCHAR(20) NOT NULL, -- 'daily', 'monthly'
    AdSpend DECIMAL(18, 2) DEFAULT 0,
    AdSales DECIMAL(18, 2) DEFAULT 0,
    Impressions INT DEFAULT 0,
    Clicks INT DEFAULT 0,
    Orders INT DEFAULT 0,
    ACoS DECIMAL(18, 4) DEFAULT 0,
    RoAS DECIMAL(18, 4) DEFAULT 0,
    CTR DECIMAL(18, 4) DEFAULT 0,
    CPC DECIMAL(18, 4) DEFAULT 0,
    ConversionRate DECIMAL(18, 4) DEFAULT 0,
    OrganicSales DECIMAL(18, 2) DEFAULT 0,
    OrganicOrders INT DEFAULT 0,
    Sessions INT DEFAULT 0,
    UploadedAt DATETIME2 DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AdsPerformance_Asin_Date' AND object_id = OBJECT_ID('AdsPerformance'))
CREATE INDEX IX_AdsPerformance_Asin_Date ON AdsPerformance(Asin, Date);

IF OBJECT_ID(N'dbo.MonthlyPerformance', N'U') IS NULL
CREATE TABLE MonthlyPerformance (
    Id VARCHAR(24) PRIMARY KEY,
    Asin VARCHAR(50) NOT NULL,
    Month DATE NOT NULL,
    OrderedUnits INT DEFAULT 0,
    OrderedRevenue DECIMAL(18, 2) DEFAULT 0,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_MonthlyPerformance_Asin FOREIGN KEY (Asin) REFERENCES Asins(AsinCode),
    CONSTRAINT UC_MonthlyPerformance_Asin_Month UNIQUE (Asin, Month)
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MonthlyPerformance_Asin_Month' AND object_id = OBJECT_ID('MonthlyPerformance'))
CREATE INDEX IX_MonthlyPerformance_Asin_Month ON MonthlyPerformance(Asin, Month);

IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
CREATE TABLE Orders (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    Asin VARCHAR(50) NOT NULL,
    Sku VARCHAR(100),
    Date DATE NOT NULL,
    Units INT DEFAULT 0,
    Revenue DECIMAL(18, 2) DEFAULT 0,
    Returns INT DEFAULT 0,
    Currency VARCHAR(10) DEFAULT 'INR',
    Marketplace VARCHAR(50) DEFAULT 'amazon.in',
    Source VARCHAR(50) DEFAULT 'sp-api',
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT UC_Order_Asin_Date UNIQUE (Asin, Date)
);

-- 6. OKR System (Goals, Objectives, Key Results)
IF OBJECT_ID(N'dbo.Goals', N'U') IS NULL
CREATE TABLE Goals (
    Id VARCHAR(24) PRIMARY KEY,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    OwnerId VARCHAR(24),
    StartDate DATE,
    EndDate DATE,
    Status NVARCHAR(50),
    Progress DECIMAL(5, 2),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Goals_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id)
);

IF OBJECT_ID(N'dbo.Objectives', N'U') IS NULL
CREATE TABLE Objectives (
    Id VARCHAR(24) PRIMARY KEY,
    GoalId VARCHAR(24) NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    OwnerId VARCHAR(24),
    Status NVARCHAR(50),
    Progress DECIMAL(5, 2),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Objectives_Goal FOREIGN KEY (GoalId) REFERENCES Goals(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Objectives_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id)
);

IF OBJECT_ID(N'dbo.KeyResults', N'U') IS NULL
CREATE TABLE KeyResults (
    Id VARCHAR(24) PRIMARY KEY,
    ObjectiveId VARCHAR(24) NOT NULL,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    OwnerId VARCHAR(24),
    Status NVARCHAR(50),
    CurrentValue DECIMAL(18, 2),
    TargetValue DECIMAL(18, 2),
    Unit NVARCHAR(50),
    Progress DECIMAL(5, 2),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_KeyResults_Objective FOREIGN KEY (ObjectiveId) REFERENCES Objectives(Id) ON DELETE CASCADE,
    CONSTRAINT FK_KeyResults_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id)
);

-- 7. Actions (Task Management)
IF OBJECT_ID(N'dbo.Actions', N'U') IS NULL
CREATE TABLE Actions (
    Id VARCHAR(24) PRIMARY KEY,
    Title NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    Status NVARCHAR(50),
    Priority NVARCHAR(50),
    Type NVARCHAR(50),
    CreatedBy VARCHAR(24),
    AssignedTo VARCHAR(24),
    SellerId VARCHAR(24),
    GoalId VARCHAR(24),
    ObjectiveId VARCHAR(24),
    KeyResultId VARCHAR(24),
    DueDate DATETIME2,
    CompletedAt DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Actions_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(Id),
    CONSTRAINT FK_Actions_AssignedTo FOREIGN KEY (AssignedTo) REFERENCES Users(Id),
    CONSTRAINT FK_Actions_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id),
    CONSTRAINT FK_Actions_Goal FOREIGN KEY (GoalId) REFERENCES Goals(Id),
    CONSTRAINT FK_Actions_Objective FOREIGN KEY (ObjectiveId) REFERENCES Objectives(Id),
    CONSTRAINT FK_Actions_KeyResult FOREIGN KEY (KeyResultId) REFERENCES KeyResults(Id)
);

IF OBJECT_ID(N'dbo.ActionHistory', N'U') IS NULL
CREATE TABLE ActionHistory (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    ActionId VARCHAR(24) NOT NULL,
    StatusFrom NVARCHAR(50),
    StatusTo NVARCHAR(50),
    ChangedBy VARCHAR(24),
    ChangedAt DATETIME2 DEFAULT GETDATE(),
    Comment NVARCHAR(MAX),
    CONSTRAINT FK_ActionHistory_Action FOREIGN KEY (ActionId) REFERENCES Actions(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ActionHistory_User FOREIGN KEY (ChangedBy) REFERENCES Users(Id)
);

-- 8. Messaging and Conversations
IF OBJECT_ID(N'dbo.Conversations', N'U') IS NULL
CREATE TABLE Conversations (
    Id VARCHAR(24) PRIMARY KEY,
    Type NVARCHAR(20) DEFAULT 'DIRECT', -- 'DIRECT', 'GROUP'
    Title NVARCHAR(255),
    IsActive BIT DEFAULT 1,
    LastMessageId VARCHAR(24), 
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);

IF OBJECT_ID(N'dbo.ConversationParticipants', N'U') IS NULL
CREATE TABLE ConversationParticipants (
    ConversationId VARCHAR(24) NOT NULL,
    UserId VARCHAR(24) NOT NULL,
    JoinedAt DATETIME2 DEFAULT GETDATE(),
    PRIMARY KEY (ConversationId, UserId),
    CONSTRAINT FK_ConvParticipants_Conv FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ConvParticipants_User FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);

IF OBJECT_ID(N'dbo.Messages', N'U') IS NULL
CREATE TABLE Messages (
    Id VARCHAR(24) PRIMARY KEY,
    ConversationId VARCHAR(24) NOT NULL,
    SenderId VARCHAR(24) NOT NULL,
    Type NVARCHAR(20) DEFAULT 'TEXT',
    Content NVARCHAR(MAX),
    FileUrl NVARCHAR(MAX),
    ReplyToId VARCHAR(24),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_Messages_Conv FOREIGN KEY (ConversationId) REFERENCES Conversations(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Messages_Sender FOREIGN KEY (SenderId) REFERENCES Users(Id)
);

-- 9. System Logs
IF OBJECT_ID(N'dbo.SystemLogs', N'U') IS NULL
CREATE TABLE SystemLogs (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    Level NVARCHAR(20),
    Module NVARCHAR(100),
    Message NVARCHAR(MAX),
    Metadata NVARCHAR(MAX), -- JSON
    UserId VARCHAR(24),
    Timestamp DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_SystemLogs_User FOREIGN KEY (UserId) REFERENCES Users(Id)
);

-- 10. Octoparse Task Pool
IF OBJECT_ID(N'dbo.OctoTasks', N'U') IS NULL
CREATE TABLE OctoTasks (
    Id VARCHAR(24) PRIMARY KEY,
    TaskId NVARCHAR(100) NOT NULL UNIQUE,
    IsAssigned BIT DEFAULT 0,
    SellerId VARCHAR(24),
    LastAssignedAt DATETIME2,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CONSTRAINT FK_OctoTasks_Seller FOREIGN KEY (SellerId) REFERENCES Sellers(Id)
);
