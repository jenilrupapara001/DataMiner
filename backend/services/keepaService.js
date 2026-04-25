/**
 * Keepa API Service
 * Fetches seller ASINs using Keepa's Seller Query API.
 * Docs: https://keepa.com/#!discuss/t/seller-query/4
 */

const axios = require('axios');

const KEEPA_API_BASE = 'https://api.keepa.com';

// Marketplace → Keepa domain ID mapping (Strictly Amazon India)
const MARKETPLACE_TO_DOMAIN = {
    'amazon.in': 10
};

/**
 * Validate Amazon seller ID format
 * Amazon seller IDs typically start with 'A' followed by alphanumeric characters (e.g., A1Z2XYZ)
 */
const isValidSellerId = (sellerId) => {
    if (!sellerId || typeof sellerId !== 'string') return false;
    // Amazon seller ID format: starts with 'A' followed by 10+ alphanumeric chars
    return /^A[A-Z0-9]{9,}$/i.test(sellerId);
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

    // Seller ID validation removed – proceeding with Keepa request regardless of format

    const domainId = typeof marketplace === 'number' ? marketplace : getDomainId(marketplace);

    // Must include 'storefront' parameter to get asinList!
    const url = `${KEEPA_API_BASE}/seller?key=${apiKey}&domain=${domainId}&seller=${keepaSellerIdStr}&storefront=1`;
    console.log(`[Keepa] Request URL: ${url.replace(apiKey, '***')}`);

    const response = await axios.get(url);
    const data = response.data;

    // Check for API errors first
    if (data.error) {
        console.error(`[Keepa] API returned error:`, data.error);
        throw new Error(`Keepa API error: ${data.error.message || JSON.stringify(data.error)}`);
    }

    // Debug: Log the full response structure (increased to 3000 chars)
    const responseStr = JSON.stringify(data);
    console.log(`[Keepa] Response for ${keepaSellerIdStr}:`, responseStr.substring(0, 3000));
    console.log(`[Keepa] Full response length:`, responseStr.length, 'chars');
    console.log(`[Keepa] Contains 'asinList':`, responseStr.includes('asinList'));
    console.log(`[Keepa] Contains 'asinListLastSeen':`, responseStr.includes('asinListLastSeen'));

    // Keepa returns { sellers: { [sellerId]: { asinList: [...] } } }
    // Try exact match first, then case-insensitive search
    let sellers = data?.sellers || {};
    let sellerData = sellers[keepaSellerIdStr];

    // If exact match not found, try case-insensitive search
    if (!sellerData && Object.keys(sellers).length > 0) {
        console.log(`[Keepa] Exact seller ID match not found, trying case-insensitive search...`);
        const lowerId = keepaSellerIdStr.toLowerCase();
        for (const [key, value] of Object.entries(sellers)) {
            if (key.toLowerCase() === lowerId) {
                sellerData = value;
                console.log(`[Keepa] Found match with key: "${key}"`);
                break;
            }
        }
    }

    if (!sellerData) {
        console.warn(`[Keepa] No data found for seller: ${keepaSellerIdStr}. Available sellers:`, Object.keys(sellers));
        
        // Debug: show what fields ARE available in sellers
        if (Object.keys(sellers).length > 0) {
            const firstSeller = sellers[Object.keys(sellers)[0]];
            console.log(`[Keepa] Sample seller data keys:`, Object.keys(firstSeller));
            console.log(`[Keepa] Has asinList:`, 'asinList' in firstSeller);
            console.log(`[Keepa] Has asinListLastSeen:`, 'asinListLastSeen' in firstSeller);
        }
        return [];
    }

    // Handle different response formats - asinList contains the actual ASINs
    let asinList = [];
    console.log(`[Keepa] Checking for asinList in response...`);
    console.log(`[Keepa] Seller data fields:`, Object.keys(sellerData));
    
    if (sellerData.asinList) {
        asinList = sellerData.asinList;
        console.log(`[Keepa] Found asinList with ${asinList.length} items`);
    } else if (sellerData.asinListLastSeen && sellerData.asinListLastSeen.length > 0) {
        // asinList might be empty but asinListLastSeen has data
        console.log(`[Keepa] asinListLastSeen has data but asinList is empty`);
    } else if (sellerData.products) {
        asinList = sellerData.products;
    } else if (Array.isArray(sellerData)) {
        asinList = sellerData;
    }

    // Ensure it's an array
    if (!Array.isArray(asinList)) {
        console.warn(`[Keepa] asinList is not an array:`, typeof asinList);
        asinList = [];
    }

    console.log(`[Keepa] Seller ${keepaSellerIdStr} → ${asinList.length} ASINs (domain: ${domainId})`);
    
    // Debug: show first few ASINs
    if (asinList.length > 0) {
        console.log(`[Keepa] Sample ASINs:`, asinList.slice(0, 5));
    }
    
    return asinList;
};

/**
 * Get token status (how many tokens are left in the Keepa bucket)
 */
const getTokenStatus = async () => {
    const apiKey = process.env.KEEPA_API_KEY;
    if (!apiKey) return null;
    try {
        const res = await axios.get(`${KEEPA_API_BASE}/token?key=${apiKey}`);
        const data = res.data;
        return {
            tokensLeft: data.tokensLeft,
            refillIn: data.refillIn,
            refillRate: data.refillRate,
        };
    } catch (e) {
        return null;
    }
};

module.exports = { getSellerAsins, getDomainId, getTokenStatus, isValidSellerId };
