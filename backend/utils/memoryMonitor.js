'use strict';
/**
 * memoryMonitor.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Two utilities:
 *
 * MemoryMonitor — polls process.memoryUsage() on a configurable interval,
 *   emits warnings at a configurable threshold, forces GC at critical level,
 *   and detects potential memory leaks by tracking heap growth over time.
 *
 * BoundedCache — a simple LRU (Least-Recently-Used) Map-based cache with a
 *   max size cap and per-entry TTL.  Suitable for caching short-lived DB
 *   results (seller lists, role configs, etc.) without risking unbounded growth.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── MemoryMonitor ────────────────────────────────────────────────────────────

class MemoryMonitor {
  /**
   * @param {object} options
   * @param {number} [options.warningThreshold=0.70]  Fraction of maxHeapSize that triggers a warning log
   * @param {number} [options.criticalThreshold=0.90] Fraction that triggers GC + critical log
   * @param {number} [options.checkIntervalMs=30000]  How often to sample (ms)
   * @param {number} [options.maxHeapBytes]            Upper bound; defaults to 4 GB (matches --max-old-space-size=4096)
   * @param {number} [options.leakWindowSize=10]       Number of consecutive increasing snapshots to flag as a leak
   */
  constructor(options = {}) {
    this.warningThreshold  = options.warningThreshold  ?? 0.70;
    this.criticalThreshold = options.criticalThreshold ?? 0.90;
    this.checkIntervalMs   = options.checkIntervalMs   ?? 30_000;
    this.maxHeapBytes      = options.maxHeapBytes      ?? 4 * 1024 * 1024 * 1024; // 4 GB
    this.leakWindowSize    = options.leakWindowSize    ?? 10;
    this._snapshots        = [];
    this._intervalId       = null;
  }

  /** Start the background polling loop. */
  start() {
    if (this._intervalId) return; // already running
    this._intervalId = setInterval(() => this._sample(), this.checkIntervalMs);
    // Unref so the interval won't prevent graceful process exit
    if (this._intervalId.unref) this._intervalId.unref();
    console.log(`🔍 MemoryMonitor started (interval=${this.checkIntervalMs}ms)`);
  }

  /** Stop the background polling loop. */
  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
      console.log('🔍 MemoryMonitor stopped');
    }
  }

  /** Return the latest memory snapshot on demand. */
  snapshot() {
    return this._buildSnapshot();
  }

  /** Return trend report for health endpoints. */
  report() {
    const current = this._buildSnapshot();
    return {
      current,
      trend: this._trend(),
      snapshotCount: this._snapshots.length,
    };
  }

  // ─── private ───────────────────────────────────────────────────────────────

  _buildSnapshot() {
    const raw = process.memoryUsage();
    return {
      timestamp:    Date.now(),
      heapUsedMB:   +(raw.heapUsed  / 1024 / 1024).toFixed(1),
      heapTotalMB:  +(raw.heapTotal / 1024 / 1024).toFixed(1),
      rssMB:        +(raw.rss       / 1024 / 1024).toFixed(1),
      externalMB:   +(raw.external  / 1024 / 1024).toFixed(1),
      ratio:        +(raw.heapUsed  / this.maxHeapBytes).toFixed(4),
    };
  }

  _sample() {
    const snap = this._buildSnapshot();

    // Maintain rolling window
    this._snapshots.push(snap);
    if (this._snapshots.length > 100) this._snapshots.shift();

    // ── Leak detection ───────────────────────────────────────────────────────
    if (this._snapshots.length >= this.leakWindowSize) {
      const window = this._snapshots.slice(-this.leakWindowSize);
      const isLeaking = window.every((s, i) =>
        i === 0 || s.heapUsedMB > window[i - 1].heapUsedMB
      );
      if (isLeaking) {
        const first = window[0].heapUsedMB;
        const last  = snap.heapUsedMB;
        console.warn(
          `⚠️  [MemoryMonitor] Potential leak: heap grew continuously from ` +
          `${first}MB → ${last}MB over last ${this.leakWindowSize} checks`
        );
      }
    }

    // ── Threshold alerts ─────────────────────────────────────────────────────
    const { ratio, heapUsedMB, heapTotalMB } = snap;

    if (ratio >= this.criticalThreshold) {
      console.error(
        `🔴 [MemoryMonitor] CRITICAL: ${(ratio * 100).toFixed(1)}% ` +
        `(${heapUsedMB}MB / ${heapTotalMB}MB heap)`
      );
      if (typeof global.gc === 'function') {
        global.gc();
        console.log('🧹 [MemoryMonitor] Forced garbage collection');
      }
    } else if (ratio >= this.warningThreshold) {
      console.warn(
        `🟡 [MemoryMonitor] WARNING: ${(ratio * 100).toFixed(1)}% ` +
        `(${heapUsedMB}MB / ${heapTotalMB}MB heap)`
      );
    }

    return snap;
  }

  _trend() {
    if (this._snapshots.length < 2) return { direction: 'insufficient_data', changePercent: '0.00' };
    const first = this._snapshots[0].heapUsedMB;
    const last  = this._snapshots[this._snapshots.length - 1].heapUsedMB;
    const pct   = ((last - first) / first) * 100;
    return {
      direction:     pct > 5 ? 'increasing' : pct < -5 ? 'decreasing' : 'stable',
      changePercent: pct.toFixed(2),
    };
  }
}

// ─── BoundedCache ─────────────────────────────────────────────────────────────

class BoundedCache {
  /**
   * LRU cache backed by a Map.  Inserts/updates move the entry to the tail
   * (most-recently used).  When at capacity, the head (least-recently used)
   * is evicted.
   *
   * @param {object} options
   * @param {number} [options.maxSize=500]     Maximum number of entries
   * @param {number} [options.ttlMs=300000]    Per-entry TTL (5 minutes default)
   */
  constructor(options = {}) {
    this.maxSize = options.maxSize ?? 500;
    this.ttlMs   = options.ttlMs   ?? 300_000;
    this._cache  = new Map();
  }

  /**
   * Store a value.  Replaces existing entry (and resets its TTL + LRU position).
   * @param {string} key
   * @param {*}      value
   */
  set(key, value) {
    // Move to tail if already present
    if (this._cache.has(key)) this._cache.delete(key);

    // Evict LRU (Map preserves insertion order, first entry = LRU)
    if (this._cache.size >= this.maxSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }

    this._cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /**
   * Retrieve a value.  Returns `null` when missing or expired.
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }

    // Promote to tail (most recently used)
    this._cache.delete(key);
    this._cache.set(key, entry);
    return entry.value;
  }

  /** Check if a non-expired entry exists. */
  has(key) {
    return this.get(key) !== null;
  }

  /** Remove a specific entry. */
  delete(key) {
    this._cache.delete(key);
  }

  /** Flush all entries. */
  clear() {
    this._cache.clear();
  }

  get size() {
    return this._cache.size;
  }
}

module.exports = { MemoryMonitor, BoundedCache };
