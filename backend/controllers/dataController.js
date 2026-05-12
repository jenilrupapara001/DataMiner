const { sql, getPool } = require('../database/db');

/**
 * Get master data with revenue (stub)
 */
exports.getMasterWithRevenue = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT a.*, s.Name as SellerName, s.Marketplace
                FROM Asins a
                LEFT JOIN Sellers s ON a.SellerId = s.Id
                ORDER BY a.CreatedAt DESC
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get chart data for dashboard (monthly trends)
 */
exports.getChartData = async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        const pool = await getPool();

        // Simple: get ASIN count growth over time
        const result = await pool.request().query(`
            SELECT CAST(CreatedAt AS DATE) as date, COUNT(*) as count
            FROM Asins
            WHERE CreatedAt >= DATEADD(DAY, -30, GETDATE())
            GROUP BY CAST(CreatedAt AS DATE)
            ORDER BY date ASC
        `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Revenue by size (stub)
 */
exports.getRevenueBySize = async (req, res) => {
    res.json({ success: true, data: [] });
};

/**
 * Size share pie (stub)
 */
exports.getSizeShare = async (req, res) => {
    res.json({ success: true, data: [] });
};

/**
 * Get Ads Report with Parent/Child Hierarchy and full metrics
 */
exports.getAdsReport = async (req, res) => {
    try {
        const { asin, startDate, endDate, sellerId } = req.query;
        const pool = await getPool();
        
        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (asin) { 
            whereClause += " AND p.Asin = @asin"; 
            request.input('asin', sql.VarChar, asin); 
        }
        if (startDate) { 
            whereClause += " AND p.Date >= @startDate"; 
            request.input('startDate', sql.Date, startDate); 
        }
        if (endDate) { 
            whereClause += " AND p.Date <= @endDate"; 
            request.input('endDate', sql.Date, endDate); 
        }
        if (sellerId) {
            whereClause += " AND a.SellerId = @sellerId";
            request.input('sellerId', sql.VarChar, sellerId);
        }

        // 1. Fetch relations
        const relResult = await pool.request().query('SELECT ParentAsin, ChildAsin FROM AsinRelations');
        const relations = relResult.recordset;
        const childToParent = {};
        relations.forEach(r => { childToParent[r.ChildAsin] = r.ParentAsin; });

        // 2. Fetch all matching records with ASIN metadata
        const result = await request.query(`
            SELECT 
                p.*,
                a.Title,
                a.ImageUrl,
                a.Category,
                a.Brand,
                a.Sku as MasterSku,
                a.CreatedAt as AsinCreatedAt
            FROM AdsPerformance p
            LEFT JOIN Asins a ON p.Asin = a.AsinCode
            ${whereClause}
            ORDER BY p.Date DESC
        `);

        const rawData = result.recordset;

        // 3. Group by ASIN (to aggregate totals and history)
        const asinMap = {};
        rawData.forEach(row => {
            const key = row.Asin;
            if (!asinMap[key]) {
                asinMap[key] = {
                    asin: row.Asin,
                    sku: row.AdvertisedSku || row.MasterSku || 'None',
                    title: row.Title || 'Unknown',
                    imageUrl: row.ImageUrl,
                    parentAsin: childToParent[row.Asin] || row.Asin, // Use mapping or self
                    createdAt: row.AsinCreatedAt,
                    ad_spend: 0, ad_sales: 0, impressions: 0, clicks: 0, orders: 0,
                    conversions: 0, same_sku_sales: 0, same_sku_orders: 0,
                    total_sales: 0, total_units: 0, organic_sales: 0, organic_orders: 0,
                    page_views: 0, sessions: 0, browser_sessions: 0, mobile_app_sessions: 0,
                    total_acos_sum: 0, record_count: 0,
                    history: []
                };
            }
            
            asinMap[key].ad_spend += Number(row.AdSpend || 0);
            asinMap[key].ad_sales += Number(row.AdSales || 0);
            asinMap[key].impressions += Number(row.Impressions || 0);
            asinMap[key].clicks += Number(row.Clicks || 0);
            asinMap[key].orders += Number(row.Orders || 0);
            asinMap[key].conversions += Number(row.Conversions || 0);
            asinMap[key].same_sku_sales += Number(row.SameSkuSales || 0);
            asinMap[key].same_sku_orders += Number(row.SameSkuOrders || 0);
            asinMap[key].total_sales += Number(row.TotalSales || 0);
            asinMap[key].total_units += Number(row.TotalUnits || 0);
            asinMap[key].organic_sales += Number(row.OrganicSales || 0);
            asinMap[key].organic_orders += Number(row.OrganicOrders || 0);
            asinMap[key].page_views += Number(row.PageViews || 0);
            asinMap[key].sessions += Number(row.Sessions || 0);
            asinMap[key].browser_sessions += Number(row.BrowserSessions || 0);
            asinMap[key].mobile_app_sessions += Number(row.MobileAppSessions || 0);
            asinMap[key].total_acos_sum += Number(row.TotalAcos || 0);
            asinMap[key].record_count++;

            asinMap[key].history.push({
                date: row.Date,
                ad_spend: Number(row.AdSpend || 0),
                ad_sales: Number(row.AdSales || 0),
                orders: Number(row.Orders || 0),
                clicks: Number(row.Clicks || 0),
                impressions: Number(row.Impressions || 0),
                conversions: Number(row.Conversions || 0),
                organic_sales: Number(row.OrganicSales || 0),
                total_sales: Number(row.TotalSales || 0),
                acos: row.AdSales > 0 ? (row.AdSpend / row.AdSales) * 100 : 0,
                roas: row.AdSpend > 0 ? row.AdSales / row.AdSpend : 0
            });
        });

        const asinList = Object.values(asinMap).map(a => {
            a.acos = a.ad_sales > 0 ? (a.ad_spend / a.ad_sales) * 100 : 0;
            a.roas = a.ad_spend > 0 ? a.ad_sales / a.ad_spend : 0;
            a.ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;
            a.cpc = a.clicks > 0 ? a.ad_spend / a.clicks : 0;
            a.conversion_rate = a.clicks > 0 ? (a.orders / a.clicks) * 100 : 0;
            a.aov = a.orders > 0 ? a.ad_sales / a.orders : 0;
            return a;
        });

        // 4. Build Hierarchy
        const parentMap = {};
        asinList.forEach(child => {
            const pid = child.parentAsin;
            if (!parentMap[pid]) {
                parentMap[pid] = {
                    asin: pid,
                    isParent: true,
                    title: `Parent: ${pid}`,
                    children: [],
                    ad_spend: 0, ad_sales: 0, impressions: 0, clicks: 0, orders: 0,
                    conversions: 0, total_sales: 0, organic_sales: 0, total_units: 0,
                    history: []
                };
            }
            parentMap[pid].children.push(child);
            parentMap[pid].ad_spend += child.ad_spend;
            parentMap[pid].ad_sales += child.ad_sales;
            parentMap[pid].impressions += child.impressions;
            parentMap[pid].clicks += child.clicks;
            parentMap[pid].orders += child.orders;
            parentMap[pid].conversions += child.conversions;
            parentMap[pid].total_sales += child.total_sales;
            parentMap[pid].organic_sales += child.organic_sales;
            parentMap[pid].total_units += child.total_units;
        });

        const hierarchicalData = Object.values(parentMap).map(p => {
            p.acos = p.ad_sales > 0 ? (p.ad_spend / p.ad_sales) * 100 : 0;
            p.roas = p.ad_spend > 0 ? p.ad_sales / p.ad_spend : 0;
            p.ctr = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;
            p.cpc = p.clicks > 0 ? p.ad_spend / p.clicks : 0;
            p.conversion_rate = p.clicks > 0 ? (p.orders / p.clicks) * 100 : 0;
            return p;
        });

        // 5. Daily trend data
        const dailyMap = {};
        rawData.forEach(row => {
            const d = row.Date ? row.Date.toISOString().split('T')[0] : 'Unknown';
            if (!dailyMap[d]) {
                dailyMap[d] = { date: d, ad_spend: 0, ad_sales: 0, organic_sales: 0, orders: 0, clicks: 0, impressions: 0 };
            }
            dailyMap[d].ad_spend += Number(row.AdSpend || 0);
            dailyMap[d].ad_sales += Number(row.AdSales || 0);
            dailyMap[d].organic_sales += Number(row.OrganicSales || 0);
            dailyMap[d].orders += Number(row.Orders || 0);
            dailyMap[d].clicks += Number(row.Clicks || 0);
            dailyMap[d].impressions += Number(row.Impressions || 0);
        });

        const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
        dailyData.forEach(d => {
            d.acos = d.ad_sales > 0 ? (d.ad_spend / d.ad_sales) * 100 : 0;
            d.roas = d.ad_spend > 0 ? d.ad_sales / d.ad_spend : 0;
        });

        const allDailyRows = rawData.map(row => ({
            asin: row.Asin,
            sku: row.AdvertisedSku || row.MasterSku || 'None',
            title: row.Title || 'Unknown',
            date: row.Date,
            ad_spend: Number(row.AdSpend || 0),
            ad_sales: Number(row.AdSales || 0),
            impressions: Number(row.Impressions || 0),
            clicks: Number(row.Clicks || 0),
            orders: Number(row.Orders || 0),
            conversions: Number(row.Conversions || 0),
            total_sales: Number(row.TotalSales || 0),
            organic_sales: Number(row.OrganicSales || 0),
            acos: row.AdSales > 0 ? (row.AdSpend / row.AdSales) * 100 : 0,
            roas: row.AdSpend > 0 ? row.AdSales / row.AdSpend : 0,
            ctr: row.Impressions > 0 ? (row.Clicks / row.Impressions) * 100 : 0,
            cpc: row.Clicks > 0 ? row.AdSpend / row.Clicks : 0,
            conversion_rate: row.Clicks > 0 ? (row.Orders / row.Clicks) * 100 : 0
        })).sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ 
            success: true, 
            data: asinList,
            hierarchicalData, 
            dailyData,
            allDailyRows
        });
    } catch (error) {
        console.error('getAdsReport error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get SKU Report (stub)
 */
exports.getSkuReport = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT a.Id, a.AsinCode, a.Title, a.Brand, a.Category, a.CurrentPrice, a.BSR, a.Rating, a.ReviewCount, s.Name as SellerName
            FROM Asins a
            LEFT JOIN Sellers s ON a.SellerId = s.Id
            ORDER BY a.CreatedAt DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Parent ASIN Report (stub)
 */
exports.getParentAsinReport = async (req, res) => {
    res.json({ success: true, data: [] });
};

/**
 * Get Month-wise Report (stub)
 */
exports.getMonthWiseReport = async (req, res) => {
    res.json({ success: true, data: [] });
};

/**
 * Get categories list
 */
exports.getCategories = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT DISTINCT Category as name, COUNT(*) as count
                FROM Asins
                WHERE Category IS NOT NULL AND Category <> ''
                GROUP BY Category
                ORDER BY count DESC
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Global search across ASINs and sellers
 */
/**
 * Dynamic fetcher for Ads Manager Datatable with full aggregations
 */
exports.getAdsManagerData = async (req, res) => {
    try {
        const { groupBy = 'asin', startDate, endDate, search, sellerId } = req.query;
        const pool = await getPool();

        // 1. Subquery to find the last 14 days of date range to pull history accurately
        const dateLimit = startDate ? new Date(startDate) : new Date();
        if (!startDate) dateLimit.setDate(dateLimit.getDate() - 14);

        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (startDate) {
            whereClause += " AND p.Date >= @startDate";
            request.input('startDate', sql.Date, new Date(startDate));
        } else {
            whereClause += " AND p.Date >= DATEADD(day, -30, GETDATE())"; // default to 30d
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

        // Fetch raw data JOINED with parent-asin info
        const result = await request.query(`
            SELECT 
                p.*,
                a.ParentAsin,
                a.Title,
                a.ImageUrl,
                a.Sku as MasterSku,
                a.Category,
                a.Brand
            FROM AdsPerformance p
            INNER JOIN Asins a ON p.Asin = a.AsinCode
            ${whereClause}
            ORDER BY p.Date DESC
        `);

        const rawData = result.recordset;

        // Process aggregation map based on requested 'groupBy' (asin OR parent)
        const groupMap = {};

        rawData.forEach(row => {
            // Resolve core key
            let key;
            if (groupBy === 'parent') {
                key = row.ParentAsin || row.Asin; // Fallback to child if no parent assigned
            } else {
                key = row.Asin;
            }

            if (!groupMap[key]) {
                groupMap[key] = {
                    id: key,
                    asin: groupBy === 'parent' ? null : row.Asin,
                    parentAsin: row.ParentAsin || row.Asin,
                    isParentView: groupBy === 'parent',
                    sku: row.MasterSku || row.AdvertisedSku || 'N/A',
                    title: row.Title || 'Unknown Title',
                    imageUrl: row.ImageUrl || '',
                    category: row.Category,
                    brand: row.Brand,
                    
                    // High level stats for table columns
                    impressions: 0,
                    clicks: 0,
                    spend: 0,
                    sales: 0,
                    orders: 0,
                    conversions: 0,
                    organicSales: 0,
                    organicOrders: 0,
                    pageViews: 0,
                    sessions: 0,
                    
                    // Storage for child breakdown if grouping by parent
                    associatedAsins: new Set(),

                    // Storage for timeline building
                    historyData: {} 
                };
            }

            const target = groupMap[key];
            
            // Sum cumulative values for simple columns
            target.impressions += Number(row.Impressions || 0);
            target.clicks += Number(row.Clicks || 0);
            target.spend += Number(row.AdSpend || 0);
            target.sales += Number(row.AdSales || 0);
            target.orders += Number(row.Orders || 0);
            target.conversions += Number(row.Conversions || 0);
            target.organicSales += Number(row.OrganicSales || 0);
            target.organicOrders += Number(row.OrganicOrders || 0);
            target.pageViews += Number(row.PageViews || 0);
            target.sessions += Number(row.Sessions || 0);

            if (groupBy === 'parent') {
                target.associatedAsins.add(row.Asin);
            }

            // Capture distinct daily values for sparklines/history
            const dStr = row.Date ? row.Date.toISOString().substring(0, 10) : 'Unknown';
            if (!target.historyData[dStr]) {
                target.historyData[dStr] = {
                    date: dStr,
                    impressions: 0,
                    clicks: 0,
                    spend: 0,
                    sales: 0,
                    orders: 0,
                    organicSales: 0,
                    pageViews: 0,
                    conversions: 0
                };
            }
            
            // Aggregate into history day slot (e.g. if multiple asins combine onto 1 parent date)
            const daySlot = target.historyData[dStr];
            daySlot.impressions += Number(row.Impressions || 0);
            daySlot.clicks += Number(row.Clicks || 0);
            daySlot.spend += Number(row.AdSpend || 0);
            daySlot.sales += Number(row.AdSales || 0);
            daySlot.orders += Number(row.Orders || 0);
            daySlot.organicSales += Number(row.OrganicSales || 0);
            daySlot.pageViews += Number(row.PageViews || 0);
            daySlot.conversions += Number(row.Conversions || 0);
        });

        // Final transformation & calculation step (Calculated Rates like ACOS, ROAS, CVR)
        const finalRows = Object.values(groupMap).map(item => {
            // Simple calculated metrics totals
            item.acos = item.sales > 0 ? (item.spend / item.sales) * 100 : 0;
            item.roas = item.spend > 0 ? (item.sales / item.spend) : 0;
            item.cvr = item.clicks > 0 ? (item.orders / item.clicks) * 100 : 0;
            item.ctr = item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0;
            item.cpc = item.clicks > 0 ? (item.spend / item.clicks) : 0;

            if (item.isParentView) {
                item.childCount = item.associatedAsins.size;
                item.asin = Array.from(item.associatedAsins).join(', '); // Display list or generic label
                delete item.associatedAsins;
            }

            // Flatten and sort daily history objects
            const flatHistory = Object.values(item.historyData).sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Inject daily-calculated percentages (Acos per day etc)
            flatHistory.forEach(h => {
                h.acos = h.sales > 0 ? (h.spend / h.sales) * 100 : 0;
                h.roas = h.spend > 0 ? (h.sales / h.spend) : 0;
                h.cvr = h.clicks > 0 ? (h.orders / h.clicks) * 100 : 0;
            });

            item.history = flatHistory;
            
            // Create "weekHistory" proxy that clones flatHistory so front-end code 
            // logic loops flawlessly over the days just like standard ASIN manager.
            item.weekHistory = flatHistory;
            
            delete item.historyData;
            return item;
        });

        res.json({
            success: true,
            total: finalRows.length,
            data: finalRows
        });

    } catch (error) {
        console.error('getAdsManagerData error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.globalSearch = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ success: true, data: [] });

        const pool = await getPool();
        const searchTerm = `%${q}%`;

        const asinsResult = await pool.request()
            .input('search', sql.NVarChar, searchTerm)
            .query(`
                SELECT TOP 10 'asin' as type, Id, AsinCode as name, Title as description
                FROM Asins
                WHERE AsinCode LIKE @search OR Title LIKE @search
            `);

        const sellersResult = await pool.request()
            .input('search', sql.NVarChar, searchTerm)
            .query(`
                SELECT TOP 10 'seller' as type, Id, Name as name, SellerId as description
                FROM Sellers
                WHERE Name LIKE @search OR SellerId LIKE @search
            `);

        res.json({
            success: true,
            data: [...asinsResult.recordset, ...sellersResult.recordset]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAdsPerformance = async (req, res) => {
    try {
        const { asin, startDate, endDate, reportType = 'daily' } = req.query;
        const pool = await getPool();

        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (asin) {
            whereClause += " AND Asin = @asin";
            request.input('asin', sql.VarChar, asin);
        }
        if (startDate) {
            whereClause += " AND Date >= @startDate";
            request.input('startDate', sql.Date, startDate);
        }
        if (endDate) {
            whereClause += " AND Date <= @endDate";
            request.input('endDate', sql.Date, endDate);
        }
        if (reportType) {
            whereClause += " AND ReportType = @reportType";
            request.input('reportType', sql.VarChar, reportType);
        }

        const result = await request.query(`
            SELECT * FROM AdsPerformance
            ${whereClause}
            ORDER BY Date DESC
        `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching ads performance:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProductData = async (req, res) => {
    try {
        const { asin } = req.query;
        if (!asin) return res.status(400).json({ success: false, message: 'ASIN required' });

        const pool = await getPool();
        const result = await pool.request()
            .input('asin', sql.VarChar, asin)
            .query(`SELECT * FROM Asins WHERE AsinCode = @asin`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'ASIN not found' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSellerData = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query("SELECT * FROM Sellers WHERE Id = @sellerId");

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Seller not found' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMonthlyPerformance = async (req, res) => {
    res.json({ success: true, data: [] });
};

exports.getMonthlyPerformance = async (req, res) => {
    res.json({ success: true, data: [] });
};

exports.uploadMonthlyPerformance = async (req, res) => {
    res.status(501).json({ success: false, message: 'Not implemented' });
};

exports.uploadAdsPerformance = async (req, res) => {
    res.status(501).json({ success: false, message: 'Not implemented in SQL yet' });
};
