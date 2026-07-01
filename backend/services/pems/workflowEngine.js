/**
 * PEMS V2 Workflow Engine
 * Manages task lifecycle with departments, escalation, and notifications
 */

const WORKFLOW_STATUSES = {
  DRAFT: 'DRAFT',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  REWORK: 'REWORK',
  RESUBMITTED: 'RESUBMITTED',
  ESCALATED: 'ESCALATED',
  CANCELLED: 'CANCELLED',
};

const VALID_TRANSITIONS = {
  DRAFT: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['SUBMITTED', 'ESCALATED'],
  SUBMITTED: ['UNDER_REVIEW'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  REJECTED: ['REWORK'],
  REWORK: ['RESUBMITTED'],
  RESUBMITTED: ['UNDER_REVIEW'],
  ESCALATED: ['IN_PROGRESS', 'UNDER_REVIEW', 'CANCELLED'],
  APPROVED: [],
  CANCELLED: [],
};

const REVIEW_DECISIONS = { APPROVE: 'APPROVE', REJECT: 'REJECT', REWORK: 'REWORK' };

const SLA_STATUSES = { WITHIN_SLA: 'WITHIN_SLA', AT_RISK: 'AT_RISK', BREACHED: 'BREACHED' };

const FREQUENCIES = {
  ONE_TIME: 'ONE_TIME', DAILY: 'DAILY', WEEKLY: 'WEEKLY', BI_WEEKLY: 'BI_WEEKLY',
  MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', HALF_YEARLY: 'HALF_YEARLY',
  YEARLY: 'YEARLY', CUSTOM: 'CUSTOM',
};

const DEPARTMENTS = {
  OPERATIONS: 'Operations',
  BRAND_MANAGERS: 'Brand Managers',
  CATALOG: 'Catalog Team',
};

const CATEGORIES = {
  LISTING: 'LISTING', PRICING: 'PRICING', INVENTORY: 'INVENTORY',
  ADS: 'ADS', ANALYTICS: 'ANALYTICS', COMPLIANCE: 'COMPLIANCE', GENERAL: 'GENERAL',
};

const PRIORITIES = { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' };

const TARGET_TYPES = { NUMERIC: 'NUMERIC', PERCENTAGE: 'PERCENTAGE', BOOLEAN: 'BOOLEAN', QUALITATIVE: 'QUALITATIVE' };

const COMPLEXITY_LEVELS = {
  LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL',
};

const APPROVAL_LEVELS = {
  SINGLE: 'single', DUAL: 'dual', MULTI: 'multi',
};

const AUTO_ASSIGN_STRATEGIES = {
  LOWEST_WORKLOAD: 'lowest_workload',
  DEPARTMENT_BASED: 'department_based',
  ROUND_ROBIN: 'round_robin',
};

const NOTIFICATION_TYPES = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_ACCEPTED: 'TASK_ACCEPTED',
  TASK_SUBMITTED: 'TASK_SUBMITTED',
  TASK_APPROVED: 'TASK_APPROVED',
  TASK_REJECTED: 'TASK_REJECTED',
  SLA_WARNING: 'SLA_WARNING',
  SLA_BREACH: 'SLA_BREACH',
  REVIEW_ASSIGNED: 'REVIEW_ASSIGNED',
};

function canTransition(fromStatus, toStatus) {
  const allowed = VALID_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

function getNextTransitions(currentStatus) {
  return VALID_TRANSITIONS[currentStatus] || [];
}

function calculateSLAStatus(dueDate, slaHours) {
  if (!dueDate) return SLA_STATUSES.WITHIN_SLA;
  const now = new Date();
  const due = new Date(dueDate);
  if (now > due) return SLA_STATUSES.BREACHED;
  const hoursRemaining = (due - now) / (1000 * 60 * 60);
  if (hoursRemaining <= (slaHours || 48) * 0.25) return SLA_STATUSES.AT_RISK;
  return SLA_STATUSES.WITHIN_SLA;
}

function calculateAchievement(achievement, target) {
  if (!target || target <= 0) return 0;
  return Math.round((achievement / target) * 100 * 100) / 100;
}

function calculateVariance(achievement, target) {
  return Math.round((achievement - (target || 0)) * 100) / 100;
}

function calculateProgress(subTasks) {
  if (!subTasks || subTasks.length === 0) return 0;
  const completed = subTasks.filter(st => st.IsCompleted || st.status === 'COMPLETED').length;
  return Math.round((completed / subTasks.length) * 100);
}

function getNextDueDate(frequency, customCron, fromDate = new Date()) {
  const d = new Date(fromDate);
  switch (frequency) {
    case 'DAILY': d.setDate(d.getDate() + 1); break;
    case 'WEEKLY': d.setDate(d.getDate() + 7); break;
    case 'BI_WEEKLY': d.setDate(d.getDate() + 14); break;
    case 'MONTHLY': d.setMonth(d.getMonth() + 1); break;
    case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
    case 'HALF_YEARLY': d.setMonth(d.getMonth() + 6); break;
    case 'YEARLY': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setDate(d.getDate() + 7); break;
  }
  return d;
}

/**
 * Escalation rules:
 * 24h before SLA → notify assignee
 * 12h before SLA → notify reviewer
 * On breach → notify manager
 * 24h after breach → notify admin
 */
function getEscalationLevel(dueDate, slaHours) {
  if (!dueDate) return null;
  const now = new Date();
  const due = new Date(dueDate);
  const hoursUntilDue = (due - now) / (1000 * 60 * 60);
  if (hoursUntilDue < -24) return 'admin';
  if (hoursUntilDue < 0) return 'manager';
  if (hoursUntilDue <= 12) return 'reviewer';
  if (hoursUntilDue <= 24) return 'assignee';
  return null;
}

module.exports = {
  WORKFLOW_STATUSES, VALID_TRANSITIONS, REVIEW_DECISIONS, SLA_STATUSES,
  FREQUENCIES, DEPARTMENTS, CATEGORIES, PRIORITIES, TARGET_TYPES,
  COMPLEXITY_LEVELS, APPROVAL_LEVELS, AUTO_ASSIGN_STRATEGIES,
  NOTIFICATION_TYPES,
  canTransition, getNextTransitions, calculateSLAStatus,
  calculateAchievement, calculateVariance, calculateProgress,
  getNextDueDate, getEscalationLevel,
};
