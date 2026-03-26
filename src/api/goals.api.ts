import { apiClient } from '../lib/api-client';

export interface Goal {
  id: string;
  name: string;
  targetGMS: number;
  achievedGMS: number;
  startDate: string;
  endDate: string;
  status: 'AHEAD' | 'ON_TRACK' | 'BEHIND';
  dailyRequiredRevenue: number;
}

export const fetchCurrentGoal = async (): Promise<Goal> => {
  const { data } = await apiClient.get<Goal>('/goals/current');
  return data;
};
