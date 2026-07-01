/**
 * RetailOps Partner — Spacing Tokens
 *
 * Base Unit: 4px
 * All layouts must use these values only.
 */

// ============================================================
// SPACING SCALE
// ============================================================

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ============================================================
// LAYOUT SPACING (semantic aliases)
// ============================================================

export const layoutSpacing = {
  /** Horizontal screen padding */
  screenPadding: 16,
  /** Internal card padding */
  cardPadding: 16,
  /** Gap between sections */
  sectionGap: 24,
  /** Gap between list items */
  itemGap: 12,
  /** Gap between inline elements */
  inlineGap: 8,
  /** Tight internal padding (badges, tags) */
  tightPadding: 4,
  /** Small padding (icon containers) */
  smallPadding: 8,
  /** Standard padding */
  standardPadding: 16,
  /** Large padding */
  largePadding: 24,
} as const;

// ============================================================
// GAP UTILITIES
// ============================================================

export const gaps = {
  xs: space[1],   // 4px
  sm: space[2],   // 8px
  md: space[3],   // 12px
  lg: space[4],   // 16px
  xl: space[6],   // 24px
  xxl: space[8],  // 32px
} as const;

// ============================================================
// PADDING UTILITIES
// ============================================================

export const padding = {
  none: space[0],
  xs: space[1],   // 4px
  sm: space[2],   // 8px
  md: space[4],   // 16px
  lg: space[6],   // 24px
  xl: space[8],   // 32px
} as const;

// ============================================================
// MARGIN UTILITIES
// ============================================================

export const margin = {
  none: space[0],
  xs: space[1],   // 4px
  sm: space[2],   // 8px
  md: space[4],   // 16px
  lg: space[6],   // 24px
  xl: space[8],   // 32px
  auto: 'auto' as const,
} as const;

// ============================================================
// LEGACY COMPAT
// ============================================================

export const Spacing = {
  xs: space[1],
  sm: space[2],
  md: space[4],
  lg: space[6],
  xl: space[8],
  xxl: space[10],
} as const;
