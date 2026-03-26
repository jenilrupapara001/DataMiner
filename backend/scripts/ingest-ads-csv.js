require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const AdsPerformance = require('../models/AdsPerformance');
const Master = require('../models/Master');

const FILE_PATH = "/Users/jenilrupapara/Easysell Projects/GMS Report/products__173DEEMOON__20260201-20260228__20260313113753_1dca188f-4963-432d-8620-650510671f44.csv";

async function run() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/easysell');
    console.log('✅ Connected.');

    if (!fs.existsSync(FILE_PATH)) {
      console.error('❌ File not found:', FILE_PATH);
      process.exit(1);
    }

    console.log('📖 Reading CSV...');
    const workbook = XLSX.readFile(FILE_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
    console.log(`📊 Total rows found: ${jsonData.length}`);

    const cleanValue = (val) => {
      if (val === null || val === undefined) return null;
      let cleaned = val.toString().trim();
      cleaned = cleaned.replace(/^"+|"+$/g, '');
      if (cleaned.toLowerCase() === 'none' || cleaned === '') return null;
      return cleaned;
    };

    const parseDate = (val) => {
      if (!val) return null;
      let cleaned = val.toString().trim().replace(/^"+|"+$/g, '');
      if (cleaned.toLowerCase() === 'none' || cleaned === '') return null;
      return new Date(cleaned);
    };

    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // We'll process in batches to be efficient
    const batchSize = 1000;
    let operations = [];

    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const asin = cleanValue(row['asin']);
        if (!asin) {
            skippedCount++;
            continue;
        }

        const date = parseDate(row['date']);
        if (!date) {
            skippedCount++;
            continue;
        }

        const getVal = (fields) => {
            for (let f of fields) {
                if (row[f] !== undefined) return cleanValue(row[f]);
            }
            return null;
        };

        const spend = parseFloat(getVal(['metrics.spend', 'spend', 'Spend']) || 0);
        const sales = parseFloat(getVal(['metrics.sales', 'sales', 'Sales']) || 0);
        const impressions = parseInt(getVal(['metrics.impressions', 'impressions', 'Impressions']) || 0);
        const clicks = parseInt(getVal(['metrics.clicks', 'clicks', 'Clicks']) || 0);
        const orders = parseInt(getVal(['metrics.orders', 'orders', 'Orders']) || 0);
        const sku = getVal(['sku', 'SKU', 'Advertised SKU']);

        const acos = parseFloat(getVal(['metrics.acos', 'acos', 'ACoS']) || 0);
        const roas = parseFloat(getVal(['metrics.roas', 'roas', 'ROAS']) || 0);
        const ctr = parseFloat(getVal(['metrics.ctr', 'ctr', 'CTR']) || 0);
        const aov = parseFloat(getVal(['metrics.aov', 'aov', 'AOV']) || 0);
        const cpc = parseFloat(getVal(['metrics.cpc', 'cpc', 'CPC']) || 0);
        const conv_rate = parseFloat(getVal(['metrics.conversion_rate', 'conversion_rate', 'Conversion Rate']) || 0);
        const conversions = parseInt(getVal(['metrics.conversions', 'conversions', 'Conversions']) || 0);

        const same_sku_sales = parseFloat(getVal(['metrics.same_sku_sales', 'same_sku_sales', 'Same SKU Sales']) || 0);
        const same_sku_orders = parseInt(getVal(['metrics.same_sku_orders', 'same_sku_orders', 'Same SKU Orders']) || 0);

        const total_sales = parseFloat(getVal(['metrics.total_sales', 'total_sales', 'Total Sales']) || 0);
        const total_acos = parseFloat(getVal(['metrics.total_acos', 'total_acos', 'Total ACoS']) || 0);
        const total_units = parseInt(getVal(['metrics.total_units', 'total_units', 'Total Units']) || 0);

        const organic_sales = parseFloat(getVal(['metrics.organic_sales', 'organic_sales', 'Organic Sales']) || 0);
        const organic_orders = parseInt(getVal(['metrics.organic_orders', 'organic_orders', 'Organic Orders']) || 0);

        const filter = { asin, date, reportType: 'daily' };
        const update = {
            $set: {
                advertised_sku: sku,
                ad_spend: spend,
                ad_sales: sales,
                impressions,
                clicks,
                orders,
                acos,
                roas,
                ctr,
                aov,
                cpc,
                conversion_rate: conv_rate,
                conversions,
                same_sku_sales,
                same_sku_orders,
                total_sales,
                total_acos,
                total_units,
                organic_sales,
                organic_orders,
                page_views: parseInt(cleanValue(row['metrics.page_views']) || 0),
                ad_sales_perc: parseFloat(cleanValue(row['metrics.ad_sales_perc']) || 0),
                tos_is: parseFloat(cleanValue(row['metrics.tos_is']) || 0),
                sessions: parseInt(cleanValue(row['metrics.sessions']) || 0),
                buy_box_percentage: parseFloat(cleanValue(row['metrics.buy_box_percentage']) || 0),
                browser_sessions: parseInt(cleanValue(row['metrics.browser_sessions']) || 0),
                mobile_app_sessions: parseInt(cleanValue(row['metrics.mobile_app_sessions']) || 0),
                uploaded_at: new Date()
            }
        };

        operations.push({
            updateOne: {
                filter,
                update,
                upsert: true
            }
        });

        if (operations.length >= batchSize) {
            try {
                await AdsPerformance.bulkWrite(operations);
                processedCount += operations.length;
                console.log(`🚀 Processed ${processedCount} rows...`);
                operations = [];
            } catch (err) {
                console.error('❌ Batch error:', err.message);
                errorCount += operations.length;
                operations = [];
            }
        }
    }

    if (operations.length > 0) {
        try {
            await AdsPerformance.bulkWrite(operations);
            processedCount += operations.length;
        } catch (err) {
            console.error('❌ Final batch error:', err.message);
            errorCount += operations.length;
        }
    }

    console.log('\n--- Final Comparison ---');
    console.log(`✅ Success: ${processedCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log(`❌ Errors:  ${errorCount}`);
    console.log('------------------------');

    process.exit(0);
  } catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
  }
}

run();
