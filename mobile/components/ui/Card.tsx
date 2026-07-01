/**
 * RetailOps Partner — Card Component
 *
 * Enterprise-grade card with consistent styling.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  /** Card variant */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Card padding */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Additional styles */
  style?: ViewStyle;
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.container,
        styles[`${variant}Container`],
        styles[`${padding}Padding`],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  // Variants
  defaultContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  elevatedContainer: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 8,
  },
  outlinedContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  // Padding
  nonePadding: {
    padding: 0,
  },
  smPadding: {
    padding: 12,
  },
  mdPadding: {
    padding: 16,
  },
  lgPadding: {
    padding: 24,
  },
});
