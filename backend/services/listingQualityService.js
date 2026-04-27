const { sql, getPool } = require('../database/db');
const TitleAnalyzer = require('../utils/titleAnalyzer');
const BulletPointsAnalyzer = require('../utils/bulletPointsAnalyzer');
const ImageAnalyzer = require('../utils/imageAnalyzer');
const DescriptionAnalyzer = require('../utils/descriptionAnalyzer');

class ListingQualityService {
  /**
   * Analyze all aspects of an ASIN and save to database
   * @param {string} asinId - The internal database ID of the ASIN
   */
  async analyzeAndSaveFull(asinId) {
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('id', sql.VarChar, asinId)
        .query(`
          SELECT Id, AsinCode, Title, BulletPointsText, ImagesCount, Images, 
                 ImageUrl, VideoCount, Category, ProductDescription, HasAplus
          FROM Asins WHERE Id = @id
        `);

      if (result.recordset.length === 0) return null;
      const asin = result.recordset[0];

      // 1. Title Analysis
      const titleAnalysis = TitleAnalyzer.analyze(asin.Title);
      
      // 2. Bullet Analysis
      const bulletAnalysis = BulletPointsAnalyzer.analyze(asin.BulletPointsText);
      
      // 3. Image Analysis
      let imageUrls = [];
      try {
        imageUrls = asin.Images ? JSON.parse(asin.Images) : [];
      } catch (e) {
        imageUrls = [];
      }
      if (imageUrls.length === 0 && asin.ImageUrl) imageUrls = [asin.ImageUrl];
      
      const imageAnalysis = ImageAnalyzer.analyze({
        imageCount: asin.ImagesCount || imageUrls.length,
        imageUrls,
        metadata: { category: asin.Category || '', title: asin.Title || '' }
      });

      // 4. Description Analysis
      const descriptionAnalysis = DescriptionAnalyzer.analyze({
        description: asin.ProductDescription || '',
        hasAplus: asin.HasAplus === true || asin.HasAplus === 1,
        metadata: { category: asin.Category || '', title: asin.Title || '' }
      });

      // 5. Total LQS Calculation (Weighted average)
      // Title: 30%, Bullets: 25%, Images: 25%, Description: 20%
      const totalScore = Math.round(
        (titleAnalysis.score * 0.30) + 
        (bulletAnalysis.score * 0.25) + 
        (imageAnalysis.score * 0.25) + 
        (descriptionAnalysis.score * 0.20)
      );

      // Determine Total Grade
      let totalGrade = 'D';
      if (totalScore >= 80) totalGrade = 'A';
      else if (totalScore >= 70) totalGrade = 'B';
      else if (totalScore >= 50) totalGrade = 'C';

      // Save everything
      await pool.request()
        .input('id', sql.VarChar, asinId)
        .input('ts', sql.Int, titleAnalysis.score)
        .input('tg', sql.NVarChar, titleAnalysis.grade)
        .input('ti', sql.NVarChar, JSON.stringify(titleAnalysis.issues))
        .input('tr', sql.NVarChar, JSON.stringify(titleAnalysis.recommendations))
        .input('td', sql.NVarChar, JSON.stringify(titleAnalysis.details))
        .input('bs', sql.Int, bulletAnalysis.score)
        .input('bg', sql.NVarChar, bulletAnalysis.grade)
        .input('bi', sql.NVarChar, JSON.stringify(bulletAnalysis.issues))
        .input('br', sql.NVarChar, JSON.stringify(bulletAnalysis.recommendations))
        .input('bd', sql.NVarChar, JSON.stringify(bulletAnalysis.details))
        .input('is', sql.Int, imageAnalysis.score)
        .input('ig', sql.NVarChar, imageAnalysis.grade)
        .input('ii', sql.NVarChar, JSON.stringify(imageAnalysis.issues))
        .input('ir', sql.NVarChar, JSON.stringify(imageAnalysis.recommendations))
        .input('id_details', sql.NVarChar, JSON.stringify(imageAnalysis.details))
        .input('ds', sql.Int, descriptionAnalysis.score)
        .input('dg', sql.NVarChar, descriptionAnalysis.grade)
        .input('di', sql.NVarChar, JSON.stringify(descriptionAnalysis.issues))
        .input('dr', sql.NVarChar, JSON.stringify(descriptionAnalysis.recommendations))
        .input('dd', sql.NVarChar, JSON.stringify(descriptionAnalysis.details))
        .input('totalScore', sql.Int, totalScore)
        .input('totalGrade', sql.NVarChar, totalGrade)
        .query(`
          UPDATE Asins SET 
            TitleScore = @ts, TitleGrade = @tg, TitleIssues = @ti, TitleRecommendations = @tr, TitleDetails = @td,
            BulletScore = @bs, BulletGrade = @bg, BulletIssues = @bi, BulletRecommendations = @br, BulletDetails = @bd,
            ImageScore = @is, ImageGrade = @ig, ImageIssues = @ii, ImageRecommendations = @ir, ImageDetails = @id_details,
            DescriptionScore = @ds, DescriptionGrade = @dg, DescriptionIssues = @di, DescriptionRecommendations = @dr, DescriptionDetails = @dd,
            LQS = @totalScore, LQSGrade = @totalGrade,
            UpdatedAt = GETDATE()
          WHERE Id = @id
        `);

      return { totalScore, totalGrade, titleAnalysis, bulletAnalysis, imageAnalysis, descriptionAnalysis };
    } catch (error) {
      console.error(`ListingQualityService Error for ASIN ${asinId}:`, error.message);
      throw error;
    }
  }

  /**
   * Run analysis during market data ingestion (fast path)
   * This doesn't query the DB, it just takes the raw data and returns scores
   */
  analyzeRaw(data) {
    const titleAnalysis = TitleAnalyzer.analyze(data.title || data.Title || '');
    const bulletAnalysis = BulletPointsAnalyzer.analyze(data.bulletPointsText || []);
    
    const imageAnalysis = ImageAnalyzer.analyze({
      imageCount: data.imagesCount || 0,
      imageUrls: data.images || [],
      metadata: { category: data.category || '', title: data.title || '' }
    });

    const descriptionAnalysis = DescriptionAnalyzer.analyze({
      description: data.description || '',
      hasAplus: data.hasAplus === true,
      metadata: { category: data.category || '', title: data.title || '' }
    });

    const totalScore = Math.round(
      (titleAnalysis.score * 0.30) + 
      (bulletAnalysis.score * 0.25) + 
      (imageAnalysis.score * 0.25) + 
      (descriptionAnalysis.score * 0.20)
    );

    let totalGrade = 'D';
    if (totalScore >= 80) totalGrade = 'A';
    else if (totalScore >= 70) totalGrade = 'B';
    else if (totalScore >= 50) totalGrade = 'C';

    return {
      totalScore,
      totalGrade,
      components: {
        title: titleAnalysis,
        bullets: bulletAnalysis,
        images: imageAnalysis,
        description: descriptionAnalysis
      }
    };
  }
}

module.exports = new ListingQualityService();
