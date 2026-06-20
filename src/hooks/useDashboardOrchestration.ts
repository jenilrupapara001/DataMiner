/**
 * useDashboardOrchestration.ts — fully fixed
 */

import {
    useCallback, useEffect, useRef, useState, useMemo
} from 'react';
import {
    useQuery, useQueryClient, keepPreviousData, type QueryKey
} from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { useDashboardStore } from '../store/dashboardStore';
import { EVENT_BUS } from '../store/eventBus';

import { useRealTimeDashboard } from './useRealTimeDashboard';
import { useOptimisticMutation } from './useOptimisticMutation';
import { useProgressiveLoad } from './useProgressiveLoad';

// ─── Segment enum ─────────────────────────────────────────────────────────────

export enum DashboardSegment {
    KPIS = 'kpis',
    REVENUE_SERIES = 'revenueSeries',
    ADS_PERFORMANCE = 'adsPerformance',
    CATEGORIES = 'categories',
    TOP_PRODUCTS = 'topProducts',
    ALERTS = 'alerts',
    TARGETS = 'targets',
}

/** Minimum skeleton delay per segment (ms). */
const SEGMENT_DELAYS: Record<DashboardSegment, number> = {
    [DashboardSegment.KPIS]: 350,
    [DashboardSegment.REVENUE_SERIES]: 400,
    [DashboardSegment.ADS_PERFORMANCE]: 400,
    [DashboardSegment.CATEGORIES]: 500,
    [DashboardSegment.TOP_PRODUCTS]: 450,
    [DashboardSegment.ALERTS]: 200,
    [DashboardSegment.TARGETS]: 350,
};

// ─── Config ───────────────────────────────────────────────────────────────────

export interface OrchestrationConfig {
    pollIntervalSeconds?: number;
    sseEndpoint?: string;
    sseSilenceThresholdSeconds?: number;
    defaultRetryAttempts?: number;
    backoffBaseMs?: number;
    sellerId?: string;
    startDate?: string;
    endDate?: string;
    period?: string;
}

// ─── Query keys ───────────────────────────────────────────────────────────────
// ✅ Fix 11: all keys use `as const` for type consistency

const QK_DASHBOARD = ['dashboard'] as const;
const QK_ALERTS = ['alerts'] as const;
const QK_TARGETS = ['targets'] as const;

// ─── Fix 10: backoff factory defined OUTSIDE hook — stable reference ──────────

function makeBackoffFn(baseMs: number) {
    return (attempt: number) => Math.min(Math.floor(baseMs * 2 ** attempt), 32_000);
}

// ─── Progressive load definitions (typed, no fragile cast) ───────────────────
// ✅ Fix 9: built as a const object, no runtime cast needed

const PROGRESSIVE_DEFINITIONS = Object.fromEntries(
    Object.values(DashboardSegment).map(seg => [
        seg,
        { key: seg, minMs: SEGMENT_DELAYS[seg as DashboardSegment] ?? 400 }
    ])
) satisfies Record<string, { key: string; minMs?: number }>;

// ─── Main hook ────────────────────────────────────────────────────────────────

export function useDashboardOrchestration(cfg: OrchestrationConfig = {}) {
    const {
        pollIntervalSeconds: pollInt = 0,
        sseEndpoint,
        sseSilenceThresholdSeconds: sseSilence = 15,
        defaultRetryAttempts: rawRetries = 3,
        backoffBaseMs: rawBaseMs = 1_000,
        sellerId,
        startDate,
        endDate,
        period,
    } = cfg;

    const retries = Math.max(rawRetries, 1);
    const baseMs = Math.max(rawBaseMs, 100);

    const qc = useQueryClient();
    const relay = EVENT_BUS; // module singleton — stable reference

    // ── Stable backoff functions (created once per hook invocation) ───────────
    const dashboardBackoff = useMemo(() => makeBackoffFn(baseMs), [baseMs]);
    const alertsBackoff = useMemo(() => makeBackoffFn(500), []);
    const targetsBackoff = useMemo(() => makeBackoffFn(baseMs), [baseMs]);

    // ── Zustand selectors ─────────────────────────────────────────────────────
    const setKpis = useDashboardStore(s => s.setKpis);
    const setAlerts = useDashboardStore(s => s.setAlerts);
    const setTargets = useDashboardStore(s => s.setTargets);
    const setSyncTime = useDashboardStore(s => s.setSyncTime);
    const connection = useDashboardStore(s => s.connection);
    const syncTimestamp = useDashboardStore(s => s.cache.syncTimestamp);

    // ── 1 · Real-time ─────────────────────────────────────────────────────────
    useRealTimeDashboard({
        sseEndpoint,
        unhealthyAfterSeconds: sseSilence,
    });

    // ── 2 · Progressive skeleton ──────────────────────────────────────────────
    const loader = useProgressiveLoad(PROGRESSIVE_DEFINITIONS);

    // ── 3 · React Query — dashboard (includes filter params in key) ───────────
    // ✅ Fix 1: REMOVED withRetry — React Query handles retries natively.
    // Double-retry (fetchWithRetry × React Query retry) = N² retry storm.
    const dashboardQuery = useQuery({
        queryKey: [...QK_DASHBOARD, sellerId, startDate, endDate, period],
        queryFn: async () => {
            const r = await apiClient.get('/dashboard', {
                params: { sellerId, startDate, endDate, period }
            });
            return (r as any).data;
        },
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: retries,
        retryDelay: dashboardBackoff,
    });

    // ✅ Fix 3: alerts + targets query keys include filter params
    // Previously they had static keys — never refetched when seller/date changed
    const alertsQuery = useQuery({
        queryKey: [...QK_ALERTS, sellerId],
        queryFn: async () => {
            const r = await apiClient.get('/alerts', { params: { sellerId } });
            return (r as any).data?.data ?? (r as any).data;
        },
        staleTime: 2 * 60_000,
        gcTime: 4 * 60_000,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 2,
        retryDelay: alertsBackoff,
    });

    const targetsQuery = useQuery({
        queryKey: [...QK_TARGETS, sellerId],
        queryFn: async () => {
            const r = await apiClient.get('/targets', { params: { sellerId } });
            return (r as any).data?.data ?? (r as any).data;
        },
        staleTime: 4 * 60_000,
        gcTime: 8 * 60_000,
        placeholderData: keepPreviousData,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: retries,
        retryDelay: targetsBackoff,
    });

    // ── 4 · Route query results into progressive loader ───────────────────────

    const { receive: loaderReceive, reject: loaderReject } = loader;

    const {
        isFetched: dashFetched, isError: dashError,
        data: dashData, error: dashErr
    } = dashboardQuery;

    const {
        isFetched: alertsFetched, isError: alertsError,
        data: alertsData, error: alertsErr
    } = alertsQuery;

    const {
        isFetched: targetsFetched, isError: targetsError,
        data: targetsData, error: targetsErr
    } = targetsQuery;

    useEffect(() => {
        if (!dashFetched) return;
        if (dashError) {
            const msg = (dashErr as any)?.message ?? 'Load failed';
            loaderReject(DashboardSegment.KPIS, msg);
            loaderReject(DashboardSegment.REVENUE_SERIES, msg);
            loaderReject(DashboardSegment.ADS_PERFORMANCE, msg);
            loaderReject(DashboardSegment.CATEGORIES, msg);
            loaderReject(DashboardSegment.TOP_PRODUCTS, msg);
        } else if (dashData) {
            loaderReceive(DashboardSegment.KPIS, dashData.kpi ?? dashData.kpis ?? []);
            loaderReceive(DashboardSegment.REVENUE_SERIES, dashData.stackedBarSeries ?? []);
            loaderReceive(DashboardSegment.ADS_PERFORMANCE, dashData.adsPerformanceSeries ?? []);
            loaderReceive(DashboardSegment.CATEGORIES, dashData.category ?? []);
            loaderReceive(DashboardSegment.TOP_PRODUCTS, dashData.tableData ?? dashData.topProducts ?? []);
        }
    }, [dashFetched, dashError, dashData, dashErr, loaderReceive, loaderReject]);

    useEffect(() => {
        if (!alertsFetched) return;
        alertsError
            ? loaderReject(DashboardSegment.ALERTS, (alertsErr as any)?.message ?? 'Load failed: alerts')
            : loaderReceive(DashboardSegment.ALERTS, alertsData ?? []);
    }, [alertsFetched, alertsError, alertsData, alertsErr, loaderReceive, loaderReject]);

    useEffect(() => {
        if (!targetsFetched) return;
        targetsError
            ? loaderReject(DashboardSegment.TARGETS, (targetsErr as any)?.message ?? 'Load failed: targets')
            : loaderReceive(DashboardSegment.TARGETS, targetsData ?? []);
    }, [targetsFetched, targetsError, targetsData, targetsErr, loaderReceive, loaderReject]);

    // ── 5 · Sync Zustand AFTER loader resolves ─────────────────────────────
    // ✅ Fix 4: hash compares full serialised content, not just length
    // ✅ Fix 6: dashboardRaw derived from dashData (query cache) — never stale
    const hashRef = useRef<string>('');

    useEffect(() => {
        if (!loader.isHydrated) return;

        // Stringify actual content — catches same-length data changes
        const h = [
            JSON.stringify(loader.kpis),
            JSON.stringify(loader.alerts),
            JSON.stringify(loader.targets),
        ].join('||');

        if (h === hashRef.current) return;
        hashRef.current = h;

        setKpis(loader.kpis as any);
        setAlerts(loader.alerts as any);
        setTargets(loader.targets as any);
        setSyncTime(new Date().toISOString());
    }, [
        loader.isHydrated,
        loader.kpis,
        loader.alerts,
        loader.targets,
        setKpis, setAlerts, setTargets, setSyncTime
    ]);

    // ── 6 · Polling ───────────────────────────────────────────────────────────
    // ✅ Fix 7: use globalThis.setInterval — works in SSR and browser
    const pollHandle = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const ms = Math.max(pollInt, 0) * 1_000;
        if (ms <= 0) return;

        pollHandle.current = globalThis.setInterval(() => {
            void qc.invalidateQueries({
                queryKey: QK_DASHBOARD,
                exact: false,
                refetchType: 'active'
            });
        }, ms);

        return () => {
            if (pollHandle.current) clearInterval(pollHandle.current);
        };
    }, [pollInt, qc]);

    // ── 7 · Event bus → React Query bridge ───────────────────────────────────
    // ✅ Fix 8: cleanup returned directly — no unsubBridge ref needed
    useEffect(() => {
        const onInvalidate = (evt: any) => {
            if (evt?.queryKey) void qc.invalidateQueries({ queryKey: evt.queryKey });
        };
        const onGlobal = () => {
            void qc.invalidateQueries({ queryKey: QK_DASHBOARD as unknown as QueryKey, exact: false });
        };

        relay.on('realtime:dataUpdated', onInvalidate);
        relay.on('realtime:invalidateAll', onGlobal);

        return () => {
            relay.off('realtime:dataUpdated', onInvalidate);
            relay.off('realtime:invalidateAll', onGlobal);
        };
    }, [qc, relay]);

    // ── 8 · Optimistic mutations ──────────────────────────────────────────────

    const { mutate: mutateAsinTag } = useOptimisticMutation(
        (id: string, payload: { tags: string[] }) =>
            apiClient.put(`/asins/${id}/tags`, payload).then((r: any) => r.data),
        {
            cacheKey: ['asins'],
            itemKey: 'id',
            mutationType: 'asin-tag-update',
            applyOptimistic: (cur: any, { tags }: any) => ({ ...cur, tags }),
            onSuccessEvent: 'socket:asinUpdated',
        },
    );

    const { mutate: mutateAck } = useOptimisticMutation(
        (id: string) =>
            apiClient.patch(`/alerts/${id}`, { acknowledged: true }).then((r: any) => r.data),
        {
            cacheKey: ['alerts'],
            itemKey: 'id',
            mutationType: 'alert-ack-toggle',
            applyOptimistic: (cur: any) => ({ ...cur, acknowledged: true }),
            onSuccessEvent: 'socket:alerts',
        },
    );

    const { mutate: mutateTaskReassign } = useOptimisticMutation(
        (id: string, payload: { userId: string }) =>
            apiClient.put(`/tasks/${id}/assign`, payload).then((r: any) => r.data),
        {
            cacheKey: ['tasks'],
            itemKey: 'id',
            mutationType: 'task-reassign',
            applyOptimistic: (cur: any, { userId }: any) => ({ ...cur, assignedTo: userId }),
            onSuccessEvent: 'socket:taskUpdated',
        },
    );

    // ── 9 · Public action helpers ─────────────────────────────────────────────
    // ✅ Fix 2: async helpers now correctly await mutation completion
    // Previously: new Promise((done) => { void mutate(); done(); })
    // = promise resolved BEFORE mutation finished — fake async

    const refetch = useCallback(
        () => qc.invalidateQueries({
            queryKey: QK_DASHBOARD as unknown as QueryKey,
            exact: false
        }),
        [qc],
    );

    const forceRefresh = useCallback(async () => {
        // ✅ Fix 5: reset loader AFTER invalidation completes, not before
        // Previously called loader.reset() then immediately invalidated
        // causing race where skeleton resets mid-fetch
        setDashboardRawRef.current = null;

        await qc.invalidateQueries({ type: 'active' } as any);
        await qc.refetchQueries({ queryKey: QK_DASHBOARD as unknown as QueryKey });

        // Reset loader skeleton only after refetch is initiated
        loader.reset();
    }, [loader, qc]);

    // ✅ Fix 2 + Fix 14: correct mutation call signature + real async wait
    const updateAsinTag = useCallback(
        (id: string, tags: string[]): Promise<void> =>
            new Promise((resolve, reject) => {
                mutateAsinTag(
                    id,
                    { tags },
                    {
                        onSuccess: () => resolve(),
                        onError: (e: any) => reject(e),
                    } as any
                );
            }),
        [mutateAsinTag],
    );

    const toggleAlertAck = useCallback(
        (id: string): Promise<void> =>
            new Promise((resolve, reject) => {
                mutateAck(
                    id,
                    undefined as any,
                    {
                        onSuccess: () => resolve(),
                        onError: (e: any) => reject(e),
                    } as any
                );
            }),
        [mutateAck],
    );

    const reassignTask = useCallback(
        (id: string, userId: string): Promise<void> =>
            new Promise((resolve, reject) => {
                mutateTaskReassign(
                    id,
                    { userId },
                    {
                        onSuccess: () => resolve(),
                        onError: (e: any) => reject(e),
                    } as any
                );
            }),
        [mutateTaskReassign],
    );

    // ── 10 · dashboardRaw — derived from query cache, never stale ────────────
    // ✅ Fix 6: replaced useState/setDashboardRaw with direct reference to
    // dashboardQuery.data — always in sync with React Query cache, zero lag
    const setDashboardRawRef = useRef<any>(null); // used only by forceRefresh reset

    // ✅ Fix 12: removed `as any ?? null` pattern — use proper null-safe access
    const kpisData = loader.kpis ?? null;
    const alertsData2 = loader.alerts ?? null;
    const targetsData2 = loader.targets ?? null;
    const topProductsData = loader.topProducts ?? null;

    // ── 11 · Stable return surface ─────────────────────────────────────────────
    return {
        // Section data
        kpis: kpisData,
        alerts: alertsData2,
        targets: targetsData2,
        topProducts: topProductsData,

        // ✅ Fix 6: dashboardRaw comes from React Query cache directly — never stale
        dashboardRaw: dashData ?? null,

        // Loading states
        isLoadingKpis: dashboardQuery.isLoading || kpisData == null,
        isLoadingAlerts: alertsQuery.isLoading || alertsData2 == null,
        isLoadingTargets: targetsQuery.isLoading || targetsData2 == null,

        // Orchestration state
        errors: loader.errors,
        isHydrated: loader.isHydrated,
        priorityFlood: loader.priorityFlood,

        // Actions
        updateAsinTag,
        toggleAlertAck,
        reassignTask,
        isMutating: dashboardQuery.isFetching,

        // Refresh controls
        refetch,
        forceRefresh,
        forceReload: forceRefresh,  // alias

        // Sync metadata
        syncTimestamp,
        connectionStatus: connection.connected
            ? 'connected'
            : connection.reconnecting
                ? 'reconnecting'
                : 'offline',
    } as const;
}