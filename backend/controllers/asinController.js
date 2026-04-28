const { sql, getPool, generateId } = require('../database/db');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');
const marketDataSyncService = require('../services/marketDataSyncService');
const imageGenerationService = require('../services/imageGenerationService');
const XLSX = require('xlsx');
const fs = require('fs');
const AsinDataParser = require('../services/asinDataParser');
const LQS = require('../utils/lqs');

// Helper to safely parse JSON
const tryParse = (data, fallback = []) => {
    if (!data) return fallback;
    if (typeof data !== 'string') return data;
    try {
        return JSON.parse(data);
    } catch (e) {
        return fallback;
    }
};

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
    
    // Helper to apply inputs to a request
    const applyInputs = (reqObj) => {
        if (seller) reqObj.input('seller', sql.VarChar, seller);
        if (status) reqObj.input('status', sql.NVarChar, status);
        if (category) reqObj.input('category', sql.NVarChar, category);
        if (brand) reqObj.input('brand', sql.NVarChar, brand);
        if (scrapeStatus) reqObj.input('scrapeStatus', sql.NVarChar, scrapeStatus);
        if (hasAplus !== undefined && hasAplus !== '') reqObj.input('hasAplus', sql.Bit, hasAplus === 'true' ? 1 : 0);
        if (buyBoxWin !== undefined && buyBoxWin !== '') reqObj.input('buyBoxStatus', sql.Bit, buyBoxWin === 'true' ? 1 : 0);
        if (minPrice) reqObj.input('minPrice', sql.Decimal(18, 2), parseFloat(minPrice));
        if (maxPrice) reqObj.input('maxPrice', sql.Decimal(18, 2), parseFloat(maxPrice));
        if (minBSR) reqObj.input('minBSR', sql.Int, parseInt(minBSR));
        if (maxBSR) reqObj.input('maxBSR', sql.Int, parseInt(maxBSR));
        if (minLQS) reqObj.input('minLQS', sql.Decimal(5, 2), parseFloat(minLQS));
        if (maxLQS) reqObj.input('maxLQS', sql.Decimal(5, 2), parseFloat(maxLQS));
        if (req.query.parentAsin) reqObj.input('parentAsin', sql.NVarChar, req.query.parentAsin);
        if (req.query.tag) reqObj.input('tag', sql.NVarChar, `%${req.query.tag}%`);
        if (req.query.sku) reqObj.input('sku', sql.NVarChar, `%${req.query.sku}%`);
        if (req.query.subBsrCategory) reqObj.input('subBsrCategory', sql.NVarChar, `%"${req.query.subBsrCategory}"%`);
        if (req.query.minRating) reqObj.input('minRating', sql.Decimal(3, 2), parseFloat(req.query.minRating));
        if (req.query.maxRating) reqObj.input('maxRating', sql.Decimal(3, 2), parseFloat(req.query.maxRating));
        if (req.query.minReviewCount) reqObj.input('minReviewCount', sql.Int, parseInt(req.query.minReviewCount));
        if (req.query.maxReviewCount) reqObj.input('maxReviewCount', sql.Int, parseInt(req.query.maxReviewCount));
        if (req.query.minImagesCount) reqObj.input('minImagesCount', sql.Int, parseInt(req.query.minImagesCount));
        if (req.query.maxImagesCount) reqObj.input('maxImagesCount', sql.Int, parseInt(req.query.maxImagesCount));
        if (req.query.minBulletPoints) reqObj.input('minBulletPoints', sql.Int, parseInt(req.query.minBulletPoints));
        if (req.query.maxBulletPoints) reqObj.input('maxBulletPoints', sql.Int, parseInt(req.query.maxBulletPoints));
        if (req.query.minReleaseDate) reqObj.input('minReleaseDate', sql.DateTime2, new Date(req.query.minReleaseDate));
        if (req.query.maxReleaseDate) {
            const maxD = new Date(req.query.maxReleaseDate);
            maxD.setHours(23, 59, 59, 999);
            reqObj.input('maxReleaseDate', sql.DateTime2, maxD);
        }
        if (search) reqObj.input('search', sql.NVarChar, `%${search}%`);
        
        if (req.query.selectedTags) {
            const tags = Array.isArray(req.query.selectedTags) ? req.query.selectedTags : req.query.selectedTags.split(',');
            tags.forEach((tag, i) => {
                reqObj.input(`selectedTag${i}`, sql.NVarChar, `%${tag.trim()}%`);
            });
        }
        return reqObj;
    };

    let whereClause = 'WHERE 1=1';

    // [1] User Scope / Seller Filtering
    if (!isGlobalUser) {
      const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());
      if (allowedSellerIds.length === 0) {
        return res.json({ asins: [], pagination: { page: pageNum, limit: limitNum, total: 0 } });
      }
      
      if (seller && allowedSellerIds.includes(seller)) {
        whereClause += ' AND a.SellerId = @seller';
      } else {
        whereClause += ` AND a.SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
      }
    } else if (seller) {
      whereClause += ' AND a.SellerId = @seller';
    }

    // [2] Filters
    if (status) whereClause += ' AND Status = @status';
    if (category) whereClause += ' AND Category = @category';
    if (brand) whereClause += ' AND s.Name = @brand';
    if (scrapeStatus) whereClause += ' AND ScrapeStatus = @scrapeStatus';
    if (hasAplus !== undefined && hasAplus !== '') whereClause += ' AND HasAplus = @hasAplus';
    if (buyBoxWin !== undefined && buyBoxWin !== '') whereClause += ' AND BuyBoxStatus = @buyBoxStatus';

    // [3] Numeric Ranges
    if (minPrice) whereClause += ' AND CurrentPrice >= @minPrice';
    if (maxPrice) whereClause += ' AND CurrentPrice <= @maxPrice';
    if (minBSR) whereClause += ' AND BSR >= @minBSR';
    if (maxBSR) whereClause += ' AND BSR <= @maxBSR';
    if (minLQS) whereClause += ' AND LQS >= @minLQS';
    if (maxLQS) whereClause += ' AND LQS <= @maxLQS';

    if (req.query.parentAsin) whereClause += ' AND ParentAsin = @parentAsin';
    if (req.query.tag) whereClause += ' AND Tags LIKE @tag';
    if (req.query.selectedTags) {
        const tags = Array.isArray(req.query.selectedTags) ? req.query.selectedTags : req.query.selectedTags.split(',');
        tags.forEach((tag, i) => {
            whereClause += ` AND Tags LIKE @selectedTag${i}`;
        });
    }
    if (req.query.sku) whereClause += ' AND Sku LIKE @sku';
    if (req.query.minRating) whereClause += ' AND Rating >= @minRating';
    if (req.query.maxRating) whereClause += ' AND Rating <= @maxRating';
    if (req.query.minReviewCount) whereClause += ' AND ReviewCount >= @minReviewCount';
    if (req.query.maxReviewCount) whereClause += ' AND ReviewCount <= @maxReviewCount';
    if (req.query.minImagesCount) {
      whereClause += ' AND ImagesCount >= @minImagesCount';
    }
    if (req.query.maxImagesCount) {
      whereClause += ' AND ImagesCount <= @maxImagesCount';
    }

    if (req.query.minBulletPoints) {
      whereClause += ' AND BulletPoints >= @minBulletPoints';
    }
    if (req.query.maxBulletPoints) {
      whereClause += ' AND BulletPoints <= @maxBulletPoints';
    }

    if (req.query.hasVideo !== undefined && req.query.hasVideo !== '') {
      whereClause += ' AND VideoCount ' + (req.query.hasVideo === 'true' ? '> 0' : '= 0');
    }

    if (req.query.minTitleScore) {
      whereClause += ' AND TitleScore >= ' + parseFloat(req.query.minTitleScore);
    }
    if (req.query.maxTitleScore) {
      whereClause += ' AND TitleScore <= ' + parseFloat(req.query.maxTitleScore);
    }
    if (req.query.minBulletScore) {
      whereClause += ' AND BulletScore >= ' + parseFloat(req.query.minBulletScore);
    }
    if (req.query.maxBulletScore) {
      whereClause += ' AND BulletScore <= ' + parseFloat(req.query.maxBulletScore);
    }
    if (req.query.minImageScore) {
      whereClause += ' AND ImageScore >= ' + parseFloat(req.query.minImageScore);
    }
    if (req.query.maxImageScore) {
      whereClause += ' AND ImageScore <= ' + parseFloat(req.query.maxImageScore);
    }
    if (req.query.minDescriptionScore) {
      whereClause += ' AND DescriptionScore >= ' + parseFloat(req.query.minDescriptionScore);
    }
    if (req.query.maxDescriptionScore) {
      whereClause += ' AND DescriptionScore <= ' + parseFloat(req.query.maxDescriptionScore);
    }

    if (req.query.hasDeal !== undefined && req.query.hasDeal !== '') {
      if (req.query.hasDeal === 'true') {
        whereClause += " AND DealBadge IS NOT NULL AND DealBadge != '' AND DealBadge != 'No deal found'";
      } else {
        whereClause += " AND (DealBadge IS NULL OR DealBadge = '' OR DealBadge = 'No deal found')";
      }
    }
    
    if (req.query.subBsrCategory) {
      whereClause += ' AND a.SubBsrCategories LIKE @subBsrCategory';
    }

    if (req.query.minReleaseDate) whereClause += ' AND ReleaseDate >= @minReleaseDate';
    if (req.query.maxReleaseDate) whereClause += ' AND ReleaseDate <= @maxReleaseDate';

    if (req.query.ageFilter) {
      if (req.query.ageFilter === '30') whereClause += ' AND ReleaseDate >= DATEADD(day, -30, GETDATE())';
      else if (req.query.ageFilter === '60') whereClause += ' AND ReleaseDate < DATEADD(day, -30, GETDATE()) AND ReleaseDate >= DATEADD(day, -60, GETDATE())';
      else if (req.query.ageFilter === '90') whereClause += ' AND ReleaseDate < DATEADD(day, -60, GETDATE()) AND ReleaseDate >= DATEADD(day, -90, GETDATE())';
      else if (req.query.ageFilter === '180') whereClause += ' AND ReleaseDate < DATEADD(day, -90, GETDATE()) AND ReleaseDate >= DATEADD(day, -180, GETDATE())';
      else if (req.query.ageFilter === '365') whereClause += ' AND ReleaseDate < DATEADD(day, -180, GETDATE()) AND ReleaseDate >= DATEADD(day, -365, GETDATE())';
      else if (req.query.ageFilter === '365+') whereClause += ' AND ReleaseDate < DATEADD(day, -365, GETDATE())';
    }

    // [4] Search
    if (search) {
      whereClause += ' AND (AsinCode LIKE @search OR Title LIKE @search OR Sku LIKE @search)';
    }

    // [5] Count Total
    const countRequest = applyInputs(pool.request());
    const countResult = await countRequest.query(`SELECT COUNT(*) as total FROM Asins a JOIN Sellers s ON a.SellerId = s.Id ${whereClause}`);
    const total = countResult.recordset[0].total;

    // [6] Fetch ASINs
    // Map sortBy from frontend names to SQL column names if necessary
    const sortField = sortBy === 'asinCode' ? 'AsinCode' : 
                      sortBy === 'currentPrice' ? 'CurrentPrice' : 
                      sortBy === 'bsr' ? 'BSR' : 
                      sortBy === 'lqs' ? 'LQS' : 
                      sortBy === 'status' ? 'Status' : 
                      sortBy === 'lastScraped' ? 'LastScrapedAt' : 'CreatedAt';
    
    const dataRequest = applyInputs(pool.request());
    const asinsResult = await dataRequest
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
      SELECT AsinId, WeekStartDate, AvgPrice as price, AvgBSR as bsr, 
             AvgRating as rating, TotalReviews as reviews
      FROM AsinWeekHistory 
      WHERE AsinId IN (${asinIds}) 
      ORDER BY WeekStartDate ASC
    `);
    
    const historyMap = {};
    historyResult.recordset.forEach(h => {
      if (!historyMap[h.AsinId]) historyMap[h.AsinId] = [];
      historyMap[h.AsinId].push({
        week: h.WeekStartDate ? `W${Math.ceil(new Date(h.WeekStartDate).getDate() / 7)}` : '',
        date: h.WeekStartDate ? h.WeekStartDate.toISOString().split('T')[0] : '',
        price: h.price || 0,
        bsr: h.bsr || 0,
        rating: h.rating || 0,
        reviews: h.reviews || 0
      });
    });

    // [8] Process for frontend
    const processedAsins = asins.map(a => {
        // Build weekHistory from AsinWeekHistory table
        const weekHistory = (historyMap[a.Id] || []).map(h => ({
            week: h.week || '',
            date: h.date ? new Date(h.date).toISOString().split('T')[0] : '',
            price: h.price || 0,
            bsr: h.bsr || 0,
            rating: h.rating || 0,
            reviews: h.reviews || 0,
            imageCount: h.imageCount || a.ImagesCount || 0,
            videoCount: h.videoCount || a.VideoCount || 0,
            lqs: h.lqs || a.LQS || 0
        }));

        // ---- PARSE ALL JSON FIELDS ----
        let allOffers = [];
        try { 
            allOffers = a.AllOffers ? (typeof a.AllOffers === 'string' ? JSON.parse(a.AllOffers) : a.AllOffers) : []; 
        } catch (e) { 
            console.error('Error parsing AllOffers for', a.AsinCode, ':', e.message);
            allOffers = []; 
        }

        let subBSRs = [];
        try { subBSRs = a.SubBSRs ? (typeof a.SubBSRs === 'string' ? JSON.parse(a.SubBSRs) : a.SubBSRs) : []; } catch (e) { subBSRs = []; }

        let images = [];
        try { images = a.Images ? (typeof a.Images === 'string' ? JSON.parse(a.Images) : a.Images) : []; } catch (e) { images = []; }

        let bulletPointsText = [];
        try { bulletPointsText = a.BulletPointsText ? (typeof a.BulletPointsText === 'string' ? JSON.parse(a.BulletPointsText) : a.BulletPointsText) : []; } catch (e) { bulletPointsText = []; }
        const bulletPointsCount = parseInt(a.BulletPoints) || bulletPointsText.length || 0;

        let ratingBreakdown = {};
        try { ratingBreakdown = a.RatingBreakdown ? (typeof a.RatingBreakdown === 'string' ? JSON.parse(a.RatingBreakdown) : a.RatingBreakdown) : {}; } catch (e) { ratingBreakdown = {}; }

        let lqsDetails = [];
        try { lqsDetails = a.LqsDetails ? (typeof a.LqsDetails === 'string' ? JSON.parse(a.LqsDetails) : a.LqsDetails) : []; } catch (e) { lqsDetails = []; }

        let cdqComponents = {};
        try { cdqComponents = a.CdqComponents ? (typeof a.CdqComponents === 'string' ? JSON.parse(a.CdqComponents) : a.CdqComponents) : {}; } catch (e) { cdqComponents = {}; }

        let feePreview = null;
        try { feePreview = a.FeePreview ? (typeof a.FeePreview === 'string' ? JSON.parse(a.FeePreview) : a.FeePreview) : null; } catch (e) { feePreview = null; }

        let historyParsed = [];
        try { historyParsed = a.History ? (typeof a.History === 'string' ? JSON.parse(a.History) : a.History) : []; } catch (e) { historyParsed = []; }

        // ---- ENSURE ALLOFFERS HAS CORRECT FORMAT ----
        // If allOffers is empty, build it from legacy fields
        if (allOffers.length === 0) {
            const primaryOffer = {
                seller: a.SoldBy || '',
                price: parseFloat(a.CurrentPrice) || 0,
                isBuyBoxWinner: true
            };
            const secondaryOffer = {
                seller: a.SoldBySec || '',
                price: parseFloat(a.SecondAsp) || 0,
                isBuyBoxWinner: false
            };
            
            allOffers = [];
            if (primaryOffer.seller || primaryOffer.price > 0) allOffers.push(primaryOffer);
            if (secondaryOffer.seller || secondaryOffer.price > 0) allOffers.push(secondaryOffer);
        }

        // ---- BUILD FINAL RESPONSE OBJECT ----
        return {
            _id: a.Id,
            asinCode: a.AsinCode,
            sku: a.Sku || '',
            status: a.Status || 'Active',
            scrapeStatus: a.ScrapeStatus || 'PENDING',
            category: a.Category || '',
            brand: a.Brand || '',
            title: a.Title || '',
            imageUrl: a.ImageUrl || '',
            tags: a.Tags || '[]',
            parentAsin: a.ParentAsin || '',
            releaseDate: a.ReleaseDate || null,
            
            // Pricing
            currentPrice: parseFloat(a.CurrentPrice) || 0,
            mrp: parseFloat(a.Mrp) || 0,
            uploadedPrice: parseFloat(a.CurrentPrice) || 0,
            secondAsp: parseFloat(a.SecondAsp) || 0,
            aspDifference: parseFloat(a.AspDifference) || 0,
            dealBadge: a.DealBadge || 'No deal found',
            priceType: a.PriceType || 'Standard Price',
            discountPercentage: parseInt(a.DiscountPercentage) || 0,
            
            // BSR & Ratings
            bsr: parseInt(a.BSR) || 0,
            rating: parseFloat(a.Rating) || 0,
            reviewCount: parseInt(a.ReviewCount) || 0,
            ratingBreakdown: ratingBreakdown,
            
            // LQS & CDQ
            lqs: parseFloat(a.LQS) || 0,
            lqsGrade: a.LQSGrade || 'N/A',
            lqsDetails: lqsDetails,
            cdq: parseInt(a.Cdq) || 0,
            cdqGrade: a.CdqGrade || 'N/A',
            cdqComponents: cdqComponents,
            
            // Quality Component Scores
            titleScore: parseFloat(a.TitleScore) || 0,
            titleGrade: a.TitleGrade || 'N/A',
            bulletScore: parseFloat(a.BulletScore) || 0,
            bulletGrade: a.BulletGrade || 'N/A',
            imageScore: parseFloat(a.ImageScore) || 0,
            imageGrade: a.ImageGrade || 'N/A',
            descriptionScore: parseFloat(a.DescriptionScore) || 0,
            descriptionGrade: a.DescriptionGrade || 'N/A',
            
            // Quality Component Issues/Recs (Parsed if needed by UI)
            titleIssues: tryParse(a.TitleIssues, []),
            titleRecommendations: tryParse(a.TitleRecommendations, []),
            bulletIssues: tryParse(a.BulletIssues, []),
            bulletRecommendations: tryParse(a.BulletRecommendations, []),
            imageIssues: tryParse(a.ImageIssues, []),
            imageRecommendations: tryParse(a.ImageRecommendations, []),
            descriptionIssues: tryParse(a.DescriptionIssues, []),
            descriptionRecommendations: tryParse(a.DescriptionRecommendations, []),
            
            productDescription: a.ProductDescription || '',
            
            // Fee Preview
            feePreview: feePreview,
            
            // BuyBox (BOOLEAN CONVERSION)
            buyBoxWin: a.BuyBoxWin === 1 || a.BuyBoxWin === true || a.BuyBoxWin === 'true',
            buyBoxStatus: a.BuyBoxStatus === 1 || a.BuyBoxStatus === true || a.BuyBoxStatus === 'true',
            buyBoxSellerId: a.BuyBoxSellerId || a.SoldBy || '',
            
            // Seller Info
            soldBy: a.SoldBy || '',
            soldBySec: a.SoldBySec || '',
            
            // A+ Content (BOOLEAN CONVERSION)
            hasAplus: a.HasAplus === 1 || a.HasAplus === true || a.HasAplus === 'true',
            aplusAbsentSince: a.AplusAbsentSince || null,
            aplusPresentSince: a.AplusPresentSince || null,
            
            // Availability & Stock
            availabilityStatus: a.AvailabilityStatus || 'Available',
            stockLevel: parseInt(a.StockLevel) || 0,
            
            // Media
            imagesCount: parseInt(a.ImagesCount) || 0,
            videoCount: parseInt(a.VideoCount) || 0,
            bulletPoints: bulletPointsCount,
            descLength: parseInt(a.DescLength) || 0,
            
            // Sub BSR
            subBsr: a.SubBsr || '',
            
            // Parsed JSON arrays/objects
            allOffers: allOffers,
            subBSRs: subBSRs,
            images: images,
            bulletPointsText: bulletPointsText,
            
            // History
            history: historyParsed,
            weekHistory: weekHistory.length > 0 ? weekHistory : historyParsed,
            
            // Weight / Staple
            weight: parseFloat(a.Weight) || 0,
            stapleLevel: a.StapleLevel || 'Standard',
            lossPerReturn: parseFloat(a.LossPerReturn) || 0,
            
            // Seller object for display
            seller: {
                _id: a.SellerId,
                name: a.sellerName || '',
                marketplace: a.sellerMarketplace || ''
            },
            
            // Timestamps
            lastScraped: a.LastScrapedAt || null,
            lastScrapedAt: a.LastScrapedAt || null,
            createdAt: a.CreatedAt,
            updatedAt: a.UpdatedAt,
            
            // Preserve original ID
            _id: a.Id,
            Id: a.Id,
            SellerId: a.SellerId
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
    let allOffers = [];
    try { allOffers = a.AllOffers ? (typeof a.AllOffers === 'string' ? JSON.parse(a.AllOffers) : a.AllOffers) : []; } catch (e) { allOffers = []; }

    let subBSRs = [];
    try { subBSRs = a.SubBSRs ? (typeof a.SubBSRs === 'string' ? JSON.parse(a.SubBSRs) : a.SubBSRs) : []; } catch (e) { subBSRs = []; }

    let images = [];
    try { images = a.Images ? (typeof a.Images === 'string' ? JSON.parse(a.Images) : a.Images) : []; } catch (e) { images = []; }

    let bulletPointsText = [];
    try { bulletPointsText = a.BulletPointsText ? (typeof a.BulletPointsText === 'string' ? JSON.parse(a.BulletPointsText) : a.BulletPointsText) : []; } catch (e) { bulletPointsText = []; }

    let ratingBreakdown = {};
    try { ratingBreakdown = a.RatingBreakdown ? (typeof a.RatingBreakdown === 'string' ? JSON.parse(a.RatingBreakdown) : a.RatingBreakdown) : {}; } catch (e) { ratingBreakdown = {}; }

    let lqsDetails = [];
    try { lqsDetails = a.LqsDetails ? (typeof a.LqsDetails === 'string' ? JSON.parse(a.LqsDetails) : a.LqsDetails) : []; } catch (e) { lqsDetails = []; }

    let cdqComponents = {};
    try { cdqComponents = a.CdqComponents ? (typeof a.CdqComponents === 'string' ? JSON.parse(a.CdqComponents) : a.CdqComponents) : {}; } catch (e) { cdqComponents = {}; }

    let feePreview = {};
    try { feePreview = a.FeePreview ? (typeof a.FeePreview === 'string' ? JSON.parse(a.FeePreview) : a.FeePreview) : {}; } catch (e) { feePreview = {}; }

    let historyParsed = [];
    try { historyParsed = a.History ? (typeof a.History === 'string' ? JSON.parse(a.History) : a.History) : []; } catch (e) { historyParsed = []; }

    const asin = {
      ...a,
      _id: a.Id,
      asinCode: a.AsinCode,
      sku: a.Sku,
      status: a.Status,
      scrapeStatus: a.ScrapeStatus,
      category: a.Category,
      brand: a.Brand,
      title: a.Title,
      imageUrl: a.ImageUrl,
      tags: a.Tags || '[]',
      parentAsin: a.ParentAsin || '',
      
      currentPrice: parseFloat(a.CurrentPrice) || 0,
      mrp: parseFloat(a.Mrp) || 0,
      bsr: parseInt(a.BSR) || 0,
      rating: parseFloat(a.Rating) || 0,
      reviewCount: parseInt(a.ReviewCount) || 0,
      lqs: parseFloat(a.LQS) || 0,
      
      buyBoxWin: a.BuyBoxWin === 1 || a.BuyBoxWin === true,
      hasAplus: a.HasAplus === 1 || a.HasAplus === true,
      buyBoxStatus: a.BuyBoxStatus === 1 || a.BuyBoxStatus === true,
      
      soldBy: a.SoldBy || '',
      soldBySec: a.SoldBySec || '',
      secondAsp: parseFloat(a.SecondAsp) || 0,
      aspDifference: parseFloat(a.AspDifference) || 0,
      dealBadge: a.DealBadge || 'No deal found',
      priceType: a.PriceType || 'Standard Price',
      discountPercentage: a.DiscountPercentage || 0,
      
      availabilityStatus: a.AvailabilityStatus || 'Available',
      stockLevel: parseInt(a.StockLevel) || 0,
      
      aplusAbsentSince: a.AplusAbsentSince || null,
      aplusPresentSince: a.AplusPresentSince || null,
      
      imagesCount: parseInt(a.ImagesCount) || 0,
      videoCount: parseInt(a.VideoCount) || 0,
      bulletPoints: parseInt(a.BulletPoints) || 0,
      descLength: parseInt(a.DescLength) || 0,
      
      cdq: parseInt(a.Cdq) || 0,
      cdqGrade: a.CdqGrade || 'N/A',
      lqsGrade: a.LQSGrade || 'N/A',
      
      // Quality Component Scores
      titleScore: parseFloat(a.TitleScore) || 0,
      titleGrade: a.TitleGrade || 'N/A',
      bulletScore: parseFloat(a.BulletScore) || 0,
      bulletGrade: a.BulletGrade || 'N/A',
      imageScore: parseFloat(a.ImageScore) || 0,
      imageGrade: a.ImageGrade || 'N/A',
      descriptionScore: parseFloat(a.DescriptionScore) || 0,
      descriptionGrade: a.DescriptionGrade || 'N/A',
      
      // Quality Component Issues/Recs/Details
      titleIssues: tryParse(a.TitleIssues, []),
      titleRecommendations: tryParse(a.TitleRecommendations, []),
      titleDetails: tryParse(a.TitleDetails, {}),
      
      bulletIssues: tryParse(a.BulletIssues, []),
      bulletRecommendations: tryParse(a.BulletRecommendations, []),
      bulletDetails: tryParse(a.BulletDetails, {}),
      
      imageIssues: tryParse(a.ImageIssues, []),
      imageRecommendations: tryParse(a.ImageRecommendations, []),
      imageDetails: tryParse(a.ImageDetails, {}),
      
      descriptionIssues: tryParse(a.DescriptionIssues, []),
      descriptionRecommendations: tryParse(a.DescriptionRecommendations, []),
      descriptionDetails: tryParse(a.DescriptionDetails, {}),
      
      productDescription: a.ProductDescription || '',
      
      allOffers,
      subBSRs,
      images,
      bulletPointsText,
      ratingBreakdown,
      lqsDetails,
      cdqComponents,
      feePreview,
      history: historyParsed,
      weekHistory: historyParsed,
      
      seller: {
        _id: a.SellerId,
        name: a.sellerName || '',
        marketplace: a.sellerMarketplace || '',
        sellerId: a.sellerExtId
      }
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
      const allowedSellerIds = (req.user?.assignedSellers || []).map(s => (s._id || s).toString());
      if (allowedSellerIds.length === 0) {
        return res.json({ 
          success: true, 
          data: { categories: [], brands: [], scrapeStatuses: [], statuses: [], subBsrCategories: [], tags: [] } 
        });
      }
      whereClause += ` AND a.SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
    }

    if (req.query.seller) {
      // Safe to interpolate seller ID as it's an ObjectId/UUID format
      whereClause += ` AND a.SellerId = '${req.query.seller.replace(/'/g, "''")}'`; 
    }

    const [categoriesResult, brandsResult, subBsrResult, tagsResult] = await Promise.all([
      pool.request().query(`SELECT DISTINCT Category FROM Asins a ${whereClause} AND a.Category IS NOT NULL AND a.Category != '' ORDER BY Category ASC`),
      pool.request().query(`SELECT DISTINCT s.Name as Brand FROM Asins a JOIN Sellers s ON a.SellerId = s.Id ${whereClause.replace('WHERE 1=1', 'WHERE 1=1 AND s.Name IS NOT NULL')} ORDER BY s.Name ASC`),
      pool.request().query(`SELECT DISTINCT value as SubBsr FROM Asins a CROSS APPLY OPENJSON(a.SubBsrCategories) ${whereClause} AND a.SubBsrCategories IS NOT NULL AND ISJSON(a.SubBsrCategories) > 0 ORDER BY value ASC`),
      pool.request().query(`SELECT Tags FROM Asins a ${whereClause} AND a.Tags IS NOT NULL AND a.Tags != '[]' AND a.Tags != ''`)
    ]);

    // Extract unique tags
    const allTags = new Set();
    tagsResult.recordset.forEach(row => {
      try {
        const parsed = JSON.parse(row.Tags || '[]');
        if (Array.isArray(parsed)) parsed.forEach(t => allTags.add(t));
      } catch (e) {}
    });

    res.json({
      success: true,
      data: {
        categories: categoriesResult.recordset.map(r => r.Category).filter(Boolean),
        brands: brandsResult.recordset.map(r => r.Brand).filter(Boolean),
        subBsrCategories: subBsrResult.recordset.map(r => r.SubBsr).filter(Boolean),
        tags: [...allTags].sort(),
        scrapeStatuses: ['PENDING', 'SCRAPING', 'COMPLETED', 'FAILED'],
        statuses: ['Active', 'Paused', 'Error', 'Pending']
      }
    });
  } catch (error) {
    console.error('getAsinFilterOptions Error:', error);
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
    const existingCodes = new Map();

    if (identifiers.length > 0) {
      const idInClause = identifiers.map(id => `'${id}'`).join(',');
      const existingAsinsResult = await pool.request()
        .input('sellerId', sql.VarChar, sellerId)
        .query(`SELECT Id, AsinCode FROM Asins WHERE SellerId = @sellerId AND AsinCode IN (${idInClause})`);
      
      existingAsinsResult.recordset.forEach(a => existingCodes.set(a.AsinCode, a.Id));
    }

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
          existingCodes.set(identifier, id); // Add to map to prevent duplicate inserts in this batch
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
 * Recalculate LQS for selected ASINs or all ASINs in scope
 */
exports.recalculateLqs = async (req, res) => {
    try {
        const { ids } = req.body;
        const pool = await getPool();
        
        let query = `
            SELECT Id, Title, BulletPoints, ImagesUrls, HasAplus, Category, SellerId
            FROM Asins
        `;
        
        const request = pool.request();
        
        if (ids && Array.isArray(ids) && ids.length > 0) {
            const idList = ids.map((id, i) => {
                request.input(`id${i}`, sql.VarChar, id);
                return `@id${i}`;
            }).join(',');
            query += ` WHERE Id IN (${idList})`;
        } else {
            // If no IDs provided, recalculate for all ASINs within user's scope
            const roleName = req.user?.role?.name || req.user?.role;
            const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
            
            if (!isGlobalUser) {
                const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s).toString());
                if (allowedSellerIds.length === 0) {
                    return res.json({ success: true, processedCount: 0 });
                }
                query += ` WHERE SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
            }
        }
        
        const result = await request.query(query);
        const asins = result.recordset;
        
        let successCount = 0;
        
        // Process in small chunks to avoid long transactions
        for (const asin of asins) {
            try {
                const bulletPoints = tryParse(asin.BulletPoints, []);
                const imageUrls = tryParse(asin.ImagesUrls, []);
                
                const analysis = LQS.calculateCDQ({
                    Title: asin.Title || '',
                    BulletPoints: bulletPoints,
                    ImagesUrls: imageUrls,
                    HasAplus: !!asin.HasAplus,
                    Category: asin.Category || ''
                });
                
                await pool.request()
                    .input('id', sql.VarChar, asin.Id)
                    .input('lqsScore', sql.Decimal(5, 2), analysis.score)
                    .input('lqsGrade', sql.NVarChar(5), analysis.grade)
                    .input('lqsIssues', sql.NVarChar(sql.MAX), JSON.stringify(analysis.issues))
                    .input('titleScore', sql.Decimal(5, 2), analysis.components.titleQuality)
                    .input('bulletScore', sql.Decimal(5, 2), analysis.components.bulletPoints)
                    .input('imageScore', sql.Decimal(5, 2), analysis.components.imageQuality)
                    .input('descriptionScore', sql.Decimal(5, 2), analysis.components.descriptionQuality)
                    .query(`
                        UPDATE Asins 
                        SET LQS = @lqsScore,
                            LqsScore = @lqsScore, 
                            LQSGrade = @lqsGrade,
                            LqsIssues = @lqsIssues,
                            TitleScore = @titleScore,
                            BulletScore = @bulletScore,
                            ImageScore = @imageScore,
                            DescriptionScore = @descriptionScore,
                            UpdatedAt = GETDATE()
                        WHERE Id = @id
                    `);
                
                successCount++;
            } catch (err) {
                console.error(`Error recalculating LQS for ${asin.Id}:`, err.message);
            }
        }
        
        res.json({ success: true, processedCount: successCount });
    } catch (error) {
        console.error('Recalculate LQS Error:', error);
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

        const AsinDataParser = require('../services/asinDataParser');
        const parsed = AsinDataParser.transformToAsinRow(rawData, 'test-seller-id');
        res.json({ success: true, parsed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Simple text upload endpoint for raw Octoparse data
 * POST /api/asins/upload-raw-text
 * Body: { sellerId: string, entries: [string, string...] }
 */
exports.uploadRawText = async (req, res) => {
    try {
        const { sellerId, entries } = req.body;
        const userId = req.user.Id || req.user._id;

        if (!sellerId) {
            return res.status(400).json({ error: 'sellerId is required' });
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'entries array with raw text data is required' });
        }

        const AsinDataParser = require('../services/asinDataParser');
        const results = await AsinDataParser.bulkUpsertAsins(entries, sellerId);
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
            message: `Processed ${entries.length} entries`,
            stats: { total: entries.length, success: successCount, failed: errorCount },
            results: results.slice(0, 10)
        });
    } catch (error) {
        console.error('Upload raw ASINs error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Export ASIN data to CSV or Excel
 */
exports.exportData = async (req, res) => {
  try {
    const { 
      sellerIds = [], 
      allSellers = false, 
      fields = [], 
      dateRange = 'all',
      managerFilter = 'all',
      format = 'csv'
    } = req.body;

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);

    const pool = await getPool();
    const request = pool.request();

    // Build WHERE clause
    let whereClause = 'WHERE 1=1';

    // [1] User Scope / Permission check
    if (!isGlobalUser) {
      const allowedSellerIds = req.user.assignedSellers.map(s => (s._id || s.Id || s).toString());
      if (allowedSellerIds.length === 0) {
        return res.status(403).json({ success: false, error: 'No sellers assigned' });
      }
      
      if (!allSellers && sellerIds.length > 0) {
        const validIds = sellerIds.filter(id => allowedSellerIds.includes(id));
        if (validIds.length === 0) {
          whereClause += ` AND a.SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
        } else {
          whereClause += ` AND a.SellerId IN (${validIds.map(id => `'${id}'`).join(',')})`;
        }
      } else {
        whereClause += ` AND a.SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
      }
    } else {
      // Admin/Global User
      if (!allSellers && sellerIds.length > 0) {
        whereClause += ` AND a.SellerId IN (${sellerIds.map(id => `'${id}'`).join(',')})`;
      }
      
      // Manager filter (Global only)
      if (managerFilter === 'mine' && req.user) {
        const userSellers = await pool.request()
          .input('userId', sql.VarChar, (req.user._id || req.user.id).toString())
          .query('SELECT SellerId FROM UserSellers WHERE UserId = @userId');
        const managedIds = userSellers.recordset.map(r => r.SellerId);
        if (managedIds.length > 0) {
          whereClause += ` AND a.SellerId IN (${managedIds.map(id => `'${id}'`).join(',')})`;
        } else {
          whereClause += ` AND 1=0`; // No sellers assigned to "mine"
        }
      } else if (managerFilter === 'unassigned') {
        whereClause += ` AND a.SellerId NOT IN (SELECT DISTINCT SellerId FROM UserSellers)`;
      } else if (managerFilter !== 'all') {
        // Specific manager
        const userSellers = await pool.request()
          .input('userId', sql.VarChar, managerFilter)
          .query('SELECT SellerId FROM UserSellers WHERE UserId = @userId');
        const managedIds = userSellers.recordset.map(r => r.SellerId);
        if (managedIds.length > 0) {
          whereClause += ` AND a.SellerId IN (${managedIds.map(id => `'${id}'`).join(',')})`;
        } else {
          whereClause += ` AND 1=0`;
        }
      }
    }

    // [2] Date filter (based on last scraped)
    const isCustomDate = typeof dateRange === 'object' && dateRange !== null;
    
    if (dateRange !== 'all' && !isCustomDate) {
      const daysMap = { today: 1, yesterday: 2, '7days': 7, '30days': 30, '90days': 90 };
      const days = daysMap[dateRange] || 30;
      whereClause += ` AND a.LastScrapedAt >= DATEADD(DAY, -${days}, GETDATE())`;
    } else if (isCustomDate) {
      const { start, end } = dateRange;
      if (start) {
        request.input('startDate', sql.VarChar, start);
        whereClause += ` AND a.LastScrapedAt >= @startDate`;
      }
      if (end) {
        request.input('endDate', sql.VarChar, end);
        whereClause += ` AND a.LastScrapedAt <= @endDate`;
      }
    }

    // Fetch ASINs
    const query = `
      SELECT a.*, s.Name as sellerName, s.Marketplace as sellerMarketplace
      FROM Asins a
      LEFT JOIN Sellers s ON a.SellerId = s.Id
      ${whereClause}
      ORDER BY a.AsinCode ASC
    `;
    
    const result = await request.query(query);

    // Map field keys to SQL column names
    const fieldMapping = {
      asinCode: 'AsinCode',
      sku: 'Sku',
      title: 'Title',
      brand: 'Brand',
      category: 'Category',
      status: 'Status',
      scrapeStatus: 'ScrapeStatus',
      currentPrice: 'CurrentPrice',
      mrp: 'Mrp',
      dealBadge: 'DealBadge',
      priceType: 'PriceType',
      discountPercentage: 'DiscountPercentage',
      secondAsp: 'SecondAsp',
      aspDifference: 'AspDifference',
      bsr: 'BSR',
      subBsr: 'SubBsr',
      subBSRs: 'SubBSRs',
      rating: 'Rating',
      reviewCount: 'ReviewCount',
      ratingBreakdown: 'RatingBreakdown',
      lqs: 'LQS',
      cdq: 'Cdq',
      cdqGrade: 'CdqGrade',
      buyBoxWin: 'BuyBoxStatus',
      soldBy: 'SoldBy',
      soldBySec: 'SoldBySec',
      allOffers: 'AllOffers',
      hasAplus: 'HasAplus',
      imagesCount: 'ImagesCount',
      videoCount: 'VideoCount',
      bulletPoints: 'BulletPoints',
      bulletPointsText: 'BulletPointsText',
      descLength: 'DescLength',
      availabilityStatus: 'AvailabilityStatus',
      stockLevel: 'StockLevel',
      aplusAbsentSince: 'AplusAbsentSince',
      aplusPresentSince: 'AplusPresentSince',
      lastScraped: 'LastScrapedAt',
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
      tags: 'Tags'
    };

    // Label mapping (for header)
    const fieldLabels = {
      asinCode: 'ASIN Code', sku: 'SKU', title: 'Product Title', brand: 'Brand',
      category: 'Category', status: 'Status', scrapeStatus: 'Scrape Status',
      currentPrice: 'Current Price', mrp: 'MRP', dealBadge: 'Deal Badge',
      priceType: 'Price Type', discountPercentage: 'Discount %',
      secondAsp: 'Second ASP', aspDifference: 'ASP Difference',
      bsr: 'BSR', subBsr: 'Sub BSR', subBSRs: 'Sub BSRs',
      rating: 'Rating', reviewCount: 'Review Count', ratingBreakdown: 'Rating Breakdown',
      lqs: 'LQS Score', cdq: 'CDQ Score', cdqGrade: 'CDQ Grade',
      buyBoxWin: 'BuyBox Winner', soldBy: 'Sold By (Primary)', soldBySec: 'Sold By (Secondary)',
      allOffers: 'All Offers', hasAplus: 'Has A+', imagesCount: 'Image Count',
      videoCount: 'Video Count', bulletPoints: 'Bullet Points',
      bulletPointsText: 'Bullet Points Text', descLength: 'Desc Length',
      lastScraped: 'Last Scraped', createdAt: 'Created At', updatedAt: 'Updated At',
      tags: 'Tags'
    };

    // Format data
    const exportData = result.recordset.map(row => {
      const item = {};
      fields.forEach(field => {
        const col = fieldMapping[field];
        if (col) {
          let value = row[col];
          // Convert booleans (SQL BIT)
          if (field === 'buyBoxWin' || field === 'hasAplus') {
            value = (value === 1 || value === true || value === 'true') ? 'Yes' : 'No';
          }
          // Parse JSON fields
          if (['allOffers', 'subBSRs', 'bulletPointsText', 'ratingBreakdown', 'tags'].includes(field)) {
            try {
                const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
                if (field === 'tags' || field === 'bulletPointsText') {
                    value = Array.isArray(parsed) ? parsed.join(' | ') : value;
                } else {
                    value = JSON.stringify(parsed, null, 0);
                }
            } catch (e) {
              value = value || '';
            }
          }

          // --- CLEANING & DECODING ---
          if (typeof value === 'string') {
              value = value
                  .replace(/&amp;/g, '&')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
                  .trim();
          }

          item[fieldLabels[field] || field] = value || '';
        }
      });
      return item;
    });

    // Generate file
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ASINs');

    const fileName = `asin_export_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'csv') {
      const csvOutput = XLSX.utils.sheet_to_csv(ws, { 
          forceQuotes: true,
          RS: '\r\n'
      });
      // Add BOM (Byte Order Mark) for Excel UTF-8 recognition
      const BOM = '\uFEFF';
      const csvBuffer = Buffer.from(BOM + csvOutput, 'utf-8');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
      res.send(csvBuffer);
    } else {
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}.xlsx"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(excelBuffer);
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = exports;

// ─────────────────────────────────────────────
// TAGS HANDLERS
// ─────────────────────────────────────────────

/**
 * PUT /api/asins/:id/tags
 * Update tags for a single ASIN
 */
exports.updateAsinTags = async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({ success: false, error: 'tags must be an array' });
    }

    const pool = await getPool();
    const tagsJson = JSON.stringify(tags);

    await pool.request()
      .input('id', sql.VarChar, id)
      .input('tags', sql.NVarChar, tagsJson)
      .query('UPDATE Asins SET Tags = @tags, UpdatedAt = GETDATE() WHERE Id = @id');

    res.json({ success: true, data: { id, tags } });
  } catch (error) {
    console.error('[Tags] updateAsinTags error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/asins/tags
 * Return the list of all distinct tags in use across ASINs
 */
exports.getAllTags = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .query("SELECT Tags FROM Asins WHERE Tags IS NOT NULL AND Tags != '[]' AND Tags != ''");

    const tagSet = new Set();
    for (const row of result.recordset) {
      try {
        const parsed = JSON.parse(row.Tags);
        if (Array.isArray(parsed)) parsed.forEach(t => tagSet.add(t));
      } catch (_) {}
    }

    res.json({ success: true, data: Array.from(tagSet).sort() });
  } catch (error) {
    console.error('[Tags] getAllTags error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/asins/tags/template
 * Download an Excel template pre-filled with all ASINs for bulk tag editing
 */
exports.downloadTagsTemplate = async (req, res) => {
  try {
    const pool = await getPool();
    const { sellerId } = req.query;

    let query = `
      SELECT a.Id, a.AsinCode, a.ParentAsin, a.Title, a.Tags,
             s.Name as SellerName
      FROM Asins a
      LEFT JOIN Sellers s ON a.SellerId = s.Id
      WHERE 1=1
    `;
    const request = pool.request();
    if (sellerId) {
      query += ' AND a.SellerId = @sellerId';
      request.input('sellerId', sql.VarChar, sellerId);
    }
    query += ' ORDER BY s.Name, a.AsinCode';

    const result = await request.query(query);

    const templateData = result.recordset.map(row => {
      let tags = '';
      try { tags = JSON.parse(row.Tags || '[]').join(', '); } catch (_) {}
      return {
        'Parent ASIN': row.ParentAsin || '',
        'Child ASIN': row.AsinCode || '',
        'Seller Name': row.SellerName || '',
        'Tags': tags,
        'Title': row.Title || '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 50 }, { wch: 60 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tags Template');

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const fileName = `tags_template_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('[Tags] downloadTagsTemplate error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * POST /api/asins/tags/bulk
 * Upload an Excel file and update tags for all matched ASINs
 */
exports.bulkUploadTags = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const wb = XLSX.readFile(req.file.path);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    fs.unlinkSync(req.file.path); // clean up

    if (!rows.length) {
      return res.status(400).json({ success: false, error: 'File is empty' });
    }

    const pool = await getPool();
    let updated = 0;
    const errors = [];

    for (const row of rows) {
      const asinCode = (row['Child ASIN'] || row['ASIN'] || '').trim().toUpperCase();
      const rawTags = (row['Tags'] || '').trim();
      if (!asinCode) continue;

      const tags = rawTags ? rawTags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const tagsJson = JSON.stringify(tags);

      try {
        const result = await pool.request()
          .input('asinCode', sql.NVarChar, asinCode)
          .input('tags', sql.NVarChar, tagsJson)
          .query('UPDATE Asins SET Tags = @tags, UpdatedAt = GETDATE() WHERE AsinCode = @asinCode');
        if (result.rowsAffected[0] > 0) updated++;
      } catch (err) {
        errors.push({ asin: asinCode, error: err.message });
      }
    }

    res.json({ success: true, updated, total: rows.length, errors });
  } catch (error) {
    console.error('[Tags] bulkUploadTags error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * PUT /api/asins/:id/tags
 * Update tags for a specific ASIN
 */
exports.updateTags = async (req, res) => {
  try {
    const { id } = req.params;
    const { tags } = req.body; // Expects array of strings
    
    if (!Array.isArray(tags)) {
      return res.status(400).json({ success: false, error: 'Tags must be an array' });
    }

    const pool = await getPool();
    const tagsJson = JSON.stringify(tags);

    const result = await pool.request()
      .input('id', sql.VarChar, id)
      .input('tags', sql.NVarChar, tagsJson)
      .query('UPDATE Asins SET Tags = @tags, UpdatedAt = GETDATE() WHERE Id = @id');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, error: 'ASIN not found' });
    }

    res.json({ success: true, message: 'Tags updated' });
  } catch (error) {
    console.error('[Tags] updateTags error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * GET /api/asins/tags
 * Get all unique tags across all ASINs
 */
exports.getTags = async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT Tags FROM Asins WHERE Tags IS NOT NULL');
    
    const allTags = new Set();
    result.recordset.forEach(row => {
      try {
        const tags = JSON.parse(row.Tags || '[]');
        if (Array.isArray(tags)) {
          tags.forEach(t => allTags.add(t));
        }
      } catch (e) {
        // skip invalid json
      }
    });

    res.json({ success: true, data: Array.from(allTags).sort() });
  } catch (error) {
    console.error('[Tags] getTags error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
