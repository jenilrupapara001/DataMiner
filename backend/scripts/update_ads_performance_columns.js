const { getPool, sql } = require('../database/db');

async function run() {
    const pool = await getPool();

    console.log('🔧 Updating AdsPerformance table schema...');

    const columnsToAdd = [
        { name: 'Conversions', type: 'INT DEFAULT 0' },
        { name: 'SameSkuSales', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'SameSkuOrders', type: 'INT DEFAULT 0' },
        { name: 'DailyBudget', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'TotalBudget', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'MaxSpend', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'AvgSpend', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'TotalSales', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'TotalAcos', type: 'DECIMAL(18, 4) DEFAULT 0' },
        { name: 'TotalUnits', type: 'INT DEFAULT 0' },
        { name: 'PageViews', type: 'INT DEFAULT 0' },
        { name: 'AdSalesPerc', type: 'DECIMAL(18, 4) DEFAULT 0' },
        { name: 'TosIs', type: 'DECIMAL(18, 4) DEFAULT 0' },
        { name: 'Aov', type: 'DECIMAL(18, 2) DEFAULT 0' },
        { name: 'BuyBoxPercentage', type: 'DECIMAL(18, 4) DEFAULT 0' },
        { name: 'BrowserSessions', type: 'INT DEFAULT 0' },
        { name: 'MobileAppSessions', type: 'INT DEFAULT 0' }
    ];

    for (const col of columnsToAdd) {
        try {
            const checkQuery = `
                IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME='AdsPerformance' AND COLUMN_NAME='${col.name}'
                )
                BEGIN
                    ALTER TABLE AdsPerformance ADD ${col.name} ${col.type};
                END
            `;
            await pool.request().query(checkQuery);
            console.log(`✅ Column ${col.name} ready`);
        } catch (err) {
            console.error(`❌ Column ${col.name} failed:`, err.message);
        }
    }

    console.log('✅ AdsPerformance schema update complete');
    process.exit(0);
}

run().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
