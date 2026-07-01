/**
 * RetailOps Partner — API Endpoints
 *
 * Central registry of all backend endpoints for the mobile app.
 */

export const ENDPOINTS = {
  // ============================================================
  // AUTHENTICATION
  // ============================================================
  AUTH: {
    LOGIN: '/auth/login',
    REQUEST_OTP: '/auth/request-otp',
    VERIFY_OTP: '/auth/verify-otp',
    RESEND_OTP: '/auth/resend-otp',
    REFRESH_TOKEN: '/auth/refresh-token',
    ME: '/auth/me',
    PROFILE: '/auth/profile',
    CHANGE_PASSWORD: '/auth/change-password',
    LOGOUT: '/auth/logout',
  },

  // ============================================================
  // SELLERS
  // ============================================================
  SELLERS: {
    LIST: '/sellers',
    GET: (id: string) => `/sellers/${id}`,
    STATS: '/sellers/stats',
  },

  // ============================================================
  // ASIN MANAGEMENT
  // ============================================================
  ASINS: {
    LIST: '/asins',
    GET: (id: string) => `/asins/${id}`,
    BY_SELLER: (sellerId: string) => `/asins/seller/${sellerId}`,
    STATS: '/asins/stats',
    FILTERS: '/asins/filters',
    BRANDS: '/asins/brands',
    LQS_TOP: '/asins/lqs-top',
    TRENDS: (id: string) => `/asins/${id}/trends`,
    SUB_BSR: (id: string) => `/asins/${id}/subbsr-trend`,
    TAGS_HISTORY: (id: string) => `/asins/${id}/tags-history`,
    UPDATE_TAGS: (id: string) => `/asins/${id}/tags`,
    BULK_UPDATE: '/asins/bulk-update',
  },

  // ============================================================
  // GMS DATA
  // ============================================================
  GMS: {
    DATA: '/upload/gms-data',
    ASINS: '/upload/gms-asins',
    UPLOAD: '/upload/upload-gms',
  },

  // ============================================================
  // ADS DATA
  // ============================================================
  ADS: {
    REPORT: '/data/ads-report',
    MANAGER: '/data/ads-manager',
    UPLOAD: '/upload/upload-ads',
  },

  // ============================================================
  // REPORTS & ANALYTICS
  // ============================================================
  REPORTS: {
    SKU: '/data/sku-report',
    PARENT_ASIN: '/data/parent-asin-report',
    MONTH_WISE: '/data/month-wise-report',
    DASHBOARD: '/data/dashboard',
    CHART_DATA: '/chart-data',
    REVENUE: '/master-revenue',
    CHART_SIZE_BAR: '/data/chart-size-bar',
    CHART_SIZE_PIE: '/data/chart-size-pie',
  },

  // ============================================================
  // TARGETS & GOALS
  // ============================================================
  TARGETS: {
    LIST: '/targets',
    CREATE: '/targets',
    UPDATE_ACHIEVEMENTS: '/targets/achievements',
    GOALS_CURRENT: '/goals/current',
    PERFORMANCE: '/analytics/performance',
  },

  // ============================================================
  // TASKS (PEMS)
  // ============================================================
  TASKS: {
    DASHBOARD_SUMMARY: '/pems/dashboard/summary',
    LIST: '/pems/instances',
    GET: (id: string) => `/pems/instances/${id}`,
    CREATE: '/pems/instances',
    TRANSITION: (id: string) => `/pems/instances/${id}/transition`,
    COMPLETE_SUBTASK: (id: string) => `/pems/subtasks/${id}/complete`,
    COMPLETE_ACTIVITY: (id: string) => `/pems/activities/${id}/complete`,
    UPLOAD_EVIDENCE: '/pems/evidence',
    NOTIFICATIONS: '/pems/notifications',
    TEMPLATES: '/pems/templates',
    TEMPLATE: (id: string) => `/pems/templates/${id}`,
  },

  // ============================================================
  // CHAT & COMMUNICATION
  // ============================================================
  CHAT: {
    CONVERSATIONS: '/chat/conversations',
    MESSAGES: (id: string) => `/chat/messages/${id}`,
    SEND: '/chat/send',
    USERS: '/chat/users',
    SELLERS: '/chat/sellers',
  },

  // ============================================================
  // EXPORTS
  // ============================================================
  EXPORT: {
    START_ASIN: '/export/start',
    START_GMS: '/export/start-gms',
    START_ADS: '/export/start-ads',
    DOWNLOAD: (id: string) => `/export/download/${id}`,
    STATUS: (id: string) => `/export/status/${id}`,
    FIELDS: '/export/fields',
    DOWNLOADS: '/export/downloads',
  },

  // ============================================================
  // NOTIFICATIONS & ALERTS
  // ============================================================
  NOTIFICATIONS: {
    LIST: '/notifications',
    READ: '/notifications/read',
    ALERTS: '/alerts',
    ALERTS_COUNT: '/alerts/count',
    ALERT_RULES: '/alerts/alert-rules',
  },

  // ============================================================
  // SCHEDULED RUNS
  // ============================================================
  SCHEDULED_RUNS: {
    LIST: '/scheduled-runs',
    SELLER_LOGS: (sellerId: string) => `/scheduled-runs/seller-logs/${sellerId}`,
    SELLER_METRICS: '/scheduled-runs/seller-metrics',
  },

  // ============================================================
  // FILE MANAGER
  // ============================================================
  FILES: {
    LIST: '/files',
    ASIN_FOLDERS: '/files/asin-folders',
    UPLOAD: '/files/upload',
  },

  // ============================================================
  // SELLER TRACKER
  // ============================================================
  TRACKER: {
    ASINS: (sellerId: string) => `/seller-tracker/${sellerId}/asins`,
    INVENTORY: (sellerId: string) => `/seller-tracker/${sellerId}/inventory-status`,
    TASKS: (sellerId: string) => `/seller-tracker/${sellerId}/tasks`,
    LIST: '/seller-tracker',
  },

  // ============================================================
  // UPLOAD
  // ============================================================
  UPLOAD: {
    STATS: '/upload/upload-stats',
    GMS_DATA: '/upload/gms-data',
    GMS_ASINS: '/upload/gms-asins',
  },
} as const;

// ============================================================
// QUERY PARAM HELPERS
// ============================================================

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ''
  );
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

export function paginateQuery(page: number = 1, limit: number = 25): string {
  return buildQuery({ page, limit });
}

export function searchQuery(search: string, page: number = 1, limit: number = 25): string {
  return buildQuery({ search, page, limit });
}

export function sellerScoped(sellerId: string, extra?: Record<string, any>): string {
  return buildQuery({ sellerId, ...extra });
}
