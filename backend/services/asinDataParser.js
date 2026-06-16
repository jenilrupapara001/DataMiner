const { sql, getPool, generateId } = require('../database/db');
const { calculateLQS } = require('../utils/lqs');

class AsinDataParser {
    /**
     * Parse raw tab-delimited Octoparse data into a structured object.
     * 
     * @param {string|object} rawText - The raw tab-delimited string or a pre-parsed object.
     * @returns {object} The parsed key-value data.
     * @throws {TypeError} If rawText is neither a string nor a valid object.
     */
    static parseRawData(rawText) {
        if (!rawText) return {};
        if (typeof rawText !== 'string') {
            if (typeof rawText === 'object' && rawText !== null) {
                return rawText;
            }
            throw new TypeError(`AsinDataParser.parseRawData expected rawText to be a string or a pre-parsed object, but received ${typeof rawText}`);
        }
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
     * Extract ASIN from Amazon or Ajio URL
     */
    static extractAsin(url) {
        if (!url) return null;
        // Amazon dp
        const match = url.match(/\/dp\/([A-Z0-9]{10})/i);
        if (match) return match[1];
        // Ajio /p/
        const ajioMatch = url.match(/\/p\/([A-Za-z0-9_-]+)/i);
        if (ajioMatch) return ajioMatch[1];
        return null;
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
     * Derive prices (currentPrice, mrp) from raw input, auto-detecting and auto-correcting any fields.
     * 
     * @param {string|number} rawPrice - The raw price or ASP value.
     * @param {string|number} rawMrp - The raw MRP or list price.
     * @returns {object} An object containing parsed currentPrice and mrp.
     */
    static derivePricesFromRawData(rawPrice, rawMrp) {
        let currentPrice = 0;
        let mrp = 0;

        // If ASP field contains "MRP", it is actually the MRP!
        if (typeof rawPrice === 'string' && rawPrice.toUpperCase().includes('MRP')) {
            mrp = this.parsePrice(rawPrice);
            if (typeof rawMrp === 'string' && !rawMrp.toUpperCase().includes('MRP') && rawMrp.trim() !== '') {
                currentPrice = this.parsePrice(rawMrp);
            }
        } else {
            currentPrice = typeof rawPrice === 'number' ? rawPrice : this.parsePrice(rawPrice);
            mrp = typeof rawMrp === 'number' ? rawMrp : this.parsePrice(rawMrp);
        }

        // Apply fallback rules
        if (!currentPrice && mrp) {
            currentPrice = mrp;
        }
        if (!mrp && currentPrice) {
            mrp = currentPrice;
        }

        // Swap if currentPrice exceeds MRP (mrp must always be >= currentPrice)
        if (currentPrice > mrp) {
            const temp = mrp;
            mrp = currentPrice;
            currentPrice = temp;
        }

        return { currentPrice, mrp };
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
     * Check if A+ content exists (supports HTML strings, parsed JSON arrays/objects, or stringified JSON)
     */
    static hasAplus(html) {
        if (!html) return false;
        
        // Handle pre-parsed JSON objects or arrays
        if (typeof html === 'object') {
            if (Array.isArray(html)) return html.length > 0;
            return Object.keys(html).length > 0;
        }
        
        if (typeof html !== 'string') {
            html = String(html);
        }
        
        const trimmed = html.trim();
        
        // If it's a boolean-like string
        const lower = trimmed.toLowerCase();
        if (lower === 'true' || lower === 'yes' || lower === '1') return true;
        if (lower === 'false' || lower === 'no' || lower === '0') return false;

        // Handle stringified JSON arrays/objects
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed.length > 0;
                return Object.keys(parsed).length > 0;
            } catch (e) {}
        }

        // Handle standard HTML string
        const textContent = trimmed.replace(/<[^>]+>/g, '').trim();
        return textContent.length > 50 || trimmed.toLowerCase().includes('aplus-v2') || trimmed.toLowerCase().includes('aplus-module');
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
        const url = parsed.Original_URL || parsed.Page_URL || parsed.page_url || parsed.url || '';
        const asinCode = this.extractAsin(url);

        if (!asinCode) {
            throw new Error('Could not extract ASIN from Original_URL or Page_URL');
        }

        const now = new Date();

        // Core fields
        const title = (parsed.Title || parsed.title || '').trim();
        
        // Category node parsing for Ajio & Amazon
        let category = '';
        if (parsed.Category || parsed.category || parsed.category_node) {
            const rawCat = parsed.Category || parsed.category || parsed.category_node;
            category = rawCat.split(/[\n\r\/\\>]+/).map(s => s.trim()).filter(Boolean).join(' > ');
        } else {
            category = this.parseCategory(parsed.category || '');
        }

        const brand = (parsed['brand name'] || parsed.brand_name || parsed.brand || '').trim();
        
        // Images and images count extraction
        let mainImage = '';
        let imagesList = [];
        let imagesCount = 0;
        
        const rawImgField = parsed.Image_count || parsed.image_count || parsed.img_count || parsed.imgCount || '';
        if (rawImgField && typeof rawImgField === 'string') {
            const matches = rawImgField.match(/src=["']([^"']+)["']/g);
            if (matches) {
                imagesList = matches.map(m => m.replace(/src=["']|["']/g, '')).filter(src => src.includes('ajio.com') || src.includes('jiocdn.ajio.com') || src.includes('assets-jiocdn.ajio.com'));
                imagesCount = imagesList.length;
                if (imagesList.length > 0) {
                    mainImage = imagesList[0];
                }
            }
            if (imagesCount === 0) {
                const parsedNum = parseInt(rawImgField.replace(/[^\d]/g, ''));
                if (!isNaN(parsedNum)) {
                    imagesCount = parsedNum;
                }
            }
        } else {
            mainImage = this.parseMainImage(parsed.Main_Image || '');
            const parsedImages = this.parseMainImage(parsed.image_count || '');
            imagesCount = parsedImages.length > 0 ? 6 : 0;
            imagesList = parsedImages ? [parsedImages] : [];
        }

        const { currentPrice, mrp } = this.derivePricesFromRawData(
            parsed.ASP || parsed.asp || parsed.price || parsed.currentPrice || '',
            parsed.MRP || parsed.mrp || parsed.listPrice || ''
        );

        const rawOffPercent = parsed.off_percent || parsed.offPercent || parsed.discountPercentage || '';
        let discountPercentage = 0;
        if (rawOffPercent) {
            const match = rawOffPercent.toString().match(/(\d+)/);
            discountPercentage = match ? parseInt(match[1]) : 0;
        }
        if (!discountPercentage && mrp > currentPrice && mrp > 0) {
            discountPercentage = Math.round(((mrp - currentPrice) / mrp) * 100);
        }

        const bsr = this.parseBSR(parsed.BSR || '');
        const subBsr = this.parseBSR(parsed.sub_BSR || '');
        
        // Rating and review count extraction
        const rawRating = parsed.Rating || parsed.rating || parsed.avg_rating || '';
        const rating = this.parseRating(rawRating);

        const rawReviews = parsed['review count'] || parsed.Review_count || parsed.review_count || parsed.ReviewCount || '';
        const reviewCount = this.parseReviewCount(rawReviews);

        const rawAplus = parsed.A_plus || parsed.aplus || parsed.aplus_content || parsed.has_aplus || parsed.hasAplus || '';
        const hasAplus = this.hasAplus(rawAplus);
        
        // Bullet points
        const bulletPoints = this.parseBulletPoints(parsed.bp_all || '');
        const bulletPointsText = bulletPoints.join('\n• ');
        
        // Buy Box details & Availability Status (Exact Button Text)
        const buttonText = (parsed.Button_text || parsed.button_text || parsed.biutton_text || parsed.unavilable || '').trim();
        const buyBoxStatus = buttonText || 'Unknown';

        const buyBoxWin = parsed.buy_box_win || 0;
        const buyBoxSellerId = parsed.second_buybox ? parsed.second_buybox.match(/seller=([^&]+)/)?.[1] || '' : '';
        const soldBy = parsed.sold_by || '';
        
        // Deal badge / MRP
        const secondAsp = mrp || this.parsePrice(parsed.second_asp || parsed.SecondAsp);
        const aspDifference = currentPrice > 0 && secondAsp > 0 ? Math.abs(currentPrice - secondAsp) : 0;
        
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
            DiscountPercentage: discountPercentage,
            BSR: bsr,
            SubBsr: subBsr ? subBsr.toString() : null,
            SubBSRs: null,
            Rating: rating,
            ReviewCount: reviewCount,
            LQS: lqs,
            LqsDetails: lqsDetails,
            CdqComponents: null,
            FeePreview: null,
            BuyBoxStatus: buyBoxStatus.toLowerCase().includes('add to bag') || buyBoxStatus.toLowerCase().includes('add to cart') || buyBoxStatus.toLowerCase().includes('in stock') ? 1 : 0,
            BuyBoxWin: buyBoxWin ? 1 : 0,
            BuyBoxSellerId: buyBoxSellerId,
            SoldBy: soldBy,
            HasAplus: hasAplus ? 1 : 0,
            StockLevel: 0,
            VideoCount: 0,
            Images: JSON.stringify(imagesList),
            ImagesCount: imagesCount,
            BulletPoints: bulletPoints.length > 0 ? JSON.stringify(bulletPoints) : null,
            BulletPointsText: bulletPointsText,
            StapleLevel: 'Regular',
            Weight: 0,
            LossPerReturn: 0,
            Mrp: mrp > 0 ? mrp : null,
            SecondAsp: mrp > 0 ? mrp : null,
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

        const request = pool.request();
        const columns = [];
        const updates = [];
        const values = [];
        let idx = 0;

        for (const [key, val] of Object.entries(row)) {
            if (val === undefined || val === null || val === '') continue;
            
            const paramName = `p_${idx++}`;
            columns.push(`[${key}]`);
            values.push(`@${paramName}`);

            // Special handling for AsinCode and SellerId for the MERGE ON clause
            if (key === 'AsinCode') request.input('targetAsinCode', sql.VarChar, val);
            if (key === 'SellerId') request.input('targetSellerId', sql.VarChar, val);

            if (val instanceof Date) {
                request.input(paramName, sql.DateTime2, val);
            } else if (typeof val === 'number') {
                if (Number.isInteger(val)) {
                    request.input(paramName, sql.Int, val);
                } else {
                    request.input(paramName, sql.Decimal(18, 4), val);
                }
            } else {
                request.input(paramName, sql.NVarChar, val.toString());
            }

            if (key !== 'Id') {
                updates.push(`[${key}] = @${paramName}`);
            }
        }

        const query = `
            MERGE INTO Asins AS target
            USING (SELECT @targetAsinCode AS AsinCode, @targetSellerId AS SellerId) AS source
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
