const { sql, getPool, generateId } = require('../database/db');

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
  
  const pool = await getPool();

  if (type === 'ASIN' || type === 'Product') {
    let query = "SELECT * FROM Asins WHERE Status = 'Active'";
    const request = pool.request();
    if (sellerId) {
      query += " AND SellerId = @sellerId";
      request.input('sellerId', sql.VarChar, sellerId);
    }
    
    const result = await request.query(query);
    const asins = result.recordset;

    return asins.map(asin => {
      let history = [];
      try {
        history = JSON.parse(asin.WeekHistory || asin.History || '[]');
      } catch (e) {
        history = [];
      }
      
      const filteredHistory = history.filter(h => {
        const hDate = new Date(h.date);
        return hDate >= startDate && hDate <= excludeEndDate;
      });

      const metrics = {
        asinCode: asin.AsinCode,
        title: asin.Title,
        current_price: asin.CurrentPrice || 0,
        bsr: asin.Bsr || 0,
        rating: asin.Rating || 0,
        review_count: asin.ReviewCount || 0,
        lqs: asin.Lqs || 0,
        buy_box_winner: asin.BuyBoxWin || false,
        has_aplus: asin.HasAplus || false,
        image_count: asin.ImageCount || 0,
        desc_length: asin.DescLength || 0,
        category: asin.Category || '',
        brand: asin.Brand || '',
        tags: asin.Tags ? JSON.parse(asin.Tags) : [],
        asin_status: asin.Status || 'Active',
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
        metrics.acos = (metrics.ad_spend / (metrics.ad_sales || 1)) * 100;
        metrics.roas = metrics.ad_sales / metrics.ad_spend;
      }

      if (metrics.sessions > 0) {
        metrics.cvr = (metrics.orders / metrics.sessions) * 100;
        metrics.session_pct = (metrics.sessions / metrics.sessions) * 100;
      }

      if (metrics.ad_spend > 0 && metrics.revenue > 0) {
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
  const pool = await getPool();

  switch (action.actionType) {
    case 'send_email':
    case 'send_notification':
      try {
        const id = generateId();
        await pool.request()
          .input('Id', sql.VarChar, id)
          .input('UserId', sql.VarChar, userId)
          .input('Type', sql.NVarChar, 'RULESET')
          .input('Title', sql.NVarChar, `Ruleset Action: ${action.actionType}`)
          .input('Message', sql.NVarChar, `Action applied to ${entity.asinCode || entity.entityId}: ${action.actionType}`)
          .input('Read', sql.Bit, 0)
          .query(`
            INSERT INTO Notifications (Id, UserId, Type, Title, Message, [Read], CreatedAt)
            VALUES (@Id, @UserId, @Type, @Title, @Message, @Read, GETDATE())
          `);
        results.push({ action: 'notification_created', status: 'success' });
      } catch (err) {
        results.push({ action: 'notification_failed', status: 'failed', error: err.message });
      }
      break;

    case 'create_task':
      try {
        const id = generateId();
        await pool.request()
          .input('Id', sql.VarChar, id)
          .input('Title', sql.NVarChar, `Ruleset: ${action.actionType}`)
          .input('Description', sql.NVarChar, `Automated action from ruleset on ${entity.asinCode || entity.entityId}`)
          .input('Priority', sql.NVarChar, 'medium')
          .input('Status', sql.NVarChar, 'pending')
          .input('Type', sql.NVarChar, 'automated')
          .input('SellerId', sql.VarChar, sellerId)
          .input('CreatedBy', sql.VarChar, userId)
          .query(`
            INSERT INTO Actions (Id, Title, Description, Priority, Status, Type, SellerId, CreatedBy, CreatedAt, UpdatedAt)
            VALUES (@Id, @Title, @Description, @Priority, @Status, @Type, @SellerId, @CreatedBy, GETDATE(), GETDATE())
          `);
        results.push({ action: 'task_created', status: 'success', taskId: id });
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

  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.VarChar, rulesetId)
    .query("SELECT * FROM Rulesets WHERE Id = @id");
  
  const ruleset = result.recordset[0];
  if (!ruleset) {
    throw new Error('Ruleset not found');
  }

  // Parse JSON fields
  ruleset.Rules = JSON.parse(ruleset.Rules || '[]');

  const startTime = Date.now();
  const entities = await getEntityData(
    ruleset.Type,
    ruleset.SellerId,
    ruleset.UsingDataFrom,
    ruleset.ExcludeDays
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

    for (let i = 0; i < ruleset.Rules.length; i++) {
      const rule = ruleset.Rules[i];
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
          ruleset.Type,
          ruleset.SellerId,
          ruleset.CreatedBy
        );

        const entry = {
          entityId: entity.asinCode || entity.entityId,
          entityType: ruleset.Type,
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
          entityType: ruleset.Type,
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
    const logId = generateId();
    await pool.request()
      .input('Id', sql.VarChar, logId)
      .input('RulesetId', sql.VarChar, rulesetId)
      .input('TriggeredBy', sql.NVarChar, triggeredBy)
      .input('Summary', sql.NVarChar, JSON.stringify(summary))
      .input('Entries', sql.NVarChar, JSON.stringify(entries))
      .input('SellerId', sql.VarChar, ruleset.SellerId)
      .input('CreatedBy', sql.VarChar, ruleset.CreatedBy)
      .query(`
        INSERT INTO RulesetExecutionLogs (Id, RulesetId, ExecutedAt, TriggeredBy, Summary, Entries, SellerId, CreatedBy)
        VALUES (@Id, @RulesetId, GETDATE(), @TriggeredBy, @Summary, @Entries, @SellerId, @CreatedBy)
      `);

    await pool.request()
      .input('id', sql.VarChar, rulesetId)
      .input('summary', sql.NVarChar, JSON.stringify(summary))
      .query(`
        UPDATE Rulesets 
        SET LastRunAt = GETDATE(), 
            TotalRunCount = ISNULL(TotalRunCount, 0) + 1,
            LastRunSummary = @summary,
            UpdatedAt = GETDATE()
        WHERE Id = @id
      `);
  }

  return { summary, entries };
}

async function scheduleRuleset(rulesetId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.VarChar, rulesetId)
    .query("SELECT * FROM Rulesets WHERE Id = @id");
  
  const ruleset = result.recordset[0];
  if (!ruleset || !ruleset.IsActive || !ruleset.IsAutomated) {
    return null;
  }

  const syncResult = await evaluateRuleset(rulesetId, { triggeredBy: 'scheduled' });
  return syncResult;
}

module.exports = {
  evaluateRuleset,
  scheduleRuleset,
  getEntityData
};