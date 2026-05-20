import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Badge, ConfigProvider } from 'antd';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { asinApi } from '../../services/api';
import {
    LayoutDashboard,
    Store,
    Package,
    Activity,
    Clock,
    GitBranch,
    LayoutTemplate,
    BarChart2,
    BarChart3,
    Folder,
    MessageSquare,
    ScanSearch,
    TrendingUp,
    CalendarDays,
    ArrowLeftRight,
    Warehouse,
    Users,
    Map,
    Settings,
    KeyRound,
    Database,
    ChevronLeft,
    ChevronRight,
    LogOut,
    ListTodo,
    CheckCircle,
    Bell,
    Target
} from 'lucide-react';
import { RetailOpsWordmark, RetailOpsMark } from './BrandLogo';
import './Sidebar.css';

const { Sider } = Layout;

const Sidebar = () => {
    const { user, logout, hasPermission } = useAuth();
    const { collapsed, toggle, isMobile, isOpen, toggleMobile, setCollapsed } = useSidebar();
    const navigate = useNavigate();
    const location = useLocation();
    const [asinCount, setAsinCount] = useState('...');
    
    // Local hover state for auto expand/collapsed logic
    const [isHovered, setIsHovered] = useState(false);
    
    // The actual visual collapsed state of the Sidebar component
    const visuallyCollapsed = collapsed && !isHovered;

    // Check if user has only ASIN Manager access
    const isAsinManagerOnly = 
        user?.role?.name?.toLowerCase().includes('asin manager') || 
        user?.role?.displayName?.toLowerCase().includes('asin manager') || 
        user?.role?.name?.toLowerCase().includes('listing manager') || 
        user?.role?.displayName?.toLowerCase().includes('listing manager');
    // Track initial path to determine when the user navigates for the first time
    const initialPathRef = useRef(location.pathname);

    useEffect(() => {
        // If user navigates away from their landing route, auto-collapse the sidebar
        if (location.pathname !== initialPathRef.current) {
            if (!isMobile && setCollapsed && !collapsed) {
                setCollapsed(true);
            }
        }
    }, [location.pathname, isMobile, collapsed, setCollapsed]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await asinApi.getStats();
                if (res && res.total !== undefined) {
                    setAsinCount(res.total.toString());
                }
            } catch (err) {
                console.error('Failed to fetch ASIN stats for sidebar:', err);
                setAsinCount('0');
            }
        };
        fetchStats();
    }, []);

    const sections = [
        {
            id: 'MAIN',
            label: 'Main',
            items: [
                { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', permission: 'dashboard_view', hiddenForAsinManager: true },
                { label: 'Sellers', icon: Store, to: '/sellers', permission: 'seller_view' },
                { label: 'ASIN Manager', icon: Package, to: '/asin-tracker', permission: 'asinmanager_view', badge: asinCount },
                { label: 'Ads Manager', icon: BarChart3, to: '/ads-manager', permission: 'adsreport_view' },
                { label: 'Seller Tracker', icon: Activity, to: '/seller-tracker', permission: 'asintracker_view' },
                // NOTE: "Scrape Tasks" has been removed for now as requested
                { label: 'Scheduled Runs', icon: Clock, to: '/scheduled-runs', permission: 'scraping_view' },
                { label: 'Alert Board', icon: Bell, to: '/alerts', permission: 'dashboard_view' },
            ],
        },
        {
            id: 'ACTIONS',
            label: 'Actions',
            items: [
                { label: 'Workflows', icon: GitBranch, to: '/actions', permission: 'actions_view' },
                { label: 'Optimization Tasks', icon: ListTodo, to: '/tasks', permission: 'tasks_view' },
                { label: 'Templates', icon: LayoutTemplate, to: '/actions/templates', permission: 'actions_view' },
                { label: 'Performance', icon: BarChart2, to: '/actions/achievement-report', permission: 'monthlyreport_view' },
                { label: 'Activity Log', icon: Clock, to: '/activity-log', permission: 'activitylogs_view' },
                { label: 'File Manager', icon: Folder, to: '/file-manager', permission: 'files_manage' },
                { label: 'Messaging', icon: MessageSquare, to: '/chat', permission: 'chat_view' },
            ],
        },
        {
            id: 'INTELLIGENCE',
            label: 'Intelligence',
            items: [
                { label: 'SKU Analysis', icon: ScanSearch, to: '/sku-report', permission: 'skureport_view' },
                { label: 'Target vs Achievement', icon: Target, to: '/target-achievement', permission: 'monthlyreport_view' },
                { label: 'Parent Trends', icon: TrendingUp, to: '/parent-asin-report', permission: 'parentreport_view' },
                { label: 'Monthly Recap', icon: CalendarDays, to: '/month-wise-report', permission: 'monthlyreport_view' },
                { label: 'Profit & Loss', icon: ArrowLeftRight, to: '/profit-loss', permission: 'pnlreport_view' },
                { label: 'Inventory', icon: Warehouse, to: '/inventory', permission: 'inventoryreport_view' },
            ],
        },
        {
            id: 'SYSTEM',
            label: 'System',
            items: [
                { label: 'Users', icon: Users, to: '/users', permission: 'users_view' },
                { label: 'Team Map', icon: Map, to: '/team-management', permission: 'roles_view' },
                { label: 'Settings', icon: Settings, to: '/settings', permission: 'settings_manage' },
                { label: 'API Keys', icon: KeyRound, to: '/api-keys', permission: 'apikeys_manage' },
                { label: 'Data Migration', icon: Database, to: '/upload-export', permission: 'asinmanager_import' },
            ],
        },
    ];

    const handleNavigate = (to) => {
        navigate(to);
        if (isMobile && isOpen) toggleMobile();
    };

    const initials = (
        (user?.firstName?.[0] || '') + (user?.lastName?.[0] || user?.firstName?.[1] || '')
    ).toUpperCase() || (user?.email?.[0] || 'U').toUpperCase();

    const pipelineActive = false; // Mock state

    // Transform sections to Ant Design Menu items format
    const menuItems = sections.map((section) => {
        const filteredItems = section.items.filter(
            (item) => !item.permission || hasPermission(item.permission)
        ).filter(
            (item) => {
                if (isAsinManagerOnly) {
                    return item.label === 'ASIN Manager';
                }
                return true;
            }
        );

        if (filteredItems.length === 0) return null;

        return {
            key: section.id,
            type: 'group',
            label: visuallyCollapsed ? null : section.label,
            children: filteredItems.map((item) => ({
                key: item.to,
                icon: React.createElement(item.icon, { size: 16 }),
                label: (
                    <div className="d-flex align-items-center justify-content-between w-100">
                        <span className="menu-label-text">{item.label}</span>
                        {item.badge && !visuallyCollapsed && (
                            <Badge 
                                count={item.badge} 
                                overflowCount={9999}
                                style={{ 
                                    backgroundColor: 'var(--blue-soft)', 
                                    color: 'var(--blue)', 
                                    boxShadow: 'none',
                                    fontSize: '10px',
                                    fontWeight: 650,
                                    minWidth: '18px',
                                    height: '18px',
                                    lineHeight: '18px',
                                    border: 'none',
                                    borderRadius: '12px'
                                }} 
                            />
                        )}
                    </div>
                )
            }))
        };
    }).filter(Boolean);

    // Flatten items to find current active menu key
    const allFlatItems = sections.flatMap(s => s.items);
    const activeItem = allFlatItems.find(item => 
        location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))
    );
    const selectedKeys = activeItem ? [activeItem.to] : [];

    return (
        <>
            {isMobile && isOpen && (
                <div 
                    className="sidebar-mobile-backdrop" 
                    onClick={toggleMobile} 
                />
            )}
            <ConfigProvider
                theme={{
                    components: {
                        Menu: {
                            itemSelectedColor: 'var(--blue)',
                            itemSelectedBg: 'var(--bg-active-nav)',
                            itemHoverBg: 'var(--bg-hover)',
                            itemHoverColor: 'var(--text-primary)',
                            groupTitleColor: 'var(--text-muted)',
                            groupTitleFontSize: 10,
                            itemHeight: 38,
                            iconSize: 16,
                            itemPaddingInline: 16,
                        },
                    },
                }}
            >
                <Sider
                width={240}
                collapsedWidth={70}
                collapsed={visuallyCollapsed}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`sidebar-sider ${isMobile && !isOpen ? 'mobile-hidden' : ''}`}
                style={{
                    height: '100vh',
                    position: 'relative',
                    zIndex: 100,
                    backgroundColor: 'var(--bg-sidebar)',
                    borderRight: '1px solid var(--border)',
                }}
            >
                {/* Logo Area */}
                <div className="logo-area">
                    {visuallyCollapsed ? (
                        <RetailOpsMark size={28} />
                    ) : (
                        <RetailOpsWordmark size={28} />
                    )}
                    <button className="sidebar-toggle" onClick={toggle} title={collapsed ? "Unlock Sidebar" : "Collapse Sidebar"}>
                        <ChevronLeft size={12} style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }} />
                    </button>
                </div>

                {/* Nav Body - Scrollable Menu Container */}
                <div className="nav-body custom-scrollbar">
                    <Menu
                        mode="inline"
                        selectedKeys={selectedKeys}
                        items={menuItems}
                        onClick={(info) => handleNavigate(info.key)}
                        style={{ borderRight: 0, background: 'transparent' }}
                        inlineIndent={14}
                    />
                </div>

                {/* Bottom Area */}
                <div className="bottom-area">
                    {!visuallyCollapsed && (
                        <div className="pipeline-row">
                            <div className={`pipeline-dot ${pipelineActive ? 'active' : 'idle'}`} />
                            <span className="pipeline-text">
                                PIPELINE {pipelineActive ? 'ACTIVE' : 'IDLE'}
                            </span>
                        </div>
                    )}
                    <div className="user-row" onClick={() => navigate('/profile')}>
                        <div className="user-avatar">
                            {initials}
                        </div>
                        {!visuallyCollapsed && (
                            <>
                                <div className="user-info">
                                    <div className="user-name">{user?.fullName || 'User'}</div>
                                    <div className="user-role">{user?.role?.displayName || user?.role?.name || 'User'}</div>
                                </div>
                                <ChevronRight size={14} className="user-arrow" />
                            </>
                        )}
                    </div>
                    <button
                        className="logout-btn"
                        onClick={logout}
                        title="Logout"
                    >
                        <LogOut size={16} />
                        {!visuallyCollapsed && <span>Logout</span>}
                    </button>
                </div>
            </Sider>
        </ConfigProvider>
        </>
    );
};

export default Sidebar;
