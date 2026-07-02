/**
 * RetailOps Partner — Chat Service
 */

import { apiClient, ApiError } from './apiClient';
import { ENDPOINTS, buildQuery } from './endpoints';

export interface Conversation {
  Id: string;
  Name: string;
  LastMessage: string;
  LastMessageAt: string;
  UnreadCount: number;
  Participants: string[];
}

export interface Message {
  Id: string;
  ConversationId: string;
  SenderId: string;
  SenderName: string;
  Content: string;
  Type: string;
  CreatedAt: string;
}

class ChatService {
  async conversations(): Promise<Conversation[]> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.CHAT.CONVERSATIONS);
      const data = res as unknown as any;
      return data?.data || data?.conversations || [];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load conversations.', 0);
    }
  }

  async messages(conversationId: string, params?: { page?: number; limit?: number }): Promise<Message[]> {
    try {
      const query = params ? buildQuery(params) : '';
      const res = await apiClient.get<any>(`${ENDPOINTS.CHAT.MESSAGES(conversationId)}${query}`);
      const data = res as unknown as any;
      return data?.data || data?.messages || [];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load messages.', 0);
    }
  }

  async send(data: { conversationId?: string; recipientId?: string; content: string; type?: string }): Promise<Message> {
    try {
      const res = await apiClient.post<any>(ENDPOINTS.CHAT.SEND, data);
      return (res as unknown as any)?.data || res;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to send message.', 0);
    }
  }

  async users(): Promise<any[]> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.CHAT.USERS);
      const data = res as unknown as any;
      return data?.data || data?.users || [];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load users.', 0);
    }
  }

  async sellers(): Promise<any[]> {
    try {
      const res = await apiClient.get<any>(ENDPOINTS.CHAT.SELLERS);
      const data = res as unknown as any;
      return data?.data || data?.sellers || [];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('Failed to load sellers.', 0);
    }
  }
}

export const chatService = new ChatService();
