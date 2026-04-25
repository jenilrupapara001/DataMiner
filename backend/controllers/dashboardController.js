const { sql, getPool } = require('../database/db');

// Helper to parse period strings (e.g., '30d', '3M', '1y')
const parsePeriod = (period) => {
  if (!period) return 30;
  const p = (Array.isArray(period) ? period[0] : period).toString().trim();
  const num = parseInt(p);
  if (isNaN(num)) return 30;
  const suffixMatch = p.match(/[a-zA-Z]+$/);
  const unit = suffixMatch ? suffixMatch[0].toLowerCase() : 'd';

  switch (unit) {
    case 'd': return num;
    case 'w': return num * 7;
    case 'm':
    case 'mo':
    case 'mon': return num * 30;
    case 'q': return num * 90;
    case 'y': return num * 365;
    default: return num;
  }
};

/**
 * Get dashboard summary data (SQL Version)
 */
exports.getDashboardData = async (req, res) => {
  try {
    const { period = '30d', startDate: startQuery, endDate: endQuery } = req.query;
    const pool = await getPool();

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const assignedSellers = req.user?.assignedSellers || [];
    const sellerIds = assignedSellers.map(s => typeof s === 'string' ? s : s._id || s.Id);

    // 1. Base Filters
    const safeSellerIds = sellerIds.length > 0 ? sellerIds : ['000000000000000000000000']; // Fallback to non-existent ID
    let sellerFilter = isGlobalUser ? '' : 'WHERE Id IN (' + safeSellerIds.map(id => `'${id}'`).join(',') + ')';
    let asinFilter = isGlobalUser ? '' : 'WHERE SellerId IN (' + safeSellerIds.map(id => `'${id}'`).join(',') + ')';
    let alertFilter = isGlobalUser ? '' : 'WHERE SellerId IN (' + safeSellerIds.map(id => `'${id}'`).join(',') + ')';

    // 2. Aggregate Counts
    const sellerCounts = await pool.request().query(`
      SELECT 
        COUNT(*) as Total,
        SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as Active
      FROM Sellers ${sellerFilter}
    `);
    
    const asinCounts = await pool.request().query(`
      SELECT 
        COUNT(*) as Total,
        SUM(CASE WHEN Status IN ('Active', 'Scraping') THEN 1 ELSE 0 END) as Active,
        SUM(ISNULL(CurrentPrice, 0)) as PortfolioValue
      FROM Asins ${asinFilter}
    `);

    // 3. Alerts
    const alertsResult = await pool.request().query(`
      SELECT TOP 5 Id, Severity, Message, CreatedAt 
      FROM Alerts ${alertFilter} 
      ORDER BY CreatedAt DESC
    `);

    // 4. Action Stats (User & Team)
    const userActionStats = await pool.request()
      .input('userId', sql.VarChar, req.user.Id || req.user._id.toString())
      .query(`
        SELECT Status, COUNT(*) as Count 
        FROM Actions 
        WHERE AssignedTo = @userId 
        GROUP BY Status
      `);

    const userStats = { pending: 0, inProgress: 0, review: 0, completed: 0, total: 0 };
    userActionStats.recordset.forEach(row => {
      const status = row.Status?.toLowerCase();
      if (status === 'pending') userStats.pending = row.Count;
      else if (status === 'in_progress') userStats.inProgress = row.Count;
      else if (status === 'review') userStats.review = row.Count;
      else if (status === 'completed') userStats.completed = row.Count;
      userStats.total += row.Count;
    });

    let teamStats = null;
    if (isGlobalUser) {
      const teamActionStats = await pool.request().query(`
        SELECT Status, COUNT(*) as Count FROM Actions GROUP BY Status
      `);
      teamStats = { pending: 0, inProgress: 0, review: 0, completed: 0, total: 0 };
      teamActionStats.recordset.forEach(row => {
        const status = row.Status?.toLowerCase();
        if (status === 'pending') teamStats.pending = row.Count;
        else if (status === 'in_progress') teamStats.inProgress = row.Count;
        else if (status === 'review') teamStats.review = row.Count;
        else if (status === 'completed') teamStats.completed = row.Count;
        teamStats.total += row.Count;
      });
    }

    // 5. Date Range Logic
    let startDate, endDate, days;
    let cleanStart = (startQuery === 'null' || startQuery === 'undefined') ? null : startQuery;
    let cleanEnd = (endQuery === 'null' || endQuery === 'undefined') ? null : endQuery;

    if (cleanStart && cleanEnd) {
      startDate = new Date(cleanStart);
      endDate = new Date(cleanEnd);
      days = Math.max(1, Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
    } else {
      days = Math.min(parsePeriod(period), 365);
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
    }

    // 6. Ads Performance & Charts
    // Join Asins with AdsPerformance
    const adsDataResult = await pool.request()
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .query(`
        SELECT 
          A.AsinCode,
          AP.Date,
          AP.AdSales,
          AP.AdSpend,
          AP.Orders,
          AP.OrganicSales,
          AP.Impressions,
          AP.Clicks
        FROM AdsPerformance AP
        JOIN Asins A ON AP.Asin = A.AsinCode
        WHERE AP.Date BETWEEN @startDate AND @endDate
        AND AP.ReportType = 'daily'
        ${asinFilter ? asinFilter.replace('WHERE', 'AND') : ''}
      `);

    const adsData = adsDataResult.recordset || [];
    const totalAdSales = adsData.reduce((sum, ad) => sum + (ad.AdSales || 0), 0);
    const totalAdSpend = adsData.reduce((sum, ad) => sum + (ad.AdSpend || 0), 0);
    const totalOrders = adsData.reduce((sum, ad) => sum + (ad.Orders || 0), 0);
    const totalCatalogValue = (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].PortfolioValue || 0 : 0;

    const activeAsinCount = (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].Active || 0 : 0;
    const kpi = [
      { id: 1, title: 'Total Ad Sales', value: `₹${totalAdSales.toLocaleString()}`, icon: 'bi-graph-up-arrow', trend: totalOrders, trendType: 'positive' },
      { id: 2, title: 'Total Ad Spend', value: `₹${totalAdSpend.toLocaleString()}`, icon: 'bi-cash-stack', trend: 0, trendType: 'neutral' },
      { id: 3, title: 'Active ASINs', value: activeAsinCount.toLocaleString(), icon: 'bi-box-seam', trend: activeAsinCount, trendType: 'positive' },
      { id: 4, title: 'Catalog Value', value: `₹${totalCatalogValue.toLocaleString()}`, icon: 'bi-currency-rupee', trend: 0, trendType: 'neutral' },
    ];

    // Chart processing
    const { revenueData, areaSeries, stackedBarSeries, adsPerformanceSeries, labels } = processChartData(days, adsData, endDate);

    // 7. Category Distribution
    const categoryResult = await pool.request().query(`
      SELECT Category, COUNT(*) as Count 
      FROM Asins ${asinFilter}
      GROUP BY Category
    `);
    const categoryData = processCategoryData(categoryResult.recordset);

    // 8. Top ASINs Table
    const topAsinsResult = await pool.request()
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .query(`
      SELECT TOP 10 
        A.Id, A.AsinCode, A.Sku, A.Title, A.Category, A.CurrentPrice,
        S.Name as SellerName,
        SUM(ISNULL(AP.AdSales, 0)) as TotalAdSales,
        SUM(ISNULL(AP.OrganicSales, 0)) as TotalOrganicSales,
        SUM(ISNULL(AP.AdSpend, 0)) as TotalAdSpend,
        SUM(ISNULL(AP.Orders, 0)) as TotalOrders
      FROM Asins A
      JOIN Sellers S ON A.SellerId = S.Id
      LEFT JOIN AdsPerformance AP ON A.AsinCode = AP.Asin AND AP.Date BETWEEN @startDate AND @endDate
      ${asinFilter}
      GROUP BY A.Id, A.AsinCode, A.Sku, A.Title, A.Category, A.CurrentPrice, S.Name
      ORDER BY TotalAdSales DESC
    `);

    const tableData = topAsinsResult.recordset.map(asin => {
      const totalRev = asin.TotalAdSales + asin.TotalOrganicSales;
      const acos = asin.TotalAdSales > 0 ? (asin.TotalAdSpend / asin.TotalAdSales) * 100 : 0;
      return {
        sku: asin.Sku || asin.AsinCode,
        asin: asin.AsinCode,
        title: asin.Title || 'Unknown Product',
        category: asin.Category || 'Uncategorized',
        revenue: totalRev || asin.CurrentPrice || 0,
        units: asin.TotalOrders || 0,
        acos: acos.toFixed(1) + '%',
      };
    });

    res.json({
      kpi,
      revenue: revenueData,
      areaSeries,
      stackedBarSeries,
      adsPerformanceSeries,
      labels,
      category: categoryData,
      tableData,
      roas: totalAdSpend > 0 ? (totalAdSales / totalAdSpend).toFixed(2) : '0.00',
      dailySpend: days > 0 ? (totalAdSpend / days).toFixed(0) : 0,
      userStats,
      teamStats,
      alerts: alertsResult.recordset.map(a => ({
        id: a.Id,
        type: a.Severity || 'info',
        message: a.Message || 'Alert',
        time: formatTimeAgo(a.CreatedAt),
      })),
      stats: {
        totalSellers: (sellerCounts.recordset && sellerCounts.recordset[0]) ? sellerCounts.recordset[0].Total || 0 : 0,
        activeSellers: (sellerCounts.recordset && sellerCounts.recordset[0]) ? sellerCounts.recordset[0].Active || 0 : 0,
        totalAsins: (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].Total || 0 : 0,
        activeAsins: (asinCounts.recordset && asinCounts.recordset[0]) ? asinCounts.recordset[0].Active || 0 : 0,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function processChartData(days, adsData = [], endDate) {
  const endDateObj = new Date(endDate);
  const useWeekly = days > 14;
  const bucketCount = useWeekly ? Math.ceil(days / 7) : days;
  const buckets = [];

  for (let i = bucketCount - 1; i >= 0; i--) {
    const d = new Date(endDateObj);
    if (useWeekly) d.setDate(d.getDate() - i * 7);
    else d.setDate(d.getDate() - i);
    
    const dateStr = d.toISOString().split('T')[0];
    buckets.push({
      key: dateStr,
      ts: d.getTime(),
      revenue: 0,
      organic: 0,
      ppc: 0,
      adsSpend: 0
    });
  }

  const findBucket = (dateMs) => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < buckets.length; i++) {
      const dist = Math.abs(buckets[i].ts - dateMs);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  };

  adsData.forEach(ad => {
    const adMs = new Date(ad.Date).getTime();
    const idx = findBucket(adMs);
    const b = buckets[idx];
    const rev = ad.AdSales + ad.OrganicSales;
    b.revenue += rev;
    b.organic += ad.OrganicSales || 0;
    b.ppc += ad.AdSales || 0;
    b.adsSpend += ad.AdSpend || 0;
  });

  const labels = buckets.map(b => {
    const date = new Date(b.key);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  });

  return {
    revenueData: [{ name: 'Revenue', data: buckets.map(b => Math.round(b.revenue)) }],
    stackedBarSeries: [
      { name: 'Total Sales', data: buckets.map(b => Math.round(b.revenue)) },
      { name: 'Ad Sales', data: buckets.map(b => Math.round(b.ppc)) },
      { name: 'Organic Sales', data: buckets.map(b => Math.round(b.organic)) }
    ],
    areaSeries: [
      { name: 'Organic Sales', data: buckets.map(b => Math.round(b.organic)) },
      { name: 'Ad Sales', data: buckets.map(b => Math.round(b.ppc)) }
    ],
    adsPerformanceSeries: [
      { name: 'Ad Revenue', data: buckets.map(b => Math.round(b.ppc)) },
      { name: 'Ad Spend', data: buckets.map(b => Math.round(b.adsSpend)) }
    ],
    labels
  };
}

function processCategoryData(rows) {
  const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];
  return rows.map((row, idx) => ({
    name: row.Category || 'Uncategorized',
    data: [row.Count],
    color: colors[idx % colors.length],
  }));
}

function formatTimeAgo(date) {
  if (!date) return 'recently';
  const diff = new Date() - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
