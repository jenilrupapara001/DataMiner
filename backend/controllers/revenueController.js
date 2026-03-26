const revenueService = require('../services/revenueService');
const responseHandler = require('../utils/responseHandler');

/**
 * Revenue Controller - Unified Revenue Engine Entry Point
 * 
 * DESIGN PATTERN: Clean Architecture (Controller -> Service -> Model)
 * This abstraction layer handles HTTP concerns and delegates business 
 * logic to the service layer, simplifying future migration to ASP.NET Core controllers.
 */
class RevenueController {
  
  /**
   * GET /api/revenue/summary
   * Fetches unified revenue metrics including organic vs ad revenue split
   */
  async getSummary(req, res) {
    try {
      const { asin, startDate, endDate, month, period = 'daily' } = req.query;

      if (!asin) {
        return responseHandler.error(res, 'ASIN code is required.', 400);
      }

      let data;

      // Logic Branching (Delegated to Service)
      if (month && period === 'monthly') {
        data = await revenueService.getMonthlyRevenue(asin, month);
      } else if (startDate && endDate) {
        data = await revenueService.getCombinedSummary(asin, {
          start: startDate,
          end: endDate
        });
      } else {
        return responseHandler.error(res, 'Provide either (startDate && endDate) or (month && period=monthly)', 400);
      }

      // Unified Success Dispatch
      return responseHandler.success(res, data, 'Revenue summary retrieved successfully');

    } catch (error) {
      console.error('[RevenueController] Critical Error:', error);
      return responseHandler.error(res, 'Internal server error processing revenue data', 500, error);
    }
  }

  /**
   * MIGRATION NOTE FOR ASP.NET CORE:
   * In C# / WebAPI, this would translate to:
   * [HttpGet("summary")]
   * public async Task<ActionResult<ApiResponse<RevenueSummaryDto>>> GetSummary([FromQuery] string asin, ...)
   * {
   *    var result = await _revenueService.GetCombinedSummaryAsync(asin, range);
   *    return Ok(new ApiResponse<RevenueSummaryDto>(result));
   * }
   */
}

module.exports = new RevenueController();
