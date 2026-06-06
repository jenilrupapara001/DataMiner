/**
 * Authorized sellers list for BuyBox winning status.
 * Includes common spelling variations and substrings for robust matching.
 */
const OWN_SELLERS = [
    'Cocoblu Retail',
    'Cocblu Retail',
    'Cocoblu',
    'Cocblu',
    'Cocoblu Retail Private Limited',
    'Cocblu Retail Private Limited',
    'Cocoblu Retail India',
    'Cocblu Retail India',
    'Cocoblu India',
    'Clicktech Retail Private Ltd',
    'Clicktech Retail',
    'Clicktech India',
    'RetailEZ Pvt Ltd',
    'RetailEZ Private Limited',
    'RetailEZ India',
    'ETrade Pvt Ltd',
    'ETrade Private Limited',
    'Appario Retail',
    'Appario',
    'ETrade Online'
];

/**
 * Robustly identifies if a seller is authorized based on given names.
 * Implements partial matching (ignores spaces, casing, and special characters).
 * 
 * LOGIC: A BuyBox is "won" if the soldBy name matches EITHER:
 *   1. Any name in the hardcoded OWN_SELLERS list (always checked), OR
 *   2. Any name in the configuredSellers / extra trusted sellers (e.g. the brand's own store name), OR
 *   3. Any name from the TRUSTED_SELLER_NAMES env variable
 * 
 * @param {string} sellerName - The seller name found on the product page (soldBy)
 * @param {string[]|string|null} configuredSellers - Additional trusted seller names (e.g. the brand's own name)
 * @returns {boolean} - true if the seller is authorized (Won), false otherwise (Lost)
 */
function isBuyBoxWinner(sellerName, configuredSellers = null) {
    if (!sellerName) return false;

    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normalizedSoldBy = normalize(sellerName);

    // 1. ALWAYS check the hardcoded OWN_SELLERS list first
    const matchesOwnSeller = OWN_SELLERS.some(s => {
        const authorized = normalize(s);
        return normalizedSoldBy.includes(authorized) || authorized.includes(normalizedSoldBy);
    });
    if (matchesOwnSeller) return true;

    // 2. Check env-configured trusted sellers
    const envSellers = (process.env.TRUSTED_SELLER_NAMES || '').split(',').map(s => s.trim()).filter(Boolean);
    if (envSellers.length > 0) {
        const matchesEnv = envSellers.some(trusted => {
            const normalizedTrusted = normalize(trusted);
            return normalizedSoldBy.includes(normalizedTrusted) || normalizedTrusted.includes(normalizedSoldBy);
        });
        if (matchesEnv) return true;
    }

    // 3. Check extra trusted sellers passed as parameter (e.g. the seller/brand's own name)
    let extraSellers = [];
    if (configuredSellers) {
        if (Array.isArray(configuredSellers)) {
            extraSellers = configuredSellers.filter(Boolean);
        } else if (typeof configuredSellers === 'string' && configuredSellers.trim()) {
            extraSellers = [configuredSellers.trim()];
        }
    }

    if (extraSellers.length > 0) {
        const matchesExtra = extraSellers.some(trusted => {
            const normalizedTrusted = normalize(trusted);
            return normalizedSoldBy.includes(normalizedTrusted) || normalizedTrusted.includes(normalizedSoldBy);
        });
        if (matchesExtra) return true;
    }

    return false;
}

module.exports = {
    OWN_SELLERS,
    isBuyBoxWinner
};

