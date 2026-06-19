const { sql, getPool, generateId } = require('../database/db');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
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
    { key: 'uploadedPrice', label: 'Master Price (₹)', category: 'Pricing' },
    { key: 'currentPrice', label: 'Current Price (₹)', category: 'Pricing' },
    { key: 'mrp', label: 'MRP (₹)', category: 'Pricing' },
    { key: 'dealBadge', label: 'Deal Badge', category: 'Pricing' },
    { key: 'priceType', label: 'Price Type', category: 'Pricing' },
    { key: 'discountPercentage', label: 'Discount %', category: 'Pricing' },
    { key: 'secondAsp', label: 'Second ASP (₹)', category: 'Pricing' },
    { key: 'aspDifference', label: 'ASP Difference (₹)', category: 'Pricing' },
    { key: 'bsr', label: 'Best Seller Rank', category: 'Performance' },
    { key: 'totalOrders', label: 'Total Orders', category: 'Performance' },
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
    // { key: 'cdq', label: 'CDQ Score', category: 'Performance' },
    // { key: 'cdqGrade', label: 'CDQ Grade', category: 'Performance' },
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
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
        const dateStr = istTime.toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const fileName = `asin_export_${dateStr}.${format}`;
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
                VALUES (@id, @userId, @fileName, @filePath, @format, @status, @params, dbo.GetEnvDate())
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
                role: u.RoleName === 'super_admin' ? 'admin' : u.RoleName,
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
            maxDescriptionScore,
            priceDispute,
            asinIds = []
        } = params;

        const request = pool.request();
        let whereClause = 'WHERE 1=1';

        // RBAC / Seller Filtering
        const roleName = user?.role || '';
        const isGlobalUser = ['admin', 'operational_manager', 'Listing Manager'].includes(roleName);

        if (!isGlobalUser) {
            const assignedIds = user?.assignedSellers || [];
            if (assignedIds.length === 0) {
                whereClause += ' AND 1=0';
            } else {
                whereClause += ` AND a.SellerId IN (${assignedIds.map(id => `'${id}'`).join(',')})`;
            }

            // Further restrict by requested sellers if provided (intersection)
            if (sellerIds.length > 0) {
                const allowedSellerIds = sellerIds.filter(id => assignedIds.includes(id));
                if (allowedSellerIds.length > 0) {
                    whereClause += ` AND a.SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
                } else {
                    whereClause += ' AND 1=0'; // Requested sellers not in assigned list
                }
            }
        } else if (!allSellers && sellerIds.length > 0) {
            // Admins filtering by specific sellers
            whereClause += ` AND a.SellerId IN (${sellerIds.map(id => `'${id}'`).join(',')})`;
        }

        if (asinIds.length > 0) {
            whereClause += ` AND a.Id IN (${asinIds.map(id => `'${id}'`).join(',')})`;
        }

        console.log(`🔍 [Export] Generated Where Clause: ${whereClause}`);
        if (asinIds.length > 0) console.log(`🔍 [Export] Specific ASINs requested: ${asinIds.length}`);

        // Apply advanced filters (Always apply these even if specific sellers are selected)
        if (asinIds.length === 0) {
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
            if (priceDispute !== undefined && priceDispute !== '' && priceDispute !== null) {
                if (priceDispute === 'true' || priceDispute === true) {
                    // Price dispute: > ₹5 difference and no deal badge
                    whereClause += " AND (ABS(a.UploadedPrice - a.CurrentPrice) > 5 AND a.UploadedPrice > 0 AND a.CurrentPrice > 0 AND (a.DealBadge IS NULL OR a.DealBadge = '' OR a.DealBadge = 'No deal found'))";
                } else {
                    // No dispute: within ₹5, or no uploaded price, or has deal badge
                    whereClause += " AND (ABS(a.UploadedPrice - a.CurrentPrice) <= 5 OR a.UploadedPrice <= 0 OR a.CurrentPrice <= 0 OR (a.DealBadge IS NOT NULL AND a.DealBadge != '' AND a.DealBadge != 'No deal found'))";
                }
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
            if (tags && (Array.isArray(tags) ? tags.length > 0 : tags)) {
                const tagList = Array.isArray(tags) ? tags : [tags];
                tagList.forEach((t, i) => {
                    const paramName = `tag_${i}`;
                    request.input(paramName, sql.NVarChar, `%${t.trim()}%`);
                    whereClause += ` AND a.Tags LIKE @${paramName}`;
                });
            }

            // Date Range (CreatedAt or LastScrapedAt based on context)
            if (dateRange === 'today') whereClause += ' AND CONVERT(DATE, a.LastScrapedAt) = CONVERT(DATE, dbo.GetEnvDate())';
            else if (dateRange === 'yesterday') whereClause += ' AND CONVERT(DATE, a.LastScrapedAt) = CONVERT(DATE, DATEADD(DAY, -1, dbo.GetEnvDate()))';
            else if (dateRange === '7days') whereClause += ' AND a.LastScrapedAt >= DATEADD(DAY, -7, dbo.GetEnvDate())';
            else if (dateRange === '30days') whereClause += ' AND a.LastScrapedAt >= DATEADD(DAY, -30, dbo.GetEnvDate())';
            else if (dateRange === '90days') whereClause += ' AND a.LastScrapedAt >= DATEADD(DAY, -90, dbo.GetEnvDate())';
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
            'uploadedPrice': 'a.UploadedPrice',
            'currentPrice': 'a.CurrentPrice',
            'mrp': 'a.Mrp',
            'dealBadge': 'a.DealBadge',
            'priceDispute': 'a.PriceDispute',
            'priceType': 'a.PriceType',
            'discountPercentage': 'a.DiscountPercentage',
            'secondAsp': 'a.SecondAsp',
            'aspDifference': 'a.AspDifference',
            'bsr': 'a.BSR',
            'totalOrders': '(SELECT SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) FROM AdsPerformance WHERE Asin = a.AsinCode)',
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
            // 'cdq': 'a.Cdq',
            // 'cdqGrade': 'a.CdqGrade',
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

        // Build SELECT columns with aliases to match frontend camelCase keys
        const selectColumns = fields.map(f => {
            const sqlField = sqlFieldMapping[f] || `a.${f}`;
            return `${sqlField} AS [${f}]`;
        }).join(', ');

        let selectQuery = '';
        let sortedDates = [];
        const headers = [];

        // Build label mapping for standard live export
        const labelMapping = {};
        ALL_ASIN_FIELDS.forEach(f => { labelMapping[f.key] = f.label; });
        labelMapping['sellerName'] = 'Seller Name';

        if (params.isHistorical) {
            // Replace a.LastScrapedAt with ah.Date in whereClause
            const dateWhereClause = whereClause.replace(/a\.LastScrapedAt/g, 'ah.Date');

            // Fetch unique dates first
            const datesQuery = `
                SELECT DISTINCT CONVERT(varchar, ah.Date, 23) as [Date]
                FROM AsinHistory ah
                JOIN Asins a ON ah.AsinId = a.Id
                LEFT JOIN Sellers s ON a.SellerId = s.Id
                ${dateWhereClause}
                ORDER BY [Date] ASC
            `;
            const datesResult = await pool.request().query(datesQuery);
            sortedDates = datesResult.recordset.map(r => r.Date);

            // Construct headers
            headers.push('ASIN Code', 'Product Title', 'Brand');
            const metrics = [
                { key: 'Price (₹)', name: 'Price (₹)', metricKey: 'Price' },
                { key: 'Best Seller Rank', name: 'BSR', metricKey: 'BSR' },
                { key: 'Rating', name: 'Rating', metricKey: 'Rating' },
                { key: 'Review Count', name: 'Reviews', metricKey: 'ReviewCount' },
                { key: 'BuyBox Winner', name: 'BuyBox Win', metricKey: 'BuyBoxWinner' },
                { key: 'Stock Level', name: 'Stock', metricKey: 'StockLevel' },
                { key: 'LQS Score', name: 'LQS', metricKey: 'LQS' }
            ];

            metrics.forEach(m => {
                sortedDates.forEach(d => {
                    headers.push(`${m.name} [${d}]`);
                });
            });

            selectQuery = `
                SELECT 
                  CONVERT(varchar, ah.Date, 23) as [Date],
                  a.AsinCode as [ASIN Code],
                  a.Title as [Product Title],
                  s.Name as [Brand],
                  ah.Price as [Price],
                  ah.BSR as [BSR],
                  ah.Rating as [Rating],
                  ah.ReviewCount as [ReviewCount],
                  CASE WHEN ah.BuyBoxStatus = 1 THEN 'Yes' ELSE 'No' END as [BuyBoxWinner],
                  ah.StockLevel as [StockLevel],
                  ah.LQS as [LQS]
                FROM AsinHistory ah
                JOIN Asins a ON ah.AsinId = a.Id
                LEFT JOIN Sellers s ON a.SellerId = s.Id
                ${dateWhereClause}
                ORDER BY a.AsinCode ASC, ah.Date ASC
            `;
        } else {
            // Join totalOrders subquery if requested to optimize performance
            let fromClause = 'FROM Asins a LEFT JOIN Sellers s ON a.SellerId = s.Id';
            if (fields.includes('totalOrders')) {
                fromClause += ` LEFT JOIN (
                    SELECT Asin, SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) as totalOrders
                    FROM AdsPerformance
                    GROUP BY Asin
                ) op ON a.AsinCode = op.Asin`;
            }

            // Map headers
            fields.forEach(f => {
                headers.push(labelMapping[f] || f);
            });

            selectQuery = `
                SELECT ${selectColumns}, s.Name as sellerName
                ${fromClause}
                ${whereClause}
                ORDER BY a.AsinCode ASC
            `;
        }

        console.log(`📊 [Export] Running query: ${selectQuery.substring(0, 500)}${selectQuery.length > 500 ? '...' : ''}`);
        await updateDownloadStatus(pool, downloadId, 'processing', 30);

        const resultDownloads = await pool.request()
            .input('id', sql.VarChar, downloadId)
            .query('SELECT FileName FROM Downloads WHERE Id = @id');
        const fileName = resultDownloads.recordset[0]?.FileName || `asin_export_${downloadId}.${format}`;
        const filePath = path.join(EXPORTS_DIR, `${downloadId}_${fileName}`);

        // Define stream writer helpers
        const formatCSVRow = (fieldsArray) => {
            return fieldsArray.map(val => {
                if (val === null || val === undefined) return '""';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            }).join(',') + '\r\n';
        };

        const cleanStringValue = (value) => {
            if (typeof value === 'string') {
                return value
                    .replace(/&amp;/g, '&')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
                    .trim();
            }
            return value;
        };

        const mapAsinRow = (row, fieldsList) => {
            const item = {};
            fieldsList.forEach(field => {
                const label = labelMapping[field] || field;
                let value = row[field];
                if (value === undefined) {
                    const colName = sqlFieldMapping[field];
                    if (colName) {
                        const simpleCol = colName.includes('.') ? colName.split('.')[1] : colName;
                        value = row[simpleCol];
                    }
                }

                if (field === 'brand' || field === 'Brand') {
                    value = row.sellerName || row.SellerName || row.brand || row.Brand || '';
                } else if (field === 'buyBoxWin' || field === 'hasAplus') {
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
                } else if (field === 'sellerName' || field === 'SellerName') {
                    value = row.sellerName || row.SellerName || '';
                } else if (field === 'bulletPointsText' || field === 'BulletPointsText') {
                    try {
                        const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
                        value = Array.isArray(parsed) ? parsed.join(' | ') : value;
                    } catch { value = value || ''; }
                }

                item[label] = (value === null || value === undefined) ? '' : cleanStringValue(value);
            });
            return item;
        };

        let writer;
        let csvStream;
        let workbook;
        let worksheet;
        let rowCount = 0;
        
        const borderStyle = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        if (format === 'csv') {
            csvStream = fs.createWriteStream(filePath, { encoding: 'utf8' });
            csvStream.write('\uFEFF');
            writer = {
                writeHeader: (headersArray) => {
                    csvStream.write(formatCSVRow(headersArray));
                },
                addRow: (rowObj) => {
                    rowCount++;
                    const values = headers.map(h => rowObj[h]);
                    csvStream.write(formatCSVRow(values));
                },
                commit: async () => {
                    return new Promise((resolve, reject) => {
                        csvStream.end(err => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                }
            };
        } else {
            workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
                filename: filePath,
                useStyles: true,
                useSharedStrings: true
            });
            worksheet = workbook.addWorksheet('ASINs');
            writer = {
                writeHeader: (headersArray) => {
                    worksheet.columns = headersArray.map(h => ({
                        header: h,
                        key: h,
                        width: h.includes('Title') ? 40 : 18
                    }));
                    
                    const headerRow = worksheet.getRow(1);
                    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    headerRow.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF1E293B' }
                    };
                    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
                    headerRow.height = 24;
                    headerRow.commit();
                },
                addRow: (rowObj) => {
                    rowCount++;
                    const row = worksheet.addRow(rowObj);
                    row.eachCell(cell => {
                        cell.border = borderStyle;
                    });
                    row.commit();
                },
                commit: async () => {
                    await workbook.commit();
                }
            };
        }

        // Execute query in stream mode
        await new Promise((resolve, reject) => {
            const selectRequest = pool.request();
            Object.keys(request.parameters).forEach(key => {
                const param = request.parameters[key];
                selectRequest.input(key, param.type, param.value);
            });
            
            selectRequest.stream = true;
            
            let currentAsin = null;
            let currentAsinData = null;
            let headersWritten = false;
            
            const metrics = [
                { key: 'Price (₹)', name: 'Price (₹)', metricKey: 'Price' },
                { key: 'Best Seller Rank', name: 'BSR', metricKey: 'BSR' },
                { key: 'Rating', name: 'Rating', metricKey: 'Rating' },
                { key: 'Review Count', name: 'Reviews', metricKey: 'ReviewCount' },
                { key: 'BuyBox Winner', name: 'BuyBox Win', metricKey: 'BuyBoxWinner' },
                { key: 'Stock Level', name: 'Stock', metricKey: 'StockLevel' },
                { key: 'LQS Score', name: 'LQS', metricKey: 'LQS' }
            ];

            selectRequest.on('row', row => {
                try {
                    if (params.isHistorical) {
                        if (!headersWritten) {
                            writer.writeHeader(headers);
                            headersWritten = true;
                        }
                        
                        const asin = row['ASIN Code'];
                        if (asin !== currentAsin) {
                            if (currentAsinData) {
                                const finalObj = {
                                    'ASIN Code': currentAsinData['ASIN Code'],
                                    'Product Title': currentAsinData['Product Title'],
                                    'Brand': currentAsinData['Brand']
                                };
                                metrics.forEach(m => {
                                    sortedDates.forEach(d => {
                                        const val = currentAsinData._dates.get(d);
                                        finalObj[`${m.name} [${d}]`] = (val !== undefined && val !== null) ? val : '';
                                    });
                                });
                                writer.addRow(finalObj);
                            }
                            
                            currentAsin = asin;
                            currentAsinData = {
                                'ASIN Code': asin,
                                'Product Title': row['Product Title'] || '',
                                'Brand': row['Brand'] || '',
                                _dates: new Map()
                            };
                        }
                        
                        metrics.forEach(m => {
                            const val = row[m.metricKey];
                            if (val !== undefined && val !== null) {
                                currentAsinData._dates.set(row['Date'], val);
                            }
                        });
                    } else {
                        if (!headersWritten) {
                            writer.writeHeader(headers);
                            headersWritten = true;
                        }
                        const mappedRow = mapAsinRow(row, fields);
                        writer.addRow(mappedRow);
                    }
                } catch (e) {
                    selectRequest.emit('error', e);
                }
            });
            
            selectRequest.on('error', err => {
                reject(err);
            });
            
            selectRequest.on('done', async result => {
                try {
                    if (params.isHistorical && currentAsinData) {
                        const finalObj = {
                            'ASIN Code': currentAsinData['ASIN Code'],
                            'Product Title': currentAsinData['Product Title'],
                            'Brand': currentAsinData['Brand']
                        };
                        metrics.forEach(m => {
                            sortedDates.forEach(d => {
                                const val = currentAsinData._dates.get(d);
                                finalObj[`${m.name} [${d}]`] = (val !== undefined && val !== null) ? val : '';
                            });
                        });
                        writer.addRow(finalObj);
                    }
                    
                    if (!headersWritten) {
                        writer.writeHeader(headers);
                    }
                    
                    await writer.commit();
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
            
            selectRequest.query(selectQuery);
        });

        await updateDownloadStatus(pool, downloadId, 'processing', 90);
        const stats = fs.statSync(filePath);

        // Update download record as completed
        await pool.request()
            .input('id', sql.VarChar, downloadId)
            .input('fileSize', sql.BigInt, stats.size)
            .input('rowCount', sql.Int, rowCount)
            .query(`
                UPDATE Downloads SET 
                    Status = 'completed',
                    Progress = 100,
                    FileSize = @fileSize,
                    [RowCount] = @rowCount,
                    FilePath = '/exports/' + (SELECT FileName FROM Downloads WHERE Id = @id),
                    CompletedAt = dbo.GetEnvDate(),
                    ExpiresAt = DATEADD(HOUR, 24, dbo.GetEnvDate())
                WHERE Id = @id
            `);

        // Notify user via socket
        const io = SocketService.getIo();
        if (io) {
            io.to(`user_${userId}`).emit('export_completed', {
                downloadId,
                fileName: fileName,
                rowCount: rowCount,
                fileSize: stats.size
            });
        }

        console.log(`✅ Export completed: ${downloadId} (${rowCount} rows)`);

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

        // Broadcast progress in real-time via Socket.io
        SocketService.emitExportUpdate(id, { status, progress, errorMessage });
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
 * Get status of a specific download
 * GET /api/export/status/:id
 */
exports.getExportStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = (req.user?._id || req.user?.id || '').toString();
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, id)
            .input('userId', sql.VarChar, userId)
            .query('SELECT Status, Progress, FileName, ErrorMessage FROM Downloads WHERE Id = @id AND UserId = @userId');

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'Download not found' });
        }

        res.json({ success: true, data: result.recordset[0] });
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
            .query('UPDATE Downloads SET DownloadCount = DownloadCount + 1, DownloadedAt = dbo.GetEnvDate() WHERE Id = @id');

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
            .query("SELECT Id, FilePath FROM Downloads WHERE Status = 'completed' AND ExpiresAt < dbo.GetEnvDate()");

        for (const download of result.recordset) {
            // Delete file
            const exportDir = path.join(__dirname, '../uploads/exports');
            const files = fs.readdirSync(exportDir).filter(f => f.includes(download.Id));
            files.forEach(f => {
                try { fs.unlinkSync(path.join(exportDir, f)); } catch (e) { }
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

/**
 * Start a GMS performance matrix export job
 * POST /api/export/start-gms
 */
exports.startGmsExport = async (req, res) => {
    try {
        const {
            exportLevel = 'asin',
            exportDateType = 'all',
            exportCustomDates = null,
            exportBrandType = 'all',
            exportCustomBrands = [],
            startDate = null,
            endDate = null,
            selectedBrands = []
        } = req.body;

        const userId = (req.user?._id || req.user?.id || '').toString();
        const pool = await getPool();

        // Create download record
        const downloadId = generateId();
        const now = new Date();
        const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
        const dateStr = istTime.toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const fileName = `gms_export_${exportLevel}_${dateStr}.xlsx`;
        const filePath = path.join(EXPORTS_DIR, `${downloadId}_${fileName}`);

        await pool.request()
            .input('id', sql.VarChar, downloadId)
            .input('userId', sql.VarChar, userId)
            .input('fileName', sql.NVarChar, fileName)
            .input('filePath', sql.NVarChar, filePath)
            .input('format', sql.NVarChar, 'xlsx')
            .input('status', sql.NVarChar, 'pending')
            .input('params', sql.NVarChar, JSON.stringify(req.body))
            .query(`
                INSERT INTO Downloads (Id, UserId, FileName, FilePath, Format, Status, Params, CreatedAt)
                VALUES (@id, @userId, @fileName, @filePath, @format, @status, @params, dbo.GetEnvDate())
            `);

        // Return immediately with download ID
        res.json({
            success: true,
            message: 'GMS export started',
            downloadId,
            fileName
        });

        // Run background job
        processGmsExportJob(downloadId, req.body, userId).catch(err => {
            console.error(`GMS Export job ${downloadId} failed:`, err);
            updateDownloadStatus(pool, downloadId, 'failed', 0, err.message).catch(console.error);
        });

    } catch (error) {
        console.error('Start GMS Export Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getISOWeek = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return {
        year: d.getUTCFullYear(),
        week: weekNo
    };
};

const getWeekRangeLabel = (year, week) => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) {
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    const Monday = new Date(ISOweekStart);
    const Sunday = new Date(ISOweekStart);
    Sunday.setDate(Monday.getDate() + 6);
    
    const options = { day: '2-digit', month: 'short' };
    const startStr = Monday.toLocaleDateString('en-IN', options);
    const endStr = Sunday.toLocaleDateString('en-IN', options);
    return `Week ${week} (${startStr} - ${endStr})`;
};

const getGmsTrend = (row, type, rawGmsMap, level = 'asin') => {
    let currentVal = 0;
    let previousVal = 0;

    const entityKey = level === 'seller' ? row.dbBrand : row.asin;
    const entityData = rawGmsMap[entityKey];
    if (!entityData) return null;

    if (type === 'month') {
        const months = Object.keys(row.monthlyRev).sort();
        if (months.length < 1) return null;
        const latestMonth = months[months.length - 1];
        currentVal = row.monthlyRev[latestMonth] || 0;

        const [year, month] = latestMonth.split('-').map(Number);
        const prevMonthDate = new Date(year, month - 2, 1);
        const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);
        
        previousVal = entityData.monthly[prevMonthStr] || 0;
    } else if (type === 'week') {
        const weeks = Object.keys(row.weeklyRev).sort();
        if (weeks.length < 1) return null;
        const latestWeek = weeks[weeks.length - 1];
        currentVal = row.weeklyRev[latestWeek] || 0;

        const [year, weekStr] = latestWeek.split('-W');
        const yVal = parseInt(year);
        const wVal = parseInt(weekStr);
        
        let prevW = wVal - 1;
        let prevY = yVal;
        if (prevW === 0) {
            prevY -= 1;
            const d = new Date(prevY, 11, 28);
            prevW = getISOWeek(d).week;
        }
        const prevWeekKey = `${prevY}-W${String(prevW).padStart(2, '0')}`;

        previousVal = entityData.weekly[prevWeekKey] || 0;
    } else if (type === 'day') {
        const days = Object.keys(row.dailyRev).sort();
        if (days.length < 1) return null;
        const latestDay = days[days.length - 1];
        currentVal = row.dailyRev[latestDay] || 0;

        const prevDayDate = new Date(new Date(latestDay).getTime() - 86400000);
        const prevDayStr = prevDayDate.toISOString().split('T')[0];
        
        previousVal = entityData.daily[prevDayStr] || 0;
    }

    if (!previousVal) return null;
    return ((currentVal - previousVal) / previousVal) * 100;
};

async function processGmsExportJob(downloadId, params, userId) {
    const pool = await getPool();
    await updateDownloadStatus(pool, downloadId, 'processing', 10);

    const {
        exportLevel = 'asin',
        exportDateType = 'all',
        exportCustomDates = null,
        exportBrandType = 'all',
        exportCustomBrands = [],
        startDate = null,
        endDate = null,
        selectedBrands = []
    } = params;

    // Fetch user details for RBAC
    let user = null;
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
            role: u.RoleName === 'super_admin' ? 'admin' : u.RoleName,
            assignedSellers: []
        };

        // Fetch assigned sellers
        const sellersResult = await pool.request()
            .input('userId', sql.VarChar, userId)
            .query('SELECT SellerId FROM UserSellers WHERE UserId = @userId');
        user.assignedSellers = sellersResult.recordset.map(s => s.SellerId);
    }

    const roleName = user?.role || '';
    const isGlobalUser = ['admin', 'operational_manager', 'Listing Manager'].includes(roleName);
    let whereClause = 'WHERE 1=1';

    if (!isGlobalUser) {
        const assignedIds = user?.assignedSellers || [];
        if (assignedIds.length === 0) {
            whereClause += ' AND 1=0';
        } else {
            whereClause += ` AND a.SellerId IN (${assignedIds.map(id => `'${id}'`).join(',')})`;
        }
    }

    await updateDownloadStatus(pool, downloadId, 'processing', 20);

    const result = await pool.request().query(`
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
      ${whereClause}
      ORDER BY g.Date DESC
    `);

    // Format dates to YYYY-MM-DD avoiding timezone issues
    const rawGmsData = result.recordset.map(row => {
      if (!row.date) return { ...row, date: null };
      const d = new Date(row.date);
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localDate = new Date(d.getTime() - tzOffset);
      return {
        ...row,
        date: localDate.toISOString().split('T')[0],
        resolvedDbBrand: row.dbBrand || '-'
      };
    });

    // Build a fast lookup map for all raw GMS data
    const rawGmsMap = {};
    rawGmsData.forEach(d => {
      const isUnmatched = !d.resolvedDbBrand || d.resolvedDbBrand === '-';
      const entityKey = exportLevel === 'seller'
        ? (!isUnmatched ? d.resolvedDbBrand : (d.brand || '-'))
        : d.asin;
        
      if (!rawGmsMap[entityKey]) {
        rawGmsMap[entityKey] = {
          daily: {},
          weekly: {},
          monthly: {}
        };
      }
      
      const dObj = new Date(d.date);
      const dateStr = d.date;
      if (!dateStr) return;
      const monthKey = dateStr.slice(0, 7);
      const { year: wYear, week: wWeek } = getISOWeek(dObj);
      const weekKey = `${wYear}-W${String(wWeek).padStart(2, '0')}`;
      
      const entityData = rawGmsMap[entityKey];
      
      // Daily
      if (!entityData.daily[dateStr]) entityData.daily[dateStr] = 0;
      entityData.daily[dateStr] += d.orderedRevenue || 0;
      
      // Weekly
      if (!entityData.weekly[weekKey]) entityData.weekly[weekKey] = 0;
      entityData.weekly[weekKey] += d.orderedRevenue || 0;
      
      // Monthly
      if (!entityData.monthly[monthKey]) entityData.monthly[monthKey] = 0;
      entityData.monthly[monthKey] += d.orderedRevenue || 0;
    });

    await updateDownloadStatus(pool, downloadId, 'processing', 35);

    let dataToExport = rawGmsData;

    // Date range filtering
    if (exportDateType === 'current' && startDate && endDate) {
      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      dataToExport = dataToExport.filter(d => {
        const dDate = new Date(d.date);
        return dDate >= sDate && dDate <= eDate;
      });
    } else if (exportDateType === 'custom' && exportCustomDates && exportCustomDates[0] && exportCustomDates[1]) {
      const sDate = new Date(exportCustomDates[0]);
      const eDate = new Date(exportCustomDates[1]);
      dataToExport = dataToExport.filter(d => {
        const dDate = new Date(d.date);
        return dDate >= sDate && dDate <= eDate;
      });
    }

    // Brand filtering
    if (exportBrandType === 'current' && selectedBrands.length > 0) {
      dataToExport = dataToExport.filter(d => 
        selectedBrands.includes(d.brand) || selectedBrands.includes(d.dbBrand)
      );
    } else if (exportBrandType === 'custom' && exportCustomBrands.length > 0) {
      dataToExport = dataToExport.filter(d => 
        exportCustomBrands.includes(d.brand) || exportCustomBrands.includes(d.dbBrand)
      );
    }

    if (dataToExport.length === 0) {
      throw new Error('No GMS data found for the selected export filters.');
    }

    await updateDownloadStatus(pool, downloadId, 'processing', 50);

    const matrixMap = {};
    dataToExport.forEach(d => {
      const isUnmatched = !d.resolvedDbBrand || d.resolvedDbBrand === '-';
      const key = exportLevel === 'seller'
        ? (!isUnmatched ? d.resolvedDbBrand : (d.brand || '-'))
        : d.asin;

      if (!matrixMap[key]) {
        if (exportLevel === 'seller') {
          matrixMap[key] = {
            dbBrand: key,
            isUnmatched: isUnmatched,
            asins: new Set(),
            brands: new Set(),
            storeCodes: new Set(),
            dailyRev: {},
            weeklyRev: {},
            monthlyRev: {}
          };
        } else {
          matrixMap[key] = {
            asin: d.asin,
            productTitle: d.productTitle || '-',
            dbBrand: d.resolvedDbBrand || '-',
            brand: d.brand || 'Generic',
            storeCode: d.storeCode || 'IN',
            dailyRev: {},
            weeklyRev: {},
            monthlyRev: {}
          };
        }
      }

      const row = matrixMap[key];
      if (exportLevel === 'seller') {
        if (d.asin) row.asins.add(d.asin);
        if (d.brand) row.brands.add(d.brand);
        if (d.storeCode) row.storeCodes.add(d.storeCode);
      }

      const dObj = new Date(d.date);
      const dateStr = d.date;
      const monthKey = dateStr.slice(0, 7);
      const { year: wYear, week: wWeek } = getISOWeek(dObj);
      const weekKey = `${wYear}-W${String(wWeek).padStart(2, '0')}`;

      // Day Revenue
      if (!row.dailyRev[dateStr]) row.dailyRev[dateStr] = 0;
      row.dailyRev[dateStr] += d.orderedRevenue;

      // Week Revenue
      if (!row.weeklyRev[weekKey]) row.weeklyRev[weekKey] = 0;
      row.weeklyRev[weekKey] += d.orderedRevenue;

      // Month Revenue
      if (!row.monthlyRev[monthKey]) row.monthlyRev[monthKey] = 0;
      row.monthlyRev[monthKey] += d.orderedRevenue;
    });

    const matrixRows = Object.values(matrixMap).map(r => {
      if (exportLevel === 'seller') {
        return {
          ...r,
          asinsList: Array.from(r.asins),
          brandsList: Array.from(r.brands),
          storeCodesList: Array.from(r.storeCodes)
        };
      }
      return r;
    });

    const dates = [...new Set(dataToExport.map(d => d.date))].sort();
    const monthGroups = {};

    dates.forEach(dateStr => {
      const dObj = new Date(dateStr);
      const monthKey = dateStr.slice(0, 7);
      const monthLabel = dObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      const { year: wYear, week: wWeek } = getISOWeek(dObj);
      const weekKey = `${wYear}-W${String(wWeek).padStart(2, '0')}`;
      const weekLabel = getWeekRangeLabel(wYear, wWeek);

      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = {
          label: monthLabel,
          key: monthKey,
          weeks: {}
        };
      }

      if (!monthGroups[monthKey].weeks[weekKey]) {
        monthGroups[monthKey].weeks[weekKey] = {
          label: weekLabel,
          key: weekKey,
          days: []
        };
      }

      monthGroups[monthKey].weeks[weekKey].days.push(dateStr);
    });

    const columnDef = [];

    if (exportLevel === 'seller') {
      columnDef.push({ label: 'Seller (DB)', getValue: (r) => r.dbBrand });
      columnDef.push({ label: 'ASIN', getValue: () => '-' });
      columnDef.push({ label: 'Brand (Sheet)', getValue: (r) => r.brandsList && r.brandsList.length > 0 ? r.brandsList.join(', ') : '-' });
      columnDef.push({ label: 'Store Code', getValue: (r) => r.storeCodesList && r.storeCodesList.length > 0 ? r.storeCodesList.join(', ') : '-' });
    } else {
      columnDef.push({ label: 'Seller (DB)', getValue: (r) => r.dbBrand });
      columnDef.push({ label: 'ASIN', getValue: (r) => r.asin });
      columnDef.push({ label: 'Product Title', getValue: (r) => r.productTitle });
      columnDef.push({ label: 'Brand (Sheet)', getValue: (r) => r.brand });
      columnDef.push({ label: 'Store Code', getValue: (r) => r.storeCode });
    }

    Object.values(monthGroups).forEach(month => {
      Object.values(month.weeks).forEach(week => {
        const sortedDays = [...week.days].sort();
        sortedDays.forEach((dayStr, idx) => {
          const formattedDayLabel = new Date(dayStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
          columnDef.push({
            label: formattedDayLabel,
            getValue: (r) => r.dailyRev[dayStr] || 0
          });

          if (idx > 0) {
            const prevDayStr = sortedDays[idx - 1];
            const currDayStr = dayStr;
            const pDayNum = new Date(prevDayStr).getDate();
            const cDayNum = new Date(currDayStr).getDate();
            columnDef.push({
              label: `DoD (${pDayNum}->${cDayNum})`,
              getValue: (r) => {
                const prev = r.dailyRev[prevDayStr] || 0;
                const curr = r.dailyRev[currDayStr] || 0;
                if (!prev && !curr) return '-';
                if (!prev) return 'NEW';
                return `${(((curr - prev) / prev) * 100).toFixed(1)}%`;
              }
            });
          }
        });

        columnDef.push({
          label: `${week.label} Total`,
          getValue: (r) => r.weeklyRev[week.key] || 0
        });
        columnDef.push({
          label: `${week.label} WoW Trend`,
          getValue: (r) => {
            const trend = getGmsTrend(r, 'week', rawGmsMap, exportLevel);
            return trend === null ? '-' : `${trend.toFixed(1)}%`;
          }
        });
      });

      columnDef.push({
        label: `${month.label} Total`,
        getValue: (r) => r.monthlyRev[month.key] || 0
      });
      columnDef.push({
        label: `${month.label} MoM Trend`,
        getValue: (r) => {
          const trend = getGmsTrend(r, 'month', rawGmsMap, exportLevel);
          return trend === null ? '-' : `${trend.toFixed(1)}%`;
        }
      });
    });

    const sheetHeaders = columnDef.map(c => c.label);
    const sheetRows = matrixRows.map(row => columnDef.map(c => c.getValue(row)));

    await updateDownloadStatus(pool, downloadId, 'processing', 75);

    const fileName = `gms_export_${exportLevel}_${Date.now()}.xlsx`;
    const filePath = path.join(EXPORTS_DIR, `${downloadId}_${fileName}`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('GMS Matrix');
    
    if (sheetRows.length > 0) {
        worksheet.columns = sheetHeaders.map(label => ({
            header: label,
            width: label.includes('Product Title') || label.includes('Seller') || label.includes('Brand') ? 25 : 15
        }));
        
        sheetRows.forEach(rowArr => worksheet.addRow(rowArr));
        
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E293B' }
        };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 24;

        const borderStyle = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.eachCell(cell => {
                    cell.border = borderStyle;
                });
            }
        });
    }
    
    await workbook.xlsx.writeFile(filePath);
    const stats = fs.statSync(filePath);

    // Update download record as completed
    await pool.request()
        .input('id', sql.VarChar, downloadId)
        .input('fileSize', sql.BigInt, stats.size)
        .input('rowCount', sql.Int, sheetRows.length)
        .input('filePath', sql.VarChar, `/exports/${downloadId}_${fileName}`)
        .query(`
            UPDATE Downloads SET 
                Status = 'completed',
                Progress = 100,
                FileSize = @fileSize,
                [RowCount] = @rowCount,
                FilePath = @filePath,
                CompletedAt = dbo.GetEnvDate(),
                ExpiresAt = DATEADD(HOUR, 24, dbo.GetEnvDate())
            WHERE Id = @id
        `);

    SocketService.emitExportUpdate(downloadId, { status: 'completed', progress: 100, filePath: `/exports/${downloadId}_${fileName}` });
}

