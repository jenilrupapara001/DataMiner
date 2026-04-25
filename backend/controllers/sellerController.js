const { sql, getPool, generateId } = require('../database/db');
const marketDataSyncService = require('../services/marketDataSyncService');

/**
 * Enrich sellers with their assigned managers.
 */
const enrichSellersWithManagers = async (sellers) => {
  if (!sellers || sellers.length === 0) return sellers;
  const sellerIds = sellers.map(s => s.Id);
  const pool = await getPool();
  
  const result = await pool.request()
    .query(`
      SELECT u.Id as _id, u.FirstName as firstName, u.LastName as lastName, u.Email as email, us.SellerId
      FROM Users u
      JOIN UserSellers us ON u.Id = us.UserId
      WHERE us.SellerId IN (${sellerIds.map(id => `'${id}'`).join(',')})
    `);

  const managers = result.recordset;

  return sellers.map(seller => {
    const sellerManagers = managers
      .filter(m => m.SellerId === seller.Id)
      .map(({ SellerId, ...m }) => m);
    return { ...seller, _id: seller.Id, managers: sellerManagers };
  });
};

/**
 * Enrich sellers with dynamic ASIN counts.
 */
const enrichSellersWithAsinCounts = async (sellers) => {
  if (!sellers || sellers.length === 0) return sellers;
  const sellerIds = sellers.map(s => s.Id);
  const pool = await getPool();

  const result = await pool.request()
    .query(`
      SELECT SellerId, 
             COUNT(*) as totalAsins,
             SUM(CASE WHEN Status = 'Active' THEN 1 ELSE 0 END) as activeAsins
      FROM Asins
      WHERE SellerId IN (${sellerIds.map(id => `'${id}'`).join(',')})
      GROUP BY SellerId
    `);

  const countMap = {};
  result.recordset.forEach(c => {
    countMap[c.SellerId] = c;
  });

  return sellers.map(seller => {
    const stats = countMap[seller.Id] || { totalAsins: 0, activeAsins: 0 };
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
    const offset = (pageNum - 1) * limitNum;

    const pool = await getPool();
    let whereClause = 'WHERE 1=1';
    const request = pool.request();

    if (!isGlobalUser) {
      const sellerIds = (req.user.assignedSellers || []).map(s => (s._id || s).toString());
      if (sellerIds.length === 0) {
        return res.json({ success: true, data: { sellers: [], pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 } } });
      }
      whereClause += ` AND Id IN (${sellerIds.map(id => `'${id}'`).join(',')})`;
    }

    if (status) {
      whereClause += ' AND IsActive = @status';
      request.input('status', sql.Bit, status === 'Active' ? 1 : 0);
    }
    if (marketplace) {
      whereClause += ' AND Marketplace = @marketplace';
      request.input('marketplace', sql.NVarChar, marketplace);
    }
    if (search) {
      whereClause += ' AND (Name LIKE @search OR SellerId LIKE @search)';
      request.input('search', sql.NVarChar, `%${search}%`);
    }

    const countResult = await request.query(`SELECT COUNT(*) as total FROM Sellers ${whereClause}`);
    const total = countResult.recordset[0].total;

    // Prepare paginated query with parameters
    const sqlQuery = `
      SELECT Id as _id, Id, Name as name, Marketplace as marketplace, SellerId as sellerId,
             OctoparseId as octoparseId, IsActive as status, [Plan] as sellerPlan,
             ScrapeLimit as scrapeLimit, ScrapeUsed as scrapeUsed, LastScrapedAt as lastScraped,
             CreatedAt, UpdatedAt
      FROM Sellers
      ${whereClause}
      ORDER BY Name ASC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    let sellers;
    try {
        const sellersResult = await request
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, limitNum)
            .query(sqlQuery);
        sellers = sellersResult.recordset.map(s => ({
            ...s,
            status: s.status ? 'Active' : 'Inactive',
            plan: s.sellerPlan
        }));
        console.log('Fetched sellers count:', sellers.length);
    } catch (e) {
        console.error('Error in sellers main query:', e.message);
        throw e;
    }

    try {
        sellers = await enrichSellersWithManagers(sellers);
        console.log('Enriched managers');
    } catch (e) {
        console.error('Error in enrichManagers:', e.message);
        throw e;
    }
    try {
        sellers = await enrichSellersWithAsinCounts(sellers);
        console.log('Enriched asinCounts');
    } catch (e) {
        console.error('Error in enrichAsinCounts:', e.message);
        throw e;
    }

    res.json({
      success: true,
      data: {
        sellers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      }
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
    const isGlobalUser = ['admin', 'operational_manager'].includes(roleName);
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
          octoparseId: seller.OctoparseId,
          plan: seller.Plan,
          scrapeLimit: seller.ScrapeLimit,
          scrapeUsed: seller.ScrapeUsed,
          lastScraped: seller.LastScrapedAt
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
    const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);
    const isManager = userRole === 'manager' || userRole === 'Brand Manager';
    const { managerId, name, marketplace, sellerId, status } = req.body;

    const pool = await getPool();
    const id = generateId();

    await pool.request()
      .input('id', sql.VarChar, id)
      .input('name', sql.NVarChar, name)
      .input('marketplace', sql.NVarChar, marketplace)
      .input('sellerId', sql.NVarChar, sellerId)
      .input('isActive', sql.Bit, status === 'Active' ? 1 : 0)
      .input('octoparseId', sql.NVarChar, req.body.octoparseId || null)
      .input('plan', sql.NVarChar, req.body.plan || 'Starter')
      .input('scrapeLimit', sql.Int, req.body.scrapeLimit || 100)
      .query(`
        INSERT INTO Sellers (Id, Name, Marketplace, SellerId, IsActive, OctoparseId, [Plan], ScrapeLimit, CreatedAt, UpdatedAt)
        VALUES (@id, @name, @marketplace, @sellerId, @isActive, @octoparseId, @plan, @scrapeLimit, GETDATE(), GETDATE())
      `);

    // Assign to manager
    let assignToManagerId = isManager ? req.user._id : (isGlobalUser && managerId ? managerId : null);
    if (assignToManagerId) {
        await pool.request()
            .input('userId', sql.VarChar, assignToManagerId.toString())
            .input('sellerId', sql.VarChar, id)
            .query('INSERT INTO UserSellers (UserId, SellerId) VALUES (@userId, @sellerId)');
    }

     res.status(201).json({ success: true, data: { _id: id, name, marketplace, sellerId, status } });

    if (marketDataSyncService.isConfigured()) {
      marketDataSyncService.ensureTaskForSeller(id).catch(console.error);
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
    const { managerId, name, marketplace, sellerId, status } = req.body;
    const userRole = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager'].includes(userRole);

    const pool = await getPool();
    await pool.request()
      .input('id', sql.VarChar, id)
      .input('name', sql.NVarChar, name)
      .input('marketplace', sql.NVarChar, marketplace)
      .input('sellerId', sql.NVarChar, sellerId)
      .input('isActive', sql.Bit, status === 'Active' ? 1 : 0)
      .input('octoparseId', sql.NVarChar, req.body.octoparseId || null)
      .input('plan', sql.NVarChar, req.body.plan || 'Starter')
      .input('scrapeLimit', sql.Int, req.body.scrapeLimit || 100)
      .query(`
        UPDATE Sellers 
        SET Name = @name, Marketplace = @marketplace, SellerId = @sellerId, 
            IsActive = @isActive, OctoparseId = @octoparseId, [Plan] = @plan, 
            ScrapeLimit = @scrapeLimit, UpdatedAt = GETDATE()
        WHERE Id = @id
      `);

    if (isGlobalUser && managerId !== undefined) {
      await pool.request().input('id', sql.VarChar, id).query('DELETE FROM UserSellers WHERE SellerId = @id');
      if (managerId) {
        await pool.request()
          .input('userId', sql.VarChar, managerId)
          .input('sellerId', sql.VarChar, id)
          .query('INSERT INTO UserSellers (UserId, SellerId) VALUES (@userId, @sellerId)');
      }
    }

    res.json({ success: true });
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
    // Simplified cascade for this migration step - in production use DB-level cascades
    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM Asins WHERE SellerId = @id');
    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM UserSellers WHERE SellerId = @id');
    await pool.request().input('id', sql.VarChar, id).query('DELETE FROM Sellers WHERE Id = @id');

    res.json({ message: 'Seller deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Bulk import
exports.importSellers = async (req, res) => {
    // Similar to create, but in a loop. Skipping full implementation for brevity unless requested.
    res.status(501).json({ error: 'Not implemented for SQL yet' });
};

