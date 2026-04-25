const { sql, getPool, generateId } = require('../database/db');
const { calculateLQS } = require('../utils/lqs');

class AsinDataParser {
    /**
     * Parse raw tab-delimited Octoparse data into structured object
     */
    static parseRawData(rawText) {
        const lines = rawText.split('\n').filter(line => line.trim() !== '');
        const data = {};
        let currentKey = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Match key-value pattern: "key\t: \tvalue" or "key\t: value"
            const kvMatch = line.match(/^([^:\t]+)\t:\t?(.+)$/);
            if (kvMatch) {
                currentKey = kvMatch[1].trim();
                let value = kvMatch[2] ? kvMatch[2].trim() : '';
                
                // Handle continuation lines (next line without colon)
                while (i + 1 < lines.length && !lines[i + 1].includes('\t:')) {
                    i++;
                    value += ' ' + lines[i].trim();
                }
                
                data[currentKey] = value;
            }
        }

        return data;
    }

    /**
     * Extract ASIN from Amazon URL
     */
    static extractAsin(url) {
        if (!url) return null;
        const match = url.match(/\/dp\/([A-Z0-9]{10})/);
        return match ? match[1] : null;
    }

    /**
     * Parse price from Indian Rupee format
     * e.g., "₹1,599" -> 1599
     */
    static parsePrice(priceStr) {
        if (!priceStr) return 0;
        const cleaned = priceStr.toString().replace(/[^\d.]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }

    /**
     * Parse BSR from "#6 in Sarees" -> 6
     */
    static parseBSR(bsrStr) {
        if (!bsrStr) return null;
        const match = bsrStr.match(/#?(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Parse review count from "(89)" -> 89 or "89 reviews"
     */
    static parseReviewCount(str) {
        if (!str) return 0;
        const match = str.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Extract category path from HTML breadcrumbs
     * Returns: "Clothing & Accessories > Girls > Ethnic Wear > Sarees"
     */
    static parseCategory(html) {
        if (!html) return '';
        // Extract link texts between <a> tags
        const matches = html.match(/<a[^>]*>([^<]+)<\/a>/g);
        if (!matches) return '';
        return matches
            .map(a => a.replace(/<[^>]+>/g, '').trim())
            .filter(Boolean)
            .join(' > ');
    }

    /**
     * Extract main image URL from HTML
     */
    static parseMainImage(html) {
        if (!html) return '';
        const match = html.match(/src="([^"]+)"/);
        return match ? match[1] : '';
    }

    /**
     * Check if A+ content exists (non-empty HTML)
     */
    static hasAplus(html) {
        if (!html) return false;
        const textContent = html.replace(/<[^>]+>/g, '').trim();
        return textContent.length > 50;
    }

    /**
     * Extract bullet points from HTML list
     */
    static parseBulletPoints(html) {
        if (!html) return [];
        const matches = html.match(/<li[^>]*>([^<]+)<\/li>/g);
        if (!matches) return [];
        return matches.map(li => li.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
    }

    /**
     * Parse rating from "3.9" or similar
     */
    static parseRating(ratingStr) {
        const val = parseFloat(ratingStr);
        return isNaN(val) ? 0 : Math.min(Math.max(val, 0), 5);
    }

    /**
     * Parse Asp deal badge percentage
     */
    static parsePercentage(str) {
        if (!str) return 0;
        const match = str.match(/(-?\d+)%?/);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Parse availability status from raw text
     */
    static parseAvailabilityStatus(str) {
        if (!str) return 'Unknown';
        const lower = str.toLowerCase();
        if (lower.includes('in stock')) return 'In Stock';
        if (lower.includes('out of stock') || lower.includes('unavailable')) return 'Out of Stock';
        if (lower.includes('only')) return 'Limited';
        return 'Unknown';
    }

    /**
     * Transform raw Octoparse data into Asins table row
     */
    static transformToAsinRow(rawData, sellerId) {
        const parsed = this.parseRawData(rawData);
        const url = parsed.Original_URL || '';
        const asinCode = this.extractAsin(url);

        if (!asinCode) {
            throw new Error('Could not extract ASIN from Original_URL');
        }

        const now = new Date();

        // Core fields
        const title = parsed.Title || '';
        const category = this.parseCategory(parsed.category || '');
        const brand = (parsed.brand || '').split(' ')[0] || '';
        const mainImage = this.parseMainImage(parsed.Main_Image || '');
        const currentPrice = this.parsePrice(parsed.mrp || parsed.asp || 0);
        const bsr = this.parseBSR(parsed.BSR || '');
        const subBsr = this.parseBSR(parsed.sub_BSR || '');
        const rating = this.parseRating(parsed.avg_rating || 0);
        const reviewCount = this.parseReviewCount(parsed.review_count || '');
        const hasAplus = this.hasAplus(parsed.A_plus || '');
        
        // Bullet points
        const bulletPoints = this.parseBulletPoints(parsed.bp_all || '');
        const bulletPointsText = bulletPoints.join('\n• ');
        
        // Images
        const images = this.parseMainImage(parsed.image_count || '');
        const imagesCount = images.length > 0 ? 6 : 0; // Count from image html
        
        // Buy Box details
        const buyBoxStatus = this.parseAvailabilityStatus(parsed.unavilable || '');
        const buyBoxWin = parsed.buy_box_win || 0;
        const buyBoxSellerId = parsed.second_buybox ? parsed.second_buybox.match(/seller=([^&]+)/)?.[1] || '' : '';
        const soldBy = parsed.sold_by || '';
        
        // Deal badge
        const asp = this.parsePrice(parsed.asp);
        const secondAsp = this.parsePrice(parsed.second_asp);
        const aspDifference = asp > 0 && secondAsp > 0 ? asp - secondAsp : 0;
        
        // LQS calculation
        const lqs = Math.round(calculateLQS({
            titleLength: title.length,
            hasAplus,
            bulletCount: bulletPoints.length,
            imageCount: imagesCount,
            descriptionLength: 0,
            hasEbc: false,
            price: currentPrice,
            rating,
            reviews: reviewCount
        }));
        
        const lqsDetails = JSON.stringify({
            titleLength: title.length,
            hasAplus,
            bulletCount: bulletPoints.length,
            imageCount: imagesCount,
            descriptionLength: 0,
            hasEbc: false,
            price: currentPrice,
            rating,
            reviews: reviewCount
        });

        return {
            Id: generateId(),
            AsinCode: asinCode,
            SellerId: sellerId,
            Status: 'Active',
            ScrapeStatus: 'SCRAPED',
            Category: category.substring(0, 255),
            Brand: brand.substring(0, 255),
            Title: title,
            ImageUrl: mainImage,
            CurrentPrice: currentPrice,
            BSR: bsr,
            SubBsr: subBsr ? subBsr.toString() : null,
            SubBSRs: null,
            Rating: rating,
            ReviewCount: reviewCount,
            LQS: lqs,
            LqsDetails: lqsDetails,
            CdqComponents: null,
            FeePreview: null,
            BuyBoxStatus: buyBoxStatus === 'In Stock' ? 1 : 0,
            BuyBoxWin: buyBoxWin ? 1 : 0,
            BuyBoxSellerId: buyBoxSellerId,
            SoldBy: soldBy,
            HasAplus: hasAplus ? 1 : 0,
            StockLevel: 0,
            VideoCount: 0,
            Images: images,
            ImagesCount: imagesCount,
            BulletPoints: bulletPoints.length > 0 ? JSON.stringify(bulletPoints) : null,
            BulletPointsText: bulletPointsText,
            StapleLevel: 'Regular',
            Weight: 0,
            LossPerReturn: 0,
            SecondAsp: secondAsp > 0 ? secondAsp : null,
            SoldBySec: '',
            AspDifference: aspDifference,
            AvailabilityStatus: buyBoxStatus,
            AplusAbsentSince: null,
            AplusPresentSince: hasAplus ? now : null,
            AllOffers: null,
            Sku: '',
            LastScrapedAt: now,
            CreatedAt: now,
            UpdatedAt: now
        };
    }

    /**
     * Insert or update a single ASIN
     */
    static async upsertAsinFromRaw(rawData, sellerId) {
        const pool = await getPool();
        const row = this.transformToAsinRow(rawData, sellerId);

        // Build dynamic insert/update
        const columns = [];
        const updates = [];
        const values = [];
        let idx = 0;

        for (const [key, val] of Object.entries(row)) {
            if (val === undefined || val === null || val === '') {
                // Skip empty nullable fields for simplicity
                continue;
            }
            
            const paramName = `p_${idx++}`;
            columns.push(`[${key}]`);
            values.push(`@${paramName}`);

            if (val instanceof Date) {
                await pool.request().input(paramName, sql.DateTime2, val);
            } else if (typeof val === 'number') {
                if (Number.isInteger(val)) {
                    await pool.request().input(paramName, sql.Int, val);
                } else {
                    await pool.request().input(paramName, sql.Decimal(18, 4), val);
                }
            } else {
                await pool.request().input(paramName, sql.NVarChar, val.toString());
            }

            if (key !== 'Id') {
                updates.push(`[${key}] = @${paramName}`);
            }
        }

        const request = pool.request();
        const query = `
            MERGE INTO Asins AS target
            USING (SELECT @p_AsinCode AS AsinCode, @p_SellerId AS SellerId) AS source
            ON target.AsinCode = source.AsinCode AND target.SellerId = source.SellerId
            WHEN MATCHED THEN
                UPDATE SET ${updates.join(', ')}
            WHEN NOT MATCHED THEN
                INSERT (${columns.join(', ')})
                VALUES (${values.join(', ')});
        `;

        await request.query(query);
        return { asinCode: row.AsinCode, sellerId };
    }

    /**
     * Bulk upsert multiple ASINs
     */
    static async bulkUpsertAsins(rawDataArray, sellerId) {
        const results = [];
        for (const rawData of rawDataArray) {
            try {
                const result = await this.upsertAsinFromRaw(rawData, sellerId);
                results.push({ success: true, ...result });
            } catch (err) {
                results.push({ success: false, error: err.message });
            }
        }
        return results;
    }
}

module.exports = AsinDataParser;
