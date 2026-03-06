const mongoose = require('mongoose');
const Seller = require('../models/Seller');
const Asin = require('../models/Asin');
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
    const { period = '30d' } = req.query;
    console.log(`[Dashboard DEBUG] Period received: "${period}" (Type: ${typeof period})`);

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

    const alertFilter = isAdmin ? {} : { sellerId: { $in: allowedSellerIds.map(id => id.toString()) } };
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

    // Chart processing
    const days = Math.min(parsePeriod(period), 365);
    console.log(`[Dashboard DEBUG] Calculated days for processing: ${days}`);

    const { revenueData, unitsData } = processChartData(asins, days);
    const categoryData = processCategoryData(asins);

    const kpi = [
      { id: 1, title: 'Total Sellers', value: totalSellers.toString(), icon: 'bi-shop', trend: 0, trendType: 'neutral' },
      { id: 2, title: 'Active ASINs', value: activeAsins.toLocaleString(), icon: 'bi-box-seam', trend: activeAsins, trendType: 'positive' },
      { id: 3, title: 'Catalog Value', value: `₹${portfolioValue.toLocaleString()}`, icon: 'bi-currency-rupee', trend: 0, trendType: 'neutral' },
      { id: 4, title: 'Avg Price', value: `₹${totalAsins ? (portfolioValue / totalAsins).toFixed(0) : 0}`, icon: 'bi-tag', trend: 0, trendType: 'neutral' },
    ];

    const topAsins = await Asin.find({ ...filter, status: 'Active' })
      .sort({ currentPrice: -1 })
      .limit(10)
      .populate('seller', 'name');

    const tableData = topAsins.map(asin => ({
      sku: asin.sku || asin.asinCode,
      asin: asin.asinCode,
      title: asin.title || 'Unknown Product',
      category: asin.category || 'Uncategorized',
      revenue: asin.currentPrice || 0,
      units: asin.totalOffers || 0,
      aov: (asin.currentPrice || 0).toFixed(2),
      acos: 0,
    }));

    res.json({
      kpi,
      revenue: revenueData,
      units: unitsData,
      category: categoryData,
      tableData,
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
function processChartData(asins, days) {
  const dateMap = {};
  const today = new Date();

  // Ensure days is a positive integer
  const validDays = Math.max(1, Math.floor(days));

  // Initialize map
  for (let i = validDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    try {
      const dateStr = d.toISOString().split('T')[0];
      dateMap[dateStr] = { revenue: 0, units: 0 };
    } catch (e) {
      // Ignore invalid date strings
    }
  }

  asins.forEach(asin => {
    // Check daily history first, then weekly history
    const historyData = (asin.history && asin.history.length > 0) ? asin.history : (asin.weekHistory || []);

    if (historyData && Array.isArray(historyData)) {
      historyData.forEach(h => {
        if (h.date) {
          try {
            const hDate = new Date(h.date);
            const dateStr = hDate.toISOString().split('T')[0];

            // Strictly filter by date range
            if (dateMap[dateStr]) {
              // Priority fields: price > currentPrice > 0
              const price = h.price || h.currentPrice || 0;
              dateMap[dateStr].revenue += price;
            }
          } catch (e) {
            // Skip invalid dates
          }
        }
      });
    }
  });

  const revenueData = Object.keys(dateMap).map(date => ({
    date,
    value: dateMap[date].revenue
  }));

  return {
    revenueData: [{ name: 'Valuation', data: revenueData.map(d => d.value) }],
    unitsData: [{ name: 'Units', data: revenueData.map(d => 0) }]
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

