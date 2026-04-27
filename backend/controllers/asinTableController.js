const asinTableService = require('../services/asinTableService');

/**
 * ASIN Table Controller - Unified Integration Layer
 * Serves optimized JSON payloads for high-performance table views.
 */
class AsinTableController {
  
  /**
   * GET /api/asins/table
   * Main entry point for the ASIN Intelligence table view
   */
  async getAsinTable(req, res) {
    try {
      const { 
        sellerId, search, category, 
        page = 1, limit = 50,
        sortBy = 'CreatedAt', sortOrder = 'DESC'
      } = req.query;

      // 1. Delegate to service for orchestration
      const result = await asinTableService.getAsinTableData({
        sellerId,
        search,
        category,
        page,
        limit,
        sortBy,
        sortOrder
      });

      // 2. Return response in format expected by frontend
      res.status(200).json({
        success: true,
        asins: result.data,
        pagination: result.pagination
      });

    } catch (error) {
      console.error('[AsinTableController] Error fetching table data:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error fetching ASIN intelligence',
        error: error.message
      });
    }
  }
}

module.exports = new AsinTableController();
