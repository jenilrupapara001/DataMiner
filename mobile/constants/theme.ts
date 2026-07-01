/**
 * RetailOps Partner — Theme
 *
 * Re-exports design system tokens for backwards compatibility.
 * New code should import from '@/design-system' directly.
 */

import { Colors } from '@/design-system/colors';
import { fontFamily, fontFamilyFallback } from '@/design-system/typography';
import { space, layoutSpacing } from '@/design-system/spacing';
import { shadows } from '@/design-system/shadows';
import { borderRadius } from '@/design-system/borderRadius';
import { frame, safeArea, dimensions } from '@/design-system/layout';
import { Platform } from 'react-native';

export { Colors };

export const Fonts = Platform.select({
  ios: {
    sans: 'Inter',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'Inter',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

export { fontFamily, fontFamilyFallback, space, layoutSpacing, shadows, borderRadius, frame, safeArea, dimensions };
