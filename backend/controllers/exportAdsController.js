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
    let q = `UPDATE Downloads SET Status = @status, Progress = @progress, UpdatedAt = dbo.GetEnvDate()`;
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
            INSERT INTO Downloads (Id, UserId, Status, Progress, Type, Format, Filters, FileName, CreatedAt, UpdatedAt)
            VALUES (@id, @userId, 'pending', 0, 'ads', @format, @filters, @fileName, dbo.GetEnvDate(), dbo.GetEnvDate())
        `;
        const fileName = `ads_export_${Date.now()}.${format}`;

        await pool.request()
            .input('id', sql.VarChar, downloadId)
            .input('userId', sql.VarChar, userId)
            .input('format', sql.VarChar, format)
            .input('filters', sql.NVarChar, JSON.stringify({ sellerId, startDate, endDate, search, groupBy }))
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

    const query = `
        SELECT 
            p.*,
            a.ParentAsin,
            a.Title,
            a.ImageUrl,
            a.Sku as MasterSku,
            a.Category,
            a.Brand
        FROM AdsPerformance p
        LEFT JOIN Asins a ON p.Asin = a.AsinCode
        ${whereClause}
        ORDER BY p.Date DESC
    `;

    const result = await request.query(query);
    const rawData = result.recordset;

    await updateDownloadStatus(pool, downloadId, 'processing', 40);

    // Grouping Logic
    const groupMap = {};
    rawData.forEach(row => {
        let key = groupBy === 'parent' ? (row.ParentAsin || row.Asin) : row.Asin;
        if (!groupMap[key]) {
            groupMap[key] = {
                ASIN: key,
                SKU: row.MasterSku || row.AdvertisedSku || 'N/A',
                Title: row.Title || 'Unknown Title',
                Spend: 0,
                Sales: 0,
                Orders: 0,
                Impressions: 0,
                Clicks: 0
            };
        }
        const target = groupMap[key];
        target.Spend += Number(row.AdSpend || 0);
        target.Sales += Number(row.AdSales || 0);
        target.Orders += Number(row.Orders || 0);
        target.Impressions += Number(row.Impressions || 0);
        target.Clicks += Number(row.Clicks || 0);
    });

    const exportData = Object.values(groupMap).map(row => {
        row.ACOS = row.Sales > 0 ? ((row.Spend / row.Sales) * 100).toFixed(2) + '%' : '0%';
        row.ROAS = row.Spend > 0 ? (row.Sales / row.Spend).toFixed(2) : '0.00';
        row.CVR = row.Clicks > 0 ? ((row.Orders / row.Clicks) * 100).toFixed(2) + '%' : '0%';
        row.Spend = '₹' + row.Spend.toFixed(2);
        row.Sales = '₹' + row.Sales.toFixed(2);
        return row;
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
