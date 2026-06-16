const { getPool } = require('../database/db');

async function lookup() {
    const pool = await getPool();
    const result = await pool.request().query("SELECT TOP 50 Id, Asin, Date, Brand, StoreCode, OrderedRevenue, OrderedUnits FROM GmsDailyPerformance ORDER BY Date DESC");
    console.log('GmsDailyPerformance:', result.recordset);
}

lookup().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
