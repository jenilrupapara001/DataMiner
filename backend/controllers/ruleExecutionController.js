const { sql, getPool, generateId } = require('../database/db');
const { createNotification } = require('./notificationController');

const getUnreadAlertCount = async (req, res) => {
  try {
    const userRole = req.user.role?.name || req.user.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
    
    const pool = await getPool();
    const request = pool.request();
    
    let whereClause = 'WHERE Acknowledged = 0';
    if (!isGlobalUser) {
      const allowedSellers = req.user.assignedSellers.map(s => `'${s._id || s}'`).join(',');
      if (allowedSellers.length > 0) {
        whereClause += ` AND SellerId IN (${allowedSellers})`;
      } else {
        return res.json({ count: 0 });
      }
    }

    const result = await request.query(`SELECT COUNT(*) as count FROM Alerts ${whereClause}`);
    res.json({ count: result.recordset[0].count });
  } catch (error) {
    console.error('Error fetching alert count:', error);
    res.status(500).json({ error: 'Failed to fetch alert count' });
  }
};

const acknowledgeAllAlerts = async (req, res) => {
  try {
    const userRole = req.user.role?.name || req.user.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
    
    const pool = await getPool();
    const request = pool.request();
    
    let whereClause = 'WHERE Acknowledged = 0';
    if (!isGlobalUser) {
      const allowedSellers = req.user.assignedSellers.map(s => `'${s._id || s}'`).join(',');
      if (allowedSellers.length > 0) {
        whereClause += ` AND SellerId IN (${allowedSellers})`;
      } else {
        return res.json({ acknowledgedCount: 0 });
      }
    }

    const userName = req.user.FirstName ? `${req.user.FirstName} ${req.user.LastName}` : 'unknown';
    
    const result = await request
        .input('acknowledgedBy', sql.NVarChar, userName)
        .query(`
            UPDATE Alerts 
            SET Acknowledged = 1, AcknowledgedBy = @acknowledgedBy, AcknowledgedAt = GETDATE() 
            ${whereClause}
        `);

    res.json({ acknowledgedCount: result.rowsAffected[0] });
  } catch (error) {
    console.error('Error acknowledging all alerts:', error);
    res.status(500).json({ error: 'Failed to acknowledge alerts' });
  }
};

const getAlertRuleById = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', sql.VarChar, req.params.id)
        .query('SELECT * FROM AlertRules WHERE Id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }
    
    const rule = result.recordset[0];
    // Parse JSON fields
    rule.condition = rule.Condition ? JSON.parse(rule.Condition) : {};
    rule.execution = rule.Execution ? JSON.parse(rule.Execution) : {};
    rule.actions = rule.Actions ? JSON.parse(rule.Actions) : {};
    
    res.json(rule);
  } catch (error) {
    console.error('Error fetching alert rule:', error);
    res.status(500).json({ error: 'Failed to fetch alert rule' });
  }
};

const toggleAlertRule = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
        .input('id', sql.VarChar, req.params.id)
        .query('SELECT IsActive FROM AlertRules WHERE Id = @id');

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    const newStatus = result.recordset[0].IsActive ? 0 : 1;
    await pool.request()
        .input('id', sql.VarChar, req.params.id)
        .input('isActive', sql.Bit, newStatus)
        .query('UPDATE AlertRules SET IsActive = @isActive, UpdatedAt = GETDATE() WHERE Id = @id');

    res.json({ id: req.params.id, isActive: !!newStatus });
  } catch (error) {
    console.error('Error toggling alert rule:', error);
    res.status(500).json({ error: 'Failed to toggle alert rule' });
  }
};

const evaluateAndExecuteRule = async (rule) => {
    const alerts = [];
    const tasks = [];
  
    try {
      const condition = typeof rule.Condition === 'string' ? JSON.parse(rule.Condition) : rule.condition;
      const actionsConfig = typeof rule.Actions === 'string' ? JSON.parse(rule.Actions) : rule.actions;
      
      const { metric, operator, value, period, thresholdType } = condition || {};
      if (!metric) return { triggered: false, alerts, tasks };

      const data = await fetchMetricData(rule, metric, period);
  
      if (!data) {
        return { triggered: false, alerts, tasks };
      }
  
      let shouldTrigger = false;
      const currentValue = data.value;
      const previousValue = data.previousValue || 0;
  
      if (thresholdType === 'percentage') {
        const percentChange = previousValue !== 0 
          ? ((currentValue - previousValue) / previousValue) * 100 
          : 0;
        
        switch (operator) {
          case '>':
          case 'increased by':
            shouldTrigger = percentChange > value;
            break;
          case '<':
          case 'decreased by':
            shouldTrigger = percentChange < -value;
            break;
          case '>=':
            shouldTrigger = percentChange >= value;
            break;
          case '<=':
            shouldTrigger = percentChange <= -value;
            break;
          case '==':
          case '=':
            shouldTrigger = Math.abs(percentChange - value) < 0.01;
            break;
        }
      } else {
        switch (operator) {
          case '>':
          case 'greater than':
            shouldTrigger = currentValue > value;
            break;
          case '<':
          case 'less than':
            shouldTrigger = currentValue < value;
            break;
          case '>=':
            shouldTrigger = currentValue >= value;
            break;
          case '<=':
            shouldTrigger = currentValue <= value;
            break;
          case '==':
          case '=':
          case 'equals':
            shouldTrigger = currentValue === value;
            break;
          case '!=':
          case 'not equals':
            shouldTrigger = currentValue !== value;
            break;
          case 'increased by':
            const increase = previousValue !== 0 
              ? ((currentValue - previousValue) / previousValue) * 100 
              : 0;
            shouldTrigger = increase > value;
            break;
          case 'decreased by':
            const decrease = previousValue !== 0 
              ? ((previousValue - currentValue) / previousValue) * 100 
              : 0;
            shouldTrigger = decrease > value;
            break;
          case 'changed by':
            const change = Math.abs(currentValue - previousValue);
            shouldTrigger = change >= value;
            break;
        }
      }
  
      if (shouldTrigger) {
        const message = generateAlertMessage(rule, currentValue, previousValue);
        const alertId = generateId();
        
        const pool = await getPool();
        await pool.request()
            .input('id', sql.VarChar, alertId)
            .input('sellerId', sql.VarChar, rule.SellerId)
            .input('type', sql.NVarChar, rule.Type)
            .input('severity', sql.NVarChar, rule.Severity)
            .input('title', sql.NVarChar, rule.Name)
            .input('message', sql.NVarChar, message)
            .query(`
                INSERT INTO Alerts (Id, SellerId, Type, Severity, Title, Message, Acknowledged, CreatedAt)
                VALUES (@id, @sellerId, @type, @severity, @title, @message, 0, GETDATE())
            `);

        const alert = { id: alertId, message };
        alerts.push(alert);
  
        if (actionsConfig?.createTask) {
          const taskId = generateId();
          await pool.request()
              .input('id', sql.VarChar, taskId)
              .input('title', sql.NVarChar, `Alert: ${rule.Name}`)
              .input('description', sql.NVarChar, message)
              .input('status', sql.NVarChar, 'Pending')
              .input('priority', sql.NVarChar, rule.Severity === 'critical' ? 'High' : (rule.Severity === 'warning' ? 'Medium' : 'Low'))
              .input('type', sql.NVarChar, 'Automated')
              .input('sellerId', sql.VarChar, rule.SellerId)
              .input('source', sql.NVarChar, 'alert_rule')
              .input('sourceId', sql.VarChar, rule.Id)
              .query(`
                  INSERT INTO Actions (Id, Title, Description, Status, Priority, Type, SellerId, Source, SourceId, CreatedAt)
                  VALUES (@id, @title, @description, @status, @priority, @type, @sellerId, @source, @sourceId, GETDATE())
              `);
          tasks.push({ id: taskId });
        }
      }
  
      return { triggered: shouldTrigger, alerts, tasks };
    } catch (error) {
      console.error('Error evaluating rule:', error);
      return { triggered: false, alerts, tasks };
    }
};

const fetchMetricData = async (rule, metric, period) => {
    try {
        const pool = await getPool();
        const sellerId = rule.SellerId;
        
        let whereClause = 'WHERE 1=1';
        if (sellerId) whereClause += ` AND SellerId = '${sellerId}'`;

        // We could add more filters here based on rule.asinFilter if it exists in JSON
        
        const days = period ? parseInt(period.replace(/[^0-9]/g, '')) || 7 : 7;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - days);
        const dateStr = targetDate.toISOString().split('T')[0];

        const asinsResult = await pool.request().query(`SELECT * FROM Asins ${whereClause}`);
        const asins = asinsResult.recordset;

        let currentValue = 0;
        let previousValue = 0;

        switch (metric) {
            case 'price':
            case 'avgPrice':
            case 'totalRevenue':
                currentValue = asins.reduce((sum, a) => sum + (Number(a.CurrentPrice) || 0), 0);
                if (metric === 'avgPrice' && asins.length > 0) currentValue /= asins.length;
                
                // Get historical average for comparison
                const priceHistResult = await pool.request()
                    .input('date', sql.Date, dateStr)
                    .query(`SELECT AVG(Price) as avgPrice, SUM(Price) as totalSupply FROM AsinHistory WHERE Date = @date AND AsinId IN (SELECT Id FROM Asins ${whereClause})`);
                
                if (metric === 'avgPrice') previousValue = priceHistResult.recordset[0]?.avgPrice || 0;
                else previousValue = priceHistResult.recordset[0]?.totalSupply || 0;
                break;

            case 'bsr':
                const validBsrAsins = asins.filter(a => a.BSR && a.BSR > 0);
                currentValue = validBsrAsins.length > 0 
                    ? validBsrAsins.reduce((sum, a) => sum + a.BSR, 0) / validBsrAsins.length 
                    : 0;
                
                const bsrHistResult = await pool.request()
                    .input('date', sql.Date, dateStr)
                    .query(`SELECT AVG(BSR) as avgBsr FROM AsinHistory WHERE Date = @date AND BSR > 0 AND AsinId IN (SELECT Id FROM Asins ${whereClause})`);
                previousValue = bsrHistResult.recordset[0]?.avgBsr || 0;
                break;

            case 'rating':
                const validRatingAsins = asins.filter(a => a.Rating && a.Rating > 0);
                currentValue = validRatingAsins.length > 0 
                    ? validRatingAsins.reduce((sum, a) => sum + Number(a.Rating), 0) / validRatingAsins.length 
                    : 0;
                
                const ratingHistResult = await pool.request()
                    .input('date', sql.Date, dateStr)
                    .query(`SELECT AVG(Rating) as avgRating FROM AsinHistory WHERE Date = @date AND Rating > 0 AND AsinId IN (SELECT Id FROM Asins ${whereClause})`);
                previousValue = ratingHistResult.recordset[0]?.avgRating || 0;
                break;

            case 'reviews':
                currentValue = asins.reduce((sum, a) => sum + (a.ReviewCount || 0), 0);
                const reviewHistResult = await pool.request()
                    .input('date', sql.Date, dateStr)
                    .query(`SELECT SUM(ReviewCount) as totalReviews FROM AsinHistory WHERE Date = @date AND AsinId IN (SELECT Id FROM Asins ${whereClause})`);
                previousValue = reviewHistResult.recordset[0]?.totalReviews || 0;
                break;

            case 'lqs':
                const validLqsAsins = asins.filter(a => a.LQS != null);
                currentValue = validLqsAsins.length > 0 
                    ? validLqsAsins.reduce((sum, a) => sum + Number(a.LQS), 0) / validLqsAsins.length 
                    : 0;
                
                const lqsHistResult = await pool.request()
                    .input('date', sql.Date, dateStr)
                    .query(`SELECT AVG(LQS) as avgLqs FROM AsinHistory WHERE Date = @date AND LQS IS NOT NULL AND AsinId IN (SELECT Id FROM Asins ${whereClause})`);
                previousValue = lqsHistResult.recordset[0]?.avgLqs || 0;
                break;

            case 'buyBox':
                const buyBoxWins = asins.filter(a => a.BuyBoxStatus).length;
                currentValue = asins.length > 0 ? (buyBoxWins / asins.length) * 100 : 0;
                
                const bbHistResult = await pool.request()
                    .input('date', sql.Date, dateStr)
                    .query(`SELECT COUNT(*) as wins, (SELECT COUNT(*) FROM AsinHistory WHERE Date = @date AND AsinId IN (SELECT Id FROM Asins ${whereClause})) as total FROM AsinHistory WHERE Date = @date AND BuyBoxStatus = 1 AND AsinId IN (SELECT Id FROM Asins ${whereClause})`);
                const totalBB = bbHistResult.recordset[0]?.total || 0;
                previousValue = totalBB > 0 ? (bbHistResult.recordset[0].wins / totalBB) * 100 : 0;
                break;

            case 'inventory':
            case 'asinCount':
                currentValue = asins.length;
                const countHistResult = await pool.request()
                    .input('date', sql.Date, dateStr)
                    .query(`SELECT COUNT(*) as total FROM AsinHistory WHERE Date = @date AND AsinId IN (SELECT Id FROM Asins ${whereClause})`);
                previousValue = countHistResult.recordset[0]?.total || 0;
                break;

            default:
                currentValue = 0;
        }

        return { value: currentValue, previousValue, asins };
    } catch (error) {
        console.error('Error fetching metric data:', error);
        return null;
    }
};

const generateAlertMessage = (rule, currentValue, previousValue) => {
    const condition = typeof rule.Condition === 'string' ? JSON.parse(rule.Condition) : (rule.condition || {});
    const { metric, operator, value } = condition;
    
    const metricLabels = {
      price: 'Price',
      bsr: 'BSR',
      rating: 'Rating',
      reviews: 'Reviews',
      lqs: 'LQS',
      buyBox: 'Buy Box %',
      aplus: 'A+ Content %',
      inventory: 'Inventory',
      asinCount: 'ASIN Count',
      avgPrice: 'Avg Price',
      totalRevenue: 'Total Revenue'
    };
  
    const metricLabel = metricLabels[metric] || metric;
    
    if (operator === 'increased by' || operator === 'decreased by') {
      const change = previousValue !== 0 
        ? ((currentValue - previousValue) / previousValue * 100).toFixed(1) 
        : 0;
      return `${rule.Name}: ${metricLabel} ${operator} ${value}% (Current: ${currentValue.toFixed(2)}, Previous: ${previousValue.toFixed(2)}, Change: ${change}%)`;
    }
    
    return `${rule.Name}: ${metricLabel} is ${operator} ${value} (Current: ${currentValue.toFixed(2)})`;
};

const executeRule = async (req, res) => {
    try {
      const pool = await getPool();
      const ruleResult = await pool.request()
          .input('id', sql.VarChar, req.params.id)
          .query('SELECT * FROM AlertRules WHERE Id = @id');

      if (ruleResult.recordset.length === 0) {
        return res.status(404).json({ error: 'Alert rule not found' });
      }
      
      const rule = ruleResult.recordset[0];
      const result = await evaluateAndExecuteRule(rule);
      
      const execution = rule.Execution ? JSON.parse(rule.Execution) : {};
      execution.lastRun = new Date();
      execution.lastStatus = result.triggered ? 'triggered' : 'success';
      if (result.triggered) {
        execution.lastTriggered = new Date();
        execution.triggerCount = (execution.triggerCount || 0) + 1;
      }
  
      await pool.request()
          .input('id', sql.VarChar, rule.Id)
          .input('execution', sql.NVarChar, JSON.stringify(execution))
          .query('UPDATE AlertRules SET Execution = @execution, UpdatedAt = GETDATE() WHERE Id = @id');
  
      res.json({
        ruleId: rule.Id,
        ruleName: rule.Name,
        triggered: result.triggered,
        alertsCreated: result.alerts.length,
        tasksCreated: result.tasks.length,
        details: result.alerts
      });
    } catch (error) {
      console.error('Error executing rule:', error);
      res.status(500).json({ error: 'Failed to execute rule' });
    }
};

const executeAllRules = async (req, res) => {
    try {
      const userRole = req.user.role?.name || req.user.role;
      const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
      
      const pool = await getPool();
      const request = pool.request();
      
      let query = 'SELECT * FROM AlertRules WHERE IsActive = 1';
      if (!isGlobalUser) {
        const allowedSellers = req.user.assignedSellers.map(s => `'${s._id || s}'`).join(',');
        if (allowedSellers.length > 0) {
          query += ` AND (SellerId IN (${allowedSellers}) OR SellerId IS NULL)`;
        }
      }
  
      const rulesResult = await request.query(query);
      const rules = rulesResult.recordset;
      const results = [];
  
      for (const rule of rules) {
        const result = await evaluateAndExecuteRule(rule);
        
        const execution = rule.Execution ? JSON.parse(rule.Execution) : {};
        execution.lastRun = new Date();
        execution.lastStatus = result.triggered ? 'triggered' : 'success';
        if (result.triggered) {
          execution.lastTriggered = new Date();
          execution.triggerCount = (execution.triggerCount || 0) + 1;
        }

        await pool.request()
            .input('id', sql.VarChar, rule.Id)
            .input('execution', sql.NVarChar, JSON.stringify(execution))
            .query('UPDATE AlertRules SET Execution = @execution, UpdatedAt = GETDATE() WHERE Id = @id');
  
        results.push({
          ruleId: rule.Id,
          ruleName: rule.Name,
          triggered: result.triggered,
          alertsCreated: result.alerts.length
        });
      }
  
      const totalTriggered = results.filter(r => r.triggered).length;
      const totalAlerts = results.reduce((sum, r) => sum + r.alertsCreated, 0);
  
      res.json({
        totalRules: rules.length,
        triggered: totalTriggered,
        totalAlerts,
        results
      });
    } catch (error) {
      console.error('Error executing all rules:', error);
      res.status(500).json({ error: 'Failed to execute rules' });
    }
};

module.exports = {
    getUnreadAlertCount,
    acknowledgeAllAlerts,
    getAlertRuleById,
    toggleAlertRule,
    executeRule,
    executeAllRules,
    evaluateAndExecuteRule
};