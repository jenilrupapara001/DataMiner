import React, { useState, useEffect } from 'react';
import { Alert } from 'reactstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, Check, Search as SearchIcon, RefreshCw, Loader2, MessageSquare } from 'lucide-react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import EmptyState from '../components/common/EmptyState';
import './Alerts.css';

const AlertsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    warning: 0,
    success: 0,
    info: 0,
    unreadCount: 0
  });
  const [filters, setFilters] = useState({
    unreadOnly: false,
    searchTerm: '',
    type: 'all'
  });
  const socket = useSocket();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.notificationApi.getNotifications({
        unreadOnly: filters.unreadOnly,
        limit: 50
      });
      if (response.success) {
        setNotifications(response.data);
        // Calculate frontend stats based on fetched data
        const data = response.data;
        setStats({
          total: response.pagination.total,
          critical: data.filter(n => n.type === 'ALERT').length, // Maps to ALERT in DB
          warning: data.filter(n => n.type === 'SYSTEM').length,
          success: data.filter(n => n.type === 'ACTION_ASSIGNED').length,
          info: data.filter(n => n.type === 'CHAT_MESSAGE' || n.type === 'CHAT_MENTION').length,
          unreadCount: response.unreadCount
        });
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filters.unreadOnly]);

  useEffect(() => {
    if (!socket) return;
    socket.on('new-notification', (data) => {
      setNotifications(prev => [data.notification, ...prev].slice(0, 50));
      setStats(prev => ({
        ...prev,
        total: prev.total + 1,
        unreadCount: data.unreadCount
      }));
    });
    return () => socket.off('new-notification');
  }, [socket]);

  const acknowledgeNotification = async (id) => {
    try {
      const response = await api.notificationApi.markAsRead(id);
      if (response.success) {
        setNotifications(notifications.map(n =>
          n._id === id ? { ...n, isRead: true } : n
        ));
        setStats(prev => ({ ...prev, unreadCount: Math.max(0, prev.unreadCount - 1) }));
      }
    } catch (err) {
      console.error('Failed to acknowledge notification:', err);
    }
  };

  const acknowledgeAll = async () => {
    if (window.confirm('Mark all notifications as read?')) {
      try {
        const response = await api.notificationApi.markAllAsRead();
        if (response.success) {
          setNotifications(notifications.map(n => ({ ...n, isRead: true })));
          setStats(prev => ({ ...prev, unreadCount: 0 }));
        }
      } catch (err) {
        console.error('Failed to mark all as read:', err);
      }
    }
  };

  // Permanently delete (dismiss) an alert — won't reappear after refresh
  const dismissAlert = async (id) => {
    const wasUnread = !notifications.find(n => n._id === id)?.isRead;
    // Optimistically remove from UI right away
    setNotifications(prev => prev.filter(n => n._id !== id));
    if (wasUnread) {
      setStats(prev => ({ ...prev, unreadCount: Math.max(0, prev.unreadCount - 1) }));
    }
    try {
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.error('Dismiss failed — refreshing:', err);
      fetchNotifications(); // restore accuracy if backend call fails
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'ALERT': return <XCircle className="text-danger" />;
      case 'SYSTEM': return <Info className="text-info" />;
      case 'ACTION_ASSIGNED': return <CheckCircle className="text-success" />;
      case 'CHAT_MESSAGE':
      case 'CHAT_MENTION': return <MessageSquare className="text-primary" />;
      default: return <Bell className="text-secondary" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'ALERT': return 'danger';
      case 'SYSTEM': return 'info';
      case 'ACTION_ASSIGNED': return 'success';
      case 'CHAT_MESSAGE':
      case 'CHAT_MENTION': return 'primary';
      default: return 'secondary';
    }
  };

  const getSeverityClass = (severity) => {
    const classes = {
      critical: 'alert-item-critical',
      warning: 'alert-item-warning',
      success: 'alert-item-success',
      info: 'alert-item-info'
    };
    return classes[severity] || 'alert-item-info';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      critical: <XCircle style={{ width: '20px', height: '20px' }} />,
      warning: <AlertTriangle style={{ width: '20px', height: '20px' }} />,
      success: <CheckCircle style={{ width: '20px', height: '20px' }} />,
      info: <Info style={{ width: '20px', height: '20px' }} />
    };
    return icons[severity] || <Bell style={{ width: '20px', height: '20px' }} />;
  };

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return (
    <>
      <div className="container-fluid py-5 min-vh-100" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="row justify-content-center">
          <div className="col-lg-10 col-xl-9">

            <div className="d-flex justify-content-between align-items-end mb-4 px-2">
              <div>
                <h1 className="fw-bold text-zinc-900 mb-0 d-flex align-items-center gap-2" style={{ letterSpacing: '-0.02em', fontSize: '2rem' }}>
                  <Bell className="text-zinc-400" size={28} />
                  Operational <span className="text-zinc-400">Alerts</span>
                </h1>
                <p className="text-zinc-500 small mb-0 mt-1 fw-500">Stay updated with system activities & market triggers</p>
              </div>
              <div className="d-flex gap-3">
                <button
                  className="btn btn-white border border-zinc-200 shadow-sm rounded-pill px-3 d-flex align-items-center gap-2 fw-bold text-zinc-700"
                  onClick={fetchNotifications}
                  disabled={loading}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} className="text-zinc-400" />}
                  Sync
                </button>
                <button
                  className="btn btn-zinc-900 text-white rounded-pill px-4 fw-bold shadow-sm border-0"
                  style={{ backgroundColor: '#18181B' }}
                  onClick={acknowledgeAll}
                  disabled={stats.unreadCount === 0}
                >
                  Mark All Read
                </button>
              </div>
            </div>

            {/* iOS Widgets Style Stats */}
            <div className="row g-3 mb-5">
              {[
                { label: 'Unread', value: stats.unreadCount, icon: Bell, color: '#007aff' },
                { label: 'Alerts', value: stats.critical, icon: XCircle, color: '#ff3b30' },
                { label: 'Updates', value: stats.success, icon: CheckCircle, color: '#34c759' },
                { label: 'System', value: stats.warning, icon: Info, color: '#5856d6' }
              ].map((stat, i) => (
                <div key={i} className="col-6 col-md-3">
                  <div className="surface-card p-4 rounded-xl text-center border border-zinc-200 bg-white shadow-sm animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                    <div className="mb-2 d-inline-block p-2 rounded-circle border border-zinc-100" style={{ backgroundColor: `${stat.color}08`, color: stat.color }}>
                      <stat.icon size={20} />
                    </div>
                    <div className="text-zinc-500 smallest fw-bold text-uppercase" style={{ letterSpacing: '0.05em' }}>{stat.label}</div>
                    <div className="h3 fw-bold mb-0 mt-1 text-zinc-900">{stat.value}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              {/* Read / Unread toggle */}
              <div className="d-flex gap-2 p-1 bg-zinc-100 border border-zinc-200 rounded-pill d-inline-flex mb-3">
                <button
                  className={`btn btn-sm rounded-pill px-4 fw-bold border-0 transition-all ${!filters.unreadOnly ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500'}`}
                  style={!filters.unreadOnly ? { backgroundColor: '#18181B' } : {}}
                  onClick={() => setFilters({ ...filters, unreadOnly: false })}
                >
                  Recent
                </button>
                <button
                  className={`btn btn-sm rounded-pill px-4 fw-bold border-0 transition-all ${filters.unreadOnly ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500'}`}
                  style={filters.unreadOnly ? { backgroundColor: '#18181B' } : {}}
                  onClick={() => setFilters({ ...filters, unreadOnly: true })}
                >
                  Unread
                </button>
              </div>

                {/* Type filter */}
                <div className="d-flex gap-2 flex-wrap mb-3">
                  {[
                    { id: 'all', label: 'All Types' },
                    { id: 'ALERT', label: '🔴 Alerts' },
                    { id: 'SYSTEM', label: '🔵 System' },
                    { id: 'ACTION_ASSIGNED', label: '🟢 Updates' },
                    { id: 'CHAT_MESSAGE', label: '💬 Chat' },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setFilters(prev => ({ ...prev, type: t.id }))}
                      className={`btn btn-sm rounded-pill fw-bold border border-zinc-200 px-3 shadow-none transition-all ${filters.type === t.id ? 'bg-zinc-900 text-white border-zinc-900 shadow-sm' : 'bg-white text-zinc-500'
                        }`}
                      style={filters.type === t.id ? { backgroundColor: '#18181B' } : {}}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

              {/* Search */}
              <div className="input-group ios-search-pill rounded-pill px-3 py-1 shadow-sm mb-4">
                <span className="input-group-text bg-transparent border-0 p-0 me-2 text-muted">
                  <SearchIcon size={18} />
                </span>
                <input
                  type="text"
                  className="form-control bg-transparent border-0 p-0 shadow-none"
                  placeholder="Search notifications…"
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
                />
                {filters.searchTerm && (
                  <button
                    className="btn btn-link p-0 text-muted"
                    onClick={() => setFilters(prev => ({ ...prev, searchTerm: '' }))}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="notifications-stack">
              {loading && notifications.length === 0 ? (
                <div className="text-center py-5 mt-5">
                  <Loader2 className="animate-spin text-primary mb-3" size={40} />
                  <p className="text-muted">Fetching updates...</p>
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="All caught up!"
                  description="No new notifications. System events and alerts will appear here."
                  action={null}
                />
              ) : (
                <div className="d-flex flex-column gap-2">
                  {notifications
                    .filter(n =>
                      (filters.type === 'all' ||
                        n.type === filters.type ||
                        (filters.type === 'CHAT_MESSAGE' && (n.type === 'CHAT_MESSAGE' || n.type === 'CHAT_MENTION'))) &&
                      (filters.searchTerm === '' ||
                        n.message.toLowerCase().includes(filters.searchTerm.toLowerCase()))
                    )
                    .map((notification, idx) => (
                      <Alert
                        key={notification._id}
                        color={getTypeColor(notification.type)}
                        isOpen={true}
                        toggle={() => dismissAlert(notification._id)}
                        className={`mb-0 border border-zinc-200 shadow-sm animate-fade-in ${!notification.isRead ? 'fw-semibold bg-white' : 'bg-zinc-50'}`}
                        style={{ animationDelay: `${idx * 0.05}s`, borderRadius: 12 }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          {getTypeIcon(notification.type)}
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between">
                              <small className="text-uppercase fw-bold" style={{ letterSpacing: '0.05em', opacity: 0.7 }}>
                                {notification.type.replace(/_/g, ' ')}
                              </small>
                              <small className="opacity-75">
                                {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </small>
                            </div>
                            <div className="mt-1">{notification.message}</div>
                          </div>
                          {!notification.isRead && (
                            <button
                              className="btn btn-link p-0 ms-2"
                              title="Mark as read"
                              onClick={() => acknowledgeNotification(notification._id)}
                            >
                              <Check size={18} />
                            </button>
                          )}
                        </div>
                      </Alert>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
          .smallest { font-size: 0.65rem; }
          .transition-all { transition: all 0.2s ease; }
          .text-truncate-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
        `}</style>
    </>
  );
};

export default AlertsPage;
