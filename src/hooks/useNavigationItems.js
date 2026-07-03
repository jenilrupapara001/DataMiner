import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../constants/permissions';
import { asinApi } from '../services/api';
import {
    LayoutDashboard, Users, Package, BarChart3,
    Target, TrendingUp, Calendar, PieChart,
    Settings, Activity, FileText, Layers,
    ShoppingBag, Zap, Bell, FolderOpen,
    MessageSquare, ChevronRight, Store, KeyRound, Database, Map, ListTodo, GitBranch, LayoutTemplate, Clock, BarChart2, ScanSearch, Warehouse, Webhook, ClipboardList, CheckSquare, UserCheck, LineChart, RefreshCcw
} from 'lucide-react';

export function useNavigationItems() {
    const { user, isAdmin, isGlobalUser, hasPermission } = useAuth();
    const [asinCount, setAsinCount] = useState(null);

    // Fetch dynamic ASIN count for sidebar badge
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await asinApi.getStats();
                if (res && res.total !== undefined) {
                    setAsinCount(Number(res.total) || 0);
                } else {
                    setAsinCount(0);
                }
            } catch (err) {
                console.error('Failed to fetch ASIN stats for sidebar hook:', err);
                setAsinCount(0);
            }
        };
        fetchStats();
    }, []);

    const roleName = (
        user?.role?.name ||
        user?.role?.displayName ||
        ''
    ).toString().toLowerCase().trim();

    const isBrandManager = roleName === 'brand manager' || roleName === 'brand_manager';
    const isListingTeam = roleName === 'listing_team' || roleName === 'listing team';
    const isCatalogManager = roleName === 'catalog_manager' || roleName === 'catalog manager';

    // ASIN Manager Only restriction from standard roles
    const isAsinManagerOnly =
        roleName.includes('asin manager') ||
        roleName.includes('listing manager');

    return useMemo(() => {
        // Helper: only include if condition is true
        const guard = (condition, item) => (condition ? item : null);

        const filterNull = (items) => {
            const filtered = items.filter((i) => i !== null);
            if (isAsinManagerOnly) {
                return filtered.filter(item => item.key === 'asin-manager');
            }
            return filtered;
        };

        // SECTION: OVERVIEW
        const overviewItems = filterNull([
            guard(
                hasPermission('dashboard_view'),
                {
                    key: 'dashboard',
                    label: 'Dashboard',
                    path: '/dashboard',
                    icon: LayoutDashboard,
                    section: 'overview',
                }
            ),
            guard(
                isAdmin || isGlobalUser || isBrandManager || isCatalogManager || isListingTeam ||
                hasPermission('seller_view'),
                {
                    key: 'sellers',
                    label: 'Sellers',
                    path: '/sellers',
                    icon: Store,
                    section: 'overview',
                }
            ),
        ]);

        // SECTION: CATALOG & ADS
        const catalogItems = filterNull([
            guard(
                isAdmin || isGlobalUser || isCatalogManager || isListingTeam ||
                hasPermission('asinmanager_view'),
                {
                    key: 'asin-manager',
                    label: 'ASIN Manager',
                    path: '/asin-tracker',
                    icon: Package,
                    badge: asinCount !== null ? asinCount : undefined,
                    badgeColor: '#0ea206f0',
                    section: 'catalog',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('adsreport_view'),
                {
                    key: 'ads-manager',
                    label: 'Ads Manager',
                    path: '/ads-manager',
                    icon: BarChart3,
                    section: 'catalog',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('gms_tracker_view'),
                {
                    key: 'gms-tracker',
                    label: 'GMS Tracker',
                    path: '/gms-tracker',
                    icon: TrendingUp,
                    section: 'catalog',
                }
            ),
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('asintracker_view'),
                {
                    key: 'seller-tracker',
                    label: 'Seller Tracker',
                    path: '/seller-tracker',
                    icon: Activity,
                    section: 'catalog',
                }
            ),
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('parentreport_view'),
                {
                    key: 'parent-trends',
                    label: 'Parent Trends',
                    path: '/parent-asin-report',
                    icon: TrendingUp,
                    section: 'catalog',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('skureport_view'),
                {
                    key: 'sku-analysis',
                    label: 'SKU Analysis',
                    path: '/sku-report',
                    icon: ScanSearch,
                    section: 'catalog',
                }
            ),
        ]);

        // SECTION: AUTOMATION & TASKS
        const automationItems = filterNull([
            guard(
                isAdmin || isGlobalUser || hasPermission('rules_view'),
                {
                    key: 'rule-sets',
                    label: 'Rule Sets',
                    path: '/rule-sets',
                    icon: Zap,
                    section: 'automation',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('tasks_view'),
                {
                    key: 'workflows',
                    label: 'Workflows & Tasks',
                    path: '/tasks',
                    icon: ListTodo,
                    section: 'automation',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('tasks_view'),
                {
                    key: 'pems-dashboard',
                    label: 'PEMS Dashboard',
                    path: '/pems/dashboard',
                    icon: BarChart2,
                    section: 'automation',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('tasks_manage'),
                {
                    key: 'pems-templates',
                    label: 'Task Templates',
                    path: '/pems/templates',
                    icon: ClipboardList,
                    section: 'automation',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('tasks_view'),
                {
                    key: 'pems-instances',
                    label: 'Task Execution',
                    path: '/pems/tasks',
                    icon: CheckSquare,
                    section: 'automation',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('tasks_view'),
                {
                    key: 'pems-reviews',
                    label: 'Review Queue',
                    path: '/pems/reviews',
                    icon: UserCheck,
                    section: 'automation',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('tasks_view'),
                {
                    key: 'pems-analytics',
                    label: 'Analytics',
                    path: '/pems/analytics',
                    icon: LineChart,
                    section: 'automation',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('scraping_view'),
                {
                    key: 'scheduled-runs',
                    label: 'Scheduled Runs',
                    path: '/scheduled-runs',
                    icon: Clock,
                    section: 'automation',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('scraping_view'),
                {
                    key: 'live-sync-tracker',
                    label: 'Live Sync Tracker',
                    path: '/live-sync-tracker',
                    icon: RefreshCcw,
                    section: 'automation',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('actions_view'),
                {
                    key: 'templates',
                    label: 'Templates',
                    path: '/actions/templates',
                    icon: LayoutTemplate,
                    section: 'automation',
                }
            ),
        ]);

        // SECTION: ANALYTICS & FINANCE
        const intelligenceItems = filterNull([
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('pnlreport_view'),
                {
                    key: 'profit-loss',
                    label: 'Profit & Loss',
                    path: '/profit-loss',
                    icon: PieChart,
                    section: 'intelligence',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('inventoryreport_view'),
                {
                    key: 'inventory',
                    label: 'Inventory',
                    path: '/inventory',
                    icon: Warehouse,
                    section: 'intelligence',
                }
            ),
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission(PERMISSIONS.TARGETS_VIEW),
                {
                    key: 'target-achievement',
                    label: 'Target vs Achievement',
                    path: '/target-achievement',
                    icon: Target,
                    section: 'intelligence',
                    badge: isBrandManager && !isAdmin ? 'View' : undefined,
                    badgeColor: '#ED6C02',
                }
            ),
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('monthlyreport_view'),
                {
                    key: 'monthly-recap',
                    label: 'Monthly Recap',
                    path: '/month-wise-report',
                    icon: Calendar,
                    section: 'intelligence',
                }
            ),
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('monthlyreport_view'),
                {
                    key: 'performance',
                    label: 'Performance',
                    path: '/actions/achievement-report',
                    icon: BarChart2,
                    section: 'intelligence',
                }
            ),
        ]);

        // SECTION: SYSTEM & CONTROL
        const systemItems = filterNull([
            guard(
                isAdmin || isGlobalUser || hasPermission('activitylogs_view') || hasPermission('alerts_view'),
                {
                    key: 'activity-log',
                    label: 'Activity Log',
                    path: '/alerts',
                    icon: Activity,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('users_view'),
                {
                    key: 'users',
                    label: 'Users',
                    path: '/users',
                    icon: Users,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('roles_view'),
                {
                    key: 'team-management',
                    label: 'Team Map',
                    path: '/team-management',
                    icon: Map,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('asinmanager_import'),
                {
                    key: 'upload-export',
                    label: 'Data Migration',
                    path: '/upload-export',
                    icon: Database,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('files_manage'),
                {
                    key: 'file-manager',
                    label: 'File Manager',
                    path: '/file-manager',
                    icon: FolderOpen,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('apikeys_manage'),
                {
                    key: 'api-keys',
                    label: 'API Keys',
                    path: '/api-keys',
                    icon: KeyRound,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('settings_manage'),
                {
                    key: 'settings',
                    label: 'Settings',
                    path: '/settings',
                    icon: Settings,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('rules_manage'),
                {
                    key: 'webhooks',
                    label: 'Webhooks',
                    path: '/webhooks',
                    icon: Webhook,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('chat_view'),
                {
                    key: 'messaging',
                    label: 'Messaging',
                    path: '/chat',
                    icon: MessageSquare,
                    section: 'system',
                }
            ),
        ]);

        return {
            overview: overviewItems,
            catalog: catalogItems,
            automation: automationItems,
            intelligence: intelligenceItems,
            system: systemItems,
            all: [...overviewItems, ...catalogItems, ...automationItems, ...intelligenceItems, ...systemItems],
        };
    }, [
        isAdmin, isGlobalUser, isBrandManager,
        isListingTeam, isCatalogManager, hasPermission, asinCount, isAsinManagerOnly
    ]);
}
