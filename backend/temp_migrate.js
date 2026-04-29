const sql = require('mssql');
const { getPool } = require('./database/db');

async function migrateHistoryToSubBsr() {
    console.log('🚀 Starting History Migration: Main BSR -> Sub BSR...');
    try {
        const pool = await getPool();

        // 1. Fetch ASINs that have a SubBsr string
        const result = await pool.request().query(`
            SELECT Id, AsinCode, BSR, SubBsr, History 
            FROM Asins 
            WHERE SubBsr IS NOT NULL AND SubBsr != ''
        `);

        const asins = result.recordset;
        console.log(`📊 Found ${asins.length} ASINs to process.`);

        let updatedCount = 0;

        for (const asin of asins) {
            // Extract rank number from string like "#12,345 in Category"
            const match = asin.SubBsr.match(/#([\d,]+)/);
            if (!match) continue;

            const subRank = parseInt(match[1].replace(/,/g, ''));
            if (isNaN(subRank) || subRank === 0) continue;

            let historyChanged = false;
            let newHistory = [];

            try {
                const history = asin.History ? JSON.parse(asin.History) : [];
                newHistory = history.map(h => {
                    if (h.bsr !== subRank) {
                        historyChanged = true;
                        return { ...h, bsr: subRank };
                    }
                    return h;
                });
            } catch (e) {
                // skip if malformed
                continue;
            }

            // Update main BSR column and History
            await pool.request()
                .input('bsr', sql.Int, subRank)
                .input('history', sql.NVarChar, JSON.stringify(newHistory))
                .input('id', sql.VarChar, asin.Id)
                .query(`
                    UPDATE Asins 
                    SET BSR = @bsr, History = @history 
                    WHERE Id = @id
                `);
            
            updatedCount++;
            if (updatedCount % 100 === 0) console.log(`✅ Processed ${updatedCount} ASINs...`);
        }

        console.log(`\n🎉 Migration Complete! Updated ${updatedCount} ASINs.`);
    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
    }
}

migrateHistoryToSubBsr().then(() => process.exit(0));
