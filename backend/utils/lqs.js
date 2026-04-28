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
    const rawScore = (
        (titleAnalysis.score * 0.30) + 
        (bulletAnalysis.score * 0.25) + 
        (imageAnalysis.score * 0.25) + 
        (descriptionAnalysis.score * 0.20)
    );

    // Scale to 10 and keep 1 decimal place
    const score = parseFloat((rawScore / 10).toFixed(1));

    // Determine Grade based on 0-10 scale
    let grade = 'D';
    if (score >= 8.5) grade = 'A';
    else if (score >= 7.0) grade = 'B';
    else if (score >= 5.0) grade = 'C';

    return {
        score,
        totalScore: score, // Keep for compatibility
        grade,
        components: {
            titleQuality: parseFloat((titleAnalysis.score / 10).toFixed(1)),
            bulletPoints: parseFloat((bulletAnalysis.score / 10).toFixed(1)),
            imageQuality: parseFloat((imageAnalysis.score / 10).toFixed(1)),
            descriptionQuality: parseFloat((descriptionAnalysis.score / 10).toFixed(1))
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
    // Handle both 0-100 and 0-10 scales
    const s = score > 10 ? score / 10 : score;
    if (s >= 8.5) return 'A';
    if (s >= 7.0) return 'B';
    if (s >= 5.0) return 'C';
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
    return cdq.score;
};

const getLQSIssues = (asin) => {
    const cdq = calculateCDQ(asin);
    return cdq.issues;
};

const getCDQBreakdown = (asin) => {
    const cdq = calculateCDQ(asin);
    return {
        score: cdq.score,
        totalScore: cdq.score,
        grade: cdq.grade,
        gradeColor: getGradeColor(cdq.grade),
        components: {
            titleQuality: {
                score: cdq.components.titleQuality,
                weight: '30%',
                label: 'Title Quality'
            },
            bulletPoints: {
                score: cdq.components.bulletPoints,
                weight: '25%',
                label: 'Bullet Points'
            },
            imageQuality: {
                score: cdq.components.imageQuality,
                weight: '25%',
                label: 'Image Quality'
            },
            descriptionQuality: {
                score: cdq.components.descriptionQuality,
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