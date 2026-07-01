/**
 * PEMS V2 Dashboard Controller — Enterprise Command Center
 * 3 consolidated endpoints for maximum performance
 */
const { sql, getPool } = require('../../database/db');

// ═══════════════════════════════════════════════════════
// ENDPOINT 1: GET /api/pems/dashboard/summary
// All KPIs, pipeline, departments, top performers, risk, status distribution
// ═══════════════════════════════════════════════════════

exports.getSummary = async (req, res) => {
  try {
    const pool = await getPool();
    const { department, sellerId, assignedTo, status, priority, dateFrom, dateTo } = req.query;

    let where = 'WHERE 1=1';
    const req_ = pool.request();

    if (department) { where += ' AND Department = @department'; req_.input('department', sql.NVarChar, department); }
    if (sellerId) { where += ' AND SellerId = @sellerId'; req_.input('sellerId', sql.VarChar, sellerId); }
    if (assignedTo) { where += ' AND AssignedTo = @assignedTo'; req_.input('assignedTo', sql.VarChar, assignedTo); }
    if (status) { where += ' AND Status = @status'; req_.input('status', sql.VarChar, status); }
    if (priority) { where += ' AND Priority = @priority'; req_.input('priority', sql.VarChar, priority); }
    if (dateFrom) { where += ' AND CreatedAt >= @dateFrom'; req_.input('dateFrom', sql.DateTime2, new Date(dateFrom)); }
    if (dateTo) { where += ' AND CreatedAt <= @dateTo'; req_.input('dateTo', sql.DateTime2, new Date(dateTo)); }

    // Main aggregate query
    const agg = await req_.query(`
      SELECT
        -- KPI 1: Total
        COUNT(*) as totalTasks,
        -- KPI 2: Active (Assigned + Accepted + In Progress)
        SUM(CASE WHEN Status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS','REWORK') THEN 1 ELSE 0 END) as activeTasks,
        -- KPI 3: Pending Reviews
        SUM(CASE WHEN Status IN ('SUBMITTED','UNDER_REVIEW') THEN 1 ELSE 0 END) as pendingReviews,
        -- KPI 4: Approved
        SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as approvedTasks,
        -- KPI 5: Achievement %
        ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
        -- KPI 6: Completion Rate
        CASE WHEN COUNT(*) > 0 THEN CAST(SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,1)) ELSE 0 END as completionRate,
        -- KPI 7: SLA Compliance
        CASE WHEN COUNT(*) > 0 THEN CAST(SUM(CASE WHEN SLAStatus = 'WITHIN_SLA' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS DECIMAL(5,1)) ELSE 100 END as slaCompliance,
        -- KPI 8: Overdue
        SUM(CASE WHEN DueDate < dbo.GetEnvDate() AND Status NOT IN ('APPROVED','CANCELLED') THEN 1 ELSE 0 END) as overdueTasks,
        -- Risk
        SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
        SUM(CASE WHEN SLAStatus = 'AT_RISK' THEN 1 ELSE 0 END) as slaAtRisk,
        SUM(CASE WHEN Status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as underReview,
        SUM(CASE WHEN Status = 'REJECTED' THEN 1 ELSE 0 END) as rejectedTasks,
        SUM(CASE WHEN Status = 'REWORK' THEN 1 ELSE 0 END) as reworkTasks,
        SUM(CASE WHEN ReviewStatus = 'PENDING_REVIEW' THEN 1 ELSE 0 END) as pendingReviewCount,
        -- Pipeline
        SUM(CASE WHEN Status = 'DRAFT' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN Status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN Status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN Status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN Status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN Status = 'UNDER_REVIEW' THEN 1 ELSE 0 END) as underReviewPipeline,
        SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as approvedPipeline,
        -- Status distribution
        SUM(CASE WHEN Status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        -- Totals
        ISNULL(SUM(Target), 0) as totalTarget,
        ISNULL(SUM(Achievement), 0) as totalAchievement
      FROM PemsTaskInstances ${where}
    `);

    const kpi = agg.recordset[0];

    // Department performance (single query)
    const deptResult = await pool.request()
      .input('dateFrom', sql.DateTime2, dateFrom ? new Date(dateFrom) : new Date('2000-01-01'))
      .input('dateTo', sql.DateTime2, dateTo ? new Date(dateTo) : new Date('2100-01-01'))
      .query(`
        SELECT Department,
          COUNT(*) as totalTasks,
          SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completedTasks,
          SUM(CASE WHEN Status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS','REWORK') THEN 1 ELSE 0 END) as openTasks,
          SUM(CASE WHEN SLAStatus = 'BREACHED' THEN 1 ELSE 0 END) as slaBreached,
          SUM(CASE WHEN DueDate < dbo.GetEnvDate() AND Status NOT IN ('APPROVED','CANCELLED') THEN 1 ELSE 0 END) as overdueTasks,
          SUM(CASE WHEN Status IN ('SUBMITTED','UNDER_REVIEW') THEN 1 ELSE 0 END) as pendingReview,
          SUM(CASE WHEN Status = 'REWORK' THEN 1 ELSE 0 END) as rework,
          ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievementPct,
          ISNULL(AVG(ProgressPct), 0) as avgProgress
        FROM PemsTaskInstances
        WHERE CreatedAt >= @dateFrom AND CreatedAt <= @dateTo
        GROUP BY Department
        ORDER BY completedTasks DESC
      `);

    const departments = deptResult.recordset.map(d => ({
      ...d,
      avgAchievementPct: Math.round(d.avgAchievementPct * 100) / 100,
      avgProgress: Math.round(d.avgProgress * 100) / 100,
      completionRate: d.totalTasks > 0 ? Math.round((d.completedTasks / d.totalTasks) * 100) : 0,
      slaCompliance: d.totalTasks > 0 ? Math.round(((d.totalTasks - d.slaBreached) / d.totalTasks) * 100) : 100,
    }));

    // Top performers (single query)
    const [sellerPerf, managerPerf] = await Promise.all([
      pool.request().query(`
        SELECT TOP 10 SellerId, SellerName,
          COUNT(*) as tasks, SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completed,
          ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievement,
          SUM(CASE WHEN SLAStatus = 'WITHIN_SLA' THEN 1 ELSE 0 END) as withinSla,
          COUNT(*) as totalSellerTasks
        FROM PemsTaskInstances WHERE SellerId IS NOT NULL
        GROUP BY SellerId, SellerName ORDER BY completed DESC
      `),
      pool.request().query(`
        SELECT TOP 10 AssignedTo as UserId, AssigneeName as UserName,
          COUNT(*) as tasks, SUM(CASE WHEN Status = 'APPROVED' THEN 1 ELSE 0 END) as completed,
          ISNULL(AVG(CASE WHEN Target > 0 THEN (Achievement / Target) * 100 END), 0) as avgAchievement,
          SUM(CASE WHEN SLAStatus = 'WITHIN_SLA' THEN 1 ELSE 0 END) as withinSla,
          COUNT(*) as totalMgrTasks
        FROM PemsTaskInstances WHERE AssignedTo IS NOT NULL
        GROUP BY AssignedTo, AssigneeName ORDER BY completed DESC
      `),
    ]);

    const topSellers = sellerPerf.recordset.map((s, i) => ({
      ...s, rank: i + 1,
      avgAchievement: Math.round(s.avgAchievement * 100) / 100,
      slaCompliance: s.totalSellerTasks > 0 ? Math.round((s.withinSla / s.totalSellerTasks) * 100) : 100,
    }));
    const topManagers = managerPerf.recordset.map((m, i) => ({
      ...m, rank: i + 1,
      avgAchievement: Math.round(m.avgAchievement * 100) / 100,
      slaCompliance: m.totalMgrTasks > 0 ? Math.round((m.withinSla / m.totalMgrTasks) * 100) : 100,
    }));

    // Workload distribution
    const workload = await pool.request().query(`
      SELECT Department, AssignedTo, AssigneeName,
        SUM(CASE WHEN Status IN ('ASSIGNED','ACCEPTED') THEN 1 ELSE 0 END) as assigned,
        SUM(CASE WHEN Status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN Status IN ('SUBMITTED','UNDER_REVIEW') THEN 1 ELSE 0 END) as review,
        SUM(CASE WHEN Status = 'REWORK' THEN 1 ELSE 0 END) as rework,
        COUNT(*) as total
      FROM PemsTaskInstances
      WHERE Status NOT IN ('APPROVED','CANCELLED') AND AssignedTo IS NOT NULL
      GROUP BY Department, AssignedTo, AssigneeName
      ORDER BY total DESC
    `);

    // Pending reviews > 48h
    const staleReviews = await pool.request().query(`
      SELECT COUNT(*) as count FROM PemsTaskInstances
      WHERE Status IN ('SUBMITTED','UNDER_REVIEW')
      AND SubmittedAt IS NOT NULL
      AND DATEDIFF(HOUR, SubmittedAt, dbo.GetEnvDate()) > 48
    `);

    // High priority delays
    const highPriorityDelays = await pool.request().query(`
      SELECT COUNT(*) as count FROM PemsTaskInstances
      WHERE Priority IN ('CRITICAL','HIGH')
      AND Status NOT IN ('APPROVED','CANCELLED')
      AND DueDate < dbo.GetEnvDate()
    `);

    res.json({
      success: true,
      data: {
        kpi: {
          total: kpi.totalTasks,
          active: kpi.activeTasks,
          pendingReview: kpi.pendingReviews,
          approved: kpi.approvedTasks,
          avgAchievementPct: Math.round(kpi.avgAchievementPct * 100) / 100,
          completionRate: kpi.completionRate,
          slaCompliance: kpi.slaCompliance,
          overdue: kpi.overdueTasks,
          totalTarget: kpi.totalTarget,
          totalAchievement: kpi.totalAchievement,
        },
        pipeline: {
          draft: kpi.draft,
          assigned: kpi.assigned,
          accepted: kpi.accepted,
          inProgress: kpi.inProgress,
          submitted: kpi.submitted,
          underReview: kpi.underReviewPipeline,
          approved: kpi.approvedPipeline,
        },
        statusDistribution: {
          draft: kpi.draft,
          assigned: kpi.assigned,
          accepted: kpi.accepted,
          inProgress: kpi.inProgress,
          submitted: kpi.submitted,
          underReview: kpi.underReviewPipeline,
          approved: kpi.approvedPipeline,
          rejected: kpi.rejectedTasks,
          rework: kpi.reworkTasks,
          cancelled: kpi.cancelled,
        },
        departments,
        topPerformers: { topSellers, topManagers },
        workload: workload.recordset,
        risk: {
          slaBreached: kpi.slaBreached,
          slaAtRisk: kpi.slaAtRisk,
          overdue: kpi.overdueTasks,
          pendingReviews: kpi.pendingReviewCount,
          rejected: kpi.rejectedTasks,
          rework: kpi.reworkTasks,
          staleReviews: staleReviews.recordset[0]?.count || 0,
          highPriorityDelays: highPriorityDelays.recordset[0]?.count || 0,
        },
      },
    });
  } catch (err) {
    console.error('getSummary error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// ENDPOINT 2: GET /api/pems/dashboard/live-tasks
// Latest 15 active tasks for live queue
// ═══════════════════════════════════════════════════════

exports.getLiveTasks = async (req, res) => {
  try {
    const pool = await getPool();
    const { department, sellerId, assignedTo, status, priority } = req.query;

    let where = "WHERE i.Status NOT IN ('APPROVED','CANCELLED')";
    const req_ = pool.request();

    if (department) { where += ' AND i.Department = @department'; req_.input('department', sql.NVarChar, department); }
    if (sellerId) { where += ' AND i.SellerId = @sellerId'; req_.input('sellerId', sql.VarChar, sellerId); }
    if (assignedTo) { where += ' AND i.AssignedTo = @assignedTo'; req_.input('assignedTo', sql.VarChar, assignedTo); }
    if (status) { where += ' AND i.Status = @status'; req_.input('status', sql.VarChar, status); }
    if (priority) { where += ' AND i.Priority = @priority'; req_.input('priority', sql.VarChar, priority); }

    const result = await req_.query(`
      SELECT TOP 15 i.Id, i.InstanceCode, i.Title, i.Department, i.SellerName, i.AssigneeName,
        i.Status, i.ReviewStatus, i.Priority, i.Frequency,
        i.Target, i.Achievement, i.AchievementPct, i.Variance, i.ProgressPct,
        i.SLAStatus, i.SLAHours, i.DueDate, i.CreatedAt,
        i.SubTaskCount, i.ActivityCount, i.CompletedSubTasks,
        i.SubmissionRemarks, i.ReviewRemarks
      FROM PemsTaskInstances i
      ${where}
      ORDER BY
        CASE i.Priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
        i.DueDate ASC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('getLiveTasks error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// ═══════════════════════════════════════════════════════
// ENDPOINT 3: GET /api/pems/dashboard/activity-feed
// Latest 20 audit log entries
// ═══════════════════════════════════════════════════════

exports.getActivityFeed = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 20
        a.Id, a.TaskInstanceId, a.Action, a.ActorName, a.Details,
        a.CreatedAt, i.InstanceCode, i.Title, i.Department
      FROM PemsTaskAuditLogs a
      LEFT JOIN PemsTaskInstances i ON a.TaskInstanceId = i.Id
      ORDER BY a.CreatedAt DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    console.error('getActivityFeed error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
