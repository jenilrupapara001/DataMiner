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
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    
    if (!isGlobalUser) {
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
    if (req.query.brand) filter.brand = req.query.brand;

    const sortOptions = {
      status: 1, // 'Active' comes before 'Pending'/'Scraping'
      title: -1  // Non-null titles first
    };
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const asins = await Asin.find(filter)
      .select('asinCode title sku currentPrice uploadedPrice bsr subBSRs rating reviewCount ratingBreakdown bulletPointsText bulletPoints imageUrl status category soldBy history weekHistory lqs buyBoxWin hasAplus imagesCount descLength lastScraped scrapeStatus dealDetails')
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
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    
    if (!isGlobalUser) {
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
    if (req.query.brand) filter.brand = req.query.brand;

    const asins = await Asin.find(filter)
      .select('asinCode title sku currentPrice uploadedPrice bsr subBSRs rating reviewCount ratingBreakdown bulletPointsText bulletPoints imageUrl status category soldBy history weekHistory lqs buyBoxWin hasAplus imagesCount descLength lastScraped scrapeStatus dealDetails')
      .populate('seller', 'name marketplace')
      .sort({ status: 1, title: -1, createdAt: -1 });


    res.json({
      success: true,
      data: asins,
      count: asins.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get ASINs by seller (Paginated for performance)
exports.getAsinsBySeller = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === req.params.sellerId);

    if (!isGlobalUser && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized access to seller data' });
    }

    const query = { seller: req.params.sellerId };
    
    const [asins, total] = await Promise.all([
      Asin.find(query)
        .populate('seller', 'name marketplace')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Asin.countDocuments(query)
    ]);

    res.json({
      asins,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === asin.seller._id.toString());

    if (!isGlobalUser && !isAssigned) {
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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

    if (!isGlobalUser && !isAssigned) {
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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

    if (!isGlobalUser && !isAssigned) {
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
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const allowedSellerIds = !isGlobalUser ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    for (const update of updates) {
      const asin = await Asin.findById(update.asinId);
      if (asin) {
        // Security check
        const isAssigned = isGlobalUser || allowedSellerIds.includes(asin.seller.toString());

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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    if (!isGlobalUser) {
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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    if (!isGlobalUser) {
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
      { $match: { ...filter, bsr: { $gt: 0 } } },
      { $group: { _id: null, avgBSR: { $avg: '$bsr' } } },
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

    // Get best selling ASINs (lowest BSR)
    const bestSellingAsins = await Asin.find({ ...filter, bsr: { $gt: 0 }, status: 'Active' })
      .sort({ bsr: 1 })
      .limit(5)
      .select('asinCode bsr title currentPrice')
      .lean();

    // Review analysis - last 7 days vs current 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);

    // Current week reviews (last 7 days) - from ratingHistory
    const currentWeekReviews = await Asin.aggregate([
      { 
        $match: { 
          ...filter,
          ratingHistory: { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$ratingHistory' },
      { 
        $match: { 
          'ratingHistory.date': { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$ratingHistory.reviewCount' }
        }
      }
    ]);

    // Previous week reviews (7-14 days ago)
    const previousWeekReviews = await Asin.aggregate([
      { 
        $match: { 
          ...filter,
          ratingHistory: { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$ratingHistory' },
      { 
        $match: { 
          'ratingHistory.date': { $gte: fourteenDaysAgo, $lt: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$ratingHistory.reviewCount' }
        }
      }
    ]);

    // Two weeks ago (14-21 days) for comparison
    const twoWeeksAgoReviews = await Asin.aggregate([
      { 
        $match: { 
          ...filter,
          ratingHistory: { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$ratingHistory' },
      { 
        $match: { 
          'ratingHistory.date': { $gte: twentyOneDaysAgo, $lt: fourteenDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$ratingHistory.reviewCount' }
        }
      }
    ]);

    const currentWeekTotal = currentWeekReviews[0]?.total || 0;
    const previousWeekTotal = previousWeekReviews[0]?.total || 0;
    const twoWeeksTotal = twoWeeksAgoReviews[0]?.total || 0;

    // Calculate change percentages
    const currentVsPreviousChange = previousWeekTotal > 0 
      ? (((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100).toFixed(1) 
      : 0;
    const previousVsTwoWeeksChange = twoWeeksTotal > 0 
      ? (((previousWeekTotal - twoWeeksTotal) / twoWeeksTotal) * 100).toFixed(1) 
      : 0;

    const avgImages = await Asin.aggregate([
      { $match: filter },
      { $group: { _id: null, avgImages: { $avg: '$imagesCount' } } },
    ]);

    const avgBullets = await Asin.aggregate([
      { $match: filter },
      { $group: { _id: null, avgBullets: { $avg: '$bulletPoints' } } },
    ]);

    res.json({
      total: totalAsins,
      active: activeAsins,
      statusBreakdown: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      avgLQS: avgLQS[0]?.avgLQS?.toFixed(2) || 0,
      avgPrice: avgPrice[0]?.avgPrice?.toFixed(2) || 0,
      avgBSR: avgBSR[0]?.avgBSR?.toFixed(0) || 0,
      avgImages: avgImages[0]?.avgImages?.toFixed(1) || 0,
      avgBullets: avgBullets[0]?.avgBullets?.toFixed(1) || 0,
      totalReviews: totalReviews[0]?.totalReviews || 0,
      buyBoxRate: totalAsins > 0 ? ((buyBoxWins / totalAsins) * 100).toFixed(0) : 0,
      bestSellingAsins,
      reviewAnalysis: {
        currentWeek: currentWeekTotal,
        previousWeek: previousWeekTotal,
        twoWeeksAgo: twoWeeksTotal,
        currentVsPreviousChange: parseFloat(currentVsPreviousChange),
        previousVsTwoWeeksChange: parseFloat(previousVsTwoWeeksChange),
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create new ASIN
exports.createAsin = async (req, res) => {
  try {
    // Keep asinCode as entered (preserve original case)
    const asin = new Asin(req.body);

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = isGlobalUser || req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const allowedSellerIds = !isGlobalUser ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    // Identify sellers in this batch
    const sellerIds = [...new Set(asins.map(a => a.seller).filter(Boolean))];

    // Verify all asins belong to allowed sellers
    for (const a of asins) {
      if (!isGlobalUser && !allowedSellerIds.includes(a.seller)) {
        return res.status(403).json({ error: `Unauthorized to create ASIN for seller ${a.seller}` });
      }
    }

    // Step 1: Identify duplicates before insertion
    const existingAsins = await Asin.find({
      $or: asins.map(a => ({
        asinCode: a.asinCode,
        seller: a.seller || { $exists: false }
      }))
    }).select('asinCode seller');

    const existingCodes = existingAsins.map(a => `${a.asinCode}-${a.seller ? a.seller.toString() : 'global'}`);
    const duplicates = [];
    const newAsins = [];

    for (const a of asins) {
      const key = `${a.asinCode}-${a.seller ? a.seller.toString() : 'global'}`;
      if (existingCodes.includes(key)) {
        duplicates.push(a.asinCode);
      } else {
        newAsins.push(a);
      }
    }

    // Step 2: Only proceed with bulkWrite if there are new ASINs
    let asinsResult = { upsertedCount: 0, matchedCount: 0, upsertedIds: {} };
    if (newAsins.length > 0) {
      const bulkOps = newAsins.map(a => {
        const filter = { asinCode: a.asinCode };
        if (a.seller) {
          filter.seller = a.seller;
        } else {
          filter.seller = { $exists: false };
        }
        return {
          updateOne: {
            filter: filter,
            update: { $setOnInsert: a },
            upsert: true
          }
        };
      });
      asinsResult = await Asin.bulkWrite(bulkOps, { ordered: false });

      // Step 3: Post-Update counts and sync
      for (const sellerId of sellerIds) {
        await updateSellerAsinCount(sellerId);
        if (marketDataSyncService.isConfigured()) {
          console.log(`🤖 Automated Sync Trigger for seller: ${sellerId}`);
          marketDataSyncService.syncSellerAsinsToOctoparse(sellerId, { triggerScrape: true })
            .catch(err => console.error(`⚠️ Automation: Failed to sync ASINs for seller ${sellerId}:`, err.message));
        }
      }
    }

    res.status(201).json({
      message: 'ASINs processed successfully',
      insertedCount: newAsins.length,
      duplicates: duplicates,
      duplicatesCount: duplicates.length,
      totalCount: asins.length
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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = isGlobalUser || req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const allowedSellerIds = !isGlobalUser ? req.user.assignedSellers.map(s => s._id.toString()) : [];

    // Check all IDs belong to allowed sellers
    const asins = await Asin.find({ _id: { $in: ids } });
    for (const asin of asins) {
      if (!isGlobalUser && !allowedSellerIds.includes(asin.seller.toString())) {
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

    const roleName = req.user?.role?.name || req.user?.role;
    // ONLY Super Admin can delete ASINs
    if (roleName !== 'admin') {
      return res.status(403).json({ error: 'Only Super Administrators can delete ASINs' });
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

    const roleName = req.user?.role?.name || req.user?.role;
    // ONLY Super Admin can delete ASINs
    if (roleName !== 'admin') {
      return res.status(403).json({ error: 'Only Super Administrators can delete ASINs' });
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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    if (!isGlobalUser) {
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

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = isGlobalUser || req.user.assignedSellers.some(s => s._id.toString() === asin.seller.toString());

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

// Import ASINs from CSV (ASIN, SKU, Price)
exports.importFromCsv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sellerId = req.body.sellerId;
    if (!sellerId) {
      return res.status(400).json({ error: 'Seller ID is required' });
    }

    // Verify seller exists and user has access
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ error: 'Seller not found' });
    }

    // Read and parse CSV file
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    // Skip header row
    const dataLines = lines.slice(1);
    
    const asins = [];
    const errors = [];
    
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;
      
      // Handle both comma and tab delimited
      const parts = line.includes(',') ? line.split(',') : line.split('\t');
      
      if (parts.length < 1) {
        errors.push(`Row ${i + 2}: Invalid format`);
        continue;
      }
      
      const asinCode = parts[0]?.trim().toUpperCase();
      const sku = parts[1]?.trim() || '';
      const price = parseFloat(parts[2]) || 0;
      
      if (!asinCode || asinCode.length < 5) {
        errors.push(`Row ${i + 2}: Invalid ASIN "${parts[0]}"`);
        continue;
      }
      
      asins.push({
        asinCode,
        sku,
        uploadedPrice: price,
        seller: sellerId,
        status: 'Active',
        scrapeStatus: 'PENDING'
      });
    }

    if (asins.length === 0 && errors.length > 0) {
      return res.status(400).json({ 
        error: 'No valid ASINs found', 
        details: errors.slice(0, 5) 
      });
    }

    // Check for duplicates
    const existingAsins = await Asin.find({
      asinCode: { $in: asins.map(a => a.asinCode) },
      seller: sellerId
    }).select('asinCode');

    const existingCodes = new Set(existingAsins.map(a => a.asinCode));
    const newAsins = asins.filter(a => !existingCodes.has(a.asinCode));
    const duplicates = asins.filter(a => existingCodes.has(a.asinCode)).length;

    // Insert new ASINs
    let inserted = 0;
    if (newAsins.length > 0) {
      await Asin.insertMany(newAsins, { ordered: false });
      inserted = newAsins.length;
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Update seller count
    await updateSellerAsinCount(sellerId);

    // Trigger sync if configured
    if (marketDataSyncService.isConfigured() && inserted > 0) {
      marketDataSyncService.syncSellerAsinsToOctoparse(sellerId, { triggerScrape: true })
        .catch(err => console.error('Sync trigger failed:', err.message));
    }

    res.json({
      success: true,
      message: `Imported ${inserted} ASINs from CSV`,
      inserted,
      duplicates,
      errors: errors.slice(0, 10)
    });
  } catch (error) {
    console.error('CSV Import Error:', error);
    // Clean up file if exists
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ error: error.message || 'Failed to import CSV' });
  }
};

module.exports = exports;
// Get unique brands for filtering
exports.getAsinBrands = async (req, res) => {
  try {
    const filter = {};
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    
    if (!isGlobalUser) {
      if (!req.user.assignedSellers || req.user.assignedSellers.length === 0) {
        return res.json({ success: true, data: [] });
      }
      filter.seller = { $in: req.user.assignedSellers.map(s => s._id || s) };
    }

    const brands = await Asin.distinct('brand', filter);
    const cleanBrands = brands.filter(Boolean).sort();

    res.json({
      success: true,
      data: cleanBrands
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
