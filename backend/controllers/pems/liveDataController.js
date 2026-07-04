/**
 * Live Data Inspector — Backend Controller
 * Public endpoint (no auth) to fetch live data for ASINs from Amazon Creators API
 */
const { sql, getPool } = require('../../database/db');

// Available metrics the user can select
const AVAILABLE_METRICS = [
    { key: 'price', label: 'Price', resource: 'offersV2.listings.price', extract: (item) => {
        const listing = item.offersV2?.listings?.find(l => l.isBuyBoxWinner) || item.offersV2?.listings?.[0];
        return listing?.price?.money?.amount || null;
    }},
    { key: 'mrp', label: 'MRP / List Price', resource: 'offersV2.listings.price', extract: (item) => {
        const listing = item.offersV2?.listings?.find(l => l.isBuyBoxWinner) || item.offersV2?.listings?.[0];
        return listing?.price?.savingBasis?.money?.amount || null;
    }},
    { key: 'bsr', label: 'Main BSR', resource: 'browseNodeInfo.browseNodes.salesRank', extract: (item) => {
        return item.browseNodeInfo?.websiteSalesRank?.salesRank || item.browseNodeInfo?.browseNodes?.[0]?.salesRank || null;
    }},
    { key: 'subBsr', label: 'Sub BSR', resource: 'browseNodeInfo.browseNodes', extract: (item) => {
        return item.browseNodeInfo?.browseNodes?.[1]?.salesRank || null;
    }},
    { key: 'rating', label: 'Rating', resource: 'customerReviews.starRating', extract: (item) => {
        return item.customerReviews?.starRating || null;
    }},
    { key: 'reviewCount', label: 'Review Count', resource: 'customerReviews.count', extract: (item) => {
        return item.customerReviews?.count || null;
    }},
    { key: 'buyBoxWinner', label: 'BuyBox Winner', resource: 'offersV2.listings.isBuyBoxWinner', extract: (item) => {
        const listing = item.offersV2?.listings?.find(l => l.isBuyBoxWinner);
        return listing ? 'Yes' : 'No';
    }},
    { key: 'seller', label: 'Seller (BuyBox)', resource: 'offersV2.listings.merchantInfo', extract: (item) => {
        const listing = item.offersV2?.listings?.find(l => l.isBuyBoxWinner) || item.offersV2?.listings?.[0];
        return listing?.merchantInfo?.name || null;
    }},
    { key: 'availability', label: 'Availability', resource: 'offersV2.listings.availability', extract: (item) => {
        const listing = item.offersV2?.listings?.[0];
        return listing?.availability?.status || null;
    }},
    { key: 'title', label: 'Title', resource: 'itemInfo.title', extract: (item) => {
        return item.itemInfo?.title?.displayValues?.[0] || null;
    }},
    { key: 'brand', label: 'Brand', resource: 'itemInfo.byLineInfo', extract: (item) => {
        return item.itemInfo?.byLineInfo?.brand?.displayValues?.[0] || null;
    }},
    { key: 'category', label: 'Category', resource: 'browseNodeInfo.browseNodes', extract: (item) => {
        return item.browseNodeInfo?.browseNodes?.map(n => n.displayName).join(' > ') || null;
    }},
    { key: 'dealBadge', label: 'Deal Badge', resource: 'offersV2.listings.dealDetails', extract: (item) => {
        const listing = item.offersV2?.listings?.find(l => l.isBuyBoxWinner) || item.offersV2?.listings?.[0];
        return listing?.dealDetails?.dealType || null;
    }},
];

/**
 * GET /api/live-data/metrics
 * Returns available metrics for selection
 */
exports.getMetrics = (req, res) => {
    res.json({
        success: true,
        data: AVAILABLE_METRICS.map(m => ({ key: m.key, label: m.label }))
    });
};

/**
 * POST /api/live-data/fetch
 * Fetch live data for given ASINs with selected metrics
 * No auth required
 */
exports.fetchLiveData = async (req, res) => {
    try {
        const { asins, metrics } = req.body;
        if (!asins || !Array.isArray(asins) || asins.length === 0) {
            return res.status(400).json({ success: false, error: 'ASINs array required' });
        }
        if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
            return res.status(400).json({ success: false, error: 'Metrics array required' });
        }
        if (asins.length > 100) {
            return res.status(400).json({ success: false, error: 'Maximum 100 ASINs per request' });
        }

        // Validate metrics
        const selectedMetrics = metrics.filter(m => AVAILABLE_METRICS.some(am => am.key === m));
        if (selectedMetrics.length === 0) {
            return res.status(400).json({ success: false, error: 'No valid metrics selected' });
        }

        // Get resources needed for selected metrics
        const neededResources = new Set();
        selectedMetrics.forEach(key => {
            const metric = AVAILABLE_METRICS.find(m => m.key === key);
            if (metric) neededResources.add(metric.resource);
        });
        const resources = [...neededResources];

        // Find seller for ASINs
        const pool = await getPool();
        const asinList = asins.map(a => a.toUpperCase().trim());
        const placeholders = asinList.map((_, i) => `@asin${i}`).join(',');
        const req_ = pool.request();
        asinList.forEach((a, i) => req_.input(`asin${i}`, sql.VarChar, a));
        
        const asinResult = await req_.query(`
            SELECT a.Id, a.AsinCode, a.SellerId, s.Name as SellerName, s.LiveSyncClientId, s.LiveSyncClientSecret
            FROM Asins a
            JOIN Sellers s ON a.SellerId = s.Id
            WHERE a.AsinCode IN (${placeholders})
        `);

        if (asinResult.recordset.length === 0) {
            return res.status(404).json({ success: false, error: 'No ASINs found in database' });
        }

        // Group by seller for batch API calls
        const sellerGroups = {};
        asinResult.recordset.forEach(r => {
            if (!sellerGroups[r.SellerId]) {
                sellerGroups[r.SellerId] = {
                    sellerId: r.SellerId,
                    sellerName: r.SellerName,
                    clientId: r.LiveSyncClientId,
                    clientSecret: r.LiveSyncClientSecret,
                    asins: []
                };
            }
            sellerGroups[r.SellerId].asins.push(r.AsinCode);
        });

        // Use liveDataSyncService to fetch data
        const liveSyncService = require('../liveDataSyncService');
        const results = [];

        for (const [sellerId, group] of Object.entries(sellerGroups)) {
            try {
                const syncResult = await liveSyncService.syncSellerLiveData(sellerId, {
                    targetAsins: group.asins,
                    resources
                });
                
                // Extract requested metrics from synced data
                for (const asinCode of group.asins) {
                    const asinData = await pool.request()
                        .input('asin', sql.VarChar, asinCode)
                        .query(`SELECT * FROM Asins WHERE AsinCode = @asin`);
                    
                    if (asinData.recordset.length > 0) {
                        const asin = asinData.recordset[0];
                        const metricsResult = { asin: asinCode, seller: group.sellerName };
                        
                        selectedMetrics.forEach(key => {
                            const metric = AVAILABLE_METRICS.find(m => m.key === key);
                            if (metric) {
                                // Map DB columns to metric values
                                switch (key) {
                                    case 'price': metricsResult[key] = asin.CurrentPrice; break;
                                    case 'mrp': metricsResult[key] = asin.Mrp; break;
                                    case 'bsr': metricsResult[key] = asin.BSR; break;
                                    case 'subBsr': metricsResult[key] = asin.SubBsr; break;
                                    case 'rating': metricsResult[key] = asin.Rating; break;
                                    case 'reviewCount': metricsResult[key] = asin.ReviewCount; break;
                                    case 'buyBoxWinner': metricsResult[key] = asin.BuyBoxWin ? 'Yes' : 'No'; break;
                                    case 'seller': metricsResult[key] = asin.SoldBy; break;
                                    case 'availability': metricsResult[key] = asin.AvailabilityStatus; break;
                                    case 'title': metricsResult[key] = asin.Title; break;
                                    case 'brand': metricsResult[key] = asin.Brand; break;
                                    case 'category': metricsResult[key] = asin.Category; break;
                                    case 'dealBadge': metricsResult[key] = asin.DealBadge; break;
                                    default: metricsResult[key] = null;
                                }
                            }
                        });
                        results.push(metricsResult);
                    }
                }
            } catch (err) {
                console.error(`Sync failed for seller ${sellerId}:`, err.message);
                // Still return partial results
                for (const asinCode of group.asins) {
                    const asinData = await pool.request()
                        .input('asin', sql.VarChar, asinCode)
                        .query(`SELECT * FROM Asins WHERE AsinCode = @asin`);
                    if (asinData.recordset.length > 0) {
                        const asin = asinData.recordset[0];
                        const metricsResult = { asin: asinCode, seller: group.sellerName, _error: 'Sync failed, showing cached data' };
                        selectedMetrics.forEach(key => {
                            switch (key) {
                                case 'price': metricsResult[key] = asin.CurrentPrice; break;
                                case 'mrp': metricsResult[key] = asin.Mrp; break;
                                case 'bsr': metricsResult[key] = asin.BSR; break;
                                case 'subBsr': metricsResult[key] = asin.SubBsr; break;
                                case 'rating': metricsResult[key] = asin.Rating; break;
                                case 'reviewCount': metricsResult[key] = asin.ReviewCount; break;
                                case 'buyBoxWinner': metricsResult[key] = asin.BuyBoxWin ? 'Yes' : 'No'; break;
                                case 'seller': metricsResult[key] = asin.SoldBy; break;
                                case 'availability': metricsResult[key] = asin.AvailabilityStatus; break;
                                case 'title': metricsResult[key] = asin.Title; break;
                                case 'brand': metricsResult[key] = asin.Brand; break;
                                case 'category': metricsResult[key] = asin.Category; break;
                                case 'dealBadge': metricsResult[key] = asin.DealBadge; break;
                                default: metricsResult[key] = null;
                            }
                        });
                        results.push(metricsResult);
                    }
                }
            }
        }

        res.json({
            success: true,
            data: results,
            total: results.length,
            metrics: selectedMetrics
        });
    } catch (err) {
        console.error('Live data fetch error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
};
