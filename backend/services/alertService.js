const { sql, getPool, generateId } = require('../database/db');

/**
 * Real-Time Alert Service (SQL Version)
 * Monitors performance anomalies and inventory risks.
 */
class AlertService {
  
  /**
   * Checks for revenue drops > 20% compared to previous day
   */
  async checkRevenueDrop(asinCode) {
    try {
      const pool = await getPool();
      // Get the latest 2 days of performance data
      const result = await pool.request()
        .input('asin', sql.NVarChar, asinCode)
        .query(`
          SELECT TOP 2 AdSales + OrganicSales as Revenue, Date, Asin
          FROM AdsPerformance
          WHERE Asin = @asin
          ORDER BY Date DESC
        `);

      const dates = result.recordset;
      if (dates.length < 2) return null;

      const current = dates[0].Revenue || 0;
      const previous = dates[1].Revenue || 0;

      if (previous > 0) {
        const drop = ((previous - current) / previous) * 100;
        if (drop > 20) {
          return {
            type: 'revenue_drop',
            title: 'Revenue Drop Detected',
            message: `Revenue for ${asinCode} dropped by ${drop.toFixed(2)}% compared to yesterday.`,
            severity: 'critical',
            asin: asinCode
          };
        }
      }
      return null;
    } catch (error) {
      console.error('[AlertService] checkRevenueDrop error:', error);
      return null;
    }
  }

  /**
   * Checks if ACoS is above the 40% threshold
   */
  async checkAcos(asinCode) {
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('asin', sql.NVarChar, asinCode)
        .query(`
          SELECT TOP 1 ACoS
          FROM AdsPerformance
          WHERE Asin = @asin
          ORDER BY Date DESC
        `);

      const latestAds = result.recordset[0];
      if (latestAds && latestAds.ACoS > 40) {
        return {
          type: 'high_acos',
          title: 'High ACoS Warning',
          message: `High ACoS alert for ${asinCode}: ${latestAds.ACoS}% (Threshold: 40%)`,
          severity: 'warning',
          asin: asinCode
        };
      }
      return null;
    } catch (error) {
      console.error('[AlertService] checkAcos error:', error);
      return null;
    }
  }

  /**
   * Checks if stock level is critically low
   */
  async checkStock(asinCode) {
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('asin', sql.NVarChar, asinCode)
        .query(`
          SELECT StockLevel, Id, SellerId
          FROM Asins
          WHERE AsinCode = @asin
        `);

      const asin = result.recordset[0];
      if (asin && asin.StockLevel < 10) {
        return {
          type: 'low_stock',
          title: 'Low Stock Alert',
          message: `Low stock alert for ${asinCode}: Only ${asin.StockLevel} units remaining.`,
          severity: 'critical',
          asin: asinCode,
          asinId: asin.Id,
          sellerId: asin.SellerId
        };
      }
      return null;
    } catch (error) {
      console.error('[AlertService] checkStock error:', error);
      return null;
    }
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

    // Store in DB if any alerts found
    if (alerts.length > 0) {
      const pool = await getPool();
      for (const alert of alerts) {
        try {
          // Resolve AsinId and SellerId if not present (from stockAlert)
          let asinId = alert.asinId;
          let sellerId = alert.sellerId;

          if (!asinId || !sellerId) {
            const res = await pool.request()
              .input('asin', sql.NVarChar, alert.asin)
              .query("SELECT Id, SellerId FROM Asins WHERE AsinCode = @asin");
            if (res.recordset[0]) {
              asinId = res.recordset[0].Id;
              sellerId = res.recordset[0].SellerId;
            }
          }

          const id = generateId();
          await pool.request()
            .input('Id', sql.VarChar, id)
            .input('SellerId', sql.VarChar, sellerId)
            .input('AsinId', sql.VarChar, asinId)
            .input('Type', sql.NVarChar, alert.type)
            .input('Severity', sql.NVarChar, alert.severity)
            .input('Title', sql.NVarChar, alert.title)
            .input('Message', sql.NVarChar, alert.message)
            .input('IsResolved', sql.Bit, 0)
            .query(`
              INSERT INTO Alerts (Id, SellerId, AsinId, Type, Severity, Title, Message, IsResolved, CreatedAt)
              VALUES (@Id, @SellerId, @AsinId, @Type, @Severity, @Title, @Message, @IsResolved, GETDATE())
            `);
        } catch (err) {
          console.error('[AlertService] Failed to save alert:', err);
        }
      }
    }

    return alerts;
  }
}

module.exports = new AlertService();
