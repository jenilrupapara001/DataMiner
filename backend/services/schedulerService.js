const cron = require('node-cron');
const Seller = require('../models/Seller');
const MarketSyncService = require('./marketDataSyncService');
const OctoparseAutomationService = require('./octoparseAutomationService');
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
        // Cron: 0 minute, every 12th hour
        this.jobs.keepaSync = cron.schedule('0 */12 * * *', async () => {
            console.log('🕒 Starting Scheduled Keepa ASIN Sync...');
            await this.runKeepaSync();
        });

        // 2. Enterprise Octoparse Pipeline (Configurable time, default 00:00)
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

        // 3. Octoparse Nightly Full Sync is handled by Enterprise Pipeline at 00:00 by default

        // 4. Octoparse Daily 1 PM Sync (Enterprise Pipeline)
        this.jobs.daily1PMSync = cron.schedule('0 13 * * *', async () => {
            console.log('🕒 Starting Daily 1 PM Octoparse Enterprise Pipeline...');
            await this.runEnterprisePipeline();
        });

        // 6. Database Integrity Repair (Every 6 hours)
        this.jobs.integrityRepair = cron.schedule('0 */6 * * *', async () => {
            console.log('🕒 Starting Global Database Integrity Repair Check...');
            try {
                await OctoparseAutomationService.runBackgroundDatabaseRepair();
            } catch (err) {
                console.error('❌ Failed to run background repair:', err.message);
            }
        });

        console.log('✅ Background tasks scheduled');


        // Optional: Run once on startup after a small delay to ensure DB is ready
        setTimeout(() => {
            console.log('🚀 Running initial Keepa sync on startup...');
            this.runKeepaSync().catch(err => console.error('Startup Keepa sync failed:', err.message));
            
            // Check all Octoparse task statuses on startup
            console.log('🔄 Checking Octoparse tasks on startup...');
            this.runOctoparseTaskRecovery().catch(err => console.error('Startup Octoparse recovery failed:', err.message));
        }, 30000); // 30 second delay
    }

    /**
     * On server restart: Check status of all Octoparse tasks and extract latest data
     * Runs CONCURRENTLY for all sellers, with self-healing in background
     */
    async runOctoparseTaskRecovery() {
        console.log('🔄 [RECOVERY] Starting Octoparse task status check on startup...');
        console.log('🔄 [RECOVERY] Self-healing will run in background for each seller...');
        
        try {
            const MarketSyncService = require('./marketDataSyncService');
            const OctoparseAutomationService = require('./octoparseAutomationService');
            const sellers = await Seller.find({ 
                status: 'Active', 
                marketSyncTaskId: { $exists: true, $ne: '' } 
            });

            console.log(`🔄 [RECOVERY] Found ${sellers.length} sellers - running CHECK CONCURRENTLY...`);

            // Check all sellers concurrently
            const checkPromises = sellers.map(async (seller) => {
                try {
                    const taskId = seller.marketSyncTaskId;
                    console.log(`🔄 [RECOVERY] Checking task ${taskId} for seller ${seller.name}...`);
                    
                    const status = await MarketSyncService.getStatus(taskId);
                    
                    if (!status) {
                        console.log(`⚠️ [RECOVERY] Could not get status for task ${taskId}`);
                        return { seller, success: false, reason: 'No status' };
                    }

                    const taskStatus = status.status?.toLowerCase();
                    console.log(`🔄 [RECOVERY] Task ${taskId} status: ${taskStatus}, extracted: ${status.currentTotalExtractCount || 0}`);

                    // If task has completed (finished/stopped/idle) with data, fetch and ingest
                    if (taskStatus === 'finished' || taskStatus === 'stopped' || taskStatus === 'idle') {
                        if (status.currentTotalExtractCount > 0) {
                            console.log(`📥 [RECOVERY] Fetching data for completed task ${taskId}...`);
                            
                            const rawData = await MarketSyncService.retrieveResults(taskId);
                            if (rawData && rawData.length > 0) {
                                const processedCount = await MarketSyncService.processBatchResults(seller._id, rawData);
                                console.log(`✅ [RECOVERY] Saved ${processedCount} ASINs for seller ${seller.name}`);
                                
                                // Start self-healing in background after data save
                                console.log(`🔧 [RECOVERY] Starting background self-healing for ${seller.name}...`);
                                OctoparseAutomationService.startSelfHealingBackground(seller._id, taskId);
                                
                                return { seller, success: true, count: processedCount, selfHealing: 'started' };
                            }
                        } else {
                            console.log(`⚠️ [RECOVERY] Task ${taskId} completed but no data extracted`);
                        }
                    } else if (taskStatus === 'running' || taskStatus === 'extracting') {
                        console.log(`🔄 [RECOVERY] Task ${taskId} still running, will continue polling...`);
                    }
                    
                    return { seller, success: true, status: taskStatus };
                } catch (err) {
                    console.error(`❌ [RECOVERY] Failed to check task for seller ${seller.name}:`, err.message);
                    return { seller, success: false, error: err.message };
                }
            });

            const results = await Promise.all(checkPromises);
            
            const successCount = results.filter(r => r.success).length;
            console.log(`✅ [RECOVERY] Initial check completed: ${successCount}/${sellers.length} sellers`);
            console.log(`🔧 [RECOVERY] Self-healing processes running in background...`);
            
        } catch (error) {
            console.error('❌ [RECOVERY] Critical error:', error.message);
        }
    }

    /**
     * Enterprise Automation Pipeline - Full Octoparse-only workflow
     * Runs concurrently for all sellers + concurrent self-healing
     */
    async runEnterprisePipeline() {
        console.log('🏢 [ENTERPRISE] Starting full automation pipeline...');
        console.log('🏢 [ENTERPRISE] Self-healing will run concurrently in background...');
        const startTime = Date.now();
        
        try {
            const result = await OctoparseAutomationService.runFullAutomation();
            
            console.log('🏢 [ENTERPRISE] Pipeline completed:', {
                totalSellers: result.totalSellers,
                successful: result.successful,
                failed: result.failed,
                duration: result.duration
            });

            // Start concurrent self-healing for all sellers in background
            console.log('🏢 [ENTERPRISE] Starting concurrent self-healing for all sellers...');
            const sellers = await Seller.find({ status: 'Active', marketSyncTaskId: { $exists: true, $ne: '' } });
            
            const healPromises = sellers.map(seller => 
                OctoparseAutomationService.startSelfHealingBackground(seller._id, seller.marketSyncTaskId)
            );
            await Promise.all(healPromises);
            console.log('🏢 [ENTERPRISE] All self-healing processes started in background');

            // Create notification for admin
            try {
                const Notification = require('../models/Notification');
                const User = require('../models/User');
                const admins = await User.find({ role: { $exists: true } }).populate('role');
                const targetAdmins = admins.filter(a => a.role && a.role.name === 'admin');

                for (const admin of targetAdmins) {
                    await Notification.create({
                        recipient: admin._id,
                        type: 'SYSTEM',
                        referenceModel: 'System',
                        referenceId: admin._id,
                        message: `🏢 Enterprise Pipeline: ${result.successful}/${result.totalSellers} sellers synced in ${result.duration}`
                    });
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

    /**
     * Logic to sync all active sellers from Keepa
     */
    async runKeepaSync() {
        try {
            const sellers = await Seller.find({ status: 'Active' });
            console.log(`[Scheduler] syncing ${sellers.length} sellers...`);

            const Notification = require('../models/Notification');
            const User = require('../models/User');
            const admins = await User.find({ role: { $exists: true } }).populate('role');
            const targetAdmins = admins.filter(a => a.role && a.role.name === 'admin');

            for (const seller of sellers) {
                try {
                    const result = await syncSellerFromKeepaInternal(seller);
                    if (result.added > 0) {
                        console.log(`[Scheduler] ✅ Added ${result.added} new ASINs for ${seller.name}`);

                        // Create notifications for admins
                        for (const admin of targetAdmins) {
                            await Notification.create({
                                recipient: admin._id,
                                type: 'SYSTEM',
                                referenceModel: 'System',
                                referenceId: admin._id, // Just point to self or system
                                message: `🚀 Keepa Sync: Found ${result.added} new ASINs for ${seller.name}`
                            });
                        }
                    }
                } catch (err) {
                    console.error(`[Scheduler] ❌ Failed to sync seller ${seller.name}:`, err.message);
                }
                // Pause briefly between sellers to avoid Keepa burst limits
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            console.log('[Scheduler] Scheduled Keepa sync completed.');
        } catch (error) {
            console.error('[Scheduler] Critical sync error:', error.message);
        }
    }

    /**
     * Logic to trigger Octoparse extraction tasks for all active sellers.
     * Runs concurrently to optimize throughput.
     */
    async runOctoparseTrigger() {
        try {
            // Find active sellers with a configured task
            const sellers = await Seller.find({
                status: 'Active',
                marketSyncTaskId: { $exists: true, $ne: '' }
            });

            console.log(`[Scheduler] 🚀 Starting Nightly Octoparse Sync for ${sellers.length} sellers...`);

            // Process in batches to avoid API rate limits (e.g., 5 at a time)
            const BATCH_SIZE = 5;
            for (let i = 0; i < sellers.length; i += BATCH_SIZE) {
                const batch = sellers.slice(i, i + BATCH_SIZE);
                console.log(`[Scheduler] 📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}...`);

                await Promise.all(batch.map(async (seller) => {
                    try {
                        console.log(`[Scheduler] 🤖 Launching sync for ${seller.name}...`);
                        // This handles Injection -> Start Task -> Start Background Poller
                        await MarketSyncService.syncSellerAsinsToOctoparse(seller._id, { triggerScrape: true });
                    } catch (err) {
                        console.error(`[Scheduler] ❌ Failed to trigger Octoparse for seller ${seller.name}:`, err.message);
                    }
                }));

                // Pause briefly between batches to respect account constraints
                if (i + BATCH_SIZE < sellers.length) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }

            console.log('[Scheduler] ✅ All nightly Octoparse tasks triggered.');
        } catch (error) {
            console.error('[Scheduler] Critical Octoparse Trigger error:', error.message);
        }
    }


    /**
     * Logic to fetch and ingest results from completed Octoparse tasks across ALL sellers.
     * Uses high-performance bulk processing.
     */
    async runOctoparseResultFetch() {
        try {
            const sellers = await Seller.find({ status: 'Active', marketSyncTaskId: { $exists: true, $ne: '' } });
            console.log(`[Scheduler] Fetching results for ${sellers.length} sellers...`);

            for (const seller of sellers) {
                try {
                    const rawData = await MarketSyncService.retrieveResults(seller.marketSyncTaskId);
                    if (rawData && rawData.length > 0) {
                        console.log(`[Scheduler] 📥 Received ${rawData.length} rows for Seller: ${seller.name}`);
                        const processedCount = await MarketSyncService.processBatchResults(seller._id, rawData);
                        console.log(`[Scheduler] ✅ Successfully bulk-linked ${processedCount} results for ${seller.name}`);
                    }
                } catch (err) {
                    console.error(`[Scheduler] ❌ Failed to fetch result for ${seller.name}:`, err.message);
                }
                // Small delay between sellers to respect API limits
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.error('[Scheduler] Critical Octoparse Fetch error:', error.message);
        }
    }
}

module.exports = new SchedulerService();
