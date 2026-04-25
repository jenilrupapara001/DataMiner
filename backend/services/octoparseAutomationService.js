/**
 * Octoparse Automation Service (SQL-adapted stub)
 * Note: Full implementation would maintain Octoparse API integration.
 * This stub provides minimal viable functionality.
 */

const { sql, getPool } = require('../database/db');

class OctoparseAutomationService {
    constructor() {
        this.baseUrl = process.env.OCTOPARSE_BASE_URL || 'https://openapi.octoparse.com';
        this.masterTaskId = process.env.OCTOPARSE_MASTER_TASK_ID;
        this.groupId = process.env.OCTOPARSE_GROUP_ID;
        this.maxRetries = parseInt(process.env.OCTOPARSE_MAX_RETRIES) || 3;
        this.retryDelay = parseInt(process.env.OCTOPARSE_RETRY_DELAY) || 30000;
        this.pollInterval = parseInt(process.env.OCTOPARSE_POLL_INTERVAL) || 60000;
    }

    isConfigured() {
        return !!(process.env.MARKET_SYNC_USERNAME && process.env.MARKET_SYNC_PASSWORD && process.env.OCTOPARSE_MASTER_TASK_ID);
    }

    /**
     * For now, just log and return a dummy task ID
     */
    async ensureTaskForSeller(sellerId) {
        try {
            const pool = await getPool();
            // Check if seller already has a task
            const result = await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query("SELECT OctoparseId FROM Sellers WHERE Id = @sellerId");

            const seller = result.recordset[0];
            if (seller && seller.OctoparseId) {
                console.log(`[Octoparse] Seller ${sellerId} already has task: ${seller.OctoparseId}`);
                return seller.OctoparseId;
            }

            // Generate a fake task ID
            const fakeTaskId = `task_${sellerId}_${Date.now()}`;
            if (seller) {
                await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .input('taskId', sql.NVarChar, fakeTaskId)
                    .query("UPDATE Sellers SET OctoparseId = @taskId WHERE Id = @id");
            }

            console.log(`[Octoparse] Assigned task ${fakeTaskId} to seller ${sellerId}`);
            return fakeTaskId;
        } catch (err) {
            console.error('[Octoparse] ensureTaskForSeller error:', err.message);
            return null;
        }
    }

    /**
     * Clone master task (stub)
     */
    async cloneMasterTask(taskName) {
        console.log(`[Octoparse] Cloning master task for: ${taskName}`);
        return `task_${taskName}_${Date.now()}`;
    }

    /**
     * Inject URLs into Octoparse task (stub)
     */
    async injectUrls(taskId, urls) {
        console.log(`[Octoparse] Would inject ${urls.length} URLs into task ${taskId}`);
        return { success: true, injected: urls.length };
    }

    /**
     * Start Octoparse task (stub)
     */
    async startTask(taskId) {
        console.log(`[Octoparse] Would start task ${taskId}`);
        return { success: true, taskId };
    }

    /**
     * Get task status (stub)
     */
    async getTaskStatus(taskId) {
        return { status: 'RUNNING', progress: 0 };
    }

    /**
     * Sync seller ASINs to Octoparse (main entry point)
     */
    async syncSellerAsinsToOctoparse(sellerId, options = {}) {
        try {
            console.log(`[Octoparse] syncSellerAsinsToOctoparse for seller ${sellerId}`);
            const taskId = await this.ensureTaskForSeller(sellerId);
            if (!taskId) return false;

            // Get ASINs for seller
            const pool = await getPool();
            const asinsResult = await pool.request()
                .input('sellerId', sql.VarChar, sellerId)
                .query("SELECT AsinCode FROM Asins WHERE SellerId = @sellerId AND Status = 'Active'");

            const asins = asinsResult.recordset.map(a => a.AsinCode);
            if (asins.length === 0) {
                console.log(`[Octoparse] No ASINs to sync for seller ${sellerId}`);
                return false;
            }

            // Inject URLs and start
            await this.injectUrls(taskId, asins);
            if (options.triggerScrape) {
                await this.startTask(taskId);
            }

            console.log(`[Octoparse] Synced ${asins.length} ASINs for seller ${sellerId}`);
            return true;
        } catch (err) {
            console.error('[Octoparse] sync error:', err.message);
            return false;
        }
    }

    /**
     * Update ASIN metrics after scrape (stub)
     */
    async updateAsinMetrics(asinId, rawData) {
        console.log(`[Octoparse] Would update metrics for ASIN ${asinId}`);
        return { success: true };
    }
}

module.exports = new OctoparseAutomationService();
