// Single source of truth for all target data + mutations
import { useState, useEffect, useCallback, useRef } from 'react';
import { notification } from 'antd';
import { targetsCache } from '../services/targetsCache';
import { targetsApi } from '../services/api';

// Debounce helper
function useDebouncedCallback(fn, delay) {
    const timer = useRef();
    const fnRef = useRef(fn);
    fnRef.current = fn;

    return useCallback((...args) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => fnRef.current(...args), delay);
    }, [delay]);
}

export function useTargetsData(customNotificationApi) {
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingIds, setSavingIds] = useState(new Set());
    const [errorIds, setErrorIds] = useState(new Map());
    const [localNotifApi, localContextHolder] = notification.useNotification();

    const notifApi = customNotificationApi || localNotifApi;
    const contextHolder = customNotificationApi ? null : localContextHolder;
    const notifRef = useRef(notifApi);

    useEffect(() => {
        notifRef.current = notifApi;
    }, [notifApi]);

    // Subscribe to cache
    useEffect(() => {
        const unsub = targetsCache.subscribe((data) => {
            setTargets([...data]); // spread to ensure new reference
            setLoading(false);
        });

        // Initial fetch
        setLoading(true);
        targetsCache.fetch().catch(() => setLoading(false));

        // Start background polling (every 30 seconds)
        targetsCache.startPolling(30000);

        return () => {
            unsub();
            targetsCache.stopPolling();
        };
    }, []);

    // ──────────────────────────────────────────────────────────────────────
    // CREATE — optimistic insert + real API call
    // ──────────────────────────────────────────────────────────────────────
    const createTargets = useCallback(async (payload) => {
        const tempIds = payload.map((_, i) => `temp_${Date.now()}_${i}`);

        // ① Instant optimistic inserts
        payload.forEach((p, i) => {
            targetsCache.optimisticInsert(tempIds[i], {
                SellerId: p.sellerId,
                BrandManager: p.brandManager,
                TargetType: p.targetType,
                Year: p.year,
                Month: p.month,
                TotalTargetValue: p.totalTargetValue,
                GoalType: p.goalType || 'GMS',
                overallAchieved: 0,
                monthlyBreakdown: p.breakdowns,
            });
        });

        try {
            // ② Real API call
            const res = await targetsApi.create(payload);

            if (res?.success) {
                // ③ Replace temp records with real server data
                const serverRecords = Array.isArray(res.data) ? res.data : [res.data];
                tempIds.forEach((tid, i) => {
                    if (serverRecords[i]) {
                        targetsCache.confirmInsert(tid, serverRecords[i]);
                    } else {
                        targetsCache.rollbackInsert(tid);
                    }
                });

                notifRef.current.success({
                    message: 'Targets are live!',
                    description: `${payload.length} target${payload.length > 1 ? 's' : ''} created successfully.`,
                    duration: 3,
                });
                return true;
            } else {
                tempIds.forEach((tid) => targetsCache.rollbackInsert(tid));
                notifRef.current.error({
                    message: 'Could not create targets',
                    description: res?.message || 'Server error',
                });
            }
        } catch (e) {
            // ④ Rollback all on failure
            tempIds.forEach((tid) => targetsCache.rollbackInsert(tid));
            notifRef.current.error({
                message: 'Could not create targets',
                description: e.message,
            });
        }
        return false;
    }, []);

    // ──────────────────────────────────────────────────────────────────────
    // UPDATE — optimistic patch + debounced API call
    // ──────────────────────────────────────────────────────────────────────
    const _doUpdate = useCallback(async (id, totalTargetValue, breakdowns, previousData) => {
        const requestKey = `update_${id}`;
        setSavingIds((s) => {
            const next = new Set(s);
            next.add(id);
            return next;
        });
        setErrorIds((m) => {
            const next = new Map(m);
            next.delete(id);
            return next;
        });

        try {
            const signal = targetsCache.getAbortSignal(requestKey);
            await targetsApi.update(id, totalTargetValue, breakdowns, { signal });

            // Recalculate overallAchieved from breakdowns
            const overallAchieved = breakdowns.reduce((sum, b) => sum + (b.achievedValue || b.AchievedValue || 0), 0);

            // Confirm patch — remove _optimistic flag
            targetsCache.optimisticPatch(id, { _optimistic: false, overallAchieved });
        } catch (e) {
            if (e.name === 'AbortError') return; // cancelled by next debounce — not an error

            // Rollback to previous values
            targetsCache.rollback(id, previousData);
            setErrorIds((m) => {
                const next = new Map(m);
                next.set(id, e.message);
                return next;
            });
            notifRef.current.error({
                message: 'Update failed — changes reversed',
                description: e.message,
                duration: 5,
            });
        } finally {
            setSavingIds((s) => {
                const next = new Set(s);
                next.delete(id);
                return next;
            });
        }
    }, []);

    // Debounce updates — 400ms wait after last keystroke before firing API
    const debouncedUpdate = useDebouncedCallback(_doUpdate, 400);

    const updateTarget = useCallback((id, totalTargetValue, breakdowns) => {
        // ① Save snapshot for rollback BEFORE optimistic update
        const previousData = targets.find((t) => t.Id === id || t.id === id);
        if (!previousData) return;

        // ② Instant optimistic update — UI reflects immediately
        const optimisticBreakdowns = breakdowns.map((b) => ({
            PeriodValue: b.periodValue || b.PeriodValue,
            TargetValue: b.targetValue || b.TargetValue,
            AchievedValue: b.achievedValue || b.AchievedValue || 0,
            PercentageContribution: b.percentageContribution || b.PercentageContribution || 0,
        }));

        const overallAchieved = breakdowns.reduce((sum, b) => sum + (b.achievedValue || b.AchievedValue || 0), 0);

        targetsCache.optimisticPatch(id, {
            TotalTargetValue: totalTargetValue,
            monthlyBreakdown: optimisticBreakdowns,
            overallAchieved,
        });

        // ③ Debounced API call — fires 400ms after last change
        debouncedUpdate(id, totalTargetValue, breakdowns, previousData);
    }, [targets, debouncedUpdate]);

    // ──────────────────────────────────────────────────────────────────────
    // DELETE — optimistic remove + real API call
    // ──────────────────────────────────────────────────────────────────────
    const deleteTargets = useCallback(async (ids) => {
        // ① Instant optimistic remove
        const snapshot = targetsCache.optimisticDelete(ids);

        try {
            if (ids.length === 1) {
                await targetsApi.delete(ids[0]);
            } else {
                await targetsApi.deleteBulk(ids);
            }
            notifRef.current.success({
                message: `${ids.length > 1 ? `${ids.length} targets` : 'Target'} removed`,
                duration: 3,
            });
            return true;
        } catch (e) {
            // ② Rollback deleted records
            targetsCache.rollbackDelete(snapshot);
            notifRef.current.error({
                message: 'Could not delete',
                description: e.message,
            });
        }
        return false;
    }, []);

    // Force refresh from server
    const refresh = useCallback(async () => {
        setLoading(true);
        targetsCache.invalidate();
        await targetsCache.fetch(true);
    }, []);

    return {
        targets,
        loading,
        savingIds,
        errorIds,
        createTargets,
        updateTarget,
        deleteTargets,
        refresh,
        contextHolder,
    };
}
