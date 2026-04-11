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

const SidebarItem = ({ item, collapsed, active, onNavigate, isSubItem = false }) => {
    const navigate = useNavigate();

    const handleClick = (e) => {
        if (item.subItems) return;
        if (onNavigate) onNavigate();
        navigate(item.to);
    };

    return (
        <div
            className={`sidebar-item d-flex align-items-center ${collapsed ? 'justify-content-center px-0' : 'gap-3 px-3'} py-2 rounded-2 transition-all mb-1 cursor-pointer ${active ? 'active-item' : 'text-muted'
                } ${isSubItem ? 'ps-4 opacity-75' : ''}`}
            onClick={handleClick}
        >
            <div className="d-flex align-items-center justify-content-center item-icon" style={{ width: collapsed ? '100%' : '18px' }}>
                {item.icon && <item.icon size={collapsed ? 18 : 16} strokeWidth={active ? 2.5 : 2} />}
            </div>
            {!collapsed && (
                <span className="item-label fw-medium flex-grow-1" style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                    {item.label}
                </span>
            )}
            {!collapsed && item.subItems && (
                <ChevronRight size={12} className={`transition-all ${active ? 'rotate-90' : ''}`} />
            )}
        </div>
    );
};

const SidebarSection = ({ section, collapsed, activePath, hasPermission, onNavigate }) => {
    const filteredItems = section.items.filter(
        (item) => !item.permission || hasPermission(item.permission)
    );

    if (filteredItems.length === 0) return null;

    return (
        <div className={`sidebar-section mb-3 ${collapsed ? 'px-2' : 'px-3'}`}>
            {section.label && !collapsed && (
                <div className="px-2 mb-2">
                    <span className="section-label text-muted text-uppercase tracking-widest fw-bold" style={{ fontSize: '9px', opacity: 0.6 }}>
                        {section.label}
                    </span>
                </div>
            )}
            {filteredItems.map((item, idx) => (
                <SidebarItem
                    key={idx}
                    item={item}
                    collapsed={collapsed}
                    active={activePath === item.to || (item.to !== '/' && activePath.startsWith(item.to))}
                    onNavigate={onNavigate}
                />
            ))}
        </div>
    );
};

const Sidebar = () => {
    const { user, logout, hasPermission } = useAuth();
    const { isMobile, isOpen, toggleMobile } = useSidebar();
    const location = useLocation();
    const [isHovered, setIsHovered] = useState(false);
    
    // Snappy expansion logic
    const isExpanded = isHovered || (isMobile && isOpen);

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

    return (
        <div className="sidebar-wrapper" style={{ position: 'relative', width: isMobile ? 0 : '70px', zIndex: 1000 }}>
            <motion.div
                className="sidebar-container bg-white border-end d-flex flex-column"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                animate={{
                    width: isExpanded ? '260px' : '70px',
                    x: isMobile && !isOpen ? '-100%' : 0,
                    boxShadow: isHovered ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' : 'none'
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                style={{
                    height: '100vh',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    overflowX: 'hidden',
                    backgroundColor: 'white'
                }}
            >
                {/* Minimalist Logo Area */}
                <div className="sidebar-header d-flex align-items-center" style={{ height: '60px', borderBottom: '1px solid #f1f5f9', width: '100%', padding: '0 20px' }}>
                    <div className={`d-flex align-items-center ${isExpanded ? 'gap-3' : 'justify-content-center w-100'}`}>
                        <div className="flex-shrink-0 bg-zinc-900 d-flex align-items-center justify-content-center shadow-sm" style={{ width: '28px', height: '28px', borderRadius: '6px' }}>
                            <Activity size={14} className="text-white" />
                        </div>
                        {isExpanded && (
                            <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="fw-bold text-zinc-900 tracking-tight"
                                style={{ fontSize: '0.95rem' }}
                            >
                                GMS Report
                            </motion.span>
                        )}
                    </div>
                </div>

                {/* Nav Items */}
                <div className="sidebar-content flex-grow-1 overflow-auto py-3 custom-scrollbar">
                    {sections.map((section, idx) => (
                        <SidebarSection
                            key={idx}
                            section={section}
                            collapsed={!isExpanded}
                            activePath={location.pathname}
                            hasPermission={hasPermission}
                            onNavigate={isMobile ? toggleMobile : undefined}
                        />
                    ))}
                </div>

                {/* Refined Profile Section */}
                <div className="sidebar-footer p-3 border-top mt-auto">
                    <div className={`d-flex align-items-center ${isExpanded ? 'gap-3' : 'justify-content-center'}`}>
                        <div
                            className="avatar flex-shrink-0 bg-zinc-100 text-zinc-900 fw-bold d-flex align-items-center justify-content-center border border-zinc-200"
                            style={{ width: '30px', height: '30px', borderRadius: '6px', fontSize: '10px' }}
                        >
                            {initials}
                        </div>
                        {isExpanded && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="overflow-hidden flex-grow-1"
                            >
                                <div className="fw-semibold text-zinc-900 smallest text-truncate" style={{ fontSize: '11.5px', lineHeight: 1.2 }}>{user?.fullName || 'Account'}</div>
                                <div className="text-muted text-truncate" style={{ fontSize: '9px', fontWeight: 500 }}>{user?.role?.title || user?.role?.name || 'Authorized User'}</div>
                            </motion.div>
                        )}
                        {isExpanded && (
                            <button className="btn btn-sm btn-ghost p-1 text-zinc-400 hover-red" onClick={logout} title="Logout">
                                <LogOut size={13} />
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Sidebar;
