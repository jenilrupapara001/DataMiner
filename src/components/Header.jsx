import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Bell,
    Search,
    ChevronDown,
    Menu,
    Download,
    MessageSquare,
    Info,
    Check,
    BellRing,
    ShieldAlert
} from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useSocket } from '../contexts/SocketContext';
import DateRangePicker from './common/DateRangePicker';
import DownloadsDrawer from './common/DownloadsDrawer';
import api from '../services/api';
import { 
    Badge, 
    Popover, 
    List, 
    Avatar, 
    Button, 
    Typography, 
    Empty, 
    Spin, 
    Space, 
    message 
} from 'antd';
import './Header.css';

const Header = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { toggleMobile } = useSidebar();
    const { pageTitle } = usePageTitle();
    const { startDate, endDate, updateDateRange } = useDateRange();
    const socket = useSocket();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [isDownloadsOpen, setIsDownloadsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    
    const searchInputRef = useRef(null);

    // SQL vs Mongo Casing Normalizer Routine
    const normalize = (n) => {
        if (!n) return {};
        return {
            id: n.Id || n._id || n.id,
            type: (n.Type || n.type || 'INFO').toUpperCase(),
            message: n.Message || n.message || 'Internal notification',
            isRead: n.IsRead === 1 || n.IsRead === true || n.isRead === 1 || n.isRead === true,
            createdAt: n.CreatedAt || n.createdAt,
            referenceId: n.ReferenceId || n.referenceId
        };
    };

    const getInitials = (user) => {
        if (!user) return '??';
        if (user.fullName) return user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        const fallback = (user.firstName?.[0] || '') + (user.lastName?.[0] || user.firstName?.[1] || '');
        return fallback.toUpperCase() || (user.email?.[0] || 'U').toUpperCase();
    };

    const fetchNotifications = async (showSpinner = false) => {
        try {
            if (showSpinner) setLoading(true);
            const response = await api.notificationApi.getNotifications({ limit: 5 });
            if (response && response.success) {
                setNotifications(response.data || []);
                setUnreadCount(response.unreadCount || 0);
            }
        } catch (error) {
            if (error.message && !error.message.includes('404')) {
                console.warn('Header: Failed to fetch notification feed:', error);
            }
        } finally {
            if (showSpinner) setLoading(false);
        }
    };

    // Real-time Socket sync & Polling
    useEffect(() => {
        fetchNotifications(true);
        const interval = setInterval(() => fetchNotifications(false), 45000); // 45s
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = ({ notification, unreadCount: updatedUnread }) => {
            if (!notification) return;
            const norm = normalize(notification);
            setNotifications(prev => {
                const filtered = prev.filter(n => normalize(n).id !== norm.id);
                return [notification, ...filtered].slice(0, 5);
            });
            setUnreadCount(updatedUnread);
            
            message.info({
                content: `Security Dispatch: ${norm.message.substring(0, 40)}${norm.message.length > 40 ? '...' : ''}`,
                duration: 3,
                style: { marginTop: '8vh' }
            });
        };

        socket.on('new-notification', handleNewNotification);
        return () => socket.off('new-notification', handleNewNotification);
    }, [socket]);

    // Keyboard listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        const handleExportStart = () => {
            setIsDownloadsOpen(true);
        };
        
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('export-started', handleExportStart);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('export-started', handleExportStart);
        };
    }, []);

    const handleMarkAsRead = async (id, e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        try {
            const response = await api.notificationApi.markAsRead(id);
            if (response && response.success) {
                setNotifications(prev => prev.map(n => {
                    if (normalize(n).id === id) {
                        if ('IsRead' in n) return { ...n, IsRead: 1 };
                        return { ...n, isRead: true, IsRead: 1 };
                    }
                    return n;
                }));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Failed to write read vector:', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            const response = await api.notificationApi.markAllAsRead();
            if (response && response.success) {
                setNotifications(prev => prev.map(n => {
                    if ('IsRead' in n) return { ...n, IsRead: 1 };
                    return { ...n, isRead: true, IsRead: 1 };
                }));
                setUnreadCount(0);
                message.success('Notification buffer cleared.');
            }
        } catch (error) {
            console.error('Failed to clear list:', error);
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'ALERT': return <BellRing size={14} />;
            case 'ACTION_ASSIGNED': return <Check size={14} />;
            case 'CHAT_MENTION':
            case 'CHAT_MESSAGE': return <MessageSquare size={14} />;
            case 'SYSTEM': return <ShieldAlert size={14} />;
            default: return <Info size={14} />;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'ALERT': return '#ef4444'; 
            case 'ACTION_ASSIGNED': return '#10b981';
            case 'CHAT_MENTION':
            case 'CHAT_MESSAGE': return '#8b5cf6'; 
            case 'SYSTEM': return '#f59e0b'; 
            default: return '#3b82f6'; 
        }
    };

    const handleNotificationClick = (rawItem) => {
        const item = normalize(rawItem);
        if (!item.isRead) {
            handleMarkAsRead(item.id);
        }
        setPopoverOpen(false);

        // Matrix Navigation Engine
        if (item.type === 'ALERT' || item.type === 'SYSTEM') {
            navigate('/alerts');
        } else if (item.type === 'ACTION_ASSIGNED' || item.type === 'CHAT_MENTION') {
            if (item.referenceId) {
                navigate(`/actions?id=${item.referenceId}`);
            } else {
                navigate('/actions');
            }
        } else if (item.type === 'CHAT_MESSAGE') {
            if (item.referenceId) {
                navigate(`/chat?userId=${item.referenceId}`);
            } else {
                navigate('/chat');
            }
        }
    };

    const formatPopTimestamp = (dateString) => {
        if (!dateString) return '--';
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? '--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const notificationPanel = (
        <div style={{ width: 340, margin: '-4px -12px' }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 16px', 
                borderBottom: '1px solid #f1f5f9' 
            }}>
                <Typography.Text strong style={{ fontSize: 14, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    System Broadcasts
                </Typography.Text>
                {unreadCount > 0 && (
                    <Button 
                        type="link" 
                        size="small" 
                        onClick={handleMarkAllRead} 
                        style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600, color: '#2563eb' }}
                    >
                        Clear All
                    </Button>
                )}
            </div>

            <Spin spinning={loading}>
                <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px' }}>
                    {notifications.length > 0 ? (
                        <List
                            itemLayout="horizontal"
                            dataSource={notifications}
                            renderItem={(raw) => {
                                const item = normalize(raw);
                                return (
                                    <div 
                                        onClick={() => handleNotificationClick(raw)}
                                        style={{
                                            cursor: 'pointer',
                                            padding: '10px 12px',
                                            borderRadius: 6,
                                            transition: 'all 0.15s ease',
                                            backgroundColor: item.isRead ? 'transparent' : '#f8fafc',
                                            border: `1px solid ${item.isRead ? 'transparent' : '#eff6ff'}`,
                                            marginBottom: 4,
                                            display: 'flex',
                                            gap: 12,
                                            position: 'relative'
                                        }}
                                        className="notification-feed-item"
                                    >
                                        <Avatar 
                                            size={30}
                                            style={{ 
                                                backgroundColor: `${getTypeColor(item.type)}12`, 
                                                color: getTypeColor(item.type),
                                                flexShrink: 0,
                                                marginTop: 2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            icon={getTypeIcon(item.type)}
                                        />
                                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                <Typography.Text 
                                                    strong={!item.isRead} 
                                                    style={{ 
                                                        fontSize: 10.5, 
                                                        textTransform: 'uppercase', 
                                                        color: item.isRead ? '#64748b' : getTypeColor(item.type),
                                                        fontWeight: item.isRead ? 600 : 800,
                                                        letterSpacing: '0.03em'
                                                    }}
                                                >
                                                    {item.type}
                                                </Typography.Text>
                                                <Typography.Text type="secondary" style={{ fontSize: 10 }}>
                                                    {formatPopTimestamp(item.createdAt)}
                                                </Typography.Text>
                                            </div>
                                            <div style={{ 
                                                fontSize: 12, 
                                                color: item.isRead ? '#64748b' : '#0f172a', 
                                                lineHeight: 1.4,
                                                wordBreak: 'break-word',
                                                fontWeight: item.isRead ? 450 : 550
                                            }}>
                                                {item.message}
                                            </div>
                                        </div>
                                        {!item.isRead && (
                                            <div style={{
                                                width: 5,
                                                height: 5,
                                                borderRadius: '50%',
                                                backgroundColor: '#2563eb',
                                                position: 'absolute',
                                                right: 10,
                                                top: 14
                                            }} />
                                        )}
                                    </div>
                                );
                            }}
                        />
                    ) : (
                        <Empty 
                            image={Empty.PRESENTED_IMAGE_SIMPLE} 
                            description={<span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>Telemetry idle. No signals.</span>}
                            style={{ margin: '24px 0' }}
                        />
                    )}
                </div>
            </Spin>

            <div style={{ 
                borderTop: '1px solid #f1f5f9', 
                padding: '8px', 
                textAlign: 'center' 
            }}>
                <Button 
                    type="link" 
                    block 
                    size="small"
                    onClick={() => {
                        setPopoverOpen(false);
                        navigate('/alerts');
                    }}
                    style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}
                >
                    Open Full Alert Console
                </Button>
            </div>

            <style>{`
                .notification-feed-item:hover {
                    background-color: #f1f5f9 !important;
                }
            `}</style>
        </div>
    );

    return (
        <header className="topbar-redesign">
            {/* Left: Breadcrumb & Mobile Toggle */}
            <div className="topbar-left">
                <button className="mobile-hamburger" onClick={toggleMobile} title="Open Menu">
                    <Menu size={20} />
                </button>
                <span className="breadcrumb-workspace d-none d-sm-inline">Workspace</span>
                <span className="breadcrumb-separator d-none d-sm-inline">›</span>
                <span className="breadcrumb-page">{pageTitle || 'Dashboard'}</span>
            </div>

            {/* Center: Search Bar */}
            <div className="topbar-center">
                <div className="search-bar-wrapper">
                    <Search size={14} className="search-icon" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="search-input"
                        placeholder="Search workspace..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="command-badge">⌘K</div>
                </div>
            </div>

            {/* Right Side */}
            <div className="topbar-right">
                <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onDateChange={(type, s, e) => updateDateRange({ startDate: s, endDate: e, rangeType: type })}
                />

                <div className="notification-wrapper d-flex align-items-center gap-2">
                    <button className="icon-button" onClick={() => setIsDownloadsOpen(true)} title="Downloads">
                        <Download size={16} />
                    </button>

                    <Popover
                        content={notificationPanel}
                        trigger="click"
                        placement="bottomRight"
                        open={popoverOpen}
                        onOpenChange={setPopoverOpen}
                        overlayClassName="global-notification-popover"
                        overlayInnerStyle={{ 
                            borderRadius: 12, 
                            padding: '8px',
                            boxShadow: '0 10px 32px -4px rgba(0,0,0,0.1)'
                        }}
                    >
                        <button className="icon-button" style={{ position: 'relative' }}>
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
                                    backgroundColor: '#ef4444'
                                }}
                            >
                                <Bell size={16} />
                            </Badge>
                        </button>
                    </Popover>
                </div>

                <div className="header-user-profile" onClick={() => navigate('/profile')}>
                    <div className="header-user-details text-end me-3 d-none d-md-block">
                        <div className="header-user-name fw-semibold" style={{ fontSize: '13px', color: '#1f2937' }}>
                            {user?.fullName || 'User'}
                        </div>
                        <div className="header-user-role" style={{ fontSize: '11px', color: '#6b7280', textTransform: 'capitalize' }}>
                            {user?.role?.displayName || user?.role?.name || 'User'}
                        </div>
                    </div>
                    <div className="user-avatar-top">
                        {getInitials(user)}
                        <div className="user-status-indicator" />
                    </div>
                </div>
            </div>
            
            <DownloadsDrawer isOpen={isDownloadsOpen} onClose={() => setIsDownloadsOpen(false)} />
        </header>
    );
};

export default Header;