import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useInfiniteData
 * ─────────────────────────────────────────────────────────────────────────────
 * A self-contained infinite-scroll data hook.
 *
 * Features:
 *  - IntersectionObserver sentinel on the last rendered element
 *  - AbortController cancels in-flight requests on unmount or re-fetch
 *  - Configurable minimum loading time (prevents skeleton flash)
 *  - Retry with configurable delay and count
 *  - `refresh()` resets state and restarts from page 1
 *
 * @param {function}  fetchFn           Async fn({ page, pageSize, signal }) → { data: [], total? }
 * @param {object}    [options]
 * @param {number}    [options.pageSize=20]
 * @param {number}    [options.threshold=200]     rootMargin pixels before sentinel is visible
 * @param {boolean}   [options.enabled=true]      Set false to skip auto-fetch
 * @param {number}    [options.minLoadingMs=300]  Minimum ms to show skeleton (prevents flash)
 * @param {number}    [options.retryCount=2]
 * @param {number}    [options.retryDelayMs=1000]
 * @param {function}  [options.onSuccess]
 * @param {function}  [options.onError]
 *
 * @returns {{
 *   data: any[],
 *   loading: boolean,
 *   initialLoading: boolean,
 *   hasMore: boolean,
 *   error: string|null,
 *   lastElementRef: (node: HTMLElement|null) => void,
 *   refresh: () => void,
 *   loadMore: () => void,
 *   total: number|null,
 * }}
 *
 * @example
 *   const { data, loading, initialLoading, hasMore, lastElementRef, refresh } =
 *     useInfiniteData(
 *       ({ page, pageSize, signal }) =>
 *         fetch(`/api/asins?page=${page}&limit=${pageSize}`, { signal }).then(r => r.json()),
 *       { pageSize: 30 }
 *     );
 * ─────────────────────────────────────────────────────────────────────────────
 */
export default function useInfiniteData(fetchFn, options = {}) {
  const {
    pageSize      = 20,
    threshold     = 200,
    enabled       = true,
    minLoadingMs  = 300,
    retryCount    = 2,
    retryDelayMs  = 1_000,
    onSuccess,
    onError,
  } = options;

  const [data,           setData]           = useState([]);
  const [page,           setPage]           = useState(1);
  const [loading,        setLoading]        = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore,        setHasMore]        = useState(true);
  const [error,          setError]          = useState(null);
  const [total,          setTotal]          = useState(null);

  const abortRef   = useRef(null);
  const observerRef = useRef(null);
  const pageRef    = useRef(page);   // stable ref so loadMore closure doesn't go stale
  const loadingRef = useRef(loading);
  const hasMoreRef = useRef(hasMore);

  pageRef.current    = page;
  loadingRef.current = loading;
  hasMoreRef.current = hasMore;

  // ── Retry helper ───────────────────────────────────────────────────────────
  const withRetry = useCallback(async (fn, retriesLeft, signal) => {
    try {
      return await fn(signal);
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (retriesLeft <= 0) throw err;
      await new Promise(r => setTimeout(r, retryDelayMs));
      return withRetry(fn, retriesLeft - 1, signal);
    }
  }, [retryDelayMs]);

  // ── Core load function ─────────────────────────────────────────────────────
  const loadPage = useCallback(async (targetPage, isFirstPage) => {
    if (loadingRef.current && !isFirstPage) return;
    if (!hasMoreRef.current && !isFirstPage)  return;
    if (!enabled) return;

    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);
    if (isFirstPage) setInitialLoading(true);
    setError(null);

    const t0 = Date.now();

    try {
      const result = await withRetry(
        (sig) => fetchFn({ page: targetPage, pageSize, signal: sig }),
        retryCount,
        signal
      );

      // Enforce minimum loading time on first page (prevents skeleton flash)
      if (isFirstPage) {
        const elapsed = Date.now() - t0;
        if (elapsed < minLoadingMs) {
          await new Promise(r => setTimeout(r, minLoadingMs - elapsed));
        }
      }

      if (signal.aborted) return;

      const items = Array.isArray(result?.data) ? result.data
        : Array.isArray(result)                  ? result
        : [];

      setData(prev => isFirstPage ? items : [...prev, ...items]);
      setHasMore(items.length >= pageSize);
      if (result?.total !== undefined) setTotal(result.total);
      setPage(targetPage + 1);
      onSuccess?.(items);
    } catch (err) {
      if (err.name === 'AbortError') return;
      const msg = err?.message ?? 'Failed to load data';
      setError(msg);
      setHasMore(false);
      onError?.(err);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [enabled, fetchFn, minLoadingMs, onError, onSuccess, pageSize, retryCount, withRetry]);

  // ── Public load-more (called by sentinel observer) ─────────────────────────
  const loadMore = useCallback(() => {
    if (!loadingRef.current && hasMoreRef.current && enabled) {
      loadPage(pageRef.current, false);
    }
  }, [enabled, loadPage]);

  // ── Public refresh ─────────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setData([]);
    setPage(1);
    setHasMore(true);
    setError(null);
    setInitialLoading(true);
    // loadPage will be called by the effect below because initialLoading changed
    loadPage(1, true);
  }, [loadPage]);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (enabled) loadPage(1, true);
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ── IntersectionObserver sentinel ref ─────────────────────────────────────
  const lastElementRef = useCallback((node) => {
    if (loading) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: `${threshold}px` }
    );

    if (node) observerRef.current.observe(node);
  }, [loading, loadMore, threshold]);

  return { data, loading, initialLoading, hasMore, error, lastElementRef, refresh, loadMore, total };
}
