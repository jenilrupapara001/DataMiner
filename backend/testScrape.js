require('dotenv').config();
const mongoose = require('mongoose');
const AutoScrapeScheduler = require('./cron/autoScrape');

async function testAutoScrape() {
    console.log('🔄 Connecting to MongoDB for AutoScrape Test...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/easysell', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log('✅ Connected.');

    const Asin = require('./models/Asin');
    const firstAsin = await Asin.findOne({ status: 'Active' });
    if (firstAsin) {
        firstAsin.lastScraped = null;
        await firstAsin.save();
        console.log(`⏱️ Reset lastScraped for ASIN ${firstAsin.asin} for testing.`);
    }

    console.log('🚀 Manually triggering runScrapeCycle()...');
    await AutoScrapeScheduler.runScrapeCycle();

    console.log('✅ Manual trigger complete. Closing connection.');
    await mongoose.connection.close();
    process.exit(0);
}

testAutoScrape();
