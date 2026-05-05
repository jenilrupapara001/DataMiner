const { getPool, sql, generateId } = require('../database/db');
const pLimit = require('p-limit');
require('dotenv').config();

async function normalizeHistoricalTrends() {
    console.log('🚀 Starting Historical Trend Normalization...');
    const pool = await getPool();

    // 1. Fetch all ASINs with their history
    const asinsResult = await pool.request().query('SELECT Id, AsinCode, History, CurrentPrice, BSR, Rating, ReviewCount, BsrTrend, RatingTrend FROM Asins');
    const asins = asinsResult.recordset;

    console.log(`📊 Processing ${asins.length} ASINs...`);

    let updatedCount = 0;

    // Helper logic (copied from MarketDataSyncService for consistency)
    const calculateTrend = (current, history, field, threshold = 0.05, isAbsolute = false, invert = false) => {
        if (!history || history.length < 2) return 'Stable';
        
        // Filter out zero values for average calculation
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
                // For BSR, a DECREASE in number (-%) is GOOD (Grow)
                if (diffPercent < -threshold) return 'Grow';
                if (diffPercent > threshold) return 'Down';
            } else {
                if (diffPercent < -threshold) return 'Down';
                if (diffPercent > threshold) return 'Grow';
            }
            return 'Stable';
        }
    };

    const limit = pLimit(50);
    const tasks = asins.map(asin => limit(async () => {
        try {
            let history = [];
            try {
                history = asin.History ? JSON.parse(asin.History) : [];
            } catch (e) {
                return;
            }

            if (!Array.isArray(history) || history.length === 0) return;

            // 1. Recalculate Trends for the Status Badge
            const currentBSR = asin.BSR || 0;
            const currentRating = asin.Rating || 0;
            const newBsrTrend = calculateTrend(currentBSR, history, 'bsr', 0.05, false, true);
            const newRatingTrend = calculateTrend(currentRating, history, 'rating', 0.1, true);

            if (newBsrTrend !== asin.BsrTrend || newRatingTrend !== asin.RatingTrend) {
                await pool.request()
                    .input('asinId', sql.VarChar, asin.Id)
                    .input('bsrTrend', sql.NVarChar, newBsrTrend)
                    .input('ratingTrend', sql.NVarChar, newRatingTrend)
                    .query('UPDATE Asins SET BsrTrend = @bsrTrend, RatingTrend = @ratingTrend WHERE Id = @asinId');
            }

            // 2. Back-populate SubBsrHistory table from History JSON (Limit to last 14 days)
            const recentHistory = history.filter(h => {
                if (!h.date) return false;
                const hDate = new Date(h.date);
                const fourteenDaysAgo = new Date();
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                return hDate >= fourteenDaysAgo;
            });

            for (const h of recentHistory) {
                const hRank = h.subBsr || h.bsr || 0;
                if (hRank > 0) {
                    await pool.request()
                        .input('id', sql.VarChar, generateId())
                        .input('asinId', sql.VarChar, asin.Id)
                        .input('date', sql.Date, h.date)
                        .input('category', sql.NVarChar, h.category || 'Unknown')
                        .input('rank', sql.Int, hRank)
                        .query(`
                            IF NOT EXISTS (SELECT 1 FROM SubBsrHistory WHERE AsinId = @asinId AND Date = @date)
                                INSERT INTO SubBsrHistory (Id, AsinId, Date, SubBsrCategory, SubBsrRank, CreatedAt)
                                VALUES (@id, @asinId, @date, @category, @rank, GETDATE())
                        `);
                }
            }

            updatedCount++;
            if (updatedCount % 500 === 0) console.log(`✅ Processed ${updatedCount} / ${asins.length} ASINs...`);

        } catch (err) {
            console.error(`❌ Error processing ASIN ${asin.AsinCode}:`, err.message);
        }
    }));

    await Promise.all(tasks);

    console.log(`✨ Normalization complete! Total ASINs updated: ${updatedCount}`);
    process.exit(0);
}

normalizeHistoricalTrends();
