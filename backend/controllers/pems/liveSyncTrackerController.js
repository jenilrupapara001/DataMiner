/**
 * Live Sync Tracker API
 * Tracks how many brands/sellers have completed live sync
 */
const { sql, getPool } = require('../../database/db');

/**
 * GET /api/live-sync-tracker/overview
 * Complete overview of live sync status across all sellers
 */
exports.getOverview = async (req, res) => {
  try {
    const pool = await getPool();

    // Overall stats
    const overview = await pool.request().query(`
      SELECT 
        COUNT(*) as totalSellers,
        SUM(CASE WHEN IsActive = 1 THEN 1 ELSE 0 END) as activeSellers,
        SUM(CASE WHEN LiveSyncEnabled = 1 THEN 1 ELSE 0 END) as liveSyncEnabled,
        SUM(CASE WHEN LiveSyncEnabled = 1 AND LastLiveSyncAt IS NOT NULL THEN 1 ELSE 0 END) as syncedSellers,
        SUM(CASE WHEN LiveSyncEnabled = 0 OR LiveSyncEnabled IS NULL THEN 1 ELSE 0 END) as notEnabledSellers
      FROM Sellers
    `);

    // ASIN sync stats
    const asinStats = await pool.request().query(`
      SELECT 
        COUNT(*) as totalAsins,
        SUM(CASE WHEN LastSyncSource = 'LIVE' THEN 1 ELSE 0 END) as liveSynced,
        SUM(CASE WHEN LastSyncSource = 'OCTOPARSE' THEN 1 ELSE 0 END) as octoparseSynced,
        SUM(CASE WHEN LastSyncSource IS NULL OR LastSyncSource = '' THEN 1 ELSE 0 END) as unsynced,
        SUM(CASE WHEN LastLiveSyncAt IS NOT NULL THEN 1 ELSE 0 END) as hasLiveSyncDate,
        MAX(LastLiveSyncAt) as latestLiveSync
      FROM Asins
    `);

    // Sellers by sync status
    const byStatus = await pool.request().query(`
      SELECT 
        CASE 
          WHEN LiveSyncEnabled = 1 AND LastLiveSyncAt IS NOT NULL THEN 'Synced'
          WHEN LiveSyncEnabled = 1 THEN 'Enabled (Not Synced)'
          ELSE 'Not Enabled'
        END as syncStatus,
        COUNT(*) as sellerCount
      FROM Sellers
      WHERE IsActive = 1
      GROUP BY 
        CASE 
          WHEN LiveSyncEnabled = 1 AND LastLiveSyncAt IS NOT NULL THEN 'Synced'
          WHEN LiveSyncEnabled = 1 THEN 'Enabled (Not Synced)'
          ELSE 'Not Enabled'
        END
    `);

    // ASIN sync by source
    const asinBySource = await pool.request().query(`
      SELECT 
        ISNULL(LastSyncSource, 'None') as source,
        COUNT(*) as count
      FROM Asins
      GROUP BY LastSyncSource
      ORDER BY count DESC
    `);

    res.json({
      success: true,
      data: {
        overview: overview.recordset[0] || {},
        asinStats: asinStats.recordset[0] || {},
        byStatus: byStatus.recordset || [],
        asinBySource: asinBySource.recordset || [],
      }
    });
  } catch (err) {
    console.error('Live sync tracker overview error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/live-sync-tracker/sellers
 * Per-seller live sync status with ASIN counts
 */
exports.getSellers = async (req, res) => {
  try {
    const pool = await getPool();
    const { marketplace, status } = req.query;

    let where = 'WHERE 1=1';
    const req_ = pool.request();
    if (marketplace && marketplace !== 'all') { where += ' AND s.Marketplace = @mp'; req_.input('mp', sql.VarChar, marketplace); }

    const result = await req_.query(`
      SELECT 
        s.Id, s.Name, s.Marketplace, s.LiveSyncEnabled, s.LastLiveSyncAt,
        s.LastLiveSyncAt as SellerLastSync,
        (SELECT COUNT(*) FROM Asins a WHERE a.SellerId = s.Id) as totalAsins,
        (SELECT COUNT(*) FROM Asins a WHERE a.SellerId = s.Id AND a.LastSyncSource = 'LIVE') as liveSyncedAsins,
        (SELECT COUNT(*) FROM Asins a WHERE a.SellerId = s.Id AND a.LastSyncSource = 'OCTOPARSE') as octoparseAsins,
        (SELECT MAX(a.LastLiveSyncAt) FROM Asins a WHERE a.SellerId = s.Id) as lastAsinSync,
        (SELECT TOP 1 a.LastLiveSyncAt FROM Asins a WHERE a.SellerId = s.Id AND a.LastSyncSource = 'LIVE' ORDER BY a.LastLiveSyncAt DESC) as lastLiveSyncAt
      FROM Sellers s
      ${where}
      ORDER BY s.Name
    `);

    // Calculate sync status per seller
    const sellers = result.recordset.map(s => ({
      ...s,
      syncStatus: s.LiveSyncEnabled && s.lastLiveSyncAt ? 'synced' : s.LiveSyncEnabled ? 'enabled' : 'not_enabled',
      syncPercentage: s.totalAsins > 0 ? Math.round((s.liveSyncedAsins / s.totalAsins) * 100) : 0,
      hoursSinceSync: s.lastLiveSyncAt ? Math.round((Date.now() - new Date(s.lastLiveSyncAt)) / (1000 * 60 * 60)) : null,
    }));

    // Filter by sync status if requested
    const filtered = status === 'synced' ? sellers.filter(s => s.syncStatus === 'synced')
      : status === 'enabled' ? sellers.filter(s => s.syncStatus === 'enabled')
      : status === 'not_enabled' ? sellers.filter(s => s.syncStatus === 'not_enabled')
      : sellers;

    res.json({ success: true, data: filtered, total: filtered.length });
  } catch (err) {
    console.error('Live sync tracker sellers error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/live-sync-tracker/seller/:sellerId
 * Detailed sync history for a specific seller
 */
exports.getSellerDetail = async (req, res) => {
  try {
    const pool = await getPool();
    const { sellerId } = req.params;

    const seller = await pool.request().input('sid', sql.VarChar, sellerId)
      .query(`SELECT Id, Name, Marketplace, LiveSyncEnabled, LastLiveSyncAt FROM Sellers WHERE Id = @sid`);

    if (!seller.recordset.length) return res.status(404).json({ success: false, error: 'Seller not found' });

    const s = seller.recordset[0];

    // ASIN sync breakdown
    const asinStats = await pool.request().input('sid', sql.VarChar, sellerId).query(`
      SELECT 
        COUNT(*) as totalAsins,
        SUM(CASE WHEN LastSyncSource = 'LIVE' THEN 1 ELSE 0 END) as liveSynced,
        SUM(CASE WHEN LastSyncSource = 'OCTOPARSE' THEN 1 ELSE 0 END) as octoparseSynced,
        SUM(CASE WHEN LastSyncSource IS NULL OR LastSyncSource = '' THEN 1 ELSE 0 END) as unsynced,
        MAX(LastLiveSyncAt) as lastSync,
        MIN(CASE WHEN LastSyncSource = 'LIVE' THEN LastLiveSyncAt END) as firstLiveSync
      FROM Asins WHERE SellerId = @sid
    `);

    // Recent sync activity (last 20 synced ASINs)
    const recentSyncs = await pool.request().input('sid', sql.VarChar, sellerId).query(`
      SELECT TOP 20 AsinCode, LastLiveSyncAt, LastSyncSource, CurrentPrice, BSR
      FROM Asins WHERE SellerId = @sid AND LastLiveSyncAt IS NOT NULL
      ORDER BY LastLiveSyncAt DESC
    `);

    // Sync by hour (last 24h)
    const hourly = await pool.request().input('sid', sql.VarChar, sellerId).query(`
      SELECT 
        FORMAT(LastLiveSyncAt, 'yyyy-MM-dd HH:00:00') as hour,
        COUNT(*) as asinCount
      FROM Asins WHERE SellerId = @sid AND LastLiveSyncAt >= DATEADD(HOUR, -24, GETDATE())
      GROUP BY FORMAT(LastLiveSyncAt, 'yyyy-MM-dd HH:00:00')
      ORDER BY hour
    `);

    res.json({
      success: true,
      data: {
        seller: s,
        stats: asinStats.recordset[0] || {},
        recentSyncs: recentSyncs.recordset || [],
        hourlySyncs: hourly.recordset || [],
      }
    });
  } catch (err) {
    console.error('Live sync tracker seller detail error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/live-sync-tracker/activity
 * Recent live sync activity across all sellers
 */
exports.getActivity = async (req, res) => {
  try {
    const pool = await getPool();
    const { limit = 50 } = req.query;

    const result = await pool.request().input('limit', sql.Int, parseInt(limit)).query(`
      SELECT TOP (@limit)
        a.AsinCode, a.LastLiveSyncAt, a.LastSyncSource, a.CurrentPrice, a.BSR, a.Rating,
        s.Name as SellerName, s.Id as SellerId
      FROM Asins a
      JOIN Sellers s ON a.SellerId = s.Id
      WHERE a.LastLiveSyncAt IS NOT NULL AND a.LastSyncSource = 'LIVE'
      ORDER BY a.LastLiveSyncAt DESC
    `);

    res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    console.error('Live sync tracker activity error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/live-sync-tracker/trigger
 * Trigger live sync for selected sellers
 */
exports.triggerSync = async (req, res) => {
  try {
    const { sellerIds } = req.body;
    if (!sellerIds || !Array.isArray(sellerIds) || sellerIds.length === 0) {
      return res.status(400).json({ success: false, error: 'sellerIds array required' });
    }

    const pool = await getPool();
    // Update LiveSyncEnabled for selected sellers
    for (const sid of sellerIds) {
      await pool.request().input('sid', sql.VarChar, sid)
        .query('UPDATE Sellers SET LiveSyncEnabled = 1, UpdatedAt = dbo.GetEnvDate() WHERE Id = @sid');
    }

    // Trigger sync via existing service
    const liveSyncService = require('../liveDataSyncService');
    liveSyncService.syncAllSellers({ targetSellers: sellerIds }).catch(err => {
      console.error('Live sync trigger error:', err.message);
    });

    res.json({ success: true, message: `Live sync triggered for ${sellerIds.length} sellers`, sellerIds });
  } catch (err) {
    console.error('Live sync trigger error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};
