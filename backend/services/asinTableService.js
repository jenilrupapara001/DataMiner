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
    const { 
      sellerId, search, category,
      page = 1, limit = 50, 
      sortBy = 'CreatedAt', sortOrder = 'DESC' 
    } = filters;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    try {
      const pool = await getPool();
      let whereClause = "WHERE 1=1";
      const request = pool.request();

      if (sellerId) {
        whereClause += " AND SellerId = @sellerId";
        request.input('sellerId', sql.VarChar, sellerId);
      }
      if (category) {
        whereClause += " AND Category = @category";
        request.input('category', sql.NVarChar, category);
      }
      if (search) {
        whereClause += " AND (AsinCode LIKE @search OR Sku LIKE @search OR Title LIKE @search)";
        request.input('search', sql.NVarChar, `%${search}%`);
      }

      // 1. Get Total Count
      const countResult = await request.query(`SELECT COUNT(*) as total FROM Asins ${whereClause}`);
      const total = countResult.recordset[0].total;

      // 2. Fetch Paginated ASINs
      const sortField = ['AsinCode', 'CurrentPrice', 'BSR', 'LQS', 'CreatedAt'].includes(sortBy) ? sortBy : 'CreatedAt';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      const asinsResult = await request
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, limitNum)
        .query(`
          SELECT * FROM Asins 
          ${whereClause}
          ORDER BY ${sortField} ${order}
          OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);
      
      const asins = asinsResult.recordset;

      // 3. Fetch history for these ASINs from AsinHistory table
      let historyMap = {};
      if (asins.length > 0) {
        const asinIds = asins.map(a => a.Id);
        const historyRequest = pool.request();
        asinIds.forEach((id, i) => historyRequest.input(`id${i}`, id));
        const idParams = asinIds.map((_, i) => `@id${i}`).join(', ');
        
        const historyResult = await historyRequest.query(`
          SELECT AsinId, Price, BSR, Rating, Date 
          FROM AsinHistory 
          WHERE AsinId IN (${idParams})
          ORDER BY Date ASC
        `);

        historyMap = historyResult.recordset.reduce((acc, row) => {
          if (!acc[row.AsinId]) acc[row.AsinId] = [];
          acc[row.AsinId].push({
            price: row.Price || 0,
            bsr: row.BSR || 0,
            rating: row.Rating || 0,
            date: row.Date
          });
          return acc;
        }, {});
      }

      // 4. Transform for UI
      const transformed = asins.map(asin => {
        const history = historyMap[asin.Id] || [];
        
        const recentHistory = history.slice(-8).map(h => ({
          price: h.price,
          bsr: h.bsr,
          rating: h.rating,
          date: h.date
        }));

        // Map to UI-expected schema
        return {
          id: asin.Id,
          _id: asin.Id, // Alias for frontend
          asinCode: asin.AsinCode,
          sku: asin.Sku || 'N/A',
          title: asin.Title,
          imageUrl: asin.ImageUrl,
          currentPrice: asin.CurrentPrice || 0,
          mrp: asin.Mrp || 0,
          dealBadge: asin.DealBadge,
          priceType: asin.PriceType,
          currentRank: asin.BSR || 0,
          bsr: asin.BSR || 0, // Alias for frontend
          rating: asin.Rating || 0,
          reviewCount: asin.ReviewCount || 0,
          lqs: asin.LQS || 0,
          cdq: asin.Cdq || 0,
          cdqGrade: asin.CdqGrade || 'D',
          buyBoxWin: asin.BuyBoxWin === 1 || asin.BuyBoxWin === true || isBuyBoxWinner(asin.SoldBy),
          soldBy: asin.SoldBy || 'N/A',
          soldBySec: asin.SoldBySec || 'N/A',
          secondAsp: asin.SecondAsp || 0,
          availabilityStatus: asin.AvailabilityStatus || 'Available',
          discountPercentage: asin.DiscountPercentage || 0,
          hasAPlus: asin.HasAplus === 1 || asin.HasAplus === true,
          imagesCount: asin.ImagesCount || 0,
          videoCount: asin.VideoCount || 0,
          status: asin.Status || 'Active',
          subBSRs: asin.SubBSRs ? (typeof asin.SubBSRs === 'string' ? JSON.parse(asin.SubBSRs) : asin.SubBSRs) : [],
          history: recentHistory, // Rename to match frontend expectations
          
          computedFields: {
            isHighlyRated: asin.Rating >= 4.5,
            needsImageAudit: (asin.ImagesCount || 0) < 7,
            bsrTrend: this._calculateTrend(recentHistory, 'bsr'),
            priceTrend: this._calculateTrend(recentHistory, 'price')
          }
        };
      });

      return {
        data: transformed,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      };
    } catch (error) {
      console.error('[AsinTableService] getAsinTableData error:', error);
      return { data: [], pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 } };
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
