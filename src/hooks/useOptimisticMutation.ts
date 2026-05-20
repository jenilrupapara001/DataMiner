/**
 * useOptimisticMutation
 *
 * Wraps a React Query mutation so the UI updates immediately (optimistic) and
 * auto-rolls back when the server rejects the change.
 *
 * Designed as a thin wrapper — generic and focused on one job:
 *  apply optimistic patch → fire mutation → confirm or rollback.
 *
 * Example:
 * ```ts
 * const { mutate } = useOptimisticMutation(
 *   (asinId, { tags }) => asinApi.updateTags(asinId, tags),
 *   { cacheKey: ['asins'], itemKey: 'id' }
 * );
 * void mutate({ id: 'xyz', payload: { tags: ['a', 'b'] } });
 * ```
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDashboardStore } from '../store/dashboardStore';
import { EVENT_BUS } from '../store/eventBus';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseOptimisticMutationConfig<TItem, TPayload> {
    /** Apply the patch to the local record before the network call. */
    applyOptimistic?:  (item: TItem, patch: TPayload) => TItem;
    /** Revert on server rejection (defaults to no-op). */
    revertOptimistic?: (item: TItem) => TItem;
    /** RQ cache key to invalidate on success. */
    cacheKey?:         unknown[];
    /** Unique-identifier field name (default: 'id'). */
    itemKey?:          string;
    /** Short label for the pending-queue log. */
    mutationType?:     string;
    /** EVENT_BUS event fired on success. */
    onSuccessEvent?:   string;
    /** EVENT_BUS event fired on error. */
    onErrorEvent?:     string;
    /** Extra options forwarded to `useMutation`. */
    mutationOptions?:  Parameters<typeof useMutation>[0];
}

// ─── Factory ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useOptimisticMutation<TItem = any, TPayload = any>(
    apiFn:         (id: string, patch: TPayload) => Promise<unknown>,
    config:        UseOptimisticMutationConfig<TItem, TPayload> = {},
) {
    const {
        itemKey          = 'id',
        cacheKey,
        mutationType     = 'custom',
        applyOptimistic  = ((current: TItem, _patch: TPayload) => current) as any,
        revertOptimistic = (_: TItem) => _ as  TItem,
        onSuccessEvent,
        onErrorEvent,
        mutationOptions,
    } = config;

    const qc            = useQueryClient();
    const addPending    = useDashboardStore((s) => s.addPendingMutation);
    const resolveMut    = useDashboardStore((s) => s.resolvePendingMutation);

    const mutation = useMutation({
        async mutationFn(args: { id: string; payload: TPayload }): Promise<unknown> {
            return apiFn(args.id, args.payload);
        },
        mutationKey: () => [mutationType] as unknown as string[],

        // apiFn already wraps the physical call with its own retry strategy
        // (uses `fetchWithRetry`).  Keep RQ retry minimal to avoid double-retry.
        retry: 1,
        retryDelay: (attempt: number) => Math.min(500 * 2 ** attempt, 8_000),

        onMutate: async (variables: { id: string; payload: TPayload }) => {
            await qc.cancelQueries({ queryKey: [] } as any);

            if (!cacheKey) return;

            const mutId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            const saved = qc.getQueriesData({ queryKey: cacheKey });

            for (const [, data] of saved) {
                const arr = Array.isArray(data) ? data : (data ? [data] : []);
                const idx = arr.findIndex(
                    (r) => String((r as Record<string, any>)[itemKey]) === String(variables.id),
                );

                if (idx === -1) continue;

                const record = arr[idx] as Record<string, any>;
                const prev   = JSON.parse(JSON.stringify(record));

                Object.assign((arr as Record<string, any>[])[idx],
                    applyOptimistic(record as TItem, variables.payload));

                qc.setQueryData(cacheKey, arr);

                addPending({
                    id:          mutId,
                    type:        mutationType as any,
                    optimistic:  record,
                    original:    prev,
                    timestamp:   Date.now(),
                });

                EVENT_BUS.emit('optimistic:updated', {
                    id:      mutId,
                    itemId:  variables.id as unknown as string,
                    type:    mutationType,
                });
            }
        },

        onSuccess: (_data, variables, _ctx) => {
            if (cacheKey)
                void qc.invalidateQueries({ queryKey: cacheKey });
            if (onSuccessEvent)
                EVENT_BUS.emit(onSuccessEvent, { variables: JSON.stringify(variables) });
            EVENT_BUS.emit('optimistic:completed', { type: mutationType, success: true });
        },

        onError: (error, variables, _ctx) => {
            if (cacheKey)
                void qc.invalidateQueries({ queryKey: cacheKey });
            useDashboardStore.getState().rollbackPendingMutations();
            if (onErrorEvent)
                EVENT_BUS.emit(onErrorEvent, { error: JSON.stringify(error), variables: JSON.stringify(variables) });
            EVENT_BUS.emit('optimistic:reverted', {
                type: mutationType,
                error: error instanceof Error ? error.message : String(error),
            });
        },

        onSettled: (_data, _error, variables, _ctx) => {
            if (cacheKey)
                void qc.invalidateQueries({ queryKey: cacheKey });
        },

        ...mutationOptions as any,
    });

    // ── Return stable surface ──────────────────────────────────────────────────
    return {
        mutate:      mutation.mutate as (args: { id: string; payload?: any }) => void,
        mutateAsync:mutation.mutateAsync as any,
        isPending:   mutation.isPending,
        isError:     mutation.isError,
        error:       mutation.error as Error | null,
        reset:       mutation.reset,
    };
}
