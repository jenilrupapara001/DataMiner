/**
 * RetailOps Partner — Color Tokens
 *
 * Enterprise B2B SaaS Color System
 * Reference: Stripe, Linear, Shopify, Notion
 */

// ============================================================
// PRIMARY PALETTE
// ============================================================

export const primary = {
  /** Primary CTA, links, active states */
  DEFAULT: '#2563EB',
  /** Pressed/hovered primary */
  hover: '#1D4ED8',
  /** Dark mode primary */
  dark: '#1E40AF',
  /** Tinted backgrounds, light fills */
  light: '#EFF6FF',
  /** Very light tint for subtle highlights */
  50: '#EFF6FF',
  100: '#DBEAFE',
  200: '#BFDBFE',
  300: '#93C5FD',
  400: '#60A5FA',
  500: '#3B82F6',
  600: '#2563EB',
  700: '#1D4ED8',
  800: '#1E40AF',
  900: '#1E3A8A',
} as const;

// ============================================================
// SEMANTIC COLORS
// ============================================================

export const success = {
  DEFAULT: '#16A34A',
  dark: '#15803D',
  light: '#F0FDF4',
  50: '#F0FDF4',
  100: '#DCFCE7',
  200: '#BBF7D0',
  300: '#86EFAC',
  400: '#4ADE80',
  500: '#22C55E',
  600: '#16A34A',
  700: '#15803D',
  800: '#166534',
  900: '#14532D',
} as const;

export const warning = {
  DEFAULT: '#F59E0B',
  dark: '#D97706',
  light: '#FFFBEB',
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#F59E0B',
  600: '#D97706',
  700: '#B45309',
  800: '#92400E',
  900: '#78350F',
} as const;

export const error = {
  DEFAULT: '#DC2626',
  dark: '#B91C1C',
  light: '#FEF2F2',
  50: '#FEF2F2',
  100: '#FEE2E2',
  200: '#FECACA',
  300: '#FCA5A5',
  400: '#F87171',
  500: '#EF4444',
  600: '#DC2626',
  700: '#B91C1C',
  800: '#991B1B',
  900: '#7F1D1D',
} as const;

export const info = {
  DEFAULT: '#0EA5E9',
  dark: '#0284C7',
  light: '#F0F9FF',
  50: '#F0F9FF',
  100: '#E0F2FE',
  200: '#BAE6FD',
  300: '#7DD3FC',
  400: '#38BDF8',
  500: '#0EA5E9',
  600: '#0284C7',
  700: '#0369A1',
  800: '#075985',
  900: '#0C4A6E',
} as const;

export const communication = {
  /** Chat, calls, meetings */
  DEFAULT: '#7C3AED',
  hover: '#6D28D9',
  dark: '#5B21B6',
  light: '#F5F3FF',
  50: '#F5F3FF',
  100: '#EDE9FE',
  200: '#DDD6FE',
  300: '#C4B5FD',
  400: '#A78BFA',
  500: '#8B5CF6',
  600: '#7C3AED',
  700: '#6D28D9',
  800: '#5B21B6',
  900: '#4C1D95',
} as const;

// ============================================================
// NEUTRAL PALETTE
// ============================================================

export const neutral = {
  /** Screen background */
  background: '#F8FAFC',
  /** Cards, sheets, modals */
  surface: '#FFFFFF',
  /** Card borders, input borders */
  border: '#E2E8F0',
  /** Section dividers */
  divider: '#CBD5E1',
  /** Headings, primary content */
  textPrimary: '#0F172A',
  /** Descriptions, labels */
  textSecondary: '#64748B',
  /** Placeholders, timestamps */
  textMuted: '#94A3B8',
  /** Text on dark/colored backgrounds */
  textInverse: '#FFFFFF',
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
  950: '#020617',
} as const;

// ============================================================
// STATUS COLORS
// ============================================================

export const statusColors = {
  open: {
    background: '#EFF6FF',
    text: '#2563EB',
    border: '#BFDBFE',
    icon: '#3B82F6',
  },
  inProgress: {
    background: '#FFFBEB',
    text: '#D97706',
    border: '#FDE68A',
    icon: '#F59E0B',
  },
  resolved: {
    background: '#F0FDF4',
    text: '#16A34A',
    border: '#BBF7D0',
    icon: '#22C55E',
  },
  closed: {
    background: '#F8FAFC',
    text: '#64748B',
    border: '#E2E8F0',
    icon: '#94A3B8',
  },
  escalated: {
    background: '#FEF2F2',
    text: '#DC2626',
    border: '#FECACA',
    icon: '#EF4444',
  },
} as const;

// ============================================================
// PRIORITY COLORS
// ============================================================

export const priorityColors = {
  low: {
    background: '#F8FAFC',
    text: '#64748B',
    icon: '#94A3B8',
    border: '#E2E8F0',
  },
  medium: {
    background: '#EFF6FF',
    text: '#2563EB',
    icon: '#3B82F6',
    border: '#BFDBFE',
  },
  high: {
    background: '#FFF7ED',
    text: '#EA580C',
    icon: '#F97316',
    border: '#FED7AA',
  },
  critical: {
    background: '#FEF2F2',
    text: '#DC2626',
    icon: '#EF4444',
    border: '#FECACA',
  },
} as const;

// ============================================================
// LEGACY COMPAT (maps to new tokens)
// ============================================================

export const Colors = {
  light: {
    text: neutral.textPrimary,
    background: neutral.background,
    tint: primary.DEFAULT,
    icon: neutral.textSecondary,
    tabIconDefault: neutral.textMuted,
    tabIconSelected: primary.DEFAULT,
  },
  dark: {
    text: neutral.textInverse,
    background: neutral[900],
    tint: primary[400],
    icon: neutral[400],
    tabIconDefault: neutral[400],
    tabIconSelected: primary[400],
  },
} as const;
