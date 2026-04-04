const axios = require('axios');
const Seller = require('../models/Seller');
const Asin = require('../models/Asin');

class OctoparseAutomationService {
    constructor() {
        this.baseUrl = process.env.OCTOPARSE_BASE_URL || 'https://openapi.octoparse.com';
        this.masterTaskId = process.env.OCTOPARSE_MASTER_TASK_ID;
        this.groupId = process.env.OCTOPARSE_GROUP_ID;
        this.maxRetries = parseInt(process.env.OCTOPARSE_MAX_RETRIES) || 3;
        this.retryDelay = parseInt(process.env.OCTOPARSE_RETRY_DELAY) || 30000;
        this.pollInterval = parseInt(process.env.OCTOPARSE_POLL_INTERVAL) || 60000; // 1 minute
        this.concurrentPollers = new Map();
    }

    async authenticate() {
        const now = Date.now();
        if (this.token && this.tokenExpiry > now + 5 * 60 * 1000) {
            return this.token;
        }

        const username = process.env.MARKET_SYNC_USERNAME;
        const password = process.env.MARKET_SYNC_PASSWORD;

        if (!username || !password) {
            throw new Error('MARKET_SYNC_USERNAME or MARKET_SYNC_PASSWORD not configured');
        }

        const response = await axios.post(`${this.baseUrl}/token`, {
            username,
            password,
            grant_type: 'password'
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        this.token = response.data.access_token || response.data.data?.access_token;
        this.tokenExpiry = now + ((response.data.expires_in || 3600) * 1000);

        if (!this.token) {
            throw new Error('Authentication failed: No access token returned');
        }

        console.log(`[OctoparseAuth] ✅ Token secured (expires in ${Math.round((response.data.expires_in || 3600) / 60)}m)`);
        return this.token;
    }

    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, JSON.stringify(data));
    }

    async ensureTaskForSeller(sellerId) {
        const seller = await Seller.findById(sellerId);
        if (!seller) {
            throw new Error(`Seller not found: ${sellerId}`);
        }

        if (seller.marketSyncTaskId) {
            this.log('info', `Seller ${seller.name} already has task: ${seller.marketSyncTaskId}`);
            return seller.marketSyncTaskId;
        }

        // Validate master task configuration before cloning
        await this.validateMasterTask();

        const asins = await Asin.find({ seller: sellerId, status: 'Active' }).select('asinCode');
        if (asins.length === 0) {
            throw new Error(`No active ASINs found for seller: ${sellerId}`);
        }

        const newTaskId = await this.cloneMasterTask(seller.name);
        seller.marketSyncTaskId = newTaskId;
        await seller.save();

        this.log('info', `Created new Octoparse task ${newTaskId} for seller ${seller.name}`);
        return newTaskId;
    }

    async cloneMasterTask(taskName) {
        const token = await this.authenticate();

        const copyUrl = `${this.baseUrl}/task/copy?taskId=${this.masterTaskId}&taskGroupId=${this.groupId}`;
        const response = await axios.post(copyUrl, {}, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data?.data?.taskId) {
            return response.data.data.taskId;
        }

        throw new Error(`Failed to clone master task: ${JSON.stringify(response.data)}`);
    }

    async injectUrls(taskId, urls) {
        const token = await this.authenticate();

        const uniqueUrls = [...new Set(urls.map(url => {
            if (url.startsWith('http')) return url;
            if (url.length === 10) return `https://www.amazon.in/dp/${url}`;
            return url;
        }))];

        this.log('info', `Injecting ${uniqueUrls.length} URLs into task ${taskId}`);

        const formData = new FormData();
        formData.append('taskId', taskId);
        const blob = new Blob([uniqueUrls.join('\n')], { type: 'text/plain' });
        formData.append('file', blob, 'urls.txt');

        const response = await axios.post(`${this.baseUrl}/task/urls:file`, formData, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.data?.requestId || response.data?.data === null) {
            this.log('info', `✅ URLs injected successfully for task ${taskId}`);
            return true;
        }

        throw new Error(`URL injection failed: ${JSON.stringify(response.data)}`);
    }

    async startTask(taskId) {
        const token = await this.authenticate();

        this.log('info', `Starting task ${taskId}`);

        try {
            const response = await axios.post(`${this.baseUrl}/cloudextraction/start`,
                { taskId },
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );

            if (response.data?.data?.lotNo || response.data?.data === true) {
                this.log('info', `✅ Task ${taskId} started successfully`, { lotNo: response.data.data.lotNo });
                return response.data.data.lotNo || response.data.data;
            }
        } catch (err) {
            this.log('warn', `V3 start failed, trying legacy`, { error: err.message });
        }

        throw new Error(`Failed to start task ${taskId}`);
    }

    async getTaskStatus(taskId) {
        const token = await this.authenticate();

        try {
            const response = await axios.post(`${this.baseUrl}/cloudextraction/statuses/v2`,
                { taskIds: [taskId] },
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );

            return response.data?.data?.[0] || null;
        } catch (err) {
            this.log('warn', `Status check failed for ${taskId}`, { error: err.message });
            return null;
        }
    }

    async fetchResults(taskId, size = 1000) {
        const token = await this.authenticate();

        // Try multiple API paths (same as marketDataSyncService)
        const paths = [
            '/data/all',
            '/data/notexported',
            '/task/data/notexporteddata',
            '/api/notexporteddata/get',
            '/task/data'
        ];

        let lastErr = null;
        for (const path of paths) {
            try {
                this.log('info', `Trying ${path} for task ${taskId}`);
                const response = await axios.get(`${this.baseUrl}${path}`, {
                    params: { taskId, size },
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.data?.data) {
                    const results = response.data.data?.dataList || response.data.data?.data || response.data;
                    if (Array.isArray(results) && results.length > 0) {
                        this.log('info', `✅ Fetched ${results.length} results from ${path}`);
                        return results;
                    }
                }
            } catch (err) {
                lastErr = err.message;
                this.log('warn', `Path ${path} failed: ${err.message}`);
            }
        }

        this.log('error', `All paths failed for ${taskId}`, { lastError: lastErr });
        return [];
    }

    async stopTask(taskId) {
        const token = await this.authenticate();

        try {
            this.log('info', `Stopping task ${taskId}`);
            const response = await axios.post(`${this.baseUrl}/cloudextraction/stop`,
                { taskId },
                { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );

            return response.data?.data === true || response.data?.data === 'true' || response.data?.code === 200;
        } catch (err) {
            this.log('warn', `Stop task failed for ${taskId}`, { error: err.message });
            return false;
        }
    }

    async validateMasterTask() {
        try {
            const token = await this.authenticate();
            const response = await axios.get(`${this.baseUrl}/task`, {
                params: { taskId: this.masterTaskId },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const task = response.data?.data;
            if (!task) {
                throw new Error('Could not retrieve master task information');
            }

            this.log('info', `🔍 Master task validation:`, {
                taskId: task.taskId,
                taskName: task.taskName,
                status: task.status,
                hasDataFields: task.dataFields?.length || 0,
                dataFields: task.dataFields?.map(f => f.name) || []
            });

            // Check if task has the expected fields (actual field names from data)
            const expectedFields = ['Title', 'asp', 'mrp', 'category', 'Main_Image', 'BSR', 'Rating', 'sold_by'];
            const actualFields = task.dataFields?.map(f => f.name) || [];
            const missingFields = expectedFields.filter(f => !actualFields.includes(f));

            if (missingFields.length > 0) {
                this.log('warn', `⚠️ Master task missing expected fields: ${missingFields.join(', ')}`);
                this.log('info', `ℹ️ Available fields in task: ${actualFields.join(', ')}`);
            } else {
                this.log('info', `✅ Master task has all expected fields: ${expectedFields.join(', ')}`);
            }

        } catch (error) {
            this.log('warn', `Could not validate master task: ${error.message}`);
        }
    }

    async processResults(sellerId, results) {
        let updatedCount = 0;

        // DEBUG: Log what fields Octoparse is actually extracting
        if (results.length > 0) {
            const sampleItem = results[0];
            this.log('info', `🔍 Octoparse data structure for ${results.length} items:`, {
                availableFields: Object.keys(sampleItem).sort(),
                sampleValues: {
                    Title: sampleItem.Title,
                    asp_Price: sampleItem.asp,
                    mrp: sampleItem.mrp,
                    category: sampleItem.category?.substring(0, 100) + '...',
                    Main_Image: sampleItem.Main_Image?.substring(0, 50) + '...',
                    BSR: sampleItem.BSR,
                    sub_BSR: sampleItem.sub_BSR,
                    Rating: sampleItem.Rating,
                    sold_by: sampleItem.sold_by,
                    image_count_li_tags: (sampleItem.image_count?.match(/<li[^>]*>/g) || []).length,
                    bullet_points_count: (sampleItem.bullet_points?.match(/<li[^>]*>/g) || []).length,
                    individual_bp_fields: Object.keys(sampleItem).filter(k => k.startsWith('bp_')),
                    Original_URL: sampleItem.Original_URL
                },
                totalItems: results.length
            });

            // Count how many items have actual data vs generic data
            let validItems = 0;
            let genericItems = 0;
            for (const item of results.slice(0, 10)) { // Check first 10 items
                const title = item.Field1 || item.Title || item.title || '';
                if (title && !title.toString().match(/^Amazon Product/i)) {
                    validItems++;
                } else {
                    genericItems++;
                }
            }
            this.log('info', `📊 Data quality check: ${validItems} valid, ${genericItems} generic (out of ${Math.min(10, results.length)} sampled)`);
        }

        for (const item of results) {

            const asinCode = this.parseAsinFromData(item);
            if (!asinCode) {
                this.log('warn', `Could not parse ASIN from item, skipping`);
                continue;
            }

            // Case-insensitive search in database
            const asin = await Asin.findOne({
                asinCode: { $regex: new RegExp(`^${asinCode}$`, 'i') },
                seller: sellerId
            });
            if (!asin) {
                // Debug: try to see what exists
                const similar = await Asin.find({
                    seller: sellerId,
                    asinCode: { $regex: asinCode.substring(0, 5), $options: 'i' }
                }).select('asinCode').limit(3);
                this.log('warn', `ASIN ${asinCode} not found in database, skipping. Similar in DB:`, similar.map(s => s.asinCode));
                continue;
            }

            const updateData = {};

            // Field mapping based on actual Octoparse data format
            const title = item.Title || item.Field1 || item.title || item.Name || item.name || item.Product_Name || '';

            // VALIDATION: Skip generic/bad titles
            if (title && title.toString().trim()) {
                const titleStr = title.toString().trim();
                // Check for generic patterns that indicate failed extraction
                if (titleStr.match(/^Amazon Product/i) ||
                    titleStr.match(/^Product Not Found/i) ||
                    titleStr.match(/^Page Not Found/i) ||
                    titleStr === asinCode ||
                    titleStr.length < 5) {
                    this.log('warn', `⚠️ Skipping ASIN ${asinCode} - detected generic/bad title: "${titleStr}"`);
                    continue;
                }
                updateData.title = titleStr;
            }

            // Price mapping - Octoparse uses "asp" field
            const price = item.asp || item.Field2 || item.Price || item.price || item.Current_Price || item.currentPrice || item.Selling_Price || '';
            if (price) {
                // Handle currency symbols and extract numeric value
                const cleanPrice = price.toString().replace(/[₹,\s]/g, '');
                const priceNum = parseFloat(cleanPrice);
                if (priceNum > 0 && priceNum < 1000000) { // Reasonable price range
                    updateData.currentPrice = priceNum;
                }
            }

            // MRP mapping - Octoparse uses "mrp" field
            const mrp = item.mrp || item.Field3 || item.MRP || item.List_Price || item.listPrice || '';
            if (mrp) {
                const cleanMrp = mrp.toString().replace(/[₹,\s]/g, '');
                updateData.mrp = parseFloat(cleanMrp) || 0;
            }

            // Rating mapping - Octoparse uses "Rating" field
            const rating = item.Rating || item.Field7 || item.rating || item.Average_Rating || '';
            if (rating) {
                const ratingNum = parseFloat(rating);
                if (ratingNum >= 0 && ratingNum <= 5) { // Valid rating range
                    updateData.rating = ratingNum;
                }
            }

            // Reviews - not present in this data format, but check anyway
            const reviews = item.Reviews || item.reviews || item.ReviewCount || item.Reviews_Count || item.Total_Reviews || '';
            if (reviews) {
                const reviewsNum = parseInt(reviews);
                if (reviewsNum >= 0 && reviewsNum < 1000000) { // Reasonable review count
                    updateData.reviewCount = reviewsNum;
                }
            }

            // BSR mapping - handle both BSR and sub_BSR fields
            let bsrValue = 0;
            const bsrRaw = item.BSR || item.Field9 || item.bsr || item.Best_Seller_Rank || item.bsrRank || '';
            const subBsrRaw = item.sub_BSR || '';

            // Try main BSR first
            if (bsrRaw) {
                const cleanBsr = bsrRaw.toString().replace(/[,]/g, '');
                const parsed = parseInt(cleanBsr);
                if (!isNaN(parsed) && parsed > 0) {
                    bsrValue = parsed;
                }
            }

            // If no main BSR, try sub_BSR
            if (bsrValue === 0 && subBsrRaw) {
                const cleanSubBsr = subBsrRaw.toString().replace(/[,]/g, '');
                const parsed = parseInt(cleanSubBsr);
                if (!isNaN(parsed) && parsed > 0) {
                    bsrValue = parsed;
                }
            }

            if (bsrValue > 0) {
                updateData.bsr = bsrValue;
            }

            // Store sub-BSR ranks separately if available
            const subBsrs = [];
            if (subBsrRaw && subBsrRaw !== bsrRaw) {
                const cleanSubBsr = subBsrRaw.toString().replace(/[,]/g, '');
                const parsed = parseInt(cleanSubBsr);
                if (!isNaN(parsed) && parsed > 0) {
                    subBsrs.push(parsed.toString());
                }
            }
            if (subBsrs.length > 0) {
                updateData.subBSRs = subBsrs;
            }

            // Category mapping - extract last breadcrumb only
            const categoryRaw = item.category || item.Field4 || item.Category || item.Product_Category || '';
            if (categoryRaw) {
                // Extract last breadcrumb from HTML
                const liMatch = categoryRaw.match(/<li[^>]*>(?:<span[^>]*>)?(?:<a[^>]*>)?([^<]+)(?:<\/a>)?(?:<\/span>)?<\/li>$/i);
                if (liMatch) {
                    updateData.category = liMatch[1].trim().replace(/^›\s*/, '').replace(/\s*›$/, '').trim();
                } else {
                    // Fallback to original if regex doesn't match
                    updateData.category = categoryRaw.replace(/<[^>]*>/g, '').trim();
                }
            }

            // Image mapping - Octoparse uses "Main_Image" field
            const image = item.Main_Image || item.Field5 || item.Image || item.imageUrl || item.image || '';
            if (image) updateData.imageUrl = image;

            // Sold by mapping
            const soldBy = item.sold_by || item.Field11 || item.soldBy || '';
            if (soldBy) updateData.soldBy = soldBy;

            // Image count - count <li> tags in image_count field
            const imageCountRaw = item.image_count || item.Field6 || '';
            if (imageCountRaw) {
                const liMatches = imageCountRaw.match(/<li[^>]*>/g);
                if (liMatches) {
                    updateData.imagesCount = liMatches.length;
                }
            }

            // Bullet points - combine all bp_1, bp_2, etc. or parse bullet_points HTML
            const bulletPoints = [];
            // Check for individual bullet point fields
            for (let i = 1; i <= 10; i++) {
                const bpField = item[`bp_${i}`];
                if (bpField && bpField.trim()) {
                    bulletPoints.push(bpField.trim());
                }
            }

            // If no individual fields, try to parse bullet_points HTML
            if (bulletPoints.length === 0) {
                const bulletPointsRaw = item.bullet_points || '';
                if (bulletPointsRaw) {
                    // Extract text from <li> tags
                    const liMatches = bulletPointsRaw.match(/<li[^>]*>(?:<span[^>]*>)?([^<]+)(?:<\/span>)?<\/li>/gi);
                    if (liMatches) {
                        for (const liMatch of liMatches) {
                            const textMatch = liMatch.match(/<li[^>]*>(?:<span[^>]*>)?([^<]+)(?:<\/span>)?<\/li>/i);
                            if (textMatch && textMatch[1]) {
                                bulletPoints.push(textMatch[1].trim());
                            }
                        }
                    }
                }
            }

            if (bulletPoints.length > 0) {
                updateData.bulletPointsText = bulletPoints;
                updateData.bulletPoints = bulletPoints.length; // Also update count
            }

            // Only update if we have meaningful data (not just generic data)
            if (Object.keys(updateData).length >= 2) { // Require at least 2 meaningful fields
                updateData.lastScraped = new Date();
                updateData.scrapeStatus = 'COMPLETED';
                updateData.status = 'Active';

                // Log processed data for first few items
                if (results.indexOf(item) < 2) {
                    this.log('info', `✅ Processing ASIN ${asinCode}:`, {
                        title: updateData.title?.substring(0, 50) + '...',
                        price: updateData.currentPrice,
                        category: updateData.category,
                        imagesCount: updateData.imagesCount,
                        bulletPointsCount: updateData.bulletPoints,
                        bsr: updateData.bsr,
                        soldBy: updateData.soldBy
                    });
                }

                await Asin.findByIdAndUpdate(asin._id, { $set: updateData });
                updatedCount++;
            } else {
                this.log('warn', `⚠️ Skipping ASIN ${asinCode} - insufficient valid data (${Object.keys(updateData).length} fields)`);
            }
        }

        this.log('info', `✅ Processed ${updatedCount}/${results.length} ASINs for seller ${sellerId}`);
        const successRate = updatedCount / results.length;

        if (successRate < 0.5) {
            this.log('error', `🚨 CRITICAL: Very low success rate (${Math.round(successRate * 100)}%). Octoparse task may be misconfigured.`);
            this.log('error', `🚨 Expected fields (Field1, Field2, etc.) not found. Check Octoparse task selectors and field mapping.`);
        } else if (successRate < 0.8) {
            this.log('warn', `⚠️ Moderate success rate (${Math.round(successRate * 100)}%). Some ASINs may need Octoparse task adjustments.`);
        } else {
            this.log('info', `🎉 High success rate (${Math.round(successRate * 100)}%). Octoparse task working well.`);
        }
        return updatedCount;
    }

    async identifyGaps(sellerId, results) {
        const allAsins = await Asin.find({ seller: sellerId, status: 'Active' }).select('asinCode currentPrice title rating');

        const gapAsins = [];
        const resultAsins = new Map();

        // First pass: build result set (lowercase for lookup)
        for (const item of results) {
            const asin = this.parseAsinFromData(item);
            if (asin) resultAsins.set(asin.toLowerCase(), item);
        }

        // Second pass: identify gaps
        for (const asin of allAsins) {
            const asinLower = asin.asinCode.toLowerCase();
            const item = resultAsins.get(asinLower);

            // Case 1: ASIN not in results at all
            if (!item) {
                gapAsins.push({
                    asinCode: asin.asinCode,
                    reason: 'NOT_EXTRACTED'
                });
                continue;
            }

            // Case 2: ASIN in results but data is incomplete
            if (!this.isDataComplete(item)) {
                gapAsins.push({
                    asinCode: asin.asinCode,
                    reason: 'INCOMPLETE_DATA'
                });
            }
        }

        this.log('info', `Identified ${gapAsins.length} gap ASINs for seller ${sellerId}`);

        // Log breakdown
        const notExtracted = gapAsins.filter(g => g.reason === 'NOT_EXTRACTED').length;
        const incomplete = gapAsins.filter(g => g.reason === 'INCOMPLETE_DATA').length;
        if (gapAsins.length > 0) {
            this.log('info', `Gap breakdown: ${notExtracted} not extracted, ${incomplete} incomplete data`);
        }

        return gapAsins;
    }

    parseAsinFromData(item) {
        // 1. Try common field names
        if (item.asinCode) return item.asinCode;
        if (item.ASIN) return item.ASIN;

        // 2. Try to parse from URL (most reliable in modern Octoparse tasks)
        const url = item.Original_URL || item.url || item.Field10 || '';
        if (url) {
            const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/asin=([A-Z0-9]{10})/i);
            if (match) return match[1];
        }

        // 3. Fallback: search all values for a 10-char uppercase alphanumeric string (Amazon ASIN pattern)
        for (const key in item) {
            const val = item[key];
            if (typeof val === 'string' && val.length === 10 && /^[A-Z0-9]{10}$/.test(val)) {
                return val;
            }
        }

        return null;
    }

    isDataComplete(item) {
        // Critical fields required for an ASIN update to be useful
        const title = (item.Title || item.title || item.Field1 || item.Name || '').toString().trim();
        const price = item.asp || item.Price || item.Field2 || item.currentPrice || 0;

        // BSR is also important but not always available
        // Return true if we have at least Title AND Price
        return title.length > 5 && !title.match(/^Amazon Product/i) && price > 0;
    }

    /**
     * Phase 3: Self-Healing - Run as concurrent background process
     * Does not block the main pipeline - runs in background
     */
    async startSelfHealingBackground(sellerId, taskId) {
        this.log('info', `🔧 [BG-HEAL] Starting background self-healing for seller ${sellerId}`);

        // Run self-healing in background without blocking
        (async () => {
            try {
                const result = await this.runSelfHealing(sellerId, taskId);
                if (result.success) {
                    this.log('info', `✅ [BG-HEAL] Self-healing completed for seller ${sellerId}`, result);
                } else {
                    this.log('warn', `⚠️ [BG-HEAL] Self-healing completed with issues for seller ${sellerId}`, result);
                }
            } catch (err) {
                this.log('error', `❌ [BG-HEAL] Self-healing failed for seller ${sellerId}:`, err.message);
            }
        })();

        // Return immediately - don't wait for completion
        return { started: true, message: 'Self-healing started in background' };
    }

    /**
     * Phase 3: Self-Healing - Loop until ALL critical data is complete
     * - Single missing value: OK (tolerate minor gaps)
     * - Multiple missing values: Retry only those ASINs
     * - Continues until no critical gaps remain
     */
    runSelfHealing = async (sellerId, taskId) => {
        let iteration = 0;
        const maxIterations = 10; // Safety limit to prevent infinite loops

        while (iteration < maxIterations) {
            iteration++;
            this.log('info', `═══════════════════════════════════════════════════════`);
            this.log('info', `🔧 PHASE 3: SELF-HEALING - Loop ${iteration}`);
            this.log('info', `═══════════════════════════════════════════════════════`);

            try {
                // Step 1: Fetch latest results and identify gaps
                this.log('info', `🔍 Scanning for incomplete ASINs...`);
                const results = await this.fetchResults(taskId);
                const gaps = await this.identifyCriticalGaps(sellerId, results);

                // Step 2: If no critical gaps, we're done
                if (gaps.length === 0) {
                    this.log('info', `✅ ALL ASINs have critical data! Self-healing complete.`);
                    return {
                        success: true,
                        gapsFound: 0,
                        iterations: iteration
                    };
                }

                // Step 3: Log gap details
                this.log('info', `📋 Found ${gaps.length} ASINs with critical missing data:`);
                gaps.slice(0, 5).forEach(g => {
                    this.log('info', `   - ${g.asinCode}: missing [${g.missingFields.join(', ')}]`);
                });
                if (gaps.length > 5) {
                    this.log('info', `   ... and ${gaps.length - 5} more`);
                }

                // Step 4: Stop current task
                this.log('info', `🛑 Stopping current task ${taskId}...`);
                await this.stopTask(taskId);
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Step 5: Inject gap ASINs only
                const gapAsins = gaps.map(g => g.asinCode);
                const gapUrls = gapAsins.map(asin => `https://www.amazon.in/dp/${asin}`);
                this.log('info', `📝 Injecting ${gapUrls.length} gap ASINs into task...`);

                await this.injectUrls(taskId, gapUrls);

                // Step 6: Start new extraction
                this.log('info', `🚀 Starting extraction for ${gapUrls.length} gap ASINs...`);
                const lotNo = await this.startTask(taskId);

                // Step 7: Poll with concurrent DB updates
                this.log('info', `⏳ Polling for completion (1-min intervals)...`);
                await this.startConcurrentPolling(sellerId, taskId, lotNo);

                // Step 8: Fetch and process new results
                this.log('info', `📥 Fetching new results...`);
                const newResults = await this.fetchResults(taskId);
                const savedCount = await this.processResults(sellerId, newResults);
                this.log('info', `💾 Saved ${savedCount} ASINs from gap retry`);

                // Step 9: Continue to next iteration
                this.log('info', `🔄 Checking for remaining gaps...`);

            } catch (error) {
                this.log('error', `❌ Self-healing error on iteration ${iteration}: ${error.message}`);

                // If error, wait and try again
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        this.log('warn', `⚠️ Self-healing reached max iterations (${maxIterations})`);
        return {
            success: false,
            reason: 'Max iterations reached',
            iterations: iteration
        };
    }

    /**
     * Identify only ASINs with CRITICAL missing data
     * - Missing title AND price = CRITICAL (retry)
     * - Only title OR price missing = OK (no retry)
     */
    async identifyCriticalGaps(sellerId, results) {
        const allAsins = await Asin.find({ seller: sellerId, status: 'Active' }).select('asinCode');

        // Debug: log what we have in DB vs what came from Octoparse
        const resultSet = new Set();
        for (const item of results) {
            const asin = this.parseAsinFromData(item);
            if (asin) resultSet.add(asin.toLowerCase());
        }

        this.log('info', `[DEBUG] DB has ${allAsins.length} ASINs for seller ${sellerId}`);
        this.log('info', `[DEBUG] Octoparse returned ${resultSet.size} unique ASINs`);
        this.log('info', `[DEBUG] Sample DB ASINs:`, allAsins.slice(0, 3).map(a => a.asinCode));
        this.log('info', `[DEBUG] Sample result ASINs:`, Array.from(resultSet).slice(0, 3));

        const criticalGaps = [];
        const resultMap = new Map(); // Map<ASIN, item data>

        // Build result map - store original case as-is
        for (const item of results) {
            const asin = this.parseAsinFromData(item);
            if (asin) {
                resultMap.set(asin.toLowerCase(), item); // Store lowercase for lookup
            }
        }

        // Check each ASIN - use case-insensitive comparison
        for (const asin of allAsins) {
            const asinLower = asin.asinCode.toLowerCase();
            const item = resultMap.get(asinLower);

            if (!item) {
                // Not extracted at all - CRITICAL
                criticalGaps.push({
                    asinCode: asin.asinCode,
                    reason: 'NOT_EXTRACTED',
                    missingFields: ['all']
                });
                continue;
            }

            // Check for critical missing data - use flexible field names
            const title = (item.Title || item.title || item.Field1 || item.Name || item.name || item.Product_Name || '').toString().trim();
            const price = item.Price || item.price || item.Current_Price || item.currentPrice || item.Selling_Price || 0;

            const missingFields = [];
            if (!title) missingFields.push('title');
            if (!price || parseFloat(price) <= 0) missingFields.push('price');

            // Only consider CRITICAL if BOTH are missing (not just one)
            if (missingFields.length >= 2) {
                criticalGaps.push({
                    asinCode: asin.asinCode,
                    reason: 'MISSING_CRITICAL_FIELDS',
                    missingFields
                });
            }
        }

        const notExtracted = criticalGaps.filter(g => g.reason === 'NOT_EXTRACTED').length;
        const criticalMissing = criticalGaps.filter(g => g.reason === 'MISSING_CRITICAL_FIELDS').length;

        this.log('info', `Critical gaps: ${notExtracted} not extracted, ${criticalMissing} missing multiple fields`);

        return criticalGaps;
    }

    async pollForCompletion(taskId, lotNo, maxAttempts = 120) {
        this.log('info', `Starting concurrent polling for task ${taskId} at 1-min intervals`);

        const pollKey = `poll_${taskId}`;

        // Start concurrent poller in background
        this.concurrentPollers.set(pollKey, true);

        let lastFetchedCount = 0;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (!this.concurrentPollers.get(pollKey)) {
                this.log('info', `Poller stopped for task ${taskId}`);
                return true;
            }

            const status = await this.getTaskStatus(taskId);

            if (!status) {
                this.log('warn', `Status check failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, this.pollInterval));
                continue;
            }

            const taskStatus = status.status?.toLowerCase();
            const extractCount = status.currentTotalExtractCount || 0;

            this.log('info', `Task ${taskId} status: ${taskStatus}, extracted: ${extractCount} items`, {
                attempt: attempt + 1,
                interval: `${this.pollInterval / 1000}s`
            });

            // Fetch and save data incrementally as it's being extracted
            if (extractCount > lastFetchedCount) {
                try {
                    const results = await this.fetchResults(taskId);
                    if (results && results.length > 0) {
                        this.log('info', `📊 Incremental data: ${results.length} items fetched, saving to DB...`);
                        // Note: We need sellerId for this - will be passed when calling
                    }
                } catch (err) {
                    this.log('warn', `Incremental fetch error: ${err.message}`);
                }
                lastFetchedCount = extractCount;
            }

            if (taskStatus === 'finished' || taskStatus === 'stopped' || taskStatus === 'idle') {
                this.log('info', `Task ${taskId} completed with ${extractCount} items`);
                this.concurrentPollers.delete(pollKey);
                return { success: true, extractCount };
            }

            if (taskStatus === 'failed' || taskStatus === 'error') {
                this.log('error', `Task ${taskId} failed`);
                this.concurrentPollers.delete(pollKey);
                return { success: false, reason: 'Task failed' };
            }

            await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        }

        this.log('warn', `Polling timeout for task ${taskId} after ${maxAttempts} attempts`);
        this.concurrentPollers.delete(pollKey);
        return { success: false, reason: 'Timeout' };
    }

    /**
     * Start concurrent background polling that updates DB in real-time
     */
    async startConcurrentPolling(sellerId, taskId, lotNo) {
        const pollKey = `poll_${taskId}`;

        this.log('info', `Starting concurrent poller for seller ${sellerId}, task ${taskId}`);

        this.concurrentPollers.set(pollKey, true);

        const maxAttempts = 120; // 2 hours max

        let lastFetchedCount = 0;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (!this.concurrentPollers.get(pollKey)) {
                this.log('info', `Concurrent poller stopped for task ${taskId}`);
                break;
            }

            const status = await this.getTaskStatus(taskId);

            if (!status) {
                this.log('warn', `Polling ${attempt + 1}: Status unavailable, retrying in 1 min...`);
                await new Promise(resolve => setTimeout(resolve, this.pollInterval));
                continue;
            }

            const taskStatus = status.status?.toLowerCase();
            const extractCount = status.currentTotalExtractCount || 0;

            // Log status every minute
            if (attempt % 5 === 0 || taskStatus === 'finished') {
                this.log('info', `🔄 [${attempt + 1}/${maxAttempts}] Task ${taskId}: ${taskStatus} - ${extractCount} items extracted`);
            }

            // Fetch and save data incrementally when new data arrives
            if (extractCount > lastFetchedCount) {
                try {
                    const results = await this.fetchResults(taskId);
                    if (results && results.length > 0) {
                        const saved = await this.processResults(sellerId, results);
                        this.log('info', `💾 Saved ${saved} ASINs to database (total: ${results.length} in task)`);
                    }
                } catch (err) {
                    this.log('warn', `Incremental save error: ${err.message}`);
                }
                lastFetchedCount = extractCount;
            }

            // Check for completion
            if (taskStatus === 'finished' || taskStatus === 'stopped' || taskStatus === 'idle') {
                this.log('info', `✅ Task ${taskId} completed. Final count: ${extractCount} items`);
                return { success: true, extractCount };
            }

            if (taskStatus === 'failed' || taskStatus === 'error') {
                this.log('error', `❌ Task ${taskId} failed with status: ${taskStatus}`);
                return { success: false, reason: 'Task failed' };
            }

            // Wait 1 minute before next poll
            await new Promise(resolve => setTimeout(resolve, this.pollInterval));
        }

        this.concurrentPollers.delete(pollKey);
        this.log('warn', `Polling loop ended for task ${taskId}`);
        return { success: false, reason: 'Polling ended' };
    }

    /**
     * Stop concurrent polling for a task
     */
    stopPolling(taskId) {
        const pollKey = `poll_${taskId}`;
        if (this.concurrentPollers.has(pollKey)) {
            this.concurrentPollers.delete(pollKey);
            this.log('info', `Stopped polling for task ${taskId}`);
        }
    }

    async executePipeline(sellerId) {
        const startTime = Date.now();
        const executionId = `exec_${sellerId}_${Date.now()}`;

        this.log('info', `Starting pipeline for seller ${sellerId}`, { executionId });

        try {
            const seller = await Seller.findById(sellerId);
            if (!seller) {
                throw new Error(`Seller not found: ${sellerId}`);
            }

            const asins = await Asin.find({ seller: sellerId, status: 'Active' });
            if (asins.length === 0) {
                this.log('warn', `No active ASINs for seller ${sellerId}`);
                return { success: true, asinsProcessed: 0, executionId };
            }

            const taskId = await this.ensureTaskForSeller(sellerId);

            const urls = asins.map(a => `https://www.amazon.in/dp/${a.asinCode}`);

            await Seller.findByIdAndUpdate(sellerId, {
                marketSyncUrls: urls,
                totalAsins: asins.length
            });

            await this.stopTask(taskId);
            await new Promise(resolve => setTimeout(resolve, 3000));

            await this.injectUrls(taskId, urls);

            const lotNo = await this.startTask(taskId);

            // Start concurrent polling - updates DB every minute as data is extracted
            this.log('info', `Starting concurrent polling (1-min intervals) for task ${taskId}`);
            const pollResult = await this.startConcurrentPolling(sellerId, taskId, lotNo);

            // Even if polling didn't complete, try to fetch and save data
            // (task might have been stopped but still have data)
            this.log('info', `Fetching final results after polling...`);
            const results = await this.fetchResults(taskId);
            const savedCount = await this.processResults(sellerId, results);
            this.log('info', `Final save: ${savedCount} ASINs`);

            // Start self-healing in background - don't block pipeline
            this.log('info', `🔧 Starting background self-healing for seller ${sellerId}`);
            const healResult = this.startSelfHealingBackground(sellerId, taskId);

            const duration = Date.now() - startTime;
            this.log('info', `Pipeline completed for seller ${sellerId}`, {
                executionId,
                duration: `${Math.round(duration / 1000)}s`,
                success: true,
                selfHealing: 'started in background'
            });

            return {
                success: true,
                asinsProcessed: asins.length,
                executionId,
                duration: `${Math.round(duration / 1000)}s`,
                selfHealing: healResult
            };

        } catch (error) {
            const duration = Date.now() - startTime;
            this.log('error', `Pipeline failed for seller ${sellerId}`, {
                executionId,
                error: error.message,
                duration: `${Math.round(duration / 1000)}s`
            });

            return {
                success: false,
                error: error.message,
                executionId,
                duration: `${Math.round(duration / 1000)}s`
            };
        }
    }

    /**
     * Run full automation for ALL sellers concurrently
     * Each seller runs in parallel - much faster
     */
    async runFullAutomation() {
        const startTime = Date.now();
        this.log('info', '═══════════════════════════════════════════════════════');
        this.log('info', '🏢 Starting CONCURRENT enterprise automation pipeline');
        this.log('info', '═══════════════════════════════════════════════════════');

        const sellers = await Seller.find({ status: 'Active', marketSyncTaskId: { $exists: true, $ne: '' } });

        if (sellers.length === 0) {
            this.log('warn', 'No active sellers with Octoparse tasks found');
            return { success: false, reason: 'No active sellers' };
        }

        this.log('info', `🚀 Launching ${sellers.length} seller pipelines CONCURRENTLY...`);

        // Run ALL seller pipelines concurrently
        const promises = sellers.map(seller =>
            this.executePipeline(seller._id).then(result => ({
                sellerId: seller._id,
                sellerName: seller.name,
                ...result
            })).catch(err => ({
                sellerId: seller._id,
                sellerName: seller.name,
                success: false,
                error: err.message,
                executionId: `error_${seller._id}`
            }))
        );

        const results = await Promise.all(promises);

        const successCount = results.filter(r => r.success).length;
        const totalDuration = Date.now() - startTime;

        const summary = {
            totalSellers: sellers.length,
            successful: successCount,
            failed: sellers.length - successCount,
            duration: `${Math.round(totalDuration / 1000)}s`,
            results
        };

        this.log('info', '═══════════════════════════════════════════════════════');
        this.log('info', '🏢 CONCURRENT pipeline completed', summary);
        this.log('info', '═══════════════════════════════════════════════════════');
        return summary;
    }
}

module.exports = new OctoparseAutomationService();