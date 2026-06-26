/**
 * RetailOps Centralized Status System
 * Single source of truth for all status colors and labels.
 */

const STATUS = {
  // Active states
  active:     { color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7', label: 'Active' },
  completed:  { color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7', label: 'Completed' },
  success:    { color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7', label: 'Success' },

  // Pending states
  pending:    { color: '#ED6C02', bg: '#FFF3E0', border: '#FFCC80', label: 'Pending' },
  review:     { color: '#FF9800', bg: '#FFF8E1', border: '#FFE082', label: 'In Review' },
  inProgress: { color: '#1976D2', bg: '#E3F2FD', border: '#90CAF9', label: 'In Progress' },
  processing: { color: '#1976D2', bg: '#E3F2FD', border: '#90CAF9', label: 'Processing' },

  // Error states
  failed:     { color: '#D32F2F', bg: '#FFEBEE', border: '#EF9A9A', label: 'Failed' },
  rejected:   { color: '#D32F2F', bg: '#FFEBEE', border: '#EF9A9A', label: 'Rejected' },
  error:      { color: '#D32F2F', bg: '#FFEBEE', border: '#EF9A9A', label: 'Error' },

  // Info states
  draft:      { color: '#0288D1', bg: '#E1F5FE', border: '#81D4FA', label: 'Draft' },
  info:       { color: '#0288D1', bg: '#E1F5FE', border: '#81D4FA', label: 'Info' },

  // Neutral
  cancelled:  { color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', label: 'Cancelled' },
  disabled:   { color: '#9CA3AF', bg: '#F3F4F6', border: '#D1D5DB', label: 'Disabled' },
};

function getStatus(statusKey) {
  const key = (statusKey || '').toUpperCase().replace(/\s+/g, '');
  const map = {
    ACTIVE: STATUS.active, COMPLETED: STATUS.completed, SUCCESS: STATUS.success,
    PENDING: STATUS.pending, REVIEW: STATUS.review, IN_PROGRESS: STATUS.inProgress,
    INPROGRESS: STATUS.inProgress, PROCESSING: STATUS.processing,
    FAILED: STATUS.failed, REJECTED: STATUS.rejected, ERROR: STATUS.error,
    DRAFT: STATUS.draft, INFO: STATUS.info,
    CANCELLED: STATUS.cancelled, CANCELED: STATUS.cancelled,
    DISABLED: STATUS.disabled,
  };
  return map[key] || STATUS.pending;
}

module.exports = { STATUS, getStatus };
