const { getPool } = require('../backend/database/db');
require('dotenv').config();

async function fixAllOffers() {
    try {
        const pool = await getPool();
        console.log('🔄 Fetching ASINs with missing secondary offers in AllOffers...');
        
        const result = await pool.request().query(`
            SELECT Id, AsinCode, AllOffers, SoldBySec, SecondAsp, SoldBy, CurrentPrice
            FROM Asins 
            WHERE SoldBySec IS NOT NULL AND SoldBySec != ''
        `);
        
        const asins = result.recordset;
        console.log(`📊 Processing ${asins.length} ASINs...`);
        
        let updated = 0;
        for (const asin of asins) {
            let allOffers = [];
            try {
                allOffers = asin.AllOffers ? JSON.parse(asin.AllOffers) : [];
            } catch (e) {
                allOffers = [];
            }
            
            // Check if SoldBySec is already in allOffers
            const hasSec = allOffers.some(o => o.seller.toLowerCase() === asin.SoldBySec.toLowerCase());
            
            if (!hasSec) {
                allOffers.push({
                    seller: asin.SoldBySec,
                    price: parseFloat(asin.SecondAsp) || 0,
                    isBuyBoxWinner: false
                });
                
                await pool.request()
                    .input('id', asin.Id)
                    .input('offers', JSON.stringify(allOffers))
                    .query('UPDATE Asins SET AllOffers = @offers WHERE Id = @id');
                updated++;
                if (updated % 100 === 0) console.log(`✅ Updated ${updated}/${asins.length}...`);
            }
        }

        console.log(`✨ Successfully fixed AllOffers for ${updated} ASINs.`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixAllOffers();
