/**
 * Task Health Engine
 * Calculates health score based on progress, due date, SLA, variance, achievement
 */

export function calculateHealth(task) {
  let score = 100;
  const now = new Date();
  const dueDate = task.DueDate ? new Date(task.DueDate) : null;

  // 1. Progress penalty (0-25 points)
  const progress = task.WeightedProgressPct || task.ProgressPct || 0;
  if (progress < 25) score -= 25;
  else if (progress < 50) score -= 15;
  else if (progress < 75) score -= 5;

  // 2. Due date proximity (0-25 points)
  if (dueDate) {
    const hoursUntilDue = (dueDate - now) / (1000 * 60 * 60);
    if (hoursUntilDue < 0) score -= 25; // Overdue
    else if (hoursUntilDue < 12) score -= 20;
    else if (hoursUntilDue < 24) score -= 12;
    else if (hoursUntilDue < 48) score -= 5;
  } else {
    score -= 5; // No due date
  }

  // 3. SLA penalty (0-20 points)
  if (task.SLAStatus === 'BREACHED') score -= 20;
  else if (task.SLAStatus === 'AT_RISK') score -= 10;

  // 4. Achievement penalty (0-15 points)
  if (task.Target > 0) {
    const achievementPct = task.AchievementPct || 0;
    if (achievementPct < 30) score -= 15;
    else if (achievementPct < 60) score -= 8;
    else if (achievementPct < 80) score -= 3;
  }

  // 5. Rework penalty (0-15 points)
  if (task.ReworkCount > 0) score -= Math.min(15, task.ReworkCount * 5);

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    label: score >= 80 ? 'Healthy' : score >= 50 ? 'Attention' : 'Critical',
    color: score >= 80 ? '#16a34a' : score >= 50 ? '#f59e0b' : '#dc2626',
    bgColor: score >= 80 ? '#f0fdf4' : score >= 50 ? '#fffbeb' : '#fef2f2',
  };
}

export function isOverdue(task) {
  if (!task.DueDate) return false;
  return new Date(task.DueDate) < new Date() && !['APPROVED', 'CANCELLED'].includes(task.Status);
}

export function isDueToday(task) {
  if (!task.DueDate) return false;
  const due = new Date(task.DueDate);
  const today = new Date();
  return due.toDateString() === today.toDateString() && !['APPROVED', 'CANCELLED'].includes(task.Status);
}

export function isDueTomorrow(task) {
  if (!task.DueDate) return false;
  const due = new Date(task.DueDate);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return due.toDateString() === tomorrow.toDateString() && !['APPROVED', 'CANCELLED'].includes(task.Status);
}

export function getDueDateLabel(task) {
  if (!task.DueDate) return null;
  const due = new Date(task.DueDate);
  const now = new Date();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, color: '#dc2626', urgent: true };
  if (diffDays === 0) return { text: 'Due today', color: '#f59e0b', urgent: true };
  if (diffDays === 1) return { text: 'Due tomorrow', color: '#f59e0b', urgent: false };
  if (diffDays <= 3) return { text: `${diffDays}d left`, color: '#f59e0b', urgent: false };
  return { text: `${diffDays}d left`, color: '#64748b', urgent: false };
}

export function formatNumber(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
