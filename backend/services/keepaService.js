/**
 * Keepa API Service
 * Fetches seller ASINs using Keepa's Seller Query API.
 * Docs: https://keepa.com/#!discuss/t/seller-query/4
 */

const KEEPA_API_BASE = 'https://api.keepa.com';

// Marketplace → Keepa domain ID mapping (Strictly Amazon India)
const MARKETPLACE_TO_DOMAIN = {
    'amazon.in': 10
};

/**
 * Get Keepa domain ID for a marketplace string
 */
const getDomainId = (marketplace) => {
    return 10; // strictly amazon.in
};

/**
 * Fetch all ASINs listed by a specific Amazon seller via Keepa.
 * @param {string} keepaSellerIdStr - Amazon Seller ID (e.g. A1Z2XYZ)
 * @param {number|string} marketplace - 'amazon.in' or numeric domain id
 * @returns {Promise<string[]>} Array of ASIN strings
 */
const getSellerAsins = async (keepaSellerIdStr, marketplace = 'amazon.in') => {
    const apiKey = process.env.KEEPA_API_KEY;
    if (!apiKey) {
        throw new Error('KEEPA_API_KEY is not set in environment variables');
    }

    const domainId = typeof marketplace === 'number' ? marketplace : getDomainId(marketplace);

    const url = `${KEEPA_API_BASE}/seller?key=${apiKey}&domain=${domainId}&seller=${keepaSellerIdStr}`;

    const response = await fetch(url);
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Keepa API error ${response.status}: ${text}`);
    }

    const data = await response.json();

    // Keepa returns { sellers: { [sellerId]: { asinList: [...] } } }
    const sellers = data?.sellers || {};
    const sellerData = sellers[keepaSellerIdStr];

    if (!sellerData) {
        console.warn(`[Keepa] No data found for seller: ${keepaSellerIdStr}`);
        return [];
    }

    const asinList = sellerData.asinList || [];
    console.log(`[Keepa] Seller ${keepaSellerIdStr} → ${asinList.length} ASINs (domain: ${domainId})`);
    return asinList;
};

/**
 * Get token status (how many tokens are left in the Keepa bucket)
 */
const getTokenStatus = async () => {
    const apiKey = process.env.KEEPA_API_KEY;
    if (!apiKey) return null;
    try {
        const res = await fetch(`${KEEPA_API_BASE}/token?key=${apiKey}`);
        const data = await res.json();
        return {
            tokensLeft: data.tokensLeft,
            refillIn: data.refillIn,
            refillRate: data.refillRate,
        };
    } catch (e) {
        return null;
    }
};

module.exports = { getSellerAsins, getDomainId, getTokenStatus };
