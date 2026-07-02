/**
 * RetailOps Partner — Export Service
 */

import { apiClient, ApiError } from './apiClient';
import { ENDPOINTS, buildQuery } from './endpoints';

class ExportService {
  async startAsinExport(params: any): Promise<{ downloadId: string }> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.EXPORT.START_ASIN, params);
      const data = res as unknown as any;
      return { downloadId: data?.data?.downloadId || data?.downloadId || '' };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to start export.', 0);
    }
  }

  async startGmsExport(params: any): Promise<{ downloadId: string }> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.EXPORT.START_GMS, params);
      const data = res as unknown as any;
      return { downloadId: data?.data?.downloadId || data?.downloadId || '' };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to start GMS export.', 0);
    }
  }

  async startAdsExport(params: any): Promise<{ downloadId: string }> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.EXPORT.START_ADS, params);
      const data = res as unknown as any;
      return { downloadId: data?.data?.downloadId || data?.downloadId || '' };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to start ads export.', 0);
    }
  }

  async status(id: string): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.EXPORT.STATUS(id));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to check export status.', 0);
    }
  }

  async download(id: string): Promise<string> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.EXPORT.DOWNLOAD(id));
      const data = res as unknown as any;
      return data?.data?.url || data?.url || '';
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to get download URL.', 0);
    }
  }

  async downloads(): Promise<any[]> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.EXPORT.DOWNLOADS);
      const data = res as unknown as any;
      return data?.data || data?.downloads || [];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load downloads.', 0);
    }
  }
}

export const exportService = new ExportService();
