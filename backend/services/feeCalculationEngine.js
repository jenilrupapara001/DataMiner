const { sql, getPool } = require('../database/db');

// Helper to calculate match score for fuzzy category matching
const calculateMatchScore = (ruleCat, itemPath) => {
    try {
        const clean = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const stopWords = ['and', 'for', 'the', 'products', 'other', 'supplies', 'accessories'];
        const ruleTokens = clean(ruleCat).split(/\s+/).filter(t => t.length > 2 && !stopWords.includes(t));
        const pathTokens = clean(itemPath).split(/\s+/);

        if (ruleTokens.length === 0) return 0;

        let matches = 0;
        for (const token of ruleTokens) {
            if (pathTokens.some(pt => pt === token)) {
                matches += 1;
            } else if (pathTokens.some(pt => pt.includes(token) || token.includes(pt))) {
                matches += 0.8;
            }
        }
        return matches / ruleTokens.length;
    } catch (error) {
        console.error('Error calculating match score:', error);
        return 0;
    }
};

// Helper to calculate return fee
const calculateReturnFee = (price, stepLevel, category, refundFees) => {
    try {
        if (!price || price <= 0 || !refundFees || refundFees.length === 0) return 0;

        const priceRange = refundFees.find(rf => price >= rf.MinPrice && price <= rf.MaxPrice);
        if (!priceRange) return 0;

        const cat = (category || '').toLowerCase();
        let feeCategory = 'General';
        if (cat.includes('shoes') || cat.includes('footwear')) {
            feeCategory = 'Shoes';
        } else if (cat.includes('apparel') || cat.includes('clothing')) {
            feeCategory = 'Apparel';
        }

        const applicableFee = refundFees.find(rf =>
            rf.Category === feeCategory &&
            price >= rf.MinPrice && price <= rf.MaxPrice
        );

        if (!applicableFee) return 0;

        switch (stepLevel) {
            case 'Basic': return applicableFee.Basic || 0;
            case 'Standard': return applicableFee.Standard || 0;
            case 'Advanced': return applicableFee.Advanced || 0;
            case 'Premium': return applicableFee.Premium || 0;
            default: return applicableFee.Standard || 0;
        }
    } catch (error) {
        console.error('Error calculating return fee:', error);
        return 0;
    }
};

const calculateProfits = async (asinIds = []) => {
    try {
        console.log(`[FeeCalc] Starting calculation for ${asinIds.length} items`);
        const pool = await getPool();

        const [referralResult, closingResult, shippingResult, storageResult, mappingResult, nodeResult, refundResult] = await Promise.all([
            pool.request().query('SELECT * FROM ReferralFees'),
            pool.request().query('SELECT * FROM ClosingFees'),
            pool.request().query('SELECT * FROM ShippingFees'),
            pool.request().query('SELECT * FROM StorageFees'),
            pool.request().query('SELECT * FROM CategoryMaps'),
            pool.request().query('SELECT * FROM NodeMaps'),
            pool.request().query('SELECT * FROM RefundFees')
        ]);

        const referralFees = referralResult.recordset;
        const closingFees = closingResult.recordset;
        const shippingFees = shippingResult.recordset;
        const storageFees = storageResult.recordset;
        const categoryMappings = mappingResult.recordset;
        const nodeMaps = nodeResult.recordset;
        const refundFees = refundResult.recordset;

        const GST_RATE = 0.18;

        let query = 'SELECT * FROM Asins';
        const request = pool.request();
        
        if (asinIds.length > 0) {
            const idList = asinIds.map(id => `'${id}'`).join(',');
            query += ` WHERE Id IN (${idList})`;
        } else {
            query += " WHERE Status IN ('Active', 'Pending')";
        }

        const itemsResult = await request.query(query);
        const items = itemsResult.recordset;

        for (const item of items) {
            const price = Number(item.CurrentPrice) || 0;
            const weight = Number(item.Weight) || 0;

            if (price <= 0) {
                continue; // Skip invalid price
            }

            // 1. Referral Fees logic
            let refRule = undefined;
            const itemCat = (item.Category || '').toLowerCase();

            // Category Mapping
            if (!refRule) {
                const mapping = categoryMappings.find(m => itemCat.includes(m.KeepaCategory.toLowerCase()));
                if (mapping) {
                    refRule = referralFees.find(r => r.Category.toLowerCase() === mapping.FeeCategory.toLowerCase());
                }
            }

            // Direct/Fuzzy Match
            if (!refRule) {
                refRule = referralFees.find(r => r.Category.toLowerCase() === itemCat);
                if (!refRule) {
                    let bestScore = 0; let bestRule = null;
                    for (const r of referralFees) {
                        const score = calculateMatchScore(r.Category, itemCat);
                        if (score > bestScore) { bestScore = score; bestRule = r; }
                    }
                    if (bestScore >= 0.4) refRule = bestRule;
                }
            }

            // Fallbacks
            if (!refRule) {
                if (itemCat.includes('book')) refRule = referralFees.find(r => r.Category === 'Books');
            }

            let referralFee = 0;
            if (refRule && refRule.Tiers) {
                try {
                    const tiers = JSON.parse(refRule.Tiers);
                    const sorted = [...tiers].sort((a, b) => a.minPrice - b.minPrice);
                    const tier = sorted.find(t => price >= t.minPrice && price <= t.maxPrice);
                    if (tier) referralFee = Number((price * (tier.percentage / 100)).toFixed(2));
                    else {
                        const last = sorted[sorted.length - 1];
                        if (last && price > last.maxPrice) referralFee = Number((price * (last.percentage / 100)).toFixed(2));
                    }
                } catch (e) {
                    console.error(`Error parsing tiers for ${refRule.Category}:`, e.message);
                }
            }

            // 2. Closing Fees
            let closingFee = 0;
            let matchedClosing = undefined;

            const findBestMatch = (candidates, priceVal) => {
                if (!candidates || candidates.length === 0) return undefined;
                // Prefer FC
                const fc = candidates.filter(c => c.SellerType === 'FC');
                const pool = fc.length > 0 ? fc : candidates;
                return pool.find(c => priceVal >= c.MinPrice && priceVal <= c.MaxPrice) || pool[pool.length - 1];
            };

            // Mappings/Direct match similar to Referral
            if (!matchedClosing) {
                const mapping = categoryMappings.find(m => itemCat.includes(m.KeepaCategory.toLowerCase()));
                if (mapping) {
                    const candidates = closingFees.filter(c => c.Category && c.Category.toLowerCase() === mapping.FeeCategory.toLowerCase());
                    matchedClosing = findBestMatch(candidates, price);
                }
            }

            if (!matchedClosing) {
                const candidates = closingFees.filter(c => c.Category && c.Category.toLowerCase() === itemCat);
                matchedClosing = findBestMatch(candidates, price);
            }

            // Price tier fallback
            if (!matchedClosing) {
                matchedClosing = findBestMatch(closingFees, price);
            }

            if (matchedClosing) closingFee = matchedClosing.Fee;
            if (!matchedClosing && price > 1000) closingFee = 51; // Fallback

            // 3. Shipping
            const sizeType = item.StapleLevel || 'Standard';
            const normSize = sizeType.charAt(0).toUpperCase() + sizeType.slice(1).toLowerCase();
            const relevantFees = shippingFees
                .filter(f => f.SizeType && f.SizeType.toLowerCase() === normSize.toLowerCase())
                .sort((a, b) => a.WeightMin - b.WeightMin);

            let weightFee = 0;
            let pickPack = 0;

            let match = relevantFees.find(f => weight <= f.WeightMax && weight >= f.WeightMin);
            if (!match && relevantFees.length > 0) {
                const last = relevantFees[relevantFees.length - 1];
                if (weight > last.WeightMax) match = last;
            }

            if (match) {
                weightFee = match.Fee || 0;
                pickPack = match.PickAndPackFee || 0;
                if (match.UseIncremental) {
                    const threshold = match.WeightMin - 1;
                    const extra = Math.max(0, weight - threshold);
                    const mult = Math.ceil(extra / match.IncrementalStep);
                    weightFee += mult * match.IncrementalFee;
                }
            }
            const fulfilmentCost = weightFee + pickPack;

            // 4. Storage
            let storageCost = 0;
            if (item.Dimensions) {
                try {
                    const parts = item.Dimensions.replace(/[^0-9.x]/g, '').split('x').map(Number);
                    if (parts.length === 3) {
                        const [l, w, h] = parts;
                        const volCft = (l * w * h) / 28316.8;
                        const rate = storageFees.length > 0 ? storageFees[0].Rate : 45;
                        storageCost = Number((volCft * rate).toFixed(2));
                        if (storageCost < 1) storageCost = 1;
                    }
                } catch (e) { }
            } else {
                storageCost = normSize === 'Standard' ? 5 : 20;
            }

            // 5. Tax & Totals
            const otherCost = Number(((referralFee + closingFee + fulfilmentCost) * GST_RATE).toFixed(2));
            const totalFees = Number((referralFee + closingFee + fulfilmentCost + storageCost + otherCost).toFixed(2));
            const netRevenue = Number((price - totalFees).toFixed(2));
            const margin = price > 0 ? Number(((netRevenue / price) * 100).toFixed(2)) : 0;

            // Return Fee
            const stepLevel = item.StapleLevel || 'Standard';
            const refundProcFee = calculateReturnFee(price, stepLevel, itemCat, refundFees);
            const returnFee = Number((Math.max(0, totalFees - referralFee) + refundProcFee).toFixed(2));

            // Update ASIN
            const feePreview = {
                referralFee, closingFee, shippingFee: weightFee, fbaFee: fulfilmentCost, storageFee: storageCost,
                tax: otherCost, totalFees, netRevenue, margin, calculatedAt: new Date()
            };

            await pool.request()
                .input('id', sql.VarChar, item.Id)
                .input('feePreview', sql.NVarChar, JSON.stringify(feePreview))
                .input('returnFee', sql.Decimal(18, 2), returnFee)
                .query(`
                    UPDATE Asins SET 
                        FeePreview = @feePreview,
                        LossPerReturn = @returnFee,
                        UpdatedAt = GETDATE()
                    WHERE Id = @id
                `);
        }

        console.log('[FeeCalc] Completed');
    } catch (error) {
        console.error('Fee Calculation Calculation Error:', error);
        throw error;
    }
};

module.exports = { calculateProfits };
