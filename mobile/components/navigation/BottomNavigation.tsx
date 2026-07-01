/**
 * RetailOps Partner — Bottom Navigation Component
 *
 * Premium enterprise-grade iOS bottom navigation.
 * Reference: Apple Wallet, Apple Fitness, Stripe Dashboard, Linear Mobile.
 *
 * Design Spec:
 * - Height: 84px (including safe area)
 * - Background: Pure White #FFFFFF
 * - Top Border: 1px #F1F5F9
 * - Shadow: Soft iOS shadow (Y: -8, Blur: 32, Opacity: 6%)
 * - Rounded Top Corners: 24px (left/right)
 * - Bottom aligned to safe area (34px)
 */

import React from 'react';
import { View, StyleSheet, Platform, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { House, Ticket, BarChart3, MessageSquare, User } from 'lucide-react-native';
import { TabConfig } from './types';
import { Badge } from './Badge';

// ============================================================
// TYPES
// ============================================================

type TabKey = 'home' | 'tickets' | 'reports' | 'messages' | 'profile';

interface BottomNavigationProps {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
}

// ============================================================
// TAB CONFIGURATION
// ============================================================

const TABS: (TabConfig & { key: TabKey })[] = [
  { key: 'home', id: 'home', label: 'Home', icon: House },
  { key: 'tickets', id: 'tickets', label: 'Tickets', icon: Ticket, badge: 3 },
  { key: 'reports', id: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'messages', id: 'messages', label: 'Messages', icon: MessageSquare, badge: 1 },
  { key: 'profile', id: 'profile', label: 'Profile', icon: User },
];

// ============================================================
// COMPONENT
// ============================================================

export function BottomNavigation({
  activeTab,
  onTabPress,
}: BottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    translateY.value = withSpring(0, {
      damping: 20,
      stiffness: 200,
    });
  }, [translateY]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: interpolate(
      translateY.value,
      [0, 100],
      [1, 0]
    ),
  }));

  // Height calculation: 84px total = 50px content + 34px safe area (iOS)
  const containerHeight = 50 + insets.bottom;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: containerHeight,
          paddingBottom: insets.bottom,
        },
        animatedContainerStyle,
      ]}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      {/* Top border line */}
      <View style={styles.borderTop} />

      {/* Tab items */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              style={styles.tabItem}
              onPress={() => onTabPress(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isActive }}
            >
              {/* Active Indicator */}
              {isActive && (
                <Animated.View
                  style={styles.indicator}
                  entering={FadeIn.duration(200)}
                />
              )}

              {/* Icon */}
              <View style={styles.iconContainer}>
                <Icon
                  size={24}
                  strokeWidth={2}
                  color={isActive ? '#2563EB' : '#94A3B8'}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <Badge count={tab.badge} />
                )}
              </View>

              {/* Label */}
              <Text
                style={[
                  styles.label,
                  isActive && styles.labelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ============================================================
// HELPER: interpolate
// ============================================================

function interpolate(
  value: number,
  inputRange: number[],
  outputRange: number[]
): number {
  const [inMin, inMax] = inputRange;
  const [outMin, outMax] = outputRange;
  const clamped = Math.min(Math.max(value, inMin), inMax);
  return outMin + ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin);
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    borderTopColor: '#F1F5F9',
    // iOS shadow
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.06,
        shadowRadius: 32,
      },
      android: {
        elevation: 8,
      },
    }),
    // Rounded top corners
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    // Overflow hidden for rounded corners
    overflow: 'hidden',
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
    color: '#94A3B8',
    marginTop: 4,
    letterSpacing: 0.01,
  },
  labelActive: {
    fontWeight: '600',
    color: '#2563EB',
  },
});
