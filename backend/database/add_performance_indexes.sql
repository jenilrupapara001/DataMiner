
-- ============================================
-- Performance Indexes for MongoDB to SQL Migration
-- ============================================
-- These indexes optimize common query patterns used by the SQL controllers
-- that were converted from MongoDB operations.

USE [retailops];
GO

-- ============================================
-- Indexes for Users table
-- ============================================
-- Optimize user queries by email, role, and status lookups

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_Email' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE UNIQUE INDEX IX_Users_Email ON Users(Email);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_RoleId' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE INDEX IX_Users_RoleId ON Users(RoleId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_IsActive' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE INDEX IX_Users_IsActive ON Users(IsActive);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_FullName' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE INDEX IX_Users_FullName ON Users(FirstName, LastName);
END
GO

-- ============================================
-- Indexes for Sellers table
-- ============================================
-- Optimize seller queries and filtering

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Sellers_SellerId' AND object_id = OBJECT_ID('Sellers'))
BEGIN
    CREATE INDEX IX_Sellers_SellerId ON Sellers(SellerId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Sellers_IsActive' AND object_id = OBJECT_ID('Sellers'))
BEGIN
    CREATE INDEX IX_Sellers_IsActive ON Sellers(IsActive);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Sellers_Marketplace' AND object_id = OBJECT_ID('Sellers'))
BEGIN
    CREATE INDEX IX_Sellers_Marketplace ON Sellers(Marketplace);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Sellers_Plan' AND object_id = OBJECT_ID('Sellers'))
BEGIN
    CREATE INDEX IX_Sellers_Plan ON Sellers([Plan]);
END
GO

-- ============================================
-- Indexes for UserSellers junction table
-- ============================================
-- Optimize seller assignment queries (critical for multi-tenant access control)

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserSellers_UserId' AND object_id = OBJECT_ID('UserSellers'))
BEGIN
    CREATE INDEX IX_UserSellers_UserId ON UserSellers(UserId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserSellers_SellerId' AND object_id = OBJECT_ID('UserSellers'))
BEGIN
    CREATE INDEX IX_UserSellers_SellerId ON UserSellers(SellerId);
END
GO

-- ============================================
-- Indexes for Asins table
-- ============================================
-- Optimize ASIN filtering and search (common dashboard and table queries)

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Asins_SellerId' AND object_id = OBJECT_ID('Asins'))
BEGIN
    CREATE INDEX IX_Asins_SellerId ON Asins(SellerId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Asins_Status' AND object_id = OBJECT_ID('Asins'))
BEGIN
    CREATE INDEX IX_Asins_Status ON Asins(Status);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Asins_Category' AND object_id = OBJECT_ID('Asins'))
BEGIN
    CREATE INDEX IX_Asins_Category ON Asins(Category);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Asins_Brand' AND object_id = OBJECT_ID('Asins'))
BEGIN
    CREATE INDEX IX_Asins_Brand ON Asins(Brand);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Asins_BuyBoxStatus' AND object_id = OBJECT_ID('Asins'))
BEGIN
    CREATE INDEX IX_Asins_BuyBoxStatus ON Asins(BuyBoxStatus) WHERE BuyBoxStatus = 1;
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Asins_CurrentPrice' AND object_id = OBJECT_ID('Asins'))
BEGIN
    CREATE INDEX IX_Asins_CurrentPrice ON Asins(CurrentPrice);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Asins_BSR' AND object_id = OBJECT_ID('Asins'))
BEGIN
    CREATE INDEX IX_Asins_BSR ON Asins(BSR) WHERE BSR > 0;
END
GO

-- ============================================
-- Indexes for UserSupervisors table
-- ============================================
-- Optimize hierarchy queries

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserSupervisors_User' AND object_id = OBJECT_ID('UserSupervisors'))
BEGIN
    CREATE INDEX IX_UserSupervisors_User ON UserSupervisors(UserId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UserSupervisors_Supervisor' AND object_id = OBJECT_ID('UserSupervisors'))
BEGIN
    CREATE INDEX IX_UserSupervisors_Supervisor ON UserSupervisors(SupervisorId);
END
GO

-- ============================================
-- Indexes for Actions table
-- ============================================
-- Optimize dashboard stats queries

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Actions_AssignedTo' AND object_id = OBJECT_ID('Actions'))
BEGIN
    CREATE INDEX IX_Actions_AssignedTo ON Actions(AssignedTo);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Actions_Status' AND object_id = OBJECT_ID('Actions'))
BEGIN
    CREATE INDEX IX_Actions_Status ON Actions(Status);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Actions_SellerId' AND object_id = OBJECT_ID('Actions'))
BEGIN
    CREATE INDEX IX_Actions_SellerId ON Actions(SellerId);
END
GO

-- ============================================
-- Indexes for RolePermissions junction table
-- ============================================
-- Optimize permission loading during authentication

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RolePermissions_Role' AND object_id = OBJECT_ID('RolePermissions'))
BEGIN
    CREATE INDEX IX_RolePermissions_Role ON RolePermissions(RoleId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_RolePermissions_Permission' AND object_id = OBJECT_ID('RolePermissions'))
BEGIN
    CREATE INDEX IX_RolePermissions_Permission ON RolePermissions(PermissionId);
END
GO

-- ============================================
-- Indexes for Alerts table (if it exists)
-- ============================================

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Alerts')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Alerts_SellerId' AND object_id = OBJECT_ID('Alerts'))
    BEGIN
        CREATE INDEX IX_Alerts_SellerId ON Alerts(SellerId);
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Alerts_Severity_CreatedAt' AND object_id = OBJECT_ID('Alerts'))
    BEGIN
        CREATE INDEX IX_Alerts_Severity_CreatedAt ON Alerts(Severity, CreatedAt DESC);
    END
END
GO

-- ============================================
-- Indexes for AdsPerformance table
-- ============================================
-- Optimize dashboard chart and analytics queries

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AdsPerformance_ReportType_Date' AND object_id = OBJECT_ID('AdsPerformance'))
BEGIN
    CREATE INDEX IX_AdsPerformance_ReportType_Date ON AdsPerformance(ReportType, Date) INCLUDE (AdSales, AdSpend, Orders, OrganicSales);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AdsPerformance_Date_ReportType' AND object_id = OBJECT_ID('AdsPerformance'))
BEGIN
    CREATE INDEX IX_AdsPerformance_Date_ReportType ON AdsPerformance(Date DESC, ReportType) INCLUDE (AdSales, AdSpend);
END
GO

-- ============================================
-- Indexes for system tables used in dashboard
-- ============================================

-- TeamMembers for team stats
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'TeamMembers')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TeamMembers_User' AND object_id = OBJECT_ID('TeamMembers'))
    BEGIN
        CREATE INDEX IX_TeamMembers_User ON TeamMembers(UserId);
    END
END
GO

-- ============================================
-- Note: Execute this script after the main schema deployment
-- ============================================

PRINT '✅ Performance indexes created successfully';
GO
