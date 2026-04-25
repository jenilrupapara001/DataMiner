'use strict';

const { MongoClient } = require('mongodb');
const { sql, getPool } = require('../database/db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BATCH_SIZE = 500;               // rows per transaction
const REPORT_INTERVAL = 5000;         // progress update every 5k rows

// ---------- helper: escape value for SQL ----------
const esc = (val) => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    if (val instanceof Date) return `'${val.toISOString().replace(/'/g, "''")}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
};

/**
 * Full mapping from a MongoDB ASIN document to the SQL Asins columns.
 * Includes all fields used by the backend controllers and services.
 */
const mapToAsinFull = (doc) => {
    const now = new Date();
    return {
        // ----- identity & core -----
        Id: doc._id.toString(),
        AsinCode: doc.asinCode || '',
        SellerId: (doc.seller?._id || doc.seller || '').toString(),
        Sku: doc.sku || null,
        Status: (doc.status || 'Active').substring(0, 50),
        ScrapeStatus: (doc.scrapeStatus || 'PENDING').substring(0, 50),

        // ----- product info -----
        Category: (doc.category || '').substring(0, 255),
        Brand: (doc.brand || '').substring(0, 255),
        Title: doc.title || '',
        ImageUrl: doc.imageUrl || '',

        // ----- pricing & deals -----
        CurrentPrice: parseFloat(doc.currentPrice) || 0,
        Mrp: parseFloat(doc.mrp) || 0,
        DealBadge: doc.dealBadge || null,
        PriceType: doc.priceType || 'Standard Price',

        // ----- performance metrics -----
        BSR: parseInt(doc.bsr) || 0,
        Rating: parseFloat(doc.rating) || 0,
        ReviewCount: parseInt(doc.reviewCount) || 0,
        LQS: parseFloat(doc.lqs) || 0,
        LqsDetails: doc.lqsDetails ? JSON.stringify(doc.lqsDetails) : null,

        // ----- CDQ (Content Data Quality) -----
        Cdq: parseInt(doc.cdq) || 0,
        CdqGrade: doc.cdqGrade || null,
        CdqComponents: doc.cdqComponents ? JSON.stringify(doc.cdqComponents) : null,

        // ----- fees & rating breakdown -----
        FeePreview: doc.feePreview ? JSON.stringify(doc.feePreview) : null,
        RatingBreakdown: doc.ratingBreakdown ? JSON.stringify(doc.ratingBreakdown) : null,

        // ----- images & media -----
        Images: doc.images ? JSON.stringify(doc.images) : null,
        ImagesCount: parseInt(doc.imagesCount) || 0,
        VideoCount: parseInt(doc.videoCount) || 0,

        // ----- bullet points -----
        BulletPoints: parseInt(doc.bulletPoints) || 0,
        BulletPointsText: doc.bulletPointsText ? JSON.stringify(doc.bulletPointsText) : null,

        // ----- BSR details -----
        SubBsr: doc.subBsr || null,
        SubBSRs: doc.subBSRs ? JSON.stringify(doc.subBSRs) : null,

        // ----- stock & A+ content -----
        StockLevel: parseInt(doc.stockLevel) || 0,
        HasAplus: doc.hasAplus ? 1 : 0,
        AvailabilityStatus: doc.availabilityStatus || null,
        AplusAbsentSince: doc.aplusAbsentSince || null,
        AplusPresentSince: doc.aplusPresentSince || null,

        // ----- buy box / seller -----
        SoldBy: doc.soldBy || null,
        BuyBoxWin: doc.buyBoxWin ? 1 : 0,
        BuyBoxSellerId: doc.buyBoxSellerId || null,
        SecondAsp: parseFloat(doc.secondAsp) || 0,
        SoldBySec: doc.soldBySec || null,
        AspDifference: parseFloat(doc.aspDifference) || 0,
        AllOffers: doc.allOffers ? JSON.stringify(doc.allOffers) : null,

        // ----- additional optional fields -----
        StapleLevel: doc.stapleLevel || null,
        Weight: parseFloat(doc.weight) || 0,
        LossPerReturn: parseFloat(doc.lossPerReturn) || 0,
        BuyBoxStatus: doc.buyBoxStatus ? 1 : 0,

        // ----- timestamps -----
        LastScrapedAt: doc.lastScraped || doc.lastScrapedAt || null,
        CreatedAt: doc.createdAt || now,
        UpdatedAt: doc.updatedAt || now,

        // ============================================================
        //  NOTE: History / WeekHistory are stored in separate tables,
        //        so they are NOT included here.
        // ============================================================
    };
};

/**
 * Returns the names of all columns that currently exist in the Asins table.
 */
const getExistingAsinColumns = async (pool) => {
    const result = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Asins' AND TABLE_SCHEMA = 'dbo'
    `);
    return result.recordset.map(r => r.COLUMN_NAME);
};

/**
 * Main migration function.
 */
async function migrate() {
    const start = Date.now();
    console.log('🚀 Starting complete Asins migration...');

    // ---- connect to MongoDB ----
    const mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();
    const mongoDb = mongoClient.db();
    const pool = await getPool();
    console.log('✅ Connected to both databases.');

    // ---- 1) discover existing SQL columns ----
    const existingColumns = await getExistingAsinColumns(pool);
    console.log(`📋 Found ${existingColumns.length} columns in Asins table.`);

    // ---- 2) clean existing data (respect foreign keys) ----
    console.log('🧹 Clearing existing Asin data...');
    await pool.request().query(`
        DELETE FROM AsinWeekHistory;
        DELETE FROM AsinHistory;
        DELETE FROM Asins;
    `);

    // ---- 3) fetch documents from MongoDB ----
    const asinColl = mongoDb.collection('asins');
    const total = await asinColl.countDocuments();
    if (total === 0) {
        console.log('⚠️  No ASINs found. Exiting.');
        await mongoClient.close();
        return;
    }

    const cursor = asinColl.find({}).batchSize(BATCH_SIZE);
    let processed = 0;
    let lastReport = 0;

    console.log(`📦 Migrating ${total} ASINs in batches of ${BATCH_SIZE}...`);

    // ---- 4) process in batches ----
    while (await cursor.hasNext()) {
        const batch = [];
        for (let i = 0; i < BATCH_SIZE && await cursor.hasNext(); i++) {
            batch.push(await cursor.next());
        }
        if (batch.length === 0) continue;

        // map documents, then filter to only columns that exist in SQL
        const rows = batch
            .map(mapToAsinFull)
            .map(fullRow => {
                const filtered = {};
                for (const [key, value] of Object.entries(fullRow)) {
                    if (existingColumns.includes(key)) {
                        filtered[key] = value;
                    }
                }
                return filtered;
            });

        // all rows in the batch must have the same keys
        const cols = Object.keys(rows[0]);
        if (cols.length === 0) {
            // skip batch if no matching columns (should not happen)
            processed += batch.length;
            continue;
        }

        // build multi‑row INSERT
        const valueLines = rows.map(row =>
            '(' + cols.map(col => esc(row[col])).join(', ') + ')'
        );

        const insertSQL = `
            INSERT INTO Asins (${cols.map(c => `[${c}]`).join(', ')})
            VALUES ${valueLines.join(',\n')}
        `;

        // execute in a transaction
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            await new sql.Request(transaction).query(insertSQL);
            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            console.error(`\n❌ Batch failed (rows ${processed + 1}–${processed + batch.length}):`,
                err.message.substring(0, 200));
            // continue with next batch
        }

        processed += batch.length;

        // report progress periodically
        if (processed - lastReport >= REPORT_INTERVAL) {
            const pct = Math.round(processed / total * 100);
            console.log(`   ⏳ Asins: ${processed}/${total} (${pct}%)`);
            lastReport = processed;
        }
    }

    // final progress
    const pct = Math.round(processed / total * 100);
    console.log(`   ⏳ Asins: ${processed}/${total} (${pct}%)`);
    console.log('\n✅ Asins migration complete.');

    const elapsed = ((Date.now() - start) / 1000).toFixed(2);
    console.log(`   Time: ${elapsed}s`);

    await mongoClient.close();
    process.exit(0);
}

// ---- run ----
migrate().catch(err => {
    console.error('❌ CRITICAL ERROR:', err);
    process.exit(1);
});