const { MongoClient } = require('mongodb');
const { sql, getPool } = require('../database/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function migrateAsins() {
    console.log('🚀 Starting ASIN Migration (Batch Insert)...');
    
    if (!process.env.MONGO_URI) {
        console.error('❌ MONGO_URI not set');
        process.exit(1);
    }

    const mongoClient = new MongoClient(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        await mongoClient.connect();
        const mongoDb = mongoClient.db();
        const sqlPool = await getPool();

        console.log('✅ Connected to both databases.');

        // Clear existing ASINs
        console.log('🧹 Clearing Asins table...');
        await sqlPool.request().query('DELETE FROM Asins');

        const asinColl = mongoDb.collection('asins');
        const count = await asinColl.countDocuments();
        console.log(`📊 Found ${count} ASINs in MongoDB`);

        if (count === 0) {
            console.log('⚠️ No ASINs to migrate');
            return;
        }

        const cursor = asinColl.find({});
        const BATCH_SIZE = 100;
        let processed = 0;

        // Get table schema to ensure correct column order
        const schemaResult = await sqlPool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'Asins'
            ORDER BY ORDINAL_POSITION
        `);

        const columns = schemaResult.recordset
            .filter(col => col.COLUMN_NAME !== 'Id') // Skip identity
            .map(col => col.COLUMN_NAME);

        console.log(`📋 Target columns: ${columns.join(', ')}`);

        while (await cursor.hasNext()) {
            const batch = [];
            for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
                batch.push(await cursor.next());
            }

            const transaction = new sql.Transaction(sqlPool);
            await transaction.begin();

            try {
                for (const doc of batch) {
                    const now = new Date();
                    const values = [
                        doc._id.toString(),                                    // Id
                        doc.asinCode || doc.asin || '',                         // AsinCode
                        (doc.seller?._id || doc.sellerId || '').toString(),   // SellerId
                        (doc.status || 'Active').substring(0, 50),           // Status
                        (doc.scrapeStatus || 'Idle').substring(0, 50),       // ScrapeStatus
                        (doc.category || '').substring(0, 255),              // Category
                        (doc.brand || '').substring(0, 255),                 // Brand
                        doc.title || '',                                       // Title
                        doc.imageUrl || '',                                    // ImageUrl
                        parseFloat(doc.currentPrice) || 0,                    // CurrentPrice
                        parseInt(doc.bsr) || 0,                               // BSR
                        parseFloat(doc.rating) || 0,                          // Rating
                        parseInt(doc.reviewCount) || 0,                       // ReviewCount
                        parseFloat(doc.lqs) || 0,                             // LQS
                        doc.lqsDetails ? JSON.stringify(doc.lqsDetails) : null, // LqsDetails
                        doc.cdqComponents ? JSON.stringify(doc.cdqComponents) : null, // CdqComponents
                        doc.feePreview ? JSON.stringify(doc.feePreview) : null, // FeePreview
                        doc.buyBoxStatus ? 1 : 0,                             // BuyBoxStatus
                        doc.lastScrapedAt || null,                            // LastScrapedAt
                        now,                                                   // CreatedAt
                        now,                                                   // UpdatedAt
                        // Additional columns that exist in schema but not in MongoDB
                        '',                                                    // SubBsr
                        null,                                                  // SubBSRs
                        null,                                                  // Images
                        0,                                                     // ImagesCount
                        0,                                                     // VideoCount
                        null,                                                  // BulletPoints
                        '',                                                    // BulletPointsText
                        0,                                                     // StockLevel
                        '',                                                    // SoldBy
                        0,                                                     // BuyBoxWin
                        '',                                                    // BuyBoxSellerId
                        null,                                                  // SecondAsp
                        '',                                                    // SoldBySec
                        0,                                                     // AspDifference
                        0,                                                     // HasAplus
                        null,                                                  // AvailabilityStatus
                        null,                                                  // AplusAbsentSince
                        null,                                                  // AplusPresentSince
                        null,                                                  // AllOffers
                        '',                                                    // Sku
                        'Regular',                                             // StapleLevel
                        0,                                                     // Weight
                        0                                                      // LossPerReturn
                    ];

                    // Build parameter names: @p0, @p1, ... @n
                    const paramNames = values.map((_, i) => `@p${i}`);
                    const columnNames = columns.map(col => `[${col}]`);

                    const req = new sql.Request(transaction);
                    for (let i = 0; i < values.length; i++) {
                        const val = values[i];
                        if (val === null || val === undefined) {
                            // Skip NULL values - they'll be default
                            continue;
                        }
                        if (val instanceof Date) {
                            req.input(`p${i}`, sql.DateTime2, val);
                        } else if (typeof val === 'number') {
                            if (Number.isInteger(val)) {
                                req.input(`p${i}`, sql.Int, val);
                            } else {
                                req.input(`p${i}`, sql.Decimal(18, 4), val);
                            }
                        } else {
                            req.input(`p${i}`, sql.NVarChar, val.toString().substring(0, 4000));
                        }
                    }

                    // Build INSERT with only non-null columns for simplicity
                    const nonNullCols = [];
                    const nonNullParams = [];
                    for (let i = 0; i < columns.length; i++) {
                        if (values[i] !== null && values[i] !== undefined) {
                            nonNullCols.push(`[${columns[i]}]`);
                            nonNullParams.push(`@p${i}`);
                        }
                    }

                    const insertSQL = `
                        INSERT INTO Asins (${nonNullCols.join(', ')})
                        VALUES (${nonNullParams.join(', ')})
                    `;

                    await req.query(insertSQL);
                }

                await transaction.commit();
            } catch (err) {
                await transaction.rollback();
                console.error(`❌ Batch failed at ${processed} records:`, err.message);
                // Continue with next batch
                break; // Exit loop on error
            }

            processed += batch.length;
            const pct = Math.round((processed / count) * 100);
            process.stdout.write(`\r   ⏳ Progress: ${processed}/${count} (${pct}%)`);
        }

        console.log('\n✅ ASIN migration completed successfully!');
        console.log(`📊 Total migrated: ${processed} ASINs`);

    } catch (err) {
        console.error('\n❌ CRITICAL ERROR:', err);
    } finally {
        await mongoClient.close();
        process.exit(0);
    }
}

migrateAsins();
