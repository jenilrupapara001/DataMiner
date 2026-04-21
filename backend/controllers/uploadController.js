const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const Monthly = require("../models/MonthlyPerformance");
const Master = require("../models/Master");
const AdsPerformance = require("../models/AdsPerformance");
const marketDataSyncService = require("../services/marketDataSyncService");

exports.uploadMonthlyData = async (req, res) => {
  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    const month = req.body.month; // Format: YYYY-MM
    const inserts = [];
    const errors = [];
    const skippedRecords = [];

    // Validate file structure
    const requiredColumns = ['ASIN', 'Ordered Revenue', 'Ordered Units'];
    const headers = Object.keys(jsonData[0] || {});
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];

      try {
        const asin = row["ASIN"];
        const revenue = parseFloat((row["Ordered Revenue"] || '0').toString().replace(/,/g, ""));
        const units = parseInt(row["Ordered Units"] || 0);

        // Validate ASIN exists
        const exists = await Master.findOne({ asin });
        if (!exists) {
          skippedRecords.push({
            index: index + 1,
            asin,
            reason: 'ASIN not found in master product data'
          });
          continue;
        }

        // Validate data types
        if (isNaN(revenue) || isNaN(units)) {
          skippedRecords.push({
            index: index + 1,
            asin,
            reason: 'Invalid numeric values'
          });
          continue;
        }

        // Check for existing record
        const existing = await Monthly.findOne({
          asin,
          month: new Date(`${month}-01`)
        });

        if (!existing) {
          inserts.push({
            asin,
            ordered_units: units,
            ordered_revenue: revenue,
            month: new Date(`${month}-01`)
          });
        } else {
          skippedRecords.push({
            index: index + 1,
            asin,
            reason: 'Record already exists'
          });
        }

      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error.message);
        errors.push({
          index: index + 1,
          asin: row["ASIN"],
          error: error.message
        });
      }
    }

    if (inserts.length > 0) {
      await Monthly.insertMany(inserts);
    }

    fs.unlinkSync(filePath);

    res.json({
      message: "Upload processed successfully",
      inserted: inserts.length,
      skipped: skippedRecords.length,
      errors: errors.length,
      details: {
        skippedRecords,
        errors
      }
    });

  } catch (err) {
    console.error("❌ Upload Error:", err);

    // Cleanup file if it exists
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupErr) {
        console.error("❌ File cleanup error:", cleanupErr);
      }
    }

    res.status(400).json({
      error: err.message || "Upload failed",
      code: err.code || "UPLOAD_ERROR"
    });
  }
};

exports.uploadAdsData = async (req, res) => {
  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // Use raw: true so XLSX doesn't auto-convert triple-quoted dates to serial numbers
    const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

    const reportType = req.body.reportType || 'daily'; // 'daily' or 'monthly'
    const reportDate = req.body.date; // For daily: YYYY-MM-DD, For monthly: YYYY-MM

    if (!reportDate) {
      throw new Error("Report date is required");
    }

    // Common column mappings (standard Amazon Ads reports + custom formats)
    const mappings = {
      asin: ['asin', 'Advertised ASIN', 'ASIN', 'metrics.asin'],
      sku: ['sku', 'Advertised SKU', 'SKU', 'metrics.sku'],
      spend: ['metrics.spend', 'Spend', 'ad_spend', 'Total Spend', 'spend'],
      sales: ['metrics.sales', '7 Day Total Sales', 'Total Sales', 'ad_sales', 'Sales', 'sales'],
      impressions: ['metrics.impressions', 'Impressions', 'impressions'],
      clicks: ['metrics.clicks', 'Clicks', 'clicks'],
      orders: ['metrics.orders', '7 Day Total Orders', 'Total Orders', 'orders'],
      date: ['date', 'Date', 'Day', 'metrics.date'],
      acos: ['metrics.acos', 'ACoS', 'acos'],
      roas: ['metrics.roas', 'ROAS', 'roas'],
      ctr: ['metrics.ctr', 'CTR', 'ctr'],
      aov: ['metrics.aov', 'AOV', 'aov'],
      cpc: ['metrics.cpc', 'CPC', 'cpc'],
      conversion_rate: ['metrics.conversion_rate', 'Conversion Rate', 'conversion_rate'],
      conversions: ['metrics.conversions', 'Conversions', 'conversions'],
      same_sku_sales: ['metrics.same_sku_sales', 'Same SKU Sales', 'same_sku_sales'],
      same_sku_orders: ['metrics.same_sku_orders', 'Same SKU Orders', 'same_sku_orders'],
      daily_budget: ['metrics.daily_budget', 'Daily Budget', 'daily_budget'],
      total_budget: ['metrics.total_budget', 'Total Budget', 'total_budget'],
      max_spend: ['metrics.max_spend', 'Max Spend', 'max_spend'],
      avg_spend: ['metrics.avg_spend', 'Avg Spend', 'avg_spend'],
      total_sales: ['metrics.total_sales', 'Total Sales', 'total_sales'],
      total_acos: ['metrics.total_acos', 'Total ACoS', 'total_acos'],
      total_units: ['metrics.total_units', 'Total Units', 'total_units'],
      organic_sales: ['metrics.organic_sales', 'Organic Sales', 'organic_sales'],
      organic_orders: ['metrics.organic_orders', 'Organic Orders', 'organic_orders'],
      page_views: ['metrics.page_views', 'Page Views', 'page_views'],
      ad_sales_perc: ['metrics.ad_sales_perc', 'Ad Sales %', 'ad_sales_perc'],
      tos_is: ['metrics.tos_is', 'TOS IS', 'tos_is'],
      sessions: ['metrics.sessions', 'Sessions', 'sessions'],
      buy_box_percentage: ['metrics.buy_box_percentage', 'Buy Box %', 'buy_box_percentage'],
      browser_sessions: ['metrics.browser_sessions', 'Browser Sessions', 'browser_sessions'],
      mobile_app_sessions: ['metrics.mobile_app_sessions', 'Mobile App Sessions', 'mobile_app_sessions']
    };

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
      if (!isNaN(cleaned) && Number(cleaned) > 10000) {
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + Number(cleaned) * 86400000);
        return d.toISOString().split('T')[0];
      }
      const shortMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (shortMatch) {
        let year = parseInt(shortMatch[3]);
        year = year < 100 ? 2000 + year : year;
        const month = shortMatch[1].padStart(2, '0');
        const day = shortMatch[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      const longMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (longMatch) {
        const month = longMatch[1].padStart(2, '0');
        const day = longMatch[2].padStart(2, '0');
        return `${longMatch[3]}-${month}-${day}`;
      }
      return cleaned;
    };

    const findValue = (row, fields) => {
      const keys = Object.keys(row);
      const lowerFields = fields.map(f => f.toLowerCase());
      const key = keys.find(k => lowerFields.includes(k.toLowerCase()));
      return key ? cleanValue(row[key]) : null;
    };

    const findDate = (row, fields) => {
      const keys = Object.keys(row);
      const lowerFields = fields.map(f => f.toLowerCase());
      const key = keys.find(k => lowerFields.includes(k.toLowerCase()));
      return key ? parseDate(row[key]) : null;
    };

    const operations = [];
    const errors = [];
    const skippedRecords = [];

    for (let index = 0; index < jsonData.length; index++) {
      const row = jsonData[index];
      try {
        const asin = findValue(row, mappings.asin);
        if (!asin) {
          skippedRecords.push({ index: index + 1, reason: 'ASIN column not found or empty' });
          continue;
        }

        const spendArr = [
          findValue(row, mappings.spend),
          findValue(row, ['spend', 'Spend', 'Ad Spend'])
        ];
        const spendStr = spendArr.find(v => v !== null) || '0';
        
        const salesArr = [
          findValue(row, mappings.sales),
          findValue(row, ['sales', 'Sales', 'Ad Sales'])
        ];
        const salesStr = salesArr.find(v => v !== null) || '0';

        const spend = parseFloat(spendStr.toString().replace(/,/g, "")) || 0;
        const sales = parseFloat(salesStr.toString().replace(/,/g, "")) || 0;
        const impressions = parseInt(findValue(row, mappings.impressions) || 0);
        const clicks = parseInt(findValue(row, mappings.clicks) || 0);
        const orders = parseInt(findValue(row, mappings.orders) || 0);
        const sku = findValue(row, mappings.sku);
        const rowDate = findDate(row, mappings.date);

        const getValue = (key) => {
          const v = findValue(row, mappings[key]);
          if (v === null || v === undefined) return 0;
          return parseFloat(v.toString().replace(/,/g, "")) || 0;
        };

        const updateData = {
          reportType,
          asin,
          advertised_sku: sku,
          ad_spend: spend,
          ad_sales: sales,
          impressions,
          clicks,
          orders,
          acos: getValue('acos'),
          roas: getValue('roas'),
          ctr: getValue('ctr'),
          aov: getValue('aov'),
          cpc: getValue('cpc'),
          conversion_rate: getValue('conversion_rate'),
          conversions: parseInt(findValue(row, mappings.conversions) || 0),
          same_sku_sales: getValue('same_sku_sales'),
          same_sku_orders: parseInt(findValue(row, mappings.same_sku_orders) || 0),
          daily_budget: getValue('daily_budget'),
          total_budget: getValue('total_budget'),
          max_spend: getValue('max_spend'),
          avg_spend: getValue('avg_spend'),
          total_sales: getValue('total_sales'),
          total_acos: getValue('total_acos'),
          total_units: parseInt(findValue(row, mappings.total_units) || 0),
          organic_sales: getValue('organic_sales'),
          organic_orders: parseInt(findValue(row, mappings.organic_orders) || 0),
          page_views: parseInt(findValue(row, mappings.page_views) || 0),
          ad_sales_perc: getValue('ad_sales_perc'),
          tos_is: getValue('tos_is'),
          sessions: parseInt(findValue(row, mappings.sessions) || 0),
          buy_box_percentage: getValue('buy_box_percentage'),
          browser_sessions: parseInt(findValue(row, mappings.browser_sessions) || 0),
          mobile_app_sessions: parseInt(findValue(row, mappings.mobile_app_sessions) || 0),
          uploaded_at: new Date()
        };

        const filter = { asin, reportType };
        if (reportType === 'daily') {
          const finalDate = rowDate || reportDate;
          if (!finalDate) throw new Error("Date is missing for daily report");
          const d = new Date(finalDate);
          filter.date = d;
          updateData.date = d;
        } else {
          const finalMonth = rowDate || reportDate;
          const monthDate = finalMonth.includes('-') && finalMonth.split('-').length === 2
            ? `${finalMonth}-01`
            : finalMonth;
          const m = new Date(monthDate);
          filter.month = m;
          updateData.month = m;
        }

        operations.push({
          updateOne: {
            filter,
            update: { $set: updateData },
            upsert: true
          }
        });

        if (operations.length >= 2000) {
          await AdsPerformance.bulkWrite(operations);
          operations.length = 0;
        }

      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error.message);
        errors.push({ index: index + 1, asin: row[Object.keys(row)[0]], error: error.message });
      }
    }

    if (operations.length > 0) {
      await AdsPerformance.bulkWrite(operations);
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({
      message: `Ads ${reportType} report processed successfully`,
      processed: jsonData.length - skippedRecords.length - errors.length,
      skipped: skippedRecords.length,
      errors: errors.length,
      details: { skippedRecords, errors }
    });

  } catch (err) {
    console.error("❌ Ads Upload Error:", err);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: err.message });
  }
};

/**
 * Handle manual Octoparse JSON data upload.
 * Maps Octoparse export data to dashboard ASIN metrics.
 */
exports.uploadOctoparseData = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const sellerId = req.body.sellerId;
    if (!sellerId) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, error: 'Seller ID is required for sync' });
    }

    const filePath = req.file.path;
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let jsonData;

    try {
      jsonData = JSON.parse(fileContent);
    } catch (parseError) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, error: 'Invalid JSON file format' });
    }

    // Process the data via MarketDataSyncService
    const result = await marketDataSyncService.processManualJsonSync(sellerId, jsonData);

    // Clean up uploaded file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: result.message,
      data: {
        updatedCount: result.updatedCount,
        totalProcessed: result.totalProcessed
      }
    });

  } catch (error) {
    console.error('❌ Octoparse Upload Error:', error.message);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process Octoparse data: ' + error.message 
    });
  }
};

// Get upload statistics
exports.getUploadStats = async (req, res) => {
  try {
    const stats = await Monthly.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$month" },
            month: { $month: "$month" }
          },
          records: { $sum: 1 },
          totalRevenue: { $sum: "$ordered_revenue" },
          totalUnits: { $sum: "$ordered_units" }
        }
      },
      {
        $sort: { "_id.year": -1, "_id.month": -1 }
      }
    ]);

    res.json(stats);
  } catch (error) {
    console.error("❌ Stats fetch error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};
