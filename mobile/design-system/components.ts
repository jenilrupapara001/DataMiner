/**
 * RetailOps Partner — Component Tokens
 *
 * Pre-defined token bindings for common components.
 */

import { primary, neutral, success, warning, error, info, communication } from './colors';
import { typography } from './typography';
import { borderRadius } from './borderRadius';
import { space } from './spacing';
import { shadows } from './shadows';
import { dimensions } from './layout';

// ============================================================
// BUTTON TOKENS
// ============================================================

export const buttonTokens = {
  primary: {
    height: dimensions.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: primary.DEFAULT,
    textColor: '#FFFFFF',
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    paddingHorizontal: space[6],
  },
  primaryHover: {
    backgroundColor: primary.hover,
  },
  secondary: {
    height: dimensions.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: '#FFFFFF',
    textColor: primary.DEFAULT,
    borderWidth: 1,
    borderColor: neutral.border,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    paddingHorizontal: space[6],
  },
  ghost: {
    height: dimensions.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: 'transparent',
    textColor: primary.DEFAULT,
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    paddingHorizontal: space[6],
  },
  danger: {
    height: dimensions.buttonHeight,
    borderRadius: borderRadius.lg,
    backgroundColor: error.DEFAULT,
    textColor: '#FFFFFF',
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    paddingHorizontal: space[6],
  },
  sm: {
    height: dimensions.buttonHeightSm,
    paddingHorizontal: space[4],
  },
  disabled: {
    opacity: 0.5,
  },
} as const;

// ============================================================
// INPUT TOKENS
// ============================================================

export const inputTokens = {
  default: {
    height: dimensions.inputHeight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: neutral.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: space[4],
    fontSize: 16,
    color: neutral.textPrimary,
  },
  focus: {
    borderColor: primary.DEFAULT,
    borderWidth: 1.5,
  },
  error: {
    borderColor: error.DEFAULT,
    borderWidth: 1.5,
  },
  success: {
    borderColor: success.DEFAULT,
    borderWidth: 1.5,
  },
  label: {
    ...typography.label,
    color: neutral.textPrimary,
    marginBottom: space[1],
  },
  helper: {
    ...typography.helper,
    color: neutral.textMuted,
    marginTop: space[1],
  },
  errorText: {
    ...typography.helper,
    color: error.DEFAULT,
    marginTop: space[1],
  },
} as const;

// ============================================================
// CARD TOKENS
// ============================================================

export const cardTokens = {
  default: {
    borderRadius: borderRadius.xl,
    backgroundColor: '#FFFFFF',
    padding: space[4],
    ...shadows.md,
  },
  elevated: {
    borderRadius: borderRadius.xl,
    backgroundColor: '#FFFFFF',
    padding: space[4],
    ...shadows.lg,
  },
  kpi: {
    borderRadius: borderRadius.xl,
    backgroundColor: '#FFFFFF',
    padding: space[5],
    gap: space[3],
    ...shadows.md,
  },
  ticket: {
    borderRadius: borderRadius.xl,
    backgroundColor: '#FFFFFF',
    padding: space[4],
    gap: space[3],
    ...shadows.md,
  },
  report: {
    borderRadius: borderRadius.xl,
    backgroundColor: '#FFFFFF',
    padding: space[4],
    gap: space[3],
    ...shadows.md,
  },
} as const;

// ============================================================
// AVATAR TOKENS
// ============================================================

export const avatarTokens = {
  sm: {
    width: dimensions.avatarSm,
    height: dimensions.avatarSm,
    borderRadius: borderRadius.full,
  },
  md: {
    width: dimensions.avatarMd,
    height: dimensions.avatarMd,
    borderRadius: borderRadius.full,
  },
  lg: {
    width: dimensions.avatarLg,
    height: dimensions.avatarLg,
    borderRadius: borderRadius.full,
  },
  xl: {
    width: dimensions.avatarXl,
    height: dimensions.avatarXl,
    borderRadius: borderRadius.full,
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: success.DEFAULT,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
} as const;

// ============================================================
// BADGE TOKENS
// ============================================================

export const badgeTokens = {
  default: {
    height: dimensions.badgeHeight,
    paddingHorizontal: space[2] + 2, // 10px
    borderRadius: borderRadius.full,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  text: {
    ...typography.caption,
    fontWeight: '600' as const,
  },
  status: {
    open: {
      backgroundColor: '#EFF6FF',
      textColor: '#2563EB',
    },
    inProgress: {
      backgroundColor: '#FFFBEB',
      textColor: '#D97706',
    },
    resolved: {
      backgroundColor: '#F0FDF4',
      textColor: '#16A34A',
    },
    closed: {
      backgroundColor: '#F8FAFC',
      textColor: '#64748B',
    },
    escalated: {
      backgroundColor: '#FEF2F2',
      textColor: '#DC2626',
    },
  },
  priority: {
    low: {
      backgroundColor: '#F8FAFC',
      textColor: '#64748B',
    },
    medium: {
      backgroundColor: '#EFF6FF',
      textColor: '#2563EB',
    },
    high: {
      backgroundColor: '#FFF7ED',
      textColor: '#EA580C',
    },
    critical: {
      backgroundColor: '#FEF2F2',
      textColor: '#DC2626',
    },
  },
  communication: {
    backgroundColor: communication.light,
    textColor: communication.DEFAULT,
  },
} as const;

// ============================================================
// BOTTOM NAVIGATION TOKENS
// ============================================================

export const bottomNavTokens = {
  height: dimensions.inputHeight + 24, // 80px
  backgroundColor: '#FFFFFF',
  borderTopWidth: 1,
  borderTopColor: neutral.border,
  activeColor: primary.DEFAULT,
  inactiveColor: neutral.textSecondary,
  iconSize: dimensions.iconLg,
  labelSize: 10,
  ...shadows.sm,
} as const;

// ============================================================
// BOTTOM SHEET TOKENS
// ============================================================

export const bottomSheetTokens = {
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.sheet,
    borderTopRightRadius: borderRadius.sheet,
    paddingTop: space[3],
    paddingHorizontal: space[4],
    paddingBottom: space[8],
    ...shadows.sheet,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: borderRadius.full,
    backgroundColor: neutral[300],
    alignSelf: 'center' as const,
    marginBottom: space[4],
  },
} as const;

// ============================================================
// EMPTY STATE TOKENS
// ============================================================

export const emptyStateTokens = {
  container: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: space[12],
    paddingHorizontal: space[8],
  },
  icon: {
    size: 64,
    color: neutral[300],
  },
  title: {
    ...typography.cardTitle,
    color: neutral.textPrimary,
    marginTop: space[4],
    textAlign: 'center' as const,
  },
  description: {
    ...typography.body,
    color: neutral.textSecondary,
    marginTop: space[2],
    textAlign: 'center' as const,
  },
} as const;
