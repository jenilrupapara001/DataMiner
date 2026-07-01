/**
 * RetailOps Partner — API Client
 *
 * HTTP client with retry logic, error handling, and token management.
 */

import { API_CONFIG } from './config';

// ============================================================
// TYPES
// ============================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  skipAuth?: boolean;
}

// ============================================================
// TOKEN STORAGE (will be replaced with SecureStore in production)
// ============================================================

let accessToken: string | null = null;
let refreshToken: string | null = null;

export const tokenManager = {
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,
  setTokens: (access: string, refresh: string) => {
    accessToken = access;
    refreshToken = refresh;
  },
  clearTokens: () => {
    accessToken = null;
    refreshToken = null;
  },
  isAuthenticated: () => !!accessToken,
};

// ============================================================
// CUSTOM ERROR CLASS
// ============================================================

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ============================================================
// API CLIENT
// ============================================================

class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(baseUrl: string, timeout: number) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = timeout;

    // Log config once on init so you can verify it in Metro
    console.log('[API] Initialized', {
      baseUrl,
      timeoutMs: timeout,
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = this.defaultTimeout,
      retries = 0,
      skipAuth = false,
      ...fetchOptions
    } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const method = fetchOptions.method || 'GET';

    // ── Build headers ──────────────────────────────
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    if (!skipAuth) {
      const token = tokenManager.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // ── Timeout / abort setup ──────────────────────
    const controller = new AbortController();
    let didTimeout = false;

    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeout);

    const startTime = Date.now();
    console.log(`[API] → ${method} ${url} (timeout: ${timeout}ms)`);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      console.log(`[API] ← ${response.status} ${url} (${elapsed}ms)`);

      // ── Parse body safely ────────────────────────
      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseErr) {
          console.warn('[API] Failed to parse JSON body:', parseErr);
          data = null;
        }
      } else {
        // Non-JSON — still try to read text for error messages
        try {
          const text = await response.text();
          data = text ? { message: text } : null;
        } catch {
          data = null;
        }
      }

      // ── Handle HTTP errors ────────────────────────
      if (!response.ok) {
        const errorMessage =
          (data && (data.message || data.error)) ||
          `Request failed with status ${response.status}`;

        if (response.status === 429) {
          throw new ApiError(
            'Too many requests. Please try again later.',
            429,
            data
          );
        }

        if (response.status === 401) {
          tokenManager.clearTokens();
          throw new ApiError(
            'Session expired. Please login again.',
            401,
            data
          );
        }

        throw new ApiError(errorMessage, response.status, data);
      }

      // If no JSON body but request was OK, return a minimal success
      if (data === null) {
        return { success: true } as ApiResponse<T>;
      }

      return data as ApiResponse<T>;
    } catch (error: any) {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      // ── Re-throw ApiError as-is (from HTTP-error branch) ──
      if (error instanceof ApiError) {
        console.error(
          `[API] ✗ ApiError ${error.status} after ${elapsed}ms:`,
          error.message
        );
        throw error;
      }

      // ── Detect abort (native + polyfill variants) ──
      const isAbort =
        error?.name === 'AbortError' ||
        error?.code === 20 || // DOMException.ABORT_ERR
        error?.message?.toLowerCase().includes('abort');

      if (isAbort) {
        if (didTimeout) {
          console.error(
            `[API] ✗ Timeout after ${elapsed}ms (limit ${timeout}ms): ${url}`
          );
          throw new ApiError(
            `Request timed out after ${Math.round(
              timeout / 1000
            )}s. Please check your connection.`,
            408
          );
        }

        // Manual abort — usually from component unmount / navigation
        console.warn(
          `[API] ✗ Request cancelled after ${elapsed}ms: ${url}`
        );
        throw new ApiError('Request was cancelled.', 0);
      }

      // ── Network errors ────────────────────────────
      const msg = (error?.message || '').toLowerCase();

      if (
        error instanceof TypeError ||
        msg.includes('network request failed') ||
        msg.includes('failed to fetch') ||
        msg.includes('network')
      ) {
        console.error(`[API] ✗ Network error after ${elapsed}ms:`, error.message);
        throw new ApiError(
          `Cannot reach server at ${this.baseUrl}. ` +
          `Verify the backend is running and reachable from the device/emulator.`,
          0
        );
      }

      if (msg.includes('connection refused') || msg.includes('econnrefused')) {
        console.error(`[API] ✗ Connection refused: ${url}`);
        throw new ApiError(
          'Connection refused. Ensure the backend is running on the correct port.',
          0
        );
      }

      // ── Retry (only for non-abort, non-ApiError failures) ──
      if (retries > 0) {
        console.warn(
          `[API] Retrying (${retries} attempts left) after ${API_CONFIG.RETRY_DELAY}ms...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, API_CONFIG.RETRY_DELAY)
        );
        return this.request<T>(endpoint, { ...options, retries: retries - 1 });
      }

      // ── Unknown error ─────────────────────────────
      console.error(
        `[API] ✗ Unknown error after ${elapsed}ms:`,
        error?.name,
        error?.message
      );
      throw new ApiError(
        error?.message || 'An unexpected error occurred.',
        0
      );
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const apiClient = new ApiClient(API_CONFIG.BASE_URL, API_CONFIG.TIMEOUT);