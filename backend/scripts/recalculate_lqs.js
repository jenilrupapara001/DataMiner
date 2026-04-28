/**
 * Recalculate LQS Script
 * 
 * This script runs the updated LQS analysis on all existing ASINs in the database.
 * Use this after updating the analyzer logic to refresh all scores.
 */

const { sql, getPool } = require('../database/db');
const LQS = require('../utils/lqs');

async function run() {
    console.log('🚀 Starting LQS Recalculation...');
    let pool;
    
    try {
        pool = await getPool();
        
        // 1. Fetch all ASINs with necessary data for analysis
        console.log('📦 Fetching ASINs from database...');
        const result = await pool.request().query(`
            SELECT 
                Id, 
                Title, 
                BulletPoints, 
                ImagesUrls, 
                HasAplus,
                Category
            FROM Asins
        `);
        
        const asins = result.recordset;
        console.log(`✅ Found ${asins.length} ASINs to process.`);
        
        let successCount = 0;
        let errorCount = 0;
        
        // 2. Process in batches to avoid overwhelming the database
        const batchSize = 100;
        for (let i = 0; i < asins.length; i += batchSize) {
            const batch = asins.slice(i, i + batchSize);
            const transaction = new sql.Transaction(pool);
            
            try {
                await transaction.begin();
                
                for (const asin of batch) {
                    try {
                        // Parse JSON fields
                        let bulletPoints = [];
                        try {
                            bulletPoints = typeof asin.BulletPoints === 'string' ? JSON.parse(asin.BulletPoints) : (asin.BulletPoints || []);
                        } catch (e) {
                            bulletPoints = [];
                        }
                        
                        let imageUrls = [];
                        try {
                            imageUrls = typeof asin.ImagesUrls === 'string' ? JSON.parse(asin.ImagesUrls) : (asin.ImagesUrls || []);
                        } catch (e) {
                            imageUrls = [];
                        }
                        
                        // Calculate new LQS with updated logic
                        const analysis = LQS.calculateCDQ({
                            Title: asin.Title || '',
                            BulletPoints: bulletPoints,
                            ImagesUrls: imageUrls,
                            HasAplus: !!asin.HasAplus,
                            Category: asin.Category || ''
                        });
                        
                        // Update the ASIN record
                        await transaction.request()
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
                    } catch (asinErr) {
                        console.error(`❌ Error processing ASIN ${asin.Id}:`, asinErr.message);
                        errorCount++;
                    }
                }
                
                await transaction.commit();
                const progress = Math.min(100, Math.round(((i + batch.length) / asins.length) * 100));
                console.log(`⏳ Progress: ${progress}% (${i + batch.length}/${asins.length})`);
                
            } catch (batchErr) {
                if (transaction) await transaction.rollback();
                console.error(`❌ Batch error at index ${i}:`, batchErr.message);
                errorCount += batch.length;
            }
        }
        
        console.log('\n--- Final Results ---');
        console.log(`✅ Successfully updated: ${successCount}`);
        console.log(`❌ Failed: ${errorCount}`);
        console.log(`🏁 Total processed: ${asins.length}`);
        
    } catch (err) {
        console.error('💥 Critical script failure:', err.message);
    } finally {
        if (sql) await sql.close();
        process.exit(0);
    }
}

run();
