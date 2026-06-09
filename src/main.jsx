import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'rsuite/dist/rsuite-no-reset.min.css';
import './styles/rsuite-overrides.css';
import './index.css'
import './styles/global-overrides.css'
import App from './App.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CometChatProvider } from './CometChat/context/CometChatContext';

/**
 * Exponential-backoff retry delay function.
 * Attempt index 0 → baseMs×2⁰ = baseMs
 * Attempt index 1 → baseMs×2¹ = 2× baseMs
 * …capped to 32 s for network blips that just need a breath.
 */
function makeRetryDelay(baseMs) {
    return (attempt) => Math.min(Math.floor(baseMs * 2 ** attempt), 32_000);
}

// Shared read-layer defaults — used as fallback by all dominion hooks
const DEFAULT_QUERY_OPTS = {
    refetchOnWindowFocus:  false,
    refetchOnReconnect:    true,
    staleTime:             4 * 60_000,          // 4 min — "fresh enough" window
    gcTime:                15 * 60_000,         // 15 min — eviction from memory
    retry:                 2,
    retryDelay:            makeRetryDelay(1_000),
    networkMode:           'online',
};

// Mutation defaults — slightly more aggressive retry (usually single shot)
const DEFAULT_MUTATION_OPTS = {
    retry:       1,
    retryDelay:  makeRetryDelay(500),
    networkMode: 'online',
    gcTime:      5 * 60_000,
};

// Global error logger — silently records any orphaned errors in dev
const globalErrorHandler = (error) => {
    if (import.meta.env.DEV) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.warn('[React Query] Unhandled error:', msg);
    }
    return undefined;
};

/**
 * Pre-hydrate the client so the very first paint uses warmed cache if
 * a prior session persisted values to localStorage.
 */
async function hydrateIfPossible(qc) {
    await requestIdleCallback?.(async () => {
        try {
            await qc.resumePausedMutations?.();
        } catch {
        }
    }, { timeout: 60_000 });
}

const queryClient = new QueryClient({
    // Every query in the app inherits from here unless overridden in-use
    defaultOptions: {
        queries:    DEFAULT_QUERY_OPTS,
        mutations:  DEFAULT_MUTATION_OPTS,
    },
    // Writes to the error bus without blocking yield points
    onError:     globalErrorHandler,
    // Network re-entrant hook-in — not yet used but kept for future SSE reconnect
    onMutate:    undefined,
    // Placeholder for a future analytics hook
    onSuccess:   undefined,
    // Hook for post-invalidation side effects (optimistic confirmation UIs, etc.)
    onSettled:   undefined,
    // Texture-quality signal — hook in at build-time per standard
    // (kept as undefined so main thread remains the source of truth)

    onConnect: undefined,
});

// Pre-hydrate once QueryClient is fully constructed (async-safe)
hydrateIfPossible(queryClient).catch(console.warn);

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <QueryClientProvider client={queryClient}>
            <CometChatProvider>
                <App />
            </CometChatProvider>
        </QueryClientProvider>
    </BrowserRouter>,
);
