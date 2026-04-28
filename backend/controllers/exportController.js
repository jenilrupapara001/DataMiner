const { sql, getPool, generateId } = require('../database/db');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const SocketService = require('../services/socketService');

const EXPORTS_DIR = path.join(__dirname, '../uploads/exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Available ASIN fields for export
const ALL_ASIN_FIELDS = [
    { key: 'asinCode', label: 'ASIN Code', category: 'Basic' },
    { key: 'parentAsin', label: 'Parent ASIN', category: 'Basic' },
    { key: 'sku', label: 'SKU', category: 'Basic' },
    { key: 'title', label: 'Product Title', category: 'Basic' },
    { key: 'brand', label: 'Brand', category: 'Basic' },
    { key: 'category', label: 'Category', category: 'Basic' },
    { key: 'status', label: 'Status', category: 'Basic' },
    { key: 'tags', label: 'Tags', category: 'Basic' },
    { key: 'currentPrice', label: 'Current Price (₹)', category: 'Pricing' },
    { key: 'mrp', label: 'MRP (₹)', category: 'Pricing' },
    { key: 'dealBadge', label: 'Deal Badge', category: 'Pricing' },
    { key: 'priceType', label: 'Price Type', category: 'Pricing' },
    { key: 'discountPercentage', label: 'Discount %', category: 'Pricing' },
    { key: 'secondAsp', label: 'Second ASP (₹)', category: 'Pricing' },
    { key: 'aspDifference', label: 'ASP Difference (₹)', category: 'Pricing' },
    { key: 'bsr', label: 'Best Seller Rank', category: 'Performance' },
    { key: 'subBsr', label: 'Sub BSR', category: 'Performance' },
    { key: 'subBSRs', label: 'Sub BSRs (All)', category: 'Performance' },
    { key: 'rating', label: 'Rating', category: 'Performance' },
    { key: 'reviewCount', label: 'Review Count', category: 'Performance' },
    { key: 'ratingBreakdown', label: 'Rating Breakdown', category: 'Performance' },
    { key: 'lqs', label: 'LQS Score', category: 'Performance' },
    { key: 'titleScore', label: 'Title Score', category: 'LQS' },
    { key: 'bulletScore', label: 'Bullet Score', category: 'LQS' },
    { key: 'imageScore', label: 'Image Score', category: 'LQS' },
    { key: 'descriptionScore', label: 'Description Score', category: 'LQS' },
    { key: 'cdq', label: 'CDQ Score', category: 'Performance' },
    { key: 'cdqGrade', label: 'CDQ Grade', category: 'Performance' },
    { key: 'buyBoxWin', label: 'BuyBox Winner', category: 'BuyBox' },
    { key: 'soldBy', label: 'Sold By (Current BuyBox)', category: 'BuyBox' },
    { key: 'soldBySec', label: 'Sold By (Other BuyBox)', category: 'BuyBox' },
    { key: 'hasAplus', label: 'Has A+ Content', category: 'Content' },
    { key: 'imagesCount', label: 'Image Count', category: 'Content' },
    { key: 'videoCount', label: 'Video Count', category: 'Content' },
    { key: 'bulletPoints', label: 'Bullet Points Count', category: 'Content' },
    { key: 'availabilityStatus', label: 'Availability Status', category: 'Inventory' },
    { key: 'stockLevel', label: 'Stock Level', category: 'Inventory' },
    { key: 'aplusAbsentSince', label: 'A+ Days Absent', category: 'Content' },
    { key: 'lastScraped', label: 'Last Scraped', category: 'Dates' },
    { key: 'createdAt', label: 'Created At', category: 'Dates' },
    { key: 'updatedAt', label: 'Updated At', category: 'Dates' },
];

const FIELD_CATEGORIES = [...new Set(ALL_ASIN_FIELDS.map(f => f.category))];

/**
 * Start an export job (background processing)
 * POST /api/export/start
 */
exports.startExport = async (req, res) => {
    try {
        const {
            sellerIds = [],
            allSellers = false,
            fields = [],
            dateRange = 'all',
            managerFilter = 'all',
            format = 'csv',
            parentAsin,
            subBsrCategory,
            tags
        } = req.body;

        const userId = (req.user?._id || req.user?.id || '').toString();
        const pool = await getPool();

        // Create download record
        const downloadId = generateId();
        const fileName = `asin_export_${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
        const filePath = path.join(EXPORTS_DIR, `${downloadId}_${fileName}`);

        await pool.request()
            .input('id', sql.VarChar, downloadId)
            .input('userId', sql.VarChar, userId)
            .input('fileName', sql.NVarChar, fileName)
            .input('filePath', sql.NVarChar, filePath)
            .input('format', sql.NVarChar, format)
            .input('status', sql.NVarChar, 'processing')
            .input('params', sql.NVarChar, JSON.stringify(req.body))
            .query(`
                INSERT INTO Downloads (Id, UserId, FileName, FilePath, Format, Status, Params, CreatedAt)
                VALUES (@id, @userId, @fileName, @filePath, @format, @status, @params, GETDATE())
            `);

        // Return immediately with download ID
        res.json({
            success: true,
            message: 'Export started',
            downloadId,
            fileName
        });

        // Process export in background
        processExportJob(downloadId, req.body, userId).catch(err => {
            console.error(`Export job ${downloadId} failed:`, err.message);
        });

    } catch (error) {
        console.error('Start Export Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Background export processing function
 */
async function processExportJob(downloadId, params, userId) {
    const pool = await getPool();

    try {
        // Update progress
        await updateDownloadStatus(pool, downloadId, 'processing', 10);

        const {
            sellerIds = [],
            allSellers = false,
            fields = [],
            dateRange = 'all',
            managerFilter = 'all',
            format = 'csv',
            parentAsin,
            subBsrCategory,
            tags
        } = params;

        const request = pool.request();
        let whereClause = 'WHERE 1=1';

        // RBAC
        const roleName = params._userRole || '';
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

        if (!isGlobalUser) {
            const assignedIds = (params._assignedSellers || []).map(s => s.toString());
            if (assignedIds.length === 0) {
                whereClause += ' AND 1=0'; // No access
            } else {
                whereClause += ` AND a.SellerId IN (${assignedIds.map(id => `'${id}'`).join(',')})`;
            }
        } else if (!allSellers && sellerIds.length > 0) {
            whereClause += ` AND a.SellerId IN (${sellerIds.map(id => `'${id}'`).join(',')})`;
        }

        // Date filter
        if (dateRange === 'today') whereClause += ' AND CONVERT(DATE, a.LastScrapedAt) = CONVERT(DATE, GETDATE())';
        else if (dateRange === '7days') whereClause += ' AND a.LastScrapedAt >= DATEADD(DAY, -7, GETDATE())';
        else if (dateRange === '30days') whereClause += ' AND a.LastScrapedAt >= DATEADD(DAY, -30, GETDATE())';
        else if (dateRange === '90days') whereClause += ' AND a.LastScrapedAt >= DATEADD(DAY, -90, GETDATE())';

        // Additional filters
        if (parentAsin) whereClause += ` AND a.ParentAsin = '${parentAsin}'`;
        if (subBsrCategory) whereClause += ` AND a.SubBsr = '${subBsrCategory}'`; // Note: This might need updating if SubBsr is stored in SubBsrCategories now
        if (tags && tags.length > 0) {
            const tagConditions = tags.map(t => `a.Tags LIKE '%${t}%'`);
            whereClause += ` AND (${tagConditions.join(' OR ')})`;
        }

        await updateDownloadStatus(pool, downloadId, 'processing', 30);

        // Fetch ASINs
        const result = await pool.request().query(`
            SELECT a.*, s.Name as sellerName
            FROM Asins a
            LEFT JOIN Sellers s ON a.SellerId = s.Id
            ${whereClause}
            ORDER BY a.AsinCode ASC
        `);

        await updateDownloadStatus(pool, downloadId, 'processing', 60);

        const asins = result.recordset;

        // Format data
        const fieldMapping = {};
        ALL_ASIN_FIELDS.forEach(f => { fieldMapping[f.key] = f.label; });

        const exportData = asins.map(row => {
            const item = {};
            fields.forEach(field => {
                const label = fieldMapping[field] || field;
                let value = row[field] !== undefined ? row[field] : 
                           (row[field.charAt(0).toUpperCase() + field.slice(1)] !== undefined ? 
                            row[field.charAt(0).toUpperCase() + field.slice(1)] : '');

                // Format special fields
                if (field === 'buyBoxWin' || field === 'hasAplus') value = value ? 'Yes' : 'No';
                if (field === 'tags') {
                    try { value = JSON.parse(value || '[]').join(', '); } catch { value = ''; }
                }
                if (field === 'createdAt' || field === 'updatedAt' || field === 'lastScraped') {
                    if (value) value = new Date(value).toLocaleDateString('en-IN');
                }

                item[label] = value || '';
            });
            return item;
        });

        await updateDownloadStatus(pool, downloadId, 'processing', 80);

        // Generate file
        const filePath = path.join(EXPORTS_DIR, `asin_export_${downloadId}.${format}`);
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ASINs');

        if (format === 'csv') {
            const csvData = XLSX.utils.sheet_to_csv(ws);
            // Add BOM for Excel UTF-8 compatibility
            fs.writeFileSync(filePath, '\uFEFF' + csvData, 'utf8');
        } else {
            const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            fs.writeFileSync(filePath, buffer);
        }

        const stats = fs.statSync(filePath);

        // Update download record as completed
        await pool.request()
            .input('id', sql.VarChar, downloadId)
            .input('fileSize', sql.BigInt, stats.size)
            .input('rowCount', sql.Int, exportData.length)
            .query(`
                UPDATE Downloads SET 
                    Status = 'completed',
                    Progress = 100,
                    FileSize = @fileSize,
                    [RowCount] = @rowCount,
                    FilePath = '/exports/' + (SELECT FileName FROM Downloads WHERE Id = @id),
                    CompletedAt = GETDATE(),
                    ExpiresAt = DATEADD(HOUR, 24, GETDATE())
                WHERE Id = @id
            `);

        // Notify user via socket
        const io = SocketService.getIo();
        if (io) {
            io.to(`user_${userId}`).emit('export_completed', {
                downloadId,
                fileName: `asin_export_${downloadId}.${format}`,
                rowCount: exportData.length,
                fileSize: stats.size
            });
        }

        console.log(`✅ Export completed: ${downloadId} (${exportData.length} rows)`);

    } catch (error) {
        console.error(`❌ Export job ${downloadId} failed:`, error.message);
        await updateDownloadStatus(pool, downloadId, 'failed', 0, error.message);

        const io = SocketService.getIo();
        if (io) {
            io.to(`user_${userId}`).emit('export_failed', {
                downloadId,
                error: error.message
            });
        }
    }
}

async function updateDownloadStatus(pool, id, status, progress, errorMessage = null) {
    try {
        const request = pool.request()
            .input('id', sql.VarChar, id)
            .input('status', sql.NVarChar, status)
            .input('progress', sql.Int, progress);

        let query = 'UPDATE Downloads SET Status = @status, Progress = @progress';
        if (errorMessage) {
            query += ', ErrorMessage = @error';
            request.input('error', sql.NVarChar, errorMessage);
        }
        query += ' WHERE Id = @id';

        await request.query(query);
    } catch (e) {
        console.error('Update download status error:', e.message);
    }
}

/**
 * Get user's downloads
 * GET /api/export/downloads
 */
exports.getDownloads = async (req, res) => {
    try {
        const userId = (req.user?._id || req.user?.id || '').toString();
        const pool = await getPool();

        const result = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query(`
                SELECT * FROM Downloads 
                WHERE UserId = @userId 
                ORDER BY CreatedAt DESC
            `);

        res.json({
            success: true,
            data: result.recordset.map(d => ({
                ...d,
                _id: d.Id,
                isExpired: d.ExpiresAt ? new Date(d.ExpiresAt) < new Date() : false
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Download a completed export file
 * GET /api/export/download/:id
 */
exports.downloadFile = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = (req.user?._id || req.user?.id || '').toString();
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .input('userId', sql.VarChar, userId)
            .query('SELECT * FROM Downloads WHERE Id = @id AND UserId = @userId');

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Download not found' });
        }

        const download = result.recordset[0];

        if (download.Status !== 'completed') {
            return res.status(400).json({ success: false, error: 'File not ready yet. Status: ' + download.Status });
        }

        if (download.ExpiresAt && new Date(download.ExpiresAt) < new Date()) {
            return res.status(410).json({ success: false, error: 'File has expired' });
        }

        // Find the actual file
        const exportDir = path.join(__dirname, '../uploads/exports');
        const files = fs.readdirSync(exportDir).filter(f => f.includes(id));
        
        if (files.length === 0) {
            return res.status(404).json({ success: false, error: 'File not found on disk' });
        }

        const filePath = path.join(exportDir, files[0]);

        // Update download count
        await pool.request()
            .input('id', sql.VarChar, id)
            .query('UPDATE Downloads SET DownloadCount = DownloadCount + 1, DownloadedAt = GETDATE() WHERE Id = @id');

        // Send file
        res.download(filePath, download.FileName);

    } catch (error) {
        console.error('Download File Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get available export fields
 * GET /api/export/fields
 */
exports.getExportFields = async (req, res) => {
    res.json({
        success: true,
        data: {
            fields: ALL_ASIN_FIELDS,
            categories: FIELD_CATEGORIES
        }
    });
};

/**
 * Clean expired downloads
 * Can be called by cron job
 */
exports.cleanExpiredDownloads = async () => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query("SELECT Id, FilePath FROM Downloads WHERE Status = 'completed' AND ExpiresAt < GETDATE()");

        for (const download of result.recordset) {
            // Delete file
            const exportDir = path.join(__dirname, '../uploads/exports');
            const files = fs.readdirSync(exportDir).filter(f => f.includes(download.Id));
            files.forEach(f => {
                try { fs.unlinkSync(path.join(exportDir, f)); } catch (e) {}
            });

            // Update status
            await pool.request()
                .input('id', sql.VarChar, download.Id)
                .query("UPDATE Downloads SET Status = 'expired' WHERE Id = @id");
        }

        console.log(`🧹 Cleaned ${result.recordset.length} expired downloads`);
    } catch (error) {
        console.error('Clean expired downloads error:', error);
    }
};
