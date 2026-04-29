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
    let filePath = null;
    let user = null;

    try {
        // Fetch user details for RBAC
        const userResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query(`
                SELECT U.*, R.Name as RoleName 
                FROM Users U 
                LEFT JOIN Roles R ON U.RoleId = R.Id 
                WHERE U.Id = @userId
            `);
        
        if (userResult.recordset.length > 0) {
            const u = userResult.recordset[0];
            user = {
                id: u.Id,
                role: u.RoleName,
                assignedSellers: []
            };
            
            // Fetch assigned sellers
            const sellersResult = await pool.request()
                .input('userId', sql.VarChar, userId)
                .query('SELECT SellerId FROM UserSellers WHERE UserId = @userId');
            user.assignedSellers = sellersResult.recordset.map(s => s.SellerId);
        }

        console.log(`📦 [Export] Starting job ${downloadId} for user ${userId}`);

        // Update progress
        await updateDownloadStatus(pool, downloadId, 'processing', 5);

        const {
            sellerIds = [],
            allSellers = false,
            fields = [],
            dateRange = 'all',
            managerFilter = 'all',
            format = 'csv',
            // Advanced filters from AsinManagerPage
            search,
            status,
            category,
            brand,
            minPrice,
            maxPrice,
            minBSR,
            maxBSR,
            minLQS,
            maxLQS,
            scrapeStatus,
            buyBoxWin,
            hasAplus,
            parentAsin,
            subBsrCategory,
            tags,
            sku,
            minRating,
            maxRating,
            minReviewCount,
            maxReviewCount,
            minTitleScore,
            maxTitleScore,
            minBulletScore,
            maxBulletScore,
            minImageScore,
            maxImageScore,
            minDescriptionScore,
            maxDescriptionScore
        } = params;

        const request = pool.request();
        let whereClause = 'WHERE 1=1';

        // RBAC / Seller Filtering
        const roleName = user?.role || '';
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

        if (!isGlobalUser) {
            const assignedIds = user?.assignedSellers || [];
            if (assignedIds.length === 0) {
                whereClause += ' AND 1=0'; 
            } else {
                whereClause += ` AND a.SellerId IN (${assignedIds.map(id => `'${id}'`).join(',')})`;
            }
        } else if (!allSellers && sellerIds.length > 0) {
            whereClause += ` AND a.SellerId IN (${sellerIds.map(id => `'${id}'`).join(',')})`;
        }

        // Apply advanced filters (Matching asinController.js logic)
        if (search) {
            request.input('search', sql.NVarChar, `%${search}%`);
            whereClause += ' AND (a.AsinCode LIKE @search OR a.Title LIKE @search OR a.Sku LIKE @search)';
        }
        if (status) {
            request.input('status', sql.NVarChar, status);
            whereClause += ' AND a.Status = @status';
        }
        if (category) {
            request.input('category', sql.NVarChar, category);
            whereClause += ' AND a.Category = @category';
        }
        if (brand) {
            request.input('brand', sql.NVarChar, brand);
            whereClause += ' AND a.Brand = @brand';
        }
        if (scrapeStatus) {
            request.input('scrapeStatus', sql.NVarChar, scrapeStatus);
            whereClause += ' AND a.ScrapeStatus = @scrapeStatus';
        }
        if (hasAplus !== undefined && hasAplus !== '' && hasAplus !== null) {
            request.input('hasAplus', sql.Bit, (hasAplus === true || hasAplus === 'true') ? 1 : 0);
            whereClause += ' AND a.HasAplus = @hasAplus';
        }
        if (buyBoxWin !== undefined && buyBoxWin !== '' && buyBoxWin !== null) {
            request.input('buyBoxStatus', sql.Bit, (buyBoxWin === true || buyBoxWin === 'true') ? 1 : 0);
            whereClause += ' AND a.BuyBoxWin = @buyBoxStatus';
        }
        if (minPrice) {
            request.input('minPrice', sql.Decimal(18, 2), parseFloat(minPrice));
            whereClause += ' AND a.CurrentPrice >= @minPrice';
        }
        if (maxPrice) {
            request.input('maxPrice', sql.Decimal(18, 2), parseFloat(maxPrice));
            whereClause += ' AND a.CurrentPrice <= @maxPrice';
        }
        if (minBSR) {
            request.input('minBSR', sql.Int, parseInt(minBSR));
            whereClause += ' AND a.BSR >= @minBSR';
        }
        if (maxBSR) {
            request.input('maxBSR', sql.Int, parseInt(maxBSR));
            whereClause += ' AND a.BSR <= @maxBSR';
        }
        if (minLQS) {
            request.input('minLQS', sql.Decimal(5, 2), parseFloat(minLQS));
            whereClause += ' AND a.LQS >= @minLQS';
        }
        if (maxLQS) {
            request.input('maxLQS', sql.Decimal(5, 2), parseFloat(maxLQS));
            whereClause += ' AND a.LQS <= @maxLQS';
        }
        if (parentAsin) {
            request.input('parentAsin', sql.NVarChar, parentAsin);
            whereClause += ' AND a.ParentAsin = @parentAsin';
        }
        if (sku) {
            request.input('skuFilter', sql.NVarChar, `%${sku}%`);
            whereClause += ' AND a.Sku LIKE @skuFilter';
        }
        if (subBsrCategory) {
            request.input('subBsrCategory', sql.NVarChar, `%${subBsrCategory}%`);
            whereClause += ' AND a.SubBSRs LIKE @subBsrCategory';
        }
        if (minRating) {
            request.input('minRating', sql.Decimal(3, 2), parseFloat(minRating));
            whereClause += ' AND a.Rating >= @minRating';
        }
        if (maxRating) {
            request.input('maxRating', sql.Decimal(3, 2), parseFloat(maxRating));
            whereClause += ' AND a.Rating <= @maxRating';
        }
        if (minReviewCount) {
            request.input('minReviewCount', sql.Int, parseInt(minReviewCount));
            whereClause += ' AND a.ReviewCount >= @minReviewCount';
        }
        if (maxReviewCount) {
            request.input('maxReviewCount', sql.Int, parseInt(maxReviewCount));
            whereClause += ' AND a.ReviewCount <= @maxReviewCount';
        }

        // LQS Breakdown Filters
        if (minTitleScore) whereClause += ' AND a.TitleScore >= ' + parseFloat(minTitleScore);
        if (maxTitleScore) whereClause += ' AND a.TitleScore <= ' + parseFloat(maxTitleScore);
        if (minBulletScore) whereClause += ' AND a.BulletScore >= ' + parseFloat(minBulletScore);
        if (maxBulletScore) whereClause += ' AND a.BulletScore <= ' + parseFloat(maxBulletScore);
        if (minImageScore) whereClause += ' AND a.ImageScore >= ' + parseFloat(minImageScore);
        if (maxImageScore) whereClause += ' AND a.ImageScore <= ' + parseFloat(maxImageScore);
        if (minDescriptionScore) whereClause += ' AND a.DescriptionScore >= ' + parseFloat(minDescriptionScore);
        if (maxDescriptionScore) whereClause += ' AND a.DescriptionScore <= ' + parseFloat(maxDescriptionScore);

        // Tags filter
        if (tags && tags.length > 0) {
            const tagList = Array.isArray(tags) ? tags : [tags];
            const tagConditions = tagList.map((t, i) => {
                const paramName = `tag_${i}`;
                request.input(paramName, sql.NVarChar, `%${t}%`);
                return `a.Tags LIKE @${paramName}`;
            });
            whereClause += ` AND (${tagConditions.join(' OR ')})`;
        }

        // Date Range (CreatedAt or LastScrapedAt based on context)
        if (dateRange === 'today') whereClause += ' AND CONVERT(DATE, a.LastScrapedAt) = CONVERT(DATE, GETDATE())';
        else if (dateRange === 'yesterday') whereClause += ' AND CONVERT(DATE, a.LastScrapedAt) = CONVERT(DATE, DATEADD(DAY, -1, GETDATE()))';
        else if (dateRange === '7days') whereClause += ' AND a.LastScrapedAt >= DATEADD(DAY, -7, GETDATE())';
        else if (dateRange === '30days') whereClause += ' AND a.LastScrapedAt >= DATEADD(DAY, -30, GETDATE())';
        else if (dateRange === '90days') whereClause += ' AND a.LastScrapedAt >= DATEADD(DAY, -90, GETDATE())';
        else if (dateRange && typeof dateRange === 'object' && dateRange.start) {
            request.input('dateStart', sql.DateTime2, new Date(dateRange.start));
            whereClause += ' AND a.LastScrapedAt >= @dateStart';
            if (dateRange.end) {
                const dEnd = new Date(dateRange.end);
                dEnd.setHours(23, 59, 59, 999);
                request.input('dateEnd', sql.DateTime2, dEnd);
                whereClause += ' AND a.LastScrapedAt <= @dateEnd';
            }
        }

        await updateDownloadStatus(pool, downloadId, 'processing', 20);

        // BUILD FIELD LIST - Map frontend field keys to actual SQL columns
        const sqlFieldMapping = {
            'asinCode': 'a.AsinCode',
            'parentAsin': 'a.ParentAsin',
            'sku': 'a.Sku',
            'title': 'a.Title',
            'brand': 'a.Brand',
            'category': 'a.Category',
            'status': 'a.Status',
            'scrapeStatus': 'a.ScrapeStatus',
            'currentPrice': 'a.CurrentPrice',
            'mrp': 'a.Mrp',
            'dealBadge': 'a.DealBadge',
            'priceType': 'a.PriceType',
            'discountPercentage': 'a.DiscountPercentage',
            'secondAsp': 'a.SecondAsp',
            'aspDifference': 'a.AspDifference',
            'bsr': 'a.BSR',
            'subBsr': 'a.SubBsr',
            'subBSRs': 'a.SubBSRs',
            'rating': 'a.Rating',
            'reviewCount': 'a.ReviewCount',
            'ratingBreakdown': 'a.RatingBreakdown',
            'lqs': 'a.LQS',
            'titleScore': 'a.TitleScore',
            'bulletScore': 'a.BulletScore',
            'imageScore': 'a.ImageScore',
            'descriptionScore': 'a.DescriptionScore',
            'cdq': 'a.Cdq',
            'cdqGrade': 'a.CdqGrade',
            'buyBoxWin': 'a.BuyBoxWin',
            'soldBy': 'a.SoldBy',
            'soldBySec': 'a.SoldBySec',
            'allOffers': 'a.AllOffers',
            'hasAplus': 'a.HasAplus',
            'imagesCount': 'a.ImagesCount',
            'videoCount': 'a.VideoCount',
            'bulletPoints': 'a.BulletPoints',
            'bulletPointsText': 'a.BulletPointsText',
            'availabilityStatus': 'a.AvailabilityStatus',
            'stockLevel': 'a.StockLevel',
            'aplusAbsentSince': 'a.AplusAbsentSince',
            'lastScraped': 'a.LastScrapedAt',
            'createdAt': 'a.CreatedAt',
            'updatedAt': 'a.UpdatedAt',
            'tags': 'a.Tags',
            'releaseDate': 'a.ReleaseDate',
            'sellerName': 's.Name'
        };

        // Build SELECT columns
        const selectColumns = fields.map(f => sqlFieldMapping[f] || `a.${f}`).join(', ');
        const selectQuery = `
            SELECT ${selectColumns}, s.Name as sellerName
            FROM Asins a
            LEFT JOIN Sellers s ON a.SellerId = s.Id
            ${whereClause}
            ORDER BY a.AsinCode ASC
        `;

        console.log(`📊 [Export] Running query for ${fields.length} fields`);
        const result = await request.query(selectQuery);
        const asins = result.recordset;

        console.log(`📊 [Export] Query returned ${asins.length} rows`);

        await updateDownloadStatus(pool, downloadId, 'processing', 40);

        // Map label mapping
        const labelMapping = {};
        ALL_ASIN_FIELDS.forEach(f => { labelMapping[f.key] = f.label; });
        labelMapping['sellerName'] = 'Seller Name';

        const exportData = asins.map(row => {
            const item = {};
            fields.forEach(field => {
                const label = labelMapping[field] || field;
                
                // Get value using exact field name from SQL
                let value = row[field];
                if (value === undefined) {
                    // Try to find the matching column from SQL result
                    const colName = sqlFieldMapping[field];
                    if (colName) {
                        const simpleCol = colName.includes('.') ? colName.split('.')[1] : colName;
                        value = row[simpleCol];
                    }
                }
                
                // Special field handling
                if (field === 'buyBoxWin' || field === 'hasAplus') {
                    value = (value === 1 || value === true || value === 'true') ? 'Yes' : 'No';
                } else if (field === 'tags' || field === 'Tags') {
                    try { 
                        const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
                        value = Array.isArray(parsed) ? parsed.join(', ') : parsed;
                    } catch { value = value || ''; }
                } else if (field === 'subBSRs' || field === 'SubBSRs') {
                    try {
                        const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
                        value = Array.isArray(parsed) ? parsed.map(b => `${b.category}: ${b.rank}`).join(' | ') : value;
                    } catch { value = value || ''; }
                } else if (field === 'ratingBreakdown' || field === 'RatingBreakdown') {
                    try {
                        const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
                        value = Object.entries(parsed).map(([star, pct]) => `${star}: ${pct}`).join(', ');
                    } catch { value = ''; }
                } else if (['createdAt', 'updatedAt', 'lastScraped', 'CreatedAt', 'UpdatedAt', 'LastScrapedAt', 'ReleaseDate'].includes(field)) {
                    if (value) value = new Date(value).toLocaleString('en-IN');
                } else if (field === 'sellerName') {
                    value = row.sellerName || '';
                } else if (field === 'bulletPointsText' || field === 'BulletPointsText') {
                    try {
                        const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
                        value = Array.isArray(parsed) ? parsed.join(' | ') : value;
                    } catch { value = value || ''; }
                }

                // --- CLEANING & DECODING ---
                if (typeof value === 'string') {
                    value = value
                        .replace(/&amp;/g, '&')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        // Remove control characters and non-printable chars that break CSV
                        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
                        .trim();
                }

                item[label] = (value === null || value === undefined) ? '' : value;
            });
            return item;
        });

        await updateDownloadStatus(pool, downloadId, 'processing', 70);

        const resultDownloads = await pool.request()
            .input('id', sql.VarChar, downloadId)
            .query('SELECT FileName FROM Downloads WHERE Id = @id');
        const fileName = resultDownloads.recordset[0]?.FileName || `asin_export_${downloadId}.${format}`;
        
        // Generate file
        const filePath = path.join(EXPORTS_DIR, `${downloadId}_${fileName}`);
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ASINs');

        // Set column widths (approximate)
        const range = XLSX.utils.decode_range(ws['!ref']);
        ws['!cols'] = Array(range.e.c + 1).fill({ wch: 15 });
        if (ws['!cols'][3]) ws['!cols'][3] = { wch: 40 }; // Title usually wider

        if (format === 'csv') {
            const csvData = XLSX.utils.sheet_to_csv(ws, { 
                forceQuotes: true,
                RS: '\r\n'
            });
            // Add BOM (Byte Order Mark) for Excel UTF-8 recognition
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
                fileName: fileName,
                rowCount: exportData.length,
                fileSize: stats.size
            });
        }

        console.log(`✅ Export completed: ${downloadId} (${exportData.length} rows)`);

    } catch (error) {
        console.error(`❌ Export job ${downloadId} failed:`, error);
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
