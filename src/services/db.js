// Database service for Revenue Calculator
// Calls the backend API for all operations

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta).env?.VITE_API_URL) || '/api';

/**
 * Initialize database connection
 */
export const initializeDatabase = async () => {
  console.log('[DB] Remote mode: MongoDB backend via API');
};

/**
 * Database Service Class
 */
class DatabaseService {
  /**
   * Make API request
   */
  async request(path, options = {}, fallback = null) {
    try {
      const token = localStorage.getItem('authToken');
      const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      };

      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          return fallback;
        }
        // For all other errors, try to parse body and throw a meaningful error
        let errMsg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          errMsg = body.message || body.error || errMsg;
        } catch (_) { /* ignore parse errors */ }
        throw new Error(errMsg);
      }
      return await res.json();
    } catch (error) {
      console.error(`[DB] Request failed for ${path}:`, error);
      // Re-throw if it's a real error (not just a network/parse issue on fallback paths)
      if (fallback === null) throw error;
      return fallback;
    }
  }

  // --- Auth & Config ---
  async login(email, password) {
    const user = await this.request(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      null
    );
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    }
    return null;
  }

  logout() {
    localStorage.removeItem('user');
  }

  getUser() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }

  getKeepaKey() {
    return localStorage.getItem('fba_keepa_key') || '';
  }

  saveKeepaKey(key) {
    localStorage.setItem('fba_keepa_key', key);
  }

  saveUser(user) {
    const existing = this.getUser();
    const merged = { ...(existing || {}), ...user };
    localStorage.setItem('user', JSON.stringify(merged));
  }

  // --- Referral Fees ---

  /**
   * @returns {Promise<ReferralFee[]>}
   */
  async getReferralFees() {
    return this.request('/fees/referral', {}, []);
  }

  /**
   * @param {ReferralFee | Omit<ReferralFee, 'id'>} fee
   */
  async saveReferralFee(fee) {
    const data = { ...fee, id: fee.id || crypto.randomUUID() };
    await this.request('/fees/referral', { method: 'POST', body: JSON.stringify(data) }, null);
  }

  /**
   * @param {Omit<ReferralFee, 'id'>[]} fees
   */
  async saveReferralFeesBulk(fees) {
    for (const fee of fees) {
      await this.saveReferralFee(fee);
    }
  }

  async deleteReferralFee(id) {
    await this.request(`/fees/referral/${id}`, { method: 'DELETE' }, null);
  }

  async clearReferralFees() {
    await this.request('/fees/referral/all', { method: 'DELETE' }, null);
  }

  // --- Closing Fees ---

  /**
   * @returns {Promise<ClosingFee[]>}
   */
  async getClosingFees() {
    return this.request('/fees/closing', {}, []);
  }

  /**
   * @param {ClosingFee | Omit<ClosingFee, 'id'>} fee
   */
  async saveClosingFee(fee) {
    const data = { ...fee, id: fee.id || crypto.randomUUID() };
    await this.request('/fees/closing', { method: 'POST', body: JSON.stringify(data) }, null);
  }

  /**
   * @param {Omit<ClosingFee, 'id'>[]} fees
   */
  async saveClosingFeesBulk(fees) {
    for (const fee of fees) {
      await this.saveClosingFee(fee);
    }
  }

  async deleteClosingFee(id) {
    await this.request(`/fees/closing/${id}`, { method: 'DELETE' }, null);
  }

  async clearClosingFees() {
    await this.request('/fees/closing/all', { method: 'DELETE' }, null);
  }

  // --- Shipping Fees ---

  /**
   * @returns {Promise<ShippingFee[]>}
   */
  async getShippingFees() {
    return this.request('/fees/shipping', {}, []);
  }

  /**
   * @param {ShippingFee | Omit<ShippingFee, 'id'>} fee
   */
  async saveShippingFee(fee) {
    const data = { ...fee, id: fee.id || crypto.randomUUID() };
    await this.request('/fees/shipping', { method: 'POST', body: JSON.stringify(data) }, null);
  }

  /**
   * @param {Omit<ShippingFee, 'id'>[]} fees
   */
  async saveShippingFeesBulk(fees) {
    for (const fee of fees) {
      await this.saveShippingFee(fee);
    }
  }

  async deleteShippingFee(id) {
    await this.request(`/fees/shipping/${id}`, { method: 'DELETE' }, null);
  }

  async clearShippingFees() {
    await this.request('/fees/shipping/all', { method: 'DELETE' }, null);
  }

  // --- Storage Fees ---

  /**
   * @returns {Promise<StorageFee[]>}
   */
  async getStorageFees() {
    return this.request('/fees/storage', {}, []);
  }

  /**
   * @param {StorageFee | Omit<StorageFee, 'id'>} fee
   */
  async saveStorageFee(fee) {
    const data = { ...fee, id: fee.id || crypto.randomUUID() };
    await this.request('/fees/storage', { method: 'POST', body: JSON.stringify(data) }, null);
  }

  async deleteStorageFee(id) {
    await this.request(`/fees/storage/${id}`, { method: 'DELETE' }, null);
  }

  // --- Category Mapping ---

  /**
   * @returns {Promise<CategoryMap[]>}
   */
  async getCategoryMappings() {
    return this.request('/mappings', {}, []);
  }

  /**
   * @param {CategoryMap | Omit<CategoryMap, 'id'>} map
   */
  async saveCategoryMapping(map) {
    const data = { ...map, id: map.id || crypto.randomUUID() };
    await this.request('/mappings', { method: 'POST', body: JSON.stringify(data) }, null);
  }

  async deleteCategoryMapping(id) {
    await this.request(`/mappings/${id}`, { method: 'DELETE' }, null);
  }

  async clearCategoryMappings() {
    await this.request('/mappings/all', { method: 'DELETE' }, null);
  }

  // --- Node Map ---

  /**
   * @returns {Promise<NodeMap[]>}
   */
  async getNodeMaps() {
    return this.request('/nodemaps', {}, []);
  }

  /**
   * @param {NodeMap | Omit<NodeMap, 'id'>} map
   */
  async saveNodeMap(map) {
    const data = { ...map, id: map.id || crypto.randomUUID() };
    await this.request('/nodemaps', { method: 'POST', body: JSON.stringify(data) }, null);
  }

  async deleteNodeMap(id) {
    await this.request(`/nodemaps/${id}`, { method: 'DELETE' }, null);
  }

  async clearNodeMaps() {
    await this.request('/nodemaps/all', { method: 'DELETE' }, null);
  }

  // --- ASINs ---

  /**
   * @returns {Promise<AsinItem[]>}
   */
  async getAsins(params = {}) {
    return this.request('/asins', { params }, []);
  }

  /**
   * @param {{ asin: string; stapleLevel: any }[]} items
   */
  async addAsinsBulk(items) {
    const payload = items.map((item) => ({
      ...item,
      status: 'pending',
      stepLevel: 'Standard',
      createdAt: new Date().toISOString(),
    }));
    await this.request('/asins/bulk', { method: 'POST', body: JSON.stringify(payload) }, null);
  }

  async updateMissingStepLevels() {
    const items = await this.getAsins();
    const missing = items.filter((i) => !i.stepLevel);
    for (const item of missing) {
      await this.updateAsin(item.id, { stepLevel: 'Standard' });
    }
    return missing.length;
  }

  /**
   * @param {string} id
   * @param {Partial<AsinItem>} updates
   */
  async updateAsin(id, updates) {
    await this.request(`/asins/${id}`, { method: 'PUT', body: JSON.stringify(updates) }, null);
  }

  async clearAsins() {
    await this.request('/asins', { method: 'DELETE' }, null);
  }

  async deleteAsin(id) {
    await this.request(`/asins/${id}`, { method: 'DELETE' }, null);
  }

  // --- Refund Fees ---

  /**
   * @returns {Promise<RefundFee[]>}
   */
  async getRefundFees() {
    return this.request('/fees/refund', {}, []);
  }

  /**
   * @param {RefundFee | Omit<RefundFee, 'id'>} fee
   */
  async saveRefundFee(fee) {
    const data = { ...fee, id: fee.id || crypto.randomUUID() };
    await this.request('/fees/refund', { method: 'POST', body: JSON.stringify(data) }, null);
  }

  async deleteRefundFee(id) {
    await this.request(`/fees/refund/${id}`, { method: 'DELETE' }, null);
  }

  async clearRefundFees() {
    await this.request('/fees/refund/all', { method: 'DELETE' }, null);
  }

  // --- Calculation ---
  async calculateProfits(asinIds = []) {
    await this.request('/revenue/calculate', { method: 'POST', body: JSON.stringify({ asinIds }) }, null);
  }


  // --- ASINs ---

  /**
   * Get all ASINs
   * @returns {Promise<ASIN[]>}
   */
  async getAsins(params = {}) {
    return this.request('/asins', { params }, []);
  }

  /**
   * Get single ASIN
   * @param {string} id
   * @returns {Promise<ASIN>}
   */
  async getAsin(id) {
    return this.request(`/asins/${id}`, {}, null);
  }

  /**
   * Create or Update ASIN
   * @param {Partial<ASIN>} asin
   */
  async saveAsin(asin) {
    if (asin.id || asin._id) {
      const id = asin.id || asin._id;
      return this.request(`/asins/${id}`, { method: 'PUT', body: JSON.stringify(asin) }, null);
    } else {
      return this.request('/asins', { method: 'POST', body: JSON.stringify(asin) }, null);
    }
  }

  /**
   * Delete ASIN
   * @param {string} id
   */
  async deleteAsin(id) {
    return this.request(`/asins/${id}`, { method: 'DELETE' }, null);
  }

  // --- Actions ---

  /**
   * Get all actions
   * @returns {Promise<Action[]>}
   */
  async getActions() {
    return this.request('/actions', {}, []);
  }

  /**
   * Create a new action
   * @param {Partial<Action>} action
   */
  async createAction(action) {
    return this.request('/actions', { method: 'POST', body: JSON.stringify(action) }, null);
  }

  /**
   * Update an action
   * @param {string} id
   * @param {Partial<Action>} updates
   */
  async updateAction(id, updates) {
    return this.request(`/actions/${id}`, { method: 'PUT', body: JSON.stringify(updates) }, null);
  }

  /**
   * Generate bulk auto-tasks from ASIN analysis
   */
  async generateBulkActions(options = {}) {
    return this.request('/actions/bulk-from-analysis', { 
      method: 'POST', 
      body: JSON.stringify(options) 
    }, null);
  }

  /**
   * Delete an action
   * @param {string} id
   */
  async deleteAction(id) {
    return this.request(`/actions/${id}`, { method: 'DELETE' }, null);
  }

  /**
   * Get action instructions (AI generated)
   */
  async getActionInstructions(id) {
    return this.request(`/actions/${id}/instructions`, { method: 'GET' }, null);
  }

  /**
   * Add a message to an action
   * @param {string} actionId
   * @param {string} content
   */
  async addMessage(actionId, content) {
    return this.request(`/actions/${actionId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }, null);
  }

  /**
   * Get all users (for assignment)
   * @returns {Promise<User[]>}
   */
  async getUsers() {
    return this.request('/users', {}, []);
  }

  /**
   * Get all sellers
   * @returns {Promise<Seller[]>}
   */
  async getSellers() {
    return this.request('/sellers', {}, []);
  }

  // --- NEW: Workflow Actions ---

  /**
   * Start a task
   * @param {string} actionId
   */
  async startAction(actionId) {
    return this.request(`/actions/${actionId}/start`, { method: 'POST' }, null);
  }

  /**
   * Complete a task
   * @param {string} actionId
   * @param {object} completionData - { remarks, stage, recurring, audioTranscript }
   */
  async completeAction(actionId, completionData) {
    return this.request(`/actions/${actionId}/complete`, {
      method: 'POST',
      body: JSON.stringify(completionData)
    }, null);
  }

  /**
   * Upload audio for task completion
   * @param {string} actionId
   * @param {Blob} audioBlob
   * @param {string} transcript
   */
  async uploadAudio(actionId, audioBlob, transcript) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    if (transcript) {
      formData.append('transcript', transcript);
    }

    try {
      const res = await fetch(`${API_BASE}/actions/${actionId}/upload-audio`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error(`[DB] Audio upload failed:`, error);
      return null;
    }
  }

  /**
   * Get action history (stage transitions)
   * @param {string} actionId
   */
  async getActionHistory(actionId) {
    return this.request(`/actions/${actionId}/history`, {}, null);
  }

  /**
   * Analyze ASIN and get suggested actions
   * @param {string} asinId
   */
  async analyzeAsin(asinId) {
    return this.request(`/actions/analyze-asin/${asinId}`, { method: 'POST' }, null);
  }

  /**
   * Create actions from ASIN analysis
   * @param {string} asinId
   */
  async createActionsFromAnalysis(asinId) {
    return this.request(`/actions/create-from-analysis/${asinId}`, { method: 'POST' }, null);
  }

  /**
   * Bulk create grouped actions from ASIN analysis
   */
  async createBulkActionsFromAnalysis(asinIds = []) {
    return this.request('/actions/bulk-create-from-analysis', { 
      method: 'POST', 
      body: JSON.stringify({ asinIds }) 
    }, null);
  }

  /**
   * Get overdue actions
   */
  async getOverdueActions() {
    return this.request('/actions/reports/overdue', {}, []);
  }

  /**
   * Get Goal vs Achievement report
   */
  async getGoalAchievementReport(timeframe = '30', startDate = null, endDate = null) {
    let url = '/actions/reports/goal-achievement';
    const params = new URLSearchParams();
    if (startDate && endDate) {
      params.append('startDate', startDate);
      params.append('endDate', endDate);
    } else if (timeframe) {
      params.append('timeframe', timeframe);
    }
    const query = params.toString();
    return this.request(`${url}${query ? `?${query}` : ''}`, {}, null);
  }

  // --- Action Review Workflow ---

  async startAction(id) {
    return this.request(`/actions/${id}/start`, { method: 'POST' }, null);
  }

  async submitActionForReview(id, formData) {
    // Check if formData is instance of FormData (for audio uploads)
    const isFormData = formData instanceof FormData;

    const options = {
      method: 'POST',
      body: isFormData ? formData : JSON.stringify(formData)
    };

    // If it's FormData, let the browser set the boundary header
    if (isFormData) {
      const token = localStorage.getItem('authToken');
      options.headers = {
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      // Important: Remove default Content-Type to let fetch set it with boundary
      return fetch(`${API_BASE}/actions/${id}/submit-review`, options)
        .then(res => res.json())
        .catch(err => {
          console.error('[DB] Submit for review failed:', err);
          return null;
        });
    }

    return this.request(`/actions/${id}/submit-review`, options, null);
  }

  async reviewAction(id, decisionOrData, comments) {
    let payload;
    if (typeof decisionOrData === 'object' && decisionOrData !== null) {
      payload = decisionOrData;
    } else {
      payload = { decision: decisionOrData, comments };
    }

    return this.request(`/actions/${id}/review-action`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }, null);
  }

  // --- OKR Methods ---

  /**
   * Get all objectives
   */
  async getObjectives() {
    return this.request('/objectives', {}, []);
  }

  /**
   * Get all goals (synonym for objectives in some contexts, or specific to GMS)
   */
  async getGoals() {
    return this.request('/goals', {}, []);
  }

  /**
   * Get goals filtered by brand
   */
  async getBrandGoals(brandId) {
    if (!brandId) return this.getGoals();
    return this.request(`/goals/brand/${brandId}`, {}, []);
  }

  /**
   * Create a new goal
   */
  async createGoal(goalData) {
    return this.request('/goals', { method: 'POST', body: JSON.stringify(goalData) }, null);
  }

  /**
   * Get all task templates
   */
  async getTaskTemplates() {
    return this.request('/actions/templates', {}, []);
  }

  /**
   * Create a new task template
   * @param {object} template
   */
  async createTemplate(template) {
    return this.request('/actions/templates', { method: 'POST', body: JSON.stringify(template) }, null);
  }

  /**
   * Update a task template
   * @param {string} id
   * @param {object} updates
   */
  async updateTemplate(id, updates) {
    return this.request(`/actions/templates/${id}`, { method: 'PUT', body: JSON.stringify(updates) }, null);
  }

  /**
   * Delete a task template
   * @param {string} id
   */
  async deleteTemplate(id) {
    return this.request(`/actions/templates/${id}`, { method: 'DELETE' }, null);
  }

  // --- Goal Templates Methods ---

  /**
   * Get all goal templates
   */
  async getGoalTemplates() {
    return this.request('/actions/goal-templates', {}, []);
  }

  /**
   * Create a new goal template
   * @param {object} template
   */
  async createGoalTemplate(template) {
    return this.request('/actions/goal-templates', { method: 'POST', body: JSON.stringify(template) }, null);
  }

  /**
   * Update a goal template
   * @param {string} id
   * @param {object} updates
   */
  async updateGoalTemplate(id, updates) {
    return this.request(`/actions/goal-templates/${id}`, { method: 'PUT', body: JSON.stringify(updates) }, null);
  }

  /**
   * Delete a goal template
   * @param {string} id
   */
  async deleteGoalTemplate(id) {
    return this.request(`/actions/goal-templates/${id}`, { method: 'DELETE' }, null);
  }

  /**
   * Create a new objective
   * @param {object} objective
   */
  async createObjective(objective) {
    return this.request('/objectives', { method: 'POST', body: JSON.stringify(objective) }, null);
  }

  /**
   * Create a new key result
   * @param {object} keyResult
   */
  async createKeyResult(keyResult) {
    return this.request('/objectives/key-results', { method: 'POST', body: JSON.stringify(keyResult) }, null);
  }

  /**
   * Update an objective
   */
  async updateObjective(id, objective) {
    return this.request(`/objectives/${id}`, { method: 'PUT', body: JSON.stringify(objective) }, null);
  }

  /**
   * Delete an objective
   */
  async deleteObjective(id) {
    return this.request(`/objectives/${id}`, { method: 'DELETE' }, null);
  }

  /**
   * Update a key result
   */
  async updateKeyResult(id, keyResult) {
    return this.request(`/objectives/key-results/${id}`, { method: 'PUT', body: JSON.stringify(keyResult) }, null);
  }

  /**
   * Delete a key result
   */
  async deleteKeyResult(id) {
    return this.request(`/objectives/key-results/${id}`, { method: 'DELETE' }, null);
  }

  /**
   * Synchronize key result progress
   */
  async syncKeyResult(id) {
    return this.request(`/objectives/key-results/${id}/sync`, { method: 'POST' }, null);
  }

  /**
   * Delete an action (task) by ID
   */
  async deleteAction(id) {
    return this.request(`/actions/${id}`, { method: 'DELETE' }, null);
  }

  /**
   * Delete ALL actions (admin only)
   */
  async deleteAllActions() {
    return this.request(`/actions/bulk-delete-all`, { method: 'DELETE' }, null);
  }

  /**
   * Delete ALL objectives, key results, and actions (admin only)
   */
  async deleteAllObjectives() {
    return this.request(`/objectives/bulk-delete-all`, { method: 'DELETE' }, null);
  }

  // --- AI Methods ---

  /**
   * Generate OKR structure using AI
   * @param {object} params - { prompt, type, industry }
   */
  async generateAIOKR(params) {
    return this.request('/ai/generate-okr', { method: 'POST', body: JSON.stringify(params) }, null);
  }

  /**
   * Get AI suggestions for tasks
   * @param {string} context - Goal or KR context
   */
  async getAISuggestions(context) {
    return this.request('/ai/suggest-tasks', { method: 'POST', body: JSON.stringify({ context }) }, null);
  }

  /**
   * Generate recovery tasks for a specific objective/goal
   * @param {string} objectiveId 
   */
  async generateRecoveryTasks(objectiveId) {
    return this.request('/ai/generate-recovery-tasks', { 
      method: 'POST', 
      body: JSON.stringify({ objectiveId }) 
    }, null);
  }

  /**
   * Get all system settings
   * @param {string} group - Optional group to filter by
   */
  async getSettings(group) {
    const data = await this.request(`/settings${group ? `?group=${group}` : ''}`, {}, { success: true, data: {} });
    return data.data;
  }

  /**
   * Update system settings
   * @param {object} settings - Key-value pair of settings
   * @param {string} group - Group name
   */
  async updateSettings(settings, group = 'general') {
    return this.request('/settings/update', {
      method: 'POST',
      body: JSON.stringify({ settings, group })
    }, null);
  }

  /**
   * Get setting by key
   * @param {string} key
   */
  async getSettingByKey(key) {
    const data = await this.request(`/settings/${key}`, {}, { success: true, data: null });
    return data.data;
  }

  /**
   * Get system activity logs
   */
  async getSystemLogs() {
    return this.request('/logs', { method: 'GET' }, null);
  }
}

export const db = new DatabaseService();
