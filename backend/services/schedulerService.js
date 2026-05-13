const cron = require('node-cron');
const { sql, getPool, generateId } = require('../database/db');
const MarketSyncService = require('./marketDataSyncService');
const { syncSellerFromKeepaInternal } = require('../controllers/sellerAsinTrackerController');
const AutoTagService = require('./autoTagService');

/**
 * Scheduler Service
 * Manages background jobs for the dashboard.
 */
class SchedulerService {
    constructor() {
        this.jobs = {};
        this.ensureTablesExist().catch(err => {
            console.error('❌ ScheduledRuns table verification failed on startup:', err.message);
        });
    }

    /**
     * Initialize all scheduled jobs
     */
    async init() {
        try {
            await this.scheduleJobs();
            console.log('✅ Background tasks successfully initialized.');
        } catch (error) {
            console.error('❌ Scheduler initialization error:', error.message);
        }
    }

    async scheduleJobs() {
        // Stop existing jobs if they exist to prevent duplicates on reschedule
        if (this.jobs.enterprisePipeline) {
            this.jobs.enterprisePipeline.stop();
            delete this.jobs.enterprisePipeline;
        }
        if (this.jobs.enterpriseAjioPipeline) {
            this.jobs.enterpriseAjioPipeline.stop();
            delete this.jobs.enterpriseAjioPipeline;
        }
        if (this.jobs.integrityRepair) {
            this.jobs.integrityRepair.stop();
            delete this.jobs.integrityRepair;
        }
        if (this.jobs.ageTagRefresh) {
            this.jobs.ageTagRefresh.stop();
            delete this.jobs.ageTagRefresh;
        }

        let scheduleTime = process.env.AUTOMATION_SCHEDULE_TIME || '11:20';
        let ajioScheduleTime = process.env.AUTOMATION_AJIO_SCHEDULE_TIME || '12:00';
        let automationEnabled = process.env.AUTOMATION_ENABLED === 'true';
        let automationTimezone = process.env.AUTOMATION_TIMEZONE || 'Asia/Kolkata'; // Align with IST by default

        console.log('--------------------------------------------------------');
        console.log('📡 [SCHEDULER CONFIG LOADED FROM ENV]');
        console.log(`⏰ ENV -> Amazon Nightly Schedule: ${scheduleTime}`);
        console.log(`⏰ ENV -> Ajio Nightly Schedule  : ${ajioScheduleTime}`);
        console.log(`🌍 ENV -> Scheduler Timezone   : ${automationTimezone}`);
        console.log(`⚙️  ENV -> Automation Status       : ${automationEnabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`📅 Server Internal System Time  : ${new Date().toString()}`);
        console.log('--------------------------------------------------------');

        try {
            const pool = await getPool();
            const settingsResult = await pool.request().query("SELECT [Key], Value FROM SystemSettings WHERE [Key] IN ('AUTOMATION_SCHEDULE_TIME', 'AUTOMATION_AJIO_SCHEDULE_TIME', 'AUTOMATION_ENABLED', 'AUTOMATION_TIMEZONE')");
            const settingsMap = {};
            settingsResult.recordset.forEach(s => {
                settingsMap[s.Key] = s.Value;
            });

            if (settingsMap['AUTOMATION_SCHEDULE_TIME'] && settingsMap['AUTOMATION_SCHEDULE_TIME'] !== scheduleTime) {
                console.log(`📌 [Scheduler DB Override] Amazon Nightly Schedule overridden by Database: ${scheduleTime} -> ${settingsMap['AUTOMATION_SCHEDULE_TIME']}`);
                scheduleTime = settingsMap['AUTOMATION_SCHEDULE_TIME'];
            }
            if (settingsMap['AUTOMATION_AJIO_SCHEDULE_TIME'] && settingsMap['AUTOMATION_AJIO_SCHEDULE_TIME'] !== ajioScheduleTime) {
                console.log(`📌 [Scheduler DB Override] Ajio Nightly Schedule overridden by Database  : ${ajioScheduleTime} -> ${settingsMap['AUTOMATION_AJIO_SCHEDULE_TIME']}`);
                ajioScheduleTime = settingsMap['AUTOMATION_AJIO_SCHEDULE_TIME'];
            }
            if (settingsMap['AUTOMATION_TIMEZONE'] && settingsMap['AUTOMATION_TIMEZONE'] !== automationTimezone) {
                console.log(`📌 [Scheduler DB Override] Timezone overridden by Database              : ${automationTimezone} -> ${settingsMap['AUTOMATION_TIMEZONE']}`);
                automationTimezone = settingsMap['AUTOMATION_TIMEZONE'];
            }
            if (settingsMap['AUTOMATION_ENABLED'] !== undefined) {
                const dbEnabled = settingsMap['AUTOMATION_ENABLED'] === 'true';
                if (dbEnabled !== automationEnabled) {
                    console.log(`📌 [Scheduler DB Override] Automation Status overridden by Database       : ${automationEnabled ? 'ENABLED' : 'DISABLED'} -> ${dbEnabled ? 'ENABLED' : 'DISABLED'}`);
                    automationEnabled = dbEnabled;
                }
            }
        } catch (dbErr) {
            console.warn('⚠️ [Scheduler] Could not query SystemSettings, falling back to environment config:', dbErr.message);
        }

        if (!automationEnabled) {
            console.log('🛑 [Scheduler] Automation is disabled either in DB or environment. Skipping cron scheduling.');
            return;
        }

        const cronOptions = {
            scheduled: true,
            timezone: automationTimezone
        };

        // 1. Amazon Enterprise Octoparse Pipeline
        const [scheduleHour, scheduleMinute] = scheduleTime.split(':');
        const cronExpr = `${scheduleMinute || 0} ${scheduleHour || 0} * * *`;
        this.jobs.enterprisePipeline = cron.schedule(cronExpr, async () => {
            console.log(`⏰ [${new Date().toLocaleTimeString()}] Running scheduled Amazon Enterprise Pipeline (${automationTimezone})...`);
            await this.runEnterprisePipeline('amazon');
        }, cronOptions);
        console.log(`🏢 Amazon Enterprise Pipeline scheduled at ${scheduleTime} in ${automationTimezone} (${cronExpr})`);

        // 2. Ajio Enterprise Octoparse Pipeline
        const [ajioHour, ajioMinute] = ajioScheduleTime.split(':');
        const ajioCronExpr = `${ajioMinute || 0} ${ajioHour || 0} * * *`;
        this.jobs.enterpriseAjioPipeline = cron.schedule(ajioCronExpr, async () => {
            console.log(`⏰ [${new Date().toLocaleTimeString()}] Running scheduled Ajio Enterprise Pipeline (${automationTimezone})...`);
            await this.runEnterprisePipeline('ajio');
        }, cronOptions);
        console.log(`🏢 Ajio Enterprise Pipeline scheduled at ${ajioScheduleTime} in ${automationTimezone} (${ajioCronExpr})`);

        // 3. Database Integrity Repair (Every 6 hours)
        this.jobs.integrityRepair = cron.schedule('0 */6 * * *', async () => {
            console.log('🕒 Starting Global Database Integrity Repair Check...');
            console.log('ℹ️ Repair task skipped (Refactoring in progress)');
        }, cronOptions);

        // 4. Daily Age Tag Refresh (Every day at 2 AM)
        this.jobs.ageTagRefresh = cron.schedule('0 2 * * *', async () => {
            await this.refreshAgeTags();
        }, cronOptions);
    }

    async reschedule() {
        console.log('🔄 [Scheduler] Settings updated, rescheduling all jobs...');
        await this.scheduleJobs();
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
                        // console.log(`🔄 [RECOVERY] Checking task ${taskId} for seller ${seller.Name}...`);
                        
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
                                const updated = processedCount?.updatedCount !== undefined ? processedCount.updatedCount : 0;
                                console.log(`✅ [RECOVERY] Saved ${updated} ASINs for seller ${seller.Name}`);
                                
                                return { seller, success: true, count: updated };
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

    async refreshAgeTags() {
        try {
            // console.log('🔄 [AutoTag] Starting daily age tag refresh...');
            const pool = await getPool();
            const result = await AutoTagService.batchUpdateAgeTags(pool);
            console.log(`✅ [AutoTag] Refresh complete: ${result.updated} updated, ${result.skipped} skipped`);
            return result;
        } catch (error) {
            console.error('❌ [AutoTag] Refresh failed:', error.message);
        }
    }

    async ensureTablesExist() {
        try {
            const pool = await getPool();
            await pool.request().query(`
                IF OBJECT_ID(N'dbo.ScheduledRuns', N'U') IS NULL
                BEGIN
                    CREATE TABLE ScheduledRuns (
                        Id VARCHAR(50) PRIMARY KEY,
                        StartTime DATETIME2 NOT NULL,
                        EndTime DATETIME2,
                        Status VARCHAR(50) NOT NULL, -- 'RUNNING', 'COMPLETED', 'FAILED'
                        Details NVARCHAR(MAX), -- JSON string with seller-wise stats
                        CreatedAt DATETIME2 DEFAULT GETDATE(),
                        UpdatedAt DATETIME2 DEFAULT GETDATE()
                    );
                END

                IF OBJECT_ID(N'dbo.TaskTemplates', N'U') IS NULL
                BEGIN
                    CREATE TABLE TaskTemplates (
                        Id VARCHAR(24) PRIMARY KEY,
                        Title NVARCHAR(255) NOT NULL,
                        Description NVARCHAR(MAX),
                        Category NVARCHAR(100) DEFAULT 'GENERAL',
                        Priority NVARCHAR(50) DEFAULT 'MEDIUM',
                        Type NVARCHAR(100),
                        TimeLimit INT DEFAULT 60,
                        IsActive BIT DEFAULT 1,
                        CreatedAt DATETIME2 DEFAULT GETDATE(),
                        UpdatedAt DATETIME2 DEFAULT GETDATE()
                    );
                    CREATE INDEX IX_TaskTemplates_Category ON TaskTemplates(Category);
                    CREATE INDEX IX_TaskTemplates_IsActive ON TaskTemplates(IsActive);
                END

                IF OBJECT_ID(N'dbo.GoalTemplates', N'U') IS NULL
                BEGIN
                    CREATE TABLE GoalTemplates (
                        Id VARCHAR(24) PRIMARY KEY,
                        Name NVARCHAR(255) NOT NULL,
                        Description NVARCHAR(MAX),
                        OwnerId VARCHAR(24),
                        CreatedAt DATETIME2 DEFAULT GETDATE(),
                        UpdatedAt DATETIME2 DEFAULT GETDATE(),
                        CONSTRAINT FK_GoalTemplates_Owner FOREIGN KEY (OwnerId) REFERENCES Users(Id)
                    );
                    CREATE INDEX IX_GoalTemplates_OwnerId ON GoalTemplates(OwnerId);
                END
            `);
            console.log('✅ ScheduledRuns, TaskTemplates, and GoalTemplates tables verified/created successfully.');
        } catch (err) {
            console.error('❌ Failed to ensure required database tables exist:', err.message);
        }
    }

    async updateRunDetails(runId, details, status = 'RUNNING', isEnd = false) {
        try {
            const pool = await getPool();
            const detailsJson = JSON.stringify(details);
            const request = pool.request()
                .input('id', sql.VarChar, runId)
                .input('status', sql.VarChar, status)
                .input('details', sql.NVarChar, detailsJson);
            
            if (isEnd) {
                await request.query(`
                    UPDATE ScheduledRuns 
                    SET Status = @status, Details = @details, EndTime = GETDATE(), UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
            } else {
                await request.query(`
                    UPDATE ScheduledRuns 
                    SET Status = @status, Details = @details, UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
            }
        } catch (err) {
            console.error(`❌ Failed to update ScheduledRuns details for run ${runId}:`, err.message);
        }
    }

    async runEnterprisePipeline(marketplace = 'amazon') {
        const isAjio = marketplace === 'ajio';
        console.log(`🏢 [ENTERPRISE] Starting full ${marketplace} automation pipeline (Dynamic worker pool with concurrency up to 5)...`);
        const runId = generateId();
        const details = [];
        const startTime = new Date();

        try {
            const pool = await getPool();

            // Insert initial run record
            await pool.request()
                .input('id', sql.VarChar, runId)
                .input('startTime', sql.DateTime2, startTime)
                .input('status', sql.VarChar, 'RUNNING')
                .input('details', sql.NVarChar, JSON.stringify([]))
                .query(`
                    INSERT INTO ScheduledRuns (Id, StartTime, Status, Details, CreatedAt, UpdatedAt)
                    VALUES (@id, @startTime, @status, @details, GETDATE(), GETDATE())
                `);

            // 1. FIRST: Stop all active tasks to ensure a fresh state
            console.log(`🏢 [ENTERPRISE] Phase 1: Stopping all active Octoparse ${marketplace} tasks...`);
            await MarketSyncService.stopAllActiveTasks(marketplace);
            await new Promise(r => setTimeout(r, 15000)); // Allow time for stop commands to propagate

            const queryStr = isAjio
                ? "SELECT * FROM Sellers WHERE IsActive = 1 AND OctoparseId IS NOT NULL AND OctoparseId != '' AND LOWER(Marketplace) = 'ajio'"
                : "SELECT * FROM Sellers WHERE IsActive = 1 AND OctoparseId IS NOT NULL AND OctoparseId != '' AND (Marketplace IS NULL OR LOWER(Marketplace) != 'ajio')";
            const sellersResult = await pool.request().query(queryStr);
            const sellers = sellersResult.recordset;

            if (sellers.length === 0) {
                await this.updateRunDetails(runId, [], 'COMPLETED', true);
                return { success: true, totalSellers: 0 };
            }

            // A-Z sorting with numeric awareness
            sellers.sort((a, b) => {
                const nameA = (a.Name || '').toString().trim();
                const nameB = (b.Name || '').toString().trim();
                return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
            });

            console.log(`🏢 [ENTERPRISE] Found ${sellers.length} active sellers. Processing with a dynamic concurrency pool of up to 5 concurrent tasks.`);
            
            let successful = 0;
            const CONCURRENCY_LIMIT = 5;
            let currentIndex = 0;

            const runWorker = async () => {
                while (currentIndex < sellers.length) {
                    const index = currentIndex++;
                    const seller = sellers[index];
                    if (!seller) break;

                    console.log(`🚀 [ENTERPRISE] Worker starting seller: ${seller.Name} (${index + 1} of ${sellers.length})...`);

                    let activeAsinsCount = 0;
                    try {
                        const countResult = await pool.request()
                            .input('sellerId', sql.VarChar, seller.Id)
                            .query("SELECT COUNT(*) as activeCount FROM Asins WHERE SellerId = @sellerId AND Status = 'Active'");
                        activeAsinsCount = countResult.recordset[0]?.activeCount || 0;
                    } catch (err) {
                        console.error(`⚠️ Failed to query active ASIN count for seller ${seller.Name}:`, err.message);
                    }

                    const sellerStat = {
                        sellerId: seller.Id,
                        name: seller.Name,
                        startTime: new Date(),
                        endTime: null,
                        status: 'RUNNING',
                        asinsCount: activeAsinsCount,
                        count: 0,
                        error: null
                    };
                    details.push(sellerStat);
                    await this.updateRunDetails(runId, details);

                    try {
                        // Clear previous data from Octoparse cloud before starting
                        console.log(`🧹 [ENTERPRISE] Clearing previous data for ${seller.Name}...`);
                        await MarketSyncService.clearTaskData(seller.OctoparseId).catch(() => {});
                        
                        // Trigger sync and await complete scrape + polling
                        const syncResult = await MarketSyncService.syncSellerAsinsToOctoparse(seller.Id, { 
                            triggerScrape: true,
                            fullSync: true,
                            forceReRun: true,
                            awaitCompletion: true
                        });

                        sellerStat.status = 'COMPLETED';
                        if (syncResult && typeof syncResult === 'object') {
                            sellerStat.asinsCount = syncResult.asinsCount || 0;
                            sellerStat.count = syncResult.count || 0;
                        }
                        successful++;
                        console.log(`✅ [ENTERPRISE] Successfully completed and exported data for ${seller.Name}!`);
                    } catch (err) {
                        sellerStat.status = 'FAILED';
                        sellerStat.error = err.message;
                        console.error(`❌ [ENTERPRISE] Failed for ${seller.Name}:`, err.message);
                    } finally {
                        sellerStat.endTime = new Date();
                        await this.updateRunDetails(runId, details);
                    }

                    // Stability delay after a worker finishes a task before picking up the next one
                    if (currentIndex < sellers.length) {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            };

            // Start up to CONCURRENCY_LIMIT workers in parallel
            const workers = [];
            const activeWorkersCount = Math.min(CONCURRENCY_LIMIT, sellers.length);
            for (let w = 0; w < activeWorkersCount; w++) {
                workers.push(runWorker());
                // Stagger starting the workers slightly for Octoparse API rate-limiting stability
                if (w < activeWorkersCount - 1) {
                    await new Promise(r => setTimeout(r, 3000));
                }
            }

            // Wait for all workers to finish processing the entire queue
            await Promise.all(workers);

            // After completed, stop all active tasks completely as requested
            console.log('🏢 [ENTERPRISE] Stopping all active tasks after pipeline completion to prevent concurrency...');
            await MarketSyncService.stopAllActiveTasks().catch(() => {});

            const totalDurationSecs = Math.round((Date.now() - startTime) / 1000);
            const result = {
                totalSellers: sellers.length,
                successful,
                duration: `${totalDurationSecs}s`
            };

            console.log('🏢 [ENTERPRISE] Pipeline fully completed:', result);
            await this.updateRunDetails(runId, details, 'COMPLETED', true);

            // Create notification for admin
            try {
                const adminsResult = await pool.request()
                    .query("SELECT u.Id FROM Users u JOIN Roles r ON u.RoleId = r.Id WHERE r.Name = 'admin'");
                
                const { createNotification } = require('../controllers/notificationController');
                for (const admin of adminsResult.recordset) {
                    await createNotification(
                        admin.Id,
                        'SYSTEM',
                        'System',
                        admin.Id,
                        `🏢 Scheduled Run Complete: ${result.successful}/${result.totalSellers} sellers synced successfully in ${result.duration}.`
                    );
                }
            } catch (notifErr) {
                console.error('Failed to create notification:', notifErr.message);
            }

            return result;
        } catch (error) {
            console.error('🏢 [ENTERPRISE] Pipeline failed:', error.message);
            await this.updateRunDetails(runId, details, 'FAILED', true);
            return { success: false, error: error.message };
        }
    }

    /**
     * Identifies ASINs with missing critical data (Title, Price, Image)
     * across all active sellers and triggers concurrent scrapes.
     */
    async runMissingDataRecovery() {
        try {
            console.log('🔍 [MISSING DATA] Starting concurrent recovery for incomplete ASINs...');
            const pool = await getPool();
            const sellersResult = await pool.request().query("SELECT Id, Name FROM Sellers WHERE IsActive = 1");
            const sellers = sellersResult.recordset;

            if (sellers.length === 0) return { success: true, count: 0 };

            const CONCURRENCY_LIMIT = 2; // Low concurrency for recovery
            let totalTriggered = 0;
            const startTime = Date.now();

            for (let i = 0; i < sellers.length; i += CONCURRENCY_LIMIT) {
                const batch = sellers.slice(i, i + CONCURRENCY_LIMIT);
                
                await Promise.all(batch.map(async (seller) => {
                    try {
                        const result = await MarketSyncService.syncSellerAsinsToOctoparse(seller.Id, { 
                            onlyMissing: true,
                            triggerScrape: true 
                        });
                        if (result) totalTriggered++;
                    } catch (err) {
                        console.error(`❌ [MISSING DATA] Failed for ${seller.Name}:`, err.message);
                    }
                }));

                // Delay between batches
                if (i + CONCURRENCY_LIMIT < sellers.length) {
                    await new Promise(r => setTimeout(r, 8000));
                }
            }

            const duration = Math.round((Date.now() - startTime) / 1000);
            console.log(`✅ [MISSING DATA] Recovery cycle completed. Triggered ${totalTriggered} sellers in ${duration}s`);
            
            return { success: true, triggered: totalTriggered, duration };
        } catch (error) {
            console.error('❌ [MISSING DATA] Critical failure:', error.message);
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
                .query("SELECT u.Id FROM Users u JOIN Roles r ON u.RoleId = r.Id WHERE r.Name = 'admin'");
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
