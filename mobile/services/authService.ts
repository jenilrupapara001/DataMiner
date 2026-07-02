/**
 * RetailOps Partner — Auth Service
 *
 * Handles authentication flow: login, OTP verification, token management.
 */

import { apiClient, ApiError, tokenManager } from './apiClient';
import { API_ENDPOINTS } from './config';

// ============================================================
// TYPES
// ============================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  requiresOtp?: boolean;
  tempToken?: string;
  destination?: string;
  expiresIn?: number;
  message?: string;
  trustedDevice?: boolean;
  requiresSetup?: boolean;
  needsPasswordReset?: boolean;
  data?: {
    user: {
      _id: string;
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: {
        Name: string;
        DisplayName: string;
      };
      permissions: string[];
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface VerifyOtpRequest {
  tempToken: string;
  otp: string;
  trustDevice?: boolean;
}

export interface VerifyOtpResponse {
  success: boolean;
  data?: {
    user: {
      _id: string;
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      role: {
        Name: string;
        DisplayName: string;
      };
      permissions: string[];
    };
    accessToken: string;
    refreshToken: string;
  };
  message?: string;
}

export interface ResendOtpRequest {
  tempToken: string;
}

export interface ResendOtpResponse {
  success: boolean;
  destination?: string;
  expiresIn?: number;
  message?: string;
}

// ============================================================
// AUTH SERVICE
// ============================================================

class AuthService {
  /**
   * Request OTP for email-only login.
   * Falls back to login endpoint if request-otp is not available.
   */
  async requestOtp(email: string): Promise<LoginResponse> {
    try {
      // Try the dedicated request-otp endpoint first
      const response = await apiClient.post<LoginResponse>(
        API_ENDPOINTS.AUTH.REQUEST_OTP,
        { email }
      );

      return response as LoginResponse;
    } catch (error) {
      // If request-otp fails (e.g., not deployed yet), try login with empty password
      if (error instanceof ApiError && (error.status === 404 || error.status === 401)) {
        console.log('[AUTH] request-otp not available, falling back to login');
        return this.login(email, '');
      }
      throw error;
    }
  }

  /**
   * Login with email and password.
   * Returns OTP requirements or direct access.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await apiClient.post<LoginResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        { email, password }
      );

      const loginData = response as LoginResponse;

      // If direct login (trusted device), store tokens
      if (!loginData.requiresOtp && loginData.data?.accessToken) {
        await tokenManager.setTokens(
          loginData.data.accessToken,
          loginData.data.refreshToken
        );
      }

      return loginData;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Login failed. Please try again.', 0);
    }
  }

  /**
   * Verify OTP code.
   * Returns auth tokens on success.
   */
  async verifyOtp(
    tempToken: string,
    otp: string,
    trustDevice: boolean = true
  ): Promise<VerifyOtpResponse> {
    try {
      const response = await apiClient.post<VerifyOtpResponse>(
        API_ENDPOINTS.AUTH.VERIFY_OTP,
        { tempToken, otp, trustDevice }
      );

      const verifyData = response as VerifyOtpResponse;

      // Store tokens on successful verification
      if (verifyData.data?.accessToken) {
        await tokenManager.setTokens(
          verifyData.data.accessToken,
          verifyData.data.refreshToken
        );
      }

      return verifyData;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('OTP verification failed. Please try again.', 0);
    }
  }

  /**
   * Resend OTP code.
   * Returns new destination and expiry.
   */
  async resendOtp(tempToken: string): Promise<ResendOtpResponse> {
    try {
      const response = await apiClient.post<ResendOtpResponse>(
        API_ENDPOINTS.AUTH.RESEND_OTP,
        { tempToken }
      );

      return response as ResendOtpResponse;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Failed to resend OTP. Please try again.', 0);
    }
  }

  /**
   * Refresh access token.
   */
  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const response = await apiClient.post<{ accessToken: string; refreshToken: string }>(
        API_ENDPOINTS.AUTH.REFRESH_TOKEN,
        { refreshToken: token }
      );

      const data = response as unknown as { accessToken: string; refreshToken: string };
      if (data?.accessToken) {
        await tokenManager.setTokens(data.accessToken, data.refreshToken);
      }

      return data;
    } catch (error) {
      await tokenManager.clearTokens();
      throw error;
    }
  }

  /**
   * Logout and clear tokens.
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // Ignore logout errors
    } finally {
      await tokenManager.clearTokens();
    }
  }

  /**
   * Get current user profile.
   */
  async getMe(): Promise<{ user: any }> {
    const response = await apiClient.get<{ user: any }>(API_ENDPOINTS.AUTH.ME);
    return response as unknown as { user: any };
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return tokenManager.isAuthenticated();
  }
}

// ============================================================
// SINGLETON
// ============================================================

export const authService = new AuthService();
