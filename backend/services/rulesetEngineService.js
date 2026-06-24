const { sql, getPool, generateId } = require('../database/db');

const DATE_RANGE_MAP = {
  'Last 7 days': 7,
  'Last 14 days': 14,
  'Last 30 days': 30,
  'Last 60 days': 60,
  'Last 90 days': 90,
};

const EXCLUDE_DAYS_MAP = {
  'Latest day': 1,
  'Latest 2 days': 2,
  'Latest 3 days': 3,
  'None': 0
};

async function getEntityData(type, sellerId, dateRange, excludeDays) {
  const pool = await getPool();

  if (type === 'ASIN' || type === 'Product') {
    let query = `SELECT 
      a.AsinCode, a.Title, a.Status, a.SellerId, a.Category, a.Brand,
      a.CurrentPrice, a.UploadedPrice, a.Mrp, a.DiscountPercentage,
      a.BSR, a.SubBsr, a.Rating, a.ReviewCount,
      a.LQS, a.TitleScore, a.BulletScore, a.ImageScore, a.DescriptionScore,
      a.ImagesCount, a.BulletPoints, a.HasAplus, a.BuyBoxWin,
      a.AvailabilityStatus, a.StockLevel,
      a.PriceDispute, a.HasDeal, a.DealBadge,
      a.BsrTrend, a.RatingTrend,
      a.Tags, a.SoldBy, a.Manufacturer,
      (SELECT SUM(ISNULL(OrderedUnits, 0)) FROM GmsDailyPerformance WITH (NOLOCK) WHERE Asin = a.AsinCode) as totalOrders
    FROM Asins a WITH (NOLOCK)
    WHERE a.Status IN ('Active', 'Error')`;
    
    const request = pool.request();
    if (sellerId) {
      query += ' AND a.SellerId = @sellerId';
      request.input('sellerId', sql.VarChar, sellerId);
    }
    
    const result = await request.query(query);
    
    return result.recordset.map(asin => {
      let tags = [];
      try { tags = JSON.parse(asin.Tags || '[]'); } catch (e) { tags = []; }

      return {
        asinCode: asin.AsinCode,
        title: asin.Title || '',
        seller: asin.SellerId || '',
        category: asin.Category || '',
        brand: asin.Brand || '',
        status: asin.Status || 'Active',
        tags: tags,

        // Price & Buybox
        currentPrice: asin.CurrentPrice || 0,
        uploadedPrice: asin.UploadedPrice || 0,
        mrp: asin.Mrp || 0,
        discountPercentage: asin.DiscountPercentage || 0,
        priceDispute: asin.PriceDispute === 1 || asin.PriceDispute === true,
        buyBoxWin: asin.BuyBoxWin === 1 || asin.BuyBoxWin === true,
        hasDeal: asin.HasDeal === 1 || asin.HasDeal === true,
        dealBadge: asin.DealBadge || '',

        // Listing Quality
        lqs: asin.LQS || 0,
        titleScore: asin.TitleScore || 0,
        bulletScore: asin.BulletScore || 0,
        imageScore: asin.ImageScore || 0,
        descriptionScore: asin.DescriptionScore || 0,
        imagesCount: asin.ImagesCount || 0,
        bulletPoints: asin.BulletPoints || 0,
        hasAplus: asin.HasAplus === 1 || asin.HasAplus === true,

        // Performance
        bsr: asin.BSR || 0,
        subBsr: asin.SubBsr || 0,
        rating: asin.Rating || 0,
        reviewCount: asin.ReviewCount || 0,
        bsrTrend: asin.BsrTrend || 'Stable',
        ratingTrend: asin.RatingTrend || 'Stable',
        totalOrders: asin.totalOrders || 0,

        // Inventory
        stockLevel: asin.StockLevel || 0,
        availabilityStatus: asin.AvailabilityStatus || 'Available',

        // Ads
        ads: asin.Ads ? 1 : 0,
        adsActive: asin.Ads === 1 || asin.Ads === true,
      };
    });
  }

  return [];
}

function evaluateCondition(condition, entity) {
  const { attribute, operator, value, value2 } = condition;
  const entityValue = entity[attribute];

  if (entityValue === undefined || entityValue === null) {
    if (operator === 'is empty') return true;
    if (operator === 'is not empty') return false;
    if (operator === '≠') return true;
    return false;
  }

  // Boolean type
  if (typeof entityValue === 'boolean' || operator === '=' && (value === 'true' || value === 'false')) {
    const boolVal = value === 'true' || value === true || value === 1;
    if (operator === '=') return entityValue === boolVal || entityValue == (boolVal ? 1 : 0);
    return false;
  }

  // List type (tags array)
  if (Array.isArray(entityValue)) {
    const arrStr = entityValue.join(',').toLowerCase();
    const valStr = String(value).toLowerCase();
    switch (operator) {
      case 'contains': return arrStr.includes(valStr);
      case 'not contains': return !arrStr.includes(valStr);
      case '=': return entityValue.map(v => String(v).toLowerCase()).includes(valStr);
      case '≠': return !entityValue.map(v => String(v).toLowerCase()).includes(valStr);
      default: return false;
    }
  }

  // Enum/text type
  if (typeof entityValue === 'string') {
    const ev = entityValue.toLowerCase();
    const v = String(value).toLowerCase();
    switch (operator) {
      case '=': return ev === v;
      case '≠': return ev !== v;
      case 'contains': return ev.includes(v);
      case 'not contains': return !ev.includes(v);
      case 'starts with': return ev.startsWith(v);
      case 'is empty': return ev === '';
      case 'is not empty': return ev !== '';
      default: return false;
    }
  }

  // Number type
  const numVal = Number(entityValue);
  const targetVal = Number(value);
  const targetVal2 = Number(value2);

  switch (operator) {
    case '=': return numVal === targetVal;
    case '≠': return numVal !== targetVal;
    case '<': return numVal < targetVal;
    case '<=': return numVal <= targetVal;
    case '>': return numVal > targetVal;
    case '>=': return numVal >= targetVal;
    case 'between': return numVal >= targetVal && numVal <= targetVal2;
    case 'is empty': return numVal === 0 || isNaN(numVal);
    case 'is not empty': return numVal !== 0 && !isNaN(numVal);
    default: return false;
  }
}

function evaluateRule(rule, entity) {
  if (!rule.isActive || !rule.conditions || rule.conditions.length === 0) {
    return false;
  }

  // Evaluate with proper AND/OR logic (left-to-right, respecting logicalOp on each condition)
  let result = evaluateCondition(rule.conditions[0], entity);

  for (let i = 1; i < rule.conditions.length; i++) {
    const condition = rule.conditions[i];
    const condResult = evaluateCondition(condition, entity);
    const op = condition.logicalOp || 'AND';

    if (op === 'AND') {
      result = result && condResult;
    } else {
      result = result || condResult;
    }
  }

  return result;
}

async function applyAction(entity, action, type, sellerId, userId, matchedRule = null) {
  const results = [];
  const pool = await getPool();

  switch (action.actionType) {
    case 'send_email':
    case 'send_notification': {
      try {
        const id = generateId();
        const ruleName = matchedRule?.name || 'Ruleset Rule';
        const asinCode = entity.asinCode || 'Unknown';
        const message = `Rule "${ruleName}" matched for ASIN ${asinCode}. ${matchedRule?.conditions?.map(c => `${c.attribute} ${c.operator} ${c.value}`).join(', ') || ''}`;

        await pool.request()
          .input('Id', sql.VarChar, id)
          .input('RecipientId', sql.VarChar, userId)
          .input('Type', sql.NVarChar, 'RULESET')
          .input('ReferenceModel', sql.NVarChar, 'Seller')
          .input('ReferenceId', sql.VarChar, sellerId)
          .input('Message', sql.NVarChar, message)
          .query(`
            INSERT INTO Notifications (Id, RecipientId, Type, ReferenceModel, ReferenceId, Message, CreatedAt)
            VALUES (@Id, @RecipientId, @Type, @ReferenceModel, @ReferenceId, @Message, dbo.GetEnvDate())
          `);
        results.push({ action: action.actionType, status: 'success' });
      } catch (err) {
        results.push({ action: action.actionType, status: 'failed', error: err.message });
      }
      break;
    }

    case 'create_task':
    case 'create_task_high': {
      try {
        const id = generateId();
        const asinsJson = JSON.stringify([entity.asinCode || entity.entityId]);
        const priority = action.actionType === 'create_task_high' ? 'High' : 'Medium';
        const ruleName = matchedRule?.name || 'Ruleset Rule';
        const title = `[Ruleset] ${ruleName}`;
        const description = `Automated task from ruleset "${ruleName}" for ASIN ${entity.asinCode || entity.entityId}.`;
        const sellerIdStr = sellerId || entity.seller || '';

        await pool.request()
          .input('Id', sql.VarChar, id)
          .input('Title', sql.NVarChar, title)
          .input('Description', sql.NVarChar, description)
          .input('Priority', sql.NVarChar, priority)
          .input('Status', sql.NVarChar, 'pending')
          .input('Type', sql.NVarChar, 'automated')
          .input('Asins', sql.NVarChar, asinsJson)
          .input('SellerId', sql.VarChar, sellerIdStr)
          .input('CreatedBy', sql.VarChar, userId)
          .query(`
            INSERT INTO Actions (Id, Title, Description, Priority, Status, Type, Asins, SellerId, CreatedBy, CreatedAt, UpdatedAt)
            VALUES (@Id, @Title, @Description, @Priority, @Status, @Type, @Asins, @SellerId, @CreatedBy, dbo.GetEnvDate(), dbo.GetEnvDate())
          `);
        results.push({ action: 'task_created', status: 'success', taskId: id });
      } catch (err) {
        results.push({ action: 'task_failed', status: 'failed', error: err.message });
      }
      break;
    }

    case 'add_tag': {
      try {
        const tagValue = action.value || '';
        if (tagValue && entity.asinCode) {
          let currentTags = [];
          try {
            const tagResult = await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .query('SELECT Tags FROM Asins WHERE AsinCode = @asin');
            if (tagResult.recordset.length > 0) {
              currentTags = JSON.parse(tagResult.recordset[0].Tags || '[]');
            }
          } catch (e) {}

          if (!currentTags.includes(tagValue)) {
            currentTags.push(tagValue);
            await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .input('tags', sql.NVarChar, JSON.stringify(currentTags))
              .query('UPDATE Asins SET Tags = @tags WHERE AsinCode = @asin');
          }
          results.push({ action: 'add_tag', status: 'success', tag: tagValue });
        } else {
          results.push({ action: 'add_tag', status: 'skipped', reason: 'No tag value or ASIN' });
        }
      } catch (err) {
        results.push({ action: 'add_tag', status: 'failed', error: err.message });
      }
      break;
    }

    case 'remove_tag': {
      try {
        const tagValue = action.value || '';
        if (tagValue && entity.asinCode) {
          let currentTags = [];
          try {
            const tagResult = await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .query('SELECT Tags FROM Asins WHERE AsinCode = @asin');
            if (tagResult.recordset.length > 0) {
              currentTags = JSON.parse(tagResult.recordset[0].Tags || '[]');
            }
          } catch (e) {}

          const newTags = currentTags.filter(t => t !== tagValue);
          await pool.request()
            .input('asin', sql.NVarChar, entity.asinCode)
            .input('tags', sql.NVarChar, JSON.stringify(newTags))
            .query('UPDATE Asins SET Tags = @tags WHERE AsinCode = @asin');
          results.push({ action: 'remove_tag', status: 'success', tag: tagValue });
        }
      } catch (err) {
        results.push({ action: 'remove_tag', status: 'failed', error: err.message });
      }
      break;
    }

    case 'flag_review': {
      try {
        if (entity.asinCode) {
          let currentTags = [];
          try {
            const tagResult = await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .query('SELECT Tags FROM Asins WHERE AsinCode = @asin');
            if (tagResult.recordset.length > 0) {
              currentTags = JSON.parse(tagResult.recordset[0].Tags || '[]');
            }
          } catch (e) {}

          if (!currentTags.includes('Needs Review')) {
            currentTags.push('Needs Review');
            await pool.request()
              .input('asin', sql.NVarChar, entity.asinCode)
              .input('tags', sql.NVarChar, JSON.stringify(currentTags))
              .query('UPDATE Asins SET Tags = @tags WHERE AsinCode = @asin');
          }
          results.push({ action: 'flag_review', status: 'success' });
        }
      } catch (err) {
        results.push({ action: 'flag_review', status: 'failed', error: err.message });
      }
      break;
    }

    default:
      results.push({ action: action.actionType || 'unknown', status: 'skipped', reason: 'Action not implemented' });
  }

  return results;
}

async function evaluateRuleset(rulesetId, options = {}) {
  const dryRun = options.dryRun || false;
  const triggeredBy = options.triggeredBy || 'manual';
  const selectedAsins = options.selectedAsins || null;

  const pool = await getPool();
  const result = await pool.request()
    .input('id', sql.VarChar, rulesetId)
    .query("SELECT * FROM Rulesets WHERE Id = @id AND IsActive = 1");
  
  const ruleset = result.recordset[0];
  if (!ruleset) {
    throw new Error('Ruleset not found or inactive');
  }

  ruleset.Rules = JSON.parse(ruleset.Rules || '[]');

  const startTime = Date.now();
  let entities = await getEntityData(
    ruleset.Type,
    ruleset.SellerId,
    ruleset.UsingDataFrom,
    ruleset.ExcludeDays
  );

  if (selectedAsins && selectedAsins.length > 0) {
    entities = entities.filter(entity => selectedAsins.includes(entity.asinCode));
  }

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

      let actionResults = [];
      if (!dryRun) {
        actionResults = await applyAction(
          entity,
          matchedRule.action,
          ruleset.Type,
          ruleset.SellerId,
          ruleset.CreatedBy,
          matchedRule
        );
        summary.totalActioned++;
      }

      entries.push({
        entityId: entity.asinCode || entity.entityId,
        entityType: ruleset.Type,
        entityName: entity.title || entity.asinCode,
        ruleName: matchedRule.name,
        ruleOrder: matchedIndex,
        conditionsMet: matchedRule.conditions.map(c => ({
          attribute: c.attribute,
          operator: c.operator,
          value: c.value
        })),
        actionApplied: matchedRule.action,
        status: dryRun ? 'dry_run' : (actionResults.some(r => r.status === 'success') ? 'applied' : 'failed')
      });
    } else {
      summary.totalSkipped++;
    }
  }

  summary.executionTimeMs = Date.now() - startTime;

  if (!dryRun && entries.length > 0) {
    const logId = generateId();
    await pool.request()
      .input('Id', sql.VarChar, logId)
      .input('RulesetId', sql.VarChar, rulesetId)
      .input('TriggeredBy', sql.NVarChar, triggeredBy)
      .input('Status', sql.NVarChar, 'SUCCESS')
      .input('MatchedCount', sql.Int, summary.totalMatched)
      .input('ActionedCount', sql.Int, summary.totalActioned)
      .input('Summary', sql.NVarChar, JSON.stringify(summary))
      .query(`
        INSERT INTO RulesetExecutionLogs (Id, RulesetId, ExecutedAt, TriggeredBy, Status, MatchedCount, ActionedCount, Summary)
        VALUES (@Id, @RulesetId, dbo.GetEnvDate(), @TriggeredBy, @Status, @MatchedCount, @ActionedCount, @Summary)
      `);

    await pool.request()
      .input('id', sql.VarChar, rulesetId)
      .input('summary', sql.NVarChar, JSON.stringify(summary))
      .query(`
        UPDATE Rulesets 
        SET LastRunAt = dbo.GetEnvDate(), 
            TotalRunCount = ISNULL(TotalRunCount, 0) + 1,
            LastRunSummary = @summary,
            UpdatedAt = dbo.GetEnvDate()
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
  getEntityData,
  evaluateCondition,
  evaluateRule
};
