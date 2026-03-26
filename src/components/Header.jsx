import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    Bell,
    Search,
    MessageSquare,
    Info,
    Check,
    TrendingUp,
    Menu,
    Package,
    Users
} from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useSidebar } from '../contexts/SidebarContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { DropdownButton } from './DropdownButton';
import { Dropdown } from './base/dropdown/dropdown';
import './Header.css';

const Header = () => {
    const { user, logout, hasPermission } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const notificationRef = useRef(null);
    const userMenuRef = useRef(null);
    const searchInputRef = useRef(null);
    const socket = useSocket();
    const { toggleMobile, isMobile } = useSidebar();
    const { pageTitle } = usePageTitle();
    
    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState(null);
    const [searchLoading, setSearchLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchContainerRef = useRef(null);

    const fetchNotifications = async () => {
        try {
            const response = await api.notificationApi.getNotifications({ limit: 5 });
            if (response && response.success) {
                setNotifications(response.data);
                setUnreadCount(response.unreadCount);
            }
        } catch (error) {
            if (error.message && !error.message.includes('404')) {
                console.warn('Failed to fetch notifications:', error);
            }
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!socket) return;
        socket.on('new-notification', ({ notification, unreadCount }) => {
            setNotifications(prev => [notification, ...prev].slice(0, 10));
            setUnreadCount(unreadCount);
        });
        return () => {
            socket.off('new-notification');
        };
    }, [socket]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setShowUserMenu(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Global keyboard shortcut (Cmd+K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (searchInputRef.current) {
                    searchInputRef.current.focus();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Global Search Logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length >= 2) {
                setSearchLoading(true);
                try {
                    const response = await api.get(`/search?q=${searchQuery}`);
                    setSearchResults(response.data);
                    setShowResults(true);
                } catch (error) {
                    console.error('Search failed:', error);
                } finally {
                    setSearchLoading(false);
                }
            } else {
                setSearchResults(null);
                setShowResults(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleOpenCommandPalette = () => {
        window.dispatchEvent(new CustomEvent('open-command-palette'));
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'ALERT': return <Bell size={14} />;
            case 'ACTION_ASSIGNED': return <Check size={14} />;
            case 'CHAT_MENTION':
            case 'CHAT_MESSAGE': return <MessageSquare size={14} />;
            default: return <Info size={14} />;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'ALERT': return '#ff3b30'; // iOS red
            case 'ACTION_ASSIGNED': return '#34c759'; // iOS green
            case 'CHAT_MENTION':
            case 'CHAT_MESSAGE': return '#5856d6'; // iOS purple
            default: return '#007aff'; // iOS blue
        }
    };

    const handleMarkAsRead = async (id, e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        try {
            const response = await api.notificationApi.markAsRead(id);
            if (response && response.success) {
                setNotifications(prev => prev.map(n =>
                    n._id === id ? { ...n, isRead: true } : n
                ));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Failed to mark as read', error);
        }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.isRead) {
            handleMarkAsRead(notification._id);
        }
        setShowNotifications(false);

        // Navigate based on type
        if (notification.type === 'ALERT' || notification.type === 'SYSTEM') {
            navigate('/alerts');
        } else if (notification.type === 'ACTION_ASSIGNED' || notification.type === 'CHAT_MENTION') {
            if (notification.referenceId) {
                navigate(`/actions?id=${notification.referenceId}`);
            } else {
                navigate('/actions');
            }
        } else if (notification.type === 'CHAT_MESSAGE') {
            if (notification.referenceId) {
                navigate(`/chat?userId=${notification.referenceId}`);
            } else {
                navigate('/chat');
            }
        }
    };

    return (
        <header className="main-header">
            <div className="header-container">
                {/* Mobile hamburger menu */}
                {isMobile && (
                    <button className="header-hamburger" onClick={toggleMobile} aria-label="Open menu">
                        <Menu size={24} />
                    </button>
                )}

                {/* Page Title */}
                {pageTitle && <h1 className="header-title">{pageTitle}</h1>}

                {/* Spacer */}
                <div className="header-spacer" />

                {/* Right Side: search + notifications + account */}
                <div className="header-right">
                    {/* Integrated Search */}
                    <div className="header-search-container" ref={searchContainerRef}>
                        <div className={`header-search-wrapper ${showResults ? 'active' : ''}`}>
                            <Search size={16} className="search-icon" />
                            <input 
                                type="text" 
                                placeholder="Search ASINs, Sellers, Actions..." 
                                value={searchQuery}
                                ref={searchInputRef}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
                                className="header-search-input"
                            />
                            {searchLoading && <div className="search-spinner-sm" />}
                            <span className="search-shortcut">⌘K</span>
                        </div>

                        {showResults && searchResults && (
                            <div className="search-results-dropdown">
                                {(!searchResults.asins.length && !searchResults.sellers.length && !searchResults.actions.length) ? (
                                    <div className="search-no-results">No results for "{searchQuery}"</div>
                                ) : (
                                    <>
                                        {searchResults.asins.length > 0 && (
                                            <div className="search-section">
                                                <div className="search-section-title">Products / ASINs</div>
                                                {searchResults.asins.map(asin => (
                                                    <div key={asin.id} className="search-item" onClick={() => { navigate(`/sku-report?asin=${asin.code}`); setShowResults(false); }}>
                                                        <div className="search-item-icon"><Package size={14} /></div>
                                                        <div className="search-item-content">
                                                            <div className="search-item-title">{asin.title}</div>
                                                            <div className="search-item-subtitle">{asin.code} • {asin.sku}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {searchResults.sellers.length > 0 && (
                                            <div className="search-section">
                                                <div className="search-section-title">Sellers</div>
                                                {searchResults.sellers.map(seller => (
                                                    <div key={seller.id} className="search-item" onClick={() => { navigate(`/seller-tracker/${seller.id}`); setShowResults(false); }}>
                                                        <div className="search-item-icon"><Users size={14} /></div>
                                                        <div className="search-item-content">
                                                            <div className="search-item-title">{seller.title}</div>
                                                            <div className="search-item-subtitle">{seller.subtitle}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {searchResults.actions.length > 0 && (
                                            <div className="search-section">
                                                <div className="search-section-title">Action Items</div>
                                                {searchResults.actions.map(action => (
                                                    <div key={action.id} className="search-item" onClick={() => { navigate(`/actions?id=${action.id}`); setShowResults(false); }}>
                                                        <div className="search-item-icon"><TrendingUp size={14} /></div>
                                                        <div className="search-item-content">
                                                            <div className="search-item-title">{action.title}</div>
                                                            <div className="search-item-subtitle">{action.subtitle}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Notifications */}
                    <Dropdown.Root>
                        <Dropdown.Trigger className="header-action-item">
                            <button className="action-btn">
                                <Bell size={20} />
                                {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                            </button>
                        </Dropdown.Trigger>
                        <Dropdown.Popover>
                            <div className="notification-container-glass" style={{ width: '360px', maxHeight: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                                    <span className="fw-bold text-dark h6 mb-0">Notifications</span>
                                    {unreadCount > 0 && <span className="badge bg-primary rounded-pill small">{unreadCount} New</span>}
                                </div>
                                <div className="notification-list p-2" style={{ overflowY: 'auto' }}>
                                    {notifications.length > 0 ? (
                                        notifications.map(n => (
                                            <Dropdown.Item key={n._id} onClick={() => handleNotificationClick(n)}>
                                                <div className="d-flex gap-3 w-100 p-1 align-items-start">
                                                    <div className="ios-app-icon flex-shrink-0 mt-1" style={{ width: '32px', height: '32px', background: `${getTypeColor(n.type)}15`, color: getTypeColor(n.type) }}>
                                                        {getTypeIcon(n.type)}
                                                    </div>
                                                    <div className="flex-grow-1 min-width-0">
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span className="smallest text-uppercase fw-bold text-muted">{n.type?.replace('_', ' ') || 'SYSTEM'}</span>
                                                            <span className="smallest text-muted">{new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                        <p className="mb-0 small text-wrap text-dark" style={{ lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                            {n.message}
                                                        </p>
                                                    </div>
                                                    {!n.isRead && <div className="notification-unread-dot mt-2 ms-2"></div>}
                                                </div>
                                            </Dropdown.Item>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center">
                                            <div className="bg-light d-inline-block p-3 rounded-circle mb-2">
                                                <Bell size={24} className="text-muted opacity-50" />
                                            </div>
                                            <div className="text-muted small">No new notifications</div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-2 border-top bg-light bg-opacity-10 text-center">
                                    <button className="btn btn-link btn-sm text-decoration-none transition-all fw-semibold" onClick={() => navigate('/alerts')}>
                                        View All Activity
                                    </button>
                                </div>
                            </div>
                        </Dropdown.Popover>
                    </Dropdown.Root>

                    {/* User Profile */}
                    <DropdownButton />
                </div>
            </div>
        </header>
    );
};

export default Header;
