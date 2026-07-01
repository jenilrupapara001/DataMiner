const { sql, getPool, generateId } = require('../../database/db');
const { canTransition, calculateSLAStatus, calculateAchievement, calculateVariance, getNextDueDate, WORKFLOW_STATUSES } = require('./workflowEngine');

function genId() { return generateId ? generateId() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function genCode(prefix, n) { return `${prefix}-${String(n).padStart(4, '0')}`; }

// ═══════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════

async function createTemplate(data) {
  const pool = await getPool();
  const id = genId();
  const countResult = await pool.request().query('SELECT COUNT(*) as c FROM PemsTaskTemplates');
  const taskCode = genCode('TPL', countResult.recordset[0].c + 1);

  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskCode', sql.VarChar, taskCode)
    .input('name', sql.NVarChar, data.name)
    .input('description', sql.NVarChar, data.description || '')
    .input('category', sql.VarChar, data.category || 'GENERAL')
    .input('department', sql.VarChar, data.department || 'OPERATIONS')
    .input('frequency', sql.VarChar, data.frequency || 'ONE_TIME')
    .input('customCron', sql.NVarChar, data.customCron || null)
    .input('slaHours', sql.Int, data.slaHours || 48)
    .input('tatHours', sql.Int, data.tatHours || 24)
    .input('priority', sql.VarChar, data.priority || 'MEDIUM')
    .input('targetType', sql.VarChar, data.targetType || 'NUMERIC')
    .input('defaultTarget', sql.Decimal(18, 2), data.defaultTarget || 0)
    .input('expectedOutput', sql.NVarChar, data.expectedOutput || '')
    .input('reviewerId', sql.VarChar, data.reviewerId || null)
    .input('assigneeRole', sql.VarChar, data.assigneeRole || 'brand_manager')
    .input('activities', sql.NVarChar(sql.MAX), JSON.stringify(data.activities || []))
    .input('subTaskDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(data.subTaskDefinitions || []))
    .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags || []))
    .input('isActive', sql.Bit, data.isActive !== false ? 1 : 0)
    .input('createdBy', sql.VarChar, data.createdBy || null)
    .query(`
      INSERT INTO PemsTaskTemplates
        (Id, TaskCode, Name, Description, Category, Department, Frequency, CustomCron,
         SLAHours, TATHours, Priority, TargetType, DefaultTarget, ExpectedOutput,
         ReviewerId, AssigneeRole, Activities, SubTaskDefinitions, Tags, IsActive, CreatedBy)
      VALUES
        (@id, @taskCode, @name, @description, @category, @department, @frequency, @customCron,
         @slaHours, @tatHours, @priority, @targetType, @defaultTarget, @expectedOutput,
         @reviewerId, @assigneeRole, @activities, @subTaskDefinitions, @tags, @isActive, @createdBy)
    `);

  return { id, taskCode };
}

async function getTemplates(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.category) { where += ' AND Category = @category'; req.input('category', sql.VarChar, filters.category); }
  if (filters.frequency) { where += ' AND Frequency = @frequency'; req.input('frequency', sql.VarChar, filters.frequency); }
  if (filters.search) { where += ' AND (Name LIKE @search OR Description LIKE @search OR TaskCode LIKE @search)'; req.input('search', sql.NVarChar, `%${filters.search}%`); }
  if (filters.isActive !== undefined) { where += ' AND IsActive = @isActive'; req.input('isActive', sql.Bit, filters.isActive ? 1 : 0); }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 25;
  const offset = (page - 1) * limit;

  const countResult = await req.query(`SELECT COUNT(*) as total FROM PemsTaskTemplates ${where}`);
  const total = countResult.recordset[0].total;

  const dataReq = pool.request();
  if (filters.category) dataReq.input('category', sql.VarChar, filters.category);
  if (filters.frequency) dataReq.input('frequency', sql.VarChar, filters.frequency);
  if (filters.search) dataReq.input('search', sql.NVarChar, `%${filters.search}%`);
  if (filters.isActive !== undefined) dataReq.input('isActive', sql.Bit, filters.isActive ? 1 : 0);
  dataReq.input('offset', sql.Int, offset);
  dataReq.input('limit', sql.Int, limit);

  const result = await dataReq.query(`
    SELECT * FROM PemsTaskTemplates ${where}
    ORDER BY CreatedAt DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const templates = result.recordset.map(t => ({
    ...t,
    Activities: safeParse(t.Activities, []),
    SubTaskDefinitions: safeParse(t.SubTaskDefinitions, []),
    Tags: safeParse(t.Tags, []),
  }));

  return { templates, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getTemplateById(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.VarChar, id).query('SELECT * FROM PemsTaskTemplates WHERE Id = @id');
  const t = result.recordset[0];
  if (!t) return null;
  return { ...t, Activities: safeParse(t.Activities, []), SubTaskDefinitions: safeParse(t.SubTaskDefinitions, []), Tags: safeParse(t.Tags, []) };
}

async function updateTemplate(id, data) {
  const pool = await getPool();
  const sets = [];
  const req = pool.request().input('id', sql.VarChar, id);

  const fields = ['Name', 'Description', 'Category', 'Department', 'Frequency', 'CustomCron', 'SLAHours', 'TATHours', 'Priority', 'TargetType', 'DefaultTarget', 'ExpectedOutput', 'ReviewerId', 'AssigneeRole', 'IsActive'];
  fields.forEach(f => {
    const key = f.charAt(0).toLowerCase() + f.slice(1);
    if (data[key] !== undefined) {
      sets.push(`${f} = @${f}`);
      req.input(f, data[key] === null ? sql.NVarChar : (typeof data[key] === 'number' ? sql.Int : sql.NVarChar), data[key]);
    }
  });

  if (data.activities) { sets.push('Activities = @Activities'); req.input('Activities', sql.NVarChar(sql.MAX), JSON.stringify(data.activities)); }
  if (data.subTaskDefinitions) { sets.push('SubTaskDefinitions = @SubTaskDefinitions'); req.input('SubTaskDefinitions', sql.NVarChar(sql.MAX), JSON.stringify(data.subTaskDefinitions)); }
  if (data.tags) { sets.push('Tags = @Tags'); req.input('Tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags)); }

  if (sets.length === 0) return false;
  sets.push('UpdatedAt = dbo.GetEnvDate()');
  await req.query(`UPDATE PemsTaskTemplates SET ${sets.join(', ')} WHERE Id = @id`);
  return true;
}

async function deleteTemplate(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.VarChar, id).query('DELETE FROM PemsTaskTemplates WHERE Id = @id');
}

// ═══════════════════════════════════════════════════════
// TASK INSTANCES
// ═══════════════════════════════════════════════════════

async function createInstance(data) {
  const pool = await getPool();
  const id = genId();
  const countResult = await pool.request().query('SELECT COUNT(*) as c FROM PemsTaskInstances');
  const instanceCode = genCode('TASK', countResult.recordset[0].c + 1);
  const now = new Date();
  const dueDate = data.dueDate || getNextDueDate(data.frequency || 'ONE_TIME');

  await pool.request()
    .input('id', sql.VarChar, id)
    .input('instanceCode', sql.VarChar, instanceCode)
    .input('templateId', sql.VarChar, data.templateId)
    .input('sellerId', sql.VarChar, data.sellerId || null)
    .input('sellerName', sql.NVarChar, data.sellerName || '')
    .input('assignedTo', sql.VarChar, data.assignedTo || null)
    .input('assigneeName', sql.NVarChar, data.assigneeName || '')
    .input('reviewerId', sql.VarChar, data.reviewerId || null)
    .input('reviewerName', sql.NVarChar, data.reviewerName || '')
    .input('status', sql.VarChar, data.status || 'DRAFT')
    .input('reviewStatus', sql.VarChar, 'NOT_REVIEWED')
    .input('frequency', sql.VarChar, data.frequency || 'ONE_TIME')
    .input('title', sql.NVarChar, data.title || data.name || '')
    .input('description', sql.NVarChar, data.description || '')
    .input('priority', sql.VarChar, data.priority || 'MEDIUM')
    .input('target', sql.Decimal(18, 2), data.target || 0)
    .input('achievement', sql.Decimal(18, 2), 0)
    .input('slaStatus', sql.VarChar, 'WITHIN_SLA')
    .input('slaHours', sql.Int, data.slaHours || 48)
    .input('dueDate', sql.DateTime2, dueDate)
    .input('assignedAt', sql.DateTime2, data.status === 'ASSIGNED' ? now : null)
    .input('attachments', sql.NVarChar(sql.MAX), JSON.stringify(data.attachments || []))
    .input('tags', sql.NVarChar(sql.MAX), JSON.stringify(data.tags || []))
    .query(`
      INSERT INTO PemsTaskInstances
        (Id, InstanceCode, TemplateId, SellerId, SellerName, AssignedTo, AssigneeName,
         ReviewerId, ReviewerName, Status, ReviewStatus, Frequency, Title, Description,
         Priority, Target, Achievement, SLAStatus, SLAHours, DueDate, AssignedAt,
         Attachments, Tags)
      VALUES
        (@id, @instanceCode, @templateId, @sellerId, @sellerName, @assignedTo, @assigneeName,
         @reviewerId, @reviewerName, @status, @reviewStatus, @frequency, @title, @description,
         @priority, @target, @achievement, @slaStatus, @slaHours, @dueDate, @assignedAt,
         @attachments, @tags)
    `);

  // Create subtasks from template definitions
  // Fetch template's SOP if subTaskDefinitions not provided in request
  let subTaskDefs = data.subTaskDefinitions;
  if (!subTaskDefs || subTaskDefs.length === 0) {
    const tplResult = await pool.request().input('tplId', sql.VarChar, data.templateId)
      .query('SELECT SubTaskDefinitions FROM PemsTaskTemplates WHERE Id = @tplId');
    const tplRow = tplResult.recordset[0];
    if (tplRow) {
      subTaskDefs = safeParse(tplRow.SubTaskDefinitions, []);
    }
  }

  if (subTaskDefs && subTaskDefs.length > 0) {
    for (let i = 0; i < subTaskDefs.length; i++) {
      const st = subTaskDefs[i];
      const stId = genId();
      const stCode = genCode('ST', i + 1);
      await pool.request()
        .input('id', sql.VarChar, stId)
        .input('taskInstanceId', sql.VarChar, id)
        .input('subTaskCode', sql.VarChar, stCode)
        .input('title', sql.NVarChar, st.title || st.name || `Sub Task ${i + 1}`)
        .input('description', sql.NVarChar, st.description || '')
        .input('status', sql.VarChar, 'PENDING')
        .input('expectedOutput', sql.NVarChar, st.expectedOutput || '')
        .input('sortOrder', sql.Int, i)
        .query(`
          INSERT INTO PemsSubTasks (Id, TaskInstanceId, SubTaskCode, Title, Description, Status, ExpectedOutput, SortOrder)
          VALUES (@id, @taskInstanceId, @subTaskCode, @title, @description, @status, @expectedOutput, @sortOrder)
        `);

      // Create activities for each subtask
      if (st.activities && st.activities.length > 0) {
        for (let j = 0; j < st.activities.length; j++) {
          const act = st.activities[j];
          await pool.request()
            .input('id', sql.VarChar, genId())
            .input('subTaskId', sql.VarChar, stId)
            .input('taskInstanceId', sql.VarChar, id)
            .input('stepNo', sql.Int, j + 1)
            .input('title', sql.NVarChar, act.title || `Step ${j + 1}`)
            .input('instructions', sql.NVarChar, act.instructions || '')
            .input('expectedOutput', sql.NVarChar, act.expectedOutput || '')
            .input('supportDocuments', sql.NVarChar(sql.MAX), JSON.stringify(act.supportDocuments || []))
            .input('isMandatory', sql.Bit, act.isMandatory !== false ? 1 : 0)
            .query(`
              INSERT INTO PemsActivities (Id, SubTaskId, TaskInstanceId, StepNo, Title, Instructions, ExpectedOutput, SupportDocuments, IsMandatory)
              VALUES (@id, @subTaskId, @taskInstanceId, @stepNo, @title, @instructions, @expectedOutput, @supportDocuments, @isMandatory)
            `);
        }
      }
    }
  }

  // Update SubTaskCount and ActivityCount on the instance
  const stCountResult = await pool.request().input('instId', sql.VarChar, id)
    .query('SELECT COUNT(*) as stCount FROM PemsSubTasks WHERE TaskInstanceId = @instId');
  const actCountResult = await pool.request().input('instId', sql.VarChar, id)
    .query('SELECT COUNT(*) as actCount FROM PemsActivities WHERE TaskInstanceId = @instId');
  const stCount = stCountResult.recordset[0]?.stCount || 0;
  const actCount = actCountResult.recordset[0]?.actCount || 0;
  await pool.request()
    .input('instId', sql.VarChar, id)
    .input('stCount', sql.Int, stCount)
    .input('actCount', sql.Int, actCount)
    .query('UPDATE PemsTaskInstances SET SubTaskCount = @stCount, ActivityCount = @actCount WHERE Id = @instId');

  // Audit log
  await writeAuditLog(id, 'CREATED', null, data.status || 'DRAFT', data.createdBy, data.assigneeName, 'Task instance created');

  return { id, instanceCode };
}

async function getInstances(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.status) { where += ' AND i.Status = @status'; req.input('status', sql.VarChar, filters.status); }
  if (filters.sellerId) { where += ' AND i.SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
  if (filters.assignedTo) { where += ' AND i.AssignedTo = @assignedTo'; req.input('assignedTo', sql.VarChar, filters.assignedTo); }
  if (filters.reviewerId) { where += ' AND i.ReviewerId = @reviewerId'; req.input('reviewerId', sql.VarChar, filters.reviewerId); }
  if (filters.priority) { where += ' AND i.Priority = @priority'; req.input('priority', sql.VarChar, filters.priority); }
  if (filters.slaStatus) { where += ' AND i.SLAStatus = @slaStatus'; req.input('slaStatus', sql.VarChar, filters.slaStatus); }
  if (filters.reviewStatus) { where += ' AND i.ReviewStatus = @reviewStatus'; req.input('reviewStatus', sql.VarChar, filters.reviewStatus); }
  if (filters.dueBefore) { where += ' AND i.DueDate <= @dueBefore'; req.input('dueBefore', sql.DateTime2, new Date(filters.dueBefore)); }
  if (filters.dueAfter) { where += ' AND i.DueDate >= @dueAfter'; req.input('dueAfter', sql.DateTime2, new Date(filters.dueAfter)); }
  if (filters.search) { where += ' AND (i.Title LIKE @search OR i.InstanceCode LIKE @search OR i.SellerName LIKE @search)'; req.input('search', sql.NVarChar, `%${filters.search}%`); }
  if (filters.templateId) { where += ' AND i.TemplateId = @templateId'; req.input('templateId', sql.VarChar, filters.templateId); }

  const page = parseInt(filters.page) || 1;
  const limit = parseInt(filters.limit) || 25;
  const offset = (page - 1) * limit;
  const sortBy = filters.sortBy || 'CreatedAt';
  const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
  const allowedSorts = ['CreatedAt', 'DueDate', 'Priority', 'Status', 'AchievementPct', 'SLAStatus', 'InstanceCode'];
  const sortCol = allowedSorts.includes(sortBy) ? sortBy : 'CreatedAt';

  const countReq = pool.request();
  applyFilterInputs(countReq, filters);
  if (filters.dueBefore) countReq.input('dueBefore', sql.DateTime2, new Date(filters.dueBefore));
  if (filters.dueAfter) countReq.input('dueAfter', sql.DateTime2, new Date(filters.dueAfter));
  const countResult = await countReq.query(`SELECT COUNT(*) as total FROM PemsTaskInstances i ${where}`);
  const total = countResult.recordset[0].total;

  const dataReq = pool.request();
  applyFilterInputs(dataReq, filters);
  if (filters.dueBefore) dataReq.input('dueBefore', sql.DateTime2, new Date(filters.dueBefore));
  if (filters.dueAfter) dataReq.input('dueAfter', sql.DateTime2, new Date(filters.dueAfter));
  dataReq.input('offset', sql.Int, offset);
  dataReq.input('limit', sql.Int, limit);

  const result = await dataReq.query(`
    SELECT i.*, t.Name as TemplateName, t.TaskCode as TemplateCode, t.Category as TemplateCategory
    FROM PemsTaskInstances i
    LEFT JOIN PemsTaskTemplates t ON i.TemplateId = t.Id
    ${where}
    ORDER BY i.${sortCol} ${sortOrder}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);

  const instances = result.recordset.map(r => ({ ...r, Tags: safeParse(r.Tags, []), Attachments: safeParse(r.Attachments, []) }));

  return { instances, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function getInstanceById(id) {
  const pool = await getPool();
  const result = await pool.request().input('id', sql.VarChar, id).query(`
    SELECT i.*, t.Name as TemplateName, t.TaskCode as TemplateCode, t.Category as TemplateCategory,
           t.Activities as TemplateActivities, t.SubTaskDefinitions as TemplateSubTasks
    FROM PemsTaskInstances i
    LEFT JOIN PemsTaskTemplates t ON i.TemplateId = t.Id
    WHERE i.Id = @id
  `);
  const instance = result.recordset[0];
  if (!instance) return null;

  instance.Tags = safeParse(instance.Tags, []);
  instance.Attachments = safeParse(instance.Attachments, []);
  instance.TemplateActivities = safeParse(instance.TemplateActivities, []);
  instance.TemplateSubTasks = safeParse(instance.TemplateSubTasks, []);

  const subTasks = await pool.request().input('instanceId', sql.VarChar, id)
    .query('SELECT * FROM PemsSubTasks WHERE TaskInstanceId = @instanceId ORDER BY SortOrder');
  instance.subTasks = subTasks.recordset;

  for (const st of instance.subTasks) {
    const acts = await pool.request().input('subTaskId', sql.VarChar, st.Id)
      .query('SELECT * FROM PemsActivities WHERE SubTaskId = @subTaskId ORDER BY StepNo');
    st.activities = acts.recordset.map(a => ({ ...a, SupportDocuments: safeParse(a.SupportDocuments, []) }));
  }

  const evidence = await pool.request().input('instanceId', sql.VarChar, id)
    .query('SELECT * FROM PemsEvidence WHERE TaskInstanceId = @instanceId ORDER BY UploadedAt DESC');
  instance.evidence = evidence.recordset;

  const reviews = await pool.request().input('instanceId', sql.VarChar, id)
    .query('SELECT * FROM PemsTaskReviews WHERE TaskInstanceId = @instanceId ORDER BY CreatedAt DESC');
  instance.reviews = reviews.recordset.map(r => ({ ...r, ReviewChecklist: safeParse(r.ReviewChecklist, []) }));

  const auditLogs = await pool.request().input('instanceId', sql.VarChar, id)
    .query('SELECT TOP 50 * FROM PemsTaskAuditLogs WHERE TaskInstanceId = @instanceId ORDER BY CreatedAt DESC');
  instance.auditLogs = auditLogs.recordset.map(l => ({ ...l, Metadata: safeParse(l.Metadata, null) }));

  return instance;
}

// ═══════════════════════════════════════════════════════
// WORKFLOW TRANSITIONS
// ═══════════════════════════════════════════════════════

async function transitionStatus(taskInstanceId, toStatus, actorId, actorName, actorRole, details) {
  const pool = await getPool();
  const instance = await getInstanceById(taskInstanceId);
  if (!instance) throw new Error('Task instance not found');

  if (!canTransition(instance.Status, toStatus)) {
    throw new Error(`Invalid transition: ${instance.Status} → ${toStatus}`);
  }

  const now = new Date();
  const timeFields = {};
  switch (toStatus) {
    case 'ASSIGNED': timeFields.AssignedAt = now; break;
    case 'ACCEPTED': timeFields.AcceptedAt = now; break;
    case 'IN_PROGRESS': timeFields.StartedAt = now; break;
    case 'SUBMITTED': timeFields.SubmittedAt = now; break;
    case 'UNDER_REVIEW': case 'APPROVED': case 'REJECTED': timeFields.ReviewedAt = now; break;
    case 'APPROVED': case 'REJECTED': timeFields.CompletedAt = toStatus === 'APPROVED' ? now : null; break;
  }

  const sets = ['Status = @status', 'UpdatedAt = dbo.GetEnvDate()'];
  const req = pool.request().input('id', sql.VarChar, taskInstanceId).input('status', sql.VarChar, toStatus);

  Object.entries(timeFields).forEach(([field, val]) => {
    sets.push(`${field} = @${field}`);
    req.input(field, sql.DateTime2, val);
  });

  if (toStatus === 'REWORK') {
    sets.push('ReworkCount = ReworkCount + 1');
  }

  if (toStatus === 'REJECTED' || toStatus === 'REWORK') {
    sets.push('ReviewStatus = @reviewStatus');
    req.input('reviewStatus', sql.VarChar, 'REJECTED');
  }
  if (toStatus === 'APPROVED') {
    sets.push('ReviewStatus = @reviewStatus');
    req.input('reviewStatus', sql.VarChar, 'APPROVED');
  }
  if (toStatus === 'SUBMITTED') {
    sets.push('ReviewStatus = @reviewStatus');
    req.input('reviewStatus', sql.VarChar, 'PENDING_REVIEW');
    if (details) {
      sets.push('SubmissionRemarks = @submissionRemarks');
      req.input('submissionRemarks', sql.NVarChar(sql.MAX), details);
    }
  }

  await req.query(`UPDATE PemsTaskInstances SET ${sets.join(', ')} WHERE Id = @id`);

  await writeAuditLog(taskInstanceId, 'STATUS_CHANGED', instance.Status, toStatus, actorId, actorName, details || `Status changed to ${toStatus}`);

  // ── Notification Triggers ──
  try {
    const { triggerNotification } = require('./emailNotificationService');
    switch (toStatus) {
      case 'ASSIGNED':
        if (instance.AssignedTo) triggerNotification('TASK_ASSIGNED', instance, instance.AssignedTo);
        break;
      case 'SUBMITTED':
        if (instance.ReviewerId) triggerNotification('TASK_SUBMITTED', instance, instance.ReviewerId);
        break;
      case 'APPROVED':
        if (instance.AssignedTo) triggerNotification('TASK_APPROVED', instance, instance.AssignedTo);
        break;
      case 'REJECTED':
        if (instance.AssignedTo) triggerNotification('TASK_REJECTED', instance, instance.AssignedTo);
        break;
      case 'ESCALATED':
        if (instance.ReviewerId) triggerNotification('TASK_ESCALATED', instance, instance.ReviewerId);
        break;
    }
    // SLA breach notification
    if (toStatus === 'IN_PROGRESS' && instance.DueDate && instance.SLAHours) {
      const hoursUntilDue = (new Date(instance.DueDate) - new Date()) / (1000 * 60 * 60);
      if (hoursUntilDue <= 0) {
        triggerNotification('SLA_BREACH', instance, instance.AssignedTo);
      }
    }
  } catch (err) { console.warn('Notification trigger error:', err.message); }

  return { success: true, from: instance.Status, to: toStatus };
}

// ═══════════════════════════════════════════════════════
// SUB TASKS
// ═══════════════════════════════════════════════════════

async function completeSubTask(subTaskId, actorId, actorName) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.VarChar, subTaskId)
    .query("UPDATE PemsSubTasks SET IsCompleted = 1, Status = 'COMPLETED', CompletedAt = dbo.GetEnvDate() WHERE Id = @id");

  const st = await pool.request().input('id', sql.VarChar, subTaskId).query('SELECT TaskInstanceId FROM PemsSubTasks WHERE Id = @id');
  if (st.recordset[0]) {
    const instId = st.recordset[0].TaskInstanceId;
    // Recalculate progress
    const stCount = await pool.request().input('instId', sql.VarChar, instId)
      .query("SELECT COUNT(*) as total, SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) as done FROM PemsSubTasks WHERE TaskInstanceId = @instId");
    const total = stCount.recordset[0]?.total || 0;
    const done = stCount.recordset[0]?.done || 0;
    const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
    const weightedProgress = await calculateWeightedProgress(instId);
    await pool.request()
      .input('instId', sql.VarChar, instId)
      .input('done', sql.Int, done)
      .input('pct', sql.Decimal(5, 2), progressPct)
      .input('wp', sql.Decimal(5, 2), weightedProgress)
      .query('UPDATE PemsTaskInstances SET CompletedSubTasks = @done, ProgressPct = @pct, WeightedProgressPct = @wp WHERE Id = @instId');
    await writeAuditLog(instId, 'SUBTASK_COMPLETED', null, null, actorId, actorName, `Subtask completed`);
  }
}

async function completeActivity(activityId, actorId, actorName) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.VarChar, activityId)
    .input('actorId', sql.VarChar, actorId)
    .query("UPDATE PemsActivities SET IsCompleted = 1, CompletedAt = dbo.GetEnvDate(), CompletedBy = @actorId WHERE Id = @id");
}

// ═══════════════════════════════════════════════════════
// EVIDENCE
// ═══════════════════════════════════════════════════════

async function uploadEvidence(data) {
  const pool = await getPool();
  const id = genId();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskInstanceId', sql.VarChar, data.taskInstanceId)
    .input('subTaskId', sql.VarChar, data.subTaskId || null)
    .input('activityId', sql.VarChar, data.activityId || null)
    .input('fileName', sql.NVarChar, data.fileName)
    .input('fileUrl', sql.NVarChar, data.fileUrl)
    .input('fileType', sql.VarChar, data.fileType || 'FILE')
    .input('fileSize', sql.BigInt, data.fileSize || 0)
    .input('mimeType', sql.NVarChar, data.mimeType || '')
    .input('remarks', sql.NVarChar, data.remarks || '')
    .input('uploadedBy', sql.VarChar, data.uploadedBy)
    .input('uploadedByName', sql.NVarChar, data.uploadedByName || '')
    .query(`
      INSERT INTO PemsEvidence (Id, TaskInstanceId, SubTaskId, ActivityId, FileName, FileUrl, FileType, FileSize, MimeType, Remarks, UploadedBy, UploadedByName)
      VALUES (@id, @taskInstanceId, @subTaskId, @activityId, @fileName, @fileUrl, @fileType, @fileSize, @mimeType, @remarks, @uploadedBy, @uploadedByName)
    `);
  await writeAuditLog(data.taskInstanceId, 'EVIDENCE_UPLOADED', null, null, data.uploadedBy, data.uploadedByName, `Evidence uploaded: ${data.fileName}`);
  return { id };
}

// ═══════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════

async function submitReview(data) {
  const pool = await getPool();
  const id = genId();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskInstanceId', sql.VarChar, data.taskInstanceId)
    .input('reviewerId', sql.VarChar, data.reviewerId)
    .input('reviewerName', sql.NVarChar, data.reviewerName || '')
    .input('decision', sql.VarChar, data.decision)
    .input('qualityScore', sql.Int, data.qualityScore || null)
    .input('feedback', sql.NVarChar, data.feedback || '')
    .input('reviewChecklist', sql.NVarChar(sql.MAX), JSON.stringify(data.reviewChecklist || []))
    .input('reviewDurationMinutes', sql.Int, data.reviewDurationMinutes || null)
    .query(`
      INSERT INTO PemsTaskReviews (Id, TaskInstanceId, ReviewerId, ReviewerName, Decision, QualityScore, Feedback, ReviewChecklist, ReviewDurationMinutes)
      VALUES (@id, @taskInstanceId, @reviewerId, @reviewerName, @decision, @qualityScore, @feedback, @reviewChecklist, @reviewDurationMinutes)
    `);

  return { id };
}

// ═══════════════════════════════════════════════════════
// ACHIEVEMENT & SLA
// ═══════════════════════════════════════════════════════

async function updateAchievement(taskInstanceId, achievement) {
  const pool = await getPool();
  const instance = await pool.request().input('id', sql.VarChar, taskInstanceId).query('SELECT Target FROM PemsTaskInstances WHERE Id = @id');
  if (!instance.recordset[0]) throw new Error('Instance not found');
  const target = instance.recordset[0].Target;
  const achievementPct = calculateAchievement(achievement, target);
  const variance = calculateVariance(achievement, target);

  await pool.request()
    .input('id', sql.VarChar, taskInstanceId)
    .input('achievement', sql.Decimal(18, 2), achievement)
    .query('UPDATE PemsTaskInstances SET Achievement = @achievement, UpdatedAt = dbo.GetEnvDate() WHERE Id = @id');

  return { achievementPct, variance };
}

async function refreshSLAStatuses() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, DueDate, SLAHours, Status FROM PemsTaskInstances
    WHERE Status NOT IN ('APPROVED', 'CANCELLED')
  `);
  let updated = 0;
  for (const inst of result.recordset) {
    const slaStatus = calculateSLAStatus(inst.DueDate, inst.SLAHours);
    if (slaStatus !== inst.SLAStatus) {
      await pool.request().input('id', sql.VarChar, inst.Id).input('sla', sql.VarChar, slaStatus)
        .query('UPDATE PemsTaskInstances SET SLAStatus = @sla WHERE Id = @id');
      updated++;
    }
  }
  return { updated };
}

// ═══════════════════════════════════════════════════════
// DASHBOARD / KPIs
// ═══════════════════════════════════════════════════════

async function getDashboardKPIs(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();

  if (filters.sellerId) { where += ' AND SellerId = @sellerId'; req.input('sellerId', sql.VarChar, filters.sellerId); }
  if (filters.assignedTo) { where += ' AND AssignedTo = @assignedTo'; req.input('assignedTo', sql.VarChar, filters.assignedTo); }
  if (filters.dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }

  const result = await req.query(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN Status = 'DRAFT' THEN 1 ELSE 0 END) as draft,
      SUM(CASE WHEN Status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
      SUM(CASE WHEN Status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
      SUM(CASE WHEN Status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN Status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted,
      SUM(CASE WHEN Status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as underReview,
      SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN Status = 'REJECTED' THEN 1 ELSE 0 END) as rejected,
      SUM(CASE WHEN Status = 'REWORK' THEN 1 ELSE 0 END) as rework,
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      SUM(CASE WHEN SLAStatus = 'AT_RISK' THEN 1 ELSE 0 END) as slaAtRisk,
      SUM(CASE WHEN ReviewStatus = 'PENDING_REVIEW' THEN 1 ELSE 0 END) as pendingReview,
      ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(SUM(Achievement), 0) as totalAchievement,
      ISNULL(SUM(Target), 0) as totalTarget
    FROM PemsTaskInstances ${where}
  `);

  const r = result.recordset[0];
  return {
    total: r.total || 0,
    draft: r.draft || 0,
    assigned: r.assigned || 0,
    accepted: r.accepted || 0,
    inProgress: r.inProgress || 0,
    submitted: r.submitted || 0,
    underReview: r.underReview || 0,
    approved: r.approved || 0,
    rejected: r.rejected || 0,
    rework: r.rework || 0,
    slaBreached: r.slaBreached || 0,
    slaAtRisk: r.slaAtRisk || 0,
    pendingReview: r.pendingReview || 0,
    avgAchievementPct: Math.round((r.avgAchievementPct || 0) * 100) / 100,
    totalAchievement: r.totalAchievement || 0,
    totalTarget: r.totalTarget || 0,
    overallProgress: r.total > 0 ? Math.round(((r.approved || 0) / r.total) * 100) : 0,
  };
}

async function getSellerPerformance(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE SellerId IS NOT NULL';
  const req = pool.request();
  if (filters.dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }

  const result = await req.query(`
    SELECT TOP 20
      SellerId, SellerName,
      COUNT(*) as totalTasks,
      SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completedTasks,
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(SUM(Achievement), 0) as totalAchievement,
      ISNULL(SUM(Target), 0) as totalTarget
    FROM PemsTaskInstances ${where}
    GROUP BY SellerId, SellerName
    ORDER BY completedTasks DESC
  `);

  return result.recordset.map(r => ({
    ...r,
    avgAchievementPct: Math.round(r.avgAchievementPct * 100) / 100,
    completionRate: r.totalTasks > 0 ? Math.round((r.completedTasks / r.totalTasks) * 100) : 0,
  }));
}

// ═══════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════

async function writeAuditLog(taskInstanceId, action, fromStatus, toStatus, actorId, actorName, details) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.VarChar, genId())
    .input('taskInstanceId', sql.VarChar, taskInstanceId)
    .input('action', sql.VarChar, action)
    .input('fromStatus', sql.VarChar, fromStatus || null)
    .input('toStatus', sql.VarChar, toStatus || null)
    .input('actorId', sql.VarChar, actorId || null)
    .input('actorName', sql.NVarChar, actorName || '')
    .input('details', sql.NVarChar, details || '')
    .query(`
      INSERT INTO PemsTaskAuditLogs (Id, TaskInstanceId, Action, FromStatus, ToStatus, ActorId, ActorName, Details)
      VALUES (@id, @taskInstanceId, @action, @fromStatus, @toStatus, @actorId, @actorName, @details)
    `);
}

function safeParse(val, fallback) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function applyFilterInputs(req, filters) {
  if (filters.status) req.input('status', sql.VarChar, filters.status);
  if (filters.sellerId) req.input('sellerId', sql.VarChar, filters.sellerId);
  if (filters.assignedTo) req.input('assignedTo', sql.VarChar, filters.assignedTo);
  if (filters.reviewerId) req.input('reviewerId', sql.VarChar, filters.reviewerId);
  if (filters.priority) req.input('priority', sql.VarChar, filters.priority);
  if (filters.slaStatus) req.input('slaStatus', sql.VarChar, filters.slaStatus);
  if (filters.reviewStatus) req.input('reviewStatus', sql.VarChar, filters.reviewStatus);
  if (filters.search) req.input('search', sql.NVarChar, `%${filters.search}%`);
  if (filters.templateId) req.input('templateId', sql.VarChar, filters.templateId);
  if (filters.department) req.input('department', sql.NVarChar, filters.department);
}

// ═══════════════════════════════════════════════════════
// V2: NOTIFICATIONS
// ═══════════════════════════════════════════════════════

async function createNotification(data) {
  const pool = await getPool();
  const id = genId();
  await pool.request()
    .input('id', sql.VarChar, id)
    .input('taskInstanceId', sql.VarChar, data.taskInstanceId || null)
    .input('userId', sql.VarChar, data.userId)
    .input('type', sql.VarChar, data.type)
    .input('title', sql.NVarChar, data.title)
    .input('message', sql.NVarChar, data.message || '')
    .input('actionUrl', sql.NVarChar, data.actionUrl || null)
    .query(`INSERT INTO PemsNotifications (Id, TaskInstanceId, UserId, Type, Title, Message, ActionUrl) VALUES (@id, @taskInstanceId, @userId, @type, @title, @message, @actionUrl)`);
  return { id };
}

async function getNotifications(userId, unreadOnly = false) {
  const pool = await getPool();
  const where = unreadOnly ? 'WHERE UserId = @userId AND IsRead = 0' : 'WHERE UserId = @userId';
  const result = await pool.request().input('userId', sql.VarChar, userId)
    .query(`SELECT TOP 100 * FROM PemsNotifications ${where} ORDER BY CreatedAt DESC`);
  return result.recordset;
}

async function getUnreadCount(userId) {
  const pool = await getPool();
  const result = await pool.request().input('userId', sql.VarChar, userId)
    .query('SELECT COUNT(*) as count FROM PemsNotifications WHERE UserId = @userId AND IsRead = 0');
  return result.recordset[0].count;
}

async function markNotificationRead(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.VarChar, id)
    .query('UPDATE PemsNotifications SET IsRead = 1 WHERE Id = @id');
}

async function markAllRead(userId) {
  const pool = await getPool();
  await pool.request().input('userId', sql.VarChar, userId)
    .query('UPDATE PemsNotifications SET IsRead = 1 WHERE UserId = @userId AND IsRead = 0');
}

// ═══════════════════════════════════════════════════════
// V2: DEPARTMENT PERFORMANCE
// ═══════════════════════════════════════════════════════

async function getDepartmentPerformance(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE 1=1';
  const req = pool.request();
  if (filters.dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }

  const result = await req.query(`
    SELECT Department,
      COUNT(*) as totalTasks,
      SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completedTasks,
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(AVG(ProgressPct), 0) as avgProgress,
      SUM(CASE WHEN Status IN ('ASSIGNED', 'IN_PROGRESS', 'REWORK') THEN 1 ELSE 0 END) as activeTasks
    FROM PemsTaskInstances ${where}
    GROUP BY Department
    ORDER BY completedTasks DESC
  `);

  return result.recordset.map(r => ({
    ...r,
    avgAchievementPct: Math.round(r.avgAchievementPct * 100) / 100,
    avgProgress: Math.round(r.avgProgress * 100) / 100,
    completionRate: r.totalTasks > 0 ? Math.round((r.completedTasks / r.totalTasks) * 100) : 0,
    slaCompliance: r.totalTasks > 0 ? Math.round(((r.totalTasks - r.slaBreached) / r.totalTasks) * 100) : 100,
  }));
}

async function getBrandManagerPerformance(filters = {}) {
  const pool = await getPool();
  let where = 'WHERE AssignedTo IS NOT NULL';
  const req = pool.request();
  if (filters.dateFrom) { where += ' AND i.CreatedAt >= @dateFrom'; req.input('dateFrom', sql.DateTime2, new Date(filters.dateFrom)); }
  if (filters.dateTo) { where += ' AND i.CreatedAt <= @dateTo'; req.input('dateTo', sql.DateTime2, new Date(filters.dateTo)); }
  if (filters.department) { where += ' AND i.Department = @department'; req.input('department', sql.NVarChar, filters.department); }

  const result = await req.query(`
    SELECT TOP 20 i.AssignedTo, i.AssigneeName,
      COUNT(*) as totalTasks,
      SUM(CASE WHEN i.Status = 'APPROVED' THEN 1 ELSE 0 END) as completedTasks,
      SUM(CASE WHEN i.SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      ISNULL(AVG(CASE WHEN i.Target > 0 THEN (i.Achievement / i.Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(AVG(i.ProgressPct), 0) as avgProgress
    FROM PemsTaskInstances i ${where}
    GROUP BY i.AssignedTo, i.AssigneeName
    ORDER BY completedTasks DESC
  `);

  return result.recordset.map(r => ({
    ...r,
    avgAchievementPct: Math.round(r.avgAchievementPct * 100) / 100,
    avgProgress: Math.round(r.avgProgress * 100) / 100,
    completionRate: r.totalTasks > 0 ? Math.round((r.completedTasks / r.totalTasks) * 100) : 0,
  }));
}

async function getReviewerPerformance(filters = {}) {
  const pool = await getPool();
  const result = await pool.request()
    .query(`
      SELECT ReviewerId, ReviewerName,
        COUNT(*) as totalReviews,
        SUM(CASE WHEN Decision = 'APPROVE' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN Decision = 'REJECT' THEN 1 ELSE 0 END) as rejected,
        ISNULL(AVG(QualityScore), 0) as avgQualityScore,
        ISNULL(AVG(ReviewDurationMinutes), 0) as avgReviewTime
      FROM PemsTaskReviews
      GROUP BY ReviewerId, ReviewerName
      ORDER BY totalReviews DESC
    `);
  return result.recordset.map(r => ({
    ...r,
    avgQualityScore: Math.round(r.avgQualityScore * 100) / 100,
  }));
}

// ═══════════════════════════════════════════════════════
// V2: ESCALATION CHECK
// ═══════════════════════════════════════════════════════

async function checkEscalations() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, AssignedTo, AssigneeName, ReviewerId, ReviewerName, DueDate, SLAHours, Status, SLAStatus, Title
    FROM PemsTaskInstances
    WHERE Status NOT IN ('APPROVED', 'CANCELLED')
    AND DueDate IS NOT NULL
  `);

  let escalated = 0;
  for (const task of result.recordset) {
    const { getEscalationLevel } = require('./workflowEngine');
    const level = getEscalationLevel(task.DueDate, task.SLAHours);
    if (!level) continue;

    const newSlaStatus = calculateSLAStatus(task.DueDate, task.SLAHours);
    if (newSlaStatus !== task.SLAStatus) {
      await pool.request().input('id', sql.VarChar, task.Id).input('sla', sql.VarChar, newSlaStatus)
        .query('UPDATE PemsTaskInstances SET SLAStatus = @sla WHERE Id = @id');
    }

    if (level === 'assignee' && task.AssignedTo) {
      await createNotification({ taskInstanceId: task.Id, userId: task.AssignedTo, type: 'SLA_WARNING', title: `SLA Warning: ${task.Title}`, message: `Task due in less than 24 hours`, actionUrl: `/pems/tasks?id=${task.Id}` });
    }
    if (level === 'reviewer' && task.ReviewerId) {
      await createNotification({ taskInstanceId: task.Id, userId: task.ReviewerId, type: 'SLA_WARNING', title: `SLA Urgent: ${task.Title}`, message: `Task due in less than 12 hours, review needed`, actionUrl: `/pems/tasks?id=${task.Id}` });
    }
    if (level === 'manager' || level === 'admin') {
      await createNotification({ taskInstanceId: task.Id, userId: task.AssignedTo, type: 'SLA_BREACH', title: `SLA BREACHED: ${task.Title}`, message: `Task has breached its SLA deadline`, actionUrl: `/pems/tasks?id=${task.Id}` });
    }
    escalated++;
  }
  return { escalated };
}

// ═══════════════════════════════════════════════════════
// V2: ENHANCED DASHBOARD
// ═══════════════════════════════════════════════════════

async function getRiskPanel() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreaches,
      SUM(CASE WHEN Status IN ('ASSIGNED', 'IN_PROGRESS', 'REWORK') AND DueDate < dbo.GetEnvDate() THEN 1 ELSE 0 END) as overdueTasks,
      SUM(CASE WHEN Status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as pendingReviews,
      SUM(CASE WHEN ReviewStatus = 'REJECTED' THEN 1 ELSE 0 END) as rejectedTasks
    FROM PemsTaskInstances
    WHERE Status NOT IN ('CANCELLED')
  `);
  return result.recordset[0] || {};
}

async function getTopPerformers() {
  const pool = await getPool();
  const [sellers, managers] = await Promise.all([
    pool.request().query(`
      SELECT TOP 5 SellerId, SellerName,
        COUNT(*) as tasks, SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completed,
        ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievement
      FROM PemsTaskInstances WHERE SellerId IS NOT NULL
      GROUP BY SellerId, SellerName ORDER BY completed DESC
    `),
    pool.request().query(`
      SELECT TOP 5 AssignedTo as UserId, AssigneeName as UserName,
        COUNT(*) as tasks, SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completed,
        ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievement
      FROM PemsTaskInstances WHERE AssignedTo IS NOT NULL
      GROUP BY AssignedTo, AssigneeName ORDER BY completed DESC
    `),
  ]);
  return {
    topSellers: sellers.recordset.map(r => ({ ...r, avgAchievement: Math.round(r.avgAchievement * 100) / 100 })),
    topManagers: managers.recordset.map(r => ({ ...r, avgAchievement: Math.round(r.avgAchievement * 100) / 100 })),
  };
}

// ═══════════════════════════════════════════════════════
// V2: DYNAMIC DATA SOURCES
// ═══════════════════════════════════════════════════════

async function getSellersForPEMS(marketplace) {
  const pool = await getPool();
  let where = 'WHERE IsActive = 1';
  const req = pool.request();
  if (marketplace && marketplace !== 'all') { where += ' AND Marketplace = @mp'; req.input('mp', sql.VarChar, marketplace); }
  const result = await req.query(`SELECT Id, Name, Marketplace FROM Sellers ${where} ORDER BY Name`);
  return result.recordset;
}

async function getBrandManagersForPEMS() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.Id, u.FirstName, u.LastName, u.Email, r.Name as RoleName
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.Id
    WHERE r.Name IN ('brand_manager', 'admin', 'super_admin', 'developer')
    ORDER BY u.FirstName
  `);
  return result.recordset.map(u => ({
    ...u,
    FullName: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email,
  }));
}

async function getReviewersForPEMS() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT u.Id, u.FirstName, u.LastName, u.Email, r.Name as RoleName
    FROM Users u
    LEFT JOIN Roles r ON u.RoleId = r.Id
    WHERE r.Name IN ('reviewer', 'operational_manager', 'admin', 'super_admin')
    ORDER BY u.FirstName
  `);
  return result.recordset.map(u => ({
    ...u,
    FullName: `${u.FirstName || ''} ${u.LastName || ''}`.trim() || u.Email,
  }));
}

// ═══════════════════════════════════════════════════════
// V3: WEIGHTED PROGRESS
// ═══════════════════════════════════════════════════════

async function calculateWeightedProgress(taskInstanceId) {
  const pool = await getPool();
  const result = await pool.request().input('instId', sql.VarChar, taskInstanceId).query(`
    SELECT WeightagePct, IsCompleted, SubTaskCode, Title
    FROM PemsSubTasks WHERE TaskInstanceId = @instId ORDER BY SortOrder
  `);
  const subTasks = result.recordset;
  if (subTasks.length === 0) return 0;
  
  const totalWeight = subTasks.reduce((s, st) => s + (st.WeightagePct || 0), 0);
  if (totalWeight <= 0) {
    // Fallback to count-based if no weights
    const completed = subTasks.filter(st => st.IsCompleted).length;
    return Math.round((completed / subTasks.length) * 100);
  }
  
  const completedWeight = subTasks
    .filter(st => st.IsCompleted)
    .reduce((s, st) => s + (st.WeightagePct || 0), 0);
  
  return Math.round((completedWeight / totalWeight) * 100);
}

// ═══════════════════════════════════════════════════════
// V3: ASSIGNMENT RULES
// ═══════════════════════════════════════════════════════

async function upsertAssignmentRules(templateId, data) {
  const pool = await getPool();
  const existing = await pool.request().input('tid', sql.VarChar, templateId)
    .query('SELECT Id FROM PemsAssignmentRules WHERE TemplateId = @tid');
  
  if (existing.recordset.length > 0) {
    const sets = [];
    const req = pool.request().input('tid', sql.VarChar, templateId);
    const fields = {
      AssignmentMode: data.assignmentMode,
      AutoAssignStrategy: data.autoAssignStrategy,
      ReviewerId: data.reviewerId,
      BackupReviewerId: data.backupReviewerId,
      EscalationHours: data.escalationHours,
      ApprovalLevel: data.approvalLevel,
      QualityScoreRequired: data.qualityScoreRequired,
    };
    Object.entries(fields).forEach(([k, v]) => {
      if (v !== undefined) { sets.push(`${k} = @${k}`); req.input(k, sql.NVarChar, v); }
    });
    if (sets.length > 0) {
      await req.query(`UPDATE PemsAssignmentRules SET ${sets.join(', ')} WHERE TemplateId = @tid`);
    }
  } else {
    const id = genId();
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('tid', sql.VarChar, templateId)
      .input('mode', sql.NVarChar, data.assignmentMode || 'manual')
      .input('strategy', sql.NVarChar, data.autoAssignStrategy || 'lowest_workload')
      .input('reviewer', sql.VarChar, data.reviewerId || null)
      .input('backup', sql.VarChar, data.backupReviewerId || null)
      .input('escHrs', sql.Int, data.escalationHours || 24)
      .input('approval', sql.NVarChar, data.approvalLevel || 'single')
      .input('qsReq', sql.Bit, data.qualityScoreRequired ? 1 : 0)
      .query(`INSERT INTO PemsAssignmentRules (Id, TemplateId, AssignmentMode, AutoAssignStrategy, ReviewerId, BackupReviewerId, EscalationHours, ApprovalLevel, QualityScoreRequired)
        VALUES (@id, @tid, @mode, @strategy, @reviewer, @backup, @escHrs, @approval, @qsReq)`);
  }
}

async function getAssignmentRules(templateId) {
  const pool = await getPool();
  const result = await pool.request().input('tid', sql.VarChar, templateId)
    .query('SELECT * FROM PemsAssignmentRules WHERE TemplateId = @tid');
  return result.recordset[0] || null;
}

// ═══════════════════════════════════════════════════════
// V3: TEMPLATE DETAIL ANALYTICS
// ═══════════════════════════════════════════════════════

async function getTemplateAnalytics(templateId) {
  const pool = await getPool();
  const r = await pool.request().input('tid', sql.VarChar, templateId).query(`
    SELECT 
      COUNT(*) as totalInstances,
      SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completedInstances,
      SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
      ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
      ISNULL(AVG(WeightedProgressPct), 0) as avgProgress,
      ISNULL(AVG(ProgressPct), 0) as avgCountProgress
    FROM PemsTaskInstances WHERE TemplateId = @tid
  `);
  const d = r.recordset[0] || {};
  return {
    totalInstances: d.totalInstances || 0,
    completedInstances: d.completedInstances || 0,
    completionRate: d.totalInstances > 0 ? Math.round((d.completedInstances / d.totalInstances) * 100) : 0,
    slaCompliance: d.totalInstances > 0 ? Math.round(((d.totalInstances - (d.slaBreached || 0)) / d.totalInstances) * 100) : 100,
    avgAchievementPct: Math.round((d.avgAchievementPct || 0) * 100) / 100,
    avgProgress: Math.round((d.avgProgress || d.avgCountProgress || 0) * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════
// V3: RECALCULATE WEIGHTED PROGRESS
// ═══════════════════════════════════════════════════════

async function recalculateAllWeightedProgress() {
  const pool = await getPool();
  const instances = await pool.request()
    .query("SELECT Id FROM PemsTaskInstances WHERE Status NOT IN ('APPROVED','CANCELLED')");
  
  let updated = 0;
  for (const inst of instances.recordset) {
    const wp = await calculateWeightedProgress(inst.Id);
    await pool.request()
      .input('id', sql.VarChar, inst.Id)
      .input('wp', sql.Decimal(5, 2), wp)
      .query('UPDATE PemsTaskInstances SET WeightedProgressPct = @wp WHERE Id = @id');
    updated++;
  }
  return { updated };
}

module.exports = {
  createTemplate, getTemplates, getTemplateById, updateTemplate, deleteTemplate,
  createInstance, getInstances, getInstanceById,
  transitionStatus,
  completeSubTask, completeActivity,
  uploadEvidence,
  submitReview,
  updateAchievement, refreshSLAStatuses,
  getDashboardKPIs, getSellerPerformance,
  // V2 additions
  createNotification, getNotifications, getUnreadCount, markNotificationRead, markAllRead,
  getDepartmentPerformance, getBrandManagerPerformance, getReviewerPerformance,
  checkEscalations, getRiskPanel, getTopPerformers,
  getSellersForPEMS, getBrandManagersForPEMS, getReviewersForPEMS,
  // V3 additions
  calculateWeightedProgress, upsertAssignmentRules, getAssignmentRules,
  getTemplateAnalytics, recalculateAllWeightedProgress,
};
