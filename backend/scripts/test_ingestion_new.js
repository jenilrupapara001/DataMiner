const marketDataSyncService = require('../services/marketDataSyncService');
const { getPool, sql } = require('../database/db');

async function testIngestion() {
    console.log('🚀 Testing ASIN Metrics Ingestion...');
    
    // ASIN B0DHD5BVVM is already in DB from previous tests
    const asinCode = 'B0DHD5BVVM';
    
    const dummyRawData = {
        asin: asinCode,
        title: 'Rushwak Premium Glass Oil Sprayer Bottle - Updated Title',
        Field2: '₹550', // Updated Price
        Field3: '₹1200', // Updated MRP
        Field14: 'Deal of the Day', // Deal Badge
        avg_rating: '4.7',
        Review_Count: '650 reviews',
        Field12: 'Rushwak Premium', // Brand
        image_count: '<li class="imageThumbnail">1</li><li class="imageThumbnail">2</li><li class="imageThumbnail">3</li><li class="videoThumbnail">V</li>',
        bullet_points: '<li>Improved Leak Proof Design</li><li>Food Grade Glass</li><li>500ML Capacity</li>',
        Field4: 'Home & Kitchen > Kitchen Tools', // Category
        A_plus: '<div class="aplus-v2">A+ Content Here</div>'
    };

    try {
        const pool = await getPool();
        const asinResult = await pool.request()
            .input('asin', asinCode)
            .query('SELECT Id FROM Asins WHERE AsinCode = @asin');
        
        if (asinResult.recordset.length === 0) {
            console.error('❌ ASIN not found in DB. Please run a migration first.');
            process.exit(1);
        }
        
        const asinId = asinResult.recordset[0].Id;
        
        console.log(`📡 Ingesting data for ASIN ${asinCode} (${asinId})...`);
        const success = await marketDataSyncService.updateAsinMetrics(asinId, dummyRawData);
        
        if (success) {
            console.log('✅ Ingestion successful. Verifying DB values...');
            const updated = await pool.request()
                .input('id', asinId)
                .query('SELECT * FROM Asins WHERE Id = @id');
            
            const row = updated.recordset[0];
            console.log('\n--- Updated DB Values ---');
            console.log(`- Title: ${row.Title}`);
            console.log(`- Brand: ${row.Brand}`);
            console.log(`- Price: ${row.CurrentPrice}`);
            console.log(`- MRP: ${row.Mrp}`);
            console.log(`- Rating: ${row.Rating}`);
            console.log(`- ScrapeStatus: ${row.ScrapeStatus}`);
            console.log(`- ImagesCount: ${row.ImagesCount}`);
            console.log(`- VideoCount: ${row.VideoCount}`);
            console.log(`- BulletPoints: ${row.BulletPoints}`);
        } else {
            console.log('❌ Ingestion failed.');
        }
    } catch (e) {
        console.error('❌ Error during test ingestion:', e);
    }
    process.exit(0);
}

testIngestion();
