const { sql, getPool } = require('../database/db');
const listingQualityService = require('../services/listingQualityService');

/**
 * Analyze a single ASIN's components and calculate total LQS
 * POST /api/listing-quality/analyze/:asinId
 */
exports.analyzeAsin = async (req, res) => {
  try {
    const { asinId } = req.params;
    const result = await listingQualityService.analyzeAndSaveFull(asinId);
    
    if (!result) {
      return res.status(404).json({ success: false, message: 'ASIN not found' });
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Batch analyze multiple ASINs
 * POST /api/listing-quality/analyze-batch
 */
exports.analyzeBatch = async (req, res) => {
  try {
    const { asinIds, sellerId } = req.body;
    const pool = await getPool();
    
    let query = 'SELECT Id, AsinCode FROM Asins';
    const conditions = [];
    
    if (asinIds && asinIds.length > 0) {
      conditions.push(`Id IN (${asinIds.map(id => `'${id}'`).join(',')})`);
    } else if (sellerId) {
      conditions.push(`SellerId = '${sellerId}'`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    const result = await pool.request().query(query);
    const asins = result.recordset;
    
    let analyzed = 0;
    for (const asin of asins) {
      try {
        await listingQualityService.analyzeAndSaveFull(asin.Id);
        analyzed++;
      } catch (e) {
        console.error(`Failed to analyze ASIN ${asin.AsinCode}:`, e.message);
      }
    }
    
    res.json({
      success: true,
      message: `Analyzed ${analyzed} of ${asins.length} ASINs`,
      analyzed,
      total: asins.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Keep specific analyze methods for legacy or granular control if needed, 
// but redirected to the new service logic for consistency.

exports.analyzeTitle = exports.analyzeAsin;
exports.analyzeBullets = exports.analyzeAsin;
exports.analyzeImages = exports.analyzeAsin;
exports.analyzeDescription = exports.analyzeAsin;
exports.analyzeTitlesBatch = exports.analyzeBatch;
exports.analyzeBulletsBatch = exports.analyzeBatch;
exports.analyzeImagesBatch = exports.analyzeBatch;
exports.analyzeDescriptionsBatch = exports.analyzeBatch;

/**
 * Get full analysis for an ASIN
 * GET /api/listing-quality/analysis/:asinId
 */
exports.getAnalysis = async (req, res) => {
  try {
    const { asinId } = req.params;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('id', sql.VarChar, asinId)
      .query(`
        SELECT AsinCode, Title, TitleScore, TitleGrade, TitleIssues, TitleRecommendations, TitleDetails,
               BulletScore, BulletGrade, BulletIssues, BulletRecommendations, BulletDetails,
               ImageScore, ImageGrade, ImageIssues, ImageRecommendations, ImageDetails,
               DescriptionScore, DescriptionGrade, DescriptionIssues, DescriptionRecommendations, DescriptionDetails,
               LQS, LQSGrade
        FROM Asins WHERE Id = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'ASIN not found' });
    }
    
    const row = result.recordset[0];
    
    res.json({
      success: true,
      data: {
        asinCode: row.AsinCode,
        title: {
          score: row.TitleScore,
          grade: row.TitleGrade,
          issues: row.TitleIssues ? JSON.parse(row.TitleIssues) : [],
          recommendations: row.TitleRecommendations ? JSON.parse(row.TitleRecommendations) : [],
          details: row.TitleDetails ? JSON.parse(row.TitleDetails) : {}
        },
        bullets: {
          score: row.BulletScore,
          grade: row.BulletGrade,
          issues: row.BulletIssues ? JSON.parse(row.BulletIssues) : [],
          recommendations: row.BulletRecommendations ? JSON.parse(row.BulletRecommendations) : [],
          details: row.BulletDetails ? JSON.parse(row.BulletDetails) : {}
        },
        images: {
          score: row.ImageScore,
          grade: row.ImageGrade,
          issues: row.ImageIssues ? JSON.parse(row.ImageIssues) : [],
          recommendations: row.ImageRecommendations ? JSON.parse(row.ImageRecommendations) : [],
          details: row.ImageDetails ? JSON.parse(row.ImageDetails) : {}
        },
        description: {
          score: row.DescriptionScore,
          grade: row.DescriptionGrade,
          issues: row.DescriptionIssues ? JSON.parse(row.DescriptionIssues) : [],
          recommendations: row.DescriptionRecommendations ? JSON.parse(row.DescriptionRecommendations) : [],
          details: row.DescriptionDetails ? JSON.parse(row.DescriptionDetails) : {}
        },
        total: {
          score: row.LQS,
          grade: row.LQSGrade
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
