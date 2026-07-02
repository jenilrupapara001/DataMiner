/**
 * RetailOps Partner — Scheduled Runs & Tracker Service
 */

import { apiClient, ApiError } from './apiClient';
import { ENDPOINTS, buildQuery } from './endpoints';

class ScheduledRunService {
  async list(params?: { page?: number; limit?: number }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.SCHEDULED_RUNS.LIST}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load scheduled runs.', 0);
    }
  }

  async sellerLogs(sellerId: string, params?: { page?: number; limit?: number }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.SCHEDULED_RUNS.SELLER_LOGS(sellerId)}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load seller logs.', 0);
    }
  }

  async sellerMetrics(): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.SCHEDULED_RUNS.SELLER_METRICS);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load seller metrics.', 0);
    }
  }
}

class TrackerService {
  async asins(sellerId: string): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.TRACKER.ASINS(sellerId));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load tracker ASINs.', 0);
    }
  }

  async inventory(sellerId: string): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.TRACKER.INVENTORY(sellerId));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load inventory status.', 0);
    }
  }

  async tasks(sellerId: string): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.TRACKER.TASKS(sellerId));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load seller tasks.', 0);
    }
  }

  async list(): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.TRACKER.LIST);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load tracker list.', 0);
    }
  }
}

class FileService {
  async list(params?: { page?: number; limit?: number }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.FILES.LIST}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load files.', 0);
    }
  }

  async asinFolders(): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.FILES.ASIN_FOLDERS);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load ASIN folders.', 0);
    }
  }

  async upload(data: FormData): Promise<any> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.FILES.UPLOAD, data);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to upload file.', 0);
    }
  }
}

export const scheduledRunService = new ScheduledRunService();
export const trackerService = new TrackerService();
export const fileService = new FileService();
