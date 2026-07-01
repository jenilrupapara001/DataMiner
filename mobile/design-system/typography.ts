/**
 * RetailOps Partner — Typography Tokens
 *
 * Font Family: Inter
 * Fallback: SF Pro Display (iOS), sans-serif (Android)
 */

import { Platform, TextStyle } from 'react-native';

// ============================================================
// FONT FAMILIES
// ============================================================

export const fontFamily = Platform.select({
  ios: 'Inter',
  android: 'Inter',
  default: 'Inter',
}) as string;

export const fontFamilyFallback = Platform.select({
  ios: '-apple-system, SF Pro Display',
  android: 'sans-serif',
  default: 'sans-serif',
}) as string;

// ============================================================
// TYPE SCALE
// ============================================================

export const typography = {
  /**
   * Display — Hero stats, dashboard highlights
   * 32px / 700 / 40px line height
   */
  display: {
    fontSize: 32,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 40,
    letterSpacing: -0.02,
    fontFamily,
  },

  /**
   * Page Title — Screen headers
   * 28px / 700 / 36px line height
   */
  pageTitle: {
    fontSize: 28,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 36,
    letterSpacing: -0.01,
    fontFamily,
  },

  /**
   * Section Title — Section headers
   * 20px / 600 / 28px line height
   */
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 28,
    letterSpacing: 0,
    fontFamily,
  },

  /**
   * Card Title — Card titles, list item titles
   * 16px / 600 / 24px line height
   */
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 24,
    letterSpacing: 0,
    fontFamily,
  },

  /**
   * Body — Body text, descriptions
   * 14px / 400 / 20px line height
   */
  body: {
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
    letterSpacing: 0.01,
    fontFamily,
  },

  /**
   * Body Semibold — Emphasized body text
   * 14px / 600 / 20px line height
   */
  bodySemibold: {
    fontSize: 14,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 20,
    letterSpacing: 0.01,
    fontFamily,
  },

  /**
   * Caption — Labels, timestamps, metadata
   * 12px / 500 / 16px line height
   */
  caption: {
    fontSize: 12,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 16,
    letterSpacing: 0.02,
    fontFamily,
  },

  /**
   * Button — Button text
   * 15px / 600 / 20px line height
   */
  button: {
    fontSize: 15,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 20,
    letterSpacing: 0.01,
    fontFamily,
  },

  /**
   * Overline — Category labels, badges
   * 11px / 600 / 16px line height
   */
  overline: {
    fontSize: 11,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 16,
    letterSpacing: 0.06,
    fontFamily,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  },

  /**
   * Label — Form labels
   * 14px / 500 / 20px line height
   */
  label: {
    fontSize: 14,
    fontWeight: '500' as TextStyle['fontWeight'],
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily,
  },

  /**
   * Helper — Helper text, error messages
   * 12px / 400 / 16px line height
   */
  helper: {
    fontSize: 12,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 16,
    letterSpacing: 0.01,
    fontFamily,
  },
} as const;

// ============================================================
// TEXT COLOR TOKENS
// ============================================================

export const textColors = {
  primary: '#0F172A',
  secondary: '#64748B',
  muted: '#94A3B8',
  inverse: '#FFFFFF',
  link: '#2563EB',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#0EA5E9',
} as const;

// ============================================================
// PRE-BUILT TEXT STYLES (convenience)
// ============================================================

export const textStyles = {
  display: {
    ...typography.display,
    color: textColors.primary,
  },
  pageTitle: {
    ...typography.pageTitle,
    color: textColors.primary,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    color: textColors.primary,
  },
  cardTitle: {
    ...typography.cardTitle,
    color: textColors.primary,
  },
  body: {
    ...typography.body,
    color: textColors.primary,
  },
  bodySecondary: {
    ...typography.body,
    color: textColors.secondary,
  },
  caption: {
    ...typography.caption,
    color: textColors.muted,
  },
  button: {
    ...typography.button,
    color: textColors.inverse,
  },
  overline: {
    ...typography.overline,
    color: textColors.muted,
  },
  label: {
    ...typography.label,
    color: textColors.primary,
  },
  helper: {
    ...typography.helper,
    color: textColors.muted,
  },
  link: {
    ...typography.body,
    color: textColors.link,
  },
} as const;
