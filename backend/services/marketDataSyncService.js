const axios = require('axios');
const Asin = require('../models/Asin');
const Action = require('../models/Action');
const OctoTask = require('../models/OctoTask');
const Seller = require('../models/Seller');
const config = require('../config/env');
const imageGenerationService = require('./imageGenerationService');
const { JSDOM } = require('jsdom');
const SocketService = require('./socketService');
const nvidiaAiService = require('./nvidiaAiService');
const { MemorySafeProcessor, clearArray } = require('../utils/memorySafe');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');


// Initialize memory-safe processor
const memProcessor = new MemorySafeProcessor({
    batchSize: 50,
    delay: 50,
    maxMemoryPercent: 70
});

/**
 * Discreet service for syncing market data from external provider.
 * Naming is abstract (MarketDataSync) to avoid provider exposure.
 */
class MarketDataSyncService {
    constructor() {
        this.baseUrl = 'https://openapi.octoparse.com';
        this.token = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.tokenType = 'Bearer';
        this.syncLocks = new Map(); // Concurrency control per sellerId
        this.statusCache = new Map(); // Simple status cache to prevent 429s (TTL: 10s)
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
            // Find seller by taskId
            const seller = await Seller.findOne({ marketSyncTaskId: taskId });
            if (!seller) {
                console.warn(`⚠️ triggerSync called for unknown task ${taskId}. Falling back to standard cloud start.`);
                return await this.startCloudExtraction(taskId);
            }
            
            console.log(`🔄 Redirecting legacy triggerSync for seller ${seller.name} to robust sync-all...`);
            const success = await this.syncSellerAsinsToOctoparse(seller._id, { triggerScrape: true });
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
                            const Seller = require('../models/Seller');
                            await Seller.findByIdAndUpdate(sellerId, { 
                                lastScraped: new Date(),
                                scrapeUsed: count
                            });
                            
                            console.log(`🎉 [AUTO] Successfully ingested ${count} metrics for seller ${sellerId}.`);
                            
                            // Cleanup: Mark as exported to keep Octoparse queue clean
                            await this.markDataAsExported(taskId).catch(() => {});
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
            const seller = await Seller.findById(sellerId);
            if (!seller) throw new Error('Seller not found');

            // 1. Check if they already have a task
            if (seller.marketSyncTaskId) {
                console.log(`ℹ️ Seller ${seller.name} already has task: ${seller.marketSyncTaskId}`);
                return seller.marketSyncTaskId;
            }

            // 2. Duplicate from Master Template
            console.log(`🏗️ Creating new Octoparse task for seller: ${seller.name}...`);
            const taskName = `${seller.name} Sync`;
            const newTaskId = await this.duplicateTask(taskName);

            if (!newTaskId) {
                throw new Error('Failed to duplicate task from master template.');
            }

            // 3. Save to Seller record
            seller.marketSyncTaskId = newTaskId;
            await seller.save();

            console.log(`✅ Seller ${seller.name} now linked to task: ${newTaskId}`);
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
            const asins = await Asin.find({ 
                seller: sellerId, 
                status: 'Active' 
            }).select('asinCode');

            if (asins.length === 0) {
                console.log(`⚠️ No active ASINs to sync for seller: ${sellerId}`);
                return false;
            }

            console.log(`✅ Found ${asins.length} active ASINs in database`);

            // Create URLs from ASINs
            const asinCodes = asins.map(a => a.asinCode);
            const urls = asinCodes.map(code => `https://www.amazon.in/dp/${code}`);

            // 3. PERSIST URLs to Database for record-keeping and formal injection
            await Seller.findByIdAndUpdate(sellerId, { 
                marketSyncUrls: urls,
                totalAsins: asins.length // Update metadata while we are here
            });
            console.log(`💾 Persisted ${urls.length} URLs to Database for seller: ${sellerId}`);

            console.log(`🔄 Syncing ${urls.length} ASINs to task ${taskId}...`);

            // 4. Update task URLs (using FILE endpoint only as per user request)
            const seller = await Seller.findById(sellerId).select('marketSyncUrls');
            const syncUrls = seller?.marketSyncUrls || urls;

            try {
                await this.updateTaskUrlsWithFile(taskId, syncUrls);
            } catch (injectionError) {
                console.error(`❌ File-based injection failed for task ${taskId}: ${injectionError.message}`);
                // Don't fall back to Loop Items anymore
                throw injectionError;
            }


            // 5. Trigger Scrape if requested
            if (triggerScrape) {
                console.log(`🚀 Automated trigger: Starting scrape for task ${taskId}...`);
                const startResult = await this.startCloudExtraction(taskId);
                console.log(`✅ Cloud extraction started for task ${taskId}:`, startResult);

                // START BACKGROUND AUTOMATION: Poll and Ingest once done
                // We do NOT await this so the response returns to user immediately
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
            const asin = await Asin.findById(asinId);
            if (!asin) throw new Error('ASIN not found');

            // --- Robust Advanced Mapping (Octoparse Specialized) ---
            
            // 1. Price & Deal Logic
            const price = this._cleanPrice(rawData.asp || rawData.price || rawData.currentPrice || rawData.Field2);
            const mrp = this._cleanPrice(rawData.mrp || rawData.listPrice || rawData.Field3);
            const dealBadge = (rawData.deal_badge && rawData.deal_badge !== 'null' && rawData.deal_badge !== '') ? rawData.deal_badge.trim() : 'No deal found';
            const priceType = dealBadge !== 'No deal found' ? 'Deal Price' : 'Standard Price';

            // 2. Title & Character Count
            const title = (rawData.Title || rawData.title || rawData.Field1 || asin.title || '').trim();
            const titleLength = title.length;

            let category = (rawData.category || rawData.Field4 || asin.category || '').trim();
            if (category.includes('<li')) {
                try {
                    const dom = new JSDOM(category);
                    const liTags = Array.from(dom.window.document.querySelectorAll('li'));
                    if (liTags.length > 0) {
                        category = liTags.map(li => li.textContent.trim().replace(/^›\s*/, '').replace(/\s*›$/, '').trim()).filter(Boolean).join(' › ');
                    }
                } catch (e) {
                    console.warn('Category HTML parsing failed, using raw string');
                }
            }

            // 4. BSR Parsing (Main BSR: #XXXX in Cat, Sub BSR: #XXXX in SubCat)
             const bsrString = rawData.BSR || rawData.Field9 || rawData.bsr || rawData.alt_bsr || '';
             const bsr = this._cleanBsr(bsrString);
             const subBsr = this._cleanBsr(rawData.sub_BSR || rawData.alt_sub_bsr || '');

            // Extract all rank strings (e.g. #476 in Men's Kurtas) fallback
            let subBSRs = [];
            if (bsrString && typeof bsrString === 'string') {
                const parts = bsrString.split(/\s{2,}|\n/).map(p => p.trim()).filter(Boolean);
                subBSRs = parts.filter(p => p.includes('#') && (p.toLowerCase().includes(' in ') || p.toLowerCase().includes(' ( ')));
            }

            // 5. Image Processing (Gallery extraction + Video Detection)
            let imageCount = 0;
            let videoCount = 0;
            let images = [];
            const imgHtml = rawData.image_count || rawData.Field6 || '';
            if (imgHtml && typeof imgHtml === 'string' && imgHtml.includes('<li')) {
                try {
                    const imgDom = new JSDOM(imgHtml);
                    const liTags = imgDom.window.document.querySelectorAll('li');
                    imageCount = liTags.length;
                    
                    // Check for video thumbnails (usually have class 'videoThumbnail')
                    const videoTags = Array.from(imgDom.window.document.querySelectorAll('.videoThumbnail, .video-thumbnail, video'));
                    videoCount = videoTags.length;
                    
                    images = Array.from(imgDom.window.document.querySelectorAll('img')).map(img => img.src).filter(Boolean);
                } catch (e) {
                    console.warn('Image HTML parsing failed');
                }
            } else {
                imageCount = parseInt(rawData.imageCount || rawData.imagesCount || rawData.Field6 || 0);
                videoCount = parseInt(rawData.videoCount || rawData.video_count || 0);
            }
            const mainImageUrl = rawData.Main_Image || rawData.mainImage || rawData.imageUrl || rawData.Field5 || asin.imageUrl;

            // 6. Rating & Reviews
            // Strictly use avg_rating field – no other parsing methods
            let rating = parseFloat(rawData.avg_rating);
            if (isNaN(rating)) rating = 0;

            // Clean review count (keep existing logic, as it doesn't affect rating value)
            let reviewCount = this._cleanReviewCount(rawData.review_count || rawData.Review_Count || rawData.Rating_Count || rawData.rating || '');

            // Rating breakdown percentages – keep as is
            let p5 = 0, p4 = 0, p3 = 0, p2 = 0, p1 = 0;
            const ratingStr = rawData.Rating || rawData.Field7 || '';
            if (ratingStr) {
                // Extracts the first continuous 5 percentages out of the html histogram string
                const percMatch = ratingStr.match(/(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%[^\d]*?(\d{1,3})%/);
                if (percMatch) {
                    p5 = parseFloat(percMatch[1]);
                    p4 = parseFloat(percMatch[2]);
                    p3 = parseFloat(percMatch[3]);
                    p2 = parseFloat(percMatch[4]);
                    p1 = parseFloat(percMatch[5]);
                } else {
                    p5 = parseFloat(rawData['5_star'] || rawData.five_star || 0);
                    p4 = parseFloat(rawData['4_star'] || rawData.four_star || 0);
                    p3 = parseFloat(rawData['3_star'] || rawData.three_star || 0);
                    p2 = parseFloat(rawData['2_star'] || rawData.two_star || 0);
                    p1 = parseFloat(rawData['1_star'] || rawData.one_star || 0);
                }
            }

            // Rating breakdown percentages – store raw percentages (0-100), NOT review counts
            const ratingBreakdown = {
                fiveStar: p5 || asin.ratingBreakdown?.fiveStar || 0,
                fourStar: p4 || asin.ratingBreakdown?.fourStar || 0,
                threeStar: p3 || asin.ratingBreakdown?.threeStar || 0,
                twoStar: p2 || asin.ratingBreakdown?.twoStar || 0,
                oneStar: p1 || asin.ratingBreakdown?.oneStar || 0
            };

            // 7. Bullet Points
            let bulletPointsText = [
                rawData.bp_1, rawData.bp_2, rawData.bp_3, rawData.bp_4, rawData.bp_5, rawData.bullet_points_1
            ].map(p => p?.trim()).filter(Boolean);

            // Fallback: Parse bullet_points HTML if plain list is empty
            if (bulletPointsText.length === 0 && rawData.bullet_points?.includes('<li')) {
                try {
                    const bpDom = new JSDOM(rawData.bullet_points);
                    bulletPointsText = Array.from(bpDom.window.document.querySelectorAll('li')).map(li => li.textContent.trim()).filter(Boolean);
                } catch (e) {
                    console.warn('Bullet point HTML parsing failed');
                }
            }
            const bulletPoints = bulletPointsText.length || parseInt(rawData.bulletPoints || rawData.bullet_points_count || 0);

            // 8. Stock Level, A+ Content & Availability
            const stockLevel = this._cleanStock(rawData.stock_level || rawData.Field10 || rawData.stock || 0);
            
            // Robust A+ Content detection (Octoparse may extract the actual HTML/JS content)
            const rawAplus = rawData.has_aplus || rawData.A_plus || rawData.Field15 || '';
            const hasAplus = (typeof rawAplus === 'string' && rawAplus.trim().length > 20) 
                              ? true 
                              : this._parseBoolean(rawAplus || false);
            
            // Parse custom user fields (availability is unavilable typo in octoparse)
            const availabilityStatus = rawData.unavilable || rawData.status || rawData.availabilityStatus || rawData.availability || asin.availabilityStatus || 'Available';
            
            // Map A+ presence/absence logic using database tracked timestamps
            let aplusAbsentSince = asin.aplusAbsentSince;
            let aplusPresentSince = asin.aplusPresentSince;
            if (hasAplus) {
                aplusPresentSince = aplusPresentSince || new Date();
                aplusAbsentSince = null; // reset absent timer
            } else {
                aplusAbsentSince = aplusAbsentSince || new Date();
                aplusPresentSince = null; // reset present timer
            }

            // 9. Sold By & Second Buy Box
            const soldBy = rawData.sold_by || rawData.Field11 || asin.soldBy || '';
            const secondAsp = this._cleanPrice(rawData.second_asp || '') || asin.secondAsp;
            const soldBySec = (rawData.Sold_by_sec || asin.soldBySec || '').trim();

            const updates = {
                title,
                titleLength,
                description: rawData.description || asin.description,
                category,
                mrp: mrp > 0 ? mrp : asin.mrp,
                currentPrice: price > 0 ? price : asin.currentPrice,
                currentASP: price > 0 ? price : asin.currentASP,
                priceType,
                dealBadge,
                bsr,
                subBsr,
                subBSRs,
                rating: rating > 0 ? rating : asin.rating,
                reviewCount: reviewCount > 0 ? reviewCount : asin.reviewCount,
                imagesCount: imageCount > 0 ? imageCount : asin.imagesCount,
                videoCount: videoCount >= 0 ? videoCount : asin.videoCount,
                images,
                mainImageUrl: mainImageUrl || asin.mainImageUrl,
                imageUrl: mainImageUrl || asin.imageUrl, // Compatibility
                soldBy,
                secondAsp,
                soldBySec,
                buyBoxWin: isBuyBoxWinner(soldBy),
                buyBoxSellerId: soldBy || asin.buyBoxSellerId,
                bulletPoints,
                bulletPointsText,
                stockLevel,
                hasAplus,
                aplusAbsentSince,
                aplusPresentSince,
                availabilityStatus,
                ratingBreakdown,
                rawOctoparseData: rawData, // Preserve complete original data
                lastScraped: new Date(),
                scrapeStatus: 'COMPLETED',
                status: 'Active',
                updatedAt: new Date()
            };

            // Update history
            asin.history.push({
                date: new Date(),
                price: updates.currentPrice,
                bsr: updates.bsr,
                rating: updates.rating,
                reviewCount: updates.reviewCount,
                imageCount: updates.imagesCount,
                videoCount: updates.videoCount,
                lqs: asin.lqs || 0
            });
            if (asin.history.length > 30) asin.history = asin.history.slice(-30);

            // Calculate current week string
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 0);
            const diff = now - start;
            const weekOfYr = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
            const weekStr = `W${weekOfYr}-${now.getFullYear()}`;

            // Update Week-on-Week History
            asin.updateWeekHistory({
                week: weekStr,
                date: now,
                price: updates.currentPrice,
                bsr: updates.bsr,
                rating: updates.rating,
                reviews: updates.reviewCount,
                imageCount: updates.imagesCount,
                titleLength: updates.titleLength,
                bulletPoints: updates.bulletPoints,
                subBSRs: updates.subBSRs,
                hasAplus: updates.hasAplus,
                stockLevel: updates.stockLevel,
                videoCount: updates.videoCount
            });

            Object.assign(asin, updates);
            await asin.save();
            
            // Emit socket event for real-time UI updates
            const io = SocketService.getIo();
            if (io) {
                io.emit('scrape_data_ingested', { 
                    asinId: asin._id, 
                    sellerId: asin.seller,
                    asinCode: asin.asinCode,
                    timestamp: new Date()
                });
            }

            // 11. Trigger AI Listing Quality Audit (Non-blocking)
            // Only trigger if image audit is missing or older than 7 days
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            if (!asin.lqsDetails?.imageAuditDate || asin.lqsDetails.imageAuditDate < sevenDaysAgo) {
                nvidiaAiService.auditAsinImage(asin._id).catch(err => {
                    console.error(`[AI-AUDIT] Background execution failed for ${asin.asinCode}:`, err.message);
                });
            }

            return asin;
        } catch (error) {
            console.error('❌ ASIN Update Error:', error.message);
            throw error;
        }
    }

    /**
     * Maps external raw data to internal ASIN model metrics using ASIN Code instead of Mongo ID.
     */
    async updateAsinMetricsByCode(asinCode, rawData) {
        try {
            // Case-insensitive search to handle both old (uppercase) and new (original case) data
            const asin = await Asin.findOne({ 
                asinCode: { $regex: new RegExp(`^${asinCode}$`, 'i') }
            });
            if (!asin) {
                console.warn(`[MarketDataSync] ASIN ${asinCode} not found in DB. Skipping update.`);
                return null;
            }
            return await this.updateAsinMetrics(asin._id, rawData);
        } catch (error) {
            console.error('❌ ASIN By Code Update Error:', error.message);
            throw error;
        }
    }

/**
     * Memory-safe streaming bulk processing with pagination
     * Handles 10,000+ results without heap errors
     */
    async processBatchResults(sellerId, rawResults) {
        if (!rawResults || rawResults.length === 0) return 0;
        
        console.log(`🚀 Memory-safe bulk processing ${rawResults.length} results for seller ${sellerId}...`);
        console.log(`📊 Memory: ${memProcessor.getMemoryStats().heapUsed}`);
        
        let updatedCount = 0;
        const now = new Date();
        
        // Process in smaller chunks to avoid memory issues
        const CHUNK_SIZE = 200;
        const ASIN_BATCH = 50;
        
        for (let chunkStart = 0; chunkStart < rawResults.length; chunkStart += CHUNK_SIZE) {
            // Check memory before chunk
            if (memProcessor.isMemoryCritical()) {
                console.log(`🧹 Memory critical - cleaning up...`);
                await memProcessor.cleanup();
            }
            
            const chunk = rawResults.slice(chunkStart, chunkStart + CHUNK_SIZE);
            console.log(`📦 Processing chunk ${Math.floor(chunkStart/CHUNK_SIZE) + 1} (${chunk.length} items)...`);
            
            // Extract ASIN codes for this chunk
            const asinCodesToFind = chunk.map(r => this._extractAsinFromData(r)).filter(Boolean);
            if (asinCodesToFind.length === 0) continue;
            
            // Fetch ASINs for this chunk only (paginated)
            let currentAsins = [];
            for (let i = 0; i < asinCodesToFind.length; i += ASIN_BATCH) {
                const codeBatch = asinCodesToFind.slice(i, i + ASIN_BATCH);
                const docs = await Asin.find({
                    seller: sellerId,
                    $or: codeBatch.map(code => ({ asinCode: { $regex: new RegExp(`^${code}$`, 'i') } }))
                }).lean();
                currentAsins.push(...docs);
                
                if (memProcessor.isMemoryCritical()) {
                    await memProcessor.cleanup();
                }
            }
            
            // Create map for lookups
            const asinMap = new Map(currentAsins.map(a => [a.asinCode.toLowerCase(), a]));
            
            // Build bulk ops for this chunk
            const bulkOps = [];
            for (const rawData of chunk) {
                const code = this._extractAsinFromData(rawData);
                if (!code) continue;
                
                const asin = asinMap.get(code.toLowerCase());
                if (!asin) continue;
                
                const price = this._cleanPrice(rawData.asp || rawData.price || rawData.Field2 || rawData.currentPrice);
                const mrp = this._cleanPrice(rawData.mrp || rawData.listPrice || rawData.Field3);
                const bsr = this._cleanBsr(rawData.sub_BSR || rawData.Field9 || rawData.BSR || rawData.bsr || rawData.alt_bsr || '');
                const title = (rawData.Title || rawData.title || asin.title || '').trim();
                const soldBy = (rawData.sold_by || rawData.Field11 || asin.soldBy || '').trim();
                const secondAsp = this._cleanPrice(rawData.second_asp || '') || asin.secondAsp;
                const soldBySec = (rawData.Sold_by_sec || asin.soldBySec || '').trim();
                
                const rawAplusBulk = rawData.A_plus || rawData.has_aplus || '';
                const hasAplus = (typeof rawAplusBulk === 'string' && rawAplusBulk.trim().length > 20)
                                 ? true
                                 : this._parseBoolean(rawAplusBulk || false);
                                 
                const availabilityStatus = rawData.status || rawData.availabilityStatus || rawData.availability || rawData.In_Stock || asin.availabilityStatus || 'Available';
                const mainImageUrl = rawData.Main_Image || rawData.mainImage || rawData.imageUrl || rawData.Field5 || asin.mainImageUrl || asin.imageUrl;
                
                let aplusAbsentSince = asin.aplusAbsentSince;
                let aplusPresentSince = asin.aplusPresentSince;
                if (hasAplus) {
                    aplusPresentSince = aplusPresentSince || now;
                    aplusAbsentSince = null;
                } else {
                    aplusAbsentSince = aplusAbsentSince || now;
                    aplusPresentSince = null;
                }
                
                let category = (rawData.category || asin.category || '').trim();
                if (category.includes('<li')) {
                    const matches = category.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
                    if (matches) {
                        category = matches.map(m => m.replace(/<[^>]+>/g, '').replace(/^›\s*/, '').replace(/\s*›$/, '').trim()).filter(Boolean).join(' › ');
                    }
                }
                // Strictly use avg_rating field – no other parsing methods
                let rating = parseFloat(rawData.avg_rating);
                if (isNaN(rating)) rating = 0;
                
                // Priority: check review_count (lowercase), then Review_Count, then ReviewCount, then fallback to noise-cleaning rating string
                const parsedReviewStr = rawData.review_count || rawData.Review_Count || rawData.ReviewCount || rawData.rating || rawData.Reviews || rawData.RT || '';
                const reviewCount = this._cleanReviewCount(parsedReviewStr) || asin.reviewCount;
                
                // Extract breakdown independently if ratingData is gone
                const breakdownStr = rawData.Rating || rawData.RT || rawData.rating || '';
                const percentages = this._extractBreakdown(breakdownStr) || {
                    '5': parseFloat(rawData['5_star'] || rawData.five_star || 0),
                    '4': parseFloat(rawData['4_star'] || rawData.four_star || 0),
                    '3': parseFloat(rawData['3_star'] || rawData.three_star || 0),
                    '2': parseFloat(rawData['2_star'] || rawData.two_star || 0),
                    '1': parseFloat(rawData['1_star'] || rawData.one_star || 0)
                };

                const ratingBreakdown = {
                    fiveStar: percentages['5'] || asin.ratingBreakdown?.fiveStar || 0,
                    fourStar: percentages['4'] || asin.ratingBreakdown?.fourStar || 0,
                    threeStar: percentages['3'] || asin.ratingBreakdown?.threeStar || 0,
                    twoStar: percentages['2'] || asin.ratingBreakdown?.twoStar || 0,
                    oneStar: percentages['1'] || asin.ratingBreakdown?.oneStar || 0
                };

                let imagesCount = asin.imagesCount || 0;
                let videoCount = 0;
                if (rawData.image_count?.includes('<li')) {
                    const liMatches = rawData.image_count.match(/<li[^>]*>[\s\S]*?<\/li>/gi) || [];
                    imagesCount = liMatches.length;
                    
                    // Video detection - look for video indicators in the li HTML
                    for (const li of liMatches) {
                        if (li.toLowerCase().includes('video') || li.toLowerCase().includes('vjs') || li.match(/<div[^>]*video[^>]*>/i)) {
                            videoCount++;
                        }
                    }
                }
                let subBSRs = asin.subBSRs || [];
                const bsrString = rawData.sub_BSR || rawData.alt_sub_bsr || rawData.BSR || rawData.alt_bsr || '';
                if (bsrString && typeof bsrString === 'string') {
                    const parts = bsrString.split(/\s{2,}|\n/).map(p => p.trim()).filter(Boolean);
                    subBSRs = parts.filter(p => p.includes('#') && (p.toLowerCase().includes(' in ') || p.toLowerCase().includes(' ( ')));
                }
                let bulletPointsText = [
                    rawData.bp_1, rawData.bp_2, rawData.bp_3, rawData.bp_4, rawData.bp_5, rawData.bullet_points_1, rawData.bullet_points
                ].map(p => p?.trim()).filter(Boolean);
                if (bulletPointsText.length <= 1 && rawData.bullet_points?.includes('<li')) {
                    const matches = rawData.bullet_points.match(/<li[^>]*>(?:<span[^>]*>)?([^<]+)(?:<\/span>)?<\/li>/gi);
                    if (matches) {
                        bulletPointsText = matches.map(m => m.replace(/[^>]+>/g, '').trim()).filter(Boolean);
                    }
                }
                const bulletCount = bulletPointsText.length || parseInt(rawData.bulletPoints || rawData.bullet_points_count || 0);
                const rawDeal = rawData.deal_badge || rawData.dealBadge || rawData.deal || '';
                const dealBadge = this._cleanDealBadge(rawDeal) || asin.dealBadge || 'No deal found';
                
                // Calculate current week string for history
                const startOfYr = new Date(now.getFullYear(), 0, 0);
                const diffOfYr = now - startOfYr;
                const weekOfYr = Math.floor(diffOfYr / (1000 * 60 * 60 * 24 * 7));
                const weekStr = `W${weekOfYr}-${now.getFullYear()}`;

                // Prepare Week-on-Week History data
                const weekData = {
                    week: weekStr,
                    date: now,
                    price: price > 0 ? price : asin.currentPrice,
                    bsr: bsr > 0 ? bsr : asin.bsr,
                    rating: rating > 0 ? rating : asin.rating,
                    reviews: reviewCount > 0 ? reviewCount : asin.reviewCount,
                    imageCount: imagesCount,
                    videoCount: videoCount,
                    titleLength: title.length || (asin.title ? asin.title.length : 0),
                    bulletPoints: bulletCount,
                    subBSRs: subBSRs,
                    hasAplus: hasAplus,
                    stockLevel: this._cleanStock(rawData.stock || rawData.inventory || 0)
                };

                // Update weekHistory in memory to avoid duplicates on the same date
                const todayStr = now.toDateString();
                const existingIndex = (asin.weekHistory || []).findIndex(w => new Date(w.date).toDateString() === todayStr);
                
                let updatedWeekHistory = Array.isArray(asin.weekHistory) ? [...asin.weekHistory] : [];
                if (existingIndex >= 0) {
                    updatedWeekHistory[existingIndex] = { ...updatedWeekHistory[existingIndex], ...weekData };
                } else {
                    updatedWeekHistory.push(weekData);
                }
                
                // Sort and Slice as per model logic
                updatedWeekHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
                if (updatedWeekHistory.length > 24) updatedWeekHistory = updatedWeekHistory.slice(-24);

                const updateData = {
                    $set: {
                        title: title || asin.title,
                        titleLength: title.length || (asin.title ? asin.title.length : 0),
                        currentPrice: price > 0 ? price : asin.currentPrice,
                        currentASP: price > 0 ? price : asin.currentASP,
                        mrp: mrp > 0 ? mrp : asin.mrp,
                        bsr: bsr > 0 ? bsr : asin.bsr,
                        subBSRs: subBSRs,
                        rating: rating > 0 ? rating : asin.rating,
                        reviewCount: reviewCount > 0 ? reviewCount : asin.reviewCount,
                        category: category || asin.category,
                        mainImageUrl: mainImageUrl || asin.mainImageUrl,
                        imageUrl: mainImageUrl || asin.mainImageUrl,
                        imagesCount: imagesCount,
                        videoCount: videoCount,
                        hasAplus: hasAplus,
                        aplusAbsentSince: aplusAbsentSince,
                        aplusPresentSince: aplusPresentSince,
                        availabilityStatus: availabilityStatus,
                        ratingBreakdown: ratingBreakdown,
                        dealBadge: dealBadge,
                        bulletPoints: bulletCount,
                        bulletPointsText: bulletPointsText,
                        rawOctoparseData: rawData,
                        stockLevel: this._cleanStock(rawData.stock || rawData.inventory || 0),
                        soldBy: soldBy,
                        secondAsp: secondAsp,
                        soldBySec: soldBySec,
                        buyBoxWin: isBuyBoxWinner(soldBy),
                        weekHistory: updatedWeekHistory,
                        lastScraped: now,
                        scrapeStatus: 'COMPLETED',
                        status: 'Active',
                        history: (() => {
                            const hList = Array.isArray(asin.history) ? [...asin.history] : [];
                            const tStr = now.toISOString().split('T')[0];
                            const idx = hList.findIndex(h => new Date(h.date).toISOString().split('T')[0] === tStr);
                            const entry = { date: now, price, bsr, rating, reviewCount, imageCount: imagesCount, videoCount };
                            
                            if (idx >= 0) hList[idx] = { ...hList[idx], ...entry };
                            else hList.push(entry);
                            
                            return hList.slice(-30);
                        })()
                    }
                };
                
                bulkOps.push({ updateOne: { filter: { _id: asin._id }, update: updateData } });
                updatedCount++;
            }
            
            // Execute bulk write for chunk
            if (bulkOps.length > 0) {
                try {
                    const BATCH = 50;
                    for (let i = 0; i < bulkOps.length; i += BATCH) {
                        const batch = bulkOps.slice(i, i + BATCH);
                        await Asin.bulkWrite(batch);
                    }
                } catch (bulkError) {
                    console.error(`❌ bulkWrite chunk error:`, bulkError.message);
                }
            }
            
            // Clear references for GC
            asinMap.clear();
            clearArray(bulkOps);
            
            console.log(`📊 Memory after chunk: ${memProcessor.getMemoryStats().heapUsed}`);
        }

console.log(`✅ Bulk Sync Finished: ${updatedCount} ASINs updated`);
        return updatedCount;
    }

    // Helper cleaners extracted from updateAsinMetrics for stateless reuse
    _cleanPrice(str) {
        if (!str) return 0;
        const cleaned = str.toString().replace(/₹|,/g, '').trim();
        const match = cleaned.match(/\d+(\.\d+)?/);
        return match ? parseFloat(match[0]) : 0;
    }

    _cleanStock(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const cleaned = val.toString().replace(/[^0-9]/g, '').trim();
        return parseInt(cleaned) || 0;
    }

    _cleanBsr(str) {
        if (!str) return 0;
        const cleaned = str.toString().replace(/,/g, '').trim();
        const match = cleaned.match(/#?(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * @deprecated Strictly use avg_rating field from JSON instead.
     */
    _cleanRating(str) {
        if (!str) return { value: 0, percentages: null };
        const s = str.toString().trim();
        
        // Always try to extract percentages for the breakdown, regardless of primary rating format
        const percentages = this._extractBreakdown(s);
        
        // Priority 1: "X.X out of 5" (Amazon's standard format)
        const outOfMatch = s.match(/([0-5](?:[.,]\d+)?)\s*out\s*of\s*5/i);
        if (outOfMatch) {
            const val = parseFloat(outOfMatch[1].replace(',', '.'));
            return { value: isNaN(val) ? 0 : val, percentages };
        }

        // Priority 2: Use weighted average from messy percentage stack
        if (percentages) {
            // Weighted average calculation
            const weighted = (5 * percentages['5'] + 4 * percentages['4'] + 3 * percentages['3'] + 2 * percentages['2'] + 1 * percentages['1']) / 100;
            return { value: Math.round(weighted * 10) / 10, percentages };
        }

        // Priority 3: Leading number (Amazon's messy format usually starts with "5 star" or "4.5 star")
        const specificMatch = s.match(/^([0-4](?:[.,]\d+)?)\s*star/i);
        if (specificMatch) return { value: parseFloat(specificMatch[1].replace(',', '.')), percentages };

        // Fallback: Match any number like 4.4, 4,4, 4 anywhere in the string
        const matches = s.match(/([0-5](?:[.,]\d+)?)/);
        if (!matches) return { value: 0, percentages };

        let rating = parseFloat(matches[1].replace(',', '.'));
        if (isNaN(rating)) return { value: 0, percentages };
        rating = Math.min(5, Math.max(0, rating));
        return { value: Math.round(rating * 10) / 10, percentages };
    }

    _extractBreakdown(str) {
        if (!str) return null;
        // Look for multiple percentages, often found in Amazon's messy feedback strings
        // order is always 5, 4, 3, 2, 1 star
        const matches = str.match(/(\d+)%/g);
        if (matches && matches.length >= 5) {
            // If there's more than 5, we look for the cluster that sums closest to 100
            // but usually the first 5 in the rating section are the ones.
            return {
                '5': parseFloat(matches[0]) || 0,
                '4': parseFloat(matches[1]) || 0,
                '3': parseFloat(matches[2]) || 0,
                '2': parseFloat(matches[3]) || 0,
                '1': parseFloat(matches[4]) || 0
            };
        }
        return null;
    }

    _cleanReviewCount(str) {
        if (!str) return 0;
        let s = str.toString().trim();
        
        // Remove common Amazon rating noise that often smashes into the review count
        // e.g. "53.8 out of 5424 global ratings" -> "424 global ratings"
        s = s.replace(/out\s+of\s+[0-5](?:\.[0-9])?/gi, '');
        s = s.replace(/[0-5]\s*stars?/gi, '');
        
        // Priority 1: Parenthesized numbers with commas (e.g. "(2,441)")
        const parenMatch = s.match(/\(([\d,]+)\)/);
        if (parenMatch) {
            const val = parseInt(parenMatch[1].replace(/,/g, ''));
            if (val > 0) return val;
        }

        // Priority 2: "123 global ratings/reviews"
        const globalMatch = s.match(/([\d,]+)\s*(?:global\s*ratings?|reviews?)/i);
        if (globalMatch) return parseInt(globalMatch[1].replace(/,/g, '')) || 0;

        // Priority 3: Decimal numbers in parentheses (e.g. "(2.5K)")
        const kMatch = s.match(/\(([\d.]+)\s*k\)/i);
        if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);

        // Priority 4: Look for any number > 10 that isn't a percentage
        const allNumericMatches = s.match(/\b[\d,]+\b(?!\s*%)/g);
        if (allNumericMatches) {
            for (const m of allNumericMatches) {
                const val = parseInt(m.replace(/,/g, ''));
                if (val > 10 && val < 50000000) return val;
                if (val > 0 && !s.toLowerCase().includes('star')) return val;
            }
        }
        
        // Fallback: If still not found, try to clean the string of "X out of 5" noise
        const noiseFree = s
            .replace(/[0-5](?:\.[0-9])?\s+out\s+of\s+5\s+stars?/i, '')
            .replace(/[0-5]\s*stars?/i, '');
        
        const fallbackMatch = noiseFree.match(/[\d,]+/);
        if (fallbackMatch) {
            const val = parseInt(fallbackMatch[0].replace(/,/g, ''));
            if (val > 0 && val < 10000000) return val;
        }

        return 0;
    }

    _cleanDealBadge(str) {
        if (!str || str === 'null' || str === '') return '';
        const s = str.toString().toLowerCase();
        
        // Amazon specific deals
        if (s.includes('limited time deal')) return 'Limited Time Deal';
        if (s.includes('deal of the day')) return 'Deal of the Day';
        if (s.includes('lightning deal')) return 'Lightning Deal';
        if (s.includes('prime deal')) return 'Prime Deal';
        if (s.includes('great indian festival')) return 'GIF Deal';
        if (s.includes('coupon')) return 'Coupon Available';
        
        // Extract first significant words if it's some other badge but not the messy duration text
        const cleaned = str.trim()
            .replace(/\s+/g, ' ')
            .split(/NO_OF/)[0] // Stop at Octoparse placeholders
            .trim();
            
        return cleaned.length > 30 ? cleaned.substring(0, 27) + '...' : cleaned;
    }

    _parseBoolean(val) {
        if (typeof val === 'boolean') return val;
        if (!val) return false;
        const str = val.toString().toLowerCase().trim();
        return ['true', 'yes', '1', 'y', 't', 'active'].includes(str);
    }

    _extractAsinFromData(rawData) {
        if (!rawData) return null;
        
        // 1. Direct fields - keep original case as stored in DB
        const direct = (rawData.ASIN || rawData.asin || rawData.asinCode || rawData.asin_code || '').trim();
        if (direct && direct.length === 10) return direct;

        // 2. URL extraction (Original_URL, Original URL, target_url, etc) - preserve case
        const urlField = rawData.Original_URL || rawData['Original URL'] || rawData.target_url || rawData.url || '';
        if (urlField && typeof urlField === 'string') {
            const match = urlField.match(/\/dp\/([A-Z0-9]{10})/i) || urlField.match(/\/product\/([A-Z0-9]{10})/i);
            if (match) return match[1]; // Keep original case
        }

        return null;
    }
    /**
     * Finds and assigns an available task ID from the pool to a seller.
     */
    async assignTaskFromPool(sellerId) {
        try {
            const availableTask = await OctoTask.findOneAndUpdate(
                { isAssigned: false },
                { 
                    isAssigned: true, 
                    sellerId: sellerId,
                    lastAssignedAt: new Date()
                },
                { new: true, sort: { createdAt: 1 } }
            );

            if (!availableTask) {
                console.warn('⚠️ No available Octoparse tasks in the pool.');
                return null;
            }

            // Sync with Seller model
            await Seller.findByIdAndUpdate(sellerId, { 
                marketSyncTaskId: availableTask.taskId 
            });

            console.log(`✅ Assigned Pool Task ${availableTask.taskId} to seller: ${sellerId}`);
            return availableTask.taskId;
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
            const operations = taskIds.map(id => ({
                updateOne: {
                    filter: { taskId: id.trim() },
                    update: { $setOnInsert: { taskId: id.trim(), isAssigned: false } },
                    upsert: true
                }
            }));

            const result = await OctoTask.bulkWrite(operations);
            const stats = await this.getPoolStats();
            return {
                added: result.upsertedCount,
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
            const total = await OctoTask.countDocuments();
            const assigned = await OctoTask.countDocuments({ isAssigned: true });
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
