const { sql, getPool } = require('../database/db');
const marketDataSyncService = require('../services/marketDataSyncService');
const { updateSellerAsinCount } = require('./asinController');

/**
 * Controller for discreet Market Data Synchronization.
 */
exports.syncAsin = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        // 1. Fetch ASIN with Seller info
        const asinResult = await pool.request()
            .input('id', sql.VarChar, id)
            .query(`
                SELECT A.*, S.Name as SellerName, S.OctoparseId 
                FROM Asins A
                LEFT JOIN Sellers S ON A.SellerId = S.Id
                WHERE A.Id = @id
            `);

        const asin = asinResult.recordset[0];
        if (!asin) {
            return res.status(404).json({ success: false, error: 'ASIN not found' });
        }

        // 2. Security check
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const isAssigned = req.user && req.user.assignedSellers.includes(asin.SellerId);

        if (!isGlobalUser && !isAssigned && asin.SellerId) {
            return res.status(403).json({ success: false, error: 'Unauthorized access to ASIN sync' });
        }

        const taskId = asin.OctoparseId;

        // 3. Check if sync already in progress
        if (asin.ScrapeStatus === 'SCRAPING') {
            return res.status(400).json({ success: false, error: 'Sync already in progress' });
        }

        // 4. Update status to scraping in SQL
        await pool.request()
            .input('id', sql.VarChar, id)
            .query("UPDATE Asins SET ScrapeStatus = 'SCRAPING', Status = 'Scraping', UpdatedAt = GETDATE() WHERE Id = @id");

        const isConfigured = marketDataSyncService.isConfigured();
        const automationEnabled = process.env.AUTOMATION_ENABLED === 'true';
        let useDirect = (!taskId || !isConfigured) && !automationEnabled;

        // Silent decision log

        if (!useDirect) {
            try {
                // Option A: Use Octoparse (Managed Task)
                // Silent sync start
                
                // Trigger batch sync logic (which handles URL injection and scrape start)
                const syncStarted = await marketDataSyncService.syncSellerAsinsToOctoparse(asin.SellerId, { triggerScrape: true });

                if (!syncStarted) {
                    throw new Error('Failed to start sync via automated service');
                }

                return res.json({
                    success: true,
                    message: 'Market data sync initiated and automated monitoring started (Octoparse)',
                    status: 'SCRAPING'
                });
            } catch (octoError) {
                console.error(`❌ Octoparse Sync failed for ${asin.AsinCode}:`, octoError.message);
                
                // Revert status if sync fails
                await pool.request()
                    .input('id', sql.VarChar, id)
                    .query("UPDATE Asins SET ScrapeStatus = 'FAILED', Status = 'Error', UpdatedAt = GETDATE() WHERE Id = @id");

                return res.status(400).json({ 
                    success: false, 
                    error: 'Octoparse Sync failed: ' + octoError.message
                });
            }
        } else {
            // Fallback or direct sync not implemented here, use manual upload
            return res.status(400).json({ 
                success: false, 
                error: 'Octoparse is not configured and direct sync is disabled.' 
            });
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
        const updatedAsin = await marketDataSyncService.updateAsinMetrics(asinId, rawData);

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
        const pool = await getPool();

        // 1. Fetch Seller
        const sellerResult = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query("SELECT * FROM Sellers WHERE Id = @id");

        const seller = sellerResult.recordset[0];
        if (!seller) {
            return res.status(404).json({ success: false, error: 'Seller not found' });
        }

        // 2. Security check
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        const isAssigned = req.user && req.user.assignedSellers.includes(sellerId);

        if (!isGlobalUser && !isAssigned) {
            return res.status(403).json({ success: false, error: 'Unauthorized to trigger sync for this seller' });
        }

        // 3. Update ASIN statuses in bulk
        await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query("UPDATE Asins SET ScrapeStatus = 'SCRAPING', Status = 'Scraping', UpdatedAt = GETDATE() WHERE SellerId = @sellerId AND Status = 'Active'");

        const isConfigured = marketDataSyncService.isConfigured();
        const automationEnabled = process.env.AUTOMATION_ENABLED === 'true';
        let useDirect = (!seller.OctoparseId || !isConfigured) && !automationEnabled;

        // Silent decision log

        if (!useDirect) {
            try {
                // Silent sync start
                const fullSync = req.body.fullSync === true || req.query.fullSync === 'true';

                const syncStarted = await marketDataSyncService.syncSellerAsinsToOctoparse(sellerId, { 
                    triggerScrape: true,
                    fullSync: fullSync
                });

                if (!syncStarted) {
                    throw new Error('Automated sync service failed to initialize');
                }

                return res.json({
                    success: true,
                    message: `Batch sync initiated and background monitoring started for active ASINs`,
                });
            } catch (octoError) {
                console.error(`❌ Octoparse Batch Sync failed for ${seller.Name}:`, octoError.message);
                
                // Revert status
                await pool.request()
                    .input('sellerId', sql.VarChar, sellerId)
                    .query("UPDATE Asins SET ScrapeStatus = 'FAILED', Status = 'Error', UpdatedAt = GETDATE() WHERE SellerId = @sellerId AND ScrapeStatus = 'SCRAPING'");

                return res.status(400).json({ 
                    success: false, 
                    error: 'Octoparse Batch Sync failed: ' + octoError.message
                });
            }
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Octoparse is not configured.' 
            });
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
    // Silent entry
    try {
        const pool = await getPool();
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

        // 1. Fetch Active ASINs for assigned sellers
        let asinsQuery = "SELECT Id, SellerId FROM Asins WHERE Status = 'Active'";
        if (!isGlobalUser) {
            const sellerIdsStr = req.user.assignedSellers.map(id => `'${id}'`).join(',');
            if (sellerIdsStr) {
                asinsQuery += ` AND SellerId IN (${sellerIdsStr})`;
            } else {
                return res.json({ success: true, message: 'No active ASINs to sync (no assigned sellers)' });
            }
        }

        const asinsResult = await pool.request().query(asinsQuery);
        const asins = asinsResult.recordset;

        if (asins.length === 0) {
            return res.json({ success: true, message: 'No active ASINs to sync' });
        }

        // 2. Update ASIN statuses in bulk
        const asinIdsStr = asins.map(a => `'${a.Id}'`).join(',');
        await pool.request().query(`UPDATE Asins SET ScrapeStatus = 'SCRAPING', Status = 'Scraping', UpdatedAt = GETDATE() WHERE Id IN (${asinIdsStr})`);

        // 3. Process Sellers in background (Bulk sync approach)
        const sellerIds = [...new Set(asins.map(a => a.SellerId).filter(Boolean))];
        
        // Force-Clear any stale locks for these specific sellers
        sellerIds.forEach(id => marketDataSyncService.syncLocks.delete(id.toString()));
        console.log(`🧹 Cleared status locks for ${sellerIds.length} sellers to allow fresh sync.`);
        // Silent global sync

        // Fire and forget background process
        setTimeout(async () => {
            // TRUE PARALLEL: Fire ALL task triggers simultaneously without waiting
            console.log(`🚀 Starting ALL ${sellerIds.length} Octoparse tasks simultaneously...`);
            
            const triggerPromises = sellerIds.map(async (sellerId) => {
                try {
                    await marketDataSyncService.syncSellerAsinsToOctoparse(sellerId, { 
                        fullSync: true,
                        forceReRun: true,
                        triggerScrape: true
                    });
                    console.log(`✅ Task triggered for seller ${sellerId}`);
                    return { sellerId, success: true };
                } catch (err) {
                    console.error(`❌ Task trigger failed for seller ${sellerId}:`, err.message);
                    return { sellerId, success: false, error: err.message };
                }
            });

            await Promise.all(triggerPromises);
            // Silent trigger completion
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
        const pool = await getPool();

        // 1. Fetch Seller
        const sellerResult = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query("SELECT OctoparseId FROM Sellers WHERE Id = @id");

        const seller = sellerResult.recordset[0];
        if (!seller || !seller.OctoparseId) {
            return res.status(404).json({ success: false, error: 'Seller or Sync Task not found' });
        }

        // 2. Retrieve results from Octoparse
        const data = await marketDataSyncService.retrieveResults(seller.OctoparseId);

        if (!data || data.length === 0) {
            return res.json({ success: true, message: 'No new data found from provider' });
        }

        // 3. Process batch results
        const updatedCount = await marketDataSyncService.processBatchResults(sellerId, data);
        
        // Update seller counts
        await updateSellerAsinCount(sellerId);

        res.json({
            success: true,
            message: `Processed ${data.length} items, updated ${updatedCount} ASINs via high-performance bulk link.`,
            count: updatedCount
        });
    } catch (error) {
        console.error('Fetch Results Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch and apply results: ' + error.message });
    }
};

/**
 * Ingest all results from a specific task or latest task execution.
 * This is used for bulk discovery and adding new ASINs.
 */
exports.ingestTaskResults = async (req, res) => {
    try {
        const { taskId, executionId, sellerId } = req.body;
        const pool = await getPool();

        if (!taskId && !executionId) {
            return res.status(400).json({ success: false, error: 'Task ID or Execution ID required' });
        }

        // 1. Identify Seller
        let seller;
        if (sellerId) {
            const result = await pool.request()
                .input('id', sql.VarChar, sellerId)
                .query("SELECT * FROM Sellers WHERE Id = @id");
            seller = result.recordset[0];
        } else if (taskId) {
            const result = await pool.request()
                .input('taskId', sql.NVarChar, taskId)
                .query("SELECT * FROM Sellers WHERE OctoparseId = @taskId");
            seller = result.recordset[0];
        }

        if (!seller) {
            return res.status(404).json({ success: false, error: 'Target Seller not found for this task' });
        }

        // 2. Resolve Execution ID
        let targetExecutionId = executionId;
        if (!targetExecutionId && (taskId || seller.OctoparseId)) {
            // Silent execution lookup
            targetExecutionId = await marketDataSyncService.getLatestExecutionId(taskId || seller.OctoparseId);
        }

        if (!targetExecutionId) {
            return res.status(404).json({ success: false, error: 'No execution ID found for this task' });
        }

        // 3. Fetch Data
        // Silent ingestion
        const data = await marketDataSyncService.retrieveResults(taskId || seller.OctoparseId, targetExecutionId);

        if (!data || data.length === 0) {
            return res.json({ success: true, message: 'No data found in execution', count: 0 });
        }

        // 4. Process & Discover ASINs
        const updatedCount = await marketDataSyncService.processBatchResults(seller.Id, data);
        
        res.json({
            success: true,
            message: `Successfully processed ${data.length} records and updated ${updatedCount} existing ASINs.`,
            count: updatedCount
        });
    } catch (error) {
        console.error('Ingest Results Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to ingest results: ' + error.message });
    }
};

/**
 * Setup a new Octoparse Sync Task for a seller by duplicating the master template.
 */
exports.setupSellerTask = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const pool = await getPool();

        const sellerResult = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query("SELECT * FROM Sellers WHERE Id = @id");

        const seller = sellerResult.recordset[0];
        if (!seller) {
            return res.status(404).json({ success: false, error: 'Seller not found' });
        }

        // 1. Assign from Pool (Fallback to duplication if pool empty - but pool is preferred now)
        console.log(`🤖 Setting up auto-sync task for ${seller.Name}...`);
        
        let newTaskId = await marketDataSyncService.assignTaskFromPool(sellerId);
        
        if (!newTaskId) {
            // Attempt Duplication
            try {
                newTaskId = await marketDataSyncService.duplicateTask(seller.Name);
                
                // Update Seller with Task ID
                await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .input('taskId', sql.NVarChar, newTaskId)
                    .query("UPDATE Sellers SET OctoparseId = @taskId WHERE Id = @id");
            } catch (dupError) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Auto-duplication failed and no available tasks in the pool. Please upload more Task IDs to the management pool.' 
                });
            }
        }
        
        // 2. Initial URL Injection (Fetch active ASINs)
        const asinsResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND Status = 'Active'");
        
        const asins = asinsResult.recordset;
        if (asins.length > 0) {
            const asinUrls = asins.map(a => `https://www.amazon.in/dp/${a.AsinCode}`);
            await marketDataSyncService.updateTaskUrlsWithFile(newTaskId, asinUrls);
            console.log(`✅ Injected ${asinUrls.length} ASIN URLs into new task: ${newTaskId}`);
        }

        res.json({
            success: true,
            message: `Market sync task successfully linked/allocated for ${seller.Name}`,
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
        const userRole = req.user.role?.Name || req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        if (!isGlobalUser) {
            return res.status(403).json({ success: false, error: 'Unauthorized to upload task pool' });
        }

        const { taskIds } = req.body;
        
        if (!taskIds || !Array.isArray(taskIds)) {
            return res.status(400).json({ success: false, error: 'Invalid Task IDs list. Expected an array of strings.' });
        }

        const result = await marketDataSyncService.importTaskPool(taskIds);
        
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
        const result = await marketDataSyncService.runBackgroundDatabaseRepair();
        res.json({ success: true, message: 'Database repair completed', result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Trigger concurrent recovery for ASINs with missing critical data.
 */
exports.recoverMissingData = async (req, res) => {
    try {
        const userRole = req.user.role?.Name || req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        if (!isGlobalUser) {
            return res.status(403).json({ success: false, error: 'Unauthorized to trigger missing data recovery' });
        }

        console.log('🔍 Manual trigger: Missing Data Recovery...');
        const SchedulerService = require('../services/schedulerService');
        
        // Fire and forget background process
        setTimeout(async () => {
            await SchedulerService.runMissingDataRecovery();
        }, 0);

        res.json({
            success: true,
            message: 'Concurrent missing data recovery initiated in the background'
        });
    } catch (error) {
        console.error('Missing Data Recovery Trigger Error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to initiate recovery' });
    }
};

/**
 * Global ingestion trigger: Checks and imports results for ALL active sellers in the background.
 */
exports.syncAllSellersResults = async (req, res) => {
    try {
        const userRole = req.user.role?.Name || req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        if (!isGlobalUser) {
            return res.status(403).json({ success: false, error: 'Unauthorized to trigger global results ingestion' });
        }

        console.log('🗳️ Global ingestion triggered (Fetch all Octoparse results)...');
        
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
        await marketDataSyncService.authenticate();
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
        const pool = await getPool();
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
        
        let query = "SELECT Id, Name, Marketplace, OctoparseId FROM Sellers WHERE OctoparseId IS NOT NULL AND OctoparseId <> ''";
        if (!isGlobalUser) {
            const sellerIdsStr = req.user.assignedSellers.map(id => `'${id}'`).join(',');
            if (sellerIdsStr) {
                query += ` AND Id IN (${sellerIdsStr})`;
            } else {
                return res.json({ success: true, tasks: [] });
            }
        }

        const sellersResult = await pool.request().query(query);
        const sellers = sellersResult.recordset;
        
        if (sellers.length === 0) {
            return res.json({ success: true, tasks: [] });
        }

        const taskIds = [...new Set(sellers.map(s => s.OctoparseId))];
        const statuses = await marketDataSyncService.getBulkStatuses(taskIds);
        const statusMap = new Map(statuses.map(s => [s.taskId, s]));

        const tasks = await Promise.all(sellers.map(async (seller) => {
            const asinStatsResult = await pool.request()
                .input('sellerId', sql.VarChar, seller.Id)
                .query(`
                    SELECT 
                        COUNT(*) as count, 
                        MAX(LastScraped) as lastScraped 
                    FROM Asins 
                    WHERE SellerId = @sellerId AND Status = 'Active'
                `);
            const asinStats = asinStatsResult.recordset[0];

            const remoteStatus = statusMap.get(seller.OctoparseId);
            
            // Map Octoparse status (1: Running, 0: Stopped/Paused, etc)
            let status = 'IDLE';
            if (remoteStatus) {
                if (remoteStatus.status === 1) status = 'RUNNING';
                else if (remoteStatus.status === 2) status = 'PAUSED';
                else if (remoteStatus.status === 0) status = 'STOPPED';
            }

            return {
                sellerId: seller.Id,
                sellerName: seller.Name,
                marketplace: seller.Marketplace,
                taskId: seller.OctoparseId,
                asinCount: asinStats?.count || 0,
                lastSync: asinStats?.lastScraped || null,
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
 * Bulk create/update dedicated Octoparse tasks for sellers.
 */
exports.bulkUpdateSellerTasks = async (req, res) => {
    try {
        const { sellerIds } = req.body;
        const pool = await getPool();

        let query = "SELECT Id, Name, OctoparseId FROM Sellers";
        if (sellerIds && Array.isArray(sellerIds) && sellerIds.length > 0) {
            const sellerIdsStr = sellerIds.map(id => `'${id}'`).join(',');
            query += ` WHERE Id IN (${sellerIdsStr})`;
        }

        const sellersResult = await pool.request().query(query);
        const targetSellers = sellersResult.recordset;

        if (targetSellers.length === 0) {
            return res.status(404).json({ success: false, error: 'No sellers found.' });
        }

        console.log(`🚀 Starting Dedicated Task Creation for ${targetSellers.length} sellers...`);
        const summary = [];

        for (const seller of targetSellers) {
            try {
                // 1. Assign from Pool or Duplicate
                let newTaskId = await marketDataSyncService.assignTaskFromPool(seller.Id);
                if (!newTaskId) {
                    newTaskId = await marketDataSyncService.duplicateTask(seller.Name);
                    
                    await pool.request()
                        .input('id', sql.VarChar, seller.Id)
                        .input('taskId', sql.NVarChar, newTaskId)
                        .query("UPDATE Sellers SET OctoparseId = @taskId WHERE Id = @id");
                }

                // 2. Auto-inject ASINs
                const asinsResult = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND Status = 'Active'");
                
                const asins = asinsResult.recordset;
                let injectStatus = 'No ASINs';
                
                if (asins.length > 0) {
                    const asinUrls = asins.map(a => `https://www.amazon.in/dp/${a.AsinCode}`);
                    await marketDataSyncService.updateTaskUrlsWithFile(newTaskId, asinUrls);
                    injectStatus = 'Success';
                }

                summary.push({ seller: seller.Name, taskId: newTaskId, status: 'Created', injection: injectStatus });
            } catch (err) {
                console.error(`❌ Setup failed for ${seller.Name}:`, err.message);
                summary.push({ seller: seller.Name, status: 'Failed', error: err.message });
            }
        }

        res.json({
            success: true,
            message: `Processed task setup for ${targetSellers.length} sellers.`,
            summary
        });
    } catch (error) {
        console.error('Bulk Task Setup Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Start a specific Octoparse task.
 */
exports.startTask = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query("SELECT OctoparseId FROM Sellers WHERE Id = @id");
        
        const seller = result.recordset[0];
        if (!seller || !seller.OctoparseId) {
            return res.status(400).json({ success: false, error: 'Seller has no Task ID assigned.' });
        }

        const startResult = await marketDataSyncService.startCloudExtraction(seller.OctoparseId);
        res.json({ success: true, data: startResult });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Bulk inject ASIN URLs into associated Octoparse tasks.
 */
exports.bulkInjectAsinsToTasks = async (req, res) => {
    try {
        const { sellerIds } = req.body;
        const pool = await getPool();

        let query = "SELECT Id, Name, OctoparseId FROM Sellers WHERE OctoparseId IS NOT NULL AND OctoparseId <> ''";
        if (sellerIds && Array.isArray(sellerIds) && sellerIds.length > 0) {
            const sellerIdsStr = sellerIds.map(id => `'${id}'`).join(',');
            query += ` AND Id IN (${sellerIdsStr})`;
        }

        const sellersResult = await pool.request().query(query);
        const sellers = sellersResult.recordset;

        if (sellers.length === 0) {
            return res.status(404).json({ success: false, error: 'No sellers with assigned Task IDs found.' });
        }

        console.log(`🚀 Starting bulk ASIN injection for ${sellers.length} sellers...`);

        const summary = [];
        for (const seller of sellers) {
            try {
                const asinsResult = await pool.request()
                    .input('sellerId', sql.VarChar, seller.Id)
                    .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND Status = 'Active'");
                
                const asins = asinsResult.recordset;

                if (asins.length === 0) {
                    summary.push({ seller: seller.Name, status: 'No ASINs found', count: 0 });
                    continue;
                }

                const asinUrls = asins.map(a => `https://www.amazon.in/dp/${a.AsinCode}`);
                await marketDataSyncService.updateTaskUrlsWithFile(seller.OctoparseId, asinUrls);

                summary.push({ 
                    seller: seller.Name, 
                    taskId: seller.OctoparseId, 
                    status: 'Success', 
                    asinCount: asins.length
                });

            } catch (err) {
                console.error(`❌ ASIN Injection failed for ${seller.Name}:`, err.message);
                summary.push({ seller: seller.Name, status: 'Error', error: err.message });
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

        const updatedCount = await marketDataSyncService.processBatchResults(sellerId, data);
        await updateSellerAsinCount(sellerId);

        res.json({
            success: true,
            message: `Successfully injected ${data.length} records manually. Updated ${updatedCount} ASINs.`,
            count: updatedCount
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
        const roleName = req.user?.role?.Name || req.user?.role?.name || req.user?.role;
        if (roleName !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only admins can trigger global repair' });
        }

        const result = await marketDataSyncService.runBackgroundDatabaseRepair();
        
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
