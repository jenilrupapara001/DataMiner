/**
 * RetailOps Partner — API Configuration
 *
 * Centralized API configuration for the mobile app.
 * Update BASE_URL for production deployment.
 */

import { Platform } from 'react-native';

// ============================================================
// ENVIRONMENT CONFIG
// ============================================================

const ENV = {
  development: {
    BASE_URL: Platform.OS === 'android'
      ? 'http://10.0.2.2:3001/api'
      : 'http://localhost:3001/api',
    USE_LIVE_API: false,
  },
  production: {
    BASE_URL: 'https://data.brandcentral.in/api',
    USE_LIVE_API: true,
  },
} as const;

// ============================================================
// CURRENT ENVIRONMENT
// ============================================================

type Environment = keyof typeof ENV;

// Switch to 'production' to use live backend
const CURRENT_ENV: Environment = 'production';

// ============================================================
// EXPORTS
// ============================================================

export const API_CONFIG = {
  BASE_URL: ENV[CURRENT_ENV].BASE_URL,
  USE_LIVE_API: ENV[CURRENT_ENV].USE_LIVE_API,
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 0,
  RETRY_DELAY: 1000,
} as const;

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REQUEST_OTP: '/auth/request-otp',
    VERIFY_OTP: '/auth/verify-otp',
    RESEND_OTP: '/auth/resend-otp',
    REFRESH_TOKEN: '/auth/refresh-token',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    PROFILE: '/auth/profile',
    CHANGE_PASSWORD: '/auth/change-password',
  },
} as const;
