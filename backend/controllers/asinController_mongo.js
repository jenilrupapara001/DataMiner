const Asin = require('../models/Asin');
const Seller = require('../models/Seller');
const imageGenerationService = require('../services/imageGenerationService');
const path = require('path');
const fs = require('fs');
const marketDataSyncService = require('../services/marketDataSyncService');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');

// Get all ASINs
exports.getAsins = async (req, res) => {
  try {
    const {
      seller, status, category, brand, search,
      minPrice, maxPrice, minBSR, maxBSR, minLQS, maxLQS,
      scrapeStatus, buyBoxWin, hasAplus,
      page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;
    const filter = {};

    // [1] User Scope / Seller Filtering
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    if (!isGlobalUser) {
      if (!req.user || !req.user.assignedSellers) {
        return res.json({ asins: [], pagination: { page: 1, limit: parseInt(limit), total: 0 } });
      }
      const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());

      if (seller && mongoose.Types.ObjectId.isValid(seller) && allowedSellerIds.includes(seller)) {
        filter.seller = seller;
      } else {
        filter.seller = { $in: allowedSellerIds };
      }
    } else if (seller && mongoose.Types.ObjectId.isValid(seller)) {
      filter.seller = seller;
    }

    // [2] Advanced Searching (Global)
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { asinCode: searchRegex },
        { title: searchRegex },
        { sku: searchRegex }
      ];
    }

    // [3] Exact Match Filters
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (brand) filter.brand = brand;
    if (scrapeStatus) filter.scrapeStatus = scrapeStatus;

    if (buyBoxWin !== undefined && buyBoxWin !== '') {
      filter.buyBoxWin = buyBoxWin === 'true' || buyBoxWin === true;
    }
    if (hasAplus !== undefined && hasAplus !== '') {
      filter.hasAplus = hasAplus === 'true' || hasAplus === true;
    }

    // [4] Numeric Range Filters
    if (minPrice || maxPrice) {
      filter.currentPrice = {};
      if (minPrice) filter.currentPrice.$gte = parseFloat(minPrice);
      if (maxPrice) filter.currentPrice.$lte = parseFloat(maxPrice);
    }
    if (minBSR || maxBSR) {
      filter.bsr = {};
      if (minBSR) filter.bsr.$gte = parseInt(minBSR);
      if (maxBSR) filter.bsr.$lte = parseInt(maxBSR);
    }
    if (minLQS || maxLQS) {
      filter.lqs = {};
      if (minLQS) filter.lqs.$gte = parseInt(minLQS);
      if (maxLQS) filter.lqs.$lte = parseInt(maxLQS);
    }

    const sortOptions = {}; // Initializing properly
    if (sortBy === 'status') {
      sortOptions.status = 1; // 'Active' first
    }
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const asins = await Asin.find(filter)
      .select('asinCode title sku currentPrice mrp uploadedPrice bsr subBSRs subBsr rating reviewCount ratingBreakdown bulletPointsText bulletPoints imageUrl status category soldBy secondAsp soldBySec aspDifference history weekHistory lqs buyBoxWin hasAplus imagesCount descLength lastScraped scrapeStatus dealDetails availabilityStatus aplusAbsentSince aplusPresentSince')
      .populate('seller', 'name marketplace')
      .sort(sortOptions)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean(); // Fast performance

    const total = await Asin.countDocuments(filter);

    // Dynamic Min Date for trends (only on first page for performance)
    let minDate = null;
    if (page == 1) {
      const minDateAgg = await Asin.aggregate([
        { $match: filter },
        { $unwind: "$history" },
        { $group: { _id: null, minDate: { $min: "$history.date" } } }
      ]);
      minDate = minDateAgg[0]?.minDate;
    }

    const processedAsins = asins.map(a => {
        // Map weekHistory to history field expected by frontend UI
        const history = (a.weekHistory || [])
            .slice(-8) // Last 8 entries to match asinTableService
            .map(h => ({
                week: h.week,
                date: h.date ? h.date.toISOString().split('T')[0] : '',
                price: h.price || 0,
                bsr: h.bsr || 0,
                rating: h.rating || 0,
                reviews: h.reviews || 0
            }));

        const win = isBuyBoxWinner(a.soldBy);
        if (a.soldBy && a.soldBy.toLowerCase().includes('cocoblu')) {
            console.log(`[BuyBox Trace] ASIN: ${a.asinCode} | SoldBy: "${a.soldBy}" | Win: ${win}`);
        }
        return { ...a, history, buyBoxWin: win };
    });

    res.json({
      asins: processedAsins,
      minDate,
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

      if (seller && mongoose.Types.ObjectId.isValid(seller) && allowedSellerIds.some(id => id.toString() === seller)) {
        filter.seller = seller;
      } else {
        filter.seller = { $in: allowedSellerIds };
      }
    } else if (seller && mongoose.Types.ObjectId.isValid(seller)) {
      filter.seller = seller;
    }

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (req.query.brand) filter.brand = req.query.brand;

     const asins = await Asin.find(filter)
       .select('asinCode title sku currentPrice mrp uploadedPrice bsr subBSRs subBsr rating reviewCount ratingBreakdown bulletPointsText bulletPoints imageUrl status category soldBy secondAsp soldBySec aspDifference history weekHistory lqs buyBoxWin hasAplus imagesCount descLength lastScraped scrapeStatus dealDetails availabilityStatus aplusAbsentSince aplusPresentSince')
       .populate('seller', 'name marketplace')
       .sort({ status: 1, title: -1, createdAt: -1 })
       .lean(); // Use lean for faster performance

     // Map weekHistory to history field for frontend compatibility
     const processedAsins = asins.map(a => {
         const history = (a.weekHistory || [])
             .slice(-8)
             .map(h => ({
                 week: h.week,
                 date: h.date ? h.date.toISOString().split('T')[0] : '',
                 price: h.price || 0,
                 bsr: h.bsr || 0,
                 rating: h.rating || 0,
                 reviews: h.reviews || 0
             }));

         return { ...a, history, buyBoxWin: isBuyBoxWinner(a.soldBy) };
     });

     res.json({
       success: true,
       data: processedAsins,
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
      asins: asins.map(a => ({ ...a.toObject ? a.toObject() : a, buyBoxWin: isBuyBoxWinner(a.soldBy) })),
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
      // Added rawOctoparseData for inspection

    if (!asin) {
      return res.status(404).json({ error: 'ASIN not found' });
    }

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = req.user && req.user.assignedSellers.some(s => s._id.toString() === asin.seller._id.toString());

    if (!isGlobalUser && !isAssigned) {
      return res.status(403).json({ error: 'Unauthorized access to ASIN details' });
    }

    const asinObj = asin.toObject ? asin.toObject() : asin;
    res.json({ ...asinObj, buyBoxWin: isBuyBoxWinner(asin.soldBy) });
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

    res.json(asins.map(a => ({ ...a.toObject ? a.toObject() : a, buyBoxWin: isBuyBoxWinner(a.soldBy) })));
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
      const allowedSellerIds = req.user.assignedSellers.map(s => s._id.toString());

      if (seller && mongoose.Types.ObjectId.isValid(seller) && allowedSellerIds.includes(seller.toString())) {
        filter.seller = new mongoose.Types.ObjectId(seller);
      } else {
        filter.seller = { $in: allowedSellerIds.map(id => new mongoose.Types.ObjectId(id)) };
      }
    } else if (seller && mongoose.Types.ObjectId.isValid(seller)) {
      filter.seller = new mongoose.Types.ObjectId(seller);
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
    await updateSellerAsinCount(asin.seller, req.app.get('io'));

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
        // Initialize A+ absence tracking if not provided
        if (a.hasAplus === undefined || a.hasAplus === false) {
          a.aplusAbsentSince = new Date();
        } else if (a.hasAplus === true) {
          a.aplusPresentSince = new Date();
        }
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
        await updateSellerAsinCount(sellerId, req.app.get('io'));
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
      await updateSellerAsinCount(asin.seller, req.app.get('io'));
    }

    const asinObj = updatedAsin.toObject ? updatedAsin.toObject() : updatedAsin;
    res.json({ ...asinObj, buyBoxWin: isBuyBoxWinner(updatedAsin.soldBy) });
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
    await updateSellerAsinCount(sellerId, req.app.get('io'));

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

    const asinsToDelete = await Asin.find({ _id: { $in: ids } }).select('seller');
    const sellerIds = [...new Set(asinsToDelete.map(a => a.seller.toString()))];

    await Asin.deleteMany({ _id: { $in: ids } });

    // Update seller counts
    for (const sellerId of sellerIds) {
      const seller = await Seller.findById(sellerId);
      if (seller) {
        const count = await Asin.countDocuments({ seller: sellerId, status: 'Active' });
        seller.asinCount = count;
        await seller.save();
      }
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

    res.json(asins.map(a => ({ ...a.toObject ? a.toObject() : a, buyBoxWin: isBuyBoxWinner(a.soldBy) })));
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
async function updateSellerAsinCount(sellerId, io) {
  if (!sellerId) return;
  try {
    const totalAsins = await Asin.countDocuments({ seller: sellerId });
    const activeAsins = await Asin.countDocuments({ seller: sellerId, status: 'Active' });
    await Seller.findByIdAndUpdate(sellerId, { totalAsins, activeAsins });
    
    // Emit socket event for real-time UI updates
    if (io) {
      io.emit('SELLERS_UPDATED', { sellerId });
    }
  } catch (error) {
    console.error('Error updating seller ASIN count:', error);
  }
}

// Import ASINs from CSV/Excel (ASIN, SKU)
exports.importFromCsv = async (req, res) => {
  try {
    const { sellerId } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // [1] Load workbook
    const workbook = XLSX.readFile(req.file.path);

    // Find the first sheet that actually has data
    let worksheet = null;
    let data = [];

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (jsonData && jsonData.length > 0) {
        worksheet = sheet;
        data = jsonData;
        break;
      }
    }

    if (!data || data.length === 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'The file appears to be empty or has no valid headers.' });
    }

    // Helper to find a value by flexible key matching
    const getValue = (row, possibleKeys) => {
      const rowKeys = Object.keys(row);
      const rowKeysClean = rowKeys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));

      for (const targetKey of possibleKeys) {
        const cleanTarget = targetKey.toLowerCase().replace(/[^a-z0-9]/g, '');
        const index = rowKeysClean.indexOf(cleanTarget);
        if (index !== -1) return row[rowKeys[index]];
      }
      return undefined;
    };

    const errors = [];
    const bulkOps = [];
    let updatedCount = 0;
    let insertedCount = 0;

    // [2] Pre-process: Collect all unique identifiers (flexible matching) to fetch existing records in one go
    const identifiers = [...new Set(data
      .map(row => {
        const rawId = getValue(row, ['Identifier', 'ASIN']);
        return (rawId || '').toString().trim().toUpperCase();
      })
      .filter(id => id.length >= 5)
    )];

    // Fetch existing ASINs for this seller and these identifiers in a single query
    const existingAsins = await Asin.find({
      seller: sellerId,
      asinCode: { $in: identifiers }
    }).select('asinCode');

    const existingCodes = new Set(existingAsins.map(a => a.asinCode));

    // [3] Process rows and build bulk operations
    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Flexible header matching
      const rawIdentifier = getValue(row, ['Identifier', 'ASIN']);
      const identifier = (rawIdentifier || '').toString().trim().toUpperCase();

      const rawSku = getValue(row, ['SKU']);
      const sku = (rawSku || '').toString().trim();

      if (!identifier || identifier.length < 5) {
        if (Object.values(row).some(v => v !== "")) {
          errors.push(`Row ${i + 2}: Missing Identifier (ASIN)`);
        }
        continue;
      }

      if (existingCodes.has(identifier)) {
        // Prepare update operation
        bulkOps.push({
          updateOne: {
            filter: { asinCode: identifier, seller: sellerId },
            update: { $set: { sku: sku } }
          }
        });
        updatedCount++;
      } else {
        // Prepare insert operation
        bulkOps.push({
          insertOne: {
            document: {
              asinCode: identifier,
              sku: sku,
              seller: sellerId,
              status: 'Active',
              scrapeStatus: 'PENDING'
            }
          }
        });
        insertedCount++;
      }
    }

    // [4] Execute Bulk Operations (maximum performance)
    if (bulkOps.length > 0) {
      await Asin.bulkWrite(bulkOps, { ordered: false });
    }

    // [5] Finalization
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    const seller = await Seller.findById(sellerId);
    if (seller) {
      const count = await Asin.countDocuments({ seller: sellerId, status: 'Active' });
      seller.asinCount = count;
      await seller.save();
    }

    if (marketDataSyncService.isConfigured() && (insertedCount > 0 || updatedCount > 0)) {
      marketDataSyncService.syncSellerAsinsToOctoparse(sellerId, { triggerScrape: true })
        .catch(err => console.error('[import] Sync trigger failed:', err.message));
    }

    res.json({
      success: true,
      message: `Successfully processed ${data.length} rows.`,
      details: {
        inserted: insertedCount,
        updated: updatedCount,
        ignored: errors.length,
        sampleErrors: errors.slice(0, 5)
      }
    });

  } catch (error) {
    console.error('[import] General Error:', error);
    if (req.file && req.file.path) {
      try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (e) { }
    }
    res.status(500).json({ error: error.message || 'Server error during file processing' });
  }
};



// Get unique brands for filtering
exports.getAsinBrands = async (req, res) => {
  try {
    const filter = {};
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    if (!isGlobalUser) {
      if (!req.user || !req.user.assignedSellers || req.user.assignedSellers.length === 0) {
        return res.json({ success: true, data: [] });
      }
      // Ensure we extract IDs safely from assignedSellers which could be objects or IDs
      const sellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());
      filter.seller = { $in: sellerIds };
    }

    const brands = await Asin.distinct('brand', filter);
    const cleanBrands = brands.filter(Boolean).sort();

    res.json({
      success: true,
      data: cleanBrands
    });
  } catch (error) {
    console.error('[getAsinBrands] Error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unique brands: ' + error.message });
  }
};

// Trigger direct repair job for a seller's incomplete ASINs
exports.repairIncompleteAsins = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const userId = req.user._id;

    const scraperRunner = require('../services/scraperRunner');
    const result = await scraperRunner.startRepairJob(sellerId, userId);

    res.json({
      success: true,
      message: 'Repair job started successfully',
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get current status of a repair job
exports.getRepairJobStatus = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const scraperRunner = require('../services/scraperRunner');
    const status = await scraperRunner.getJobStatus(sellerId);

    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get unique filter options for the user's scope
exports.getAsinFilterOptions = async (req, res) => {
  try {
    const filter = {};
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    if (!isGlobalUser) {
      const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());
      filter.seller = { $in: allowedSellerIds };
    }

    // Get unique categories and brands concurrently
    const [categories, brands] = await Promise.all([
      Asin.distinct('category', filter),
      Asin.distinct('brand', filter),
    ]);

    res.json({
      success: true,
      data: {
        categories: categories.filter(Boolean).sort(),
        brands: brands.filter(Boolean).sort(),
        scrapeStatuses: ['PENDING', 'SCRAPING', 'COMPLETED', 'FAILED'],
        statuses: ['Active', 'Pending', 'Scraping', 'Error', 'Paused']
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateSellerAsinCount = updateSellerAsinCount;
module.exports = exports;

