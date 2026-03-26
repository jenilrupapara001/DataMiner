const Asin = require('../models/Asin');
const AdsPerformance = require('../models/AdsPerformance');
const RevenueSummary = require('../models/RevenueSummary');

/**
 * ASIN Table Service - High-Performance Data Orchestration
 * Aggregates master data, advertising, and revenue metrics into a unified UI schema.
 */
class AsinTableService {
  /**
   * Fetches and transforms ASIN data optimized for the Table UI
   * @param {Object} filters { sellerId, search, category }
   */
  async getAsinTableData(filters = {}) {
    const { sellerId, search, category } = filters;
    
    // 1. Build Query
    const query = {};
    if (sellerId) query.seller = sellerId;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { asinCode: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ];
    }

    // 2. Fetch Master Data
    const asins = await Asin.find(query)
      .select('asinCode sku title imageUrl currentPrice bsr subBSRs rating reviewCount lqs buyBoxWin hasAplus imagesCount descLength status weekHistory')
      .lean();

    // 3. Transform for UI
    const transformed = asins.map(asin => {
      // Extract last 8 weeks of history
      const history = (asin.weekHistory || [])
        .slice(-8)
        .map(h => ({
          price: h.price || 0,
          bsr: h.bsr || 0,
          subBSRs: h.subBSRs || [],
          rating: h.rating || 0
        }));

      // Map to UI-expected schema
      return {
        asinCode: asin.asinCode,
        sku: asin.sku || 'N/A',
        title: asin.title,
        imageUrl: asin.imageUrl,
        currentPrice: asin.currentPrice || 0,
        currentRank: asin.bsr || 0, // Mapping bsr to currentRank
        rating: asin.rating || 0,
        reviewCount: asin.reviewCount || 0,
        lqs: asin.lqs || 0,
        buyBoxWin: asin.buyBoxWin || false,
        hasAPlus: asin.hasAplus || false,
        imagesCount: asin.imagesCount || 0,
        descLength: asin.descLength || 0,
        status: asin.status || 'Active',
        subBSRs: asin.subBSRs || [],
        weekHistory: history,
        
        // Computed Fields (Example: Price Variance)
        computedFields: {
          isHighlyRated: asin.rating >= 4.5,
          needsImageAudit: (asin.imagesCount || 0) < 7,
          bsrTrend: this._calculateTrend(history, 'bsr')
        }
      };
    });

    return transformed;
  }

  /**
   * Internal helper to calculate simple trend direction
   */
  _calculateTrend(history, key) {
    if (history.length < 2) return 'neutral';
    const first = history[0][key];
    const last = history[history.length - 1][key];
    if (last < first) return 'improving'; // For BSR, lower is better
    if (last > first) return 'declining';
    return 'neutral';
  }
}

module.exports = new AsinTableService();
