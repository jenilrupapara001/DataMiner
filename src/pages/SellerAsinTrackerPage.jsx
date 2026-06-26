import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useParams } from 'react-router-dom';
import {
  RefreshCw, Package, Search, Activity, AlertTriangle,
  ExternalLink, Store, Plus, Database, Globe,
  Calendar, Clock, CheckCircle2, XCircle, Loader2, TrendingUp,
  TrendingDown, FileText, ShoppingBag, Users, Star,
  AlertCircle, Info, ChevronRight,
  Mail, Award, ArrowUpRight,
  ClipboardList, Bell, Eye, Edit3,
  DollarSign, Layers, Target, Hash, Settings as SettingsIcon,
  Filter, MoreHorizontal
} from 'lucide-react';
import {
  Card, Typography, Space, Button, Input,
  Select, Table, Tag, Avatar, Tooltip, Alert,
  message, Tabs, Empty, ConfigProvider, Divider,
  Modal, Form, DatePicker
} from 'antd';
import api from '../services/api';
import { PageLoading } from '../components/application/loading-indicator';

const { Text } = Typography;

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const MARKETPLACE_LABELS = {
  'amazon.in': 'Amazon India',
  'ajio': 'AJIO',
  'myntra': 'Myntra',
  'flipkart': 'Flipkart'
};

// ═══════════════════════════════════════════════════════════════
// SELLER NAME PARSER
// ═══════════════════════════════════════════════════════════════
const parseSellerName = (name = '') => {
  const match = name.match(/^(\d+)[\s\-_.]+(.+)$/);
  if (match) {
    return {
      number: match[1],
      cleanName: match[2].trim(),
      hasNumber: true
    };
  }
  const reverseMatch = name.match(/^(.+?)[\s\-_.]+(\d+)$/);
  if (reverseMatch) {
    return {
      number: reverseMatch[2],
      cleanName: reverseMatch[1].trim(),
      hasNumber: true
    };
  }
  return {
    number: name.charAt(0)?.toUpperCase() || '?',
    cleanName: name,
    hasNumber: false
  };
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const formatRelativeTime = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  const diff = Date.now() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatFullDate = (date) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getLqsBadge = (lqs) => {
  if (lqs == null) return <span style={{ color: '#94a3b8', fontSize: 11 }}>N/A</span>;
  const grade = lqs >= 80 ? 'A' : lqs >= 60 ? 'B' : lqs >= 40 ? 'C' : 'D';
  const colors = {
    A: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
    B: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    C: { bg: '#fffbeb', text: '#a16207', border: '#fde68a' },
    D: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' }
  };
  const c = colors[grade];
  return (
    <span style={{
      fontWeight: 600,
      fontSize: 11,
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      padding: '2px 8px',
      borderRadius: 4,
      display: 'inline-block',
      minWidth: 50,
      textAlign: 'center'
    }}>
      {grade} · {lqs}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════
// ACTIVITY TYPE CONFIG (No emojis, professional labels)
// ═══════════════════════════════════════════════════════════════
const ACTIVITY_TYPES = {
  ASIN_ADDED: { icon: Plus, color: '#15803d', label: 'ASIN Added', bg: '#f0fdf4' },
  ASIN_REMOVED: { icon: XCircle, color: '#b91c1c', label: 'ASIN Removed', bg: '#fef2f2' },
  SYNC_COMPLETED: { icon: CheckCircle2, color: '#15803d', label: 'Sync Completed', bg: '#f0fdf4' },
  SYNC_FAILED: { icon: XCircle, color: '#b91c1c', label: 'Sync Failed', bg: '#fef2f2' },
  SYNC_STARTED: { icon: Loader2, color: '#1d4ed8', label: 'Sync Initiated', bg: '#eff6ff' },
  PRICE_CHANGE: { icon: DollarSign, color: '#a16207', label: 'Price Updated', bg: '#fffbeb' },
  LQS_UPDATED: { icon: TrendingUp, color: '#6d28d9', label: 'LQS Score Updated', bg: '#f5f3ff' },
  NEW_ORDER: { icon: ShoppingBag, color: '#0e7490', label: 'Order Received', bg: '#ecfeff' },
  STOCK_LOW: { icon: AlertTriangle, color: '#a16207', label: 'Low Stock Alert', bg: '#fffbeb' },
  STOCK_OUT: { icon: AlertCircle, color: '#b91c1c', label: 'Out of Stock', bg: '#fef2f2' },
  REVIEW_RECEIVED: { icon: Star, color: '#a16207', label: 'Review Received', bg: '#fffbeb' },
  TASK_CREATED: { icon: ClipboardList, color: '#1d4ed8', label: 'Task Created', bg: '#eff6ff' },
  TASK_COMPLETED: { icon: CheckCircle2, color: '#15803d', label: 'Task Completed', bg: '#f0fdf4' },
  MANAGER_ASSIGNED: { icon: Users, color: '#6d28d9', label: 'Manager Assigned', bg: '#f5f3ff' },
  MANAGER_CHANGE:   { icon: Users, color: '#0891b2', label: 'Manager Changed', bg: '#ecfeff' },
  SETTINGS_UPDATED: { icon: Edit3, color: '#475569', label: 'Settings Updated', bg: '#f1f5f9' }
};

// ═══════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════
const StatCard = memo(({ icon: Icon, label, value, color = '#475569' }) => (
  <div style={{
    padding: '14px 16px',
    background: '#ffffff',
    border: '1px solid #d9e6e9',
    borderRadius: 12
  }}>
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }}>
      <div style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        background: `${color}0D`,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon size={16} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#8c8e8f',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 3
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#121b1e',
          letterSpacing: '-0.3px',
          lineHeight: 1
        }}>
          {value}
        </div>
      </div>
    </div>
  </div>
));

// ═══════════════════════════════════════════════════════════════
// ACTIVITY TIMELINE ITEM
// ═══════════════════════════════════════════════════════════════
const TimelineItem = memo(({ activity }) => {
  const config = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.SETTINGS_UPDATED;
  const Icon = config.icon;
  const isAnimated = activity.type === 'SYNC_STARTED';
  const isManagerChange = activity.type === 'MANAGER_CHANGE';
  const meta = activity.metadata || {};

  // Extract manager change fields from metadata
  const prevManagers = meta.previousManagers || [];
  const removedManagers = meta.removedManagers || [];
  const prevBMName = removedManagers.length > 0
    ? removedManagers.map(m => m.name).join(', ')
    : (prevManagers.length > 0 ? prevManagers.map(m => m.name).join(', ') : meta.previousManager || null);
  const newBMName = meta.newManager
    || (meta.addedManagerIds?.length > 0 ? `ID: ${meta.addedManagerIds.join(', ')}` : null);
  const actorName = activity.actor
    ? `${activity.actor.firstName || ''} ${activity.actor.lastName || ''}`.trim()
    : null;

  return (
    <div className="timeline-item-row" style={{
      display: 'flex',
      gap: 14,
      padding: '14px 16px',
      background: isManagerChange ? '#f0fdff' : '#ffffff',
      border: `1px solid ${isManagerChange ? '#bae6fd' : '#e5e7eb'}`,
      borderLeft: isManagerChange ? '3px solid #0891b2' : '1px solid #e5e7eb',
      borderRadius: 6,
      marginBottom: 8,
      transition: 'border-color 0.15s, background 0.15s'
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 6,
        background: config.bg,
        color: config.color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: `1px solid ${config.color}25`
      }}>
        <Icon size={15} strokeWidth={2} className={isAnimated ? 'spin-animation' : ''} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: config.color,
              background: config.bg,
              padding: '2px 8px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              border: `1px solid ${config.color}20`
            }}>
              {config.label}
            </span>
            {activity.priority === 'HIGH' && (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Urgent</span>
            )}
          </div>
          <Tooltip title={formatFullDate(activity.timestamp)}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', cursor: 'help', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={10} strokeWidth={2} />
              {formatRelativeTime(activity.timestamp)}
              <span style={{ color: '#94a3b8', marginLeft: 2 }}>· {formatFullDate(activity.timestamp)}</span>
            </span>
          </Tooltip>
        </div>

        {/* Title */}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', lineHeight: 1.4, marginBottom: 4 }}>
          {activity.title}
        </div>

        {/* Description */}
        {activity.description && !isManagerChange && (
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            {activity.description}
          </div>
        )}

        {/* ── MANAGER CHANGE: rich inline card ── */}
        {isManagerChange && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: 8,
              alignItems: 'center',
              background: '#ffffff',
              border: '1px solid #bae6fd',
              borderRadius: 8,
              padding: '12px 14px'
            }}>
              {/* Old BM */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Previous Manager</div>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: prevBMName ? '#b91c1c' : '#94a3b8',
                  background: prevBMName ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${prevBMName ? '#fecaca' : '#e2e8f0'}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  textDecoration: 'line-through',
                  opacity: 0.85
                }}>
                  {prevBMName || 'Unassigned'}
                </div>
              </div>

              {/* Arrow */}
              <div style={{ fontSize: 18, color: '#0891b2', fontWeight: 700, textAlign: 'center' }}>→</div>

              {/* New BM */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>New Manager</div>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#0891b2',
                  background: '#ecfeff',
                  border: '1px solid #a5f3fc',
                  borderRadius: 6,
                  padding: '6px 10px'
                }}>
                  {newBMName || 'Unassigned'}
                </div>
              </div>
            </div>

            {/* Footer: actor + timestamp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {actorName && (
                <span style={{ fontSize: 11, color: '#475569', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Users size={10} strokeWidth={2} />
                  Changed by <strong style={{ color: '#0f172a' }}>{actorName}</strong>
                </span>
              )}
              <span style={{ fontSize: 11, color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Calendar size={10} strokeWidth={2} />
                {formatFullDate(activity.timestamp)}
              </span>
            </div>
          </div>
        )}

        {/* Generic metadata chips (skip for MANAGER_CHANGE — we show above) */}
        {activity.metadata && !isManagerChange && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(activity.metadata).map(([key, value], i) => (
              <span key={i} style={{ fontSize: 11, fontWeight: 500, color: '#475569', background: '#f8fafc', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: 4 }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>{key}:</span> {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// UPCOMING TASK ITEM
// ═══════════════════════════════════════════════════════════════
const UpcomingTaskItem = memo(({ task }) => {
  const dueDate = new Date(task.dueDate);
  const now = new Date();
  const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
  const isOverdue = diffDays < 0;
  const isToday = diffDays === 0;
  const isTomorrow = diffDays === 1;

  let dueColor = '#475569';
  let dueBg = '#f1f5f9';
  let dueBorder = '#e2e8f0';
  let dueLabel = `In ${diffDays} days`;

  if (isOverdue) {
    dueColor = '#b91c1c';
    dueBg = '#fef2f2';
    dueBorder = '#fecaca';
    dueLabel = `${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''} overdue`;
  } else if (isToday) {
    dueColor = '#a16207';
    dueBg = '#fffbeb';
    dueBorder = '#fde68a';
    dueLabel = 'Due today';
  } else if (isTomorrow) {
    dueColor = '#a16207';
    dueBg = '#fffbeb';
    dueBorder = '#fde68a';
    dueLabel = 'Due tomorrow';
  }

  const priorityColors = {
    HIGH: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    MEDIUM: { bg: '#fffbeb', text: '#a16207', border: '#fde68a' },
    LOW: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' }
  };
  const priority = priorityColors[task.priority] || priorityColors.MEDIUM;

  return (
    <div className="task-item-row" style={{
      padding: '14px 16px',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderLeft: `3px solid ${dueColor}`,
      borderRadius: 6,
      marginBottom: 8,
      transition: 'border-color 0.15s, background 0.15s'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 6,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            color: priority.text,
            background: priority.bg,
            border: `1px solid ${priority.border}`,
            padding: '2px 8px',
            borderRadius: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }}>
            {task.priority || 'Normal'} Priority
          </span>
          {task.category && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#475569',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              padding: '2px 8px',
              borderRadius: 4,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {task.category}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: dueColor,
          background: dueBg,
          border: `1px solid ${dueBorder}`,
          padding: '2px 9px',
          borderRadius: 4,
          whiteSpace: 'nowrap'
        }}>
          {dueLabel}
        </span>
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: '#0f172a',
        lineHeight: 1.4,
        marginBottom: 4
      }}>
        {task.title}
      </div>
      {task.description && (
        <div style={{
          fontSize: 12,
          color: '#64748b',
          lineHeight: 1.5,
          marginBottom: 8
        }}>
          {task.description}
        </div>
      )}
      {task.assignee && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          color: '#64748b',
          fontWeight: 500
        }}>
          <Users size={11} strokeWidth={2} />
          Assigned to <span style={{ color: '#334155', fontWeight: 600 }}>{task.assignee}</span>
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// PROFESSIONAL SELLER CARD (No Gradients, Clean Design)
// ═══════════════════════════════════════════════════════════════
const SellerCard = memo(({ seller, isActive, onClick }) => {
  const parsed = parseSellerName(seller.name);
  const isOnline = seller.lastKeepaSync &&
    (new Date() - new Date(seller.lastKeepaSync)) < (24 * 60 * 60 * 1000);

  const numLength = String(parsed.number).length;
  const avatarFontSize = numLength <= 2 ? 15 : numLength === 3 ? 13 : 11;

  return (
    <div
      onClick={onClick}
      className={`seller-card-pro ${isActive ? 'active' : ''}`}
      style={{
        padding: '12px 14px',
        background: isActive ? '#f8fafc' : '#ffffff',
        border: `1px solid ${isActive ? '#1e293b' : '#e5e7eb'}`,
        borderLeft: `3px solid ${isActive ? '#1e293b' : 'transparent'}`,
        borderRadius: 6,
        marginBottom: 6,
        cursor: 'pointer',
        transition: 'all 0.15s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        {/* Professional Number Avatar */}
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 6,
          background: isActive ? '#1e293b' : '#f1f5f9',
          border: `1px solid ${isActive ? '#0f172a' : '#e2e8f0'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isActive ? '#ffffff' : '#334155',
          fontWeight: 700,
          fontSize: avatarFontSize,
          flexShrink: 0,
          position: 'relative',
          fontFamily: parsed.hasNumber
            ? '"JetBrains Mono", "SF Mono", Consolas, monospace'
            : 'inherit',
          letterSpacing: parsed.hasNumber ? '-0.3px' : '0',
          transition: 'all 0.15s'
        }}>
          {parsed.number}
          {isOnline && (
            <span style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 10,
              height: 10,
              background: '#16a34a',
              border: '2px solid #ffffff',
              borderRadius: '50%'
            }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 3,
            textTransform: 'capitalize',
            letterSpacing: '-0.01em'
          }}>
            {parsed.hasNumber ? parsed.cleanName : seller.name}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: '#64748b'
          }}>
            {parsed.hasNumber && (
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 600,
                color: '#475569',
                fontSize: 10
              }}>
                #{parsed.number}
              </span>
            )}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontWeight: 500
            }}>
              <Package size={10} strokeWidth={2} />
              {seller.dbAsinCount || 0}
            </span>
            {seller.newAsinCount > 0 && (
              <span style={{
                fontWeight: 600,
                color: '#15803d'
              }}>
                +{seller.newAsinCount} new
              </span>
            )}
          </div>
        </div>

        {isActive && (
          <ChevronRight size={14} style={{ color: '#1e293b', flexShrink: 0 }} strokeWidth={2.5} />
        )}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// SELLER DETAIL VIEW (Main Content)
// ═══════════════════════════════════════════════════════════════
const SellerDetailView = ({ seller, onSync, syncing, refreshKey }) => {
  const [asins, setAsins] = useState([]);
  const [activities, setActivities] = useState([]);
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('activity');
  const [search, setSearch] = useState('');
  const [lqsFilter, setLqsFilter] = useState('');
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [form] = Form.useForm();

  const handleCreateTask = async (values) => {
    setSubmittingTask(true);
    try {
      const res = await api.sellerTrackerApi.createSellerTask(seller._id, {
        title: values.title,
        description: values.description,
        priority: values.priority,
        category: values.category,
        dueDate: values.dueDate ? values.dueDate.toISOString() : null,
        assignee: values.assignee || null
      });
      if (res.success) {
        message.success('Task created successfully');
        setIsTaskModalOpen(false);
        form.resetFields();
        // Refresh local data loaders
        await Promise.all([loadUpcomingTasks(), loadActivities()]);
      } else {
        message.error(res.message || 'Failed to create task');
      }
    } catch (e) {
      message.error(`Failed to create task: ${e.message}`);
    } finally {
      setSubmittingTask(false);
    }
  };

  const loadAsins = useCallback(async () => {
    if (!seller) return;
    setLoading(true);
    try {
      const res = await api.sellerTrackerApi.getSellerAsins(seller._id);
      if (res.success) setAsins(res.data || []);
    } catch (e) {
      console.error('Failed to load ASINs:', e.message);
    } finally {
      setLoading(false);
    }
  }, [seller]);

  const loadActivities = useCallback(async () => {
    if (!seller) return;
    try {
      const res = await api.sellerTrackerApi.getSellerActivities(seller._id);
      if (res.success) {
        setActivities(res.data || []);
      }
    } catch (e) {
      console.error('Failed to load activities:', e.message);
    }
  }, [seller]);

  const loadUpcomingTasks = useCallback(async () => {
    if (!seller) return;
    try {
      const res = await api.sellerTrackerApi.getSellerTasks(seller._id);
      if (res.success) {
        setUpcomingTasks(res.data || []);
      }
    } catch (e) {
      console.error('Failed to load upcoming tasks:', e.message);
    }
  }, [seller]);

  useEffect(() => {
    if (seller) {
      loadAsins();
      loadActivities();
      loadUpcomingTasks();
    }
  }, [seller, loadAsins, loadActivities, loadUpcomingTasks, refreshKey]);

  const filtered = useMemo(() => {
    let result = asins;
    if (search) {
      result = result.filter(a =>
        a.asinCode?.toLowerCase().includes(search.toLowerCase()) ||
        a.title?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (lqsFilter) {
      result = result.filter(a => {
        const grade = a.lqs >= 80 ? 'A' : a.lqs >= 60 ? 'B' : a.lqs >= 40 ? 'C' : 'D';
        if (lqsFilter === 'high') return grade === 'A';
        if (lqsFilter === 'medium') return grade === 'B';
        if (lqsFilter === 'low') return grade === 'C' || grade === 'D';
        return true;
      });
    }
    return result;
  }, [asins, search, lqsFilter]);

  if (!seller) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        background: '#fafafa'
      }}>
        <div style={{
          background: '#ffffff',
          padding: 48,
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          textAlign: 'center',
          maxWidth: 420
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 8,
            background: '#f1f5f9',
            border: '1px solid #e5e7eb',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <Store size={24} color="#475569" strokeWidth={2} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            No Seller Selected
          </div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            Select a seller from the sidebar to view activity timeline, scheduled tasks, and catalog details.
          </div>
        </div>
      </div>
    );
  }

  const parsed = parseSellerName(seller.name);
  const marketplaceLabel = MARKETPLACE_LABELS[seller.marketplace] || seller.marketplace;
  const numLength = String(parsed.number).length;
  const headerFontSize = numLength <= 2 ? 20 : numLength === 3 ? 17 : 14;

  const overdueTasks = upcomingTasks.filter(t => new Date(t.dueDate) < new Date()).length;

  const asinColumns = [
    {
      title: 'ASIN',
      dataIndex: 'asinCode',
      width: 130,
      render: (code) => (
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          color: '#0f172a',
          fontSize: 12,
          fontWeight: 600,
          background: '#f8fafc',
          border: '1px solid #e5e7eb',
          padding: '2px 8px',
          borderRadius: 4
        }}>
          {code}
        </span>
      )
    },
    {
      title: 'Product Details',
      dataIndex: 'title',
      ellipsis: true,
      render: (title, record) => (
        <Space size={10}>
          {record.imageUrl && (
            <Avatar shape="square" size={32} src={record.imageUrl} style={{ borderRadius: 4, border: '1px solid #e5e7eb' }} />
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: '#334155' }}>
            {title || <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>No title available</span>}
          </span>
        </Space>
      )
    },
    {
      title: 'Quality Score',
      key: 'lqs',
      width: 110,
      align: 'center',
      render: (_, record) => getLqsBadge(record.lqs)
    },
    {
      title: 'Date Added',
      dataIndex: 'createdAt',
      width: 130,
      render: (date) => (
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
          {formatRelativeTime(date)}
        </span>
      )
    },
    {
      title: '',
      key: 'action',
      width: 50,
      align: 'center',
      render: (_, record) => (
        <Tooltip title="View on marketplace">
          <Button
            type="text"
            size="small"
            icon={<ExternalLink size={13} />}
            href={record.pageUrl || `https://amazon.in/dp/${record.asinCode}`}
            target="_blank"
          />
        </Tooltip>
      )
    }
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--color-surface-1)' }}>
      {/* ═══════════════════════════════════════════════════
                SELLER HEADER (Clean, Professional)
            ═══════════════════════════════════════════════════ */}
      <div style={{
        padding: '20px 28px',
        background: '#ffffff',
        borderBottom: '1px solid var(--color-border)',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 18
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Clean Professional Avatar */}
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              background: '#1e293b',
              border: '1px solid #0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: headerFontSize,
              fontFamily: parsed.hasNumber
                ? '"JetBrains Mono", "SF Mono", monospace'
                : 'inherit',
              letterSpacing: parsed.hasNumber ? '-0.3px' : '0',
              flexShrink: 0
            }}>
              {parsed.number}
            </div>

            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 6,
                flexWrap: 'wrap'
              }}>
                  {parsed.hasNumber && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#475569',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontFamily: '"JetBrains Mono", monospace',
                    letterSpacing: '0.02em'
                  }}>
                    #{parsed.number}
                  </span>
                )}
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#15803d',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#16a34a',
                    display: 'inline-block'
                  }} />
                  Active
                </span>
              </div>
              <Space size={12} separator={<Divider orientation="vertical" style={{ margin: 0 }} />}>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#475569' }}>
                  {marketplaceLabel}
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  color: '#64748b',
                  fontWeight: 500
                }}>
                  {seller.sellerId}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Last sync: {formatRelativeTime(seller.lastKeepaSync)}
                </span>
              </Space>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              size="small"
              icon={<Plus size={13} strokeWidth={2} />}
              onClick={() => setIsTaskModalOpen(true)}
            >
              Add Task
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={() => onSync(seller._id)}
              loading={syncing}
              icon={<RefreshCw size={13} strokeWidth={2} className={syncing ? 'spin-animation' : ''} />}
            >
              {syncing ? 'Syncing' : 'Sync Now'}
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 10
        }}>
          <StatCard
            icon={Package}
            label="Total ASINs"
            value={(seller.dbAsinCount || 0).toLocaleString('en-IN')}
            color="#1e293b"
          />
          <StatCard
            icon={Database}
            label="Keepa Catalog"
            value={(seller.keepaAsinCount || 0).toLocaleString('en-IN')}
            color="#1e293b"
          />
          <StatCard
            icon={TrendingUp}
            label="New Today"
            value={seller.newAsinCount || 0}
            color="#15803d"
          />
          <StatCard
            icon={Activity}
            label="Activities"
            value={activities.length}
            color="#1e293b"
          />
          <StatCard
            icon={ClipboardList}
            label="Pending Tasks"
            value={upcomingTasks.length}
            color={overdueTasks > 0 ? '#b91c1c' : '#a16207'}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
                TABS
            ═══════════════════════════════════════════════════ */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 28px',
        flexShrink: 0
      }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="pro-seller-tabs"
          items={[
            {
              key: 'activity',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={13} strokeWidth={2} />
                  Activity Log
                  <span style={{
                    padding: '0 6px',
                    background: activeTab === 'activity' ? '#1e293b' : '#e5e7eb',
                    color: activeTab === 'activity' ? '#ffffff' : '#475569',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: '16px'
                  }}>
                    {activities.length}
                  </span>
                </span>
              )
            },
            {
              key: 'tasks',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ClipboardList size={13} strokeWidth={2} />
                  Scheduled Tasks
                  <span style={{
                    padding: '0 6px',
                    background: overdueTasks > 0 ? '#b91c1c' : (activeTab === 'tasks' ? '#1e293b' : '#e5e7eb'),
                    color: overdueTasks > 0 ? '#ffffff' : (activeTab === 'tasks' ? '#ffffff' : '#475569'),
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: '16px'
                  }}>
                    {upcomingTasks.length}
                  </span>
                </span>
              )
            },
            {
              key: 'asins',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Package size={13} strokeWidth={2} />
                  ASIN Catalog
                  <span style={{
                    padding: '0 6px',
                    background: activeTab === 'asins' ? '#1e293b' : '#e5e7eb',
                    color: activeTab === 'asins' ? '#ffffff' : '#475569',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: '16px'
                  }}>
                    {asins.length}
                  </span>
                </span>
              )
            },
            {
              key: 'overview',
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Info size={13} strokeWidth={2} />
                  Overview
                </span>
              )
            }
          ]}
        />
      </div>

      {/* ═══════════════════════════════════════════════════
                TAB CONTENT
            ═══════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 28px'
      }}>
        {/* ACTIVITY TIMELINE TAB */}
        {activeTab === 'activity' && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#334155',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Recent Activity
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                color: '#15803d',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '3px 10px',
                borderRadius: 4
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  background: '#16a34a',
                  borderRadius: '50%',
                  display: 'inline-block'
                }} />
                Live
              </span>
            </div>

            {activities.length === 0 ? (
              <div style={{
                padding: 60,
                textAlign: 'center',
                background: '#ffffff',
                borderRadius: 6,
                border: '1px dashed #cbd5e1'
              }}>
                <Activity size={32} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  No activity recorded
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  Activity will appear here as events occur
                </div>
              </div>
            ) : (
              activities.map((activity) => (
                <TimelineItem key={activity.id} activity={activity} />
              ))
            )}
          </div>
        )}

        {/* UPCOMING TASKS TAB */}
        {activeTab === 'tasks' && (
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#334155',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Scheduled Tasks for {parsed.cleanName || seller.name}
              </div>
              {overdueTasks > 0 && (
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#b91c1c',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '3px 10px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  {overdueTasks} Overdue
                </span>
              )}
            </div>

            {upcomingTasks.length === 0 ? (
              <div style={{
                padding: 60,
                textAlign: 'center',
                background: '#ffffff',
                borderRadius: 6,
                border: '1px dashed #cbd5e1'
              }}>
                <CheckCircle2 size={32} style={{ color: '#15803d', marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                  No pending tasks
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  All tasks completed for this seller
                </div>
              </div>
            ) : (
              upcomingTasks.map((task) => (
                <UpcomingTaskItem key={task.id} task={task} />
              ))
            )}
          </div>
        )}

        {/* ASIN CATALOG TAB */}
        {activeTab === 'asins' && (
          <div>
            <div style={{
              display: 'flex',
              gap: 10,
              marginBottom: 14,
              flexWrap: 'wrap'
            }}>
              <Input
                placeholder="Search by ASIN or product title"
                prefix={<Search size={13} style={{ color: '#94a3b8' }} />}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: 280, borderRadius: 6 }}
                allowClear
              />
              <Select
                value={lqsFilter}
                onChange={setLqsFilter}
                style={{ width: 180 }}
                placeholder="Filter by quality"
                options={[
                  { value: '', label: 'All Quality Scores' },
                  { value: 'high', label: 'Grade A (80-100)' },
                  { value: 'medium', label: 'Grade B (60-79)' },
                  { value: 'low', label: 'Grade C/D (Below 60)' }
                ]}
              />
            </div>

            <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 0 } }}>
              <Table
                columns={asinColumns}
                dataSource={filtered}
                rowKey={r => r._id || r.asinCode}
                loading={loading}
                pagination={{ pageSize: 15, size: 'small' }}
                size="middle"
                className="pro-asin-table"
              />
            </Card>
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: 16
          }}>
            <Card
              title={
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  Seller Information
                </div>
              }
              style={{ borderRadius: 6, border: '1px solid #e5e7eb' }}
              styles={{ header: { padding: '14px 18px', minHeight: 'auto' } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { label: 'Seller Name', value: parsed.cleanName || seller.name, capitalize: true },
                  { label: 'Seller ID', value: seller.sellerId, mono: true },
                  { label: 'Account Number', value: parsed.hasNumber ? `#${parsed.number}` : 'N/A', mono: true },
                  { label: 'Marketplace', value: marketplaceLabel },
                  { label: 'Last Synchronization', value: formatFullDate(seller.lastKeepaSync) },
                  { label: 'Status', value: 'Active', color: '#15803d' }
                ].map((item, i, arr) => (
                  <div key={i} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}>
                    <span style={{
                      fontSize: 12,
                      color: '#64748b',
                      fontWeight: 500
                    }}>
                      {item.label}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: item.color || '#0f172a',
                      textTransform: item.capitalize ? 'capitalize' : 'none',
                      fontFamily: item.mono ? 'JetBrains Mono, monospace' : 'inherit'
                    }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              title={
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                  Quick Actions
                </div>
              }
              style={{ borderRadius: 6, border: '1px solid #e5e7eb' }}
              styles={{ header: { padding: '14px 18px', minHeight: 'auto' } }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { icon: RefreshCw, label: 'Synchronize Now', onClick: () => onSync(seller._id) },
                  { icon: Plus, label: 'Create New Task', onClick: () => setIsTaskModalOpen(true) },
                  { icon: FileText, label: 'View Reports', onClick: () => message.info('Report generation is automated under overview.') },
                  { icon: SettingsIcon, label: 'Configuration', onClick: () => message.info('Configuration settings are updated via global admin panel.') }
                ].map((action, i) => {
                  const ActionIcon = action.icon;
                  return (
                    <Button
                      key={i}
                      size="small"
                      block
                      icon={<ActionIcon size={13} strokeWidth={2} />}
                      onClick={action.onClick}
                      style={{ textAlign: 'left', justifyContent: 'flex-start' }}
                    >
                      {action.label}
                    </Button>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </div>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
            <ClipboardList size={18} style={{ color: '#1e293b' }} />
            Create Manual Task
          </div>
        }
        open={isTaskModalOpen}
        onCancel={() => {
          setIsTaskModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submittingTask}
        okText="Create Task"
        cancelText="Cancel"
        okButtonProps={{
          style: { borderRadius: 8, fontWeight: 600 }
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateTask}
          initialValues={{ priority: 'MEDIUM', category: 'Content' }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="title"
            label="Task Title"
            rules={[{ required: true, message: 'Please enter a task title' }]}
          >
            <Input placeholder="e.g. Optimize image gallery for ASINs" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea placeholder="Provide detailed instructions or context..." rows={3} maxLength={500} />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              name="priority"
              label="Priority"
              rules={[{ required: true }]}
            >
              <Select options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' }
              ]} />
            </Form.Item>

            <Form.Item
              name="category"
              label="Category"
              rules={[{ required: true }]}
            >
              <Select options={[
                { value: 'Content', label: 'Content Optimization' },
                { value: 'Inventory', label: 'Inventory Sync / Stock' },
                { value: 'Advertising', label: 'PPC / Advertising' },
                { value: 'Pricing', label: 'Pricing Strategy' },
                { value: 'Reporting', label: 'Performance Report' },
                { value: 'Other', label: 'Other' }
              ]} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item
              name="dueDate"
              label="Due Date"
              rules={[{ required: true, message: 'Please select a due date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="assignee"
              label="Assignee"
            >
              <Input placeholder="e.g. Sandip Kathiriya" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════
const SellerAsinTrackerPage = () => {
  const { sellerId: urlSellerId } = useParams();
  const [sellers, setSellers] = useState([]);
  const [activeSeller, setActiveSeller] = useState(null);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingSeller, setSyncingSeller] = useState(null);
  const [keepaKeyMissing, setKeepaKeyMissing] = useState(false);
  const [refreshKeys, setRefreshKeys] = useState({});
  const [sellerSearch, setSellerSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.sellerTrackerApi.getTrackers();
      if (res.success) {
        setSellers(res.data || []);
        setTokenStatus(res.tokenStatus);
        setKeepaKeyMissing(false);
        if (res.data?.length > 0 && !activeSeller) {
          const urlSeller = urlSellerId ? res.data.find(s => s._id === urlSellerId) : null;
          setActiveSeller(urlSeller || res.data[0]);
        }
      }
    } catch (e) {
      if (e.message && e.message.includes('KEEPA_API_KEY')) {
        setKeepaKeyMissing(true);
      } else {
        message.error(`Failed to fetch trackers: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncSeller = async (sellerId) => {
    setSyncingSeller(sellerId);
    try {
      const res = await api.sellerTrackerApi.syncSeller(sellerId);
      if (res.success) {
        message.success(`${res.seller}: ${res.added} new ASINs synchronized`);
        setRefreshKeys(prev => ({ ...prev, [sellerId]: Date.now() }));
        await loadData();
      }
    } catch (e) {
      message.error(`Synchronization failed: ${e.message}`);
    } finally {
      setSyncingSeller(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await api.sellerTrackerApi.syncAll();
      if (res.success) {
        message.success(`Full synchronization complete. ${res.totalAdded} new ASINs added.`);
        const newKeys = {};
        sellers.forEach(s => { newKeys[s._id] = Date.now(); });
        setRefreshKeys(newKeys);
        await loadData();
      }
    } catch (e) {
      message.error(`Synchronization failed: ${e.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const filteredSellers = useMemo(() => {
    if (!sellerSearch) return sellers;
    const q = sellerSearch.toLowerCase();
    return sellers.filter(s => {
      const parsed = parseSellerName(s.name || '');
      return (
        (s.name || '').toLowerCase().includes(q) ||
        parsed.cleanName.toLowerCase().includes(q) ||
        parsed.number.toString().toLowerCase().includes(q) ||
        (s.sellerId || '').toLowerCase().includes(q)
      );
    });
  }, [sellers, sellerSearch]);

  if (loading && sellers.length === 0) {
    return <PageLoading message="Loading seller tracker..." subMessage="Fetching seller catalog and activity data" />;
  }

  return (
    <div className="seller-tracker-pro">
      <style>{`
        .seller-tracker-pro {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
          background: #fafafa;
        }
        .seller-card-pro:hover {
          background: var(--color-surface-1) !important;
          border-color: var(--color-border-strong) !important;
        }
        .seller-card-pro.active:hover {
          background: var(--color-surface-2) !important;
        }
        .timeline-item-row:hover,
        .task-item-row:hover {
          border-color: var(--color-border-strong) !important;
        }
        .quick-action-pro:hover {
          background: var(--color-surface-1) !important;
          border-color: var(--color-border-strong) !important;
        }
        .pro-seller-tabs .ant-tabs-tab {
          font-weight: 600 !important;
          font-size: 12px !important;
          padding: 12px 0 !important;
          color: var(--color-text-muted) !important;
        }
        .pro-seller-tabs .ant-tabs-tab-active {
          color: var(--color-text-primary) !important;
        }
        .pro-seller-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
          color: var(--color-text-primary) !important;
        }
        .pro-seller-tabs .ant-tabs-ink-bar {
          background: var(--color-brand-500) !important;
          height: 2px !important;
        }
        .pro-asin-table .ant-table-thead > tr > th {
          background: var(--color-surface-1) !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          color: var(--color-text-secondary) !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em !important;
          border-bottom: 1px solid var(--color-border) !important;
        }
        .pro-asin-table .ant-table-tbody > tr > td {
          padding: 12px 16px !important;
          border-bottom: 1px solid var(--color-surface-1) !important;
        }
        @keyframes spin-animation {
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin-animation 1s linear infinite;
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: var(--color-surface-1); }
        ::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--color-text-muted); }
      `}</style>

        {keepaKeyMissing && (
          <Alert
            message="Keepa API Key Required"
            description="Configure KEEPA_API_KEY environment variable to enable seller synchronization."
            type="warning"
            showIcon
            closable
            style={{ margin: 16, borderRadius: 6 }}
          />
        )}

        {/* ═══════════════════════════════════════════════════
                    MAIN LAYOUT
                ═══════════════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* SELLER SIDEBAR */}
          <div style={{
            width: 290,
            background: '#ffffff',
            borderRight: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0
          }}>
            <div style={{
              padding: '14px 14px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}>
              <Input
                placeholder="Search sellers..."
                prefix={<Search size={13} style={{ color: '#94a3b8' }} />}
                value={sellerSearch}
                onChange={e => setSellerSearch(e.target.value)}
                size="small"
                allowClear
              />
              <Button
                type="primary"
                size="small"
                block
                icon={<RefreshCw size={12} strokeWidth={2} className={syncingAll ? 'spin-animation' : ''} />}
                onClick={handleSyncAll}
                loading={syncingAll}
              >
                Sync All ({sellers.length})
              </Button>
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '10px 10px'
            }}>
              {filteredSellers.length === 0 ? (
                <div style={{
                  padding: 30,
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: 12
                }}>
                  <Store size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div>{sellerSearch ? 'No sellers found' : 'No sellers registered'}</div>
                </div>
              ) : (
                filteredSellers.map(seller => (
                  <SellerCard
                    key={seller._id}
                    seller={seller}
                    isActive={activeSeller?._id === seller._id}
                    onClick={() => setActiveSeller(seller)}
                  />
                ))
              )}
            </div>
          </div>

          <SellerDetailView
            seller={activeSeller}
            onSync={handleSyncSeller}
            syncing={syncingSeller === activeSeller?._id}
            refreshKey={activeSeller ? refreshKeys[activeSeller._id] : null}
          />
        </div>
      </div>
  );
};

export default SellerAsinTrackerPage;