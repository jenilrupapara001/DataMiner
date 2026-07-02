/**
 * RetailOps Partner — ASIN Service
 */

import { apiClient, ApiError } from './apiClient';
import { ENDPOINTS, buildQuery } from './endpoints';

export interface Asin {
  Id: string;
  AsinCode: string;
  Title: string;
  Brand: string;
  Category: string;
  Price: number;
  Bsr: number;
  Rating: number;
  ReviewCount: number;
  LQS: number;
  SellerId: string;
  SellerName: string;
  Tags: string[];
  IsActive: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface AsinFilters {
  categories: string[];
  brands: string[];
  tags: string[];
  sellers: { id: string; name: string }[];
}

class AsinService {
  async list(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sellerId?: string;
    category?: string;
    brand?: string;
    tag?: string;
    marketplace?: string;
    lqsMin?: number;
    lqsMax?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ asins: Asin[]; total: number; page: number; limit: number }> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.ASINS.LIST}${query}`);
      const data = res as unknown as any;
      return {
        asins: data?.data || data?.asins || [],
        total: data?.total || 0,
        page: data?.page || 1,
        limit: data?.limit || 25,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load ASINs.', 0);
    }
  }

  async get(id: string): Promise<Asin> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.ASINS.GET(id));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load ASIN.', 0);
    }
  }

  async getBySeller(sellerId: string, params?: { page?: number; limit?: number }): Promise<{ asins: Asin[]; total: number }> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.ASINS.BY_SELLER(sellerId)}${query}`);
      const data = res as unknown as any;
      return { asins: data?.data || data?.asins || [], total: data?.total || 0 };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load seller ASINs.', 0);
    }
  }

  async stats(sellerId?: string): Promise<any> {
    try {
      const query = sellerId ? `?sellerId=${sellerId}` : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.ASINS.STATS}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load ASIN stats.', 0);
    }
  }

  async filters(): Promise<AsinFilters> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.ASINS.FILTERS);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load filters.', 0);
    }
  }

  async brands(): Promise<string[]> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.ASINS.BRANDS);
      const data = res as unknown as any;
      return data?.data || data?.brands || [];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load brands.', 0);
    }
  }

  async trends(id: string, params?: { days?: number }): Promise<any> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.ASINS.TRENDS(id)}${query}`);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load trends.', 0);
    }
  }

  async subBsrTrend(id: string): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.ASINS.SUB_BSR(id));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load sub-BSR trend.', 0);
    }
  }

  async tagsHistory(id: string): Promise<any> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.ASINS.TAGS_HISTORY(id));
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load tag history.', 0);
    }
  }

  async updateTags(id: string, tags: string[]): Promise<any> {
    try {
      const res = await apiClient.put<any>(ENDPOINTS.ASINS.UPDATE_TAGS(id), { tags });
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to update tags.', 0);
    }
  }

  async bulkUpdate(ids: string[], updates: Record<string, any>): Promise<any> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.ASINS.BULK_UPDATE, { ids, updates });
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to bulk update.', 0);
    }
  }
}

export const asinService = new AsinService();
