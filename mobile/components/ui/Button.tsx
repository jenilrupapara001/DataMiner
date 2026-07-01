/**
 * RetailOps Partner — Button Component
 *
 * Enterprise-grade button with loading, disabled, and variant states.
 */

import React from 'react';
import { Text, StyleSheet, Pressable, ActivityIndicator, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  /** Button text */
  children: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether button is loading */
  loading?: boolean;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Loading text (replaces children when loading) */
  loadingText?: string;
  /** Button press handler */
  onPress?: () => void;
  /** Additional styles */
  style?: ViewStyle;
  /** Full width button */
  fullWidth?: boolean;
  /** Leading icon */
  icon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  loadingText,
  onPress,
  style,
  fullWidth = true,
  icon,
}: ButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!disabled && !loading) {
      scale.value = withSpring(0.98, {
        damping: 15,
        stiffness: 300,
      });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 300,
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isDisabled = disabled || loading;

  const getContainerStyle = (): ViewStyle[] => {
    const base: ViewStyle[] = [styles.container, styles[`${size}Container`]];

    if (fullWidth) base.push(styles.fullWidth);

    switch (variant) {
      case 'primary':
        base.push(styles.primaryContainer);
        if (isDisabled) base.push(styles.primaryDisabled);
        break;
      case 'secondary':
        base.push(styles.secondaryContainer);
        if (isDisabled) base.push(styles.secondaryDisabled);
        break;
      case 'ghost':
        base.push(styles.ghostContainer);
        if (isDisabled) base.push(styles.ghostDisabled);
        break;
      case 'danger':
        base.push(styles.dangerContainer);
        if (isDisabled) base.push(styles.dangerDisabled);
        break;
    }

    if (style) base.push(style);

    return base;
  };

  const getTextColor = (): string => {
    if (isDisabled && variant === 'primary') return '#FFFFFF';
    if (variant === 'secondary') return '#2563EB';
    if (variant === 'ghost') return '#2563EB';
    if (variant === 'danger') return '#FFFFFF';
    return '#FFFFFF';
  };

  return (
    <AnimatedPressable
      style={[...getContainerStyle(), animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : icon ? (
        <>
          {icon}
          <Text style={[styles.text, { color: getTextColor() }, styles[`${size}Text`]]}>
            {children}
          </Text>
        </>
      ) : (
        <Text style={[styles.text, { color: getTextColor() }, styles[`${size}Text`]]}>
          {loading ? loadingText || children : children}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
  },
  fullWidth: {
    width: '100%',
  },
  // Sizes
  smContainer: {
    height: 40,
    paddingHorizontal: 16,
  },
  mdContainer: {
    height: 48,
    paddingHorizontal: 20,
  },
  lgContainer: {
    height: 56,
    paddingHorizontal: 24,
  },
  // Variants
  primaryContainer: {
    backgroundColor: '#2563EB',
  },
  primaryDisabled: {
    backgroundColor: '#93C5FD',
  },
  secondaryContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  ghostDisabled: {
    backgroundColor: 'transparent',
  },
  dangerContainer: {
    backgroundColor: '#DC2626',
  },
  dangerDisabled: {
    backgroundColor: '#FCA5A5',
  },
  // Text
  text: {
    fontWeight: '600',
    letterSpacing: 0.01,
  },
  smText: {
    fontSize: 14,
  },
  mdText: {
    fontSize: 15,
  },
  lgText: {
    fontSize: 15,
  },
});
