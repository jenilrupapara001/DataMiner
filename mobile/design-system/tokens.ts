/**
 * RetailOps Partner — Master Token Export
 *
 * Single source of truth for all design tokens.
 */

import { primary, success, warning, error, info, communication, neutral, statusColors, priorityColors, Colors } from './colors';
import { typography, textColors, textStyles, fontFamily, fontFamilyFallback } from './typography';
import { space, layoutSpacing, gaps, padding, margin, Spacing } from './spacing';
import { shadows } from './shadows';
import { borderRadius, componentRadius } from './borderRadius';
import { frame, safeArea, screen, grid, bottomNav, header, tabBar, dimensions } from './layout';
import { iconSizes, iconRegistry, tabBarIcons } from './icons';
import {
  buttonTokens,
  inputTokens,
  cardTokens,
  avatarTokens,
  badgeTokens,
  bottomNavTokens,
  bottomSheetTokens,
  emptyStateTokens,
} from './components';

// ============================================================
// MASTER TOKENS OBJECT
// ============================================================

export const tokens = {
  colors: {
    primary,
    success,
    warning,
    error,
    info,
    communication,
    neutral,
    status: statusColors,
    priority: priorityColors,
    text: textColors,
    legacy: Colors,
  },
  typography: {
    ...typography,
    fontFamily,
    fontFamilyFallback,
    colors: textColors,
    styles: textStyles,
  },
  spacing: {
    ...space,
    layout: layoutSpacing,
    gaps,
    padding,
    margin,
    legacy: Spacing,
  },
  borderRadius: {
    ...borderRadius,
    component: componentRadius,
  },
  shadows,
  layout: {
    frame,
    safeArea,
    screen,
    grid,
    bottomNav,
    header,
    tabBar,
    dimensions,
  },
  icons: {
    sizes: iconSizes,
    registry: iconRegistry,
    tabBar: tabBarIcons,
  },
  components: {
    button: buttonTokens,
    input: inputTokens,
    card: cardTokens,
    avatar: avatarTokens,
    badge: badgeTokens,
    bottomNav: bottomNavTokens,
    bottomSheet: bottomSheetTokens,
    emptyState: emptyStateTokens,
  },
} as const;

export type Tokens = typeof tokens;
