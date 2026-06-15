const { sql, getPool, generateId } = require('../database/db');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const SocketService = require('../services/socketService');

const EXPORTS_DIR = path.join(__dirname, '../uploads/exports');
if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

const updateDownloadStatus = async (pool, id, status, progress, filePath = null) => {
    let q = `UPDATE Downloads SET Status = @status, Progress = @progress`;
    if (filePath) { q += `, FilePath = @filePath`; }
    q += ` WHERE Id = @id`;

    const req = pool.request()
        .input('id', sql.VarChar, id)
        .input('status', sql.VarChar, status)
        .input('progress', sql.Int, progress);
    
    if (filePath) req.input('filePath', sql.VarChar, filePath);
    
    await req.query(q);
    SocketService.emitExportUpdate(id, { status, progress, filePath });
};

exports.startAdsExport = async (req, res) => {
    try {
        const { sellerId, startDate, endDate, search, groupBy = 'asin', format = 'xlsx' } = req.body;
        const userId = req.user ? req.user.id : 'system';
        const downloadId = generateId();

        const pool = await getPool();

        // 1. Create Download Record
        const insertQuery = `
            INSERT INTO Downloads (Id, UserId, FileName, FilePath, Format, Status, Params, CreatedAt)
            VALUES (@id, @userId, @fileName, '', @format, 'pending', @params, dbo.GetEnvDate())
        `;
        const fileName = `ads_export_${Date.now()}.${format}`;

        await pool.request()
            .input('id', sql.VarChar, downloadId)
            .input('userId', sql.VarChar, userId)
            .input('format', sql.VarChar, format)
            .input('params', sql.NVarChar, JSON.stringify({ sellerId, startDate, endDate, search, groupBy }))
            .input('fileName', sql.VarChar, fileName)
            .query(insertQuery);

        res.json({ success: true, downloadId, message: 'Ads export started in background' });

        // 2. Background Process
        processAdsExportJob(downloadId, { sellerId, startDate, endDate, search, groupBy, format, fileName }).catch(err => {
            console.error('Error processing ads export:', err);
            updateDownloadStatus(pool, downloadId, 'failed', 0).catch(console.error);
        });

    } catch (error) {
        console.error('startAdsExport error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

async function processAdsExportJob(downloadId, params) {
    const pool = await getPool();
    await updateDownloadStatus(pool, downloadId, 'processing', 10);
    
    const { sellerId, startDate, endDate, search, groupBy, format, fileName } = params;

    let whereClause = 'WHERE 1=1';
    const request = pool.request();

    if (startDate) {
        whereClause += " AND p.Date >= @startDate";
        request.input('startDate', sql.Date, new Date(startDate));
    } else {
        whereClause += " AND p.Date >= DATEADD(day, -30, dbo.GetEnvDate())";
    }
    if (endDate) {
        whereClause += " AND p.Date <= @endDate";
        request.input('endDate', sql.Date, new Date(endDate));
    }
    
    if (search) {
        whereClause += " AND (p.Asin LIKE @search OR a.Sku LIKE @search OR a.Title LIKE @search)";
        request.input('search', sql.VarChar, `%${search}%`);
    }

    if (sellerId) {
        whereClause += " AND a.SellerId = @sellerId";
        request.input('sellerId', sql.VarChar, sellerId);
    }

    await updateDownloadStatus(pool, downloadId, 'processing', 20);

    const isParentGroup = groupBy === 'parent';
    const query = `
        SELECT 
            ${isParentGroup ? 'COALESCE(a.ParentAsin, p.Asin)' : 'p.Asin'} as [ASIN],
            COALESCE(MAX(a.Sku), MAX(p.AdvertisedSku), 'N/A') as [SKU],
            COALESCE(MAX(a.Title), 'Unknown Title') as [Title],
            SUM(ISNULL(p.AdSpend, 0)) as Spend,
            SUM(ISNULL(p.AdSales, 0)) as Sales,
            SUM(ISNULL(p.Orders, 0)) as Orders,
            SUM(ISNULL(p.Impressions, 0)) as Impressions,
            SUM(ISNULL(p.Clicks, 0)) as Clicks
        FROM AdsPerformance p
        LEFT JOIN Asins a ON p.Asin = a.AsinCode
        ${whereClause}
        GROUP BY ${isParentGroup ? 'COALESCE(a.ParentAsin, p.Asin)' : 'p.Asin'}
    `;

    const result = await request.query(query);
    const rawData = result.recordset;

    await updateDownloadStatus(pool, downloadId, 'processing', 40);

    const exportData = rawData.map(row => {
        const Spend = Number(row.Spend || 0);
        const Sales = Number(row.Sales || 0);
        const Orders = Number(row.Orders || 0);
        const Impressions = Number(row.Impressions || 0);
        const Clicks = Number(row.Clicks || 0);

        const ACOS = Sales > 0 ? ((Spend / Sales) * 100).toFixed(2) + '%' : '0%';
        const ROAS = Spend > 0 ? (Sales / Spend).toFixed(2) : '0.00';
        const CVR = Clicks > 0 ? ((Orders / Clicks) * 100).toFixed(2) + '%' : '0%';

        return {
            ASIN: row.ASIN,
            SKU: row.SKU,
            Title: row.Title,
            Spend: '₹' + Spend.toFixed(2),
            Sales: '₹' + Sales.toFixed(2),
            Orders,
            Impressions,
            Clicks,
            ACOS,
            ROAS,
            CVR
        };
    });

    await updateDownloadStatus(pool, downloadId, 'processing', 70);

    const filePath = path.join(EXPORTS_DIR, `${downloadId}_${fileName}`);
    
    // ExcelJS for .xlsx files
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Ads Data');
    
    if (exportData.length > 0) {
        const keys = Object.keys(exportData[0]);
        worksheet.columns = keys.map(key => ({
            header: key,
            key: key,
            width: key === 'Title' ? 40 : 18
        }));
        
        exportData.forEach(row => worksheet.addRow(row));
        
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 24;
    }
    
    await workbook.xlsx.writeFile(filePath);

    await updateDownloadStatus(pool, downloadId, 'completed', 100, `/exports/${downloadId}_${fileName}`);
}
