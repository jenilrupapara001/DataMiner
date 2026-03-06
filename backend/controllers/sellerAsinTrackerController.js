/**
 * Seller ASIN Tracker Controller
 * Uses Keepa API to auto-discover and sync ASINs for each seller.
 */

const Seller = require('../models/Seller');
const Asin = require('../models/Asin');
const { getSellerAsins, getTokenStatus, getDomainId } = require('../services/keepaService');

/**
 * GET /api/seller-tracker
 * Returns all sellers with their Keepa sync stats.
 */
exports.getTrackerList = async (req, res) => {
    try {
        const sellers = await Seller.find({}).sort({ name: 1 }).lean();
        // Enrich with ASIN counts from DB
        const result = await Promise.all(sellers.map(async (seller) => {
            const total = await Asin.countDocuments({ seller: seller._id });
            const newToday = await Asin.countDocuments({
                seller: seller._id,
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            });
            return {
                ...seller,
                dbAsinCount: total,
                newAsinCount: newToday,
            };
        }));

        const tokenStatus = await getTokenStatus();
        res.json({ success: true, data: result, tokenStatus });
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
        const seller = await Seller.findById(req.params.sellerId);
        if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

        const asins = await Asin.find({ seller: seller._id })
            .select('asinCode title lqs imagesCount scrapeStatus status createdAt')
            .sort({ createdAt: -1 })
            .lean();

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
    if (!seller.sellerId) throw new Error('Seller has no Amazon Seller ID (sellerId field)');

    const marketplace = seller.marketplace || 'amazon.in';
    const keepaAsins = await getSellerAsins(seller.sellerId, marketplace);

    if (keepaAsins.length === 0) {
        return { added: 0, total: 0, newAsins: [] };
    }

    // Find which ASINs are already in our DB for this seller
    const existing = await Asin.find({ seller: seller._id }).select('asinCode').lean();
    const existingCodes = new Set(existing.map(a => a.asinCode.toUpperCase()));

    const newCodes = keepaAsins.filter(code => !existingCodes.has(code.toUpperCase()));

    let newAsins = [];
    if (newCodes.length > 0) {
        const docs = newCodes.map(code => ({
            asinCode: code.toUpperCase(),
            seller: seller._id,
            status: 'Active',
            scrapeStatus: 'PENDING',
            source: 'KEEPA_AUTO',
        }));
        newAsins = await Asin.insertMany(docs, { ordered: false }).catch(err => {
            // Ignore duplicate key errors (race condition)
            console.warn('[SellerTracker] insertMany partial error (likely duplicates):', err.message);
            return [];
        });

        // Update ASIN count on seller
        await Seller.findByIdAndUpdate(seller._id, {
            keepaAsinCount: keepaAsins.length,
            lastKeepaSync: new Date(),
            totalAsins: existingCodes.size + newAsins.length,
        });

        console.log(`[SellerTracker] ${seller.name}: added ${newAsins.length} new ASINs from Keepa`);

        // Notify users associated with this seller
        if (newAsins.length > 0 && seller.users && seller.users.length > 0) {
            const Notification = require('../models/Notification');
            for (const userId of seller.users) {
                try {
                    await Notification.create({
                        recipient: userId,
                        type: 'SYSTEM',
                        referenceModel: 'System',
                        referenceId: seller._id, // Using sellerId as reference
                        message: `🚀 ${newAsins.length} new ASINs discovered for seller: ${seller.name} via Keepa sync.`
                    });
                } catch (notiErr) {
                    console.error('[SellerTracker] Failed to create sync notification:', notiErr.message);
                }
            }
        }
    } else {
        await Seller.findByIdAndUpdate(seller._id, {
            keepaAsinCount: keepaAsins.length,
            lastKeepaSync: new Date(),
        });
    }

    return {
        added: newAsins.length,
        total: keepaAsins.length,
        newAsins: Array.isArray(newAsins) ? newAsins.map(a => a.asinCode) : [],
    };
};

/**
 * POST /api/seller-tracker/sync/:sellerId
 * Manually sync a single seller's ASINs from Keepa.
 */
exports.syncSeller = async (req, res) => {
    try {
        const seller = await Seller.findById(req.params.sellerId);
        if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

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
        const sellers = await Seller.find({ status: 'Active' });
        const results = [];

        for (const seller of sellers) {
            try {
                const r = await syncSellerFromKeepa(seller);
                results.push({ seller: seller.name, sellerId: seller._id, ...r, error: null });
            } catch (err) {
                results.push({ seller: seller.name, sellerId: seller._id, added: 0, error: err.message });
            }
        }

        const totalAdded = results.reduce((s, r) => s + (r.added || 0), 0);
        res.json({ success: true, results, totalAdded });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Export for scheduler use
module.exports.syncSellerFromKeepaInternal = syncSellerFromKeepa;
