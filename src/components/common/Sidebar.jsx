import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu, Badge, ConfigProvider } from 'antd';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { useNavigationItems } from '../../hooks/useNavigationItems';
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
    const { user, logout } = useAuth();
    const { collapsed, toggle, isMobile, isOpen, toggleMobile, setCollapsed } = useSidebar();
    const navigate = useNavigate();
    const location = useLocation();
    
    // Local hover state for auto expand/collapsed logic
    const [isHovered, setIsHovered] = useState(false);
    
    // The actual visual collapsed state of the Sidebar component
    const visuallyCollapsed = collapsed && !isHovered;

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

    // Use our permission-aware navigation hook
    const navItems = useNavigationItems();

    const sections = [
        {
            id: 'OVERVIEW',
            label: 'Overview',
            items: navItems.overview || [],
        },
        {
            id: 'CATALOG',
            label: 'Catalog & Ads',
            items: navItems.catalog || [],
        },
        {
            id: 'AUTOMATION',
            label: 'Automation & Tasks',
            items: navItems.automation || [],
        },
        {
            id: 'INTELLIGENCE',
            label: 'Analytics & Finance',
            items: navItems.intelligence || [],
        },
        {
            id: 'SYSTEM',
            label: 'System & Control',
            items: navItems.system || [],
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
        const filteredItems = section.items;

        if (filteredItems.length === 0) return null;

        return {
            key: section.id,
            type: 'group',
            label: visuallyCollapsed ? null : section.label,
            children: filteredItems.map((item) => ({
                key: item.path,
                icon: React.createElement(item.icon, { size: 16 }),
                label: (
                    <div className="d-flex align-items-center justify-content-between w-100">
                        <span className="menu-label-text">{item.label}</span>
                        {item.badge !== undefined && !visuallyCollapsed && (
                            <Badge 
                                count={item.badge} 
                                showZero
                                overflowCount={9999}
                                style={{ 
                                    backgroundColor: item.badgeColor || '#6366f1', 
                                    color: '#ffffff', 
                                    boxShadow: 'none',
                                    fontSize: '10px',
                                    fontWeight: 650,
                                    padding: '0 6px',
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
        location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
    );
    const selectedKeys = activeItem ? [activeItem.path] : [];

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
                            itemSelectedColor: '#171717',
                            itemSelectedBg: '#f4f4f5',
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
