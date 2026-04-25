const { MongoClient } = require('mongodb');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function listCollections() {
    const client = new MongoClient(process.env.MONGO_URI);
    try {
        await client.connect();
        const db = client.db();
        const collections = await db.listCollections().toArray();
        console.log('Collections in Mongo:');
        collections.forEach(c => console.log(`- ${c.name}`));
    } catch (err) {
        console.error('Error listing collections:', err);
    } finally {
        await client.close();
    }
}

listCollections();
