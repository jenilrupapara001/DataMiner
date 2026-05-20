/**
 * useDashboardOrchestration.ts
 *
 * Orchestration hook — the ONLY page-facing entry point for dashboard data concerns.
 * Composes: React Query + Zustand + WebSocket + SSE + Progressive skeleton + Optimistic UI.
 *
 * Retains value between orchestrations: caller should call once and extract the return value
 * directly in the component body.
 *
 * @example
 * ```tsx
 * const { kpis, alerts, targets, isHydrated, refetch } =
 *        useDashboardOrchestration({ pollIntervalSeconds: 0 });
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { apiClient }         from '../lib/api-client';
import { useDashboardStore } from '../store/dashboardStore';
import { EVENT_BUS }         from '../store/eventBus';
import { fetchWithRetry }    from '../lib/retry-util';

import { useRealTimeDashboard } from './useRealTimeDashboard';
import { useOptimisticMutation } from './useOptimisticMutation';
import { useProgressiveLoad }   from './useProgressiveLoad';

// ── Local type shorthands ─────────────────────────────────────────────────────
// These supplement the shared `growth.types` where field names differ between
// the growth-tracking domain and the AdOps dashboard domain.

export enum DashboardSegment {
    /** KPI summary cards (Total Ad Sales, Ad Spend, Active ASINs, Catalog Value) */
    KPIS = 'kpis',
    /** Revenue and area chart series */
    REVENUE_SERIES = 'revenueSeries',
    /** ROAS / Ad Performance series and data points */
    ADS_PERFORMANCE = 'adsPerformance',
    /** Category / marketplace share entries */
    CATEGORIES = 'categories',
    /** Top-product leaderboard rows */
    TOP_PRODUCTS = 'topProducts',
    /** In-app alert items */
    ALERTS = 'alerts',
    /** Progress targets */
    TARGETS = 'targets',
}

/** Minimum skeleton-delay per section (ms). Prevents flash-of-empty. */
const SEGMENT_DELAYS: Record<string, number> = {
    [DashboardSegment.KPIS]:             350,
    [DashboardSegment.REVENUE_SERIES]:   400,
    [DashboardSegment.ADS_PERFORMANCE]:  400,
    [DashboardSegment.CATEGORIES]:        500,
    [DashboardSegment.TOP_PRODUCTS]:      450,
    [DashboardSegment.ALERTS]:            200,
    [DashboardSegment.TARGETS]:           350,
};

// ── Config ─────────────────────────────────────────────────────────────────────

export interface OrchestrationConfig {
    /** Seconds between auto-poll calls (0 = disabled). */
    pollIntervalSeconds?:         number;
    /** Custom SSE endpoint for fallback (default = `/api/__sse`). */
    sseEndpoint?:                 string;
    /** Seconds of socket silence before SSE fallback fires. */
    sseSilenceThresholdSeconds?:  number;
    /** Default retry count for managed fetches. */
    defaultRetryAttempts?:        number;
    /** Base backoff in ms. */
    backoffBaseMs?:               number;
}

// ── Query-key constants ────────────────────────────────────────────────────────

const QK_DASHBOARD = ['dashboard'] as const;
const QK_ALERTS    = ['alerts']     as QueryKey;
const QK_TARGETS   = ['targets']    as QueryKey;

// ── Backoff factory ────────────────────────────────────────────────────────────

function makeBackoffFn(baseMs: number) {
    return (attempt: number) => Math.min(Math.floor(baseMs * 2 ** attempt), 32_000);
}

// ── Helper: async query runner with retry ─────────────────────────────────────

function withRetry<T>(fn: () => Promise<T>, opts: { attempts: number; baseMs: number; maxDelayMs: number }): Promise<T> {
    return fetchWithRetry(fn, opts);
}

// ── Main hook ─────────────────────────────────────────────────────────────────

const PROGRESSIVE_LOAD_DEFINITIONS = Object.fromEntries(
    Object.values(DashboardSegment).map((seg) => [
        seg,
        { key: seg, minMs: SEGMENT_DELAYS[seg] ?? 400 },
    ]),
) as Record<string, { key: string; minMs?: number }>;

export function useDashboardOrchestration(cfg: OrchestrationConfig = {}) {
    const {
        pollIntervalSeconds:             pollInt        = 0,
        sseEndpoint:                     sseEndpoint,
        sseSilenceThresholdSeconds:      sseSilence     = 15,
        defaultRetryAttempts:            rawRetries     = 3,
        backoffBaseMs:                   rawBaseMs      = 1_000,
    } = cfg;

    // Apply safe floors
    const retries = Math.max(rawRetries, 1);
    const baseMs  = Math.max(rawBaseMs,  100);

    const qc       = useQueryClient();
    const relay    = EVENT_BUS;
    
    // Stable Zustand store selectors
    const setKpis       = useDashboardStore((s) => s.setKpis);
    const setAlerts     = useDashboardStore((s) => s.setAlerts);
    const setTargets     = useDashboardStore((s) => s.setTargets);
    const setSyncTime   = useDashboardStore((s) => s.setSyncTime);
    const connection    = useDashboardStore((s) => s.connection);
    const syncTimestamp = useDashboardStore((s) => s.cache.syncTimestamp);

    // ── 1 · Real-time ─────────────────────────────────────────────────────────
    useRealTimeDashboard({
        sseEndpoint:        sseEndpoint,
        unhealthyAfterSeconds: sseSilence,
    });

    // ── 2 · Progressive-skeleton coordinator ───────────────────────────────────
    const loader = useProgressiveLoad(PROGRESSIVE_LOAD_DEFINITIONS);

    // ── 3 · React Query per-section reads ──────────────────────────────────────

    const kpisQuery = useQuery({
        queryKey:             ['kpis'],
        queryFn:              () => withRetry(() => apiClient.get('/dashboard'), { attempts: retries, baseMs: baseMs, maxDelayMs: 30_000 }).then((r: any) => r.data),
        staleTime:            5 * 60_000,
        gcTime:               10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect:   true,
        retry:                retries,
        retryDelay:           makeBackoffFn(baseMs),
    });

    const adsPerfQuery = useQuery({
        queryKey:             ['ads-performance'],
        queryFn:              () => withRetry(() => apiClient.get('/dashboard'), { attempts: retries, baseMs: baseMs, maxDelayMs: 30_000 }).then((r: any) => r.data),
        staleTime:            5 * 60_000,
        gcTime:               10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect:   true,
        retry:                retries,
        retryDelay:           makeBackoffFn(baseMs),
        enabled:              kpisQuery.isSuccess,
    });

    const categoriesQuery = useQuery({
        queryKey:             ['categories'],
        queryFn:              () => withRetry(() => apiClient.get('/dashboard'), { attempts: retries, baseMs: baseMs, maxDelayMs: 30_000 }).then((r: any) => r.data),
        staleTime:            5 * 60_000,
        gcTime:               10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect:   true,
        retry:                retries,
        retryDelay:           makeBackoffFn(baseMs),
        enabled:              kpisQuery.isSuccess,
    });

    const topProductsQuery = useQuery({
        queryKey:             ['top-products'],
        queryFn:              () => withRetry(() => apiClient.get('/dashboard'), { attempts: retries, baseMs: baseMs, maxDelayMs: 30_000 }).then((r: any) => r.data),
        staleTime:            5 * 60_000,
        gcTime:               10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect:   true,
        retry:                retries,
        retryDelay:           makeBackoffFn(baseMs),
        enabled:              kpisQuery.isSuccess,
    });

    const alertsQuery = useQuery({
        queryKey:             QK_ALERTS,
        queryFn:              () => withRetry(() => apiClient.get('/alerts'), { attempts: 2, baseMs: 500, maxDelayMs: 10_000 }).then((r: any) => r.data),
        staleTime:            2 * 60_000,
        gcTime:               4 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect:   true,
        retry:                2,
        retryDelay:           makeBackoffFn(500),
    });

    const targetsQuery = useQuery({
        queryKey:             QK_TARGETS,
        queryFn:              () => withRetry(() => apiClient.get('/targets'), { attempts: 3, baseMs: 800, maxDelayMs: 20_000 }).then((r: any) => r.data),
        staleTime:            4 * 60_000,
        gcTime:               8 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect:   true,
        retry:                retries,
        retryDelay:           makeBackoffFn(baseMs),
    });

    // ── 4 · Route query results into progressive loader ─────────────────────────

    const { receive: loaderReceive, reject: loaderReject } = loader;
    const relayToLoader = useCallback((seg: string, q: {
        isFetched: boolean;
        isError:   boolean;
        data:      unknown;
        error:   { message?: string } | null;
    }) => {
        if (!q.isFetched) return;
        q.isError
            ? loaderReject(seg, q.error?.message ?? `Load failed: ${seg}`)
            : loaderReceive(seg, q.data ?? null);
    }, [loaderReceive, loaderReject]);

    // Destructure query primitives for stable dependencies
    const { isFetched: kpisFetched, isError: kpisError, data: kpisData, error: kpisErr } = kpisQuery;
    const { isFetched: adsPerfFetched, isError: adsPerfError, data: adsPerfData, error: adsPerfErr } = adsPerfQuery;
    const { isFetched: categoriesFetched, isError: categoriesError, data: categoriesData, error: categoriesErr } = categoriesQuery;
    const { isFetched: topProductsFetched, isError: topProductsError, data: topProductsData, error: topProductsErr } = topProductsQuery;
    const { isFetched: alertsFetched, isError: alertsError, data: alertsData, error: alertsErr } = alertsQuery;
    const { isFetched: targetsFetched, isError: targetsError, data: targetsData, error: targetsErr } = targetsQuery;

    useEffect(() => {
        relayToLoader(DashboardSegment.KPIS, { isFetched: kpisFetched, isError: kpisError, data: kpisData, error: kpisErr as any });
    }, [kpisFetched, kpisError, kpisData, kpisErr, relayToLoader]);

    useEffect(() => {
        relayToLoader(DashboardSegment.ADS_PERFORMANCE, { isFetched: adsPerfFetched, isError: adsPerfError, data: adsPerfData, error: adsPerfErr as any });
    }, [adsPerfFetched, adsPerfError, adsPerfData, adsPerfErr, relayToLoader]);

    useEffect(() => {
        relayToLoader(DashboardSegment.CATEGORIES, { isFetched: categoriesFetched, isError: categoriesError, data: categoriesData, error: categoriesErr as any });
    }, [categoriesFetched, categoriesError, categoriesData, categoriesErr, relayToLoader]);

    useEffect(() => {
        relayToLoader(DashboardSegment.TOP_PRODUCTS, { isFetched: topProductsFetched, isError: topProductsError, data: topProductsData, error: topProductsErr as any });
    }, [topProductsFetched, topProductsError, topProductsData, topProductsErr, relayToLoader]);

    useEffect(() => {
        relayToLoader(DashboardSegment.ALERTS, { isFetched: alertsFetched, isError: alertsError, data: alertsData, error: alertsErr as any });
    }, [alertsFetched, alertsError, alertsData, alertsErr, relayToLoader]);

    useEffect(() => {
        relayToLoader(DashboardSegment.TARGETS, { isFetched: targetsFetched, isError: targetsError, data: targetsData, error: targetsErr as any });
    }, [targetsFetched, targetsError, targetsData, targetsErr, relayToLoader]);

    // ── 5 · Sync Zustand store after loader resolves ────────────────────────────
    // Hash-tracker avoids redundant writes when the same data fires multiple renders.
    const hashRef = useRef<string>('');
    useEffect(() => {
        if (!loader.isHydrated) return;
        const h = [
            JSON.stringify(loader.kpis?.length ?? 0),
            JSON.stringify(loader.alerts?.length ?? 0),
            JSON.stringify(loader.targets?.length ?? 0),
        ].join('|');
        if (h === hashRef.current) return;
        hashRef.current = h;

        setKpis(loader.kpis as any);
        setAlerts(loader.alerts as any);
        setTargets(loader.targets as any);
        setSyncTime(new Date().toISOString());
    }, [loader.isHydrated, loader.kpis, loader.alerts, loader.targets, setKpis, setAlerts, setTargets, setSyncTime]);

    // ── 6 · Polling ────────────────────────────────────────────────────────────
    const pollHandle = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        const ms = Math.max(pollInt, 0) * 1_000;
        if (ms <= 0) return;
        pollHandle.current = window.setInterval(() => {
            void qc.invalidateQueries({ queryKey: QK_DASHBOARD, exact: false, refetchType: 'active' });
        }, ms);
        return () => { if (pollHandle.current) clearInterval(pollHandle.current); };
    }, [pollInt, qc]);

    // ── 7 · Event bus → React Query invalidation bridge ─────────────────────────
    const unsubBridge = useRef<(() => void) | null>(null);
    useEffect(() => {
        const onInvalidate = (evt: any) => { if (evt?.queryKey) void qc.invalidateQueries({ queryKey: evt.queryKey }); };
        const onGlobal     = ()        => { void qc.invalidateQueries({ queryKey: QK_DASHBOARD, exact: false }); };

        relay.on('realtime:dataUpdated',   onInvalidate);
        relay.on('realtime:invalidateAll', onGlobal);
        unsubBridge.current = () => {
            relay.off('realtime:dataUpdated',   onInvalidate);
            relay.off('realtime:invalidateAll', onGlobal);
        };
        return () => { unsubBridge.current?.(); };
    }, [qc, relay]);

    // ── 8 · Optimistic mutations ─────────────────────────────────────────────────
    const { mutate: mutateAsinTag } = useOptimisticMutation(
        (id: string, { tags }: { tags: string[] }) =>
            apiClient.put(`/asins/${id}/tags`, { tags }).then((r: any) => r.data),
        { cacheKey: ['asins'], itemKey: 'id', mutationType: 'asin-tag-update',
          applyOptimistic: (cur, { tags }) => ({ ...cur, tags }),
          onSuccessEvent:  'socket:asinUpdated' },
    );

    const { mutate: mutateAck } = useOptimisticMutation(
        (id: string) =>
            apiClient.patch(`/alerts/${id}`, { acknowledged: true }).then((r: any) => r.data),
        { cacheKey: ['alerts'], itemKey: 'id', mutationType: 'alert-ack-toggle',
          applyOptimistic: (cur) => ({ ...cur, acknowledged: true }),
          onSuccessEvent:  'socket:alerts' },
    );

    const { mutate: mutateTaskReassign } = useOptimisticMutation(
        (id: string, { userId }: { userId: string }) =>
            apiClient.put(`/tasks/${id}/assign`, { userId }).then((r: any) => r.data),
        { cacheKey: ['tasks'], itemKey: 'id', mutationType: 'task-reassign',
          applyOptimistic: (cur, { userId }) => ({ ...cur, assignedTo: userId }),
          onSuccessEvent:  'socket:taskUpdated' },
    );

    // ── 9 · Controllers & helper closures ──────────────────────────────────────

    const refetch = useCallback(
        () => void qc.invalidateQueries({ queryKey: QK_DASHBOARD, exact: false }),
        [qc],
    );

    const forceRefresh = useCallback(async () => {
        loader.reset();
        await qc.invalidateQueries({ type: 'active' } as any);
        await qc.refetchQueries({ queryKey: QK_DASHBOARD });
    }, [loader, qc]);

    const updateAsinTag = useCallback(
        (id: string, tags: string[]) => new Promise<void>((done) => {
            void mutateAsinTag({ id, payload: { tags } });
            done();
        }),
        [mutateAsinTag],
    );

    const toggleAlertAck = useCallback(
        (id: string) => new Promise<void>((done) => {
            void mutateAck({ id });
            done();
        }),
        [mutateAck],
    );

    const reassignTask = useCallback(
        (id: string, userId: string) => new Promise<void>((done) => {
            void mutateTaskReassign({ id, payload: { userId } });
            done();
        }),
        [mutateTaskReassign],
    );

    // ── 10 · Return the stable orchestration surface ───────────────────────────
    // Progressive loader gives typed section snapshots; chart data not yet
    // per-sectioned comes from `loader.kpis` which, when configured as the
    // primary /dashboard response, carries the full JSON response object.
    return {
        kpis:           loader.kpis as any ?? null,
        alerts:         loader.alerts as any ?? null,
        targets:        loader.targets ?? null,
        // `dashboardRaw` exposes the full /dashboard response for chart consumers.
        // Reconstructed from the loader's kpis section (the whole-body response).
        dashboardRaw:   loader.kpis as any ?? null,

        isLoadingKpis:  kpisQuery.isFetching  || (loader.kpis  == null),
        isLoadingAlerts:alertsQuery.isFetching || (loader.alerts == null),
        isLoadingTargets:targetsQuery.isFetching || (loader.targets == null),

        errors:         loader.errors,
        isHydrated:     loader.isHydrated,
        priorityFlood:  loader.priorityFlood,

        updateAsinTag,
        toggleAlertAck,
        reassignTask,
        isMutating:     kpisQuery.isFetching || adsPerfQuery.isFetching,

        refetch,
        forceRefresh,
        forceReload:    forceRefresh,

        syncTimestamp:  syncTimestamp,
        connectionStatus:
            connection.connected
                ? 'connected'
                : connection.reconnecting
                    ? 'reconnecting'
                    : 'offline',
    };
}
