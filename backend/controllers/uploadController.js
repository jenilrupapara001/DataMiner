const XLSX = require("xlsx");
const fs = require("fs");
const { sql, getPool, generateId, executeWithRetry } = require('../database/db');
const { buildInClause } = require('../utils/sqlHelpers');
const marketDataSyncService = require("../services/marketDataSyncService");
const SystemLogService = require('../services/SystemLogService');

// Helper: find a value in row by possible keys
const findValue = (row, fields) => {
  const keys = Object.keys(row);
  const lowerFields = fields.map(f => f.toLowerCase());
  const key = keys.find(k => lowerFields.includes(k.toLowerCase()));
  return key ? (row[key] ?? '').toString().trim() : null;
};

// Helper: parse date from various formats
const parseDate = (val) => {
    if (!val) return null;
    
    // 1. Handle Excel serial numeric dates
    if (typeof val === 'number' || (!isNaN(val) && Number(val) > 10000)) {
        const num = Number(val);
        const d = new Date(Date.UTC(1899, 11, 30));
        d.setDate(d.getDate() + Math.floor(num));
        const fractionalDay = num - Math.floor(num);
        const millisecondsInDay = 24 * 60 * 60 * 1000;
        d.setMilliseconds(d.getMilliseconds() + Math.round(fractionalDay * millisecondsInDay));
        return isNaN(d.getTime()) ? null : d;
    }
    
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    
    let cleaned = val.toString().trim().replace(/^"+|"+$/g, '');
    if (!cleaned || cleaned.toLowerCase() === 'none') return null;
    
    // 2. Standard ISO Matches (YYYY-MM-DD)
    const isoMatch = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1]);
        const month = parseInt(isoMatch[2]) - 1;
        const day = parseInt(isoMatch[3]);
        const d = new Date(Date.UTC(year, month, day));
        if (!isNaN(d.getTime())) return d;
    }
    
    // 3. Generic Delimited Format: DD/MM/YY, MM/DD/YYYY, etc.
    const match = cleaned.match(/^(\d{1,4})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (match) {
        let part1 = parseInt(match[1]);
        let part2 = parseInt(match[2]);
        let part3 = parseInt(match[3]);
        
        let year, month, day;
        
        if (part1 > 31) {
            year = part1; month = part2; day = part3;
        } else if (part3 > 31 || match[3].length === 4) {
            year = part3;
            if (part1 > 12) { day = part1; month = part2; }
            else if (part2 > 12) { month = part1; day = part2; }
            else { day = part1; month = part2; } // Priority to DD/MM
        } else {
            year = part3 < 50 ? 2000 + part3 : 1900 + part3;
            if (part1 > 12) { day = part1; month = part2; }
            else if (part2 > 12) { month = part1; day = part2; }
            else { day = part1; month = part2; } 
        }
        
        const d = new Date(Date.UTC(year, month - 1, day));
        if (!isNaN(d.getTime())) return d;
    }
    
    const fallback = new Date(cleaned);
    return isNaN(fallback.getTime()) ? null : fallback;
};

exports.uploadMonthlyData = async (req, res) => {
  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const month = req.body.month; // 'YYYY-MM'
    const pool = await getPool();

    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    const skippedRecords = [];

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        try {
          const asin = findValue(row, ['ASIN', 'asin', 'Jio Code', 'jio_code', 'jiocode']);
          const revenue = parseFloat((findValue(row, ['Ordered Revenue', 'ordered_revenue']) || '0').replace(/,/g, ''));
          const units = parseInt(findValue(row, ['Ordered Units', 'ordered_units']) || '0');

          if (!asin || isNaN(revenue) || isNaN(units)) {
            skipped++;
            skippedRecords.push({ index: i + 1, reason: 'Missing/invalid data' });
            continue;
          }

          // Check if ASIN exists in Asins table
          const asinCheck = await transaction.request()
            .input('asinCode', sql.VarChar, asin)
            .query('SELECT Id FROM Asins WHERE AsinCode = @asinCode');
          if (asinCheck.recordset.length === 0) {
            skipped++;
            skippedRecords.push({ index: i + 1, asin, reason: 'ASIN not found in master' });
            continue;
          }

          // Check duplicate for this month
          const existing = await transaction.request()
            .input('asin', sql.VarChar, asin)
            .input('month', sql.Date, new Date(`${month}-01T00:00:00Z`))
            .query('SELECT Id FROM MonthlyPerformance WHERE Asin = @asin AND Month = @month');
          if (existing.recordset.length > 0) {
            skipped++;
            skippedRecords.push({ index: i + 1, asin, reason: 'Record already exists' });
            continue;
          }

          const id = generateId();
          await transaction.request()
            .input('id', sql.VarChar, id)
            .input('asin', sql.VarChar, asin)
            .input('month', sql.Date, new Date(`${month}-01T00:00:00Z`))
            .input('units', sql.Int, units)
            .input('revenue', sql.Decimal(18, 2), revenue)
            .query(`
              INSERT INTO MonthlyPerformance (Id, Asin, Month, OrderedUnits, OrderedRevenue)
              VALUES (@id, @asin, @month, @units, @revenue)
            `);
          inserted++;
        } catch (e) {
          errors++;
          console.error(`Row ${i + 1} error:`, e.message);
        }
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    fs.unlinkSync(filePath);

    // Log activity
    await SystemLogService.log({
      type: 'IMPORT',
      entityType: 'MONTHLY_DATA',
      user: req.user?._id || req.userId,
      description: `Uploaded monthly data report for ${month}`,
      metadata: { inserted, skipped, errors }
    });

    res.json({
      success: true,
      inserted,
      skipped,
      errors,
      details: { skippedRecords }
    });
  } catch (err) {
    console.error("❌ Upload Error:", err);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
};

exports.uploadAdsData = async (req, res) => {
  let filePath = null;
  let tempTableName = null;
  const pool = await getPool();

  try {
    if (!req.file) throw new Error('No file uploaded');
    filePath = req.file.path;
    
    const isCSV = filePath.toLowerCase().endsWith('.csv');
    let workbook = XLSX.readFile(filePath, isCSV ? { raw: true } : {});
    let sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
    // Free large workbook objects immediately to avoid memory retention
    sheet = null;
    workbook = null;

    const reportType = req.body.reportType || 'daily';
    const reportDate = req.body.date;
    if (!reportDate) throw new Error('Report date is required');

    // Standardized column specification matching database inspection
    const columnsList = [
      { name: 'Asin', type: sql.VarChar(50), required: true },
      { name: 'AdvertisedSku', type: sql.VarChar(255) },
      { name: 'Date', type: sql.Date },
      { name: 'Month', type: sql.Date },
      { name: 'ReportType', type: sql.VarChar(20), required: true },
      { name: 'AdSpend', type: sql.Decimal(18, 2) },
      { name: 'AdSales', type: sql.Decimal(18, 2) },
      { name: 'Impressions', type: sql.Int },
      { name: 'Clicks', type: sql.Int },
      { name: 'Orders', type: sql.Int },
      { name: 'ACoS', type: sql.Decimal(18, 4) },
      { name: 'RoAS', type: sql.Decimal(18, 4) },
      { name: 'CTR', type: sql.Decimal(18, 4) },
      { name: 'CPC', type: sql.Decimal(18, 4) },
      { name: 'ConversionRate', type: sql.Decimal(18, 4) },
      { name: 'OrganicSales', type: sql.Decimal(18, 2) },
      { name: 'OrganicOrders', type: sql.Int },
      { name: 'Sessions', type: sql.Int },
      { name: 'Conversions', type: sql.Int },
      { name: 'SameSkuSales', type: sql.Decimal(18, 2) },
      { name: 'SameSkuOrders', type: sql.Int },
      { name: 'DailyBudget', type: sql.Decimal(18, 2) },
      { name: 'TotalBudget', type: sql.Decimal(18, 2) },
      { name: 'MaxSpend', type: sql.Decimal(18, 2) },
      { name: 'AvgSpend', type: sql.Decimal(18, 2) },
      { name: 'TotalSales', type: sql.Decimal(18, 2) },
      { name: 'TotalAcos', type: sql.Decimal(18, 2) },
      { name: 'TotalUnits', type: sql.Int },
      { name: 'PageViews', type: sql.Int },
      { name: 'AdSalesPerc', type: sql.Decimal(18, 4) },
      { name: 'TosIs', type: sql.Decimal(18, 4) },
      { name: 'Aov', type: sql.Decimal(18, 2) },
      { name: 'BuyBoxPercentage', type: sql.Decimal(18, 4) },
      { name: 'BrowserSessions', type: sql.Int },
      { name: 'MobileAppSessions', type: sql.Int }
    ];

    // Generate collision-proof global temp table name to traverse pool connection barriers
    tempTableName = `##TempAds_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Explicit, durable type mapping to defend against runtime serialization drifts
    const colDefs = columnsList.map(col => {
      let typeStr = 'NVARCHAR(MAX)'; // Safe fallback
      if (col.type === sql.Int) {
        typeStr = 'INT';
      } else if (col.type === sql.Date) {
        typeStr = 'DATE';
      } else if (col.type.type === sql.VarChar) {
        typeStr = `VARCHAR(${col.type.length || 255})`;
      } else if (col.type.type === sql.Decimal) {
        typeStr = `DECIMAL(${col.type.precision || 18}, ${col.type.scale || 4})`;
      }
      return `[${col.name}] ${typeStr} ${col.required ? 'NOT NULL' : 'NULL'}`;
    }).join(', ');

    // Initialize DB Table Structure
    await pool.request().query(`CREATE TABLE ${tempTableName} (${colDefs})`);

    // Prepare client-side Bulk Insertion engine
    const table = new sql.Table(tempTableName);
    columnsList.forEach(c => table.columns.add(c.name, c.type, { nullable: !c.required }));

    // Utilize a map to deduplicate spreadsheet rows to obey strict atomicity constraints
    const uniqueRowMap = new Map();
    let skippedCount = 0;

    for (const row of jsonData) {
      let asin = findValue(row, ['asin', 'Advertised ASIN', 'ASIN', 'Jio Code', 'jio_code']);
      if (!asin) { skippedCount++; continue; }
      asin = asin.replace(/^"+|"+$/g, ''); 

      let sku = findValue(row, ['sku', 'SKU', 'Advertised SKU']);
      if (sku) sku = sku.replace(/^"+|"+$/g, '');

      const dateVal = findValue(row, ['date', 'Date', 'Day', 'Released Date', 'Realeased date', 'release_date', 'released_date']);
      const parsedDate = parseDate(dateVal) || parseDate(reportDate);
      
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        skippedCount++;
        continue;
      }

      const parseNum = (val) => {
        if (!val) return 0;
        const cleaned = val.toString().replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      };

      const spend = parseNum(findValue(row, ['spend', 'Spend', 'ad_spend', 'metrics.spend']));
      const sales = parseNum(findValue(row, ['sales', 'Sales', 'ad_sales', 'metrics.sales']));
      const impressions = Math.floor(parseNum(findValue(row, ['impressions', 'Impressions', 'metrics.impressions'])));
      const clicks = Math.floor(parseNum(findValue(row, ['clicks', 'Clicks', 'metrics.clicks'])));
      const orders = Math.floor(parseNum(findValue(row, ['orders', 'Orders', 'metrics.orders'])));

      const conversions = Math.floor(parseNum(findValue(row, ['conversions', 'Conversions', 'metrics.conversions'])));
      const sameSkuSales = parseNum(findValue(row, ['same_sku_sales', 'SameSkuSales', 'metrics.same_sku_sales']));
      const sameSkuOrders = Math.floor(parseNum(findValue(row, ['same_sku_orders', 'SameSkuOrders', 'metrics.same_sku_orders'])));
      const dailyBudget = parseNum(findValue(row, ['daily_budget', 'DailyBudget', 'metrics.daily_budget']));
      const totalBudget = parseNum(findValue(row, ['total_budget', 'TotalBudget', 'metrics.total_budget']));
      const maxSpend = parseNum(findValue(row, ['max_spend', 'MaxSpend', 'metrics.max_spend']));
      const avgSpend = parseNum(findValue(row, ['avg_spend', 'AvgSpend', 'metrics.avg_spend']));
      const totalSales = parseNum(findValue(row, ['total_sales', 'TotalSales', 'metrics.total_sales']));
      const totalAcos = parseNum(findValue(row, ['total_acos', 'TotalAcos', 'metrics.total_acos']));
      const totalUnits = Math.floor(parseNum(findValue(row, ['total_units', 'TotalUnits', 'metrics.total_units'])));
      const organicSales = parseNum(findValue(row, ['organic_sales', 'OrganicSales', 'metrics.organic_sales']));
      const organicOrders = Math.floor(parseNum(findValue(row, ['organic_orders', 'OrganicOrders', 'metrics.organic_orders'])));
      const pageViews = Math.floor(parseNum(findValue(row, ['page_views', 'PageViews', 'metrics.page_views'])));
      const adSalesPerc = parseNum(findValue(row, ['ad_sales_perc', 'AdSalesPerc', 'metrics.ad_sales_perc']));
      const tosIs = parseNum(findValue(row, ['tos_is', 'TosIs', 'metrics.tos_is']));
      const aov = parseNum(findValue(row, ['aov', 'Aov', 'metrics.aov']));
      const sessions = Math.floor(parseNum(findValue(row, ['sessions', 'Sessions', 'metrics.sessions'])));
      const buyBoxPercentage = parseNum(findValue(row, ['buy_box_percentage', 'BuyBoxPercentage', 'metrics.buy_box_percentage']));
      const browserSessions = Math.floor(parseNum(findValue(row, ['browser_sessions', 'BrowserSessions', 'metrics.browser_sessions'])));
      const mobileAppSessions = Math.floor(parseNum(findValue(row, ['mobile_app_sessions', 'MobileAppSessions', 'metrics.mobile_app_sessions'])));

      const acos = sales > 0 ? (spend / sales) * 100 : 0;
      const roas = spend > 0 ? sales / spend : 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const conversionRate = clicks > 0 ? (orders / clicks) * 100 : 0;

      let targetDate = null;
      let targetMonth = null;
      let compositeKey = '';

      if (reportType === 'daily') {
        targetDate = parsedDate;
        targetMonth = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), 1));
        // Unique string format for consistency
        compositeKey = `${asin}|daily|${targetDate.toISOString().split('T')[0]}`;
      } else {
        targetMonth = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), 1));
        compositeKey = `${asin}|monthly|${targetMonth.toISOString().split('T')[0]}`;
      }

      // Add/Overwrite payload to fulfill the "Last Wins" semantics safely before streaming
      uniqueRowMap.set(compositeKey, [
        asin, sku, targetDate, targetMonth, reportType,
        spend, sales, impressions, clicks, orders,
        acos, roas, ctr, cpc, conversionRate,
        organicSales, organicOrders, sessions,
        conversions, sameSkuSales, sameSkuOrders,
        dailyBudget, totalBudget, maxSpend, avgSpend,
        totalSales, totalAcos, totalUnits,
        pageViews, adSalesPerc, tosIs, aov,
        buyBoxPercentage, browserSessions, mobileAppSessions
      ]);
    }

    // Populate memory Table with non-duplicate unique rows
    for (const values of uniqueRowMap.values()) {
      table.rows.add(...values);
    }

    const uniqueCount = uniqueRowMap.size;

    // High-Throughput Database Streaming and Atomic Ingestion
    if (uniqueCount > 0) {
      // Direct Server Memory-to-Memory push
      await pool.request().bulk(table);

      // Resolve targetSellerId to auto-heal missing ASINs in master table
      let targetSellerId = req.body.sellerId || req.body.selectedSeller || req.body.seller;
      if (!targetSellerId) {
        const sellerCheck = await pool.request().query(`
          SELECT TOP 1 a.SellerId
          FROM Asins a
          INNER JOIN (
            SELECT DISTINCT Asin FROM ${tempTableName}
          ) t ON a.AsinCode = t.Asin
          GROUP BY a.SellerId
          ORDER BY COUNT(*) DESC
        `);
        if (sellerCheck.recordset.length > 0) {
          targetSellerId = sellerCheck.recordset[0].SellerId;
        } else {
          const defaultSeller = await pool.request().query("SELECT TOP 1 Id FROM Sellers ORDER BY CreatedAt DESC");
          if (defaultSeller.recordset.length > 0) {
            targetSellerId = defaultSeller.recordset[0].Id;
          }
        }
      }

      // Auto-create skeleton rows in Asins for any advertised ASINs not in master table
      if (targetSellerId) {
        await pool.request()
          .input('sellerId', sql.VarChar, targetSellerId)
          .query(`
            INSERT INTO Asins (Id, AsinCode, SellerId, Status, ScrapeStatus, Ads, CreatedAt, UpdatedAt)
            SELECT 
              SUBSTRING(LOWER(REPLACE(CAST(NEWID() AS VARCHAR(36)), '-', '')), 1, 24) AS Id,
              t.AsinCode,
              @sellerId AS SellerId,
              'Active' AS Status,
              'Pending' AS ScrapeStatus,
              1 AS Ads,
              dbo.GetEnvDate() AS CreatedAt,
              dbo.GetEnvDate() AS UpdatedAt
            FROM (
              SELECT DISTINCT Asin AS AsinCode FROM ${tempTableName}
            ) t
            LEFT JOIN Asins existing ON t.AsinCode = existing.AsinCode
            WHERE existing.AsinCode IS NULL
          `);
      }

      // Dynamic mapping for MERGE operation to preserve safety against manual mapping drift
      const updateCols = columnsList
        .filter(c => !['Asin', 'Date', 'Month', 'ReportType'].includes(c.name))
        .map(c => `T.[${c.name}] = S.[${c.name}]`)
        .join(', ');

      const insertColNames = columnsList.map(c => `[${c.name}]`).join(', ');
      const insertColVals = columnsList.map(c => `S.[${c.name}]`).join(', ');

      const matchClause = reportType === 'daily'
        ? `T.Asin = S.Asin AND T.ReportType = 'daily' AND T.[Date] = S.[Date]`
        : `T.Asin = S.Asin AND T.ReportType = 'monthly' AND T.[Month] = S.[Month]`;

      // Perform Atomic Unit-of-Work UPSERT across all rows simultaneously
      await executeWithRetry(async () => {
        await pool.request().query(`
          MERGE AdsPerformance WITH (HOLDLOCK) AS T
          USING ${tempTableName} AS S
          ON (${matchClause})
          WHEN MATCHED THEN
            UPDATE SET ${updateCols}, T.UploadedAt = dbo.GetEnvDate()
          WHEN NOT MATCHED THEN
            INSERT (${insertColNames}, UploadedAt)
            VALUES (${insertColVals}, dbo.GetEnvDate());
        `);
      });

      // 3. Mark Asins as having Ads
      await pool.request().query(`
        -- Update Child ASINs directly advertised
        UPDATE Asins 
        SET Ads = 1 
        WHERE AsinCode IN (SELECT DISTINCT Asin FROM ${tempTableName})
          AND (Ads IS NULL OR Ads = 0);

        -- Update Parent ASINs if any of their children are advertised
        UPDATE p
        SET p.Ads = 1
        FROM Asins p
        INNER JOIN Asins c ON p.AsinCode = c.ParentAsin
        WHERE c.AsinCode IN (SELECT DISTINCT Asin FROM ${tempTableName})
          AND (p.Ads IS NULL OR p.Ads = 0);
      `);
    }

    res.json({
      success: true,
      processed: uniqueCount,
      skipped: skippedCount,
      duplicatesCondensed: jsonData.length - uniqueCount - skippedCount,
      errors: 0
    });

  } catch (err) {
    console.error("❌ HighPerformance Ads Upload Failed:", err);
    res.status(500).json({ 
      error: "Advertising ingestion pipeline error", 
      details: err.message 
    });
  } finally {
    // Safeguarded resource release guarantees no leakage regardless of failure vector
    if (tempTableName) {
      try { 
        await pool.request().query(`IF OBJECT_ID('tempdb..${tempTableName}') IS NOT NULL DROP TABLE ${tempTableName}`);
      } catch(e) {}
    }
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
};

exports.uploadOctoparseData = async (req, res) => {
  try {
    const filePath = req.file.path;
    const sellerId = req.body.sellerId;

    if (!sellerId) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: "Seller ID is required for Octoparse upload" });
    }

    const ext = filePath.toLowerCase().split('.').pop();
    let rawDataArray = [];

    if (ext === 'txt' || ext === 'text' || ext === 'csv') {
      // Handle raw tab-delimited format
      const fileContent = fs.readFileSync(filePath, 'utf8');
      // Split by double newline (each entry separated by blank line)
      rawDataArray = fileContent.split(/\n\s*\n/).filter(entry => entry.trim().length > 0);
    } else if (ext === 'json') {
      // JSON array or wrapped object
      const fileContent = fs.readFileSync(filePath, 'utf8');
      let jsonData = JSON.parse(fileContent);
      
      if (!Array.isArray(jsonData) && jsonData && typeof jsonData === 'object') {
        // Look for array properties like data, records, list, results, etc.
        const arrayProp = Object.values(jsonData).find(v => Array.isArray(v));
        if (arrayProp) {
          jsonData = arrayProp;
        } else if (jsonData.data && Array.isArray(jsonData.data)) {
          jsonData = jsonData.data;
        } else if (jsonData.records && Array.isArray(jsonData.records)) {
          jsonData = jsonData.records;
        } else if (jsonData.list && Array.isArray(jsonData.list)) {
          jsonData = jsonData.list;
        } else if (jsonData.results && Array.isArray(jsonData.results)) {
          jsonData = jsonData.results;
        }
      }
      
      rawDataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
    } else {
      // Excel format
      let workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      let sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      // Free large workbook objects immediately to avoid memory retention
      sheet = null;
      workbook = null;
      rawDataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
    }

    console.log(`📊 Octoparse upload: Processing ${rawDataArray.length} records for seller ${sellerId}`);

    // If raw text format, parse into objects first
    if (ext === 'txt' || ext === 'text' || ext === 'csv') {
      const AsinDataParser = require('../services/asinDataParser');
      rawDataArray = rawDataArray.map(entry => AsinDataParser.parseRawData(entry));
    }

    // Use unified ingestion pipeline for consistent mapping and tracking
    const batchResult = await marketDataSyncService.processBatchResults(sellerId, rawDataArray);

    const successCount = batchResult.updatedCount || 0;
    const errorCount = (batchResult.skippedNoCode || 0) + (batchResult.skippedNoMatch || 0);

    // Update seller scrape stats
    const pool = await getPool();
    await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .input('count', sql.Int, successCount)
      .query(`
        UPDATE Sellers
        SET ScrapeUsed = ScrapeUsed + @count,
            LastScrapedAt = dbo.GetEnvDate(),
            UpdatedAt = dbo.GetEnvDate()
        WHERE Id = @sellerId
      `);

    // Cleanup
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Processed ${rawDataArray.length} entries`,
      stats: {
        total: rawDataArray.length,
        success: successCount,
        failed: errorCount,
        skippedNoCode: batchResult.skippedNoCode,
        skippedNoMatch: batchResult.skippedNoMatch
      }
    });
  } catch (err) {
    console.error("❌ Octoparse Upload Error:", err);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
};

exports.getUploadStats = async (req, res) => {
  try {
    const pool = await getPool();
    const stats = await pool.request().query(`
      SELECT
        Year(Month) as year,
        Month(Month) as month,
        COUNT(*) as records,
        SUM(OrderedRevenue) as totalRevenue,
        SUM(OrderedUnits) as totalUnits
      FROM MonthlyPerformance
      GROUP BY Year(Month), Month(Month)
      ORDER BY year DESC, month DESC
    `);
    res.json(stats.recordset);
  } catch (error) {
    console.error("❌ Stats fetch error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

exports.uploadAsinMapping = async (req, res) => {
  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let inserted = 0;

    try {
      for (const row of data) {
        const parent = findValue(row, ['ParentAsin', 'Parent', 'Parent ASIN', 'Parent_ASIN', 'ParentASIN', 'Parent_Code', 'ParentCode']);
        const child = findValue(row, ['ChildAsin', 'Child', 'Child ASIN', 'ASIN', 'asin', 'child_asin', 'asinCode', 'Jio Code', 'jio_code']);

        if (!parent || !child) continue;

        await transaction.request()
          .input('parent', sql.VarChar, parent)
          .input('child', sql.VarChar, child)
          .query(`
            UPDATE Asins 
            SET ParentAsin = @parent, UpdatedAt = dbo.GetEnvDate() 
            WHERE AsinCode = @child
          `);
        inserted++;
      }
      await transaction.commit();
      
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.json({ success: true, inserted });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error("❌ ASIN Mapping Upload Error:", err);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
};

exports.uploadGmsData = async (req, res) => {
  let filePath = null;
  let tempTableName = null;
  const pool = await getPool();

  try {
    if (!req.file) throw new Error('No file uploaded');
    filePath = req.file.path;
    
    const isCSV = filePath.toLowerCase().endsWith('.csv');
    let workbook = XLSX.readFile(filePath, isCSV ? { raw: true } : {});
    let sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
    sheet = null;
    workbook = null;

    const reportDate = req.body.date; // 'YYYY-MM-DD'
    if (!reportDate) throw new Error('Date is required');

    const userRole = req.user.role?.name || req.user.role;
    const isGlobalUser = ['admin', 'super_admin', 'developer', 'operational_manager'].includes(userRole);
    let allowedAsins = null;

    if (!isGlobalUser) {
      const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
      if (assignedSellerIds.length === 0) {
        throw new Error('You do not have any assigned sellers.');
      }
      const req = pool.request();
      const inClause = buildInClause(req, 'sellerId', assignedSellerIds);
      const allowedAsinsResult = await req.query(`SELECT AsinCode FROM Asins WHERE SellerId IN (${inClause})`);
      allowedAsins = new Set(allowedAsinsResult.recordset.map(r => r.AsinCode.toUpperCase()));
    }

    const columnsList = [
      { name: 'Asin', type: sql.VarChar(50), required: true },
      { name: 'Date', type: sql.Date, required: true },
      { name: 'Brand', type: sql.NVarChar(255) },
      { name: 'StoreCode', type: sql.NVarChar(50) },
      { name: 'OrderedRevenue', type: sql.Decimal(18, 2) },
      { name: 'OrderedUnits', type: sql.Int },
      { name: 'ShippedRevenue', type: sql.Decimal(18, 2) },
      { name: 'ShippedCOGS', type: sql.Decimal(18, 2) },
      { name: 'ShippedUnits', type: sql.Int },
      { name: 'CustomerReturns', type: sql.Int }
    ];

    tempTableName = `##TempGms_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const colDefs = columnsList.map(col => {
      let typeStr = 'NVARCHAR(MAX)';
      if (col.type === sql.Int) {
        typeStr = 'INT';
      } else if (col.type === sql.Date) {
        typeStr = 'DATE';
      } else if (col.type.type === sql.VarChar) {
        typeStr = `VARCHAR(${col.type.length || 255})`;
      } else if (col.type.type === sql.Decimal) {
        typeStr = `DECIMAL(${col.type.precision || 18}, ${col.type.scale || 4})`;
      } else if (col.type.type === sql.NVarChar) {
        typeStr = `NVARCHAR(${col.type.length || 255})`;
      }
      return `[${col.name}] ${typeStr} ${col.required ? 'NOT NULL' : 'NULL'}`;
    }).join(', ');

    await pool.request().query(`CREATE TABLE ${tempTableName} (${colDefs})`);

    const table = new sql.Table(tempTableName);
    columnsList.forEach(c => table.columns.add(c.name, c.type, { nullable: !c.required }));

    const uniqueRowMap = new Map();
    let skippedCount = 0;

    for (const row of jsonData) {
      let asin = findValue(row, ['asin', 'ASIN', 'Jio Code', 'jio_code', 'jiocode']);
      if (!asin) { skippedCount++; continue; }
      asin = asin.replace(/^"+|"+$/g, '').trim().toUpperCase();

      if (allowedAsins && !allowedAsins.has(asin)) {
        skippedCount++;
        continue;
      }

      const parseNum = (val) => {
        if (!val) return 0;
        const cleaned = val.toString().replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      };

      const brand = findValue(row, ['brand', 'Brand', 'Seller Name', 'Seller']) || 'Generic';
      const storeCode = findValue(row, ['storecode', 'store code', 'store_code', 'marketplace']) || 'IN';
      const orderedRevenue = parseNum(findValue(row, ['ordered revenue', 'ordered_revenue', 'revenue']));
      const orderedUnits = Math.floor(parseNum(findValue(row, ['ordered units', 'ordered_units', 'units'])));
      const shippedRevenue = parseNum(findValue(row, ['shipped revenue', 'shipped_revenue']));
      const shippedCOGS = parseNum(findValue(row, ['shipped cogs', 'shipped_cogs', 'cogs']));
      const shippedUnits = Math.floor(parseNum(findValue(row, ['shipped units', 'shipped_units'])));
      const customerReturns = Math.floor(parseNum(findValue(row, ['customer returns', 'customer_returns', 'returns'])));

      const parsedDate = parseDate(reportDate);

      const compositeKey = `${asin}|${reportDate}`;
      uniqueRowMap.set(compositeKey, [
        asin, parsedDate, brand, storeCode,
        orderedRevenue, orderedUnits, shippedRevenue,
        shippedCOGS, shippedUnits, customerReturns
      ]);
    }

    for (const values of uniqueRowMap.values()) {
      table.rows.add(...values);
    }

    const uniqueCount = uniqueRowMap.size;

    if (uniqueCount > 0) {
      await pool.request().bulk(table);

      // Perform atomic MERGE / UPSERT into GmsDailyPerformance
      const updateCols = columnsList
        .filter(c => !['Asin', 'Date'].includes(c.name))
        .map(c => `T.[${c.name}] = S.[${c.name}]`)
        .join(', ');

      const insertColNames = columnsList.map(c => `[${c.name}]`).join(', ');
      const insertColVals = columnsList.map(c => `S.[${c.name}]`).join(', ');

      await executeWithRetry(async () => {
        await pool.request().query(`
          MERGE GmsDailyPerformance WITH (HOLDLOCK) AS T
          USING ${tempTableName} AS S
          ON (T.Asin = S.Asin AND T.Date = S.Date)
          WHEN MATCHED THEN
            UPDATE SET ${updateCols}, T.UpdatedAt = dbo.GetEnvDate()
          WHEN NOT MATCHED THEN
            INSERT (Id, ${insertColNames}, CreatedAt, UpdatedAt)
            VALUES (SUBSTRING(LOWER(REPLACE(CAST(NEWID() AS VARCHAR(36)), '-', '')), 1, 24), ${insertColVals}, dbo.GetEnvDate(), dbo.GetEnvDate());
        `);
      });
    }

    res.json({
      success: true,
      processed: uniqueCount,
      skipped: skippedCount,
      duplicatesCondensed: jsonData.length - uniqueCount - skippedCount,
      errors: 0
    });

  } catch (err) {
    console.error("❌ GMS Upload Failed:", err);
    res.status(500).json({ 
      error: "GMS Ingestion Pipeline Error", 
      details: err.message 
    });
  } finally {
    if (tempTableName) {
      try { 
        await pool.request().query(`IF OBJECT_ID('tempdb..${tempTableName}') IS NOT NULL DROP TABLE ${tempTableName}`);
      } catch(e) {}
    }
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }
};

exports.getGmsData = async (req, res) => {
  try {
    const userRole = req.user.role?.name || req.user.role;
    const isGlobalUser = ['admin', 'super_admin', 'developer', 'operational_manager'].includes(userRole);
    
    const pool = await getPool();
    const request = pool.request();
    let whereClauses = [];

    if (!isGlobalUser) {
      const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
      if (assignedSellerIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      whereClauses.push(`a.SellerId IN (${buildInClause(request, 'sellerId', assignedSellerIds)})`);
    }

    // Date range filter
    if (req.query.startDate) {
      request.input('startDate', sql.Date, req.query.startDate);
      whereClauses.push('g.Date >= @startDate');
    }
    if (req.query.endDate) {
      request.input('endDate', sql.Date, req.query.endDate);
      whereClauses.push('g.Date <= @endDate');
    }

    const whereSQL = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

    // For global users, skip the expensive JOINs — frontend resolves brands
    let query;
    if (isGlobalUser && !whereClauses.some(c => c.includes('SellerId'))) {
      query = `
        SELECT 
          g.Date as date,
          g.Asin as asin,
          g.Brand as brand,
          g.StoreCode as storeCode,
          g.OrderedRevenue as orderedRevenue,
          g.OrderedUnits as orderedUnits,
          g.ShippedRevenue as shippedRevenue,
          g.ShippedCOGS as shippedCOGS,
          g.ShippedUnits as shippedUnits,
          g.CustomerReturns as customerReturns
        FROM GmsDailyPerformance g
        ${whereSQL}
        ORDER BY g.Date DESC
      `;
    } else {
      query = `
        SELECT 
          g.Date as date,
          g.Asin as asin,
          g.Brand as brand,
          g.StoreCode as storeCode,
          g.OrderedRevenue as orderedRevenue,
          g.OrderedUnits as orderedUnits,
          g.ShippedRevenue as shippedRevenue,
          g.ShippedCOGS as shippedCOGS,
          g.ShippedUnits as shippedUnits,
          g.CustomerReturns as customerReturns,
          s.Name as dbBrand,
          a.Title as productTitle
        FROM GmsDailyPerformance g
        LEFT JOIN Asins a ON g.Asin = a.AsinCode
        LEFT JOIN Sellers s ON a.SellerId = s.Id
        ${whereSQL}
        ORDER BY g.Date DESC
      `;
    }

    const result = await request.query(query);
    
    // Format Date object to YYYY-MM-DD avoiding timezone shifts
    const formatted = result.recordset.map(row => {
      if (!row.date) return { ...row, date: null };
      const d = new Date(row.date);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localDate = new Date(d.getTime() - tzOffset);
      return {
        ...row,
        date: localDate.toISOString().split('T')[0]
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error("❌ Gms fetch error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch GMS data" });
  }
};

exports.clearGmsData = async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query("DELETE FROM GmsDailyPerformance");
    res.json({ success: true, message: "GMS Performance data cleared successfully" });
  } catch (error) {
    console.error("❌ Gms clear error:", error);
    res.status(500).json({ success: false, message: "Failed to clear GMS data" });
  }
};

// Lightweight ASINs endpoint for GMS tracker (only ASINs with GMS data)
exports.getGmsAsins = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT DISTINCT a.AsinCode as asinCode, a.Brand as brand, a.SellerId as sellerId,
             a.Title as title, s.Name as sellerName
      FROM Asins a
      INNER JOIN GmsDailyPerformance g ON g.Asin = a.AsinCode
      LEFT JOIN Sellers s ON a.SellerId = s.Id
    `);
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("GMS asins error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch ASINs" });
  }
};