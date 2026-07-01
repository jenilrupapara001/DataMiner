/**
 * RetailOps Partner — Dashboard Service
 *
 * Fetches dashboard data from the backend API.
 */

import { apiClient, ApiError } from './apiClient';

// ============================================================
// TYPES
// ============================================================

export interface DashboardData {
  summary: {
    revenue: { value: string; trend: number; trendUp: boolean };
    orders: { value: string; trend: number; trendUp: boolean };
    profit: { value: string; trend: number; trendUp: boolean };
    buyBox: { value: string; trend: number; trendUp: boolean };
    healthScore: number;
  };
  alerts: Alert[];
  recentActivity: Activity[];
  tickets: Ticket[];
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  icon: string;
}

export interface Ticket {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  department: string;
  assignedTo: string;
  createdAt: string;
  slaDeadline: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

// ============================================================
// DASHBOARD SERVICE
// ============================================================

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  roleName: string;
  sellers: SellerInfo[];
  assignedSellers: string[];
  avatar: string;
  createdAt: string;
  lastLogin: string;
}

export interface SellerInfo {
  Id: string;
  Name: string;
  Marketplace: string;
  SellerId: string;
  IsActive: boolean;
  Plan: string;
  PartnerTag: string;
  CreatedAt: string;
}

class DashboardService {
  async getDashboard(): Promise<DashboardData> {
    try {
      const response = await apiClient.get<DashboardData>('/data/dashboard');
      return response as unknown as DashboardData;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load dashboard data.', 0);
    }
  }

  async getAlerts(): Promise<{ alerts: Alert[] }> {
    try {
      const response = await apiClient.get<any>('/alerts');
      const data = response as unknown as any;
      return { alerts: data?.data || data?.alerts || [] };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load alerts.', 0);
    }
  }

  async getUnreadAlertCount(): Promise<{ count: number }> {
    try {
      const response = await apiClient.get<any>('/alerts/count');
      const data = response as unknown as any;
      return { count: data?.count || data?.data?.count || 0 };
    } catch {
      return { count: 0 };
    }
  }

  async getNotifications(): Promise<{ notifications: Notification[] }> {
    try {
      const response = await apiClient.get<any>('/notifications');
      const data = response as unknown as any;
      return { notifications: data?.data || data?.notifications || [] };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load notifications.', 0);
    }
  }

  async getUnreadNotificationCount(): Promise<{ count: number }> {
    try {
      const response = await apiClient.get<any>('/notifications');
      const data = response as unknown as any;
      const notifications = data?.data || [];
      const count = Array.isArray(notifications)
        ? notifications.filter((n: any) => !n.IsRead && !n.Read).length
        : 0;
      return { count };
    } catch {
      return { count: 0 };
    }
  }

  async getProfile(): Promise<{ data: UserProfile }> {
    try {
      const response = await apiClient.get<any>('/auth/me');
      const data = response as unknown as any;
      return { data: data?.data || data };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load profile.', 0);
    }
  }
}

export const dashboardService = new DashboardService();
