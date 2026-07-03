const { sql, getPool, generateId } = require('../database/db');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const SocketService = require('../services/socketService');
const { buildInClause } = require('../utils/sqlHelpers');

const EXPORTS_DIR = path.join(__dirname, '../uploads/exports');

// Ensure exports directory exists
if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Available ASIN fields for export
const ALL_ASIN_FIELDS = [
    // Basic
    { key: 'asinCode', label: 'ASIN Code', category: 'Basic' },
    { key: 'parentAsin', label: 'Parent ASIN', category: 'Basic' },
    { key: 'sku', label: 'SKU', category: 'Basic' },
    { key: 'title', label: 'Product Title', category: 'Basic' },
    { key: 'brand', label: 'Brand', category: 'Basic' },
    { key: 'manufacturer', label: 'Manufacturer', category: 'Basic' },
    { key: 'category', label: 'Category', category: 'Basic' },
    { key: 'categoryPath', label: 'Category Path', category: 'Basic' },
    { key: 'status', label: 'Status', category: 'Basic' },
    { key: 'tags', label: 'Tags', category: 'Basic' },
    { key: 'marketplace', label: 'Marketplace', category: 'Basic' },
    { key: 'stapleLevel', label: 'Staple Level', category: 'Basic' },
    { key: 'weight', label: 'Weight', category: 'Basic' },
    { key: 'dimensions', label: 'Dimensions', category: 'Basic' },
    { key: 'scrapedAsin', label: 'Scraped ASIN', category: 'Basic' },
    // Pricing
    { key: 'uploadedPrice', label: 'Master Price (₹)', category: 'Pricing' },
    { key: 'currentPrice', label: 'Current Price (₹)', category: 'Pricing' },
    { key: 'mrp', label: 'MRP (₹)', category: 'Pricing' },
    { key: 'dealBadge', label: 'Deal Badge', category: 'Pricing' },
    { key: 'dealStartTime', label: 'Deal Start Date', category: 'Pricing' },
    { key: 'dealEndTime', label: 'Deal End Date', category: 'Pricing' },
    { key: 'dealAccessType', label: 'Deal Access Type', category: 'Pricing' },
    { key: 'hasDeal', label: 'Has Deal', category: 'Pricing' },
    { key: 'dealType', label: 'Deal Type', category: 'Pricing' },
    { key: 'dealPercentClaimed', label: 'Deal % Claimed', category: 'Pricing' },
    { key: 'priceType', label: 'Price Type', category: 'Pricing' },
    { key: 'discountPercentage', label: 'Discount %', category: 'Pricing' },
    { key: 'secondAsp', label: 'Second ASP (₹)', category: 'Pricing' },
    { key: 'aspDifference', label: 'ASP Difference (₹)', category: 'Pricing' },
    { key: 'priceDispute', label: 'Price Dispute', category: 'Pricing' },
    // Performance
    { key: 'bsr', label: 'Best Seller Rank', category: 'Performance' },
    { key: 'subBsr', label: 'Sub BSR', category: 'Performance' },
    { key: 'subBSRs', label: 'Sub BSRs (All)', category: 'Performance' },
    { key: 'subBsrCategories', label: 'Sub BSR Categories', category: 'Performance' },
    { key: 'bsrTrend', label: 'BSR Trend', category: 'Performance' },
    { key: 'rating', label: 'Rating', category: 'Performance' },
    { key: 'ratingTrend', label: 'Rating Trend', category: 'Performance' },
    { key: 'reviewCount', label: 'Review Count', category: 'Performance' },
    { key: 'ratingBreakdown', label: 'Rating Breakdown', category: 'Performance' },
    { key: 'totalOrders', label: 'Total Orders', category: 'Performance' },
    { key: 'orderedRevenue', label: 'Ordered Revenue (₹)', category: 'Performance' },
    { key: 'orderedUnits', label: 'Ordered Units', category: 'Performance' },
    { key: 'shippedRevenue', label: 'Shipped Revenue (₹)', category: 'Performance' },
    { key: 'shippedCogs', label: 'Shipped COGS (₹)', category: 'Performance' },
    { key: 'shippedUnits', label: 'Shipped Units', category: 'Performance' },
    { key: 'customerReturns', label: 'Customer Returns', category: 'Performance' },
    { key: 'ads', label: 'Has Ads', category: 'Performance' },
    // LQS
    { key: 'lqs', label: 'LQS Score', category: 'LQS' },
    { key: 'lqsGrade', label: 'LQS Grade', category: 'LQS' },
    { key: 'lqsScore', label: 'LQS Score (Raw)', category: 'LQS' },
    { key: 'titleScore', label: 'Title Score', category: 'LQS' },
    { key: 'titleGrade', label: 'Title Grade', category: 'LQS' },
    { key: 'bulletScore', label: 'Bullet Score', category: 'LQS' },
    { key: 'bulletGrade', label: 'Bullet Grade', category: 'LQS' },
    { key: 'imageScore', label: 'Image Score', category: 'LQS' },
    { key: 'imageGrade', label: 'Image Grade', category: 'LQS' },
    { key: 'descriptionScore', label: 'Description Score', category: 'LQS' },
    { key: 'descriptionGrade', label: 'Description Grade', category: 'LQS' },
    { key: 'cdq', label: 'CDQ Score', category: 'LQS' },
    { key: 'cdqGrade', label: 'CDQ Grade', category: 'LQS' },
    // BuyBox
    { key: 'buyBoxWin', label: 'BuyBox Winner', category: 'BuyBox' },
    { key: 'buyBoxStatus', label: 'BuyBox Status', category: 'BuyBox' },
    { key: 'buyBoxSellerId', label: 'BuyBox Seller ID', category: 'BuyBox' },
    { key: 'soldBy', label: 'Sold By (Current)', category: 'BuyBox' },
    { key: 'soldBySec', label: 'Sold By (Other)', category: 'BuyBox' },
    { key: 'buyBoxes', label: 'BuyBox Details', category: 'BuyBox' },
    { key: 'allOffers', label: 'All Offers', category: 'BuyBox' },
    // Content
    { key: 'hasAplus', label: 'Has A+ Content', category: 'Content' },
    { key: 'aplusContent', label: 'A+ Content Text', category: 'Content' },
    { key: 'aplusModuleCount', label: 'A+ Module Count', category: 'Content' },
    { key: 'aplusAbsentSince', label: 'A+ Days Absent', category: 'Content' },
    { key: 'imagesCount', label: 'Image Count', category: 'Content' },
    { key: 'videoCount', label: 'Video Count', category: 'Content' },
    { key: 'bulletPoints', label: 'Bullet Points Count', category: 'Content' },
    { key: 'bulletPointsText', label: 'Bullet Points Text', category: 'Content' },
    { key: 'productDescription', label: 'Product Description', category: 'Content' },
    { key: 'variantImages', label: 'Variant Images', category: 'Content' },
    { key: 'images', label: 'Images (JSON)', category: 'Content' },
    // Inventory
    { key: 'availabilityStatus', label: 'Availability Status', category: 'Inventory' },
    { key: 'stockLevel', label: 'Stock Level', category: 'Inventory' },
    { key: 'lossPerReturn', label: 'Loss Per Return (₹)', category: 'Inventory' },
    // Sync (dates removed except releaseDate)
    { key: 'sellerId', label: 'Seller ID', category: 'Sync' },
    { key: 'sellerExternalId', label: 'Seller External ID', category: 'Sync' },
    { key: 'lastSyncSource', label: 'Last Sync Source', category: 'Sync' },
    { key: 'lastLiveSyncAt', label: 'Last Live Sync', category: 'Sync' },
    { key: 'lastOctoparseSyncAt', label: 'Last Octoparse Sync', category: 'Sync' },
    { key: 'releaseDate', label: 'Release Date', category: 'Sync' },
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
// Single source of truth for BuyBox own-seller names
const OWN_SELLERS = ['ETrade Online', 'Cocoblu Retail', 'Clicktech Retail Private Ltd', 'RetailEZ Pvt Ltd'];

async function processExportJob(downloadId, params, userId) {
    const pool = await getPool();
    let filePath = null; // tracked here so catch block can clean up partial files
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
        await updateDownloadStatus(pool, downloadId, 'processing', 5, null, userId);

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
        const isGlobalUser = ['admin', 'super_admin', 'developer', 'operational_manager'].includes(roleName);

        console.log(`🔍 [Export] Debug: roleName=${roleName}, isGlobalUser=${isGlobalUser}, sellerIds=${JSON.stringify(sellerIds)}, allSellers=${allSellers}`);

        if (!isGlobalUser) {
            const assignedIds = user?.assignedSellers || [];
            if (assignedIds.length === 0) {
                whereClause += ' AND 1=0';
            } else {
                const inClause = buildInClause(request, 'asgnSeller', assignedIds);
                whereClause += ` AND a.SellerId IN (${inClause})`;
            }

            // Further restrict by requested sellers if provided (intersection)
            if (sellerIds.length > 0) {
                const allowedSellerIds = sellerIds.filter(id => assignedIds.includes(id));
                if (allowedSellerIds.length > 0) {
                    const inClause = buildInClause(request, 'alwdSeller', allowedSellerIds);
                    whereClause += ` AND a.SellerId IN (${inClause})`;
                } else {
                    whereClause += ' AND 1=0'; // Requested sellers not in assigned list
                }
            }
        } else if (!allSellers && sellerIds.length > 0) {
            const inClause = buildInClause(request, 'reqSeller', sellerIds);
            whereClause += ` AND a.SellerId IN (${inClause})`;
        }

        if (asinIds.length > 0) {
            const inClause = buildInClause(request, 'asinId', asinIds);
            whereClause += ` AND a.Id IN (${inClause})`;
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
                OWN_SELLERS.forEach((s, i) => request.input(`ownSeller${i}`, sql.NVarChar, s));
                if (buyBoxWin === true || buyBoxWin === 'true') {
                    whereClause += ` AND (${OWN_SELLERS.map((s, i) => `a.SoldBy = @ownSeller${i}`).join(' OR ')})`;
                } else {
                    whereClause += ` AND (${OWN_SELLERS.map((s, i) => `a.SoldBy != @ownSeller${i}`).join(' AND ')})`;
                }
            }
            if (priceDispute !== undefined && priceDispute !== '' && priceDispute !== null) {
                if (priceDispute === 'true' || priceDispute === true) {
                    whereClause += ' AND a.PriceDispute = 1';
                } else {
                    whereClause += ' AND (a.PriceDispute = 0 OR a.PriceDispute IS NULL)';
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
            if (minTitleScore) { request.input('minTitleScore', sql.Float, parseFloat(minTitleScore)); whereClause += ' AND a.TitleScore >= @minTitleScore'; }
            if (maxTitleScore) { request.input('maxTitleScore', sql.Float, parseFloat(maxTitleScore)); whereClause += ' AND a.TitleScore <= @maxTitleScore'; }
            if (minBulletScore) { request.input('minBulletScore', sql.Float, parseFloat(minBulletScore)); whereClause += ' AND a.BulletScore >= @minBulletScore'; }
            if (maxBulletScore) { request.input('maxBulletScore', sql.Float, parseFloat(maxBulletScore)); whereClause += ' AND a.BulletScore <= @maxBulletScore'; }
            if (minImageScore) { request.input('minImageScore', sql.Float, parseFloat(minImageScore)); whereClause += ' AND a.ImageScore >= @minImageScore'; }
            if (maxImageScore) { request.input('maxImageScore', sql.Float, parseFloat(maxImageScore)); whereClause += ' AND a.ImageScore <= @maxImageScore'; }
            if (minDescriptionScore) { request.input('minDescScore', sql.Float, parseFloat(minDescriptionScore)); whereClause += ' AND a.DescriptionScore >= @minDescScore'; }
            if (maxDescriptionScore) { request.input('maxDescScore', sql.Float, parseFloat(maxDescriptionScore)); whereClause += ' AND a.DescriptionScore <= @maxDescScore'; }

            // Tags filter
            if (tags && (Array.isArray(tags) ? tags.length > 0 : tags)) {
                const tagList = Array.isArray(tags) ? tags : [tags];
                tagList.forEach((t, i) => {
                    const paramName = `tag_${i}`;
                    request.input(paramName, sql.NVarChar, `%${t.trim()}%`);
                    whereClause += ` AND a.Tags LIKE @${paramName}`;
                });
            }

            // Date Range — COALESCE for compatibility with NULL LastScrapedAt
            // 'today' and 'yesterday' skip date filter for ASIN export (show current data)
            if (dateRange === 'yesterday' || dateRange === 'today') {
                // No date filter — export current ASIN data for selected sellers
            } else if (dateRange === '7days') whereClause += ' AND COALESCE(a.LastScrapedAt, a.CreatedAt) >= DATEADD(DAY, -7, dbo.GetEnvDate())';
            else if (dateRange === '30days') whereClause += ' AND COALESCE(a.LastScrapedAt, a.CreatedAt) >= DATEADD(DAY, -30, dbo.GetEnvDate())';
            else if (dateRange === '90days') whereClause += ' AND COALESCE(a.LastScrapedAt, a.CreatedAt) >= DATEADD(DAY, -90, dbo.GetEnvDate())';
            else if (dateRange && typeof dateRange === 'object' && dateRange.start) {
                request.input('dateStart', sql.DateTime2, new Date(dateRange.start));
                whereClause += ' AND COALESCE(a.LastScrapedAt, a.CreatedAt) >= @dateStart';
                if (dateRange.end) {
                    const dEnd = new Date(dateRange.end);
                    dEnd.setHours(23, 59, 59, 999);
                    request.input('dateEnd', sql.DateTime2, dEnd);
                    whereClause += ' AND COALESCE(a.LastScrapedAt, a.CreatedAt) <= @dateEnd';
                }
            }
        }

        await updateDownloadStatus(pool, downloadId, 'processing', 20, null, userId);

        // BUILD FIELD LIST - Map frontend field keys to actual SQL columns
        const sqlFieldMapping = {
            'asinCode': 'a.AsinCode',
            'parentAsin': 'a.ParentAsin',
            'sku': 'a.Sku',
            'title': 'a.Title',
            'brand': 'a.Brand',
            'category': 'a.Category',
            'categoryPath': 'a.CategoryPath',
            'status': 'a.Status',
            'scrapeStatus': 'a.ScrapeStatus',
            'marketplace': 'a.Marketplace',
            'stapleLevel': 'a.StapleLevel',
            'weight': 'a.Weight',
            'dimensions': 'a.Dimensions',
            'scrapedAsin': 'a.ScrapedAsin',
            'uploadedPrice': 'a.UploadedPrice',
            'currentPrice': 'a.CurrentPrice',
            'mrp': 'a.Mrp',
            'dealBadge': 'a.DealBadge',
            'dealStartTime': 'a.DealStartTime',
            'dealEndTime': 'a.DealEndTime',
            'dealAccessType': 'a.DealAccessType',
            'hasDeal': 'a.HasDeal',
            'dealType': 'a.DealType',
            'dealPercentClaimed': 'a.DealPercentClaimed',
            'manufacturer': 'a.Manufacturer',
            'priceDispute': 'a.PriceDispute',
            'priceType': 'a.PriceType',
            'discountPercentage': 'a.DiscountPercentage',
            'secondAsp': 'a.SecondAsp',
            'aspDifference': 'a.AspDifference',
            'bsr': 'a.BSR',
            'totalOrders': 'ISNULL(op.totalOrders, 0)',
            'orderedRevenue': '(SELECT SUM(ISNULL(OrderedRevenue, 0)) FROM GmsDailyPerformance WHERE Asin = a.AsinCode)',
            'orderedUnits': '(SELECT SUM(ISNULL(OrderedUnits, 0)) FROM GmsDailyPerformance WHERE Asin = a.AsinCode)',
            'shippedRevenue': '(SELECT SUM(ISNULL(ShippedRevenue, 0)) FROM GmsDailyPerformance WHERE Asin = a.AsinCode)',
            'shippedCogs': '(SELECT SUM(ISNULL(ShippedCOGS, 0)) FROM GmsDailyPerformance WHERE Asin = a.AsinCode)',
            'shippedUnits': '(SELECT SUM(ISNULL(ShippedUnits, 0)) FROM GmsDailyPerformance WHERE Asin = a.AsinCode)',
            'customerReturns': '(SELECT SUM(ISNULL(CustomerReturns, 0)) FROM GmsDailyPerformance WHERE Asin = a.AsinCode)',
            'ads': 'a.Ads',
            'subBsr': 'a.SubBsr',
            'subBSRs': 'a.SubBSRs',
            'subBsrCategories': 'a.SubBSRCategory',
            'bsrTrend': 'a.BsrTrend',
            'rating': 'a.Rating',
            'ratingTrend': 'a.RatingTrend',
            'reviewCount': 'a.ReviewCount',
            'ratingBreakdown': 'a.RatingBreakdown',
            'lqs': 'a.LQS',
            'lqsGrade': 'a.LQSGrade',
            'lqsScore': 'a.LqsScore',
            'titleScore': 'a.TitleScore',
            'titleGrade': 'a.TitleGrade',
            'bulletScore': 'a.BulletScore',
            'bulletGrade': 'a.BulletGrade',
            'imageScore': 'a.ImageScore',
            'imageGrade': 'a.ImageGrade',
            'descriptionScore': 'a.DescriptionScore',
            'descriptionGrade': 'a.DescriptionGrade',
            'cdq': 'a.Cdq',
            'cdqGrade': 'a.CdqGrade',
            'buyBoxWin': `CASE WHEN a.SoldBy IN (${OWN_SELLERS.map(s => `'${s}'`).join(',')}) THEN 'Yes' WHEN a.SoldBy IS NULL AND a.BuyBoxes IS NOT NULL AND a.BuyBoxes != '[]' THEN (SELECT TOP 1 CASE WHEN JSON_VALUE(a.BuyBoxes, '$[0].isBuyBoxWinner') = 'true' AND JSON_VALUE(a.BuyBoxes, '$[0].seller') IN (${OWN_SELLERS.map(s => `'${s}'`).join(',')}) THEN 'Yes' ELSE 'No' END) ELSE 'No' END`,
            'buyBoxStatus': 'a.BuyBoxStatus',
            'buyBoxSellerId': 'a.BuyBoxSellerId',
            'soldBy': `CASE WHEN a.SoldBy IS NOT NULL THEN a.SoldBy WHEN a.BuyBoxes IS NOT NULL AND a.BuyBoxes != '[]' THEN JSON_VALUE(a.BuyBoxes, '$[0].seller') ELSE '' END`,
            'soldBySec': 'a.SoldBySec',
            'allOffers': 'a.AllOffers',
            'buyBoxes': 'a.BuyBoxes',
            'hasAplus': 'a.HasAplus',
            'aplusContent': 'a.AplusContent',
            'aplusModuleCount': 'a.AplusModuleCount',
            'aplusAbsentSince': 'a.AplusAbsentSince',
            'imagesCount': 'a.ImagesCount',
            'videoCount': 'a.VideoCount',
            'bulletPoints': 'a.BulletPoints',
            'bulletPointsText': 'a.BulletPointsText',
            'productDescription': 'a.ProductDescription',
            'variantImages': 'a.VariantImages',
            'images': 'a.Images',
            'availabilityStatus': 'a.AvailabilityStatus',
            'stockLevel': 'a.StockLevel',
            'lossPerReturn': 'a.LossPerReturn',
            'sellerId': 'a.SellerId',
            'sellerExternalId': 'a.SellerExternalId',
            'lastSyncSource': 'a.LastSyncSource',
            'lastLiveSyncAt': 'a.LastLiveSyncAt',
            'lastOctoparseSyncAt': 'a.LastOctoparseSyncAt',
            // Date fields removed per request — users don't need them in export
            'lastScraped': null,
            'createdAt': null,
            'updatedAt': null,
            'releaseDate': 'a.ReleaseDate',
            'tags': 'a.Tags',
        };

        // Build SELECT columns with aliases to match frontend camelCase keys
        const selectColumns = fields.map(f => {
            const sqlField = sqlFieldMapping[f];
            if (!sqlField) return null;
            return `${sqlField} AS [${f.replace(/[\]]/g, '')}]`;
        }).filter(Boolean).join(', ');

        let selectQuery = '';
        let sortedDates = [];
        let historyMetrics = [];
        const headers = [];

        // Build label mapping for standard live export
        const labelMapping = {};
        ALL_ASIN_FIELDS.forEach(f => { labelMapping[f.key] = f.label; });
        labelMapping['sellerName'] = 'Seller Name';

        if (params.isHistorical) {
            // Replace a.LastScrapedAt with ah.Date in whereClause
            const dateWhereClause = whereClause.replace(/a\.LastScrapedAt/g, 'ah.Date');

            // Fetch unique dates first
            const datesRequest = pool.request();
            Object.keys(request.parameters).forEach(key => {
                const param = request.parameters[key];
                datesRequest.input(key, param.type, param.value);
            });
            const datesQuery = `
                SELECT DISTINCT CONVERT(varchar, ah.Date, 23) as [Date]
                FROM AsinHistory ah
                JOIN Asins a ON ah.AsinId = a.Id
                LEFT JOIN Sellers s ON a.SellerId = s.Id
                ${dateWhereClause}
                ORDER BY [Date] ASC
            `;
            const datesResult = await datesRequest.query(datesQuery);
            sortedDates = datesResult.recordset.map(r => r.Date);

            // Map user-selected fields to AsinHistory columns
            const fieldToHistoryCol = {
                currentPrice: 'Price', mrp: 'MRP', discountPercentage: 'Discount',
                bsr: 'BSR', subBSR: 'SubBSR', subBsrCategory: 'SubBSRCategory',
                rating: 'Rating', reviewCount: 'ReviewCount',
                buyBoxWin: 'BuyBoxStatus', hasAplus: 'HasAplus',
                stockLevel: 'StockLevel', availabilityStatus: 'AvailabilityStatus',
                lqs: 'LQS', manufacturer: 'Manufacturer',
                mainImage: 'ImageUrl', images: 'Images', bulletPointCount: 'BulletPoints'
            };

            // Determine which metrics to include in historical export
            if (fields && fields.length > 0) {
                // Use user-selected fields, mapped to AsinHistory columns
                historyMetrics = fields
                    .filter(f => fieldToHistoryCol[f])
                    .map(f => ({
                        key: f,
                        name: labelMapping[f] || f,
                        metricKey: fieldToHistoryCol[f]
                    }));
            }
            // Always include core metrics if user didn't select any history-compatible fields
            if (historyMetrics.length === 0) {
                historyMetrics = [
                    { key: 'currentPrice', name: 'Price (₹)', metricKey: 'Price' },
                    { key: 'bsr', name: 'BSR', metricKey: 'BSR' },
                    { key: 'subBSR', name: 'SubBSR', metricKey: 'SubBSR' },
                    { key: 'rating', name: 'Rating', metricKey: 'Rating' },
                    { key: 'reviewCount', name: 'Reviews', metricKey: 'ReviewCount' },
                    { key: 'buyBoxWin', name: 'BuyBox Win', metricKey: 'BuyBoxStatus' },
                    { key: 'stockLevel', name: 'Stock', metricKey: 'StockLevel' },
                    { key: 'lqs', name: 'LQS', metricKey: 'LQS' }
                ];
            }

            // Construct headers
            headers.push('ASIN Code', 'Product Title', 'Brand');
            historyMetrics.forEach(m => {
                sortedDates.forEach(d => {
                    headers.push(`${m.name}(${d})`);
                });
            });

            // Build SELECT columns for history query
            const historySelectCols = historyMetrics.map(m => {
                if (m.metricKey === 'BuyBoxStatus') {
                    return `CASE WHEN ah.BuyBoxStatus = 1 THEN 'Yes' ELSE 'No' END as [${m.name}]`;
                }
                return `ah.[${m.metricKey}] as [${m.name}]`;
            }).join(',\n                  ');

            selectQuery = `
                SELECT 
                  CONVERT(varchar, ah.Date, 23) as [Date],
                  a.AsinCode as [ASIN Code],
                  a.Title as [Product Title],
                  s.Name as [Brand],
                  ${historySelectCols}
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
        await updateDownloadStatus(pool, downloadId, 'processing', 30, null, userId);

        const resultDownloads = await pool.request()
            .input('id', sql.VarChar, downloadId)
            .query('SELECT FileName FROM Downloads WHERE Id = @id');
        const fileName = resultDownloads.recordset[0]?.FileName || `asin_export_${downloadId}.${format}`;
        filePath = path.join(EXPORTS_DIR, `${downloadId}_${fileName}`);

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
                } else                 if (field === 'buyBoxWin' || field === 'hasAplus' || field === 'priceDispute') {
                    value = (value === 1 || value === true || value === 'true' || value === 'Yes') ? 'Yes' : 'No';
                } else if (field === 'availabilityStatus') {
                    value = value || 'Available';
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
                } else if (field === 'buyBoxes' || field === 'BuyBoxes') {
                    try {
                        const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
                        value = Array.isArray(parsed) ? parsed.map(b => `${b.seller || 'N/A'}: ₹${b.priceAmount || 0}${b.isBuyBoxWinner ? ' (Winner)' : ''}`).join(' | ') : '';
                    } catch { value = ''; }
                } else if (field === 'allOffers' || field === 'AllOffers') {
                    try {
                        const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
                        value = Array.isArray(parsed) ? parsed.map(o => `${o.seller || 'N/A'}: ₹${o.price || 0}`).join(' | ') : '';
                    } catch { value = ''; }
                } else if (field === 'ratingBreakdown' || field === 'RatingBreakdown') {
                    try {
                        const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
                        value = Object.entries(parsed).map(([star, pct]) => `${star}: ${pct}`).join(', ');
                    } catch { value = ''; }
                } else if (['createdAt', 'updatedAt', 'lastScraped', 'releaseDate', 'CreatedAt', 'UpdatedAt', 'LastScrapedAt'].includes(field)) {
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
            // Non-streaming Excel writer — guaranteed file integrity
            workbook = new ExcelJS.Workbook();
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
                },
                addRow: (rowObj) => {
                    rowCount++;
                    const row = worksheet.addRow(rowObj);
                    row.eachCell(cell => {
                        cell.border = borderStyle;
                    });
                },
                commit: async () => {
                    // Write workbook to buffer then to file for guaranteed integrity
                    const buffer = await workbook.xlsx.writeBuffer();
                    fs.writeFileSync(filePath, buffer);
                }
            };
        }

        // Execute query in stream mode
        await new Promise((resolve, reject) => {
            const selectRequest = pool.request();
            console.log(`📊 [Export] Copying ${Object.keys(request.parameters).length} parameters`);
            Object.keys(request.parameters).forEach(key => {
                const param = request.parameters[key];
                selectRequest.input(key, param.type, param.value);
            });

            selectRequest.stream = true;

            let currentAsin = null;
            let currentAsinData = null;
            let headersWritten = false;

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
                                historyMetrics.forEach(m => {
                                    sortedDates.forEach(d => {
                                        const dateData = currentAsinData._dates.get(d);
                                        const val = dateData ? dateData[m.metricKey] : undefined;
                                        finalObj[`${m.name}(${d})`] = (val !== undefined && val !== null) ? val : '';
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

                        const dateKey = row['Date'];
                        if (!currentAsinData._dates.has(dateKey)) {
                            currentAsinData._dates.set(dateKey, {});
                        }
                        historyMetrics.forEach(m => {
                            const val = row[m.name];
                            if (val !== undefined && val !== null) {
                                currentAsinData._dates.get(dateKey)[m.metricKey] = val;
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
                        historyMetrics.forEach(m => {
                            sortedDates.forEach(d => {
                                const dateData = currentAsinData._dates.get(d);
                                const val = dateData ? dateData[m.metricKey] : undefined;
                                finalObj[`${m.name}(${d})`] = (val !== undefined && val !== null) ? val : '';
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

        console.log(`📊 [Export] Streaming complete: ${rowCount} rows written`);
        await updateDownloadStatus(pool, downloadId, 'processing', 90, null, userId);
        const stats = fs.statSync(filePath);

        // Update download record as completed
        await pool.request()
            .input('id', sql.VarChar, downloadId)
            .input('fileSize', sql.BigInt, stats.size)
            .input('rowCount', sql.Int, rowCount)
            .input('relPath', sql.NVarChar, `/exports/${downloadId}_${fileName}`)
            .query(`
                UPDATE Downloads SET
                    Status = 'completed',
                    Progress = 100,
                    FileSize = @fileSize,
                    [RowCount] = @rowCount,
                    FilePath = @relPath,
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

        // Clean up any partial file written before failure
        if (filePath && fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { /* ignore cleanup errors */ }
        }

        await updateDownloadStatus(pool, downloadId, 'failed', 0, error.message, userId);

        const io = SocketService.getIo();
        if (io) {
            io.to(`user_${userId}`).emit('export_failed', {
                downloadId,
                error: error.message
            });
        }
    }
}

async function updateDownloadStatus(pool, id, status, progress, errorMessage = null, userId = null) {
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
        SocketService.emitExportUpdate(id, { status, progress, errorMessage, userId });
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

        // Run background job with 5-minute timeout
        const EXPORT_TIMEOUT_MS = 5 * 60 * 1000;
        const exportTimeout = setTimeout(() => {
            updateDownloadStatus(pool, downloadId, 'failed', 0, 'Export timed out after 5 minutes', userId).catch(console.error);
        }, EXPORT_TIMEOUT_MS);

        processGmsExportJob(downloadId, req.body, userId)
            .then(() => clearTimeout(exportTimeout))
            .catch(err => {
                clearTimeout(exportTimeout);
                console.error(`GMS Export job ${downloadId} failed:`, err);
                updateDownloadStatus(pool, downloadId, 'failed', 0, err.message, userId).catch(console.error);
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

/**
 * Compute period-over-period trend for a specific period key.
 * @param {object} row - aggregated row with dailyRev/weeklyRev/monthlyRev
 * @param {'month'|'week'|'day'} type - period type
 * @param {object} rawGmsMap - full dataset lookup (includes prior periods not in export range)
 * @param {'asin'|'seller'} level - grouping level
 * @param {string} periodKey - the specific period to compute trend for (e.g. '2024-06', '2024-W23')
 */
const getGmsTrend = (row, type, rawGmsMap, level = 'asin', periodKey) => {
    const entityKey = level === 'seller' ? row.dbBrand : row.asin;
    const entityData = rawGmsMap[entityKey];
    if (!entityData || !periodKey) return null;

    let currentVal = 0;
    let previousVal = 0;

    if (type === 'month') {
        currentVal = row.monthlyRev[periodKey] || 0;
        const [year, month] = periodKey.split('-').map(Number);
        const prevMonthDate = new Date(year, month - 2, 1);
        const prevMonthStr = prevMonthDate.toISOString().slice(0, 7);
        previousVal = entityData.monthly[prevMonthStr] || 0;
    } else if (type === 'week') {
        currentVal = row.weeklyRev[periodKey] || 0;
        const [yearStr, weekStr] = periodKey.split('-W');
        const yVal = parseInt(yearStr);
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
        currentVal = row.dailyRev[periodKey] || 0;
        const prevDayDate = new Date(new Date(periodKey).getTime() - 86400000);
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
        .query(`SELECT U.*, R.Name as RoleName FROM Users U LEFT JOIN Roles R ON U.RoleId = R.Id WHERE U.Id = @userId`);
    if (userResult.recordset.length > 0) {
        const u = userResult.recordset[0];
        user = { id: u.Id, role: u.RoleName === 'super_admin' ? 'admin' : u.RoleName, assignedSellers: [] };
        const sellersResult = await pool.request().input('userId', sql.VarChar, userId)
            .query('SELECT SellerId FROM UserSellers WHERE UserId = @userId');
        user.assignedSellers = sellersResult.recordset.map(s => s.SellerId);
    }

    const roleName = user?.role || '';
    const isGlobalUser = ['admin', 'super_admin', 'developer', 'operational_manager'].includes(roleName);
    const gmsRequest = pool.request();
    let whereClause = 'WHERE 1=1';

    if (!isGlobalUser) {
        const assignedIds = user?.assignedSellers || [];
        if (assignedIds.length === 0) { whereClause += ' AND 1=0'; }
        else {
            const inClause = buildInClause(gmsRequest, 'gmsSeller', assignedIds);
            whereClause += ` AND a.SellerId IN (${inClause})`;
        }
    }

    await updateDownloadStatus(pool, downloadId, 'processing', 20);

    // Build date filter
    let sqlDateFilter = '';
    if (exportDateType === 'current' && startDate && endDate) {
        sqlDateFilter = `AND g.Date >= '${startDate}' AND g.Date <= '${endDate}'`;
    } else if (exportDateType === 'custom' && exportCustomDates && exportCustomDates[0] && exportCustomDates[1]) {
        sqlDateFilter = `AND g.Date >= '${exportCustomDates[0]}' AND g.Date <= '${exportCustomDates[1]}'`;
    }

    // Fetch all GMS data
    const result = await gmsRequest.query(`
      SELECT g.Date as date, g.Asin as asin, g.Brand as brand, g.StoreCode as storeCode,
        g.OrderedRevenue as orderedRevenue, g.OrderedUnits as orderedUnits,
        g.ShippedRevenue as shippedRevenue, g.ShippedCOGS as shippedCOGS,
        g.ShippedUnits as shippedUnits, g.CustomerReturns as customerReturns,
        s.Name as dbBrand, a.Title as productTitle
      FROM GmsDailyPerformance g
      LEFT JOIN Asins a ON g.Asin = a.AsinCode
      LEFT JOIN Sellers s ON a.SellerId = s.Id
      ${whereClause} ${sqlDateFilter}
      ORDER BY g.Date DESC
    `);

    const rawGmsData = result.recordset.map(row => {
        if (!row.date) return { ...row, date: null };
        const d = new Date(row.date);
        const tzOffset = d.getTimezoneOffset() * 60000;
        return { ...row, date: new Date(d.getTime() - tzOffset).toISOString().split('T')[0], resolvedDbBrand: row.dbBrand || '-' };
    });

    await updateDownloadStatus(pool, downloadId, 'processing', 35);

    // Build matrix map
    const matrixMap = {};
    rawGmsData.forEach(d => {
        const isUnmatched = !d.resolvedDbBrand || d.resolvedDbBrand === '-';
        const key = exportLevel === 'seller' ? (!isUnmatched ? d.resolvedDbBrand : (d.brand || '-')) : d.asin;
        if (!matrixMap[key]) {
            matrixMap[key] = exportLevel === 'seller'
                ? { dbBrand: key, isUnmatched, asins: new Set(), brands: new Set(), storeCodes: new Set(), dailyRev: {}, weeklyRev: {}, monthlyRev: {} }
                : { asin: d.asin, productTitle: d.productTitle || '-', dbBrand: d.resolvedDbBrand || '-', brand: d.brand || 'Generic', storeCode: d.storeCode || 'IN', dailyRev: {}, weeklyRev: {}, monthlyRev: {} };
        }
        const row = matrixMap[key];
        if (exportLevel === 'seller') {
            if (d.asin) row.asins.add(d.asin);
            if (d.brand) row.brands.add(d.brand);
            if (d.storeCode) row.storeCodes.add(d.storeCode);
        }
        const monthKey = d.date.slice(0, 7);
        const { year: wYear, week: wWeek } = getISOWeek(new Date(d.date));
        const weekKey = `${wYear}-W${String(wWeek).padStart(2, '0')}`;
        if (!row.dailyRev[d.date]) row.dailyRev[d.date] = 0;
        row.dailyRev[d.date] += d.orderedRevenue || 0;
        if (!row.weeklyRev[weekKey]) row.weeklyRev[weekKey] = 0;
        row.weeklyRev[weekKey] += d.orderedRevenue || 0;
        if (!row.monthlyRev[monthKey]) row.monthlyRev[monthKey] = 0;
        row.monthlyRev[monthKey] += d.orderedRevenue || 0;
    });

    await updateDownloadStatus(pool, downloadId, 'processing', 50);

    const matrixRows = Object.values(matrixMap).map(r => {
        if (exportLevel === 'seller') {
            return { ...r, asinsList: Array.from(r.asins), brandsList: Array.from(r.brands), storeCodesList: Array.from(r.storeCodes) };
        }
        return r;
    });

    const dates = [...new Set(rawGmsData.map(d => d.date))].sort();
    const monthGroups = {};
    dates.forEach(dateStr => {
        const monthKey = dateStr.slice(0, 7);
        const monthLabel = new Date(dateStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
        const { year: wYear, week: wWeek } = getISOWeek(new Date(dateStr));
        const weekKey = `${wYear}-W${String(wWeek).padStart(2, '0')}`;
        const weekLabel = getWeekRangeLabel(wYear, wWeek);
        if (!monthGroups[monthKey]) monthGroups[monthKey] = { label: monthLabel, key: monthKey, weeks: {} };
        if (!monthGroups[monthKey].weeks[weekKey]) monthGroups[monthKey].weeks[weekKey] = { label: weekLabel, key: weekKey, days: [] };
        monthGroups[monthKey].weeks[weekKey].days.push(dateStr);
    });

    await updateDownloadStatus(pool, downloadId, 'processing', 60);

    // Build column definitions
    const columnDef = [];
    if (exportLevel === 'seller') {
        columnDef.push({ label: 'Seller (DB)', getValue: r => r.dbBrand });
        columnDef.push({ label: 'ASIN', getValue: () => '-' });
        columnDef.push({ label: 'Brand (Sheet)', getValue: r => r.brandsList?.length > 0 ? r.brandsList.join(', ') : '-' });
        columnDef.push({ label: 'Store Code', getValue: r => r.storeCodesList?.length > 0 ? r.storeCodesList.join(', ') : '-' });
    } else {
        columnDef.push({ label: 'Seller (DB)', getValue: r => r.dbBrand });
        columnDef.push({ label: 'ASIN', getValue: r => r.asin });
        columnDef.push({ label: 'Product Title', getValue: r => r.productTitle });
        columnDef.push({ label: 'Brand (Sheet)', getValue: r => r.brand });
        columnDef.push({ label: 'Store Code', getValue: r => r.storeCode });
    }

    Object.values(monthGroups).forEach(month => {
        Object.values(month.weeks).forEach(week => {
            const sortedDays = [...week.days].sort();
            sortedDays.forEach((dayStr, idx) => {
                columnDef.push({ label: new Date(dayStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), getValue: r => r.dailyRev[dayStr] || 0 });
                if (idx > 0) {
                    const prevDay = sortedDays[idx - 1];
                    columnDef.push({ label: `DoD`, getValue: r => { const p = r.dailyRev[prevDay] || 0; const c = r.dailyRev[dayStr] || 0; return !p && !c ? '-' : !p ? 'NEW' : `${(((c - p) / p) * 100).toFixed(1)}%`; } });
                }
            });
            columnDef.push({ label: `${week.label} Total`, getValue: r => r.weeklyRev[week.key] || 0 });
            columnDef.push({ label: `${week.label} WoW`, getValue: r => { const t = getGmsTrend(r, 'week', {}, exportLevel, week.key); return t === null ? '-' : `${t.toFixed(1)}%`; } });
        });
        columnDef.push({ label: `${month.label} Total`, getValue: r => r.monthlyRev[month.key] || 0 });
        columnDef.push({ label: `${month.label} MoM`, getValue: r => { const t = getGmsTrend(r, 'month', {}, exportLevel, month.key); return t === null ? '-' : `${t.toFixed(1)}%`; } });
    });

    await updateDownloadStatus(pool, downloadId, 'processing', 70);

    // Build sheet data
    const sheetHeaders = columnDef.map(c => c.label);
    const sheetRows = [];
    for (let i = 0; i < matrixRows.length; i++) {
        try {
            sheetRows.push(columnDef.map(c => c.getValue(matrixRows[i])));
        } catch (e) {
            sheetRows.push(columnDef.map(() => '-'));
        }
        if (i % 10000 === 0 && i > 0) {
            await updateDownloadStatus(pool, downloadId, 'processing', Math.min(85, 70 + Math.round(i / matrixRows.length * 15)));
        }
    }

    await updateDownloadStatus(pool, downloadId, 'processing', 85);

    // Get file path
    const gmsFileResult = await pool.request().input('id', sql.VarChar, downloadId)
        .query('SELECT FileName FROM Downloads WHERE Id = @id');
    const fileName = gmsFileResult.recordset[0]?.FileName || `gms_export_${exportLevel}_${downloadId}.xlsx`;
    const filePath = path.join(EXPORTS_DIR, `${downloadId}_${fileName}`);

    // BULLETPROOF: Use xlsx library (simpler, more reliable than ExcelJS)
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([sheetHeaders, ...sheetRows]);
        XLSX.utils.book_append_sheet(wb, ws, 'GMS Matrix');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
        fs.writeFileSync(filePath, wbout);
    } catch (xlsxErr) {
        console.error(`XLSX write failed for ${downloadId}:`, xlsxErr.message);
        // Fallback: write as CSV
        try {
            const csvContent = [sheetHeaders.join(','), ...sheetRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
            const csvPath = filePath.replace('.xlsx', '.csv');
            fs.writeFileSync(csvPath, csvContent, 'utf8');
            // Rename CSV to xlsx for consistency
            fs.copyFileSync(csvPath, filePath);
            fs.unlinkSync(csvPath);
        } catch (csvErr) {
            throw new Error(`Export failed: ${csvErr.message}`);
        }
    }

    // Verify file
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
        throw new Error('Export file is empty or missing');
    }

    const stats = fs.statSync(filePath);

    await pool.request()
        .input('id', sql.VarChar, downloadId)
        .input('fileSize', sql.BigInt, stats.size)
        .input('rowCount', sql.Int, sheetRows.length)
        .input('filePath', sql.VarChar, `/exports/${downloadId}_${fileName}`)
        .query(`UPDATE Downloads SET Status = 'completed', Progress = 100, FileSize = @fileSize, [RowCount] = @rowCount, FilePath = @filePath, CompletedAt = dbo.GetEnvDate(), ExpiresAt = DATEADD(HOUR, 24, dbo.GetEnvDate()) WHERE Id = @id`);

    SocketService.emitExportUpdate(downloadId, { status: 'completed', progress: 100, filePath: `/exports/${downloadId}_${fileName}` });
}

