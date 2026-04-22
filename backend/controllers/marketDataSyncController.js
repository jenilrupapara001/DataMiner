const octoparseAutomationService = require('../services/octoparseAutomationService');
const marketDataSyncService = require('../services/marketDataSyncService');
const Asin = require('../models/Asin');
const Seller = require('../models/Seller');
const { updateSellerAsinCount } = require('./asinController');

/**
 * Controller for discreet Market Data Synchronization.
 */
exports.syncAsin = async (req, res) => {
    try {
        const { id } = req.params;
        const asin = await Asin.findById(id).populate('seller');

        if (!asin) {
            return res.status(404).json({ success: false, error: 'ASIN not found' });
        }

        // Security check
        const roleName = req.user?.role?.name || req.user?.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const sellerIdStr = asin.seller ? (asin.seller._id ? asin.seller._id.toString() : asin.seller.toString()) : null;
        const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === sellerIdStr);

        if (!isGlobalUser && !isAssigned && sellerIdStr) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to ASIN sync' });
        }

        const taskId = asin.seller?.marketSyncTaskId;

        // Check if sync already in progress
        if (asin.scrapeStatus === 'SCRAPING') {
            return res.status(400).json({ success: false, error: 'Sync already in progress' });
        }

        // Update status to scraping
        asin.scrapeStatus = 'SCRAPING';
        asin.status = 'Scraping';
        await asin.save();

        const isConfigured = octoparseAutomationService.isConfigured();
        const automationEnabled = process.env.AUTOMATION_ENABLED === 'true';
        let useDirect = (!taskId || !isConfigured) && !automationEnabled;

        console.log(`[SyncAsin] Decision for ${asin.asinCode}: taskId=${taskId}, isConfigured=${isConfigured}, automationEnabled=${automationEnabled} => useDirect=${useDirect}`);

        if (!useDirect) {
            try {
                // Option A: Use Octoparse (Managed Task)
                console.log(`🤖 Using Octoparse for ASIN: ${asin.asinCode}`);
                
                // Trigger batch sync logic (which handles URL injection and scrape start)
                const syncStarted = await octoparseAutomationService.syncSellerAsinsToOctoparse(asin.seller._id, { triggerScrape: true });

                if (!syncStarted) {
                    throw new Error('Failed to start sync via automated service');
                }

                return res.json({
                    success: true,
                    message: 'Market data sync initiated and automated monitoring started (Octoparse)',
                    status: 'SCRAPING'
                });
            } catch (octoError) {
                console.error(`❌ Octoparse Sync failed for ${asin.asinCode}:`, octoError.message);
                /* 
                // Option B: Fallback to Direct Web Scraping
                console.log(`🕷️ Using Direct Scraper for ASIN: ${asin.asinCode}`);
                const DirectScraperService = require('../services/directScraperService');

                try {
                    const rawData = await DirectScraperService.scrapeAsin(asin.asinCode);
                    const updatedAsin = await octoparseAutomationService.updateAsinMetrics(asin._id, rawData);

                    return res.json({
                        success: true,
                        message: 'Market data synced successfully (Direct)',
                        status: 'COMPLETED',
                        data: updatedAsin
                    });
                } catch (scrapeError) {
                    // Revert status if scraping fails
                    asin.scrapeStatus = 'FAILED';
                    asin.status = 'Error';
                    await asin.save();
                    throw scrapeError;
                }
                */
                return res.status(400).json({ 
                    success: false, 
                    error: 'Octoparse Sync failed and Direct Fallback is disabled.' 
                });
            }
        }

    } catch (error) {
        console.error('Market Sync Controller Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Market Sync Error: ' + error.message });
    }
};

/**
 * Handle manual completion/webhooks for sync completion.
 */
exports.handleSyncComplete = async (req, res) => {
    try {
        const { asinId, rawData } = req.body;

        // This would typically be a webhook from the provider
        // but can be triggered manually for direct API updates.
        const updatedAsin = await octoparseAutomationService.updateAsinMetrics(asinId, rawData);

        res.json({
            success: true,
            message: 'Market metrics updated successfully',
            data: updatedAsin
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Trigger batch sync for all active ASINs of a seller.
 */
exports.syncSellerAsins = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const seller = await Seller.findById(sellerId);

        if (!seller) {
            return res.status(404).json({ success: false, error: 'Seller not found' });
        }

        // Security check
        const roleName = req.user?.role?.name || req.user?.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === sellerId);

        if (!isGlobalUser && !isAssigned) {
            return res.status(403).json({ success: false, error: 'Unauthorized to trigger sync for this seller' });
        }

        const asins = await Asin.find({ seller: sellerId, status: 'Active' });
        if (asins.length === 0) {
            return res.json({ success: true, message: 'No active ASINs to sync' });
        }

        const asinCodes = asins.map(a => a.asinCode);

        // Update ASIN statuses
        await Asin.updateMany(
            { _id: { $in: asins.map(a => a._id) } },
            { $set: { scrapeStatus: 'SCRAPING', status: 'Scraping' } }
        );

        const isConfigured = octoparseAutomationService.isConfigured();
        const automationEnabled = process.env.AUTOMATION_ENABLED === 'true';
        let useDirect = (!seller.marketSyncTaskId || !isConfigured) && !automationEnabled;

        console.log(`[SellerSync] Decision for ${seller.name}: taskId=${seller.marketSyncTaskId}, isConfigured=${isConfigured}, automationEnabled=${automationEnabled} => useDirect=${useDirect}`);

        if (!useDirect) {
            try {
                console.log(`🤖 Using Automated Octoparse Sync for Seller: ${seller.name}`);
                const fullSync = req.body.fullSync === true || req.query.fullSync === 'true';

                const syncStarted = await octoparseAutomationService.syncSellerAsinsToOctoparse(sellerId, { 
                    triggerScrape: true,
                    fullSync: fullSync
                });

                if (!syncStarted) {
                    throw new Error('Automated sync service failed to initialize');
                }

                return res.json({
                    success: true,
                    message: `Batch sync initiated and background monitoring started for ${asins.length} ASINs`,
                    count: asins.length
                });
            } catch (octoError) {
                console.error(`❌ Octoparse Batch Sync failed for ${seller.name}:`, octoError.message);
                /*
                if (useDirect) {
                    console.log(`🕷️ Using Direct Scraper for Batch Sync for Seller: ${seller.name}`);
                    const DirectScraperService = require('../services/directScraperService');

                    // Fire and forget background process
                    setTimeout(async () => {
                        for (const asin of asins) {
                            try {
                                const rawData = await DirectScraperService.scrapeAsin(asin.asinCode);
                                await octoparseAutomationService.updateAsinMetrics(asin._id, rawData);
                                console.log(`✅ Background sync completed for ASIN: ${asin.asinCode}`);
                            } catch (err) {
                                console.error(`❌ Background sync failed for ASIN: ${asin.asinCode}`, err.message);
                                await Asin.updateOne({ _id: asin._id }, { $set: { scrapeStatus: 'FAILED', status: 'Error' } });
                            }
                            await new Promise(resolve => setTimeout(resolve, 2000));
                        }
                    }, 0);

                    return res.json({
                        success: true,
                        message: `Batch sync initiated (Direct) in background for ${asins.length} ASINs`,
                        count: asins.length
                    });
                }
                */
                return res.status(400).json({ 
                    success: false, 
                    error: 'Octoparse Batch Sync failed and Direct Fallback is disabled.' 
                });
            }
        }

    } catch (error) {
        console.error('Batch Sync Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Batch Sync Error: ' + error.message });
    }
};

/**
 * Trigger batch sync for all active ASINs across all sellers assigned to the user.
 */
exports.syncAllAsins = async (req, res) => {
    console.log('📨 Entering syncAllAsins handler');
    try {
        const roleName = req.user?.role?.name || req.user?.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const filter = { status: 'Active' };

        if (!isGlobalUser) {
            const allowedSellerIds = req.user.assignedSellers.map(s => s._id);
            filter.seller = { $in: allowedSellerIds };
        }

        const asins = await Asin.find(filter).populate('seller');
        if (asins.length === 0) {
            return res.json({ success: true, message: 'No active ASINs to sync' });
        }

        // Update ASIN statuses
        await Asin.updateMany(
            { _id: { $in: asins.map(a => a._id) } },
            { $set: { scrapeStatus: 'SCRAPING', status: 'Scraping' } }
        );

        // Process Sellers in background (Bulk sync approach)
        const SocketService = require('../services/socketService');
        const io = SocketService.getIo();

        // 1. Identify Unique Sellers from the ASIN set
        const sellerIds = [...new Set(asins.map(a => a.seller?._id || a.seller).filter(Boolean))];
        
        // Force-Clear any stale locks for these specific sellers before a manual "Sync All"
        sellerIds.forEach(id => octoparseAutomationService.syncLocks.delete(id.toString()));
        console.log(`🧹 Cleared status locks for ${sellerIds.length} sellers to allow fresh sync.`);
        console.log(`🚀 Starting Global Sync for ${sellerIds.length} Sellers (${asins.length} ASINs)...`);

        // Fire and forget background process
        setTimeout(async () => {
            let sellersProcessed = 0;

            const broadcastProgress = (statusText) => {
                if (io) {
                    io.emit('scrape_progress', {
                        total: sellerIds.length,
                        processed: sellersProcessed,
                        status: statusText,
                        timestamp: Date.now()
                    });
                }
            };

            broadcastProgress('Initializing Bulk Sync Tasks...');

            // TRUE PARALLEL: Fire ALL task triggers simultaneously without waiting
            console.log(`🚀 Starting ALL ${sellerIds.length} Octoparse tasks simultaneously...`);
            
            const triggerPromises = sellerIds.map(async (sellerId) => {
                try {
                    const result = await octoparseAutomationService.syncSellerAsinsToOctoparse(sellerId, { 
                        fullSync: true,
                        forceReRun: true,
                        triggerScrape: true
                    });
                    if (result) {
                        console.log(`✅ Task triggered for seller ${sellerId}`);
                    }
                    return { sellerId, success: true };
                } catch (err) {
                    console.error(`❌ Task trigger failed for seller ${sellerId}:`, err.message);
                    return { sellerId, success: false, error: err.message };
                }
            });

            // Fire all triggers at once and let them run in background
            const results = await Promise.all(triggerPromises);
            
            const successCount = results.filter(r => r.success).length;
            console.log(`🎉 All ${sellerIds.length} task triggers fired. ${successCount} successful, ${results.length - successCount} failed.`);
            broadcastProgress(`All ${sellerIds.length} scrape tasks started.`);

            console.log(`🎉 Global sync bulk initialization finished for ${sellerIds.length} sellers.`);
            broadcastProgress('All sync tasks initiated.');
        }, 0);

        res.json({
            success: true,
            message: `Global sync initiated for ${asins.length} ASINs`,
            count: asins.length
        });
    } catch (error) {
        console.error('Global Sync Error:', error.message);
        res.status(500).json({ success: false, error: 'Internal Global Sync Error: ' + error.message });
    }
};

/**
 * Fetch results from provider and apply to ASINs.
 */
exports.fetchAndApplyResults = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const seller = await Seller.findById(sellerId);

        if (!seller || !seller.marketSyncTaskId) {
            return res.status(404).json({ success: false, error: 'Seller or Sync Task not found' });
        }

        const data = await octoparseAutomationService.retrieveResults(seller.marketSyncTaskId);

        if (!data || data.length === 0) {
            return res.json({ success: true, message: 'No new data found from provider' });
        }

        const updatedCount = await octoparseAutomationService.processBatchResults(sellerId, data);
        
        // Update seller counts and emit socket signal
        await updateSellerAsinCount(sellerId, req.app.get('io'));

        res.json({
            success: true,
            message: `Processed ${data.length} items, updated ${updatedCount} ASINs via high-performance bulk link.`,
            count: updatedCount
        });
    } catch (error) {
        console.error('Fetch Results Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch and apply results' });
    }
};

/**
 * Ingest all results from a specific task or latest task execution.
 * This is used for bulk discovery and adding new ASINs.
 */
exports.ingestTaskResults = async (req, res) => {
    try {
        const { taskId, executionId, sellerId } = req.body;

        if (!taskId && !executionId) {
            return res.status(400).json({ success: false, error: 'Task ID or Execution ID required' });
        }

        // 1. Identify Seller
        let seller;
        if (sellerId) {
            seller = await Seller.findById(sellerId);
        } else if (taskId) {
            seller = await Seller.findOne({ marketSyncTaskId: taskId });
        }

        if (!seller) {
            return res.status(404).json({ success: false, error: 'Target Seller not found for this task' });
        }

        // 2. Resolve Execution ID
        let targetExecutionId = executionId;
        if (!targetExecutionId && taskId) {
            console.log(`🔍 Finding latest execution for taskId: ${taskId}`);
            targetExecutionId = await octoparseAutomationService.getLatestExecutionId(taskId);
        }

        if (!targetExecutionId) {
            return res.status(404).json({ success: false, error: 'No execution ID found for this task' });
        }

        // 3. Fetch Data
        console.log(`📥 Ingesting results from Execution: ${targetExecutionId}`);
        const data = await octoparseAutomationService.retrieveResults(taskId || seller.marketSyncTaskId, targetExecutionId);

        if (!data || data.length === 0) {
            return res.json({ success: true, message: 'No data found in execution', count: 0 });
        }

        // 4. Process & Discover ASINs
        let createdCount = 0;
        const asinCodesInData = data.map(item => (item.ASIN || item.asin || item.asinCode || '').trim()).filter(Boolean);

        // Bulk find existing ASINs to identify what needs creating
        const existingAsins = await Asin.find({ 
            seller: seller._id, 
            asinCode: { $in: asinCodesInData } 
        });
        const existingCodes = new Set(existingAsins.map(a => a.asinCode));

        // Create new ASINs in bulk if missing
        const newAsinOps = [];
        for (const code of asinCodesInData) {
            if (!existingCodes.has(code)) {
                newAsinOps.push({
                    asinCode: code,
                    seller: seller._id,
                    status: 'Active',
                    scrapeStatus: 'PENDING',
                    marketplace: 'amazon.in'
                });
                createdCount++;
            }
        }

        if (newAsinOps.length > 0) {
            await Asin.insertMany(newAsinOps);
        }

        // 5. High-Performance Bulk Update
        const updatedCount = await octoparseAutomationService.processBatchResults(seller._id, data);

        // Update seller counts and emit socket signal
        await updateSellerAsinCount(seller._id, req.app.get('io'));

        res.json({
            success: true,
            message: `Ingestion complete. Updated ${updatedCount} ASINs, discovered ${createdCount} new ASINs.`,
            executionId: targetExecutionId,
            stats: { 
                totalProcessed: data.length,
                updated: updatedCount,
                newlyCreated: createdCount
            }
        });
    } catch (error) {
        console.error('Ingest Task Results Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to ingest task results: ' + error.message });
    }
};

/**
 * Setup a new Octoparse Sync Task for a seller by duplicating the master template.
 */
exports.setupSellerTask = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const seller = await Seller.findById(sellerId);

        if (!seller) {
            return res.status(404).json({ success: false, error: 'Seller not found' });
        }

        // 1. Attempt Duplicate Task (API Automated)
        const taskName = seller.name;
        console.log(`🤖 Setting up auto-sync task for ${seller.name}...`);
        
        let newTaskId;
        try {
            newTaskId = await octoparseAutomationService.duplicateTask(taskName);
        } catch (dupError) {
            console.warn(`⚠️ Automated duplication failed: ${dupError.message}. Falling back to Pooled Tasks...`);
            
            // 2. Fallback: Assign from Pool
            newTaskId = await octoparseAutomationService.assignTaskFromPool(sellerId);
            
            if (!newTaskId) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Auto-duplication failed and no available tasks in the pool. Please upload more Task IDs to the management pool.' 
                });
            }
        }
        
        // 3. Sync with Seller Model (In case service didn't)
        seller.marketSyncTaskId = newTaskId;
        await seller.save();

        // 4. Initial URL Injection (Fetch active ASINs)
        const asins = await Asin.find({ seller: sellerId, status: 'Active' });
        if (asins.length > 0) {
            const asinUrls = asins.map(a => `https://www.amazon.in/dp/${a.asinCode}`);
            await octoparseAutomationService.updateTaskUrlsWithFile(newTaskId, asinUrls);
            console.log(`✅ Injected ${asinUrls.length} ASIN URLs into new task: ${newTaskId} via FILE method.`);
        }

        res.json({
            success: true,
            message: `Market sync task successfully linked/allocated for ${seller.name}`,
            taskId: newTaskId,
            asinsLinked: asins.length
        });
    } catch (error) {
        console.error('Setup Seller Task Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to setup market sync task: ' + error.message });
    }
};

/**
 * Bulk upload task IDs to the pool.
 */
exports.uploadTaskPool = async (req, res) => {
    try {
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        if (!isGlobalUser) {
            return res.status(403).json({ success: false, error: 'Unauthorized to upload task pool' });
        }

        const { taskIds } = req.body;
        
        if (!taskIds || !Array.isArray(taskIds)) {
            return res.status(400).json({ success: false, error: 'Invalid Task IDs list. Expected an array of strings.' });
        }

        const result = await octoparseAutomationService.importTaskPool(taskIds);
        
        res.json({
            success: true,
            message: `Successfully updated task pool. ${result.added} new tasks added.`,
            stats: result.stats
        });
    } catch (error) {
        console.error('Upload Task Pool Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Get the current status of the task pool.
 */
exports.getPoolStatus = async (req, res) => {
    try {
        const stats = await marketDataSyncService.getPoolStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Global ingestion trigger: Checks and imports results for ALL active sellers in the background.
 */
exports.syncAllSellersResults = async (req, res) => {
    try {
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        if (!isGlobalUser) {
            return res.status(403).json({ success: false, error: 'Unauthorized to trigger global results ingestion' });
        }

        console.log('🗳️ Global ingestion triggered (Fetch all Octoparse results)...');
        
        // Return immediate response but process in background
        const SchedulerService = require('../services/schedulerService');
        
        // Fire and forget background process
        setTimeout(async () => {
            await SchedulerService.runOctoparseResultFetch();
            console.log('✅ Global ingestion cycle finished.');
        }, 0);

        res.json({
            success: true,
            message: 'Global results ingestion initiated in the background'
        });
    } catch (error) {
        console.error('Global Ingest Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to initiate global ingestion' });
    }
};

/**
 * Provide general status of sync capabilities.
 */
exports.getSyncStatus = async (req, res) => {
    try {
        await octoparseAutomationService.authenticate();
        res.json({ success: true, service: 'Operational', provider: 'Connected' });
    } catch (error) {
        res.json({ success: true, service: 'Maintenance', provider: 'Disconnected' });
    }
};

/**
 * Get the status of all sync tasks associated with sellers.
 */
exports.getGlobalSyncTasks = async (req, res) => {
    try {
        const roleName = req.user?.role?.name || req.user?.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const filter = { marketSyncTaskId: { $exists: true, $ne: '' } };
        
        if (!isGlobalUser) {
            const allowedSellerIds = req.user.assignedSellers.map(s => s._id);
            filter._id = { $in: allowedSellerIds };
        }

        const sellers = await Seller.find(filter).select('name marketplace marketSyncTaskId');
        
        if (sellers.length === 0) {
            return res.json({ success: true, tasks: [] });
        }

        const taskIds = [...new Set(sellers.map(s => s.marketSyncTaskId))];
        const statuses = await octoparseAutomationService.getBulkStatuses(taskIds);
        const statusMap = new Map(statuses.map(s => [s.taskId, s]));

        const tasks = await Promise.all(sellers.map(async (seller) => {
            const asinStats = await Asin.aggregate([
                { $match: { seller: seller._id, status: 'Active' } },
                { $group: { 
                    _id: null, 
                    count: { $sum: 1 }, 
                    lastScraped: { $max: '$lastScraped' } 
                }}
            ]);

            const remoteStatus = statusMap.get(seller.marketSyncTaskId);
            
            // Map Octoparse status (1: Running, 0: Stopped/Paused, etc)
            let status = 'IDLE';
            if (remoteStatus) {
                if (remoteStatus.status === 1) status = 'RUNNING';
                else if (remoteStatus.status === 2) status = 'PAUSED';
                else if (remoteStatus.status === 0) status = 'STOPPED';
            }

            return {
                sellerId: seller._id,
                sellerName: seller.name,
                marketplace: seller.marketplace,
                taskId: seller.marketSyncTaskId,
                asinCount: asinStats[0]?.count || 0,
                lastSync: asinStats[0]?.lastScraped || null,
                status: status,
                progress: remoteStatus?.progress || 0
            };
        }));

        res.json({ success: true, tasks });
    } catch (error) {
        console.error('Get Global Sync Tasks Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch sync tasks' });
    }
};

/**
 * Bulk update marketSyncTaskId for multiple sellers.
 * If sellerIds is empty, updates ALL sellers.
 */
/**
 * Bulk create dedicated Octoparse tasks for sellers (via duplication).
 * This replaces the previous shared Task ID model.
 */
exports.bulkUpdateSellerTasks = async (req, res) => {
    try {
        const { sellerIds } = req.body;

        const filter = {};
        if (sellerIds && Array.isArray(sellerIds) && sellerIds.length > 0) {
            filter._id = { $in: sellerIds };
        }

        const targetSellers = await Seller.find(filter).select('_id name marketSyncTaskId');
        if (targetSellers.length === 0) {
            return res.status(404).json({ success: false, error: 'No sellers found.' });
        }

        console.log(`🚀 Starting Dedicated Task Creation for ${targetSellers.length} sellers...`);
        const summary = [];

        for (const seller of targetSellers) {
            try {
                // 1. Duplicate Master Task
                const taskName = seller.name;
                const newTaskId = await octoparseAutomationService.duplicateTask(taskName);

                // 2. Save Task ID to Seller
                seller.marketSyncTaskId = newTaskId;
                await seller.save();

                // 3. Auto-inject ASINs
                const asins = await Asin.find({ seller: seller._id, status: 'Active' }).select('asinCode');
                let injectStatus = 'No ASINs';
                
                if (asins.length > 0) {
                    const asinUrls = asins.map(a => `https://www.amazon.in/dp/${a.asinCode}`);
                    try {
                        await octoparseAutomationService.updateTaskUrlsWithFile(newTaskId, asinUrls);
                        injectStatus = 'Success';
                    } catch (fileErr) {
                        console.error(`❌ File injection failed for ${seller.name}:`, fileErr.message);
                        injectStatus = 'Failed';
                    }
                }

                summary.push({ seller: seller.name, taskId: newTaskId, status: 'Created', injection: injectStatus });
            } catch (err) {
                console.error(`❌ Duplication failed for ${seller.name}:`, err.message);
                summary.push({ seller: seller.name, status: 'Failed', error: err.message });
            }
        }

        res.json({
            success: true,
            message: `Processed task creation for ${targetSellers.length} sellers.`,
            summary
        });
    } catch (error) {
        console.error('Bulk Task Duplication Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Start a specific Octoparse task.
 */
exports.startTask = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const seller = await Seller.findById(sellerId);
        
        if (!seller || !seller.marketSyncTaskId) {
            return res.status(400).json({ success: false, error: 'Seller has no Task ID assigned.' });
        }

        const result = await octoparseAutomationService.startCloudExtraction(seller.marketSyncTaskId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Fetch and map results for a specific task/seller.
 */
exports.syncResults = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const seller = await Seller.findById(sellerId);
        
        if (!seller || !seller.marketSyncTaskId) {
            return res.status(400).json({ success: false, error: 'Seller has no Task ID assigned.' });
        }

        // 1. Fetch results from Octoparse
        const results = await octoparseAutomationService.fetchTaskResults(seller.marketSyncTaskId);
        
        if (!results || results.length === 0) {
            return res.json({ success: true, message: 'No new records found in Octoparse.', count: 0 });
        }

        // 2. Map results to dashboard
        const mappingResult = await octoparseAutomationService.processAndMapResults(sellerId, results);

        // 3. Update seller status
        seller.lastScraped = new Date();
        await seller.save();

        res.json({ 
            success: true, 
            message: `Successfully synced ${mappingResult.count} records.`, 
            count: mappingResult.count 
        });

        // Trigger real-time count update on Sellers page after sync completes
        updateSellerAsinCount(sellerId, req.app.get('io')).catch(e => console.error('Error in post-sync count update:', e));
    } catch (error) {
        console.error('❌ Results Sync Error:', error.message);
        
        // Handle common Octoparse "Not Found" as a success state meaning "No Data available right now"
        if (error.message && error.message.includes('404')) {
            return res.json({ 
                success: true, 
                message: 'No unexported data available in Octoparse for this task (Status 404).',
                count: 0
            });
        }
        res.status(500).json({ success: false, error: 'Failed to sync results: ' + error.message });
    }
};

/**
 * Bulk inject ASIN URLs into associated Octoparse tasks for all/selected sellers.
 */
exports.bulkInjectAsinsToTasks = async (req, res) => {
    try {
        const { sellerIds } = req.body;

        // 1. Identify Target Sellers
        const filter = { marketSyncTaskId: { $exists: true, $ne: '' } };
        if (sellerIds && Array.isArray(sellerIds) && sellerIds.length > 0) {
            filter._id = { $in: sellerIds };
        }

        const sellers = await Seller.find(filter).select('name marketSyncTaskId');
        if (sellers.length === 0) {
            return res.status(404).json({ success: false, error: 'No sellers with assigned Task IDs found.' });
        }

        console.log(`🚀 Starting bulk ASIN injection for ${sellers.length} sellers...`);

        // 2. Process Sellers
        const summary = [];
        for (const seller of sellers) {
            try {
                const asins = await Asin.find({ 
                    seller: seller._id, 
                    status: 'Active' 
                }).select('asinCode');

                if (asins.length === 0) {
                    summary.push({ seller: seller.name, status: 'No ASINs found', count: 0 });
                    continue;
                }

                const asinUrls = asins.map(a => `https://www.amazon.in/dp/${a.asinCode}`);
                
                let success = false;
                let methodUsed = 'File-based';
                
                try {
                    success = await octoparseAutomationService.updateTaskUrlsWithFile(seller.marketSyncTaskId, asinUrls);
                } catch (fileErr) {
                    console.error(`❌ Bulk file injection failed for ${seller.name}:`, fileErr.message);
                    success = false;
                }

                summary.push({ 
                    seller: seller.name, 
                    taskId: seller.marketSyncTaskId, 
                    status: success ? 'Success' : 'Failed', 
                    asinCount: asins.length,
                    method: methodUsed
                });

            } catch (err) {
                console.error(`❌ ASIN Injection failed for ${seller.name}:`, err.message);
                summary.push({ seller: seller.name, status: 'Error', error: err.message });
            }
        }

        res.json({
            success: true,
            message: `Bulk ASIN injection processed for ${sellers.length} sellers.`,
            summary
        });

    } catch (error) {
        console.error('Bulk ASIN Injection Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Bulk inject raw JSON results from Octoparse into the dashboard.
 */
exports.bulkInjectJson = async (req, res) => {
    try {
        const { data, sellerId } = req.body;

        if (!data || !Array.isArray(data)) {
            return res.status(400).json({ success: false, error: 'Data array required' });
        }

        if (!sellerId) {
            return res.status(400).json({ success: false, error: 'Seller ID required' });
        }

        const seller = await Seller.findById(sellerId);
        if (!seller) {
            return res.status(404).json({ success: false, error: 'Seller not found' });
        }

        // Process and map results using the existing robust mapping service
        const mappingResult = await marketDataSyncService.processAndMapResults(sellerId, data);

        // Update seller last scraped
        seller.lastScraped = new Date();
        await seller.save();

        res.json({
            success: true,
            message: `Successfully injected ${mappingResult.count} records manually.`,
            count: mappingResult.count,
            stats: mappingResult.stats
        });
    } catch (error) {
        console.error('Manual JSON Ingestion Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
/**
 * Manually trigger the global database integrity repair process.
 */
exports.triggerRepair = async (req, res) => {
    try {
        const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
        if (!isAdmin) {
            return res.status(403).json({ success: false, error: 'Only admins can trigger global repair' });
        }

        const result = await octoparseAutomationService.runBackgroundDatabaseRepair();
        
        res.json({
            success: true,
            message: 'Global database integrity repair initiated',
            details: result
        });
    } catch (error) {
        console.error('Manual Repair Trigger Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to trigger repair: ' + error.message });
    }
};
