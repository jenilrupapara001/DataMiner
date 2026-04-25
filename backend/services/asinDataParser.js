const { sql, getPool, generateId } = require('../database/db');
const { calculateLQS } = require('../utils/lqs');

/**
 * Octoparse ASIN Data Parser and Storage Service
 * Handles raw scraped data from Octoparse and stores in SQL Asins table
 */
class AsinDataParser {
    /**
     * Parse raw tab-delimited Octoparse data into structured object
     * Input format: "field_name\t: \tvalue" or multiline fields
     */
    static parseRawData(rawText) {
        const lines = rawText.split('\n').filter(line => line.trim() !== '');
        const data = {};
        let currentKey = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Skip HTML content blocks (A_plus, category breadcrumbs, image_count)
            if (line.startsWith('<') && !line.startsWith('<li')) {
                // Skip pure HTML lines except list items
                continue;
            }

            // Match key-value pattern: "key\t: \tvalue"
            const kvMatch = line.match(/^([^:\t]+)\t:\t(.+)$/);
            if (kvMatch) {
                currentKey = kvMatch[1].trim();
                let value = kvMatch[2].trim();

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
        if (!bsrStr) return 0;
        const match = bsrStr.match(/#(\d+)/);
        return match ? parseInt(match[1]) : 0;
    }

    /**
     * Parse review count from "(89)" -> 89
     */
    static parseReviewCount(str) {
        if (!str) return 0;
        const match = str.match(/\((\d+)\)/);
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
        // Check for meaningful A+ content (exclude just whitespace or minimal tags)
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
     * Calculate LQS from available data
     * (Placeholder - you can enhance with actual LQS formula)
     */
    static calculateLQSFromData(data) {
        // Basic LQS calculation based on title length, image count, description, A+ content
        const hasAplus = this.hasAplus(data.A_plus || '');
        const bulletCount = this.parseBulletPoints(data.bp_all || '').length;
        const titleLen = (data.Title || '').length;
        const price = this.parsePrice(data.mrp || data.asp);

        let score = 50; // base
        if (hasAplus) score += 20;
        if (bulletCount >= 5) score += 15;
        if (titleLen >= 100) score += 10;
        if (titleLen >= 150) score += 5;
        if (price > 0) score += 10;

        return Math.min(score, 100);
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

        const title = parsed.Title || '';
        const category = this.parseCategory(parsed.category || '');
        const brand = title.split(' ')[0] || ''; // simple: first word
        const mainImage = this.parseMainImage(parsed.Main_Image || '');
        const currentPrice = this.parsePrice(parsed.mrp || parsed.asp || 0);
        const bsr = this.parseBSR(parsed.BSR || '');
        const rating = this.parseRating(parsed.avg_rating || 0);
        const reviewCount = this.parseReviewCount(parsed.review_count || '');
        const hasAplus = this.hasAplus(parsed.A_plus || '');

        // Bullet points
        const bulletPoints = this.parseBulletPoints(parsed.bp_all || '');
        const bulletPointsText = bulletPoints.join('\n• ');

        // LQS calculation
        const lqs = Math.round(this.calculateLQSFromData(parsed));

        // LqsDetails JSON
        const lqsDetails = JSON.stringify({
            titleLength: title.length,
            hasAplus,
            bulletCount: bulletPoints.length,
            imageCount: 0, // placeholder
            descriptionLength: 0, // placeholder
            hasEbc: false,
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
            Rating: rating,
            ReviewCount: reviewCount,
            LQS: lqs,
            LqsDetails: lqsDetails,
            CdqComponents: null,
            FeePreview: null,
            BuyBoxStatus: 1, // Assume winner if data present
            LastScrapedAt: new Date(),
            CreatedAt: new Date(),
            UpdatedAt: new Date()
        };
    }

    /**
     * Insert or update a single ASIN from raw data
     */
    static async upsertAsinFromRaw(rawData, sellerId) {
        const pool = await getPool();
        const row = this.transformToAsinRow(rawData, sellerId);

        // Use MERGE to insert or update
        await pool.request()
            .input('Id', sql.VarChar, row.Id)
            .input('AsinCode', sql.VarChar, row.AsinCode)
            .input('SellerId', sql.VarChar, row.SellerId)
            .input('Status', sql.NVarChar, row.Status)
            .input('ScrapeStatus', sql.NVarChar, row.ScrapeStatus)
            .input('Category', sql.NVarChar, row.Category)
            .input('Brand', sql.NVarChar, row.Brand)
            .input('Title', sql.NVarChar, row.Title)
            .input('ImageUrl', sql.NVarChar, row.ImageUrl)
            .input('CurrentPrice', sql.Decimal(18, 2), row.CurrentPrice)
            .input('BSR', sql.Int, row.BSR)
            .input('Rating', sql.Decimal(3, 2), row.Rating)
            .input('ReviewCount', sql.Int, row.ReviewCount)
            .input('LQS', sql.Decimal(5, 2), row.LQS)
            .input('LqsDetails', sql.NVarChar, row.LqsDetails)
            .input('CdqComponents', sql.NVarChar, row.CdqComponents)
            .input('FeePreview', sql.NVarChar, row.FeePreview)
            .input('BuyBoxStatus', sql.Bit, row.BuyBoxStatus)
            .input('LastScrapedAt', sql.DateTime2, row.LastScrapedAt)
            .query(`
                MERGE INTO Asins AS target
                USING (SELECT @AsinCode AS AsinCode, @SellerId AS SellerId) AS source
                ON target.AsinCode = source.AsinCode AND target.SellerId = source.SellerId
                WHEN MATCHED THEN
                    UPDATE SET
                        Status = @Status,
                        ScrapeStatus = @ScrapeStatus,
                        Category = @Category,
                        Brand = @Brand,
                        Title = @Title,
                        ImageUrl = @ImageUrl,
                        CurrentPrice = @CurrentPrice,
                        BSR = @BSR,
                        Rating = @Rating,
                        ReviewCount = @ReviewCount,
                        LQS = @LQS,
                        LqsDetails = @LqsDetails,
                        CdqComponents = @CdqComponents,
                        FeePreview = @FeePreview,
                        BuyBoxStatus = @BuyBoxStatus,
                        LastScrapedAt = @LastScrapedAt,
                        UpdatedAt = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (Id, AsinCode, SellerId, Status, ScrapeStatus, Category, Brand, Title, ImageUrl,
                            CurrentPrice, BSR, Rating, ReviewCount, LQS, LqsDetails, CdqComponents, FeePreview,
                            BuyBoxStatus, LastScrapedAt, CreatedAt, UpdatedAt)
                    VALUES (@Id, @AsinCode, @SellerId, @Status, @ScrapeStatus, @Category, @Brand, @Title, @ImageUrl,
                            @CurrentPrice, @BSR, @Rating, @ReviewCount, @LQS, @LqsDetails, @CdqComponents, @FeePreview,
                            @BuyBoxStatus, @LastScrapedAt, @CreatedAt, GETDATE());
            `);

        return { asinCode: row.AsinCode, sellerId, lqs: row.LQS };
    }

    /**
     * Bulk insert multiple ASINs from raw data array
     */
    static async bulkUpsertAsins(rawDataArray, sellerId) {
        const pool = await getPool();
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
