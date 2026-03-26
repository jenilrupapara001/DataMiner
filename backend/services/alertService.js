const RealTimeAlert = require('../models/RealTimeAlert');
const RevenueSummary = require('../models/RevenueSummary');
const AdsPerformance = require('../models/AdsPerformance');
const Asin = require('../models/Asin');

/**
 * Real-Time Alert Service
 * Monitors performance anomalies and inventory risks.
 */
class AlertService {
  
  /**
   * Checks for revenue drops > 20% compared to previous day
   */
  async checkRevenueDrop(asinCode) {
    const dates = await RevenueSummary.find({ asin: asinCode, period: 'daily' })
      .sort({ date: -1 })
      .limit(2);

    if (dates.length < 2) return null;

    const current = dates[0].totalRevenue;
    const previous = dates[1].totalRevenue;

    if (previous > 0) {
      const drop = ((previous - current) / previous) * 100;
      if (drop > 20) {
        return {
          type: 'revenue_drop',
          message: `Revenue for ${asinCode} dropped by ${drop.toFixed(2)}% compared to yesterday.`,
          severity: 'critical',
          asin: asinCode
        };
      }
    }
    return null;
  }

  /**
   * Checks if ACoS is above the 40% threshold
   */
  async checkAcos(asinCode) {
    const latestAds = await AdsPerformance.findOne({ asin: asinCode })
      .sort({ date: -1 });

    if (latestAds && latestAds.acos > 40) {
      return {
        type: 'high_acos',
        message: `High ACoS alert for ${asinCode}: ${latestAds.acos}% (Threshold: 40%)`,
        severity: 'warning',
        asin: asinCode
      };
    }
    return null;
  }

  /**
   * Checks if stock level is critically low
   */
  async checkStock(asinCode) {
    const asin = await Asin.findOne({ asinCode });
    
    if (asin && asin.stockLevel < 10) {
      return {
        type: 'low_stock',
        message: `Low stock alert for ${asinCode}: Only ${asin.stockLevel} units remaining.`,
        severity: 'critical',
        asin: asinCode
      };
    }
    return null;
  }

  /**
   * Orchestrates all performance checks for a specific ASIN
   */
  async runAllChecks(asinCode) {
    const alerts = [];
    
    const revenueAlert = await this.checkRevenueDrop(asinCode);
    if (revenueAlert) alerts.push(revenueAlert);

    const acosAlert = await this.checkAcos(asinCode);
    if (acosAlert) alerts.push(acosAlert);

    const stockAlert = await this.checkStock(asinCode);
    if (stockAlert) alerts.push(stockAlert);

    // Optional: Store in DB
    if (alerts.length > 0) {
      await RealTimeAlert.insertMany(alerts);
    }

    return alerts;
  }
}

module.exports = new AlertService();
