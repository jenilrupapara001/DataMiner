/**
 * Calculate LQS (Listing Quality Score) for an ASIN (Backend calculation)
 * @param {Object} asin - Mongoose Asin document or plain object
 * @returns {number} Score between 0 and 100
 */
const calculateLQS = (asin) => {
    let score = 100;

    // Title completeness (max 15 points)
    const title = asin.title || '';
    if (title.length < 50) score -= 10;
    else if (title.length < 80) score -= 5;

    // Images (max 20 points)
    const imagesCount = asin.imagesCount || 0;
    if (imagesCount === 0) score -= 20;
    else if (imagesCount < 5) score -= 10;

    // Price (max 15 points)
    const price = Number(asin.currentPrice || asin.price || 0);
    const mrp = Number(asin.mrp || 0);
    if (price === 0) score -= 15;
    else if (mrp > 0 && price > mrp) score -= 10;

    // Rating (max 20 points)
    const rating = Number(asin.rating || 0);
    if (rating < 3) score -= 20;
    else if (rating < 4) score -= 10;

    // Reviews (max 15 points)
    const reviews = Number(asin.reviewCount || 0);
    if (reviews === 0) score -= 15;
    else if (reviews < 10) score -= 8;

    // Ranking (max 15 points)
    const rank = Number(asin.bsr || 0);
    if (rank === 0) score -= 15;
    else if (rank > 50000) score -= 15;
    else if (rank > 20000) score -= 8;
    else if (rank > 10000) score -= 4;

    return Math.max(0, score);
};

/**
 * Get list of LQS issues
 * @param {Object} asin
 * @returns {string[]} List of issues
 */
const getLQSIssues = (asin) => {
    const issues = [];

    const title = asin.title || '';
    if (title.length < 50) issues.push('Title too short (< 50 chars)');

    const imagesCount = asin.imagesCount || 0;
    if (imagesCount < 5) issues.push(`Missing images (Has ${imagesCount}, needs 5+)`);

    const rating = Number(asin.rating || 0);
    if (rating < 4) issues.push(`Low rating (${rating})`);

    const reviews = Number(asin.reviewCount || 0);
    if (reviews < 10) issues.push(`Few reviews (${reviews})`);

    const rank = Number(asin.bsr || 0);
    if (rank > 50000) issues.push(`Poor ranking (#${rank})`);

    return issues;
};

module.exports = {
    calculateLQS,
    getLQSIssues
};
