const { getPool } = require('./backend/database/db.js');

async function removeDuplicates() {
    try {
        const pool = await getPool();
        console.log("Processing JSON History deduplication...");
        const asinsRes = await pool.request().query(`
            SELECT Id, CAST(History AS VARCHAR(MAX)) as History
            FROM Asins
            WHERE CAST(History AS VARCHAR(MAX)) LIKE '%"date":"2026-06-08"%"date":"2026-06-08"%'
        `);
        
        let fixedCount = 0;
        for (const row of asinsRes.recordset) {
            try {
                let historyArr = JSON.parse(row.History || '[]');
                
                const uniqueHistory = [];
                const seenDates = new Set();
                
                // Traverse from newest to oldest
                for (let i = historyArr.length - 1; i >= 0; i--) {
                    const item = historyArr[i];
                    if (!item || !item.date) continue;
                    if (!seenDates.has(item.date)) {
                        seenDates.add(item.date);
                        uniqueHistory.unshift(item);
                    }
                }
                
                const newHistoryJson = JSON.stringify(uniqueHistory);
                
                await pool.request()
                    .input('id', row.Id)
                    .input('history', newHistoryJson)
                    .query(`UPDATE Asins SET History = @history WHERE Id = @id`);
                    
                fixedCount++;
            } catch(e) {
                console.error("Error parsing JSON for ASIN", row.Id, e);
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
