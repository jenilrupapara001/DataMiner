/**
 * RetailOps Partner — API Client
 *
 * Custom fetch-based HTTP client with:
 *  - Promise.race() timeout  (avoids whatwg-fetch AbortController bug in RN)
 *  - Token injection
 *  - Structured error handling
 *  - Optional retry logic
 */

import * as SecureStore from 'expo-secure-store';
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
  /** Pass true for endpoints that must NOT send an Authorization header (e.g. login, OTP). */
  skipAuth?: boolean;
}

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
// TOKEN STORAGE
// In-memory for dev; screens that need persistence use SecureStore directly.
// ============================================================

let accessToken: string | null = null;
let refreshToken: string | null = null;

const TOKEN_KEYS = {
  ACCESS: 'retailops_access_token',
  REFRESH: 'retailops_refresh_token',
} as const;

export const tokenManager = {
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,
  setTokens: async (access: string, refresh: string) => {
    accessToken = access;
    refreshToken = refresh;
    await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, access);
    await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refresh);
  },
  clearTokens: async () => {
    accessToken = null;
    refreshToken = null;
    await SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS);
    await SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH);
  },
  isAuthenticated: () => !!accessToken,
  loadTokens: async (): Promise<boolean> => {
    try {
      const storedAccess = await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
      const storedRefresh = await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);
      if (storedAccess && storedRefresh) {
        accessToken = storedAccess;
        refreshToken = storedRefresh;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
};

// ============================================================
// API CLIENT
// ============================================================

class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;

  constructor(baseUrl: string, timeout: number) {
    this.baseUrl = baseUrl;
    this.defaultTimeout = timeout;
    console.log('[API] Initialized', { baseUrl, timeoutMs: timeout });
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
    const method = (fetchOptions.method || 'GET').toUpperCase();

    // ── Build headers ────────────────────────────────────────
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Platform': 'mobile',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    if (!skipAuth) {
      const token = tokenManager.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const startTime = Date.now();
    console.log(`[API] → ${method} ${url}`);

    // ── Timeout via Promise.race (NOT AbortController) ───────
    // whatwg-fetch v3.x (used by React Native 0.81) has a bug where passing a
    // signal causes xhr.onabort to fire on connection errors instead of
    // xhr.onerror, producing a spurious AbortError before any response arrives.
    // Using Promise.race avoids the polyfill's signal path entirely.
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new ApiError(
              `Request timed out after ${Math.round(timeout / 1000)}s. Please check your connection.`,
              408
            )
          ),
        timeout
      )
    );

    const fetchPromise = fetch(url, {
      ...fetchOptions,
      headers,
      // ⚠️ NO `signal` — deliberately omitted to avoid whatwg-fetch AbortError bug
    });

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      const elapsed = Date.now() - startTime;
      console.log(`[API] ← ${response.status} ${url} (${elapsed}ms)`);

      // ── Parse body ────────────────────────────────────────
      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (parseErr) {
          console.warn('[API] Failed to parse JSON body:', parseErr);
        }
      } else {
        try {
          const text = await response.text();
          data = text ? { message: text } : null;
        } catch {
          data = null;
        }
      }

      // ── HTTP error handling ───────────────────────────────
      if (!response.ok) {
        const msg =
          (data?.message) ||
          (data?.error) ||
          `Request failed with status ${response.status}`;

        if (response.status === 429) {
          throw new ApiError('Too many requests. Please try again later.', 429, data);
        }

        if (response.status === 401) {
          tokenManager.clearTokens();
          throw new ApiError('Session expired. Please login again.', 401, data);
        }

        throw new ApiError(msg, response.status, data);
      }

      return data ?? ({ success: true } as ApiResponse<T>);

    } catch (error: any) {
      const elapsed = Date.now() - startTime;

      // Re-throw our own structured errors immediately
      if (error instanceof ApiError) {
        console.error(`[API] ✗ ${error.status} after ${elapsed}ms: ${error.message}`);
        throw error;
      }

      // Network / fetch failures
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
            'Verify the backend is running and reachable from the device/emulator.',
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

      // Retry logic (for transient failures only)
      if (retries > 0) {
        console.warn(`[API] Retrying (${retries} left) after ${API_CONFIG.RETRY_DELAY}ms…`);
        await new Promise((res) => setTimeout(res, API_CONFIG.RETRY_DELAY));
        return this.request<T>(endpoint, { ...options, retries: retries - 1 });
      }

      console.error(`[API] ✗ Unknown error after ${elapsed}ms:`, error?.name, error?.message);
      throw new ApiError(error?.message || 'An unexpected error occurred.', 0);
    }
  }

  // ── Convenience methods ─────────────────────────────────────

  get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// ============================================================
// SINGLETON
// ============================================================

export const apiClient = new ApiClient(API_CONFIG.BASE_URL, API_CONFIG.TIMEOUT);
