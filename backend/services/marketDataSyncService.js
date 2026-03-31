const axios = require('axios');
const Asin = require('../models/Asin');
const Action = require('../models/Action');
const OctoTask = require('../models/OctoTask');
const Seller = require('../models/Seller');
const config = require('../config/env');
const imageGenerationService = require('./imageGenerationService');
const { JSDOM } = require('jsdom');

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
        const apiKey = process.env.MARKET_SYNC_API_KEY;
        
        // Check if defined and not default demo values
        return !!(apiKey || (username && password &&
            username !== 'demo-provider' &&
            password !== 'demo-pass'));
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
    async updateTaskUrlsWithFile(taskId, urls) {
        if (!urls || urls.length === 0) return true;
        const token = await this.authenticate();
        
        try {
            console.log(`📂 Injecting ${urls.length} URLs via professional file endpoint for task: ${taskId}`);
            
            // Create FormData for multipart upload (Native in Node 18+)
            const formData = new FormData();
            formData.append('taskId', taskId);
            
            // Create a Blob containing the URLs separated by newlines
            const blob = new Blob([urls.join('\n')], { type: 'text/plain' });
            
            // Append as 'file' - following Octoparse OpenAPI spec
            formData.append('file', blob, 'asins.txt');

            const response = await axios.post(`${this.baseUrl}/task/urls:file`, formData, {
                headers: { 
                    'Authorization': `Bearer ${token}`
                    // Axios v1.x handles Content-Type and boundary automatically for global FormData/Blob
                }
            });

            console.log(`✅ File-based injection success. RequestID: ${response.data?.requestId}`);
            return true;
        } catch (error) {
            const errorData = error.response?.data;
            console.error('❌ File-based URL Injection Error:', errorData || error.message);
            
            // Specific handling for permission issues on this endpoint
            if (errorData?.error?.code === 'PermissionDenied') {
                console.warn('⚠️ Professional endpoint restricted. Will likely need Professional/Enterprise plan.');
            }
            throw error;
        }
    }

    async updateTaskLoopItems(taskId, items) {
        const token = await this.authenticate();
        try {
            // Find LoopAction ID
            let actionId = process.env.OCTOPARSE_LOOP_ACTION_ID;
            
            // Robust discovery: If actionId is missing or we want to ensure correctness for this specific taskId
            if (!actionId || actionId === 'undefined' || actionId === 'j7jy8yp23dh') { // Force discovery if using the generic one
                console.log(`🔍 Discovering LoopAction ID for task: ${taskId}`);
                try {
                    const actionRes = await axios.get(`${this.baseUrl}/api/Task/GetActions`, {
                        params: { taskId },
                        headers: { 'Authorization': `Bearer ${token}` }
                    });

                    // Search for LoopAction in the response
                    const actions = actionRes.data.data || [];
                    const loopAction = actions.find(a => 
                        a.actionType === "LoopAction" || 
                        a.name?.toLowerCase().includes('loop') ||
                        a.actionId?.startsWith('loop')
                    );
                    
                    if (loopAction) {
                        actionId = loopAction.actionId;
                        console.log(`✅ Dynamically found Action ID: ${actionId}`);
                    }
                } catch (discoveryError) {
                    console.error(`⚠️ Discovery failed for task ${taskId}:`, discoveryError.message);
                }
            }

            if (!actionId) {
                console.warn(`⚠️ No LoopAction found for task ${taskId}. Attempting fallback to known generic ID.`);
                actionId = process.env.OCTOPARSE_LOOP_ACTION_ID || 'j7jy8yp23dh';
            }

            // Format ASINs into Amazon Search URLs
            const formattedItems = items.map(item => {
                if (typeof item !== 'string') return '';
                if (item.startsWith('http')) return item;
                return `https://www.amazon.in/dp/${item.trim()}`;
            }).filter(Boolean);

            // CHUNKING: Octoparse API limits
            const CHUNK_SIZE = 1000;
            console.log(`🔄 Updating loop items for task ${taskId} (${formattedItems.length} items)...`);

            for (let i = 0; i < formattedItems.length; i += CHUNK_SIZE) {
                const chunk = formattedItems.slice(i, i + CHUNK_SIZE);
                const isFirst = i === 0;

                try {
                    await axios.post(`${this.baseUrl}/api/Task/UpdateLoopItems`, {
                        taskId,
                        actionId,
                        loopItems: chunk.join('\n'), 
                        isAppend: !isFirst 
                    }, {
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                    });
                    console.log(`✅ Chunk ${Math.floor(i/CHUNK_SIZE) + 1} uploaded.`);
                } catch (apiError) {
                    console.error(`❌ UpdateLoopItems API Error (Chunk ${i}):`, apiError.response?.data || apiError.message);
                    // If 404, the actionId is definitely wrong for this task
                    if (apiError.response?.status === 404) {
                        throw new Error(`Invalid Action ID (${actionId}) for Task ${taskId}. Please verify the task workflow in Octoparse.`);
                    }
                    throw apiError;
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Update Loop Items Service Error:', error.message);
            return false;
        }
    }

    /**
     * Triggers a data extraction task for a list of ASINs.
     */
    async triggerSync(taskId, parameters) {
        const token = await this.authenticate();
        try {
            // 1. Update ASIN list if provided
            if (parameters && parameters.length > 0) {
                const asins = parameters.flatMap(p => {
                    const val = p.value || p.ASIN || p;
                    if (typeof val === 'string' && val.includes(',')) {
                        return val.split(',').map(s => s.trim());
                    }
                    return val;
                }).filter(Boolean);

                if (asins.length > 0) {
                    await this.updateTaskLoopItems(taskId, asins);
                }
            }

            // 2. Start the task in the Cloud using modern POST /cloudextraction/start
            console.log(`🚀 Starting Octoparse Cloud Extraction: ${taskId}`);
            const response = await axios.post(`${this.baseUrl}/cloudextraction/start`, {
                taskId: taskId
            }, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = response.data;
            if (data.error && !data.data?.lotNo) {
                if (data.message?.includes('running')) {
                    return { success: true, taskId, lotNo: data.data?.lotNo, status: 'Running' };
                }
                throw new Error(`Provider Error: ${data.message || data.error}`);
            }

            return { 
                success: true, 
                taskId, 
                lotNo: data.data?.lotNo,
                status: data.data?.status || 'Running'
            };
        } catch (error) {
            console.error('❌ Trigger Sync Error:', error.response?.data || error.message);
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

    /**
     * Start cloud extraction for a specific task.
     */
    async startCloudExtraction(taskId) {
        const token = await this.authenticate();
        try {
            console.log(`🚀 Starting Octoparse Cloud Extraction for Task: ${taskId}...`);
            const response = await axios.post(`${this.baseUrl}/cloudextraction/start`, {
                taskId: taskId
            }, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });

            return response.data;
        } catch (error) {
            console.error('❌ Start Extraction Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Fetch unexported results for a task.
     */
    async fetchTaskResults(taskId) {
        const token = await this.authenticate();
        try {
            console.log(`📥 Fetching unexported data for task: ${taskId}...`);
            const response = await axios.get(`${this.baseUrl}/data/notexportdata`, {
                params: { taskId },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = response.data?.data || [];
            if (data.length > 0) {
                return data;
            }
            return [];
        } catch (error) {
            console.error('❌ Fetch Results Error:', error.response?.data || error.message);
            throw error;
        }
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
        const token = await this.authenticate();
        try {
            await axios.get(`${this.baseUrl}/api/CloudTask/StopTask`, {
                params: { taskId },
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return true;
        } catch (error) {
            console.error('❌ Stop Sync Error:', error.response?.data || error.message);
            return false;
        }
    }

    /**
     * Get task status.
     */
    async getStatus(taskId) {
        // STATUS CACHING: Check if we have a fresh status (under 10 seconds old)
        const cached = this.statusCache.get(taskId);
        if (cached && Date.now() - cached.timestamp < 10000) {
            return cached.data;
        }

        const token = await this.authenticate();
        try {
            // Use modern V2 status endpoint
            const response = await axios.post(`${this.baseUrl}/cloudextraction/statuses/v2`, {
                taskIds: [taskId]
            }, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const results = response.data?.data || [];
            const result = results.length > 0 ? results[0] : null;

            // Cache result if valid
            if (result) {
                this.statusCache.set(taskId, { data: result, timestamp: Date.now() });
            }
            return result;
        } catch (error) {
            const isRateLimit = error.response?.status === 429 || error.message?.includes('TooManyRequests');
            
            if (isRateLimit) {
                console.warn(`⚠️ Get Status Rate Limited for task ${taskId}. Returning error indicator...`);
                return { error: 'RateLimit', message: 'TooManyRequests' };
            }

            console.error('❌ Get Status Error:', error.response?.data || error.message);
            
            // Fallback to legacy status
            try {
                const response = await axios.get(`${this.baseUrl}/api/CloudTask/GetTaskStatus`, {
                    params: { taskId },
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
            console.log(`🔍 Fetching bulk status for ${taskIds.length} tasks...`);
            
            // 1. Try Modern V2
            try {
                const response = await axios.post(`${this.baseUrl}/cloudextraction/statuses/v2`, {
                    taskIds: taskIds
                }, {
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                if (response.data?.data && response.data.data.length > 0) return response.data.data;
            } catch (v2Err) {
                console.warn('⚠️ Octoparse V2 Bulk Status failed:', v2Err.response?.data?.message || v2Err.message);
            }

            // 2. Try Legacy List Endpoint
            const legacyRes = await axios.get(`${this.baseUrl}/api/CloudTask/GetTaskStatusList`, {
                params: { taskIds: taskIds.join(',') },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (legacyRes.data?.data) {
                return Array.isArray(legacyRes.data.data) ? legacyRes.data.data : [legacyRes.data.data];
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
            
            // Try Modern V2 Data API first
            try {
                const response = await axios.get(`${this.baseUrl}/cloudextraction/data/v1`, {
                    params: { taskId, size, offset },
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data?.data) return response.data.data;
            } catch (v2Err) {
                // Fallback to V1
                const v1Response = await axios.get(`${this.baseUrl}/api/CloudTask/GetData`, {
                    params: { taskId, size, offset },
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
    async pollAndAutomate(sellerId, taskId) {
        console.log(`🕵️ Starting automated monitoring for Seller: ${sellerId}, Task: ${taskId}...`);
        
        let attempts = 0;
        const maxAttempts = 24; // 24 * 5 mins = 2 hours max
        const interval = 300000; // 5 minutes

        // Initial wait - Amazon scrapes never finish in < 2 mins
        await this.wait(120000); 

        while (attempts < maxAttempts) {
            try {
                const statusInfo = await this.getStatus(taskId);
                
                // If rate limited, wait a bit longer and continue
                if (statusInfo?.error === 'RateLimit') {
                    console.warn(`⏳ Automation Polling Rate Limited for task ${taskId}. Waiting 1 minute...`);
                    await this.wait(60000);
                    continue;
                }

                const status = statusInfo?.status || statusInfo?.Status || statusInfo;
                
                // Status 3 = Completed, Status 2 = Failed
                const isCompleted = status === 3 || status === '3' || status === 'Completed';
                const isFailed = status === 2 || status === '2' || status === 'Failed' || status === 'Stopped';

                if (isCompleted) {
                    console.log(`✅ Task ${taskId} COMPLETED! Initiating auto-ingestion...`);
                    const rawData = await this._fetchAllDataPages(taskId);
                    if (rawData.length > 0) {
                        const updatedCount = await this.processBatchResults(sellerId, rawData);
                        console.log(`🎉 Automation Success: ${updatedCount} ASINs auto-updated for seller ${sellerId}.`);
                    } else {
                        console.warn(`⚠️ Task ${taskId} completed but no data was found.`);
                    }
                    return; // Exit loop on success
                }

                if (isFailed) {
                    console.error(`❌ Task ${taskId} FAILED or STOPPED. Automation aborted.`);
                    return; // Exit loop on failure
                }

                console.log(`⏳ [Attempt ${attempts+1}/${maxAttempts}] Task ${taskId} still in progress (Status: ${status}). Checking again in 5m...`);
                
            } catch (err) {
                console.warn(`⚠️ Automation Polling Error for task ${taskId}:`, err.message);
            }

            attempts++;
            await this.wait(interval);
        }

        console.warn(`⏰ Automation Timeout: Task ${taskId} did not complete within 2 hours.`);
    }

    /**
     * Fetch a list of executions for a taskId
     */
    async getExecutionList(taskId, size = 10) {
        const token = await this.authenticate();
        try {
            const response = await axios.get(`${this.baseUrl}/api/Execution/GetTaskExecutionList`, {
                params: { taskId, size },
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
     * Polls and retrieves results from a completed sync task with auto-pagination for large data sets.
     * @param {string} taskId - Octoparse task ID
     * @param {string} executionId - Optional specific execution ID
     */
    async retrieveResults(taskId, executionId = null) {
        const token = await this.authenticate();
        let allResults = [];
        let offset = 0;
        const size = 1000;
        let hasMore = true;

        try {
            console.log(`📥 Starting fetch from Octoparse (Task: ${taskId})`);
            
            while (hasMore) {
                const params = { taskId, size, offset };
                if (executionId) params.executionId = executionId;

                const response = await axios.get(`${this.baseUrl}/api/notexporteddata/get`, {
                    params,
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.data.error) {
                    throw new Error(`Provider Error: ${response.data.error.message}`);
                }

                const dataList = response.data.data?.dataList || response.data.data?.data || [];
                allResults = allResults.concat(dataList);
                
                console.log(`📦 Fetched ${dataList.length} items (Total: ${allResults.length})`);

                // If fewer than 'size' items returned, we've reached the end
                if (dataList.length < size) {
                    hasMore = false;
                } else {
                    offset += size;
                }
            }

            // Mark data as exported after successful retrieval of ALL pages
            if (allResults.length > 0) {
                try {
                    await axios.post(`${this.baseUrl}/api/notexporteddata/update`, { taskId }, {
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                    });
                } catch (markError) {
                    console.error('⚠️ Market Sync: Failed to mark data as exported', markError.message);
                }
            }

            return allResults;
        } catch (error) {
            console.error('❌ Retrieve Results Error:', error.response?.data || error.message);
            throw error;
        }
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
        const { triggerScrape = false } = options;

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

            // 2. Robust Task Stop (TaskExecuting error prevention)
            let isRunning = true;
            let stopRetries = 0;
            
            while (isRunning && stopRetries < 5) {
                const statusInfo = await this.getStatus(taskId);
                
                // If rate limited, WAIT and RETRY without assuming status
                if (statusInfo?.error === 'RateLimit') {
                    console.log(`⏳ Rate limited on status check for task ${taskId}. Waiting 5s before retry...`);
                    await this.wait(5000);
                    continue; // Skip this loop iteration, don't increment retries if it's just a rate limit? 
                    // Actually, let's limit total attempts.
                }

                const status = statusInfo?.status || statusInfo?.Status || statusInfo;
                isRunning = status === 'Executing' || status === 'Running' || status === 1 || status === '1';

                if (isRunning) {
                    console.log(`⏳ Task ${taskId} is currently executing (Status: ${status}). Sending stop command (Attempt ${stopRetries + 1})...`);
                    await this.stopSync(taskId);
                    this.statusCache.delete(taskId); // Invalidate cache so we fetch fresh status next time
                    await this.wait(5000 * (stopRetries + 1)); // Heavier back off
                }
                stopRetries++;
            }

            // If still running after retries, try one more time or alert
            if (isRunning) {
                console.warn(`⚠️ Task ${taskId} still reported as Running after ${stopRetries} stops. Proceeding with update anyway (may hit TaskExecuting error).`);
            }

            // 3. Get All Active ASINs for this seller
            const asins = await Asin.find({ 
                seller: sellerId, 
                status: 'Active' 
            }).select('asinCode');

            if (asins.length === 0) {
                console.log(`⚠️ No active ASINs to sync for seller: ${sellerId}`);
                return false;
            }

            const asinCodes = asins.map(a => a.asinCode);
            const urls = asinCodes.map(code => `https://www.amazon.in/dp/${code}`);

            // 3. PERSIST URLs to Database for record-keeping and formal injection
            await Seller.findByIdAndUpdate(sellerId, { 
                marketSyncUrls: urls,
                totalAsins: asins.length // Update metadata while we are here
            });
            console.log(`💾 Persisted ${urls.length} URLs to Database for seller: ${sellerId}`);

            console.log(`🔄 Syncing ASINs to task ${taskId} from DB record...`);

            // 4. Update task URLs (using file endpoint for efficiency)
            // Pulling from DB record (as requested) to ensure absolute sync
            const seller = await Seller.findById(sellerId).select('marketSyncUrls');
            const syncUrls = seller?.marketSyncUrls || urls;

            await this.updateTaskUrlsWithFile(taskId, syncUrls);

            // 5. Trigger Scrape if requested
            if (triggerScrape) {
                console.log(`🚀 Automated trigger: Starting scrape for task ${taskId}...`);
                await this.startCloudExtraction(taskId);

                // START BACKGROUND AUTOMATION: Poll and Ingest once done
                // We do NOT await this so the response returns to user immediately
                this.pollAndAutomate(sellerId, taskId).catch(err => {
                    console.error(`❌ Background Automation Critical Error for seller ${sellerId}:`, err.message);
                });
            }

            return true;
        } catch (error) {
            console.error(`❌ Sync Error for seller ${sellerId}:`, error.message);
            return false;
        } finally {
            this.syncLocks.delete(sellerId.toString());
        }
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

            // 3. Category (Parse HTML for last breadcrumb)
            let category = (rawData.category || rawData.Field4 || asin.category || '').trim();
            if (category.includes('<li')) {
                try {
                    const dom = new JSDOM(category);
                    const liTags = dom.window.document.querySelectorAll('li');
                    if (liTags.length > 0) {
                        category = liTags[liTags.length - 1].textContent.trim().replace(/^›\s*/, '').replace(/\s*›$/, '').trim();
                    }
                } catch (e) {
                    console.warn('Category HTML parsing failed, using raw string');
                }
            }

            // 4. BSR Parsing (Main BSR: #XXXX in Cat, Sub BSR: #XXXX in SubCat)
            const bsrString = rawData.Field9 || rawData.sub_BSR || rawData.BSR || rawData.bsr || '';
            const bsr = this._cleanBsr(bsrString);
            
            // Extract all rank strings (e.g. #476 in Men's Kurtas)
            let subBSRs = [];
            if (bsrString) {
                // Split by multiple spaces or newlines and clean
                const parts = bsrString.split(/\s{2,}|\n/).map(p => p.trim()).filter(Boolean);
                subBSRs = parts.filter(p => p.includes('#') && (p.toLowerCase().includes(' in ') || p.toLowerCase().includes(' ( ')));
            }

            // 5. Image Processing (Gallery extraction)
            let imageCount = 0;
            let images = [];
            const imgHtml = rawData.image_count || rawData.Field6 || '';
            if (imgHtml && typeof imgHtml === 'string' && imgHtml.includes('<li')) {
                try {
                    const imgDom = new JSDOM(imgHtml);
                    const liTags = imgDom.window.document.querySelectorAll('li');
                    imageCount = liTags.length;
                    images = Array.from(imgDom.window.document.querySelectorAll('img')).map(img => img.src).filter(Boolean);
                } catch (e) {
                    console.warn('Image HTML parsing failed');
                }
            } else {
                imageCount = parseInt(rawData.imageCount || rawData.imagesCount || rawData.Field6 || 0);
            }
            const mainImageUrl = rawData.Main_Image || rawData.mainImage || rawData.imageUrl || rawData.Field5 || asin.imageUrl;

            // 6. Rating & Reviews
            let rating = 0;
            let reviewCount = 0;
            const ratingStr = rawData.Rating || rawData.Field7 || '';
            if (ratingStr) {
                const rMatch = ratingStr.match(/([\d.]+)\s+out of 5/i);
                if (rMatch) rating = parseFloat(rMatch[1]);
                
                const cMatch = ratingStr.match(/([\d,]+)\s+global ratings/i) || ratingStr.match(/([\d,]+)\s+ratings/i);
                if (cMatch) reviewCount = parseInt(cMatch[1].replace(/,/g, ''));
            } else if (rawData.Rating_Count) {
                reviewCount = parseInt(rawData.Rating_Count.toString().replace(/,/g, '')) || 0;
            }

            // 7. Bullet Points
            let bulletPointsList = [
                rawData.bp_1, rawData.bp_2, rawData.bp_3, rawData.bp_4, rawData.bp_5, rawData.bullet_points_1
            ].map(p => p?.trim()).filter(Boolean);

            // Fallback: Parse bullet_points HTML if plain list is empty
            if (bulletPointsList.length === 0 && rawData.bullet_points?.includes('<li')) {
                try {
                    const bpDom = new JSDOM(rawData.bullet_points);
                    bulletPointsList = Array.from(bpDom.window.document.querySelectorAll('li')).map(li => li.textContent.trim()).filter(Boolean);
                } catch (e) {
                    console.warn('Bullet point HTML parsing failed');
                }
            }
            const bulletPoints = bulletPointsList.length || parseInt(rawData.bulletPoints || rawData.bullet_points_count || 0);

            // 8. Stock Level & A+ Content
            const stockLevel = this._cleanStock(rawData.stock_level || rawData.Field10 || rawData.stock || 0);
            const hasAplus = this._parseBoolean(rawData.has_aplus || rawData.A_plus || rawData.Field15 || false);

            // 9. Sold By
            const soldBy = rawData.sold_by || rawData.Field11 || asin.soldBy || '';

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
                subBSRs,
                rating: rating > 0 ? rating : asin.rating,
                reviewCount: reviewCount > 0 ? reviewCount : asin.reviewCount,
                imagesCount: imageCount > 0 ? imageCount : asin.imagesCount,
                images,
                mainImageUrl: mainImageUrl || asin.mainImageUrl,
                imageUrl: mainImageUrl || asin.imageUrl, // Compatibility
                soldBy,
                buyBoxSellerId: soldBy || asin.buyBoxSellerId,
                bulletPoints,
                bulletPointsList,
                stockLevel,
                hasAplus,
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
                stockLevel: updates.stockLevel
            });

            Object.assign(asin, updates);
            await asin.save();

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
            const asin = await Asin.findOne({ asinCode });
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
     * High-performance processing of an array of results using MongoDB bulkWrite.
     * Ideal for 5,000+ results per seller.
     */
    async processBatchResults(sellerId, rawResults) {
        if (!rawResults || rawResults.length === 0) return 0;
        
        console.log(`🚀 Bulk Processing ${rawResults.length} market results for seller ${sellerId}...`);
        
        const bulkOps = [];
        let updatedCount = 0;

        // Prepare context
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        const weekOfYr = Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
        const weekStr = `W${weekOfYr}-${now.getFullYear()}`;

        // Fetch all current ASIN documents in one go to handle logic in memory
        const currentAsins = await Asin.find({ 
            seller: sellerId,
            asinCode: { $in: rawResults.map(r => this._extractAsinFromData(r)).filter(Boolean) }
        });

        const asinMap = new Map(currentAsins.map(a => [a.asinCode, a]));

        for (const rawData of rawResults) {
            const code = this._extractAsinFromData(rawData);
            if (!code) continue;

            const asin = asinMap.get(code);
            if (!asin) continue;

            // Use existing cleaning/mapping logic via a stateless version of updateAsinMetrics
            // For now, we'll manually extract the critical updates to optimize memory
            const price = this._cleanPrice(rawData.asp || rawData.price || rawData.Field2 || rawData.currentPrice);
            const mrp = this._cleanPrice(rawData.mrp || rawData.listPrice || rawData.Field3);
            const bsr = this._cleanBsr(rawData.sub_BSR || rawData.Field9 || rawData.BSR || rawData.bsr);
            const soldBy = (rawData.sold_by || rawData.Field11 || '').trim();
            
            // Smarter Rating Extraction for noisy strings
            let rating = 0;
            const rawRating = (rawData.Rating || rawData.rating || rawData.Field7 || '').toString();
            if (rawRating) {
                const rMatch = rawRating.match(/([\d.]+)\s+out of 5/i);
                rating = rMatch ? parseFloat(rMatch[1]) : parseFloat(rawRating.replace(/[^0-9.]/g, '')) || 0;
            }

            // Prepare update object (simplified for bulk)
            const updateData = {
                $set: {
                    currentPrice: price > 0 ? price : asin.currentPrice,
                    currentASP: price > 0 ? price : asin.currentASP,
                    mrp: mrp > 0 ? mrp : asin.mrp,
                    bsr: bsr > 0 ? bsr : asin.bsr,
                    rating: rating > 0 ? rating : asin.rating,
                    stockLevel: this._cleanStock(rawData.stock || rawData.inventory || rawData.FieldX || 0),
                    soldBy: soldBy || asin.soldBy,
                    lastScraped: now,
                    scrapeStatus: 'COMPLETED',
                    status: 'Active'
                },
                $push: {
                    history: { 
                        $each: [{ date: now, price, bsr, rating }],
                        $slice: -30 
                    }
                }
            };

            bulkOps.push({
                updateOne: {
                    filter: { _id: asin._id },
                    update: updateData
                }
            });
            updatedCount++;
        }

        if (bulkOps.length > 0) {
            await Asin.bulkWrite(bulkOps);
        }

        console.log(`✅ Bulk Sync Finished: ${updatedCount} ASINs updated via bulkWrite.`);
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

    _parseBoolean(val) {
        if (typeof val === 'boolean') return val;
        if (!val) return false;
        const str = val.toString().toLowerCase().trim();
        return ['true', 'yes', '1', 'y', 't', 'active'].includes(str);
    }

    _extractAsinFromData(rawData) {
        if (!rawData) return null;
        
        // 1. Direct fields
        const direct = (rawData.ASIN || rawData.asin || rawData.asinCode || rawData.asin_code || '').trim();
        if (direct && direct.length === 10) return direct;

        // 2. URL extraction (Original_URL, Original URL, target_url, etc)
        const urlField = rawData.Original_URL || rawData['Original URL'] || rawData.target_url || rawData.url || '';
        if (urlField && typeof urlField === 'string') {
            const match = urlField.match(/\/dp\/([A-Z0-9]{10})/i) || urlField.match(/\/product\/([A-Z0-9]{10})/i);
            if (match) return match[1].toUpperCase();
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
            const tasks = await this.getTasksInGroup(groupId);
            
            if (!Array.isArray(tasks)) return null;

            const task = tasks.find(t => t.taskId === uuid || t.id?.toString() === uuid);
            if (task) {
                return task.id || task.taskId;
            }
            return null;
        } catch (error) {
            console.error('❌ Resolve Task ID Error:', error.message);
            return null;
        }
    }
}

module.exports = new MarketDataSyncService();
