const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Auth helper functions
const getAuthHeader = () => {
  const token = localStorage.getItem('authToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
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
    if (data.success) {
      localStorage.setItem('authToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.data.user));
    }
    return data;
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
  }
};

// User API
export const userApi = {
  getAll: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/users?${query}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },

  create: async (data) => {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to create user');
    }
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update user');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to delete user');
    return res.json();
  },

  toggleStatus: async (id) => {
    const res = await fetch(`${API_BASE}/users/${id}/toggle-status`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to toggle user status');
    return res.json();
  },

  resetPassword: async (id, newPassword) => {
    const res = await fetch(`${API_BASE}/users/${id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ newPassword }),
    });
    if (!res.ok) throw new Error('Failed to reset password');
    return res.json();
  },

  getManagers: async () => {
    const res = await fetch(`${API_BASE}/users/managers`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch managers');
    const data = await res.json();
    return data.data || [];
  },
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
    const res = await fetch(`${API_BASE}/roles/permissions`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch permissions');
    return res.json();
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
    const res = await fetch(`${API_BASE}/sellers?${query}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch sellers');
    return res.json();
  },

  getById: async (id) => {
    const res = await fetch(`${API_BASE}/sellers/${id}`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error('Failed to fetch seller');
    return res.json();
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
    return res.json();
  },

  update: async (id, data) => {
    const res = await fetch(`${API_BASE}/sellers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update seller');
    return res.json();
  },

  delete: async (id) => {
    const res = await fetch(`${API_BASE}/sellers/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to delete seller');
    return res.json();
  },

  import: async (sellers) => {
    const res = await fetch(`${API_BASE}/sellers/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ sellers }),
    });
    if (!res.ok) throw new Error('Failed to import sellers');
    return res.json();
  },

  seedDemo: async () => {
    const res = await fetch(`${API_BASE}/sellers/seed`, {
      method: 'POST',
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to seed demo data');
    return res.json();
  },
};

// ASIN API
export const asinApi = {
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

  getFilters: async () => {
    const res = await fetch(`${API_BASE}/asins/filters`, {
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
  }
};
