/**
 * RetailOps Partner — Notification & Alert Service
 */

import { apiClient, ApiError } from './apiClient';
import { ENDPOINTS, buildQuery } from './endpoints';

export interface NotificationItem {
  Id: string;
  Title: string;
  Message: string;
  IsRead: boolean;
  Type: string;
  CreatedAt: string;
}

export interface AlertItem {
  Id: string;
  Title: string;
  Description: string;
  Priority: string;
  Type: string;
  IsRead: boolean;
  Acknowledged: boolean;
  CreatedAt: string;
}

class NotificationService {
  async list(params?: { page?: number; limit?: number }): Promise<{ notifications: NotificationItem[]; total: number }> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.NOTIFICATIONS.LIST}${query}`);
      const data = res as unknown as any;
      return { notifications: data?.data || data?.notifications || [], total: data?.total || 0 };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load notifications.', 0);
    }
  }

  async markAsRead(ids?: string[]): Promise<any> {
    try {
      const res = await apiClient.put<any>(ENDPOINTS.NOTIFICATIONS.READ, { ids });
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to mark as read.', 0);
    }
  }

  async alerts(params?: { page?: number; limit?: number }): Promise<{ alerts: AlertItem[]; total: number }> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.NOTIFICATIONS.ALERTS}${query}`);
      const data = res as unknown as any;
      return { alerts: data?.data || data?.alerts || [], total: data?.total || 0 };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load alerts.', 0);
    }
  }

  async unreadCount(): Promise<number> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.NOTIFICATIONS.ALERTS_COUNT);
      const data = res as unknown as any;
      return data?.count || data?.data?.count || 0;
    } catch {
      return 0;
    }
  }

  async alertRules(): Promise<any[]> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.NOTIFICATIONS.ALERT_RULES);
      const data = res as unknown as any;
      return data?.data || data?.rules || [];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load alert rules.', 0);
    }
  }
}

export const notificationService = new NotificationService();
