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
            WHERE CreatedAt >= DATEADD(DAY, -30, dbo.GetEnvDate())
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

        // 1. Fetch relations from Asins table instead of non-existent AsinRelations
        const relResult = await pool.request().query('SELECT AsinCode as ChildAsin, ParentAsin FROM Asins WHERE ParentAsin IS NOT NULL AND ParentAsin <> \'\'');
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
                a.CreatedAt as AsinCreatedAt,
                a.ParentAsin as MasterParentAsin
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
                    parentAsin: row.MasterParentAsin || childToParent[row.Asin] || row.Asin, // Use master data, mapping or self
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
        const { startDate, endDate, sellerId, search, category, page = 1, limit = 50 } = req.query;
        const pool = await getPool();
        const request = pool.request();

        let hasFilter = false;
        let whereClause = "WHERE 1=1";

        if (sellerId) {
            whereClause += " AND a.SellerId = @sellerId";
            request.input('sellerId', sql.VarChar, sellerId);
            hasFilter = true;
        }

        if (category && category !== 'all') {
            whereClause += " AND a.Category = @category";
            request.input('category', sql.VarChar, category);
            hasFilter = true;
        }

        if (search) {
            whereClause += " AND (a.Sku LIKE @search OR a.AsinCode LIKE @search OR a.Title LIKE @search)";
            request.input('search', sql.VarChar, `%${search}%`);
            hasFilter = true;
        }

        if (startDate) {
            request.input('startDate', sql.Date, startDate);
        }
        if (endDate) {
            request.input('endDate', sql.Date, endDate);
        }

        // 1. Optimized Total Count Query
        let totalCount = 0;
        if (!hasFilter) {
            // Instant partition row count for base table
            const fastCountQuery = `
                SELECT SUM(rows) as total 
                FROM sys.partitions 
                WHERE object_id = OBJECT_ID('Asins') AND index_id IN (0, 1)
            `;
            const countResult = await request.query(fastCountQuery);
            totalCount = countResult.recordset[0]?.total || 0;
        } else {
            // High-speed index count
            const countQuery = `
                SELECT COUNT(1) as total
                FROM Asins a
                ${whereClause}
            `;
            const countResult = await request.query(countQuery);
            totalCount = countResult.recordset[0]?.total || 0;
        }

        // 2. Optimized KPI Summary Query
        let kpis = {
            total_revenue: 0,
            units_sold: 0,
            ad_sales: 0,
            ad_spend: 0,
            clicks: 0,
            impressions: 0,
            sessions: 0
        };

        if (!hasFilter) {
            // Query AdsPerformance directly (under 5ms!)
            const kpiQueryDirect = `
                SELECT 
                    SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)) as total_revenue,
                    SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) as units_sold,
                    SUM(ISNULL(AdSales, 0)) as ad_sales,
                    SUM(ISNULL(AdSpend, 0)) as ad_spend,
                    SUM(ISNULL(Clicks, 0)) as clicks,
                    SUM(ISNULL(Impressions, 0)) as impressions,
                    SUM(ISNULL(Sessions, 0)) as sessions
                FROM AdsPerformance
                WHERE 1=1
                    ${startDate ? 'AND Date >= @startDate' : ''}
                    ${endDate ? 'AND Date <= @endDate' : ''}
            `;
            const kpiResult = await request.query(kpiQueryDirect);
            if (kpiResult.recordset[0]) kpis = kpiResult.recordset[0];
        } else {
            // CTE-based filter to join only matching ASINs
            const kpiQueryFiltered = `
                WITH FilteredAsins AS (
                    SELECT AsinCode FROM Asins a ${whereClause}
                )
                SELECT 
                    SUM(ISNULL(p.AdSales, 0) + ISNULL(p.OrganicSales, 0)) as total_revenue,
                    SUM(ISNULL(p.Orders, 0) + ISNULL(p.OrganicOrders, 0)) as units_sold,
                    SUM(ISNULL(p.AdSales, 0)) as ad_sales,
                    SUM(ISNULL(p.AdSpend, 0)) as ad_spend,
                    SUM(ISNULL(p.Clicks, 0)) as clicks,
                    SUM(ISNULL(p.Impressions, 0)) as impressions,
                    SUM(ISNULL(p.Sessions, 0)) as sessions
                FROM FilteredAsins a
                INNER JOIN AdsPerformance p ON a.AsinCode = p.Asin
                WHERE 1=1
                    ${startDate ? 'AND p.Date >= @startDate' : ''}
                    ${endDate ? 'AND p.Date <= @endDate' : ''}
            `;
            const kpiResult = await request.query(kpiQueryFiltered);
            if (kpiResult.recordset[0]) kpis = kpiResult.recordset[0];
        }

        // Ensure numerical fallbacks are never null
        kpis.total_revenue = kpis.total_revenue || 0;
        kpis.units_sold = kpis.units_sold || 0;
        kpis.ad_sales = kpis.ad_sales || 0;
        kpis.ad_spend = kpis.ad_spend || 0;
        kpis.clicks = kpis.clicks || 0;
        kpis.impressions = kpis.impressions || 0;
        kpis.sessions = kpis.sessions || 0;

        // 3. Optimized Paged Listings CTE
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const pagedQuery = `
            WITH FilteredAsins AS (
                SELECT Sku, AsinCode, Title, Category, CurrentPrice
                FROM Asins a
                ${whereClause}
            ),
            AggregatedPerformance AS (
                SELECT 
                    Asin,
                    SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)) as total_revenue,
                    SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) as units_sold,
                    SUM(ISNULL(AdSales, 0)) as ad_sales,
                    SUM(ISNULL(AdSpend, 0)) as ad_spend,
                    SUM(ISNULL(Clicks, 0)) as clicks,
                    SUM(ISNULL(Impressions, 0)) as impressions,
                    SUM(ISNULL(Sessions, 0)) as sessions
                FROM AdsPerformance
                WHERE 1=1
                    ${startDate ? 'AND Date >= @startDate' : ''}
                    ${endDate ? 'AND Date <= @endDate' : ''}
                GROUP BY Asin
            )
            SELECT 
                ISNULL(a.Sku, 'N/A') as sku,
                a.AsinCode as asin,
                a.Title as title,
                a.Category as category,
                a.CurrentPrice as price,
                ISNULL(p.total_revenue, 0) as total_revenue,
                ISNULL(p.units_sold, 0) as units_sold,
                ISNULL(p.ad_sales, 0) as ad_sales,
                ISNULL(p.ad_spend, 0) as ad_spend,
                ISNULL(p.clicks, 0) as clicks,
                ISNULL(p.impressions, 0) as impressions,
                ISNULL(p.sessions, 0) as sessions
            FROM FilteredAsins a
            LEFT JOIN AggregatedPerformance p ON a.AsinCode = p.Asin
            ORDER BY total_revenue DESC, units_sold DESC
            OFFSET ${offset} ROWS
            FETCH NEXT ${parseInt(limit)} ROWS ONLY
        `;
        const result = await request.query(pagedQuery);

        // 4. Optimized Category Breakdown CTE
        const categoryQuery = `
            WITH FilteredAsins AS (
                SELECT AsinCode, Category FROM Asins a ${whereClause}
            ),
            AggregatedPerformance AS (
                SELECT 
                    Asin,
                    SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)) as total_revenue
                FROM AdsPerformance
                WHERE 1=1
                    ${startDate ? 'AND Date >= @startDate' : ''}
                    ${endDate ? 'AND Date <= @endDate' : ''}
                GROUP BY Asin
            )
            SELECT TOP 5
                ISNULL(a.Category, 'General') as category,
                SUM(p.total_revenue) as revenue
            FROM FilteredAsins a
            INNER JOIN AggregatedPerformance p ON a.AsinCode = p.Asin
            GROUP BY a.Category
            ORDER BY revenue DESC
        `;
        const categoryResult = await request.query(categoryQuery);

        res.json({
            success: true,
            data: result.recordset,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit)
            },
            kpis,
            categories: categoryResult.recordset
        });
    } catch (error) {
        console.error('getSkuReport error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Parent ASIN Report with aggregated metrics
 */
exports.getParentAsinReport = async (req, res) => {
    try {
        const { startDate, endDate, sellerId } = req.query;
        const pool = await getPool();

        const request = pool.request();
        let whereClause = "WHERE a.ParentAsin IS NOT NULL AND a.ParentAsin <> ''";

        if (sellerId) {
            whereClause += " AND a.SellerId = @sellerId";
            request.input('sellerId', sql.VarChar, sellerId);
        }

        if (startDate) {
            request.input('startDate', sql.Date, startDate);
        }
        if (endDate) {
            request.input('endDate', sql.Date, endDate);
        }

        // Aggregate metrics by ParentAsin
        const query = `
            SELECT 
                a.ParentAsin as parent_asin,
                MAX(a.Title) as title,
                MAX(a.Brand) as brand,
                COUNT(DISTINCT a.AsinCode) as childCount,
                SUM(ISNULL(p.AdSales, 0) + ISNULL(p.OrganicSales, 0)) as total_revenue,
                CASE WHEN SUM(ISNULL(p.AdSales, 0)) > 0 
                     THEN (SUM(ISNULL(p.AdSpend, 0)) / SUM(ISNULL(p.AdSales, 0))) * 100 
                     ELSE 0 END as acos,
                CASE WHEN SUM(ISNULL(p.AdSpend, 0)) > 0 
                     THEN SUM(ISNULL(p.AdSales, 0)) / SUM(ISNULL(p.AdSpend, 0)) 
                     ELSE 0 END as roas
            FROM Asins a
            LEFT JOIN AdsPerformance p ON a.AsinCode = p.Asin 
                ${startDate ? 'AND p.Date >= @startDate' : ''}
                ${endDate ? 'AND p.Date <= @endDate' : ''}
            ${whereClause}
            GROUP BY a.ParentAsin
            ORDER BY total_revenue DESC
        `;

        const result = await request.query(query);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('getParentAsinReport error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Month-wise Performance Report
 */
exports.getMonthWiseReport = async (req, res) => {
    try {
        const { sellerId, year } = req.query;
        const pool = await getPool();
        const request = pool.request();

        let whereClause = "WHERE 1=1";
        if (sellerId) {
            whereClause += " AND a.SellerId = @sellerId";
            request.input('sellerId', sql.VarChar, sellerId);
        }

        const targetYear = year || new Date().getFullYear();
        request.input('year', sql.Int, targetYear);

        const query = `
            SELECT 
                FORMAT(p.Date, 'MMM yyyy') as month,
                SUM(ISNULL(p.AdSales, 0) + ISNULL(p.OrganicSales, 0)) as revenue,
                SUM(ISNULL(p.AdSpend, 0)) as ad_spend,
                COUNT(DISTINCT p.Asin) as active_asins
            FROM AdsPerformance p
            JOIN Asins a ON p.Asin = a.AsinCode
            ${whereClause} AND YEAR(p.Date) = @year
            GROUP BY FORMAT(p.Date, 'MMM yyyy'), MONTH(p.Date)
            ORDER BY MONTH(p.Date)
        `;

        const result = await request.query(query);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('getMonthWiseReport error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
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
        const { groupBy = 'asin', startDate, endDate, search, sellerId, page = 1, limit = 50, sortBy = 'sales', sortOrder = 'desc' } = req.query;
        const pool = await getPool();
        const request = pool.request();

        let whereClause = 'WHERE 1=1';

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

        // 1. Get Global Chart Data (Aggregated by Date)
        const globalChartQuery = `
            SELECT 
                CONVERT(varchar, p.Date, 23) as date,
                SUM(ISNULL(p.AdSpend, 0)) as spend,
                SUM(ISNULL(p.AdSales, 0)) as sales,
                SUM(ISNULL(p.Clicks, 0)) as clicks,
                SUM(ISNULL(p.Impressions, 0)) as impressions,
                SUM(ISNULL(p.Orders, 0)) as orders,
                SUM(ISNULL(p.OrganicSales, 0)) as organicSales,
                SUM(ISNULL(p.OrganicOrders, 0)) as organicOrders
            FROM AdsPerformance p
            LEFT JOIN Asins a ON p.Asin = a.AsinCode
            ${whereClause}
            GROUP BY CONVERT(varchar, p.Date, 23)
            ORDER BY date ASC
        `;
        const globalChartResult = await request.query(globalChartQuery);

        // 2. Count Total Rows (for Pagination)
        const groupField = groupBy === 'parent' ? 'ISNULL(a.ParentAsin, p.Asin)' : 'p.Asin';

        const countQuery = `
            SELECT COUNT(DISTINCT ${groupField}) as total
            FROM AdsPerformance p
            LEFT JOIN Asins a ON p.Asin = a.AsinCode
            ${whereClause}
        `;
        const countResult = await request.query(countQuery);
        const totalRows = countResult.recordset[0]?.total || 0;

        // 3. Paginated Aggregation CTE
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 50;
        const offset = (pageNum - 1) * limitNum;

        let sortCol = 'sales';
        if (sortBy === 'spend') sortCol = 'SUM(ISNULL(p.AdSpend, 0))';
        else if (sortBy === 'sales') sortCol = 'SUM(ISNULL(p.AdSales, 0))';
        else if (sortBy === 'totalSales') sortCol = 'SUM(ISNULL(p.AdSales, 0)) + SUM(ISNULL(p.OrganicSales, 0))';
        else if (sortBy === 'impressions') sortCol = 'SUM(ISNULL(p.Impressions, 0))';
        else if (sortBy === 'clicks') sortCol = 'SUM(ISNULL(p.Clicks, 0))';
        else if (sortBy === 'acos') sortCol = 'CASE WHEN SUM(ISNULL(p.AdSales, 0)) > 0 THEN (SUM(ISNULL(p.AdSpend, 0)) / SUM(ISNULL(p.AdSales, 0))) ELSE 0 END';
        else if (sortBy === 'tacos') sortCol = 'CASE WHEN (SUM(ISNULL(p.AdSales, 0)) + SUM(ISNULL(p.OrganicSales, 0))) > 0 THEN (SUM(ISNULL(p.AdSpend, 0)) / (SUM(ISNULL(p.AdSales, 0)) + SUM(ISNULL(p.OrganicSales, 0)))) ELSE 0 END';
        else if (sortBy === 'roas') sortCol = 'CASE WHEN SUM(ISNULL(p.AdSpend, 0)) > 0 THEN (SUM(ISNULL(p.AdSales, 0)) / SUM(ISNULL(p.AdSpend, 0))) ELSE 0 END';
        else if (sortBy === 'orders') sortCol = 'SUM(ISNULL(p.Orders, 0))';
        else if (sortBy === 'cvr') sortCol = 'CASE WHEN SUM(ISNULL(p.Clicks, 0)) > 0 THEN (SUM(ISNULL(p.Orders, 0)) / CAST(SUM(ISNULL(p.Clicks, 0)) AS FLOAT)) ELSE 0 END';
        else if (sortBy === 'pageViews') sortCol = 'SUM(ISNULL(p.PageViews, 0))';
        else if (sortBy === 'organicSales') sortCol = 'SUM(ISNULL(p.OrganicSales, 0))';
        else sortCol = 'SUM(ISNULL(p.AdSales, 0))';

        const sortDir = (sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const pagedQuery = `
            SELECT 
                ${groupField} as groupKey,
                MAX(a.Title) as title,
                MAX(a.ImageUrl) as imageUrl,
                MAX(a.Sku) as sku,
                MAX(a.Category) as category,
                MAX(a.Brand) as brand,
                MAX(a.SellerId) as sellerId,
                COUNT(DISTINCT p.Asin) as childCount,
                SUM(ISNULL(p.AdSpend, 0)) as spend,
                SUM(ISNULL(p.AdSales, 0)) as sales,
                SUM(ISNULL(p.Clicks, 0)) as clicks,
                SUM(ISNULL(p.Impressions, 0)) as impressions,
                SUM(ISNULL(p.Orders, 0)) as orders,
                SUM(ISNULL(p.OrganicSales, 0)) as organicSales,
                SUM(ISNULL(p.OrganicOrders, 0)) as organicOrders,
                SUM(ISNULL(p.PageViews, 0)) as pageViews,
                SUM(ISNULL(p.Sessions, 0)) as sessions,
                SUM(ISNULL(p.Conversions, 0)) as conversions
            FROM AdsPerformance p
            LEFT JOIN Asins a ON p.Asin = a.AsinCode
            ${whereClause}
            GROUP BY ${groupField}
            ORDER BY ${sortCol} ${sortDir}
            OFFSET ${offset} ROWS
            FETCH NEXT ${limitNum} ROWS ONLY
        `;

        const pagedResult = await request.query(pagedQuery);
        const pagedRows = pagedResult.recordset;

        // 4. Fetch Daily History just for the returned rows
        let finalRows = [];
        if (pagedRows.length > 0) {
            const groupKeys = pagedRows.map(r => `'${r.groupKey.replace(/'/g, "''")}'`).join(',');
            
            const historyQuery = `
                SELECT 
                    ${ groupField } as groupKey,
                CONVERT(varchar, p.Date, 23) as date,
                SUM(ISNULL(p.AdSpend, 0)) as spend,
                SUM(ISNULL(p.AdSales, 0)) as sales,
                SUM(ISNULL(p.Clicks, 0)) as clicks,
                SUM(ISNULL(p.Impressions, 0)) as impressions,
                SUM(ISNULL(p.Orders, 0)) as orders,
                SUM(ISNULL(p.OrganicSales, 0)) as organicSales,
                SUM(ISNULL(p.OrganicOrders, 0)) as organicOrders,
                SUM(ISNULL(p.PageViews, 0)) as pageViews,
                SUM(ISNULL(p.Conversions, 0)) as conversions
                FROM AdsPerformance p
                LEFT JOIN Asins a ON p.Asin = a.AsinCode
                ${ whereClause }
                AND ${ groupField } IN(${ groupKeys })
                GROUP BY ${ groupField }, CONVERT(varchar, p.Date, 23)
                ORDER BY date ASC
                `;
            
            const historyResult = await request.query(historyQuery);
            const historyRows = historyResult.recordset;

            // Fetch Targets for the sellers
            const uniqueSellers = [...new Set(pagedRows.map(r => r.sellerId).filter(Boolean))].map(String);
            let sellerTargets = [];
            if (uniqueSellers.length > 0) {
                const currentMonth = new Date().getMonth() + 1;
                const currentYear = new Date().getFullYear();
                
                const targetsQuery = `
                    SELECT t.SellerId, t.GoalType, ISNULL(b.TargetValue, t.TotalTargetValue) as TotalTargetValue
                    FROM GmsTargets t
                    LEFT JOIN GmsTargetBreakdowns b ON t.Id = b.TargetId AND b.PeriodType = 'MONTH' AND b.PeriodValue = @currentMonth
                    WHERE t.Year = @currentYear
                      AND (
                          (t.TargetType = 'MONTHLY' AND t.Month = @currentMonth) 
                          OR 
                          (t.TargetType = 'YEARLY')
                      )
                      AND t.SellerId IN (${uniqueSellers.map(s => `'${s.replace(/'/g, "''")}'`).join(',')})
                      AND t.GoalType IN ('ADS', 'ACOS')
                `;
                const tReq = pool.request();
                tReq.input('currentMonth', sql.Int, currentMonth);
                tReq.input('currentYear', sql.Int, currentYear);
                const targetsResult = await tReq.query(targetsQuery);
                sellerTargets = targetsResult.recordset;
            }

            finalRows = pagedRows.map(row => {
                const history = historyRows.filter(h => h.groupKey === row.groupKey).map(h => ({
                    date: h.date,
                    spend: h.spend,
                    sales: h.sales,
                    clicks: h.clicks,
                    impressions: h.impressions,
                    orders: h.orders,
                    organicSales: h.organicSales,
                    organicOrders: h.organicOrders,
                    pageViews: h.pageViews,
                    conversions: h.conversions,
                    totalSales: h.sales + h.organicSales,
                    totalOrders: h.orders + h.organicOrders,
                    acos: h.sales > 0 ? (h.spend / h.sales) * 100 : 0,
                    tacos: (h.sales + h.organicSales) > 0 ? (h.spend / (h.sales + h.organicSales)) * 100 : 0,
                    adSalesPct: (h.sales + h.organicSales) > 0 ? (h.sales / (h.sales + h.organicSales)) * 100 : 0,
                    roas: h.spend > 0 ? (h.sales / h.spend) : 0,
                    cvr: h.clicks > 0 ? (h.orders / h.clicks) * 100 : 0
                }));

                const totalSales = row.sales + row.organicSales;
                return {
                    id: row.groupKey,
                    asin: groupBy === 'parent' ? null : row.groupKey,
                    parentAsin: groupBy === 'parent' ? row.groupKey : null,
                    isParentView: groupBy === 'parent',
                    childCount: row.childCount,
                    sku: groupBy === 'parent' ? 'PARENT' : (row.sku || 'N/A'),
                    title: groupBy === 'parent' ? `Parent Group: ${row.groupKey}` : (row.title || 'Unknown Title'),
                    imageUrl: row.imageUrl || '',
                    category: row.category,
                    brand: row.brand,
                    sellerId: row.sellerId,
                    adsTarget: sellerTargets.find(t => t.SellerId === row.sellerId && t.GoalType === 'ADS')?.TotalTargetValue || null,
                    acosTarget: sellerTargets.find(t => t.SellerId === row.sellerId && t.GoalType === 'ACOS')?.TotalTargetValue || null,
                    impressions: row.impressions,
                    clicks: row.clicks,
                    spend: row.spend,
                    sales: row.sales,
                    orders: row.orders,
                    conversions: row.conversions,
                    organicSales: row.organicSales,
                    organicOrders: row.organicOrders,
                    pageViews: row.pageViews,
                    sessions: row.sessions,
                    totalSales,
                    totalOrders: row.orders + row.organicOrders,
                    acos: row.sales > 0 ? (row.spend / row.sales) * 100 : 0,
                    tacos: totalSales > 0 ? (row.spend / totalSales) * 100 : 0,
                    adSalesPct: totalSales > 0 ? (row.sales / totalSales) * 100 : 0,
                    roas: row.spend > 0 ? (row.sales / row.spend) : 0,
                    cvr: row.clicks > 0 ? (row.orders / row.clicks) * 100 : 0,
                    ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
                    cpc: row.clicks > 0 ? (row.spend / row.clicks) : 0,
                    history: history,
                    weekHistory: history
                };
            });
        }

        res.json({
            success: true,
            total: totalRows,
            page: pageNum,
            limit: limitNum,
            data: finalRows,
            globalChartData: globalChartResult.recordset.map(day => {
                const totalS = day.sales + day.organicSales;
                return {
                    ...day,
                    totalSales: totalS,
                    acos: day.sales > 0 ? (day.spend / day.sales) * 100 : 0,
                    tacos: totalS > 0 ? (day.spend / totalS) * 100 : 0,
                    adSalesPct: totalS > 0 ? (day.sales / totalS) * 100 : 0,
                    roas: day.spend > 0 ? (day.sales / day.spend) : 0,
                    cvr: day.clicks > 0 ? (day.orders / day.clicks) * 100 : 0,
                    cpc: day.clicks > 0 ? (day.spend / day.clicks) : 0,
                    ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0,
                    totalOrders: day.orders + day.organicOrders
                };
            })
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
        const searchTerm = `% ${ q } % `;

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
            ${ whereClause }
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
