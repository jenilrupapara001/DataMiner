/**
 * RetailOps Partner — Root Layout
 */

import { useEffect, useState } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { tokenManager } from '@/services/apiClient';
import { SellerProvider } from '@/contexts/SellerContext';
import { pushNotificationService } from '@/services/pushNotificationService';

export const unstable_settings = {
  anchor: 'login',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const hasTokens = await tokenManager.loadTokens();
        if (hasTokens && tokenManager.isAuthenticated()) {
          // Initialize push notifications
          pushNotificationService.register().catch(() => {});
          setInitialRoute('(tabs)');
        } else {
          setInitialRoute('login');
        }
      } catch {
        setInitialRoute('login');
      }
    };
    checkAuth();
  }, []);

  // Navigate after initialRoute is set
  useEffect(() => {
    if (!initialRoute) return;
    const timer = setTimeout(() => {
      router.replace(initialRoute === '(tabs)' ? '/(tabs)' : '/login');
    }, 100);
    return () => clearTimeout(timer);
  }, [initialRoute]);

  return (
    <SellerProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F8FAFC' },
          }}
        >
          <Stack.Screen name="login" />
          <Stack.Screen name="otp" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="seller-select" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="modal"
            options={{
              presentation: 'modal',
              headerShown: true,
              headerTitle: 'Modal',
              headerTintColor: '#0F172A',
              headerStyle: { backgroundColor: '#FFFFFF' },
              headerShadowVisible: false,
            }}
          />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SellerProvider>
  );
}

export default function RootLayout() {
  return <RootLayoutNav />;
}
