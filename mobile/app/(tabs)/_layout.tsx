/**
 * RetailOps Partner — Tabs Layout
 *
 * Premium iOS tab navigator using custom bottom navigation.
 * This replaces the default Expo Router tab bar.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, Ticket, BarChart3, MessageSquare, User } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Badge } from '@/components/navigation/Badge';

// ============================================================
// TAB CONFIGURATION
// ============================================================

const TABS = [
  { id: 'home', label: 'Home', icon: House, route: '/' },
  { id: 'tickets', label: 'Tickets', icon: Ticket, route: '/tickets' },
  { id: 'reports', label: 'Reports', icon: BarChart3, route: '/reports' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, route: '/messages' },
  { id: 'profile', label: 'Profile', icon: User, route: '/profile' },
] as const;

// ============================================================
// TAB ITEM COMPONENT
// ============================================================

function TabItem({
  tab,
  isActive,
  onPress,
  badge,
}: {
  tab: typeof TABS[number];
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const scale = useSharedValue(1);
  const indicatorOpacity = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    indicatorOpacity.value = withTiming(isActive ? 1 : 0, {
      duration: 200,
    });
  }, [isActive, indicatorOpacity]);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
  }));

  const Icon = tab.icon;
  const activeColor = '#2563EB';
  const inactiveColor = '#94A3B8';
  const currentColor = isActive ? activeColor : inactiveColor;

  return (
    <Animated.View style={[styles.tabItem, animatedStyle]}>
      <Pressable
        style={styles.tabPressable}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={tab.label}
        accessibilityState={{ selected: isActive }}
      >
        {/* Active Indicator */}
        <Animated.View style={[styles.indicator, indicatorStyle]} />

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Icon size={24} strokeWidth={2} color={currentColor} />
          {badge !== undefined && badge > 0 && (
            <Badge count={badge} />
          )}
        </View>

        {/* Label */}
        <Animated.Text
          style={[
            styles.label,
            { color: currentColor },
            isActive && styles.labelActive,
          ]}
        >
          {tab.label}
        </Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================
// MAIN TABS LAYOUT
// ============================================================

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Mock badge counts (replace with real data)
  const [badges] = useState({
    tickets: 3,
    messages: 1,
  });

  // Determine active tab from pathname
  const getActiveTab = useCallback(() => {
    if (pathname === '/') return 'home';
    if (pathname.startsWith('/tickets')) return 'tickets';
    if (pathname.startsWith('/reports')) return 'reports';
    if (pathname.startsWith('/messages')) return 'messages';
    if (pathname.startsWith('/profile')) return 'profile';
    return 'home';
  }, [pathname]);

  const activeTab = getActiveTab();

  const handleTabPress = (tabId: string) => {
    const tab = TABS.find((t) => t.id === tabId);
    if (tab) {
      router.push(tab.route as any);
    }
  };

  return (
    <View style={styles.container}>
      {/* Screen content */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="tickets" />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="profile" />
      </Tabs>

      {/* Custom Bottom Navigation */}
      <View
        style={[
          styles.bottomNav,
          {
            height: 50 + insets.bottom,
            paddingBottom: insets.bottom,
          },
        ]}
      >
        {/* Top border */}
        <View style={styles.borderTop} />

        {/* Tab items */}
        <View style={styles.tabsContainer}>
          {TABS.map((tab) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              onPress={() => handleTabPress(tab.id)}
              badge={badges[tab.id as keyof typeof badges]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    // iOS shadow
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 8,
  },
  borderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 4,
    width: 64,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
  },
  iconContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.01,
  },
  labelActive: {
    fontWeight: '600',
  },
});
