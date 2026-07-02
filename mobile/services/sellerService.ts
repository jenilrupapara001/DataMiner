/**
 * RetailOps Partner — Seller Service
 */

import { apiClient, ApiError } from './apiClient';
import { ENDPOINTS, buildQuery } from './endpoints';

export interface Seller {
  Id: string;
  Name: string;
  Marketplace: string;
  SellerId: string;
  IsActive: boolean;
  Plan: string;
  PartnerTag: string;
  CreatedAt: string;
}

class SellerService {
  async list(params?: { page?: number; limit?: number; search?: string }): Promise<{ sellers: Seller[]; total: number }> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.SELLERS.LIST}${query}`);
      const data = res as unknown as any;
      return { sellers: data?.data || data?.sellers || [], total: data?.total || 0 };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load sellers.', 0);
    }
  }

  async get(id: string): Promise<Seller> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.SELLERS.GET(id));
      const data = res as unknown as any;
      return data?.data || data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load seller.', 0);
    }
  }

  async stats(): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.SELLERS.STATS);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load seller stats.', 0);
    }
  }
}

export const sellerService = new SellerService();
