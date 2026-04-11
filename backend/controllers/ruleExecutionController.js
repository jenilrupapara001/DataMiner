const { Alert, AlertRule } = require('../models/AlertModel');
const { createNotification } = require('./notificationController');
const User = require('../models/User');
const Action = require('../models/Action');
const Asin = require('../models/Asin');
const Seller = require('../models/Seller');
const mongoose = require('mongoose');

const getUnreadAlertCount = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const filter = isAdmin ? {} : { sellerId: { $in: req.user.assignedSellers.map(s => s._id.toString()) } };
    filter.acknowledged = false;

    const count = await Alert.countDocuments(filter);
    res.json({ count });
  } catch (error) {
    console.error('Error fetching alert count:', error);
    res.status(500).json({ error: 'Failed to fetch alert count' });
  }
};

const acknowledgeAllAlerts = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const filter = isAdmin ? {} : { sellerId: { $in: req.user.assignedSellers.map(s => s._id.toString()) } };
    filter.acknowledged = false;

    const result = await Alert.updateMany(filter, {
      acknowledged: true,
      acknowledgedBy: req.user.name || 'unknown',
      acknowledgedAt: new Date()
    });

    res.json({ acknowledgedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error acknowledging all alerts:', error);
    res.status(500).json({ error: 'Failed to acknowledge alerts' });
  }
};

const getAlertRuleById = async (req, res) => {
  try {
    const rule = await AlertRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }
    res.json(rule);
  } catch (error) {
    console.error('Error fetching alert rule:', error);
    res.status(500).json({ error: 'Failed to fetch alert rule' });
  }
};

const toggleAlertRule = async (req, res) => {
  try {
    console.log('toggleAlertRule called with params:', req.params);
    const rule = await AlertRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    rule.active = !rule.active;
    await rule.save();
    console.log('Rule toggled:', rule._id, 'active:', rule.active);
    res.json(rule);
  } catch (error) {
    console.error('Error toggling alert rule:', error);
    res.status(500).json({ error: 'Failed to toggle alert rule' });
  }
};

const executeRule = async (req, res) => {
  try {
    const rule = await AlertRule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    const result = await evaluateAndExecuteRule(rule);
    
    rule.execution.lastRun = new Date();
    rule.execution.lastStatus = result.triggered ? 'triggered' : 'success';
    if (result.triggered) {
      rule.execution.lastTriggered = new Date();
      rule.execution.triggerCount = (rule.execution.triggerCount || 0) + 1;
    }
    await rule.save();

    res.json({
      ruleId: rule._id,
      ruleName: rule.name,
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
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const filter = { active: true };
    if (!isAdmin) {
      filter.$or = [
        { sellerId: { $in: req.user.assignedSellers.map(s => s._id) } },
        { sellerId: { $exists: false } }
      ];
    }

    const rules = await AlertRule.find(filter);
    const results = [];

    for (const rule of rules) {
      const result = await evaluateAndExecuteRule(rule);
      
      rule.execution.lastRun = new Date();
      rule.execution.lastStatus = result.triggered ? 'triggered' : 'success';
      if (result.triggered) {
        rule.execution.lastTriggered = new Date();
        rule.execution.triggerCount = (rule.execution.triggerCount || 0) + 1;
      }
      await rule.save();

      results.push({
        ruleId: rule._id,
        ruleName: rule.name,
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

const evaluateAndExecuteRule = async (rule) => {
  const alerts = [];
  const tasks = [];

  try {
    const { metric, operator, value, period, thresholdType } = rule.condition;
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
      const alertData = {
        ruleId: rule._id,
        ruleName: rule.name,
        type: rule.type,
        message: generateAlertMessage(rule, currentValue, previousValue),
        severity: rule.severity,
        sellerId: rule.sellerId,
        data: {
          metric,
          operator,
          value,
          currentValue,
          previousValue,
          period
        }
      };

      const alert = await createAlert(alertData);
      alerts.push(alert);

      if (rule.actions?.createTask) {
        const task = await createTaskFromAlert(rule, alert, data);
        if (task) {
          tasks.push(task);
          alert.actionId = task._id;
          await alert.save();
        }
      }
    }

    return { triggered: shouldTrigger, alerts, tasks };
  } catch (error) {
    console.error('Error evaluating rule:', error);
    return { triggered: false, alerts, tasks };
  }
};

const fetchMetricData = async (rule, metric, period) => {
  const sellerFilter = rule.sellerId ? { seller: rule.sellerId } : {};
  
  let asinFilter = { ...sellerFilter };
  if (rule.asinFilter) {
    if (rule.asinFilter.categories?.length) asinFilter.category = { $in: rule.asinFilter.categories };
    if (rule.asinFilter.brands?.length) asinFilter.brand = { $in: rule.asinFilter.brands };
    if (rule.asinFilter.minPrice) asinFilter.currentPrice = { $gte: rule.asinFilter.minPrice };
    if (rule.asinFilter.maxPrice) asinFilter.currentPrice = { ...asinFilter.currentPrice, $lte: rule.asinFilter.maxPrice };
    if (rule.asinFilter.statuses?.length) asinFilter.status = { $in: rule.asinFilter.statuses };
  }

  const days = period ? parseInt(period.replace(/[^0-9]/g, '')) || 7 : 7;
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - days);
  const dateStr = targetDate.toISOString().split('T')[0];

  const asins = await Asin.find(asinFilter).select('currentPrice uploadedPrice bsr rating reviewCount weekHistory history lqs buyBoxWin hasAplus imagesCount descLength title asinCode');

  let currentValue = 0;
  let previousValue = 0;

  switch (metric) {
    case 'price':
      currentValue = asins.reduce((sum, a) => sum + (a.currentPrice || 0), 0);
      previousValue = asins.reduce((sum, a) => {
        const hist = a.history?.find(h => new Date(h.date).toISOString().split('T')[0] === dateStr);
        return sum + (hist?.price || hist?.currentPrice || a.currentPrice || 0);
      }, 0);
      break;

    case 'bsr':
      const validBsrAsins = asins.filter(a => a.bsr && a.bsr > 0);
      currentValue = validBsrAsins.length > 0 
        ? validBsrAsins.reduce((sum, a) => sum + a.bsr, 0) / validBsrAsins.length 
        : 0;
      break;

    case 'rating':
      const validRatingAsins = asins.filter(a => a.rating && a.rating > 0);
      currentValue = validRatingAsins.length > 0 
        ? validRatingAsins.reduce((sum, a) => sum + a.rating, 0) / validRatingAsins.length 
        : 0;
      break;

    case 'reviews':
      currentValue = asins.reduce((sum, a) => sum + (a.reviewCount || 0), 0);
      previousValue = asins.reduce((sum, a) => {
        const hist = a.history?.find(h => new Date(h.date).toISOString().split('T')[0] === dateStr);
        return sum + (hist?.reviews || hist?.reviewCount || a.reviewCount || 0);
      }, 0);
      break;

    case 'lqs':
      const validLqsAsins = asins.filter(a => a.lqs != null);
      currentValue = validLqsAsins.length > 0 
        ? validLqsAsins.reduce((sum, a) => sum + (a.lqs || 0), 0) / validLqsAsins.length 
        : 0;
      break;

    case 'buyBox':
      const buyBoxWins = asins.filter(a => a.buyBoxWin).length;
      currentValue = asins.length > 0 ? (buyBoxWins / asins.length) * 100 : 0;
      break;

    case 'aplus':
      const withAplus = asins.filter(a => a.hasAplus).length;
      currentValue = asins.length > 0 ? (withAplus / asins.length) * 100 : 0;
      break;

    case 'inventory':
      currentValue = asins.length;
      break;

    case 'asinCount':
      currentValue = asins.length;
      break;

    case 'avgPrice':
      currentValue = asins.length > 0 
        ? asins.reduce((sum, a) => sum + (a.currentPrice || 0), 0) / asins.length 
        : 0;
      break;

    case 'totalRevenue':
      currentValue = asins.reduce((sum, a) => sum + (a.currentPrice || 0), 0);
      previousValue = asins.reduce((sum, a) => {
        const hist = a.history?.find(h => new Date(h.date).toISOString().split('T')[0] === dateStr);
        return sum + (hist?.price || hist?.currentPrice || a.currentPrice || 0);
      }, 0);
      break;

    default:
      currentValue = 0;
  }

  return { value: currentValue, previousValue, asins };
};

const generateAlertMessage = (rule, currentValue, previousValue) => {
  const { metric, operator, value, period } = rule.condition;
  
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
    return `${rule.name}: ${metricLabel} ${operator} ${value}% (Current: ${currentValue.toFixed(2)}, Previous: ${previousValue.toFixed(2)}, Change: ${change}%)`;
  }
  
  return `${rule.name}: ${metricLabel} is ${operator} ${value} (Current: ${currentValue.toFixed(2)})`;
};

const createTaskFromAlert = async (rule, alert, data) => {
  try {
    const taskData = {
      title: `Alert: ${rule.name}`,
      description: alert.message,
      priority: rule.severity === 'critical' ? 'high' : rule.severity === 'warning' ? 'medium' : 'low',
      status: 'pending',
      type: 'automated',
      asin: alert.asinId,
      seller: rule.sellerId,
      source: 'alert_rule',
      sourceId: rule._id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    };

    const task = new Action(taskData);
    await task.save();
    return task;
  } catch (error) {
    console.error('Error creating task from alert:', error);
    return null;
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