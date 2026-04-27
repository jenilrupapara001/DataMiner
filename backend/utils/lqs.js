const TitleAnalyzer = require('./titleAnalyzer');
const BulletPointsAnalyzer = require('./bulletPointsAnalyzer');
const ImageAnalyzer = require('./imageAnalyzer');
const DescriptionAnalyzer = require('./descriptionAnalyzer');

/**
 * CDQ (Content Data Quality) Calculator for Amazon Listings
 * Updated to use specialized analyzers for Title, Bullets, Images and Description.
 */

const calculateCDQ = (asin) => {
    // 1. Title Analysis
    const titleAnalysis = TitleAnalyzer.analyze(asin.Title || asin.title || '');
    
    // 2. Bullet Analysis
    const bulletAnalysis = BulletPointsAnalyzer.analyze(asin.BulletPointsText || asin.bulletPointsText || []);
    
    // 3. Image Analysis
    let imageUrls = [];
    try {
        imageUrls = asin.Images ? (typeof asin.Images === 'string' ? JSON.parse(asin.Images) : asin.Images) : [];
    } catch (e) {
        imageUrls = [];
    }
    if (imageUrls.length === 0 && (asin.ImageUrl || asin.imageUrl)) imageUrls = [asin.ImageUrl || asin.imageUrl];
    
    const imageAnalysis = ImageAnalyzer.analyze({
        imageCount: asin.ImagesCount || asin.imageCount || imageUrls.length,
        imageUrls,
        metadata: { category: asin.Category || asin.category || '', title: asin.Title || asin.title || '' }
    });

    // 4. Description Analysis
    const descriptionAnalysis = DescriptionAnalyzer.analyze({
        description: asin.ProductDescription || asin.productDescription || '',
        hasAplus: asin.HasAplus === true || asin.HasAplus === 1 || asin.hasAplus === true,
        metadata: { category: asin.Category || asin.category || '', title: asin.Title || asin.title || '' }
    });

    // 5. Total LQS Calculation (Weighted average)
    // Title: 30%, Bullets: 25%, Images: 25%, Description: 20%
    const totalScore = Math.round(
        (titleAnalysis.score * 0.30) + 
        (bulletAnalysis.score * 0.25) + 
        (imageAnalysis.score * 0.25) + 
        (descriptionAnalysis.score * 0.20)
    );

    // Determine Grade
    let grade = 'D';
    if (totalScore >= 80) grade = 'A';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 50) grade = 'C';

    return {
        totalScore,
        grade,
        components: {
            titleQuality: titleAnalysis.score,
            bulletPoints: bulletAnalysis.score,
            imageQuality: imageAnalysis.score,
            descriptionQuality: descriptionAnalysis.score
        },
        issues: [
            ...titleAnalysis.issues,
            ...bulletAnalysis.issues,
            ...imageAnalysis.issues,
            ...descriptionAnalysis.issues
        ]
    };
};

const getGrade = (score) => {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    return 'D';
};

const getGradeColor = (grade) => {
    const colors = {
        'A': '#059669', // green
        'B': '#2563eb', // blue
        'C': '#d97706', // amber
        'D': '#dc2626'  // red
    };
    return colors[grade] || '#6b7280';
};

/**
 * Legacy LQS calculation for backward compatibility
 * Now maps to CDQ internally
 */
const calculateLQS = (asin) => {
    const cdq = calculateCDQ(asin);
    return cdq.totalScore;
};

const getLQSIssues = (asin) => {
    const cdq = calculateCDQ(asin);
    return cdq.issues;
};

const getCDQBreakdown = (asin) => {
    const cdq = calculateCDQ(asin);
    return {
        totalScore: Math.round(cdq.totalScore),
        grade: cdq.grade,
        gradeColor: getGradeColor(cdq.grade),
        components: {
            titleQuality: {
                score: Math.round(cdq.components.titleQuality),
                weight: '30%',
                label: 'Title Quality'
            },
            bulletPoints: {
                score: Math.round(cdq.components.bulletPoints),
                weight: '25%',
                label: 'Bullet Points'
            },
            imageQuality: {
                score: Math.round(cdq.components.imageQuality),
                weight: '25%',
                label: 'Image Quality'
            },
            descriptionQuality: {
                score: Math.round(cdq.components.descriptionQuality),
                weight: '20%',
                label: 'Description Quality'
            }
        },
        issues: cdq.issues
    };
};

module.exports = {
    calculateLQS,
    calculateCDQ,
    getLQSIssues,
    getCDQBreakdown,
    getGrade,
    getGradeColor
};