const marketDataSyncService = require('../services/marketDataSyncService');
const AsinDataParser = require('../services/asinDataParser');
const { getPool, sql } = require('../database/db');

async function testManualUpload() {
    console.log('🚀 Testing Manual Upload Unified Logic...');
    
    const sellerId = '69e85c3f1e4de9e2dc81f2b7'; // Correct seller for B0DHD5BVVM
    const asinCode = 'B0DHD5BVVM';
    
    // Simulate raw text format upload
    const rawText = `
Original_URL\t:\thttps://www.amazon.in/dp/${asinCode}
Title\t:\tManual Upload Title
mrp\t:\t₹1500
asp\t:\t₹600
brand\t:\tManual Brand
image_count\t:\t<li class="imageThumbnail">1</li>
    `;

    try {
        console.log('📦 Parsing raw text...');
        const parsedObject = AsinDataParser.parseRawData(rawText);
        console.log('✅ Parsed Object:', parsedObject);

        console.log('📡 Calling processBatchResults...');
        const result = await marketDataSyncService.processBatchResults(sellerId, [parsedObject]);
        
        console.log('📊 Result:', result);

        if (result.updatedCount === 1) {
            console.log('✅ Manual upload simulation successful.');
            
            const pool = await getPool();
            const updated = await pool.request()
                .input('asin', asinCode)
                .query('SELECT Title, Mrp, CurrentPrice, Brand, ScrapeStatus FROM Asins WHERE AsinCode = @asin');
            
            const row = updated.recordset[0];
            console.log('\n--- Verified DB Values ---');
            console.log(`- Title: ${row.Title}`);
            console.log(`- MRP: ${row.Mrp}`);
            console.log(`- Price: ${row.CurrentPrice}`);
            console.log(`- Brand: ${row.Brand}`);
            console.log(`- ScrapeStatus: ${row.ScrapeStatus}`);
        } else {
            console.log('❌ Manual upload simulation failed or ASIN not found.');
        }
    } catch (e) {
        console.error('❌ Error:', e);
    }
    process.exit(0);
}

testManualUpload();
