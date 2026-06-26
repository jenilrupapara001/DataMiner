import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card, Table, Tag, Badge, Button, Input, Select,
  Space, Tooltip, Dropdown, Modal, Empty, Typography,
  Row, Col, Avatar, Progress, Divider, Collapse, Layout, Segmented, Spin,
  message as antdMessage
} from 'antd';
import {
  PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  SearchOutlined, ReloadOutlined, ThunderboltOutlined,
  ShopOutlined, BarsOutlined, WarningOutlined,
  ClockCircleOutlined, CheckOutlined, CloseOutlined,
  MoreOutlined, RightOutlined, DownOutlined,
  CalendarOutlined, ArrowUpOutlined,
  ArrowDownOutlined, MinusOutlined, LockOutlined,
  UnorderedListOutlined, ExclamationCircleOutlined,
  SyncOutlined, CheckSquareOutlined,
  SendOutlined, LoadingOutlined
} from '@ant-design/icons';
import { Zap } from 'lucide-react';
import { db } from '../services/db';
import ActionModal from '../components/actions/ActionModal';
import ObjectiveManager from '../components/actions/ObjectiveManager';

import StartTaskModal from '../components/actions/StartTaskModal';
import SubmitTaskModal from '../components/actions/SubmitTaskModal';
import ReviewDecisionModal from '../components/actions/ReviewDecisionModal';
import TaskDetailDrawer from '../components/actions/TaskDetailDrawer';
import WorkflowActionButton from '../components/actions/WorkflowActionButton';
import RejectedTaskBanner from '../components/actions/RejectedTaskBanner';
import { useWorkflow } from '../hooks/useWorkflow.jsx';
import { getDisplayStatus, hasEverBeenStarted } from '../services/workflowEngine';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageLoading } from '../components/application/loading-indicator';
import { usePageTitle } from '../contexts/PageTitleContext';

dayjs.extend(relativeTime);

const { Content } = Layout;
const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;
/* ─── STATUS CONFIGURATION ──────────────────────────────────────────── */
const STATUS_META = {
  TODO: { label: 'To Do', color: '#64748b', bg: '#f1f5f9', antColor: 'default', icon: <BarsOutlined /> },
  PENDING: { label: 'Pending', color: '#E65100', bg: '#fef3c7', antColor: 'warning', icon: <ClockCircleOutlined /> },
  IN_PROGRESS: { label: 'In Progress', color: '#1976D2', bg: '#eef2ff', antColor: 'processing', icon: <SyncOutlined spin /> },
  REVIEW: { label: 'Review', color: '#9C27B0', bg: '#f5f3ff', antColor: 'purple', icon: <EyeOutlined /> },
  COMPLETED: { label: 'Completed', color: '#2E7D32', bg: '#ecfdf5', antColor: 'success', icon: <CheckCircleOutlined /> },
  REJECTED: { label: 'Rejected', color: '#e11d48', bg: '#fff1f2', antColor: 'error', icon: <CloseCircleOutlined /> },
  OVERDUE: { label: 'Overdue', color: '#C62828', bg: '#fef2f2', antColor: 'error', icon: <ExclamationCircleOutlined /> },
};

const PRIORITY_META = {
  CRITICAL: { label: 'Critical', color: '#b91c1c', bg: '#fee2e2', icon: <ExclamationCircleOutlined /> },
  HIGH: { label: 'High', color: '#c2410c', bg: '#ffedd5', icon: <ArrowUpOutlined /> },
  MEDIUM: { label: 'Medium', color: '#b45309', bg: '#fef3c7', icon: <MinusOutlined /> },
  LOW: { label: 'Low', color: '#475569', bg: '#f1f5f9', icon: <ArrowDownOutlined /> },
};

const SELLER_PALETTE = [
  '#1976D2', '#9C27B0', '#9C27B0', '#f43f5e', '#ED6C02',
  '#eab308', '#22c55e', '#14b8a6', '#0288D1', '#0288D1',
];

/* ─── UTILITIES ─────────────────────────────────────────────────────── */
const getSellerColor = (name) => {
  if (!name) return SELLER_PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return SELLER_PALETTE[Math.abs(h) % SELLER_PALETTE.length];
};

const getSellerInitial = (name) => {
  if (!name) return '?';
  const parts = name.split('-');
  return (parts[parts.length - 1] || name).charAt(0).toUpperCase();
};

const getRoleColor = (role) => {
  const r = (role?.name || role || '').toLowerCase();
  if (r.includes('admin')) return '#1976D2';
  if (r.includes('manager')) return '#9C27B0';
  if (r.includes('analyst')) return '#0288D1';
  return '#2E7D32';
};

const getUserInitial = (u) =>
  (u?.firstName?.charAt(0) || u?.name?.charAt(0) || 'U').toUpperCase();

const fmtTime = (iso) => {
  if (!iso) return null;
  const d = dayjs(iso);
  const h = dayjs().diff(d, 'hour');
  if (h < 1) return `${dayjs().diff(d, 'minute')}m ago`;
  if (h < 24) return `${h}h ago`;
  if (h < 168) return `${dayjs().diff(d, 'day')}d ago`;
  return d.format('MMM D');
};

const fmtDuration = (start, end) => {
  if (!start) return null;
  const s = dayjs(start), e = end ? dayjs(end) : dayjs();
  const h = e.diff(s, 'hour'), m = e.diff(s, 'minute') % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtExact = (iso) => iso ? dayjs(iso).format('ddd, D MMM YYYY [at] h:mm A') : '';

const getProgressColor = (pct) => {
  if (pct === 0) return '#e2e8f0';
  if (pct <= 25) return '#fb7185';
  if (pct <= 50) return '#fbbf24';
  if (pct <= 75) return '#818cf8';
  if (pct < 100) return '#1976D2';
  return '#2E7D32';
};

const matchesFilter = (a, f) => {
  if (f === 'ALL') return true;
  const s = (a.status || 'PENDING').toUpperCase();
  const now = new Date();
  switch (f) {
    case 'TODO': return s !== 'COMPLETED' && s !== 'REJECTED';
    case 'OVERDUE': {
      const dl = a.timeTracking?.deadline || a.DueDate;
      return dl && new Date(dl) < now && s !== 'COMPLETED';
    }
    case 'TOMORROW': {
      const dl = a.timeTracking?.deadline || a.DueDate;
      if (!dl) return false;
      const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(0, 0, 0, 0);
      const da = new Date(t); da.setDate(t.getDate() + 1);
      const d = new Date(dl);
      return d >= t && d < da;
    }
    case 'UPCOMING': {
      const dl = a.timeTracking?.deadline || a.DueDate;
      if (!dl) return false;
      const da = new Date(); da.setDate(da.getDate() + 2); da.setHours(0, 0, 0, 0);
      return new Date(dl) >= da;
    }
    case 'PENDING': return s === 'PENDING';
    case 'IN_PROGRESS': return s === 'IN_PROGRESS';
    case 'REVIEW': return s === 'REVIEW';
    case 'REJECTED': return s === 'REJECTED';
    case 'COMPLETED': return s === 'COMPLETED';
    default: return true;
  }
};

const matchesSearch = (a, q) => {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    (a.action || a.title || a.name || '').toLowerCase().includes(lower) ||
    (a.description || '').toLowerCase().includes(lower)
  );
};

const buildSellerHierarchy = (objectives, allActions, sellers) => {
  const map = {};

  const resolveSeller = (obj) => {
    let sid = obj.sellerId || obj.SellerId || obj.brandId;
    let sname = '';
    if (typeof sid === 'object' && sid?._id) { sname = sid.name || ''; sid = sid._id; }
    if (sid && !sname) {
      const s = sellers.find(x => x._id === sid);
      if (s) sname = s.name || s.sellerName || '';
    }
    if (!sid) { sid = 'unassigned'; sname = 'Unassigned'; }
    return { sellerId: sid, sellerName: sname || 'Unknown Brand' };
  };

  objectives.forEach(obj => {
    const { sellerId, sellerName } = resolveSeller(obj);
    if (!map[sellerId]) map[sellerId] = { sellerId, sellerName, objectives: [], directTasks: [] };
    const tasks = [];
    if (obj.keyResults) {
      obj.keyResults.forEach(kr => {
        if (kr.actions) {
          kr.actions.forEach(a => {
            const subs = allActions.filter(x =>
              x.parentTaskId === (a._id || a.id) || x.parentId === (a._id || a.id)
            );
            tasks.push({ ...a, subtasks: subs, krTitle: kr.title, objectiveTitle: obj.title });
          });
        }
      });
    }
    const done = tasks.filter(t => t.status === 'COMPLETED').length;
    const progress = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);
    map[sellerId].objectives.push({ ...obj, tasks, progress });
  });

  const standalone = allActions.filter(a =>
    !a.GoalId && !a.ObjectiveId && !a.KeyResultId && !a.keyResultId &&
    !a.parentTaskId && !a.parentId
  );

  standalone.forEach(a => {
    let sid = a.sellerId || a.SellerId;
    let sname = '';
    if (typeof sid === 'object' && sid?._id) { sname = sid.name || ''; sid = sid._id; }
    if (sid && !sname) {
      const s = sellers.find(x => x._id === sid);
      if (s) sname = s.name || s.sellerName || '';
    }
    if (!sid) { sid = 'unassigned'; sname = 'Unassigned'; }
    if (!map[sid]) map[sid] = { sellerId: sid, sellerName: sname || 'Unknown Brand', objectives: [], directTasks: [] };
    const subs = allActions.filter(x =>
      x.parentTaskId === (a._id || a.id) || x.parentId === (a._id || a.id)
    );
    map[sid].directTasks.push({ ...a, subtasks: subs });
  });

  return Object.values(map).sort((a, b) => a.sellerName.localeCompare(b.sellerName));
};

/* ─── SMALL REUSABLE COMPONENTS ─────────────────────────────────────── */

const StatusTag = ({ status, size = 'default' }) => {
  const cfg = STATUS_META[status] || STATUS_META.PENDING;
  return (
    <Tag
      icon={cfg.icon}
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}30`,
        borderRadius: 20,
        fontWeight: 600,
        fontSize: size === 'small' ? 10 : 11,
        padding: size === 'small' ? '0 6px' : '1px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {cfg.label}
    </Tag>
  );
};

const PriorityTag = ({ priority }) => {
  const cfg = PRIORITY_META[priority] || PRIORITY_META.MEDIUM;
  return (
    <Tag
      icon={cfg.icon}
      style={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}30`,
        borderRadius: 20,
        fontWeight: 600,
        fontSize: 11,
        padding: '1px 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {cfg.label}
    </Tag>
  );
};

const UserChip = ({ user }) => {
  if (!user) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
  const color = getRoleColor(user?.role);
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email || 'User';
  const role = user.role?.name || user.role || 'User';
  return (
    <Tooltip title={`${name} · ${role}`}>
      <Space size={6}>
        <Avatar size={22} style={{ background: color, fontSize: 11, fontWeight: 700 }}>
          {getUserInitial(user)}
        </Avatar>
        <Text style={{ fontSize: 12, fontWeight: 500 }}>{name.split(' ')[0]}</Text>
      </Space>
    </Tooltip>
  );
};

const TimelineCell = ({ createdAt, startedAt, completedAt, status }) => {
  const items = [];
  if (createdAt) items.push({
    label: 'Created',
    value: fmtTime(createdAt),
    exact: fmtExact(createdAt),
    color: '#94a3b8',
    icon: <CalendarOutlined style={{ color: '#94a3b8', fontSize: 10 }} />,
  });
  if (startedAt) items.push({
    label: 'Started',
    value: fmtTime(startedAt),
    exact: fmtExact(startedAt),
    color: '#1976D2',
    icon: <PlayCircleOutlined style={{ color: '#1976D2', fontSize: 10 }} />,
  });
  if (completedAt) items.push({
    label: 'Done',
    value: fmtTime(completedAt),
    exact: fmtExact(completedAt),
    color: '#2E7D32',
    icon: <CheckCircleOutlined style={{ color: '#2E7D32', fontSize: 10 }} />,
  });

  const duration = startedAt ? fmtDuration(startedAt, completedAt) : null;

  const content = (
    <Space orientation="vertical" size={2}>
      {items.map((it, i) => (
        <Text key={i} style={{ fontSize: 11, color: '#64748b' }}>{it.label}: {it.exact}</Text>
      ))}
    </Space>
  );

  if (items.length === 0) return <Text style={{ color: '#cbd5e1', fontSize: 12 }}>—</Text>;

  return (
    <Tooltip title={content}>
      <Space orientation="vertical" size={2}>
        {items.slice(-2).map((it, i) => (
          <Space key={i} size={4}>
            {it.icon}
            <Text style={{ fontSize: 10, color: '#94a3b8' }}>{it.label}</Text>
            <Text style={{ fontSize: 11, fontWeight: 600, color: it.color }}>{it.value}</Text>
          </Space>
        ))}
        {duration && (
          <Tag style={{
            marginTop: 2,
            fontSize: 10,
            fontFamily: 'monospace',
            background: status === 'COMPLETED' ? '#ecfdf5' : '#eef2ff',
            color: status === 'COMPLETED' ? '#2E7D32' : '#1976D2',
            border: 'none',
            borderRadius: 4,
            padding: '0 6px',
          }}>
            {duration}
          </Tag>
        )}
      </Space>
    </Tooltip>
  );
};

const ProgressCell = ({ pct }) => {
  const color = getProgressColor(pct);
  return (
    <Space orientation="vertical" size={2} style={{ width: 80 }}>
      <Progress
        percent={pct}
        size="small"
        showInfo={false}
        strokeColor={color}
        railColor="#f1f5f9"
      />
      <Text style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums', textAlign: 'center', display: 'block' }}>
        {pct}%
      </Text>
    </Space>
  );
};

const RejectionForm = ({ onSubmit, onCancel }) => {
  const [text, setText] = useState('');
  return (
    <Card
      size="small"
      style={{
        margin: '4px 16px 8px 16px',
        borderLeft: '4px solid #ED6C02',
        borderRadius: 8,
        background: '#fffbeb',
      }}
      styles={{ body: { padding: '12px 16px' } }}
    >
      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
        <Text strong style={{ fontSize: 12, color: '#92400e' }}>
          <ExclamationCircleOutlined style={{ marginRight: 6 }} />
          Rejection Reason (Required)
        </Text>
        <TextArea
          rows={2}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Describe what needs to be changed..."
          style={{ fontSize: 12, borderRadius: 6 }}
        />
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button size="small" onClick={onCancel}>Cancel</Button>
          <Button
            size="small"
            danger
            type="primary"
            disabled={!text.trim()}
            onClick={() => onSubmit(text)}
          >
            Submit Rejection
          </Button>
        </Space>
      </Space>
    </Card>
  );
};

/* ─── MAIN PAGE ─────────────────────────────────────────────────────── */
const TasksPage = () => {
  const [messageApi, contextHolder] = antdMessage.useMessage();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setPageTitle } = usePageTitle();

  /* ── State ── */
  const [objectives, setObjectives] = useState([]);
  const [allActions, setAllActions] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [users, setUsers] = useState([]);
  const [asins, setAsins] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState('ALL_TASKS');
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || 'ALL');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState(null);
  const [priorityFilter, setPriorityFilter] = useState(null);

  const [startingTask, setStartingTask] = useState(null);
  const [submittingTask, setSubmittingTask] = useState(null);
  const [reviewingTask, setReviewingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null);
  const [editingAction, setEditingAction] = useState(null);
  const [editingObjective, setEditingObjective] = useState(null);
  const [completingAction, setCompletingAction] = useState(null);

  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [selectedKeyResultId, setSelectedKeyResultId] = useState(null);

  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [rejectionForms, setRejectionForms] = useState({});

  const [kpis, setKpis] = useState({
    all: 0, todo: 0, overdue: 0, tomorrow: 0, upcoming: 0,
    status: { pending: 0, inProgress: 0, review: 0, completed: 0, rejected: 0 }
  });

  /* ── Data Loading ── */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [objRes, actRes, userRes, sellRes, asinRes] = await Promise.allSettled([
        db.getObjectives(),
        db.getActions(),
        db.getUsers(),
        db.getSellers(),
        db.getAsins(),
      ]);

      const objs = objRes.status === 'fulfilled'
        ? (objRes.value?.data || objRes.value || []) : [];
      const acts = actRes.status === 'fulfilled'
        ? (actRes.value?.data || actRes.value || []) : [];

      setObjectives(objs);
      const combined = computeAllActions(objs, acts);
      calculateKPIs(combined);

      if (userRes.status === 'fulfilled') {
        const v = userRes.value;
        setUsers(Array.isArray(v) ? v : (v?.data?.users || v?.data || []));
      }
      if (sellRes.status === 'fulfilled') {
        const v = sellRes.value;
        setSellers(Array.isArray(v) ? v : (v?.sellers || v?.data || []));
      }
      if (asinRes.status === 'fulfilled') {
        const v = asinRes.value;
        setAsins(Array.isArray(v) ? v : (v?.asins || v?.data || []));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computeAllActions = (objs, directActs) => {
    const combined = [...directActs];
    objs.forEach(obj => {
      obj.keyResults?.forEach(kr => {
        kr.actions?.forEach(a => {
          const id = a._id || a.id;
          if (!combined.some(x => (x._id || x.id) === id)) combined.push(a);
        });
      });
    });
    setAllActions(combined);
    return combined;
  };

  const calculateKPIs = (combined) => {
    const actions = [...combined];
    const now = new Date();
    const tomorrow = new Date(); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow); dayAfter.setDate(tomorrow.getDate() + 1);

    const c = {
      all: actions.length, todo: 0, overdue: 0, tomorrow: 0, upcoming: 0,
      status: { pending: 0, inProgress: 0, review: 0, completed: 0, rejected: 0 }
    };

    actions.forEach(a => {
      const s = String(a.status || 'PENDING').toUpperCase();
      if (s === 'IN_PROGRESS') c.status.inProgress++;
      else if (s === 'COMPLETED') c.status.completed++;
      else if (s === 'REVIEW') c.status.review++;
      else if (s === 'REJECTED') c.status.rejected++;
      else c.status.pending++;

      if (s !== 'COMPLETED') {
        c.todo++;
        const dl = a.timeTracking?.deadline || a.DueDate;
        if (dl) {
          const d = new Date(dl);
          if (d < now) c.overdue++;
          else if (d >= tomorrow && d < dayAfter) c.tomorrow++;
          else if (d >= dayAfter) c.upcoming++;
        }
      }
    });

    setKpis(c);
  };

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setPageTitle('Optimization Tasks'); }, [setPageTitle]);

  /* ── Handlers ── */
  const addToast = (msg, type = 'success') =>
    type === 'error' ? messageApi.error(msg) : messageApi.success(msg);

  const handleCreateAction = () => { setEditingAction(null); setIsActionModalOpen(true); };
  const handleCreateObjective = () => { setEditingObjective(null); setIsObjectiveModalOpen(true); };

  const handleEdit = (item, type = 'ACTION') => {
    if (type === 'ACTION') { setEditingAction(item); setIsActionModalOpen(true); }
    else { setEditingObjective(item); setIsObjectiveModalOpen(true); }
  };

  const handleDelete = (id, type = 'ACTION') => {
    Modal.confirm({
      title: `Delete this ${type.toLowerCase()}?`,
      icon: <ExclamationCircleOutlined />,
      content: 'This action cannot be undone.',
      okText: 'Delete', okType: 'danger', cancelText: 'Cancel', centered: true,
      onOk: async () => {
        try {
          if (type === 'ACTION') await db.deleteAction(id);
          else await db.deleteObjective(id);
          loadData(); addToast('Deleted successfully');
        } catch { addToast('Delete failed', 'error'); }
      },
    });
  };

  const handleSaveAction = async (data) => {
    try {
      if (data._id || data.id) await db.updateAction(data._id || data.id, data);
      else await db.createAction(data);
      setIsActionModalOpen(false); loadData();
      setSelectedKeyResultId(null);
      addToast('Task saved');
    } catch { addToast('Save failed', 'error'); }
  };

  const {
    handleStart,
    handleSubmitForReview: workflowSubmit,
    handleApprove,
    handleReject,
    handleForceComplete,
    handleReopen,
    isLoading: isWorkflowLoading,
    loadingTaskId,
  } = useWorkflow({
    currentUser,
    onSuccess: loadData,   // auto-refresh after every transition
  });

  const openStartModal = (task) => {
    setStartingTask(task);
    setIsStartModalOpen(true);
  };

  const openSubmitModal = (task) => {
    setSubmittingTask(task);
    setIsSubmitModalOpen(true);
  };

  const openReviewModal = (task) => {
    setReviewingTask(task);
    setIsReviewModalOpen(true);
  };

  const handleConfirmStart = async (taskId, startPayload) => {
    const task = allActions.find(a => (a._id || a.id) === taskId);
    if (!task) return;
    const result = await handleStart(task, startPayload);
    if (result?.success) {
      setIsStartModalOpen(false);
      setStartingTask(null);
    }
  };

  const handleConfirmSubmit = async (taskId, submissionData) => {
    const task = allActions.find(a => (a._id || a.id) === taskId);
    if (!task) return;
    const result = await workflowSubmit(task, submissionData);
    if (result?.success) {
      setIsSubmitModalOpen(false);
      setSubmittingTask(null);
    }
  };

  const handleConfirmDecision = async (taskId, decision, decisionData) => {
    const task = allActions.find(a => (a._id || a.id) === taskId);
    if (!task) return;
    let result;
    if (decision === 'APPROVE') {
      result = await handleApprove(task, decisionData);
    } else {
      result = await handleReject(task, decisionData);
    }
    if (result?.success) {
      setIsReviewModalOpen(false);
      setReviewingTask(null);
    }
  };

  const handleViewTask = (task) => {
    setViewingTask(task);
    setIsDetailDrawerOpen(true);
  };

  // ── Rejection form handlers ──
  const submitRejection = async (taskId, reason) => {
    try {
      const task = allActions.find(a => (a._id || a.id) === taskId);
      if (!task) return;
      await handleReject(task, { feedback: reason });
      closeRejectionForm(taskId);
    } catch { addToast('Failed to reject', 'error'); }
  };

  const closeRejectionForm = (taskId) => {
    setRejectionForms(prev => ({ ...prev, [taskId]: { open: false } }));
  };

  // ── Auto-generate tasks ──
  const [isAutoGenModalOpen, setIsAutoGenModalOpen] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  const handleAutoGenerate = async () => {
    setAutoGenerating(true);
    try {
      const result = await db.generateBulkActions();
      if (result?.success || result?.count > 0) {
        loadData();
        setIsAutoGenModalOpen(false);
        addToast(`Generated ${result?.count || 0} optimization tasks`);
      } else {
        addToast('No new tasks generated', 'error');
      }
    } catch (e) { addToast('Failed to auto-generate tasks', 'error'); }
    finally { setAutoGenerating(false); }
  };

  const clearFilters = () => {
    setActiveFilter('ALL');
    setSearchQuery('');
    setStatusFilter(null);
    setPriorityFilter(null);
    setSearchParams({});
  };

  const handleFilterClick = (f) => {
    const next = activeFilter === f ? 'ALL' : f;
    setActiveFilter(next);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (next === 'ALL') params.delete('filter'); else params.set('filter', next);
      if (searchQuery) params.set('q', searchQuery);
      return params;
    });
  };

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (value) params.set('q', value); else params.delete('q');
      if (activeFilter !== 'ALL') params.set('filter', activeFilter);
      return params;
    });
  }, [activeFilter, setSearchParams]);

  /* ── Computed Data ── */
  const sellerGroups = useMemo(
    () => buildSellerHierarchy(objectives, allActions, sellers),
    [objectives, allActions, sellers]
  );

  const reviewCount = useMemo(() => {
    return allActions.filter(a => (a.status || '').toUpperCase() === 'REVIEW').length;
  }, [allActions]);

  const filteredActions = useMemo(() => {
    return allActions.filter(a => {
      if (statusFilter && (a.status || '').toUpperCase() !== statusFilter) return false;
      if (priorityFilter && (a.priority || '').toUpperCase() !== priorityFilter) return false;
      if (!matchesFilter(a, activeFilter)) return false;
      if (!matchesSearch(a, searchQuery)) return false;
      return true;
    });
  }, [allActions, activeFilter, searchQuery, statusFilter, priorityFilter]);

  const isAdmin = currentUser?.role?.name === 'admin' || currentUser?.role === 'admin';

  /* ── Filter Pills ── */
  const filterPills = [
    { type: 'ALL', label: 'All', count: kpis.all, color: '#64748b' },
    { type: 'TODO', label: 'To Do', count: kpis.todo, color: '#0288D1' },
    { type: 'OVERDUE', label: 'Overdue', count: kpis.overdue, color: '#D32F2F' },
    { type: 'TOMORROW', label: 'Tomorrow', count: kpis.tomorrow, color: '#ED6C02' },
    { type: 'UPCOMING', label: 'Upcoming', count: kpis.upcoming, color: '#eab308' },
    null,
    { type: 'PENDING', label: 'Pending', count: kpis.status.pending, color: '#94a3b8' },
    { type: 'IN_PROGRESS', label: 'In Progress', count: kpis.status.inProgress, color: '#1976D2' },
    { type: 'REVIEW', label: 'Review', count: kpis.status.review, color: '#9C27B0' },
    { type: 'REJECTED', label: 'Rejected', count: kpis.status.rejected, color: '#f43f5e' },
    { type: 'COMPLETED', label: 'Completed', count: kpis.status.completed, color: '#2E7D32' },
  ];

  /* ── ALL TASKS TABLE ── */
  const renderActionMenu = (task) => {
    const displayStatus = getDisplayStatus(task);
    const everStarted = hasEverBeenStarted(task);
    const id = task._id || task.id;
    const items = [];

    items.push({
      key: 'view',
      icon: <EyeOutlined style={{ color: '#1976D2' }} />,
      label: 'View Details',
      onClick: () => handleViewTask(task)
    });

    const isPending = ['PENDING', 'TODO'].includes(displayStatus) && !everStarted;
    const isInProgress = ['IN_PROGRESS', 'OVERDUE'].includes(displayStatus) || (displayStatus === 'PENDING' && everStarted);
    const isReview = displayStatus === 'REVIEW';

    if (isPending) {
      items.push({
        key: 'start',
        icon: <PlayCircleOutlined style={{ color: '#1976D2' }} />,
        label: 'Start Task',
        onClick: () => openStartModal(task),
      });
    }
    if (isInProgress) {
      items.push({
        key: 'review',
        icon: <SendOutlined style={{ color: '#9C27B0' }} />,
        label: 'Submit for Review',
        onClick: () => openSubmitModal(task),
      });
    }
    if (isReview) {
      items.push({
        key: 'review-action',
        icon: <CheckCircleOutlined style={{ color: '#2E7D32' }} />,
        label: 'Review Submission',
        onClick: () => openReviewModal(task),
      });
    }

    items.push({ type: 'divider' });
    items.push({ key: 'edit', icon: <EditOutlined />, label: 'Edit Task', onClick: () => handleEdit(task) });
    items.push({ key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: () => handleDelete(id) });
    return { items };
  };

  const taskTableColumns = [
    {
      title: '#',
      key: 'index',
      width: 48,
      render: (_, __, idx) => (
        <Text style={{ fontSize: 12, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
          {idx + 1}
        </Text>
      ),
    },
    {
      title: 'Task Name',
      key: 'name',
      width: 280,
      render: (_, task) => {
        const name = task.action || task.title || task.name || 'Untitled';
        const asins = task.asins?.length || task.asinCount || 0;
        return (
          <Space orientation="vertical" size={2}>
            <Text strong style={{ fontSize: 13, color: '#1e293b' }}>{name}</Text>
            {asins > 0 && (
              <Tag style={{ fontSize: 10, borderRadius: 4, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
                {asins} ASIN{asins > 1 ? 's' : ''}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Category',
      key: 'type',
      width: 120,
      render: (_, task) => {
        const cat = task.type || task.category || task.actionType || 'General';
        return (
          <Tag style={{
            fontSize: 11, borderRadius: 4,
            background: '#f8fafc', color: '#475569',
            border: '1px solid #e2e8f0',
          }}>
            {cat}
          </Tag>
        );
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 100,
      align: 'center',
      render: (_, task) => {
        const pct = task.status === 'COMPLETED' ? 100 : task.status === 'IN_PROGRESS' ? 50 : 0;
        return <ProgressCell pct={pct} />;
      },
    },
    {
      title: 'Assigned',
      key: 'assigned',
      width: 130,
      render: (_, task) => {
        const u = task.assignedTo;
        if (!u) return <Text style={{ color: '#cbd5e1', fontSize: 12 }}>—</Text>;
        const users = Array.isArray(u) ? u : [u];
        return (
          <Space size={4}>
            {users.slice(0, 2).map((usr, i) => (
              <UserChip key={i} user={usr} />
            ))}
            {users.length > 2 && (
              <Tag style={{ fontSize: 10 }}>+{users.length - 2}</Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Priority',
      key: 'priority',
      width: 100,
      render: (_, task) => task.priority
        ? <PriorityTag priority={(task.priority || '').toUpperCase()} />
        : <Text style={{ color: '#cbd5e1', fontSize: 12 }}>—</Text>,
    },
    {
      title: 'Status / Review',
      key: 'review',
      width: 200,
      render: (_, task) => (
        <WorkflowActionButton
          task={task}
          currentUser={currentUser}
          onStart={openStartModal}
          onSubmit={openSubmitModal}
          onApprove={openReviewModal}
          onReject={openReviewModal}
          onReopen={(t) => handleReopen(t)}
          size="small"
          isLoading={isWorkflowLoading(task._id || task.id, null)}
        />
      ),
    },
    {
      title: 'Timeline',
      key: 'timeline',
      width: 160,
      render: (_, task) => (
        <TimelineCell
          createdAt={task.createdAt}
          startedAt={task.timeTracking?.startedAt}
          completedAt={task.timeTracking?.completedAt}
          status={(task.status || '').toUpperCase()}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      align: 'right',
      render: (_, task) => (
        <Dropdown menu={renderActionMenu(task)} trigger={['click']} placement="bottomRight">
          <Button
            type="text"
            icon={<MoreOutlined />}
            size="small"
            style={{ color: '#94a3b8' }}
          />
        </Dropdown>
      ),
    },
  ];

  /* ── SELLER VIEW ── */
  const renderSellerView = () => {
    if (sellerGroups.length === 0) return (
      <Empty description="No seller data available" style={{ padding: 60 }} />
    );

    const visibleGroups = sellerGroups.map(group => {
      const allTasks = [
        ...group.objectives.flatMap(o => o.tasks),
        ...group.directTasks,
      ].filter(t => {
        if (statusFilter && (t.status || '').toUpperCase() !== statusFilter) return false;
        if (priorityFilter && (t.priority || '').toUpperCase() !== priorityFilter) return false;
        if (!matchesFilter(t, activeFilter)) return false;
        if (!matchesSearch(t, searchQuery)) return false;
        return true;
      });
      return { ...group, filteredTasks: allTasks };
    }).filter(g => g.filteredTasks.length > 0);

    const buildCollapseItems = (group) => {
      const items = [];

      group.objectives.forEach((obj, oi) => {
        const objTasks = obj.tasks.filter(t => {
          if (statusFilter && (t.status || '').toUpperCase() !== statusFilter) return false;
          if (priorityFilter && (t.priority || '').toUpperCase() !== priorityFilter) return false;
          if (!matchesFilter(t, activeFilter)) return false;
          if (!matchesSearch(t, searchQuery)) return false;
          return true;
        });
        if (objTasks.length === 0) return;

        const objDone = objTasks.filter(t => t.status === 'COMPLETED').length;
        const objPct = objTasks.length === 0 ? 0 : Math.round((objDone / objTasks.length) * 100);
        const hasReview = objTasks.some(t => t.status === 'REVIEW');
        const childIncomplete = objTasks.some(t => t.status !== 'COMPLETED');

        items.push({
          key: obj._id || `obj-${oi}`,
          label: (
            <Row align="middle" gutter={16} style={{ width: '100%' }}>
              <Col>
                <Tag style={{
                  fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                  background: '#eef2ff', color: '#1976D2',
                  border: '1px solid #c7d2fe', borderRadius: 4,
                  minWidth: 36, textAlign: 'center',
                }}>OBJ</Tag>
              </Col>
              <Col flex={1}>
                <Space size={8}>
                  {hasReview && <Tooltip title="Has tasks awaiting review"><Badge dot color="#ED6C02" /></Tooltip>}
                  {childIncomplete && <Tooltip title="Not all tasks complete"><LockOutlined style={{ color: '#fbbf24', fontSize: 12 }} /></Tooltip>}
                  <Text strong style={{ fontSize: 13, color: '#1e293b' }}>{obj.title || 'Untitled Objective'}</Text>
                  {obj.isStandalone && <Tag style={{ fontSize: 10, background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' }}>Direct Actions</Tag>}
                </Space>
              </Col>
              <Col>
                <Space size={12} align="center">
                  <Text style={{ fontSize: 11, color: '#94a3b8' }}>{objDone}/{objTasks.length} done</Text>
                  <Progress percent={objPct} size="small" style={{ width: 80, margin: 0 }} strokeColor={objPct === 100 ? '#2E7D32' : '#1976D2'} railColor="#f1f5f9" showInfo={false} />
                  <Text style={{ fontSize: 11, color: '#64748b', fontVariantNumeric: 'tabular-nums', minWidth: 32 }}>{objPct}%</Text>
                </Space>
              </Col>
            </Row>
          ),
          children: (
            <Table
              dataSource={objTasks.map((t, i) => ({ ...t, _tableKey: `${t._id || t.id}-${i}` }))}
              rowKey="_tableKey"
              columns={taskTableColumns}
              size="small"
              pagination={false}
              showHeader={false}
              style={{ background: 'white' }}
              rowClassName={(_, idx) => idx % 2 === 0 ? 'task-row-even' : 'task-row-odd'}
              expandable={{
                expandedRowRender: (task) => {
                  const id = task._id || task.id;
                  return (
                    <div>
                      {rejectionForms[id]?.open && <RejectionForm onSubmit={(r) => submitRejection(id, r)} onCancel={() => closeRejectionForm(id)} />}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div style={{ padding: '8px 16px 8px 48px', background: '#f8fafc' }}>
                          {task.subtasks.map((sub, si) => (
                            <Row key={sub._id || sub.id || si} align="middle" gutter={16} style={{ padding: '6px 12px', background: 'white', borderRadius: 6, marginBottom: 4, border: '1px solid #f1f5f9' }}>
                              <Col flex={1}>
                                <Space size={8}>
                                  <Tag style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4', borderRadius: 4 }}>SUB</Tag>
                                  <Text style={{ fontSize: 12, color: '#374151' }}>{sub.action || sub.title || sub.name || 'Untitled'}</Text>
                                </Space>
                              </Col>
                              <Col><StatusTag status={(sub.status || 'PENDING').toUpperCase()} size="small" /></Col>
                              <Col><TimelineCell createdAt={sub.createdAt} startedAt={sub.timeTracking?.startedAt} completedAt={sub.timeTracking?.completedAt} status={(sub.status || '').toUpperCase()} /></Col>
                            </Row>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                },
                rowExpandable: (task) => (task.subtasks && task.subtasks.length > 0) || !!rejectionForms[task._id || task.id]?.open,
              }}
            />
          ),
          style: { background: '#fafbfc', borderBottom: '1px solid #f1f5f9' },
        });
      });

      if (group.directTasks.length > 0) {
        const filteredDirect = group.directTasks.filter(t => {
          if (statusFilter && (t.status || '').toUpperCase() !== statusFilter) return false;
          if (!matchesFilter(t, activeFilter)) return false;
          if (!matchesSearch(t, searchQuery)) return false;
          return true;
        });
        if (filteredDirect.length > 0) {
          items.push({
            key: 'direct-tasks',
            label: (
              <Space>
                <Tag style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 4 }}>DIRECT</Tag>
                <Text strong style={{ fontSize: 13, color: '#1e293b' }}>Direct Tasks</Text>
                <Tag style={{ fontSize: 11, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 12 }}>{filteredDirect.length} tasks</Tag>
              </Space>
            ),
            children: (
              <Table
                dataSource={filteredDirect.map((t, i) => ({ ...t, _tableKey: `d-${t._id || t.id}-${i}` }))}
                rowKey="_tableKey"
                columns={taskTableColumns}
                size="small"
                pagination={false}
                showHeader={false}
                style={{ background: 'white' }}
              />
            ),
            style: { background: '#fafbfc', borderBottom: '1px solid #f1f5f9' },
          });
        }
      }

      return items;
    };

    return (
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        {visibleGroups.map(group => {
          const totalTasks = group.filteredTasks.length;
          const doneTasks = group.filteredTasks.filter(t => (t.status || '').toUpperCase() === 'COMPLETED').length;
          const overdueTasks = group.filteredTasks.filter(t => {
            const dl = t.timeTracking?.deadline || t.DueDate;
            return dl && new Date(dl) < new Date() && (t.status || '').toUpperCase() !== 'COMPLETED';
          }).length;
          const inProgTasks = group.filteredTasks.filter(t => (t.status || '').toUpperCase() === 'IN_PROGRESS').length;
          const reviewTasks = group.filteredTasks.filter(t => (t.status || '').toUpperCase() === 'REVIEW').length;
          const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
          const sellerColor = getSellerColor(group.sellerName);
          const collapseItems = buildCollapseItems(group);

          if (collapseItems.length === 0) return null;

          return (
            <Card key={group.sellerId} style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 0 } }}>
              <div style={{ padding: '12px 20px', background: `linear-gradient(135deg, ${sellerColor}10, #ffffff)`, borderBottom: '1px solid #f1f5f9', borderLeft: `4px solid ${sellerColor}` }}>
                <Row align="middle" gutter={16} style={{ width: '100%' }}>
                  <Col>
                    <Avatar size={36} style={{ background: sellerColor, fontSize: 15, fontWeight: 700 }}>
                      {getSellerInitial(group.sellerName)}
                    </Avatar>
                  </Col>
                  <Col flex={1}>
                    <Space size={8} wrap>
                      <Text strong style={{ fontSize: 14, color: '#1e293b' }}>{group.sellerName}</Text>
                      <Tag style={{ borderRadius: 12, fontSize: 11, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                        {group.objectives.length} objective{group.objectives.length !== 1 ? 's' : ''}
                      </Tag>
                      <Tag style={{ borderRadius: 12, fontSize: 11, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                        {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                      </Tag>
                      {overdueTasks > 0 && <Tag style={{ borderRadius: 12, fontSize: 11, background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}><ExclamationCircleOutlined style={{ marginRight: 4 }} />{overdueTasks} overdue</Tag>}
                      {reviewTasks > 0 && <Tag style={{ borderRadius: 12, fontSize: 11, background: '#f5f3ff', color: '#9C27B0', border: '1px solid #ddd6fe' }}><EyeOutlined style={{ marginRight: 4 }} />{reviewTasks} needs review</Tag>}
                    </Space>
                  </Col>
                  <Col>
                    <Space size={16} align="center">
                      <Space size={8}>
                        <Badge color="#2E7D32" text={<Text style={{ fontSize: 12 }}>{doneTasks}</Text>} />
                        <Badge color="#1976D2" text={<Text style={{ fontSize: 12 }}>{inProgTasks}</Text>} />
                      </Space>
                      <Progress percent={pct} size="small" style={{ width: 100, margin: 0 }} strokeColor={sellerColor} railColor="#f1f5f9" format={p => <Text style={{ fontSize: 11, color: '#64748b' }}>{p}%</Text>} />
                    </Space>
                  </Col>
                </Row>
              </div>

              <Collapse ghost items={collapseItems} style={{ background: 'transparent' }} />
            </Card>
          );
        })}
      </Space>
    );
  };

  /* ── KPI CARDS ── */
  const kpiCards = [
    {
      title: 'Total Tasks', value: kpis.all,
      icon: <UnorderedListOutlined style={{ fontSize: 20, color: '#1976D2' }} />,
      color: '#1976D2', bg: '#E3F2FD',
    },
    {
      title: 'In Progress', value: kpis.status.inProgress,
      icon: <SyncOutlined spin={kpis.status.inProgress > 0} style={{ fontSize: 20, color: '#1976D2' }} />,
      color: '#1976D2', bg: '#E3F2FD',
    },
    {
      title: 'Pending Review', value: kpis.status.review,
      icon: <EyeOutlined style={{ fontSize: 20, color: '#9C27B0' }} />,
      color: '#9C27B0', bg: '#F3E5F5',
    },
    {
      title: 'Overdue', value: kpis.overdue,
      icon: <WarningOutlined style={{ fontSize: 20, color: '#D32F2F' }} />,
      color: '#D32F2F', bg: '#FFEBEE',
    },
    {
      title: 'Completed', value: kpis.status.completed,
      icon: <CheckCircleOutlined style={{ fontSize: 20, color: '#2E7D32' }} />,
      color: '#2E7D32', bg: '#E8F5E9',
    },
  ];

  /* ── RENDER ── */
  if (loading && allActions.length === 0 && objectives.length === 0) return <PageLoading message="Loading tasks..." subMessage="Fetching objectives, actions, and seller data" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', background: '#f8fafc' }}>
      {contextHolder}

      {/* ═══ PAGE HEADER ═══════════════════════════════════════════════ */}
      <div style={{
        background: 'white',
        padding: '0 24px',
        flexShrink: 0,
      }}>
        {/* Top bar */}
        <Row align="middle" justify="end" style={{ height: 48 }}>
          <Col>
            <Space size={12} align="center">
              {/* KPI quick numbers - clean inline */}
              <Space orientation="vertical" size={0} style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {kpis.all}
                </Text>
                <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
                  Total
                </Text>
              </Space>
              <Divider vertical style={{ margin: 0, height: 25 }} />
              <Space orientation="vertical" size={0} style={{ textAlign: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: 800, color: '#ffa200ff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {kpis.todo}
                </Text>
                <Text style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>
                  Outstanding
                </Text>
              </Space>
              {reviewCount > 0 && (
                <>
                  <Divider vertical style={{ margin: 0, height: 28 }} />
                  <Button
                    type="text"
                    size="small"
                    onClick={() => handleFilterClick('REVIEW')}
                    style={{
                      background: '#f5f3ff',
                      border: '1px solid #ddd6fe',
                      color: '#9C27B0',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 12,
                      height: 28,
                    }}
                    icon={<Badge count={reviewCount} size="small" color="#9C27B0"><EyeOutlined /></Badge>}
                  >
                    Review Queue
                  </Button>
                </>
              )}
              <Divider vertical style={{ margin: 0, height: 28 }} />
              <Button
                icon={<ThunderboltOutlined />}
                style={{
                  height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
                  fontWeight: 600, fontSize: 12,
                }}
                onClick={() => setIsAutoGenModalOpen(true)}
              >
                Auto-Generate
              </Button>
              <Button
                icon={<ThunderboltOutlined style={{ color: '#ED6C02' }} />}
                style={{
                  height: 32, borderRadius: 8, border: '1px solid #fde68a', background: '#fffbeb',
                  fontWeight: 600, fontSize: 12, color: '#92400e',
                }}
                onClick={handleCreateAction}
              >
                Quick Task
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                style={{
                  height: 32, borderRadius: 8, fontWeight: 600, fontSize: 12,
                  background: 'linear-gradient(135deg, #1976D2, #9C27B0)',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                }}
                onClick={handleCreateObjective}
              >
                New Project
              </Button>
            </Space>
          </Col>
        </Row>

        {/* View Tabs */}
        <Row align="middle" justify="space-between" style={{ borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', paddingTop: 7, paddingBottom: 7 }}>
          <Col>
            <Space size={12}>
              <Segmented
                value={viewMode}
                onChange={setViewMode}
                options={[
                  {
                    value: 'ALL_TASKS',
                    label: (
                      <Space size={6}>
                        <UnorderedListOutlined />
                        <span>All Tasks</span>
                      </Space>
                    ),
                  },
                  {
                    value: 'BY_SELLER',
                    label: (
                      <Space size={6}>
                        <ShopOutlined />
                        <span>By Seller</span>
                      </Space>
                    ),
                  },
                ]}
                style={{
                  background: '#f1f5f9',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              />
              <Divider vertical style={{ height: 20, margin: 0 }} />
            </Space>
          </Col>
          <Col>
            <Space size={8}>
              <Input
                prefix={<SearchOutlined style={{ color: '#94a3b8', fontSize: 13 }} />}
                suffix={searchQuery
                  ? <CloseOutlined style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer' }} onClick={() => handleSearchChange('')} />
                  : null
                }
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                style={{ width: 220, height: 32, borderRadius: 8, fontSize: 12 }}
              />
              <Select
                allowClear
                placeholder="All Statuses"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 130, height: 32 }}
                size="small"
              >
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <Option key={k} value={k}>
                    <Space size={6}>
                      <Badge dot color={v.color} />
                      {v.label}
                    </Space>
                  </Option>
                ))}
              </Select>
              <Select
                allowClear
                placeholder="All Priorities"
                value={priorityFilter}
                onChange={setPriorityFilter}
                style={{ width: 130, height: 32 }}
                size="small"
              >
                {Object.entries(PRIORITY_META).map(([k, v]) => (
                  <Option key={k} value={k}>
                    <Space size={6}>
                      {v.icon}
                      {v.label}
                    </Space>
                  </Option>
                ))}
              </Select>
              <Tooltip title="Refresh">
                <Button
                  icon={<ReloadOutlined />}
                  onClick={loadData}
                  loading={loading}
                  style={{ height: 32, width: 32, borderRadius: 8, border: '1px solid #e2e8f0', padding: 0 }}
                />
              </Tooltip>
              {isAdmin && (
                <Tooltip title="Admin: Delete all data">
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    style={{ height: 32, width: 32, borderRadius: 8, padding: 0 }}
                    onClick={() => {
                      Modal.confirm({
                        title: 'Delete all data?',
                        icon: <ExclamationCircleOutlined />,
                        content: 'This will permanently delete ALL objectives and tasks.',
                        okText: 'Delete All', okType: 'danger',
                        onOk: async () => { await db.deleteAllObjectives(); loadData(); },
                      });
                    }}
                  />
                </Tooltip>
              )}
            </Space>
          </Col>
        </Row>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 7, paddingBottom: 7, gap: 6, overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', borderTop: '1px solid #f1f5f9' }} className="filter-pills-row">
          {filterPills.map((pill, idx) => {
            if (pill === null) return (
              <Divider key={`div-${idx}`} orientation="vertical" style={{ height: 18, margin: '0 4px' }} />
            );
            const isActive = activeFilter === pill.type;
            return (
              <div
                key={pill.type}
                onClick={() => handleFilterClick(pill.type)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 10px',
                  height: 26,
                  borderRadius: 13,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  border: isActive ? `1.5px solid ${pill.color}` : '1px solid #e2e8f0',
                  background: isActive ? `${pill.color}18` : 'white',
                  color: isActive ? pill.color : '#64748b',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: pill.color, flexShrink: 0,
                  ...(isActive && pill.type === 'IN_PROGRESS' ? { animation: 'taskStatusPulse 1.5s infinite' } : {}),
                }} />
                <span>{pill.label}</span>
                <span style={{
                  fontWeight: 700, fontSize: 10, fontVariantNumeric: 'tabular-nums',
                  background: 'transparent',
                  marginLeft: 2,
                  color: isActive ? pill.color : '#94a3b8',
                }}>
                  {pill.count}
                </span>
              </div>
            );
          })}
          {(activeFilter !== 'ALL' || searchQuery || statusFilter || priorityFilter) && (
            <>
              <Divider vertical style={{ height: 18, margin: '0 4px' }} />
              <Button
                size="small"
                onClick={clearFilters}
                icon={<CloseOutlined />}
                style={{
                  height: 26, borderRadius: 13, fontSize: 11, fontWeight: 600,
                  background: '#D32F2F', color: 'white', border: 'none',
                  display: 'inline-flex', alignItems: 'center',
                }}
              >
                Clear
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ═══ CONTENT ═══════════════════════════════════════════════════ */}
      <Content style={{ padding: '16px 24px 0' }}>

        {/* KPI Strip */}
        <Row gutter={12} style={{ marginBottom: 14 }}>
          {kpiCards.map((card, i) => (
            <Col key={i} flex={1} style={{ minWidth: 0 }}>
              <Card
                styles={{ body: { padding: '12px 14px' } }}
                style={{
                  height: 76,
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  borderLeft: `3px solid ${card.color}`,
                  cursor: 'default',
                  transition: 'box-shadow 0.15s',
                }}
                hoverable
              >
                <Row align="middle" gutter={10} wrap={false}>
                  <Col flex="none">
                    <div style={{
                      width: 34, height: 34,
                      background: card.bg,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {card.icon}
                    </div>
                  </Col>
                  <Col>
                    <Text style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', display: 'block', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {card.value}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {card.title}
                    </Text>
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>

        {/* Overall Progress Bar */}
        <Card
          styles={{ body: { padding: '8px 16px' } }}
          style={{
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            marginBottom: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <Row align="middle" gutter={12}>
            <Col>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Overall Progress</Text>
            </Col>
            <Col flex={1}>
              <Progress
                percent={kpis.all === 0 ? 0 : Math.round((kpis.status.completed / kpis.all) * 100)}
                strokeColor={{ '0%': '#1976D2', '100%': '#2E7D32' }}
                railColor="#f1f5f9"
                size={6}
                showInfo={false}
                style={{ margin: 0 }}
              />
            </Col>
            <Col>
              <Text style={{ fontSize: 12, fontWeight: 700, color: '#1976D2', fontVariantNumeric: 'tabular-nums' }}>
                {kpis.all === 0 ? 0 : Math.round((kpis.status.completed / kpis.all) * 100)}% complete
              </Text>
            </Col>
          </Row>
        </Card>

        {/* Main View */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin
              indicator={<LoadingOutlined style={{ fontSize: 32, color: '#1976D2' }} spin />}
              tip={<Text style={{ color: '#64748b', fontSize: 13, marginTop: 12 }}>Loading tasks...</Text>}
            />
          </div>
        ) : viewMode === 'ALL_TASKS' ? (
          <Card
            styles={{ body: { padding: 0 } }}
            style={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fafbfc',
            }}>
              <Space>
                <UnorderedListOutlined style={{ color: '#1976D2' }} />
                <Text strong style={{ fontSize: 14, color: '#1e293b' }}>
                  All Tasks
                </Text>
                <Tag style={{ borderRadius: 12, background: '#eef2ff', color: '#1976D2', border: '1px solid #c7d2fe', fontSize: 11 }}>
                  {filteredActions.length} tasks
                </Tag>
              </Space>
              <Text style={{ fontSize: 12, color: '#94a3b8' }}>
                Showing {filteredActions.length} of {kpis.all} total
              </Text>
            </div>

            {filteredActions.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <Empty
                  description={
                    <Space orientation="vertical" size={8}>
                      <Text style={{ fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                        No tasks found
                      </Text>
                      <Text style={{ fontSize: 13, color: '#94a3b8' }}>
                        {searchQuery || activeFilter !== 'ALL' || statusFilter || priorityFilter
                          ? 'Try clearing your filters'
                          : 'Create your first task to get started'
                        }
                      </Text>
                    </Space>
                  }
                >
                  <Space>
                    {(searchQuery || activeFilter !== 'ALL' || statusFilter || priorityFilter) && (
                      <Button onClick={clearFilters} icon={<CloseOutlined />}>Clear Filters</Button>
                    )}
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleCreateAction}
                      style={{ background: '#1976D2', border: 'none' }}
                    >
                      New Task
                    </Button>
                  </Space>
                </Empty>
              </div>
            ) : (
              <Table
                dataSource={filteredActions.map((t, i) => ({ ...t, _tableKey: `all-${t._id || t.id}-${i}` }))}
                rowKey="_tableKey"
                columns={taskTableColumns}
                size="middle"
                scroll={{ x: 1100 }}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  showTotal: (total) => (
                    <Text style={{ fontSize: 12, color: '#94a3b8' }}>{total} tasks</Text>
                  ),
                  style: { padding: '12px 20px', margin: 0, borderTop: '1px solid #f1f5f9' },
                  size: 'small',
                }}
                rowClassName={(_, idx) => idx % 2 === 0 ? '' : 'task-row-stripe'}
                expandable={{
                  expandedRowRender: (task) => {
                    const id = task._id || task.id;
                    const hasForm = !!rejectionForms[id]?.open;
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    const wasRejected = Array.isArray(task.rejections) && task.rejections.length > 0;
                    const isInProgress = (task.status || '').toUpperCase() === 'IN_PROGRESS';

                    if (!hasForm && !hasSubtasks && !wasRejected) return null;

                    return (
                      <div style={{ padding: '0 16px 8px' }}>
                        {/* Show rejection history banner if task is back in progress after rejection */}
                        {wasRejected && isInProgress && (
                          <RejectedTaskBanner task={task} />
                        )}
                        {hasForm && (
                          <RejectionForm
                            onSubmit={(r) => submitRejection(id, r)}
                            onCancel={() => closeRejectionForm(id)}
                          />
                        )}
                        {hasSubtasks && (
                          <div style={{ padding: '4px 0 0 32px', background: '#f8fafc', borderRadius: 8 }}>
                            <Text style={{
                              fontSize: 11, color: '#94a3b8', fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: 0.5,
                              display: 'block', marginBottom: 6, padding: '6px 12px 0',
                            }}>
                              Subtasks ({task.subtasks.length})
                            </Text>
                            <Space orientation="vertical" size={4} style={{ width: '100%', padding: '0 12px 8px' }}>
                              {task.subtasks.map((sub, si) => (
                                <Row
                                  key={si}
                                  align="middle"
                                  gutter={12}
                                  style={{
                                    padding: '7px 10px',
                                    background: 'white',
                                    borderRadius: 8,
                                    border: '1px solid #f1f5f9',
                                  }}
                                >
                                  <Col>
                                    <Tag style={{
                                      fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                                      background: '#f0fdfa', color: '#0d9488',
                                      border: '1px solid #99f6e4', borderRadius: 4,
                                    }}>SUB</Tag>
                                  </Col>
                                  <Col flex={1}>
                                    <Text style={{ fontSize: 12, color: '#374151' }}>
                                      {sub.action || sub.title || sub.name || 'Untitled'}
                                    </Text>
                                  </Col>
                                  <Col>
                                    <WorkflowActionButton
                                      task={sub}
                                      currentUser={currentUser}
                                      onStart={openStartModal}
                                      onSubmit={openSubmitModal}
                                      onApprove={openReviewModal}
                                      onReject={openReviewModal}
                                      size="small"
                                      showStatus={true}
                                    />
                                  </Col>
                                </Row>
                              ))}
                            </Space>
                          </div>
                        )}
                      </div>
                    );
                  },
                  rowExpandable: (task) => {
                    const id = task._id || task.id;
                    return (task.subtasks && task.subtasks.length > 0) ||
                      !!rejectionForms[id]?.open;
                  },
                  expandIcon: ({ expanded, onExpand, record }) =>
                    (record.subtasks?.length > 0 || rejectionForms[record._id || record.id]?.open)
                      ? (
                        <Button
                          type="text"
                          size="small"
                          icon={expanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                          onClick={e => onExpand(record, e)}
                          style={{ width: 20, height: 20, padding: 0, color: '#94a3b8' }}
                        />
                      ) : null,
                }}
                onRow={(record) => ({
                  style: {
                    cursor: 'default',
                    transition: 'background 0.1s',
                    ...(rejectionForms[record._id || record.id]?.open
                      ? { background: '#fffbeb' }
                      : {}),
                  },
                })}
              />
            )}
          </Card>
        ) : (
          renderSellerView()
        )}
      </Content>

      {/* ═══ MODALS ═══════════════════════════════════════════════════ */}
      <Modal
        open={isObjectiveModalOpen}
        onCancel={() => { setIsObjectiveModalOpen(false); setEditingObjective(null); }}
        footer={null}
        closable={false}
        styles={{ body: { padding: 0 } }}
        width={800}
        centered
        destroyOnHidden
      >
        <ObjectiveManager
          objective={editingObjective}
          users={users}
          onClose={() => { setIsObjectiveModalOpen(false); setEditingObjective(null); }}
          onObjectiveCreated={() => { setIsObjectiveModalOpen(false); setEditingObjective(null); loadData(); }}
        />
      </Modal>

      <ActionModal
        isOpen={isActionModalOpen}
        onClose={() => { setIsActionModalOpen(false); setEditingAction(null); setSelectedKeyResultId(null); }}
        onSave={handleSaveAction}
        action={editingAction}
        currentUser={currentUser}
        asins={asins}
        users={users}
        sellers={sellers}
        initialKeyResultId={selectedKeyResultId}
      />





      <StartTaskModal
        isOpen={isStartModalOpen}
        task={startingTask}
        currentUser={currentUser}
        onClose={() => {
          setIsStartModalOpen(false);
          setStartingTask(null);
        }}
        onConfirm={handleConfirmStart}
      />

      <SubmitTaskModal
        isOpen={isSubmitModalOpen}
        task={submittingTask}
        currentUser={currentUser}
        onClose={() => {
          setIsSubmitModalOpen(false);
          setSubmittingTask(null);
        }}
        onSubmit={handleConfirmSubmit}
      />

      <ReviewDecisionModal
        isOpen={isReviewModalOpen}
        task={reviewingTask}
        currentUser={currentUser}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewingTask(null);
        }}
        onDecision={handleConfirmDecision}
      />

      <TaskDetailDrawer
        isOpen={isDetailDrawerOpen}
        action={viewingTask}
        currentUser={currentUser}
        onClose={() => { setIsDetailDrawerOpen(false); setViewingTask(null); }}
        onEdit={handleEdit}
        onStart={openStartModal}
        onSubmit={openSubmitModal}
        onReview={openReviewModal}
      />

      {/* ═══ AUTO-GENERATE MODAL ════════════════════════════════════ */}
      <Modal
        open={isAutoGenModalOpen}
        onCancel={() => setIsAutoGenModalOpen(false)}
        centered width={480}
        footer={null}
        destroyOnHidden
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #ED6C02, #E65100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Auto-Generate Tasks</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Scan ASINs and create optimization tasks automatically</div>
            </div>
          </div>
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8 }}>This will analyze your ASIN catalog and generate tasks for:</div>
            {['Titles — Missing SEO keywords or too short', 'Images — Below recommended count', 'A+ Content — Missing modules or low quality', 'LQS — Below quality threshold'].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: '#334155' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1976D2', flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setIsAutoGenModalOpen(false)} style={{ borderRadius: 8, fontSize: 12 }}>Cancel</Button>
            <Button type="primary" loading={autoGenerating} icon={<Zap size={13} />}
              onClick={handleAutoGenerate}
              style={{ borderRadius: 8, fontWeight: 600, fontSize: 12, background: '#ED6C02', borderColor: '#ED6C02' }}>
              {autoGenerating ? 'Generating...' : 'Generate Tasks'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ═══ GLOBAL STYLES ════════════════════════════════════════════ */}
      <style>{`
        .task-row-stripe td { background: #fafbfc !important; }
        .task-row-stripe:hover td { background: #f1f5f9 !important; }
        .ant-table-tbody > tr:hover > td { background: #f8faff !important; }
        .ant-table-thead > tr > th {
          background: #f8fafc !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.6px !important;
          color: #94a3b8 !important;
          border-bottom: 2px solid #e2e8f0 !important;
          padding: 10px 12px !important;
        }
        .ant-table-tbody > tr > td {
          padding: 10px 12px !important;
          border-bottom: 1px solid #f1f5f9 !important;
          vertical-align: middle !important;
        }
        .ant-table-expanded-row > td {
          padding: 0 !important;
          background: #f8fafc !important;
        }
        .ant-segmented-item-selected {
          background: white !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1) !important;
          font-weight: 700 !important;
          color: #1976D2 !important;
        }
        .ant-segmented-item {
          font-weight: 500 !important;
          font-size: 13px !important;
        }
        .ant-collapse-header {
          padding: 10px 16px !important;
          background: #fafbfc !important;
        }
        .ant-collapse-content-box {
          padding: 0 !important;
        }
        .ant-collapse-item {
          border-bottom: 1px solid #f1f5f9 !important;
        }
        .ant-progress-inner {
          border-radius: 4px !important;
        }
        .ant-progress-bg {
          border-radius: 4px !important;
        }
        .ant-tag {
          line-height: 1.4 !important;
        }
        .ant-select-selector {
          border-radius: 8px !important;
          font-size: 12px !important;
        }
        .ant-input-affix-wrapper {
          border-radius: 8px !important;
        }
        .ant-btn {
          font-weight: 500 !important;
        }
        .ant-pagination {
          margin: 0 !important;
        }
        .filter-pills-row::-webkit-scrollbar { display: none; }
        @keyframes taskStatusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes wfPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
};

export default TasksPage;