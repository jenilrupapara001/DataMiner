/**
 * RetailOps Partner — Root Layout
 *
 * Main app navigation structure.
 * Login is the initial route; tabs are accessible after authentication.
 */

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: 'login',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F8FAFC' },
        }}
      >
        {/* Auth Screens */}
        <Stack.Screen name="login" />
        <Stack.Screen
          name="otp"
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Main App */}
        <Stack.Screen
          name="(tabs)"
          options={{
            animation: 'slide_from_right',
          }}
        />

        {/* Modal */}
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
  );
}
