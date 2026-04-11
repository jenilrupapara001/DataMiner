const { Alert, AlertRule } = require('../models/AlertModel');
const { createNotification } = require('./notificationController');
const ruleExecutionController = require('./ruleExecutionController');
const User = require('../models/User');

const mongoose = require('mongoose');

exports.getUnreadAlertCount = ruleExecutionController.getUnreadAlertCount;
exports.acknowledgeAllAlerts = ruleExecutionController.acknowledgeAllAlerts;
exports.getAlertRuleById = ruleExecutionController.getAlertRuleById;
exports.toggleAlertRule = ruleExecutionController.toggleAlertRule;
exports.executeRule = ruleExecutionController.executeRule;
exports.executeAllRules = ruleExecutionController.executeAllRules;

exports.getAlerts = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const filter = isAdmin ? {} : { sellerId: { $in: req.user.assignedSellers.map(s => s._id.toString()) } };

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('ruleId', 'name type')
      .populate('asinId', 'asinCode title')
      .populate('sellerId', 'name');
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

exports.getAlertRules = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const filter = isAdmin ? {} : { 
      $or: [
        { sellerId: { $in: req.user.assignedSellers.map(s => s._id.toString()) } },
        { sellerId: { $exists: false } }
      ]
    };

    const rules = await AlertRule.find(filter)
      .sort({ createdAt: -1 })
      .populate('sellerId', 'name')
      .populate('createdBy', 'name email');
    res.json(rules);
  } catch (error) {
    console.error('Error fetching alert rules:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
};

exports.createAlertRule = async (req, res) => {
  try {
    const ruleData = {
      ...req.body,
      createdBy: req.user._id
    };
    const rule = new AlertRule(ruleData);
    await rule.save();
    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating alert rule:', error);
    res.status(400).json({ error: error.message || 'Failed to create alert rule' });
  }
};

exports.updateAlertRule = async (req, res) => {
  try {
    const rule = await AlertRule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }
    res.json(rule);
  } catch (error) {
    console.error('Error updating alert rule:', error);
    res.status(400).json({ error: error.message || 'Failed to update alert rule' });
  }
};

exports.deleteAlertRule = async (req, res) => {
  try {
    const rule = await AlertRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }
    res.json({ message: 'Alert rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
};

exports.acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = isAdmin || req.user.assignedSellers.some(s => s._id.toString() === alert.sellerId?.toString());

    if (!isAssigned && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to acknowledge this alert' });
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = req.body.acknowledgedBy || req.user.name || 'unknown';
    alert.acknowledgedAt = new Date();
    await alert.save();
    res.json(alert);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(400).json({ error: 'Failed to acknowledge alert' });
  }
};

exports.createAlert = async (alertData) => {
  try {
    const alert = new Alert(alertData);
    await alert.save();

    try {
      const admins = await User.find({ role: { $ne: null } });
      for (const admin of admins) {
        await createNotification(
          admin._id,
          'ALERT',
          'Alert',
          alert._id,
          `New Alert: ${alert.message}`
        );
      }
    } catch (e) {
      console.error('Failed to create alert notifications:', e);
    }

    return alert;
  } catch (error) {
    console.error('Error creating alert:', error);
    throw error;
  }
};

exports.checkAlerts = async () => {
  try {
    const rules = await AlertRule.find({ active: true });
    const alerts = [];

    for (const rule of rules) {
      const result = await ruleExecutionController.evaluateAndExecuteRule(rule);
      if (result.triggered) {
        alerts.push(...result.alerts);
      }
    }

    return alerts;
  } catch (error) {
    console.error('Error checking alerts:', error);
    return [];
  }
};

// Get all alert rules
exports.getAlertRules = async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const filter = isAdmin ? {} : { sellerId: { $in: req.user.assignedSellers.map(s => s._id.toString()) } };

    const rules = await AlertRule.find(filter).sort({ createdAt: -1 });
    res.json(rules);
  } catch (error) {
    console.error('Error fetching alert rules:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
};

// Create a new alert rule
exports.createAlertRule = async (req, res) => {
  try {
    const rule = new AlertRule(req.body);
    await rule.save();
    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating alert rule:', error);
    res.status(400).json({ error: 'Failed to create alert rule' });
  }
};

// Update an alert rule
exports.updateAlertRule = async (req, res) => {
  try {
    const rule = await AlertRule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }
    res.json(rule);
  } catch (error) {
    console.error('Error updating alert rule:', error);
    res.status(400).json({ error: 'Failed to update alert rule' });
  }
};

// Delete an alert rule
exports.deleteAlertRule = async (req, res) => {
  try {
    const rule = await AlertRule.findByIdAndDelete(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }
    res.json({ message: 'Alert rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
};

// Acknowledge an alert
exports.acknowledgeAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = isAdmin || req.user.assignedSellers.some(s => s._id.toString() === alert.sellerId);

    if (!isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to acknowledge this alert' });
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = req.body.acknowledgedBy || req.user.name || 'unknown';
    alert.acknowledgedAt = new Date();
    await alert.save();
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(alert);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(400).json({ error: 'Failed to acknowledge alert' });
  }
};

// Create an alert (internal use)
exports.createAlert = async (alertData) => {
  try {
    const alert = new Alert(alertData);
    await alert.save();

    // Trigger Notification for Admin users (or relevant users based on rule)
    try {
      // Find admin users or all users for now as a fallback
      const admins = await User.find({ role: { $ne: null } });
      // Ideally filter by permission or role. For now, notify all 'staff'

      for (const admin of admins) {
        await createNotification(
          admin._id,
          'ALERT',
          'Alert',
          alert._id,
          `New Alert: ${alert.message}`
        );
      }
    } catch (e) {
      console.error('Failed to create alert notifications:', e);
    }

    return alert;
  } catch (error) {
    console.error('Error creating alert:', error);
    throw error;
  }
};

// Check and generate alerts based on rules
exports.checkAlerts = async () => {
  try {
    const rules = await AlertRule.find({ active: true });
    const alerts = [];

    // For each rule, check if it should trigger an alert
    for (const rule of rules) {
      const shouldTrigger = await evaluateRule(rule);
      if (shouldTrigger) {
        // Prevent duplicate alerts for same rule in short window? 
        // For now, just create it.
        const alert = await createAlertForRule(rule);
        alerts.push(alert);
      }
    }

    return alerts;
  } catch (error) {
    console.error('Error checking alerts:', error);
    return [];
  }
};

// Evaluate if a rule should trigger an alert
const evaluateRule = async (rule) => {
  try {
    const { metric, operator, value, period } = rule.condition;

    // Get current data for evaluation
    const currentData = await getDataForEvaluation(rule, metric, period);

    // Evaluate the condition
    switch (operator) {
      case '>':
        return currentData.value > value;
      case '<':
        return currentData.value < value;
      case '>=':
        return currentData.value >= value;
      case '<=':
        return currentData.value <= value;
      case '==':
        return currentData.value === value;
      case '!=':
        return currentData.value !== value;
      case 'increase':
        return calculatePercentageChange(currentData) > value;
      case 'decrease':
        return calculatePercentageChange(currentData) < -value;
      default:
        return false;
    }
  } catch (error) {
    console.error('Error evaluating rule:', error);
    return false;
  }
};

// Get data for evaluation
const getDataForEvaluation = async (rule, metric, period) => {
  // Aggregate data based on rule type and seller
  const sellerFilter = rule.sellerId ? { seller: rule.sellerId } : {};

  let currentValue = 0;
  let historyValue = 0; // For percentage change comparison

  // Fetch real data based on type
  if (rule.type === 'revenue') {
    // Proxy: Sum of currentPrice * totalOffers (or just Price as simple valuation)
    // Ideally we need an Order model. Using Asin Price sum as 'Catalog Value'.
    // We use mongoose.connection.model('Asin') to avoid circular dependency if any.
    const Asin = mongoose.models.Asin;
    const asins = await Asin.find(sellerFilter).select('currentPrice history');
    currentValue = asins.reduce((acc, curr) => acc + (curr.currentPrice || 0), 0);

    // Calculate history value (e.g. 7 days ago)
    if (period) {
      const days = parseInt(period.replace('d', '')) || 7;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - days);
      const dateStr = targetDate.toISOString().split('T')[0];

      historyValue = asins.reduce((acc, curr) => {
        const hist = curr.history?.find(h => new Date(h.date).toISOString().split('T')[0] === dateStr);
        return acc + (hist ? (hist.price || 0) : (curr.currentPrice || 0)); // Fallback to current if no history
      }, 0);
    }

  } else if (rule.type === 'inventory') {
    currentValue = 0; // Placeholder until Stock is tracked
  } else if (rule.type === 'ads') {
    currentValue = 0; // Placeholder until Ads are tracked
  }

  return {
    value: currentValue,
    history: {
      [period || '7d']: { value: historyValue }
    }
  };
};

// Calculate percentage change from previous period
const calculatePercentageChange = (data) => {
  // Find the first history key available
  const historyKeys = Object.keys(data.history || {});
  if (historyKeys.length === 0) return 0;

  const previous = data.history[historyKeys[0]].value;
  const current = data.value;

  if (!previous || previous === 0) return 0;

  return ((current - previous) / previous) * 100;
};

// Create an alert for a triggered rule
const createAlertForRule = async (rule) => {
  const alertData = {
    type: rule.type,
    message: `Rule triggered: ${rule.name}`,
    severity: rule.severity,
    data: {
      ruleId: rule._id,
      ruleName: rule.name,
      condition: rule.condition
    }
  };

  return await exports.createAlert(alertData);
};
