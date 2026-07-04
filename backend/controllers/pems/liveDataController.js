const { sql, getPool } = require('../../database/db');
const axios = require('axios');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const SystemLogService = require('../../services/SystemLogService');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/live-data');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Redis-backed job store (works across PM2 cluster workers)
let redis = null;
async function getRedis() {
    if (redis && redis.status === 'ready') return redis;
    try {
        const Redis = require('ioredis');
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: 3, retryStrategy: (times) => Math.min(times * 100, 3000),
            lazyConnect: true, connectTimeout: 3000,
        });
        redis.on('error', () => { redis = null; });
        await redis.connect();
        return redis;
    } catch { redis = null; return null; }
}

const JOB_PREFIX = 'ldi:job:';
const JOB_RESULTS_PREFIX = 'ldi:results:';
const JOB_TTL = 7200; // 2 hours

async function saveJob(job) {
    const r = await getRedis();
    const { results, notFoundList, ...meta } = job;
    if (r) {
        await r.setex(JOB_PREFIX + job.id, JOB_TTL, JSON.stringify(meta));
        if (results && results.length > 0) {
            await r.setex(JOB_RESULTS_PREFIX + job.id + ':data', JOB_TTL, JSON.stringify(results));
        }
        if (notFoundList && notFoundList.length > 0) {
            await r.setex(JOB_RESULTS_PREFIX + job.id + ':nf', JOB_TTL, JSON.stringify(notFoundList));
        }
    } else {
        // Fallback to file-based storage
        fs.writeFileSync(path.join(UPLOADS_DIR, job.id + '.json'), JSON.stringify({ meta, results, notFoundList }));
    }
}

async function loadJob(jobId) {
    const r = await getRedis();
    if (r) {
        const metaStr = await r.get(JOB_PREFIX + jobId);
        if (!metaStr) return null;
        const meta = JSON.parse(metaStr);
        const dataStr = await r.get(JOB_RESULTS_PREFIX + jobId + ':data');
        const nfStr = await r.get(JOB_RESULTS_PREFIX + jobId + ':nf');
        return { ...meta, results: dataStr ? JSON.parse(dataStr) : [], notFoundList: nfStr ? JSON.parse(nfStr) : [] };
    } else {
        const filePath = path.join(UPLOADS_DIR, jobId + '.json');
        if (!fs.existsSync(filePath)) return null;
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return { ...data.meta, results: data.results || [], notFoundList: data.notFoundList || [] };
    }
}

async function deleteJob(jobId) {
    const r = await getRedis();
    if (r) {
        await r.del(JOB_PREFIX + jobId, JOB_RESULTS_PREFIX + jobId + ':data', JOB_RESULTS_PREFIX + jobId + ':nf');
    } else {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, jobId + '.json')); } catch { }
    }
}

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

const CreatorsApiCredentials = require('../../services/creatorsApiCredentials');
const TOKEN_CACHE = new Map(); // credId -> { token, expiry }

function getCreds() {
    return {
        pt: process.env.LIVE_SYNC_PARTNER_TAG,
        mk: process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in',
    };
}

async function getToken(credId) {
    const cred = credId
        ? CreatorsApiCredentials.credentials.find(c => c.id === credId) || CreatorsApiCredentials.get()
        : CreatorsApiCredentials.get();
    const cacheKey = cred.id;
    const cached = TOKEN_CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.token;

    const r = await axios.post('https://api.amazon.co.uk/auth/o2/token', new URLSearchParams({
        grant_type: 'client_credentials', client_id: cred.clientId,
        client_secret: cred.clientSecret, scope: 'creatorsapi::default',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 });

    const token = r.data.access_token;
    TOKEN_CACHE.set(cacheKey, { token, expiry: Date.now() + (r.data.expires_in * 1000) - 120000 });
    CreatorsApiCredentials.markSuccess(cred);
    return token;
}

async function callCreatorsAPI(token, batch, creds) {
    const cred = CreatorsApiCredentials.get();
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

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || 'unknown';
}

async function logActivity(type, description, metadata = {}) {
    try {
        await SystemLogService.log({
            type,
            entityType: 'LIVE_DATA_INSPECTOR',
            entityId: String(metadata.jobId || metadata.asinCount || 'N/A'),
            entityTitle: description,
            user: metadata.userId || null,
            description,
            metadata: { ...metadata, source: 'live-data-inspector' },
        });
    } catch (e) { /* don't block on log failure */ }
}

exports.getMetrics = (req, res) => {
    res.json({ success: true, data: AVAILABLE_METRICS.map(m => ({ key: m.key, label: m.label })) });
};

exports.fetchLiveData = async (req, res) => {
    try {
        const { asins, metrics, credId } = req.body;
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
        const targetCredId = credId || null;

        if (CreatorsApiCredentials.count === 0)
            return res.status(500).json({ success: false, error: 'Live Sync credentials not configured on server' });

        const creds = getCreds();
        const token = await getToken(targetCredId);

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
                        resources: API_RESOURCES,
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

        logActivity('LIVE_DATA_FETCH', `Fetched ${results.length} ASINs (${notFound.length} not found) — metrics: ${selectedMetrics.join(', ')}`, {
            ip: getClientIp(req), asinCount: asins.length, foundCount: results.length,
            notFoundCount: notFound.length, metrics: selectedMetrics,
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
        if (asinList.length === 0) return res.status(400).json({ success: false, error: 'No valid ASINs found in file.' });
        if (asinList.length > 50000) return res.status(400).json({ success: false, error: 'Maximum 50,000 ASINs per upload' });

        const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const job = {
            id: jobId, status: 'processing', totalAsins: asinList.length,
            processed: 0, found: 0, notFound: 0, failed: 0,
            metrics: selectedMetrics, results: [], notFoundList: [],
            startedAt: new Date().toISOString(), completedAt: null, error: null,
        };
        await saveJob(job);

        processJob(jobId, asinList, selectedMetrics, req.body._credId || req.body.credId || null).catch(async (err) => {
            console.error(`Job ${jobId} failed:`, err.message);
            const j = await loadJob(jobId);
            if (j) { j.status = 'failed'; j.error = err.message; j.completedAt = new Date().toISOString(); await saveJob(j); }
        });

        res.json({ success: true, jobId, totalAsins: asinList.length, estimatedMinutes: Math.ceil((asinList.length / BATCH_SIZE) * BATCH_DELAY_MS / 60000) });

        logActivity('LIVE_DATA_UPLOAD', `File upload: ${asinList.length} ASINs from ${req.file.originalname} — metrics: ${selectedMetrics.join(', ')}`, {
            ip: getClientIp(req), jobId, asinCount: asinList.length,
            fileName: req.file.originalname, fileSize: req.file.size, metrics: selectedMetrics,
        });
    } catch (err) {
        console.error('Upload error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
};

exports.getProgress = async (req, res) => {
    const job = await loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({
        success: true,
        data: {
            id: job.id, status: job.status, totalAsins: job.totalAsins,
            processed: job.processed, found: job.found, notFound: job.notFound, failed: job.failed,
            percent: job.totalAsins > 0 ? Math.round((job.processed / job.totalAsins) * 100) : 0,
            startedAt: job.startedAt, completedAt: job.completedAt, error: job.error,
        }
    });
};

exports.getResults = async (req, res) => {
    const job = await loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, data: job.results, notFound: job.notFoundList.length > 0 ? job.notFoundList : undefined, metrics: job.metrics, total: job.results.length });
};

exports.downloadResults = async (req, res) => {
    const job = await loadJob(req.params.jobId);
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

    logActivity('LIVE_DATA_DOWNLOAD', `Downloaded XLSX: ${job.results.length} ASINs from job ${job.id}`, {
        ip: getClientIp(req), jobId: job.id, resultCount: job.results.length,
        notFoundCount: job.notFoundList.length,
    });
};

exports.cancelJob = async (req, res) => {
    const job = await loadJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    job.status = 'cancelled';
    await saveJob(job);
    res.json({ success: true });

    logActivity('LIVE_DATA_CANCEL', `Cancelled job ${job.id} at ${job.processed}/${job.totalAsins} ASINs`, {
        ip: getClientIp(req), jobId: job.id, processed: job.processed, total: job.totalAsins,
    });
};

// ── Background job processor (bulletproof — never lose accessible ASINs) ──
const MAX_BATCH_RETRIES = 5;
const RETRY_DELAYS = [3000, 8000, 20000, 40000, 80000]; // exponential backoff per retry
const BASE_BATCH_DELAY = 1500; // 1.5s between batches
const RATE_LIMIT_DELAY = 30000; // 30s on 429
const STALE_DELAY = 5000; // 5s after any error before next batch

async function processJob(jobId, asinList, selectedMetrics, credId) {
    if (CreatorsApiCredentials.count === 0) throw new Error('Live Sync credentials not configured');

    const creds = getCreds();
    let token = await getToken(credId);
    let tokenExpiry = Date.now() + 3600000;
    let results = [];
    let notFoundList = [];
    let processed = 0, found = 0, notFound = 0;
    let consecutiveErrors = 0;

    for (let i = 0; i < asinList.length; i += BATCH_SIZE) {
        const job = await loadJob(jobId);
        if (!job || job.status === 'cancelled') break;

        const batch = asinList.slice(i, i + BATCH_SIZE);
        let batchSucceeded = false;

        // Refresh token if expired or about to expire
        if (Date.now() > tokenExpiry - 120000) {
            try { token = await getToken(credId); tokenExpiry = Date.now() + 3600000; consecutiveErrors = 0; } catch { }
        }

        // Retry loop — up to MAX_BATCH_RETRIES attempts
        for (let attempt = 0; attempt < MAX_BATCH_RETRIES; attempt++) {
            if (batchSucceeded) break;

            try {
                const apiData = await callCreatorsAPI(token, batch, creds);
                const items = apiData?.itemsResult?.items || [];
                const errorMap = parseApiErrors(apiData?.errors || []);

                for (const asinCode of batch) {
                    const item = items.find(it => it.asin === asinCode);
                    if (!item) {
                        notFoundList.push({ asin: asinCode, reason: errorMap.get(asinCode) || 'Not returned by API' });
                        notFound++;
                    } else {
                        const row = { asin: asinCode, seller: extractMetricValue('seller', item) };
                        for (const key of selectedMetrics) row[key] = extractMetricValue(key, item);
                        results.push(row);
                        found++;
                    }
                    processed++;
                }
                batchSucceeded = true;
                consecutiveErrors = 0;

            } catch (batchErr) {
                const status = batchErr.response?.status;
                const isRateLimit = status === 429;
                const isAuth = status === 401 || status === 403;
                const isNetwork = !status || batchErr.code === 'ECONNRESET' || batchErr.code === 'ETIMEDOUT' || batchErr.code === 'ECONNREFUSED' || batchErr.message?.includes('timeout');

                if (isRateLimit) {
                    const retryAfter = batchErr.response?.headers?.['retry-after'];
                    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : RATE_LIMIT_DELAY;
                    console.log(`Rate limited (429) on batch ${i / BATCH_SIZE + 1}, rotating credential, waiting ${waitMs / 1000}s...`);
                    TOKEN_CACHE.clear(); // Force new credential selection
                    await new Promise(r => setTimeout(r, waitMs));
                    try { token = await getToken(credId); tokenExpiry = Date.now() + 3600000; } catch { }
                    continue; // retry same batch
                }

                if (isAuth) {
                    console.log(`Auth error (${status}) on batch ${i / BATCH_SIZE + 1}, rotating credential...`);
                    TOKEN_CACHE.clear(); // Force new credential selection
                    try { token = await getToken(credId); tokenExpiry = Date.now() + 3600000; } catch {}
                    continue;
                }

                if (isNetwork) {
                    // Network error — wait with backoff and retry
                    const waitMs = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
                    console.log(`Network error on batch ${i / BATCH_SIZE + 1}, attempt ${attempt + 1}/${MAX_BATCH_RETRIES}, waiting ${waitMs / 1000}s...`);
                    await new Promise(r => setTimeout(r, waitMs));
                    continue; // retry same batch
                }

                // Other error (4xx/5xx) — backoff and retry
                const waitMs = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
                console.log(`API error ${status} on batch ${i / BATCH_SIZE + 1}, attempt ${attempt + 1}/${MAX_BATCH_RETRIES}, waiting ${waitMs / 1000}s...`);
                await new Promise(r => setTimeout(r, waitMs));
            }
        }

        // If all retries failed — queue failed ASINs for retry after main loop
        if (!batchSucceeded) {
            consecutiveErrors++;
            // Mark as not-found for now, will retry after all batches
            for (const a of batch) { notFoundList.push({ asin: a, reason: 'API error after all retries' }); notFound++; processed++; }
            console.warn(`Batch ${i / BATCH_SIZE + 1} FAILED after ${MAX_BATCH_RETRIES} retries — ${batch.length} ASINs queued for retry`);
        }

        // Save progress to Redis every batch
        job.processed = processed; job.found = found; job.notFound = notFound;
        job.results = results; job.notFoundList = notFoundList;
        await saveJob(job);

        // Delay between batches — longer after errors
        if (i + BATCH_SIZE < asinList.length) {
            const delay = consecutiveErrors > 0
                ? Math.min(STALE_DELAY * consecutiveErrors, 30000) // scale up on consecutive errors, max 30s
                : BASE_BATCH_DELAY;
            await new Promise(r => setTimeout(r, delay));
        }
    }

    // ── RETRY PASS 2: Re-fetch all failed ASINs with fresh token ──
    const failedAsins = notFoundList.map(n => n.asin);
    if (failedAsins.length > 0 && failedAsins.length <= 5000) {
        console.log(`Retry pass 2: re-fetching ${failedAsins.length} failed ASINs...`);
        // Clear not-found list and re-process
        notFoundList = [];
        notFound = 0;
        const retryResults = [];
        let retryFound = 0;

        // Get fresh token
        try { token = await getToken(credId); tokenExpiry = Date.now() + 3600000; } catch { }

        for (let i = 0; i < failedAsins.length; i += BATCH_SIZE) {
            const job = await loadJob(jobId);
            if (!job || job.status === 'cancelled') break;

            const batch = failedAsins.slice(i, i + BATCH_SIZE);
            let retryBatchOk = false;

            for (let attempt = 0; attempt < MAX_BATCH_RETRIES; attempt++) {
                if (retryBatchOk) break;
                try {
                    // Refresh token if needed
                    if (Date.now() > tokenExpiry - 120000) {
                        try { token = await getToken(credId); tokenExpiry = Date.now() + 3600000; } catch { }
                    }
                    const apiData = await callCreatorsAPI(token, batch, creds);
                    const items = apiData?.itemsResult?.items || [];
                    const errorMap = parseApiErrors(apiData?.errors || []);

                    for (const asinCode of batch) {
                        const item = items.find(it => it.asin === asinCode);
                        if (!item) {
                            notFoundList.push({ asin: asinCode, reason: errorMap.get(asinCode) || 'Not accessible' });
                            notFound++;
                        } else {
                            const row = { asin: asinCode, seller: extractMetricValue('seller', item) };
                            for (const key of selectedMetrics) row[key] = extractMetricValue(key, item);
                            retryResults.push(row);
                            retryFound++;
                        }
                    }
                    retryBatchOk = true;
                } catch (err) {
                    const status = err.response?.status;
                    if (status === 429) {
                        const waitMs = err.response?.headers?.['retry-after'] ? parseInt(err.response.headers['retry-after']) * 1000 : RATE_LIMIT_DELAY;
                        await new Promise(r => setTimeout(r, waitMs));
                        try { token = await getToken(credId); tokenExpiry = Date.now() + 3600000; } catch { }
                        continue;
                    }
                    const waitMs = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
                    await new Promise(r => setTimeout(r, waitMs));
                }
            }

            if (!retryBatchOk) {
                for (const a of batch) { notFoundList.push({ asin: a, reason: 'Not accessible after retries' }); notFound++; }
            }

            if (i + BATCH_SIZE < failedAsins.length) await new Promise(r => setTimeout(r, BASE_BATCH_DELAY * 2));
        }

        // Merge retry results
        results = [...results, ...retryResults];
        found += retryFound;
    }

    const finalJob = await loadJob(jobId);
    if (finalJob && finalJob.status !== 'cancelled') {
        finalJob.status = 'completed';
        finalJob.completedAt = new Date().toISOString();
        await saveJob(finalJob);

        logActivity('LIVE_DATA_COMPLETE', `Job completed: ${finalJob.found}/${finalJob.totalAsins} ASINs found, ${finalJob.notFound} not found`, {
            jobId, foundCount: finalJob.found, notFoundCount: finalJob.notFound,
            totalAsins: finalJob.totalAsins, metrics: finalJob.metrics,
            duration: finalJob.completedAt ? Math.round((new Date(finalJob.completedAt) - new Date(finalJob.startedAt)) / 1000) + 's' : 'unknown',
        });
    }
}

function jobId_safe(id) { return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40); }

// ── V2: Locked to secondary credential only ──────────────────────────
exports.fetchLiveDataV2 = async (req, res) => {
    req.body.credId = 'secondary';
    return exports.fetchLiveData(req, res);
};

exports.uploadAndProcessV2 = async (req, res) => {
    req.body._credId = 'secondary';
    // Inject credId into the job creation
    const origSaveJob = saveJob;
    return exports.uploadAndProcess(req, res);
};

exports.getProgressV2 = (req, res) => exports.getProgress(req, res);
exports.getResultsV2 = (req, res) => exports.getResults(req, res);
exports.downloadResultsV2 = (req, res) => exports.downloadResults(req, res);
exports.cancelJobV2 = (req, res) => exports.cancelJob(req, res);
