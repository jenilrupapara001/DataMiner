/**
 * RetailOps Partner — Icon System
 *
 * Library: Lucide React Native
 * Sizes: 16px (inline), 20px (list), 24px (tab bar), 28px (featured)
 */

// ============================================================
// ICON SIZE SCALE
// ============================================================

export const iconSizes = {
  /** Inline text icons */
  sm: 16,
  /** List item icons */
  md: 20,
  /** Tab bar, navigation icons */
  lg: 24,
  /** Featured, hero icons */
  xl: 28,
} as const;

// ============================================================
// ICON REGISTRY (by category)
// ============================================================

export const iconRegistry = {
  // Navigation
  navigation: {
    home: 'home',
    search: 'search',
    bell: 'bell',
    user: 'user',
    menu: 'menu',
    settings: 'settings',
    chevronLeft: 'chevron-left',
    chevronRight: 'chevron-right',
    chevronDown: 'chevron-down',
    arrowLeft: 'arrow-left',
    arrowRight: 'arrow-right',
    x: 'x',
    plus: 'plus',
  },

  // Tickets
  tickets: {
    ticket: 'ticket',
    alertCircle: 'alert-circle',
    checkCircle: 'check-circle',
    clock: 'clock',
    alertTriangle: 'alert-triangle',
    messageSquare: 'message-square',
    paperclip: 'paperclip',
    tag: 'tag',
    folder: 'folder',
    archive: 'archive',
  },

  // Reports
  reports: {
    barChart: 'bar-chart-2',
    download: 'download',
    fileText: 'file-text',
    calendar: 'calendar',
    pieChart: 'pie-chart',
    trend: 'trending-up',
    filter: 'filter',
    share: 'share',
  },

  // Communication
  communication: {
    messageCircle: 'message-circle',
    phone: 'phone',
    video: 'video',
    send: 'send',
    mic: 'mic',
    micOff: 'mic-off',
    volume2: 'volume-2',
    volumeX: 'volume-x',
    atSign: 'at-sign',
    hash: 'hash',
  },

  // Status
  status: {
    check: 'check',
    x: 'x',
    alertTriangle: 'alert-triangle',
    info: 'info',
    loader: 'loader',
    refreshCw: 'refresh-cw',
    rotateCcw: 'rotate-ccw',
  },

  // Actions
  actions: {
    edit: 'edit',
    trash: 'trash',
    share: 'share',
    externalLink: 'external-link',
    copy: 'copy',
    link: 'link',
    moreVertical: 'more-vertical',
    moreHorizontal: 'more-horizontal',
    eye: 'eye',
    eyeOff: 'eye-off',
    lock: 'lock',
    unlock: 'unlock',
    shield: 'shield',
  },

  // Dashboard
  dashboard: {
    trendingUp: 'trending-up',
    trendingDown: 'trending-down',
    users: 'users',
    target: 'target',
    zap: 'zap',
    activity: 'activity',
    database: 'database',
    server: 'server',
    globe: 'globe',
   Layers: 'layers',
    grid: 'grid',
    layout: 'layout',
  },

  // AI Assistant
  ai: {
    sparkles: 'sparkles',
    wand: 'wand-2',
    brain: 'brain',
    lightbulb: 'lightbulb',
    helpCircle: 'help-circle',
    messageCircle: 'message-circle',
  },

  // Profile & Settings
  profile: {
    user: 'user',
    users: 'users',
    settings: 'settings',
    logOut: 'log-out',
    moon: 'moon',
    sun: 'sun',
    globe: 'globe',
    shield: 'shield',
    key: 'key',
    mail: 'mail',
    phone: 'phone',
  },

  // Media & Attachments
  media: {
    image: 'image',
    camera: 'camera',
    file: 'file',
    folder: 'folder',
    upload: 'upload',
    download: 'download',
    paperclip: 'paperclip',
  },
} as const;

// ============================================================
// TAB BAR ICONS
// ============================================================

export const tabBarIcons = {
  home: {
    active: 'home',
    inactive: 'home',
  },
  tickets: {
    active: 'ticket',
    inactive: 'ticket',
  },
  reports: {
    active: 'bar-chart-2',
    inactive: 'bar-chart-2',
  },
  messages: {
    active: 'message-circle',
    inactive: 'message-circle',
  },
  profile: {
    active: 'user',
    inactive: 'user',
  },
} as const;
