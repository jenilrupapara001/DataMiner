/**
 * Dashboard Store — Zustand client-side state cache
 *
 * Responsibilities:
 *  - Hold a local copy of dashboard-critical data (KPIs, targets, alerts)
 *    to eliminate layout thrashing on UI-only interactions such as
 *    sorting, filtering, and optimistic updates.
 *  - Track partition-aware state (offline edits queued for sync).
 *  - Manage optimistic mutation life-cycle: apply → confirm OR rollback.
 *  - Expose web-socket connection health.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    MetricType,
    GoalStatus,
    TaskStatus,
    MetricOverview,
} from '../models/growth.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiValue {
    label: string;
    value: number | string;
    format: 'currency' | 'percentage' | 'number';
    change?: number;
    changeType?: 'positive' | 'negative' | 'neutral';
    target?: number;
    status?: GoalStatus;
}

interface AlertItem {
    id: string;
    type: 'info' | 'warning' | 'critical' | 'success';
    message: string;
    timestamp: string;
    acknowledged: boolean;
}

interface TargetItem {
    id: string;
    label: string;
    metric: MetricType;
    currentValue: number;
    targetValue: number;
    gap: number;
    unit: string;
    status: GoalStatus;
}

interface DashboardCache {
    kpis:           KpiValue[];
    metrics:        MetricOverview[];
    targets:        TargetItem[];
    alerts:         AlertItem[];
    syncTimestamp:  string | null;
    filteredAsins:  string[];
    myTasks:        { id: string; title: string; taskType: string; taskStatus: string }[];
}

interface PendingMutation {
    id:          string;
    type:        'asinUpdate' | 'tagBulk' | 'targetUpdate' | 'taskStatus' | 'custom';
    optimistic:  Record<string, unknown>;
    original:    Record<string, unknown>;
    timestamp:   number;
}

interface ConnectionHealth {
    connected:    boolean;
    reconnecting: boolean;
    failedSince:  number | null;
    lastPing:     number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INITIAL_CACHE: DashboardCache = {
    kpis:          [],
    metrics:       [],
    targets:       [],
    alerts:        [],
    syncTimestamp: null,
    filteredAsins: [],
    myTasks:       [],
};

// ─── Store ─────────────────────────────────────────────────────────────────────

interface DashboardState {
    // Cache
    cache:           DashboardCache;
    connection:      ConnectionHealth;

    // Optimistic queue
    pendingMutations: PendingMutation[];

    // ── Setters ───────────────────────────────────────────────────────────────

    setKpis:       (kp: KpiValue[]) => void;
    setMetrics:    (m: MetricOverview[]) => void;
    setTargets:    (t: TargetItem[]) => void;
    setAlerts:     (a: AlertItem[]) => void;
    setSyncTime:   (ts: string) => void;
    setFiltered:   (asins: string[]) => void;
    setMyTasks:    (tasks: DashboardCache['myTasks']) => void;

    // ── Cache replace ─────────────────────────────────────────────────────────

    replaceCache: (partial: Partial<DashboardCache>) => void;
    invalidateAllQueries: () => void;

    // ── Optimistic-shim helpers ────────────────────────────────────────────────

    /** Plant an optimistic record before the mutation fires. */
    addPendingMutation: (m: PendingMutation) => void;

    /** Resolve a mutation — remove from queue. */
    resolvePendingMutation: (id: string) => void;

    /** Revert all mutations whose server call failed. */
    rollbackPendingMutations: () => PendingMutation[];

    // ── Connection health ──────────────────────────────────────────────────────

    setConnection: (state: Partial<ConnectionHealth>) => void;
    markPing:      () => void;
}

export const useDashboardStore = create<DashboardState>()(
    persist(
        (set, get) => ({
            cache:               { ...INITIAL_CACHE },
            connection:          { connected: false, reconnecting: false, failedSince: null, lastPing: null },
            pendingMutations:    [],

            setKpis:      (kp)     => set((s) => ({ cache: { ...s.cache, kpis: kp } })),
            setMetrics:   (m)      => set((s) => ({ cache: { ...s.cache, metrics: m } })),
            setTargets:   (t)      => set((s) => ({ cache: { ...s.cache, targets: t } })),
            setAlerts:    (a)      => set((s) => ({ cache: { ...s.cache, alerts: a } })),
            setSyncTime:  (ts)     => set((s) => ({ cache: { ...s.cache, syncTimestamp: ts } })),
            setFiltered:  (asins)  => set((s) => ({ cache: { ...s.cache, filteredAsins: asins } })),
            setMyTasks:   (tasks)  => set((s) => ({ cache: { ...s.cache, myTasks: tasks } })),

            replaceCache: (partial) =>
                set((s) => ({ cache: { ...s.cache, ...partial } })),

            invalidateAllQueries: () =>
                set((s) => ({ cache: { ...INITIAL_CACHE, filteredAsins: s.cache.filteredAsins } })),

            addPendingMutation: (m) =>
                set((s) => ({
                    pendingMutations: [...s.pendingMutations, m],
                })),

            resolvePendingMutation: (id) =>
                set((s) => ({
                    pendingMutations: s.pendingMutations.filter((p) => p.id !== id),
                })),

            rollbackPendingMutations: () => {
                const rolledBack = get().pendingMutations;
                set((s) => ({ pendingMutations: [] }));
                return rolledBack;
            },

            setConnection: (state) =>
                set((s) => ({
                    connection: { ...s.connection, ...state },
                })),

            markPing: () =>
                set((s) => ({
                    connection: { ...s.connection, lastPing: Date.now(), connected: true },
                })),
        }),
        {
            name: 'dash-cache',
            partialize: (state) => ({
                // Persist only non-bulky cache details to avoid localStorage QuotaExceededError
                cache: {
                    ...INITIAL_CACHE,
                    syncTimestamp: state.cache.syncTimestamp,
                    filteredAsins: state.cache.filteredAsins,
                },
            }),
        }
    )
);
