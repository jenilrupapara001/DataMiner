const cron = require('node-cron');
const Seller = require('../models/Seller');
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
        console.log('🗓️ Initializing Background Scheduler...');

        // 1. Keepa ASIN Sync (Every 12 hours)
        // Cron: 0 minute, every 12th hour
        this.jobs.keepaSync = cron.schedule('0 */12 * * *', async () => {
            console.log('🕒 Starting Scheduled Keepa ASIN Sync...');
            await this.runKeepaSync();
        });

        // 2. Octoparse Nightly Full Sync (Every day at 12 AM)
        this.jobs.triggerOctoparse = cron.schedule('0 0 * * *', async () => {
            console.log('🕒 Starting Nightly Octoparse Market Data Sync...');
            await this.runOctoparseTrigger();
        });

        // 3. Octoparse Data Fetching (Every 4 hours as a fallback for background polling)
        this.jobs.fetchOctoparse = cron.schedule('0 */4 * * *', async () => {
            console.log('🕒 Fetching pending Octoparse Scrape Results (Fallback)...');
            await this.runOctoparseResultFetch();
        });

        console.log('✅ Background tasks scheduled (Keepa: 12h, Octoparse Trigger: Daily 12AM, Octoparse Fetch: 4h)');


        // Optional: Run once on startup after a small delay to ensure DB is ready
        setTimeout(() => {
            console.log('🚀 Running initial Keepa sync on startup...');
            this.runKeepaSync().catch(err => console.error('Startup Keepa sync failed:', err.message));
        }, 30000); // 30 second delay
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

            // Use Promise.all for concurrent triggering of scrapes
            // (Each trigger handles its own background polling/ingestion)
            await Promise.all(sellers.map(async (seller) => {
                try {
                    console.log(`[Scheduler] 🤖 Launching sync for ${seller.name}...`);
                    await MarketSyncService.syncSellerAsinsToOctoparse(seller._id, { triggerScrape: true });
                } catch (err) {
                    console.error(`[Scheduler] ❌ Failed to trigger Octoparse for seller ${seller.name}:`, err.message);
                }
            }));

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
