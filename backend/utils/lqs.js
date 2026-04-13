/**
 * CDQ (Content Data Quality) Calculator for Amazon Listings
 * Based on Amazon's quality scoring methodology
 * 
 * Components:
 * - Structured Attributes (SA): 30%
 * - Title Quality Score (TQS): 25%
 * - Image Quality: 15%
 * - Bullet Points: 5%
 * - A+ Content: 5%
 * - Variation Quality: 20% (for variant products)
 * 
 * Grading:
 * - Grade A: 80-100% (Excellent)
 * - Grade B: 70-79% (Good)
 * - Grade C: 50-69% (Acceptable)
 * - Grade D: <50% (Poor)
 */

const calculateCDQ = (asin) => {
    const cdq = {
        totalScore: 0,
        grade: 'D',
        components: {},
        issues: []
    };

    // 1. Structured Attributes Score (30%)
    // Based on: category, brand, manufacturer, bullet points, searchable keywords
    const saScore = calculateStructuredAttributes(asin);
    cdq.components.structuredAttributes = saScore.score;
    cdq.issues.push(...saScore.issues);

    // 2. Title Quality Score (25%)
    // Based on: length, keyword placement, readability, brand mention
    const tqsScore = calculateTitleQuality(asin);
    cdq.components.titleQuality = tqsScore.score;
    cdq.issues.push(...tqsScore.issues);

    // 3. Image Quality Score (15%)
    // Based on: count, IAI (Image Inside Amazon), image variety
    const imageScore = calculateImageQuality(asin);
    cdq.components.imageQuality = imageScore.score;
    cdq.issues.push(...imageScore.issues);

    // 4. Bullet Points Score (5%)
    // Based on: count and quality of bullet points
    const bulletScore = calculateBulletPoints(asin);
    cdq.components.bulletPoints = bulletScore.score;
    cdq.issues.push(...bulletScore.issues);

    // 5. A+ Content Score (5%)
    // Based on: A+ content presence
    const aPlusScore = calculateAPlusContent(asin);
    cdq.components.aPlusContent = aPlusScore.score;
    cdq.issues.push(...aPlusScore.issues);

    // 6. Variation Quality Score (20%) - Only for variant products
    const variationScore = calculateVariationQuality(asin);
    cdq.components.variationQuality = variationScore.score;
    cdq.issues.push(...variationScore.issues);

    // Calculate weighted total
    cdq.totalScore = 
        (cdq.components.structuredAttributes * 0.30) +
        (cdq.components.titleQuality * 0.25) +
        (cdq.components.imageQuality * 0.15) +
        (cdq.components.bulletPoints * 0.05) +
        (cdq.components.aPlusContent * 0.05) +
        (cdq.components.variationQuality * 0.20);

    // Determine grade
    cdq.grade = getGrade(cdq.totalScore);

    return cdq;
};

const calculateStructuredAttributes = (asin) => {
    let score = 0;
    const issues = [];
    let attributes = 0;

    // Brand (10 points)
    if (asin.brand) {
        score += 10;
        attributes++;
    } else {
        issues.push('Missing brand');
    }

    // Category/Subcategory (10 points)
    if (asin.category) {
        score += 10;
        attributes++;
    } else {
        issues.push('Missing category');
    }

    // Manufacturer (5 points)
    if (asin.manufacturer) {
        score += 5;
        attributes++;
    }

    // Bullet points (5 points for 5+ bullets)
    const bulletText = asin.bulletPointsText || [];
    const bulletCount = Array.isArray(bulletText) && bulletText.length > 0 
        ? bulletText.length 
        : (typeof asin.bulletPointsText === 'string' ? asin.bulletPointsText.split('|').filter(b => b.trim()).length : (asin.bulletPoints || 0));

    if (bulletCount >= 5) {
        score += 5;
    } else if (bulletCount > 0) {
        score += (bulletCount / 5) * 5;
        issues.push(`Incomplete bullet points (${bulletCount}/5)`);
    } else {
        issues.push('Missing bullet points');
    }

    return { score: Math.min(100, score), issues };
};

const calculateTitleQuality = (asin) => {
    let score = 0;
    const issues = [];
    const title = asin.title || '';
    const titleLength = title.length;

    // Length scoring (10 points)
    // Optimal: 150-200 characters
    if (titleLength >= 150 && titleLength <= 200) {
        score += 10;
    } else if (titleLength >= 100 && titleLength < 150) {
        score += 7;
        issues.push('Title could be longer (100-150 chars)');
    } else if (titleLength >= 80 && titleLength < 100) {
        score += 5;
        issues.push('Title too short (80-100 chars recommended)');
    } else if (titleLength > 0 && titleLength < 80) {
        score += 2;
        issues.push('Title too short (<80 chars)');
    } else {
        issues.push('Missing title');
    }

    // Brand in title (5 points)
    if (asin.brand && title.toLowerCase().includes(asin.brand.toLowerCase())) {
        score += 5;
    }

    // Key product features in title (5 points)
    const keywords = ['professional', 'premium', 'quality', ' pack', 'set', 'kit', 'combo'];
    const hasKeyword = keywords.some(kw => title.toLowerCase().includes(kw));
    if (hasKeyword) score += 5;

    // No prohibited characters (5 points)
    const prohibitedChars = ['!', '@', '#', '$', '%', '^', '*', '(', ')'];
    const hasProhibited = prohibitedChars.some(char => title.includes(char));
    if (!hasProhibited) {
        score += 5;
    } else {
        issues.push('Title contains special characters');
    }

    return { score: Math.min(100, score), issues };
};

const calculateImageQuality = (asin) => {
    let score = 0;
    const issues = [];
    const imagesCount = asin.imagesCount || asin.imageCount || 0;

    // Image count (10 points) - 7+ images is optimal
    if (imagesCount >= 7) {
        score += 10;
    } else if (imagesCount >= 5) {
        score += 7;
    } else if (imagesCount >= 3) {
        score += 5;
        issues.push('Need more images (5+ recommended)');
    } else if (imagesCount > 0) {
        score += 3;
        issues.push('Insufficient images (5+ needed)');
    } else {
        issues.push('No images');
    }

    // IAI (Image Inside Amazon) - 5 points
    if (asin.images && Array.isArray(asin.images)) {
        const iaiImages = asin.images.filter(img => img.source === 'amazon' || img.isAmazonHosted);
        score += Math.min(5, iaiImages.length);
    }

    return { score: Math.min(100, score), issues };
};

const calculateBulletPoints = (asin) => {
    let score = 0;
    const issues = [];
    // 5 points for 5 bullets
    const bulletText = asin.bulletPointsText || [];
    const bulletCount = Array.isArray(bulletText) && bulletText.length > 0 
        ? bulletText.length 
        : (typeof asin.bulletPointsText === 'string' ? asin.bulletPointsText.split('|').filter(b => b.trim()).length : (asin.bulletPoints || 0));

    if (bulletCount >= 5) {
        score += 5;
    } else if (bulletCount >= 3) {
        score += (bulletCount / 5) * 5;
        issues.push(`Incomplete bullet points (${bulletCount}/5)`);
    } else {
        issues.push('Missing bullet points');
    }

    return { score, issues };
};

const calculateAPlusContent = (asin) => {
    const hasAplus = asin.hasAplus || asin.hasAplusContent || false;
    
    if (hasAplus) {
        return { score: 100, issues: [] };
    }
    
    return { 
        score: 0, 
        issues: ['Missing A+ Content'] 
    };
};

const calculateVariationQuality = (asin) => {
    // Only applies to variant/parent products
    const isParent = asin.variationTheme || asin.parentAsin || asin.isParent;
    const childCount = asin.childCount || asin.variantCount || 0;
    
    if (!isParent) {
        // For non-variants, this component doesn't apply - use neutral score
        return { score: 100, issues: [] };
    }

    let score = 0;
    const issues = [];

    // Variation theme defined (10 points)
    if (asin.variationTheme) {
        score += 10;
    } else {
        issues.push('Missing variation theme');
    }

    // Sufficient variants (10 points)
    if (childCount >= 4) {
        score += 10;
    } else if (childCount > 0) {
        score += (childCount / 4) * 10;
        issues.push(`Low variant count (${childCount}/4)`);
    } else {
        issues.push('No variant data');
    }

    return { score: Math.min(100, score), issues };
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
            structuredAttributes: {
                score: Math.round(cdq.components.structuredAttributes),
                weight: '30%',
                label: 'Structured Attributes'
            },
            titleQuality: {
                score: Math.round(cdq.components.titleQuality),
                weight: '25%',
                label: 'Title Quality'
            },
            imageQuality: {
                score: Math.round(cdq.components.imageQuality),
                weight: '15%',
                label: 'Image Quality'
            },
            bulletPoints: {
                score: Math.round(cdq.components.bulletPoints),
                weight: '5%',
                label: 'Bullet Points'
            },
            aPlusContent: {
                score: Math.round(cdq.components.aPlusContent),
                weight: '5%',
                label: 'A+ Content'
            },
            variationQuality: {
                score: Math.round(cdq.components.variationQuality),
                weight: '20%',
                label: 'Variation Quality'
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