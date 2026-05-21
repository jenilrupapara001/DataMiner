// components/common/Alerts.jsx

import React, { memo, useCallback, useMemo } from 'react';
import { Badge, Empty, Typography, Tag, Button, Tooltip } from 'antd';
import {
  AlertTriangle, CheckCircle2, XCircle,
  Info, Bell, BellOff, X
} from 'lucide-react';

const { Text } = Typography;

// ─── Pure helpers — defined outside component, never recreated ────────────────

const ALERT_CONFIG = {
  warning: {
    icon: AlertTriangle,
    color: '#d97706',
    bg: '#fef3c7',
    border: '#fcd34d',
    tagColor: 'warning',
  },
  success: {
    icon: CheckCircle2,
    color: '#059669',
    bg: '#d1fae5',
    border: '#6ee7b7',
    tagColor: 'success',
  },
  danger: {
    icon: XCircle,
    color: '#dc2626',
    bg: '#fee2e2',
    border: '#fca5a5',
    tagColor: 'error',
  },
  error: {
    icon: XCircle,
    color: '#dc2626',
    bg: '#fee2e2',
    border: '#fca5a5',
    tagColor: 'error',
  },
  info: {
    icon: Info,
    color: '#2563eb',
    bg: '#dbeafe',
    border: '#93c5fd',
    tagColor: 'processing',
  },
};

const DEFAULT_CONFIG = {
  icon: Bell,
  color: '#6366f1',
  bg: '#ede9fe',
  border: '#c4b5fd',
  tagColor: 'purple',
};

function getConfig(type) {
  return ALERT_CONFIG[type?.toLowerCase()] ?? DEFAULT_CONFIG;
}

function formatRelativeTime(timeValue) {
  if (!timeValue) return null;

  // If already a formatted string (e.g. "2 hours ago"), return as-is
  if (typeof timeValue === 'string' && isNaN(Date.parse(timeValue))) {
    return timeValue;
  }

  try {
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) return String(timeValue);

    const diffMs = Date.now() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;

    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return String(timeValue);
  }
}

// ─── Single alert row ─────────────────────────────────────────────────────────

const AlertRow = memo(({ alert, onDismiss, showDismiss }) => {
  const cfg = getConfig(alert.type);
  const Icon = cfg.icon;

  // Use _id (MongoDB) or id or index fallback — handled by parent key
  const relTime = useMemo(() => formatRelativeTime(alert.time || alert.createdAt), [alert.time, alert.createdAt]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 9,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      marginBottom: 8,
      transition: 'opacity 0.2s',
      position: 'relative',
    }}>
      {/* Icon */}
      <div style={{
        flexShrink: 0,
        marginTop: 1,
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: `${cfg.color}18`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={13} color={cfg.color} strokeWidth={2.5} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Message */}
        <Text style={{
          fontSize: 12,
          fontWeight: 600,
          color: '#1e293b',
          display: 'block',
          lineHeight: '16px',
        }}>
          {alert.message || alert.title || 'Alert'}
        </Text>

        {/* Sub-message if present */}
        {alert.description && (
          <Text style={{
            fontSize: 11,
            color: '#64748b',
            display: 'block',
            marginTop: 2,
            lineHeight: '15px',
          }}>
            {alert.description}
          </Text>
        )}

        {/* Footer row: tag + time */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 5,
        }}>
          {alert.type && (
            <Tag
              color={cfg.tagColor}
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '0 5px',
                lineHeight: '16px',
                borderRadius: 4,
                margin: 0,
                textTransform: 'uppercase',
              }}
            >
              {alert.type}
            </Tag>
          )}
          {relTime && (
            <Text style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
              {relTime}
            </Text>
          )}
        </div>
      </div>

      {/* Dismiss button */}
      {showDismiss && onDismiss && (
        <Tooltip title="Dismiss">
          <Button
            type="text"
            size="small"
            icon={<X size={12} />}
            onClick={() => onDismiss(alert._id || alert.id)}
            style={{
              flexShrink: 0,
              width: 22,
              height: 22,
              padding: 0,
              color: cfg.color,
              opacity: 0.6,
              marginTop: 0,
            }}
          />
        </Tooltip>
      )}
    </div>
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

// ✅ Fix 8: default is a stable constant — not `= []` inline
const EMPTY_ALERTS = [];

const Alerts = memo(({
  alerts = EMPTY_ALERTS,
  onDismiss,                    // optional: (id) => void
  onDismissAll,                 // optional: () => void
  title = 'Alerts & Notifications',
  showDismiss = false,
  maxHeight = 320,
}) => {
  // ✅ Fix 1: key builder — handles _id (MongoDB), id, or fallback to index
  const getKey = useCallback((alert, idx) => {
    return alert._id || alert.id || `alert-${idx}`;
  }, []);

  const hasAlerts = Array.isArray(alerts) && alerts.length > 0;

  // Count by type for summary
  const counts = useMemo(() => {
    if (!hasAlerts) return {};
    return alerts.reduce((acc, a) => {
      const t = (a.type || 'info').toLowerCase();
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
  }, [alerts, hasAlerts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: hasAlerts ? '#fee2e2' : '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {hasAlerts
              ? <Bell size={14} color="#dc2626" />
              : <BellOff size={14} color="#94a3b8" />
            }
          </div>
          <Text strong style={{ fontSize: 13, color: '#0f172a' }}>
            {title}
          </Text>
          {hasAlerts && (
            <Badge
              count={alerts.length}
              overflowCount={99}
              style={{
                backgroundColor: '#dc2626',
                fontSize: 10,
                fontWeight: 800,
                boxShadow: 'none',
              }}
            />
          )}
        </div>

        {/* Dismiss all */}
        {hasAlerts && showDismiss && onDismissAll && (
          <Button
            type="link"
            size="small"
            onClick={onDismissAll}
            style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, padding: 0 }}
          >
            Dismiss all
          </Button>
        )}
      </div>

      {/* Type summary chips */}
      {hasAlerts && Object.keys(counts).length > 1 && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {Object.entries(counts).map(([type, count]) => {
            const cfg = getConfig(type);
            return (
              <span
                key={type}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 20,
                  background: cfg.bg,
                  color: cfg.color,
                  border: `1px solid ${cfg.border}`,
                  textTransform: 'uppercase',
                }}
              >
                {count} {type}
              </span>
            );
          })}
        </div>
      )}

      {/* Alert list or empty state */}
      {hasAlerts ? (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight,
          paddingRight: 2,
        }}>
          {alerts.map((alert, idx) => (
            <AlertRow
              key={getKey(alert, idx)}
              alert={alert}
              onDismiss={onDismiss}
              showDismiss={showDismiss}
            />
          ))}
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 0',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}>
            <BellOff size={22} color="#94a3b8" />
          </div>
          <Text style={{ fontSize: 13, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
            All clear
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            No active alerts at this time
          </Text>
        </div>
      )}
    </div>
  );
});

export default Alerts;