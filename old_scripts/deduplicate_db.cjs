const { getPool } = require('./backend/database/db.js');

async function removeDuplicates() {
    try {
        const pool = await getPool();
        console.log("Removing duplicates from AsinHistory and SubBsrHistory...");
        
        // AsinHistory Deduplication
        const ahRes = await pool.request().query(`
            WITH CTE AS (
                SELECT AsinId, Date,
                       ROW_NUMBER() OVER(PARTITION BY AsinId, Date ORDER BY Price DESC) as rn
                FROM AsinHistory
            )
            DELETE FROM CTE WHERE rn > 1;
        `);
        console.log(`✅ Removed ${ahRes.rowsAffected[0]} duplicates from AsinHistory.`);

        // SubBsrHistory Deduplication
        const sbRes = await pool.request().query(`
            WITH CTE AS (
                SELECT AsinId, Date, Category,
                       ROW_NUMBER() OVER(PARTITION BY AsinId, Date, Category ORDER BY Bsr ASC) as rn
                FROM SubBsrHistory
            )
            DELETE FROM CTE WHERE rn > 1;
        `);
        console.log(`✅ Removed ${sbRes.rowsAffected[0]} duplicates from SubBsrHistory.`);
        
        // JSON History Deduplication
        console.log("Processing JSON History deduplication (Node-side parsing)...");
        const asinsRes = await pool.request().query(`
            SELECT Id, CAST(History AS VARCHAR(MAX)) as History
            FROM Asins
            WHERE CAST(History AS VARCHAR(MAX)) LIKE '%"date":"2026-06-08"%"date":"2026-06-08"%'
        `);
        
        let fixedCount = 0;
        for (const row of asinsRes.recordset) {
            try {
                let historyArr = JSON.parse(row.History || '[]');
                
                // Deduplicate by date, keeping the last one
                const uniqueHistory = [];
                const seenDates = new Set();
                
                for (let i = historyArr.length - 1; i >= 0; i--) {
                    const item = historyArr[i];
                    if (!item || !item.date) continue;
                    if (!seenDates.has(item.date)) {
                        seenDates.add(item.date);
                        uniqueHistory.unshift(item); // prepend to keep original order
                    }
                }
                
                const newHistoryJson = JSON.stringify(uniqueHistory);
                
                await pool.request()
                    .input('id', row.Id)
                    .input('history', newHistoryJson)
                    .query(`UPDATE Asins SET History = @history WHERE Id = @id`);
                    
                fixedCount++;
            } catch(e) {
                console.error("Error parsing/fixing JSON for ASIN", row.Id, e);
            }
        }
        console.log(`✅ Fixed JSON History for ${fixedCount} ASINs.`);
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
removeDuplicates();
