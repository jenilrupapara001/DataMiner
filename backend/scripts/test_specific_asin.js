const { getPool, sql, generateId } = require('../database/db');
require('dotenv').config();

async function test() {
    const pool = await getPool();
    const result = await pool.request()
        .input('asinCode', sql.VarChar, 'B0GF8DM58B')
        .query('SELECT Id, AsinCode, History, BSR, BsrTrend FROM Asins WHERE AsinCode = @asinCode');
    
    const asin = result.recordset[0];
    const history = JSON.parse(asin.History);
    
    const calculateTrend = (current, history, field, threshold = 0.05, isAbsolute = false, invert = false) => {
        if (!history || history.length < 2) return 'Stable';
        const prevPoints = history.slice(0, -1).filter(item => (item[field] || 0) > 0);
        if (prevPoints.length === 0) return 'Stable';
        const sum = prevPoints.reduce((acc, item) => acc + (item[field] || 0), 0);
        const avg = sum / prevPoints.length;
        if (avg === 0) return 'Stable';
        
        if (isAbsolute) {
            if (current < avg - threshold) return 'Down';
            if (current > avg + threshold) return 'Grow';
            return 'Stable';
        } else {
            const diffPercent = (current - avg) / avg;
            if (invert) {
                if (diffPercent < -threshold) return 'Grow';
                if (diffPercent > threshold) return 'Down';
            } else {
                if (diffPercent < -threshold) return 'Down';
                if (diffPercent > threshold) return 'Grow';
            }
            return 'Stable';
        }
    };

    const newTrend = calculateTrend(asin.BSR, history, 'bsr', 0.05, false, true);
    console.log(`ASIN: ${asin.AsinCode}`);
    console.log(`Current BSR: ${asin.BSR}`);
    console.log(`Calculated Trend: ${newTrend}`);
    console.log(`DB Trend: ${asin.BsrTrend}`);
    
    process.exit(0);
}
test();
