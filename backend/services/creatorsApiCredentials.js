/**
 * CreatorsAPI Credential Rotation Service
 * Manages multiple credential sets and rotates them randomly for higher request throughput
 */
class CreatorsApiCredentials {
    constructor() {
        this.credentials = [];
        this.currentIndex = 0;
        this._loadFromEnv();
    }

    _loadFromEnv() {
        // Primary credentials (always loaded)
        const primary = {
            id: 'primary',
            clientId: process.env.LIVE_SYNC_CLIENT_ID,
            clientSecret: process.env.LIVE_SYNC_CLIENT_SECRET,
            partnerTag: process.env.LIVE_SYNC_PARTNER_TAG,
            marketplace: process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in',
            successCount: 0,
            failCount: 0,
            lastUsed: 0,
            lastError: null,
            consecutiveErrors: 0,
        };

        // Secondary credentials (from new env vars)
        const secondary = {
            id: 'secondary',
            clientId: process.env.CREATORS_API_CLIENT_ID_2,
            clientSecret: process.env.CREATORS_API_CLIENT_SECRET_2,
            partnerTag: process.env.LIVE_SYNC_PARTNER_TAG,
            marketplace: process.env.LIVE_SYNC_MARKETPLACE || 'www.amazon.in',
            successCount: 0,
            failCount: 0,
            lastUsed: 0,
            lastError: null,
            consecutiveErrors: 0,
        };

        this.credentials = [];
        if (primary.clientId && primary.clientSecret) this.credentials.push(primary);
        if (secondary.clientId && secondary.clientSecret) this.credentials.push(secondary);

        if (this.credentials.length === 0) {
            console.error('[Credentials] No Creators API credentials found in environment!');
        } else {
            console.log(`[Credentials] Loaded ${this.credentials.length} credential set(s)`);
        }
    }

    /**
     * Get next credential set using smart rotation:
     * 1. Random selection among healthy credentials
     * 2. Skip credentials with consecutive errors
     * 3. Least-recently-used preference
     */
    get() {
        const healthy = this.credentials.filter(c => c.consecutiveErrors < 5);
        if (healthy.length === 0) {
            // All credentials are failing — reset and use any
            console.warn('[Credentials] All credential sets have consecutive errors, resetting...');
            this.credentials.forEach(c => { c.consecutiveErrors = 0; });
            return this.credentials[0];
        }

        // Pick random healthy credential, preferring least recently used
        const now = Date.now();
        const sorted = healthy.sort((a, b) => {
            // Penalize if used in last 200ms (rate limit protection)
            const aPenalty = (now - a.lastUsed < 200) ? 1000 : 0;
            const bPenalty = (now - b.lastUsed < 200) ? 1000 : 0;
            return (a.consecutiveErrors + aPenalty) - (b.consecutiveErrors + bPenalty);
        });

        const chosen = sorted[0];
        chosen.lastUsed = now;
        return chosen;
    }

    /**
     * Mark credential as successful
     */
    markSuccess(cred) {
        cred.successCount++;
        cred.consecutiveErrors = 0;
        cred.lastError = null;
    }

    /**
     * Mark credential as failed
     */
    markFailed(cred, error) {
        cred.failCount++;
        cred.consecutiveErrors++;
        cred.lastError = error;
    }

    /**
     * Get stats for all credentials
     */
    getStats() {
        return this.credentials.map(c => ({
            id: c.id,
            clientId: c.clientId ? c.clientId.slice(0, 30) + '...' : 'NOT SET',
            successCount: c.successCount,
            failCount: c.failCount,
            consecutiveErrors: c.consecutiveErrors,
            healthy: c.consecutiveErrors < 5,
        }));
    }

    get count() { return this.credentials.length; }
}

module.exports = new CreatorsApiCredentials();
