/**
 * RetailOps Partner — Border Radius Tokens
 */

// ============================================================
// RADIUS SCALE
// ============================================================

export const borderRadius = {
  /** No radius */
  none: 0,
  /** Small elements — tags, small buttons */
  sm: 8,
  /** Medium elements — inputs, small cards */
  md: 12,
  /** Large elements — buttons, inputs */
  lg: 16,
  /** Extra large — cards */
  xl: 24,
  /** Full radius — chips, avatars, badges */
  full: 999,
  /** Bottom sheet top radius */
  sheet: 32,
} as const;

// ============================================================
// COMPONENT-SPECIFIC RADII
// ============================================================

export const componentRadius = {
  button: borderRadius.lg,     // 16px
  input: borderRadius.lg,      // 16px
  card: borderRadius.xl,       // 24px
  chip: borderRadius.full,     // 999px
  avatar: borderRadius.full,   // 999px
  badge: borderRadius.full,    // 999px
  sheet: borderRadius.sheet,   // 32px
  modal: borderRadius.xl,      // 24px
  toast: borderRadius.lg,      // 16px
  bottomNav: 0,                // 0px
} as const;
