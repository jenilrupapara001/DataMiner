/**
 * Retry Utility — Exponential Backoff with Jitter
 *
 * Features:
 * - Configurable retry attempts and base/max delay
 * - Full jitter to prevent thundering-herd
 * - Retry-condition predicate for selective retries (network errors, 5xx, etc.)
 * - On-retry callback for telemetry / UI signalling
 * - AbortController support so callers can cancel mid-retry
 */

/**
 * Decide whether a failed fetch attempt should be retried.
 * Retries: network failures, 408, 429, and 5xx status codes.
 */
export function shouldRetry(error, attempt, maxAttempts) {
    if (attempt >= maxAttempts) return false;

    const signal = error?.signal;
    if (signal?.aborted) return false;

    // Network error / CORS / failed fetch
    if (error?.code === 'ERR_NETWORK' || error?.code === 'ECONNABORTED') return true;

    if (error?.response?.status) {
        const s = error.response.status;
        return s === 408 || s === 429 || s >= 500;
    }

    if (error?.status) {
        const s = error.status;
        return s === 408 || s === 429 || s >= 500;
    }

    return true; // conservative: retry unknown errors up to maxAttempts
}

/**
 * Compute the millisecond delay before the next attempt using full jitter.
 * Base: baseMs * 2^attempt, capped at maxDelayMs, then randomised to [0, delay].
 */
export function computeBackoff(baseMs = 1000, maxDelayMs = 30000, attempt = 0) {
    const exponentialMs = baseMs * Math.pow(2, attempt);
    const cappedMs = Math.min(exponentialMs, maxDelayMs);
    return Math.floor(Math.random() * cappedMs);
}

/**
 * Throttle/debounce wait utility built on Promise + setTimeout.
 *
 * @param {AbortSignal|undefined} externalSignal — optional external signal to cancel
 * @returns {Promise<void>}
 */
export function delayMs(ms, externalSignal) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(resolve, ms);
        const handler = (e) => {
            cleanup();
            if (e.type === 'abort') reject(Object.assign(new Error('Aborted'), { signal: e }));
        };
        externalSignal?.addEventListener('abort', handler);
        function cleanup() {
            clearTimeout(timeoutId);
            timeoutId.abort = true;
            externalSignal?.removeEventListener('abort', handler);
        }
    });
}

/**
 * Wait for a network-settled retry delay.
 * Respects the AbortSignal (aborts immediately if signal is already aborted).
 */
function waitForRetry(ms, signal) {
    if (signal?.aborted) return Promise.reject(Object.assign(new Error('Aborted'), { signal }));
    return delayMs(ms, signal);
}

/**
 * Execute an async function with exponential-backoff retry.
 *
 * @param {() => Promise<T>} fn               — the async operation
 * @param {object}           [options]
 * @param {number}           [options.attempts=3]        — max attempts (including first)
 * @param {number}           [options.baseMs=1000]       — initial backoff in ms
 * @param {number}           [options.maxDelayMs=30000]  — cap on backoff
 * @param {Function}         [options.shouldRetryFn]     — override shouldRetry predicate
 * @param {Function}         [options.onRetry]           — (err, attempt, delayMs) => void
 * @param {AbortSignal}      [options.signal]             — caller can cancel
 * @returns {Promise<T>}
 */
export async function fetchWithRetry(fn, { attempts = 3, baseMs = 1000, maxDelayMs = 30000, shouldRetryFn, onRetry, signal } = {}) {
    const shouldRetry = shouldRetryFn || (() => true);

    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const result = await Promise.race([
                fn(),
                signal
                    ? new Promise((_, reject) => {
                          signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { signal })), { once: true });
                      })
                    : Promise.reject(new Error('No signal')),
            ]);
            return result;
        } catch (err) {
            lastError = err;
            if (attempt < attempts && shouldRetry(err, attempt, attempts)) {
                const ms = computeBackoff(baseMs, maxDelayMs, attempt - 1);
                onRetry?.(err, attempt, ms);
                await waitForRetry(ms, signal);
            }
        }
    }
    throw lastError;
}

/**
 * Wrap an AbortController with a timeout so in-flight requests never hang forever.
 *
 * @param {number} [timeoutMs=15000]
 * @returns {{ signal: AbortSignal, controller: AbortController }}
 */
export function createTimeoutSignal(timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    // keep reference so callers can clear it if needed
    timeoutId.controller = controller;
    return { signal: controller.signal, controller };
}

/**
 * Wraps an awaitable request inside a timeout.
 * Equivalent to Promise.race between fn() and an AbortTimer.
 *
 * @param {() => Promise<T>} fn
 * @param {number}           timeoutMs
 * @returns {Promise<T>}
 */
export async function fetchWithTimeout(fn, timeoutMs = 15000) {
    const { signal, controller } = createTimeoutSignal(timeoutMs);
    try {
        return await Promise.race([fn(), new Promise((_, rej) => { signal.addEventListener('abort', () => rej(new Error('Request timed out')), { once: true }); })]);
    } finally {
        clearTimeout(controller._timeoutId);
        controller.abort();
    }
}
