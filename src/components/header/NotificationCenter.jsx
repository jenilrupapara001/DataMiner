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
  success: { color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' },
  warning: { color: '#ED6C02', bg: '#FFF3E0', border: '#FFCC80' },
  error: { color: '#D32F2F', bg: '#FFEBEE', border: '#EF9A9A' },
  info: { color: '#64748B', bg: '#F1F5F9', border: '#E5E7EB' },
  LIVE_SYNC: { color: '#2E7D32', bg: '#E8F5E9', border: '#A5D6A7' },
  RE_SYNC: { color: '#1976D2', bg: '#E3F2FD', border: '#90CAF9' },
  RE_SYNC_ERROR: { color: '#D32F2F', bg: '#FFEBEE', border: '#EF9A9A' },
  CHAT_MESSAGE: { color: '#64748B', bg: '#F1F5F9', border: '#E5E7EB' },
  BUYBOX_LOST: { color: '#ED6C02', bg: '#FFF3E0', border: '#FFCC80' },
  PRICE_DISPUTE: { color: '#D32F2F', bg: '#FFEBEE', border: '#EF9A9A' },
  RULE_TRIGGERED: { color: '#9C27B0', bg: '#f5f3ff', border: '#ddd6fe' },
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
                  background: '#1976D2', color: '#fff', fontSize: '10px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: '100px', fontFamily: 'Inter, sans-serif',
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <Tooltip title="Mark all as read">
                <Button type="text" size="small" icon={<CheckOutlined />}
                  onClick={markAllRead} disabled={unreadCount === 0} style={{ color: '#94A3B8' }} />
              </Tooltip>
              <Tooltip title="Clear read notifications">
                <Button type="text" size="small" icon={<DeleteOutlined />}
                  onClick={clearAllRead} disabled={!notifications.some(n => n.read)}
                  style={{ color: '#94A3B8' }} />
              </Tooltip>
            </div>
          </div>
        }
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ borderBottom: '1px solid #F1F5F9', padding: '0 20px' }}>
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
                      <span style={{ color: '#94A3B8', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>
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
                          color: !notif.read ? '#0F172A' : '#64748b',
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
                          color: '#D1D5DB', padding: '4px', opacity: 0, transition: 'opacity 0.15s',
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
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9', background: '#F1F5F9', textAlign: 'center' }}>
            <Button type="link" size="small" onClick={loadMore}
              style={{ color: '#1976D2', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>
              Load more
            </Button>
          </div>
        )}
        {loading && notifications.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F1F5F9', textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        )}
      </Drawer>
    </>
  );
};

export default NotificationCenter;
