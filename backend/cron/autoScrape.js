const cron = require('node-cron');
const Asin = require('../models/Asin');
const DirectScraperService = require('../services/directScraperService');
const MarketDataSyncService = require('../services/marketDataSyncService');

class AutoScrapeScheduler {
    static init() {
        console.log('⏰ Initializing 24-Hour ASIN Auto-Scraper Cron Job...');
        
        // Run every hour at minute 0
        cron.schedule('0 * * * *', async () => {
            console.log('🔄 Running hourly check for ASINs needing scrape...');
            await this.runScrapeCycle();
        });
    }

    static async runScrapeCycle() {
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            // Find Active ASINs that haven't been scraped in the last 24 hours, or never scraped
            const asinsToScrape = await Asin.find({
                status: 'Active',
                $or: [
                    { lastScraped: null },
                    { lastScraped: { $lt: twentyFourHoursAgo } }
                ]
            });

            if (asinsToScrape.length === 0) {
                console.log('ℹ️ No ASINs require automatic scraping at this time.');
                return;
            }

            console.log(`🚀 Found ${asinsToScrape.length} ASIN(s) that need automatic scraping.`);

            // Process sequentially to be gentle on resources
            for (const asin of asinsToScrape) {
                try {
                    console.log(`🤖 Auto-scraping ASIN: ${asin.asin}`);
                    const scrapeResult = await DirectScraperService.scrapeProduct(asin.asin);
                    
                    if (scrapeResult && typeof scrapeResult === 'object') {
                        // Use MarketDataSyncService to process and store the result (updating weekHistory too)
                        await MarketDataSyncService.updateAsinMetrics(asin._id, scrapeResult);
                        console.log(`✅ Auto-scrape successful for ASIN: ${asin.asin}`);
                    } else {
                        console.warn(`⚠️ Auto-scrape failed or returned invalid data for ASIN: ${asin.asin}`);
                    }
                    
                    // Small delay to prevent rate-limiting between products
                    await new Promise(resolve => setTimeout(resolve, 3000));
                } catch (scrapeErr) {
                    console.error(`❌ Error auto-scraping ASIN ${asin.asin}:`, scrapeErr.message);
                }
            }
            console.log('🏁 Auto-scrape cycle completed.');
        } catch (error) {
            console.error('❌ Auto-scrape cycle failed:', error);
        }
    }
}

module.exports = AutoScrapeScheduler;
