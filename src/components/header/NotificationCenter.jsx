import React, { useState, useMemo } from 'react';
import { Drawer, Badge, Tabs, Tooltip, Button, Empty } from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  CheckCircleFilled,
  WarningFilled,
  CloseCircleFilled,
  InfoCircleFilled,
  DeleteOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useHeader } from '../../contexts/HeaderContext';
import { mockNotifications, notificationTypeConfig } from '../../data/notificationsData';
import { formatRelativeTime } from './headerHooks';

const typeIcons = {
  success: <CheckCircleFilled />,
  warning: <WarningFilled />,
  error: <CloseCircleFilled />,
  info: <InfoCircleFilled />,
};

const NotificationCenter = () => {
  const { notifOpen, setNotifOpen } = useHeader();
  const [notifications, setNotifications] = useState(mockNotifications);
  const [activeTab, setActiveTab] = useState('all');

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    if (activeTab === 'all') return notifications;
    if (activeTab === 'unread') return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.category === activeTab);
  }, [notifications, activeTab]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const markOne = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const deleteOne = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: '#fb4f40',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: '100px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <Tooltip title="Mark all as read">
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  style={{ color: '#8c8e8f' }}
                />
              </Tooltip>
              <Tooltip title="Clear all">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={clearAll}
                  disabled={notifications.length === 0}
                  style={{ color: '#8c8e8f' }}
                />
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
          <AnimatePresence>
            {filtered.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span
                      style={{
                        color: '#8c8e8f',
                        fontSize: '13px',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      You're all caught up
                    </span>
                  }
                />
              </div>
            ) : (
              filtered.map((notif) => {
                const cfg = notificationTypeConfig[notif.type];
                return (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12, height: 0 }}
                    className={`notif-item ${!notif.read ? 'unread' : ''}`}
                    onClick={() => markOne(notif.id)}
                  >
                    <div
                      className="notif-item-icon"
                      style={{
                        background: cfg.bg,
                        color: cfg.color,
                        border: `1px solid ${cfg.border}`,
                      }}
                    >
                      {typeIcons[notif.type]}
                    </div>
                    <div className="notif-item-content">
                      <div className="notif-item-title">{notif.title}</div>
                      <div className="notif-item-message">{notif.message}</div>
                      <div className="notif-item-meta">
                        <span className="notif-item-time">
                          {formatRelativeTime(notif.timestamp)}
                        </span>
                        {notif.actionLabel && (
                          <Button
                            size="small"
                            type="link"
                            style={{
                              padding: 0,
                              height: 'auto',
                              fontSize: '11px',
                              color: '#fb4f40',
                              fontWeight: 600,
                            }}
                          >
                            {notif.actionLabel} →
                          </Button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteOne(notif.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#cbd0d4',
                        padding: '4px',
                        opacity: 0,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = '1')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = '0')
                      }
                    >
                      <DeleteOutlined style={{ fontSize: '11px' }} />
                    </button>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {notifications.length > 0 && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #f4f5f7',
              background: '#f4f5f7',
              textAlign: 'center',
            }}
          >
            <Button
              type="link"
              size="small"
              style={{
                color: '#fb4f40',
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              View all notifications →
            </Button>
          </div>
        )}
      </Drawer>
    </>
  );
};

export default NotificationCenter;
