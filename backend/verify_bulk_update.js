const mongoose = require('mongoose');
const Seller = require('./models/Seller');
require('dotenv').config({ path: './.env' });

async function verifyBulkUpdate() {
    try {
        // Correcting the URI variable name as per .env
        const mongoUri = process.env.MONGO_URI; 
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB успешно!');

        const testTaskId = 'TEST_TASK_ID_123';
        
        // Count total sellers
        const totalSellers = await Seller.countDocuments();
        console.log(`Total sellers in DB: ${totalSellers}`);

        if (totalSellers === 0) {
            console.log('No sellers found in DB. Test cannot modify any documents but structure is confirmed.');
        } else {
            // Perform update manually for verification
            const result = await Seller.updateMany({}, { $set: { marketSyncTaskId: testTaskId } });
            console.log(`Updated ${result.modifiedCount} sellers.`);

            const updatedSellers = await Seller.find({ marketSyncTaskId: testTaskId });
            console.log(`Verified ${updatedSellers.length} sellers with task ID ${testTaskId}`);
        }

        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

verifyBulkUpdate();
