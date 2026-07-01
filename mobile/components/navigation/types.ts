/**
 * RetailOps Partner — Bottom Navigation Types
 */

import { LucideIcon } from 'lucide-react-native';

export type TabId = 'home' | 'tickets' | 'reports' | 'messages' | 'profile';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: LucideIcon;
  /** Badge count - shows dot if 0, shows number if > 0 */
  badge?: number;
  /** Whether this tab has unread items */
  hasUnread?: boolean;
}

export interface BottomNavigationProps {
  /** Currently active tab */
  activeTab: TabId;
  /** Callback when tab is pressed */
  onTabPress: (tabId: TabId) => void;
  /** Tab configurations with badges */
  tabs?: TabConfig[];
  /** Whether to show the navigation bar */
  visible?: boolean;
}

export interface TabItemProps {
  /** Tab configuration */
  tab: TabConfig;
  /** Whether this tab is active */
  isActive: boolean;
  /** Callback when tab is pressed */
  onPress: () => void;
}
