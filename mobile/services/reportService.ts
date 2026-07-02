/**
 * RetailOps Partner — Report & Analytics Service
 */

import { apiClient, ApiError } from './apiClient';
import { ENDPOINTS, buildQuery } from './endpoints';

class ReportService {
  async dashboard(params?: { sellerId?: string }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.REPORTS.DASHBOARD}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load dashboard.', 0);
    }
  }

  async chartData(params?: { sellerId?: string; months?: number }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.REPORTS.CHART_DATA}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load chart data.', 0);
    }
  }

  async revenue(params?: { sellerId?: string }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.REPORTS.REVENUE}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load revenue data.', 0);
    }
  }

  async skuReport(params?: { sellerId?: string; page?: number; limit?: number }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.REPORTS.SKU}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load SKU report.', 0);
    }
  }

  async parentAsinReport(params?: { sellerId?: string; page?: number; limit?: number }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.REPORTS.PARENT_ASIN}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load parent ASIN report.', 0);
    }
  }

  async monthWiseReport(params?: { sellerId?: string; year?: number }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.REPORTS.MONTH_WISE}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load month-wise report.', 0);
    }
  }

  // GMS Data
  async gmsData(params?: { sellerId?: string; startDate?: string; endDate?: string }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.GMS.DATA}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load GMS data.', 0);
    }
  }

  async gmsAsins(params?: { sellerId?: string }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.GMS.ASINS}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load GMS ASIN data.', 0);
    }
  }

  // Ads Data
  async adsReport(params?: { sellerId?: string; startDate?: string; endDate?: string }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.ADS.REPORT}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load ads report.', 0);
    }
  }

  async adsManager(params?: { sellerId?: string }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.ADS.MANAGER}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load ads manager data.', 0);
    }
  }

  // Targets
  async targets(params?: { sellerId?: string }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.TARGETS.LIST}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load targets.', 0);
    }
  }

  async createTarget(data: any): Promise<any> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.TARGETS.CREATE, data);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to create target.', 0);
    }
  }

  async currentGoals(params?: { sellerId?: string }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.TARGETS.GOALS_CURRENT}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load goals.', 0);
    }
  }

  async performance(params?: { sellerId?: string }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.TARGETS.PERFORMANCE}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load performance data.', 0);
    }
  }
}

export const reportService = new ReportService();
