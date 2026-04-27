const marketDataSyncService = require('../services/marketDataSyncService');
const AsinDataParser = require('../services/asinDataParser');
const { getPool, sql } = require('../database/db');

async function testFinalFix() {
    console.log('🚀 Testing Final Fix (SoldBy & History)...');

    const sellerId = '69e861361e4de9e2dc81f83b';
    const asinCode = 'B09SQ5QX4K';

    // Simulate raw data with HTML in soldBy
    const rawData = {
        Original_URL: `https://www.amazon.in/dp/${asinCode}`,
        Title: 'Final Test Title',
        mrp: '₹2000',
        asp: '₹800',
        brand: 'Final Brand',
        // HTML in soldBy field
        sold_by: '<span class="a-size-small">Sold by </span><a href="/seller=A123">Rushwak Retail</a>',
        // Secondary buybox HTML
        Field25: '<div class="aod-offer">Sold by <a href="/seller=B456">Other Seller</a> Price ₹900.00</div>'
    };

    try {
        console.log('📡 Calling processBatchResults...');
        const result = await marketDataSyncService.processBatchResults(sellerId, [rawData]);

        console.log('📊 Result:', result);

        if (result.updatedCount === 1) {
            const pool = await getPool();
            const updated = await pool.request()
                .input('asin', asinCode)
                .query('SELECT Title, SoldBy, History, BuyBoxWin, AllOffers FROM Asins WHERE AsinCode = @asin');

            const row = updated.recordset[0];
            console.log('\n--- Verified DB Values ---');
            console.log(`- Title: ${row.Title}`);
            console.log(`- SoldBy: "${row.SoldBy}"`);
            console.log(`- BuyBoxWin: ${row.BuyBoxWin}`);
            console.log(`- AllOffers: ${row.AllOffers}`);
            console.log(`- History: ${row.History}`);

            if (row.SoldBy === 'Rushwak Retail') {
                console.log('✅ SoldBy extracted correctly from HTML!');
            } else {
                console.log('❌ SoldBy extraction failed.');
            }

            if (row.History && JSON.parse(row.History).length > 0) {
                console.log('✅ History tracking working!');
            } else {
                console.log('❌ History tracking failed.');
            }
        }
    } catch (e) {
        console.error('❌ Error:', e);
    }
    process.exit(0);
}

testFinalFix();
