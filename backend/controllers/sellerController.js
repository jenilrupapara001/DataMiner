const { sql, getPool, generateId } = require('../database/db');
const { buildInClause } = require('../utils/sqlHelpers');
const marketDataSyncService = require('../services/marketDataSyncService');
const SystemLogService = require('../services/SystemLogService');

// Lightweight in-memory cache registry for sellers to prevent duplicate queries
const sellerCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

const getCachedSellers = (key) => {
  const entry = sellerCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    sellerCache.delete(key);
    return null;
  }
  return entry.data;
};

const setCachedSellers = (key, data) => {
  sellerCache.set(key, { data, timestamp: Date.now() });
};

const clearSellerCache = () => {
  console.log('[SELLER CACHE] Invalidation triggered - clearing cached sellers.');
  sellerCache.clear();
};

exports.clearSellerCache = clearSellerCache;


/**
 * Enrich sellers with their assigned managers.
 */
const enrichSellersWithManagers = async (sellers) => {
  if (!sellers || sellers.length === 0) return sellers;
  const sellerIds = sellers.map(s => s._id || s.Id);
  const pool = await getPool();
  const req = pool.request();
  const sellerInClause = buildInClause(req, 'sellerId', sellerIds);

  const result = await req.query(`
    SELECT u.Id as _id, u.FirstName as firstName, u.LastName as lastName, u.Email as email, us.SellerId
    FROM Users u
    JOIN UserSellers us ON u.Id = us.UserId
    WHERE us.SellerId IN (${sellerInClause})
  `);

  const managers = result.recordset;

  return sellers.map(seller => {
    const sId = seller._id || seller.Id;
    const sellerManagers = managers
      .filter(m => m.SellerId === sId)
      .map(({ SellerId, ...m }) => m);
    return { ...seller, _id: sId, managers: sellerManagers };
  });
};

/**
 * Enrich sellers with dynamic ASIN counts.
 */
const enrichSellersWithAsinCounts = async (sellers) => {
  if (!sellers || sellers.length === 0) return sellers;
  const sellerIds = sellers.map(s => s._id || s.Id);
  const pool = await getPool();
  const req = pool.request();
  const sellerInClause = buildInClause(req, 'asinSellerId', sellerIds);

  const result = await req.query(`
    SELECT SellerId, 
           COUNT(*) as totalAsins,
           SUM(CASE WHEN Status IS NULL OR Status != 'Inactive' THEN 1 ELSE 0 END) as activeAsins
    FROM Asins
    WHERE SellerId IN (${sellerInClause})
    GROUP BY SellerId
  `);

  const countMap = {};
  result.recordset.forEach(c => {
    countMap[c.SellerId] = c;
  });

  return sellers.map(seller => {
    const sId = seller._id || seller.Id;
    const stats = countMap[sId] || { totalAsins: 0, activeAsins: 0 };
    return {
      ...seller,
      totalAsins: stats.totalAsins,
      activeAsins: stats.activeAsins
    };
  });
};

// Get aggregate seller stats (filtered, respecting RBAC)
exports.getSellerStats = async (req, res) => {
  try {
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager', 'Listing Manager'].includes(roleName);
    const { marketplace, manager, status, search } = req.query;
    const pool = await getPool();
    const reqObj = pool.request();
    let whereClause = 'WHERE 1=1';

    if (!isGlobalUser) {
      const sellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
      if (sellerIds.length === 0) {
        return res.json({ success: true, data: { totalStores: 0, activeStores: 0, pausedStores: 0, totalAsins: 0, activeAsins: 0, marketplaces: 0, activeToday: 0 } });
      }
      const inClause = buildInClause(reqObj, 'gssSid', sellerIds);
      whereClause += ` AND S.Id IN (${inClause})`;
    }

    if (manager) {
      whereClause += ' AND S.Id IN (SELECT SellerId FROM UserSellers WHERE UserId = @gssManager)';
      reqObj.input('gssManager', sql.VarChar, manager);
    }
    if (status) {
      whereClause += ' AND S.IsActive = @gssStatus';
      reqObj.input('gssStatus', sql.Bit, status === 'Active' ? 1 : 0);
    }
    if (marketplace) {
      whereClause += ' AND S.Marketplace = @gssMarketplace';
      reqObj.input('gssMarketplace', sql.NVarChar, marketplace);
    }
    if (search) {
      whereClause += ' AND (S.Name LIKE @gssSearch OR S.SellerId LIKE @gssSearch)';
      reqObj.input('gssSearch', sql.NVarChar, `%${search}%`);
    }

    const result = await reqObj.query(`
      SELECT
        COUNT(DISTINCT S.Id) as totalStores,
        SUM(CASE WHEN S.IsActive = 1 THEN 1 ELSE 0 END) as activeStores,
        SUM(CASE WHEN S.IsActive = 0 OR S.IsActive IS NULL THEN 1 ELSE 0 END) as pausedStores,
        COUNT(DISTINCT S.Marketplace) as marketplaces,
        SUM(CASE WHEN S.LastScrapedAt >= DATEADD(HOUR, -24, GETDATE()) THEN 1 ELSE 0 END) as activeToday,
        COUNT(A.Id) as totalAsins,
        SUM(CASE WHEN A.Status IS NULL OR A.Status != 'Inactive' THEN 1 ELSE 0 END) as activeAsins
      FROM Sellers S
      LEFT JOIN Asins A ON S.Id = A.SellerId
      ${whereClause}
    `);

    const stats = result.recordset[0];
    res.json({
      success: true,
      data: {
        totalStores: Number(stats.totalStores) || 0,
        activeStores: Number(stats.activeStores) || 0,
        pausedStores: Number(stats.pausedStores) || 0,
        totalAsins: Number(stats.totalAsins) || 0,
        activeAsins: Number(stats.activeAsins) || 0,
        marketplaces: Number(stats.marketplaces) || 0,
        activeToday: Number(stats.activeToday) || 0,
      }
    });
  } catch (error) {
    console.error('getSellerStats error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

// Get all sellers
exports.getSellers = async (req, res) => {
  try {
    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager', 'Listing Manager'].includes(roleName);

    const { status, marketplace, manager, search, page = 1, limit = 200 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Generate a secure cache key based on query parameters and user's specific access scope
    const cacheKey = JSON.stringify({
      status,
      marketplace,
      manager,
      search,
      page: pageNum,
      limit: limitNum,
      roleName,
      userId: req.user?._id || req.userId,
      assignedSellers: (req.user?.assignedSellers || []).map(s => (s._id || s).toString())
    });

    const cachedData = getCachedSellers(cacheKey);
    if (cachedData) {
      console.log('[SELLER CACHE] Cache HIT for sellers key:', cacheKey);
      return res.json({
        success: true,
        data: cachedData
      });
    }

    const pool = await getPool();
    let whereClause = 'WHERE 1=1';

    // Helper to apply inputs
    const applyInputs = (reqObj) => {
      if (status) reqObj.input('status', sql.Bit, status === 'Active' ? 1 : 0);
      if (marketplace) reqObj.input('marketplace', sql.NVarChar, marketplace);
      if (manager) reqObj.input('manager', sql.VarChar, manager);
      if (search) reqObj.input('search', sql.NVarChar, `%${search}%`);
      return reqObj;
    };

    const sellerReq = pool.request();
    if (!isGlobalUser) {
      const sellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
      if (sellerIds.length === 0) {
        const emptyResponse = { sellers: [], pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 } };
        setCachedSellers(cacheKey, emptyResponse);
        return res.json({ success: true, data: emptyResponse });
      }
      const sellerInClause = buildInClause(sellerReq, 'gsSellerId', sellerIds);
      whereClause += ` AND Id IN (${sellerInClause})`;
    }

    if (status) whereClause += ' AND IsActive = @status';
    if (marketplace) whereClause += ' AND Marketplace = @marketplace';
    if (manager) whereClause += ' AND Id IN (SELECT SellerId FROM UserSellers WHERE UserId = @manager)';
    if (search) whereClause += ' AND (Name LIKE @search OR SellerId LIKE @search)';

    applyInputs(sellerReq);
    const countResult = await sellerReq.query(`SELECT COUNT(*) as total FROM Sellers ${whereClause}`);
    const total = countResult.recordset[0].total;

    // Prepare paginated query with parameters
    const sqlQuery = `
      SELECT Id as _id, Name as name, Marketplace as marketplace, SellerId as sellerId, 
             OctoparseId as octoparseId, IsActive as status, IsPriority as isPriority, [Plan] as sellerPlan,
             ScrapeLimit as scrapeLimit, CreatedAt as createdAt, UpdatedAt as updatedAt,
             LastScrapedAt as lastScraped, LiveSyncClientId as liveSyncClientId,
             LiveSyncClientSecret as liveSyncClientSecret, PartnerTag as partnerTag,
             LiveSyncEnabled as liveSyncEnabled
       FROM Sellers
       ${whereClause}
       ORDER BY Name ASC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    let sellers;
    try {
      const sellersResult = await sellerReq
        .input('offset', sql.Int, offset)
        .input('limit', sql.Int, limitNum)
        .query(sqlQuery);
      sellers = sellersResult.recordset.map(s => ({
        ...s,
        status: s.status ? 'Active' : 'Inactive',
        isPriority: !!s.isPriority,
        plan: s.sellerPlan,
        liveSyncEnabled: !!s.liveSyncEnabled
      }));
      console.log('Fetched sellers count:', sellers.length);
    } catch (e) {
      console.error('Error in sellers main query:', e.message);
      throw e;
    }

    try {
        // Run both enrichments in parallel instead of sequential
        const [enrichedWithManagers, enrichedWithAsins] = await Promise.all([
            enrichSellersWithManagers(sellers),
            enrichSellersWithAsinCounts(sellers)
        ]);
        
        // Merge results - managers first, then asin counts
        sellers = sellers.map(seller => {
            const sId = seller._id || seller.Id;
            const managersData = enrichedWithManagers.find(m => (m._id || m.Id) === sId);
            const asinsData = enrichedWithAsins.find(a => (a._id || a.Id) === sId);
            return {
                ...seller,
                managers: managersData?.managers || [],
                totalAsins: asinsData?.totalAsins || 0,
                activeAsins: asinsData?.activeAsins || 0
            };
        });
        console.log('Enriched managers and asinCounts in parallel');
    } catch (e) {
        console.error('Error in enrichment:', e.message);
        throw e;
    }

      const payload = {
        sellers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };

      setCachedSellers(cacheKey, payload);

      res.json({
        success: true,
        data: payload
      });
    } catch (error) {
      console.error('getSellers error:', error.message);
      res.status(500).json({ error: error.message });
    }
  };

  // Get single seller
  exports.getSeller = async (req, res) => {
    try {
      const { id } = req.params;
      const roleName = req.user?.role?.name || req.user?.role;
      const isGlobalUser = ['admin', 'operational_manager', 'Listing Manager'].includes(roleName);
      const isAssigned = (req.user?.assignedSellers || []).some(s => (s._id || s).toString() === id);

      if (!isGlobalUser && !isAssigned) {
        return res.status(403).json({ error: 'Unauthorized access to seller profile' });
      }

      const pool = await getPool();
      const sellerResult = await pool.request()
        .input('id', sql.VarChar, id)
        .query('SELECT * FROM Sellers WHERE Id = @id');

      if (sellerResult.recordset.length === 0) {
        return res.status(404).json({ error: 'Seller not found' });
      }

      const seller = sellerResult.recordset[0];
      const asinsResult = await pool.request()
        .input('id', sql.VarChar, id)
        .query('SELECT * FROM Asins WHERE SellerId = @id ORDER BY CreatedAt DESC');

      res.json({
        seller: {
          ...seller,
          _id: seller.Id,
          name: seller.Name,
          marketplace: seller.Marketplace,
          sellerId: seller.SellerId,
          status: seller.IsActive ? 'Active' : 'Inactive',
          isPriority: !!seller.IsPriority,
          octoparseId: seller.OctoparseId,
          plan: seller.Plan,
          scrapeLimit: seller.ScrapeLimit,
          scrapeUsed: seller.ScrapeUsed,
          lastScraped: seller.LastScrapedAt,
          liveSyncClientId: seller.LiveSyncClientId,
          liveSyncClientSecret: seller.LiveSyncClientSecret,
          partnerTag: seller.PartnerTag,
          liveSyncEnabled: !!seller.LiveSyncEnabled
        },
        asins: asinsResult.recordset.map(a => ({ ...a, _id: a.Id }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Create new seller
  exports.createSeller = async (req, res) => {
    try {
      const userRole = req.user?.role?.name || req.user?.role;
      const isGlobalUser = ['admin', 'operational_manager', 'Listing Manager'].includes(userRole);
      const isManager = userRole === 'manager' || userRole === 'Brand Manager';
      const { assignedUserIds, name, marketplace, sellerId, status, isPriority, liveSyncClientId, liveSyncClientSecret, partnerTag, liveSyncEnabled } = req.body;

      const pool = await getPool();
      const id = generateId();

      const request = pool.request();
      request
        .input('id', sql.VarChar, id)
        .input('name', sql.NVarChar, name)
        .input('marketplace', sql.NVarChar, marketplace || 'amazon.in')
        .input('sellerId', sql.NVarChar, sellerId || null)
        .input('isActive', sql.Bit, status === 'Active' ? 1 : 0)
        .input('isPriority', sql.Bit, isPriority === true ? 1 : 0)
        .input('octoparseId', sql.NVarChar, req.body.octoparseId || null)
        .input('plan', sql.NVarChar, req.body.plan || 'Starter')
        .input('scrapeLimit', sql.Int, req.body.scrapeLimit || 100)
        .input('liveSyncClientId', sql.NVarChar, liveSyncClientId || null)
        .input('liveSyncClientSecret', sql.NVarChar, liveSyncClientSecret || null)
        .input('partnerTag', sql.NVarChar, partnerTag || null)
        .input('liveSyncEnabled', sql.Bit, liveSyncEnabled === true || liveSyncEnabled === 1 ? 1 : 0);

      await request.query(`
        INSERT INTO Sellers (Id, Name, Marketplace, SellerId, IsActive, IsPriority, OctoparseId, [Plan], ScrapeLimit, LiveSyncClientId, LiveSyncClientSecret, PartnerTag, LiveSyncEnabled, CreatedAt, UpdatedAt)
        VALUES (@id, @name, @marketplace, @sellerId, @isActive, @isPriority, @octoparseId, @plan, @scrapeLimit, @liveSyncClientId, @liveSyncClientSecret, @partnerTag, @liveSyncEnabled, dbo.GetEnvDate(), dbo.GetEnvDate())
      `);

      // Assign to users
      const usersToAssign = assignedUserIds && Array.isArray(assignedUserIds) ? assignedUserIds : [];
      if (isManager && !usersToAssign.includes(req.user._id)) {
        usersToAssign.push(req.user._id);
      }

      if (usersToAssign.length > 0) {
        for (const uId of usersToAssign) {
          await pool.request()
            .input('userId', sql.VarChar, uId.toString())
            .input('sellerId', sql.VarChar, id)
            .query('INSERT INTO UserSellers (UserId, SellerId) VALUES (@userId, @sellerId)');
        }
      }

      clearSellerCache();
      res.status(201).json({ success: true, data: { _id: id, name, marketplace, sellerId, status } });

      // Log Action
      await SystemLogService.log({
        type: 'CREATE',
        entityType: 'SELLER',
        entityId: id,
        entityTitle: name,
        user: req.user?._id || req.userId,
        description: `Created new seller profile: ${name} (${marketplace})`
      });

      if (marketplace) {
        marketDataSyncService.ensureTaskForSeller(id).catch(err => {
          console.error(`❌ Error during automated task creation for seller ${name}:`, err.message);
        });
      }
    } catch (error) {
      if (error.message.includes('UNIQUE KEY')) {
        return res.status(400).json({ error: 'Seller ID already exists' });
      }
      res.status(500).json({ error: error.message });
    }
  };

  // Update seller
  exports.updateSeller = async (req, res) => {
    try {
      const { id } = req.params;
      const { assignedUserIds, name, marketplace, sellerId, status, isPriority, liveSyncClientId, liveSyncClientSecret, partnerTag, liveSyncEnabled } = req.body;
      const userRole = req.user?.role?.name || req.user?.role;
      const isGlobalUser = ['admin', 'operational_manager', 'Listing Manager'].includes(userRole);

      const pool = await getPool();

      // Fetch existing seller for partial updates (e.g. status toggle)
      const currentResult = await pool.request()
        .input('id', sql.VarChar, id)
        .query('SELECT * FROM Sellers WHERE Id = @id');

      if (currentResult.recordset.length === 0) {
        return res.status(404).json({ error: 'Seller not found' });
      }
      const current = currentResult.recordset[0];

      // Merge incoming fields with existing database fallbacks
      const finalName = name !== undefined ? name : current.Name;
      const finalMarketplace = marketplace !== undefined ? marketplace : current.Marketplace;
      const finalSellerId = sellerId === undefined ? current.SellerId : (sellerId || null);

      let finalIsActive = current.IsActive;
      if (status !== undefined) {
        finalIsActive = status === 'Active' ? 1 : 0;
      }

      let finalIsPriority = current.IsPriority;
      if (isPriority !== undefined) {
        finalIsPriority = isPriority === true ? 1 : 0;
      }

      const finalOctoId = req.body.octoparseId === undefined ? current.OctoparseId : (req.body.octoparseId || null);
      const finalPlan = req.body.plan === undefined ? current.Plan : (req.body.plan || 'Starter');
      const finalScrapeLimit = req.body.scrapeLimit === undefined ? current.ScrapeLimit : (parseInt(req.body.scrapeLimit) || 100);
      const finalLiveSyncClientId = liveSyncClientId === undefined ? current.LiveSyncClientId : (liveSyncClientId || null);
      const finalLiveSyncClientSecret = liveSyncClientSecret === undefined ? current.LiveSyncClientSecret : (liveSyncClientSecret || null);
      const finalPartnerTag = partnerTag === undefined ? current.PartnerTag : (partnerTag || null);

      let finalLiveSyncEnabled = current.LiveSyncEnabled;
      if (liveSyncEnabled !== undefined) {
        finalLiveSyncEnabled = liveSyncEnabled === true || liveSyncEnabled === 1 ? 1 : 0;
      }

      const request = pool.request();
      request
        .input('id', sql.VarChar, id)
        .input('name', sql.NVarChar, finalName)
        .input('marketplace', sql.NVarChar, finalMarketplace)
        .input('sellerId', sql.NVarChar, finalSellerId)
        .input('isActive', sql.Bit, finalIsActive)
        .input('isPriority', sql.Bit, finalIsPriority)
        .input('octoparseId', sql.NVarChar, finalOctoId)
        .input('plan', sql.NVarChar, finalPlan)
        .input('scrapeLimit', sql.Int, finalScrapeLimit)
        .input('liveSyncClientId', sql.NVarChar, finalLiveSyncClientId)
        .input('liveSyncClientSecret', sql.NVarChar, finalLiveSyncClientSecret)
        .input('partnerTag', sql.NVarChar, finalPartnerTag)
        .input('liveSyncEnabled', sql.Bit, finalLiveSyncEnabled);

      await request.query(`
        UPDATE Sellers 
        SET Name = @name, Marketplace = @marketplace, SellerId = @sellerId, 
            IsActive = @isActive, IsPriority = @isPriority, OctoparseId = @octoparseId, [Plan] = @plan, 
            ScrapeLimit = @scrapeLimit, LiveSyncClientId = @liveSyncClientId, 
            LiveSyncClientSecret = @liveSyncClientSecret, PartnerTag = @partnerTag, 
            LiveSyncEnabled = @liveSyncEnabled, UpdatedAt = dbo.GetEnvDate()
        WHERE Id = @id
      `);

      // Handle Archiving/Restoring ASINs when Seller status changes
      if (finalIsActive === 0 && current.IsActive === true) {
        console.log(`[SELLER PAUSED] Archiving ASINs for seller ${id}`);
        await pool.request()
          .input('sellerId', sql.VarChar, id)
          .query("UPDATE Asins SET Status = 'Archived', UpdatedAt = dbo.GetEnvDate() WHERE SellerId = @sellerId AND (Status IS NULL OR Status != 'Inactive')");
      } else if (finalIsActive === 1 && current.IsActive === false) {
        console.log(`[SELLER RESUMED] Un-archiving ASINs for seller ${id}`);
        await pool.request()
          .input('sellerId', sql.VarChar, id)
          .query("UPDATE Asins SET Status = 'Active', UpdatedAt = dbo.GetEnvDate() WHERE SellerId = @sellerId AND Status = 'Archived'");
      }

      if (isGlobalUser && assignedUserIds !== undefined) {
        // Fetch current managers BEFORE changing them (for change log)
        const prevManagersResult = await pool.request()
          .input('sid', sql.VarChar, id)
          .query(`
          SELECT u.Id, u.FirstName, u.LastName, u.Email
          FROM Users u
          JOIN UserSellers us ON u.Id = us.UserId
          WHERE us.SellerId = @sid
        `);
        const prevManagers = prevManagersResult.recordset;
        const prevManagerIds = prevManagers.map(m => m.Id);

        // Apply new manager assignments
        await pool.request().input('id', sql.VarChar, id).query('DELETE FROM UserSellers WHERE SellerId = @id');
        if (Array.isArray(assignedUserIds) && assignedUserIds.length > 0) {
          for (const uId of assignedUserIds) {
            await pool.request()
              .input('userId', sql.VarChar, uId)
              .input('sellerId', sql.VarChar, id)
              .query('INSERT INTO UserSellers (UserId, SellerId) VALUES (@userId, @sellerId)');
          }
        }

        // Detect manager changes and log them
        const newManagerIds = Array.isArray(assignedUserIds) ? assignedUserIds.map(String) : [];
        const removed = prevManagers.filter(m => !newManagerIds.includes(String(m.Id)));
        const added = newManagerIds.filter(id => !prevManagerIds.map(String).includes(String(id)));

        if (removed.length > 0 || added.length > 0) {
          // Fetch names for newly added managers
          let addedNames = [];
          if (added.length > 0) {
            const userReq = pool.request();
            const addedInClause = buildInClause(userReq, 'addedUser', added);
            const addedNamesResult = await userReq
              .query(`SELECT Id, FirstName, LastName, Email FROM Users WHERE Id IN (${addedInClause})`);
            addedNames = addedNamesResult.recordset;
          }

          const removedDesc = removed.map(m => `${m.FirstName} ${m.LastName} (${m.Email})`).join(', ');
          const addedDesc = addedNames.map(m => `${m.FirstName} ${m.LastName} (${m.Email})`).join(', ');

          let changeDesc = `Manager assignment changed for seller "${finalName}" (${finalMarketplace}).`;
          if (removed.length > 0) changeDesc += ` Removed: ${removedDesc}.`;
          if (added.length > 0) changeDesc += ` Added: ${addedDesc}.`;

          await SystemLogService.log({
            type: 'MANAGER_CHANGE',
            entityType: 'SELLER',
            entityId: id,
            entityTitle: finalName,
            user: req.user?._id || req.userId,
            description: changeDesc,
            metadata: {
              previousManagers: prevManagers.map(m => ({ id: m.Id, name: `${m.FirstName} ${m.LastName}`, email: m.Email })),
              newManagerIds: newManagerIds,
              removedManagers: removed.map(m => ({ id: m.Id, name: `${m.FirstName} ${m.LastName}`, email: m.Email })),
              addedManagerIds: added
            }
          });
        }
      } else if (!isGlobalUser) {
        // Non-global users cannot reassign managers — skip manager update block
      }

      clearSellerCache();
      res.json({ success: true });

      // Log Update
      await SystemLogService.log({
        type: 'UPDATE',
        entityType: 'SELLER',
        entityId: id,
        entityTitle: finalName,
        user: req.user?._id || req.userId,
        description: `Updated seller profile settings for ${finalName}`
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Delete seller
  exports.deleteSeller = async (req, res) => {
    try {
      const { id } = req.params;
      if (req.user?.role?.name !== 'admin' && req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Only Super Administrators can delete sellers' });
      }

      const pool = await getPool();

      // 1. Get all ASINs for this seller
      const asinsResult = await pool.request()
        .input('id', sql.VarChar, id)
        .query('SELECT Id FROM Asins WHERE SellerId = @id');
      const asins = asinsResult.recordset;

      // 2. Cascade delete ASIN-related metrics if there are any
      if (asins.length > 0) {
        const asinReq = pool.request();
        const asinInClause = buildInClause(asinReq, 'asinId', asins.map(a => a.Id));

        // Delete historical metrics
        await asinReq.query(`DELETE FROM AsinHistory WHERE AsinId IN (${asinInClause})`);
        await asinReq.query(`DELETE FROM AsinWeekHistory WHERE AsinId IN (${asinInClause})`);
        await asinReq.query(`DELETE FROM SubBsrHistory WHERE AsinId IN (${asinInClause})`);
        await asinReq.query(`DELETE FROM RevenueCalculators WHERE AsinId IN (${asinInClause})`);
      }

      // 3. Delete related Actions
      await pool.request()
        .input('id', sql.VarChar, id)
        .query('DELETE FROM Actions WHERE SellerId = @id');

      // 4. Update OctoTasks
      await pool.request()
        .input('id', sql.VarChar, id)
        .query('UPDATE OctoTasks SET SellerId = NULL, IsAssigned = 0, LastAssignedAt = NULL WHERE SellerId = @id');

      // 5. Delete UserSellers mapping
      await pool.request()
        .input('id', sql.VarChar, id)
        .query('DELETE FROM UserSellers WHERE SellerId = @id');

      // 6. Delete ASINs
      await pool.request()
        .input('id', sql.VarChar, id)
        .query('DELETE FROM Asins WHERE SellerId = @id');

      // 7. Delete Seller itself
      await pool.request()
        .input('id', sql.VarChar, id)
        .query('DELETE FROM Sellers WHERE Id = @id');

      clearSellerCache();
      res.json({ message: 'Seller deleted successfully' });

      // Log Delete
      await SystemLogService.log({
        type: 'DELETE',
        entityType: 'SELLER',
        entityId: id,
        user: req.user?._id || req.userId,
        description: `Permanently deleted seller and all cascading associations (ID: ${id})`
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  // Bulk import
  exports.importSellers = async (req, res) => {
    // Similar to create, but in a loop. Skipping full implementation for brevity unless requested.
    res.status(501).json({ error: 'Not implemented for SQL yet' });
  };