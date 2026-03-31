require('dotenv').config();
const mongoose = require('mongoose');
const MarketSyncService = require('./services/marketDataSyncService');
const Seller = require('./models/Seller');
const Asin = require('./models/Asin');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://jenil:jenilpatel@aiap.sedzp3h.mongodb.net/aiap?retryWrites=true&w=majority&appName=aiap';
const SELLER_NAME = 'Sakul Collection';
const TASK_ID = '4rq6i5c5vuu';

async function trigger() {
    try {
        console.log(`🚀 Starting Octoparse Ingestion for: ${SELLER_NAME}...`);
        
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected to MongoDB");

        const seller = await Seller.findOne({ name: SELLER_NAME });
        if (!seller) {
            console.error(`❌ Seller '${SELLER_NAME}' not found!`);
            process.exit(1);
        }
        console.log(`✅ Found Seller: ${seller.name} (${seller._id})`);

        if (seller.marketSyncTaskId !== TASK_ID) {
            seller.marketSyncTaskId = TASK_ID;
            await seller.save();
            console.log(`✅ Updated Seller Task ID to: ${TASK_ID}`);
        }

        // Try to fetch results directly using taskId (OpenAPI v1.0 usually returns latest non-exported)
        console.log(`📥 Fetching latest results for task: ${TASK_ID}`);
        const results = await MarketSyncService.retrieveResults(TASK_ID);
        
        if (!results || results.length === 0) {
            console.log("⚠️ No results found or data already exported. Please check Octoparse Task status.");
            process.exit(0);
        }

        console.log(`📊 Found ${results.length} items. Starting ingestion...`);
        
        let updatedCount = 0;
        let createdCount = 0;

        for (const item of results) {
            const asinCode = (item.ASIN || item.asin || item.asinCode || '').trim();
            if (!asinCode) continue;

            let asin = await Asin.findOne({ asinCode, seller: seller._id });

            if (!asin) {
                console.log(`✨ Discovering new ASIN: ${asinCode}`);
                asin = new Asin({
                    asinCode,
                    seller: seller._id,
                    status: 'Active',
                    scrapeStatus: 'PENDING',
                    marketplace: 'amazon.in'
                });
                await asin.save();
                createdCount++;
            }

            try {
                await MarketSyncService.updateAsinMetrics(asin._id, item);
                updatedCount++;
            } catch (err) {
                console.error(`❌ Failed to update ${asinCode}:`, err.message);
            }
        }

        console.log(`\n🎉 INGESTION COMPLETE!`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Ingestion Error:", error.message);
        process.exit(1);
    }
}

trigger();
