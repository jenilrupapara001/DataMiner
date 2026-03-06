const cron = require('node-cron');
const Seller = require('../models/Seller');
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

        console.log('✅ Background tasks scheduled (Keepa Sync: Every 12h)');

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
}

module.exports = new SchedulerService();
