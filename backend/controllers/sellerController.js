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
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    const { status, marketplace, search, page = 1, limit = 200 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // If not global user, return only assigned sellers
    if (!isGlobalUser) {
      const sellerIds = req.user.assignedSellers.map(s => s._id);
      const filter = { _id: { $in: sellerIds } };
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { sellerId: { $regex: search, $options: 'i' } }
        ];
      }

      const total = await Seller.countDocuments(filter);
      const sellers = await Seller.find(filter)
        .sort({ name: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum);

      const enrichedWithManagers = await enrichSellersWithManagers(sellers);
      const fullyEnriched = await enrichSellersWithAsinCounts(enrichedWithManagers);

      return res.json({
        success: true,
        data: {
          sellers: fullyEnriched,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum)
          }
        }
      });
    }
    const filter = {};

    if (status) filter.status = status;
    if (marketplace) filter.marketplace = marketplace;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sellerId: { $regex: search, $options: 'i' } }
      ];
    }

    const sellers = await Seller.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Seller.countDocuments(filter);
    const enrichedWithManagers = await enrichSellersWithManagers(sellers);
    const fullyEnriched = await enrichSellersWithAsinCounts(enrichedWithManagers);

    console.log(`[BACKEND] Returning ${fullyEnriched.length} enriched sellers to user ${req.user.email} (Limit: ${limit})`);

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
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === req.params.id);

    if (!isGlobalUser && !isAssigned) {
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
    const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
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
    } else if (isGlobalUser && managerId) {
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
    const { id } = req.params;
    const { managerId, ...updateData } = req.body;
    const userRole = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);

    // Security check
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === id);
    if (!isGlobalUser && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to update this seller' });
    }

    const seller = await Seller.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Handle Manager Re-assignment (Global users only)
    if (isGlobalUser && managerId !== undefined) {
      // 1. Remove seller from all existing managers
      await User.updateMany(
        { assignedSellers: id },
        { $pull: { assignedSellers: id } }
      );

      // 2. Assign to new manager if managerId is not null/empty
      if (managerId) {
        await User.findByIdAndUpdate(
          managerId,
          { $addToSet: { assignedSellers: id } }
        );
      }
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
    // ONLY Super Admin can delete sellers
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only Super Administrators can delete sellers' });
    }

    const seller = await Seller.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // 1. Find all ASINs for this seller to clean up related data
    const asins = await Asin.find({ seller: seller._id });
    const asinCodes = asins.map(a => a.asinCode);
    const asinIds = asins.map(a => a._id);

    // 2. Cascade delete related data across multiple models
    // Import models dynamically to avoid potential circular dependencies
    const AdsPerformance = require('../models/AdsPerformance');
    const Order = require('../models/Order');
    const RevenueSummary = require('../models/RevenueSummary');
    const RealTimeAlert = require('../models/RealTimeAlert');
    const { AsinItem } = require('../models/RevenueCalculatorModel');
    const Action = require('../models/Action');
    const { Alert, AlertRule } = require('../models/AlertModel');

    // Delete by ASIN string/code
    if (asinCodes.length > 0) {
      await AdsPerformance.deleteMany({ asin: { $in: asinCodes } });
      await Order.deleteMany({ asin: { $in: asinCodes } });
      await RevenueSummary.deleteMany({ asin: { $in: asinCodes } });
      await RealTimeAlert.deleteMany({ asin: { $in: asinCodes } });
      await AsinItem.deleteMany({ asin: { $in: asinCodes } });
    }

    // Delete by Seller ID or ASIN ObjectIDs
    await Action.deleteMany({ 
      $or: [
        { sellerId: seller._id },
        { asins: { $in: asinIds } },
        { resolvedAsins: { $in: asinCodes } }
      ]
    });

    await Alert.deleteMany({ sellerId: seller._id });
    await AlertRule.deleteMany({ sellerId: seller._id });

    // Unassign Octoparse Tasks
    const OctoTask = require('../models/OctoTask');
    await OctoTask.updateMany(
      { sellerId: seller._id },
      { isAssigned: false, sellerId: null }
    );

    // 3. Delete all ASINs for this seller
    await Asin.deleteMany({ seller: seller._id });

    // 4. Remove seller from any manager's assignedSellers
    await User.updateMany(
      { assignedSellers: seller._id },
      { $pull: { assignedSellers: seller._id } }
    );

    const uid = `seller_${require('../services/cometChatService').sanitizeUid(seller.sellerId)}`;
    
    // 5. Delete the seller itself
    await seller.deleteOne();

    // Sync to CometChat on deletion
    try {
      const { deleteFromCometChat } = require('../services/cometChatService');
      deleteFromCometChat(uid); // Fire and forget
    } catch (chatError) {
      console.error('CometChat Deletion Error:', chatError);
    }
    
    res.json({ message: 'Seller and all associated data deleted successfully' });
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
        const { managerId, ...data } = sellerData;
        const seller = new Seller(data);
        await seller.save();

        // Linked: Assign manager if provided
        if (managerId) {
          await User.findByIdAndUpdate(
            managerId,
            { $addToSet: { assignedSellers: seller._id } }
          );
        }

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

