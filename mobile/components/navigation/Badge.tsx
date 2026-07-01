/**
 * RetailOps Partner — Badge Component
 *
 * Enterprise-grade badge for tab bar notifications.
 * Supports both dot indicators and count badges.
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface BadgeProps {
  /** Count to display. If 0, shows dot. If undefined, shows nothing. */
  count?: number;
  /** Maximum count to display (e.g., 99+) */
  maxCount?: number;
  /** Custom background color */
  backgroundColor?: string;
  /** Custom text color */
  textColor?: string;
}

export function Badge({
  count,
  maxCount = 99,
  backgroundColor = '#DC2626',
  textColor = '#FFFFFF',
}: BadgeProps) {
  const scale = useSharedValue(0);

  React.useEffect(() => {
    if (count !== undefined && count > 0) {
      scale.value = withSpring(1, {
        damping: 12,
        stiffness: 200,
      });
    } else if (count === 0) {
      scale.value = withSpring(1, {
        damping: 15,
        stiffness: 250,
      });
    } else {
      scale.value = withTiming(0, { duration: 150 });
    }
  }, [count, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (count === undefined) return null;

  // Dot indicator (count === 0 with hasUnread)
  if (count === 0) {
    return (
      <Animated.View style={[styles.dot, { backgroundColor }, animatedStyle]} />
    );
  }

  // Count badge
  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <Animated.View
      style={[
        styles.badge,
        { backgroundColor },
        animatedStyle,
      ]}
    >
      <Text style={[styles.text, { color: textColor }]}>{displayCount}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    textAlign: 'center',
  },
});
