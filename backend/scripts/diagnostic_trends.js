const { getPool, sql } = require('../database/db');
require('dotenv').config();

async function diagnostic() {
    const pool = await getPool();
    const result = await pool.request().query(`
        SELECT TOP 10 AsinCode, BSR, History, BsrTrend 
        FROM Asins 
        WHERE BsrTrend = 'Down' 
        AND History IS NOT NULL
    `);

    for (const asin of result.recordset) {
        const history = JSON.parse(asin.History);
        if (history.length < 2) continue;
        
        const prevPoints = history.slice(0, -1).filter(h => (h.bsr || 0) > 0);
        if (prevPoints.length === 0) continue;
        
        const avg = prevPoints.reduce((s, h) => s + h.bsr, 0) / prevPoints.length;
        const current = asin.BSR;
        const diff = (current - avg) / avg;
        
        console.log(`ASIN: ${asin.AsinCode}`);
        console.log(`  Current BSR: ${current}`);
        console.log(`  Avg Prev: ${avg.toFixed(2)}`);
        console.log(`  Diff: ${(diff * 100).toFixed(2)}%`);
        console.log(`  Current Trend: ${asin.BsrTrend}`);
        
        if (diff < -0.05) {
            console.log(`  🚨 BUG DETECTED: Should be GROW!`);
        }
    }
    process.exit(0);
}

diagnostic();
