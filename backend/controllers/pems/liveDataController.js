const { sql, getPool } = require('../../database/db');
const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/live-data');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// In-memory job store for batch processing
const jobs = new Map();

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1100;

const API_RESOURCES = [
    'itemInfo.title', 'itemInfo.byLineInfo',
    'images.primary.large', 'images.variants.large',
    'offersV2.listings.price', 'offersV2.listings.availability',
    'offersV2.listings.merchantInfo', 'offersV2.listings.dealDetails',
    'offersV2.listings.isBuyBoxWinner', 'offersV2.listings.condition',
    'customerReviews.count', 'customerReviews.starRating',
    'browseNodeInfo.browseNodes', 'browseNodeInfo.browseNodes.salesRank',
    'browseNodeInfo.websiteSalesRank', 'parentASIN',
];

function getCreds() {
    return {
        cid: process.env.LIVE_SYNC_CLIENT_ID,
        cs: process.env.LIVE_SYNC_CLIENT_SECRET,
        pt: process.env.LIVE_SYNC_PARTNER_TAG,
        mk: process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in',
    };
}

async function getToken(creds) {
    const r = await axios.post('https://api.amazon.co.uk/auth/o2/token', new URLSearchParams({
        grant_type: 'client_credentials', client_id: creds.cid,
        client_secret: creds.cs, scope: 'creatorsapi::default',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });
    return r.data.access_token;
}

async function callCreatorsAPI(token, batch, creds) {
    const r = await axios.post('https://creatorsapi.amazon/catalog/v1/getItems', {
        itemIds: batch, itemIdType: 'ASIN', marketplace: creds.mk,
        partnerTag: creds.pt, resources: API_RESOURCES,
    }, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'x-marketplace': creds.mk },
        timeout: 30000,
    });
    return r.data;
}

function parseApiErrors(apiErrors) {
    const map = new Map();
    for (const err of apiErrors) {
        let asin = err.asin || err.itemId || err.resourceId;
        if (!asin && err.message) {
            const m = err.message.match(/(?:ItemId|ASIN|Item)\s+(B[A-Z0-9]{9,})/i);
            if (m) asin = m[1];
        }
        if (asin) map.set(asin, err.message);
    }
    return map;
}

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

/**
 * POST /api/live-data/upload
 * Upload CSV/Excel file with ASINs, starts background batch processing
 */
exports.uploadAndProcess = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

        const metrics = req.body.metrics ? (typeof req.body.metrics === 'string' ? JSON.parse(req.body.metrics) : req.body.metrics) : [];
        const selectedMetrics = metrics.filter(m => AVAILABLE_METRICS.some(am => am.key === m));
        if (selectedMetrics.length === 0) return res.status(400).json({ success: false, error: 'No valid metrics selected' });

        // Parse ASINs from file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const asinSet = new Set();
        for (const row of rows) {
            for (const key of Object.keys(row)) {
                const val = String(row[key] || '').trim().toUpperCase();
                if (/^B[A-Z0-9]{9,}$/.test(val)) asinSet.add(val);
            }
        }

        const asinList = [...asinSet];
        if (asinList.length === 0) return res.status(400).json({ success: false, error: 'No valid ASINs found in file. Expected format: columns containing B0XXXXXXXX ASINs.' });
        if (asinList.length > 50000) return res.status(400).json({ success: false, error: 'Maximum 50,000 ASINs per upload' });

        const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const job = {
            id: jobId,
            status: 'processing',
            totalAsins: asinList.length,
            processed: 0,
            found: 0,
            notFound: 0,
            failed: 0,
            metrics: selectedMetrics,
            results: [],
            notFoundList: [],
            startedAt: new Date().toISOString(),
            completedAt: null,
            error: null,
        };
        jobs.set(jobId, job);

        // Start background processing (don't await)
        processJob(jobId, asinList, selectedMetrics).catch(err => {
            console.error(`Job ${jobId} failed:`, err.message);
            job.status = 'failed';
            job.error = err.message;
            job.completedAt = new Date().toISOString();
        });

        res.json({ success: true, jobId, totalAsins: asinList.length, estimatedMinutes: Math.ceil((asinList.length / BATCH_SIZE) * BATCH_DELAY_MS / 60000) });
    } catch (err) {
        console.error('Upload error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

/**
 * GET /api/live-data/progress/:jobId
 * Get processing progress for a batch job
 */
exports.getProgress = (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({
        success: true,
        data: {
            id: job.id,
            status: job.status,
            totalAsins: job.totalAsins,
            processed: job.processed,
            found: job.found,
            notFound: job.notFound,
            failed: job.failed,
            percent: job.totalAsins > 0 ? Math.round((job.processed / job.totalAsins) * 100) : 0,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            error: job.error,
        }
    });
};

/**
 * GET /api/live-data/results/:jobId
 * Get results for a completed job
 */
exports.getResults = (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({
        success: true,
        data: job.results,
        notFound: job.notFoundList.length > 0 ? job.notFoundList : undefined,
        metrics: job.metrics,
        total: job.results.length,
    });
};

/**
 * GET /api/live-data/download/:jobId
 * Download results as XLSX file
 */
exports.downloadResults = (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    if (job.status !== 'completed') return res.status(400).json({ success: false, error: 'Job not completed yet' });
    if (job.results.length === 0) return res.status(400).json({ success: false, error: 'No results to download' });

    const ws = XLSX.utils.json_to_sheet(job.results);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Live Data');

    if (job.notFoundList.length > 0) {
        const nfWs = XLSX.utils.json_to_sheet(job.notFoundList);
        XLSX.utils.book_append_sheet(wb, nfWs, 'Not Found');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `live_data_${jobId_safe(job.id)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
};

/**
 * POST /api/live-data/cancel/:jobId
 * Cancel a running job
 */
exports.cancelJob = (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    job.status = 'cancelled';
    res.json({ success: true });
};

// ── Background job processor ──────────────────────────────────────────
async function processJob(jobId, asinList, selectedMetrics) {
    const job = jobs.get(jobId);
    const creds = getCreds();
    if (!creds.cid || !creds.cs) throw new Error('Live Sync credentials not configured');

    const token = await getToken(creds);
    let tokenExpiry = Date.now() + 3600000;

    for (let i = 0; i < asinList.length; i += BATCH_SIZE) {
        if (job.status === 'cancelled') break;

        const batch = asinList.slice(i, i + BATCH_SIZE);

        // Refresh token if needed
        if (Date.now() > tokenExpiry - 60000) {
            try { token = await getToken(creds); tokenExpiry = Date.now() + 3600000; } catch (e) { console.error('Token refresh failed:', e.message); }
        }

        try {
            const apiData = await callCreatorsAPI(token, batch, creds);
            const items = apiData?.itemsResult?.items || [];
            const errorMap = parseApiErrors(apiData?.errors || []);

            for (const asinCode of batch) {
                if (job.status === 'cancelled') break;
                const item = items.find(it => it.asin === asinCode);
                if (!item) {
                    job.notFoundList.push({ asin: asinCode, reason: errorMap.get(asinCode) || 'Not returned by API' });
                    job.notFound++;
                } else {
                    const row = { asin: asinCode, seller: extractMetricValue('seller', item) };
                    for (const key of selectedMetrics) {
                        row[key] = extractMetricValue(key, item);
                    }
                    job.results.push(row);
                    job.found++;
                }
                job.processed++;
            }
        } catch (batchErr) {
            // Rate limit hit — refresh token and retry once
            if (batchErr.response?.status === 429 || batchErr.response?.status === 401) {
                try {
                    token = await getToken(creds);
                    tokenExpiry = Date.now() + 3600000;
                    const apiData = await callCreatorsAPI(token, batch, creds);
                    const items = apiData?.itemsResult?.items || [];
                    const errorMap = parseApiErrors(apiData?.errors || []);
                    for (const asinCode of batch) {
                        const item = items.find(it => it.asin === asinCode);
                        if (!item) { job.notFoundList.push({ asin: asinCode, reason: 'Not found after retry' }); job.notFound++; }
                        else {
                            const row = { asin: asinCode, seller: extractMetricValue('seller', item) };
                            for (const key of selectedMetrics) row[key] = extractMetricValue(key, item);
                            job.results.push(row); job.found++;
                        }
                        job.processed++;
                    }
                } catch (retryErr) {
                    for (const asinCode of batch) { job.notFoundList.push({ asin: asinCode, reason: 'API error after retry' }); job.notFound++; job.processed++; }
                }
            } else {
                for (const asinCode of batch) { job.notFoundList.push({ asin: asinCode, reason: 'API error: ' + batchErr.message }); job.notFound++; job.processed++; }
            }
        }

        // Delay between batches
        if (i + BATCH_SIZE < asinList.length && job.status !== 'cancelled') {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
    }

    if (job.status !== 'cancelled') {
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
    }
}

function jobId_safe(id) { return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40); }

// Cleanup old jobs every 30 minutes
setInterval(() => {
    const cutoff = Date.now() - 3600000;
    for (const [id, job] of jobs) {
        if (job.completedAt && new Date(job.completedAt).getTime() < cutoff) jobs.delete(id);
    }
}, 1800000);
