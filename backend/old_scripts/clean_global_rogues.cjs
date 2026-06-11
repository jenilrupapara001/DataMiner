const { getPool, sql } = require('../database/db');

async function cleanGlobalRogueAsins() {
    console.log("Starting global cleanup of mistakenly ingested 'ghost' ASINs...");
    const pool = await getPool();

    try {
        // Find ALL rogue ASINs globally (Created after June 1st and completely empty)
        const rogueAsinsResult = await pool.request().query(`
            SELECT Id, AsinCode, SellerId FROM Asins 
            WHERE CreatedAt > '2026-06-01'
            AND Title IS NULL 
            AND ImageUrl IS NULL 
            AND CurrentPrice IS NULL
        `);
            
        const rogueAsins = rogueAsinsResult.recordset;
        
        if (rogueAsins.length === 0) {
            console.log("No rogue ASINs found globally.");
            process.exit(0);
        }

        console.log(`Found ${rogueAsins.length} global rogue ASINs to safely delete.`);

        // Get unique seller IDs affected to update their counts later
        const affectedSellers = [...new Set(rogueAsins.map(r => r.SellerId))];

        // Delete in batches
        const batchSize = 1000;
        for (let i = 0; i < rogueAsins.length; i += batchSize) {
            const batch = rogueAsins.slice(i, i + batchSize);
            const batchIdsJson = JSON.stringify(batch.map(b => b.Id));
            const batchCodesJson = JSON.stringify(batch.map(b => b.AsinCode));
            
            console.log(`Deleting batch ${i / batchSize + 1} of ${Math.ceil(rogueAsins.length / batchSize)}...`);
            
            await pool.request()
                .input('idsJson', sql.NVarChar, batchIdsJson)
                .input('codesJson', sql.NVarChar, batchCodesJson)
                .query(`
                    -- Delete from AsinHistory
                    DELETE FROM AsinHistory WHERE AsinId IN (SELECT value FROM OPENJSON(@idsJson));
                    
                    -- Delete from AsinWeekHistory
                    DELETE FROM AsinWeekHistory WHERE AsinId IN (SELECT value FROM OPENJSON(@idsJson));
                    
                    -- Delete from AdsPerformance
                    DELETE FROM AdsPerformance WHERE Asin IN (SELECT value FROM OPENJSON(@codesJson));
                    
                    -- Finally, delete the ASINs
                    DELETE FROM Asins WHERE Id IN (SELECT value FROM OPENJSON(@idsJson));
                `);
        }

        // Update the ScrapeUsed count for all affected sellers
        console.log(`Updating ASIN counts for ${affectedSellers.length} affected sellers...`);
        for (const sellerId of affectedSellers) {
            await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query(`
                    UPDATE Sellers 
                    SET ScrapeUsed = (SELECT COUNT(*) FROM Asins WHERE SellerId = @sellerId)
                    WHERE Id = @sellerId
                `);
        }

        console.log("✅ Global cleanup complete! All ghost ASINs removed successfully.");
        process.exit(0);
    } catch (e) {
        console.error("Cleanup failed:", e);
        process.exit(1);
    }
}

cleanGlobalRogueAsins();
