const Asin = require('../models/Asin');
const Ruleset = require('../models/Ruleset');
const RulesetExecutionLog = require('../models/RulesetExecutionLog');
const Action = require('../models/Action');
const Notification = require('../models/Notification');

const DATE_RANGE_MAP = {
  'Last 7 days': 7,
  'Last 14 days': 14,
  'Last 30 days': 30,
  'Last 60 days': 60,
  'Last 90 days': 90,
  'Last 6 months': 180,
  'Last 1 year': 365
};

const EXCLUDE_DAYS_MAP = {
  'Latest day': 1,
  'Latest 2 days': 2,
  'Latest 3 days': 3,
  'Latest 7 days': 7,
  'None': 0
};

async function getEntityData(type, sellerId, dateRange, excludeDays) {
  const includeDays = DATE_RANGE_MAP[dateRange] || 14;
  const excludeCount = EXCLUDE_DAYS_MAP[excludeDays] || 1;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - includeDays - excludeCount);
  const excludeEndDate = new Date();
  excludeEndDate.setDate(excludeEndDate.getDate() - excludeCount);
  
  const sellerFilter = sellerId ? { seller: sellerId } : {};

  if (type === 'ASIN' || type === 'Product') {
    const asins = await Asin.find(sellerFilter)
      .select('asinCode title currentPrice bsr rating reviewCount lqs buyBoxWin hasAplus imageCount descLength category brand tags status weekHistory history')
      .lean();

    return asins.map(asin => {
      const history = asin.weekHistory || asin.history || [];
      
      const filteredHistory = history.filter(h => {
        const hDate = new Date(h.date);
        return hDate >= startDate && hDate <= excludeEndDate;
      });

      const metrics = {
        asinCode: asin.asinCode,
        title: asin.title,
        current_price: asin.currentPrice || 0,
        bsr: asin.bsr || 0,
        rating: asin.rating || 0,
        review_count: asin.reviewCount || 0,
        lqs: asin.lqs || 0,
        buy_box_winner: asin.buyBoxWin || false,
        has_aplus: asin.hasAplus || false,
        image_count: asin.imageCount || 0,
        desc_length: asin.descLength || 0,
        category: asin.category || '',
        brand: asin.brand || '',
        tags: asin.tags || [],
        asin_status: asin.status || 'Active',
        sessions: filteredHistory.reduce((sum, h) => sum + (h.sessions || 0), 0),
        page_views: filteredHistory.reduce((sum, h) => sum + (h.pageViews || h.impressions || 0), 0),
        orders: filteredHistory.reduce((sum, h) => sum + (h.orders || h.revenue || 0), 0),
        units_sold: filteredHistory.reduce((sum, h) => sum + (h.unitsSold || 0), 0),
        revenue: filteredHistory.reduce((sum, h) => sum + (h.revenue || 0), 0),
        ad_spend: filteredHistory.reduce((sum, h) => sum + (h.adSpend || 0), 0),
        ad_sales: filteredHistory.reduce((sum, h) => sum + (h.adSales || 0), 0),
        acos: 0,
        roas: 0
      };

      if (metrics.ad_spend > 0) {
        metrics.acos = (metrics.ad_spend / metrics.ad_sales) * 100;
        metrics.roas = metrics.ad_sales / metrics.ad_spend;
      }

      if (metrics.sessions > 0) {
        metrics.cvr = (metrics.orders / metrics.sessions) * 100;
        metrics.session_pct = (metrics.sessions / metrics.sessions) * 100;
      }

      if (metrics.ad_spend > 0) {
        metrics.tacos = (metrics.ad_spend / metrics.revenue) * 100;
      }

      return metrics;
    });
  }

  return [];
}

function evaluateCondition(condition, entity) {
  const { attribute, operator, value, value2 } = condition;
  const entityValue = entity[attribute];

  if (entityValue === undefined || entityValue === null) {
    return false;
  }

  switch (operator) {
    case '=':
      return entityValue == value;
    case '≠':
      return entityValue != value;
    case '<':
      return entityValue < value;
    case '<=':
      return entityValue <= value;
    case '>':
      return entityValue > value;
    case '>=':
      return entityValue >= value;
    case 'between':
      return entityValue >= value && entityValue <= value2;
    case 'contains':
      return String(entityValue).toLowerCase().includes(String(value).toLowerCase());
    case 'not contains':
      return !String(entityValue).toLowerCase().includes(String(value).toLowerCase());
    case 'starts with':
      return String(entityValue).toLowerCase().startsWith(String(value).toLowerCase());
    case 'is empty':
      return !entityValue || entityValue === '' || entityValue === 0;
    case 'is not empty':
      return entityValue && entityValue !== '' && entityValue !== 0;
    default:
      return false;
  }
}

function evaluateRule(rule, entity) {
  if (!rule.isActive || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  for (let i = 0; i < rule.conditions.length; i++) {
    const condition = rule.conditions[i];
    const result = evaluateCondition(condition, entity);

    if (i === 0) {
      if (!result) return false;
    } else {
      const prevResult = evaluateCondition(rule.conditions[i - 1], entity);
      if (condition.logicalOp === 'AND') {
        if (!prevResult || !result) return false;
      } else {
        if (prevResult || result) return true;
        if (i === rule.conditions.length - 1 && condition.logicalOp === 'OR') {
          return result;
        }
      }
    }
  }

  return true;
}

async function applyAction(entity, action, type, sellerId, userId) {
  const results = [];

  switch (action.actionType) {
    case 'send_email':
    case 'send_notification':
      try {
        const notification = new Notification({
          user: userId,
          type: 'RULESET',
          title: `Ruleset Action: ${action.actionType}`,
          message: `Action applied to ${entity.asinCode || entity.entityId}: ${action.actionType}`,
          read: false
        });
        await notification.save();
        results.push({ action: 'notification_created', status: 'success' });
      } catch (err) {
        results.push({ action: 'notification_failed', status: 'failed', error: err.message });
      }
      break;

    case 'create_task':
      try {
        const task = new Action({
          title: `Ruleset: ${action.actionType}`,
          description: `Automated action from ruleset on ${entity.asinCode || entity.entityId}`,
          priority: 'medium',
          status: 'pending',
          type: 'automated',
          seller: sellerId
        });
        await task.save();
        results.push({ action: 'task_created', status: 'success', taskId: task._id });
      } catch (err) {
        results.push({ action: 'task_failed', status: 'failed', error: err.message });
      }
      break;

    case 'add_tag':
      results.push({ action: 'add_tag', status: 'pending', tag: action.value });
      break;

    case 'remove_tag':
      results.push({ action: 'remove_tag', status: 'pending', tag: action.value });
      break;

    case 'pause_ads':
    case 'enable_ads':
      results.push({ action: action.actionType, status: 'pending' });
      break;

    case 'flag_review':
      results.push({ action: 'flag_review', status: 'pending' });
      break;

    default:
      results.push({ action: 'unknown', status: 'skipped' });
  }

  return results;
}

async function evaluateRuleset(rulesetId, options = {}) {
  const dryRun = options.dryRun || false;
  const triggeredBy = options.triggeredBy || 'manual';

  const ruleset = await Ruleset.findById(rulesetId);
  if (!ruleset) {
    throw new Error('Ruleset not found');
  }

  const startTime = Date.now();
  const entities = await getEntityData(
    ruleset.type,
    ruleset.seller,
    ruleset.usingDataFrom,
    ruleset.excludeDays
  );

  const summary = {
    totalEvaluated: entities.length,
    totalMatched: 0,
    totalActioned: 0,
    totalSkipped: 0,
    executionTimeMs: 0
  };

  const entries = [];

  for (const entity of entities) {
    let matchedRule = null;
    let matchedIndex = -1;

    for (let i = 0; i < ruleset.rules.length; i++) {
      const rule = ruleset.rules[i];
      if (evaluateRule(rule, entity)) {
        matchedRule = rule;
        matchedIndex = i;
        break;
      }
    }

    if (matchedRule) {
      summary.totalMatched++;

      if (!dryRun) {
        const actionResults = await applyAction(
          entity,
          matchedRule.action,
          ruleset.type,
          ruleset.seller,
          ruleset.createdBy
        );

        const entry = {
          entityId: entity.asinCode || entity.entityId,
          entityType: ruleset.type,
          entityName: entity.title || entity.name || entity.asinCode,
          ruleName: matchedRule.name,
          ruleOrder: matchedIndex,
          conditionsMet: matchedRule.conditions.map(c => ({ attribute: c.attribute, operator: c.operator, value: c.value })),
          actionApplied: matchedRule.action,
          previousValue: null,
          newValue: null,
          status: actionResults.some(r => r.status === 'success') ? 'applied' : 'failed'
        };
        entries.push(entry);
        summary.totalActioned++;
      } else {
        const entry = {
          entityId: entity.asinCode || entity.entityId,
          entityType: ruleset.type,
          entityName: entity.title || entity.name || entity.asinCode,
          ruleName: matchedRule.name,
          ruleOrder: matchedIndex,
          conditionsMet: matchedRule.conditions.map(c => ({ attribute: c.attribute, operator: c.operator, value: c.value })),
          actionApplied: matchedRule.action,
          previousValue: null,
          newValue: null,
          status: 'dry_run'
        };
        entries.push(entry);
        summary.totalActioned++;
      }
    } else {
      summary.totalSkipped++;
    }
  }

  summary.executionTimeMs = Date.now() - startTime;

  if (!dryRun) {
    const log = new RulesetExecutionLog({
      ruleset: ruleset._id,
      executedAt: new Date(),
      triggeredBy,
      summary,
      entries,
      seller: ruleset.seller,
      createdBy: ruleset.createdBy
    });
    await log.save();

    ruleset.lastRunAt = new Date();
    ruleset.totalRunCount = (ruleset.totalRunCount || 0) + 1;
    ruleset.lastRunSummary = summary;
    await ruleset.save();
  }

  return { summary, entries };
}

async function scheduleRuleset(rulesetId) {
  const ruleset = await Ruleset.findById(rulesetId);
  if (!ruleset || !ruleset.isActive || !ruleset.isAutomated) {
    return null;
  }

  const result = await evaluateRuleset(rulesetId, { triggeredBy: 'scheduled' });
  return result;
}

module.exports = {
  evaluateRuleset,
  scheduleRuleset,
  getEntityData
};