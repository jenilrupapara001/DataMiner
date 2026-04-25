const { sql, getPool } = require('../database/db');

/**
 * Get master data with revenue (stub)
 */
exports.getMasterWithRevenue = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT a.*, s.Name as SellerName, s.Marketplace
                FROM Asins a
                LEFT JOIN Sellers s ON a.SellerId = s.Id
                ORDER BY a.CreatedAt DESC
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get chart data for dashboard (monthly trends)
 */
exports.getChartData = async (req, res) => {
    try {
        const { period = '30d' } = req.query;
        const pool = await getPool();

        // Simple: get ASIN count growth over time
        const result = await pool.request().query(`
            SELECT CAST(CreatedAt AS DATE) as date, COUNT(*) as count
            FROM Asins
            WHERE CreatedAt >= DATEADD(DAY, -30, GETDATE())
            GROUP BY CAST(CreatedAt AS DATE)
            ORDER BY date ASC
        `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Revenue by size (stub)
 */
exports.getRevenueBySize = async (req, res) => {
    res.json({ success: true, data: [] });
};

/**
 * Size share pie (stub)
 */
exports.getSizeShare = async (req, res) => {
    res.json({ success: true, data: [] });
};

/**
 * Get Ads Report
 */
exports.getAdsReport = async (req, res) => {
    try {
        const { asin, startDate, endDate } = req.query;
        const pool = await getPool();
        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (asin) { whereClause += " AND Asin = @asin"; request.input('asin', sql.VarChar, asin); }
        if (startDate) { whereClause += " AND Date >= @startDate"; request.input('startDate', sql.Date, startDate); }
        if (endDate) { whereClause += " AND Date <= @endDate"; request.input('endDate', sql.Date, endDate); }

        const result = request.query(`
            SELECT * FROM AdsPerformance ${whereClause} ORDER BY Date DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get SKU Report (stub)
 */
exports.getSkuReport = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT a.Id, a.AsinCode, a.Title, a.Brand, a.Category, a.CurrentPrice, a.BSR, a.Rating, a.ReviewCount, s.Name as SellerName
            FROM Asins a
            LEFT JOIN Sellers s ON a.SellerId = s.Id
            ORDER BY a.CreatedAt DESC
        `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get Parent ASIN Report (stub)
 */
exports.getParentAsinReport = async (req, res) => {
    res.json({ success: true, data: [] });
};

/**
 * Get Month-wise Report (stub)
 */
exports.getMonthWiseReport = async (req, res) => {
    res.json({ success: true, data: [] });
};

/**
 * Get categories list
 */
exports.getCategories = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .query(`
                SELECT DISTINCT Category as name, COUNT(*) as count
                FROM Asins
                WHERE Category IS NOT NULL AND Category <> ''
                GROUP BY Category
                ORDER BY count DESC
            `);
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Global search across ASINs and sellers
 */
exports.globalSearch = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ success: true, data: [] });

        const pool = await getPool();
        const searchTerm = `%${q}%`;

        const asinsResult = await pool.request()
            .input('search', sql.NVarChar, searchTerm)
            .query(`
                SELECT TOP 10 'asin' as type, Id, AsinCode as name, Title as description
                FROM Asins
                WHERE AsinCode LIKE @search OR Title LIKE @search
            `);

        const sellersResult = await pool.request()
            .input('search', sql.NVarChar, searchTerm)
            .query(`
                SELECT TOP 10 'seller' as type, Id, Name as name, SellerId as description
                FROM Sellers
                WHERE Name LIKE @search OR SellerId LIKE @search
            `);

        res.json({
            success: true,
            data: [...asinsResult.recordset, ...sellersResult.recordset]
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAdsPerformance = async (req, res) => {
    try {
        const { asin, startDate, endDate, reportType = 'daily' } = req.query;
        const pool = await getPool();

        let whereClause = 'WHERE 1=1';
        const request = pool.request();

        if (asin) {
            whereClause += " AND Asin = @asin";
            request.input('asin', sql.VarChar, asin);
        }
        if (startDate) {
            whereClause += " AND Date >= @startDate";
            request.input('startDate', sql.Date, startDate);
        }
        if (endDate) {
            whereClause += " AND Date <= @endDate";
            request.input('endDate', sql.Date, endDate);
        }
        if (reportType) {
            whereClause += " AND ReportType = @reportType";
            request.input('reportType', sql.VarChar, reportType);
        }

        const result = await request.query(`
            SELECT * FROM AdsPerformance
            ${whereClause}
            ORDER BY Date DESC
        `);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        console.error('Error fetching ads performance:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getProductData = async (req, res) => {
    try {
        const { asin } = req.query;
        if (!asin) return res.status(400).json({ success: false, message: 'ASIN required' });

        const pool = await getPool();
        const result = await pool.request()
            .input('asin', sql.VarChar, asin)
            .query(`SELECT * FROM Asins WHERE AsinCode = @asin`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'ASIN not found' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getSellerData = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const pool = await getPool();
        const result = await pool.request()
            .input('sellerId', sql.VarChar, sellerId)
            .query("SELECT * FROM Sellers WHERE Id = @sellerId");

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Seller not found' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getMonthlyPerformance = async (req, res) => {
    res.json({ success: true, data: [] });
};

exports.getMonthlyPerformance = async (req, res) => {
    res.json({ success: true, data: [] });
};

exports.uploadMonthlyPerformance = async (req, res) => {
    res.status(501).json({ success: false, message: 'Not implemented' });
};

exports.uploadAdsPerformance = async (req, res) => {
    res.status(501).json({ success: false, message: 'Not implemented in SQL yet' });
};
