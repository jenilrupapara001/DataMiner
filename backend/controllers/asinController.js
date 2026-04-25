const { sql, getPool, generateId } = require('../database/db');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');
const marketDataSyncService = require('../services/marketDataSyncService');
const imageGenerationService = require('../services/imageGenerationService');
const XLSX = require('xlsx');
const fs = require('fs');
const AsinDataParser = require('../services/asinDataParser');

/**
 * Get all ASINs (SQL Version)
 */
exports.getAsins = async (req, res) => {
  try {
    const {
      seller, status, category, brand, search,
      minPrice, maxPrice, minBSR, maxBSR, minLQS, maxLQS,
      scrapeStatus, buyBoxWin, hasAplus,
      page = 1, limit = 50, sortBy = 'CreatedAt', sortOrder = 'DESC'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    const pool = await getPool();
    const request = pool.request();
    let whereClause = 'WHERE 1=1';

    // [1] User Scope / Seller Filtering
    if (!isGlobalUser) {
      const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());
      if (allowedSellerIds.length === 0) {
        return res.json({ asins: [], pagination: { page: pageNum, limit: limitNum, total: 0 } });
      }
      
      if (seller && allowedSellerIds.includes(seller)) {
        whereClause += ' AND a.SellerId = @seller';
        request.input('seller', sql.VarChar, seller);
      } else {
        whereClause += ` AND a.SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
      }
    } else if (seller) {
      whereClause += ' AND a.SellerId = @seller';
      request.input('seller', sql.VarChar, seller);
    }

    // [2] Filters
    if (status) {
      whereClause += ' AND Status = @status';
      request.input('status', sql.NVarChar, status);
    }
    if (category) {
      whereClause += ' AND Category = @category';
      request.input('category', sql.NVarChar, category);
    }
    if (brand) {
      whereClause += ' AND Brand = @brand';
      request.input('brand', sql.NVarChar, brand);
    }
    if (scrapeStatus) {
      whereClause += ' AND ScrapeStatus = @scrapeStatus';
      request.input('scrapeStatus', sql.NVarChar, scrapeStatus);
    }
    if (hasAplus !== undefined && hasAplus !== '') {
      whereClause += ' AND HasAplus = @hasAplus';
      request.input('hasAplus', sql.Bit, hasAplus === 'true' ? 1 : 0);
    }
    if (buyBoxWin !== undefined && buyBoxWin !== '') {
      whereClause += ' AND BuyBoxStatus = @buyBoxStatus';
      request.input('buyBoxStatus', sql.Bit, buyBoxWin === 'true' ? 1 : 0);
    }

    // [3] Numeric Ranges
    if (minPrice) {
      whereClause += ' AND CurrentPrice >= @minPrice';
      request.input('minPrice', sql.Decimal(18, 2), parseFloat(minPrice));
    }
    if (maxPrice) {
      whereClause += ' AND CurrentPrice <= @maxPrice';
      request.input('maxPrice', sql.Decimal(18, 2), parseFloat(maxPrice));
    }
    if (minBSR) {
      whereClause += ' AND BSR >= @minBSR';
      request.input('minBSR', sql.Int, parseInt(minBSR));
    }
    if (maxBSR) {
      whereClause += ' AND BSR <= @maxBSR';
      request.input('maxBSR', sql.Int, parseInt(maxBSR));
    }
    if (minLQS) {
      whereClause += ' AND LQS >= @minLQS';
      request.input('minLQS', sql.Decimal(5, 2), parseFloat(minLQS));
    }
    if (maxLQS) {
      whereClause += ' AND LQS <= @maxLQS';
      request.input('maxLQS', sql.Decimal(5, 2), parseFloat(maxLQS));
    }

    // [4] Search
    if (search) {
      whereClause += ' AND (AsinCode LIKE @search OR Title LIKE @search OR Sku LIKE @search)';
      request.input('search', sql.NVarChar, `%${search}%`);
    }

    // [5] Count Total
    const countResult = await request.query(`SELECT COUNT(*) as total FROM Asins a ${whereClause}`);
    const total = countResult.recordset[0].total;

    // [6] Fetch ASINs
    // Map sortBy from frontend names to SQL column names if necessary
    const sortField = sortBy === 'asinCode' ? 'AsinCode' : 
                      sortBy === 'currentPrice' ? 'CurrentPrice' : 
                      sortBy === 'bsr' ? 'BSR' : 
                      sortBy === 'lqs' ? 'LQS' : 
                      sortBy === 'status' ? 'Status' : 'CreatedAt';
    
    const asinsResult = await request
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, limitNum)
        .query(`
            SELECT a.*, s.Name as sellerName, s.Marketplace as sellerMarketplace
            FROM Asins a
            JOIN Sellers s ON a.SellerId = s.Id
            ${whereClause}
            ORDER BY a.${sortField} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

    const asins = asinsResult.recordset;

    if (asins.length === 0) {
      return res.json({ asins: [], pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
    }

    // [7] Fetch Week History for these ASINs
    const asinIds = asins.map(a => `'${a.Id}'`).join(',');
    const historyResult = await pool.request().query(`
      SELECT * FROM AsinWeekHistory 
      WHERE AsinId IN (${asinIds}) 
      ORDER BY WeekStartDate DESC
    `);
    
    const historyMap = {};
    historyResult.recordset.forEach(h => {
      if (!historyMap[h.AsinId]) historyMap[h.AsinId] = [];
      if (historyMap[h.AsinId].length < 8) {
        historyMap[h.AsinId].push({
          week: h.WeekStartDate ? `W${Math.ceil(new Date(h.WeekStartDate).getDate() / 7)}` : '', // Placeholder week format
          date: h.WeekStartDate ? h.WeekStartDate.toISOString().split('T')[0] : '',
          price: h.AvgPrice || 0,
          bsr: h.AvgBSR || 0,
          rating: h.AvgRating || 0,
          reviews: h.TotalReviews || 0
        });
      }
    });

    // [8] Process for frontend
    const processedAsins = asins.map(a => {
      const history = (historyMap[a.Id] || []).reverse(); // Reverse to get chronological order for sparkline
      return {
        ...a,
        _id: a.Id,
        asinCode: a.AsinCode,
        sku: a.Sku,
        currentPrice: a.CurrentPrice,
        bsr: a.BSR,
        rating: a.Rating,
        reviewCount: a.ReviewCount,
        lqs: a.LQS,
        status: a.Status,
        category: a.Category,
        brand: a.Brand,
        title: a.Title,
        imageUrl: a.ImageUrl,
        lastScraped: a.LastScrapedAt,
        scrapeStatus: a.ScrapeStatus,
        seller: {
          _id: a.SellerId,
          name: a.sellerName,
          marketplace: a.sellerMarketplace
        },
        history,
        buyBoxWin: isBuyBoxWinner(a.SoldBy)
      };
    });

    res.json({
      asins: processedAsins,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error('getAsins Error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get single ASIN (SQL Version)
 */
exports.getAsin = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('id', sql.VarChar, id)
      .query(`
        SELECT a.*, s.Name as sellerName, s.Marketplace as sellerMarketplace, s.SellerId as sellerExtId
        FROM Asins a
        JOIN Sellers s ON a.SellerId = s.Id
        WHERE a.Id = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'ASIN not found' });
    }

    const a = result.recordset[0];

    // User Scope Check
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = isGlobalUser || (req.user && req.user.assignedSellers.some(s => (s._id || s).toString() === a.SellerId));

    if (!isAssigned) {
      return res.status(403).json({ error: 'Unauthorized access to ASIN details' });
    }

    // Map to Frontend Object
    const asin = {
      ...a,
      _id: a.Id,
      asinCode: a.AsinCode,
      seller: {
        _id: a.SellerId,
        name: a.sellerName,
        marketplace: a.sellerMarketplace,
        sellerId: a.sellerExtId
      },
      buyBoxWin: isBuyBoxWinner(a.SoldBy)
    };

    res.json(asin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get ASIN Trends (SQL Version)
 */
exports.getAsinTrends = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    // 1. Fetch ASIN
    const asinResult = await pool.request()
      .input('id', sql.VarChar, id)
      .query('SELECT * FROM Asins WHERE Id = @id');

    if (asinResult.recordset.length === 0) {
      return res.status(404).json({ error: 'ASIN not found' });
    }
    const asin = asinResult.recordset[0];

    // 2. Fetch History
    const historyResult = await pool.request()
      .input('id', sql.VarChar, id)
      .query('SELECT * FROM AsinWeekHistory WHERE AsinId = @id ORDER BY WeekStartDate ASC');

    const weekHistory = historyResult.recordset.map(h => ({
      week: h.WeekStartDate ? `W${Math.ceil(new Date(h.WeekStartDate).getDate() / 7)}` : '',
      date: h.WeekStartDate,
      price: h.AvgPrice || 0,
      bsr: h.AvgBSR || 0,
      rating: h.AvgRating || 0,
      reviews: h.TotalReviews || 0,
      lqs: h.AvgLQS || 0
    }));

    // 3. Calculate Trends
    let trends = null;
    if (weekHistory.length >= 2) {
      const first = weekHistory[0];
      const last = weekHistory[weekHistory.length - 1];
      trends = {
        priceChange: last.price - first.price,
        pricePercent: first.price > 0 ? (((last.price - first.price) / first.price) * 100).toFixed(1) : 0,
        bsrChange: last.bsr - first.bsr,
        bsrPercent: first.bsr > 0 ? (((last.bsr - first.bsr) / first.bsr) * 100).toFixed(1) : 0,
        ratingChange: last.rating - first.rating,
        reviewsChange: last.reviews - first.reviews,
        lqsChange: last.lqs - first.lqs,
      };
    }

    res.json({
      trends,
      weekHistory,
      current: {
        price: asin.CurrentPrice,
        bsr: asin.BSR,
        rating: asin.Rating,
        reviews: asin.ReviewCount,
        lqs: asin.LQS,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get ASIN Stats (SQL Version)
 */
exports.getAsinStats = async (req, res) => {
  try {
    const { seller } = req.query;
    const pool = await getPool();
    const request = pool.request();
    let whereClause = 'WHERE 1=1';

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    if (!isGlobalUser) {
      const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());
      if (seller && allowedSellerIds.includes(seller)) {
        whereClause += ' AND SellerId = @seller';
        request.input('seller', sql.VarChar, seller);
      } else {
        whereClause += ` AND SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
      }
    } else if (seller) {
      whereClause += ' AND SellerId = @seller';
      request.input('seller', sql.VarChar, seller);
    }

    // Status Breakdown
    const statusResult = await request.query(`SELECT Status, COUNT(*) as count FROM Asins ${whereClause} GROUP BY Status`);
    const statusBreakdown = {};
    statusResult.recordset.forEach(r => { statusBreakdown[r.Status] = r.count; });

    // Aggregates
    const aggResult = await request.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN Status = 'Active' THEN 1 ELSE 0 END) as active,
        AVG(CASE WHEN BSR > 0 THEN CAST(BSR AS FLOAT) END) as avgBSR,
        SUM(CAST(ReviewCount AS BIGINT)) as totalReviews,
        AVG(CAST(LQS AS FLOAT)) as avgLQS,
        AVG(CASE WHEN CurrentPrice > 0 THEN CAST(CurrentPrice AS FLOAT) END) as avgPrice
      FROM Asins
      ${whereClause}
    `);

    const aggs = aggResult.recordset[0];

    // Buy Box wins
    const buyBoxResult = await request.query(`SELECT COUNT(*) as count FROM Asins ${whereClause} AND BuyBoxStatus = 1`);
    const buyBoxWins = buyBoxResult.recordset[0].count;

    // Best Selling ASINs
    const bestSellingResult = await request.query(`
      SELECT TOP 5 AsinCode as asinCode, BSR as bsr, Title as title, CurrentPrice as currentPrice
      FROM Asins
      ${whereClause} AND BSR > 0 AND Status = 'Active'
      ORDER BY BSR ASC
    `);

    res.json({
      total: aggs.total || 0,
      active: aggs.active || 0,
      statusBreakdown,
      avgLQS: aggs.avgLQS?.toFixed(2) || 0,
      avgPrice: aggs.avgPrice?.toFixed(2) || 0,
      avgBSR: aggs.avgBSR?.toFixed(0) || 0,
      totalReviews: aggs.totalReviews || 0,
      buyBoxRate: aggs.total > 0 ? ((buyBoxWins / aggs.total) * 100).toFixed(0) : 0,
      bestSellingAsins: bestSellingResult.recordset,
      // Review analysis (Simplified for now, can be expanded with AsinHistory table if needed)
      reviewAnalysis: {
        currentWeek: 0, 
        previousWeek: 0,
        twoWeeksAgo: 0,
        currentVsPreviousChange: 0,
        previousVsTwoWeeksChange: 0,
      }
    });
  } catch (error) {
    console.error('getAsinStats Error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update Seller ASIN Count (Utility)
 */
async function updateSellerAsinCount(sellerId, io) {
  if (!sellerId) return;
  try {
    const pool = await getPool();
    const statsResult = await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN Status = 'Active' THEN 1 ELSE 0 END) as active
        FROM Asins
        WHERE SellerId = @sellerId
      `);
    
    const { total, active } = statsResult.recordset[0];

    await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .input('total', sql.Int, total || 0)
      .input('active', sql.Int, active || 0)
      .query('UPDATE Sellers SET TotalAsins = @total, ActiveAsins = @active WHERE Id = @sellerId');

    if (io) {
      io.emit('SELLERS_UPDATED', { sellerId });
    }
  } catch (error) {
    console.error('Error updating seller ASIN count:', error);
  }
}

/**
 * Create ASIN (SQL Version)
 */
exports.createAsin = async (req, res) => {
  try {
    const { asinCode, seller, status, category, brand, title, imageUrl, sku } = req.body;
    const pool = await getPool();
    const id = generateId();

    // User Scope Check
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = isGlobalUser || (req.user && req.user.assignedSellers.some(s => (s._id || s).toString() === seller));

    if (!isAssigned) {
      return res.status(403).json({ error: 'Unauthorized to create ASIN for this seller' });
    }

    await pool.request()
      .input('id', sql.VarChar, id)
      .input('asinCode', sql.VarChar, asinCode)
      .input('sellerId', sql.VarChar, seller)
      .input('sku', sql.NVarChar, sku || null)
      .input('status', sql.NVarChar, status || 'Active')
      .input('category', sql.NVarChar, category || null)
      .input('brand', sql.NVarChar, brand || null)
      .input('title', sql.NVarChar, title || null)
      .input('imageUrl', sql.NVarChar, imageUrl || null)
      .query(`
        INSERT INTO Asins (Id, AsinCode, SellerId, Sku, Status, Category, Brand, Title, ImageUrl, ScrapeStatus, CreatedAt, UpdatedAt)
        VALUES (@id, @asinCode, @sellerId, @sku, @status, @category, @brand, @title, @imageUrl, 'PENDING', GETDATE(), GETDATE())
      `);

    await updateSellerAsinCount(seller, req.app.get('io'));

    if (marketDataSyncService.isConfigured()) {
      marketDataSyncService.syncSellerAsinsToOctoparse(seller, { triggerScrape: true }).catch(console.error);
    }

    res.status(201).json({ _id: id, asinCode, seller, status });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'ASIN already exists for this seller' });
    }
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update ASIN (SQL Version)
 */
exports.updateAsin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, category, brand, title, imageUrl, sku, currentPrice, bsr, rating, reviewCount } = req.body;
    const pool = await getPool();

    // Fetch existing for auth check
    const existingResult = await pool.request().input('id', sql.VarChar, id).query('SELECT SellerId, Status FROM Asins WHERE Id = @id');
    if (existingResult.recordset.length === 0) return res.status(404).json({ error: 'ASIN not found' });
    const existing = existingResult.recordset[0];

    // User Scope Check
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = isGlobalUser || (req.user && req.user.assignedSellers.some(s => (s._id || s).toString() === existing.SellerId));

    if (!isAssigned) return res.status(403).json({ error: 'Unauthorized to update this ASIN' });

    await pool.request()
      .input('id', sql.VarChar, id)
      .input('sku', sql.NVarChar, sku !== undefined ? sku : null)
      .input('status', sql.NVarChar, status || null)
      .input('category', sql.NVarChar, category || null)
      .input('brand', sql.NVarChar, brand || null)
      .input('title', sql.NVarChar, title || null)
      .input('imageUrl', sql.NVarChar, imageUrl || null)
      .input('price', sql.Decimal(18, 2), currentPrice || null)
      .input('bsr', sql.Int, bsr || null)
      .input('rating', sql.Decimal(3, 2), rating || null)
      .input('reviews', sql.Int, reviewCount || null)
      .query(`
        UPDATE Asins SET 
          Sku = COALESCE(@sku, Sku),
          Status = COALESCE(@status, Status),
          Category = COALESCE(@category, Category),
          Brand = COALESCE(@brand, Brand),
          Title = COALESCE(@title, Title),
          ImageUrl = COALESCE(@imageUrl, ImageUrl),
          CurrentPrice = COALESCE(@price, CurrentPrice),
          BSR = COALESCE(@bsr, BSR),
          Rating = COALESCE(@rating, Rating),
          ReviewCount = COALESCE(@reviews, ReviewCount),
          UpdatedAt = GETDATE()
        WHERE Id = @id
      `);

    if (status && status !== existing.Status) {
      await updateSellerAsinCount(existing.SellerId, req.app.get('io'));
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


/**
 * Delete ASIN (SQL Version)
 */
exports.deleteAsin = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();

    const roleName = req.user?.role?.name || req.user?.role;
    if (roleName !== 'admin') {
      return res.status(403).json({ error: 'Only Super Administrators can delete ASINs' });
    }

    const asinResult = await pool.request().input('id', sql.VarChar, id).query('SELECT SellerId FROM Asins WHERE Id = @id');
    if (asinResult.recordset.length === 0) return res.status(404).json({ error: 'ASIN not found' });
    const { SellerId } = asinResult.recordset[0];

    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM Asins WHERE Id = @id');
    await updateSellerAsinCount(SellerId, req.app.get('io'));

    res.json({ message: 'ASIN deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Bulk Delete ASINs (SQL Version)
 */
exports.bulkDeleteAsins = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'IDs array required' });

    const roleName = req.user?.role?.name || req.user?.role;
    if (roleName !== 'admin') return res.status(403).json({ error: 'Only Super Administrators can delete ASINs' });

    const pool = await getPool();
    const idList = ids.map(id => `'${id}'`).join(',');
    
    const sellersResult = await pool.request().query(`SELECT DISTINCT SellerId FROM Asins WHERE Id IN (${idList})`);
    const sellerIds = sellersResult.recordset.map(r => r.SellerId);

    await pool.request().query(`DELETE FROM Asins WHERE Id IN (${idList})`);

    for (const sellerId of sellerIds) {
      await updateSellerAsinCount(sellerId, req.app.get('io'));
    }

    res.json({ message: 'ASINs deleted successfully', deletedCount: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Search ASINs (SQL Version)
 */
exports.searchAsins = async (req, res) => {
  try {
    const { q, seller } = req.query;
    const pool = await getPool();
    const request = pool.request();
    let whereClause = 'WHERE 1=1';

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    if (!isGlobalUser) {
      const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());
      if (seller && allowedSellerIds.includes(seller)) {
        whereClause += ' AND SellerId = @seller';
        request.input('seller', sql.VarChar, seller);
      } else {
        whereClause += ` AND SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
      }
    } else if (seller) {
      whereClause += ' AND SellerId = @seller';
      request.input('seller', sql.VarChar, seller);
    }

    if (q) {
      whereClause += ' AND (AsinCode LIKE @q OR Title LIKE @q OR Brand LIKE @q OR Sku LIKE @q)';
      request.input('q', sql.NVarChar, `%${q}%`);
    }

    const result = await request.query(`
      SELECT TOP 50 a.*, s.Name as sellerName 
      FROM Asins a 
      JOIN Sellers s ON a.SellerId = s.Id 
      ${whereClause}
    `);

    const asins = result.recordset.map(a => ({
      ...a,
      _id: a.Id,
      asinCode: a.AsinCode,
      seller: { _id: a.SellerId, name: a.sellerName },
      buyBoxWin: isBuyBoxWinner(a.SoldBy)
    }));

    res.json(asins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get Unique Brands (SQL Version)
 */
exports.getAsinBrands = async (req, res) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    let whereClause = 'WHERE Brand IS NOT NULL AND Brand != \'\'';

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    if (!isGlobalUser) {
      const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());
      if (allowedSellerIds.length === 0) return res.json({ success: true, data: [] });
      whereClause += ` AND SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
    }

    const result = await request.query(`SELECT DISTINCT Brand FROM Asins ${whereClause} ORDER BY Brand ASC`);
    res.json({ success: true, data: result.recordset.map(r => r.Brand) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


/**
 * Get Unique Filter Options (SQL Version)
 */
exports.getAsinFilterOptions = async (req, res) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    let whereClause = 'WHERE 1=1';

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    if (!isGlobalUser) {
      const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());
      if (allowedSellerIds.length === 0) {
        return res.json({ success: true, data: { categories: [], brands: [], scrapeStatuses: [], statuses: [] } });
      }
      whereClause += ` AND SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
    }

    const [categoriesResult, brandsResult] = await Promise.all([
      pool.request().query(`SELECT DISTINCT Category FROM Asins ${whereClause} AND Category IS NOT NULL AND Category != '' ORDER BY Category ASC`),
      pool.request().query(`SELECT DISTINCT Brand FROM Asins ${whereClause} AND Brand IS NOT NULL AND Brand != '' ORDER BY Brand ASC`)
    ]);

    res.json({
      success: true,
      data: {
        categories: categoriesResult.recordset.map(r => r.Category),
        brands: brandsResult.recordset.map(r => r.Brand),
        scrapeStatuses: ['PENDING', 'SCRAPING', 'COMPLETED', 'FAILED'],
        statuses: ['Active', 'Pending', 'Scraping', 'Error', 'Paused']
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Trigger Repair Job (SQL Version)
 */
exports.repairIncompleteAsins = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const userId = req.user._id || req.user.id;
    const scraperRunner = require('../services/scraperRunner');
    const result = await scraperRunner.startRepairJob(sellerId, userId);
    res.json({ success: true, message: 'Repair job started successfully', ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get Repair Job Status (SQL Version)
 */
exports.getRepairJobStatus = async (req, res) => {
  try {
    const { sellerId } = req.params;
    const scraperRunner = require('../services/scraperRunner');
    const status = await scraperRunner.getJobStatus(sellerId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


/**
 * Import ASINs from CSV/Excel (SQL Version)
 */
exports.importFromCsv = async (req, res) => {
  try {
    const { sellerId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.readFile(req.file.path);
    let data = [];
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (jsonData && jsonData.length > 0) {
        data = jsonData;
        break;
      }
    }

    if (data.length === 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'The file appears to be empty or has no valid headers.' });
    }

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

    const identifiers = [...new Set(data
      .map(row => (getValue(row, ['Identifier', 'ASIN']) || '').toString().trim().toUpperCase())
      .filter(id => id.length >= 5)
    )];

    const pool = await getPool();
    const idInClause = identifiers.map(id => `'${id}'`).join(',');
    const existingAsinsResult = await pool.request()
      .input('sellerId', sql.VarChar, sellerId)
      .query(`SELECT Id, AsinCode FROM Asins WHERE SellerId = @sellerId AND AsinCode IN (${idInClause})`);
    
    const existingCodes = new Map(existingAsinsResult.recordset.map(a => [a.AsinCode, a.Id]));

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    let insertedCount = 0;
    let updatedCount = 0;
    const errors = [];

    try {
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const identifier = (getValue(row, ['Identifier', 'ASIN']) || '').toString().trim().toUpperCase();
        const sku = (getValue(row, ['SKU']) || '').toString().trim();

        if (!identifier || identifier.length < 5) continue;

        if (existingCodes.has(identifier)) {
          await transaction.request()
            .input('id', sql.VarChar, existingCodes.get(identifier))
            .input('sku', sql.NVarChar, sku)
            .query('UPDATE Asins SET Sku = @sku, UpdatedAt = GETDATE() WHERE Id = @id');
          updatedCount++;
        } else {
           const id = generateId();
          await transaction.request()
            .input('id', sql.VarChar, id)
            .input('asin', sql.VarChar, identifier)
            .input('sellerId', sql.VarChar, sellerId)
            .input('sku', sql.NVarChar, sku)
            .query(`
              INSERT INTO Asins (Id, AsinCode, SellerId, Sku, Status, ScrapeStatus, CreatedAt, UpdatedAt)
              VALUES (@id, @asin, @sellerId, @sku, 'Active', 'PENDING', GETDATE(), GETDATE())
            `);
          insertedCount++;
        }
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    await updateSellerAsinCount(sellerId, req.app.get('io'));

    if (marketDataSyncService.isConfigured() && (insertedCount > 0 || updatedCount > 0)) {
      marketDataSyncService.syncSellerAsinsToOctoparse(sellerId, { triggerScrape: true }).catch(console.error);
    }

    res.json({
      success: true,
      message: `Successfully processed ${data.length} rows.`,
      details: { inserted: insertedCount, updated: updatedCount, ignored: errors.length }
    });

  } catch (error) {
    console.error('[import] Error:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: error.message || 'Server error during file processing' });
  }
};


/**
 * Get ASINs by LQS (SQL Version)
 */
exports.getAsinsByLQS = async (req, res) => {
  req.query.sortBy = 'LQS';
  req.query.sortOrder = 'desc';
  return exports.getAsins(req, res);
};

/**
 * Get All ASINs with History (SQL Version)
 */
exports.getAllAsinsWithHistory = async (req, res) => {
  req.query.limit = 1000; // Large limit for "all"
  return exports.getAsins(req, res);
};

/**
 * Get ASINs by Seller (SQL Version)
 */
exports.getAsinsBySeller = async (req, res) => {
  const { sellerId } = req.params;
  req.query.seller = sellerId;
  return exports.getAsins(req, res);
};

/**
 * Update Week History (SQL Version)
 */
exports.updateWeekHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const weekData = req.body;
    const pool = await getPool();

    // Check ASIN existence
    const asinResult = await pool.request().input('id', sql.VarChar, id).query('SELECT Id FROM Asins WHERE Id = @id');
    if (asinResult.recordset.length === 0) return res.status(404).json({ error: 'ASIN not found' });

    // In SQL, we upsert into AsinWeekHistory
    // weekData has { date, price, bsr, rating, reviews, lqs, ... }
    const weekDate = new Date(weekData.date || new Date());
    weekDate.setHours(0, 0, 0, 0);

    await pool.request()
      .input('asinId', sql.VarChar, id)
      .input('date', sql.DateTime, weekDate)
      .input('price', sql.Decimal(18, 2), weekData.price || 0)
      .input('bsr', sql.Int, weekData.bsr || 0)
      .input('rating', sql.Decimal(3, 2), weekData.rating || 0)
      .input('reviews', sql.Int, weekData.reviews || 0)
      .input('lqs', sql.Decimal(5, 2), weekData.lqs || 0)
      .query(`
        IF EXISTS (SELECT 1 FROM AsinWeekHistory WHERE AsinId = @asinId AND WeekStartDate = @date)
        BEGIN
          UPDATE AsinWeekHistory SET 
            AvgPrice = @price, AvgBSR = @bsr, AvgRating = @rating, TotalReviews = @reviews, AvgLQS = @lqs
          WHERE AsinId = @asinId AND WeekStartDate = @date
        END
        ELSE
        BEGIN
          INSERT INTO AsinWeekHistory (AsinId, WeekStartDate, AvgPrice, AvgBSR, AvgRating, TotalReviews, AvgLQS)
          VALUES (@asinId, @date, @price, @bsr, @rating, @reviews, @lqs)
        END
      `);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


/**
 * Generate AI Images for ASIN (SQL Version)
 */
exports.generateImages = async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool.request().input('id', sql.VarChar, id).query('SELECT SellerId FROM Asins WHERE Id = @id');
    
    if (result.recordset.length === 0) return res.status(404).json({ error: 'ASIN not found' });
    const asin = result.recordset[0];

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
    const isAssigned = isGlobalUser || (req.user && req.user.assignedSellers.some(s => (s._id || s).toString() === asin.SellerId));

    if (!isAssigned) return res.status(403).json({ error: 'Unauthorized to generate images for this ASIN' });

    const imageUrl = await imageGenerationService.triggerAiImageTask(id);
    res.json({ success: true, message: 'AI image generated successfully', imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Bulk Create ASINs (SQL Version)
 */
exports.createAsins = async (req, res) => {
  try {
    const { asins, sellerId } = req.body;
    if (!asins || !Array.isArray(asins)) return res.status(400).json({ error: 'ASINs array required' });

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const item of asins) {
         const id = generateId();
        await transaction.request()
          .input('id', sql.VarChar, id)
          .input('asin', sql.VarChar, item.asinCode)
          .input('sellerId', sql.VarChar, sellerId)
          .input('sku', sql.NVarChar, item.sku || null)
          .query(`
            INSERT INTO Asins (Id, AsinCode, SellerId, Sku, Status, ScrapeStatus, CreatedAt, UpdatedAt)
            VALUES (@id, @asin, @sellerId, @sku, 'Active', 'PENDING', GETDATE(), GETDATE())
          `);
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    await updateSellerAsinCount(sellerId, req.app.get('io'));
    res.json({ success: true, createdCount: asins.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Bulk Update ASINs (SQL Version)
 */
exports.bulkUpdateAsins = async (req, res) => {
  try {
    const { ids, updates } = req.body;
    if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'IDs array required' });

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const idList = ids.map(id => `'${id}'`).join(',');
      const sellersResult = await transaction.request().query(`SELECT DISTINCT SellerId FROM Asins WHERE Id IN (${idList})`);
      const sellerIds = sellersResult.recordset.map(r => r.SellerId);

      // Build SET clause
      const setParts = [];
      const request = transaction.request();
      if (updates.status) { setParts.push('Status = @status'); request.input('status', sql.NVarChar, updates.status); }
      if (updates.category) { setParts.push('Category = @category'); request.input('category', sql.NVarChar, updates.category); }
      if (updates.brand) { setParts.push('Brand = @brand'); request.input('brand', sql.NVarChar, updates.brand); }
      
      if (setParts.length > 0) {
        setParts.push('UpdatedAt = GETDATE()');
        await request.query(`UPDATE Asins SET ${setParts.join(', ')} WHERE Id IN (${idList})`);
      }

      await transaction.commit();
      
      for (const sellerId of sellerIds) {
        await updateSellerAsinCount(sellerId, req.app.get('io'));
      }
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.json({ success: true, updatedCount: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Bulk Update Week History (SQL Version)
 */
exports.bulkUpdateWeekHistory = async (req, res) => {
  try {
    const { updates } = req.body; // Array of { asinId, weekData }
    if (!updates || !Array.isArray(updates)) return res.status(400).json({ error: 'Updates array required' });

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const update of updates) {
        const { asinId, weekData } = update;
        const weekDate = new Date(weekData.date || new Date());
        weekDate.setHours(0, 0, 0, 0);

        await transaction.request()
          .input('asinId', sql.VarChar, asinId)
          .input('date', sql.DateTime, weekDate)
          .input('price', sql.Decimal(18, 2), weekData.price || 0)
          .input('bsr', sql.Int, weekData.bsr || 0)
          .input('rating', sql.Decimal(3, 2), weekData.rating || 0)
          .input('reviews', sql.Int, weekData.reviews || 0)
          .input('lqs', sql.Decimal(5, 2), weekData.lqs || 0)
          .query(`
            IF EXISTS (SELECT 1 FROM AsinWeekHistory WHERE AsinId = @asinId AND WeekStartDate = @date)
            BEGIN
              UPDATE AsinWeekHistory SET 
                AvgPrice = @price, AvgBSR = @bsr, AvgRating = @rating, TotalReviews = @reviews, AvgLQS = @lqs
              WHERE AsinId = @asinId AND WeekStartDate = @date
            END
            ELSE
            BEGIN
              INSERT INTO AsinWeekHistory (AsinId, WeekStartDate, AvgPrice, AvgBSR, AvgRating, TotalReviews, AvgLQS)
              VALUES (@asinId, @date, @price, @bsr, @rating, @reviews, @lqs)
            END
          `);
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.json({ success: true, updatedCount: updates.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateSellerAsinCount = updateSellerAsinCount;

/**
 * POST /api/asins/upload-raw
 * Upload raw scraped ASIN data (Octoparse format)
 * Body: { sellerId, data: [rawText1, rawText2, ...] } OR multipart form
 */
exports.uploadRawAsins = async (req, res) => {
    try {
        const { sellerId, data: rawDataArray } = req.body;
        const userId = req.user.Id || req.user._id;

        if (!sellerId) {
            return res.status(400).json({ error: 'sellerId is required' });
        }

        if (!Array.isArray(rawDataArray) || rawDataArray.length === 0) {
            return res.status(400).json({ error: 'data array with raw scraped entries is required' });
        }

        const results = await AsinDataParser.bulkUpsertAsins(rawDataArray, sellerId);
        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;

        // Update seller's scrape stats
        const pool = await getPool();
        await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .input('count', sql.Int, successCount)
            .query(`
                UPDATE Sellers
                SET ScrapeUsed = ScrapeUsed + @count,
                    LastScrapedAt = GETDATE(),
                    UpdatedAt = GETDATE()
                WHERE Id = @sellerId
            `);

        res.json({
            success: true,
            message: `Processed ${rawDataArray.length} entries`,
            stats: { total: rawDataArray.length, success: successCount, failed: errorCount },
            results: results.slice(0, 10) // Return first 10 for debugging
        });
    } catch (error) {
        console.error('Upload raw ASINs error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/asins/parse-test
 * Test parsing without saving (for debugging)
 */
exports.testParseRaw = async (req, res) => {
    try {
        const { rawData } = req.body;
        if (!rawData) {
            return res.status(400).json({ error: 'rawData string required' });
        }

        const parsed = AsinDataParser.transformToAsinRow(rawData, 'test-seller-id');
        res.json({ success: true, parsed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = exports;
