const XLSX = require("xlsx");
const fs = require("fs");
const { sql, getPool, generateId } = require('../database/db');
const marketDataSyncService = require("../services/marketDataSyncService");

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
    let cleaned = val.toString().trim().replace(/^"+|"+$/g, '');
    if (cleaned.toLowerCase() === 'none' || cleaned === '') return null;
    // Excel serial number
    if (!isNaN(cleaned) && Number(cleaned) > 10000) {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + Number(cleaned) * 86400000);
    }
    const shortMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (shortMatch) {
        let year = parseInt(shortMatch[3]);
        year = year < 100 ? 2000 + year : year;
        return new Date(`${year}-${shortMatch[1].padStart(2,'0')}-${shortMatch[2].padStart(2,'0')}`);
    }
    const fullMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (fullMatch) {
        return new Date(`${fullMatch[3]}-${fullMatch[1].padStart(2,'0')}-${fullMatch[2].padStart(2,'0')}`);
    }
    return new Date(cleaned);
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
          const asin = findValue(row, ['ASIN', 'asin']);
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
            .input('month', sql.Date, new Date(`${month}-01`))
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
            .input('month', sql.Date, new Date(`${month}-01`))
            .input('units', sql.Int, units)
            .input('revenue', sql.Decimal(18, 2), revenue)
            .query(`
              INSERT INTO MonthlyPerformance (Id, Asin, Month, OrderedUnits, OrderedRevenue)
              VALUES (@id, @asin, @month, @units, @revenue)
            `);
          inserted++;
        } catch (e) {
          errors++;
          console.error(`Row ${i+1} error:`, e.message);
        }
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    fs.unlinkSync(filePath);
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
  try {
    const filePath = req.file.path;
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });

    const reportType = req.body.reportType || 'daily';
    const reportDate = req.body.date;
    if (!reportDate) throw new Error('Report date is required');

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let processed = 0, skipped = 0, errors = 0;
    const skippedRecords = [];

    try {
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        try {
          const asin = findValue(row, ['asin', 'Advertised ASIN', 'ASIN']);
          if (!asin) { skipped++; continue; }

          const spend = parseFloat((findValue(row, ['spend','Spend','ad_spend', 'metrics.spend'])||'0').replace(/,/g,'')) || 0;
          const sales = parseFloat((findValue(row, ['sales','Sales','ad_sales', 'metrics.sales'])||'0').replace(/,/g,'')) || 0;
          const impressions = parseInt((findValue(row, ['impressions','Impressions', 'metrics.impressions']) || '0').replace(/,/g,''));
          const clicks = parseInt((findValue(row, ['clicks','Clicks', 'metrics.clicks']) || '0').replace(/,/g,''));
          const orders = parseInt((findValue(row, ['orders','Orders', 'metrics.orders']) || '0').replace(/,/g,''));
          
          // Additional metrics
          const conversions = parseInt((findValue(row, ['conversions', 'metrics.conversions']) || '0').replace(/,/g,''));
          const sameSkuSales = parseFloat((findValue(row, ['same_sku_sales', 'metrics.same_sku_sales']) || '0').replace(/,/g,'')) || 0;
          const sameSkuOrders = parseInt((findValue(row, ['same_sku_orders', 'metrics.same_sku_orders']) || '0').replace(/,/g,''));
          const dailyBudget = parseFloat((findValue(row, ['daily_budget', 'metrics.daily_budget']) || '0').replace(/,/g,'')) || 0;
          const totalBudget = parseFloat((findValue(row, ['total_budget', 'metrics.total_budget']) || '0').replace(/,/g,'')) || 0;
          const maxSpend = parseFloat((findValue(row, ['max_spend', 'metrics.max_spend']) || '0').replace(/,/g,'')) || 0;
          const avgSpend = parseFloat((findValue(row, ['avg_spend', 'metrics.avg_spend']) || '0').replace(/,/g,'')) || 0;
          const totalSales = parseFloat((findValue(row, ['total_sales', 'metrics.total_sales']) || '0').replace(/,/g,'')) || 0;
          const totalAcos = parseFloat((findValue(row, ['total_acos', 'metrics.total_acos']) || '0').replace(/,/g,'')) || 0;
          const totalUnits = parseInt((findValue(row, ['total_units', 'metrics.total_units']) || '0').replace(/,/g,''));
          const organicSales = parseFloat((findValue(row, ['organic_sales', 'metrics.organic_sales']) || '0').replace(/,/g,'')) || 0;
          const organicOrders = parseInt((findValue(row, ['organic_orders', 'metrics.organic_orders']) || '0').replace(/,/g,''));
          const pageViews = parseInt((findValue(row, ['page_views', 'metrics.page_views']) || '0').replace(/,/g,''));
          const adSalesPerc = parseFloat((findValue(row, ['ad_sales_perc', 'metrics.ad_sales_perc']) || '0').replace(/,/g,'')) || 0;
          const tosIs = parseFloat((findValue(row, ['tos_is', 'metrics.tos_is']) || '0').replace(/,/g,'')) || 0;
          const aov = parseFloat((findValue(row, ['aov', 'metrics.aov']) || '0').replace(/,/g,'')) || 0;
          const sessions = parseInt((findValue(row, ['sessions', 'metrics.sessions']) || '0').replace(/,/g,''));
          const buyBoxPercentage = parseFloat((findValue(row, ['buy_box_percentage', 'metrics.buy_box_percentage']) || '0').replace(/,/g,'')) || 0;
          const browserSessions = parseInt((findValue(row, ['browser_sessions', 'metrics.browser_sessions']) || '0').replace(/,/g,''));
          const mobileAppSessions = parseInt((findValue(row, ['mobile_app_sessions', 'metrics.mobile_app_sessions']) || '0').replace(/,/g,''));

          // Derived metrics (if not in CSV)
          const acos = sales > 0 ? (spend / sales) * 100 : 0;
          const roas = spend > 0 ? sales / spend : 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpc = clicks > 0 ? spend / clicks : 0;
          const conversionRate = clicks > 0 ? (orders / clicks) * 100 : 0;

          const dateVal = reportType === 'daily' ? (findValue(row, ['date','Date']) || reportDate) : reportDate;
          const parsedDate = parseDate(dateVal);
          if (!parsedDate) { skipped++; continue; }

          // Upsert logic: check if record exists
          if (reportType === 'daily') {
            const existing = await transaction.request()
              .input('asin', sql.VarChar, asin)
              .input('date', sql.Date, parsedDate)
              .query('SELECT Id FROM AdsPerformance WHERE Asin = @asin AND Date = @date AND ReportType = \'daily\'');
            
            const query = existing.recordset.length > 0 
              ? `UPDATE AdsPerformance SET 
                  AdSpend=@spend, AdSales=@sales, Impressions=@impressions, Clicks=@clicks, Orders=@orders,
                  ACoS=@acos, RoAS=@roas, CTR=@ctr, CPC=@cpc, ConversionRate=@conversionRate,
                  Conversions=@conversions, SameSkuSales=@sameSkuSales, SameSkuOrders=@sameSkuOrders,
                  DailyBudget=@dailyBudget, TotalBudget=@totalBudget, MaxSpend=@maxSpend, AvgSpend=@avgSpend,
                  TotalSales=@totalSales, TotalAcos=@totalAcos, TotalUnits=@totalUnits,
                  OrganicSales=@organicSales, OrganicOrders=@organicOrders, PageViews=@pageViews,
                  AdSalesPerc=@adSalesPerc, TosIs=@tosIs, Aov=@aov, Sessions=@sessions,
                  BuyBoxPercentage=@buyBoxPercentage, BrowserSessions=@browserSessions, MobileAppSessions=@mobileAppSessions
                 WHERE Id=@id`
              : `INSERT INTO AdsPerformance (
                  Asin, Date, ReportType, AdSpend, AdSales, Impressions, Clicks, Orders,
                  ACoS, RoAS, CTR, CPC, ConversionRate,
                  Conversions, SameSkuSales, SameSkuOrders,
                  DailyBudget, TotalBudget, MaxSpend, AvgSpend,
                  TotalSales, TotalAcos, TotalUnits,
                  OrganicSales, OrganicOrders, PageViews,
                  AdSalesPerc, TosIs, Aov, Sessions,
                  BuyBoxPercentage, BrowserSessions, MobileAppSessions
                 ) VALUES (
                  @asin, @date, @reportType, @spend, @sales, @impressions, @clicks, @orders,
                  @acos, @roas, @ctr, @cpc, @conversionRate,
                  @conversions, @sameSkuSales, @sameSkuOrders,
                  @dailyBudget, @totalBudget, @maxSpend, @avgSpend,
                  @totalSales, @totalAcos, @totalUnits,
                  @organicSales, @organicOrders, @pageViews,
                  @adSalesPerc, @tosIs, @aov, @sessions,
                  @buyBoxPercentage, @browserSessions, @mobileAppSessions
                 )`;

            const request = transaction.request()
              .input('asin', sql.VarChar, asin)
              .input('date', sql.Date, parsedDate)
              .input('reportType', sql.NVarChar, 'daily')
              .input('spend', sql.Decimal(18,2), spend)
              .input('sales', sql.Decimal(18,2), sales)
              .input('impressions', sql.Int, impressions)
              .input('clicks', sql.Int, clicks)
              .input('orders', sql.Int, orders)
              .input('acos', sql.Decimal(18,4), acos)
              .input('roas', sql.Decimal(18,4), roas)
              .input('ctr', sql.Decimal(18,4), ctr)
              .input('cpc', sql.Decimal(18,4), cpc)
              .input('conversionRate', sql.Decimal(18,4), conversionRate)
              .input('conversions', sql.Int, conversions)
              .input('sameSkuSales', sql.Decimal(18,2), sameSkuSales)
              .input('sameSkuOrders', sql.Int, sameSkuOrders)
              .input('dailyBudget', sql.Decimal(18,2), dailyBudget)
              .input('totalBudget', sql.Decimal(18,2), totalBudget)
              .input('maxSpend', sql.Decimal(18,2), maxSpend)
              .input('avgSpend', sql.Decimal(18,2), avgSpend)
              .input('totalSales', sql.Decimal(18,2), totalSales)
              .input('totalAcos', sql.Decimal(18,4), totalAcos)
              .input('totalUnits', sql.Int, totalUnits)
              .input('organicSales', sql.Decimal(18,2), organicSales)
              .input('organicOrders', sql.Int, organicOrders)
              .input('pageViews', sql.Int, pageViews)
              .input('adSalesPerc', sql.Decimal(18,4), adSalesPerc)
              .input('tosIs', sql.Decimal(18,4), tosIs)
              .input('aov', sql.Decimal(18,2), aov)
              .input('sessions', sql.Int, sessions)
              .input('buyBoxPercentage', sql.Decimal(18,4), buyBoxPercentage)
              .input('browserSessions', sql.Int, browserSessions)
              .input('mobileAppSessions', sql.Int, mobileAppSessions);

            if (existing.recordset.length > 0) {
              request.input('id', sql.Int, existing.recordset[0].Id);
            }
            
            await request.query(query);
          } else {
            // monthly similar
            const monthDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
            const existing = await transaction.request()
              .input('asin', sql.VarChar, asin)
              .input('month', sql.Date, monthDate)
              .query('SELECT Id FROM AdsPerformance WHERE Asin = @asin AND Month = @month AND ReportType = \'monthly\'');
            
            const query = existing.recordset.length > 0 
              ? `UPDATE AdsPerformance SET 
                  AdSpend=@spend, AdSales=@sales, Impressions=@impressions, Clicks=@clicks, Orders=@orders,
                  ACoS=@acos, RoAS=@roas, CTR=@ctr, CPC=@cpc, ConversionRate=@conversionRate,
                  Conversions=@conversions, SameSkuSales=@sameSkuSales, SameSkuOrders=@sameSkuOrders,
                  DailyBudget=@dailyBudget, TotalBudget=@totalBudget, MaxSpend=@maxSpend, AvgSpend=@avgSpend,
                  TotalSales=@totalSales, TotalAcos=@totalAcos, TotalUnits=@totalUnits,
                  OrganicSales=@organicSales, OrganicOrders=@organicOrders, PageViews=@pageViews,
                  AdSalesPerc=@adSalesPerc, TosIs=@tosIs, Aov=@aov, Sessions=@sessions,
                  BuyBoxPercentage=@buyBoxPercentage, BrowserSessions=@browserSessions, MobileAppSessions=@mobileAppSessions
                 WHERE Id=@id`
              : `INSERT INTO AdsPerformance (
                  Asin, Month, ReportType, AdSpend, AdSales, Impressions, Clicks, Orders,
                  ACoS, RoAS, CTR, CPC, ConversionRate,
                  Conversions, SameSkuSales, SameSkuOrders,
                  DailyBudget, TotalBudget, MaxSpend, AvgSpend,
                  TotalSales, TotalAcos, TotalUnits,
                  OrganicSales, OrganicOrders, PageViews,
                  AdSalesPerc, TosIs, Aov, Sessions,
                  BuyBoxPercentage, BrowserSessions, MobileAppSessions
                 ) VALUES (
                  @asin, @month, @reportType, @spend, @sales, @impressions, @clicks, @orders,
                  @acos, @roas, @ctr, @cpc, @conversionRate,
                  @conversions, @sameSkuSales, @sameSkuOrders,
                  @dailyBudget, @totalBudget, @maxSpend, @avgSpend,
                  @totalSales, @totalAcos, @totalUnits,
                  @organicSales, @organicOrders, @pageViews,
                  @adSalesPerc, @tosIs, @aov, @sessions,
                  @buyBoxPercentage, @browserSessions, @mobileAppSessions
                 )`;

            const request = transaction.request()
              .input('asin', sql.VarChar, asin)
              .input('month', sql.Date, monthDate)
              .input('reportType', sql.NVarChar, 'monthly')
              .input('spend', sql.Decimal(18,2), spend)
              .input('sales', sql.Decimal(18,2), sales)
              .input('impressions', sql.Int, impressions)
              .input('clicks', sql.Int, clicks)
              .input('orders', sql.Int, orders)
              .input('acos', sql.Decimal(18,4), acos)
              .input('roas', sql.Decimal(18,4), roas)
              .input('ctr', sql.Decimal(18,4), ctr)
              .input('cpc', sql.Decimal(18,4), cpc)
              .input('conversionRate', sql.Decimal(18,4), conversionRate)
              .input('conversions', sql.Int, conversions)
              .input('sameSkuSales', sql.Decimal(18,2), sameSkuSales)
              .input('sameSkuOrders', sql.Int, sameSkuOrders)
              .input('dailyBudget', sql.Decimal(18,2), dailyBudget)
              .input('totalBudget', sql.Decimal(18,2), totalBudget)
              .input('maxSpend', sql.Decimal(18,2), maxSpend)
              .input('avgSpend', sql.Decimal(18,2), avgSpend)
              .input('totalSales', sql.Decimal(18,2), totalSales)
              .input('totalAcos', sql.Decimal(18,4), totalAcos)
              .input('totalUnits', sql.Int, totalUnits)
              .input('organicSales', sql.Decimal(18,2), organicSales)
              .input('organicOrders', sql.Int, organicOrders)
              .input('pageViews', sql.Int, pageViews)
              .input('adSalesPerc', sql.Decimal(18,4), adSalesPerc)
              .input('tosIs', sql.Decimal(18,4), tosIs)
              .input('aov', sql.Decimal(18,2), aov)
              .input('sessions', sql.Int, sessions)
              .input('buyBoxPercentage', sql.Decimal(18,4), buyBoxPercentage)
              .input('browserSessions', sql.Int, browserSessions)
              .input('mobileAppSessions', sql.Int, mobileAppSessions);

            if (existing.recordset.length > 0) {
              request.input('id', sql.Int, existing.recordset[0].Id);
            }
            
            await request.query(query);
          }
          processed++;
        } catch (e) {
          errors++;
          console.error(`Row ${i+1} error:`, e.message);
        }
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true, processed, skipped, errors });
  } catch (err) {
    console.error("❌ Ads Upload Error:", err);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
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
      // JSON array
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(fileContent);
      rawDataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
    } else {
      // Excel format
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
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
            LastScrapedAt = GETDATE(),
            UpdatedAt = GETDATE()
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