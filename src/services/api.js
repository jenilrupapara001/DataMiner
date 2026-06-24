import { cachedFetch, invalidateCachePattern } from './apiCache';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Auth helper functions
const getAuthHeader = () => {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const handleResponse = async (res, defaultErrorMsg = 'Request failed') => {
  if (res.ok) {
    return res.json();
  }
  let errorMsg = defaultErrorMsg;
  try {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await res.json();
      errorMsg = error.error || error.message || errorMsg;
    } else {
      const text = await res.text();
      errorMsg = text ? (text.length > 150 ? text.substring(0, 150) + '...' : text) : `HTTP Error ${res.status}: ${res.statusText}`;
    }
  } catch (e) {
    errorMsg = `HTTP Error ${res.status}: ${res.statusText}`;
  }
  throw new Error(errorMsg);
};

// Auth API
export const authApi = {
  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Login failed');
    }
    const data = await res.json();
    // Only store tokens if this is a direct login (trusted device)
    if (data.success && data.data?.accessToken) {
      localStorage.setItem('authToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  verifyOtp: async (tempToken, otp, trustDevice = false) => {
    const res = await fetch(`${API_BASE}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, otp, trustDevice }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'OTP verification failed');
    if (data.success && data.data?.accessToken) {
      localStorage.setItem('authToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  resendOtp: async (tempToken) => {
    const res = await fetch(`${API_BASE}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to resend OTP');
    return data;
  },

  post: async (endpoint, body = {}) => {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  },

  getMe: async () => {
    const token = localStorage.getItem('authToken');
    const res = await fetch(`${API_BASE}/auth/me`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return res.json();
  },

  register: async (userData) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Registration failed');
    }
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('authToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
  },

  logout: async () => {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    });
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    return res.json();
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to get user info');
    return res.json();
  },

  updateProfile: async (data) => {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const result = await res.json();
    if (result.success) {
      localStorage.setItem('user', JSON.stringify(result.data));
    }
    return result;
  },

  changePassword: async (currentPassword, newPassword) => {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to change password');
    }
    return res.json();
  },

  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');

    const res = await fetch(`${API_BASE}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error('Failed to refresh token');

    const data = await res.json();
    if (data.success) {
      localStorage.setItem('authToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
    }
    return data;
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  },
};

// Seed API - Comprehensive demo data seeding
export const seedApi = {
  seedAll: async () => {
    const res = await fetch(`${API_BASE}/seed/seed-all`, { method: 'POST' });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to seed demo data');
    }
    return res.json();
  },

  getDashboard: async () => {
    const res = await fetch(`${API_BASE}/seed/dashboard`);
    if (!res.ok) throw new Error('Failed to get dashboard data');
    return res.json();
  },
};

// Market Sync API
export const marketSyncApi = {
  getStatus: async () => {
    const res = await fetch(`${API_BASE}/market-sync/status`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch sync status');
    return res.json();
  },

  syncAsin: async (id) => {
    const res = await fetch(`${API_BASE}/market-sync/sync/${id}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to trigger ASIN sync');
    }
    return res.json();
  },

  syncSellerAsins: async (sellerId, fullSync = false) => {
    const query = fullSync ? '?fullSync=true' : '';
    const res = await fetch(`${API_BASE}/market-sync/sync-all/${sellerId}${query}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to trigger batch sync');
    }
    return res.json();
  },

  fetchResults: async (sellerId) => {
    const res = await fetch(`${API_BASE}/market-sync/fetch-results/${sellerId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fetch results');
    }
    return res.json();
  },

  syncAll: async () => {
    const res = await fetch(`${API_BASE}/market-sync/sync-all`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to trigger global sync');
    }
    return res.json();
  },

   setupAutoSync: async (sellerId) => {
    const res = await fetch(`${API_BASE}/market-sync/setup-task/${sellerId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to setup auto-sync');
    }
    return res.json();
  },

  getPoolStatus: async () => {
    const res = await fetch(`${API_BASE}/market-sync/pool-status`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch pool status');
    return res.json();
  },

  uploadPoolTasks: async (taskIds) => {
    const res = await fetch(`${API_BASE}/market-sync/pool-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ taskIds }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to upload task pool');
    }
    return res.json();
  },

  syncTaskPool: async () => {
    const res = await fetch(`${API_BASE}/market-sync/sync-pool`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to sync task pool');
    }
    return res.json();
  },

  ingestAllResults: async () => {
    const res = await fetch(`${API_BASE}/market-sync/ingest-all`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to initiate global ingestion');
    }
    return res.json();
  },

  getSyncTasks: async () => {
    const res = await fetch(`${API_BASE}/market-sync/tasks`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch global sync tasks');
    return res.json();
  },

  startTask: async (sellerId) => {
    const res = await fetch(`${API_BASE}/market-sync/start-task/${sellerId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to start extraction');
    }
    return res.json();
  },

  syncResults: async (sellerId) => {
    const res = await fetch(`${API_BASE}/market-sync/sync-results/${sellerId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to sync results');
    }
    return res.json();
  },

  bulkUpdateTasks: async (sellerIds = []) => {
    const res = await fetch(`${API_BASE}/market-sync/bulk-update-tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sellerIds }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to duplicate and assign tasks');
    }
    return res.json();
  },

  bulkInjectJson: async (sellerId, data) => {
    const res = await fetch(`${API_BASE}/market-sync/bulk-inject-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sellerId, data }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to manually inject JSON data');
    }
    return res.json();
  },

  bulkInjectAsins: async (sellerIds = []) => {
    const res = await fetch(`${API_BASE}/market-sync/bulk-inject-asins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sellerIds }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to trigger bulk ASIN injection');
    }
    return res.json();
  },
  
  uploadOctoparseJson: async (file, sellerId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sellerId', sellerId);
    
    const res = await fetch(`${API_BASE}/upload/octoparse`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || error.message || 'Failed to upload Octoparse JSON');
    }
    return res.json();
  },

  triggerLiveSync: async (sellerId) => {
    const res = await fetch(`${API_BASE}/market-sync/sync/live/${sellerId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res, 'Failed to trigger live sync');
  },

  getSellerSyncStatus: async (sellerId) => {
    const res = await fetch(`${API_BASE}/market-sync/sync/status/${sellerId}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res, 'Failed to fetch seller sync status');
  },

  triggerLiveSyncAll: async (options = {}) => {
    const res = await fetch(`${API_BASE}/market-sync/sync-all-live`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(options),
    });
    return handleResponse(res, 'Failed to trigger global live sync');
  },

  getLiveSyncAllStatus: async () => {
    const res = await fetch(`${API_BASE}/market-sync/sync-all-live/status`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse(res, 'Failed to fetch global sync status');
  },
};

// Scheduled Runs API
export const scheduledRunsApi = {
  getAll: async () => {
    const res = await fetch(`${API_BASE}/scheduled-runs`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch scheduled runs');
    return res.json();
  },

  getSellerMetrics: async () => {
    const res = await fetch(`${API_BASE}/scheduled-runs/seller-metrics`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch scheduled run seller metrics');
    return res.json();
  },

  getSellerLogs: async (sellerId) => {
    const res = await fetch(`${API_BASE}/scheduled-runs/seller-logs/${sellerId}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch seller logs');
    return res.json();
  },

  getDetails: async (id) => {
    const res = await fetch(`${API_BASE}/scheduled-runs/${id}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch scheduled run details');
    return res.json();
  },

  trigger: async (marketplace) => {
    const url = marketplace 
      ? `${API_BASE}/scheduled-runs/trigger?marketplace=${encodeURIComponent(marketplace)}`
      : `${API_BASE}/scheduled-runs/trigger`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to trigger scheduled run');
    return res.json();
  },
};

// User API
export const userApi = {
  getAll: async (params = {}) => {
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    );
    return api.get('/users', cleanParams);
  },
  getById: async (id) => {
    return api.get(`/users/${id}`);
  },
  create: async (data) => {
    return api.post('/users', data);
  },
  update: async (id, data) => {
    return api.put(`/users/${id}`, data);
  },
  delete: async (id) => {
    return api.delete(`/users/${id}`);
  },
  toggleStatus: async (id) => {
    return api.put(`/users/${id}/toggle-status`);
  },
  resetPassword: async (id, newPassword) => {
    return api.put(`/users/${id}/reset-password`, { newPassword });
  },
  getRoles: async () => {
    return api.get('/users/roles');
  },
  getSellers: async () => {
    return api.get('/users/sellers');
  },
  getManagers: async () => {
    return api.get('/users/managers');
  },
  sendEmail: async (data) => {
    return api.post('/users/send-email', data);
  }
};

// Role API
export const roleApi = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/roles?${query}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch roles');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/roles/${id}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch role');
    return res.json();
  },

  getPermissions: async () => {
    return api.get('/users/permissions');
  },

  create: async (data) => {
    const res = await fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create role');
    }
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_BASE}/roles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update role');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/roles/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to delete role');
    return res.json();
  },
};

// Seller API
export const sellerApi = {
  getAll: async (params = {}) => {
    // Filter out null, undefined, or empty strings to keep URL clean
    const cleanParams = Object.entries(params).reduce((acc, [key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        acc[key] = val;
      }
      return acc;
    }, {});

    const query = new URLSearchParams(cleanParams).toString();
    const cacheKey = `sellers:${query}`;

    return cachedFetch(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/sellers?${query}`, {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error('Failed to fetch sellers');
      return res.json();
    }, 5 * 60 * 1000); // 5 min TTL
  },

  getStats: async (params = {}) => {
    const cleanParams = Object.entries(params).reduce((acc, [key, val]) => {
      if (val !== undefined && val !== null && val !== '') acc[key] = val;
      return acc;
    }, {});
    const query = new URLSearchParams(cleanParams).toString();
    const res = await fetch(`${API_BASE}/sellers/stats?${query}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch seller stats');
    return res.json();
  },

  getById: async (id) => {
    const cacheKey = `seller:${id}`;
    return cachedFetch(cacheKey, async () => {
      const res = await fetch(`${API_BASE}/sellers/${id}`, {
        headers: { ...getAuthHeader() },
      });
      if (!res.ok) throw new Error('Failed to fetch seller');
      return res.json();
    }, 1 * 60 * 1000); // 1 min TTL
  },

  create: async (data) => {
    const res = await fetch(`${API_BASE}/sellers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create seller');
    }
    invalidateCachePattern('sellers:');
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_BASE}/sellers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update seller');
    invalidateCachePattern('sellers:');
    invalidateCachePattern(`seller:${id}`);
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/sellers/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to delete seller');
    invalidateCachePattern('sellers:');
    invalidateCachePattern(`seller:${id}`);
    return res.json();
  },

  import: async (sellers) => {
    const res = await fetch(`${API_BASE}/sellers/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sellers }),
    });
    if (!res.ok) throw new Error('Failed to import sellers');
    invalidateCachePattern('sellers:');
    return res.json();
  },

  seedDemo: async () => {
    const res = await fetch(`${API_BASE}/sellers/seed`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to seed demo data');
    invalidateCachePattern('sellers:');
    return res.json();
  },
};

// ASIN API
export const asinApi = {
  matchAsins: async (sellerId, asinCodes) => {
    const res = await fetch(`${API_BASE}/asins/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sellerId, asinCodes }),
    });
    if (!res.ok) throw new Error('Failed to match ASINs');
    return res.json();
  },
  updateTags: async (asinId, tags) => {
    try {
      const res = await fetch(`${API_BASE}/asins/${asinId}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ tags })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Failed to update tags');
      }
      return res.json();
    } catch (error) {
      console.error('Failed to update tags:', error);
      throw error;
    }
  },

  bulkUpdateTags: async (asinIds, tags, action = 'replace') => {
    const res = await fetch(`${API_BASE}/asins/bulk-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ asinIds, tags, action })
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to bulk update tags');
    }
    return res.json();
  },

  bulkUploadTags: async (file, sellerId) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (sellerId) formData.append('sellerId', sellerId);
      
      const res = await fetch(`${API_BASE}/asins/tags/bulk`, {
        method: 'POST',
        headers: { ...getAuthHeader() },
        body: formData
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Failed to bulk upload tags');
      }
      return res.json();
    } catch (error) {
      console.error('Failed to bulk upload tags:', error);
      throw error;
    }
  },

  downloadTagsTemplate: async (sellerId) => {
    try {
      const query = new URLSearchParams(sellerId ? { sellerId } : {}).toString();
      const res = await fetch(`${API_BASE}/asins/tags/template${query ? `?${query}` : ''}`, {
        headers: { ...getAuthHeader() }
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Failed to download template');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tags_template_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return { success: true };
    } catch (error) {
      console.error('Failed to download template:', error);
      throw error;
    }
  },

  recalculateLQS: async (ids = []) => {
    try {
      const res = await fetch(`${API_BASE}/asins/recalculate-lqs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Failed to recalculate LQS');
      }
      return res.json();
    } catch (error) {
      console.error('Failed to recalculate LQS:', error);
      throw error;
    }
  },

  getTags: async () => {
    try {
      const res = await fetch(`${API_BASE}/asins/tags`, {
        headers: { ...getAuthHeader() }
      });
      if (!res.ok) throw new Error('Failed to fetch tags');
      return res.json();
    } catch (error) {
      console.error('Failed to get tags:', error);
      return { success: true, data: { default: [], used: [], all: [] } };
    }
  },

  getTagsHistory: async (asinId, page = 1, limit = 20) => {
    try {
      const res = await fetch(`${API_BASE}/asins/${asinId}/tags-history?page=${page}&limit=${limit}`, {
        headers: { ...getAuthHeader() }
      });
      if (!res.ok) throw new Error('Failed to fetch tags history');
      return res.json();
    } catch (error) {
      console.error('Failed to get tags history:', error);
      throw error;
    }
  },

  getTagsSummary: async (asinId) => {
    try {
      const res = await fetch(`${API_BASE}/asins/${asinId}/tags-summary`, {
        headers: { ...getAuthHeader() }
      });
      if (!res.ok) throw new Error('Failed to fetch tags summary');
      return res.json();
    } catch (error) {
      console.error('Failed to get tags summary:', error);
      throw error;
    }
  },

  getPredefinedTags: async () => {
    try {
      const res = await fetch(`${API_BASE}/asins/predefined-tags`, {
        headers: { ...getAuthHeader() }
      });
      if (!res.ok) throw new Error('Failed to fetch predefined tags');
      return res.json();
    } catch (error) {
      console.error('Failed to get predefined tags:', error);
      throw error;
    }
  },

  addPredefinedTag: async (tagData) => {
    try {
      const res = await fetch(`${API_BASE}/asins/predefined-tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(tagData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add predefined tag');
      }
      return res.json();
    } catch (error) {
      console.error('Failed to add predefined tag:', error);
      throw error;
    }
  },

  updatePredefinedTag: async (id, tagData) => {
    try {
      const res = await fetch(`${API_BASE}/asins/predefined-tags/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(tagData)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update predefined tag');
      }
      return res.json();
    } catch (error) {
      console.error('Failed to update predefined tag:', error);
      throw error;
    }
  },

  deletePredefinedTag: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/asins/predefined-tags/${id}`, {
        method: 'DELETE',
        headers: { ...getAuthHeader() }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete predefined tag');
      }
      return res.json();
    } catch (error) {
      console.error('Failed to delete predefined tag:', error);
      throw error;
    }
  },

  getAll: async (params = {}) => {
    // Filter out null, undefined, or empty strings to keep URL clean
    const cleanParams = Object.entries(params).reduce((acc, [key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        acc[key] = val;
      }
      return acc;
    }, {});
    
    const query = new URLSearchParams(cleanParams).toString();
    const res = await fetch(`${API_BASE}/asins${query ? `?${query}` : ''}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch ASINs');
    return res.json();
  },

  getFilters: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/asins/filters${query ? `?${query}` : ''}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch filter options');
    return res.json();
  },

  getAllWithoutPagination: async () => {
    const res = await fetch(`${API_BASE}/asins/all`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch all ASINs');
    return res.json();
  },

  getStats: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/asins/stats?${query}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch ASIN stats');
    return res.json();
  },

  getSubBsrTrend: async (asinId, days = 30) => {
    const res = await fetch(`${API_BASE}/asins/${asinId}/subbsr-trend?days=${days}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch Sub BSR trend');
    return res.json();
  },
  
  getBrands: async () => {
    const res = await fetch(`${API_BASE}/asins/brands`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch brands');
    return res.json();
  },

  getBySeller: async (sellerId, params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/asins/seller/${sellerId}${query ? `?${query}` : ''}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch ASINs');
    return res.json();
  },


  getById: async (id) => {
    const res = await fetch(`${API_BASE}/asins/${id}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch ASIN');
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_BASE}/asins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create ASIN');
    }
    return res.json();
  },

  createBulk: async (asins) => {
    const res = await fetch(`${API_BASE}/asins/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ asins }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to create ASINs');
    }
    return res.json();
  },

  importCsv: async (file, sellerId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sellerId', sellerId);
    
    const res = await fetch(`${API_BASE}/asins/import-csv`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to import CSV');
    }
    return res.json();
  },

  bulkUploadAllSellers: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(`${API_BASE}/asins/bulk-upload-all-sellers`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to bulk upload ASINs');
    }
    return res.json();
  },

  bulkDelete: async (ids) => {
    const res = await fetch(`${API_BASE}/asins/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to bulk delete ASINs');
    }
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_BASE}/asins/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update ASIN');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/asins/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to delete ASIN');
    return res.json();
  },

  generateImages: async (id) => {
    const res = await fetch(`${API_BASE}/asins/${id}/generate-images`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to generate AI images');
    }
    return res.json();
  },

  repairIncomplete: async (sellerId) => {
    const res = await fetch(`${API_BASE}/asins/repair/${sellerId}`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to trigger data repair');
    }
    return res.json();
  },

  getRepairStatus: async (sellerId) => {
    const res = await fetch(`${API_BASE}/asins/repair-status/${sellerId}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch repair status');
    return res.json();
  },

  exportData: async (payload) => {
    const res = await fetch(`${API_BASE}/asins/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) {
      let errorMessage = 'Export failed';
      try {
        const error = await res.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch (e) {
        // Not a JSON response
        errorMessage = `Server error (${res.status})`;
      }
      throw new Error(errorMessage);
    }
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    return { success: true, downloadUrl: url };
  },
};


const REVENUE_API_BASE = `${import.meta.env.VITE_API_URL || '/api'}/revenue`;

export const dashboardApi = {
  getSummary: async (params = {}) => {
    let query = '';
    if (typeof params === 'string') {
      // If it's already a query string (has = or &), use it as is
      if (params.includes('=') || params.includes('&')) {
        query = params;
      } else if (params) {
        query = `period=${params}`;
      }
    } else {
      // For object params, filter out null/undefined before stringifying
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== null && v !== undefined && v !== 'null')
      );
      query = new URLSearchParams(cleanParams).toString();
    }
    
    const res = await fetch(`${API_BASE}/dashboard?${query}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch dashboard data');
    return res.json();
  },
};

export const revenueApi = {
  // Auth
  login: async (email, password) => {
    const res = await fetch(`${REVENUE_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  // Fees
  getFees: async (type) => {
    const res = await fetch(`${REVENUE_API_BASE}/fees/${type}`);
    if (!res.ok) throw new Error(`Failed to fetch ${type} fees`);
    return res.json();
  },

  saveFee: async (type, fee) => {
    const res = await fetch(`${REVENUE_API_BASE}/fees/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fee),
    });
    if (!res.ok) throw new Error(`Failed to save ${type} fee`);
    return res.json();
  },

  deleteFee: async (type, id) => {
    const res = await fetch(`${REVENUE_API_BASE}/fees/${type}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete ${type} fee`);
    return res.json();
  },

  // Mappings
  getCategoryMappings: async () => {
    const res = await fetch(`${REVENUE_API_BASE}/mappings`);
    if (!res.ok) throw new Error('Failed to fetch category mappings');
    return res.json();
  },

  saveCategoryMapping: async (mapping) => {
    const res = await fetch(`${REVENUE_API_BASE}/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapping),
    });
    if (!res.ok) throw new Error('Failed to save category mapping');
    return res.json();
  },

  getNodeMaps: async () => {
    const res = await fetch(`${REVENUE_API_BASE}/nodemaps`);
    if (!res.ok) throw new Error('Failed to fetch node maps');
    return res.json();
  },

  saveNodeMap: async (nodeMap) => {
    const res = await fetch(`${REVENUE_API_BASE}/nodemaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nodeMap),
    });
    if (!res.ok) throw new Error('Failed to save node map');
    return res.json();
  },

  // ASINs
  getAsins: async () => {
    const res = await fetch(`${REVENUE_API_BASE}/asins`);
    if (!res.ok) throw new Error('Failed to fetch ASINs');
    return res.json();
  },

  addAsinsBulk: async (asins) => {
    const res = await fetch(`${REVENUE_API_BASE}/asins/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asins),
    });
    if (!res.ok) throw new Error('Failed to add ASINs');
    return res.json();
  },

  updateAsin: async (id, updates) => {
    const res = await fetch(`${REVENUE_API_BASE}/asins/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update ASIN');
    return res.json();
  },

  deleteAsin: async (id) => {
    const res = await fetch(`${REVENUE_API_BASE}/asins/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete ASIN');
    return res.json();
  },

  deleteAllAsins: async () => {
    const res = await fetch(`${REVENUE_API_BASE}/asins`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete all ASINs');
    return res.json();
  },

  // Health check
  healthCheck: async () => {
    const res = await fetch(`${REVENUE_API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },
};

// Settings API
export const settingsApi = {
  getAll: async (group) => {
    const query = group ? `?group=${group}` : '';
    const res = await fetch(`${API_BASE}/settings${query}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  update: async (settings, group = 'general') => {
    const res = await fetch(`${API_BASE}/settings/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ settings, group }),
    });
    if (!res.ok) throw new Error('Failed to update settings');
    return res.json();
  },

  getByKey: async (key) => {
    const res = await fetch(`${API_BASE}/settings/${key}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch setting');
    return res.json();
  },

  getOctoparseAutomation: async () => {
    const res = await fetch(`${API_BASE}/settings/octoparse-automation`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch octoparse automation setting');
    return res.json();
  },
  
  toggleOctoparseAutomation: async (enabled) => {
    const res = await fetch(`${API_BASE}/settings/octoparse-automation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error('Failed to toggle octoparse automation');
    return res.json();
  },

  getScheduleConfig: async () => {
    const res = await fetch(`${API_BASE}/settings/schedule-config`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch schedule config');
    return res.json();
  },
};

// Bulk API
export const bulkApi = {
  catalogSync: async (file, sellerId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sellerId', sellerId);
    return api.post('/bulk/catalog-sync', formData);
  },
  ajioCatalogImport: async (file, sellerId) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sellerId', sellerId);
    return api.post('/bulk/ajio-catalog-sync', formData);
  },
  tagsImport: async (file, sellerId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (sellerId) formData.append('sellerId', sellerId);
    return api.post('/bulk/tags-import', formData);
  },
  downloadCatalogTemplate: async (marketplace = '') => {
    const query = marketplace ? `?marketplace=${marketplace}` : '';
    const res = await fetch(`${API_BASE}/bulk/catalog-template${query}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to download template');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = marketplace === 'ajio' ? 'ajio_catalog_template.xlsx' : 'catalog_template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return { success: true };
  },
  octoparseJsonUpload: async (file, sellerId, allowCreation = false) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('sellerId', sellerId);
    formData.append('allowCreation', allowCreation);
    return api.post('/bulk/octoparse-json', formData);
  },
};


// Generic API Client
const api = {
  get: async (endpoint, params = {}) => {
    const authHeader = getAuthHeader();
    console.log('[API GET]', endpoint, 'Auth:', Object.keys(authHeader).length > 0 ? 'Token present' : 'NO TOKEN');
    const query = new URLSearchParams(params).toString();
    const url = `${API_BASE}${endpoint}${query ? `?${query}` : ''}`;
    const res = await fetch(url, { headers: authHeader });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${res.statusText}`);
    }
    return res.json();
  },
  post: async (endpoint, data = {}, config = {}) => {
    const isFormData = data instanceof FormData;
    let headers = { ...getAuthHeader(), ...(config.headers || {}) };

    // Remove Content-Type for FormData - browser sets it with boundary automatically
    if (isFormData) {
      delete headers['Content-Type'];
    } else {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers,
      body: isFormData ? data : JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${res.statusText}`);
    }
    return res.json();
  },
  put: async (endpoint, data, config = {}) => {
    const isFormData = data instanceof FormData;
    let headers = { ...getAuthHeader(), ...(config.headers || {}) };

    // Remove Content-Type for FormData - browser sets it with boundary automatically
    if (isFormData) {
      delete headers['Content-Type'];
    } else {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers,
      body: isFormData ? data : JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${res.statusText}`);
    }
    return res.json();
  },
  delete: async (endpoint) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${res.statusText}`);
    }
    return res.json();
  },
  patch: async (endpoint, data = {}) => {
    const authHeader = getAuthHeader();
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: {
        ...authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || `Request failed: ${res.statusText}`);
    }
    return res.json();
  },

  // Namespaced APIs
  authApi,
  seedApi,
  dashboardApi,
  userApi,
  roleApi,
  sellerApi,
  asinApi,
  revenueApi,
  settingsApi,
  notificationApi: {
    getNotifications: async (params = {}) => {
      return api.get('/notifications', params);
    },
    markAsRead: async (notificationId) => {
      return api.put('/notifications/read', { notificationId });
    },
    markAllAsRead: async () => {
      return api.put('/notifications/read', { notificationId: 'all' });
    },
    deleteNotification: async (id) => {
      return api.delete(`/notifications/${id}`);
    },
    deleteAllRead: async () => {
      return api.delete('/notifications/all-read');
    }
  },
  chatApi: {
    getConversations: async () => {
      return api.get('/chat/conversations');
    },
    getUsers: async () => {
      return api.get('/chat/users');
    },
    getSellers: async () => {
      return api.get('/chat/sellers');
    },
    createConversation: async (participantId, sellerId) => {
      return api.post('/chat/conversations', { participantId, sellerId });
    },
    getMessages: async (conversationId, params = {}) => {
      return api.get(`/chat/messages/${conversationId}`, params);
    },
    markAsRead: async (conversationId) => {
      return api.post(`/chat/messages/${conversationId}/read`);
    },
    sendMessage: async (data) => {
      return api.post('/chat/send', data);
    },
    uploadFile: async (formData) => {
      return api.post('/chat/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    },
    createGroup: async (groupData) => {
      return api.post('/chat/groups', groupData);
    },
    addGroupMembers: async (conversationId, participants) => {
      return api.post(`/chat/groups/${conversationId}/members`, { participants });
    },
    removeGroupMember: async (conversationId, userId) => {
      return api.post(`/chat/groups/${conversationId}/members/remove`, { userId });
    },
    searchMessages: async (query) => {
      return api.get('/chat/search', { query });
    },
    editMessage: async (messageId, content) => {
      return api.put(`/chat/messages/${messageId}`, { content });
    },
    deleteMessage: async (messageId) => {
      return api.delete(`/chat/messages/${messageId}`);
    },
    forwardMessage: async (messageId, targetConversationId) => {
      return api.post('/chat/messages/forward', { messageId, targetConversationId });
    },
    getMessageReceipts: async (messageId) => {
      return api.get(`/chat/messages/${messageId}/receipts`);
    },
    getLinkPreview: async (url) => {
      return api.get('/chat/link-preview', { url });
    },
    updateMemberRole: async (conversationId, userId, role) => {
      return api.put(`/chat/groups/${conversationId}/role`, { userId, role });
    },
    getSharedMedia: async (conversationId, type) => {
      return api.get(`/chat/groups/${conversationId}/media`, { type });
    },
    togglePinMessage: async (messageId) => {
      return api.put(`/chat/messages/${messageId}/pin`);
    },
    createPoll: async (pollData) => {
      return api.post('/chat/messages/poll', pollData);
    },
    votePoll: async (messageId, optionIndex) => {
      return api.post(`/chat/messages/${messageId}/vote`, { optionIndex });
    }
  },
  alertApi: {
    getAlerts: async () => {
      return api.get('/alerts');
    },
    getAlertCount: async () => {
      return api.get('/alerts/count');
    },
    acknowledgeAlert: async (id) => {
      return api.patch(`/alerts/${id}`, { acknowledged: true });
    },
    acknowledgeAll: async () => {
      return api.patch('/alerts/acknowledge-all');
    },
    getRules: async () => {
      return api.get('/alert-rules');
    },
    getRule: async (id) => {
      return api.get(`/alert-rules/${id}`);
    },
    createRule: async (data) => {
      return api.post('/alert-rules', data);
    },
    updateRule: async (id, data) => {
      return api.put(`/alert-rules/${id}`, data);
    },
    toggleRule: async (id) => {
      return api.patch(`/alert-rules/${id}/toggle`);
    },
    deleteRule: async (id) => {
      return api.delete(`/alert-rules/${id}`);
    },
    executeRule: async (id) => {
      return api.post(`/alert-rules/${id}/execute`);
    },
    executeAllRules: async () => {
      return api.post('/execute-all-rules');
    }
  },
  sellerTrackerApi: {
    getTrackers: async () => {
      return api.get('/seller-tracker');
    },
    getSellerAsins: async (sellerId) => {
      return api.get(`/seller-tracker/${sellerId}/asins`);
    },
    syncSeller: async (sellerId) => {
      return api.post(`/seller-tracker/sync/${sellerId}`);
    },
    syncAll: async () => {
      return api.post('/seller-tracker/sync-all');
    },
    getSellerActivities: async (sellerId) => {
      return api.get(`/seller-tracker/${sellerId}/activities`);
    },
    getSellerTasks: async (sellerId) => {
      return api.get(`/seller-tracker/${sellerId}/tasks`);
    },
    createSellerTask: async (sellerId, taskData) => {
      return api.post(`/seller-tracker/${sellerId}/tasks`, taskData);
    }
  }
};

export default api;

export const alertApi = {
  getAlerts: async () => {
    return api.get('/alerts');
  },
  getAlertCount: async () => {
    return api.get('/alerts/count');
  },
  acknowledgeAlert: async (id) => {
    return api.patch(`/alerts/${id}`, { acknowledged: true });
  },
  acknowledgeAll: async () => {
    return api.patch('/alerts/acknowledge-all');
  },
  getRules: async () => {
    return api.get('/alert-rules');
  },
  getRule: async (id) => {
    return api.get(`/alert-rules/${id}`);
  },
  createRule: async (data) => {
    return api.post('/alert-rules', data);
  },
  updateRule: async (id, data) => {
    return api.put(`/alert-rules/${id}`, data);
  },
  toggleRule: async (id) => {
    return api.patch(`/alert-rules/${id}/toggle`);
  },
  deleteRule: async (id) => {
    return api.delete(`/alert-rules/${id}`);
  },
  executeRule: async (id) => {
    return api.post(`/alert-rules/${id}/execute`);
  },
  executeAllRules: async () => {
    return api.post('/alert-rules/execute-all');
  }
};

export const rulesetApi = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/rulesets?${query}`);
  },
  getById: async (id) => {
    return api.get(`/rulesets/${id}`);
  },
  create: async (data) => {
    return api.post('/rulesets', data);
  },
  update: async (id, data) => {
    return api.put(`/rulesets/${id}`, data);
  },
  delete: async (id) => {
    return api.delete(`/rulesets/${id}`);
  },
  toggle: async (id) => {
    return api.patch(`/rulesets/${id}/toggle`);
  },
  execute: async (id) => {
    return api.post(`/rulesets/${id}/execute`);
  },
  preview: async (id) => {
    return api.post(`/rulesets/${id}/preview`);
  },
  getHistory: async (id, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/rulesets/${id}/history?${query}`);
  },
  getExecutionDetails: async (logId) => {
    return api.get(`/rulesets/history/${logId}`);
  },
  duplicate: async (id) => {
    return api.post(`/rulesets/${id}/duplicate`);
  },
  executeForAsins: async (selectedAsins) => {
    return api.post('/rulesets/execute-for-asins', { selectedAsins });
  }
};

export const taskApi = {
    getAll: async (params = {}) => {
        return api.get('/tasks', params);
    },
    generate: async (asinIds) => {
        return api.post('/tasks/generate', { asinIds });
    },
    updateStatus: async (taskId, status, remarks) => {
        return api.put(`/tasks/${taskId}/status`, { status, remarks });
    },
    assign: async (taskId, userId) => {
        return api.put(`/tasks/${taskId}/assign`, { userId });
    },
    delete: async (taskId) => {
        return api.delete(`/tasks/${taskId}`);
    }
};

export const exportApi = {
    startExport: async (params) => {
        const res = await fetch(`${API_BASE}/export/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify(params),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || error.message || 'Export failed');
        }
        return res.json();
    },
    startGmsExport: async (params) => {
        const res = await fetch(`${API_BASE}/export/start-gms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify(params),
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.error || error.message || 'Export failed');
        }
        return res.json();
    },
    getDownloads: async () => {
        const res = await fetch(`${API_BASE}/export/downloads`, {
            headers: { ...getAuthHeader() }
        });
        if (!res.ok) throw new Error('Failed to fetch downloads');
        return res.json();
    },
    getFields: async () => {
        const res = await fetch(`${API_BASE}/export/fields`, {
            headers: { ...getAuthHeader() }
        });
        if (!res.ok) throw new Error('Failed to fetch export fields');
        return res.json();
    },
    getExportStatus: async (id) => {
        const res = await fetch(`${API_BASE}/export/status/${id}`, {
            headers: { ...getAuthHeader() }
        });
        if (!res.ok) throw new Error('Failed to fetch export status');
        return res.json();
    },
    downloadFile: async (id) => {
        const res = await fetch(`${API_BASE}/export/download/${id}`, {
            headers: { ...getAuthHeader() }
        });
        if (!res.ok) throw new Error('Download failed or file not ready');
        return res.blob();
    }
};

export const adsApi = {
    getAdsManagerData: async (params = {}) => {
        const cleanParams = Object.entries(params).reduce((acc, [key, val]) => {
            if (val !== undefined && val !== null && val !== '') acc[key] = val;
            return acc;
        }, {});
        return api.get('/data/ads-manager', cleanParams);
    },
    exportAdsManagerData: async (params = {}) => {
        const cleanParams = Object.entries(params).reduce((acc, [key, val]) => {
            if (val !== undefined && val !== null && val !== '') acc[key] = val;
            return acc;
        }, {});
        return api.post('/export/start-ads', cleanParams);
    }
};

export const targetsApi = {
    getAll: async () => {
        return cachedFetch('targets', async () => {
            const res = await fetch(`${API_BASE}/targets`, { headers: { ...getAuthHeader() } });
            if (!res.ok) throw new Error('Failed to fetch targets');
            return res.json();
        }, 60 * 1000); // 1 min TTL
    },
    create: async (targets) => {
        const res = await fetch(`${API_BASE}/targets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ targets })
        });
        if (!res.ok) throw new Error('Failed to save targets');
        invalidateCachePattern('targets');
        return res.json();
    },
    update: async (targetId, totalTargetValue, breakdowns, opts = {}) => {
        const res = await fetch(`${API_BASE}/targets`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ targetId, totalTargetValue, breakdowns }),
            signal: opts.signal
        });
        if (!res.ok) throw new Error('Failed to update target');
        invalidateCachePattern('targets');
        return res.json();
    },
    updateBulk: async (updates) => {
        const res = await fetch(`${API_BASE}/targets`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ updates })
        });
        if (!res.ok) throw new Error('Failed to update targets');
        invalidateCachePattern('targets');
        return res.json();
    },
    updateAchievements: async (updates) => {
        const res = await fetch(`${API_BASE}/targets/achievements`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ updates })
        });
        if (!res.ok) throw new Error('Failed to save overrides');
        invalidateCachePattern('targets');
        return res.json();
    },
    delete: async (id) => {
        const res = await fetch(`${API_BASE}/targets/${id}`, {
            method: 'DELETE',
            headers: { ...getAuthHeader() }
        });
        if (!res.ok) throw new Error('Failed to delete target');
        invalidateCachePattern('targets');
        return res.json();
    },
    deleteBulk: async (ids) => {
        const res = await fetch(`${API_BASE}/targets/bulk`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ ids })
        });
        if (!res.ok) throw new Error('Failed to delete selected targets');
        invalidateCachePattern('targets');
        return res.json();
    }
};

export const gmsApi = {
  upload: async (file, date, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('date', date);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/upload/upload-gms`);
      
      const headers = getAuthHeader();
      Object.keys(headers).forEach(k => {
        xhr.setRequestHeader(k, headers[k]);
      });

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            resolve({ success: true });
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData.error || xhr.statusText || 'Upload failed'));
          } catch (e) {
            reject(new Error(xhr.statusText || 'Upload failed'));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });
  },

  getAll: async () => {
    const res = await fetch(`${API_BASE}/upload/gms-data`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch GMS data');
    return res.json();
  },

  clearAll: async () => {
    const res = await fetch(`${API_BASE}/upload/gms-clear`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to clear GMS data');
    return res.json();
  }
};
