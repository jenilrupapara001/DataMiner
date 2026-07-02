/**
 * RetailOps Partner — Tabs Layout
 *
 * Dynamic Island-style floating bottom navigation.
 * Premium iOS-native with smooth tab switching animations.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, Ticket, BarChart3, MessageSquare, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import { notificationService } from '@/services';

// ============================================================
// CONSTANTS
// ============================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_COUNT = 5;
const TAB_WIDTH = (SCREEN_WIDTH - 48) / TAB_COUNT; // 48 = padding (24 each side)
const PILL_HEIGHT = 64;
const ICON_SIZE = 24;

const COLORS = {
  active: '#2563EB',
  inactive: '#94A3B8',
  background: '#FFFFFF',
  pillBg: '#F1F5F9',
  badge: '#FF3B30',
};

const TABS = [
  { id: 'home', label: 'Home', icon: House, route: '/' },
  { id: 'tickets', label: 'Tickets', icon: Ticket, route: '/tickets' },
  { id: 'reports', label: 'Reports', icon: BarChart3, route: '/reports' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, route: '/messages' },
  { id: 'profile', label: 'Profile', icon: User, route: '/profile' },
] as const;

// ============================================================
// TAB ITEM
// ============================================================

function TabItem({
  tab,
  isActive,
  index,
  onPress,
  badge,
}: {
  tab: typeof TABS[number];
  isActive: boolean;
  index: number;
  onPress: () => void;
  badge?: number;
}) {
  const scale = useSharedValue(1);
  const iconScale = useSharedValue(isActive ? 1 : 0.9);

  useEffect(() => {
    iconScale.value = withSpring(isActive ? 1 : 0.9, {
      damping: 15,
      stiffness: 300,
    });
  }, [isActive, iconScale]);

  const handlePressIn = () => {
    scale.value = withSpring(0.85, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const Icon = tab.icon;
  const color = isActive ? COLORS.active : COLORS.inactive;

  return (
    <Pressable
      style={styles.tabItem}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: isActive }}
    >
      <Animated.View style={[styles.iconWrap, animatedStyle]}>
        <Animated.View style={iconAnimStyle}>
          <Icon size={ICON_SIZE} strokeWidth={isActive ? 2.2 : 1.8} color={color} />
        </Animated.View>
        {/* Badge */}
        {badge !== undefined && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </Animated.View>
      {/* Label - only show for active */}
      {isActive && (
        <Animated.Text
          style={styles.label}
          entering={FadeIn.duration(200)}
        >
          {tab.label}
        </Animated.Text>
      )}
    </Pressable>
  );
}

// ============================================================
// FLOATING ISLAND TAB BAR
// ============================================================

function FloatingIsland({
  activeTab,
  onTabPress,
  badges,
}: {
  activeTab: string;
  onTabPress: (id: string) => void;
  badges: Record<string, number>;
}) {
  const insets = useSafeAreaInsets();
  const pillX = useSharedValue(0);

  // Calculate active index
  const activeIndex = TABS.findIndex((t) => t.id === activeTab);
  const targetX = activeIndex * TAB_WIDTH;

  useEffect(() => {
    pillX.value = withSpring(targetX, {
      damping: 20,
      stiffness: 250,
    });
  }, [targetX, pillX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View style={[styles.container, { bottom: insets.bottom + 16 }]}>
      {/* Background pill */}
      <View style={styles.island}>
        {/* Active indicator pill */}
        <Animated.View style={[styles.activeIndicator, pillStyle]} />

        {/* Tab items */}
        <View style={styles.tabsRow}>
          {TABS.map((tab, i) => (
            <TabItem
              key={tab.id}
              tab={tab}
              isActive={activeTab === tab.id}
              index={i}
              onPress={() => onTabPress(tab.id)}
              badge={badges[tab.id]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ============================================================
// LAYOUT
// ============================================================

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const count = await notificationService.unreadCount();
        setBadges({ messages: count });
      } catch {}
    };
    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, []);

  const getActiveTab = useCallback(() => {
    if (pathname === '/') return 'home';
    if (pathname.startsWith('/tickets')) return 'tickets';
    if (pathname.startsWith('/reports')) return 'reports';
    if (pathname.startsWith('/messages')) return 'messages';
    if (pathname.startsWith('/profile')) return 'profile';
    return 'home';
  }, [pathname]);

  const activeTab = getActiveTab();

  const handleTabPress = useCallback((tabId: string) => {
    const tab = TABS.find((t) => t.id === tabId);
    if (!tab) return;
    if (tabId === 'home') {
      router.replace('/');
    } else {
      router.push(tab.route as any);
    }
  }, [router]);

  return (
    <View style={styles.root}>
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

      <FloatingIsland
        activeTab={activeTab}
        onTabPress={handleTabPress}
        badges={badges}
      />
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  // Container
  container: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },

  // Island
  island: {
    width: SCREEN_WIDTH - 48,
    height: PILL_HEIGHT,
    borderRadius: 32,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    // iOS shadow
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },

  // Active indicator
  activeIndicator: {
    position: 'absolute',
    left: 4,
    width: TAB_WIDTH - 8,
    height: PILL_HEIGHT - 8,
    borderRadius: 28,
    backgroundColor: COLORS.pillBg,
    top: 4,
  },

  // Tabs
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: PILL_HEIGHT,
    zIndex: 1,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    position: 'relative',
  },

  // Badge
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.badge,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 14,
  },

  // Label
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 2,
    letterSpacing: 0.01,
  },
});
