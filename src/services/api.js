const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

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

  syncSellerAsins: async (sellerId) => {
    const res = await fetch(`${API_BASE}/market-sync/sync-all/${sellerId}`, {
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
    const query = new URLSearchParams(params).toString();
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
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/asins?${query}`, {
      headers: { ...getAuthHeader() }
    });
    if (!res.ok) throw new Error('Failed to fetch ASINs');
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

  getBySeller: async (sellerId) => {
    const res = await fetch(`${API_BASE}/asins/seller/${sellerId}`, {
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
};


const REVENUE_API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/revenue`;

export const dashboardApi = {
  getSummary: async (period = '30d') => {
    const res = await fetch(`${API_BASE}/dashboard?period=${period}`, {
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
    const query = new URLSearchParams(params).toString();
    const url = `${API_BASE}${endpoint}${query ? `?${query}` : ''}`;
    const res = await fetch(url, { headers: { ...getAuthHeader() } });
    if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
    return res.json();
  },
  post: async (endpoint, data = {}) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
    return res.json();
  },
  put: async (endpoint, data) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
    return res.json();
  },
  delete: async (endpoint) => {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
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
