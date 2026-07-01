/**
 * RetailOps Partner — Shadow Tokens
 *
 * Note: Android uses `elevation`, iOS uses `shadow*` props.
 * This system provides both.
 */

import { Platform, ViewStyle } from 'react-native';

// ============================================================
// SHADOW DEFINITIONS
// ============================================================

interface ShadowStyle extends ViewStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

function createShadow(
  iOSOffset: { width: number; height: number },
  iOSRadius: number,
  iOSOpacity: number,
  androidElevation: number
): ShadowStyle {
  return Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: iOSOffset,
      shadowOpacity: iOSOpacity,
      shadowRadius: iOSRadius,
      elevation: androidElevation,
    },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: androidElevation,
    },
  }) as ShadowStyle;
}

// ============================================================
// SHADOW SCALE
// ============================================================

export const shadows = {
  /**
   * Subtle elevation — small elements, inline badges
   * 0 1px 2px rgba(15,23,42,0.05)
   */
  sm: createShadow(
    { width: 0, height: 1 },
    2,
    0.05,
    2
  ),

  /**
   * Card shadow — standard cards, list items
   * 0 4px 12px rgba(15,23,42,0.06)
   */
  md: createShadow(
    { width: 0, height: 4 },
    12,
    0.06,
    4
  ),

  /**
   * Elevated cards — featured cards, dropdowns
   * 0 4px 24px rgba(15,23,42,0.06)
   */
  lg: createShadow(
    { width: 0, height: 4 },
    24,
    0.06,
    8
  ),

  /**
   * Modals, floating elements
   * 0 12px 32px rgba(15,23,42,0.08)
   */
  xl: createShadow(
    { width: 0, height: 12 },
    32,
    0.08,
    16
  ),

  /**
   * Bottom sheets (top shadow)
   * 0 -8px 32px rgba(15,23,42,0.12)
   */
  sheet: Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.12,
      shadowRadius: 32,
      elevation: 24,
    },
    default: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 24,
    },
  }) as ShadowStyle,

  /**
   * No shadow
   */
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } as ShadowStyle,
} as const;
