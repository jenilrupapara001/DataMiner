const { sql, getPool } = require('../database/db');

/**
 * Revenue Service - Unified Revenue Engine Logic (SQL Version)
 */
class RevenueService {
  /**
   * Get Daily Revenue Summary for a specific ASIN and Date Range
   */
  async getDailyRevenue(asin, { start, end }) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input('asin', sql.NVarChar, asin)
        .input('start', sql.DateTime, new Date(start))
        .input('end', sql.DateTime, new Date(end))
        .query(`
          SELECT 
            a.Asin as asin,
            a.Date as date,
            (ISNULL(a.Orders, 0) + ISNULL(a.OrganicOrders, 0)) as units,
            (ISNULL(a.AdSales, 0) + ISNULL(a.OrganicSales, 0)) as totalRevenue,
            ISNULL(a.AdSales, 0) as adRevenue,
            ISNULL(a.OrganicSales, 0) as organicRevenue,
            0 as returns, -- Returns currently only in Orders table, need to decide if we join
            (ISNULL(a.AdSales, 0) + ISNULL(a.OrganicSales, 0)) as netRevenue,
            CASE 
              WHEN (ISNULL(a.AdSales, 0) + ISNULL(a.OrganicSales, 0)) > 0 
              THEN (ISNULL(a.AdSales, 0) / (ISNULL(a.AdSales, 0) + ISNULL(a.OrganicSales, 0)))
              ELSE 0 
            END as adsRatio
          FROM AdsPerformance a
          WHERE a.Asin = @asin 
          AND a.Date >= @start AND a.Date <= @end
          ORDER BY a.Date ASC
        `);

      return result.recordset;
    } catch (error) {
      console.error('[RevenueService] getDailyRevenue error:', error);
      throw error;
    }
  }

  /**
   * Get Monthly Revenue Summary for a specific ASIN and Month
   */
  async getMonthlyRevenue(asin, month) {
    try {
      const startDate = new Date(month);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);

      const pool = await getPool();
      const result = await pool.request()
        .input('asin', sql.NVarChar, asin)
        .input('start', sql.DateTime, startDate)
        .input('end', sql.DateTime, endDate)
        .query(`
          SELECT 
            Asin as asin,
            MONTH(Date) as month,
            YEAR(Date) as year,
            SUM(ISNULL(Orders, 0) + ISNULL(OrganicOrders, 0)) as units,
            SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)) as totalRevenue,
            SUM(ISNULL(AdSales, 0)) as adRevenue,
            SUM(ISNULL(OrganicSales, 0)) as organicRevenue,
            0 as returns,
            SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)) as netRevenue,
            CASE 
              WHEN SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)) > 0 
              THEN (SUM(ISNULL(AdSales, 0)) / SUM(ISNULL(AdSales, 0) + ISNULL(OrganicSales, 0)))
              ELSE 0 
            END as adsRatio
          FROM AdsPerformance
          WHERE Asin = @asin 
          AND Date >= @start AND Date <= @end
          GROUP BY Asin, MONTH(Date), YEAR(Date)
        `);

      return result.recordset[0] || null;
    } catch (error) {
      console.error('[RevenueService] getMonthlyRevenue error:', error);
      throw error;
    }
  }

  /**
   * Get Combined Summary for a Date Range (Top Level)
   */
  async getCombinedSummary(asin, { start, end }) {
    const dailyData = await this.getDailyRevenue(asin, { start, end });
    
    const summary = dailyData.reduce((acc, curr) => ({
      units: acc.units + (curr.units || 0),
      totalRevenue: acc.totalRevenue + (curr.totalRevenue || 0),
      adRevenue: acc.adRevenue + (curr.adRevenue || 0),
      returns: acc.returns + (curr.returns || 0),
      organicRevenue: acc.organicRevenue + (curr.organicRevenue || 0),
      netRevenue: acc.netRevenue + (curr.netRevenue || 0)
    }), { units: 0, totalRevenue: 0, adRevenue: 0, returns: 0, organicRevenue: 0, netRevenue: 0 });

    summary.adsRatio = summary.totalRevenue > 0 ? (summary.adRevenue / summary.totalRevenue) : 0;
    
    return { summary, timeline: dailyData };
  }
}

module.exports = new RevenueService();
