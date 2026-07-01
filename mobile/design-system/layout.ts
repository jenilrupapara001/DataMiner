/**
 * RetailOps Partner — Layout Tokens
 *
 * Frame: 390 × 844
 * Safe Area: Top 59px, Bottom 34px
 */

import { Dimensions, Platform } from 'react-native';

// ============================================================
// FRAME DIMENSIONS
// ============================================================

export const frame = {
  /** Design frame width */
  width: 390,
  /** Design frame height */
  height: 844,
} as const;

// ============================================================
// SAFE AREA
// ============================================================

export const safeArea = {
  top: Platform.OS === 'ios' ? 59 : 24,
  bottom: Platform.OS === 'ios' ? 34 : 0,
  /** Total vertical safe area */
  get vertical() {
    return this.top + this.bottom;
  },
} as const;

// ============================================================
// SCREEN DIMENSIONS (runtime)
// ============================================================

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const screen = {
  width: screenWidth,
  height: screenHeight,
  /** Usable content height (excluding safe areas) */
  contentHeight: screenHeight - safeArea.top - safeArea.bottom,
} as const;

// ============================================================
// GRID SYSTEM
// ============================================================

export const grid = {
  /** Base unit for spacing */
  baseUnit: 4,
  /** Number of columns */
  columns: 4,
  /** Column gutter */
  gutter: 16,
} as const;

// ============================================================
// BOTTOM NAVIGATION
// ============================================================

export const bottomNav = {
  height: 80,
  iconSize: 24,
  labelSize: 10,
  /** Padding from bottom safe area */
  paddingBottom: 8,
} as const;

// ============================================================
// HEADER
// ============================================================

export const header = {
  height: 56,
  /** Title font size */
  titleSize: 17,
} as const;

// ============================================================
// TAB BAR
// ============================================================

export const tabBar = {
  height: 48,
  /** Indicator height */
  indicatorHeight: 2,
} as const;

// ============================================================
// COMMON DIMENSIONS
// ============================================================

export const dimensions = {
  /** Standard button height */
  buttonHeight: 56,
  /** Small button height */
  buttonHeightSm: 40,
  /** Input height */
  inputHeight: 56,
  /** Avatar sizes */
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 56,
  avatarXl: 80,
  /** Icon sizes */
  iconSm: 16,
  iconMd: 20,
  iconLg: 24,
  iconXl: 28,
  /** Badge height */
  badgeHeight: 24,
  /** Divider height */
  dividerHeight: 1,
} as const;
