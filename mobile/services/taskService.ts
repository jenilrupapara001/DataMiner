/**
 * RetailOps Partner — Task (PEMS) Service
 */

import { apiClient, ApiError } from './apiClient';
import { ENDPOINTS, buildQuery } from './endpoints';

export interface Task {
  Id: string;
  Title: string;
  Status: string;
  Priority: string;
  AssignedTo: string;
  SellerId: string;
  DueDate: string;
  CreatedAt: string;
}

class TaskService {
  async dashboardSummary(): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.TASKS.DASHBOARD_SUMMARY);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load task summary.', 0);
    }
  }

  async list(params?: { page?: number; limit?: number; status?: string; sellerId?: string }): Promise<{ tasks: Task[]; total: number }> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.TASKS.LIST}${query}`);
      const data = res as unknown as any;
      return { tasks: data?.data || data?.instances || [], total: data?.total || 0 };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load tasks.', 0);
    }
  }

  async get(id: string): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.TASKS.GET(id));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load task.', 0);
    }
  }

  async create(data: any): Promise<any> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.TASKS.CREATE, data);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to create task.', 0);
    }
  }

  async transition(id: string, action: string, data?: any): Promise<any> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.TASKS.TRANSITION(id), { action, ...data });
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to transition task.', 0);
    }
  }

  async completeSubtask(id: string): Promise<any> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.TASKS.COMPLETE_SUBTASK(id));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to complete subtask.', 0);
    }
  }

  async completeActivity(id: string): Promise<any> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.TASKS.COMPLETE_ACTIVITY(id));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to complete activity.', 0);
    }
  }

  async uploadEvidence(data: FormData): Promise<any> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.TASKS.UPLOAD_EVIDENCE, data);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to upload evidence.', 0);
    }
  }

  async notifications(params?: { page?: number; limit?: number }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.TASKS.NOTIFICATIONS}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load notifications.', 0);
    }
  }

  async templates(): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.TASKS.TEMPLATES);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load templates.', 0);
    }
  }
}

export const taskService = new TaskService();
