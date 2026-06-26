// components/Header.jsx

import React, {
    useState, useEffect, useRef,
    useCallback, useMemo, memo
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Bell, Search, Menu, Download,
    MessageSquare, Info, Check,
    BellRing, ShieldAlert
} from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useSocket } from '../contexts/SocketContext';
import DateRangePicker from './common/DateRangePicker';
import DownloadsDrawer from './common/DownloadsDrawer';
import api from '../services/api';
import {
    Badge, Popover, List, Avatar,
    Button, Typography, Empty, Spin, App
} from 'antd';
import './Header.css';

const { Text } = Typography;

// ─── Pure helpers — outside component, never recreated ────────────────────────

function normalizeNotification(n) {
    if (!n) return {};
    return {
        id: n.Id || n._id || n.id,
        type: (n.Type || n.type || 'INFO').toUpperCase(),
        message: n.Message || n.message || 'Internal notification',
        isRead: n.IsRead === 1 || n.IsRead === true || n.isRead === 1 || n.isRead === true,
        createdAt: n.CreatedAt || n.createdAt,
        referenceId: n.ReferenceId || n.referenceId,
    };
}

function getInitials(user) {
    if (!user) return '??';
    if (user.fullName?.trim()) {
        return user.fullName
            .trim()
            .split(/\s+/)
            .map(n => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
    }
    const first = user.firstName?.[0] || '';
    const second = user.lastName?.[0] || user.firstName?.[1] || '';
    return (first + second).toUpperCase() || (user.email?.[0] || 'U').toUpperCase();
}

function formatTimestamp(dateString) {
    if (!dateString) return '--';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '--';
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'Now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const TYPE_CONFIG = {
    ALERT: { icon: BellRing, color: '#D32F2F' },
    ACTION_ASSIGNED: { icon: Check, color: '#2E7D32' },
    CHAT_MENTION: { icon: MessageSquare, color: '#9C27B0' },
    CHAT_MESSAGE: { icon: MessageSquare, color: '#9C27B0' },
    SYSTEM: { icon: ShieldAlert, color: '#ED6C02' },
    DEFAULT: { icon: Info, color: '#0288D1' },
};

function getTypeConfig(type) {
    return TYPE_CONFIG[type] ?? TYPE_CONFIG.DEFAULT;
}

// ─── Notification item ────────────────────────────────────────────────────────

const NotificationItem = memo(({ raw, onRead, onClick }) => {
    const item = normalizeNotification(raw);
    const cfg = getTypeConfig(item.type);
    const Icon = cfg.icon;
    const time = useMemo(() => formatTimestamp(item.createdAt), [item.createdAt]);

    return (
        <div
            onClick={() => onClick(raw)}
            className="notification-feed-item"
            style={{
                cursor: 'pointer',
                padding: '10px 12px',
                borderRadius: 6,
                transition: 'background 0.15s',
                backgroundColor: item.isRead ? 'transparent' : '#f8fafc',
                border: `1px solid ${item.isRead ? 'transparent' : '#eff6ff'}`,
                marginBottom: 4,
                display: 'flex',
                gap: 12,
                position: 'relative',
            }}
        >
            <Avatar
                size={30}
                style={{
                    backgroundColor: `${cfg.color}15`,
                    color: cfg.color,
                    flexShrink: 0,
                    marginTop: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                icon={<Icon size={14} />}
            />

            <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Text
                        style={{
                            fontSize: 10.5,
                            textTransform: 'uppercase',
                            color: item.isRead ? '#64748b' : cfg.color,
                            fontWeight: item.isRead ? 600 : 800,
                            letterSpacing: '0.03em',
                        }}
                    >
                        {item.type}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>{time}</Text>
                </div>
                <div style={{
                    fontSize: 12,
                    color: item.isRead ? '#64748b' : '#0f172a',
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                    fontWeight: item.isRead ? 450 : 550,
                }}>
                    {item.message}
                </div>
            </div>

            {!item.isRead && (
                <div style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    backgroundColor: '#0288D1',
                    position: 'absolute',
                    right: 10,
                    top: 14,
                }} />
            )}
        </div>
    );
});

// ─── Notification panel ───────────────────────────────────────────────────────

const NotificationPanel = memo(({
    notifications, unreadCount, loading,
    onMarkAllRead, onItemClick, onViewAll,
}) => (
    <div style={{ width: 340, margin: '-4px -12px' }}>
        {/* Header */}
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid #f1f5f9',
        }}>
            <Text strong style={{ fontSize: 14, color: '#0f172a', letterSpacing: '-0.01em' }}>
                System Broadcasts
            </Text>
            {unreadCount > 0 && (
                <Button
                    type="link" size="small"
                    onClick={onMarkAllRead}
                    style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600, color: '#0288D1' }}
                >
                    Clear All
                </Button>
            )}
        </div>

        {/* List */}
        <Spin spinning={loading}>
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px' }}>
                {notifications.length > 0 ? (
                    <List
                        itemLayout="horizontal"
                        dataSource={notifications}
                        renderItem={(raw, idx) => (
                            <NotificationItem
                                key={normalizeNotification(raw).id || idx}
                                raw={raw}
                                onClick={onItemClick}
                            />
                        )}
                    />
                ) : (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                                No signals.
                            </span>
                        }
                        style={{ margin: '24px 0' }}
                    />
                )}
            </div>
        </Spin>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px', textAlign: 'center' }}>
            <Button
                type="link" block size="small"
                onClick={onViewAll}
                style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}
            >
                Open Full Alert Console
            </Button>
        </div>
    </div>
));

// ─── Main Header ──────────────────────────────────────────────────────────────

const Header = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toggleMobile } = useSidebar();
    const { pageTitle } = usePageTitle();
    const { startDate, endDate, updateDateRange } = useDateRange();
    const socket = useSocket();

    // ✅ Fix 4: use App.useApp() — antd v6 compatible
    const { message: msgApi } = App.useApp();

    const [searchQuery, setSearchQuery] = useState('');
    const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);

    const searchInputRef = useRef(null);

    // ✅ Fix 7+8: abort controller + stable fetch function
    const fetchNotifications = useCallback(async (showSpinner = false) => {
        const controller = new AbortController();
        try {
            if (showSpinner) setLoading(true);
            const response = await api.notificationApi.getNotifications(
                { limit: 5 },
                { signal: controller.signal }
            );
            if (response?.success) {
                setNotifications(response.data || []);
                setUnreadCount(response.unreadCount || 0);
            }
        } catch (error) {
            if (error?.name === 'AbortError') return;
            if (!error?.message?.includes('404')) {
                console.warn('[Header] Failed to fetch notifications:', error);
            }
        } finally {
            if (showSpinner) setLoading(false);
        }
        return () => controller.abort();
    }, []);

    // Initial fetch + 45s polling
    useEffect(() => {
        void fetchNotifications(true);
        const interval = setInterval(() => void fetchNotifications(false), 45_000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // ✅ Fix 5: socket listener via ref — never re-registers
    const fetchRef = useRef(fetchNotifications);
    useEffect(() => { fetchRef.current = fetchNotifications; });

    useEffect(() => {
        if (!socket) return;

        const handler = ({ notification, unreadCount: updatedUnread }) => {
            if (!notification) return;
            const norm = normalizeNotification(notification);

            setNotifications(prev => {
                const filtered = prev.filter(n => normalizeNotification(n).id !== norm.id);
                return [notification, ...filtered].slice(0, 5);
            });
            setUnreadCount(updatedUnread ?? 0);

            msgApi.info({
                content: `${norm.message.substring(0, 50)}${norm.message.length > 50 ? '…' : ''}`,
                duration: 3,
                style: { marginTop: '8vh' }
            });
        };

        socket.on('new-notification', handler);
        return () => socket.off('new-notification', handler);
    }, [socket, msgApi]);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        const onExport = () => setIsDownloadsOpen(true);

        window.addEventListener('keydown', onKey);
        window.addEventListener('export-started', onExport);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('export-started', onExport);
        };
    }, []);

    // ✅ Fix 6: all handlers wrapped in useCallback
    const handleMarkAsRead = useCallback(async (id) => {
        try {
            const response = await api.notificationApi.markAsRead(id);
            if (response?.success) {
                setNotifications(prev => prev.map(n => {
                    if (normalizeNotification(n).id !== id) return n;
                    return 'IsRead' in n
                        ? { ...n, IsRead: 1 }
                        : { ...n, isRead: true };
                }));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('[Header] Failed to mark notification read:', error);
        }
    }, []);

    const handleMarkAllRead = useCallback(async () => {
        try {
            const response = await api.notificationApi.markAllAsRead();
            if (response?.success) {
                setNotifications(prev => prev.map(n =>
                    'IsRead' in n ? { ...n, IsRead: 1 } : { ...n, isRead: true }
                ));
                setUnreadCount(0);
                msgApi.success('All notifications cleared.');
            }
        } catch (error) {
            console.error('[Header] Failed to clear notifications:', error);
        }
    }, [msgApi]);

    const handleNotificationClick = useCallback((raw) => {
        const item = normalizeNotification(raw);
        if (!item.isRead) void handleMarkAsRead(item.id);
        setPopoverOpen(false);

        if (item.type === 'ALERT' || item.type === 'SYSTEM') {
            navigate('/alerts');
        } else if (item.type === 'ACTION_ASSIGNED' || item.type === 'CHAT_MENTION') {
            navigate(item.referenceId ? `/actions?id=${item.referenceId}` : '/actions');
        } else if (item.type === 'CHAT_MESSAGE') {
            navigate(item.referenceId ? `/chat?userId=${item.referenceId}` : '/chat');
        }
    }, [handleMarkAsRead, navigate]);

    const handleViewAll = useCallback(() => {
        setPopoverOpen(false);
        navigate('/alerts');
    }, [navigate]);

    // ✅ Fix 3: panel is memoized — not rebuilt on every render
    const notificationPanel = useMemo(() => (
        <NotificationPanel
            notifications={notifications}
            unreadCount={unreadCount}
            loading={loading}
            onMarkAllRead={handleMarkAllRead}
            onItemClick={handleNotificationClick}
            onViewAll={handleViewAll}
        />
    ), [notifications, unreadCount, loading, handleMarkAllRead, handleNotificationClick, handleViewAll]);

    const initials = useMemo(() => getInitials(user), [user]);

    return (
        <header className="topbar-redesign">

            {/* Left: Breadcrumb + mobile menu */}
            <div className="topbar-left">
                <button className="mobile-hamburger" onClick={toggleMobile} title="Open Menu">
                    <Menu size={20} />
                </button>
                <span className="breadcrumb-workspace d-none d-sm-inline">Workspace</span>
                <span className="breadcrumb-separator d-none d-sm-inline">›</span>
                <span className="breadcrumb-page">{pageTitle || 'Dashboard'}</span>
            </div>

            {/* Center: Search */}
            <div className="topbar-center">
                <div className="search-bar-wrapper">
                    <Search size={14} className="search-icon" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="search-input"
                        placeholder="Search workspace..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        aria-label="Search workspace"
                    />
                    <div className="command-badge">⌘K</div>
                </div>
            </div>

            {/* Right: Actions + User */}
            <div className="topbar-right">
                <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onDateChange={(type, s, e) =>
                        updateDateRange({ startDate: s, endDate: e, rangeType: type })
                    }
                />

                <div className="notification-wrapper d-flex align-items-center gap-2">
                    <button
                        className="icon-button"
                        onClick={() => setIsDownloadsOpen(true)}
                        title="Downloads"
                        aria-label="Open downloads"
                    >
                        <Download size={16} />
                    </button>

                    <Popover
                        content={notificationPanel}
                        trigger="click"
                        placement="bottomRight"
                        open={popoverOpen}
                        onOpenChange={setPopoverOpen}
                        overlayClassName="global-notification-popover"
                        styles={{
                            content: {
                                borderRadius: 12,
                                padding: '8px',
                                boxShadow: '0 10px 32px -4px rgba(0,0,0,0.1)',
                            }
                        }}
                    >
                        <button
                            className="icon-button"
                            style={{ position: 'relative' }}
                            aria-label={`${unreadCount} unread notifications`}
                        >
                            <Badge
                                count={unreadCount}
                                overflowCount={9}
                                size="small"
                                offset={[-2, 2]}
                                style={{
                                    boxShadow: '0 0 0 2px #fff',
                                    fontSize: '10px',
                                    height: 15,
                                    minWidth: 15,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#D32F2F',
                                }}
                            >
                                <Bell size={16} />
                            </Badge>
                        </button>
                    </Popover>
                </div>

                {/* User profile */}
                <div
                    className="header-user-profile"
                    onClick={() => navigate('/profile')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && navigate('/profile')}
                    aria-label="Go to profile"
                >
                    <div className="header-user-details text-end me-3 d-none d-md-block">
                        <div className="header-user-name fw-semibold" style={{ fontSize: 13, color: '#1f2937' }}>
                            {user?.fullName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
                        </div>
                        <div className="header-user-role" style={{ fontSize: 11, color: '#6b7280', textTransform: 'capitalize' }}>
                            {user?.role?.displayName || user?.role?.name || 'User'}
                        </div>
                    </div>
                    <div className="user-avatar-top" aria-hidden="true">
                        {initials}
                        <div className="user-status-indicator" />
                    </div>
                </div>
            </div>

            <DownloadsDrawer isOpen={isDownloadsOpen} onClose={() => setIsDownloadsOpen(false)} />

            {/* ✅ Fix 12: single static style block — not re-injected per panel render */}
            <style>{`
                .notification-feed-item:hover {
                    background-color: #f1f5f9 !important;
                }
                .global-notification-popover .ant-popover-inner {
                    padding: 4px !important;
                }
            `}</style>
        </header>
    );
};

export default memo(Header);