// Request deduplication registry
const inflightRequests = new Map();

export function deduplicatedGet(key, fetcher) {
    if (inflightRequests.has(key)) {
        console.log('[API DEDUPE] Reusing inflight promise for key:', key);
        return inflightRequests.get(key);
    }

    const promise = fetcher().finally(() => {
        inflightRequests.delete(key);
    });

    inflightRequests.set(key, promise);
    return promise;
}

// Client-side cache registry
const cacheRegistry = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export async function cachedFetch(key, fetcher, ttlMs = DEFAULT_TTL) {
    const existing = cacheRegistry.get(key);
    const now = Date.now();

    if (existing && (now - existing.timestamp) < ttlMs) {
        console.log('[API CACHE] Cache HIT for key:', key);
        return existing.data;
    }

    console.log('[API CACHE] Cache MISS for key:', key, '- fetching fresh data...');
    const data = await deduplicatedGet(key, fetcher);
    cacheRegistry.set(key, { data, timestamp: now });
    return data;
}

export function invalidateCache(...keys) {
    keys.forEach((key) => {
        console.log('[API CACHE] Invalidating cache key:', key);
        cacheRegistry.delete(key);
    });
}

export function invalidateCachePattern(pattern) {
    console.log('[API CACHE] Invalidating keys matching pattern:', pattern);
    for (const key of cacheRegistry.keys()) {
        if (key.includes(pattern)) {
            console.log('[API CACHE]   Deleted key:', key);
            cacheRegistry.delete(key);
        }
    }
}
