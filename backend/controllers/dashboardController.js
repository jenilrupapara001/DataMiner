const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const Asin = require('../models/Asin');
const AdsPerformance = require('../models/AdsPerformance');
const { Alert } = require('../models/AlertModel');

// Helper to parse period strings (e.g., '30d', '3M', '1y')
const parsePeriod = (period) => {
  if (!period) return 30;

  const p = (Array.isArray(period) ? period[0] : period).toString().trim();
  const num = parseInt(p);
  if (isNaN(num)) return 30;

  // Extract suffix (can be multiple chars like 'mo')
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

const Action = require('../models/Action');

// Get dashboard summary data
exports.getDashboardData = async (req, res) => {
  try {
    const { period = '30d', startDate: startQuery, endDate: endQuery } = req.query;
    console.log(`[Dashboard DEBUG] Params received: period="${period}", start="${startQuery}", end="${endQuery}"`);

    if (!req.user) {
      console.log('[Dashboard DEBUG] Unauthorized request');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userRole = req.user.role?.name || (typeof req.user.role === 'string' ? req.user.role : null);
    const isAdmin = userRole === 'admin';
    const allowedSellerIds = req.user.assignedSellers?.map(s => s._id) || [];

    const filter = {};
    const sellerFilter = {};

    if (!isAdmin) {
      filter.seller = { $in: allowedSellerIds };
      sellerFilter._id = { $in: allowedSellerIds };
    }

    console.log('[Dashboard DEBUG] Query Filter:', JSON.stringify(filter));

    const totalSellers = await Seller.countDocuments(sellerFilter);
    const activeSellers = await Seller.countDocuments({ ...sellerFilter, status: 'Active' });
    console.log(`[Dashboard DEBUG] Sellers - Total: ${totalSellers}, Active: ${activeSellers}`);

    const totalAsins = await Asin.countDocuments(filter);
    const activeAsins = await Asin.countDocuments({ ...filter, status: 'Active' });
    console.log(`[Dashboard DEBUG] ASINs - Total: ${totalAsins}, Active: ${activeAsins}`);

    const asins = await Asin.find(filter).lean();
    console.log(`[Dashboard DEBUG] Found ${asins.length} ASINs`);

    const portfolioValue = asins.reduce((acc, curr) => acc + (curr.currentPrice || 0), 0);
    console.log(`[Dashboard DEBUG] Portfolio Value: ${portfolioValue}`);

    const alertFilter = isAdmin ? {} : { sellerId: { $in: (allowedSellerIds || []).map(id => id.toString()) } };
    const alerts = await Alert.find(alertFilter)
      .sort({ createdAt: -1 })
      .limit(5);
    console.log(`[Dashboard DEBUG] Found ${alerts?.length || 0} alerts`);

    // Fetch user-specific action stats
    const userActions = await Action.aggregate([
      { $match: { assignedTo: req.user._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const userStats = {
      pending: 0,
      inProgress: 0,
      review: 0,
      completed: 0,
      total: 0
    };

    userActions.forEach(stat => {
      const status = stat._id?.toLowerCase();
      if (status === 'pending') userStats.pending = stat.count;
      else if (status === 'in_progress') userStats.inProgress = stat.count;
      else if (status === 'review') userStats.review = stat.count;
      else if (status === 'completed') userStats.completed = stat.count;
      userStats.total += stat.count;
    });

    // If admin, also get team stats
    let teamStats = null;
    if (isAdmin) {
      const allActions = await Action.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      teamStats = { pending: 0, inProgress: 0, review: 0, completed: 0, total: 0 };
      allActions.forEach(stat => {
        const status = stat._id?.toLowerCase();
        if (status === 'pending') teamStats.pending = stat.count;
        else if (status === 'in_progress') teamStats.inProgress = stat.count;
        else if (status === 'review') teamStats.review = stat.count;
        else if (status === 'completed') teamStats.completed = stat.count;
        teamStats.total += stat.count;
      });
    }

    // Fetch Ads Performance data for the active ASINs
    const asinCodes = asins.map(a => a.asinCode);
    
    let startDate, endDate, days;
    if (startQuery && endQuery) {
        startDate = new Date(startQuery);
        endDate = new Date(endQuery);
        days = Math.max(1, Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24)) + 1);
        console.log(`[Dashboard DEBUG] Using custom range: ${startDate.toISOString()} to ${endDate.toISOString()} (${days} days)`);
    } else {
        days = Math.min(parsePeriod(period), 365);
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        console.log(`[Dashboard DEBUG] Using period: ${period} (${days} days) starting from ${startDate.toISOString()}`);
    }

    const adsData = await AdsPerformance.find({
      asin: { $in: asinCodes },
      date: { $gte: startDate, $lte: endDate },
      reportType: 'daily'
    }).sort({ date: 1 }).lean();

    console.log(`[Dashboard DEBUG] Found ${adsData.length} AdsPerformance records`);

    // Chart processing
    const { revenueData, areaSeries, stackedBarSeries, adsPerformanceSeries, labels } = processChartData(asins, days, adsData, endDate);
    const categoryData = processCategoryData(asins);

    // Aggregate Ad Sales and Spend from the fetched ads data
    const totalAdSales = adsData.reduce((sum, ad) => sum + (ad.ad_sales || 0), 0);
    const totalAdSpend = adsData.reduce((sum, ad) => sum + (ad.ad_spend || 0), 0);
    const totalOrders = adsData.reduce((sum, ad) => sum + (ad.orders || 0), 0);
    const roas = totalAdSpend > 0 ? (totalAdSales / totalAdSpend).toFixed(2) : '0.00';
    const dailySpend = days > 0 ? (totalAdSpend / days).toFixed(0) : 0;

    const kpi = [
      { id: 1, title: 'Total Ad Sales', value: `₹${totalAdSales.toLocaleString()}`, icon: 'bi-graph-up-arrow', trend: totalOrders, trendType: 'positive' },
      { id: 2, title: 'Total Ad Spend', value: `₹${totalAdSpend.toLocaleString()}`, icon: 'bi-cash-stack', trend: 0, trendType: 'neutral' },
      { id: 3, title: 'Active ASINs', value: activeAsins.toLocaleString(), icon: 'bi-box-seam', trend: activeAsins, trendType: 'positive' },
      { id: 4, title: 'Catalog Value', value: `₹${portfolioValue.toLocaleString()}`, icon: 'bi-currency-rupee', trend: 0, trendType: 'neutral' },
    ];

    // Aggregate Ads Performance by ASIN for the table
    const adsByAsin = {};
    adsData.forEach(ad => {
        if (!adsByAsin[ad.asin]) {
            adsByAsin[ad.asin] = { sales: 0, spend: 0, orders: 0, organic: 0 };
        }
        adsByAsin[ad.asin].sales += (ad.ad_sales || 0);
        adsByAsin[ad.asin].spend += (ad.ad_spend || 0);
        adsByAsin[ad.asin].orders += (ad.orders || 0);
        adsByAsin[ad.asin].organic += (ad.organic_sales || 0);
    });

    const topAsins = await Asin.find({ ...filter, status: 'Active' })
      .sort({ currentPrice: -1 })
      .limit(10)
      .populate('seller', 'name');

    const tableData = topAsins.map(asin => {
      const stats = adsByAsin[asin.asinCode] || { sales: 0, spend: 0, orders: 0, organic: 0 };
      const totalRev = stats.sales + stats.organic;
      const acos = stats.sales > 0 ? (stats.spend / stats.sales) * 100 : 0;
      
      return {
        sku: asin.sku || asin.asinCode,
        asin: asin.asinCode,
        title: asin.title || 'Unknown Product',
        category: asin.category || 'Uncategorized',
        revenue: totalRev || asin.currentPrice || 0, // Favor real sales, fallback to catalog price
        units: stats.orders || asin.totalOffers || 0,
        aov: totalRev > 0 && stats.orders > 0 ? (totalRev / stats.orders).toFixed(2) : (asin.currentPrice || 0).toFixed(2),
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
      roas,
      dailySpend,
      userStats,
      teamStats,
      alerts: (alerts || []).map(a => ({
        id: a._id,
        type: a.severity || 'info',
        message: a.message || 'Alert',
        time: formatTimeAgo(a.createdAt || new Date()),
      })),
      stats: {
        totalSellers,
        activeSellers,
        totalAsins,
        activeAsins,
      }
    });
  } catch (error) {
    console.error('CRITICAL Dashboard Error:', error.message);
    console.error(error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};

// Defensive helper functions
function processChartData(asins, days, adsData = [], endDate) {
  const endDateObj = endDate ? new Date(endDate) : new Date();
  const validDays = Math.max(1, Math.floor(days));

  // Use weekly buckets for periods > 14 days, otherwise daily
  const useWeekly = validDays > 14;
  const bucketCount = useWeekly ? Math.ceil(validDays / 7) : validDays;

  // Build ordered bucket keys
  const buckets = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const d = new Date(endDateObj);
    if (useWeekly) {
      d.setDate(d.getDate() - i * 7);
    } else {
      d.setDate(d.getDate() - i);
    }
    const dateStr = d.toISOString().split('T')[0];
    buckets.push({
      key: dateStr,
      ts: d.getTime(),
      revenue: 0,
      profit: 0,
      returns: 0,
      organic: 0,
      ppc: 0,
      adsSpend: 0,
      direct: 0,
      count: 0,
      hasRealData: false
    });
  }

  // Helper: find the closest bucket for a given date
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

  const startMs = buckets[0].ts - (useWeekly ? 4 * 86400000 : 86400000);

  // 1. Process Real Ads Data first (highest priority)
  if (adsData && adsData.length > 0) {
    adsData.forEach(ad => {
      const adDate = new Date(ad.date);
      const adMs = adDate.getTime();
      if (adMs >= startMs) {
        const bucketIdx = findBucket(adMs);
        const b = buckets[bucketIdx];

        // Preference order for revenue: total_sales > ad_sales + organic_sales
        const revenue = ad.total_sales || (ad.ad_sales + ad.organic_sales) || 0;
        b.revenue += revenue;
        b.organic += ad.organic_sales || 0;
        b.ppc += ad.ad_sales || 0;
        b.adsSpend += ad.ad_spend || 0;
        b.profit += (revenue * 0.25) - (ad.ad_spend || 0);
        b.hasRealData = true;
      }
    });
  }

  // 2. Process ASIN History / weekHistory (fallback if no real ads data for that bucket)
  asins.forEach(asin => {
    const historyData = (asin.history && asin.history.length > 0) ? asin.history : (asin.weekHistory || []);
    
    if (historyData && Array.isArray(historyData) && historyData.length > 0) {
        // If we already have real AdsPerformance data for this period, we might not want to mix it with history estimations
        // unless they are complementary. For now, we only use history if NO Ads data was found in any bucket.
        const hasAnyAdsData = adsData && adsData.length > 0;
        
      historyData.forEach(h => {
        if (!h.date) return;
        try {
          const hDate = new Date(h.date);
          const hMs = hDate.getTime();

          if (hMs >= startMs) {
            const bucketIdx = findBucket(hMs);
            const b = buckets[bucketIdx];

            // Only add estimation data if this bucket isn't already populated by real Ads data
            // AND we don't have better data overall
            if (!b.hasRealData && !hasAnyAdsData) {
              const price = h.price || h.currentPrice || 0;
              const margin = asin.feePreview?.margin || 0.25;
              const revenue = price; // This is catalog valuation proxy
              const profit = price * margin;
              
              b.revenue += revenue;
              b.profit += profit;
              b.count++;

              const bsr = h.salesRank || h.bsr || 10000;
              const organicFactor = Math.max(0.3, Math.min(0.8, 1 - (bsr / 20000)));
              b.organic += revenue * organicFactor;
              b.ppc += revenue * (1 - organicFactor) * 0.7;
              b.direct += revenue * (1 - organicFactor) * 0.3;
            }
          }
        } catch (e) {}
      });
    }
  });

  // 3. REMOVED: Global Baseline (synthetic data). 
  // If no data is found, charts will display 0 or partial data accurately.

  // Produce output in format expected by Dashboard.jsx
  const labels = buckets.map(b => {
    const date = new Date(b.key);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  });

  return {
    revenueData: [{ name: 'Valuation', data: buckets.map(b => Math.round(b.revenue)) }],
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

function processCategoryData(asins) {
  const categories = {};
  asins.forEach(asin => {
    const category = asin.category || 'Uncategorized';
    categories[category] = (categories[category] || 0) + 1;
  });

  const colors = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4'];
  const categoryNames = Object.keys(categories);

  return categoryNames.map((name, idx) => ({
    name,
    data: [categories[name]],
    color: colors[idx % colors.length],
  }));
}

function formatTimeAgo(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'recently';

    const now = new Date();
    const diff = now - d;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  } catch (e) {
    return 'recently';
  }
}

