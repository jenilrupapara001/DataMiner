const cron = require('node-cron');
const { sql, getPool } = require('../database/db');
const MarketSyncService = require('./marketDataSyncService');
const { syncSellerFromKeepaInternal } = require('../controllers/sellerAsinTrackerController');

/**
 * Scheduler Service
 * Manages background jobs for the dashboard.
 */
class SchedulerService {
    constructor() {
        this.jobs = {};
    }

    /**
     * Initialize all scheduled jobs
     */
    init() {
        const now = new Date();
        console.log(`🗓️ Initializing Background Scheduler at ${now.toISOString()} (${now.toString()})...`);

        // 1. Keepa ASIN Sync (Every 12 hours)
        this.jobs.keepaSync = cron.schedule('0 */12 * * *', async () => {
            console.log('🕒 Starting Scheduled Keepa ASIN Sync...');
            await this.runKeepaSync();
        });

        // 2. Enterprise Octoparse Pipeline
        const scheduleTime = process.env.AUTOMATION_SCHEDULE_TIME || '00:00';
        const [scheduleHour, scheduleMinute] = scheduleTime.split(':');
        const cronExpr = `${scheduleMinute || 0} ${scheduleHour || 0} * * *`;
        
        if (process.env.AUTOMATION_ENABLED !== 'false') {
            this.jobs.enterprisePipeline = cron.schedule(cronExpr, async () => {
                console.log('🏢 Starting Enterprise Octoparse Automation Pipeline...');
                await this.runEnterprisePipeline();
            });
            console.log(`🏢 Enterprise Pipeline scheduled at ${scheduleTime}`);
        }

        // 4. Octoparse Daily 1 PM Sync
        this.jobs.daily1PMSync = cron.schedule('0 13 * * *', async () => {
            console.log('🕒 Starting Daily 1 PM Octoparse Enterprise Pipeline...');
            await this.runEnterprisePipeline();
        });

        // 6. Database Integrity Repair (Every 6 hours)
        this.jobs.integrityRepair = cron.schedule('0 */6 * * *', async () => {
            console.log('🕒 Starting Global Database Integrity Repair Check...');
            // Logic for repair is currently being moved to MarketSyncService
            console.log('ℹ️ Repair task skipped (Refactoring in progress)');
        });

        console.log('✅ Background tasks scheduled');

        // Optional: Run once on startup
        setTimeout(() => {
            console.log('🚀 Running initial Keepa sync on startup...');
            this.runKeepaSync().catch(err => console.error('Startup Keepa sync failed:', err.message));
            
            console.log('🔄 Checking Octoparse tasks on startup...');
            this.runOctoparseTaskRecovery().catch(err => console.error('Startup Octoparse recovery failed:', err.message));
        }, 30000); // 30 second delay
    }

    async runOctoparseTaskRecovery() {
        console.log('🔄 [RECOVERY] Starting Octoparse task status check on startup...');
        
        try {
            const pool = await getPool();
            const sellersResult = await pool.request()
                .query("SELECT * FROM Sellers WHERE IsActive = 1 AND OctoparseId IS NOT NULL AND OctoparseId != ''");
            const sellers = sellersResult.recordset;

            console.log(`🔄 [RECOVERY] Found ${sellers.length} sellers - running with concurrency limit...`);
            
            const CONCURRENCY_LIMIT = 3;
            const results = [];
            
            for (let i = 0; i < sellers.length; i += CONCURRENCY_LIMIT) {
                const batch = sellers.slice(i, i + CONCURRENCY_LIMIT);
                
                const batchResults = await Promise.all(batch.map(async (seller) => {
                    try {
                        const taskId = seller.OctoparseId;
                        console.log(`🔄 [RECOVERY] Checking task ${taskId} for seller ${seller.Name}...`);
                        
                        const status = await MarketSyncService.getStatus(taskId);
                    
                        if (!status) {
                            console.log(`⚠️ [RECOVERY] Could not get status for task ${taskId}`);
                            return { seller, success: false, reason: 'No status' };
                        }

                        const taskStatus = typeof status.status === 'string' ? status.status.toLowerCase() : status.status;
                        // Octoparse status can be numbers (1: Running, 0: Stopped)
                        if (taskStatus === 'finished' || taskStatus === 'stopped' || taskStatus === 'idle' || taskStatus === 0) {
                            console.log(`📥 [RECOVERY] Fetching data for completed/idle task ${taskId}...`);
                            
                            const rawData = await MarketSyncService.retrieveResults(taskId);
                            if (rawData && rawData.length > 0) {
                                const processedCount = await MarketSyncService.processBatchResults(seller.Id, rawData);
                                console.log(`✅ [RECOVERY] Saved ${processedCount} ASINs for seller ${seller.Name}`);
                                
                                return { seller, success: true, count: processedCount };
                            }
                        }
                        return { seller, success: true, status: taskStatus };
                    } catch (err) {
                        console.error(`❌ [RECOVERY] Failed to check task for seller ${seller.Name}:`, err.message);
                        return { seller, success: false, error: err.message };
                    }
                }));
                
                results.push(...batchResults);
            }
            
            console.log(`✅ [RECOVERY] Initial check completed: ${results.filter(r => r.success).length}/${sellers.length} sellers`);
        } catch (error) {
            console.error('❌ [RECOVERY] Critical error:', error.message);
        }
    }

    async runEnterprisePipeline() {
        console.log('🏢 [ENTERPRISE] Starting full automation pipeline...');
        try {
            const pool = await getPool();
            const sellersResult = await pool.request()
                .query("SELECT * FROM Sellers WHERE IsActive = 1 AND OctoparseId IS NOT NULL AND OctoparseId != ''");
            const sellers = sellersResult.recordset;

            console.log(`🏢 [ENTERPRISE] Found ${sellers.length} active sellers for sync.`);
            
            let successful = 0;
            const startTime = Date.now();

            for (const seller of sellers) {
                try {
                    await MarketSyncService.syncSellerAsinsToOctoparse(seller.Id, { 
                        triggerScrape: true,
                        fullSync: true 
                    });
                    successful++;
                    console.log(`✅ [ENTERPRISE] Triggered sync for ${seller.Name}`);
                } catch (err) {
                    console.error(`❌ [ENTERPRISE] Failed to trigger sync for ${seller.Name}:`, err.message);
                }
                // Throttling to avoid provider rate limits
                await new Promise(r => setTimeout(r, 2000));
            }

            const duration = Math.round((Date.now() - startTime) / 1000);
            const result = {
                totalSellers: sellers.length,
                successful,
                duration: `${duration}s`
            };

            console.log('🏢 [ENTERPRISE] Pipeline completed:', result);

            // Create notification for admin
            try {
                const adminsResult = await pool.request()
                    .query("SELECT Id FROM Users WHERE Role = 'admin' OR Role IN (SELECT Id FROM Roles WHERE Name = 'admin')");
                
                const { createNotification } = require('../controllers/notificationController');
                for (const admin of adminsResult.recordset) {
                    await createNotification(
                        admin.Id,
                        'SYSTEM',
                        'System',
                        admin.Id,
                        `🏢 Enterprise Pipeline: ${result.successful}/${result.totalSellers} sellers synced in ${result.duration}`
                    );
                }
            } catch (notifErr) {
                console.error('Failed to create notification:', notifErr.message);
            }

            return result;
        } catch (error) {
            console.error('🏢 [ENTERPRISE] Pipeline failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    async runKeepaSync() {
        try {
            const pool = await getPool();
            const sellersResult = await pool.request().query("SELECT * FROM Sellers WHERE IsActive = 1");
            const sellers = sellersResult.recordset;

            console.log(`[Scheduler] syncing ${sellers.length} sellers...`);

            const { createNotification } = require('../controllers/notificationController');
            const adminsResult = await pool.request()
                .query("SELECT Id FROM Users WHERE Role = 'admin' OR Role IN (SELECT Id FROM Roles WHERE Name = 'admin')");
            const admins = adminsResult.recordset;

            for (const seller of sellers) {
                try {
                    const result = await syncSellerFromKeepaInternal(seller);
                    if (result.added > 0) {
                        console.log(`[Scheduler] ✅ Added ${result.added} new ASINs for ${seller.Name}`);

                        for (const admin of admins) {
                            await createNotification(
                                admin.Id,
                                'SYSTEM',
                                'System',
                                admin.Id,
                                `🚀 Keepa Sync: Found ${result.added} new ASINs for ${seller.Name}`
                            );
                        }
                    }
                } catch (err) {
                    console.error(`[Scheduler] ❌ Failed to sync seller ${seller.Name}:`, err.message);
                }
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            console.log('[Scheduler] Scheduled Keepa sync completed.');
        } catch (error) {
            console.error('[Scheduler] Critical sync error:', error.message);
        }
    }

    async runOctoparseTrigger() {
        try {
            const pool = await getPool();
            const sellersResult = await pool.request()
                .query("SELECT * FROM Sellers WHERE IsActive = 1 AND OctoparseId IS NOT NULL AND OctoparseId != ''");
            const sellers = sellersResult.recordset;

            console.log(`[Scheduler] 🚀 Starting Nightly Octoparse Sync for ${sellers.length} sellers...`);

            const BATCH_SIZE = 5;
            for (let i = 0; i < sellers.length; i += BATCH_SIZE) {
                const batch = sellers.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (seller) => {
                    try {
                        console.log(`[Scheduler] 🤖 Launching sync for ${seller.Name}...`);
                        await MarketSyncService.syncSellerAsinsToOctoparse(seller.Id, { triggerScrape: true });
                    } catch (err) {
                        console.error(`[Scheduler] ❌ Failed to trigger Octoparse for seller ${seller.Name}:`, err.message);
                    }
                }));
                if (i + BATCH_SIZE < sellers.length) await new Promise(resolve => setTimeout(resolve, 5000));
            }
        } catch (error) {
            console.error('[Scheduler] Critical Octoparse Trigger error:', error.message);
        }
    }

    async runOctoparseResultFetch() {
        try {
            const pool = await getPool();
            const sellersResult = await pool.request()
                .query("SELECT * FROM Sellers WHERE IsActive = 1 AND OctoparseId IS NOT NULL AND OctoparseId != ''");
            const sellers = sellersResult.recordset;

            for (const seller of sellers) {
                try {
                    const rawData = await MarketSyncService.retrieveResults(seller.OctoparseId);
                    if (rawData && rawData.length > 0) {
                        const processedCount = await MarketSyncService.processBatchResults(seller.Id, rawData);
                        console.log(`[Scheduler] ✅ Successfully bulk-linked ${processedCount} results for ${seller.Name}`);
                    }
                } catch (err) {
                    console.error(`[Scheduler] ❌ Failed to fetch result for ${seller.Name}:`, err.message);
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error('[Scheduler] Critical Octoparse Fetch error:', error.message);
        }
    }
}

module.exports = new SchedulerService();
