const sql = require('mssql');
const { getPool } = require('./database/db');

async function migrateWeekHistoryToSubBsr() {
    console.log('🚀 Starting Week History Migration: Main BSR -> Sub BSR...');
    try {
        const pool = await getPool();

        // 1. Fetch ASINs that have a SubBsr string
        const result = await pool.request().query(`
            SELECT Id, AsinCode, SubBsr 
            FROM Asins 
            WHERE SubBsr IS NOT NULL AND SubBsr != '' AND SubBsr != '0'
        `);

        const asins = result.recordset;
        console.log(`📊 Found ${asins.length} ASINs with SubBsr data.`);

        let updatedAsins = 0;
        let totalRecordsUpdated = 0;

        for (const asin of asins) {
            // Extract rank number from string like "#12,345 in Category"
            const match = asin.SubBsr.match(/#([\d,]+)/);
            if (!match) continue;

            const subRank = parseInt(match[1].replace(/,/g, ''));
            if (isNaN(subRank) || subRank === 0) continue;

            // Update all records for this ASIN in AsinWeekHistory
            const updateResult = await pool.request()
                .input('bsr', sql.Int, subRank)
                .input('asinId', sql.VarChar, asin.Id)
                .query(`
                    UPDATE AsinWeekHistory 
                    SET AvgBSR = @bsr 
                    WHERE AsinId = @asinId
                `);
            
            if (updateResult.rowsAffected[0] > 0) {
                updatedAsins++;
                totalRecordsUpdated += updateResult.rowsAffected[0];
            }

            if (updatedAsins % 100 === 0) {
                console.log(`✅ Processed ${updatedAsins} ASINs (${totalRecordsUpdated} history records updated)...`);
            }
        }

        console.log(`\n🎉 Week History Migration Complete!`);
        console.log(`📈 Updated ${totalRecordsUpdated} history records across ${updatedAsins} ASINs.`);
    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
    }
}

migrateWeekHistoryToSubBsr().then(() => process.exit(0));
