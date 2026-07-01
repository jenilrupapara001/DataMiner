# RetailOps Partner — Design System Foundation

**Version:** 1.0.0
**Platform:** React Native Expo SDK 54
**Frame:** 390 × 844 (Safe Area: Top 59px, Bottom 34px)

---

## 1. Design Tokens

All tokens are exported as TypeScript constants from `design-system/`.

```
design-system/
├── tokens.ts        # Master token export
├── colors.ts        # Color palette + semantic tokens
├── typography.ts    # Font scale + text styles
├── spacing.ts       # 4px grid system
├── shadows.ts       # Elevation system
├── borderRadius.ts  # Radius scale
├── layout.ts        # Frame + safe area + grid
├── icons.ts         # Lucide icon registry
├── components.ts    # Component token bindings
└── index.ts         # Barrel export
```

---

## 2. Color System

### Primary Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#2563EB` | CTAs, links, active states |
| `primaryHover` | `#1D4ED8` | Pressed/hovered primary |
| `primaryLight` | `#EFF6FF` | Primary tinted backgrounds |
| `primaryDark` | `#1E40AF` | Dark mode primary |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#16A34A` | Resolved tickets, positive trends |
| `successLight` | `#F0FDF4` | Success tinted backgrounds |
| `warning` | `#F59E0B` | SLA warnings, medium priority |
| `warningLight` | `#FFFBEB` | Warning tinted backgrounds |
| `error` | `#DC2626` | Critical tickets, errors |
| `errorLight` | `#FEF2F2` | Error tinted backgrounds |
| `info` | `#0EA5E9` | Informational, low priority |
| `infoLight` | `#F0F9FF` | Info tinted backgrounds |
| `communication` | `#7C3AED` | Chat, calls, meetings |

### Neutral Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#F8FAFC` | Screen background |
| `surface` | `#FFFFFF` | Cards, sheets, modals |
| `border` | `#E2E8F0` | Card borders, input borders |
| `divider` | `#CBD5E1` | Section dividers |
| `textPrimary` | `#0F172A` | Headings, primary content |
| `textSecondary` | `#64748B` | Descriptions, labels |
| `textMuted` | `#94A3B8` | Placeholders, timestamps |
| `textInverse` | `#FFFFFF` | Text on dark/colored backgrounds |

### Status Colors

| Status | Background | Text | Border |
|--------|-----------|------|--------|
| Open | `#EFF6FF` | `#2563EB` | `#BFDBFE` |
| In Progress | `#FFFBEB` | `#D97706` | `#FDE68A` |
| Resolved | `#F0FDF4` | `#16A34A` | `#BBF7D0` |
| Closed | `#F8FAFC` | `#64748B` | `#E2E8F0` |
| Escalated | `#FEF2F2` | `#DC2626` | `#FECACA` |

### Priority Colors

| Priority | Background | Text | Icon |
|----------|-----------|------|------|
| Low | `#F8FAFC` | `#64748B` | `#94A3B8` |
| Medium | `#EFF6FF` | `#2563EB` | `#3B82F6` |
| High | `#FFF7ED` | `#EA580C` | `#F97316` |
| Critical | `#FEF2F2` | `#DC2626` | `#EF4444` |

---

## 3. Typography

**Font Family:** Inter
**Fallback:** SF Pro Display (iOS), sans-serif (Android)

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `display` | 32px | 700 | 40px | -0.02em | Hero stats, dashboard |
| `pageTitle` | 28px | 700 | 36px | -0.01em | Screen headers |
| `sectionTitle` | 20px | 600 | 28px | 0 | Section headers |
| `cardTitle` | 16px | 600 | 24px | 0 | Card titles, list items |
| `body` | 14px | 400 | 20px | 0.01em | Body text, descriptions |
| `caption` | 12px | 500 | 16px | 0.02em | Labels, timestamps |
| `button` | 15px | 600 | 20px | 0.01em | Button text |
| `overline` | 11px | 600 | 16px | 0.06em | Category labels, badges |

### Text Colors

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `textPrimary` | `#0F172A` | `#F8FAFC` |
| `textSecondary` | `#64748B` | `#94A3B8` |
| `textMuted` | `#94A3B8` | `#64748B` |
| `textInverse` | `#FFFFFF` | `#0F172A` |
| `textLink` | `#2563EB` | `#60A5FA` |

---

## 4. Spacing System

**Base Unit:** 4px

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `space[0]` | 0px | — |
| `space[1]` | 4px | Tight internal padding |
| `space[2]` | 8px | Icon gaps, small padding |
| `space[3]` | 12px | Compact list items |
| `space[4]` | 16px | Standard padding, card padding |
| `space[5]` | 20px | Section gaps |
| `space[6]` | 24px | Card internal spacing |
| `space[8]` | 32px | Section spacing |
| `space[10]` | 40px | Large section gaps |
| `space[12]` | 48px | Page margins |
| `space[16]` | 64px | Hero spacing |

### Layout Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `screenPadding` | 16px | Horizontal screen padding |
| `cardPadding` | 16px | Internal card padding |
| `sectionGap` | 24px | Gap between sections |
| `itemGap` | 12px | Gap between list items |
| `inlineGap` | 8px | Gap between inline elements |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius.none` | 0px | — |
| `radius.sm` | 8px | Small elements |
| `radius.md` | 12px | Inputs, small cards |
| `radius.lg` | 16px | Buttons, inputs |
| `radius.xl` | 24px | Cards |
| `radius.full` | 999px | Chips, avatars, badges |
| `radius.sheet` | 32px | Bottom sheet top radius |

---

## 6. Shadow System

| Token | Shadow | Usage |
|-------|--------|-------|
| `shadow.sm` | `0 1px 2px rgba(15,23,42,0.05)` | Subtle elevation |
| `shadow.md` | `0 4px 12px rgba(15,23,42,0.06)` | Cards |
| `shadow.lg` | `0 4px 24px rgba(15,23,42,0.06)` | Elevated cards |
| `shadow.xl` | `0 12px 32px rgba(15,23,42,0.08)` | Modals, floating elements |
| `shadow.sheet` | `0 -8px 32px rgba(15,23,42,0.12)` | Bottom sheets |

---

## 7. Component Tokens

### Button

| Token | Value |
|-------|-------|
| `height.sm` | 40px |
| `height.md` | 48px |
| `height.lg` | 56px |
| `radius` | 16px |
| `fontSize` | 15px |
| `fontWeight` | 600 |

### Input

| Token | Value |
|-------|-------|
| `height` | 56px |
| `radius` | 16px |
| `borderWidth` | 1px |
| `fontSize` | 16px |
| `paddingHorizontal` | 16px |

### Card

| Token | Value |
|-------|-------|
| `radius` | 24px |
| `padding` | 16px |
| `gap` | 12px |

### Avatar

| Token | Value |
|-------|-------|
| `size.sm` | 32px |
| `size.md` | 40px |
| `size.lg` | 56px |
| `size.xl` | 80px |
| `radius` | 999px |

### Badge

| Token | Value |
|-------|-------|
| `height` | 24px |
| `paddingHorizontal` | 10px |
| `radius` | 999px |
| `fontSize` | 12px |

### Bottom Navigation

| Token | Value |
|-------|-------|
| `height` | 80px |
| `iconSize` | 24px |
| `labelSize` | 10px |
| `activeColor` | `#2563EB` |
| `inactiveColor` | `#64748B` |

---

## 8. Navigation System

### Screen Hierarchy

```
Root Stack
├── (auth)
│   ├── login.tsx
│   └── otp.tsx
├── (tabs)
│   ├── _layout.tsx
│   ├── index.tsx          # Home / Dashboard
│   ├── tickets.tsx        # Ticket Listing
│   ├── reports.tsx        # Reports Hub
│   ├── messages.tsx       # Chat & Communication
│   └── profile.tsx        # Profile
├── ticket/
│   ├── [id].tsx           # Ticket Details
│   └── raise.tsx          # Raise Ticket
├── report/
│   └── [id].tsx           # Report Viewer
├── team.tsx               # My Team
├── notifications.tsx      # Notifications
├── ai-assistant.tsx       # AI Assistant
├── sla-tracker.tsx        # SLA Tracker
└── analytics.tsx          # Ticket Analytics
```

### Tab Bar Configuration

| Tab | Icon | Screen |
|-----|------|--------|
| Home | `home` | Dashboard |
| Tickets | `ticket` | Ticket Listing |
| Reports | `bar-chart-2` | Reports Hub |
| Messages | `message-circle` | Chat & Communication |
| Profile | `user` | Profile |

---

## 9. Icon System

**Library:** Lucide React Native
**Sizes:** 16px (inline), 20px (list), 24px (tab bar), 28px (featured)

### Icon Categories

| Category | Icons |
|----------|-------|
| Navigation | `home`, `search`, `bell`, `user`, `menu` |
| Tickets | `ticket`, `plus`, `alert-circle`, `check-circle`, `clock` |
| Reports | `bar-chart-2`, `download`, `file-text`, `calendar` |
| Communication | `message-circle`, `phone`, `video`, `send` |
| Status | `check`, `x`, `alert-triangle`, `info` |
| Actions | `edit`, `trash`, `share`, `external-link`, `chevron-right` |
| Dashboard | `trending-up`, `trending-down`, `users`, `target` |

---

## 10. Accessibility

### Touch Targets
- **Minimum:** 44 × 44px
- **Recommended:** 48 × 48px
- **Button height:** 56px

### Contrast Ratios
- **Primary text on white:** 15.4:1 (AAA)
- **Secondary text on white:** 5.7:1 (AA)
- **White text on primary blue:** 4.6:1 (AA)

### Screen Reader
- All interactive elements must have `accessibilityLabel`
- Status changes must have `accessibilityLiveRegion`
- Group related elements with `accessibilityRole`

---

## 11. Figma Component Architecture

### Page Structure

```
Figma File
├── 📄 Cover
├── 📄 Tokens
│   ├── Colors
│   ├── Typography
│   ├── Spacing
│   ├── Shadows
│   └── Radius
├── 📄 Primitives
│   ├── Buttons
│   ├── Inputs
│   ├── Badges
│   ├── Avatars
│   ├── Cards
│   └── Icons
├── 📄 Components
│   ├── KPI Card
│   ├── Ticket Card
│   ├── Report Card
│   ├── Status Badge
│   ├── Priority Badge
│   ├── Empty State
│   └── Loading State
├── 📄 Patterns
│   ├── List Item
│   ├── Section Header
│   ├── Search Bar
│   ├── Filter Bar
│   └── Tab Bar
└── 📄 Screens
    ├── Auth
    ├── Dashboard
    ├── Tickets
    ├── Reports
    ├── Messages
    ├── Profile
    └── ...
```

### Component Naming Convention

```
[Category]/[Component]/[Variant]
```

Examples:
- `Primitives/Button/Primary`
- `Components/Ticket Card/Open`
- `Patterns/List Item/With Avatar`

### Auto Layout Rules

| Component | Direction | Gap | Padding |
|-----------|-----------|-----|---------|
| Button | Horizontal | 8px | 16px |
| Input | Vertical | 4px | 16px |
| Card | Vertical | 12px | 16px |
| List Item | Horizontal | 12px | 16px |
| Tab Bar | Horizontal | 0 | 0 |

---

## 12. Export Structure

```typescript
// design-system/index.ts
export { colors, semanticColors, statusColors, priorityColors } from './colors';
export { typography, textStyles } from './typography';
export { spacing, layoutSpacing } from './spacing';
export { shadows } from './shadows';
export { borderRadius } from './borderRadius';
export { layout } from './layout';
export { iconRegistry } from './icons';
export { componentTokens } from './components';
export { tokens } from './tokens';
```

---

## 13. Implementation Notes

### React Native Specifics

1. **Shadows:** Use `elevation` on Android, `shadow*` props on iOS
2. **Fonts:** Load Inter via `expo-font` at app startup
3. **Icons:** Use `lucide-react-native` package
4. **Safe Areas:** Use `react-native-safe-area-context`
5. **Haptics:** Use `expo-haptics` for interactive feedback

### Performance

1. **Memoize** theme objects to prevent re-renders
2. **Use StyleSheet.create** for all static styles
3. **Lazy load** heavy screens with `React.lazy`

### Dark Mode

1. All tokens have light/dark variants
2. Use `useColorScheme()` hook
3. Persist user preference in AsyncStorage

---

*This design system is the single source of truth for all RetailOps Partner UI. Every screen, component, and interaction must conform to these tokens and guidelines.*
