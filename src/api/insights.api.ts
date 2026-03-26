import { apiClient } from '../lib/api-client';

export interface Insight {
  id: string;
  type: 'STOCK' | 'ADS' | 'OPPORTUNITY';
  message: string;
  actionLabel: string;
  actionType: string;
}

export const fetchInsights = async (): Promise<Insight[]> => {
  const { data } = await apiClient.get<Insight[]>('/insights');
  return data;
};
