/**
 * RetailOps Partner — Tab Item Component
 *
 * Individual tab item with active/inactive states,
 * micro-interactions, and badge support.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Badge } from './Badge';
import { TabItemProps } from './types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TabItem({ tab, isActive, onPress }: TabItemProps) {
  const scale = useSharedValue(1);
  const indicatorOpacity = useSharedValue(isActive ? 1 : 0);
  const indicatorWidth = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    indicatorOpacity.value = withTiming(isActive ? 1 : 0, {
      duration: 200,
    });
    indicatorWidth.value = withSpring(isActive ? 1 : 0, {
      damping: 20,
      stiffness: 200,
    });
  }, [isActive, indicatorOpacity, indicatorWidth]);

  const handlePressIn = () => {
    scale.value = withSpring(0.95, {
      damping: 15,
      stiffness: 300,
    });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [
      {
        scaleX: interpolate(
          indicatorWidth.value,
          [0, 1],
          [0.8, 1],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const Icon = tab.icon;
  const activeColor = '#2563EB';
  const inactiveColor = '#94A3B8';
  const currentColor = isActive ? activeColor : inactiveColor;

  return (
    <AnimatedPressable
      style={[styles.container, animatedIconStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`${tab.label}${tab.badge && tab.badge > 0 ? `, ${tab.badge} unread` : ''}`}
      accessibilityState={{ selected: isActive }}
    >
      {/* Active Indicator Background */}
      <Animated.View
        style={[styles.indicator, animatedIndicatorStyle]}
      />

      {/* Icon */}
      <View style={styles.iconContainer}>
        <Icon
          size={24}
          strokeWidth={2}
          color={currentColor}
        />
        <Badge count={tab.badge} />
      </View>

      {/* Label */}
      <Text
        style={[
          styles.label,
          { color: currentColor },
          isActive && styles.labelActive,
        ]}
      >
        {tab.label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
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
    marginTop: 4,
    letterSpacing: 0.01,
  },
  labelActive: {
    fontWeight: '600',
  },
});
