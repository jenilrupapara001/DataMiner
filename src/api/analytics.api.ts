import { apiClient } from '../lib/api-client';

export interface PerformanceTimelineEntry {
  date: string;
  actualRevenue: number;
  targetRevenue: number;
}

export interface PerformanceAnalytics {
  timeline: PerformanceTimelineEntry[];
  projectionRevenue: number;
  gapPercentage: number;
  expectedFinal: number;
}

export const fetchPerformanceAnalytics = async (goalId: string): Promise<PerformanceAnalytics> => {
  const { data } = await apiClient.get<PerformanceAnalytics>(`/analytics/performance?goalId=${goalId}`);
  return data;
};
