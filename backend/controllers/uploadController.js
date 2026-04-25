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

          const spend = parseFloat((findValue(row, ['spend','Spend','ad_spend'])||'0').replace(/,/g,'')) || 0;
          const sales = parseFloat((findValue(row, ['sales','Sales','ad_sales'])||'0').replace(/,/g,'')) || 0;
          const impressions = parseInt(findValue(row, ['impressions','Impressions']) || '0');
          const clicks = parseInt(findValue(row, ['clicks','Clicks']) || '0');
          const orders = parseInt(findValue(row, ['orders','Orders']) || '0');

          const dateVal = reportType === 'daily' ? (findValue(row, ['date','Date']) || reportDate) : reportDate;
          const parsedDate = parseDate(dateVal);
          if (!parsedDate) { skipped++; continue; }

          // Upsert logic: check if record exists
          if (reportType === 'daily') {
            const existing = await transaction.request()
              .input('asin', sql.VarChar, asin)
              .input('date', sql.Date, parsedDate)
              .query('SELECT Id FROM AdsPerformance WHERE Asin = @asin AND Date = @date AND ReportType = \'daily\'');
            if (existing.recordset.length > 0) {
              // Update
              await transaction.request()
                .input('id', sql.VarChar, existing.recordset[0].Id)
                .input('spend', sql.Decimal(18,2), spend)
                .input('sales', sql.Decimal(18,2), sales)
                .input('impressions', sql.Int, impressions)
                .input('clicks', sql.Int, clicks)
                .input('orders', sql.Int, orders)
                .query(`UPDATE AdsPerformance SET AdSpend=@spend, AdSales=@sales, Impressions=@impressions, Clicks=@clicks, Orders=@orders WHERE Id=@id`);
            } else {
              const id = generateId();
              await transaction.request()
                .input('id', sql.VarChar, id)
                .input('asin', sql.VarChar, asin)
                .input('date', sql.Date, parsedDate)
                .input('reportType', sql.NVarChar, 'daily')
                .input('spend', sql.Decimal(18,2), spend)
                .input('sales', sql.Decimal(18,2), sales)
                .input('impressions', sql.Int, impressions)
                .input('clicks', sql.Int, clicks)
                .input('orders', sql.Int, orders)
                .query(`INSERT INTO AdsPerformance (Id, Asin, Date, ReportType, AdSpend, AdSales, Impressions, Clicks, Orders) VALUES (@id,@asin,@date,@reportType,@spend,@sales,@impressions,@clicks,@orders)`);
            }
          } else {
            // monthly similar, using Month field
            const monthDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
            const existing = await transaction.request()
              .input('asin', sql.VarChar, asin)
              .input('month', sql.Date, monthDate)
              .query('SELECT Id FROM AdsPerformance WHERE Asin = @asin AND Month = @month AND ReportType = \'monthly\'');
            if (existing.recordset.length > 0) {
              await transaction.request()
                .input('id', sql.VarChar, existing.recordset[0].Id)
                .input('spend', sql.Decimal(18,2), spend)
                .input('sales', sql.Decimal(18,2), sales)
                .input('impressions', sql.Int, impressions)
                .input('clicks', sql.Int, clicks)
                .input('orders', sql.Int, orders)
                .query(`UPDATE AdsPerformance SET AdSpend=@spend, AdSales=@sales, Impressions=@impressions, Clicks=@clicks, Orders=@orders WHERE Id=@id`);
            } else {
              const id = generateId();
              await transaction.request()
                .input('id', sql.VarChar, id)
                .input('asin', sql.VarChar, asin)
                .input('month', sql.Date, monthDate)
                .input('reportType', sql.NVarChar, 'monthly')
                .input('spend', sql.Decimal(18,2), spend)
                .input('sales', sql.Decimal(18,2), sales)
                .input('impressions', sql.Int, impressions)
                .input('clicks', sql.Int, clicks)
                .input('orders', sql.Int, orders)
                .query(`INSERT INTO AdsPerformance (Id, Asin, Month, ReportType, AdSpend, AdSales, Impressions, Clicks, Orders) VALUES (@id,@asin,@month,@reportType,@spend,@sales,@impressions,@clicks,@orders)`);
            }
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

    let jsonData = [];
    if (filePath.toLowerCase().endsWith('.json')) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      jsonData = JSON.parse(fileContent);
    } else {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }

    if (!Array.isArray(jsonData)) {
      jsonData = [jsonData]; // Handle single object case
    }

    console.log(`📊 Manual Octoparse upload: Processing ${jsonData.length} records for seller ${sellerId}`);
    
    // Call the robust batch processor in marketDataSyncService
    const updatedCount = await marketDataSyncService.processBatchResults(sellerId, jsonData);

    // Cleanup
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: `Processed ${jsonData.length} records. Successfully updated ${updatedCount} ASINs.`,
      totalProcessed: jsonData.length,
      updatedCount
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