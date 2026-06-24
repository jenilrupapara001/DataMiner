import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Drawer, Badge, Tabs, Tooltip, Button, Empty, Spin } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleFilled,
  InfoCircleFilled,
  DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useHeader } from '../../contexts/HeaderContext';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatRelativeTime } from './headerHooks';

const typeIcons = {
  success: <CheckCircleFilled />,
  warning: <WarningFilled />,
  error: <CloseCircleFilled />,
  info: <InfoCircleFilled />,
  LIVE_SYNC: <CheckCircleFilled />,
  RE_SYNC: <ReloadOutlined />,
  RE_SYNC_ERROR: <WarningFilled />,
  CHAT_MESSAGE: <InfoCircleFilled />,
  BUYBOX_LOST: <WarningFilled />,
  PRICE_DISPUTE: <CloseCircleFilled />,
  RULE_TRIGGERED: <InfoCircleFilled />,
};

const typeStyles = {
  success: { color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  warning: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  error: { color: '#fb4f40', bg: '#fff0f0', border: '#ffb3ae' },
  info: { color: '#8c8e8f', bg: '#f4f5f7', border: '#d9e6e9' },
  LIVE_SYNC: { color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  RE_SYNC: { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  RE_SYNC_ERROR: { color: '#fb4f40', bg: '#fff0f0', border: '#ffb3ae' },
  CHAT_MESSAGE: { color: '#8c8e8f', bg: '#f4f5f7', border: '#d9e6e9' },
  BUYBOX_LOST: { color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  PRICE_DISPUTE: { color: '#fb4f40', bg: '#fff0f0', border: '#ffb3ae' },
  RULE_TRIGGERED: { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
};

const mapTypeToDisplay = (type, message) => {
  const t = (type || '').toUpperCase();
  if (t.includes('LIVE_SYNC')) {
    if (message && message.includes('failed')) return { type: 'warning', category: 'alert' };
    return { type: 'LIVE_SYNC', category: 'system' };
  }
  if (t.includes('RE_SYNC_ERROR')) return { type: 'RE_SYNC_ERROR', category: 'alert' };
  if (t.includes('RE_SYNC')) return { type: 'RE_SYNC', category: 'system' };
  if (t.includes('CHAT')) return { type: 'CHAT_MESSAGE', category: 'system' };
  if (t.includes('BUYBOX')) return { type: 'BUYBOX_LOST', category: 'alert' };
  if (t.includes('PRICE_DISPUTE') || t.includes('DISPUTE')) return { type: 'PRICE_DISPUTE', category: 'alert' };
  if (t.includes('RULE') || t.includes('AUTOMATION')) return { type: 'RULE_TRIGGERED', category: 'system' };
  if (t.includes('ERROR') || t.includes('FAILED')) return { type: 'error', category: 'alert' };
  if (t.includes('WARN')) return { type: 'warning', category: 'alert' };
  if (t.includes('SUCCESS') || t.includes('CREATE') || t.includes('UPDATE')) return { type: 'success', category: 'system' };
  if (t.includes('AUTH')) return { type: 'info', category: 'system' };
  return { type: 'info', category: 'system' };
};

const NotificationCenter = () => {
  const { notifOpen, setNotifOpen } = useHeader();
  const socket = useSocket();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  const fetchingRef = useRef(false);

  const unreadCount = serverUnreadCount;

  const fetchNotifications = useCallback(async (pageNum = 1, append = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    try {
      const res = await api.notificationApi.getNotifications({ page: pageNum, limit: 30 });
      if (res.success) {
        const mapped = (res.data || []).map((n) => ({
          id: n.Id,
          type: n.Type,
          message: n.Message,
          referenceModel: n.ReferenceModel,
          referenceId: n.ReferenceId,
          read: n.IsRead === 1 || n.IsRead === true,
          timestamp: new Date(n.CreatedAt),
          category: mapTypeToDisplay(n.Type, n.Message).category,
          displayType: mapTypeToDisplay(n.Type, n.Message).type,
        }));
        setNotifications((prev) => (append ? [...prev, ...mapped] : mapped));
        setServerUnreadCount(res.unreadCount || 0);
        setHasMore(pageNum < (res.pagination?.pages || 1));
      }
    } catch (e) {
      console.error('Failed to fetch notifications:', e);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (notifOpen) {
      fetchNotifications(1, false);
      setPage(1);
    }
  }, [notifOpen, fetchNotifications]);

  useEffect(() => {
    if (!socket || !user) return;
    const currentUserId = user.Id || user._id || user.id;

    const handleNewNotification = (data) => {
      const n = data.notification || data;
      const recipientId = n.recipient || n.RecipientId;
      if (recipientId && recipientId !== currentUserId) return;

      const mapped = {
        id: n.id || n.Id,
        type: n.type || n.Type,
        message: n.message || n.Message,
        referenceModel: n.referenceModel || n.ReferenceModel,
        referenceId: n.referenceId || n.ReferenceId,
        read: false,
        timestamp: new Date(n.createdAt || n.CreatedAt || Date.now()),
        category: mapTypeToDisplay(n.type || n.Type, n.message || n.Message).category,
        displayType: mapTypeToDisplay(n.type || n.Type, n.message || n.Message).type,
      };

      setNotifications((prev) => {
        if (prev.some((p) => p.id === mapped.id)) return prev;
        return [mapped, ...prev];
      });
      if (data.unreadCount != null) {
        setServerUnreadCount(data.unreadCount);
      } else {
        setServerUnreadCount((prev) => prev + 1);
      }
    };

    socket.on('new-notification', handleNewNotification);
    return () => { socket.off('new-notification', handleNewNotification); };
  }, [socket, user]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return notifications;
    if (activeTab === 'unread') return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.category === activeTab);
  }, [notifications, activeTab]);

  const markAllRead = async () => {
    try {
      await api.notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setServerUnreadCount(0);
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const clearAllRead = async () => {
    try {
      await api.notificationApi.deleteAllRead();
      setNotifications((prev) => prev.filter((n) => !n.read));
    } catch (e) {
      console.error('Failed to clear read:', e);
    }
  };

  const markOne = async (id) => {
    const notif = notifications.find((n) => n.id === id);
    if (notif && !notif.read) {
      try {
        await api.notificationApi.markAsRead(id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        setServerUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (e) {
        console.error('Failed to mark read:', e);
      }
    }
  };

  const deleteOne = async (id) => {
    try {
      await api.notificationApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const wasUnread = notifications.find((n) => n.id === id && !n.read);
      if (wasUnread) setServerUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchNotifications(next, true);
  };

  return (
    <>
      <Tooltip title="Notifications" placement="bottom">
        <button
          className="header-icon-btn"
          onClick={() => setNotifOpen(true)}
          aria-label="Notifications"
        >
          <Badge count={unreadCount} size="small" offset={[-2, 2]}>
            <BellOutlined style={{ fontSize: '16px' }} />
          </Badge>
        </button>
      </Tooltip>

      <Drawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        size={420}
        className="notif-drawer"
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span style={{
                  background: '#fb4f40', color: '#fff', fontSize: '10px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '100px', fontFamily: 'Inter, sans-serif',
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <Tooltip title="Mark all as read">
                <Button type="text" size="small" icon={<CheckOutlined />}
                  onClick={markAllRead} disabled={unreadCount === 0} style={{ color: '#8c8e8f' }} />
              </Tooltip>
              <Tooltip title="Clear read notifications">
                <Button type="text" size="small" icon={<DeleteOutlined />}
                  onClick={clearAllRead} disabled={!notifications.some(n => n.read)}
                  style={{ color: '#8c8e8f' }} />
              </Tooltip>
            </div>
          </div>
        }
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ borderBottom: '1px solid #f4f5f7', padding: '0 20px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="small"
            items={[
              { key: 'all', label: `All (${notifications.length})` },
              { key: 'unread', label: `Unread (${unreadCount})` },
              { key: 'alert', label: 'Alerts' },
              { key: 'system', label: 'System' },
            ]}
          />
        </div>

        <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 180px)' }}>
          {loading && notifications.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <Spin size="small" />
            </div>
          ) : (
            <AnimatePresence>
              {filtered.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={
                      <span style={{ color: '#8c8e8f', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
                        You're all caught up
                      </span>
                    }
                  />
                </div>
              ) : (
                filtered.map((notif) => {
                  const cfg = typeStyles[notif.displayType] || typeStyles[notif.type] || typeStyles.info;
                  const icon = typeIcons[notif.displayType] || typeIcons[notif.type] || typeIcons.info;
                  return (
                    <motion.div
                      key={notif.id}
                      layout
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12, height: 0 }}
                      className={`notif-item ${!notif.read ? 'unread' : ''}`}
                      onClick={() => markOne(notif.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div
                        className="notif-item-icon"
                        style={{
                          background: cfg.bg,
                          color: cfg.color,
                          border: `1px solid ${cfg.border}`,
                        }}
                      >
                        {icon}
                      </div>
                      <div className="notif-item-content">
                        <div className="notif-item-title" style={{
                          fontWeight: !notif.read ? 700 : 500,
                          color: !notif.read ? '#1e293b' : '#64748b',
                        }}>
                          {notif.type?.replace(/_/g, ' ') || 'Notification'}
                        </div>
                        <div className="notif-item-message" style={{
                          color: !notif.read ? '#334155' : '#94a3b8',
                        }}>
                          {notif.message}
                        </div>
                        <div className="notif-item-meta">
                          <span className="notif-item-time">
                            {formatRelativeTime(notif.timestamp)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteOne(notif.id); }}
                        style={{
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: '#cbd0d4', padding: '4px', opacity: 0, transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                      >
                        <DeleteOutlined style={{ fontSize: '11px' }} />
                      </button>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          )}
        </div>

        {hasMore && !loading && notifications.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f4f5f7', background: '#f4f5f7', textAlign: 'center' }}>
            <Button type="link" size="small" onClick={loadMore}
              style={{ color: '#fb4f40', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
              Load more
            </Button>
          </div>
        )}
        {loading && notifications.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f4f5f7', textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        )}
      </Drawer>
    </>
  );
};

export default NotificationCenter;
