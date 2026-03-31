const Asin = require('../models/Asin');
const Seller = require('../models/Seller');
const imageGenerationService = require('../services/imageGenerationService');
const path = require('path');
const fs = require('fs');
const marketDataSyncService = require('../services/marketDataSyncService');

// Get all ASINs
exports.getAsins = async (req, res) => {
  try {
    const { seller, status, category, page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const filter = {};

    // Enforce seller filter for non-admins
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    if (!isAdmin) {
      const allowedSellerIds = req.user.assignedSellers.map(s => s._id);

      if (seller && allowedSellerIds.some(id => id.toString() === seller)) {
        filter.seller = seller;
      } else {
        filter.seller = { $in: allowedSellerIds };
      }
    } else if (seller) {
      filter.seller = seller;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const asins = await Asin.find(filter)
      .populate('seller', 'name marketplace')
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Asin.countDocuments(filter);

    res.json({
      asins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all ASINs with weekHistory for dashboard (no pagination, returns all)
exports.getAllAsinsWithHistory = async (req, res) => {
  try {
    const { seller, status, category } = req.query;
    const filter = {};

    // Enforce seller filter for non-admins
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    if (!isAdmin) {
      const allowedSellerIds = req.user.assignedSellers.map(s => s._id);

      if (seller && allowedSellerIds.some(id => id.toString() === seller)) {
        filter.seller = seller;
      } else {
        filter.seller = { $in: allowedSellerIds };
      }
    } else if (seller) {
      filter.seller = seller;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;

    const asins = await Asin.find(filter)
      .populate('seller', 'name marketplace')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: asins,
      count: asins.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get ASINs by seller
exports.getAsinsBySeller = async (req, res) => {
  try {
    // Security check: non-admins can only access their own seller data
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === req.params.sellerId);

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized access to seller data' });
    }

    const asins = await Asin.find({ seller: req.params.sellerId })
      .populate('seller', 'name marketplace')
      .sort({ createdAt: -1 });

    res.json(asins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get single ASIN
exports.getAsin = async (req, res) => {
  try {
    const asin = await Asin.findById(req.params.id)
      .populate('seller', 'name marketplace sellerId');

    if (!asin) {
      return res.status(404).json({ error: 'ASIN not found' });
    }

    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === asin.seller._id.toString());

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized access to ASIN details' });
    }

    res.json(asin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get ASIN trends (week-on-week data)
exports.getAsinTrends = async (req, res) => {
  try {
    const asin = await Asin.findById(req.params.id);

    if (!asin) {
      return res.status(404).json({ error: 'ASIN not found' });
    }

    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized access to ASIN trends' });
    }

    const trends = asin.getTrends();
    const weekHistory = asin.weekHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      trends,
      weekHistory,
      current: {
        price: asin.currentPrice,
        bsr: asin.bsr,
        rating: asin.rating,
        reviews: asin.reviewCount,
        lqs: asin.lqs,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update ASIN week history
exports.updateWeekHistory = async (req, res) => {
  try {
    const { week, date, price, bsr, rating, reviews, lqs, imageCount, descLength, hasAplus } = req.body;

    const asin = await Asin.findById(req.params.id);

    if (!asin) {
      return res.status(404).json({ error: 'ASIN not found' });
    }

    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to update this ASIN history' });
    }

    asin.updateWeekHistory({
      week,
      date: new Date(date),
      price,
      bsr,
      rating,
      reviews,
      lqs,
      imageCount,
      descLength,
      hasAplus,
    });

    await asin.save();

    res.json(asin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Bulk update week history for multiple ASINs
exports.bulkUpdateWeekHistory = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { asinId, weekData }

    const results = [];
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    for (const update of updates) {
      const asin = await Asin.findById(update.asinId);
      if (asin) {
        // Security check
        const isAssigned = isAdmin || allowedSellerIds.includes(asin.seller.toString());

        if (!isAssigned) {
          results.push({ asinId: update.asinId, success: false, error: 'Unauthorized' });
          continue;
        }

        asin.updateWeekHistory({
          ...update.weekData,
          date: new Date(update.weekData.date),
        });
        await asin.save();
        results.push({ asinId: update.asinId, success: true });
      } else {
        results.push({ asinId: update.asinId, success: false, error: 'ASIN not found' });
      }
    }

    res.json({ message: 'Bulk update completed', results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get ASINs with LQS score sorting
exports.getAsinsByLQS = async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const filter = { status: 'Active' };

    // Enforce isolation
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    if (!isAdmin) {
      filter.seller = { $in: req.user.assignedSellers.map(s => s._id) };
    }

    const asins = await Asin.find(filter)
      .populate('seller', 'name')
      .sort({ lqs: -1 })
      .limit(parseInt(limit));

    res.json(asins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get ASIN statistics for dashboard
exports.getAsinStats = async (req, res) => {
  try {
    const { seller } = req.query;
    const filter = {};

    // Enforce seller filter for non-admins
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    if (!isAdmin) {
      const allowedSellerIds = req.user.assignedSellers.map(s => s._id);

      if (seller && allowedSellerIds.some(id => id.toString() === seller)) {
        filter.seller = seller;
      } else {
        filter.seller = { $in: allowedSellerIds };
      }
    } else if (seller) {
      filter.seller = seller;
    }

    const stats = await Asin.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalAsins = await Asin.countDocuments(filter);
    const activeAsins = await Asin.countDocuments({ ...filter, status: 'Active' });
    const avgBSR = await Asin.aggregate([
      { $match: { ...filter, currentRank: { $gt: 0 } } },
      { $group: { _id: null, avgBSR: { $avg: '$currentRank' } } },
    ]);

    const totalReviews = await Asin.aggregate([
      { $match: filter },
      { $group: { _id: null, totalReviews: { $sum: '$reviewCount' } } },
    ]);

    const avgLQS = await Asin.aggregate([
      { $match: filter },
      { $group: { _id: null, avgLQS: { $avg: '$lqs' } } },
    ]);

    const avgPrice = await Asin.aggregate([
      { $match: { ...filter, currentPrice: { $gt: 0 } } },
      { $group: { _id: null, avgPrice: { $avg: '$currentPrice' } } },
    ]);

    const buyBoxWins = await Asin.countDocuments({ ...filter, buyBoxWin: true });

    res.json({
      total: totalAsins,
      active: activeAsins,
      statusBreakdown: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      avgLQS: avgLQS[0]?.avgLQS?.toFixed(2) || 0,
      avgPrice: avgPrice[0]?.avgPrice?.toFixed(2) || 0,
      avgBSR: avgBSR[0]?.avgBSR?.toFixed(0) || 0,
      totalReviews: totalReviews[0]?.totalReviews || 0,
      buyBoxRate: totalAsins > 0 ? ((buyBoxWins / totalAsins) * 100).toFixed(0) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new ASIN
exports.createAsin = async (req, res) => {
  try {
    const asin = new Asin(req.body);

    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = isAdmin || req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

    if (!isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to create ASIN for this seller' });
    }

    await asin.save();

    // Update seller ASIN count
    await updateSellerAsinCount(asin.seller);

    // BACKGROUND: Automate URL Injection & Scrape
    if (marketDataSyncService.isConfigured()) {
      marketDataSyncService.syncSellerAsinsToOctoparse(asin.seller, { triggerScrape: true })
        .catch(err => console.error(`⚠️ Automation: Failed to sync ASIN ${asin.asinCode}:`, err.message));
    }

    res.status(201).json(asin);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'ASIN already exists for this seller' });
    }
    res.status(500).json({ error: error.message });
  }
};

// Bulk create ASINs
exports.createAsins = async (req, res) => {
  try {
    const { asins } = req.body;

    if (!asins || !Array.isArray(asins)) {
      return res.status(400).json({ error: 'ASINs array required' });
    }

    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    // Verify all asins belong to allowed sellers
    for (const a of asins) {
      if (!isAdmin && !allowedSellerIds.includes(a.seller)) {
        return res.status(403).json({ error: `Unauthorized to create ASIN for seller ${a.seller}` });
      }
    }

    // Use bulkWrite to perform upserts, avoiding duplicate key errors
    const bulkOps = asins.map(a => {
      const filter = { asinCode: a.asinCode };
      if (a.seller) {
        filter.seller = a.seller;
      } else {
        filter.seller = { $exists: false }; // Match global ASINs
      }
      return {
        updateOne: {
          filter: filter,
          update: { $setOnInsert: a },
          upsert: true
        }
      };
    });

    const asinsResult = await Asin.bulkWrite(bulkOps, { ordered: false });

    // Update seller counts
    const sellerIds = [...new Set(asins.map(a => a.seller).filter(Boolean))];
    for (const sellerId of sellerIds) {
      await updateSellerAsinCount(sellerId);

      // BACKGROUND: Automate URL Injection & Scrape for newly added/updated ASINs
      // The service now handles concurrency locking to prevent multiple overlapping syncs for the same seller.
      if (marketDataSyncService.isConfigured()) {
        console.log(`🤖 Automated Sync Trigger for seller: ${sellerId}`);
        marketDataSyncService.syncSellerAsinsToOctoparse(sellerId, { triggerScrape: true })
          .catch(err => console.error(`⚠️ Automation: Failed to sync ASINs for seller ${sellerId}:`, err.message));
      }
    }

    res.status(201).json({
      message: 'ASINs processed successfully',
      insertedCount: asinsResult.upsertedCount,
      matchedCount: asinsResult.matchedCount,
      upsertedIds: asinsResult.upsertedIds
    });
  } catch (error) {
    console.error('Bulk Insert Error:', error);
    res.status(500).json({ error: 'Failed to process bulk ASINs' });
  }
};

// Update ASIN
exports.updateAsin = async (req, res) => {
  try {
    const asin = await Asin.findById(req.params.id);
    if (!asin) {
      return res.status(404).json({ error: 'ASIN not found' });
    }

    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = isAdmin || req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

    if (!isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to update this ASIN' });
    }

    const updatedAsin = await Asin.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (req.body.status && req.body.status !== asin.status) {
      await updateSellerAsinCount(asin.seller);
    }

    res.json(updatedAsin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Bulk update ASINs
exports.bulkUpdateAsins = async (req, res) => {
  try {
    const { ids, updates } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array required' });
    }

    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    // Check all IDs belong to allowed sellers
    const asins = await Asin.find({ _id: { $in: ids } });
    for (const asin of asins) {
      if (!isAdmin && !allowedSellerIds.includes(asin.seller.toString())) {
        return res.status(403).json({ error: 'Unauthorized to update some of the selected ASINs' });
      }
    }

    const result = await Asin.updateMany(
      { _id: { $in: ids } },
      { $set: updates }
    );

    res.json({
      message: 'ASINs updated successfully',
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete ASIN
exports.deleteAsin = async (req, res) => {
  try {
    const asin = await Asin.findById(req.params.id);
    if (!asin) {
      return res.status(404).json({ error: 'ASIN not found' });
    }

    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = isAdmin || req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

    if (!isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to delete this ASIN' });
    }

    const sellerId = asin.seller;
    await asin.deleteOne();

    // Update seller ASIN count
    await updateSellerAsinCount(sellerId);

    res.json({ message: 'ASIN deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Bulk delete ASINs
exports.bulkDeleteAsins = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs array required' });
    }

    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const allowedSellerIds = !isAdmin ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    const asins = await Asin.find({ _id: { $in: ids } });
    for (const asin of asins) {
      if (!isAdmin && !allowedSellerIds.includes(asin.seller.toString())) {
        return res.status(403).json({ error: 'Unauthorized to delete some of the selected ASINs' });
      }
    }

    const sellerIds = [...new Set(asins.map(a => a.seller))];

    await Asin.deleteMany({ _id: { $in: ids } });

    // Update seller counts
    for (const sellerId of sellerIds) {
      await updateSellerAsinCount(sellerId);
    }

    res.json({ message: 'ASINs deleted successfully', deletedCount: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Search ASINs
exports.searchAsins = async (req, res) => {
  try {
    const { q, seller } = req.query;
    const filter = {};

    // Enforce isolation
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    if (!isAdmin) {
      const allowedSellerIds = req.user.assignedSellers.map(s => s._id);

      if (seller && allowedSellerIds.some(id => id.toString() === seller)) {
        filter.seller = seller;
      } else {
        filter.seller = { $in: allowedSellerIds };
      }
    } else if (seller) {
      filter.seller = seller;
    }

    if (q) {
      filter.$or = [
        { asinCode: { $regex: q, $options: 'i' } },
        { title: { $regex: q, $options: 'i' } },
        { brand: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
      ];
    }

    const asins = await Asin.find(filter)
      .populate('seller', 'name')
      .limit(50);

    res.json(asins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Generate AI images for ASIN
exports.generateImages = async (req, res) => {
  console.log(`[DEBUG] generateImages called for ID: ${req.params.id}`);
  try {
    const asin = await Asin.findById(req.params.id);
    if (!asin) {
      return res.status(404).json({ error: 'ASIN not found' });
    }

    // Security check
    const isAdmin = req.user && req.user.role && req.user.role.name === 'admin';
    const isAssigned = isAdmin || req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

    if (!isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to generate images for this ASIN' });
    }

    const imageUrl = await imageGenerationService.triggerAiImageTask(asin._id);
    
    res.json({
      success: true,
      message: 'AI image generated successfully',
      imageUrl
    });
  } catch (error) {
    console.error('Image Generation Error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate AI image' });
  }
};

// Helper function to update seller ASIN counts
async function updateSellerAsinCount(sellerId) {
  if (!sellerId) return;

  try {
    const total = await Asin.countDocuments({ seller: sellerId });
    const active = await Asin.countDocuments({ seller: sellerId, status: 'Active' });

    await Seller.findByIdAndUpdate(sellerId, {
      totalAsins: total,
      activeAsins: active,
    });
  } catch (error) {
    console.error('Error updating seller ASIN count:', error);
  }
}

module.exports = exports;
