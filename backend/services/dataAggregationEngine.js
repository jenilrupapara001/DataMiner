const RevenueSummary = require('../models/RevenueSummary');
const AdsPerformance = require('../models/AdsPerformance');

/**
 * Data Aggregation Engine - The Calculation Core
 * 
 * Aggregates core business metrics (GMS, ACoS, Profit) across dynamic 
 * ASIN lists and date ranges for real-time goal tracking.
 */
class DataAggregationEngine {
  /**
   * Aggregates performance data for a specific set of ASINs and date range.
   */
  async aggregatePerformance(asins, startDate, endDate) {
    try {
      // 1. Fetch Revenue Data
      const revenueData = await RevenueSummary.aggregate([
        { 
          $match: { 
            asin: { $in: asins },
            date: { $gte: new Date(startDate), $lte: new Date(endDate) }
          }
        },
        {
          $group: {
            _id: null,
            totalGMS: { $sum: '$orderedProductSales' },
            totalOrders: { $sum: '$totalOrderItems' },
            totalOrganicSales: { $sum: '$organicSales' }
          }
        }
      ]);

      // 2. Fetch Ads Data
      const adsData = await AdsPerformance.aggregate([
        {
          $match: {
            asin: { $in: asins },
            date: { $gte: new Date(startDate), $lte: new Date(endDate) }
          }
        },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: '$spend' },
            totalAdSales: { $sum: '$sales' },
            totalClicks: { $sum: '$clicks' },
            totalImpressions: { $sum: '$impressions' }
          }
        }
      ]);

      const rev = revenueData[0] || { totalGMS: 0, totalOrders: 0, totalOrganicSales: 0 };
      const ads = adsData[0] || { totalSpend: 0, totalAdSales: 0, totalClicks: 0, totalImpressions: 0 };

      // 3. Compute Derived Metrics
      const totalGMS = rev.totalGMS;
      const totalSpend = ads.totalSpend;
      const acos = totalGMS > 0 ? (totalSpend / totalGMS) * 100 : 0;
      const conversionRate = ads.totalImpressions > 0 ? (rev.totalOrders / ads.totalImpressions) * 100 : 0;
      
      return {
        gms: totalGMS,
        orders: rev.totalOrders,
        spend: totalSpend,
        acos: parseFloat(acos.toFixed(2)),
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        adSales: ads.totalAdSales,
        organicSales: rev.totalOrganicSales,
        clicks: ads.totalClicks
      };
    } catch (error) {
      console.error('[Aggregation Engine] Error:', error);
      throw error;
    }
  }
}

module.exports = new DataAggregationEngine();
