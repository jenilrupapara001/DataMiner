import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, LayoutGrid, TrendingUp, Search, Plus,
  Trash2, Check, ChevronDown, ChevronUp, Flag,
  Circle, CheckCircle2, AlertCircle, Zap,
  ListChecks, Gauge, Calendar, X, Send
} from 'lucide-react';
import {
  Button, Input, Select, Space, Badge, Tag, Progress,
  Typography, Popconfirm, Tooltip, Modal, Divider,
  Table, Switch, Card, Row, Col, message as antdMessage, Spin
} from 'antd';
import { db } from '../services/db';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const OKR_STATUS_COLORS = {
  'ON_TRACK': { color: '#059669', bg: '#ecfdf5', label: 'On Track' },
  'AT_RISK': { color: '#d97706', bg: '#fffbeb', label: 'At Risk' },
  'BEHIND': { color: '#dc2626', bg: '#fef2f2', label: 'Behind' },
};

const PRIORITY_COLORS = {
  'URGENT': { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  'HIGH': { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  'MEDIUM': { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  'LOW': { bg: '#f4f4f5', color: '#71717a', border: '#e4e4e7' }
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' }
];

const TASK_TYPES = [
  { value: 'TITLE_OPTIMIZATION', label: 'Title SEO', category: 'SEO & Content' },
  { value: 'A_PLUS_CONTENT', label: 'A+ Content', category: 'SEO & Content' },
  { value: 'PRICING_STRATEGY', label: 'Pricing', category: 'Sales & Marketing' },
  { value: 'INVENTORY_MANAGEMENT', label: 'Inventory', category: 'Operations' },
  { value: 'GENERAL_OPTIMIZATION', label: 'General', category: 'Operations' },
  { value: 'IMAGE_OPTIMIZATION', label: 'Images', category: 'SEO & Content' },
  { value: 'DESCRIPTION_OPTIMIZATION', label: 'Description', category: 'SEO & Content' },
  { value: 'REVIEW_MANAGEMENT', label: 'Reviews', category: 'Sales & Marketing' },
  { value: 'PPC_OPTIMIZATION', label: 'PPC Ads', category: 'Advertising' },
  { value: 'COMPLIANCE', label: 'Compliance', category: 'Compliance' }
];

const TASK_CATEGORIES = ['SEO & Content', 'Sales & Marketing', 'Operations', 'Advertising', 'Compliance'];

const PriorityTag = ({ priority }) => {
  const c = PRIORITY_COLORS[priority] || PRIORITY_COLORS.MEDIUM;
  return (
    <span className="badge" style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      textTransform: 'uppercase', letterSpacing: '0.03em'
    }}>
      {priority}
    </span>
  );
};

const StatusTag = ({ status }) => {
  const map = {
    PENDING: { bg: '#f4f4f5', color: '#71717a', border: '#e4e4e7' },
    IN_PROGRESS: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
    REVIEW: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    COMPLETED: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
    CANCELLED: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  };
  const c = map[status] || map.PENDING;
  return (
    <span className="badge" style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
      textTransform: 'uppercase', letterSpacing: '0.03em'
    }}>
      {status?.replace('_', ' ')}
    </span>
  );
};

const ActionsPage = () => {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = antdMessage.useMessage();

  const [activeView, setActiveView] = useState('tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showObjectiveModal, setShowObjectiveModal] = useState(false);
  const [showKeyResultModal, setShowKeyResultModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAutoGenerateModal, setShowAutoGenerateModal] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState(null);
  const [expandedObjectives, setExpandedObjectives] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);

  const getTaskCategory = (type) => TASK_TYPES.find(t => t.value === type)?.category || 'Operations';

  const [objectiveForm, setObjectiveForm] = useState({
    title: '', description: '', type: 'MONTHLY',
    startDate: new Date(), endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    owner: ''
  });

  const [keyResultForm, setKeyResultForm] = useState({
    title: '', targetValue: '', currentValue: 0, unit: '%', metric: 'GMS', deadline: new Date()
  });

  const [taskForm, setTaskForm] = useState({
    title: '', description: '', type: 'GENERAL_OPTIMIZATION',
    priority: 'MEDIUM', objectiveId: '', keyResultId: ''
  });

  const { data: objectivesData, isLoading: objectivesLoading, refetch: refetchObjectives } = useQuery({
    queryKey: ['objectives'],
    queryFn: async () => {
      try {
        const res = await db.getObjectives();
        return Array.isArray(res) ? res : (res?.data || []);
      } catch { return []; }
    }
  });

  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['actions'],
    queryFn: async () => {
      try {
        const res = await db.getActions();
        return Array.isArray(res) ? res : (res?.data || []);
      } catch { return []; }
    }
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const res = await db.request('/users', {}, []);
        if (Array.isArray(res)) return res;
        if (res?.data && Array.isArray(res.data)) return res.data;
        if (res?.success && Array.isArray(res.data)) return res.data;
        return [];
      } catch { return []; }
    }
  });

  const objectives = useMemo(() => {
    const data = objectivesData || [];
    return searchQuery ? data.filter(o =>
      o.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) : data;
  }, [objectivesData, searchQuery]);

  const tasks = useMemo(() => {
    let taskList = tasksData || [];
    if (filterStatus) taskList = taskList.filter(t => t.status === filterStatus);
    if (filterPriority) taskList = taskList.filter(t => t.priority === filterPriority);
    if (filterCategory) taskList = taskList.filter(t => getTaskCategory(t.type) === filterCategory);
    if (searchQuery) taskList = taskList.filter(t =>
      t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return taskList;
  }, [tasksData, filterStatus, filterPriority, filterCategory, searchQuery]);

  const tasksByCategory = useMemo(() => {
    const groups = {};
    TASK_CATEGORIES.forEach(cat => { groups[cat] = []; });
    tasks.forEach(task => {
      const cat = getTaskCategory(task.type);
      (groups[cat] || groups['Operations']).push(task);
    });
    return groups;
  }, [tasks]);

  const toggleObjectiveExpand = (id) => setExpandedObjectives(prev => ({ ...prev, [id]: !prev[id] }));

  const getObjectiveProgress = (objective) => {
    const krs = objective.keyResults || [];
    if (krs.length === 0) return 0;
    const total = krs.reduce((sum, kr) => {
      const target = parseFloat(kr.targetValue) || 1;
      const current = parseFloat(kr.currentValue) || 0;
      return sum + Math.min(100, (current / target) * 100);
    }, 0);
    return Math.round(total / krs.length);
  };

  const handleCreateObjective = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await db.createObjective({
        title: objectiveForm.title,
        description: objectiveForm.description,
        type: objectiveForm.type,
        startDate: objectiveForm.startDate.toISOString(),
        endDate: objectiveForm.endDate.toISOString(),
        owners: objectiveForm.owner ? [objectiveForm.owner] : []
      });
      if (res?.success || res?._id) {
        await refetchObjectives();
        setShowObjectiveModal(false);
        setObjectiveForm({ title: '', description: '', type: 'MONTHLY', startDate: new Date(), endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), owner: '' });
        messageApi.success('Objective created');
      }
    } catch (e) { messageApi.error('Failed to create objective'); }
    finally { setIsSubmitting(false); }
  };

  const handleCreateKeyResult = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await db.createKeyResult({
        title: keyResultForm.title,
        targetValue: parseFloat(keyResultForm.targetValue) || 0,
        currentValue: 0,
        unit: keyResultForm.unit,
        metric: keyResultForm.metric,
        objectiveId: selectedObjective?._id,
        startDate: new Date().toISOString(),
        deadline: keyResultForm.deadline?.toISOString ? keyResultForm.deadline.toISOString() : new Date(keyResultForm.deadline).toISOString()
      });
      if (res?.success || res?._id) {
        await refetchObjectives();
        setShowKeyResultModal(false);
        setKeyResultForm({ title: '', targetValue: '', currentValue: 0, unit: '%', metric: 'GMS', deadline: new Date() });
        messageApi.success('Key Result added');
      }
    } catch (e) { messageApi.error('Failed to add key result'); }
    finally { setIsSubmitting(false); }
  };

  const handleUpdateKeyResult = async (krId, newValue) => {
    try {
      const result = await db.updateKeyResult(krId, { currentValue: parseFloat(newValue) });
      if (result?.success || result?._id) { await refetchObjectives(); messageApi.success('Progress updated'); }
    } catch (e) { messageApi.error('Failed to update'); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const user = db.getUser();
      const res = await db.createAction({
        title: taskForm.title,
        description: taskForm.description,
        type: taskForm.type,
        priority: taskForm.priority,
        status: 'PENDING',
        createdBy: user?._id || user?.id,
        objectiveId: taskForm.objectiveId || null,
        keyResultId: taskForm.keyResultId || null
      });
      if (res?.success || res?._id) {
        await refetchTasks();
        setShowTaskModal(false);
        setTaskForm({ title: '', description: '', type: 'GENERAL_OPTIMIZATION', priority: 'MEDIUM', objectiveId: '', keyResultId: '' });
        messageApi.success('Task created');
      }
    } catch (e) { messageApi.error('Failed to create task'); }
    finally { setIsSubmitting(false); }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const result = await db.updateAction(taskId, { status: newStatus });
      if (!result?.success) { messageApi.error(result?.message || 'Failed to update'); return; }
      messageApi.success('Status updated');
      await refetchTasks();
    } catch (e) { messageApi.error('Failed to update status'); }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const result = await db.deleteAction(taskId);
      if (!result?.success) { messageApi.error(result?.message || 'Failed to delete'); return; }
      messageApi.success('Task deleted');
      await refetchTasks();
    } catch (e) { messageApi.error('Failed to delete task'); }
  };

  const handleAutoGenerateTasks = async () => {
    setAutoGenerating(true);
    try {
      const result = await db.generateBulkActions();
      if (result?.success || result?.count > 0) {
        await refetchTasks();
        setShowAutoGenerateModal(false);
        messageApi.success(`Generated ${result?.count || 0} tasks`);
      }
    } catch (e) { messageApi.error('Failed to auto-generate'); }
    finally { setAutoGenerating(false); }
  };

  const stats = useMemo(() => {
    const taskList = tasksData || [];
    return {
      total: taskList.length,
      pending: taskList.filter(t => t.status === 'PENDING').length,
      inProgress: taskList.filter(t => t.status === 'IN_PROGRESS').length,
      completed: taskList.filter(t => t.status === 'COMPLETED').length,
      objectivesTotal: objectives?.length || 0,
      objectivesOnTrack: objectives?.filter(o => getObjectiveProgress(o) >= 70).length || 0
    };
  }, [tasksData, objectives]);

  if (objectivesLoading || tasksLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ background: '#fff', minHeight: 'calc(100vh - 60px)' }}>
      {contextHolder}

      {/* Page Header */}
      <div style={{ padding: '20px 28px 16px', borderBottom: '1px solid #f4f4f7' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#18181b', margin: 0 }}>Workflows & Tasks</h2>
            <p style={{ fontSize: 12, color: '#71717a', margin: 0, marginTop: 4 }}>Manage objectives, track tasks, and automate operations</p>
          </div>
          <Space size={8}>
            <Button icon={<RefreshCw size={13} />} onClick={() => { refetchObjectives(); refetchTasks(); }}
              style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>Refresh</Button>
            <Button icon={<Zap size={13} />} onClick={() => setShowAutoGenerateModal(true)}
              style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32, color: '#d97706', borderColor: '#d97706' }}>Auto-Generate</Button>
            <Button type="primary" icon={<Plus size={13} />} onClick={() => setShowTaskModal(true)}
              style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>New Task</Button>
          </Space>
        </div>
      </div>

      <div style={{ padding: '16px 28px' }}>
        {/* KPI Strip */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#f4f4f5', borderRadius: 8, border: '1px solid #e4e4e7' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ListChecks size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Tasks</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#18181b' }}>{stats.total}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gauge size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>In Progress</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#92400e' }}>{stats.inProgress}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #d1fae5' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#065f46' }}>{stats.completed}</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flag size={13} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Objectives</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#1e40af' }}>{stats.objectivesTotal}</div>
            </div>
          </div>
        </div>

        {/* View Tabs + Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ display: 'flex', background: '#f4f4f5', borderRadius: 8, padding: 2 }}>
            {[
              { key: 'tasks', label: 'Tasks', icon: <ListChecks size={13} /> },
              { key: 'okr', label: 'OKR Board', icon: <Flag size={13} /> },
              { key: 'board', label: 'Kanban', icon: <LayoutGrid size={13} /> },
              { key: 'auto', label: 'Auto-Tasks', icon: <Zap size={13} /> },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveView(tab.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600,
                background: activeView === tab.key ? '#18181b' : 'transparent',
                color: activeView === tab.key ? '#fff' : '#71717a',
                cursor: 'pointer', transition: 'all 0.15s'
              }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <Input prefix={<Search size={12} style={{ color: '#a1a1aa' }} />}
            placeholder="Search..." allowClear value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            size="small" style={{ width: 200, borderRadius: 8 }} />

          {activeView === 'tasks' && (
            <>
              <Select size="small" value={filterStatus || undefined} placeholder="Status" allowClear
                onChange={v => setFilterStatus(v || '')} style={{ width: 120, borderRadius: 8 }}
                options={STATUS_OPTIONS.filter(o => o.value).map(o => ({ value: o.value, label: o.label }))} />
              <Select size="small" value={filterPriority || undefined} placeholder="Priority" allowClear
                onChange={v => setFilterPriority(v || '')} style={{ width: 120, borderRadius: 8 }}
                options={[{ value: 'URGENT', label: 'Urgent' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'LOW', label: 'Low' }]} />
            </>
          )}

          {activeView !== 'okr' && (
            <Button size="small" type="primary" icon={<Plus size={13} />}
              onClick={() => activeView === 'auto' ? setShowAutoGenerateModal(true) : setShowTaskModal(true)}
              style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>
              {activeView === 'auto' ? 'Generate' : 'New Task'}
            </Button>
          )}
        </div>

        {/* ================= VIEW: TASKS TABLE ================= */}
        {activeView === 'tasks' && (
          <div style={{ border: '1px solid #e4e4e7', borderRadius: 12, overflow: 'hidden' }}>
            <Table
              dataSource={tasks.map(t => ({ ...t, key: t._id || t.id }))}
              rowKey={(r) => r._id || r.id}
              pagination={{ pageSize: 15, showSizeChanger: false, size: 'small', showTotal: (t) => `${t} tasks` }}
              size="small"
              scroll={{ x: 900 }}
              columns={[
                { title: '#', key: 'idx', width: 50, align: 'center', render: (_, __, i) => <span style={{ fontSize: 11, color: '#a1a1aa' }}>{i + 1}</span> },
                { title: 'Task', key: 'task', render: (_, r) => (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#18181b' }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#71717a', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description || '—'}</div>
                  </div>
                )},
                { title: 'Priority', dataIndex: 'priority', key: 'priority', width: 90, render: (p) => <PriorityTag priority={p} /> },
                { title: 'Type', dataIndex: 'type', key: 'type', width: 120, render: (t) => {
                  const cat = getTaskCategory(t);
                  return <Tag style={{ fontSize: 9, borderRadius: 4, fontWeight: 600, margin: 0 }}>{TASK_TYPES.find(x => x.value === t)?.label || t}</Tag>;
                }},
                { title: 'Status', key: 'status', width: 140, render: (_, r) => (
                  <Select size="small" value={r.status} style={{ width: 120, borderRadius: 6 }}
                    onChange={v => handleStatusChange(r._id || r.id, v)}
                    options={STATUS_OPTIONS.filter(o => o.value).map(o => ({ value: o.value, label: o.label }))} />
                )},
                { title: 'Due', dataIndex: 'dueDate', key: 'dueDate', width: 100, render: (d) => d
                  ? <span style={{ fontSize: 11, color: '#71717a' }}><Calendar size={11} style={{ marginRight: 3 }} />{new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  : <span style={{ fontSize: 11, color: '#d4d4d8' }}>—</span>
                },
                { title: '', key: 'action', width: 50, align: 'right', render: (_, r) => (
                  <Popconfirm title="Delete?" onConfirm={() => handleDeleteTask(r._id || r.id)} okText="Delete" okButtonProps={{ danger: true }}>
                    <Button type="text" danger size="small" icon={<Trash2 size={13} />} />
                  </Popconfirm>
                )},
              ]}
            />
          </div>
        )}

        {/* ================= VIEW: OKR BOARD ================= */}
        {activeView === 'okr' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#18181b' }}>Objectives & Key Results</span>
              <Button size="small" icon={<Plus size={13} />} onClick={() => setShowObjectiveModal(true)}
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Add Objective</Button>
            </div>

            {objectives.length === 0 ? (
              <div style={{ border: '1px dashed #e4e4e7', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
                <Flag size={36} style={{ color: '#d4d4d8', marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#18181b', marginBottom: 4 }}>No Objectives Yet</div>
                <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 16 }}>Create objectives to define strategic goals for your team</div>
                <Button type="primary" icon={<Plus size={13} />} onClick={() => setShowObjectiveModal(true)} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Create First Objective</Button>
              </div>
            ) : objectives.map((obj, idx) => {
              const progress = getObjectiveProgress(obj);
              const status = progress >= 70 ? 'ON_TRACK' : progress >= 30 ? 'AT_RISK' : 'BEHIND';
              const statusStyle = OKR_STATUS_COLORS[status];
              const isExpanded = expandedObjectives[obj._id];

              return (
                <div key={obj._id || idx} style={{
                  border: '1px solid #e4e4e7', borderRadius: 12, marginBottom: 10,
                  overflow: 'hidden', background: '#fff'
                }}>
                  <div onClick={() => toggleObjectiveExpand(obj._id)}
                    style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: statusStyle.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Gauge size={16} style={{ color: statusStyle.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>{obj.title}</div>
                        <div style={{ fontSize: 11, color: '#71717a', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          {obj.description && <span>{obj.description}</span>}
                          {obj.startDate && obj.endDate && (
                            <Tag style={{ fontSize: 9, borderRadius: 4, padding: '1px 6px', margin: 0 }}>
                              {new Date(obj.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} — {new Date(obj.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </Tag>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right', minWidth: 60 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: statusStyle.color }}>{progress}%</div>
                        <div style={{ fontSize: 9, color: '#a1a1aa', fontWeight: 700 }}>PROGRESS</div>
                      </div>
                      <span className="badge" style={{
                        background: statusStyle.bg, color: statusStyle.color,
                        border: `1px solid ${statusStyle.border || statusStyle.bg}`,
                        fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                        textTransform: 'uppercase'
                      }}>{statusStyle.label}</span>
                      {isExpanded ? <ChevronUp size={14} style={{ color: '#a1a1aa' }} /> : <ChevronDown size={14} style={{ color: '#a1a1aa' }} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '16px 18px', background: '#fafafa', borderTop: '1px solid #f4f4f5' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Results</span>
                        <Button size="small" type="dashed" icon={<Plus size={12} />}
                          onClick={(e) => { e.stopPropagation(); setSelectedObjective(obj); setShowKeyResultModal(true); }}
                          style={{ borderRadius: 6, fontSize: 10 }}>Add KR</Button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                        {(obj.keyResults || []).map((kr, krIdx) => {
                          const krProgress = kr.targetValue ? Math.min(100, ((kr.currentValue || 0) / kr.targetValue) * 100) : 0;
                          const pColor = krProgress >= 70 ? '#059669' : krProgress >= 30 ? '#d97706' : '#dc2626';
                          return (
                            <div key={krIdx} style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, padding: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{kr.title}</span>
                                <Tag style={{ fontSize: 8, borderRadius: 3, padding: '1px 5px', margin: 0, fontWeight: 700, background: '#f4f4f5', color: '#71717a', border: 'none' }}>{kr.metric}</Tag>
                              </div>
                              <Progress percent={Math.round(krProgress)} strokeColor={pColor} size="small" style={{ marginBottom: 8 }} />
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Input size="small" type="number" addonBefore="Now" style={{ width: 120, borderRadius: 6 }}
                                  defaultValue={kr.currentValue || 0}
                                  onBlur={(e) => handleUpdateKeyResult(kr._id, e.target.value)} />
                                <span style={{ fontSize: 11, color: '#71717a' }}>Target: <b style={{ color: '#18181b' }}>{kr.targetValue} {kr.unit}</b></span>
                              </div>
                            </div>
                          );
                        })}
                        {(obj.keyResults || []).length === 0 && (
                          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 16, border: '1px dashed #e4e4e7', borderRadius: 8, color: '#a1a1aa', fontSize: 11 }}>No key results yet</div>
                        )}
                      </div>

                      <div style={{ fontSize: 10, fontWeight: 700, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Linked Tasks</div>
                      <div style={{ background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, overflow: 'hidden' }}>
                        <Table dataSource={tasks.filter(t => t.objectiveId === (obj._id || obj.id)).slice(0, 5)}
                          columns={[
                            { title: 'Task', dataIndex: 'title', key: 'title', render: (t) => <span style={{ fontSize: 11, fontWeight: 600 }}>{t}</span> },
                            { title: 'Priority', dataIndex: 'priority', key: 'priority', width: 80, render: (p) => <PriorityTag priority={p} /> },
                            { title: 'Status', dataIndex: 'status', key: 'status', width: 100, render: (s) => <StatusTag status={s} /> },
                          ]}
                          pagination={false} size="small" rowKey="_id"
                          locale={{ emptyText: <span style={{ fontSize: 11, color: '#a1a1aa' }}>No linked tasks</span> }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ================= VIEW: KANBAN ================= */}
        {activeView === 'board' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {['PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map(status => {
              const laneTasks = tasks.filter(t => t.status === status);
              const colorMap = { PENDING: '#71717a', IN_PROGRESS: '#d97706', REVIEW: '#2563eb', COMPLETED: '#059669' };
              return (
                <div key={status} style={{ background: '#fafafa', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 6px', borderBottom: '1px solid #e4e4e7' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#18181b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {status.replace('_', ' ')}
                    </span>
                    <span className="badge" style={{ background: colorMap[status], color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>
                      {laneTasks.length}
                    </span>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100vh - 300px)' }}>
                    {laneTasks.map(task => (
                      <div key={task._id || task.id} style={{
                        background: '#fff', border: '1px solid #e4e4e7', borderRadius: 8, padding: 12,
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#18181b', marginBottom: 4 }}>{task.title}</div>
                        <div style={{ fontSize: 11, color: '#71717a', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description || '—'}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <PriorityTag priority={task.priority} />
                          <Tooltip title={status === 'COMPLETED' ? 'Reopen' : 'Mark complete'}>
                            <Button type="text" size="small"
                              icon={status === 'COMPLETED' ? <CheckCircle2 size={14} style={{ color: '#059669' }} /> : <Circle size={14} style={{ color: '#d4d4d8' }} />}
                              onClick={() => handleStatusChange(task._id || task.id, status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')} />
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                    {laneTasks.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '20px 8px', color: '#d4d4d8', fontSize: 11, border: '1px dashed #e4e4e7', borderRadius: 8 }}>No tasks</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= VIEW: AUTO-TASKS ================= */}
        {activeView === 'auto' && (
          <div>
            {tasks.length === 0 ? (
              <div style={{ border: '1px dashed #e4e4e7', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
                <Zap size={36} style={{ color: '#d97706', marginBottom: 12 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#18181b', marginBottom: 4 }}>No Tasks Generated</div>
                <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 16 }}>Auto-generate tasks from ASIN analysis</div>
                <Button type="primary" icon={<Zap size={13} />} onClick={() => setShowAutoGenerateModal(true)}
                  style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, background: '#d97706', borderColor: '#d97706' }}>Generate Tasks</Button>
              </div>
            ) : TASK_CATEGORIES.map(category => {
              const catTasks = tasksByCategory[category] || [];
              if (catTasks.length === 0) return null;
              return (
                <div key={category} style={{ border: '1px solid #e4e4e7', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: '#fafafa', borderBottom: '1px solid #e4e4e7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#18181b' }}>{category}</span>
                    <span className="badge" style={{ background: '#f4f4f5', color: '#71717a', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10 }}>{catTasks.length}</span>
                  </div>
                  <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {catTasks.map(task => (
                      <div key={task._id || task.id} style={{ border: '1px solid #f4f4f5', borderRadius: 8, padding: 12, background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#18181b' }}>{task.title}</div>
                            <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{task.description || '—'}</div>
                          </div>
                          <PriorityTag priority={task.priority} />
                        </div>
                        <Divider style={{ margin: '6px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <StatusTag status={task.status} />
                          <Space size={4}>
                            <Button size="small" type="link" onClick={() => handleStatusChange(task._id || task.id, task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                              style={{ fontSize: 11, fontWeight: 600 }}>
                              {task.status === 'COMPLETED' ? 'Reopen' : 'Complete'}
                            </Button>
                            <Popconfirm title="Delete?" onConfirm={() => handleDeleteTask(task._id || task.id)} okButtonProps={{ danger: true }}>
                              <Button type="text" danger size="small" icon={<Trash2 size={12} />} />
                            </Popconfirm>
                          </Space>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* Objective Modal */}
      <Modal open={showObjectiveModal} onCancel={() => setShowObjectiveModal(false)} centered destroyOnHidden width={520}
        title={<span style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>Create Objective</span>}
        footer={null}>
        <form onSubmit={handleCreateObjective} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Title *</div>
            <Input size="small" placeholder="What is the goal?" required value={objectiveForm.title} onChange={e => setObjectiveForm({ ...objectiveForm, title: e.target.value })} style={{ borderRadius: 8 }} /></div>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Description</div>
            <TextArea size="small" rows={3} placeholder="Describe the objective..." value={objectiveForm.description} onChange={e => setObjectiveForm({ ...objectiveForm, description: e.target.value })} style={{ borderRadius: 8 }} /></div>
          <Row gutter={12}>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Period</div>
              <Select size="small" value={objectiveForm.type} style={{ width: '100%', borderRadius: 8 }}
                onChange={v => setObjectiveForm({ ...objectiveForm, type: v })}
                options={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'QUARTERLY', label: 'Quarterly' }, { value: 'WEEKLY', label: 'Weekly' }]} /></Col>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Owner</div>
              <Select size="small" placeholder="Select" style={{ width: '100%', borderRadius: 8 }}
                value={objectiveForm.owner || undefined}
                onChange={v => setObjectiveForm({ ...objectiveForm, owner: v })}
                options={(Array.isArray(usersData) ? usersData : []).map(u => ({ value: u._id || u.id, label: `${u.firstName || ''} ${u.lastName || ''}` || u.email }))} /></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Start Date</div>
              <Input size="small" type="date" value={objectiveForm.startDate ? new Date(objectiveForm.startDate).toISOString().split('T')[0] : ''} onChange={e => setObjectiveForm({ ...objectiveForm, startDate: new Date(e.target.value) })} style={{ borderRadius: 8 }} /></Col>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>End Date</div>
              <Input size="small" type="date" value={objectiveForm.endDate ? new Date(objectiveForm.endDate).toISOString().split('T')[0] : ''} onChange={e => setObjectiveForm({ ...objectiveForm, endDate: new Date(e.target.value) })} style={{ borderRadius: 8 }} /></Col>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button onClick={() => setShowObjectiveModal(false)} style={{ borderRadius: 8, fontSize: 11 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting} icon={<Check size={13} />}
              style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Create</Button>
          </div>
        </form>
      </Modal>

      {/* Key Result Modal */}
      <Modal open={showKeyResultModal && !!selectedObjective} onCancel={() => setShowKeyResultModal(false)} centered destroyOnHidden width={520}
        title={<div><span style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>Add Key Result</span>
          <div style={{ fontSize: 11, color: '#a1a1aa', marginTop: 2 }}>For: {selectedObjective?.title}</div></div>}
        footer={null}>
        <form onSubmit={handleCreateKeyResult} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Title *</div>
            <Input size="small" placeholder="e.g. Scale GMS by 15%" required value={keyResultForm.title} onChange={e => setKeyResultForm({ ...keyResultForm, title: e.target.value })} style={{ borderRadius: 8 }} /></div>
          <Row gutter={12}>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Target *</div>
              <Input size="small" type="number" placeholder="150" required value={keyResultForm.targetValue} onChange={e => setKeyResultForm({ ...keyResultForm, targetValue: e.target.value })} style={{ borderRadius: 8 }} /></Col>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Unit</div>
              <Select size="small" value={keyResultForm.unit} style={{ width: '100%', borderRadius: 8 }}
                onChange={v => setKeyResultForm({ ...keyResultForm, unit: v })}
                options={[{ value: '%', label: '% (Percentage)' }, { value: '₹', label: '₹ (Revenue)' }, { value: '#', label: '# (Count)' }]} /></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Metric</div>
              <Select size="small" value={keyResultForm.metric} style={{ width: '100%', borderRadius: 8 }}
                onChange={v => setKeyResultForm({ ...keyResultForm, metric: v })}
                options={[{ value: 'GMS', label: 'GMS Revenue' }, { value: 'UNITS', label: 'Units Sold' }, { value: 'ROAS', label: 'ROAS' }, { value: 'ACOS', label: 'ACOS' }, { value: 'RATING', label: 'Rating' }, { value: 'REVIEW', label: 'Reviews' }, { value: 'BSR', label: 'BSR Ranking' }]} /></Col>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Deadline</div>
              <Input size="small" type="date" value={keyResultForm.deadline ? new Date(keyResultForm.deadline).toISOString().split('T')[0] : ''} onChange={e => setKeyResultForm({ ...keyResultForm, deadline: new Date(e.target.value) })} style={{ borderRadius: 8 }} /></Col>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button onClick={() => setShowKeyResultModal(false)} style={{ borderRadius: 8, fontSize: 11 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Add KR</Button>
          </div>
        </form>
      </Modal>

      {/* Task Modal */}
      <Modal open={showTaskModal} onCancel={() => setShowTaskModal(false)} centered destroyOnHidden width={520}
        title={<span style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>Create Task</span>}
        footer={null}>
        <form onSubmit={handleCreateTask} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Title *</div>
            <Input size="small" placeholder="What needs to be done?" required value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} style={{ borderRadius: 8 }} /></div>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Description</div>
            <TextArea size="small" rows={3} placeholder="Action items / steps..." value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} style={{ borderRadius: 8 }} /></div>
          <Row gutter={12}>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Type</div>
              <Select size="small" value={taskForm.type} style={{ width: '100%', borderRadius: 8 }}
                onChange={v => setTaskForm({ ...taskForm, type: v })}
                options={TASK_TYPES.map(t => ({ value: t.value, label: t.label }))} /></Col>
            <Col span={12}><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Priority</div>
              <Select size="small" value={taskForm.priority} style={{ width: '100%', borderRadius: 8 }}
                onChange={v => setTaskForm({ ...taskForm, priority: v })}
                options={[{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }, { value: 'URGENT', label: 'Urgent' }]} /></Col>
          </Row>
          <div><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Link to Objective</div>
            <Select size="small" placeholder="Optional" allowClear style={{ width: '100%', borderRadius: 8 }}
              value={taskForm.objectiveId || undefined}
              onChange={v => setTaskForm({ ...taskForm, objectiveId: v || '', keyResultId: '' })}
              options={[{ label: 'None', value: '' }, ...(objectives || []).map(o => ({ label: o.title, value: o._id || o.id }))] } /></div>
          {taskForm.objectiveId && (
            <div><div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', marginBottom: 4 }}>Key Result</div>
              <Select size="small" placeholder="Optional" allowClear style={{ width: '100%', borderRadius: 8 }}
                value={taskForm.keyResultId || undefined}
                onChange={v => setTaskForm({ ...taskForm, keyResultId: v || '' })}
                options={[{ label: 'Any', value: '' }, ...(objectives?.find(o => (o._id || o.id) === taskForm.objectiveId)?.keyResults?.map(kr => ({ label: kr.title, value: kr._id || kr.id })) || [])]} /></div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <Button onClick={() => setShowTaskModal(false)} style={{ borderRadius: 8, fontSize: 11 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Create Task</Button>
          </div>
        </form>
      </Modal>

      {/* Auto-Generate Modal */}
      <Modal open={showAutoGenerateModal} onCancel={() => setShowAutoGenerateModal(false)} centered width={480}
        title={<span style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>Auto-Generate Tasks</span>}
        footer={null}>
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: '#71717a', marginBottom: 12 }}>This will analyze your ASIN catalog and generate optimization tasks for:</p>
          {['Titles — Missing SEO keywords', 'Images — Underdeveloped galleries', 'A+ Content — Missing modules', 'LQS — Below quality threshold'].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: '#18181b' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
              {item}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Button onClick={() => setShowAutoGenerateModal(false)} style={{ borderRadius: 8, fontSize: 11 }}>Cancel</Button>
            <Button type="primary" loading={autoGenerating} icon={<Zap size={13} />}
              onClick={handleAutoGenerateTasks}
              style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, background: '#d97706', borderColor: '#d97706' }}>
              {autoGenerating ? 'Generating...' : 'Generate Tasks'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ActionsPage;
