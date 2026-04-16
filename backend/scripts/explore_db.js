require('dotenv').config();
const mongoose = require('mongoose');

async function explore() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://jenil:jenilpatel@aiap.sedzp3h.mongodb.net/aiap?retryWrites=true&w=majority&appName=aiap';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to:', mongoose.connection.name);

    const cols = await mongoose.connection.db.listCollections().toArray();
    for (const col of cols) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      if (count > 0) {
        // Look for any document that has rating or bsr or asinCode
        const doc = await mongoose.connection.db.collection(col.name).findOne({
          $or: [
            { asinCode: { $exists: true } },
            { asin: { $exists: true } },
            { rating: { $exists: true } },
            { bsr: { $exists: true } },
            { currentPrice: { $exists: true } }
          ]
        });

        if (doc) {
          console.log(`\n💎 Found potential data in [${col.name}] (${count} docs)`);
          console.log('Sample Keys:', Object.keys(doc).join(', '));
          if (doc.asinCode) console.log('Sample asinCode:', doc.asinCode);
          if (doc.asin) console.log('Sample asin:', doc.asin);
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

explore();
