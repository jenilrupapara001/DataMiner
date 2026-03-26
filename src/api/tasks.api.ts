import { apiClient } from '../lib/api-client';

export interface Task {
  id: string;
  title: string;
  type: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'REJECTED';
  impactScore: number;
  brandId?: string;
  asinList: string[];
  isAISuggested: boolean;
}

export const fetchTasks = async (filter?: string): Promise<Task[]> => {
  const { data } = await apiClient.get<Task[]>(`/tasks${filter ? `?filter=${filter}` : ''}`);
  return data;
};
