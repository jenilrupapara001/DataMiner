const { sql, getPool } = require('../database/db');
const { buildInClause } = require('../utils/sqlHelpers');

exports.getOverview = async (req, res) => {
  try {
    const pool = await getPool();
    const userId = req.user.Id || req.user._id;
    const roleName = req.user.role?.name || req.user.role;
    const roleClean = String(roleName || '').toLowerCase();
    const isGlobal = ['admin', 'super admin', 'super_admin', 'superadmin', 'operational_manager'].includes(roleClean);
    const now = new Date();

    // ── Run all data queries in parallel ──
    const [objectivesData, actionsData, sellersData] = await Promise.all([
      loadObjectives(pool, userId, roleName, isGlobal, req.user),
      loadActions(pool, userId, roleName, isGlobal, req.user),
      loadSellers(pool),
    ]);

    const objectives = objectivesData.map(obj => ({
      ...obj,
      _id: obj.Id,
      id: obj.Id,
      title: obj.Title,
      description: obj.Description,
      status: obj.Status || 'PENDING',
      progress: obj.Progress || 0,
      createdAt: obj.CreatedAt,
      updatedAt: obj.UpdatedAt,
      sellerId: obj.SellerId,
      keyResults: (obj._krs || []).map(kr => ({
        ...kr,
        _id: kr.Id,
        id: kr.Id,
        title: kr.Title,
        objectiveId: kr.ObjectiveId,
        progress: kr.Progress || 0,
        status: kr.Status || 'PENDING',
        actions: (kr._actions || []).map(enrichAction),
      })),
    }));

    const actions = actionsData.map(enrichAction);

    // ── Compute KPIs from all actions ──
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(tomorrow.getDate() + 1);

    const kpis = { all: 0, todo: 0, overdue: 0, tomorrow: 0, upcoming: 0, status: { pending: 0, inProgress: 0, review: 0, completed: 0, rejected: 0 } };
    kpis.all = actions.length;

    actions.forEach(a => {
      const s = String(a.status || 'PENDING').toUpperCase();
      if (s === 'IN_PROGRESS') kpis.status.inProgress++;
      else if (s === 'COMPLETED') kpis.status.completed++;
      else if (s === 'REVIEW') kpis.status.review++;
      else if (s === 'REJECTED') kpis.status.rejected++;
      else kpis.status.pending++;

      if (s !== 'COMPLETED') {
        kpis.todo++;
        const dl = a.timeTracking?.deadline || a.DueDate;
        if (dl) {
          const d = new Date(dl);
          if (d < now) kpis.overdue++;
          else if (d >= tomorrow && d < dayAfter) kpis.tomorrow++;
          else if (d >= dayAfter) kpis.upcoming++;
        }
      }
    });

    // ── Build seller hierarchy ──
    const hierarchy = buildSellerHierarchy(objectives, actions, sellersData);

    // ── Simplified seller list for dropdown ──
    const sellers = sellersData.map(s => ({ _id: s.Id, name: s.Name, marketplace: s.Marketplace }));

    res.json({
      success: true,
      data: { objectives, actions, sellers, kpis, hierarchy },
    });
  } catch (error) {
    console.error('[TasksPage Overview]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ── Data Loaders ── */

async function loadObjectives(pool, userId, roleName, isGlobal, reqUser) {
  const request = pool.request();
  let whereClause = 'WHERE 1=1';

  if (!isGlobal) {
    const hierarchyService = require('../services/hierarchyService');
    const subordinateIds = await hierarchyService.getSubordinateIds(userId);
    const teamIds = [userId, ...subordinateIds];
    const teamList = buildInClause(request, 'ovTeamId', teamIds);

    const assignedSellerIds = (reqUser.assignedSellers || []).map(s => (s._id || s).toString());
    let accessFilter = '';
    if (assignedSellerIds.length > 0) {
      const sellerPlaceholders = buildInClause(request, 'ovSellerId', assignedSellerIds);
      accessFilter = ` OR (o.SellerId IN (${sellerPlaceholders}) AND o.SellerId IS NOT NULL)`;
    }

    whereClause += ` AND (o.OwnerId IN (${teamList}) ${accessFilter})`;
  }

  const result = await request.query(`
    SELECT o.*, u.FirstName + ' ' + u.LastName as OwnerName, s.Name as SellerName
    FROM Objectives o
    LEFT JOIN Users u ON o.OwnerId = u.Id
    LEFT JOIN Sellers s ON o.SellerId = s.Id
    ${whereClause}
    ORDER BY o.CreatedAt DESC
  `);

  const objectives = result.recordset;
  const objIds = objectives.map(o => o.Id);

  if (objIds.length === 0) return [];

  // Fetch KRs
  const krReq = pool.request();
  const krPlaceholders = buildInClause(krReq, 'ovKrId', objIds);
  const krResult = await krReq.query(`
    SELECT * FROM KeyResults WHERE ObjectiveId IN (${krPlaceholders}) ORDER BY CreatedAt ASC
  `);

  const krs = krResult.recordset;
  const krIds = krs.map(kr => kr.Id);

  // Fetch actions for all KRs
  const krActionMap = {};
  if (krIds.length > 0) {
    const actReq = pool.request();
    const actPlaceholders = buildInClause(actReq, 'ovActKrId', krIds);
    const actResult = await actReq.query(`
      SELECT a.*, ua.FirstName as assignedToFirstName, ua.LastName as assignedToLastName,
             ua.Email as assignedToEmail, uc.FirstName as createdByFirstName,
             uc.LastName as createdByLastName, s.Name as sellerName
      FROM Actions a
      LEFT JOIN Users ua ON a.AssignedTo = ua.Id
      LEFT JOIN Users uc ON a.CreatedBy = uc.Id
      LEFT JOIN Sellers s ON a.SellerId = s.Id
      WHERE a.KeyResultId IN (${actPlaceholders})
      ORDER BY a.CreatedAt DESC
    `);

    actResult.recordset.forEach(a => {
      const krId = a.KeyResultId;
      if (!krActionMap[krId]) krActionMap[krId] = [];
      krActionMap[krId].push(a);
    });
  }

  // Attach KRs and their actions to objectives
  const krByObj = {};
  krs.forEach(kr => {
    if (!krByObj[kr.ObjectiveId]) krByObj[kr.ObjectiveId] = [];
    krByObj[kr.ObjectiveId].push({
      ...kr,
      _actions: krActionMap[kr.Id] || [],
    });
  });

  objectives.forEach(o => {
    o._krs = krByObj[o.Id] || [];
  });

  return objectives;
}

async function loadActions(pool, userId, roleName, isGlobal, reqUser) {
  const request = pool.request();
  let whereClauses = [];

  if (!isGlobal) {
    const hierarchyService = require('../services/hierarchyService');
    const subordinateIds = await hierarchyService.getSubordinateIds(userId);
    const teamIds = [userId, ...subordinateIds];
    const teamList = buildInClause(request, 'actTeamId', teamIds);
    const assignedSellerIds = (reqUser.assignedSellers || []).map(s => (s._id || s).toString());
    const sellerList = buildInClause(request, 'actSellerId', assignedSellerIds);

    whereClauses.push(`(
      a.AssignedTo IN (${teamList}) OR
      a.CreatedBy IN (${teamList}) OR
      (a.SellerId IN (${sellerList}) AND a.SellerId IS NOT NULL)
    )`);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const result = await request.query(`
    WITH FirstUserSeller AS (
      SELECT SellerId, MIN(UserId) as UserId
      FROM UserSellers
      GROUP BY SellerId
    )
    SELECT a.*,
           COALESCE(ua.FirstName, uas.FirstName) as assignedToFirstName,
           COALESCE(ua.LastName, uas.LastName) as assignedToLastName,
           COALESCE(ua.Email, uas.Email) as assignedToEmail,
           COALESCE(a.AssignedTo, us.UserId) as resolvedAssignedTo,
           uc.FirstName as createdByFirstName, uc.LastName as createdByLastName,
           s.Name as sellerName, s.Marketplace as sellerMarketplace
    FROM Actions a
    LEFT JOIN Users ua ON a.AssignedTo = ua.Id
    LEFT JOIN Sellers s ON a.SellerId = s.Id
    LEFT JOIN FirstUserSeller us ON a.SellerId = us.SellerId OR (a.SellerId IS NULL AND a.Asins IS NOT NULL AND EXISTS (
      SELECT 1 FROM Asins asin
      WHERE asin.SellerId = us.SellerId
      AND a.Asins LIKE '%' + asin.Id + '%'
    ))
    LEFT JOIN Users uas ON us.UserId = uas.Id
    LEFT JOIN Users uc ON a.CreatedBy = uc.Id
    ${whereSql}
    ORDER BY a.CreatedAt DESC
  `);

  return result.recordset;
}

async function loadSellers(pool) {
  const result = await pool.request().query(`
    SELECT Id, Name, Marketplace, IsActive, CreatedAt
    FROM Sellers ORDER BY Name ASC
  `);
  return result.recordset;
}

/* ── Helpers ── */

function enrichAction(a) {
  return {
    ...a,
    _id: a.Id,
    id: a.Id,
    title: a.Title || a.title,
    description: a.Description || a.description,
    status: a.Status || a.status || 'PENDING',
    priority: a.Priority || a.priority || 'MEDIUM',
    type: a.Type || a.type || 'GENERAL',
    sellerId: a.SellerId ? { _id: a.SellerId, name: a.sellerName, marketplace: a.sellerMarketplace } : null,
    assignedTo: (a.AssignedTo || a.resolvedAssignedTo) ? {
      _id: a.AssignedTo || a.resolvedAssignedTo,
      firstName: a.assignedToFirstName,
      lastName: a.assignedToLastName,
      email: a.assignedToEmail,
    } : null,
    createdBy: a.CreatedBy ? { _id: a.CreatedBy, firstName: a.createdByFirstName, lastName: a.createdByLastName } : null,
    asins: safeParseJson(a.Asins, []),
    stage: safeParseJson(a.Stage, { current: 'PENDING', history: [] }),
    completion: safeParseJson(a.Completion, {}),
    timeTracking: safeParseJson(a.TimeTracking, {}),
    recurring: safeParseJson(a.Recurring, {}),
    autoGenerated: safeParseJson(a.AutoGenerated, {}),
    submission: safeParseJson(a.Submission, null),
    rejections: safeParseJson(a.Rejections, []),
    reviewDecision: safeParseJson(a.ReviewDecision, null),
    DueDate: a.DueDate,
    dueDate: a.DueDate,
    createdAt: a.CreatedAt,
    updatedAt: a.UpdatedAt,
    completedAt: a.CompletedAt,
    parentTaskId: a.ParentTaskId,
    parentId: a.ParentId,
    GoalId: a.GoalId,
    ObjectiveId: a.ObjectiveId,
    KeyResultId: a.KeyResultId,
    keyResultId: a.KeyResultId,
    sellerId_raw: a.SellerId,
  };
}

function safeParseJson(val, fallback) {
  if (!val) return fallback;
  try { return typeof val === 'string' ? JSON.parse(val) : val; }
  catch { return fallback; }
}

function buildSellerHierarchy(objectives, allActions, sellers) {
  const map = {};
  const sellerLookup = {};
  sellers.forEach(s => { sellerLookup[s.Id] = s.Name; });

  const resolveSeller = (item) => {
    let sid = item.sellerId || item.SellerId || item.SellerId_raw || (typeof item.sellerId === 'object' ? item.sellerId?._id : null);
    let sname = '';
    if (sid && !sname) sname = sellerLookup[sid] || '';
    if (!sid) { sid = 'unassigned'; sname = 'Unassigned'; }
    return { sellerId: sid, sellerName: sname || sid };
  };

  objectives.forEach(obj => {
    const { sellerId, sellerName } = resolveSeller(obj);
    if (!map[sellerId]) map[sellerId] = { sellerId, sellerName, objectives: [], directTasks: [] };
    const tasks = [];
    (obj.keyResults || []).forEach(kr => {
      (kr.actions || []).forEach(a => {
        tasks.push(a);
      });
    });
    const done = tasks.filter(t => t.status === 'COMPLETED').length;
    const progress = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
    map[sellerId].objectives.push({ ...obj, tasks, progress });
  });

  const standalone = allActions.filter(a =>
    !a.GoalId && !a.ObjectiveId && !a.KeyResultId && !a.keyResultId &&
    !a.parentTaskId && !a.parentId
  );

  standalone.forEach(a => {
    const { sellerId, sellerName } = resolveSeller(a);
    if (!map[sellerId]) map[sellerId] = { sellerId, sellerName, objectives: [], directTasks: [] };
    map[sellerId].directTasks.push(a);
  });

  return Object.values(map).sort((a, b) => a.sellerName.localeCompare(b.sellerName));
}
