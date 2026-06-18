const axios = require('axios');
const pLimitModule = require('p-limit');
const pLimit = pLimitModule.default || pLimitModule;
const { sql, getPool } = require('../database/db');
const SystemLogService = require('./SystemLogService');
const listingQualityService = require('./listingQualityService');
const rulesetEngineService = require('./rulesetEngineService');
const EventEmitter = require('events');

class LiveDataSyncService extends EventEmitter {
    constructor() {
        super();
        
        this._config = {
            _t: 'https://api.amazon.co.uk/auth/o2/token',
            _b: 'https://creatorsapi.amazon',
            maxPerRequest: 10,
            concurrency: 3,
            requestDelay: 1500,
            maxRetries: 3,
            retryDelay: 3000
        };
        
        this._tokens = new Map();
        this.activeSyncs = new Map();
    }

    // ============================================
    // Internal: Get global credentials from env
    // ============================================
    _getCredentials() {
        const cid = process.env.LIVE_SYNC_CLIENT_ID;
        const cs = process.env.LIVE_SYNC_CLIENT_SECRET;
        const pt = process.env.LIVE_SYNC_PARTNER_TAG;
        const mk = process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in';
        
        if (!cid || !cs) {
            throw new Error('Live Sync credentials not configured. Set LIVE_SYNC_CLIENT_ID and LIVE_SYNC_CLIENT_SECRET in environment.');
        }
        
        return { _cid: cid, _cs: cs, _pt: pt, _mk: mk };
    }
    
    // ============================================
    // 🚀 MAIN: Live Sync for Seller (Public Method)
    // ============================================
    async syncSellerLiveData(sellerId, options = {}) {
        const startTime = Date.now();
        const sellerIdStr = sellerId.toString();
        
        if (this.activeSyncs.has(sellerIdStr)) {
            return { 
                error: 'Live sync already in progress for this seller',
                status: 'IN_PROGRESS'
            };
        }
        
        const stats = {
            sellerId: sellerIdStr,
            syncType: 'LIVE',
            totalAsins: 0,
            successCount: 0,
            failedCount: 0,
            errors: [],
            duration: 0
        };
        
        this.activeSyncs.set(sellerIdStr, stats);
        
        try {
            const pool = await getPool();
            
            // 1. Get global credentials from env
            const creds = this._getCredentials();
            
            // 2. Get ALL active ASINs
            const asinsResult = await pool.request()
                .input('sellerId', sql.VarChar, sellerIdStr)
                .query(`
                    SELECT Id, AsinCode 
                    FROM Asins 
                    WHERE SellerId = @sellerId 
                    AND Status = 'Active'
                `);
            
            const allAsins = asinsResult.recordset;
            stats.totalAsins = allAsins.length;
            
            if (allAsins.length === 0) {
                throw new Error('No active ASINs found for this seller');
            }
            
            console.log(`Live sync: Seller ${sellerIdStr} - ${allAsins.length} ASINs`);
            
            this.emit('liveSync:started', {
                sellerId: sellerIdStr,
                totalAsins: allAsins.length
            });
            
            // 3. Get token (global, not per-seller)
            const token = await this._getToken(creds);
            
            // 4. Process in parallel batches
            const batches = this._createBatches(allAsins, this._config.maxPerRequest);
            const limit = pLimit(this._config.concurrency);
            
            let processed = 0;
            const promises = batches.map((batch, index) => 
                limit(async () => {
                    try {
                        await this._processBatch(sellerIdStr, batch, token, creds, stats);
                        processed++;
                        
                        const progress = Math.round((processed / batches.length) * 100);
                        this.emit('liveSync:progress', {
                            sellerId: sellerIdStr,
                            progress,
                            processed,
                            total: batches.length
                        });

                        // Yield execution slightly to avoid rate limit spikes
                        await this._delay(this._config.requestDelay);
                    } catch (e) {
                        stats.errors.push({ batch: index, error: e.message });
                    }
                })
            );
            
            await Promise.all(promises);
            
            stats.duration = Date.now() - startTime;
            
            console.log(`Live sync complete: Seller ${sellerIdStr}`, {
                success: stats.successCount,
                failed: stats.failedCount,
                duration: `${(stats.duration / 1000).toFixed(2)}s`
            });
            
            // 5. Post-sync actions (may take time for LQS analysis)
            try {
                await this._triggerPostSync(sellerIdStr, allAsins);
            } catch (postSyncErr) {
                console.error(`Post-sync actions failed for seller ${sellerIdStr}:`, postSyncErr.message);
                // Don't fail the whole sync for post-sync errors
            }
            
            // 6. Log sync
            await this._logSync(sellerIdStr, stats);
            
            stats.completedAt = new Date().toISOString();
            stats.status = 'COMPLETED';
            this.emit('liveSync:completed', stats);
            
            return {
                success: true,
                sellerId: sellerIdStr,
                totalAsins: stats.totalAsins,
                updatedAsins: stats.successCount,
                failedAsins: stats.failedCount,
                duration: stats.duration,
                completedAt: stats.completedAt
            };
            
        } catch (error) {
            stats.fatalError = error.message;
            stats.status = 'FAILED';
            console.error(`Live sync failed for seller ${sellerIdStr}:`, error);
            
            this.emit('liveSync:failed', { sellerId: sellerIdStr, error: error.message });
            
            throw new Error(`Live sync failed: ${error.message}`);
            
        } finally {
            // Always clean up after ALL operations complete (success or failure)
            this.activeSyncs.delete(sellerIdStr);
        }
    }
    
    // ============================================
    // Internal: Get Token (global, cached)
    // ============================================
    async _getToken(creds) {
        const cached = this._tokens.get('global');
        
        if (cached && Date.now() < cached.exp) {
            return cached.t;
        }
        
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', creds._cid);
        params.append('client_secret', creds._cs);
        params.append('scope', 'creatorsapi::default');
        
        const response = await axios.post(this._config._t, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });
        
        this._tokens.set('global', {
            t: response.data.access_token,
            exp: Date.now() + (response.data.expires_in * 1000) - 60000
        });
        
        return response.data.access_token;
    }
    
    // ============================================
    // Internal: Process Batch
    // ============================================
    async _processBatch(sellerId, batch, token, creds, stats, retry = 0) {
        try {
            const codes = batch.map(a => a.AsinCode);
            
            const response = await axios.post(
                `${this._config._b}/catalog/v1/getItems`,
                {
                    itemIds: codes,
                    itemIdType: 'ASIN',
                    marketplace: creds._mk || 'www.amazon.in',
                    partnerTag: creds._pt,
                    resources: this._getResources()
                },
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'x-marketplace': creds._mk || 'www.amazon.in'
                    },
                    timeout: 30000
                }
            );
            
            const items = response.data.itemsResult?.items || [];
            
            const savePromises = batch.map(async (asinRecord) => {
                try {
                    const item = items.find(i => i.asin === asinRecord.AsinCode);
                    if (!item) {
                        stats.failedCount++;
                        return;
                    }
                    
                    await this._updateAsinFromLiveSync(asinRecord.Id, sellerId, item);
                    stats.successCount++;
                } catch (e) {
                    stats.failedCount++;
                    stats.errors.push({ asin: asinRecord.AsinCode, error: e.message });
                }
            });
            
            await Promise.all(savePromises);
            
        } catch (error) {
            if (error.response?.status === 429 && retry < this._config.maxRetries) {
                await this._delay(this._config.retryDelay * Math.pow(2, retry));
                return this._processBatch(sellerId, batch, token, creds, stats, retry + 1);
            }
            
            if (error.response?.status === 401 && retry < this._config.maxRetries) {
                this._tokens.delete('global');
                const newToken = await this._getToken(creds);
                return this._processBatch(sellerId, batch, newToken, creds, stats, retry + 1);
            }
            
            throw error;
        }
    }
    
    // ============================================
    // 🔥 KEY: Update ALL Fields EXCEPT A+ and Rating Breakdown
    // ============================================
    async _updateAsinFromLiveSync(asinId, sellerId, item) {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        
        try {
            await transaction.begin();
            
            const extracted = this._extractFields(item);
            
            // ⚠️ Update ALL fields EXCEPT:
            // - HasAplus, AplusContent, AplusModuleCount (from Octoparse)
            // - RatingBreakdown (from Octoparse)
            
            await new sql.Request(transaction)
                .input('asinId', sql.VarChar, asinId)
                .input('title', sql.NVarChar(sql.MAX), extracted.title)
                .input('parentAsin', sql.NVarChar, extracted.parentAsin)
                .input('currentPrice', sql.Decimal(18, 2), extracted.priceAmount)
                .input('mrp', sql.Decimal(18, 2), extracted.mrpAmount)
                .input('discount', sql.Int, extracted.discountPercent)
                .input('mainImage', sql.NVarChar(sql.MAX), extracted.mainImage)
                .input('rating', sql.Decimal(3, 2), extracted.rating)
                .input('reviewCount', sql.Int, extracted.reviewCount)
                .input('mainBSR', sql.Int, extracted.mainBSR)
                .input('subBSR', sql.Int, extracted.subBSR)
                .input('subBSRCategory', sql.NVarChar(255), extracted.subBSRCategory)
                .input('mainCategory', sql.NVarChar, extracted.mainCategory)
                .input('subCategory', sql.NVarChar, extracted.subCategory)
                .input('categoryPath', sql.NVarChar(500), extracted.categoryPath)
                .input('seller', sql.NVarChar, extracted.seller)
                .input('sellerId', sql.NVarChar, extracted.sellerId)
                .input('availability', sql.NVarChar, extracted.availability)
                .input('imageCount', sql.Int, extracted.imageCount)
                .input('bulletPointCount', sql.Int, extracted.bulletPointCount)
                .input('bulletPoints', sql.NVarChar(sql.MAX), JSON.stringify(extracted.bulletPoints))
                .input('imagesJson', sql.NVarChar(sql.MAX), JSON.stringify([extracted.mainImage, ...extracted.variantImages].filter(Boolean)))
                .input('hasDeal', sql.Bit, extracted.hasDeal ? 1 : 0)
                .input('dealType', sql.NVarChar, extracted.dealType)
                .input('dealEndTime', sql.DateTime, extracted.dealEndTime)
                .input('variantImages', sql.NVarChar(sql.MAX), JSON.stringify(extracted.variantImages))
                .input('dimensions', sql.NVarChar(sql.MAX), JSON.stringify(extracted.dimensions))
                .input('buyBoxes', sql.NVarChar(sql.MAX), JSON.stringify(extracted.buyBoxes))
                .query(`
                    UPDATE Asins SET
                        Title = @title,
                        ParentAsin = @parentAsin,
                        CurrentPrice = @currentPrice,
                        Mrp = @mrp,
                        Category = @mainCategory,
                        BSR = @mainBSR,
                        SubBSR = @subBSR,
                        SubBSRCategory = @subBSRCategory,
                        Rating = ISNULL(@rating, Rating),
                        ReviewCount = ISNULL(@reviewCount, ReviewCount),
                        ImageUrl = @mainImage,
                        ImagesCount = @imageCount,
                        Images = @imagesJson,
                        BulletPoints = @bulletPointCount,
                        BulletPointsText = @bulletPoints,

                        SellerExternalId = @sellerId,
                        CategoryPath = @categoryPath,
                        VariantImages = @variantImages,
                        Dimensions = @dimensions,
                        BuyBoxes = @buyBoxes,
                        HasDeal = @hasDeal,
                        DealType = @dealType,
                        DealEndTime = @dealEndTime,
                        LastLiveSyncAt = dbo.GetEnvDate(),
                        LastSyncSource = 'LIVE',
                        UpdatedAt = dbo.GetEnvDate()
                    WHERE Id = @asinId
                `);
            
            // Insert into AsinHistory (use SELECT from Asins to preserve current rating/reviewCount if null)
            await new sql.Request(transaction)
                .input('asinId', sql.VarChar, asinId)
                .input('price', sql.Decimal(18, 2), extracted.priceAmount)
                .input('mrp', sql.Decimal(18, 2), extracted.mrpAmount)
                .input('bsr', sql.Int, extracted.mainBSR)
                .input('subBSR', sql.Int, extracted.subBSR)
                .input('rating', sql.Decimal(3, 2), extracted.rating)
                .input('reviewCount', sql.Int, extracted.reviewCount)
                .input('source', sql.NVarChar, 'LIVE')
                .query(`
                    INSERT INTO AsinHistory (
                        AsinId, Date, Price, BSR, SubBSR, Rating, ReviewCount, Source
                    )
                    SELECT 
                        @asinId, 
                        CAST(dbo.GetEnvDate() AS DATE), 
                        @price, 
                        @bsr, 
                        @subBSR,
                        ISNULL(@rating, Rating), 
                        ISNULL(@reviewCount, ReviewCount), 
                        @source
                    FROM Asins
                    WHERE Id = @asinId
                `);
            
            await transaction.commit();
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    
    // ============================================
    // Internal: Extract Fields from API response
    // Maps the actual Creators API JSON response format
    // ============================================
    _extractFields(item) {
        // ── Buy Box / Listing (Creators API uses offersV2.listings) ─────
        const listing = item.offersV2?.listings?.find(l => l.isBuyBoxWinner) 
                     || item.offersV2?.listings?.[0]
                     || item.buyBoxes?.find(b => b.isBuyBoxWinner) 
                     || item.buyBoxes?.[0];
        
        // ── Price (Creators API: offersV2.listings[].price.money.amount) ─
        const priceMoney = listing?.price?.money;
        const savingBasis = listing?.price?.savingBasis?.money;
        const savings = listing?.price?.savings;
        
        const priceAmount = priceMoney?.amount 
                         || listing?.priceAmount 
                         || this._parsePrice(item.price);
        const mrpAmount = savingBasis?.amount 
                       || listing?.mrpAmount 
                       || this._parsePrice(item.mrp);
        const discountPercent = savings?.percentage 
                             || this._parseDiscount(item.discount);
        
        // ── BSR (Creators API: rankings array format) ─────────────────────
        // API returns: ["#467556 in Unknown", "#578 in Washer Floor Trays"]
        // First = main BSR (website-wide), Second = sub BSR (category-specific)
        const rankings = item.rankings || [];
        const browseNodes = item.browseNodeInfo?.browseNodes || [];
        
        let mainBSR = null;
        let subBSR = null;
        let subBSRCategory = null;
        
        // Primary: Parse from rankings array (most reliable)
        if (rankings.length >= 2) {
            mainBSR = this._parseBSR(rankings[0]);
            subBSR = this._parseBSR(rankings[1]);
            subBSRCategory = this._parseBSRCategory(rankings[1]);
        } else if (rankings.length === 1) {
            mainBSR = this._parseBSR(rankings[0]);
        }
        
        // Fallback: Use browseNodeInfo.websiteSalesRank for main BSR
        if (!mainBSR && item.browseNodeInfo?.websiteSalesRank?.salesRank) {
            mainBSR = item.browseNodeInfo.websiteSalesRank.salesRank;
        }
        
        // Fallback: Use browseNodes for sub BSR
        if (!subBSR && browseNodes.length > 1) {
            for (const node of browseNodes) {
                if (node.salesRank && node.salesRank !== mainBSR && !subBSR) {
                    subBSR = node.salesRank;
                    subBSRCategory = node.contextFreeName;
                }
            }
        }
        
        // ── Category ────────────────────────────────────────────────────
        const categoryPath = item.category || browseNodes[0]?.contextFreeName || '';
        const pathParts = categoryPath.split(/[›>]/).filter(Boolean);
        
        // ── Customer Reviews ────────────────────────────────────────────
        const customerReviews = item.customerReviews || {};
        const rating = this._parseRating(customerReviews.starRating);
        const reviewCount = this._parseReviewCount(customerReviews.count);
        
        // ── Images (Creators API: images.primary.large.url) ─────────────
        const primaryImage = item.images?.primary?.large?.url 
                          || item.images?.primary?.medium?.url
                          || item.images?.primary?.small?.url
                          || item.mainImage 
                          || null;
        const variantImages = (item.images?.variants || []).map(v => v?.large?.url || v?.medium?.url || v?.url).filter(Boolean)
                          || item.variantImages 
                          || [];
        
        // ── Deals ───────────────────────────────────────────────────────
        const deals = item.deals || [];
        const hasDeal = deals.length > 0;
        const activeDeal = deals[0];
        
        return {
            title: item.itemInfo?.title?.displayValue || item.productName || null,
            parentAsin: item.parentASIN || item.parentAsin || null,
            priceAmount: priceAmount,
            mrpAmount: mrpAmount,
            discountPercent: discountPercent,
            availability: listing?.availability?.type || item.stock?.status || listing?.availability || 'Unknown',
            seller: listing?.merchantInfo?.name || listing?.seller || null,
            sellerId: listing?.merchantInfo?.id || listing?.sellerId || null,
            rating: rating,
            reviewCount: reviewCount,
            mainCategory: pathParts[0] || null,
            subCategory: pathParts[pathParts.length - 1] || null,
            categoryPath: categoryPath,
            mainBSR: mainBSR,
            subBSR: subBSR,
            subBSRCategory: subBSRCategory,
            mainImage: primaryImage,
            imageCount: variantImages.length + (primaryImage ? 1 : 0),
            bulletPoints: item.itemInfo?.features?.displayValues || item.bulletPoints || [],
            bulletPointCount: item.itemInfo?.features?.displayValues?.length || item.bulletPointsCount || item.bulletPoints?.length || 0,
            hasDeal: hasDeal,
            dealType: activeDeal?.badge || activeDeal?.dealType || null,
            dealEndTime: activeDeal?.endTime ? new Date(activeDeal.endTime) : null,
            variantImages: variantImages,
            dimensions: item.dimensions || null,
            buyBoxes: (item.offersV2?.listings || item.buyBoxes || []).map(l => ({
                buyBoxNumber: l.buyBoxNumber || 1,
                isBuyBoxWinner: l.isBuyBoxWinner || false,
                seller: l.merchantInfo?.name || l.seller || null,
                sellerId: l.merchantInfo?.id || l.sellerId || null,
                price: l.price?.money?.displayAmount || l.price,
                priceAmount: l.price?.money?.amount || l.priceAmount,
                currency: l.price?.money?.currency || l.currency || 'INR',
                mrp: l.price?.savingBasis?.money?.displayAmount || l.mrp,
                mrpAmount: l.price?.savingBasis?.money?.amount || l.mrpAmount,
                savingsAmount: l.price?.savings?.money?.amount || l.savingsAmount,
                savingsPercentage: l.price?.savings?.percentage || l.savingsPercentage,
                condition: l.condition,
                availability: l.availability?.type || l.availability,
                availabilityType: l.availabilityType,
                maxOrderQuantity: l.maxOrderQuantity,
                minOrderQuantity: l.minOrderQuantity,
                violatesMAP: l.violatesMAP || false,
                type: l.type
            }))
        };
    }
    
    // Parse BSR from ranking string like "#367 in Unknown"
    _parseBSR(rankStr) {
        if (!rankStr) return null;
        const match = rankStr.match(/#([\d,]+)/);
        if (!match) return null;
        return parseInt(match[1].replace(/,/g, ''), 10) || null;
    }
    
    // Parse category name from ranking string like "#578 in Washer Floor Trays"
    _parseBSRCategory(rankStr) {
        if (!rankStr) return null;
        const match = rankStr.match(/in\s+(.+)$/);
        return match ? match[1].trim() : null;
    }
    
    // Parse price from "₹599.00" format
    _parsePrice(priceStr) {
        if (!priceStr) return null;
        if (typeof priceStr === 'number') return priceStr;
        const match = priceStr.replace(/,/g, '').match(/([\d.]+)/);
        return match ? parseFloat(match[1]) : null;
    }
    
    // Parse discount from "-88%" format
    _parseDiscount(discountStr) {
        if (!discountStr) return null;
        const match = discountStr.match(/(-?\d+)/);
        return match ? Math.abs(parseInt(match[1], 10)) : null;
    }
    
    // Parse rating from Amazon API response (can be number, string, or object with value)
    _parseRating(ratingData) {
        if (!ratingData) return null;
        if (typeof ratingData === 'number') return ratingData;
        if (typeof ratingData === 'string') {
            const parsed = parseFloat(ratingData);
            return isNaN(parsed) ? null : parsed;
        }
        if (ratingData.value !== undefined) return parseFloat(ratingData.value) || null;
        if (ratingData.starRating !== undefined) return parseFloat(ratingData.starRating) || null;
        return null;
    }
    
    // Parse review count from Amazon API response (can be number, string, or object with value)
    _parseReviewCount(countData) {
        if (!countData) return null;
        if (typeof countData === 'number') return Math.round(countData);
        if (typeof countData === 'string') {
            const cleaned = countData.replace(/[,]/g, '');
            const parsed = parseInt(cleaned, 10);
            return isNaN(parsed) ? null : parsed;
        }
        if (countData.value !== undefined) return Math.round(parseFloat(countData.value)) || null;
        if (countData.count !== undefined) return Math.round(parseFloat(countData.count)) || null;
        return null;
    }
    
    _getResources() {
        return [
            'itemInfo.title',
            'itemInfo.features',
            'itemInfo.productInfo',
            'itemInfo.byLineInfo',
            'images.primary.large',
            'images.variants.large',
            'offersV2.listings.price',
            'offersV2.listings.availability',
            'offersV2.listings.condition',
            'offersV2.listings.merchantInfo',
            'offersV2.listings.dealDetails',
            'offersV2.listings.isBuyBoxWinner',
            'offersV2.listings.type',
            'customerReviews.count',
            'customerReviews.starRating',
            'browseNodeInfo.browseNodes',
            'browseNodeInfo.browseNodes.ancestor',
            'browseNodeInfo.browseNodes.salesRank',
            'browseNodeInfo.websiteSalesRank',
            'parentASIN'
        ];
    }
    
    async _triggerPostSync(sellerId, allAsins) {
        try {
            console.log(`Running post-sync operations for seller: ${sellerId}`);
            for (const asin of allAsins) {
                try {
                    await listingQualityService.analyzeAndSaveFull(asin.Id);
                } catch (e) {
                    console.error(`LQS analysis failed for ASIN ${asin.Id}:`, e.message);
                }
            }
            
            // Rulesets/Alerts engine execution if present
            try {
                if (rulesetEngineService && typeof rulesetEngineService.runForSeller === 'function') {
                    await rulesetEngineService.runForSeller(sellerId);
                }
            } catch (e) {
                console.error(`RulesetEngineService run failed for seller ${sellerId}:`, e.message);
            }
        } catch (e) {
            console.error('Post-sync actions failed:', e);
        }
    }
    
    async _logSync(sellerId, stats) {
        try {
            await SystemLogService.log({
                type: 'LIVE_SYNC',
                entityType: 'SELLER',
                entityId: sellerId,
                description: `Live data sync completed for seller ${sellerId}. Total: ${stats.totalAsins}, Success: ${stats.successCount}, Failed: ${stats.failedCount}`,
                metadata: stats
            });
        } catch (e) {
            console.error('Logging sync failed:', e);
        }
    }
    
    _createBatches(items, size) {
        const batches = [];
        for (let i = 0; i < items.length; i += size) {
            batches.push(items.slice(i, i + size));
        }
        return batches;
    }
    
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = new LiveDataSyncService();
