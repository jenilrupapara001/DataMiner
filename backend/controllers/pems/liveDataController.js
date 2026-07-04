const { sql, getPool } = require('../../database/db');
const axios = require('axios');

const AVAILABLE_METRICS = [
    { key: 'price', label: 'Price' },
    { key: 'mrp', label: 'MRP / List Price' },
    { key: 'bsr', label: 'Main BSR' },
    { key: 'subBsr', label: 'Sub BSR' },
    { key: 'rating', label: 'Rating' },
    { key: 'reviewCount', label: 'Review Count' },
    { key: 'buyBoxWinner', label: 'BuyBox Winner' },
    { key: 'seller', label: 'Seller (BuyBox)' },
    { key: 'availability', label: 'Availability' },
    { key: 'title', label: 'Title' },
    { key: 'brand', label: 'Brand' },
    { key: 'category', label: 'Category' },
    { key: 'dealBadge', label: 'Deal Badge' },
];

function extractMetricValue(key, item) {
    const listing = item.offersV2?.listings?.find(l => l.isBuyBoxWinner)
                 || item.offersV2?.listings?.[0]
                 || item.buyBoxes?.find(b => b.isBuyBoxWinner)
                 || item.buyBoxes?.[0];
    switch (key) {
        case 'price': return listing?.price?.money?.amount || listing?.priceAmount || null;
        case 'mrp': return listing?.price?.savingBasis?.money?.amount || listing?.mrpAmount || null;
        case 'bsr': return item.browseNodeInfo?.websiteSalesRank?.salesRank || item.browseNodeInfo?.browseNodes?.[0]?.salesRank || null;
        case 'subBsr': {
            const rankings = item.rankings || [];
            if (rankings.length >= 2) {
                const match = rankings[1]?.match(/#([\d,]+)/);
                return match ? parseInt(match[1].replace(/,/g, '')) : null;
            }
            return item.browseNodeInfo?.browseNodes?.[1]?.salesRank || null;
        }
        case 'rating': return item.customerReviews?.starRating || null;
        case 'reviewCount': return item.customerReviews?.count || null;
        case 'buyBoxWinner': return listing?.isBuyBoxWinner ? 'Yes' : 'No';
        case 'seller': return listing?.merchantInfo?.name || listing?.seller || null;
        case 'availability': return listing?.availability?.message || listing?.availability?.status || item.stock?.status || null;
        case 'title': return item.itemInfo?.title?.displayValue || item.productName || null;
        case 'brand': return item.itemInfo?.byLineInfo?.brand?.displayValue || null;
        case 'category': {
            const nodes = item.browseNodeInfo?.browseNodes || [];
            return nodes.map(n => n.displayName || n.contextFreeName).filter(Boolean).join(' > ') || item.category || null;
        }
        case 'dealBadge': return listing?.dealDetails?.badge || listing?.dealDetails?.type || (item.deals?.[0]?.badge) || null;
        default: return null;
    }
}

exports.getMetrics = (req, res) => {
    res.json({ success: true, data: AVAILABLE_METRICS.map(m => ({ key: m.key, label: m.label })) });
};

exports.fetchLiveData = async (req, res) => {
    try {
        const { asins, metrics } = req.body;
        if (!asins || !Array.isArray(asins) || asins.length === 0)
            return res.status(400).json({ success: false, error: 'ASINs array required' });
        if (!metrics || !Array.isArray(metrics) || metrics.length === 0)
            return res.status(400).json({ success: false, error: 'Metrics array required' });
        if (asins.length > 100)
            return res.status(400).json({ success: false, error: 'Maximum 100 ASINs per request' });

        const selectedMetrics = metrics.filter(m => AVAILABLE_METRICS.some(am => am.key === m));
        if (selectedMetrics.length === 0)
            return res.status(400).json({ success: false, error: 'No valid metrics selected' });

        const asinList = asins.map(a => a.toUpperCase().trim());

        const asinController = require('../../controllers/asinController');

        const creds = {
            cid: process.env.LIVE_SYNC_CLIENT_ID,
            cs: process.env.LIVE_SYNC_CLIENT_SECRET,
            pt: process.env.LIVE_SYNC_PARTNER_TAG,
            mk: process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in',
        };
        if (!creds.cid || !creds.cs)
            return res.status(500).json({ success: false, error: 'Live Sync credentials not configured on server' });

        const tokenRes = await axios.post('https://api.amazon.co.uk/auth/o2/token', new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: creds.cid,
            client_secret: creds.cs,
            scope: 'creatorsapi::default',
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });
        const token = tokenRes.data.access_token;

        const BATCH_SIZE = 10;
        const results = [];
        const notFound = [];

        for (let i = 0; i < asinList.length; i += BATCH_SIZE) {
            const batch = asinList.slice(i, i + BATCH_SIZE);
            try {
                const apiRes = await axios.post(
                    'https://creatorsapi.amazon/catalog/v1/getItems',
                    {
                        itemIds: batch,
                        itemIdType: 'ASIN',
                        marketplace: creds.mk,
                        partnerTag: creds.pt,
                        resources: [
                            'itemInfo.title', 'itemInfo.byLineInfo',
                            'images.primary.large', 'images.variants.large',
                            'offersV2.listings.price', 'offersV2.listings.availability',
                            'offersV2.listings.merchantInfo', 'offersV2.listings.dealDetails',
                            'offersV2.listings.isBuyBoxWinner', 'offersV2.listings.condition',
                            'customerReviews.count', 'customerReviews.starRating',
                            'browseNodeInfo.browseNodes', 'browseNodeInfo.browseNodes.salesRank',
                            'browseNodeInfo.websiteSalesRank', 'parentASIN',
                        ],
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'x-marketplace': creds.mk,
                        },
                        timeout: 30000,
                    }
                );

                const items = apiRes.data?.itemsResult?.items || [];
                const apiErrors = apiRes.data?.errors || [];
                const errorMap = new Map();
                for (const err of apiErrors) {
                    let asin = err.asin || err.itemId || err.resourceId;
                    if (!asin && err.message) {
                        const match = err.message.match(/(?:ItemId|ASIN|Item)\s+(B[A-Z0-9]{9,})/i);
                        if (match) asin = match[1];
                    }
                    if (asin) errorMap.set(asin, err.message);
                }

                for (const asinCode of batch) {
                    const item = items.find(i => i.asin === asinCode);
                    if (!item) {
                        notFound.push({ asin: asinCode, reason: errorMap.get(asinCode) || 'Not returned by API' });
                        continue;
                    }
                    const row = { asin: asinCode, seller: extractMetricValue('seller', item) };
                    for (const key of selectedMetrics) {
                        row[key] = extractMetricValue(key, item);
                    }
                    results.push(row);
                }

                if (i + BATCH_SIZE < asinList.length) {
                    await new Promise(r => setTimeout(r, 1100));
                }
            } catch (batchErr) {
                console.error('Batch API error:', batchErr.message);
                for (const asinCode of batch) {
                    notFound.push({ asin: asinCode, reason: 'API request failed: ' + batchErr.message });
                }
            }
        }

        res.json({
            success: true,
            data: results,
            total: results.length,
            notFound: notFound.length > 0 ? notFound : undefined,
            metrics: selectedMetrics,
        });
    } catch (err) {
        console.error('Live data fetch error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};
