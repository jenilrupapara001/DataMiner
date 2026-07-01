/**
 * RetailOps Partner — Services
 *
 * Export all service modules.
 */

export { API_CONFIG, API_ENDPOINTS } from './config';
export { apiClient, ApiError, tokenManager } from './apiClient';
export { authService } from './authService';
export type {
  LoginRequest,
  LoginResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  ResendOtpRequest,
  ResendOtpResponse,
} from './authService';
