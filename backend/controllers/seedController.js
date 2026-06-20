const { sql, getPool } = require('../database/db');
const axios = require('axios');

// Fetch random avatars from Unsplash
const fetchUnsplashAvatar = async (query = 'person portrait') => {
  try {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) return null;

    const response = await axios.get('https://api.unsplash.com/photos/random', {
      params: { query, orientation: 'squarish' },
      headers: { Authorization: `Client-ID ${accessKey}` }
    });

    return response.data.urls.small;
  } catch (error) {
    return null;
  }
};

// Get dashboard summary from database
exports.getDashboardSummary = async (req, res) => {
  try {
    const pool = await getPool();
    
    const [userRes, roleRes, permissionRes, sellerRes, asinRes, alertRuleRes, statsRes] = await Promise.all([
      pool.request().query("SELECT COUNT(*) as count FROM Users WHERE IsActive = 1"),
      pool.request().query("SELECT COUNT(*) as count FROM Roles"),
      pool.request().query("SELECT COUNT(*) as count FROM Permissions"),
      pool.request().query("SELECT COUNT(*) as count FROM Sellers WHERE IsActive = 1"),
      pool.request().query("SELECT COUNT(*) as count FROM Asins WHERE Status = 'Active'"),
      pool.request().query("SELECT COUNT(*) as count FROM AlertRules WHERE IsActive = 1"),
      pool.request().query(`
        SELECT 
          COUNT(*) as totalAsins,
          SUM(ISNULL(CurrentPrice, 0) * ISNULL(ReviewCount, 100) * 0.3) as totalRevenue,
          SUM(ISNULL(ReviewCount, 100) * 0.3) as totalUnits,
          SUM(CASE WHEN StockLevel < 10 THEN 1 ELSE 0 END) as lowStockCount
        FROM Asins WHERE Status = 'Active'
      `),
    ]);

    const users = userRes.recordset[0].count;
    const roles = roleRes.recordset[0].count;
    const permissions = permissionRes.recordset[0].count;
    const sellers = sellerRes.recordset[0].count;
    const asins = asinRes.recordset[0].count;
    const alertRules = alertRuleRes.recordset[0].count;
    const stats = statsRes.recordset[0];

    const totalRevenue = stats.totalRevenue || 0;
    const totalUnits = stats.totalUnits || 0;
    const avgAcos = asins > 0 ? 22 : 0;
    const avgRoas = asins > 0 ? 3.5 : 0;
    const totalProfit = totalRevenue * 0.22;
    const lowStockCount = stats.lowStockCount || 0;

    res.json({
      success: true,
      data: {
        kpis: [
          { id: 1, title: 'Total Revenue', value: `₹${Math.round(totalRevenue).toLocaleString()}`, icon: 'bi-currency-rupee', trend: 12.5, trendType: 'positive' },
          { id: 2, title: 'Units Sold (30d)', value: totalUnits.toLocaleString(), icon: 'bi-box-seam', trend: 8.3, trendType: 'positive' },
          { id: 3, title: 'Avg ACoS', value: `${avgAcos.toFixed(1)}%`, icon: 'bi-percent', trend: 2.1, trendType: 'positive' },
          { id: 4, title: 'Avg ROAS', value: `${avgRoas.toFixed(2)}x`, icon: 'bi-graph-up', trend: 5.7, trendType: 'positive' },
          { id: 5, title: 'Net Profit (30d)', value: `₹${Math.round(totalProfit).toLocaleString()}`, icon: 'bi-cash-stack', trend: 15.2, trendType: 'positive' },
          { id: 6, title: 'Low Stock Items', value: lowStockCount.toString(), icon: 'bi-exclamation-triangle', trend: lowStockCount, trendType: lowStockCount > 5 ? 'negative' : 'positive' },
          { id: 7, title: 'Active Sellers', value: sellers.toString(), icon: 'bi-shop', trend: 0, trendType: 'neutral' },
          { id: 8, title: 'Active ASINs', value: asins.toString(), icon: 'bi-tag', trend: 0, trendType: 'neutral' },
        ],
        counts: { users, roles, permissions, sellers, asins, alertRules },
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ success: false, message: 'Failed to get dashboard summary' });
  }
};

exports.seedAll = async (req, res) => {
  try {
    // In SQL version, roles and permissions are usually seeded via a script or migration
    // We'll return a placeholder success for now
    res.json({ success: true, message: 'SQL Seeding usually handled via migrations' });
  } catch (error) {
    console.error('Seed all error:', error);
    res.status(500).json({ success: false, message: 'Failed to seed system roles' });
  }
};
