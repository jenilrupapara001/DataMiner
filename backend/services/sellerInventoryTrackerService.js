/**
 * Seller Inventory Tracker Service
 * Uses Keepa API to track seller inventory and detect new ASINs.
 * Adds any new ASINs to the system automatically.
 */

const { sql, getPool, generateId } = require('../database/db');
const { getSellerAsins, getTokenStatus, isValidSellerId } = require('./keepaService');
const marketDataSyncService = require('./marketDataSyncService');

class SellerInventoryTracker {
    constructor() {
        this.syncLocks = new Map();
    }

    /**
     * Main entry point - sync all active sellers' inventory
     */
    async syncAllSellersInventory() {
        console.log('[InventoryTracker] Starting inventory sync for all sellers...');

        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT * FROM Sellers
                WHERE IsActive = 1
                AND (KeepaSellerId IS NOT NULL AND KeepaSellerId <> ''
                     OR SellerId IS NOT NULL AND SellerId <> '')
            `);

        const sellers = result.recordset;

        if (sellers.length === 0) {
            console.log('[InventoryTracker] No sellers with Keepa seller ID configured');
            return { success: false, reason: 'No sellers configured' };
        }

        console.log(`[InventoryTracker] Syncing ${sellers.length} sellers...`);

        const results = await Promise.allSettled(
            sellers.map(seller => this.syncSellerInventory(seller.Id))
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        const totalNewAsins = results
            .filter(r => r.status === 'fulfilled')
            .reduce((sum, r) => sum + (r.value?.newAsinsCount || 0), 0);

        console.log(`[InventoryTracker] Completed: ${successful} success, ${failed} failed, ${totalNewAsins} new ASINs added`);

        return {
            success: true,
            totalSellers: sellers.length,
            successful,
            failed,
            totalNewAsins
        };
    }

    /**
     * Sync a single seller's inventory from Keepa
     */
    async syncSellerInventory(sellerId) {
        const sellerIdStr = sellerId.toString();

        if (this.syncLocks.get(sellerIdStr)) {
            console.log(`[InventoryTracker] Sync already in progress for seller ${sellerIdStr}`);
            return { success: false, reason: 'Already syncing' };
        }
        this.syncLocks.set(sellerIdStr, true);

        try {
            const pool = await getPool();
            const sellerResult = await pool.request()
                .input('Id', sql.Int, sellerId)
                .query('SELECT * FROM Sellers WHERE Id = @Id');

            const seller = sellerResult.recordset[0];
            if (!seller) {
                throw new Error('Seller not found');
            }

            console.log(`[InventoryTracker] Processing seller: ${seller.Name}`);
            const lookupId = seller.KeepaSellerId || seller.SellerId;

            if (!lookupId) {
                return { success: false, reason: 'No Keepa seller ID' };
            }

            if (!isValidSellerId(lookupId)) {
                return { success: false, reason: `Invalid seller ID format` };
            }

            const keepaAsins = await getSellerAsins(lookupId, seller.Marketplace || 'amazon.in');

            if (keepaAsins.length === 0) {
                return { success: true, newAsinsCount: 0, totalAsins: 0 };
            }

            const existingResult = await pool.request()
                .input('SellerId', sql.Int, seller.Id)
                .query('SELECT AsinCode FROM Asins WHERE SellerId = @SellerId');

            const existingCodes = new Set(existingResult.recordset.map(a => a.AsinCode.toUpperCase()));
            const newAsins = keepaAsins.filter(code => !existingCodes.has(code.toUpperCase()));

            let addedCount = 0;
            if (newAsins.length > 0) {
                for (const code of newAsins) {
                    await pool.request()
                        .input('AsinCode', sql.NVarChar, code.toUpperCase())
                        .input('SellerId', sql.VarChar, seller.Id)
                        .query(`INSERT INTO Asins (AsinCode, SellerId, Status, ScrapeStatus, CreatedAt)
                                VALUES (@AsinCode, @SellerId, 'Active', 'PENDING', GETDATE())`);
                    addedCount++;
                }

                await this.sendNotifications(seller, addedCount);

                if (marketDataSyncService.isConfigured()) {
                    marketDataSyncService.syncSellerAsinsToOctoparse(seller.Id, { triggerScrape: true })
                        .catch(err => console.error(err.message));
                }
            }

            await pool.request()
                .input('Id', sql.Int, seller.Id)
                .input('Count', sql.Int, keepaAsins.length)
                .query('UPDATE Sellers SET KeepaAsinCount = @Count, LastKeepaSync = GETDATE() WHERE Id = @Id');

            return { success: true, newAsinsCount: addedCount };

        } catch (error) {
            console.error(`[InventoryTracker] Error:`, error.message);
            return { success: false, error: error.message };
        } finally {
            this.syncLocks.delete(sellerIdStr);
        }
    }

    async sendNotifications(seller, newAsinsCount) {
        if (newAsinsCount === 0) return;
        const pool = await getPool();
        const message = `📦 Inventory Update: ${newAsinsCount} new ASINs discovered for seller "${seller.Name}".`;

        // Get users assigned to this seller
        const usersResult = await pool.request()
            .input('sellerId', sql.VarChar, seller.Id)
            .query('SELECT UserId FROM UserSellers WHERE SellerId = @sellerId');

        const users = usersResult.recordset;

        if (users.length === 0) {
            console.log(`[InventoryTracker] No users assigned to seller ${seller.Name} (${seller.Id})`);
            return;
        }

        const notificationPromises = users.map(user =>
            pool.request()
                .input('Id', sql.VarChar, generateId())
                .input('RecipientId', sql.VarChar, user.UserId)
                .input('Type', sql.NVarChar, 'SYSTEM')
                .input('ReferenceModel', sql.NVarChar, 'System')
                .input('ReferenceId', sql.VarChar, seller.Id)
                .input('Message', sql.NVarChar, message)
                .query(`
                    INSERT INTO Notifications (Id, RecipientId, Type, ReferenceModel, ReferenceId, Message, CreatedAt)
                    VALUES (@Id, @RecipientId, @Type, @ReferenceModel, @ReferenceId, @Message, GETDATE())
                `)
        );

        try {
            await Promise.all(notificationPromises);
            console.log(`[InventoryTracker] Sent ${users.length} notifications for ${newAsinsCount} new ASINs to seller ${seller.Name}`);
        } catch (err) {
            console.error('[InventoryTracker] Notification send error:', err.message);
        }
    }

    async getTokenStatus() {
        return await getTokenStatus();
    }

    async getInventoryStatus(sellerId) {
        const pool = await getPool();
        const result = await pool.request()
            .input('SellerId', sql.Int, sellerId)
            .query(`SELECT * FROM Asins WHERE SellerId = @SellerId`);

        const dbAsins = result.recordset;
        return {
            dbTotal: dbAsins.length,
            dbActive: dbAsins.filter(a => a.Status === 'Active').length,
            dbPending: dbAsins.filter(a => a.ScrapeStatus === 'PENDING').length
        };
    }
}

module.exports = new SellerInventoryTracker();