const emailService = require('../services/emailService');

/**
 * Login Rate Limiter with progressive delay, account lockout, and email notification.
 *
 * Layers:
 *   1. IP rate limit   — 10 req/min per IP (express-rate-limit compatible)
 *   2. Per-email lockout — 5 consecutive failures → 15 min lockout
 *   3. Progressive delay — each failure doubles the wait: 1s, 2s, 4s, 8s, 16s
 *   4. Email notification — sent when account is locked
 *
 * All counts stored in Redis (falls back to in-memory if Redis unavailable).
 * Generic errors — never reveals which layer triggered the block.
 */

const GENERIC_BLOCK = 'Unable to sign in. Please try again later.';

// ─── Redis / in-memory fallback ───────────────────────────────────────────────

let redis = null;
const memStore = new Map(); // fallback: { key: { count, lockUntil, nextAllowed } }

async function getRedis() {
    if (redis !== null) return redis;
    try {
        const Redis = require('ioredis');
        redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            lazyConnect: true,
            enableOfflineQueue: false,
        });
        redis.on('error', () => { redis = null; });
        await redis.connect();
        console.log('✅ Redis connected for login rate limiter');
        return redis;
    } catch {
        redis = null;
        console.warn('⚠️ Redis unavailable for rate limiter — using in-memory fallback');
        return null;
    }
}

async function cacheGet(key) {
    const r = await getRedis();
    if (r) {
        try { return await r.get(key); } catch { return null; }
    }
    const entry = memStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) { memStore.delete(key); return null; }
    return entry.value;
}

async function cacheSet(key, value, ttlSeconds) {
    const r = await getRedis();
    if (r) {
        try { await r.setex(key, ttlSeconds, value); return; } catch {}
    }
    memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function cacheIncr(key, ttlSeconds) {
    const r = await getRedis();
    if (r) {
        try {
            const val = await r.incr(key);
            if (val === 1) await r.expire(key, ttlSeconds);
            return val;
        } catch { return null; }
    }
    const entry = memStore.get(key);
    if (!entry || (entry.expiresAt && Date.now() > entry.expiresAt)) {
        memStore.set(key, { value: 1, expiresAt: Date.now() + ttlSeconds * 1000 });
        return 1;
    }
    entry.value++;
    return entry.value;
}

async function cacheSetEx(key, value, ttlSeconds) {
    const r = await getRedis();
    if (r) {
        try { await r.setex(key, ttlSeconds, value); return; } catch {}
    }
    memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const IP_WINDOW        = 60;       // 1 minute IP rate limit window
const IP_MAX           = 10;       // max 10 requests per IP per minute
const FAIL_LOCKOUT     = 900;      // 15 minutes lockout after 5 failures
const FAIL_THRESHOLD   = 5;        // failures before lockout
const PROGRESSIVE_DELAYS = [0, 1, 2, 4, 8, 16]; // seconds per attempt (index 0 = attempt 1)

function getProgressiveDelay(attemptNumber) {
    const idx = Math.min(attemptNumber, PROGRESSIVE_DELAYS.length - 1);
    return PROGRESSIVE_DELAYS[idx] * 1000; // ms
}

// ─── Email notification on lockout ────────────────────────────────────────────

async function sendLockoutEmail(email, clientIp) {
    try {
        await emailService.send({
            to: email,
            subject: 'Security Alert: Your account has been temporarily locked',
            html: `
                <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                    <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <h2 style="color: #991b1b; font-size: 16px; margin: 0 0 8px 0;">⚠️ Account Temporarily Locked</h2>
                        <p style="color: #7f1d1d; font-size: 13px; margin: 0;">
                            Your account was locked after multiple failed login attempts.
                            Access will be restored automatically in <strong>15 minutes</strong>.
                        </p>
                    </div>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                        <p style="color: #475569; font-size: 12px; margin: 0 0 4px 0;"><strong>Details:</strong></p>
                        <p style="color: #64748b; font-size: 12px; margin: 0;">Time: ${new Date().toUTCString()}</p>
                        <p style="color: #64748b; font-size: 12px; margin: 0;">IP Address: ${clientIp}</p>
                    </div>
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 16px;">
                        <p style="color: #1e40af; font-size: 12px; margin: 0;">
                            <strong>If this wasn't you:</strong> Change your password immediately after the lockout expires.
                            Contact your administrator if you need immediate access.
                        </p>
                    </div>
                    <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 20px;">
                        This is an automated security notification from RetailOps.
                    </p>
                </div>
            `
        });
        console.log(`📧 [LOCKOUT EMAIL] Sent to ${email}`);
    } catch (err) {
        console.error(`📧 [LOCKOUT EMAIL FAILED] ${email}: ${err.message}`);
    }
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * Layer 1: IP rate limiter — 10 requests per IP per minute.
 * Returns early with generic error if exceeded.
 */
async function ipRateLimiter(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const key = `rl:ip:${ip}`;
    const count = await cacheIncr(key, IP_WINDOW);

    if (count > IP_MAX) {
        console.warn(`[RATE_LIMIT] IP ${ip} exceeded ${IP_MAX} requests/min (${count} counted)`);
        return res.status(429).json({ success: false, message: GENERIC_BLOCK });
    }
    next();
}

/**
 * Layer 2: Per-email lockout check — runs BEFORE the controller processes credentials.
 * Checks Redis/in-memory for lock status and progressive delay.
 */
async function accountLockoutCheck(req, res, next) {
    const { email } = req.body || {};
    if (!email) return next(); // validation middleware handles missing email

    const normalizedEmail = email.toLowerCase().trim();
    const lockKey = `rl:lock:${normalizedEmail}`;
    const failKey = `rl:fail:${normalizedEmail}`;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

    // Check if account is currently locked
    const lockUntil = await cacheGet(lockKey);
    if (lockUntil) {
        const remainingMs = parseInt(lockUntil) - Date.now();
        if (remainingMs > 0) {
            const remainingMin = Math.ceil(remainingMs / 60000);
            console.warn(`[LOCKOUT] ${normalizedEmail} is locked. ${remainingMin}min remaining. IP: ${clientIp}`);
            return res.status(423).json({
                success: false,
                message: GENERIC_BLOCK
            });
        }
        // Lock expired — clean up
        await cacheSet(lockKey, '0', 1);
    }

    // Check progressive delay
    const failCount = parseInt(await cacheGet(failKey) || '0');
    if (failCount > 0 && failCount < FAIL_THRESHOLD) {
        const delayMs = getProgressiveDelay(failCount);
        if (delayMs > 0) {
            console.log(`[PROGRESSIVE_DELAY] ${normalizedEmail} attempt ${failCount + 1}: waiting ${delayMs}ms`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    // Attach metadata for the controller to use
    req._authMetadata = { email: normalizedEmail, clientIp };
    next();
}

/**
 * Called by the controller after a FAILED login attempt.
 * Increments failure count, applies lockout at threshold, sends email.
 */
async function recordFailedAttempt(email, clientIp) {
    const normalizedEmail = email.toLowerCase().trim();
    const failKey = `rl:fail:${normalizedEmail}`;
    const lockKey = `rl:lock:${normalizedEmail}`;

    const count = await cacheIncr(failKey, FAIL_LOCKOUT + 60);
    console.warn(`[FAILED_ATTEMPT] ${normalizedEmail} — attempt ${count}/${FAIL_THRESHOLD} | IP: ${clientIp}`);

    if (count >= FAIL_THRESHOLD) {
        const lockUntil = Date.now() + FAIL_LOCKOUT * 1000;
        await cacheSetEx(lockKey, String(lockUntil), FAIL_LOCKOUT + 60);
        console.warn(`[LOCKOUT] ${normalizedEmail} locked for 15 minutes. IP: ${clientIp}`);

        // Send email notification (fire-and-forget)
        sendLockoutEmail(normalizedEmail, clientIp).catch(() => {});
    }

    return count;
}

/**
 * Called by the controller after a SUCCESSFUL login.
 * Clears all failure counters for the email.
 */
async function recordSuccessfulLogin(email) {
    const normalizedEmail = email.toLowerCase().trim();
    const failKey = `rl:fail:${normalizedEmail}`;
    const lockKey = `rl:lock:${normalizedEmail}`;
    await cacheSet(failKey, '0', 1);
    await cacheSet(lockKey, '0', 1);
}

module.exports = {
    ipRateLimiter,
    accountLockoutCheck,
    recordFailedAttempt,
    recordSuccessfulLogin,
    GENERIC_BLOCK
};
