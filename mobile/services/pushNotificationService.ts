/**
 * RetailOps Partner — Push Notification Service
 *
 * Lazy-loads expo-notifications to prevent crashes in Expo Go.
 */

import { Platform } from 'react-native';

let Notifications: any = null;
let Device: any = null;

async function loadModules() {
  try {
    Notifications = await import('expo-notifications');
    Device = await import('expo-device');
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// PUSH NOTIFICATION SERVICE
// ============================================================

class PushNotificationService {
  private expoPushToken: string | null = null;
  private isSupported = false;
  private loaded = false;

  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    this.isSupported = await loadModules();

    if (this.isSupported && Notifications) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  }

  async register(): Promise<string | null> {
    await this.init();
    if (!this.isSupported || !Notifications || !Device) return null;

    try {
      if (!Device.isDevice) {
        console.log('[PUSH] Push notifications require a physical device');
        return null;
      }

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      this.expoPushToken = tokenData.data;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'RetailOps Notifications',
          importance: Notifications.AndroidImportance.HIGH,
        });
      }

      console.log('[PUSH] Registered:', tokenData.data);
      return tokenData.data;
    } catch (error: any) {
      console.log('[PUSH] Not available:', error?.message || 'unknown');
      return null;
    }
  }

  async setBadgeCount(count: number): Promise<void> {
    if (!this.isSupported || !Notifications) return;
    try { await Notifications.setBadgeCountAsync(count); } catch {}
  }

  async clearAll(): Promise<void> {
    if (!this.isSupported || !Notifications) return;
    try { await Notifications.dismissAllNotificationsAsync(); } catch {}
  }

  getToken(): string | null { return this.expoPushToken; }
  isPushSupported(): boolean { return this.isSupported; }
}

export const pushNotificationService = new PushNotificationService();
