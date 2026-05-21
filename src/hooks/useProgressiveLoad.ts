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
    const freezetime = useRef(Date.now());

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
    const receive = useCallback((key: string, snapshot: any, opts?: { updated?: boolean; manual?: boolean }) => {
        const def = Object.values(definitions).find((d) => d.key === key);
        if (!def) return;

        const minMs   = def.minMs ?? 400;
        const updated = opts?.updated ?? false;

        setSections((prev) => {
            const existing = prev.get(key);
            
            // If already resolved with data or manually updated, bypass delay and update immediately
            if (updated || (existing && existing.snapshot !== null)) {
                lockedSections.current.delete(key);
                const next = new Map(prev);
                next.set(key, { ...existing!, snapshot, updated: true });
                return next;
            }

            // Clear any previously pending timeout for this section
            if (resolveTracker.current.has(key)) {
                clearTimeout(resolveTracker.current.get(key)!);
            }

            // Schedule deferred resolution after minMs
            lockedSections.current.add(key);
            resolveTracker.current.set(key, setTimeout(() => {
                lockedSections.current.delete(key);
                setSections((p) => {
                    const ex = p.get(key);
                    const n = new Map(p);
                    n.set(key, { ...ex!, snapshot, updated: true });
                    return n;
                });
                resolveTracker.current.delete(key);
            }, Math.max(minMs - (Date.now() - freezetime.current), 0)));

            return prev;
        });

        if (opts?.manual) setFlood((p) => p + 1);
    }, [definitions]);

    /**
     * Signal that a section has an error.
     */
    const reject = useCallback((key: string, error: string) => {
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
            if (resolveTracker.current.has(def.key)) {
                clearTimeout(resolveTracker.current.get(def.key)!);
            }
        });
        resolveTracker.current.clear();
        lockedSections.current.clear();
        freezetime.current = Date.now();
        setSections(new Map(Object.values(definitions).map((d) => [d.key, createSkeleton(d)])));
        setFlood(0);
        setErrors({});
    }, [definitions]);

    // Hydration: all sections resolved when none are null, or have errored
    const checkIsHydrated = useCallback(() => {
        const allDefs = Object.values(definitions);
        return allDefs.every((def) => {
            const sec = sections.get(def.key);
            return sec && (sec.snapshot !== null || errors[def.key] != null);
        });
    }, [definitions, sections, errors]);

    // ── Pre-baked section getters matching the dashboard's sections ──────────────
    const snap         = <T>(key: string): T | null => ((sections.get(key) as ProgressiveSection<T>)?.snapshot ?? null) as T | null;
    const isLoadingSec = (key: string) => {
        const sec = sections.get(key);
        return sec ? sec.snapshot === null && errors[key] == null : true;
    };

    return {
        sections,
        errors,
        receive,
        reject,
        clearErrors,
        reset,
        priorityFlood,
        // Convenience typed accessors
        kpis:             snap<MetricOverview[]>('kpis'),
        revenueSeries:    snap<any[]>('revenueSeries'),
        adsPerformance:   snap<any[]>('adsPerformance'),
        categories:       snap<any[]>('categories'),
        topProducts:      snap<any[]>('topProducts'),
        targets:          snap<any[]>('targets'),
        alerts:           snap<any[]>('alerts'),
        metrics:          snap<MetricOverview[]>('metrics'),
        isLoadingKpis:      isLoadingSec('kpis'),
        isLoadingMetrics:   isLoadingSec('metrics'),
        isLoadingTargets:   isLoadingSec('targets'),
        isLoadingAlerts:    isLoadingSec('alerts'),
        isHydrated: checkIsHydrated(),
    };
}
