const { getPool } = require('../database/db');

async function migrate() {
    console.log('🚀 Starting AdsPerformance schema migration...');
    const pool = await getPool();
    
    const missingColumns = [
        { name: 'Conversions', type: 'INT' },
        { name: 'SameSkuSales', type: 'DECIMAL(18, 2)' },
        { name: 'SameSkuOrders', type: 'INT' },
        { name: 'DailyBudget', type: 'DECIMAL(18, 2)' },
        { name: 'TotalBudget', type: 'DECIMAL(18, 2)' },
        { name: 'MaxSpend', type: 'DECIMAL(18, 2)' },
        { name: 'AvgSpend', type: 'DECIMAL(18, 2)' },
        { name: 'TotalSales', type: 'DECIMAL(18, 2)' },
        { name: 'TotalAcos', type: 'DECIMAL(18, 2)' },
        { name: 'TotalUnits', type: 'INT' },
        { name: 'PageViews', type: 'INT' },
        { name: 'AdSalesPerc', type: 'DECIMAL(18, 4)' },
        { name: 'TosIs', type: 'DECIMAL(18, 4)' },
        { name: 'Aov', type: 'DECIMAL(18, 2)' },
        { name: 'BuyBoxPercentage', type: 'DECIMAL(18, 4)' },
        { name: 'BrowserSessions', type: 'INT' },
        { name: 'MobileAppSessions', type: 'INT' }
    ];

    try {
        for (const col of missingColumns) {
            console.log(`Checking column: ${col.name}`);
            const checkResult = await pool.request().query(`
                IF NOT EXISTS (
                    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = 'AdsPerformance' AND COLUMN_NAME = '${col.name}'
                )
                BEGIN
                    ALTER TABLE AdsPerformance ADD [${col.name}] ${col.type} DEFAULT 0;
                    PRINT 'Added column ${col.name}';
                END
            `);
        }
        console.log('✅ AdsPerformance schema updated successfully');
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
    process.exit(0);
}

migrate();
