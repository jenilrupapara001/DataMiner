const axios = require('axios');
const xpath = require('xpath');
const { DOMParser } = require('xmldom');

/**
 * Service for direct web scraping of Amazon India.
 * Specifically handles amazon.in products using ASIN.
 */
class DirectScraperService {
    constructor() {
        this.userAgentList = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        ];
        console.log('🌐 Direct Scraper initialized (Simple mode)');
    }

    getRandomUserAgent() {
        return this.userAgentList[Math.floor(Math.random() * this.userAgentList.length)];
    }

    /**
     * Scrapes an Amazon India product page with retries.
     * @param {string} asin - The Amazon Product Identification Number.
     * @param {number} retries - Current retry attempt count.
     * @returns {Object} Extracted data.
     */
    async scrapeAsin(asin, retries = 0) {
        const url = `https://www.amazon.in/dp/${asin}`;
        const MAX_RETRIES = 3;

        try {
            console.log(`🌐 Scraping direct [Attempt ${retries + 1}]: ${url}`);

            const requestConfig = {
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Device-Memory': '8',
                    'Viewport-Width': '1920'
                },
                timeout: 15000 // Increased timeout
            };

            const response = await axios.get(url, requestConfig);

            if (response.status !== 200) {
                throw new Error(`Failed to fetch page: Status ${response.status}`);
            }

            const html = response.data;

            // Check for Amazon Captcha or blocking
            if (html.includes('api/services/captcha') || html.includes('Type the characters you see in this image')) {
                throw new Error(`Amazon CAPTCHA Challenge encountered`);
            }

            const doc = new DOMParser({
                errorHandler: {
                    warning: () => { },
                    error: () => { },
                    fatalError: (msg) => console.warn('Fatal DOM Error:', msg)
                }
            }).parseFromString(html);

            const select = xpath.useNamespaces({ "re": "http://exslt.org/regular-expressions" });

            // Helper to get text by xpath
            const getText = (path) => {
                const node = xpath.select(path, doc);
                if (node && node.length > 0) {
                    return node[0].textContent?.trim() || '';
                }
                return '';
            };

            // Helper to get attribute by xpath
            const getAttr = (path, attr) => {
                const node = xpath.select(path, doc);
                if (node && node.length > 0) {
                    return node[0].getAttribute(attr) || '';
                }
                return '';
            };

            // Basic validation - check if title exists. If not, page might have loaded incorrectly.
            let title = getText('//*[@id="productTitle"]') || getText('//*[@id="title"]') || getText('//h1[contains(@class, "a-size-large")]');
            if (!title) {
                console.warn(`[DirectScraper] Failed to parse product title for ${asin}. Using fallback title.`);
                title = `Amazon Product ${asin}`;
            }

            let ratingStr = getText('//*[@id="averageCustomerReviews"]')?.split('out of')[0]?.trim() || getText('//*[@id="acrPopover"]')?.split('out of')[0]?.trim();
            const reviewCountText = getText('//*[@id="acrCustomerReviewText"]');

            const descriptionText = getText('//*[@id="productDescription"]') || getText('//*[@id="productFactsDesktopExpander"]/div[1]/ul') || getText('//*[@id="feature-bullets"]/ul');

            // User provided XPaths
            const data = {
                asin: asin,
                title: title,
                rating: ratingStr,
                reviews: parseInt(reviewCountText.replace(/[^\d]/g, '')) || 0,
                price: getText('//*[@id="corePriceDisplay_desktop_feature_div"]/div[1]/span[3]') || getText('//*[@id="priceblock_ourprice"]'),
                mrp: getText('//*[@id="corePriceDisplay_desktop_feature_div"]/div[2]/span/span[1]/span[2]/span/span[1]'),
                bsr: getText('//span[contains(text(), "Best Sellers Rank")]/parent::*') || getText('//*[@id="SalesRank"]'), // Capture raw string
                subBSRs: [], // Initialize fresh array
                imageCount: xpath.select('//*[@id="altImages"]/ul/li', doc)?.length || 0,
                mainImage: getAttr('//*[@id="landingImage"]', 'src') || getAttr('//*[@id="imgBlkFront"]', 'src'),
                description: descriptionText,
                bulletPoints: xpath.select('//*[@id="feature-bullets"]/ul/li', doc)?.length || 0,
                hasAplus: xpath.select('//*[@id="aplus"]/div/div', doc)?.length > 0,
                category: getText('//*[@id="wayfinding-breadcrumbs_feature_div"]/ul/li[7]/span/a') || getText('//*[@id="wayfinding-breadcrumbs_feature_div"]/ul'),
                boughtLastMonth: getText('//*[@id="socialProofingAsinFaceout_feature_div"]/div/div'),
                soldBy: getText('//*[@id="merchantInfoFeature_feature_div"]/div[2]/div[1]/span'),
                scrapedAt: new Date().toISOString()
            };

            // Parse numeric values
            data.price = parseFloat(data.price?.replace(/[^\d.]/g, '')) || 0;
            data.rating = parseFloat(data.rating) || 0;

            // Extract BSR from complicated string "#1 in Beauty (See Top 100 in Beauty) #1 in Solid Soap Bars"
            if (data.bsr && typeof data.bsr === 'string') {
                const bsrText = data.bsr;
                
                // 1. Primary BSR - Look for "#rank in Category" (usually at the start)
                const primaryMatch = bsrText.match(/#([\d,]+)\s+in\s+([^(\n]+)/);
                if (primaryMatch) {
                    data.bsr = parseInt(primaryMatch[1].replace(/,/g, ''));
                } else {
                    // Fallback: try to just get the first number
                    const firstNumMatch = bsrText.match(/#([\d,]+)/);
                    if (firstNumMatch) {
                        data.bsr = parseInt(firstNumMatch[1].replace(/,/g, ''));
                    } else {
                        data.bsr = 0; // Truly not found
                    }
                }

                // 2. Sub-category BSRs - Usually in a <ul> or following the primary
                // Reset subBSRs to ensure we don't have duplicates from previous logic
                data.subBSRs = [];
                const allRankMatches = bsrText.matchAll(/#([\d,]+)\s+in\s+([^(\n]+)/g);
                let matchCount = 0;
                for (const match of allRankMatches) {
                    matchCount++;
                    // If the first match was actually the primary, skip it. 
                    // But if primaryMatch was null, then the first match might actually be a sub-BSR if we're not careful.
                    // However, in Amazon, the first one is consistently the primary.
                    if (matchCount > 1) { 
                        data.subBSRs.push(`${match[1]} in ${match[2].trim()}`);
                    }
                }
            } else if (typeof data.bsr === 'number') {
                // Already a number, nothing to parse
            } else {
                data.bsr = 0;
            }

            console.log(`✅ Scraped successfully: ${data.title.substring(0, 30)}...`);
            return data;
        } catch (error) {
            console.error(`⚠️ Direct Scrape Warning for ${asin}:`, error.message);
            if (retries < MAX_RETRIES) {
                const backoffDelay = (retries + 1) * 3000; // 3s, 6s, 9s backoff
                console.log(`⏳ Retrying ${asin} in ${backoffDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                return this.scrapeAsin(asin, retries + 1);
            } else {
                console.error(`❌ Direct Scrape FAILED for ${asin} after ${MAX_RETRIES} retries.`);
                throw error;
            }
        }
    }
}

module.exports = new DirectScraperService();
