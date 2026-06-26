import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useRefresh } from '../contexts/RefreshContext';
import api from '../services/api';
import HeaderNavigation from './HeaderNavigation';
import { DropdownButton } from './DropdownButton';
import { Dropdown } from './base/dropdown/dropdown';
import { Bell as BellIcon, Search, Menu, User, Check, X, MessageSquare, Info, RefreshCw } from 'lucide-react';

const Topbar = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const { triggerRefresh, isRefreshing } = useRefresh();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);
  const socket = useSocket();

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
    // Poll for notifications every minute as fallback
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('new-notification', ({ notification, unreadCount }) => {
      setNotifications(prev => [notification, ...prev].slice(0, 5));
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
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleMarkAllRead = async () => {
    try {
      const response = await api.notificationApi.markAllAsRead();
      if (response && response.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all read', error);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'ALERT': return <BellIcon size={14} />;
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
        navigate('/tasks');
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
    <nav className="navbar navbar-expand bg-white border-bottom px-4 py-2 sticky-top" style={{ height: '60px', zIndex: 100 }}>
      {/* Sidebar Toggle (Mobile) */}
      <button className="btn btn-link link-dark d-md-none me-3" onClick={toggleSidebar}>
        <Menu size={20} />
      </button>

      {/* Navigation (Desktop) */}
      <HeaderNavigation
        items={[
          { label: "Home", href: "/" },
          {
            label: "Dashboard",
            href: "/dashboard",
            items: [
              { label: "Overview", href: "/dashboard", current: true },
              { label: "Notifications", href: "/alerts" },
              { label: "Ads Report", href: "/ads-report" },
              { label: "SKU Insights", href: "/sku-report" },
              { label: "Scheduled reports", href: "#" },
              { label: "User reports", href: "#" },
            ],
          },
          { label: "Projects", href: "/actions" },
          { label: "Inventory", href: "/inventory" },
          { label: "Sellers", href: "/sellers" },
          { label: "Users", href: "/users" },
          { label: "Settings", href: "/settings" },
        ]}
      />

      <div className="ms-auto d-flex align-items-center gap-3">
        {/* Search Bar (Visual Only) */}
        <div className="d-none d-md-flex align-items-center bg-light rounded-pill px-3 py-1" style={{ width: '250px' }}>
          <Search size={16} className="text-muted me-2" />
          <input
            type="text"
            className="border-0 bg-transparent flex-grow-1"
            style={{ outline: 'none', fontSize: '0.9rem' }}
            placeholder="Search..."
          />
        </div>

        {/* Refresh Button */}
        <button 
          className="btn btn-link link-dark p-1" 
          onClick={triggerRefresh}
          title="Refresh data"
          disabled={isRefreshing}
        >
          <RefreshCw size={20} className={isRefreshing ? 'spin' : ''} />
        </button>

        {/* Notifications */}
        <Dropdown.Root>
          <Dropdown.Trigger className="position-relative">
            <button
              className="btn btn-link link-dark position-relative p-1"
            >
              <BellIcon size={20} />
              {unreadCount > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style={{ fontSize: '0.6rem' }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </Dropdown.Trigger>

          <Dropdown.Popover>
            <div className="notification-container-glass animate-fade-in" style={{ width: '360px', maxHeight: '500px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
                <span className="fw-bold text-dark h6 mb-0">Notifications</span>
                {unreadCount > 0 && (
                  <button className="btn btn-link btn-sm text-primary text-decoration-none transition-all smallest fw-bold" onClick={handleMarkAllRead}>
                    Mark All Read
                  </button>
                )}
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
                      <BellIcon size={24} className="text-muted opacity-50" />
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

        <div className="vr h-50 my-auto text-muted"></div>

        {/* User Profile */}
        <DropdownButton />
      </div>
    </nav>
  );
};

export default Topbar;
