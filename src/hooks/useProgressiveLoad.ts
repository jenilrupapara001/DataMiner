/**
 * Progressive Loading Hook
 *
 * Coordinates skeleton → content transitions for dashboard sections with
 * variable network latency. Each section declares its own priority and
 * minimum-skeleton-duration so the UI never flashes: the skeleton remains
 * visible for at least `minMs` even after the data arrives.
 *
 * Lifecycle per section:
 *   pending ──[data arrives]──► loading ──[minMs elapsed]──► resolved
 *             ──[minMs elapsed]──► resolved
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { MetricOverview } from '../models/growth.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProgressiveSection<TSnapshot = unknown> {
    /** Unique section key. */
    key:        string;
    /** Minimum ms the skeleton is shown before data can appear. */
    minMs:      number;
    /** Current snapshot — null means "data not loaded yet". */
    snapshot:   TSnapshot | null;
    /** Marks this section as manually re-fetched (bypasses skeleton minMs). */
    updated?:   boolean;
    /** Whether the section is actively being fetched. */
    isLoading?: boolean;
}

export interface ProgressState {
    /** Skeleton state per section. */
    sections:              Map<string, ProgressiveSection>;
    /** Globally resolved skeleton index (for cascading transitions). */
    priorityFlood:         number;
    /** Global loading flag — true until all sections are resolved. */
    isHydrated:     boolean;
    /** per-section: error message or null. */
    errors:         Record<string, string | null>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createSkeleton<TSnapshot>(config: {
    key:           string;
    minMs?:        number;
    initial?:     TSnapshot | null;
}): ProgressiveSection<TSnapshot> {
    return {
        key:      config.key,
        minMs:    config.minMs ?? 400,
        snapshot: config.initial ?? null,
    };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useProgressiveLoad
 *
 * @example
 * const loader = useProgressiveLoad({
 *   kpis:         { key: 'kpis',         minMs: 500 },
 *   metrics:      { key: 'metrics',      minMs: 600 },
 *   targets:      { key: 'targets',      minMs: 700 },
 *   alerts:       { key: 'alerts',       minMs: 300 },
 * });
 *
 * // React Query, WebSocket, or any data source calls `loader.receive()`
 * loader.receive('kpis', data);
 * loader.receive('targets', data, true); // updated=true → bypass skeleton
 *
 * // Components read loader.sections.get('kpis')!.snapshot
 */
export function useProgressiveLoad(
    definitions: Record<string, { key: string; minMs?: number }>,
) {
    const freezetime = Date.now();

    const [sections, setSections]   = useState(
        () => new Map(Object.values(definitions).map((d) => [d.key, createSkeleton(d)])),
    );
    const [priorityFlood, setFlood] = useState(0);
    const [errors, setErrors]       = useState<Record<string, string | null>>({});
    const lockedSections            = useRef(new Set<string>());

    const resolveTracker = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    /**
     * Called when a section receives data.
     *
     * @param key      section key
     * @param snapshot data received
     * @param opts     propagation options
     */
    const receive = useCallback((key, snapshot, opts?: { updated?: boolean; manual?: boolean }) => {
        const def = Object.values(definitions).find((d) => d.key === key);
        if (!def) return;

        const minMs   = def.minMs ?? 400;
        const updated = opts?.updated ?? false;

        setSections((prev) => {
            const existing = prev.get(key);
            if (existing && existing.updated) return prev; // already resolved, skip

            if (updated) {
                // Immediate resolution — no skeleton delay
                lockedSections.current.delete(key);
                const next = new Map(prev);
                next.set(key, { ...existing!, snapshot, updated: true });
                return next;
            }

            // Schedule deferred resolution after minMs
            lockedSections.current.add(key);
            resolveTracker.current.set(key, setTimeout(() => {
                lockedSections.current.delete(key);
                setSections((p) => {
                    const ex = p.get(key);
                    if (!ex || ex.updated) return p;
                    const n = new Map(p);
                    n.set(key, { ...ex, snapshot });
                    return n;
                });
                resolveTracker.current.delete(key);
            }, Math.max(minMs - (Date.now() - freezetime), 0)));

            return prev;
        });

        if (opts?.manual) setFlood((p) => p + 1);
    }, [definitions]);

    /**
     * Signal that a section has an error.
     */
    const reject = useCallback((key, error: string) => {
        setErrors((prev) => ({ ...prev, [key]: error }));
        lockedSections.current.delete(key);
    }, []);

    /**
     * Clear all errors.
     */
    const clearErrors = useCallback(() => {
        setErrors({});
    }, []);

    /**
     * Reset the entire loader (on mount, logout, etc.).
     */
    const reset = useCallback(() => {
        Object.values(definitions).forEach((def) => {
            resolveTracker.current.get(def.key) && clearTimeout(resolveTracker.current.get(def.key)!);
        });
        resolveTracker.current.clear();
        lockedSections.current.clear();
        setSections(new Map(Object.values(definitions).map((d) => [d.key, createSkeleton(d)])));
        setFlood(0);
        setErrors({});
    }, [definitions]);

    // Hydration: all sections resolved when none are locked
    const checkIsHydrated = useCallback(() => {
        const allDefs = Object.values(definitions);
        const allResolved = !allDefs.some((d) => resolvedSections.current.has(d.key));
        return lockedSections.current.size === 0;
    }, [definitions]);

    const resolvedSections = useRef(new Set<string>());
    useEffect(() => {
        sections.forEach((sec) => {
            if (sec.snapshot !== null && !resolvedSections.current.has(sec.key)) {
                resolvedSections.current.add(sec.key);
            }
        });
    }, [sections]);

    // ── Pre-baked section getters matching the dashboard's sections ──────────────
    const snap         = <T>(key: string): T | null => ((sections.get(key) as ProgressiveSection<T>)?.snapshot ?? null) as T | null;
    const isLoadingSec = (key: string) =>
        sections.get(key)?.snapshot === null ? !lockedSections.current.has(key) : false;

    return {
        sections,
        errors,
        receive,
        reject,
        clearErrors,
        reset,
        priorityFlood,
        // Convenience typed accessors
        kpis:      snap<MetricOverview[]>('kpis'),
        metrics:   snap<MetricOverview[]>('metrics'),
        targets:   snap<any[]>('targets'),
        alerts:    snap<any[]>('alerts'),
        isLoadingKpis:      isLoadingSec('kpis'),
        isLoadingMetrics:   isLoadingSec('metrics'),
        isLoadingTargets:   isLoadingSec('targets'),
        isLoadingAlerts:    isLoadingSec('alerts'),
        // Stable boolean flag — computed once per render from the ref-backed state
        isHydrated: checkIsHydrated(),
    };
}
