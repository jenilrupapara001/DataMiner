const axios = require('axios');
const { sql, getPool, generateId, query } = require('../database/db');
const config = require('../config/env');
const imageGenerationService = require('./imageGenerationService');
const { JSDOM } = require('jsdom');
const SocketService = require('./socketService');
const nvidiaAiService = require('./nvidiaAiService');
const { MemorySafeProcessor, clearArray } = require('../utils/memorySafe');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');
const { calculateLQS, calculateCDQ, getGrade, getCDQBreakdown } = require('../utils/lqs');
const listingQualityService = require('./listingQualityService');

// Amazon India Top-Level Categories for BSR classification
const AMAZON_TOP_LEVEL_CATEGORIES = [
    'Clothing & Accessories',
    'Electronics',
    'Home & Kitchen',
    'Beauty',
    'Health & Personal Care',
    'Grocery & Gourmet Foods',
    'Toys & Games',
    'Baby Products',
    'Watches',
    'Shoes & Handbags',
    'Jewellery',
    'Sports, Fitness & Outdoors',
    'Books',
    'Kindle Store',
    'Video Games',
    'Software',
    'Office Products',
    'Pet Supplies',
    'Car & Motorbike',
    'Industrial & Scientific',
    'Home Improvement',
    'Garden & Outdoors',
    'Musical Instruments',
    'Bags, Wallets and Luggage',
    'Computers & Accessories',
    'All Electronics',
    'Clothing, Shoes & Jewelry',
    'Health, Household & Personal Care'
];


// Initialize memory-safe processor
const memProcessor = new MemorySafeProcessor({
    batchSize: 50,
    delay: 50,
    maxMemoryPercent: 70
});

/**
 * Discreet service for syncing market data from external provider.
 * Consolidated from OctoparseAutomationService and MarketDataSyncService.
 */
class MarketDataSyncService {
    constructor() {
        this.baseUrl = process.env.OCTOPARSE_BASE_URL || 'https://openapi.octoparse.com';
        this.masterTaskId = process.env.OCTOPARSE_MASTER_TASK_ID;
        this.groupId = process.env.OCTOPARSE_GROUP_ID;
        this.token = null;
        this.tokenExpiry = null;
        this.tokenType = 'Bearer';
        this.syncLocks = new Map(); // Concurrency control per sellerId
        this.statusCache = new Map(); // Simple status cache to prevent 429s (TTL: 10s)

        // Throttling for setup operations
        this._executingSetups = 0;
        this._maxConcurrentSetups = 3;
        this._setupQueue = [];
    }

    /**
     * Internal semaphore to control concurrent API-heavy operations (Inject/Start)
     */
    async _acquireSetupLock() {
        if (this._executingSetups < this._maxConcurrentSetups) {
            this._executingSetups++;
            return;
        }
        return new Promise(resolve => {
            this._setupQueue.push(resolve);
        });
    }

    _releaseSetupLock() {
        this._executingSetups--;
        if (this._setupQueue.length > 0) {
            this._executingSetups++;
            const next = this._setupQueue.shift();
            next();
        }
    }

    async wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, Object.keys(data).length ? JSON.stringify(data) : '');
    }

    async validateMasterTask() {
        if (!this.masterTaskId) {
            throw new Error('OCTOPARSE_MASTER_TASK_ID not configured in environment');
        }
        return true;
    }

    async ensureTaskForSeller(sellerId) {
        const pool = await getPool();
        const sellerResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query('SELECT Id, Name, OctoparseId FROM Sellers WHERE Id = @sellerId');

        const seller = sellerResult.recordset[0];
        if (!seller) {
            throw new Error(`Seller not found: ${sellerId}`);
        }

        if (seller.OctoparseId) {
            this.log('info', `Seller ${seller.Name} already has task: ${seller.OctoparseId}`);
            return seller.OctoparseId;
        }

        // Validate master task configuration before cloning
        await this.validateMasterTask();

        const asinsResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND Status = 'Active'");

        if (asinsResult.recordset.length === 0) {
            throw new Error(`No active ASINs found for seller: ${sellerId}`);
        }

        // Use the consolidated duplicateTask method
        const newTaskId = await this.duplicateTask(seller.Name);

        await pool.request()
            .input('newTaskId', sql.VarChar, newTaskId)
            .input('sellerId', sql.VarChar, sellerId)
            .query('UPDATE Sellers SET OctoparseId = @newTaskId, UpdatedAt = GETDATE() WHERE Id = @sellerId');

        this.log('info', `Created new Octoparse task ${newTaskId} for seller ${seller.Name}`);
        return newTaskId;
    }

    /**
     * Checks if the service is configured with credentials.
     */
    isConfigured() {
        const username = process.env.MARKET_SYNC_USERNAME;
        const password = process.env.MARKET_SYNC_PASSWORD;
        
        // Strictly use username/password flow for generating Access Tokens
        return !!(username && password &&
            username !== 'demo-provider' &&
            password !== 'demo-pass');
    }

    /**
     * Handles OAuth2.0 authentication with the data provider.
     */
    async authenticate() {
        // TOKEN CACHING: Only fetch a new token if the current one is missing or expiring within 5 minutes
        const now = Date.now();
        if (this.token && this.tokenExpiry && (this.tokenExpiry - now > 5 * 60 * 1000)) {
            return this.token;
        }

        const username = process.env.MARKET_SYNC_USERNAME;
        const password = process.env.MARKET_SYNC_PASSWORD;

        if (!username || !password) {
            throw new Error('MARKET_SYNC_USERNAME or MARKET_SYNC_PASSWORD not configured in .env');
        }

        try {
            console.log(`🔄 Authenticating with Octoparse for ${username}... (Cache miss/expiry)`);
            const response = await axios.post(`${this.baseUrl}/token`, {
                username: username,
                password: password,
                grant_type: 'password'
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            const data = response.data;
            // Octoparse response can be { access_token: "..." } or { data: { access_token: "..." } }
            this.token = data.access_token || data.data?.access_token;

            if (!this.token) {
                throw new Error(`Authentication failed: No access token returned`);
            }

            // Update internal state - default 1 hour if not provided
            this.tokenExpiry = now + ((data.expires_in || 3600) * 1000);
            console.log(`✅ Authentication successful. Token secured (Expires in ${Math.round((data.expires_in || 3600) / 60)}m).`);

            return this.token;
        } catch (error) {
            console.error('❌ Octoparse Authentication Error:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Octoparse service.');
        }
    }

    /**
     * Updates the dynamic ASIN list (URL/Text Loop) for a task with chunking for large lists.
     */
    /**
     * Update task URLs using the Professional/Enterprise file upload method.
     * Replaces existing URLs with the contents of the file.
     * @param {string} taskId The task ID to update
     * @param {string[]} urls Array of full URLs to inject
     */
    async updateTaskUrlsWithFile(taskId, items, retryCount = 0) {
        if (!taskId) throw new Error('Task ID is required for URL injection');
        if (!items || items.length === 0) return true;

        const maxRetries = 2;

        const token = await this.authenticate();

        // 1. Normalize and clean input (strictly one URL per line, no duplicates)
        // Correctly formats ASINs to full Amazon.in URLs if they aren't already
        const uniqueUrls = [...new Set(items.map(item => {
            if (typeof item !== 'string') return '';
            const t = item.trim();
            if (t.startsWith('http')) return t;
            if (t.length === 10) return `https://www.amazon.in/dp/${t}`;
            return t;
        }).filter(Boolean))];

        try {
            console.log(`📂 Injecting ${uniqueUrls.length} items via Octoparse FILE method for task: ${taskId}`);

            // 2. Create FormData and Blob (Standard Multipart approach)
            // Note: Uses Node.js 18+ global FormData and Blob compatibility
            const formData = new FormData();
            formData.append('taskId', taskId);

            // Standard Octoparse URL file format: one URL per line
            const blob = new Blob([uniqueUrls.join('\n')], { type: 'text/plain' });

            // Field mapping: 'taskId' (string) and 'file' (File)
            formData.append('file', blob, 'sync_urls.txt');

            const response = await axios.post(`${this.baseUrl}/task/urls:file`, formData, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // 3. Official Status Handling
            if (response.data && (response.data.requestId || response.data.data === null)) {
                console.log(`✅ File-based injection successful for task: ${taskId}`);
                return true;
            }

            throw new Error(`Unexpected provider response: ${JSON.stringify(response.data)}`);
        } catch (error) {
            const errorData = error.response?.data;
            const provError = errorData?.error || {};

            // RETRY LOGIC for TaskExecuting (400) and FileProcessing errors
            if ((provError.code === 'TaskExecuting' ||
                provError.code === 'FileProcessing' ||
                errorData?.message === 'TaskExecuting' ||
                errorData?.message === 'FileProcessing') && retryCount < maxRetries) {
                console.warn(`⏳ Task is in transition state (${provError.code || errorData?.message}). Retrying injection in 15s... (Attempt ${retryCount + 1}/${maxRetries})`);
                await this.wait(15000);
                return this.updateTaskUrlsWithFile(taskId, items, retryCount + 1); // Retry with count
            }

            console.error('❌ Octoparse File Injection Error:', {
                code: provError.code,
                message: provError.message,
                requestId: errorData?.requestId || error.response?.headers?.['x-request-id']
            });

            // Handle specific spec errors
            if (provError.code === 'PermissionDenied') {
                console.warn('⚠️ Restricted Feature: File injection requires a Professional or Enterprise account.');
            } else if (provError.code === 'InvalidTaskId') {
                console.error('⚠️ The provided Task ID is not recognized by the provider.');
            }

            throw error;
        }
    }

    /**
     * @deprecated Use syncSellerAsinsToOctoparse instead.
     * This method is kept for legacy compatibility but redirected to the robust sync-all.
     */
    async triggerSync(taskId, parameters) {
        try {
            const pool = await getPool();
            const sellerResult = await pool.request()
                .input('taskId', sql.NVarChar, taskId)
                .query('SELECT Id, Name FROM Sellers WHERE OctoparseId = @taskId');

            const seller = sellerResult.recordset[0];
            if (!seller) {
                console.warn(`⚠️ triggerSync called for unknown task ${taskId}. Falling back to standard cloud start.`);
                return await this.startCloudExtraction(taskId);
            }

            console.log(`🔄 Redirecting legacy triggerSync for seller ${seller.Name} to robust sync-all...`);
            const success = await this.syncSellerAsinsToOctoparse(seller.Id, { triggerScrape: true });
            return { success, taskId };
        } catch (error) {
            console.error('❌ Legacy Trigger Sync Error:', error.message);
            throw error;
        }
    }

    /**
     * Duplicates a master template task for a new seller.
     * @param {string} taskName - Name for the new task (e.g. "Sakul Collection Sync")
     */
    async duplicateTask(taskName) {
        const token = await this.authenticate();
        const masterTaskId = process.env.OCTOPARSE_MASTER_TASK_ID;
        let groupId = process.env.OCTOPARSE_GROUP_ID;
        const groupName = process.env.OCTOPARSE_GROUP_NAME;

        if (!masterTaskId) throw new Error('OCTOPARSE_MASTER_TASK_ID is not configured in .env');

        try {
            // Find Group ID by Name if ID is not provided but Name is
            if (!groupId && groupName) {
                console.log(`🔍 Finding Octoparse Group ID for: ${groupName}...`);
                const groups = await this.getTaskGroupList();

                if (Array.isArray(groups)) {
                    const group = groups.find(g =>
                        (g.categoryName && g.categoryName === groupName) ||
                        (g.name && g.name === groupName) ||
                        (g.taskGroupName && g.taskGroupName === groupName)
                    );

                    if (group) {
                        groupId = group.categoryId || group.id || group.taskGroupId;
                        console.log(`✅ Found Group ID: ${groupId} for "${groupName}"`);
                    }
                }
            }

            // Method 1: Discovery via Master Task ID (Robust Fallback)
            if (!groupId) {
                console.log(`🔍 Attempting Method 1 discovery for Master Task: ${masterTaskId}`);
                groupId = await this.findTaskGroupIdForTask(masterTaskId);
            }

            console.log(`📋 Duplicating Octoparse Master Template: ${masterTaskId} ... (Group: ${groupId || 'Root'})`);

            // Resolve UUID to Integer ID (Required for some body-based Octoparse v2 endpoints)
            let masterTaskIntId = masterTaskId;
            try {
                const resolvedId = await this.resolveTaskIdToInteger(masterTaskId, groupId);
                if (resolvedId) {
                    console.log(`🔢 Resolved Master UUID ${masterTaskId} to Integer ID: ${resolvedId}`);
                    masterTaskIntId = resolvedId;
                }
            } catch (e) {
                console.warn(`⚠️ Could not resolve master task to integer ID, falling back to UUID: ${e.message}`);
            }

            // 1. Prioritize Modern /task/copy with JSON body as per documentation
            const endpoints = [
                {
                    url: `${this.baseUrl}/task/copy`,
                    method: 'POST',
                    body: {
                        taskId: masterTaskIntId,
                        taskGroupId: parseInt(groupId) || 0,
                        taskName: taskName
                    }
                },
                {
                    url: `${this.baseUrl}/task/copy?taskId=${masterTaskIntId}&taskGroupId=${groupId || 0}&taskName=${encodeURIComponent(taskName)}`,
                    method: 'POST',
                    body: {}
                },
                {
                    url: `${this.baseUrl}/task/duplicate`,
                    method: 'POST',
                    body: {
                        taskId: masterTaskIntId,
                        taskGroupId: parseInt(groupId) || 0,
                        taskName: taskName
                    }
                }
            ];

            let lastError = null;
            for (const ep of endpoints) {
                try {
                    console.log(`🧪 Trying duplication endpoint: ${ep.url}...`);
                    const response = await axios({
                        method: ep.method,
                        url: ep.url,
                        data: ep.body,
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                    });

                    if (response.data?.data?.taskId || response.data?.taskId) {
                        const newTaskId = response.data?.data?.taskId || response.data?.taskId;
                        console.log(`✅ Successfully created new task: ${taskName} (ID: ${newTaskId})`);
                        return newTaskId;
                    }

                    if (response.data.error || response.data.message?.includes('failed')) {
                        console.warn(`⚠️ Endpoint ${ep.url} failed: ${response.data.message || response.data.error}`);
                    }
                } catch (err) {
                    lastError = err.response?.data || err.message;
                    console.warn(`⚠️ Endpoint ${ep.url} 404/Error: ${JSON.stringify(lastError)}`);
                }
            }

            throw new Error(`All duplication endpoints failed. Last Error: ${JSON.stringify(lastError)}`);
        } catch (error) {
            console.error('❌ Final Duplicate Task Error:', error.message);
            throw error;
        }
    }

    async startCloudExtraction(taskId) {
        if (!taskId) throw new Error('Task ID is required for cloud extraction');

        const fs = require('fs');
        const path = require('path');
        const diagLogPath = path.join(process.cwd(), 'octoparse_sync_diagnostics.log');
        const logDiag = (msg) => {
            const entry = `[${new Date().toISOString()}] ${msg}\n`;
            fs.appendFileSync(diagLogPath, entry);
            console.log(msg);
        };

        logDiag(`🚀 Starting Mega Diagnostic for Task ID: ${taskId}`);
        const token = await this.authenticate();

        // 1. RESOLVE UUID TO INTEGER ID (Deep Resolution)
        let integerId = null;
        if (taskId.includes('-')) {
            logDiag(`🔍 Attempting to resolve UUID ${taskId} to Integer ID...`);

            // Try method 1: Task Details (Direct)
            try {
                const detailRes = await axios.get(`${this.baseUrl}/api/Task/GetTaskDetail`, {
                    params: { taskId },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (detailRes.data?.data?.TaskID) {
                    integerId = detailRes.data.data.TaskID;
                    logDiag(`✅ Resolved via Detail [Method 1]: ${integerId}`);
                }
            } catch (e) { /* next */ }

            // Try method 2: Deep Search in Groups (Paginated)
            if (!integerId) {
                integerId = await this.resolveTaskIdToInteger(taskId);
            }

            if (integerId) {
                logDiag(`✅ Final Resolved Integer ID: ${integerId}`);
            } else {
                logDiag(`⚠️ Could not resolve Integer ID. Diagnostics proceeding with UUID only.`);
            }
        }

        const baseUrls = [this.baseUrl, 'https://dataapi.octoparse.com', 'https://openapi.octoparse.cn'];

        let lastError = null;
        for (const base of baseUrls) {
            const currentId = integerId || taskId;
            const variants = [
                // Modern OpenAPI V3.0 (Correct path from OpenAPI spec)
                { name: 'OpenAPI V3 (POST /cloudextraction/start)', url: `${base}/cloudextraction/start`, method: 'post', data: { taskId } },
                { name: 'OpenAPI V3 (POST /cloudextraction/start UUID)', url: `${base}/cloudextraction/start`, method: 'post', data: { taskId: taskId } },

                // Legacy V1 (Standard/Enterprise)
                { name: 'Legacy V1 (POST Q Integer)', url: `${base}/api/CloudTask/StartTask?taskId=${currentId}`, method: 'post' },
                { name: 'Legacy V1 (GET UUID)', url: `${base}/api/CloudTask/StartTask`, method: 'get', params: { taskId } },
                { name: 'Legacy V1 (GET Integer)', url: `${base}/api/CloudTask/StartTask`, method: 'get', params: { taskId: currentId } },

                // Variation Handling (Casing & Lowercase Bearer)
                { name: 'V1 (GET Lowercase ID)', url: `${base}/api/CloudTask/StartTask`, method: 'get', params: { taskid: currentId } },
                { name: 'OpenAPI (POST Lowercase Bearer)', url: `${base}/cloudextraction/start`, method: 'post', data: { taskId }, lowerBearer: true },
                { name: 'V1 (GET Lowercase Bearer)', url: `${base}/api/CloudTask/StartTask`, method: 'get', params: { taskId: currentId }, lowerBearer: true },

                // V3 API Paths
                { name: 'V3 Task Start (POST Body)', url: `${base}/task/start`, method: 'post', data: { taskId: currentId } },
                { name: 'V3 Task Start (POST Query)', url: `${base}/task/start?taskId=${currentId}`, method: 'post', data: {} },

                // Advanced/AddRun
                { name: 'Advanced Trigger (AddRunTask)', url: `${base}/api/CloudTask/AddRunTask`, method: 'get', params: { taskId: currentId } }
            ];

            for (const v of variants) {
                try {
                    logDiag(`🔍 Trying ${v.name} at ${base}...`);
                    const response = await axios({
                        url: v.url,
                        method: v.method,
                        data: v.data,
                        params: v.params,
                        headers: {
                            'Authorization': v.lowerBearer ? `bearer ${token}` : `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 8000
                    });

                    const data = response.data || {};
                    const isSuccess = data.data === true || data.data === 1 || data.data?.lotNo || data.requestId;

                    if (isSuccess) {
                        logDiag(`✅ SUCCESS via ${v.name}! Response: ${JSON.stringify(data)}`);
                        return data.data || data;
                    }

                    logDiag(`⚠️ Server rejected ${v.name}: ${JSON.stringify(data)}`);
                    lastError = data;
                } catch (err) {
                    const status = err.response?.status;
                    const body = err.response?.data;
                    logDiag(`❌ ${v.name} Failed (${status}): ${JSON.stringify(body || err.message)}`);
                    lastError = body || err.message;
                }
            }
        }
        logDiag(`🛑 ALL VARIANTS FAILED for task ${taskId}.`);
        throw new Error(`Exhausted all 18 start variants. Check octoparse_sync_diagnostics.log for details.`);
    }

    /**
     * Fetch unexported results for a task.
     */
    async fetchTaskResults(taskId) {
        const token = await this.authenticate();
        const paths = [
            '/data/notexported',              // OpenAPI V3 spec
            '/data/all',                       // Get all data by offset
            '/api/notexporteddata/get',       // Legacy V1
            '/task/data/notexporteddata'       // Alternative
        ];

        let lastErr = null;
        for (const path of paths) {
            try {
                console.log(`📥 Trying Data Fetch at ${path} for task: ${taskId}...`);
                const response = await axios.get(`${this.baseUrl}${path}`, {
                    params: { taskId, size: '100' },
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.data?.data || Array.isArray(response.data)) {
                    const dataObj = response.data.data;
                    const dataList = dataObj?.data || dataObj?.current !== undefined ? dataObj : response.data;
                    return Array.isArray(dataList) ? dataList : [];
                }
            } catch (err) {
                lastErr = err.response?.data?.error?.message || err.message;
                console.warn(`⚠️ Path ${path} failed: ${lastErr}`);
            }
        }
        throw new Error(`Failed to fetch results from any known Octoparse endpoint: ${lastErr}`);
    }

    /**
     * Map Octoparse JSON results to the ASIN model and update dashboard.
     */
    async processAndMapResults(sellerId, results) {
        if (!results || !Array.isArray(results) || results.length === 0) return { count: 0 };

        let updatedCount = 0;

        for (const item of results) {
            try {
                // Determine ASIN Code
                let asinCode = (item.ASIN || item.asin || item.asinCode || '').trim();

                // Fallback: Extract from URL if code is missing
                if (!asinCode && item.Original_URL) {
                    const match = item.Original_URL.match(/\/dp\/(B[A-Z0-9]{9})/);
                    if (match) asinCode = match[1];
                }

                if (!asinCode) continue;

                // Sync the ASIN metrics using the shared robust mapper
                await this.updateAsinMetricsByCode(asinCode, item);
                updatedCount++;
            } catch (err) {
                console.error(`⚠️ Mapping error for item:`, err.message);
            }
        }

        return { count: updatedCount };
    }

    /**
     * Get list of Octoparse Task Groups
     */
    /**
     * Get list of Octoparse Task Groups
     */
    async getTaskGroupList() {
        const token = await this.authenticate();
        try {
            console.log('🔍 Fetching Octoparse Task Group List...');

            // 1. Try Modern endpoint first (from Python snippet)
            try {
                const res = await axios.get(`${this.baseUrl}/taskGroup`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.data?.data) return res.data.data;
            } catch (err) { /* fallback */ }

            // 2. Try legacy API snippet fallback
            try {
                const res = await axios.get(`${this.baseUrl}/api/taskgroup/getlist`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.data?.data) return res.data.data;
            } catch (err) { /* fallback */ }

            return [];
        } catch (error) {
            console.error('❌ Get Task Group List Error:', error.response?.status, error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Get tasks for a specific group
     */
    async getTasksInGroup(groupId) {
        const token = await this.authenticate();
        try {
            // Try modern search first
            try {
                const response = await axios.get(`${this.baseUrl}/task/search`, {
                    params: { taskGroupId: groupId, size: 50 },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data?.data) return response.data.data;
            } catch (e) { /* next */ }

            // Fallback to multiple legacy list endpoints
            const endpoints = [
                '/api/Task/GetTaskList',
                '/api/task/getlist'
            ];

            for (const endpoint of endpoints) {
                try {
                    const response = await axios.get(`${this.baseUrl}${endpoint}`, {
                        params: { taskGroupId: groupId, size: 50 },
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    const list = response.data?.data?.taskList || response.data?.data?.dataList || response.data?.data;
                    if (Array.isArray(list)) return list;
                } catch (e) { /* next */ }
            }
            return [];
        } catch (error) {
            console.error(`❌ Get Tasks Error for group ${groupId}:`, error.message);
            return [];
        }
    }

    /**
     * Highly robust way to find the group ID for a specific task (User-requested Method 1)
     */
    async findTaskGroupIdForTask(taskId) {
        try {
            const groups = await this.getTaskGroupList();
            for (const group of groups) {
                const id = group.categoryId || group.id || group.taskGroupId;
                if (!id) continue;

                const tasks = await this.getTasksInGroup(id);
                const found = tasks.find(t => t.taskId === taskId || t.id === taskId);
                if (found) {
                    console.log(`🎯 Task ${taskId} found in group: ${group.categoryName || group.name} (${id})`);
                    return id;
                }
            }
            console.warn(`🔍 Task ${taskId} not found in any group.`);
            return null;
        } catch (error) {
            console.error('❌ Method 1 Discovery Error:', error.message);
            return null;
        }
    }


    /**
     * Stop a running task.
     */
    async stopSync(taskId) {
        if (!taskId) throw new Error('Task ID required for stop command');

        const token = await this.authenticate();

        // Try modern OpenAPI V3 stop first (POST /cloudextraction/stop)
        try {
            console.log(`🛑 Sending STOP command for task: ${taskId} (OpenAPI V3 method)...`);
            const response = await axios.post(`${this.baseUrl}/cloudextraction/stop`,
                { taskId },
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );
            if (response.data) {
                console.log(`✅ Stop command sent (V3) for: ${taskId}`);
                this.statusCache.delete(taskId);
                return true;
            }
        } catch (err) {
            console.log(`⚠️ V3 Stop failed: ${err.response?.status || err.message}`);
        }

        // Fallback: Try legacy V1 method
        try {
            console.log(`🛑 Sending STOP command for task: ${taskId} (Legacy V1 method)...`);

            const response = await axios.get(`${this.baseUrl}/api/CloudTask/StopTask`, {
                params: { taskId: taskId },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data && (response.data.requestId || response.data.data === true)) {
                console.log(`✅ Stop command acknowledge (V1) for: ${taskId}`);
                this.statusCache.delete(taskId);
                return true;
            }
        } catch (error) {
            console.log(`⚠️ V1 Stop also failed: ${error.response?.status || error.message}`);
        }

        console.log(`⚠️ Stop command attempted but task may already be stopped: ${taskId}`);
        return true; // Return true so sync continues anyway
    }

    /**
     * Get statuses for multiple tasks in a single call (Official V2 Batch API).
     * @param {string[]} taskIds Array of Task IDs to check.
     */
    async getStatuses(taskIds) {
        if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) return [];

        const token = await this.authenticate();
        try {
            console.log(`📊 Batch Status Check for ${taskIds.length} tasks...`);

            // Resolve any UUIDs to Integer IDs for higher compatibility with the Batch API
            const resolvedIds = await Promise.all(taskIds.map(async id => {
                if (id.includes('-')) {
                    const res = await this.resolveTaskIdToInteger(id);
                    return res || id;
                }
                return id;
            }));

            const response = await axios.post(`${this.baseUrl}/cloudextraction/statuses/v2`, {
                taskIds: resolvedIds
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const results = response.data?.data || [];

            // Map results back to original IDs for internal consistency
            const finalResults = [];
            taskIds.forEach((originalId, index) => {
                const statusObj = results.find(r => r.taskId === originalId || r.taskId === resolvedIds[index]);
                if (statusObj) {
                    this.statusCache.set(originalId, { data: statusObj, timestamp: Date.now() });
                    finalResults.push(statusObj);
                }
            });

            return finalResults;
        } catch (error) {
            const isRateLimit = error.response?.status === 429 || error.message?.includes('TooManyRequests');
            if (isRateLimit) {
                console.warn(`⚠️ Status API Rate Limited (5 req/sec spec)`);
                return taskIds.map(id => ({ taskId: id, error: 'RateLimit' }));
            }
            console.error('❌ Octoparse Statuses V2 Batch Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get task status for a single task.
     */
    async getStatus(taskId) {
        if (!taskId) return null;

        // STATUS CACHING: Check if we have a fresh status (under 10 seconds old)
        const cached = this.statusCache.get(taskId);
        if (cached && Date.now() - cached.timestamp < 10000) {
            return cached.data;
        }

        try {
            const results = await this.getStatuses([taskId]);
            return results.length > 0 ? results[0] : null;
        } catch (error) {
            // Fallback to legacy single-task status if Batch/V2 fails
            const token = await this.authenticate();
            try {
                // RESOLVE UUID FOR V1 API
                let currentId = taskId;
                if (taskId.includes('-')) {
                    const resolved = await this.resolveTaskIdToInteger(taskId);
                    if (resolved) currentId = resolved;
                }

                const response = await axios.get(`${this.baseUrl}/api/CloudTask/GetTaskStatus`, {
                    params: { taskId: currentId },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const result = response.data.data;
                if (result) {
                    this.statusCache.set(taskId, { data: result, timestamp: Date.now() });
                }
                return result;
            } catch (fallbackErr) {
                return null;
            }
        }
    }

    /**
     * Get statuses for multiple tasks in one call.
     */
    async getBulkStatuses(taskIds) {
        if (!taskIds || taskIds.length === 0) return [];
        const token = await this.authenticate();

        // Strategy: Try modern V2 first, then legacy list, then individual if needed
        try {
            console.log(`🔍 Fetching bulk status for ${taskIds.length} tasks (Resolving UUIDs)...`);

            // Resolve any UUIDs to Integer IDs for higher compatibility
            const resolvedIds = await Promise.all(taskIds.map(async id => {
                if (id.includes('-')) {
                    const res = await this.resolveTaskIdToInteger(id);
                    return res || id;
                }
                return id;
            }));

            // 1. Try Modern V2
            try {
                const response = await axios.post(`${this.baseUrl}/cloudextraction/statuses/v2`, {
                    taskIds: resolvedIds
                }, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                if (response.data?.data && response.data.data.length > 0) return response.data.data;
            } catch (v2Err) {
                console.warn('⚠️ Octoparse V2 Bulk Status failed:', v2Err.response?.data?.message || v2Err.message);
            }

            // 2. Try Legacy List Endpoint
            const legacyRes = await axios.get(`${this.baseUrl}/api/CloudTask/GetTaskStatusList`, {
                params: { taskIds: resolvedIds.join(',') },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (legacyRes.data?.data) {
                const data = Array.isArray(legacyRes.data.data) ? legacyRes.data.data : [legacyRes.data.data];
                // Normalize legacy return to match V2 schema if possible
                return data.map((d, index) => ({
                    taskId: taskIds[index], // Use original ID for consistency
                    taskStatus: d.TaskStatus || d.status || 'Unknown',
                    taskName: d.TaskName || d.name
                }));
            }

            return [];
        } catch (error) {
            console.error('❌ Get Bulk Status Error:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Fetch actual extraction results from the cloud.
     * @param {string} taskId Task UUID or integer ID
     * @param {number} size Number of rows per page (max 1000)
     * @param {number} offset Starting row
     */
    async fetchCloudData(taskId, size = 1000, offset = 0) {
        if (!taskId) return [];
        const token = await this.authenticate();

        try {
            console.log(`📥 Fetching ${size} rows from Octoparse (Offset: ${offset}) for Task: ${taskId}...`);

            // Try Modern V2 Data API first (Usually accepts UUIDs)
            try {
                const response = await axios.get(`${this.baseUrl}/cloudextraction/data/v1`, {
                    params: { taskId, size, offset },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data?.data) return response.data.data;
            } catch (v2Err) {
                // Fallback to V1 (Strictly requires Integer ID for Legacy clusters)
                let currentId = taskId;
                if (taskId.includes('-')) {
                    const resolved = await this.resolveTaskIdToInteger(taskId);
                    if (resolved) currentId = resolved;
                }

                const v1Response = await axios.get(`${this.baseUrl}/api/CloudTask/GetData`, {
                    params: { taskId: currentId, size, offset },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                return v1Response.data?.data?.dataList || v1Response.data?.data || [];
            }
        } catch (error) {
            console.error(`❌ Fetch Cloud Data Error:`, error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Get data that has never been exported (Official Incremental API).
     * @param {string} taskId 
     * @param {number} size Range from 1 to 1000
     */
    async fetchNonExportedData(taskId, size = 1000) {
        if (!taskId) return { data: [], total: 0, current: 0 };
        const token = await this.authenticate();

        try {
            let currentId = taskId;
            if (taskId.includes('-')) {
                const resolved = await this.resolveTaskIdToInteger(taskId);
                if (resolved) currentId = resolved;
            }

            console.log(`📥 Fetching INCREMENTAL data for task: ${currentId} (Size: ${size})...`);
            const response = await axios.get(`${this.baseUrl}/data/notexported`, {
                params: { taskId: currentId, size },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Spec: { data: { total, current, data: [...] }, requestId }
            const result = response.data?.data || {};
            return {
                total: result.total || 0,
                current: result.current || 0,
                data: result.data || []
            };
        } catch (error) {
            console.error('❌ Fetch Non-Exported Data Error:', error.response?.data || error.message);
            return { data: [], total: 0, current: 0 };
        }
    }

    /**
     * Mark data as exported so it won't be fetched as "not exported" again.
     */
    async markDataAsExported(taskId) {
        if (!taskId) return false;
        const token = await this.authenticate();

        try {
            console.log(`🏷️ Marking task ${taskId} data as exported...`);
            await axios.post(`${this.baseUrl}/data/markexported`, {
                taskId: taskId
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`✅ Task ${taskId} successfully marked as exported.`);
            return true;
        } catch (error) {
            console.error('❌ Mark Exported Error:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Helper to fetch all available data pages for a task.
     */
    async _fetchAllDataPages(taskId) {
        let allData = [];
        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const page = await this.fetchCloudData(taskId, pageSize, offset);
            if (!page || page.length === 0) {
                hasMore = false;
            } else {
                allData = [...allData, ...page];
                offset += page.length;
                // If we got less than page size, we reached the end
                if (page.length < pageSize) hasMore = false;
                // Safety break for very large datasets (limit to 10k for now)
                if (allData.length >= 10000) {
                    console.warn('⚠️ Reached 10k items limit for auto-ingestion. Stopping pagination.');
                    hasMore = false;
                }
            }
        }
        return allData;
    }

    /**
     * Background worker that polls for task completion and then ingests data.
     */
    async pollAndAutomate(sellerId, taskId, options = {}) {
        const fullSync = options.fullSync || false;
        console.log(`🕵️ [AUTO] Monitoring Seller: ${sellerId}, Task: ${taskId}... (Mode: ${fullSync ? 'FULL' : 'INC'})`);

        let attempts = 0;
        const maxAttempts = 100; // Increased to handle longer tasks
        const startTime = Date.now();
        const FOUR_HOURS = 4 * 60 * 60 * 1000;

        const FAST_INTERVAL = 60000;      // 1 min
        const STANDARD_INTERVAL = 300000; // 5 mins
        const INITIAL_WAIT = 30000;      // 30 secs

        await this.wait(INITIAL_WAIT);

        while (attempts < maxAttempts) {
            // Stuck detection: Don't poll forever
            if (Date.now() - startTime > FOUR_HOURS) {
                console.error(`⏰ [TIMEOUT] Task ${taskId} exceeded 4h limit. Aborting polling.`);
                return;
            }

            try {
                const statusInfo = await this.getStatus(taskId);

                if (statusInfo?.error === 'RateLimit') {
                    await this.wait(60000);
                    continue;
                }

                // Normalizing status codes
                let status = statusInfo?.status ?? statusInfo?.Status ?? statusInfo;
                if (typeof status === 'object' && status !== null) status = status.status || status.Status;
                const statusNum = parseInt(status);

                // 2=Failed, 3=Finished, 4=Stopped (depending on endpoint version)
                const isCompleted = (statusNum === 3 || status === 'Finished' || status === 'Completed' || status === '3');
                const isFailed = (statusNum === 2 || statusNum === 4 || status === 'Failed' || status === 'Stopped' || status === '2' || status === '4');

                if (isCompleted) {
                    console.log(`✅ [AUTO] Task ${taskId} FINISHED. Starting results ingestion...`);

                    try {
                        // Use our ROBUST multi-path retrieval method
                        const rawData = await this.retrieveResults(taskId);

                        if (rawData && rawData.length > 0) {
                            console.log(`📥 [AUTO] Fetched ${rawData.length} rows for ingestion.`);
                            const count = await this.processBatchResults(sellerId, rawData);

                            // Update Seller metadata
                            const pool = await getPool();
                            await pool.request()
                                .input('sellerId', sql.VarChar, sellerId)
                                .input('lastScraped', sql.DateTime2, new Date())
                                .input('scrapeUsed', sql.Int, count)
                                .query('UPDATE Sellers SET LastScrapedAt = @lastScraped, ScrapeUsed = @scrapeUsed, UpdatedAt = GETDATE() WHERE Id = @sellerId');

                            console.log(`🎉 [AUTO] Successfully ingested ${count} metrics for seller ${sellerId}.`);

                            // Cleanup: Mark as exported to keep Octoparse queue clean
                            await this.markDataAsExported(taskId).catch(() => { });
                        } else {
                            console.warn(`⚠️ [AUTO] Task reported complete but no data found in retrieveResults.`);
                        }
                    } catch (ingestErr) {
                        console.error(`❌ [AUTO] Ingestion Error for ${taskId}:`, ingestErr.message);
                    }
                    return;
                }

                if (isFailed) {
                    console.error(`❌ [AUTO] Task ${taskId} FAILED or STOPPED (Status: ${status}). Automation aborted.`);
                    return;
                }

                const currentInterval = attempts < 10 ? FAST_INTERVAL : STANDARD_INTERVAL;
                await this.wait(currentInterval);
            } catch (err) {
                console.warn(`⚠️ [AUTO] Polling Warning for ${taskId}:`, err.message);
                await this.wait(60000);
            }
            attempts++;
        }

        console.warn(`⏰ [AUTO] Max attempts reached for ${taskId}.`);
    }

    /**
     * Fetch a list of executions for a taskId
     */
    async getExecutionList(taskId, size = 10) {
        const token = await this.authenticate();
        try {
            // RESOLVE UUID FOR V1 API Compatibility
            let currentId = taskId;
            if (taskId.includes('-')) {
                const resolved = await this.resolveTaskIdToInteger(taskId);
                if (resolved) currentId = resolved;
            }

            const response = await axios.get(`${this.baseUrl}/api/Execution/GetTaskExecutionList`, {
                params: { taskId: currentId, size },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data.data?.dataList || [];
        } catch (error) {
            console.error('❌ Get Execution List Error:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Get the latest execution ID for a given task
     */
    async getLatestExecutionId(taskId) {
        try {
            const executions = await this.getExecutionList(taskId, 1);
            if (executions && executions.length > 0) {
                return executions[0].executionId;
            }
            return null;
        } catch (error) {
            console.error('❌ Get Latest Execution Error:', error.message);
            return null;
        }
    }

    /**
     * Internal utility to fetch data from any valid Octoparse endpoint.
     */
    async _fetchDataBatch(taskId, size, offset, executionId = null) {
        const token = await this.authenticate();

        // RESOLVE UUID TO INTEGER ID for Legacy/Alt clusters
        let currentId = taskId;
        if (taskId.includes('-')) {
            const resolved = await this.resolveTaskIdToInteger(taskId);
            if (resolved) {
                console.log(`📥 Retrieval: Resolved UUID ${taskId} to Integer ${resolved} for data fetching.`);
                currentId = resolved;
            }
        }

        const paths = [
            '/data/all',                       // OpenAPI V3 - get all by offset (PRIMARY - gets ALL data)
            '/data/notexported',              // OpenAPI V3 spec (only unexported data)
            '/task/data/notexporteddata',     // OpenAPI V1.0
            '/api/notexporteddata/get',       // Legacy V1 (Common)
            '/api/alldata/GetDataOfTaskByOffset', // Legacy API
            '/api/notexporteddata',           // V1 Extension
            '/data/notexportdata'             // Legacy V1 (Alt)
        ];

        let lastErr = null;
        for (const path of paths) {
            try {
                // Try with currentId (Resolved)
                const params = { taskId: currentId, size, offset };
                if (executionId) params.executionId = executionId;

                console.log(`📥 Trying data path: ${path} with taskId: ${currentId}`);
                const response = await axios.get(`${this.baseUrl}${path}`, {
                    params,
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                // Octoparse API success check
                if (response.data?.data || Array.isArray(response.data)) {
                    console.log(`✅ Data fetched from ${path}:`, JSON.stringify(response.data).substring(0, 300));
                    const dataList = response.data.data?.dataList || response.data.data?.data || response.data;

                    // DEBUG: Log the structure of response for /data/all path
                    if (path === '/data/all' && response.data.data) {
                        console.log(`📋 DEBUG /data/all response structure:`, {
                            hasTotal: 'total' in response.data.data,
                            hasRestTotal: 'restTotal' in response.data.data,
                            hasOffset: 'offset' in response.data.data,
                            hasData: 'data' in response.data.data,
                            total: response.data.data.total,
                            restTotal: response.data.data.restTotal,
                            offset: response.data.data.offset,
                            dataLength: response.data.data.data?.length
                        });

                        // For /data/all, the next offset is returned in response
                        // Store it in a custom property we can access later
                        if (response.data.data.offset !== undefined) {
                            return { dataList: Array.isArray(dataList) ? dataList : [], nextOffset: response.data.data.offset };
                        }
                    }

                    // Also check for /data/notexported response structure
                    if (path === '/data/notexported' && response.data.data) {
                        console.log(`📋 DEBUG /data/notexported response structure:`, {
                            hasTotal: 'total' in response.data.data,
                            hasCurrent: 'current' in response.data.data,
                            hasData: 'data' in response.data.data,
                            total: response.data.data.total,
                            current: response.data.data.current,
                            dataLength: response.data.data.data?.length
                        });
                    }

                    return Array.isArray(dataList) ? dataList : [];
                } else {
                    // Response doesn't have expected structure
                    console.log(`⚠️ Response from ${path} missing expected data structure:`, JSON.stringify(response.data).substring(0, 200));
                }
            } catch (err) {
                lastErr = err.response?.status + ' ' + (err.response?.data?.error?.message || err.message);
                console.log(`❌ Path ${path} failed: ${err.response?.status} - ${err.message}`);

                // If it's a 404 and we used a resolved ID, try a fallback to original UUID
                if (err.response?.status === 404 && currentId !== taskId) {
                    try {
                        console.log(`📥 Retry with original UUID: ${taskId}`);
                        const response = await axios.get(`${this.baseUrl}${path}`, {
                            params: { taskId, size, offset, executionId },
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (response.data?.data || Array.isArray(response.data)) {
                            const dataList = response.data.data?.dataList || response.data.data?.data || response.data;

                            // For /data/all fallback, also extract offset
                            if (path === '/data/all' && response.data.data?.offset !== undefined) {
                                return { dataList: Array.isArray(dataList) ? dataList : [], nextOffset: response.data.data.offset };
                            }

                            return Array.isArray(dataList) ? dataList : [];
                        }
                    } catch (inner) {
                        console.log(`❌ Fallback also failed: ${inner.message}`);
                    }
                }
            }
        }
        throw new Error(`Exhausted all data paths for task ${taskId}: ${lastErr}`);
    }

    /**
     * Polls and retrieves results from a completed sync task with auto-pagination.
     */
    async retrieveResults(taskId, executionId = null) {
        let allResults = [];
        let offset = 0;
        const size = 1000;
        let hasMore = true;
        const seenUrls = new Set();
        let useServerOffset = false; // For /data/all which returns next offset from server

        try {
            console.log(`📥 Multi-Path Retrieval triggered for Task: ${taskId}`);
            while (hasMore) {
                const batchResult = await this._fetchDataBatch(taskId, size, offset, executionId);

                // Handle both array return and object return (for /data/all which returns nextOffset)
                let dataList = batchResult;
                if (batchResult && typeof batchResult === 'object' && 'dataList' in batchResult) {
                    dataList = batchResult.dataList;
                    if (batchResult.nextOffset !== undefined) {
                        offset = batchResult.nextOffset;
                        useServerOffset = true;
                        console.log(`📍 Using server-provided offset: ${offset}`);
                    }
                }

                // Deduplicate: Only add items we haven't seen before (by URL)
                let newCount = 0;
                for (const item of dataList) {
                    const url = item.Original_URL || item.url || '';
                    if (!seenUrls.has(url)) {
                        seenUrls.add(url);
                        allResults.push(item);
                        newCount++;
                    }
                }

                console.log(`📦 Fetched ${dataList.length} items, added ${newCount} new (Total unique: ${allResults.length})`);

                // Check for empty data - if ALL items have empty Title/asp, stop early
                const allEmpty = dataList.every(item => !item.Title && !item.asp && !item.mrp);
                if (allEmpty && dataList.length > 0) {
                    console.warn(`⚠️ WARNING: All ${dataList.length} items have empty data fields! Stopping.`);
                    console.warn(`⚠️ This indicates Octoparse task is NOT extracting product data properly.`);
                    hasMore = false;
                    break;
                }

                if (dataList.length < size) {
                    hasMore = false;
                } else {
                    // If using server offset (from /data/all), don't increment manually
                    if (!useServerOffset) {
                        offset += size;
                    }
                }
            }

            // Log sample of what we got
            if (allResults.length > 0) {
                console.log(`📊 Sample of retrieved data (first item):`, JSON.stringify(allResults[0], null, 2));
            }

            return allResults;
        } catch (error) {
            console.error('❌ Retrieve Results Error:', error.message);
            throw error;
        }
    }

    /**
     * Fetch unexported results (simplified wrapper for retrieveResults)
     */
    async fetchTaskResults(taskId) {
        return this.retrieveResults(taskId);
    }

    /**
     * Ensures a seller has a task in Octoparse.
     * If no taskId is stored, it duplicates the master task and saves it.
     */
    async ensureTaskForSeller(sellerId) {
        try {
            const pool = await getPool();
            const sellerResult = await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query('SELECT Id, Name, OctoparseId FROM Sellers WHERE Id = @sellerId');

            const seller = sellerResult.recordset[0];
            if (!seller) throw new Error('Seller not found');

            // 1. Check if they already have a task
            if (seller.OctoparseId) {
                console.log(`ℹ️ Seller ${seller.Name} already has task: ${seller.OctoparseId}`);
                return seller.OctoparseId;
            }

            // 2. Duplicate from Master Template
            console.log(`🏗️ Creating new Octoparse task for seller: ${seller.Name}...`);
            const taskName = `${seller.Name} Sync`;
            const newTaskId = await this.duplicateTask(taskName);

            if (!newTaskId) {
                throw new Error('Failed to duplicate task from master template.');
            }

            // 3. Save to Seller record
            await pool.request()
                .input('newTaskId', sql.NVarChar, newTaskId)
                .input('sellerId', sql.VarChar, sellerId)
                .query('UPDATE Sellers SET OctoparseId = @newTaskId, UpdatedAt = GETDATE() WHERE Id = @sellerId');

            console.log(`✅ Seller ${seller.Name} now linked to task: ${newTaskId}`);
            return newTaskId;
        } catch (error) {
            console.error('❌ Error in ensureTaskForSeller:', error.message);
            throw error;
        }
    }

    /**
     * Automated workflow: Fetches all active ASINs for a seller and updates Octoparse task.
     * Optionally triggers a new cloud scrape.
     */
    async syncSellerAsinsToOctoparse(sellerId, options = {}) {
        // DEFAULT TO TRUE: We always want to start the scrape unless explicitly told not to
        const triggerScrape = options.triggerScrape !== undefined ? options.triggerScrape : true;
        const forceReRun = options.forceReRun || false;

        console.log(`🏁 [START] Seller Sync Logic triggered for: ${sellerId}`);

        // CONCURRENCY LOCK: Prevent overlapping syncs for the same seller
        if (this.syncLocks.get(sellerId.toString())) {
            console.log(`🛡️ Sync already in progress for seller ${sellerId}. Skipping this trigger.`);
            return false;
        }
        this.syncLocks.set(sellerId.toString(), true);

        try {
            const pool = await getPool();

            // 1. Ensure Task Exists
            const taskId = await this.ensureTaskForSeller(sellerId);
            if (!taskId) {
                this.syncLocks.delete(sellerId.toString());
                return false;
            }

            // 2. Task Stop (Only wait if not a forced manual re-run to save time)
            if (forceReRun) {
                console.log(`📡 Forcing immediate restart for task ${taskId}...`);
                await this.stopSync(taskId);
                // Wait for task to actually stop before proceeding
                console.log(`⏳ Waiting for task to stop...`);
                await this.wait(5000);
            } else {
                await this.ensureTaskStopped(taskId);
            }

            // 3. Get All Active ASINs for this seller from database
            console.log(`📊 Fetching all active ASINs from database for seller ${sellerId}...`);
            const asinsResult = await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND Status = 'Active'");

            const asins = asinsResult.recordset;

            if (asins.length === 0) {
                console.log(`⚠️ No active ASINs to sync for seller: ${sellerId}`);
                return false;
            }

            console.log(`✅ Found ${asins.length} active ASINs in database`);

            // Create URLs from ASINs
            const asinCodes = asins.map(a => a.AsinCode);
            const urls = asinCodes.map(code => `https://www.amazon.in/dp/${code}`);

            // 4. PERSIST metadata to Database
            await pool.request()
                .input('totalAsins', sql.Int, asins.length)
                .input('sellerId', sql.VarChar, sellerId)
                .query('UPDATE Sellers SET ScrapeUsed = @totalAsins, UpdatedAt = GETDATE() WHERE Id = @sellerId');

            console.log(`💾 Updated metadata for seller: ${sellerId}`);

            console.log(`🔄 Syncing ${urls.length} ASINs to task ${taskId}...`);

            // 5. Update task URLs (using FILE endpoint)
            try {
                await this.updateTaskUrlsWithFile(taskId, urls);
            } catch (injectionError) {
                console.error(`❌ File-based injection failed for task ${taskId}: ${injectionError.message}`);
                throw injectionError;
            }


            // 6. Trigger Scrape if requested
            if (triggerScrape) {
                console.log(`🚀 Automated trigger: Starting scrape for task ${taskId}...`);
                const startResult = await this.startCloudExtraction(taskId);
                console.log(`✅ Cloud extraction started for task ${taskId}:`, startResult);

                // START BACKGROUND AUTOMATION: Poll and Ingest once done
                console.log(`🔄 Starting background polling for seller ${sellerId}, task ${taskId}...`);
                this.pollAndAutomate(sellerId, taskId, { fullSync: options.fullSync }).catch(err => {
                    console.error(`❌ Background Automation Critical Error for seller ${sellerId}:`, err.message);
                });
            }

            console.log(`✅ syncSellerAsinsToOctoparse completed for seller ${sellerId}`);
            return true;
        } catch (error) {
            console.error(`❌ Sync Error for seller ${sellerId}:`, error.message);
            return false;
        } finally {
            this.syncLocks.delete(sellerId.toString());
        }
    }

    /**
     * Helper to ensure a task is fully stopped before proceeding.
     * Polls the status and sends stop commands if necessary.
     */
    async ensureTaskStopped(taskId, maxAttempts = 6) {
        let attempts = 0;
        let isRunning = true;

        while (isRunning && attempts < maxAttempts) {
            const statusInfo = await this.getStatus(taskId);

            // Octoparse statuses can be: 0=Idle, 1=Running, 2=Waiting, 3=Stopped/Finished, 4=Failed
            let status = statusInfo?.status ?? statusInfo?.Status ?? statusInfo;
            if (typeof status === 'object' && status !== null) status = status.status || status.Status;

            // Normalize status to number if possible
            const statusNum = parseInt(status);

            // 0, 3, 4 are "Not Running"
            isRunning = (statusNum === 1 || statusNum === 2 || status === 'Executing' || status === 'Running' || status === 'Waiting');

            if (isRunning) {
                console.log(`⏳ Task ${taskId} is active (Status: ${status}). Forcing STOP... (Attempt ${attempts + 1}/${maxAttempts})`);
                await this.stopSync(taskId);
                await this.wait(3000); // Wait for cloud coordinator to process stop
            } else {
                console.log(`✅ Task ${taskId} is already stopped/idle (Status: ${status}).`);
                isRunning = false;
            }
            attempts++;
        }

        if (isRunning) {
            console.warn(`⚠️ Warning: Task ${taskId} still in ${isRunning} state after ${maxAttempts} attempts.`);
        } else {
            console.log(`✅ Task ${taskId} is confirmed stopped.`);
        }
        return !isRunning;
    }

    /**
     * Maps external raw data to internal ASIN model metrics.
     */
    async updateAsinMetrics(asinId, rawData) {
        try {
            const pool = await getPool();
            const asinResult = await pool.request()
                .input('asinId', sql.VarChar, asinId)
                .query('SELECT * FROM Asins WHERE Id = @asinId');

            const asin = asinResult.recordset[0];
            if (!asin) throw new Error('ASIN not found');

            // --- Robust Advanced Mapping (Octoparse Specialized) ---

            // 1. Price & Deal Logic
            const price = this._cleanPrice(this._getFromRaw(rawData, ['asp', 'price', 'currentPrice', 'Field2']));
            const mrp = this._cleanPrice(this._getFromRaw(rawData, ['mrp', 'listPrice', 'Field3']));
            const dealBadge = this._cleanDealBadge(this._getFromRaw(rawData, ['deal_badge', 'dealBadge', 'deal', 'Field14'], 'No deal found'));
            const priceType = dealBadge !== 'No deal found' ? 'Deal Price' : 'Standard Price';

            // 2. Title & Character Count
            const title = (rawData.Title || rawData.title || rawData.Field1 || asin.Title || '').trim();
            const titleLength = title.length;

            // 3. Category Breadcrumbs
            const category = this._parseCategory(rawData) || asin.Category || '';

            // 4. BSR Parsing
            const bsrData = this._parseBSR(rawData);
            const bsr = bsrData.main;
            const subBsr = bsrData.subBsrString || bsrData.sub;
            const subBSRs = bsrData.allRanks;

            // 5. Image Processing (Gallery extraction + Video Detection)
            const mediaData = this._countImagesAndVideos(rawData);
            const imagesCount = mediaData.imagesCount;
            const videoCount = mediaData.videoCount;
            const images = mediaData.images || [];
            const mainImageUrl = this._getFromRaw(rawData, ['Main_Image', 'mainImage', 'imageUrl', 'Field5'], asin.ImageUrl);

            // 6. Rating & Reviews
            let rating = parseFloat(rawData.avg_rating);
            if (isNaN(rating)) rating = 0;

            let reviewCount = this._cleanReviewCount(this._getFromRaw(rawData, ['review_count', 'Review_Count', 'Rating_Count', 'rating', 'RT'], '')) || asin.ReviewCount;

            const ratingBreakdown = this._parseRatingBreakdown(rawData.Rating || rawData.Field7 || rawData.Rating_breakdown || '');

            // Ensure we don't lose data if breakdown is empty but we had it before
            const hasBreakdown = Object.values(ratingBreakdown).some(v => v > 0);
            const finalRatingBreakdown = hasBreakdown ? ratingBreakdown : (asin.RatingBreakdown ? JSON.parse(asin.RatingBreakdown) : ratingBreakdown);

            // 7. Bullet Points - Get exact text from Octoparse
            let bulletPointsText = [];
            let bulletPointsCount = 0;

            // Try bullet_points or bullet_points_count HTML field
            const bulletHtmlField = this._getFromRaw(rawData, ['bullet_points', 'bullet_points_count', 'Field8'], '');
            if (bulletHtmlField && typeof bulletHtmlField === 'string' && bulletHtmlField.length > 50) {
                bulletPointsText = this._parseBulletPoints(bulletHtmlField);
                bulletPointsCount = bulletPointsText.length;
            }

            // Fallback: individual bp_ fields
            if (bulletPointsCount === 0) {
                for (let i = 1; i <= 10; i++) {
                    const bpField = `bp_${i}`;
                    if (rawData[bpField] && typeof rawData[bpField] === 'string' && rawData[bpField].trim().length > 3) {
                        let text = rawData[bpField].trim()
                            .replace(/<[^>]+>/g, '')
                            .replace(/&amp;/g, '&')
                            .replace(/&nbsp;/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        if (text.length > 3 && !bulletPointsText.includes(text)) {
                            bulletPointsText.push(text);
                        }
                    }
                }
                bulletPointsCount = bulletPointsText.length;
            }

            console.log(`📝 Extracted ${bulletPointsCount} bullet points:`, bulletPointsText.map(b => b.substring(0, 60)));

            // 8. Stock Level, A+ Content & Availability
            const stockLevel = this._cleanStock(this._getFromRaw(rawData, ['stock_level', 'Field10', 'stock', 'inventory'], 0));
            const hasAplus = this._detectAplusContent(rawData);
            const availabilityStatus = rawData.unavilable || rawData.status || rawData.availabilityStatus || rawData.availability || asin.AvailabilityStatus || 'Available';

            let aplusAbsentSince = asin.AplusAbsentSince;
            let aplusPresentSince = asin.AplusPresentSince;
            const now = new Date();

            if (hasAplus) {
                aplusPresentSince = aplusPresentSince || now;
                aplusAbsentSince = null;
            } else {
                aplusAbsentSince = aplusAbsentSince || now;
                aplusPresentSince = null;
            }

            // 9. Sold By & Second Buy Box
            const soldBy = this._extractSellerFromRaw(rawData) || asin.SoldBy || '';
            const buyBoxWin = this._isBuyBoxWinner(soldBy);

            let secondAsp = asin.SecondAsp;
            let soldBySec = asin.SoldBySec;
            let allOffers = [];

            // Add primary buy box as the first offer
            if (soldBy) {
                allOffers.push({
                    seller: soldBy,
                    price: price || asin.CurrentPrice || 0,
                    isBuyBoxWinner: true
                });
            }

            const secondBuyboxData = this._parseSecondaryBuybox(rawData.second_buybox || rawData.Alt_buyBox || rawData.Field25 || '');
            if (secondBuyboxData.offers.length > 0) {
                // Find first non-primary seller for legacy secondAsp/soldBySec fields
                const alternateOffer = secondBuyboxData.offers.find(o => o.seller !== soldBy) || secondBuyboxData.offers[0];
                if (alternateOffer) {
                    secondAsp = alternateOffer.price || secondAsp;
                    soldBySec = alternateOffer.seller || soldBySec;
                }

                // Add all secondary offers to allOffers
                secondBuyboxData.offers.forEach(offer => {
                    if (offer.seller !== soldBy || allOffers.length === 0) {
                        allOffers.push({
                            seller: offer.seller,
                            price: offer.price,
                            isBuyBoxWinner: false
                        });
                    }
                });
            } else {
                secondAsp = this._cleanPrice(rawData.second_asp || '') || secondAsp;
                soldBySec = (rawData.Sold_by_sec || soldBySec || '').trim();

                if (soldBySec && soldBySec !== soldBy) {
                    allOffers.push({
                        seller: soldBySec,
                        price: secondAsp,
                        isBuyBoxWinner: false
                    });
                }
            }

            // 10. Listing Quality Analysis (LQS) - New Implementation
            const productDescription = this._getFromRaw(rawData, ['Product_Description', 'product_description', 'Field9'], asin.ProductDescription || '');

            const lqsAnalysis = listingQualityService.analyzeRaw({
                title,
                bulletPointsText,
                imagesCount,
                images,
                description: productDescription,
                hasAplus,
                category
            });

            const lqsScore = lqsAnalysis.totalScore;
            const lqsGrade = lqsAnalysis.totalGrade;

            // --- Price Trend History (Last 7 Days) ---
            let history = [];
            try {
                history = asin.History ? JSON.parse(asin.History) : [];
            } catch (e) {
                history = [];
            }

            // Add current point
            history.push({
                price: price > 0 ? price : (asin.CurrentPrice || 0),
                bsr: bsr > 0 ? bsr : (asin.BSR || 0),
                rating: rating > 0 ? rating : (asin.Rating || 0),
                reviews: reviewCount || asin.ReviewCount || 0,
                imageCount: imagesCount || asin.ImagesCount || 0,
                videoCount: videoCount || asin.VideoCount || 0,
                date: now.toISOString().split('T')[0]
            });

            // Keep last 7 unique days
            const uniqueHistory = [];
            const seenDates = new Set();
            for (let i = history.length - 1; i >= 0; i--) {
                const item = history[i];
                if (!seenDates.has(item.date)) {
                    uniqueHistory.unshift(item);
                    seenDates.add(item.date);
                }
                if (uniqueHistory.length >= 7) break;
            }

            const updates = {
                Title: title,
                Category: category,
                CurrentPrice: price > 0 ? price : asin.CurrentPrice,
                Mrp: mrp > 0 ? mrp : asin.Mrp,
                DealBadge: dealBadge,
                PriceType: priceType,
                BSR: bsr > 0 ? bsr : asin.BSR,
                Rating: rating > 0 ? rating : asin.Rating,
                ReviewCount: reviewCount,
                RatingBreakdown: JSON.stringify(finalRatingBreakdown),
                LQS: lqsScore,
                LQSGrade: lqsGrade,
                LqsDetails: JSON.stringify(lqsAnalysis.components.title.issues), // Fallback for legacy

                // Detailed Quality Components
                TitleScore: lqsAnalysis.components.title.score,
                TitleGrade: lqsAnalysis.components.title.grade,
                TitleIssues: JSON.stringify(lqsAnalysis.components.title.issues),
                TitleRecommendations: JSON.stringify(lqsAnalysis.components.title.recommendations),
                TitleDetails: JSON.stringify(lqsAnalysis.components.title.details),

                BulletScore: lqsAnalysis.components.bullets.score,
                BulletGrade: lqsAnalysis.components.bullets.grade,
                BulletIssues: JSON.stringify(lqsAnalysis.components.bullets.issues),
                BulletRecommendations: JSON.stringify(lqsAnalysis.components.bullets.recommendations),
                BulletDetails: JSON.stringify(lqsAnalysis.components.bullets.details),

                ImageScore: lqsAnalysis.components.images.score,
                ImageGrade: lqsAnalysis.components.images.grade,
                ImageIssues: JSON.stringify(lqsAnalysis.components.images.issues),
                ImageRecommendations: JSON.stringify(lqsAnalysis.components.images.recommendations),
                ImageDetails: JSON.stringify(lqsAnalysis.components.images.details),

                DescriptionScore: lqsAnalysis.components.description.score,
                DescriptionGrade: lqsAnalysis.components.description.grade,
                DescriptionIssues: JSON.stringify(lqsAnalysis.components.description.issues),
                DescriptionRecommendations: JSON.stringify(lqsAnalysis.components.description.recommendations),
                DescriptionDetails: JSON.stringify(lqsAnalysis.components.description.details),

                ProductDescription: productDescription,
                BuyBoxStatus: buyBoxWin ? 1 : 0,
                ImageUrl: mainImageUrl,
                SubBsr: subBsr,
                SubBSRs: JSON.stringify(subBSRs),
                SubBsrCategories: JSON.stringify(subBSRs.map(rankStr => {
                    const match = rankStr.match(/in\s+([^\(#]+)/i);
                    return match ? match[1].trim() : '';
                }).filter(Boolean)),
                Images: JSON.stringify(images),
                ImagesCount: imagesCount,
                VideoCount: videoCount,
                BulletPoints: bulletPointsCount,
                BulletPointsText: JSON.stringify(bulletPointsText),
                StockLevel: stockLevel,
                SoldBy: soldBy || asin.SoldBy || '',
                BuyBoxWin: buyBoxWin ? 1 : 0,
                BuyBoxSellerId: soldBy || asin.SoldBy || '',
                SecondAsp: secondAsp,
                SoldBySec: soldBySec,
                AspDifference: price && secondAsp ? Math.abs(price - secondAsp) : 0,
                DiscountPercentage: this._parseDiscount(rawData, price, mrp),
                HasAplus: hasAplus ? 1 : 0,
                AvailabilityStatus: availabilityStatus,
                AplusAbsentSince: aplusAbsentSince,
                AplusPresentSince: aplusPresentSince,
                AllOffers: JSON.stringify(allOffers),
                Brand: (rawData.brand || rawData.Brand || rawData.Field12 || asin.Brand || '').trim(),
                ScrapeStatus: 'COMPLETED',
                Status: asin.Status === 'Scraping' ? 'Active' : asin.Status,
                History: JSON.stringify(uniqueHistory),
                LastScrapedAt: now,
                UpdatedAt: now
            };

            // Build SQL UPDATE
            const setClause = Object.keys(updates).map((k, i) => `${k} = @val${i}`).join(', ');
            const request = pool.request();
            Object.keys(updates).forEach((k, i) => {
                request.input(`val${i}`, updates[k]);
            });
            request.input('asinId', sql.VarChar, asinId);

            await request.query(`UPDATE Asins SET ${setClause} WHERE Id = @asinId`);

            // 11. History Tracking
            const today = now.toISOString().split('T')[0];
            await pool.request()
                .input('asinId', sql.VarChar, asinId)
                .input('date', sql.Date, today)
                .input('price', sql.Decimal(18, 2), updates.CurrentPrice)
                .input('bsr', sql.Int, updates.BSR)
                .input('rating', sql.Decimal(3, 2), updates.Rating)
                .input('reviewCount', sql.Int, updates.ReviewCount)
                .input('buyBoxStatus', sql.Bit, updates.BuyBoxStatus)
                .input('stockLevel', sql.Int, updates.StockLevel)
                .input('lqs', sql.Decimal(5, 2), updates.LQS)
                .query(`
                    IF EXISTS (SELECT 1 FROM AsinHistory WHERE AsinId = @asinId AND Date = @date)
                        UPDATE AsinHistory SET Price = @price, BSR = @bsr, Rating = @rating, ReviewCount = @reviewCount, BuyBoxStatus = @buyBoxStatus, StockLevel = @stockLevel, LQS = @lqs
                        WHERE AsinId = @asinId AND Date = @date
                    ELSE
                        INSERT INTO AsinHistory (AsinId, Date, Price, BSR, Rating, ReviewCount, BuyBoxStatus, StockLevel, LQS)
                        VALUES (@asinId, @date, @price, @bsr, @rating, @reviewCount, @buyBoxStatus, @stockLevel, @lqs)
                `);

            // 12. Socket Notification (REMOVED - Handled by batch in processBatchResults)
            /*
            const io = SocketService.getIo();
            if (io) {
                io.emit('scrape_data_ingested', {
                    asinId: asinId,
                    sellerId: asin.SellerId,
                    asinCode: asin.AsinCode,
                    timestamp: now
                });
            }
            */

            // console.log(`✅ SQL Metrics updated for ASIN: ${asin.AsinCode}`);
            return true;
        } catch (error) {
            console.error(`❌ SQL Metric Update Error (${asinId}):`, error.message);
            throw error;
        }
    }

    /**
     * Maps external raw data to internal ASIN model metrics using ASIN Code instead of Mongo ID.
     */
    async updateAsinMetricsByCode(asinCode, rawData) {
        try {
            const pool = await getPool();
            const asinResult = await pool.request()
                .input('asinCode', sql.VarChar, asinCode)
                .query('SELECT Id FROM Asins WHERE AsinCode = @asinCode');

            const asin = asinResult.recordset[0];
            if (!asin) {
                console.warn(`[MarketSync] ASIN ${asinCode} not found in database. Skipping.`);
                return false;
            }

            return await this.updateAsinMetrics(asin.Id, rawData);
        } catch (error) {
            console.error(`❌ ASIN Update by Code Error (${asinCode}):`, error.message);
            return false;
        }
    }

    async processBatchResults(sellerId, rawResults) {
        if (!rawResults || rawResults.length === 0) return 0;

        console.log(`🚀 Memory-safe SQL bulk processing ${rawResults.length} results for seller ${sellerId}...`);

        let updatedCount = 0;
        let skippedNoCode = 0;
        let skippedNoMatch = 0;
        const now = new Date();
        const pool = await getPool();
        const updatedAsinCodes = []; // Track updated ASINs for batch notification

        const CHUNK_SIZE = 100;

        for (let chunkStart = 0; chunkStart < rawResults.length; chunkStart += CHUNK_SIZE) {
            const chunk = rawResults.slice(chunkStart, chunkStart + CHUNK_SIZE);
            console.log(`📦 Processing chunk ${Math.floor(chunkStart / CHUNK_SIZE) + 1} (${chunk.length} items)...`);

            // Extract ASIN codes for this chunk - normalize to uppercase
            const asinCodesToFind = chunk.map(r => this._extractAsinFromData(r))
                .filter(Boolean)
                .map(code => code.toUpperCase()); // Normalize to uppercase

            if (chunkStart === 0 && chunk.length > 0) {
                console.log(`[DEBUG] First record raw data keys:`, Object.keys(chunk[0]));
                const firstCode = this._extractAsinFromData(chunk[0]);
                console.log(`[DEBUG] Extracted ASIN from first record:`, firstCode);
                if (firstCode) {
                    console.log(`[DEBUG] Normalized ASIN (uppercase):`, firstCode.toUpperCase());
                }
            }

            if (asinCodesToFind.length === 0) {
                console.log(`[DEBUG] No ASIN codes found in chunk ${Math.floor(chunkStart / CHUNK_SIZE) + 1}`);
                skippedNoCode += chunk.length;
                continue;
            }

            // Fetch ASINs for this chunk - use parameterized query for sellerId
            const asinRequest = pool.request();
            asinCodesToFind.forEach((code, i) => asinRequest.input(`code${i}`, code));
            const codeParams = asinCodesToFind.map((_, i) => `@code${i}`).join(', ');

            // FIX: Use parameterized query to prevent SQL injection and ensure proper matching
            asinRequest.input('sellerId', sellerId.toUpperCase()); // Add sellerId parameter BEFORE query
            const asinResult = await asinRequest.query(
                `SELECT * FROM Asins WHERE UPPER(SellerId) = @sellerId AND UPPER(AsinCode) IN (${codeParams})`
            );

            console.log(`[DEBUG] Found ${asinResult.recordset.length} ASINs in DB for chunk ${Math.floor(chunkStart / CHUNK_SIZE) + 1} (Seller: ${sellerId})`);

            // Create lookup map with uppercase keys for case-insensitive matching
            const asinMap = new Map(asinResult.recordset.map(a => [a.AsinCode.toUpperCase(), a]));

            // Log which ASIN codes were found vs not found
            const notFoundCodes = asinCodesToFind.filter(code => !asinMap.has(code));
            if (notFoundCodes.length > 0) {
                console.log(`[DEBUG] ASIN codes NOT found in DB:`, notFoundCodes.slice(0, 10));
                if (notFoundCodes.length > 10) {
                    console.log(`[DEBUG] ... and ${notFoundCodes.length - 10} more`);
                }
            }

            for (const rawData of chunk) {
                const code = this._extractAsinFromData(rawData);
                if (!code) {
                    skippedNoCode++;
                    continue;
                }

                const normalizedCode = code.toUpperCase();
                let asin = asinMap.get(normalizedCode);

                if (!asin) {
                    // Create missing ASIN if it's found in Octoparse data but not in SQL
                    try {
                        const newAsinId = generateId();
                        const productName = this._getFromRaw(rawData, ['Product_Name', 'title', 'Field1'], 'Unknown Product');

                        await pool.request()
                            .input('id', sql.VarChar, newAsinId)
                            .input('sellerId', sql.VarChar, sellerId)
                            .input('asinCode', sql.VarChar, normalizedCode)
                            .input('title', sql.NVarChar, productName)
                            .query(`
                                INSERT INTO Asins (Id, SellerId, AsinCode, Title, Status, CreatedAt, UpdatedAt)
                                VALUES (@id, @sellerId, @asinCode, @title, 'Active', GETDATE(), GETDATE())
                            `);

                        console.log(`[MarketSync] Automatically created missing ASIN ${normalizedCode} for seller ${sellerId}`);
                        asin = { Id: newAsinId, AsinCode: normalizedCode };
                    } catch (createErr) {
                        console.error(`❌ Error creating missing ASIN ${normalizedCode}:`, createErr.message);
                        skippedNoMatch++;
                        continue;
                    }
                }

                try {
                    await this.updateAsinMetrics(asin.Id, rawData);
                    updatedCount++;
                    updatedAsinCodes.push(asin.AsinCode); // Track for batch notification
                } catch (err) {
                    console.error(`❌ Error updating ASIN ${asin.AsinCode} in batch:`, err.message);
                }
            }
        }

        // ---- BATCH SOCKET NOTIFICATION (instead of per-ASIN) ----
        if (updatedAsinCodes.length > 0) {
            const io = SocketService.getIo();
            if (io) {
                // Emit ONE event with all updated ASIN codes
                io.emit('scrape_batch_complete', {
                    sellerId: sellerId,
                    count: updatedAsinCodes.length,
                    asinCodes: updatedAsinCodes,
                    timestamp: now
                });
            }
        }

        console.log(`✅ Bulk processing completed. Updated ${updatedCount} ASINs.`);
        return {
            success: true,
            updatedCount,
            skippedNoCode,
            skippedNoMatch,
            total: rawResults.length
        };
    }

    // ==================== HELPER METHODS FOR DATA MAPPING ====================

    /**
     * Get value from raw data with fallback chain
     */
    _getFromRaw(rawData, fieldNames, defaultValue = null) {
        if (!rawData) return defaultValue;

        for (const field of fieldNames) {
            const value = rawData[field];
            if (value !== undefined && value !== null && value !== '') {
                if (typeof value === 'string' && value.trim() === '') continue;
                return value;
            }
        }
        return defaultValue;
    }

    /**
     * Parse Product Category from Octoparse data
     * Robustly handles HTML breadcrumbs and cleans up noise
     */
    _parseCategory(rawData) {
        if (!rawData) return '';

        const catFields = ['category', 'Category', 'breadcrumbs', 'Breadcrumb', 'Field4'];
        let rawCat = '';

        for (const field of catFields) {
            if (rawData[field] && typeof rawData[field] === 'string' && rawData[field].trim().length > 0) {
                rawCat = rawData[field];
                break;
            }
        }

        if (!rawCat || typeof rawCat !== 'string' || rawCat.trim().length === 0) return '';

        // If it's HTML, parse it
        if (rawCat.includes('<')) {
            try {
                const dom = new JSDOM(rawCat);
                const doc = dom.window.document;

                // Find all breadcrumb links
                const links = doc.querySelectorAll('a.a-link-normal');
                const parts = [];
                const seen = new Set();

                for (const link of links) {
                    const text = link.textContent.trim();
                    if (text && text !== '›' && !text.includes('dp_bc_') && !text.includes('ref=') && !seen.has(text)) {
                        seen.add(text);
                        parts.push(text);
                    }
                }

                if (parts.length > 0) {
                    return parts.join(' › ')
                        .replace(/&amp;/g, '&')
                        .replace(/&nbsp;/g, ' ')
                        .trim();
                }
            } catch (e) {
                console.warn('JSDOM category parsing failed:', e.message);
            }

            // Regex fallback
            const aTagRegex = /<a[^>]*>([^<]+)<\/a>/gi;
            const matches = [];
            let m;
            while ((m = aTagRegex.exec(rawCat)) !== null) {
                const text = m[1].trim();
                if (text && text !== '›' && !text.includes('dp_bc_') && !text.includes('ref=')) {
                    matches.push(text);
                }
            }
            if (matches.length > 0) {
                return matches.join(' › ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
            }

            // Remove all HTML tags
            return rawCat.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }

        return rawCat.replace(/\s+/g, ' ').trim();
    }

    /**
     * Parse BSR (Best Sellers Rank) from Octoparse data
     * Handles both main and sub ranks intelligently using category classification
     */
    _parseBSR(rawData) {
        if (!rawData) return { main: 0, sub: 0, subBsrString: '', allRanks: [] };

        let main = 0;
        let sub = 0;
        let subBsrString = '';
        const allRanks = [];

        const mainFields = ['alt_bsr', 'BSR', 'bsr', 'Best_Sellers_Rank', 'rank', 'Field9'];
        const subFields = ['alt_sub_bsr', 'sub_BSR', 'sub_bsr', 'Category_Rank', 'Field10'];

        // Helper to extract rank and category from a string
        const extractRankInfo = (s) => {
            if (!s || typeof s !== 'string') return [];

            // Clean string: remove newlines and extra spaces
            const cleanStr = s.replace(/\s+/g, ' ').trim();

            // Extract all rank matches: #123,456 in Category Name
            const matches = [];
            // This regex captures the rank number and the category following "in"
            // It stops at another "#", a newline, or common Amazon "See Top 100" suffixes
            const rankRegex = /#([\d,]+)\s+in\s+([^#\n]+?)(?=\s*(?:\(|#|Best Sellers Rank|$))/gi;
            let m;

            while ((m = rankRegex.exec(cleanStr)) !== null) {
                const rankValue = parseInt(m[1].replace(/,/g, ''));
                const categoryName = m[2].trim().replace(/\s*\(See Top 100 in.*\)\s*/i, '').trim();

                matches.push({
                    rank: rankValue,
                    category: categoryName,
                    full: `#${m[1]} in ${categoryName}`
                });
            }

            // Fallback for simple "#123" without category if no complex ranks found
            if (matches.length === 0) {
                const simpleMatch = cleanStr.match(/#([\d,]+)/);
                if (simpleMatch) {
                    matches.push({
                        rank: parseInt(simpleMatch[1].replace(/,/g, '')),
                        category: '',
                        full: simpleMatch[0]
                    });
                }
            }

            return matches;
        };

        // 1. Gather all unique ranks found across all potential fields
        const allFoundRanks = [];
        [...mainFields, ...subFields].forEach(field => {
            const val = rawData[field];
            if (val) {
                const extracted = extractRankInfo(val);
                extracted.forEach(item => {
                    if (!allFoundRanks.some(r => r.rank === item.rank && r.category === item.category)) {
                        allFoundRanks.push(item);
                    }
                });
            }
        });

        // 2. Classify ranks into Main and Sub
        allFoundRanks.forEach(item => {
            if (!allRanks.includes(item.full)) allRanks.push(item.full);

            // Check if this is a top-level category rank
            const isTopLevel = AMAZON_TOP_LEVEL_CATEGORIES.some(cat =>
                item.category.toLowerCase().trim() === cat.toLowerCase().trim() ||
                item.category.toLowerCase().startsWith(cat.toLowerCase() + ' ')
            );

            if (isTopLevel) {
                // If multiple top-levels exist, the first one found (usually from mainFields) wins
                if (main === 0) main = item.rank;
            } else {
                // If it's not top-level, it's a sub-rank
                if (sub === 0) {
                    sub = item.rank;
                    subBsrString = item.full;
                }
            }
        });

        // No fallback logic here: If main is 0, it stays 0 unless a top-level category match was found.
        return { main, sub, subBsrString, allRanks };
    }

    /**
     * Count images and videos from Octoparse image_count HTML
     * Properly detects videoThumbnail class and videoCount span
     */
    _countImagesAndVideos(rawData) {
        let imagesCount = 0;
        let videoCount = 0;
        let images = [];

        const imgHtml = this._getFromRaw(rawData, ['image_count', 'Field6', 'images_html'], '');

        if (imgHtml && typeof imgHtml === 'string' && imgHtml.length > 0) {
            try {
                // Count image thumbnails (li elements with imageThumbnail class)
                const imageLiMatches = imgHtml.match(/<li[^>]*class="[^"]*imageThumbnail[^"]*"[^>]*>/gi) || [];
                imagesCount = imageLiMatches.length;

                // Count video thumbnails specifically
                const videoLiMatches = imgHtml.match(/<li[^>]*class="[^"]*videoThumbnail[^"]*"[^>]*>/gi) || [];

                // Check for video count span (e.g., '<span id="videoCount"...>2 VIDEOS</span>')
                const videoCountSpan = imgHtml.match(/<span[^>]*id="videoCount"[^>]*>(\d+)\s*VIDEOS?<\/span>/i);
                if (videoCountSpan) {
                    videoCount = parseInt(videoCountSpan[1]) || 0;
                } else {
                    videoCount = videoLiMatches.length;
                }

                // Extract image URLs from img tags
                const imgSrcMatches = imgHtml.match(/src="([^"]+\.jpg[^"]*)"/gi);
                if (imgSrcMatches) {
                    images = imgSrcMatches.map(src => src.replace(/src="/g, '').replace(/"/g, ''));
                }

                // If no images found via counting, count all li elements
                if (imagesCount === 0) {
                    const allLiMatches = imgHtml.match(/<li[^>]*>/gi) || [];
                    imagesCount = allLiMatches.length - videoLiMatches.length;
                }
            } catch (e) {
                console.warn('Image count parsing failed:', e.message);
            }
        } else {
            // Fallback to numeric fields
            imagesCount = parseInt(this._getFromRaw(rawData, ['imageCount', 'imagesCount', 'Field6'], 0)) || 0;
            videoCount = parseInt(this._getFromRaw(rawData, ['videoCount', 'video_count', 'videos'], 0)) || 0;
        }

        // Ensure we have at least main image counted
        if (imagesCount === 0) {
            const mainImage = this._getFromRaw(rawData, ['Main_Image', 'mainImage', 'imageUrl', 'Field5'], '');
            if (mainImage) imagesCount = 1;
        }

        return { imagesCount, videoCount, images };
    }

    /**
     * Detect A+ Content presence from Octoparse data
     */
    _parseDiscount(rawData, price, mrp) {
        const perc = this._getFromRaw(rawData, ['percentage', 'Discount', 'discount', 'Field15'], '');
        if (perc) {
            const match = perc.match(/(\d+)/);
            if (match) return parseInt(match[1]);
        }
        if (mrp > price && mrp > 0) {
            return Math.round(((mrp - price) / mrp) * 100);
        }
        return 0;
    }

    _detectAplusContent(rawData) {
        // Priority 1: Explicit boolean/flag fields
        const explicitFlags = ['has_aplus', 'A_plus', 'aplus', 'hasAplus', 'isAplus'];
        for (const flag of explicitFlags) {
            const val = rawData[flag];
            if (typeof val === 'boolean') return val;
            if (typeof val === 'string') {
                const lower = val.toLowerCase();
                if (lower === 'true' || lower === 'yes' || lower === '1') return true;
                if (lower === 'false' || lower === 'no' || lower === '0') return false;
            }
        }

        // Priority 2: Check A_plus field for A+ markers
        const aplusContent = this._getFromRaw(rawData, ['A_plus', 'aplus_content', 'product_description'], '');
        if (aplusContent && typeof aplusContent === 'string') {
            const aplusMarkers = [
                'aplus-v2', 'aplus-standard', 'aplus-module', 'launchpad-module',
                'apm-', 'aplus-content-wrapper', 'productDescription_feature_div'
            ];

            for (const marker of aplusMarkers) {
                if (aplusContent.toLowerCase().includes(marker.toLowerCase())) {
                    return true;
                }
            }

            // If content has significant length and HTML structure
            if (aplusContent.length > 300 && (aplusContent.includes('<div') || aplusContent.includes('<img'))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract seller name from raw data
     */
    _extractSellerFromRaw(rawData) {
        // Try direct fields first
        const sellerFields = ['sold_by', 'Sold_by', 'seller', 'Seller', 'merchant', 'Merchant', 'Field11', 'SoldBy', 'Sold_By'];
        for (const field of sellerFields) {
            const value = rawData[field];
            if (value && typeof value === 'string' && value.trim().length > 0) {
                // If it looks like HTML, try to extract the text
                if (value.includes('<') && value.includes('>')) {
                    const extracted = this._extractSellerFromBuyboxHtml(value);
                    if (extracted) return extracted;

                    // Simple regex fallback if helper fails
                    let clean = value.replace(/<[^>]+>/g, '').trim();
                    clean = clean.replace(/^(Sold by|Ships from)\s*/i, '').trim();
                    if (clean) return clean;
                }
                let clean = value.trim();
                clean = clean.replace(/^(Sold by|Ships from)\s*/i, '').trim();
                return clean;
            }
        }

        // Fallback: check secondary buybox or other fields that might contain HTML
        const htmlFields = ['second_buybox', 'Alt_buyBox', 'Field25', 'buybox_html'];
        for (const field of htmlFields) {
            const val = rawData[field];
            if (val && typeof val === 'string' && val.includes('<')) {
                const extracted = this._extractSellerFromBuyboxHtml(val);
                if (extracted) return extracted;
            }
        }

        return '';
    }

    /**
     * Check if seller is a buy box winner (trusted seller)
     */
    _isBuyBoxWinner(sellerName) {
        if (!sellerName) return false;

        // Get trusted sellers from environment
        const trustedSellersStr = process.env.TRUSTED_SELLER_NAMES || 'Amazon,RetailEZ Pvt Ltd,Cloudtail,Appario';
        const trustedSellers = trustedSellersStr.split(',').map(s => s.trim().toLowerCase());

        const sellerLower = sellerName.toLowerCase();
        return trustedSellers.some(trusted => sellerLower.includes(trusted));
    }

    /**
     * Parse category from HTML breadcrumb
     */

    /**
     * Parse rating breakdown from HTML or string
     */
    _parseRatingBreakdown(ratingStr) {
        const breakdown = { fiveStar: 0, fourStar: 0, threeStar: 0, twoStar: 0, oneStar: 0 };

        if (!ratingStr) return breakdown;

        const s = ratingStr.toString();

        // Extract percentages from the pattern (e.g., "53%23%12%5%7%")
        const percMatch = s.match(/(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%/);
        if (percMatch) {
            breakdown.fiveStar = parseFloat(percMatch[1]) || 0;
            breakdown.fourStar = parseFloat(percMatch[2]) || 0;
            breakdown.threeStar = parseFloat(percMatch[3]) || 0;
            breakdown.twoStar = parseFloat(percMatch[4]) || 0;
            breakdown.oneStar = parseFloat(percMatch[5]) || 0;
        }

        return breakdown;
    }

    /**
     * Parse bullet points from HTML
     */
    _parseBulletPoints(bulletHtml) {
        if (!bulletHtml || typeof bulletHtml !== 'string') return [];

        const bulletPoints = [];

        // Method 1: JSDOM - preserve exact text from <li> elements
        try {
            const dom = new JSDOM(bulletHtml);
            const doc = dom.window.document;

            const liTags = doc.querySelectorAll('li');
            for (const li of liTags) {
                let text = li.textContent
                    .replace(/&amp;/g, '&')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .replace(/\s+/g, ' ')
                    .trim();

                if (text && text.length > 3 && !bulletPoints.includes(text)) {
                    bulletPoints.push(text);
                }
            }

            if (bulletPoints.length > 0) return bulletPoints;
        } catch (e) {
            console.warn('JSDOM bullet parsing failed:', e.message);
        }

        // Method 2: Regex for <li> elements
        const liRegex = /<li[^>]*>(.*?)<\/li>/gis;
        let match;
        while ((match = liRegex.exec(bulletHtml)) !== null) {
            let text = match[1]
                .replace(/<span[^>]*>/g, '')
                .replace(/<\/span>/g, '')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s+/g, ' ')
                .trim();

            if (text && text.length > 3 && !bulletPoints.includes(text)) {
                bulletPoints.push(text);
            }
        }

        return bulletPoints;
    }

    /**
     * Clean price from various formats
     */
    _cleanPrice(str) {
        if (!str) return 0;
        const cleaned = str.toString().replace(/[₹$€£,]/g, '').trim();
        const match = cleaned.match(/(\d+(?:\.\d+)?)/);
        return match ? parseFloat(match[1]) : 0;
    }

    /**
     * Clean BSR number from string
     */
    _cleanBsr(str) {
        if (!str) return 0;
        const cleaned = str.toString().replace(/,/g, '').trim();
        const match = cleaned.match(/#?(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Clean review count from various formats
     */
    _cleanReviewCount(str) {
        if (!str) return 0;
        let s = str.toString().trim();

        // Remove common Amazon rating noise
        s = s.replace(/out\s+of\s+[0-5](?:\.[0-9])?/gi, '');
        s = s.replace(/[0-5]\s*stars?/gi, '');

        // Parenthesized numbers with commas (e.g., "(2,441)")
        const parenMatch = s.match(/\(([\d,]+)\)/);
        if (parenMatch) {
            const val = parseInt(parenMatch[1].replace(/,/g, ''));
            if (val > 0) return val;
        }

        // Direct number with commas
        const numMatch = s.match(/([\d,]+)/);
        if (numMatch) {
            const val = parseInt(numMatch[1].replace(/,/g, ''));
            if (val > 0 && val < 10000000) return val;
        }

        return 0;
    }

    /**
     * Clean deal badge text
     */
    _cleanDealBadge(str) {
        if (!str || str === 'null' || str === '') return 'No deal found';
        const s = str.toString().toLowerCase();

        if (s.includes('limited time deal')) return 'Limited Time Deal';
        if (s.includes('deal of the day')) return 'Deal of the Day';
        if (s.includes('lightning deal')) return 'Lightning Deal';
        if (s.includes('prime deal')) return 'Prime Deal';
        if (s.includes('coupon')) return 'Coupon Available';

        const cleaned = str.trim().replace(/\s+/g, ' ').split(/NO_OF/)[0].trim();
        return cleaned.length > 30 ? cleaned.substring(0, 27) + '...' : (cleaned || 'No deal found');
    }

    /**
     * Clean stock level
     */
    _cleanStock(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const cleaned = val.toString().replace(/[^0-9]/g, '').trim();
        return parseInt(cleaned) || 0;
    }

    _parseSecondaryBuybox(htmlContent) {
        if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.length < 50) {
            return { offers: [], hasMultipleSellers: false };
        }

        const offers = [];
        try {
            const dom = new JSDOM(htmlContent);
            const doc = dom.window.document;

            const offerContainers = doc.querySelectorAll('.aod-offer, .a-fixed-left-grid, [id^="aod-offer"]');

            for (const container of offerContainers) {
                const offer = {};

                const sellerLink = container.querySelector('a[href*="seller="], [aria-label*="Seller"], #aod-offer-shipsFrom-soldBy');
                if (sellerLink) {
                    offer.seller = sellerLink.textContent.trim().replace(/^Sold by\s*/i, '');
                }

                const priceWhole = container.querySelector('.a-price-whole');
                const priceFraction = container.querySelector('.a-price-fraction');
                if (priceWhole) {
                    const whole = priceWhole.textContent.replace(/,/g, '');
                    const fraction = priceFraction ? priceFraction.textContent : '00';
                    offer.price = parseFloat(`${whole}.${fraction}`);
                }

                if (offer.seller || offer.price) offers.push(offer);
            }

            if (offers.length === 0) {
                // Regex fallback
                const sellers = htmlContent.match(/Sold by\s*<\/span>\s*<[^>]+>\s*<a[^>]*>([^<]+)</gi);
                const prices = htmlContent.match(/₹\s*([\d,]+)\.(\d{2})/g);

                for (let i = 0; i < Math.max(sellers?.length || 0, prices?.length || 0); i++) {
                    const offer = {};
                    if (sellers && sellers[i]) {
                        const m = sellers[i].match(/>([^<]+)</);
                        if (m) offer.seller = m[1].trim();
                    }
                    if (prices && prices[i]) {
                        offer.price = parseFloat(prices[i].replace(/[₹,\s]/g, ''));
                    }
                    if (offer.seller || offer.price) offers.push(offer);
                }
            }
        } catch (e) {
            console.warn('Failed to parse secondary buybox HTML:', e.message);
        }

        return {
            offers,
            hasMultipleSellers: offers.length > 1,
            alternateSeller: offers.length > 0 ? offers[0].seller : null,
            alternatePrice: offers.length > 0 ? offers[0].price : null
        };
    }

    _extractSellerFromBuyboxHtml(htmlContent) {
        if (!htmlContent || typeof htmlContent !== 'string') return null;

        // Pattern 1: Sold by section with link text
        const soldByMatch = htmlContent.match(/Sold by\s*<\/span>\s*<[^>]+>\s*<a[^>]*>([^<]+)</i);
        if (soldByMatch) return soldByMatch[1].trim();

        // Pattern 2: aria-label with seller info
        const ariaMatch = htmlContent.match(/aria-label="[^"]*Seller[^"]*:\s*([^"]+)/i);
        if (ariaMatch) return ariaMatch[1].trim();

        // Pattern 3: Direct seller name in text
        const textMatch = htmlContent.match(/sold by\s*[:;]?\s*([^<>{}\n]+)/i);
        if (textMatch) return textMatch[1].trim();

        return null;
    }

    _parseBoolean(val) {
        if (typeof val === 'boolean') return val;
        if (!val) return false;
        const str = val.toString().toLowerCase().trim();
        return ['true', 'yes', '1', 'y', 't', 'active'].includes(str);
    }

    _extractAsinFromData(rawData) {
        if (!rawData) return null;

        // Direct fields - check common ASIN field names
        const direct = this._getFromRaw(rawData, ['ASIN', 'asin', 'asinCode', 'asin_code', 'AsinCode', 'ASIN_CODE'], '');
        if (direct && direct.length === 10) {
            // Ensure it's a valid ASIN format (alphanumeric, 10 chars)
            if (/^[A-Z0-9]{10}$/i.test(direct)) {
                return direct.toUpperCase(); // Return normalized uppercase
            }
        }

        // URL extraction - check multiple URL field names
        const urlField = this._getFromRaw(rawData, ['Original_URL', 'Original URL', 'target_url', 'url', 'Url', 'URL', 'ProductURL', 'product_url'], '');
        if (urlField && typeof urlField === 'string') {
            // Enhanced regex to match various Amazon URL formats
            // Supports: /dp/ASIN, /product/ASIN, /gp/product/ASIN, /gp/offer-listing/ASIN
            // Also handles URLs with query parameters and fragments
            const patterns = [
                /\/dp\/([A-Z0-9]{10})/i,
                /\/product\/([A-Z0-9]{10})/i,
                /\/gp\/product\/([A-Z0-9]{10})/i,
                /\/gp\/offer-listing\/([A-Z0-9]{10})/i,
                /\/([A-Z0-9]{10})(?:[?\/]|$)/i, // Fallback: ASIN at path root
                /[?&]asin=([A-Z0-9]{10})/i, // ASIN in query parameters
                /[?&]ASIN=([A-Z0-9]{10})/i
            ];

            for (const pattern of patterns) {
                const match = urlField.match(pattern);
                if (match) {
                    const asin = match[1].toUpperCase();
                    if (/^[A-Z0-9]{10}$/.test(asin)) {
                        return asin;
                    }
                }
            }
        }

        return null;
    }

    /**
     * Finds and assigns an available task ID from the pool to a seller.
     */
    async assignTaskFromPool(sellerId) {
        try {
            const pool = await getPool();

            // 1. Find an unassigned task
            const taskResult = await pool.request()
                .query("SELECT TOP 1 Id, TaskId FROM OctoTasks WHERE IsAssigned = 0 ORDER BY CreatedAt ASC");

            const task = taskResult.recordset[0];
            if (!task) {
                console.warn('⚠️ No available Octoparse tasks in the pool.');
                return null;
            }

            // 2. Mark as assigned
            await pool.request()
                .input('id', sql.VarChar, task.Id)
                .input('sellerId', sql.VarChar, sellerId)
                .input('now', sql.DateTime2, new Date())
                .query("UPDATE OctoTasks SET IsAssigned = 1, SellerId = @sellerId, LastAssignedAt = @now, UpdatedAt = GETDATE() WHERE Id = @id");

            // 3. Sync with Seller model
            await pool.request()
                .input('octoparseId', sql.NVarChar, task.TaskId)
                .input('sellerId', sql.VarChar, sellerId)
                .query("UPDATE Sellers SET OctoparseId = @octoparseId, UpdatedAt = GETDATE() WHERE Id = @sellerId");

            console.log(`✅ Assigned Pool Task ${task.TaskId} to seller: ${sellerId}`);
            return task.TaskId;
        } catch (error) {
            console.error('❌ Assign Task From Pool Error:', error.message);
            return null;
        }
    }

    /**
     * Imports a list of Task IDs into the available pool.
     */
    async importTaskPool(taskIds) {
        try {
            const pool = await getPool();
            let addedCount = 0;

            for (const id of taskIds) {
                const taskId = id.trim();
                if (!taskId) continue;

                const result = await pool.request()
                    .input('taskId', sql.NVarChar, taskId)
                    .input('newId', sql.VarChar, generateId())
                    .query(`
                        IF NOT EXISTS (SELECT 1 FROM OctoTasks WHERE TaskId = @taskId)
                        BEGIN
                            INSERT INTO OctoTasks (Id, TaskId, IsAssigned, CreatedAt, UpdatedAt)
                            VALUES (@newId, @taskId, 0, GETDATE(), GETDATE());
                            SELECT 1 as Added;
                        END
                        ELSE SELECT 0 as Added;
                    `);

                if (result.recordset[0]?.Added) addedCount++;
            }

            const stats = await this.getPoolStats();
            return {
                added: addedCount,
                stats
            };
        } catch (error) {
            console.error('❌ Import Task Pool Error:', error.message);
            throw error;
        }
    }

    /**
     * Gets statistics on the Octoparse task pool.
     */
    async getPoolStats() {
        try {
            const pool = await getPool();
            const result = await pool.request().query(`
                SELECT 
                    COUNT(*) as Total,
                    SUM(CASE WHEN IsAssigned = 1 THEN 1 ELSE 0 END) as Assigned
                FROM OctoTasks
            `);

            const total = result.recordset[0].Total || 0;
            const assigned = result.recordset[0].Assigned || 0;
            const available = total - assigned;

            return { total, assigned, available };
        } catch (error) {
            console.error('❌ Get Pool Stats Error:', error.message);
            return { total: 0, assigned: 0, available: 0 };
        }
    }

    /**
     * Small utility to wait for a specified time.
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Resolves a UUID taskId to its legacy integer ID by searching the group task list.
     */
    async resolveTaskIdToInteger(uuid, groupId = null) {
        try {
            console.log(`🔍 Resolving UUID ${uuid} to integer ID...`);

            // 1. If groupId is provided, check that group first (with pagination)
            if (groupId) {
                for (let offset = 0; offset <= 200; offset += 50) {
                    const response = await axios.get(`${this.baseUrl}/task/search`, {
                        params: { taskGroupId: groupId, size: 50, offset },
                        headers: { 'Authorization': `Bearer ${await this.authenticate()}` }
                    });
                    const tasks = response.data?.data || [];
                    console.log(`🔍 Task search response (group ${groupId}, offset ${offset}):`, JSON.stringify(tasks.slice(0, 2)));
                    const task = (tasks || []).find(t => t.taskId === uuid || t.id?.toString() === uuid);
                    if (task) {
                        console.log(`🎯 Found task in single group:`, JSON.stringify(task));
                        return task.id || task.taskId || task.TaskID || task.intId;
                    }
                    if (tasks.length < 50) break;
                }
            }

            // 2. SEARCH ALL GROUPS (Fallback for when we only have a UUID)
            console.log(`🌐 Searching all task groups for UUID: ${uuid}...`);
            const groups = await this.getTaskGroupList();
            for (const group of groups) {
                const id = group.categoryId || group.id || group.taskGroupId;
                if (!id) continue;

                // Search each group with pagination
                for (let offset = 0; offset <= 200; offset += 50) {
                    const tasksResponse = await axios.get(`${this.baseUrl}/task/search`, {
                        params: { taskGroupId: id, size: 50, offset },
                        headers: { 'Authorization': `Bearer ${await this.authenticate()}` }
                    });
                    const tasks = tasksResponse.data?.data || [];
                    const found = (tasks || []).find(t => t.taskId === uuid || t.id?.toString() === uuid);
                    if (found) {
                        console.log(`🎯 Found task ${uuid} in group ${id}. Task object:`, JSON.stringify(found));
                        console.log(`🎯 Found task ${uuid} in group ${id}. Integer ID: ${found.id || found.taskId || found.TaskID || 'NOT_FOUND'}`);
                        return found.id || found.taskId || found.TaskID;
                    }
                    if (tasks.length < 50) break;
                }
            }

            return null;
        } catch (error) {
            console.error('❌ Resolve Task ID Error:', error.message);
            return null;
        }
    }

    /**
     * Process manually uploaded Octoparse JSON data.
     * This is a wrapper around processBatchResults for manual file uploads.
     */
    async processManualJsonSync(sellerId, jsonData) {
        if (!jsonData || !Array.isArray(jsonData)) {
            throw new Error('Invalid JSON data format. Expected an array of records.');
        }

        console.log(`📂 Manual Octoparse JSON Sync started for seller ${sellerId} with ${jsonData.length} records.`);

        try {
            // Re-use the robust batch processing logic
            const updatedCount = await this.processBatchResults(sellerId, jsonData);

            // Log completion
            console.log(`✅ Manual Octoparse JSON Sync completed. Updated ${updatedCount} ASINs.`);

            return {
                message: `Successfully processed ${jsonData.length} records and updated ${updatedCount} ASINs.`,
                updatedCount,
                totalProcessed: jsonData.length
            };
        } catch (error) {
            console.error('❌ Manual JSON Sync Error:', error.message);
            throw new Error('Failed to process Octoparse JSON data: ' + error.message);
        }
    }
}

module.exports = new MarketDataSyncService();
