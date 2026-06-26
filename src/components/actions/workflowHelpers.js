export const canTransition = (currentUser, task, targetStatus) => {
  const role = (currentUser?.role?.name || currentUser?.role || '').toLowerCase();
  const userId = currentUser?._id || currentUser?.id;
  const isAdmin = ['admin', 'super_admin', 'developer', 'operational_manager'].includes(role);
  const isAssignee = task?.assignedTo && (
    Array.isArray(task.assignedTo)
      ? task.assignedTo.some(u => (u._id || u.id || u) === userId)
      : (task.assignedTo._id || task.assignedTo.id || task.assignedTo) === userId
  );
  const isReviewer = task?.reviewer &&
    (task.reviewer._id || task.reviewer.id || task.reviewer) === userId;
  const current = (task?.status || 'PENDING').toUpperCase();

  switch (`${current}→${targetStatus.toUpperCase()}`) {
    case 'PENDING→IN_PROGRESS':    return isAssignee || isAdmin;
    case 'IN_PROGRESS→REVIEW':     return isAssignee || isAdmin;
    case 'IN_PROGRESS→COMPLETED':  return isAdmin && !task?.reviewer;
    case 'REVIEW→COMPLETED':       return isReviewer || isAdmin;
    case 'REVIEW→IN_PROGRESS':     return isReviewer || isAdmin;
    default:                        return isAdmin;
  }
};

export const STATUS_META = {
  PENDING: { label: 'Pending', color: '#94a3b8', bg: '#f1f5f9' },
  IN_PROGRESS: { label: 'In Progress', color: '#6366f1', bg: '#eef2ff' },
  REVIEW: { label: 'Awaiting Review', color: '#8b5cf6', bg: '#f5f3ff' },
  COMPLETED: { label: 'Completed', color: '#10b981', bg: '#ecfdf5' },
  REJECTED: { label: 'Rejected', color: '#ef4444', bg: '#fef2f2' },
};

export const formatRelativeTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const formatUserName = (user) => {
  if (!user) return 'Unknown';
  if (typeof user === 'string') return user;
  const firstName = user.firstName || user.name || '';
  const lastName = user.lastName || '';
  return `${firstName} ${lastName}`.trim() || user.email || 'Unknown';
};
