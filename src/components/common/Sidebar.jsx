import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { asinApi } from '../../services/api';
import {
    LayoutDashboard,
    Store,
    Package,
    Activity,
    Bot,
    GitBranch,
    LayoutTemplate,
    BarChart2,
    Clock,
    Folder,
    MessageSquare,
    ScanSearch,
    TrendingUp,
    CalendarDays,
    Megaphone,
    ArrowLeftRight,
    Warehouse,
    Users,
    ShieldCheck,
    Map,
    Settings,
    KeyRound,
    Database,
    ChevronLeft,
    ChevronRight,
    Zap,
    LogOut,
    ListTodo
} from 'lucide-react';
import './Sidebar.css';

const NavItem = ({ item, collapsed, active, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={`nav-item ${active ? 'active' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => onClick(item.to)}
        >
            <div className="nav-item-icon">
                <item.icon size={15} />
            </div>
            {!collapsed && (
                <span className="nav-item-label">{item.label}</span>
            )}
            {!collapsed && item.badge && (
                <div className="nav-item-badge">{item.badge}</div>
            )}
            {collapsed && isHovered && (
                <div className="nav-tooltip">
                    {item.label}
                </div>
            )}
            {active && !collapsed && <div className="active-indicator" />}
        </div>
    );
};

const Sidebar = () => {
    const { user, logout, hasPermission } = useAuth();
    const { collapsed, toggle, isMobile, isOpen, toggleMobile } = useSidebar();
    const navigate = useNavigate();
    const location = useLocation();
    const [asinCount, setAsinCount] = useState('...');

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
                { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', permission: 'dashboard_view' },
                { label: 'Sellers', icon: Store, to: '/sellers', permission: 'seller_view' },
                { label: 'ASIN Manager', icon: Package, to: '/asin-tracker', permission: 'asinmanager_view', badge: asinCount },
                { label: 'Seller Tracker', icon: Activity, to: '/seller-tracker', permission: 'asintracker_view' },
                { label: 'Scrape Tasks', icon: Bot, to: '/scrape-tasks', permission: 'scraping_view' },
            ],
        },
        {
            id: 'ACTIONS',
            label: 'Actions',
            items: [
                { label: 'Workflows', icon: GitBranch, to: '/actions', permission: 'actions_view' },
                { label: 'Optimization Tasks', icon: ListTodo, to: '/tasks', permission: 'dashboard_view' },
                { label: 'Templates', icon: LayoutTemplate, to: '/actions/templates', permission: 'actions_view' },
                { label: 'Performance', icon: BarChart2, to: '/actions/achievement-report', permission: 'monthlyreport_view' },
                { label: 'Activity Log', icon: Clock, to: '/activity-log', permission: 'activitylogs_view' },
                { label: 'File Manager', icon: Folder, to: '/file-manager', permission: 'files_manage' },
                { label: 'Messaging', icon: MessageSquare, to: '/chat', permission: 'dashboard_view' },
            ],
        },
        {
            id: 'INTELLIGENCE',
            label: 'Intelligence',
            items: [
                { label: 'SKU Analysis', icon: ScanSearch, to: '/sku-report', permission: 'skureport_view' },
                { label: 'Parent Trends', icon: TrendingUp, to: '/parent-asin-report', permission: 'parentreport_view' },
                { label: 'Monthly Recap', icon: CalendarDays, to: '/month-wise-report', permission: 'monthlyreport_view' },
                { label: 'Advertising', icon: Megaphone, to: '/ads-report', permission: 'adsreport_view' },
                { label: 'Profit & Loss', icon: ArrowLeftRight, to: '/profit-loss', permission: 'pnlreport_view' },
                { label: 'Inventory', icon: Warehouse, to: '/inventory', permission: 'inventoryreport_view' },
            ],
        },
        {
            id: 'SYSTEM',
            label: 'System',
            items: [
                { label: 'Users', icon: Users, to: '/users', permission: 'users_view' },
                { label: 'Security Roles', icon: ShieldCheck, to: '/roles', permission: 'roles_view' },
                { label: 'Team Map', icon: Map, to: '/team-management', permission: 'roles_view' },
                { label: 'Settings', icon: Settings, to: '/settings', permission: 'dashboard_view' },
                { label: 'API Keys', icon: KeyRound, to: '/api-keys', permission: 'dashboard_view' },
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

    return (
        <aside className={`sidebar-redesign ${collapsed ? 'collapsed' : ''} ${isMobile && !isOpen ? 'mobile-hidden' : ''}`}>
            {/* Logo Area */}
            <div className="logo-area">
                <div className="logo-icon">
                    <Zap size={13} fill="white" className="text-white" />
                </div>
                {!collapsed && (
                    <span className="logo-text">RetailOps</span>
                )}
                <button className="sidebar-toggle" onClick={toggle}>
                    <ChevronLeft size={12} style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }} />
                </button>
            </div>

            {/* Nav Body */}
            <div className="nav-body custom-scrollbar">
                {sections.map((section) => {
                    const filteredItems = section.items.filter(
                        (item) => !item.permission || hasPermission(item.permission)
                    );
                    if (filteredItems.length === 0) return null;

                    return (
                        <div key={section.id} className="nav-section">
                            {collapsed ? (
                                <div className="section-divider" />
                            ) : (
                                <div className="section-header">{section.label}</div>
                            )}
                            {filteredItems.map((item, idx) => (
                                <NavItem
                                    key={idx}
                                    item={item}
                                    collapsed={collapsed}
                                    active={location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to))}
                                    onClick={handleNavigate}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>

            {/* Bottom Area */}
            <div className="bottom-area">
                {!collapsed && (
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
                    {!collapsed && (
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
                    {!collapsed && <span>Logout</span>}
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
