const { getPool } = require('../database/db');

async function ensureIndexes() {
    try {
        const pool = await getPool();
        console.log("Connected to SQL Server. Applying indexes...");

        // 1. Asins Indexes
        console.log("Checking and creating Asins indexes...");
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Asins_SellerId_Status' AND object_id = OBJECT_ID('Asins'))
            BEGIN
                CREATE NONCLUSTERED INDEX IX_Asins_SellerId_Status 
                ON Asins(SellerId, Status) 
                INCLUDE (AsinCode, Sku, Title, Category, CurrentPrice);
                PRINT 'Created index IX_Asins_SellerId_Status';
            END
            ELSE
            BEGIN
                PRINT 'Index IX_Asins_SellerId_Status already exists';
            END
        `);

        // 2. AdsPerformance Indexes
        console.log("Checking and creating AdsPerformance indexes...");
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AdsPerformance_Asin_Date_ReportType' AND object_id = OBJECT_ID('AdsPerformance'))
            BEGIN
                CREATE NONCLUSTERED INDEX IX_AdsPerformance_Asin_Date_ReportType 
                ON AdsPerformance(Asin, Date, ReportType) 
                INCLUDE (AdSales, AdSpend, Orders, OrganicSales, Impressions, Clicks);
                PRINT 'Created index IX_AdsPerformance_Asin_Date_ReportType';
            END
            ELSE
            BEGIN
                PRINT 'Index IX_AdsPerformance_Asin_Date_ReportType already exists';
            END
        `);

        // 3. Alerts Indexes
        console.log("Checking and creating Alerts indexes...");
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Alerts_SellerId_CreatedAt' AND object_id = OBJECT_ID('Alerts'))
            BEGIN
                CREATE NONCLUSTERED INDEX IX_Alerts_SellerId_CreatedAt 
                ON Alerts(SellerId, CreatedAt DESC) 
                INCLUDE (Severity, Message);
                PRINT 'Created index IX_Alerts_SellerId_CreatedAt';
            END
            ELSE
            BEGIN
                PRINT 'Index IX_Alerts_SellerId_CreatedAt already exists';
            END
        `);

        // 4. Sellers Indexes
        console.log("Checking and creating Sellers indexes...");
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Sellers_Id_IsActive' AND object_id = OBJECT_ID('Sellers'))
            BEGIN
                CREATE NONCLUSTERED INDEX IX_Sellers_Id_IsActive 
                ON Sellers(Id, IsActive) 
                INCLUDE (Name, Marketplace);
                PRINT 'Created index IX_Sellers_Id_IsActive';
            END
            ELSE
            BEGIN
                PRINT 'Index IX_Sellers_Id_IsActive already exists';
            END
        `);

        console.log("✅ All indexes applied successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error applying indexes:", err);
        process.exit(1);
    }
}

ensureIndexes();
