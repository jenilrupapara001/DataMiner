-- ============================================
-- Performance Indexes for ASIN History and Deadlock Prevention
-- ============================================

-- Ensure the AsinHistory lookups are extremely fast
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AsinHistory_AsinId_Date' AND object_id = OBJECT_ID('AsinHistory')) CREATE UNIQUE NONCLUSTERED INDEX IX_AsinHistory_AsinId_Date ON AsinHistory (AsinId, Date) INCLUDE (Price, BSR, Rating, ReviewCount, BuyBoxStatus, StockLevel, LQS);

-- Ensure the SubBsrHistory lookups are extremely fast
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_SubBsrHistory_AsinId_Date' AND object_id = OBJECT_ID('SubBsrHistory')) CREATE NONCLUSTERED INDEX IX_SubBsrHistory_AsinId_Date ON SubBsrHistory (AsinId, Date) INCLUDE (SubBsrCategory, SubBsrRank, CreatedAt);

-- Ensure the AdsData filtering by Seller and Date is fast
IF OBJECT_ID('AdsData') IS NOT NULL AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AdsData_SellerId_Date' AND object_id = OBJECT_ID('AdsData')) CREATE NONCLUSTERED INDEX IX_AdsData_SellerId_Date ON AdsData (SellerId, Date) INCLUDE (Campaign, AdGroup, Targeting, AdSales, AdSpend, Clicks, Impressions, ROAS);
