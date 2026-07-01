/**
 * PEMS RBAC Permission System
 * Permission-based access control for all PEMS operations
 */

export const PERMISSIONS = {
  // Task permissions
  TASK_CREATE: 'task.create',
  TASK_EDIT: 'task.edit',
  TASK_DELETE: 'task.delete',
  TASK_SUBMIT: 'task.submit',
  TASK_ESCALATE: 'task.escalate',

  // Review permissions
  REVIEW_VIEW: 'review.view',
  REVIEW_APPROVE: 'review.approve',
  REVIEW_REJECT: 'review.reject',
  REVIEW_ASSIGN: 'review.assign',

  // Analytics
  ANALYTICS_VIEW: 'analytics.view',
  ANALYTICS_DEPARTMENT: 'analytics.department',

  // Templates
  TEMPLATE_MANAGE: 'template.manage',
  TEMPLATE_VIEW: 'template.view',

  // Admin
  USER_MANAGE: 'user.manage',
  SYSTEM_SETTINGS: 'system.settings',
};

export const ROLE_HIERARCHY = {
  super_admin: ['pems.*'],
  director: ['task.*', 'review.*', 'analytics.*', 'template.*'],
  operational_manager: ['task.create', 'task.edit', 'review.view', 'review.approve', 'review.reject', 'review.assign', 'analytics.view', 'template.manage'],
  brand_manager: ['task.create', 'task.edit', 'task.submit', 'task.escalate', 'review.view', 'analytics.view'],
  catalog_manager: ['task.create', 'task.edit', 'task.submit', 'review.view', 'analytics.view'],
  reviewer: ['review.view', 'review.approve', 'review.reject', 'analytics.view'],
  executor: ['task.create', 'task.edit', 'task.submit', 'review.view'],
  viewer: ['review.view', 'analytics.view'],
};

/**
 * Check if user has a specific permission
 */
export function hasPermission(user, permission) {
  if (!user) return false;
  const role = user.role?.name || user.role;
  if (!role) return false;

  // Super admin has all permissions
  if (role === 'super_admin' || role === 'admin') return true;

  const perms = ROLE_HIERARCHY[role];
  if (!perms) return false;

  // Check for wildcard
  if (perms.some(p => p === 'pems.*')) return true;

  // Check for exact permission or category wildcard
  return perms.some(p => p === permission || permission.startsWith(p.split('.')[0] + '.'));
}

/**
 * Get all permissions for a user
 */
export function getUserPermissions(user) {
  const role = user?.role?.name || user?.role;
  if (!role) return [];
  if (role === 'super_admin' || role === 'admin') return Object.values(PERMISSIONS);
  return ROLE_HIERARCHY[role] || [];
}

/**
 * Check multiple permissions (user must have ALL)
 */
export function hasAllPermissions(user, permissions) {
  return permissions.every(p => hasPermission(user, p));
}

/**
 * Check any permission (user needs at least ONE)
 */
export function hasAnyPermission(user, permissions) {
  return permissions.some(p => hasPermission(user, p));
}
