const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const ctrl = require('../../controllers/pems/pemsController');

// ── Templates ──
router.get('/templates', auth, ctrl.getTemplates);
router.get('/templates/filters', auth, ctrl.getFilterOptions);
router.get('/templates/:id', auth, ctrl.getTemplateById);
router.post('/templates', auth, ctrl.createTemplate);
router.put('/templates/:id', auth, ctrl.updateTemplate);
router.delete('/templates/:id', auth, ctrl.deleteTemplate);

// ── Task Instances ──
router.get('/instances', auth, ctrl.getInstances);
router.get('/instances/:id', auth, ctrl.getInstanceById);
router.post('/instances', auth, ctrl.createInstance);
router.post('/instances/:id/transition', auth, ctrl.transitionStatus);
router.put('/instances/:id/achievement', auth, ctrl.updateAchievement);

// ── Sub Tasks & Activities ──
router.post('/subtasks/:subTaskId/complete', auth, ctrl.completeSubTask);
router.post('/activities/:activityId/complete', auth, ctrl.completeActivity);

// ── Evidence ──
router.post('/evidence', auth, ctrl.uploadEvidence);

// ── Reviews ──
router.post('/reviews', auth, ctrl.submitReview);

// ── Dashboard ──
router.get('/dashboard/kpis', auth, ctrl.getDashboardKPIs);
router.get('/dashboard/seller-performance', auth, ctrl.getSellerPerformance);
router.get('/dashboard/department-performance', auth, ctrl.getDepartmentPerformance);
router.get('/dashboard/brand-manager-performance', auth, ctrl.getBrandManagerPerformance);
router.get('/dashboard/reviewer-performance', auth, ctrl.getReviewerPerformance);
router.get('/dashboard/risk-panel', auth, ctrl.getRiskPanel);
router.get('/dashboard/top-performers', auth, ctrl.getTopPerformers);
router.post('/dashboard/refresh-sla', auth, ctrl.refreshSLA);
router.post('/dashboard/check-escalations', auth, ctrl.checkEscalations);

// ── Enterprise Dashboard (3 consolidated endpoints) ──
const dc = require('../../controllers/pems/dashboardController');
router.get('/dashboard/summary', auth, dc.getSummary);
router.get('/dashboard/live-tasks', auth, dc.getLiveTasks);
router.get('/dashboard/activity-feed', auth, dc.getActivityFeed);

// ── V3: Template Detail + Assignment Rules ──
router.get('/templates/:id/detail', auth, ctrl.getTemplateDetail);
router.put('/templates/:templateId/assignment-rules', auth, ctrl.upsertAssignmentRules);
router.post('/recalculate-progress', auth, ctrl.recalculateProgress);

// ── Notifications ──
router.get('/notifications', auth, ctrl.getNotifications);
router.post('/notifications/:id/read', auth, ctrl.markNotificationRead);
router.post('/notifications/read-all', auth, ctrl.markAllNotificationsRead);

// ── Merged Notifications (for main Header integration) ──
const { getMergedNotifications } = require('../../services/pems/notificationMergeService');
router.get('/notifications/merged', auth, async (req, res) => {
  try {
    const userId = req.user?.Id || req.user?.id;
    if (!userId) return res.json({ success: true, data: [], unreadCount: 0 });
    const pems = await getMergedNotifications(userId, 20);
    res.json({ success: true, data: pems, unreadCount: pems.filter(n => !n.IsRead).length });
  } catch (err) {
    res.json({ success: true, data: [], unreadCount: 0 });
  }
});

// ── Dynamic Data Sources ──
router.get('/sellers', auth, ctrl.getSellers);
router.get('/brand-managers', auth, ctrl.getBrandManagers);
router.get('/reviewers', auth, ctrl.getReviewers);

// ── Demo Seed ──
router.post('/seed-demo', auth, async (req, res) => {
  try {
    const { seedDemo } = require('../../services/pems/seedDemo');
    const result = await seedDemo();
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
