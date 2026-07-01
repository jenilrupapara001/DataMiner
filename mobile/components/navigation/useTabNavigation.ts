/**
 * RetailOps Partner — Use Tab Navigation Hook
 *
 * Manages tab state and provides navigation functions.
 */

import { useState, useCallback } from 'react';
import { House, Ticket, BarChart3, MessageSquare, User } from 'lucide-react-native';
import { TabId, TabConfig } from './types';

interface UseTabNavigationOptions {
  /** Initial active tab */
  initialTab?: TabId;
  /** Callback when tab changes */
  onTabChange?: (tabId: TabId) => void;
  /** Tab configurations with badges */
  tabs?: TabConfig[];
}

interface UseTabNavigationReturn {
  /** Currently active tab */
  activeTab: TabId;
  /** Set active tab */
  setActiveTab: (tabId: TabId) => void;
  /** Handle tab press */
  handleTabPress: (tabId: TabId) => void;
  /** Update badge count for a tab */
  updateBadge: (tabId: TabId, count: number) => void;
  /** Get current tabs with badges */
  tabs: TabConfig[];
}

export function useTabNavigation({
  initialTab = 'home',
  onTabChange,
  tabs: initialTabs,
}: UseTabNavigationOptions = {}): UseTabNavigationReturn {
  const [activeTab, setActiveTabState] = useState<TabId>(initialTab);
  const [tabs, setTabs] = useState<TabConfig[]>(
    initialTabs || getDefaultTabs()
  );

  const handleTabPress = useCallback(
    (tabId: TabId) => {
      if (tabId !== activeTab) {
        setActiveTabState(tabId);
        onTabChange?.(tabId);
      }
    },
    [activeTab, onTabChange]
  );

  const setActiveTab = useCallback(
    (tabId: TabId) => {
      setActiveTabState(tabId);
      onTabChange?.(tabId);
    },
    [onTabChange]
  );

  const updateBadge = useCallback((tabId: TabId, count: number) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, badge: count } : tab
      )
    );
  }, []);

  return {
    activeTab,
    setActiveTab,
    handleTabPress,
    updateBadge,
    tabs,
  };
}

function getDefaultTabs(): TabConfig[] {
  return [
    { id: 'home', label: 'Home', icon: House },
    { id: 'tickets', label: 'Tickets', icon: Ticket },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'profile', label: 'Profile', icon: User },
  ];
}
