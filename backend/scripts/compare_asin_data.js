'use strict';

const { MongoClient } = require('mongodb');
const { getPool, sql } = require('../database/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function compare() {
    const asinToMatch = 'B09SQ5QX4K';
    console.log(`🔍 Comparing data for ASIN: ${asinToMatch}`);

    // Connect to MongoDB
    const mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();
    const mongoDb = mongoClient.db();
    const mongoAsin = await mongoDb.collection('asins').findOne({ asinCode: asinToMatch });

    // Connect to SQL Server
    const pool = await getPool();
    const sqlAsinResult = await pool.request()
        .input('asin', sql.VarChar, asinToMatch)
        .query('SELECT * FROM Asins WHERE AsinCode = @asin');
    const sqlAsin = sqlAsinResult.recordset[0];

    console.log('\n--- MongoDB Data ---');
    if (mongoAsin) {
        console.log(JSON.stringify(mongoAsin, null, 2));
    } else {
        console.log('❌ ASIN not found in MongoDB');
    }

    console.log('\n--- SQL Server Data ---');
    if (sqlAsin) {
        console.log(JSON.stringify(sqlAsin, null, 2));
    } else {
        console.log('❌ ASIN not found in SQL Server');
    }

    await mongoClient.close();
    process.exit(0);
}

compare().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
