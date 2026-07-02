/**
 * RetailOps Partner — Root Layout
 */

import { useEffect, useState, useRef } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { tokenManager } from '@/services/apiClient';
import { SellerProvider } from '@/contexts/SellerContext';

export const unstable_settings = {
  anchor: 'login',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const hasNavigated = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const checkAuth = async () => {
        try {
          const hasTokens = await tokenManager.loadTokens();
          if (hasTokens && tokenManager.isAuthenticated()) {
            // Has tokens — try dashboard
            try {
              const { dashboardService } = await import('@/services');
              await dashboardService.getProfile();
              // Profile OK — go to dashboard
              if (!hasNavigated.current) {
                hasNavigated.current = true;
                router.replace('/(tabs)');
              }
            } catch {
              // Profile failed — clear tokens, go to login
              await tokenManager.clearTokens();
              if (!hasNavigated.current) {
                hasNavigated.current = true;
                router.replace('/login');
              }
            }
          } else {
            // No tokens — go to login
            if (!hasNavigated.current) {
              hasNavigated.current = true;
              router.replace('/login');
            }
          }
        } catch {
          if (!hasNavigated.current) {
            hasNavigated.current = true;
            router.replace('/login');
          }
        } finally {
          setIsReady(true);
        }
      };
      checkAuth();
    }, 150); // Small delay to let Stack mount

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <SellerProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SellerProvider>
    );
  }

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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});

export default function RootLayout() {
  return <RootLayoutNav />;
}
