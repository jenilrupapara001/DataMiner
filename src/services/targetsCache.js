// Central cache + optimistic update engine for targets

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const getAuthHeader = () => {
    const token = localStorage.getItem('authToken');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

class TargetsCacheService {
    constructor() {
        this.cache = { data: [], timestamp: 0, etag: null };
        this.listeners = new Set();
        this.inflight = null;
        this.pollTimer = null;
        this.pendingPatches = new Map();
        this.abortControllers = new Map();
    }

    // Subscribe to cache changes
    subscribe(fn) {
        this.listeners.add(fn);
        // Immediately emit current cache if available
        if (this.cache.data.length > 0) fn(this.cache.data);
        return () => this.listeners.delete(fn);
    }

    emit(data) {
        this.cache.data = data;
        this.listeners.forEach((fn) => fn(data));
    }

    // Optimistic patch — instant UI update
    optimisticPatch(id, patch) {
        const updated = this.cache.data.map((t) =>
            (t.Id === id || t.id === id) ? { ...t, ...patch, _optimistic: true } : t
        );
        const previousRecord = this.cache.data.find((t) => t.Id === id || t.id === id);
        this.emit(updated);
        return previousRecord; // returns old value for rollback
    }

    // Rollback a failed optimistic update
    rollback(id, previousData) {
        const rolled = this.cache.data.map((t) =>
            (t.Id === id || t.id === id) ? { ...previousData, _optimistic: false } : t
        );
        this.emit(rolled);
    }

    // Optimistic insert (for create)
    optimisticInsert(tempId, record) {
        this.emit([...this.cache.data, { ...record, Id: tempId, _optimistic: true, _temp: true }]);
    }

    // Replace temp record with real server response
    confirmInsert(tempId, serverRecord) {
        const replaced = this.cache.data.map((t) =>
            t.Id === tempId ? { ...serverRecord, _optimistic: false, _temp: false } : t
        );
        this.emit(replaced);
    }

    // Remove optimistic insert on failure
    rollbackInsert(tempId) {
        this.emit(this.cache.data.filter((t) => t.Id !== tempId));
    }

    // Optimistic delete
    optimisticDelete(ids) {
        const idSet = new Set(ids.map(String));
        const snapshot = this.cache.data.filter((t) => idSet.has(String(t.Id)));
        this.emit(this.cache.data.filter((t) => !idSet.has(String(t.Id))));
        return snapshot; // return deleted records for rollback
    }

    rollbackDelete(deletedRecords) {
        this.emit([...this.cache.data, ...deletedRecords]);
    }

    // Fetch (with deduplication + ETag)
    async fetch(force = false) {
        const STALE_MS = 60_000; // 1 minute
        const now = Date.now();

        if (!force && this.cache.data.length > 0 && (now - this.cache.timestamp) < STALE_MS) {
            return this.cache.data;
        }

        // Deduplicate: if a fetch is already in-flight, share that promise
        if (this.inflight) return this.inflight;

        this.inflight = this._doFetch().finally(() => { this.inflight = null; });
        return this.inflight;
    }

    async _doFetch() {
        try {
            const headers = { 
                'Content-Type': 'application/json',
                ...getAuthHeader()
            };
            if (this.cache.etag) headers['If-None-Match'] = this.cache.etag;

            const res = await fetch(`${API_BASE}/targets`, { headers });

            // 304 Not Modified — data unchanged, use cache
            if (res.status === 304) return this.cache.data;

            const etag = res.headers.get('ETag');
            if (etag) this.cache.etag = etag;

            const json = await res.json();
            const data = json.data || json;

            this.cache.timestamp = Date.now();
            this.emit(data);
            return data;
        } catch (err) {
            // Network error — return stale cache rather than crashing
            console.warn('[TargetsCache] Fetch failed, using stale cache:', err);
            return this.cache.data;
        }
    }

    // Background polling
    startPolling(intervalMs = 30_000) {
        this.stopPolling();
        this.pollTimer = setInterval(() => {
            this.fetch(true).catch(() => {});
        }, intervalMs);
    }

    stopPolling() {
        if (this.pollTimer) clearInterval(this.pollTimer);
        this.pollTimer = null;
    }

    // Cancel in-flight request by key (for debounced saves)
    cancelRequest(key) {
        if (this.abortControllers.has(key)) {
            this.abortControllers.get(key).abort();
            this.abortControllers.delete(key);
        }
    }

    getAbortSignal(key) {
        this.cancelRequest(key); // cancel previous
        const ctrl = new AbortController();
        this.abortControllers.set(key, ctrl);
        return ctrl.signal;
    }

    invalidate() {
        this.cache.timestamp = 0;
    }
}

export const targetsCache = new TargetsCacheService();
