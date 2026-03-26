const Order = require('../models/Order');
const AdsPerformance = require('../models/AdsPerformance');
const RevenueSummary = require('../models/RevenueSummary');

/**
 * Revenue Service - Unified Revenue Engine Logic
 * Built with modular aggregation to support future migration to .NET Core.
 */
class RevenueService {
  /**
   * Get Daily Revenue Summary for a specific ASIN and Date Range
   * @param {string} asin 
   * @param {Object} dateRange { start, end }
   */
  async getDailyRevenue(asin, { start, end }) {
    const pipeline = [
      {
        $match: {
          asin,
          date: { $gte: new Date(start), $lte: new Date(end) }
        }
      },
      {
        // Join with AdsPerformance to get ad_sales
        $lookup: {
          from: 'adsperformances', // MongoDB collection name
          let: { asin: '$asin', date: '$date' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$asin', '$$asin'] },
                    { $eq: ['$date', '$$date'] },
                    { $eq: ['$reportType', 'daily'] }
                  ]
                }
              }
            }
          ],
          as: 'adData'
        }
      },
      {
        $unwind: { path: '$adData', preserveNullAndEmptyArrays: true }
      },
      {
        $project: {
          asin: 1,
          date: 1,
          units: 1,
          totalRevenue: '$revenue',
          adRevenue: { $ifNull: ['$adData.ad_sales', 0] },
          returns: 1,
          // totalRevenue = organic + ad (user's formula)
          // Since Order.revenue is total, organic = total - ad
          organicRevenue: {
            $max: [0, { $subtract: ['$revenue', { $ifNull: ['$adData.ad_sales', 0] }] }]
          },
          netRevenue: { $subtract: ['$revenue', '$returns'] },
          adsRatio: {
            $cond: [
              { $gt: ['$revenue', 0] },
              { $divide: [{ $ifNull: ['$adData.ad_sales', 0] }, '$revenue'] },
              0
            ]
          }
        }
      },
      { $sort: { date: 1 } }
    ];

    return await Order.aggregate(pipeline);
  }

  /**
   * Get Monthly Revenue Summary for a specific ASIN and Month
   * @param {string} asin 
   * @param {number|string} month (ISO string or month number)
   */
  async getMonthlyRevenue(asin, month) {
    const startDate = new Date(month);
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    endDate.setHours(23, 59, 59, 999);

    const pipeline = [
      {
        $match: {
          asin,
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { asin: '$asin', month: { $month: '$date' }, year: { $year: '$date' } },
          units: { $sum: '$units' },
          totalRevenue: { $sum: '$revenue' },
          returns: { $sum: '$returns' }
        }
      },
      {
        // Join with AdsPerformance (Monthly report if exists or sum of daily)
        $lookup: {
          from: 'adsperformances',
          let: { asin: '$_id.asin', start: startDate, end: endDate },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$asin', '$$asin'] },
                    { $gte: ['$date', '$$start'] },
                    { $lte: ['$date', '$$end'] },
                    { $eq: ['$reportType', 'daily'] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: null,
                totalAdSales: { $sum: '$ad_sales' }
              }
            }
          ],
          as: 'adData'
        }
      },
      {
        $project: {
          _id: 0,
          asin: '$_id.asin',
          month: '$_id.month',
          year: '$_id.year',
          units: 1,
          totalRevenue: 1,
          adRevenue: { $ifNull: [{ $arrayElemAt: ['$adData.totalAdSales', 0] }, 0] },
          returns: 1,
          organicRevenue: {
            $max: [0, { $subtract: ['$totalRevenue', { $ifNull: [{ $arrayElemAt: ['$adData.totalAdSales', 0] }, 0] }] }]
          },
          netRevenue: { $subtract: ['$totalRevenue', '$returns'] }
        }
      },
      {
        $addFields: {
          adsRatio: {
            $cond: [
              { $gt: ['$totalRevenue', 0] },
              { $divide: ['$adRevenue', '$totalRevenue'] },
              0
            ]
          }
        }
      }
    ];

    const result = await Order.aggregate(pipeline);
    return result[0] || null;
  }

  /**
   * Get Combined Summary for a Date Range (Top Level)
   */
  async getCombinedSummary(asin, { start, end }) {
    const dailyData = await this.getDailyRevenue(asin, { start, end });
    
    // Aggregate daily into a total summary object
    const summary = dailyData.reduce((acc, curr) => ({
      units: acc.units + curr.units,
      totalRevenue: acc.totalRevenue + curr.totalRevenue,
      adRevenue: acc.adRevenue + curr.adRevenue,
      returns: acc.returns + curr.returns,
      organicRevenue: acc.organicRevenue + curr.organicRevenue,
      netRevenue: acc.netRevenue + curr.netRevenue
    }), { units: 0, totalRevenue: 0, adRevenue: 0, returns: 0, organicRevenue: 0, netRevenue: 0 });

    summary.adsRatio = summary.totalRevenue > 0 ? (summary.adRevenue / summary.totalRevenue) : 0;
    
    return { summary, timeline: dailyData };
  }
}

module.exports = new RevenueService();
