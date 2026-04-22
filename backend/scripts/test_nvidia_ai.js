require('dotenv').config({ path: '../.env' });
const nvidiaAiService = require('../services/nvidiaAiService');
const mongoose = require('mongoose');
const Asin = require('../models/Asin');

async function testAudit() {
    try {
        console.log('🚀 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected.');

        // Find an ASIN with an image
        const asin = await Asin.findOne({ mainImageUrl: { $exists: true, $ne: '' } });
        if (!asin) {
            console.error('❌ No ASIN with image found in DB.');
            process.exit(1);
        }

        console.log(`🔍 Testing AI Audit for ASIN: ${asin.asinCode}`);
        console.log(`🖼️ Image URL: ${asin.mainImageUrl}`);

        const results = await nvidiaAiService.auditAsinImage(asin._id);
        
        console.log('\n--- AUDIT RESULTS ---');
        console.log(JSON.stringify(results, null, 2));
        console.log('---------------------\n');

        if (results) {
            console.log('✅ AI Audit test successful.');
        } else {
            console.log('❌ AI Audit test failed (no results).');
        }

    } catch (err) {
        console.error('❌ Test failed:', err.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

testAudit();
