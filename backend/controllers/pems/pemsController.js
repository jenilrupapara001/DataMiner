const pemsService = require('../../services/pems/pemsService');
const { WORKFLOW_STATUSES, FREQUENCIES, CATEGORIES, PRIORITIES } = require('../../services/pems/workflowEngine');

// ═══════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════

exports.createTemplate = async (req, res) => {
  try {
    const result = await pemsService.createTemplate({ ...req.body, createdBy: req.user?.id });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('createTemplate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTemplates = async (req, res) => {
  try {
    const result = await pemsService.getTemplates(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('getTemplates error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTemplateById = async (req, res) => {
  try {
    const template = await pemsService.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: template });
  } catch (err) {
    console.error('getTemplateById error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    await pemsService.updateTemplate(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('updateTemplate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    await pemsService.deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteTemplate error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getFilterOptions = async (req, res) => {
  res.json({
    success: true,
    data: {
      frequencies: Object.values(FREQUENCIES),
      categories: Object.values(CATEGORIES),
      priorities: Object.values(PRIORITIES),
      statuses: Object.values(WORKFLOW_STATUSES),
    }
  });
};

// ═══════════════════════════════════════════════════════
// TASK INSTANCES
// ═══════════════════════════════════════════════════════

exports.createInstance = async (req, res) => {
  try {
    const result = await pemsService.createInstance(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('createInstance error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getInstances = async (req, res) => {
  try {
    const result = await pemsService.getInstances(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('getInstances error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getInstanceById = async (req, res) => {
  try {
    const instance = await pemsService.getInstanceById(req.params.id);
    if (!instance) return res.status(404).json({ success: false, error: 'Instance not found' });
    res.json({ success: true, data: instance });
  } catch (err) {
    console.error('getInstanceById error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.transitionStatus = async (req, res) => {
  try {
    const { toStatus, details } = req.body;
    const result = await pemsService.transitionStatus(
      req.params.id, toStatus,
      req.user?.id, req.user?.name || req.user?.email, req.user?.role,
      details
    );
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('transitionStatus error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.updateAchievement = async (req, res) => {
  try {
    const { achievement } = req.body;
    const result = await pemsService.updateAchievement(req.params.id, achievement);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('updateAchievement error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// SUB TASKS & ACTIVITIES
// ═══════════════════════════════════════════════════════

exports.completeSubTask = async (req, res) => {
  try {
    await pemsService.completeSubTask(req.params.subTaskId, req.user?.id, req.user?.name || req.user?.email);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

exports.completeActivity = async (req, res) => {
  try {
    await pemsService.completeActivity(req.params.activityId, req.user?.id, req.user?.name || req.user?.email);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// EVIDENCE
// ═══════════════════════════════════════════════════════

exports.uploadEvidence = async (req, res) => {
  try {
    const result = await pemsService.uploadEvidence({
      ...req.body,
      uploadedBy: req.user?.id,
      uploadedByName: req.user?.name || req.user?.email,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// REVIEWS
// ═══════════════════════════════════════════════════════

exports.submitReview = async (req, res) => {
  try {
    const result = await pemsService.submitReview({
      ...req.body,
      reviewerId: req.user?.id,
      reviewerName: req.user?.name || req.user?.email,
    });

    // Auto-transition based on decision
    if (req.body.decision === 'APPROVE') {
      await pemsService.transitionStatus(req.body.taskInstanceId, 'APPROVED', req.user?.id, req.user?.name, req.user?.role, req.body.feedback);
    } else {
      await pemsService.transitionStatus(req.body.taskInstanceId, 'REJECTED', req.user?.id, req.user?.name, req.user?.role, req.body.feedback);
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

exports.getDashboardKPIs = async (req, res) => {
  try {
    const kpis = await pemsService.getDashboardKPIs(req.query);
    res.json({ success: true, data: kpis });
  } catch (err) {
    console.error('getDashboardKPIs error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getSellerPerformance = async (req, res) => {
  try {
    const perf = await pemsService.getSellerPerformance(req.query);
    res.json({ success: true, data: perf });
  } catch (err) {
    console.error('getSellerPerformance error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.refreshSLA = async (req, res) => {
  try {
    const result = await pemsService.refreshSLAStatuses();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// V2: NOTIFICATIONS
// ═══════════════════════════════════════════════════════

exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.query.userId;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await pemsService.getNotifications(userId, unreadOnly);
    const unreadCount = await pemsService.getUnreadCount(userId);
    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await pemsService.markNotificationRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    await pemsService.markAllRead(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// V2: ANALYTICS & DEPARTMENTS
// ═══════════════════════════════════════════════════════

exports.getDepartmentPerformance = async (req, res) => {
  try {
    const perf = await pemsService.getDepartmentPerformance(req.query);
    res.json({ success: true, data: perf });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBrandManagerPerformance = async (req, res) => {
  try {
    const perf = await pemsService.getBrandManagerPerformance(req.query);
    res.json({ success: true, data: perf });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getReviewerPerformance = async (req, res) => {
  try {
    const perf = await pemsService.getReviewerPerformance(req.query);
    res.json({ success: true, data: perf });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getRiskPanel = async (req, res) => {
  try {
    const risk = await pemsService.getRiskPanel();
    res.json({ success: true, data: risk });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getTopPerformers = async (req, res) => {
  try {
    const performers = await pemsService.getTopPerformers();
    res.json({ success: true, data: performers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.checkEscalations = async (req, res) => {
  try {
    const result = await pemsService.checkEscalations();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// V2: DYNAMIC DATA SOURCES
// ═══════════════════════════════════════════════════════

exports.getSellers = async (req, res) => {
  try {
    const sellers = await pemsService.getSellersForPEMS(req.query.marketplace);
    res.json({ success: true, data: sellers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getBrandManagers = async (req, res) => {
  try {
    const managers = await pemsService.getBrandManagersForPEMS();
    res.json({ success: true, data: managers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getReviewers = async (req, res) => {
  try {
    const reviewers = await pemsService.getReviewersForPEMS();
    res.json({ success: true, data: reviewers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getFilterOptions = async (req, res) => {
  res.json({
    success: true,
    data: {
      frequencies: Object.values(require('../../services/pems/workflowEngine').FREQUENCIES),
      categories: Object.values(require('../../services/pems/workflowEngine').CATEGORIES),
      priorities: Object.values(require('../../services/pems/workflowEngine').PRIORITIES),
      statuses: Object.values(require('../../services/pems/workflowEngine').WORKFLOW_STATUSES),
      departments: Object.values(require('../../services/pems/workflowEngine').DEPARTMENTS),
      targetTypes: Object.values(require('../../services/pems/workflowEngine').TARGET_TYPES),
      complexityLevels: Object.values(require('../../services/pems/workflowEngine').COMPLEXITY_LEVELS),
      approvalLevels: Object.values(require('../../services/pems/workflowEngine').APPROVAL_LEVELS),
      autoAssignStrategies: Object.values(require('../../services/pems/workflowEngine').AUTO_ASSIGN_STRATEGIES),
    }
  });
};

// ═══════════════════════════════════════════════════════
// V3: TEMPLATE DETAIL ANALYTICS
// ═══════════════════════════════════════════════════════

exports.getTemplateDetail = async (req, res) => {
  try {
    const template = await pemsService.getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    const analytics = await pemsService.getTemplateAnalytics(req.params.id);
    const rules = await pemsService.getAssignmentRules(req.params.id);
    res.json({ success: true, data: { ...template, analytics, assignmentRules: rules } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.upsertAssignmentRules = async (req, res) => {
  try {
    await pemsService.upsertAssignmentRules(req.params.templateId, req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.recalculateProgress = async (req, res) => {
  try {
    const result = await pemsService.recalculateAllWeightedProgress();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
