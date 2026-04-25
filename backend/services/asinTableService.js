const { sql, getPool } = require('../database/db');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');

/**
 * ASIN Table Service - High-Performance Data Orchestration (SQL Version)
 * Aggregates master data, advertising, and revenue metrics into a unified UI schema.
 */
class AsinTableService {
  /**
   * Fetches and transforms ASIN data optimized for the Table UI
   */
  async getAsinTableData(filters = {}) {
    const { sellerId, search, category } = filters;
    
    try {
      const pool = await getPool();
      let query = "SELECT * FROM Asins WHERE 1=1";
      const request = pool.request();

      if (sellerId) {
        query += " AND SellerId = @sellerId";
        request.input('sellerId', sql.VarChar, sellerId);
      }
      if (category) {
        query += " AND Category = @category";
        request.input('category', sql.NVarChar, category);
      }
      if (search) {
        query += " AND (AsinCode LIKE @search OR Sku LIKE @search OR Title LIKE @search)";
        request.input('search', sql.NVarChar, `%${search}%`);
      }

      const result = await request.query(query);
      const asins = result.recordset;

      // Transform for UI
      const transformed = asins.map(asin => {
        // Extract history
        let history = [];
        try {
          history = JSON.parse(asin.AsinWeekHistory || asin.WeekHistory || '[]');
        } catch (e) {
          history = [];
        }

        const recentHistory = history.slice(-8).map(h => ({
          price: h.price || 0,
          bsr: h.bsr || 0,
          subBSRs: h.subBSRs || [],
          rating: h.rating || 0
        }));

        // Map to UI-expected schema
        return {
          asinCode: asin.AsinCode,
          sku: asin.Sku || 'N/A',
          title: asin.Title,
          imageUrl: asin.ImageUrl,
          currentPrice: asin.CurrentPrice || 0,
          currentRank: asin.BSR || 0,
          rating: asin.Rating || 0,
          reviewCount: asin.ReviewCount || 0,
          lqs: asin.LQS || 0,
          buyBoxWin: asin.BuyBoxWin || isBuyBoxWinner(asin.SoldBy),
          hasAPlus: asin.HasAplus || false,
          imagesCount: asin.ImagesCount || 0,
          status: asin.Status || 'Active',
          subBSRs: asin.SubBSRs ? JSON.parse(asin.SubBSRs) : [],
          weekHistory: recentHistory,
          
          computedFields: {
            isHighlyRated: asin.Rating >= 4.5,
            needsImageAudit: (asin.ImagesCount || 0) < 7,
            bsrTrend: this._calculateTrend(recentHistory, 'bsr')
          }
        };
      });

      return transformed;
    } catch (error) {
      console.error('[AsinTableService] getAsinTableData error:', error);
      return [];
    }
  }

  /**
   * Internal helper to calculate simple trend direction
   */
  _calculateTrend(history, key) {
    if (history.length < 2) return 'neutral';
    const first = history[0][key];
    const last = history[history.length - 1][key];
    if (last < first) return 'improving';
    if (last > first) return 'declining';
    return 'neutral';
  }
}

module.exports = new AsinTableService();
