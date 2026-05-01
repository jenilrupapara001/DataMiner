const { getPool } = require('../backend/database/db');
const { isBuyBoxWinner } = require('../backend/utils/buyBoxUtils');
require('dotenv').config();

async function fixBuyBoxWin() {
    try {
        const pool = await getPool();
        console.log('🔄 Fetching all ASINs to recalculate BuyBoxWin...');
        
        const result = await pool.request().query(`
            SELECT a.Id, a.AsinCode, a.SoldBy, s.Name as sellerName 
            FROM Asins a 
            JOIN Sellers s ON a.SellerId = s.Id
        `);
        
        const asins = result.recordset;
        console.log(`📊 Processing ${asins.length} ASINs...`);
        
        let updated = 0;
        for (const asin of asins) {
            const currentWinner = isBuyBoxWinner(asin.SoldBy, [asin.sellerName]);
            const winInt = currentWinner ? 1 : 0;
            
            // We only update if it changed
            // Note: Since we don't have the current BuyBoxWin in the query above to compare, 
            // we'll just update all or fetch it too.
        }
        
        // Let's do it more efficiently with a batch update or just a query
        console.log('🚀 Running bulk update query...');
        
        // This is tricky because isBuyBoxWinner has complex logic.
        // I'll just do it in JS for now as it's a one-time fix.
        
        for (const asin of asins) {
            const currentWinner = isBuyBoxWinner(asin.SoldBy, [asin.sellerName]);
            await pool.request()
                .input('id', asin.Id)
                .input('win', currentWinner ? 1 : 0)
                .query('UPDATE Asins SET BuyBoxWin = @win WHERE Id = @id');
            updated++;
            if (updated % 100 === 0) console.log(`✅ Updated ${updated}/${asins.length}...`);
        }

        console.log(`✨ Successfully updated ${updated} ASINs.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixBuyBoxWin();
