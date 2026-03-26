import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { motion, AnimatePresence } from 'framer-motion';
import './Sidebar.css';
import {
    ChevronDown,
    LayoutDashboard,
    Store,
    Target,
    ScanLine,
    Zap,
    CloudDownload,
    Kanban,
    LayoutTemplate,
    BarChart3,
    BookOpen,
    FolderOpen,
    MessageSquare,
    FileText,
    TrendingUp,
    Activity,
    Calculator,
    Bell,
    Users,
    ShieldCheck,
    Settings as SettingsIcon,
    KeyRound,
    ArrowLeftRight,
    LogOut,
    Moon,
    Sun,
    HelpCircle,
    MoreVertical,
    ChevronRight
} from 'lucide-react';

const SidebarItem = ({ item, collapsed, active, onNavigate }) => {
    const [isHovered, setIsHovered] = useState(false);
    const navigate = useNavigate();

    const handleClick = (e) => {
        if (onNavigate) {
            onNavigate();
        }
        navigate(item.to);
    };

    return (
        <Link
            to={item.to}
            className={`sidebar-item d-flex align-items-center gap-3 px-3 py-2 rounded-2 text-decoration-none transition-all mb-1 ${active ? 'bg-primary text-white' : 'text-muted'
                }`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
        >
            <div className="d-flex align-items-center justify-content-center" style={{ width: '20px' }}>
                {item.icon && <item.icon size={18} strokeWidth={active ? 2.5 : 2} />}
            </div>
            {!collapsed && (
                <span className="fw-medium flex-grow-1" style={{ fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                    {item.label}
                </span>
            )}
            {!collapsed && item.badge && (
                <span className="badge rounded-pill bg-danger smallest" style={{ fontSize: '10px' }}>
                    {item.badge}
                </span>
            )}
        </Link>
    );
};

const SidebarSection = ({ section, collapsed, activePath, hasPermission, onNavigate }) => {
    const [isOpen, setIsOpen] = useState(!section.collapsible);

    const filteredItems = section.items.filter(
        (item) => !item.permission || hasPermission(item.permission)
    );

    if (filteredItems.length === 0) return null;

    return (
        <div className={`sidebar-section mb-3 ${collapsed ? 'px-2' : 'px-3'}`}>
            {section.label && !collapsed && (
                <div
                    className="d-flex align-items-center justify-content-between mb-2 px-1 cursor-pointer"
                    onClick={() => section.collapsible && setIsOpen(!isOpen)}
                >
                    <span className="smallest fw-bold text-muted text-uppercase tracking-wider">
                        {section.label}
                    </span>
                    {section.collapsible && (
                        <motion.div animate={{ rotate: isOpen ? 0 : -90 }}>
                            <ChevronDown size={12} className="text-muted opacity-50" />
                        </motion.div>
                    )}
                </div>
            )}

            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={section.collapsible ? { height: 0, opacity: 0 } : false}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {filteredItems.map((item, idx) => (
                            <SidebarItem
                                key={idx}
                                item={item}
                                collapsed={collapsed}
                                active={activePath === item.to || (item.to !== '/' && activePath.startsWith(item.to))}
                                onNavigate={onNavigate}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Sidebar = () => {
    const { user, logout, hasPermission } = useAuth();
    const { collapsed, toggle, isOpen, toggleMobile, isMobile } = useSidebar();
    const location = useLocation();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [theme, setTheme] = useState('light');

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
    };

    const sections = [
        {
            label: 'Main',
            items: [
                { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', permission: 'dashboard_view' },
                { label: 'Sellers', icon: Store, to: '/sellers', permission: 'sellers_view' },
                { label: 'ASIN Manager', icon: ScanLine, to: '/asin-tracker', permission: 'sellers_view' },
                { label: 'Seller Tracker', icon: Zap, to: '/seller-tracker', permission: 'sellers_view' },
                { label: 'Scrape Tasks', icon: CloudDownload, to: '/scrape-tasks', permission: 'scraping_view' },
            ],
        },
        {
            label: 'Actions',
            items: [
                { label: 'Workflows', icon: Kanban, to: '/actions', permission: 'actions_view' },
                { label: 'Templates', icon: LayoutTemplate, to: '/actions/templates', permission: 'actions_view' },
                { label: 'Performance', icon: BarChart3, to: '/actions/achievement-report', permission: 'reports_monthly_view' },
                { label: 'Activity Log', icon: BookOpen, to: '/activity-log', permission: 'settings_view' },
                { label: 'File Manager', icon: FolderOpen, to: '/file-manager' },
                { label: 'Messaging', icon: MessageSquare, to: '/chat' },
            ],
        },
        {
            label: 'Intelligence',
            collapsible: true,
            items: [
                { label: 'SKU Analysis', icon: FileText, to: '/sku-report', permission: 'reports_sku_view' },
                { label: 'Parent Trends', icon: TrendingUp, to: '/parent-asin-report', permission: 'reports_parent_view' },
                { label: 'Monthly Recap', icon: BarChart3, to: '/month-wise-report', permission: 'reports_monthly_view' },
                { label: 'Advertising', icon: Activity, to: '/ads-report', permission: 'reports_ads_view' },
                { label: 'Profit & Loss', icon: TrendingUp, to: '/profit-loss', permission: 'reports_profit_view' },
                { label: 'Inventory', icon: Store, to: '/inventory', permission: 'reports_inventory_view' },
            ],
        },
        {
            label: 'System',
            collapsible: true,
            items: [
                { label: 'Users', icon: Users, to: '/users', permission: 'users_view' },
                { label: 'Security Roles', icon: ShieldCheck, to: '/roles', permission: 'roles_view' },
                { label: 'Team Map', icon: Users, to: '/team-management', permission: 'roles_view' },
                { label: 'Settings', icon: SettingsIcon, to: '/settings', permission: 'settings_view' },
                { label: 'API Keys', icon: KeyRound, to: '/api-keys', permission: 'settings_view' },
                { label: 'Data Migration', icon: ArrowLeftRight, to: '/upload-export', permission: 'sellers_manage_asins' },
            ],
        },
    ];

    const initials = (
        (user?.firstName?.[0] || '') + (user?.lastName?.[0] || user?.firstName?.[1] || '')
    ).toUpperCase();

    // Handle mobile: show overlay and sidebar
    const shouldShowSidebar = !isMobile || isOpen;

    return (
        <>
            {/* Mobile overlay */}
            {isMobile && isOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={toggleMobile}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 999
                    }}
                />
            )}
            <motion.div
                className="sidebar-container bg-white border-end shadow-sm d-flex flex-column"
                animate={{
                    width: collapsed ? '72px' : '260px',
                    x: isMobile && !isOpen ? '-100%' : 0
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                style={{
                    height: '100vh',
                    position: isMobile ? 'fixed' : 'sticky',
                    top: 0,
                    zIndex: 1000,
                    display: shouldShowSidebar ? 'flex' : 'none'
                }}
            >
                {/* ── Header ───────────────────────────────────── */}
                <div className="sidebar-header px-3 border-bottom d-flex align-items-center justify-content-between" style={{ height: '64px' }}>
                    <div className="d-flex align-items-center gap-3 overflow-hidden">
                        <div className="flex-shrink-0 bg-primary rounded-2 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                            <Store size={18} className="text-white" />
                        </div>
                        {!collapsed && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="overflow-hidden"
                            >
                                <h1 className="h6 fw-bold mb-0 text-dark text-nowrap">RetailOps</h1>
                                <p className="smallest text-muted mb-0 text-nowrap">Enterprise Platform</p>
                            </motion.div>
                        )}
                    </div>
                    {!collapsed && (
                        <button
                            className="btn btn-icon btn-sm btn-ghost text-muted"
                            onClick={() => setShowUserMenu(!showUserMenu)}
                        >
                            <MoreVertical size={16} />
                        </button>
                    )}
                </div>

                {/* ── User Menu Popup (Floating) ──────────────── */}
                <AnimatePresence>
                    {showUserMenu && !collapsed && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="position-absolute bg-white shadow-lg border rounded-3 p-2"
                            style={{ top: '65px', right: '15px', zIndex: 1100, width: '180px' }}
                        >
                            <button className="btn btn-sm btn-ghost w-100 justify-content-start gap-2 mb-1" onClick={toggleTheme}>
                                {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                            </button>
                            <button className="btn btn-sm btn-ghost w-100 justify-content-start gap-2 mb-1">
                                <HelpCircle size={14} />
                                <span>Help & Docs</span>
                            </button>
                            <div className="dropdown-divider"></div>
                            <button className="btn btn-sm btn-danger w-100 justify-content-start gap-2" onClick={logout}>
                                <LogOut size={14} />
                                <span>Logout</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Navigation Sections ──────────────────────── */}
                <div className="sidebar-content flex-grow-1 overflow-auto py-3 custom-scrollbar">
                    {sections.map((section, idx) => (
                        <SidebarSection
                            key={idx}
                            section={section}
                            collapsed={collapsed}
                            activePath={location.pathname}
                            hasPermission={hasPermission}
                            onNavigate={isMobile ? toggleMobile : undefined}
                        />
                    ))}
                </div>

                {/* ── Footer / Profile ─────────────────────────── */}
                <div className="sidebar-footer p-3 border-top">
                    {!collapsed ? (
                        <div className="d-flex align-items-center justify-content-between gap-3">
                            <Link to="/profile" className="d-flex align-items-center gap-3 text-decoration-none min-w-0 flex-grow-1">
                                <div
                                    className="avatar flex-shrink-0 bg-light rounded-circle d-flex align-items-center justify-content-center fw-bold text-primary border"
                                    style={{ width: '32px', height: '32px', fontSize: '12px' }}
                                >
                                    {initials}
                                </div>
                                <div className="overflow-hidden">
                                    <div className="fw-bold text-dark smallest text-truncate">{user?.fullName || 'User Account'}</div>
                                    <div className="smallest text-muted text-truncate" style={{ fontSize: '10px' }}>{user?.email}</div>
                                </div>
                            </Link>
                            <button className="btn btn-icon btn-sm btn-secondary border-0" onClick={toggle}>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    ) : (
                        <div className="d-flex flex-column align-items-center gap-3">
                            <Link to="/profile" className="avatar bg-light rounded-circle d-flex align-items-center justify-content-center fw-bold text-primary border" style={{ width: '36px', height: '36px', fontSize: '13px' }}>
                                {initials}
                            </Link>
                            <button className="btn btn-icon btn-sm btn-secondary border-0" onClick={toggle}>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </>
    );
};

export default Sidebar;
