const Seller = require('../models/Seller');
const Asin = require('../models/Asin');
const User = require('../models/User');
const marketDataSyncService = require('../services/marketDataSyncService');

/**
 * Enrich sellers with their assigned managers.
 * A manager is a User who has the seller's _id in their `assignedSellers` array.
 */
const enrichSellersWithManagers = async (sellers) => {
  if (!sellers || sellers.length === 0) return sellers;
  const sellerIds = sellers.map(s => s._id);
  // Find all users that manage at least one of these sellers
  const managers = await User.find({ assignedSellers: { $in: sellerIds } })
    .select('firstName lastName email assignedSellers')
    .lean();

  return sellers.map(seller => {
    const sellerObj = seller.toObject ? seller.toObject() : { ...seller };
    sellerObj.managers = managers
      .filter(m => m.assignedSellers.some(sid => sid.toString() === sellerObj._id.toString()))
      .map(m => ({ _id: m._id, firstName: m.firstName, lastName: m.lastName, email: m.email }));
    return sellerObj;
  });
};

/**
 * Enrich sellers with dynamic ASIN counts so it's always accurate.
 */
const enrichSellersWithAsinCounts = async (sellers) => {
  if (!sellers || sellers.length === 0) return sellers;
  const sellerIds = sellers.map(s => s._id);

  const counts = await Asin.aggregate([
    { $match: { seller: { $in: sellerIds } } },
    {
      $group: {
        _id: '$seller',
        totalAsins: { $sum: 1 },
        activeAsins: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } }
      }
    }
  ]);

  const countMap = {};
  counts.forEach(c => {
    countMap[c._id.toString()] = c;
  });

  return sellers.map(seller => {
    const stats = countMap[seller._id.toString()] || { totalAsins: 0, activeAsins: 0 };
    return {
      ...seller,
      totalAsins: stats.totalAsins,
      activeAsins: stats.activeAsins
    };
  });
};

// Get all sellers
exports.getSellers = async (req, res) => {
  try {
    // If not admin, return only assigned sellers
    if (req.user && req.user.role && req.user.role.name !== 'admin') {
      const sellerIds = req.user.assignedSellers.map(s => s._id);

      const filter = { _id: { $in: sellerIds } };
      const sellers = await Seller.find(filter).sort({ createdAt: -1 });
      const enrichedWithManagers = await enrichSellersWithManagers(sellers);
      const fullyEnriched = await enrichSellersWithAsinCounts(enrichedWithManagers);

      return res.json({
        success: true,
        data: {
          sellers: fullyEnriched,
          pagination: {
            page: 1,
            limit: fullyEnriched.length,
            total: fullyEnriched.length,
            totalPages: 1
          }
        }
      });
    }

    const { status, marketplace, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (marketplace) filter.marketplace = marketplace;

    const sellers = await Seller.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Seller.countDocuments(filter);
    const enrichedWithManagers = await enrichSellersWithManagers(sellers);
    const fullyEnriched = await enrichSellersWithAsinCounts(enrichedWithManagers);

    res.json({
      success: true,
      data: {
        sellers: fullyEnriched,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single seller with ASINs
exports.getSeller = async (req, res) => {
  try {
    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === req.params.id);

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized access to seller profile' });
    }

    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    const asins = await Asin.find({ seller: seller._id }).sort({ createdAt: -1 });

    res.json({ seller, asins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new seller
exports.createSeller = async (req, res) => {
  try {
    const userRole = req.user?.role?.name || req.user?.role;
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager' || userRole === 'Brand Manager';

    // Extract managerId from body (admin can select a manager)
    const { managerId, ...sellerData } = req.body;

    const seller = new Seller(sellerData);
    await seller.save();

    // Validated: Sync to CometChat
    try {
      const { syncSellerToCometChat } = require('../services/cometChatService');
      syncSellerToCometChat(seller);
    } catch (chatError) {
      console.error('CometChat Sync Error during seller creation:', chatError);
    }

    // Determine which manager to assign the seller to
    let assignToManagerId = null;
    if (isManager) {
      // Manager creates: auto-assign to themselves
      assignToManagerId = req.user._id;
    } else if (isAdmin && managerId) {
      // Admin creates with a selected manager
      assignToManagerId = managerId;
    }

    if (assignToManagerId) {
      await User.findByIdAndUpdate(
        assignToManagerId,
        { $addToSet: { assignedSellers: seller._id } },
        { new: true }
      );
    }

    res.status(201).json(seller);

    // BACKGROUND: Automate Octoparse task creation
    if (marketDataSyncService.isConfigured()) {
      marketDataSyncService.ensureTaskForSeller(seller._id)
        .catch(err => console.error(`⚠️ Automation: Failed to ensure task for seller ${seller.name}:`, err.message));
    }
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Seller ID already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Update seller
exports.updateSeller = async (req, res) => {
  try {
    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === req.params.id);

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to update this seller' });
    }

    const seller = await Seller.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Sync to CometChat on update
    try {
      const { syncSellerToCometChat } = require('../services/cometChatService');
      syncSellerToCometChat(seller);
    } catch (chatError) {
      console.error('CometChat Sync Error during seller update:', chatError);
    }

    res.json(seller);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete seller
exports.deleteSeller = async (req, res) => {
  try {
    const userRole = req.user?.role?.name || req.user?.role;
    const isAdmin = userRole === 'admin';
    // Manager can delete sellers assigned to them
    const isAssigned = req.user && (req.user.assignedSellers || []).some(s =>
      (s._id || s).toString() === req.params.id
    );

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to delete this seller' });
    }

    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Delete all ASINs for this seller
    await Asin.deleteMany({ seller: seller._id });

    // Remove seller from any manager's assignedSellers
    await User.updateMany(
      { assignedSellers: seller._id },
      { $pull: { assignedSellers: seller._id } }
    );

    const uid = `seller_${require('../services/cometChatService').sanitizeUid(seller.sellerId)}`;
    await seller.deleteOne();

    // Sync to CometChat on deletion
    try {
      const { deleteFromCometChat } = require('../services/cometChatService');
      deleteFromCometChat(uid); // Fire and forget
    } catch (chatError) {
      console.error('CometChat Deletion Error:', chatError);
    }
    res.json({ message: 'Seller deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Bulk import sellers
exports.importSellers = async (req, res) => {
  try {
    const { sellers } = req.body;

    if (!sellers || !Array.isArray(sellers)) {
      return res.status(400).json({ error: 'Sellers array required' });
    }

    const results = { imported: 0, errors: [] };

    const { syncSellerToCometChat } = require('../services/cometChatService');

    for (const sellerData of sellers) {
      try {
        const seller = new Seller(sellerData);
        await seller.save();

        // Sync to CometChat
        try {
          await syncSellerToCometChat(seller);
        } catch (chatError) {
          console.error(`CometChat Sync Error for imported seller ${sellerData.name}:`, chatError);
        }

        results.imported++;

        // BACKGROUND: Automate Octoparse task creation for imported seller
        if (marketDataSyncService.isConfigured()) {
          marketDataSyncService.ensureTaskForSeller(seller._id)
            .catch(err => console.error(`⚠️ Automation: Failed to ensure task for imported seller ${sellerData.name}:`, err.message));
        }
      } catch (error) {
        results.errors.push({ seller: sellerData.name, error: error.message });
      }
    }

    res.status(201).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

