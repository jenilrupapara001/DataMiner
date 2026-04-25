const { sql, getPool } = require('../database/db');

/**
 * Data Aggregation Engine - The Calculation Core (SQL Version)
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
      const pool = await getPool();
      
      // Use AdsPerformance as the primary source for daily aggregated metrics
      const result = await pool.request()
        .input('startDate', sql.DateTime, new Date(startDate))
        .input('endDate', sql.DateTime, new Date(endDate))
        .query(`
          SELECT 
            SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)) as totalGMS,
            SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) as totalOrders,
            SUM(ISNULL(OrganicSales, 0)) as totalOrganicSales,
            SUM(ISNULL(AdSpend, 0)) as totalSpend,
            SUM(ISNULL(AdSales, 0)) as totalAdSales,
            SUM(ISNULL(Clicks, 0)) as totalClicks,
            SUM(ISNULL(Impressions, 0)) as totalImpressions
          FROM AdsPerformance
          WHERE Asin IN (${asins.map((_, i) => `@asin${i}`).join(',')})
          AND Date >= @startDate AND Date <= @endDate
        `);
      
      // We need to dynamically add ASIN parameters because mssql doesn't support arrays in IN clause easily without TVPs or splitting
      const request = pool.request()
        .input('startDate', sql.DateTime, new Date(startDate))
        .input('endDate', sql.DateTime, new Date(endDate));
      
      asins.forEach((asin, i) => {
        request.input(`asin${i}`, sql.NVarChar, asin);
      });

      const finalResult = await request.query(`
          SELECT 
            SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)) as totalGMS,
            SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) as totalOrders,
            SUM(ISNULL(OrganicSales, 0)) as totalOrganicSales,
            SUM(ISNULL(AdSpend, 0)) as totalSpend,
            SUM(ISNULL(AdSales, 0)) as totalAdSales,
            SUM(ISNULL(Clicks, 0)) as totalClicks,
            SUM(ISNULL(Impressions, 0)) as totalImpressions
          FROM AdsPerformance
          WHERE Asin IN (${asins.map((_, i) => `@asin${i}`).join(',')})
          AND Date >= @startDate AND Date <= @endDate
      `);

      const data = finalResult.recordset[0] || {};
      
      const totalGMS = data.totalGMS || 0;
      const totalSpend = data.totalSpend || 0;
      const totalOrders = data.totalOrders || 0;
      const totalImpressions = data.totalImpressions || 0;
      
      const acos = totalGMS > 0 ? (totalSpend / totalGMS) * 100 : 0;
      const conversionRate = totalImpressions > 0 ? (totalOrders / totalImpressions) * 100 : 0;
      
      return {
        gms: totalGMS,
        orders: totalOrders,
        spend: totalSpend,
        acos: parseFloat(acos.toFixed(2)),
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        adSales: data.totalAdSales || 0,
        organicSales: data.totalOrganicSales || 0,
        clicks: data.totalClicks || 0
      };
    } catch (error) {
      console.error('[Aggregation Engine] Error:', error);
      throw error;
    }
  }
}

module.exports = new DataAggregationEngine();
