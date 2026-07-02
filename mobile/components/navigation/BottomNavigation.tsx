/**
 * RetailOps Partner — iOS-Style Bottom Navigation
 *
 * Premium iOS-native bottom navigation with:
 * - Sliding spring indicator (Apple Fitness / Wallet style)
 * - BlurView translucent backdrop (iOS)
 * - Per-tab icon bounce + colour transition
 * - Haptic feedback on tap
 * - Badge with pop-in animation
 *
 * Reference: Apple Wallet, Apple Fitness, Apple Music.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  Text,
  LayoutChangeEvent,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  House,
  Ticket,
  ChartBar as BarChart3,
  MessageSquare,
  User,
} from 'lucide-react-native';
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

interface TabItemProps {
  tab: TabConfig & { key: TabKey };
  isActive: boolean;
  onPress: () => void;
  onLayout: (x: number, width: number) => void;
}

// ============================================================
// CONSTANTS
// ============================================================

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

const TABS: (TabConfig & { key: TabKey })[] = [
  { key: 'home', id: 'home', label: 'Home', icon: House },
  { key: 'tickets', id: 'tickets', label: 'Tickets', icon: Ticket, badge: 3 },
  { key: 'reports', id: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'messages', id: 'messages', label: 'Messages', icon: MessageSquare, badge: 1 },
  { key: 'profile', id: 'profile', label: 'Profile', icon: User },
];

const COLORS = {
  active: '#2563EB',
  inactive: '#8E8E93', // iOS secondary label
  indicator: '#EFF6FF',
  border: 'rgba(60, 60, 67, 0.1)', // iOS separator
  background: '#FFFFFF',
  backgroundIOS: 'rgba(255, 255, 255, 0.72)', // for BlurView tint
};

// ============================================================
// TAB ITEM
// ============================================================

function TabItem({ tab, isActive, onPress, onLayout }: TabItemProps) {
  const Icon = tab.icon;

  // Icon animation values
  const scale = useSharedValue(1);
  const iconY = useSharedValue(0);
  const activeProgress = useSharedValue(isActive ? 1 : 0);

  // Animate on active state change
  useEffect(() => {
    activeProgress.value = withTiming(isActive ? 1 : 0, { duration: 220 });
    if (isActive) {
      // Bouncy pop when becoming active
      scale.value = withSequence(
        withTiming(0.85, { duration: 100 }),
        withSpring(1.08, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 260 })
      );
      // Slight upward lift
      iconY.value = withSequence(
        withTiming(-2, { duration: 150 }),
        withSpring(0, { damping: 10, stiffness: 240 })
      );
    }
  }, [isActive]);

  // Icon animated style — scale, translate, colour transition
  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: iconY.value }],
  }));

  // Label animated style — colour + weight-emulating opacity
  const labelAnimatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      activeProgress.value,
      [0, 1],
      [COLORS.inactive, COLORS.active]
    );
    return {
      color,
      opacity: interpolate(
        activeProgress.value,
        [0, 1],
        [0.85, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  // Icon colour animated via interpolateColor (need to wrap Icon in colour swap)
  const iconColor = isActive ? COLORS.active : COLORS.inactive;

  // Capture layout so parent can position the sliding indicator
  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { x, width } = e.nativeEvent.layout;
      onLayout(x, width);
    },
    [onLayout]
  );

  // Press feedback
  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 400 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 300 });
  };

  const handlePress = () => {
    if (!isActive) {
      Haptics.selectionAsync();
    }
    onPress();
  };

  return (
    <Pressable
      style={styles.tabItem}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLayout={handleLayout}
      accessibilityRole="button"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: isActive }}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      {/* Icon */}
      <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
        <Icon size={24} strokeWidth={isActive ? 2.4 : 2} color={iconColor} />

        {/* Badge with pop-in animation */}
        {tab.badge !== undefined && tab.badge > 0 && (
          <Animated.View
            entering={ZoomIn.duration(300).springify()}
            style={styles.badgeWrapper}
          >
            <Badge count={tab.badge} />
          </Animated.View>
        )}
      </Animated.View>

      {/* Label */}
      <Animated.Text
        style={[styles.label, labelAnimatedStyle]}
        numberOfLines={1}
      >
        {tab.label}
      </Animated.Text>
    </Pressable>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function BottomNavigation({
  activeTab,
  onTabPress,
}: BottomNavigationProps) {
  const insets = useSafeAreaInsets();

  // Track each tab's layout (x position + width)
  const [tabLayouts, setTabLayouts] = useState<
    Record<TabKey, { x: number; width: number }>
  >({} as any);

  // Sliding indicator shared values
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  // Entry animation for whole bar
  const barTranslateY = useSharedValue(20);
  const barOpacity = useSharedValue(0);

  useEffect(() => {
    barTranslateY.value = withSpring(0, { damping: 18, stiffness: 180 });
    barOpacity.value = withTiming(1, { duration: 300 });
  }, []);

  // Whenever active tab or layouts change, animate indicator to new position
  useEffect(() => {
    const layout = tabLayouts[activeTab];
    if (!layout) return;

    const targetWidth = Math.min(layout.width - 20, 56); // pill inset within tab
    const targetX = layout.x + (layout.width - targetWidth) / 2;

    // Only animate width once (avoid width bounce mid-slide)
    if (indicatorWidth.value === 0) {
      indicatorWidth.value = targetWidth;
    } else {
      indicatorWidth.value = withSpring(targetWidth, {
        damping: 18,
        stiffness: 200,
      });
    }

    indicatorX.value = withSpring(targetX, {
      damping: 20,
      stiffness: 220,
      mass: 0.9,
    });
  }, [activeTab, tabLayouts]);

  // Handle tab layout capture
  const handleTabLayout = useCallback(
    (key: TabKey, x: number, width: number) => {
      setTabLayouts((prev) => {
        // Skip if unchanged (prevents re-render loop)
        if (prev[key]?.x === x && prev[key]?.width === width) return prev;
        return { ...prev, [key]: { x, width } };
      });
    },
    []
  );

  const handleTabPress = useCallback(
    (key: TabKey) => {
      if (key !== activeTab) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onTabPress(key);
    },
    [activeTab, onTabPress]
  );

  // ── Animated styles ─────────────────────────────
  const barAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: barTranslateY.value }],
    opacity: barOpacity.value,
  }));

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
    opacity: indicatorWidth.value > 0 ? 1 : 0,
  }));

  // Height: 50px content + safe-area bottom (min 12px for Android)
  const bottomPadding = Math.max(insets.bottom, 12);
  const containerHeight = 56 + bottomPadding;

  return (
    <Animated.View
      style={[
        styles.container,
        { height: containerHeight, paddingBottom: bottomPadding },
        barAnimatedStyle,
      ]}
    >
      {/* iOS BlurView backdrop */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={80}
          tint="light"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidBackground]} />
      )}

      {/* Top hairline border (iOS-style) */}
      <View style={styles.hairline} />

      {/* Tabs row */}
      <View style={styles.tabsContainer}>
        {/* Sliding pill indicator (behind icons) */}
        <Animated.View
          style={[styles.indicator, indicatorAnimatedStyle, { top: 6 }]}
          pointerEvents="none"
        />

        {TABS.map((tab) => (
          <TabItem
            key={tab.key}
            tab={tab}
            isActive={activeTab === tab.key}
            onPress={() => handleTabPress(tab.key)}
            onLayout={(x, w) => handleTabLayout(tab.key, x, w)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    // Layered iOS shadow for depth
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
      },
      android: {
        elevation: 20,
      },
    }),
    // iOS-style overflow for BlurView clipping
    overflow: 'hidden',
    // Subtle top corners (Apple-style safe area bar)
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  androidBackground: {
    backgroundColor: COLORS.background,
  },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    paddingTop: 6,
    position: 'relative',
  },
  // Sliding pill indicator
  indicator: {
    position: 'absolute',
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.indicator,
    left: 0,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    minHeight: 48,
  },
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeWrapper: {
    position: 'absolute',
    top: -4,
    right: -8,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.inactive,
    marginTop: 3,
    letterSpacing: 0.1,
    // iOS SF-style tight tracking
    ...Platform.select({
      ios: {
        fontFamily: 'System',
      },
    }),
  },
});