const mongoose = require('mongoose');
const Asin = require('./backend/models/Asin');
require('dotenv').config();

async function repairAplusTimestamps() {
    try {
        console.log('🔄 Connecting to database for repair...');
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('🔍 Identifying ASINs with missing A+ timestamps...');
        const asins = await Asin.find({
            hasAplus: false,
            aplusAbsentSince: null
        });
        
        console.log(`Found ${asins.length} ASINs requiring update.`);
        
        let count = 0;
        for (const asin of asins) {
            // Set absent date to createdAt as a reasonable approximation
            asin.aplusAbsentSince = asin.createdAt || new Date();
            await asin.save();
            count++;
        }
        
        console.log(`✅ Successfully repaired ${count} ASINs.`);
        process.exit(0);
    } catch (err) {
        console.error('❌ Repair failed:', err.message);
        process.exit(1);
    }
}

repairAplusTimestamps();
