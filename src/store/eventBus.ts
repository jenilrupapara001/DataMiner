/**
 * Global event-bus used for cross-cutting state synchronization:
 *  - Socket events → React Query invalidation
 *  - React Query mutations → Zustand optimistic updates
 *
 * Implemented as a thin wrapper over the browser EventTarget API
 * so it requires zero additional dependency.
 */
class GlobalEventBus {
    #target = new EventTarget();

    on(event: string, fn: EventListenerOrEventListenerObject) {
        this.#target.addEventListener(event, fn);
    }

    off(event: string, fn: EventListenerOrEventListenerObject) {
        this.#target.removeEventListener(event, fn);
    }

    emit(event: string, detail?: any) {
        this.#target.dispatchEvent(new CustomEvent(event, { detail }));
    }
}

export const EVENT_BUS = new GlobalEventBus();

/**
 * Published event names (keep in sync across the codebase):
 *
 * Socket → cache:
 *   'socket:dataUpdate'         — generic dashboard refresh
 *   'socket:asinUpdated'        — an ASIN record changed
 *   'socket:targetReached'      — a goal/target milestone changed
 *   'socket:alerts'             — new alert arrived
 *   'socket:sellerSynced'       — seller data synced
 *   'socket:taskUpdated'        — task lifecycle event
 *   'realtime:connected'
 *   'realtime:disconnected'
 *   'realtime:error'
 *
 * Optimistic UI:
 *   'optimistic:updated'        — an optimistic patch landed
 *   'optimistic:reverted'       — optimistic patch rolled back
 *   'optimistic:completed'      — server confirmed un-optimistically
 */
