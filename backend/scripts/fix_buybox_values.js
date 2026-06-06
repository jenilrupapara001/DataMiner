/**
 * One-time migration: Fix inverted BuyBoxWin values in Asins table.
 * 
 * The old isBuyBoxWinner() logic had a bug where the OWN_SELLERS list was
 * skipped when a seller name was passed as configuredSellers, causing
 * BuyBoxWin=0 for our sellers and BuyBoxWin=1 for competitors.
 * 
 * This script recalculates BuyBoxWin for ALL ASINs using the corrected logic.
 */

const { getPool } = require('../database/db');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');

async function fixBuyBoxValues() {
    console.log('🔧 [Migration] Starting BuyBoxWin correction...');
    const startTime = Date.now();

    try {
        const pool = await getPool();

        // 1. Fetch all ASINs with their SoldBy and Seller Name
        const result = await pool.request().query(`
            SELECT a.Id, a.AsinCode, a.SoldBy, a.BuyBoxWin, a.BuyBoxStatus, s.Name as SellerName
            FROM Asins a
            JOIN Sellers s ON a.SellerId = s.Id
            WHERE a.SoldBy IS NOT NULL AND a.SoldBy != ''
        `);

        const asins = result.recordset;
        console.log(`📊 Found ${asins.length} ASINs with SoldBy data to recalculate.`);

        let correctedWon = 0;    // was 0, now should be 1
        let correctedLost = 0;   // was 1, now should be 0
        let unchanged = 0;
        let errors = 0;

        // 2. Process in batches
        const BATCH_SIZE = 500;
        for (let i = 0; i < asins.length; i += BATCH_SIZE) {
            const batch = asins.slice(i, i + BATCH_SIZE);

            // Build a single batch UPDATE query
            let updateCases = '';
            let updateIds = [];
            const request = pool.request();

            for (let j = 0; j < batch.length; j++) {
                const asin = batch[j];
                const correctValue = isBuyBoxWinner(asin.SoldBy) ? 1 : 0;
                const currentValue = asin.BuyBoxWin || 0;

                if (correctValue !== currentValue) {
                    const paramId = `id_${i}_${j}`;
                    const paramVal = `val_${i}_${j}`;
                    request.input(paramId, asin.Id);
                    request.input(paramVal, correctValue);
                    updateIds.push({ paramId, paramVal, asinCode: asin.AsinCode, oldVal: currentValue, newVal: correctValue });

                    if (correctValue === 1) {
                        correctedWon++;
                    } else {
                        correctedLost++;
                    }
                } else {
                    unchanged++;
                }
            }

            // Execute batch update
            if (updateIds.length > 0) {
                // Use individual updates in a single transaction for safety
                let sql = 'SET NOCOUNT ON;\n';
                for (const item of updateIds) {
                    sql += `UPDATE Asins SET BuyBoxWin = @${item.paramVal}, BuyBoxStatus = @${item.paramVal}, UpdatedAt = GETDATE() WHERE Id = @${item.paramId};\n`;
                }

                try {
                    await request.query(sql);
                } catch (err) {
                    console.error(`❌ Batch update failed at offset ${i}:`, err.message);
                    errors += updateIds.length;
                }
            }

            if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= asins.length) {
                console.log(`⏳ Progress: ${Math.min(i + BATCH_SIZE, asins.length)}/${asins.length} processed...`);
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('\n========================================');
        console.log('✅ [Migration] BuyBoxWin correction COMPLETE');
        console.log(`   Total ASINs processed: ${asins.length}`);
        console.log(`   Corrected 0→1 (Won):   ${correctedWon}`);
        console.log(`   Corrected 1→0 (Lost):  ${correctedLost}`);
        console.log(`   Already correct:        ${unchanged}`);
        console.log(`   Errors:                 ${errors}`);
        console.log(`   Duration:               ${duration}s`);
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ [Migration] Critical error:', error.message);
    }

    process.exit(0);
}

fixBuyBoxValues();
