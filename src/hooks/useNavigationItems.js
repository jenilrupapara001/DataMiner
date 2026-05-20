import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS } from '../constants/permissions';
import { asinApi } from '../services/api';
import {
    LayoutDashboard, Users, Package, BarChart3,
    Target, TrendingUp, Calendar, PieChart,
    Settings, Activity, FileText, Layers,
    ShoppingBag, Zap, Bell, FolderOpen,
    MessageSquare, ChevronRight, Store, KeyRound, Database, Map, ListTodo, GitBranch, LayoutTemplate, Clock, BarChart2, ScanSearch, Warehouse
} from 'lucide-react';

export function useNavigationItems() {
    const { user, isAdmin, isGlobalUser, hasPermission } = useAuth();
    const [asinCount, setAsinCount] = useState('...');

    // Fetch dynamic ASIN count for sidebar badge
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await asinApi.getStats();
                if (res && res.total !== undefined) {
                    setAsinCount(res.total.toString());
                }
            } catch (err) {
                console.error('Failed to fetch ASIN stats for sidebar hook:', err);
                setAsinCount('0');
            }
        };
        fetchStats();
    }, []);

    const roleName = (
        user?.role?.name ||
        user?.role?.displayName ||
        ''
    ).toString().toLowerCase().trim();

    const isBrandManager   = roleName === 'brand manager'   || roleName === 'brand_manager';
    const isListingTeam    = roleName === 'listing_team'    || roleName === 'listing team';
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

        // SECTION: MAIN
        const mainItems = filterNull([
            // Dashboard
            guard(
                hasPermission('dashboard_view'),
                {
                    key:     'dashboard',
                    label:   'Dashboard',
                    path:    '/dashboard',
                    icon:    LayoutDashboard,
                    section: 'main',
                }
            ),

            // Sellers
            guard(
                isAdmin || isGlobalUser || isBrandManager || isCatalogManager || isListingTeam ||
                hasPermission('seller_view'),
                {
                    key:     'sellers',
                    label:   'Sellers',
                    path:    '/sellers',
                    icon:    Store,
                    section: 'main',
                }
            ),

            // ASIN Manager
            guard(
                isAdmin || isGlobalUser || isCatalogManager || isListingTeam ||
                hasPermission('asinmanager_view'),
                {
                    key:     'asin-manager',
                    label:   'ASIN Manager',
                    path:    '/asin-tracker',
                    icon:    Package,
                    badge:   asinCount !== '...' ? asinCount : undefined,
                    badgeColor: 'var(--blue)',
                    section: 'main',
                }
            ),

            // Ads Manager
            guard(
                isAdmin || isGlobalUser || hasPermission('adsreport_view'),
                {
                    key:     'ads-manager',
                    label:   'Ads Manager',
                    path:    '/ads-manager',
                    icon:    BarChart3,
                    section: 'main',
                }
            ),

            // Seller Tracker
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('asintracker_view'),
                {
                    key:     'seller-tracker',
                    label:   'Seller Tracker',
                    path:    '/seller-tracker',
                    icon:    Activity,
                    section: 'main',
                }
            ),

            // Scheduled Runs
            guard(
                isAdmin || isGlobalUser || hasPermission('scraping_view'),
                {
                    key:     'scheduled-runs',
                    label:   'Scheduled Runs',
                    path:    '/scheduled-runs',
                    icon:    Clock,
                    section: 'main',
                }
            ),

            // Alert Board
            guard(
                isAdmin || isGlobalUser || hasPermission('alerts_view'),
                {
                    key:     'alert-board',
                    label:   'Alert Board',
                    path:    '/alerts',
                    icon:    Bell,
                    section: 'main',
                }
            ),
        ]);

        // SECTION: ACTIONS
        const actionItems = filterNull([
            guard(
                isAdmin || isGlobalUser || hasPermission('actions_view'),
                {
                    key:     'workflows',
                    label:   'Workflows',
                    path:    '/actions',
                    icon:    GitBranch,
                    section: 'actions',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('tasks_view'),
                {
                    key:     'optimization-tasks',
                    label:   'Optimization Tasks',
                    path:    '/tasks',
                    icon:    ListTodo,
                    section: 'actions',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('actions_view'),
                {
                    key:     'templates',
                    label:   'Templates',
                    path:    '/actions/templates',
                    icon:    LayoutTemplate,
                    section: 'actions',
                }
            ),
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('monthlyreport_view'),
                {
                    key:     'performance',
                    label:   'Performance',
                    path:    '/actions/achievement-report',
                    icon:    BarChart2,
                    section: 'actions',
                }
            ),
            guard(
                isAdmin || hasPermission('activitylogs_view'),
                {
                    key:     'activity-log',
                    label:   'Activity Log',
                    path:    '/activity-log',
                    icon:    Clock,
                    section: 'actions',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('files_manage'),
                {
                    key:     'file-manager',
                    label:   'File Manager',
                    path:    '/file-manager',
                    icon:    FolderOpen,
                    section: 'actions',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('chat_view'),
                {
                    key:     'messaging',
                    label:   'Messaging',
                    path:    '/chat',
                    icon:    MessageSquare,
                    section: 'actions',
                }
            ),
        ]);

        // SECTION: INTELLIGENCE
        const intelligenceItems = filterNull([
            guard(
                isAdmin || isGlobalUser || hasPermission('skureport_view'),
                {
                    key:     'sku-analysis',
                    label:   'SKU Analysis',
                    path:    '/sku-report',
                    icon:    ScanSearch,
                    section: 'intelligence',
                }
            ),

            // TARGET VS ACHIEVEMENT
            guard(
                isAdmin ||
                isGlobalUser ||
                isBrandManager ||
                hasPermission(PERMISSIONS.TARGETS_VIEW),
                {
                    key:     'target-achievement',
                    label:   'Target vs Achievement',
                    path:    '/target-achievement',
                    icon:    Target,
                    section: 'intelligence',
                    badge:      isBrandManager && !isAdmin ? 'View' : undefined,
                    badgeColor: '#f59e0b',
                }
            ),

            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('parentreport_view'),
                {
                    key:     'parent-trends',
                    label:   'Parent Trends',
                    path:    '/parent-asin-report',
                    icon:    TrendingUp,
                    section: 'intelligence',
                }
            ),
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('monthlyreport_view'),
                {
                    key:     'monthly-recap',
                    label:   'Monthly Recap',
                    path:    '/month-wise-report',
                    icon:    Calendar,
                    section: 'intelligence',
                }
            ),
            guard(
                isAdmin || isGlobalUser || isBrandManager || hasPermission('pnlreport_view'),
                {
                    key:     'profit-loss',
                    label:   'Profit & Loss',
                    path:    '/profit-loss',
                    icon:    PieChart,
                    section: 'intelligence',
                }
            ),
            guard(
                isAdmin || isGlobalUser || hasPermission('inventoryreport_view'),
                {
                    key:     'inventory',
                    label:   'Inventory',
                    path:    '/inventory',
                    icon:    Warehouse,
                    section: 'intelligence',
                }
            ),
        ]);

        // SECTION: SYSTEM
        const systemItems = filterNull([
            guard(
                isAdmin || hasPermission('users_view'),
                {
                    key:     'users',
                    label:   'Users',
                    path:    '/users',
                    icon:    Users,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('roles_view'),
                {
                    key:     'team-management',
                    label:   'Team Map',
                    path:    '/team-management',
                    icon:    Map,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('settings_manage'),
                {
                    key:     'settings',
                    label:   'Settings',
                    path:    '/settings',
                    icon:    Settings,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('apikeys_manage'),
                {
                    key:     'api-keys',
                    label:   'API Keys',
                    path:    '/api-keys',
                    icon:    KeyRound,
                    section: 'system',
                }
            ),
            guard(
                isAdmin || hasPermission('asinmanager_import'),
                {
                    key:     'upload-export',
                    label:   'Data Migration',
                    path:    '/upload-export',
                    icon:    Database,
                    section: 'system',
                }
            ),
        ]);

        return {
            main:         mainItems,
            actions:      actionItems,
            intelligence: intelligenceItems,
            system:       systemItems,
            all: [...mainItems, ...actionItems, ...intelligenceItems, ...systemItems],
        };
    }, [
        isAdmin, isGlobalUser, isBrandManager,
        isListingTeam, isCatalogManager, hasPermission, asinCount, isAsinManagerOnly
    ]);
}
