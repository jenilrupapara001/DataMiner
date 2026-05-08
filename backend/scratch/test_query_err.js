const { getPool, sql } = require('../database/db');
require('dotenv').config();

async function testQuery() {
  try {
    const pool = await getPool();
    
    // Find admin user
    const userResult = await pool.request()
      .input('email', sql.VarChar, 'admin@gms.com')
      .query(`
        SELECT U.*, R.Name as RoleName, R.DisplayName as RoleDisplayName 
        FROM Users U
        LEFT JOIN Roles R ON U.RoleId = R.Id
        WHERE U.Email = @email
      `);
      
    if (userResult.recordset.length === 0) {
      console.log('User admin@gms.com not found');
      process.exit(0);
    }
    
    const userData = userResult.recordset[0];
    console.log(`User found: ${userData.Email}, Role: ${userData.RoleName}`);
    
    const req = {
      user: {
        ...userData,
        role: { Name: userData.RoleName === 'super_admin' ? 'admin' : userData.RoleName, name: userData.RoleName === 'super_admin' ? 'admin' : userData.RoleName, DisplayName: userData.RoleDisplayName },
        assignedSellers: [],
      },
      query: {
        seller: '',
        marketplace: 'amazon.in'
      }
    };
    
    console.log('--- TESTING getAsinStats Queries ---');
    const { seller } = req.query;
    const request = pool.request();
    let whereClause = 'WHERE 1=1';

    const roleName = req.user?.role?.name || req.user?.role;
    const isGlobalUser = ['admin', 'operational_manager', 'Listing Manager'].includes(roleName);

    if (!isGlobalUser) {
      const allowedSellerIds = (req.user?.assignedSellers || []).map(s => (s._id || s).toString());
      if (seller && allowedSellerIds.includes(seller)) {
        whereClause += ' AND SellerId = @seller';
        request.input('seller', sql.VarChar, seller);
      } else if (allowedSellerIds.length > 0) {
        whereClause += ` AND SellerId IN (${allowedSellerIds.map(id => `'${id}'`).join(',')})`;
      } else {
        whereClause += ' AND 1=0';
      }
    } else if (seller) {
      whereClause += ' AND SellerId = @seller';
      request.input('seller', sql.VarChar, seller);
    }

    if (req.query.marketplace) {
      whereClause += ' AND SellerId IN (SELECT Id FROM Sellers WHERE Marketplace = @marketplace)';
      request.input('marketplace', sql.VarChar, req.query.marketplace);
    }
    
    console.log(`Generated whereClause: "${whereClause}"`);
    
    console.log('Running Query 1: Basic Counts...');
    try {
      const basicCounts = await request.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN Status = 'Active' THEN 1 ELSE 0 END) as active,
          COUNT(DISTINCT Brand) as brandCount
        FROM Asins ${whereClause}
      `);
      console.log('Query 1 Success:', basicCounts.recordset[0]);
    } catch (e) {
      console.error('Query 1 Failed:', e.message, e.stack);
    }

    console.log('Running Query 2: CTE for Parent Aggregation...');
    try {
      const combinedResult = await request.query(`
        WITH ParentAgg AS (
          SELECT 
            CASE WHEN ParentAsin IS NOT NULL AND ParentAsin != '' THEN ParentAsin ELSE AsinCode END as ParentGroup,
            MAX(Rating) as ParentRating,
            MAX(LQS) as ParentLQS,
            MIN(CASE WHEN BSR > 0 THEN BSR END) as ParentBSR,
            MIN(CASE WHEN CurrentPrice > 0 THEN CurrentPrice END) as ParentPrice,
            MAX(CASE WHEN BuyBoxWin = 1 THEN 1 ELSE 0 END) as BuyBoxWinStatus,
            MAX(CASE WHEN HasAplus = 1 THEN 1 ELSE 0 END) as HasAplusStatus,
            MAX(CASE WHEN ImagesCount > 0 THEN ImagesCount ELSE 0 END) as ParentImages,
            MAX(CASE WHEN BulletPoints > 0 THEN BulletPoints ELSE 0 END) as ParentBullets,
            MAX(ReviewCount) as ParentReviewCount
          FROM Asins
          ${whereClause}
          GROUP BY CASE WHEN ParentAsin IS NOT NULL AND ParentAsin != '' THEN ParentAsin ELSE AsinCode END
        )
        SELECT 
          COUNT(*) as totalParents,
          AVG(CAST(ParentLQS AS FLOAT)) as avgLQS,
          AVG(CAST(ParentRating AS FLOAT)) as avgRating,
          AVG(CAST(ParentPrice AS FLOAT)) as avgPrice,
          AVG(CAST(ParentBSR AS FLOAT)) as avgBSR,
          MIN(ParentBSR) as bestBSR,
          SUM(BuyBoxWinStatus) as buyBoxWins,
          SUM(HasAplusStatus) as withAplus,
          AVG(CAST(ParentImages AS FLOAT)) as avgImages,
          AVG(CAST(ParentBullets AS FLOAT)) as avgBullets,
          SUM(ParentReviewCount) as totalReviews,
          MAX(ParentReviewCount) as maxReviews,
          COUNT(CASE WHEN ParentRating >= 4.0 THEN 1 END) as above4Star,
          COUNT(CASE WHEN ParentRating >= 3.5 AND ParentRating < 4.0 THEN 1 END) as above35Star,
          COUNT(CASE WHEN ParentRating < 3.5 AND ParentRating > 0 THEN 1 END) as below35Star
        FROM ParentAgg
      `);
      console.log('Query 2 Success:', combinedResult.recordset[0]);
    } catch (e) {
      console.error('Query 2 Failed:', e.message, e.stack);
    }

    console.log('Running Query 3: Status Breakdown...');
    try {
      const statusResult = await request.query(`SELECT Status, COUNT(*) as count FROM Asins ${whereClause} GROUP BY Status`);
      console.log('Query 3 Success:', statusResult.recordset);
    } catch (e) {
      console.error('Query 3 Failed:', e.message, e.stack);
    }

    console.log('Running Query 4: Best Selling ASINs...');
    try {
      const bestSellingResult = await request.query(`
        SELECT TOP 5 AsinCode, Title, CurrentPrice, BSR
        FROM Asins ${whereClause} AND BSR > 0 AND Status = 'Active'
        ORDER BY BSR ASC
      `);
      console.log('Query 4 Success:', bestSellingResult.recordset);
    } catch (e) {
      console.error('Query 4 Failed:', e.message, e.stack);
    }

    console.log('Running Query 5: Review Trend...');
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      
      request.input('sevenDaysAgo', sql.DateTime, sevenDaysAgo);
      request.input('fourteenDaysAgo', sql.DateTime, fourteenDaysAgo);

      const reviewTrendResult = await request.query(`
        SELECT 
          SUM(CASE WHEN Date >= @sevenDaysAgo THEN ReviewCount ELSE 0 END) as currentWeek,
          SUM(CASE WHEN Date >= @fourteenDaysAgo AND Date < @sevenDaysAgo THEN ReviewCount ELSE 0 END) as previousWeek
        FROM AsinHistory
        WHERE AsinId IN (SELECT Id FROM Asins ${whereClause})
          AND Date >= @fourteenDaysAgo
      `);
      console.log('Query 5 Success:', reviewTrendResult.recordset[0]);
    } catch (e) {
      console.error('Query 5 Failed:', e.message, e.stack);
    }

    process.exit(0);
  } catch (err) {
    console.error('Outer error:', err);
    process.exit(1);
  }
}

testQuery();
