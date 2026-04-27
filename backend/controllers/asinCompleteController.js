const { sql, getPool } = require('../database/db');
const { isBuyBoxWinner } = require('../utils/buyBoxUtils');

/**
 * GET /api/asins/complete
 * Returns all ASIN fields in a flat structure optimized for datatables
 */
exports.getAsinsComplete = async (req, res) => {
    try {
        const {
            seller, status, category, brand, search,
            minPrice, maxPrice, minBSR, maxBSR, minLQS, maxLQS,
            page = 1, limit = 50, sortBy = 'CreatedAt', sortOrder = 'DESC'
        } = req.query;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        const pool = await getPool();
        const request = pool.request();
        let whereClause = 'WHERE 1=1';

        // Filters
        if (seller) {
            whereClause += ' AND a.SellerId = @seller';
            request.input('seller', sql.VarChar, seller);
        }
        if (status) {
            whereClause += ' AND a.Status = @status';
            request.input('status', sql.NVarChar, status);
        }
        if (category) {
            whereClause += ' AND a.Category = @category';
            request.input('category', sql.NVarChar, category);
        }
        if (brand) {
            whereClause += ' AND a.Brand = @brand';
            request.input('brand', sql.NVarChar, brand);
        }
        if (minPrice) {
            whereClause += ' AND a.CurrentPrice >= @minPrice';
            request.input('minPrice', sql.Decimal(18, 2), parseFloat(minPrice));
        }
        if (maxPrice) {
            whereClause += ' AND a.CurrentPrice <= @maxPrice';
            request.input('maxPrice', sql.Decimal(18, 2), parseFloat(maxPrice));
        }
        if (search) {
            whereClause += ' AND (a.AsinCode LIKE @search OR a.Title LIKE @search OR a.Sku LIKE @search)';
            request.input('search', sql.NVarChar, `%${search}%`);
        }

        // Count total
        const countResult = await request.query(`SELECT COUNT(*) as total FROM Asins a ${whereClause}`);
        const total = countResult.recordset[0].total;

        // Determine sort field
        const sortField = sortBy === 'asinCode' ? 'a.AsinCode' :
                          sortBy === 'currentPrice' ? 'a.CurrentPrice' :
                          sortBy === 'bsr' ? 'a.BSR' :
                          sortBy === 'lqs' ? 'a.LQS' :
                          sortBy === 'title' ? 'a.Title' : 'a.CreatedAt';

        // Fetch ASINs with ALL fields
        const asinsResult = await request
            .input('offset', sql.Int, offset)
            .input('limit', sql.Int, limitNum)
            .query(`
                SELECT a.*, s.Name as sellerName, s.Marketplace as sellerMarketplace
                FROM Asins a
                LEFT JOIN Sellers s ON a.SellerId = s.Id
                ${whereClause}
                ORDER BY ${sortField} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `);

        const asins = asinsResult.recordset.map(a => {
            // Parse JSON fields safely
            const lqsDetails = a.LqsDetails ? (() => { try { return JSON.parse(a.LqsDetails); } catch { return {}; } })() : {};
            const cdqComponents = a.CdqComponents ? (() => { try { return JSON.parse(a.CdqComponents); } catch { return {}; } })() : {};
            const feePreview = a.FeePreview ? (() => { try { return JSON.parse(a.FeePreview); } catch { return {}; } })() : {};
            const bulletPoints = a.BulletPoints ? (() => { try { return JSON.parse(a.BulletPoints); } catch { return []; } })() : [];
            const subBSRs = a.SubBSRs ? (() => { try { return JSON.parse(a.SubBSRs); } catch { return []; } })() : [];
            const images = a.Images ? (() => { try { return typeof a.Images === 'string' ? JSON.parse(a.Images) : a.Images; } catch { return []; } })() : [];

            return {
                // Core identifiers
                id: a.Id,
                asinCode: a.AsinCode,
                sku: a.Sku || '',

                // Product details
                title: a.Title || '',
                category: a.Category || '',
                brand: a.Brand || '',
                description: '', // Could be constructed from bulletPoints

                // Images & media
                imageUrl: a.ImageUrl || '',
                images: images,
                imagesCount: a.ImagesCount || 0,
                videoCount: a.VideoCount || 0,

                // Pricing
                currentPrice: a.CurrentPrice || 0,
                secondAsp: a.SecondAsp || null,
                aspDifference: a.AspDifference || 0,

                // Buy Box
                buyBoxStatus: a.BuyBoxStatus === 1 ? 'In Stock' : 'Out of Stock',
                buyBoxWin: a.BuyBoxWin === 1,
                buyBoxSellerId: a.BuyBoxSellerId || '',
                soldBy: a.SoldBy || '',
                soldBySec: a.SoldBySec || '',

                // Performance metrics
                bsr: a.BSR || 0,
                subBsr: a.SubBsr || '',
                subBSRs: subBSRs,
                rating: a.Rating || 0,
                reviewCount: a.ReviewCount || 0,
                lqs: a.LQS || 0,
                lqsDetails: lqsDetails,
                cdqComponents: cdqComponents,
                feePreview: feePreview,

                // Bullet points & A+
                bulletPoints: bulletPoints,
                bulletPointsText: a.BulletPointsText || '',
                hasAplus: a.HasAplus === 1,
                allOffers: a.AllOffers,

                // Stock & details
                stockLevel: a.StockLevel || 0,
                stapleLevel: a.StapleLevel || 'Regular',
                weight: a.Weight || 0,
                lossPerReturn: a.LossPerReturn || 0,

                // Status & scraping
                status: a.Status || '',
                scrapeStatus: a.ScrapeStatus || '',
                availabilityStatus: a.AvailabilityStatus || '',

                // Timestamps
                lastScrapedAt: a.LastScrapedAt ? new Date(a.LastScrapedAt) : null,
                aplusAbsentSince: a.AplusAbsentSince ? new Date(a.AplusAbsentSince) : null,
                aplusPresentSince: a.AplusPresentSince ? new Date(a.AplusPresentSince) : null,
                createdAt: a.CreatedAt ? new Date(a.CreatedAt) : null,
                updatedAt: a.UpdatedAt ? new Date(a.UpdatedAt) : null,

                // Seller relationship
                seller: {
                    id: a.SellerId,
                    name: a.sellerName || '',
                    marketplace: a.sellerMarketplace || ''
                }
            };
        });

        res.json({
            success: true,
            asins,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });

    } catch (error) {
        console.error('Get ASINs Complete Error:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
};
