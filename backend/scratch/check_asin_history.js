const { getPool } = require('/Users/jenilrupapara/RetailOps_V2.1/retail-ops/backend/database/db');

async function checkHistory() {
    try {
        console.log('🔄 Connecting...');
        const pool = await getPool();
        const res = await pool.request().query(`
            SELECT TOP 20 * FROM AsinHistory
            WHERE AsinId IN ('019a58504363452aa40108a0', '01e0ed161d39463d80563ed9', '021949e491d14726b0477287')
            ORDER BY Date DESC
        `);
        console.log('AsinHistory rows:', res.recordset.length);
        console.log(JSON.stringify(res.recordset, null, 2));
        
        const resWeek = await pool.request().query(`
            SELECT TOP 20 * FROM AsinWeekHistory
            WHERE AsinId IN ('019a58504363452aa40108a0', '01e0ed161d39463d80563ed9', '021949e491d14726b0477287')
            ORDER BY WeekStartDate DESC
        `);
        console.log('AsinWeekHistory rows:', resWeek.recordset.length);
        console.log(JSON.stringify(resWeek.recordset, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkHistory();
