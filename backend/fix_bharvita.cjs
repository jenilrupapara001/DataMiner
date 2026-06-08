const { getPool, sql } = require('./database/db');

async function fixBharvitaAsins() {
    console.log("Starting cleanup of mistakenly ingested ASINs for 101-BHARVITA...");
    const pool = await getPool();
    const sellerId = '69e8612f1e4de9e2dc81f78d';

    try {
        // Find the rogue ASIN IDs and Codes
        const rogueAsinsResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query(`
                SELECT Id, AsinCode FROM Asins 
                WHERE SellerId = @sellerId AND CreatedAt > '2026-06-01'
            `);
            
        const rogueAsins = rogueAsinsResult.recordset;
        
        if (rogueAsins.length === 0) {
            console.log("No rogue ASINs found.");
            process.exit(0);
        }

        console.log(`Found ${rogueAsins.length} rogue ASINs to delete.`);

        // Delete in batches to avoid locking the database
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

        // Update the ScrapeUsed count for the seller
        await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query(`
                UPDATE Sellers 
                SET ScrapeUsed = (SELECT COUNT(*) FROM Asins WHERE SellerId = @sellerId)
                WHERE Id = @sellerId
            `);

        console.log("Cleanup complete!");
        process.exit(0);
    } catch (e) {
        console.error("Cleanup failed:", e);
        process.exit(1);
    }
}

fixBharvitaAsins();
