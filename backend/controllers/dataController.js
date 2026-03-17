const Master = require("../models/Master");
const MonthlyPerformance = require("../models/MonthlyPerformance");
const AdsPerformance = require("../models/AdsPerformance");
const Asin = require("../models/Asin");

// Get category-specific attribute mapping
const getCategoryAttributes = (category) => {
  const attributeMaps = {
    apparel: {
      variant1: 'size',
      variant2: 'color'
    },
    electronics: {
      variant1: 'storage',
      variant2: 'ram'
    },
    fmcg: {
      variant1: 'pack_size',
      variant2: 'flavor'
    },
    home_goods: {
      variant1: 'material',
      variant2: 'finish'
    },
    beauty: {
      variant1: 'shade',
      variant2: 'formula'
    },
    industrial: {
      variant1: 'voltage',
      variant2: 'capacity'
    },
    general: {
      variant1: 'attribute1',
      variant2: 'attribute2'
    }
  };
  return attributeMaps[category] || attributeMaps.general;
};

// Get all category options
exports.getCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'general', label: 'All Categories' },
      { value: 'apparel', label: 'Apparel' },
      { value: 'electronics', label: 'Electronics' },
      { value: 'fmcg', label: 'FMCG' },
      { value: 'home_goods', label: 'Home Goods' },
      { value: 'beauty', label: 'Beauty' },
      { value: 'industrial', label: 'Industrial' }
    ];
    res.json(categories);
  } catch (err) {
    console.error("❌ Categories Error:", err);
    res.status(500).send("Error fetching categories");
  }
};

exports.getMasterWithRevenue = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    // DEBUG: Log user info to diagnose assignedSellers issue
    console.log('[DEBUG] User info:', {
      userId: req.user?._id,
      isAdmin,
      hasAssignedSellers: !!req.user?.assignedSellers,
      assignedSellersType: typeof req.user?.assignedSellers,
      roleName: req.user?.role?.name
    });

    // FIX: Add null check for assignedSellers
    let allowedSellerIds = [];
    if (!isAdmin) {
      if (!req.user.assignedSellers) {
        console.warn('[WARN] Non-admin user has no assignedSellers:', req.user._id);
        allowedSellerIds = []; // Return empty array - user has no access
      } else {
        allowedSellerIds = req.user.assignedSellers.map(s => s._id);
      }
    }

    const result = await Master.aggregate([
      {
        $lookup: {
          from: "asins",
          localField: "asin",
          foreignField: "asinCode",
          as: "asinData"
        }
      },
      { $unwind: "$asinData" },
      {
        $match: isAdmin ? {} : { "asinData.seller": { $in: allowedSellerIds } }
      },
      {
        $lookup: {
          from: "monthlyperformances",
          localField: "asin",
          foreignField: "asin",
          as: "monthlyData",
        },
      },
      {
        $addFields: {
          total_revenue: { $sum: "$monthlyData.ordered_revenue" },
        },
      },
      {
        $project: {
          sku: 1,
          parent_asin: 1,
          category: 1,
          attributes: 1,
          asin: 1,
          total_revenue: 1,
        },
      },
    ]);

    res.json(result);
  } catch (err) {
    console.error("❌ Controller Error:", err);
    res.status(500).send("Error calculating revenue");
  }
};

exports.getChartData = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id) : [];

    const chartData = await MonthlyPerformance.aggregate([
      {
        $lookup: {
          from: 'asins',
          localField: 'asin',
          foreignField: 'asinCode',
          as: 'asinData'
        }
      },
      { $unwind: "$asinData" },
      {
        $match: isAdmin ? {} : { "asinData.seller": { $in: allowedSellerIds } }
      },
      {
        $lookup: {
          from: 'masters',
          localField: 'asin',
          foreignField: 'asin',
          as: 'master'
        }
      },
      { $unwind: "$master" },
      {
        $group: {
          _id: {
            size: "$master.size",
            month: { $dateToString: { format: "%Y-%m", date: "$month" } }
          },
          totalRevenue: { $sum: "$ordered_revenue" }
        }
      },
      {
        $group: {
          _id: "$_id.month",
          sizes: {
            $push: {
              size: "$_id.size",
              revenue: "$totalRevenue"
            }
          }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    res.json(chartData);
  } catch (err) {
    console.error("❌ Chart Data Error:", err);
    res.status(500).send("Chart data fetch failed");
  }
};

// 1. Revenue by Attribute (Bar)
exports.getRevenueBySize = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id) : [];

    const data = await MonthlyPerformance.aggregate([
      {
        $lookup: {
          from: 'asins',
          localField: 'asin',
          foreignField: 'asinCode',
          as: 'asinData'
        }
      },
      { $unwind: "$asinData" },
      {
        $match: isAdmin ? {} : { "asinData.seller": { $in: allowedSellerIds } }
      },
      {
        $lookup: {
          from: 'masters',
          localField: 'asin',
          foreignField: 'asin',
          as: 'master'
        }
      },
      { $unwind: "$master" },
      {
        $group: {
          _id: "$master.size",
          totalRevenue: { $sum: "$ordered_revenue" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (err) {
    console.error("❌ Revenue by Size Error:", err.message);
    res.status(500).send("Error");
  }
};

// 3. Size Share (Pie)
exports.getSizeShare = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id) : [];

    const data = await MonthlyPerformance.aggregate([
      {
        $lookup: {
          from: 'asins',
          localField: 'asin',
          foreignField: 'asinCode',
          as: 'asinData'
        }
      },
      { $unwind: "$asinData" },
      {
        $match: isAdmin ? {} : { "asinData.seller": { $in: allowedSellerIds } }
      },
      {
        $lookup: {
          from: 'masters',
          localField: 'asin',
          foreignField: 'asin',
          as: 'master'
        }
      },
      { $unwind: "$master" },
      {
        $group: {
          _id: "$master.size",
          revenue: { $sum: "$ordered_revenue" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    res.json(data);
  } catch (err) {
    console.error("❌ Size Share Pie Chart Error:", err.message);
    res.status(500).send("Error");
  }
};

// Real ads data API with multi-tenancy and aggregation
exports.getAdsReport = async (req, res) => {
  try {
    const { startDate, endDate, reportType = 'daily' } = req.query;
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    // 1. Get allowed ASINs
    let allowedAsinCodes = [];
    if (!isAdmin) {
      const allowedAsins = await Asin.find({ seller: { $in: allowedSellerIds } }).select('asinCode');
      allowedAsinCodes = allowedAsins.map(a => a.asinCode);
    }

    // 2. Build Query
    const query = {};
    if (!isAdmin) {
      query.asin = { $in: allowedAsinCodes };
    }

    // Add explicit asin filter if provided
    if (req.query.asin) {
      query.asin = req.query.asin;
    }

    if (reportType === 'daily' && (startDate || endDate)) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
      query.reportType = 'daily';
    } else if (reportType === 'monthly' && (startDate || endDate)) {
      query.month = {};
      if (startDate) query.month.$gte = new Date(startDate);
      if (endDate) query.month.$lte = new Date(endDate);
      query.reportType = 'monthly';
    }

    // 3. Aggregate results per date for the line chart
    const dailyData = await AdsPerformance.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          ad_spend: { $sum: '$ad_spend' },
          ad_sales: { $sum: '$ad_sales' },
          impressions: { $sum: '$impressions' },
          clicks: { $sum: '$clicks' },
          orders: { $sum: '$orders' }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: '$_id',
          ad_spend: 1,
          ad_sales: 1,
          impressions: 1,
          clicks: 1,
          orders: 1,
          acos: {
            $cond: [
              { $gt: ['$ad_sales', 0] },
              { $multiply: [{ $divide: ['$ad_spend', '$ad_sales'] }, 100] },
              0
            ]
          },
          roas: {
            $cond: [
              { $gt: ['$ad_spend', 0] },
              { $divide: ['$ad_sales', '$ad_spend'] },
              0
            ]
          },
          ctr: {
            $cond: [
              { $gt: ['$impressions', 0] },
              { $multiply: [{ $divide: ['$clicks', '$impressions'] }, 100] },
              0
            ]
          },
          aov: {
            $cond: [
              { $gt: ['$orders', 0] },
              { $divide: ['$ad_sales', '$orders'] },
              0
            ]
          }
        }
      }
    ]);

    // 4. Aggregate results per ASIN
    const adsData = await AdsPerformance.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$asin",
          ad_spend: { $sum: "$ad_spend" },
          ad_sales: { $sum: "$ad_sales" },
          impressions: { $sum: "$impressions" },
          clicks: { $sum: "$clicks" },
          orders: { $sum: "$orders" }
        }
      },
      {
        $project: {
          asin: "$_id",
          ad_spend: 1,
          ad_sales: 1,
          impressions: 1,
          clicks: 1,
          orders: 1,
          acos: {
            $cond: [
              { $gt: ["$ad_sales", 0] },
              { $multiply: [{ $divide: ["$ad_spend", "$ad_sales"] }, 100] },
              0
            ]
          },
          roas: {
            $cond: [
              { $gt: ["$ad_spend", 0] },
              { $divide: ["$ad_sales", "$ad_spend"] },
              0
            ]
          },
          ctr: {
            $cond: [
              { $gt: ["$impressions", 0] },
              { $multiply: [{ $divide: ["$clicks", "$impressions"] }, 100] },
              0
            ]
          },
          aov: {
            $cond: [
              { $gt: ["$orders", 0] },
              { $divide: ["$ad_sales", "$orders"] },
              0
            ]
          }
        }
      }
    ]);

    res.json({ data: adsData, dailyData: dailyData });
  } catch (err) {
    console.error("❌ Ads Report Error:", err);
    res.status(500).send("Error fetching ads data");
  }
};

// SKU Report API 
exports.getSkuReport = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    const query = {};
    if (!isAdmin) {
      const asinsInAllowedSellers = await Asin.find({ seller: { $in: allowedSellerIds } }).select('asinCode');
      const allowedAsinCodes = asinsInAllowedSellers.map(a => a.asinCode);
      query.asin = { $in: allowedAsinCodes };
    }

    const skuData = await Master.find(query).limit(500);
    res.json(skuData);
  } catch (err) {
    console.error("❌ SKU Report Error:", err);
    res.status(500).send("Error fetching SKU report data");
  }
};

// Parent ASIN Report API
exports.getParentAsinReport = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    const query = {};
    if (!isAdmin) {
      const asinsInAllowedSellers = await Asin.find({ seller: { $in: allowedSellerIds } }).select('asinCode');
      const allowedAsinCodes = asinsInAllowedSellers.map(a => a.asinCode);
      query.asin = { $in: allowedAsinCodes };
    }

    const parentAsinData = await Master.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$parent_asin",
          asin_count: { $sum: 1 },
          skus: { $push: "$sku" }
        }
      },
      {
        $project: {
          parent_asin: "$_id",
          asin_count: 1,
          skus: 1
        }
      }
    ]);
    res.json(parentAsinData);
  } catch (err) {
    console.error("❌ Parent ASIN Report Error:", err);
    res.status(500).send("Error fetching Parent ASIN report data");
  }
};

// Month-wise Report API
exports.getMonthWiseReport = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    const query = {};
    if (!isAdmin) {
      const asinsInAllowedSellers = await Asin.find({ seller: { $in: allowedSellerIds } }).select('asinCode');
      const allowedAsinCodes = asinsInAllowedSellers.map(a => a.asinCode);
      query.asin = { $in: allowedAsinCodes };
    }

    const monthlyData = await MonthlyPerformance.aggregate([
      { $match: query },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$month" } },
          total_revenue: { $sum: "$ordered_revenue" },
          total_units_sold: { $sum: "$ordered_units" }
        }
      },
      { $sort: { "_id": -1 } }
    ]);
    res.json(monthlyData);
  } catch (err) {
    console.error("❌ Monthly Report Error:", err);
    res.status(500).send("Error fetching monthly report data");
  }
};
