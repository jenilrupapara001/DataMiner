const { getPool } = require('../database/db');

async function main() {
    const pool = await getPool();
    
    console.log('--- LATEST 10 RECORDS IN AdsPerformance ---');
    const latest = await pool.request().query(`
        SELECT TOP 10 * 
        FROM AdsPerformance 
        ORDER BY UploadedAt DESC
    `);
    console.log(latest.recordset);
    
    console.log('--- DISTINCT REPORT TYPES AND DATE RANGES ---');
    const summary = await pool.request().query(`
        SELECT 
            ReportType,
            MIN(Date) as minDate,
            MAX(Date) as maxDate,
            COUNT(*) as count,
            MAX(UploadedAt) as lastUploadedAt
        FROM AdsPerformance
        GROUP BY ReportType
    `);
    console.log(summary.recordset);
}

main().catch(console.error);
