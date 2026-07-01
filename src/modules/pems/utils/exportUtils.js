/**
 * PEMS Export Utilities
 * Export tasks, analytics, and reports to Excel
 */
import * as XLSX from 'xlsx';

export function exportTasksToExcel(tasks, filename = 'PEMS_Tasks') {
  const data = tasks.map((t, idx) => ({
    '#': idx + 1,
    'Task Code': t.InstanceCode,
    'Task Name': t.Title || t.TemplateName || '',
    'Seller': t.SellerName || '',
    'Department': t.Department || '',
    'Brand Manager': t.AssigneeName || '',
    'Reviewer': t.ReviewerName || '',
    'Priority': t.Priority || '',
    'Status': t.Status || '',
    'Review Status': t.ReviewStatus || '',
    'Frequency': t.Frequency || '',
    'Target': t.Target || 0,
    'Achievement': t.Achievement || 0,
    'Achievement %': t.AchievementPct || 0,
    'Variance': t.Variance || 0,
    'Progress %': t.WeightedProgressPct || t.ProgressPct || 0,
    'SLA Status': t.SLAStatus || '',
    'SLA Hours': t.SLAHours || 0,
    'Due Date': t.DueDate ? new Date(t.DueDate).toLocaleDateString('en-IN') : '',
    'Created': t.CreatedAt ? new Date(t.CreatedAt).toLocaleString('en-IN') : '',
    'Submitted': t.SubmittedAt ? new Date(t.SubmittedAt).toLocaleString('en-IN') : '',
    'Completed': t.CompletedAt ? new Date(t.CompletedAt).toLocaleString('en-IN') : '',
    'Sub Task Count': t.SubTaskCount || 0,
    'Activity Count': t.ActivityCount || 0,
    'Evidence Count': t.evidence?.length || 0,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-width columns
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] || '').length).slice(0, 10)) + 2
  }));
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportAnalyticsToExcel(analytics, filename = 'PEMS_Analytics') {
  const wb = XLSX.utils.book_new();

  // Department Performance
  if (analytics.departments?.length) {
    const deptData = analytics.departments.map(d => ({
      'Department': d.Department,
      'Total Tasks': d.totalTasks,
      'Completed': d.completedTasks,
      'Completion %': d.completionRate || 0,
      'Achievement %': d.avgAchievementPct || 0,
      'SLA %': d.slaCompliance || 100,
      'SLA Breached': d.slaBreached || 0,
      'Pending Review': d.pendingReview || 0,
      'Rework': d.rework || 0,
      'Overdue': d.overdueTasks || 0,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptData), 'Departments');
  }

  // Top Sellers
  if (analytics.topPerformers?.topSellers?.length) {
    const sellerData = analytics.topPerformers.topSellers.map(s => ({
      'Rank': s.rank,
      'Seller': s.SellerName,
      'Tasks': s.tasks,
      'Completed': s.completed,
      'Achievement %': s.avgAchievement || 0,
      'SLA %': s.slaCompliance || 100,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sellerData), 'Top Sellers');
  }

  // Top Managers
  if (analytics.topPerformers?.topManagers?.length) {
    const mgrData = analytics.topPerformers.topManagers.map(m => ({
      'Rank': m.rank,
      'Manager': m.UserName,
      'Tasks': m.tasks,
      'Completed': m.completed,
      'Achievement %': m.avgAchievement || 0,
      'SLA %': m.slaCompliance || 100,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mgrData), 'Top Managers');
  }

  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportReviewQueueToExcel(tasks, filename = 'PEMS_Review_Queue') {
  const data = tasks.map((t, idx) => ({
    '#': idx + 1,
    'Task Code': t.InstanceCode,
    'Task Name': t.Title || '',
    'Seller': t.SellerName || '',
    'Department': t.Department || '',
    'Submitted By': t.AssigneeName || '',
    'Reviewer': t.ReviewerName || '',
    'Priority': t.Priority || '',
    'Status': t.Status || '',
    'Review Status': t.ReviewStatus || '',
    'Target': t.Target || 0,
    'Achievement': t.Achievement || 0,
    'Achievement %': t.AchievementPct || 0,
    'Progress %': t.WeightedProgressPct || t.ProgressPct || 0,
    'SLA Status': t.SLAStatus || '',
    'Due Date': t.DueDate ? new Date(t.DueDate).toLocaleDateString('en-IN') : '',
    'Submitted': t.SubmittedAt ? new Date(t.SubmittedAt).toLocaleString('en-IN') : '',
    'Evidence Count': t.evidence?.length || 0,
    'Rework Count': t.ReworkCount || 0,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] || '').length).slice(0, 10)) + 2
  }));
  ws['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, ws, 'Review Queue');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
