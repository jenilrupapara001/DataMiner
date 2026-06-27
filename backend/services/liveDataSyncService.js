const axios = require('axios');
const pLimitModule = require('p-limit');
const pLimit = pLimitModule.default || pLimitModule;
const { sql, getPool } = require('../database/db');
const SystemLogService = require('./SystemLogService');
const notificationController = require('../controllers/notificationController');
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
            concurrency: 2,
            requestDelay: 2000,
            sellerDelay: 2000,
            maxRetries: 3,
            retryDelay: 5000,
            rateLimitPerSecond: 1
        };
        
        this._tokens = new Map();
        this.activeSyncs = new Map();
        this._globalSyncRunning = false;
        this._lastRequestTime = 0;
    }
    
    // Rate limiter - ensures max 1 request per second
    async _rateLimit() {
        const now = Date.now();
        const elapsed = now - this._lastRequestTime;
        const minInterval = 1000 / this._config.rateLimitPerSecond;
        if (elapsed < minInterval) {
            await this._delay(minInterval - elapsed);
        }
        this._lastRequestTime = Date.now();
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
            failedAsinCodes: [],
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
                    AND Status IN ('Active', 'Error')
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
            
            // 4. Process in parallel batches with rate-limit-aware delays
            const batches = this._createBatches(allAsins, this._config.maxPerRequest);
            const limit = pLimit(this._config.concurrency);
            
            let processed = 0;
            let consecutiveFailures = 0;
            
            const promises = batches.map((batch, index) => 
                limit(async () => {
                    try {
                        await this._processBatch(sellerIdStr, batch, token, creds, stats);
                        processed++;
                        consecutiveFailures = 0;
                        
                        const progress = Math.round((processed / batches.length) * 100);
                        this.emit('liveSync:progress', {
                            sellerId: sellerIdStr,
                            progress,
                            processed,
                            total: batches.length
                        });

                        // Always delay after each batch (success or failure) to respect rate limits
                        await this._delay(this._config.requestDelay);
                    } catch (e) {
                        stats.errors.push({ batch: index, error: e.message });
                        consecutiveFailures++;
                        
                        // Track ASINs from failed batches
                        for (const asinRecord of batch) {
                            stats.failedCount++;
                            stats.failedAsinCodes.push(asinRecord.AsinCode);
                        }
                        
                        // Exponential backoff on consecutive failures (2s → 4s → 8s → 16s)
                        const backoff = Math.min(this._config.requestDelay * Math.pow(2, consecutiveFailures), 16000);
                        console.log(`  ⏳ Batch ${index + 1} failed, backing off ${(backoff / 1000).toFixed(0)}s (consecutive failures: ${consecutiveFailures})`);
                        await this._delay(backoff);
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
            
            // 7. Emit socket event for real-time UI updates
            try {
                const SocketService = require('./socketService');
                const io = SocketService.getIo();
                if (io) {
                    console.log(`⚡ Emitting liveSync:completed for ${sellerIdStr}`);
                    io.emit('liveSync:completed', {
                        sellerId: sellerIdStr,
                        totalAsins: stats.totalAsins,
                        updatedAsins: stats.successCount,
                        failedAsins: stats.failedCount,
                        failedAsinCodes: stats.failedAsinCodes,
                        duration: stats.duration
                    });
                    // Also emit ASIN update event for ASIN manager auto-refresh
                    console.log(`⚡ Emitting ASINS_UPDATED for ${sellerIdStr}`);
                    io.emit('ASINS_UPDATED', { sellerId: sellerIdStr });
                } else {
                    console.warn('⚠️ SocketService not initialized, skipping socket emission');
                }
            } catch (e) { console.error('Socket emission error:', e.message); }
            
            // 8. If there are failed ASINs, schedule auto-retry after 30s
            if (stats.failedAsinCodes.length > 0) {
                const failedCodes = [...stats.failedAsinCodes];
                console.log(`🔄 Scheduling re-sync for ${failedCodes.length} failed ASINs in 30s...`);
                
                setTimeout(async () => {
                    try {
                        await this._resyncFailedAsins(sellerIdStr, failedCodes, creds);
                    } catch (reSyncErr) {
                        console.error(`Re-sync of failed ASINs error:`, reSyncErr.message);
                    }
                }, 30000);
            }
            
            // 9. Notify users about sync results
            await this._notifySyncResult(sellerIdStr, stats);
            
            stats.completedAt = new Date().toISOString();
            stats.status = 'COMPLETED';
            this.emit('liveSync:completed', stats);
            
            return {
                success: true,
                sellerId: sellerIdStr,
                totalAsins: stats.totalAsins,
                updatedAsins: stats.successCount,
                failedAsins: stats.failedCount,
                failedAsinCodes: stats.failedAsinCodes,
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
    // GLOBAL: Sync All Sellers (parallel batching)
    // ============================================
    async syncAllSellers(options = {}) {
        const { concurrency = 1, sellerIds = null, maxRetries = 2 } = options;
        const startTime = Date.now();
        
        // Prevent duplicate global sync
        if (this._globalSyncRunning) {
            return { error: 'Global live sync already in progress', status: 'IN_PROGRESS' };
        }
        this._globalSyncRunning = true;

        try {
            const pool = await getPool();

            // Get all active sellers with Amazon ASINs
            let sellersQuery = `
                SELECT DISTINCT s.Id, s.Name, COUNT(a.Id) as AsinCount
                FROM Sellers s
                JOIN Asins a ON a.SellerId = s.Id
                WHERE s.IsActive = 1 AND a.Status = 'Active' AND a.AsinCode LIKE 'B0%'
                GROUP BY s.Id, s.Name
                HAVING COUNT(a.Id) > 0
            `;
            const request = pool.request();
            if (sellerIds && sellerIds.length > 0) {
                sellersQuery += ` AND s.Id IN (${sellerIds.map((_, i) => `@sellerId${i}`).join(',')})`;
                sellerIds.forEach((id, i) => request.input(`sellerId${i}`, sql.VarChar, id));
            }

            const sellersResult = await request.query(sellersQuery);
            const sellers = sellersResult.recordset;

            console.log(`⚡ Live sync all: ${sellers.length} sellers (${sellers.reduce((s, v) => s + v.AsinCount, 0)} ASINs)`);
            console.log(`   Config: concurrency=${concurrency}, retries=${maxRetries}, delay=${this._config.sellerDelay}ms`);
            this.emit('liveSyncAll:started', { totalSellers: sellers.length });

            const results = [];

            // Process sellers sequentially for reliability (concurrency=1 default)
            for (let i = 0; i < sellers.length; i++) {
                const seller = sellers[i];
                const progress = `[${i + 1}/${sellers.length}]`;

                if (this._globalSyncAborted) {
                    results.push({ sellerId: seller.Id, name: seller.Name, status: 'SKIPPED', reason: 'Sync aborted' });
                    continue;
                }

                if (this.activeSyncs.has(seller.Id)) {
                    results.push({ sellerId: seller.Id, name: seller.Name, status: 'SKIPPED', reason: 'Already syncing' });
                    console.log(`  ${progress} ⏭️  ${seller.Name} — already syncing, skipped`);
                    continue;
                }

                let lastError = null;
                let attempt = 0;

                while (attempt <= maxRetries) {
                    try {
                        if (attempt > 0) {
                            console.log(`  ${progress} 🔄 ${seller.Name} — retry ${attempt}/${maxRetries}`);
                            await this._delay(this._config.retryDelay);
                        }

                        const result = await this.syncSellerLiveData(seller.Id);
                        results.push({
                            sellerId: seller.Id,
                            name: seller.Name,
                            status: result.success ? 'SUCCESS' : 'PARTIAL',
                            updated: result.updatedAsins || 0,
                            failed: result.failedAsins || 0,
                            duration: result.duration || 0
                        });
                        console.log(`  ${progress} ✅ ${seller.Name}: ${result.updatedAsins || 0} updated, ${result.failedAsins || 0} failed (${((result.duration || 0) / 1000).toFixed(1)}s)`);
                        break; // success, no more retries
                    } catch (err) {
                        lastError = err;
                        attempt++;
                        console.warn(`  ${progress} ⚠️  ${seller.Name}: attempt ${attempt}/${maxRetries} failed — ${err.message}`);
                    }
                }

                // If all retries failed
                if (lastError && attempt > maxRetries) {
                    results.push({ sellerId: seller.Id, name: seller.Name, status: 'FAILED', error: lastError.message, retries: maxRetries });
                    console.error(`  ${progress} ❌ ${seller.Name}: FAILED after ${maxRetries} retries — ${lastError.message}`);
                }

                // Delay between sellers (respect rate limit)
                if (i < sellers.length - 1) {
                    await this._delay(this._config.sellerDelay);
                }
            }

            const totalDuration = Date.now() - startTime;
            const summary = {
                totalSellers: sellers.length,
                success: results.filter(r => r.status === 'SUCCESS').length,
                partial: results.filter(r => r.status === 'PARTIAL').length,
                failed: results.filter(r => r.status === 'FAILED').length,
                skipped: results.filter(r => r.status === 'SKIPPED').length,
                totalAsinsUpdated: results.reduce((sum, r) => sum + (r.updated || 0), 0),
                duration: totalDuration,
                completedAt: new Date().toISOString()
            };

            console.log(`⚡ Live sync complete: ${summary.success}/${summary.totalSellers} success, ${summary.partial} partial, ${summary.failed} failed, ${summary.totalAsinsUpdated} ASINs in ${(totalDuration / 1000).toFixed(1)}s`);
            this.emit('liveSyncAll:completed', summary);

            // Emit socket event for real-time UI updates
            try {
                const SocketService = require('./socketService');
                const io = SocketService.getIo();
                if (io) {
                    io.emit('liveSyncAll:completed', summary);
                    io.emit('ASINS_UPDATED', { type: 'bulk', sellerCount: summary.success });
                }
            } catch (e) { /* socket not critical */ }

            return { success: true, summary, results };
        } finally {
            this._globalSyncRunning = false;
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
            
            // Rate limit before API call
            await this._rateLimit();
            
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
                        stats.failedAsinCodes.push(asinRecord.AsinCode);
                        return;
                    }
                    
                    await this._updateAsinFromLiveSync(asinRecord.Id, sellerId, item);
                    stats.successCount++;
                } catch (e) {
                    stats.failedCount++;
                    stats.failedAsinCodes.push(asinRecord.AsinCode);
                    stats.errors.push({ asin: asinRecord.AsinCode, error: e.message });
                }
            });
            
            await Promise.all(savePromises);
            
        } catch (error) {
            if (error.response?.status === 429 && retry < this._config.maxRetries) {
                const backoff = this._config.retryDelay * Math.pow(2, retry + 1);
                console.log(`⏳ Rate limited on batch, retrying in ${(backoff / 1000).toFixed(0)}s (attempt ${retry + 1}/${this._config.maxRetries})...`);
                await this._delay(backoff);
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
            
            // Price Dispute Calculation
            const uploadedPrice = item.uploadedPrice || item.UploadedPrice || 0;
            const currentPrice = extracted.priceAmount || 0;
            const dealBadge = extracted.dealBadge || '';
            
            // Only PROPER Amazon deal types suppress dispute.
            // "% off" badges, "Sale", "Ends in..." countdown banners do NOT suppress.
            const PROPER_DEAL_PATTERN = /^(lightning|limited time deal|best deal|prime exclusive|subscribe.?and.?save|deal of the day|coupon)$/i;
            const hasProperDeal = PROPER_DEAL_PATTERN.test(dealBadge.trim());
            
            let priceDispute = false;
            if (uploadedPrice > 0 && currentPrice > 0) {
                const priceDiff = Math.abs(uploadedPrice - currentPrice);
                if (!hasProperDeal && priceDiff > 5) {
                    priceDispute = true;
                }
            }
            
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
                .input('dealStartTime', sql.DateTime, extracted.dealStartTime)
                .input('dealEndTime', sql.DateTime, extracted.dealEndTime)
                .input('dealAccessType', sql.NVarChar, extracted.dealAccessType)
                .input('dealPercentClaimed', sql.NVarChar, extracted.dealPercentClaimed)
                .input('manufacturer', sql.NVarChar, extracted.manufacturer)
                .input('priceDispute', sql.Bit, priceDispute ? 1 : 0)
                .input('variantImages', sql.NVarChar(sql.MAX), JSON.stringify(extracted.variantImages))
                .input('dimensions', sql.NVarChar(sql.MAX), JSON.stringify(extracted.dimensions))
                .input('buyBoxes', sql.NVarChar(sql.MAX), JSON.stringify(extracted.buyBoxes))
                .input('soldBy', sql.NVarChar, extracted.soldBy)
                .input('soldBySec', sql.NVarChar, extracted.soldBySec)
                .input('buyBoxWin', sql.Bit, extracted.buyBoxWin ? 1 : 0)
                .input('allOffersJson', sql.NVarChar(sql.MAX), JSON.stringify(extracted.allOffers))
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

                        SoldBy = @soldBy,
                        SoldBySec = @soldBySec,
                        BuyBoxWin = @buyBoxWin,
                        AllOffers = @allOffersJson,
                        SellerExternalId = @sellerId,
                        CategoryPath = @categoryPath,
                        VariantImages = @variantImages,
                        Dimensions = @dimensions,
                        BuyBoxes = @buyBoxes,
                        HasDeal = @hasDeal,
                        DealBadge = @dealType,
                        DealType = @dealType,
                        DealStartTime = @dealStartTime,
                        DealEndTime = @dealEndTime,
                        DealAccessType = @dealAccessType,
                        DealPercentClaimed = @dealPercentClaimed,
                        Manufacturer = @manufacturer,
                        PriceDispute = @priceDispute,
                        DiscountPercentage = @discount,
                        LastLiveSyncAt = dbo.GetEnvDate(),
                        LastSyncSource = 'LIVE',
                        UpdatedAt = dbo.GetEnvDate(),
                        AvailabilityStatus = @availability
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
        
        // ── Deals (Creators API: from listing.dealDetails, NOT item.deals) ──
        const listingDealDetails = listing?.dealDetails || null;
        const hasDeal = !!(listingDealDetails && (listingDealDetails.badge || listingDealDetails.type || listingDealDetails.hasDeal));
        const activeDeal = listingDealDetails;
        
        // ── Manufacturer ──────────────────────────────────────────────
        const manufacturer = item.itemInfo?.byLineInfo?.manufacturer?.displayValue 
                           || item.itemInfo?.byLineInfo?.brand?.displayValue
                           || null;
        
        // ── Deal details with dates ──────────────────────────────────
        const dealBadge = (activeDeal?.badge || activeDeal?.type || null);
        const dealStartTime = activeDeal?.startDate ? new Date(activeDeal.startDate) 
                            : activeDeal?.startTime ? new Date(activeDeal.startTime) 
                            : null;
        const dealEndTime = activeDeal?.endDate ? new Date(activeDeal.endDate)
                          : activeDeal?.endTime ? new Date(activeDeal.endTime)
                          : null;
        const dealAccessType = activeDeal?.accessType || null;
        const dealPercentClaimed = activeDeal?.percentClaimed != null ? `${activeDeal.percentClaimed}%` : null;
        
        // ── Availability ────────────────────────────────────────────
        const availability = listing?.availability?.message 
                           || listing?.availability?.type 
                           || item.stock?.status 
                           || 'Unknown';
        
        return {
            title: item.itemInfo?.title?.displayValue || item.productName || null,
            parentAsin: item.parentASIN || item.parentAsin || null,
            priceAmount: priceAmount,
            mrpAmount: mrpAmount,
            discountPercent: discountPercent,
            availability: availability,
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
            dealType: dealBadge,
            dealStartTime: dealStartTime,
            dealEndTime: dealEndTime,
            dealAccessType: dealAccessType,
            dealPercentClaimed: dealPercentClaimed,
            manufacturer: manufacturer,
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

        // Derive SoldBy and AllOffers from buyBoxes
        const buyBoxWinner = extracted.buyBoxes.find(b => b.isBuyBoxWinner) || extracted.buyBoxes[0];
        extracted.soldBy = buyBoxWinner?.seller || extracted.seller || null;
        extracted.soldBySec = extracted.buyBoxes.find(b => !b.isBuyBoxWinner && b.seller)?.seller || null;
        extracted.buyBoxWin = extracted.buyBoxes.some(b => b.isBuyBoxWinner);
        extracted.allOffers = extracted.buyBoxes.map(b => ({
            seller: b.seller,
            price: b.priceAmount || 0,
            isBuyBoxWinner: b.isBuyBoxWinner
        }));

        return extracted;
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
            // Fetch seller name for human-readable log
            let sellerName = sellerId;
            try {
                const pool = await getPool();
                const nameResult = await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .query('SELECT Name FROM Sellers WHERE Id = @id');
                if (nameResult.recordset.length > 0) {
                    sellerName = nameResult.recordset[0].Name;
                }
            } catch (e) { /* use sellerId as fallback */ }
            
            await SystemLogService.log({
                type: 'LIVE_SYNC',
                entityType: 'SELLER',
                entityId: sellerId,
                entityTitle: sellerName,
                description: `Live data sync completed for ${sellerName}. Total: ${stats.totalAsins}, Success: ${stats.successCount}, Failed: ${stats.failedCount}, Duration: ${(stats.duration / 1000).toFixed(1)}s`,
                metadata: { ...stats, sellerName }
            });
        } catch (e) {
            console.error('Logging sync failed:', e);
        }
    }

    // ============================================
    // Re-sync only failed ASINs (called after main sync)
    // ============================================
    async _resyncFailedAsins(sellerId, failedCodes, creds) {
        const pool = await getPool();
        const startTime = Date.now();
        const stats = {
            sellerId,
            syncType: 'RE_SYNC',
            totalAsins: failedCodes.length,
            successCount: 0,
            failedCount: 0,
            failedAsinCodes: [],
            errors: []
        };

        try {
            console.log(`🔄 Re-sync: Starting for ${failedCodes.length} failed ASINs...`);

            const request = pool.request()
                .input('sellerId', sql.VarChar, sellerId);
            failedCodes.forEach((code, i) => request.input(`code${i}`, sql.VarChar, code));
            const asinsResult = await request.query(`
                    SELECT Id, AsinCode 
                    FROM Asins 
                    WHERE SellerId = @sellerId 
                    AND AsinCode IN (${failedCodes.map((_, i) => `@code${i}`).join(',')})
                `);
            const asinsToRetry = asinsResult.recordset;

            if (asinsToRetry.length === 0) {
                console.log(`🔄 Re-sync: No ASINs found to retry`);
                return;
            }

            const token = await this._getToken(creds);
            const batches = this._createBatches(asinsToRetry, this._config.maxPerRequest);
            const limit = pLimit(this._config.concurrency);

            const promises = batches.map((batch) =>
                limit(async () => {
                    try {
                        await this._processBatch(sellerId, batch, token, creds, stats);
                        await this._delay(this._config.requestDelay);
                    } catch (e) {
                        stats.errors.push({ error: e.message });
                    }
                })
            );

            await Promise.all(promises);
            stats.duration = Date.now() - startTime;

            console.log(`🔄 Re-sync complete: Seller ${sellerId}`, {
                success: stats.successCount,
                failed: stats.failedCount,
                duration: `${(stats.duration / 1000).toFixed(2)}s`
            });

            // Emit socket events for UI refresh
            try {
                const SocketService = require('./socketService');
                const io = SocketService.getIo();
                if (io) {
                    io.emit('liveSync:reSyncCompleted', {
                        sellerId,
                        retried: failedCodes.length,
                        successCount: stats.successCount,
                        failedCount: stats.failedCount,
                        failedAsinCodes: stats.failedAsinCodes,
                        duration: stats.duration
                    });
                    io.emit('ASINS_UPDATED', { sellerId });
                }
            } catch (e) { console.error('Socket emission error:', e.message); }

            // Log re-sync
            let sellerName = sellerId;
            try {
                const nameResult = await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .query('SELECT Name FROM Sellers WHERE Id = @id');
                if (nameResult.recordset.length > 0) {
                    sellerName = nameResult.recordset[0].Name;
                }
            } catch (e) { /* fallback */ }

            await SystemLogService.log({
                type: 'RE_SYNC',
                entityType: 'SELLER',
                entityId: sellerId,
                entityTitle: sellerName,
                description: `Re-sync of ${failedCodes.length} failed ASINs for ${sellerName}. Success: ${stats.successCount}, Still Failed: ${stats.failedCount}, Duration: ${(stats.duration / 1000).toFixed(1)}s${stats.failedAsinCodes.length > 0 ? '. Still failed: ' + stats.failedAsinCodes.slice(0, 5).join(', ') + (stats.failedAsinCodes.length > 5 ? '...' : '') : ''}`,
                metadata: { ...stats, sellerName, failedAsinCodes: stats.failedAsinCodes }
            });

            // Notify users about re-sync result
            const failedStill = stats.failedAsinCodes.length;
            const reSyncMsg = failedStill === 0
                ? `✅ Re-sync successful! All ${stats.successCount} previously failed ASINs for ${sellerName} are now synced.`
                : `⚠️ Re-sync for ${sellerName}: ${stats.successCount} recovered, ${failedStill} still failing. ASINs: ${stats.failedAsinCodes.slice(0, 3).join(', ')}${failedStill > 3 ? '...' : ''}`;

            await this._sendNotificationToAllAdmins('RE_SYNC', sellerId, sellerName, reSyncMsg);

        } catch (error) {
            console.error(`🔄 Re-sync error for seller ${sellerId}:`, error.message);
            await SystemLogService.log({
                type: 'RE_SYNC_ERROR',
                entityType: 'SELLER',
                entityId: sellerId,
                entityTitle: sellerId,
                description: `Re-sync failed for seller ${sellerId}: ${error.message}`,
                metadata: { error: error.message, failedCodes }
            });
        }
    }

    // ============================================
    // Notify users about sync result
    // ============================================
    async _notifySyncResult(sellerId, stats) {
        try {
            let sellerName = sellerId;
            try {
                const pool = await getPool();
                const nameResult = await pool.request()
                    .input('id', sql.VarChar, sellerId)
                    .query('SELECT Name FROM Sellers WHERE Id = @id');
                if (nameResult.recordset.length > 0) {
                    sellerName = nameResult.recordset[0].Name;
                }
            } catch (e) { /* fallback */ }

            const message = stats.failedCount === 0
                ? `✅ Live sync completed for ${sellerName}. All ${stats.successCount} ASINs updated successfully.`
                : `⚠️ Live sync for ${sellerName}: ${stats.successCount} updated, ${stats.failedCount} failed. Re-sync scheduled in 30s for ${stats.failedCount} failed ASINs.`;

            await this._sendNotificationToAllAdmins('LIVE_SYNC', sellerId, sellerName, message);
        } catch (e) {
            console.error('Failed to send sync notification:', e.message);
        }
    }

    // ============================================
    // Helper: Send notification to all active users
    // ============================================
    async _sendNotificationToAllAdmins(type, referenceId, referenceTitle, message) {
        try {
            const pool = await getPool();
            const users = await pool.request().query('SELECT Id FROM Users WHERE IsActive = 1');
            
            for (const user of users.recordset) {
                await notificationController.createNotification(
                    user.Id,
                    type,
                    'Seller',
                    referenceId,
                    message
                );
            }
        } catch (e) {
            console.error('Failed to send admin notifications:', e.message);
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
