import React from 'react';
import { Sidebar, Menu, MenuItem, SubMenu, sidebarClasses } from 'react-pro-sidebar';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import {
  LayoutDashboard, Store, ScanLine, CloudDownload, Kanban,
  BarChart3, BookOpen, MessageSquare, Calculator,
  FileText, TrendingUp, Users, ShieldCheck, Settings,
  ArrowLeftRight, Bell, Zap, Activity, UserCircle,
  LogOut, ChevronsLeft, ChevronsRight, KeyRound, FolderOpen, LayoutTemplate
} from 'lucide-react';

const PRIMARY = '#4F46E5';
const PRIMARY_BG = '#EEF2FF';
const NAV_TXT = '#475569';
const HOVER_BG = '#F1F5F9';

const SideBar = () => {
  const { user, logout, hasPermission } = useAuth();
  const { collapsed, toggle } = useSidebar();
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const initials = (
    (user?.firstName?.[0] || '') + (user?.lastName?.[0] || user?.firstName?.[1] || '')
  ).toUpperCase();

  const menuItemStyles = {
    root: { fontSize: '0.875rem', fontWeight: 500 },
    button: ({ active }) => ({
      color: active ? PRIMARY : NAV_TXT,
      backgroundColor: active ? PRIMARY_BG : 'transparent',
      fontWeight: active ? 600 : 500,
      borderRadius: '8px',
      margin: '1px 8px',
      padding: '0 8px',
      '&:hover': {
        backgroundColor: active ? PRIMARY_BG : HOVER_BG,
        color: active ? PRIMARY : '#1E293B',
      },
    }),
    icon: ({ active }) => ({
      color: active ? PRIMARY : '#64748B',
      minWidth: '32px',
    }),
    label: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    subMenuContent: { backgroundColor: '#F8FAFC' },
  };

  const item = (path, icon, label, permission) => {
    if (permission && !hasPermission(permission)) return null;
    return (
      <MenuItem
        key={path}
        active={isActive(path)}
        icon={icon}
        component={<Link to={path} />}
      >
        {label}
      </MenuItem>
    );
  };

  const sectionLabel = (txt) =>
    !collapsed && (
      <div style={{
        padding: '14px 20px 4px',
        fontSize: '10px',
        fontWeight: 700,
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
      }}>
        {txt}
      </div>
    );

  return (
    <Sidebar
      collapsed={collapsed}
      width="260px"
      collapsedWidth="72px"
      transitionDuration={250}
      rootStyles={{
        [`.${sidebarClasses.container}`]: {
          background: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          overflowY: 'auto',
          overflowX: 'hidden',
        },
      }}
    >
      {/* ── Logo ────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '0.65rem',
        padding: '0 1rem',
        borderBottom: '1px solid #E2E8F0',
        flexShrink: 0,
        height: 72,
        boxSizing: 'border-box',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `linear-gradient(135deg, ${PRIMARY} 0%, #6366F1 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <i className="bi bi-bar-chart-fill" style={{ color: '#fff', fontSize: '1.1rem' }} />
        </div>
        {!collapsed && (
          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', letterSpacing: '-0.03em' }}>
            Retail<span style={{ color: PRIMARY }}>Ops</span>
          </span>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0' }}>
        <Menu menuItemStyles={menuItemStyles}>
          {sectionLabel('Main')}
          {item('/dashboard', <LayoutDashboard size={18} />, 'Dashboard', 'dashboard_view')}
          {item('/sellers', <Store size={18} />, 'Sellers', 'sellers_view')}
          {item('/asin-tracker', <ScanLine size={18} />, 'ASIN Manager', 'sellers_view')}
          {item('/seller-tracker', <Zap size={18} />, 'Seller Tracker', 'sellers_view')}
          {item('/scrape-tasks', <CloudDownload size={18} />, 'Scrape Tasks', 'scraping_view')}

          {sectionLabel('Actions')}
          {item('/actions', <Kanban size={18} />, 'Actions', 'actions_view')}
          {item('/actions/templates', <LayoutTemplate size={18} />, 'Templates', 'actions_view')}
          {item('/actions/achievement-report', <BarChart3 size={18} />, 'Performance Report', 'reports_monthly_view')}
          {item('/activity-log', <BookOpen size={18} />, 'Activity Log', 'settings_view')}
          {item('/file-manager', <FolderOpen size={18} />, 'File Manager')}
          {item('/chat', <MessageSquare size={18} />, 'Direct Chat')}

          {sectionLabel('Reports')}
          <SubMenu label="Analytics" icon={<BarChart3 size={18} />}>
            {item('/sku-report', <FileText size={16} />, 'SKU Report', 'reports_sku_view')}
            {item('/parent-asin-report', <TrendingUp size={16} />, 'Parent ASIN', 'reports_parent_view')}
            {item('/month-wise-report', <BarChart3 size={16} />, 'Monthly Report', 'reports_monthly_view')}
            {item('/ads-report', <Activity size={16} />, 'Ads Report', 'reports_ads_view')}
            {item('/profit-loss', <TrendingUp size={16} />, 'Profit & Loss', 'reports_profit_view')}
            {item('/inventory', <Store size={16} />, 'Inventory', 'reports_inventory_view')}
          </SubMenu>
          {item('/revenue-calculator', <Calculator size={18} />, 'Revenue Calculator', 'calculator_view')}
          {item('/alerts', <Bell size={18} />, 'Alerts', 'dashboard_view')}

          {sectionLabel('Admin')}
          {item('/users', <Users size={18} />, 'Users', 'users_view')}
          {item('/roles', <ShieldCheck size={18} />, 'Roles', 'roles_view')}
          {item('/team-management', <Users size={18} />, 'Team management', 'roles_view')}
          {item('/settings', <Settings size={18} />, 'Settings', 'settings_view')}
          {item('/api-keys', <KeyRound size={18} />, 'API Keys', 'settings_view')}
          {item('/upload-export', <ArrowLeftRight size={18} />, 'Upload / Export', 'sellers_manage_asins')}
        </Menu>
      </div>

      {/* ── Plan card (expanded only) ──────────────── */}
      {!collapsed && (
        <div style={{
          margin: '0 10px 8px',
          background: '#F8FAFC',
          borderRadius: 10,
          border: '1px solid #E2E8F0',
          padding: '10px 14px',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Plan</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', margin: '3px 0 3px' }}>Professional Plan</p>
          <Link to="/settings" style={{ fontSize: 11, color: PRIMARY, fontWeight: 700, textDecoration: 'none' }}>
            Manage Settings →
          </Link>
        </div>
      )}

      {/* ── User + Collapse button ─────────────────── */}
      <div style={{
        borderTop: '1px solid #E2E8F0',
        flexShrink: 0,
        padding: collapsed ? '8px' : '8px 10px',
      }}>
        {!collapsed ? (
          <>
            <Link to="/profile" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              borderRadius: 10,
              background: '#F8FAFC',
              textDecoration: 'none',
              marginBottom: 6,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: `linear-gradient(135deg, ${PRIMARY}, #818CF8)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 13,
              }}>
                {initials || <UserCircle size={18} />}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.fullName || user?.firstName || 'User'}
                </div>
                <div style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user?.email || ''}
                </div>
              </div>
            </Link>

            {/* Row: logout + collapse */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={logout} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '9px 12px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff', border: 'none', borderRadius: 8,
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>
                <LogOut size={14} /> Logout
              </button>
              <button onClick={toggle} title="Collapse sidebar" style={{
                padding: '9px 11px',
                background: '#F1F5F9',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                cursor: 'pointer',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 150ms',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = PRIMARY_BG; e.currentTarget.style.color = PRIMARY; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569'; }}
              >
                <ChevronsLeft size={16} />
              </button>
            </div>
          </>
        ) : (
          /* Collapsed: avatar + logout + expand button */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <Link to="/profile" title="Profile" style={{
              width: 36, height: 36, borderRadius: 9,
              background: `linear-gradient(135deg, ${PRIMARY}, #818CF8)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none',
            }}>
              {initials || <UserCircle size={18} />}
            </Link>
            <button onClick={logout} title="Logout" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#EF4444', padding: 6, borderRadius: 8,
            }}>
              <LogOut size={18} />
            </button>
            {/* Expand button */}
            <button onClick={toggle} title="Expand sidebar" style={{
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              cursor: 'pointer',
              color: '#475569',
              padding: '7px',
              display: 'flex',
              alignItems: 'center',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = PRIMARY_BG; e.currentTarget.style.color = PRIMARY; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#475569'; }}
            >
              <ChevronsRight size={16} />
            </button>
          </div>
        )}
      </div>
    </Sidebar>
  );
};

export default SideBar;
