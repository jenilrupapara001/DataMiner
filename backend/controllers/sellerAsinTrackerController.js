/**
 * Seller ASIN Tracker Controller
 * Uses Keepa API to auto-discover and sync ASINs for each seller.
 */

const { sql, getPool, generateId } = require('../database/db');
const { getSellerAsins, getTokenStatus, getDomainId, isValidSellerId } = require('../services/keepaService');
const octoparseAutomationService = require('../services/octoparseAutomationService');


/**
 * GET /api/seller-tracker
 * Returns all sellers with their Keepa sync stats.
 */
exports.getTrackerList = async (req, res) => {
    try {
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        let whereClause = 'WHERE 1=1';
        const request = (await getPool()).request();

        if (!isGlobalUser) {
            const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
            if (assignedSellerIds.length === 0) {
                return res.json({ success: true, data: [], tokenStatus: null });
            }
            whereClause += ` AND Id IN (${assignedSellerIds.map(id => `'${id}'`).join(',')})`;
        }

        // Fetch sellers
        const sellersResult = await (await getPool()).request()
            .query(`
                SELECT Id as _id, Id, Name as name, Marketplace as marketplace, SellerId as sellerId,
                       KeepaSellerId as keepaSellerId, IsActive as status, [Plan] as sellerPlan,
                       ScrapeLimit as scrapeLimit, ScrapeUsed as scrapeUsed, LastScrapedAt as lastScraped,
                       KeepaAsinCount as keepaAsinCount, LastKeepaSync as lastKeepaSync
                FROM Sellers
                ${whereClause}
                ORDER BY name ASC
            `);

        let sellers = sellersResult.recordset.map(s => ({
            ...s,
            status: s.IsActive ? 'Active' : 'Inactive',
            plan: s.sellerPlan // map sellerPlan to plan
        }));

        // Enrich with ASIN counts from DB (total and today's new)
        if (sellers.length > 0) {
            const sellerIds = sellers.map(s => s.Id);
            const countsResult = await (await getPool()).request()
                .query(`
                    SELECT SellerId,
                           COUNT(*) as totalAsins,
                           SUM(CASE WHEN DATEDIFF(DAY, CreatedAt, GETDATE()) = 0 THEN 1 ELSE 0 END) as newToday
                    FROM Asins
                    WHERE SellerId IN (${sellerIds.map(id => `'${id}'`).join(',')})
                    GROUP BY SellerId
                `);

            const countMap = {};
            countsResult.recordset.forEach(c => {
                countMap[c.SellerId] = { totalAsins: c.totalAsins, newToday: c.newToday || 0 };
            });

            sellers = sellers.map(seller => ({
                ...seller,
                dbAsinCount: (countMap[seller.Id]?.totalAsins) || 0,
                newAsinCount: (countMap[seller.Id]?.newToday) || 0,
            }));
        }

        const tokenStatus = await getTokenStatus();
        res.json({ success: true, data: sellers, tokenStatus });
    } catch (error) {
        console.error('[SellerTracker] getTrackerList error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /api/seller-tracker/:sellerId/asins
 * Returns all ASINs in DB for a given seller, sorted by createdAt desc.
 */
exports.getSellerAsins = async (req, res) => {
    try {
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
        const sellerId = req.params.sellerId;

        if (!isGlobalUser && !assignedSellerIds.includes(sellerId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to this seller tracker' });
        }

        const pool = await getPool();

        // Check if seller exists
        const sellerResult = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query('SELECT Id FROM Sellers WHERE Id = @id');

        if (sellerResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Seller not found' });
        }

        // Fetch ASINs
        const asinsResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query(`
                SELECT Id as _id, AsinCode as asinCode, Title as title, LQS as lqs,
                       ImageUrl as imageUrl, ScrapeStatus as scrapeStatus, Status as status,
                       CreatedAt as createdAt
                FROM Asins
                WHERE SellerId = @sellerId
                ORDER BY CreatedAt DESC
            `);

        const asins = asinsResult.recordset;
        res.json({ success: true, data: asins, count: asins.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Core sync logic for a single seller.
 * Returns { added, total, newAsins[] }
 */
const syncSellerFromKeepa = async (seller) => {
    // Use keepaSellerId if set, otherwise fall back to sellerId
    const keepaId = seller.keepaSellerId || seller.sellerId;
    if (!keepaId) throw new Error('Seller has no Amazon Seller ID (keepaSellerId or sellerId field)');

    const marketplace = seller.marketplace || 'amazon.in';
    const keepaAsins = await getSellerAsins(keepaId, marketplace);

    if (keepaAsins.length === 0) {
        return { added: 0, total: 0, newAsins: [] };
    }

    // Find which ASINs are already in our DB for this seller
    const pool = await getPool();
    const existingResult = await pool.request()
        .input('sellerId', sql.VarChar, seller.Id)
        .query('SELECT AsinCode FROM Asins WHERE SellerId = @sellerId');

    const existing = existingResult.recordset;
    const existingCodes = new Set(existing.map(a => a.AsinCode.toUpperCase()));
    const newCodes = keepaAsins.filter(code => !existingCodes.has(code.toUpperCase()));

    let newAsins = [];
    if (newCodes.length > 0) {
        // Insert new ASINs in batch
        const insertPromises = newCodes.map(code =>
            pool.request()
                .input('Id', sql.VarChar, generateId())
                .input('AsinCode', sql.NVarChar, code.toUpperCase())
                .input('SellerId', sql.VarChar, seller.Id)
                .input('Status', sql.NVarChar, 'Active')
                .input('ScrapeStatus', sql.NVarChar, 'PENDING')
                .query(`
                    INSERT INTO Asins (Id, AsinCode, SellerId, Status, ScrapeStatus, CreatedAt)
                    VALUES (@Id, @AsinCode, @SellerId, @Status, @ScrapeStatus, GETDATE())
                `)
        );

        try {
            await Promise.all(insertPromises);
            newAsins = newCodes; // Successfully inserted all
        } catch (err) {
            console.error('[SellerTracker] Batch insert error (likely duplicates):', err.message);
            newAsins = []; // Some failed, but we continue
        }

        // Update ASIN count on seller
        await pool.request()
            .input('Id', sql.VarChar, seller.Id)
            .input('Count', sql.Int, keepaAsins.length)
            .query('UPDATE Sellers SET KeepaAsinCount = @Count, LastKeepaSync = GETDATE(), UpdatedAt = GETDATE() WHERE Id = @Id');

        console.log(`[SellerTracker] ${seller.name}: added ${newAsins.length} new ASINs from Keepa`);

        // Notify users associated with this seller
        if (newAsins.length > 0) {
            await notifySellerUsers(seller.Id, seller.name, newAsins.length);
        }

        // BACKGROUND: Trigger Octoparse sync for the newly discovered ASINs
        if (newAsins.length > 0 && octoparseAutomationService.isConfigured()) {
            console.log(`🤖 [SellerTracker] Triggering ROBUST Octoparse sync for: ${seller.name} (+${newAsins.length} ASINs)`);
            octoparseAutomationService.syncSellerAsinsToOctoparse(seller.Id, { triggerScrape: true })
                .catch(err => console.error(`⚠️ [SellerTracker] Octoparse trigger failed for ${seller.name}:`, err.message));
        }
    } else {
        await pool.request()
            .input('Id', sql.VarChar, seller.Id)
            .input('Count', sql.Int, keepaAsins.length)
            .query('UPDATE Sellers SET KeepaAsinCount = @Count, LastKeepaSync = GETDATE(), UpdatedAt = GETDATE() WHERE Id = @Id');
    }

    return {
        added: newAsins.length,
        total: keepaAsins.length,
        newAsins: Array.isArray(newAsins) ? newAsins : [],
    };
};

/**
 * POST /api/seller-tracker/sync/:sellerId
 * Manually sync a single seller's ASINs from Keepa.
 */
exports.syncSeller = async (req, res) => {
    try {
        const userRole = req.user.role?.name || req.user.role;
        const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
        const assignedSellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
        const sellerId = req.params.sellerId;

        if (!isGlobalUser && !assignedSellerIds.includes(sellerId)) {
            return res.status(403).json({ success: false, message: 'Unauthorized to sync this seller' });
        }

        const pool = await getPool();
        const sellerResult = await pool.request()
            .input('id', sql.VarChar, sellerId)
            .query(`
                SELECT Id, Name, KeepaSellerId, SellerId, Marketplace
                FROM Sellers WHERE Id = @id
            `);

        if (sellerResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Seller not found' });
        }

        const seller = sellerResult.recordset[0];
        const result = await syncSellerFromKeepa(seller);
        res.json({ success: true, seller: seller.name, ...result });
    } catch (error) {
        console.error('[SellerTracker] syncSeller error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/seller-tracker/sync-all
 * Sync all active sellers.
 */
exports.syncAll = async (req, res) => {
    try {
        const sellersResult = await (await getPool()).request()
            .query(`
                SELECT Id, Name, KeepaSellerId, SellerId, Marketplace
                FROM Sellers
                WHERE IsActive = 1
                  AND (KeepaSellerId IS NOT NULL AND KeepaSellerId <> '' OR SellerId IS NOT NULL AND SellerId <> '')
            `);

        const sellers = sellersResult.recordset;

        // 1. Concurrent Keepa Sync
        const results = await Promise.allSettled(
            sellers.map(seller => syncSellerFromKeepa(seller).then(r => ({
                seller: seller.name,
                sellerId: seller.Id,
                ...r,
                error: null
            })).catch(err => ({
                seller: seller.name,
                sellerId: seller.Id,
                added: 0,
                error: err.message
            })))
        );

        const totalAdded = results.reduce((sum, r) => sum + (r.value?.added || 0), 0);
        res.json({ success: true, results, totalAdded });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Helper: Send notification to all users assigned to a seller
 */
async function notifySellerUsers(sellerId, sellerName, newAsinsCount) {
    try {
        const pool = await getPool();

        // Get all users assigned to this seller via UserSellers
        const usersResult = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query(`
                SELECT UserId FROM UserSellers
                WHERE SellerId = @sellerId
            `);

        const users = usersResult.recordset;
        const message = `🚀 ${newAsinsCount} new ASINs discovered for seller: ${sellerName} via Keepa sync.`;

        const notificationPromises = users.map(user =>
            pool.request()
                .input('Id', sql.VarChar, generateId())
                .input('RecipientId', sql.VarChar, user.UserId)
                .input('Type', sql.NVarChar, 'SYSTEM')
                .input('ReferenceModel', sql.NVarChar, 'System')
                .input('ReferenceId', sql.VarChar, sellerId)
                .input('Message', sql.NVarChar, message)
                .query(`
                    INSERT INTO Notifications (Id, RecipientId, Type, ReferenceModel, ReferenceId, Message, CreatedAt)
                    VALUES (@Id, @RecipientId, @Type, @ReferenceModel, @ReferenceId, @Message, GETDATE())
                `)
        );

        await Promise.all(notificationPromises);
    } catch (err) {
        console.error('[SellerTracker] Failed to create notifications:', err.message);
    }
}

// Export for scheduler use
module.exports.syncSellerFromKeepaInternal = syncSellerFromKeepa;
