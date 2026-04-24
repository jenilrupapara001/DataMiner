const mongoose = require('mongoose');
require('dotenv').config({ path: './.env' });

async function cleanup() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected');

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📊 Collection Counts:');
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`- ${col.name}: ${count} documents`);
    }

    console.log('✨ Analysis complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Analysis failed:', err);
    process.exit(1);
  }
}

cleanup();
