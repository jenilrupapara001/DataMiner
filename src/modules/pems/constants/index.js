export const WORKFLOW_STATUSES = {
  DRAFT: { label: 'Draft', color: '#64748b', bg: '#f1f5f9', antColor: 'default' },
  ASSIGNED: { label: 'Assigned', color: '#0288D1', bg: '#e0f2fe', antColor: 'processing' },
  ACCEPTED: { label: 'Accepted', color: '#9C27B0', bg: '#f5f3ff', antColor: 'purple' },
  IN_PROGRESS: { label: 'In Progress', color: '#1976D2', bg: '#eef2ff', antColor: 'processing' },
  SUBMITTED: { label: 'Submitted', color: '#ED6C02', bg: '#fff7ed', antColor: 'warning' },
  UNDER_REVIEW: { label: 'Under Review', color: '#9C27B0', bg: '#f5f3ff', antColor: 'purple' },
  APPROVED: { label: 'Approved', color: '#2E7D32', bg: '#ecfdf5', antColor: 'success' },
  REJECTED: { label: 'Rejected', color: '#D32F2F', bg: '#fef2f2', antColor: 'error' },
  REWORK: { label: 'Rework', color: '#E65100', bg: '#fff7ed', antColor: 'warning' },
  RESUBMITTED: { label: 'Resubmitted', color: '#0288D1', bg: '#e0f2fe', antColor: 'processing' },
  ESCALATED: { label: 'Escalated', color: '#D32F2F', bg: '#fef2f2', antColor: 'error' },
  CANCELLED: { label: 'Cancelled', color: '#94a3b8', bg: '#f8fafc', antColor: 'default' },
};

export const VALID_TRANSITIONS = {
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
};

export const SLA_STATUSES = {
  WITHIN_SLA: { label: 'Within SLA', color: '#2E7D32', bg: '#ecfdf5' },
  AT_RISK: { label: 'At Risk', color: '#ED6C02', bg: '#fff7ed' },
  BREACHED: { label: 'SLA Breached', color: '#D32F2F', bg: '#fef2f2' },
};

export const FREQUENCIES = [
  { value: 'ONE_TIME', label: 'One Time' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BI_WEEKLY', label: 'Bi Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly' },
  { value: 'HALF_YEARLY', label: 'Half Yearly' },
  { value: 'YEARLY', label: 'Yearly' },
  { value: 'CUSTOM', label: 'Custom Cron' },
];

export const DEPARTMENTS = [
  { value: 'Operations', label: 'Operations' },
  { value: 'Brand Managers', label: 'Brand Managers' },
  { value: 'Catalog Team', label: 'Catalog Team' },
];

export const CATEGORIES = [
  { value: 'LISTING', label: 'Listing' },
  { value: 'PRICING', label: 'Pricing' },
  { value: 'INVENTORY', label: 'Inventory' },
  { value: 'ADS', label: 'Ads' },
  { value: 'ANALYTICS', label: 'Analytics' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'GENERAL', label: 'General' },
];

export const PRIORITIES = {
  CRITICAL: { label: 'Critical', color: '#b91c1c', bg: '#fee2e2' },
  HIGH: { label: 'High', color: '#c2410c', bg: '#ffedd5' },
  MEDIUM: { label: 'Medium', color: '#b45309', bg: '#fef3c7' },
  LOW: { label: 'Low', color: '#475569', bg: '#f1f5f9' },
};

export const TARGET_TYPES = [
  { value: 'NUMERIC', label: 'Numeric' },
  { value: 'PERCENTAGE', label: 'Percentage' },
  { value: 'BOOLEAN', label: 'Yes/No' },
  { value: 'QUALITATIVE', label: 'Qualitative' },
];

export const COMPLEXITY_LEVELS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

export const APPROVAL_LEVELS = [
  { value: 'single', label: 'Single Approval' },
  { value: 'dual', label: 'Dual Approval' },
  { value: 'multi', label: 'Multi Approval' },
];

export const AUTO_ASSIGN_STRATEGIES = [
  { value: 'lowest_workload', label: 'Lowest Workload' },
  { value: 'department_based', label: 'Department Based' },
  { value: 'round_robin', label: 'Round Robin' },
];
