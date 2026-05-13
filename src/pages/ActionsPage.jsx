import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, LayoutGrid, TrendingUp, Search, Plus,
  Trash2, Loader2, Check, ChevronDown,
  ChevronUp, Flag, Calendar, 
  Circle, CheckCircle2, AlertCircle, Zap,
  ListChecks, Gauge
} from 'lucide-react';
import { 
  Layout, Card, Row, Col, Statistic, Button, Space, Table, Input, 
  Badge, Alert, Tag, Progress, Typography, Popconfirm, 
  Tooltip, Select, Segmented, Modal, Divider, message as antdMessage 
} from 'antd';
import { db } from '../services/db';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const OKR_STATUS_COLORS = {
  'ON_TRACK': { color: '#16a34a', bg: '#dcfce7', label: 'On Track' },
  'AT_RISK': { color: '#d97706', bg: '#fef3c7', label: 'At Risk' },
  'BEHIND': { color: '#dc2626', bg: '#fee2e2', label: 'Behind' },
  'COMPLETED': { color: '#2563eb', bg: '#dbeafe', label: 'Completed' }
};

const PRIORITY_COLORS = {
  'URGENT': { bg: '#fee2e2', color: '#ef4444' },
  'HIGH': { bg: '#fef3c7', color: '#f59e0b' },
  'MEDIUM': { bg: '#dbeafe', color: '#3b82f6' },
  'LOW': { bg: '#f3f4f6', color: '#6b7280' }
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
  { value: 'INVENTORY_MANAGEMENT', label: 'Inventory', category: 'Operations & General' },
  { value: 'GENERAL_OPTIMIZATION', label: 'General', category: 'Operations & General' },
  { value: 'IMAGE_OPTIMIZATION', label: 'Images', category: 'SEO & Content' },
  { value: 'DESCRIPTION_OPTIMIZATION', label: 'Description', category: 'SEO & Content' },
  { value: 'REVIEW_MANAGEMENT', label: 'Reviews', category: 'Sales & Marketing' },
  { value: 'PPC_OPTIMIZATION', label: 'PPC Ads', category: 'PPC & Advertising' },
  { value: 'COMPLIANCE', label: 'Compliance', category: 'Compliance & Legal' }
];

const TASK_CATEGORIES = ['SEO & Content', 'Sales & Marketing', 'Operations & General', 'PPC & Advertising', 'Compliance & Legal'];

const ActionsPage = () => {
  const queryClient = useQueryClient();
  const [messageApi, contextHolder] = antdMessage.useMessage();
  const [activeView, setActiveView] = useState('okr'); // 'okr' | 'tasks' | 'board' | 'auto'
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

  // Helper function to get category from task type
  const getTaskCategory = (type) => {
    const taskType = TASK_TYPES.find(t => t.value === type);
    return taskType?.category || 'Operations & General';
  };

  // Form states
  const [objectiveForm, setObjectiveForm] = useState({
    title: '',
    description: '',
    type: 'MONTHLY',
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
    owner: ''
  });

  const [keyResultForm, setKeyResultForm] = useState({
    title: '',
    targetValue: '',
    currentValue: 0,
    unit: '%',
    metric: 'GMS',
    deadline: new Date()
  });

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    type: 'GENERAL_OPTIMIZATION',
    priority: 'MEDIUM',
    objectiveId: '',
    keyResultId: ''
  });

  // Fetch Objectives with Key Results via API
  const { data: objectivesData, isLoading: objectivesLoading, refetch: refetchObjectives } = useQuery({
    queryKey: ['objectives'],
    queryFn: async () => {
      try {
        const res = await db.getObjectives();
        return Array.isArray(res) ? res : (res?.data || []);
      } catch (error) {
        console.error('Failed to fetch objectives:', error);
        return [];
      }
    }
  });

  // Fetch Actions/Tasks via API
  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = useQuery({
    queryKey: ['actions'],
    queryFn: async () => {
      try {
        const res = await db.getActions();
        return Array.isArray(res) ? res : (res?.data || []);
      } catch (error) {
        console.error('Failed to fetch actions:', error);
        return [];
      }
    }
  });

  // Fetch Users via API
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      try {
        const res = await db.request('/users', {}, []);
        if (Array.isArray(res)) return res;
        if (res?.data && Array.isArray(res.data)) return res.data;
        if (res?.success && Array.isArray(res.data)) return res.data;
        return [];
      } catch (error) {
        console.error('Failed to fetch users:', error);
        return [];
      }
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
    
    if (filterStatus) {
      taskList = taskList.filter(t => t.status === filterStatus);
    }
    if (filterPriority) {
      taskList = taskList.filter(t => t.priority === filterPriority);
    }
    if (filterCategory) {
      taskList = taskList.filter(t => getTaskCategory(t.type) === filterCategory);
    }
    if (searchQuery) {
      taskList = taskList.filter(t => 
        t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return taskList;
  }, [tasksData, filterStatus, filterPriority, filterCategory, searchQuery]);

  // Group tasks by category
  const tasksByCategory = useMemo(() => {
    const groups = {};
    TASK_CATEGORIES.forEach(cat => {
      groups[cat] = [];
    });
    tasks.forEach(task => {
      const cat = getTaskCategory(task.type);
      if (groups[cat]) {
        groups[cat].push(task);
      } else {
        groups['Operations & General'].push(task);
      }
    });
    return groups;
  }, [tasks]);

  const toggleObjectiveExpand = (id) => {
    setExpandedObjectives(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate objective progress from key results
  const getObjectiveProgress = (objective) => {
    const krs = objective.keyResults || [];
    if (krs.length === 0) return 0;
    const totalProgress = krs.reduce((sum, kr) => {
      const target = parseFloat(kr.targetValue) || 1;
      const current = parseFloat(kr.currentValue) || 0;
      return sum + Math.min(100, (current / target) * 100);
    }, 0);
    return Math.round(totalProgress / krs.length);
  };

  // Handle create objective
  const handleCreateObjective = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const objectiveData = {
        title: objectiveForm.title,
        description: objectiveForm.description,
        type: objectiveForm.type,
        startDate: objectiveForm.startDate.toISOString(),
        endDate: objectiveForm.endDate.toISOString(),
        owners: objectiveForm.owner ? [objectiveForm.owner] : []
      };
      const res = await db.createObjective(objectiveData);
      if (res?.success || res?._id) {
        await refetchObjectives();
        setShowObjectiveModal(false);
        setObjectiveForm({
          title: '', description: '', type: 'MONTHLY',
          startDate: new Date(),
          endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
          owner: ''
        });
        messageApi.success('Objective created successfully');
      }
    } catch (error) {
      console.error('Create objective error:', error);
      messageApi.error('Failed to create objective: ' + (error.message || 'Server error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle create key result
  const handleCreateKeyResult = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const krData = {
        title: keyResultForm.title,
        targetValue: parseFloat(keyResultForm.targetValue) || 0,
        currentValue: 0,
        unit: keyResultForm.unit,
        metric: keyResultForm.metric,
        metricType: keyResultForm.metric,
        objectiveId: selectedObjective?._id,
        startDate: new Date().toISOString(),
        deadline: keyResultForm.deadline?.toISOString ? keyResultForm.deadline.toISOString() : new Date(keyResultForm.deadline).toISOString()
      };
      const res = await db.createKeyResult(krData);
      if (res?.success || res?._id) {
        await refetchObjectives();
        setShowKeyResultModal(false);
        setKeyResultForm({
          title: '', targetValue: '', currentValue: 0, unit: '%',
          metric: 'GMS', deadline: new Date()
        });
        messageApi.success('Key Result added successfully');
      }
    } catch (error) {
      console.error('Create key result error:', error);
      messageApi.error('Failed to create key result: ' + (error.message || 'Server error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle update key result progress
  const handleUpdateKeyResult = async (krId, newValue) => {
    try {
      const result = await db.updateKeyResult(krId, { currentValue: parseFloat(newValue) });
      if (result?.success || result?._id) {
        await refetchObjectives();
        messageApi.success('Progress updated');
      } else {
        messageApi.error(result?.message || 'Failed to update progress');
      }
    } catch (error) {
      console.error('Key result update error:', error);
      messageApi.error('Failed to update progress: ' + (error.message || 'Server error'));
    }
  };

  // Handle create task
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const user = db.getUser();
      const taskData = {
        title: taskForm.title,
        description: taskForm.description,
        type: taskForm.type,
        priority: taskForm.priority,
        status: 'PENDING',
        createdBy: user?._id || user?.id,
        objectiveId: taskForm.objectiveId || null,
        keyResultId: taskForm.keyResultId || null
      };
      const res = await db.createAction(taskData);
      if (res?.success || res?._id) {
        await refetchTasks();
        setShowTaskModal(false);
        setTaskForm({
          title: '', description: '', type: 'GENERAL_OPTIMIZATION',
          priority: 'MEDIUM', objectiveId: '', keyResultId: ''
        });
        messageApi.success('Task created successfully');
      }
    } catch (error) {
      console.error('Create task error:', error);
      messageApi.error('Failed to create task: ' + (error.message || 'Server error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const result = await db.updateAction(taskId, { status: newStatus });
      if (!result?.success) {
        messageApi.error(result?.message || 'Failed to update task status');
        return;
      }
      messageApi.success('Task status updated');
      await refetchTasks();
    } catch (error) {
      console.error('Status update error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Server error';
      messageApi.error('Failed to update status: ' + errorMsg);
    }
  };

  // Handle delete task
  const handleDeleteTask = async (taskId) => {
    try {
      const result = await db.deleteAction(taskId);
      if (!result?.success) {
        messageApi.error(result?.message || 'Failed to delete task');
        return;
      }
      messageApi.success('Task deleted successfully');
      await refetchTasks();
    } catch (error) {
      console.error('Delete task error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Server error';
      messageApi.error('Failed to delete task: ' + errorMsg);
    }
  };

  // Handle auto-generate bulk tasks from ASIN analysis
  const handleAutoGenerateTasks = async () => {
    setAutoGenerating(true);
    try {
      const result = await db.generateBulkActions();
      if (result?.success || result?.count > 0) {
        await refetchTasks();
        setShowAutoGenerateModal(false);
        messageApi.success(`Successfully generated ${result?.count || 0} auto-tasks`);
      } else if (result?.message) {
        messageApi.info(result.message);
      }
    } catch (error) {
      console.error('Auto-generate error:', error);
      messageApi.error('Failed to auto-generate tasks: ' + (error.message || 'Server error'));
    } finally {
      setAutoGenerating(false);
    }
  };

  // Stats calculation
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

  // Ant Design Table Columns for All Tasks
  const taskColumns = [
    {
      title: '#',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => <Text type="secondary" style={{ fontSize: '12px' }}>{index + 1}</Text>
    },
    {
      title: 'Task Title & Description',
      key: 'task',
      render: (_, record) => (
        <div>
          <Text strong style={{ color: '#1e293b', fontSize: '13px' }}>{record.title}</Text>
          <div style={{ color: '#64748b', fontSize: '11px', maxWidth: '360px' }} className="text-truncate">
            {record.description || 'No description provided'}
          </div>
        </div>
      )
    },
    {
      title: 'Objective Mapping',
      key: 'objective',
      render: (_, record) => {
        const mapping = objectives.find(o => o._id === record.objectiveId);
        return mapping ? (
          <Tag color="blue" style={{ fontSize: '11px', borderRadius: '4px' }}>{mapping.title}</Tag>
        ) : (
          <Text type="secondary" style={{ fontSize: '11px' }}>--</Text>
        );
      }
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (priority) => (
        <Tag 
          color={PRIORITY_COLORS[priority]?.color || '#64748b'} 
          style={{ border: 'none', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', minWidth: '70px', textAlign: 'center' }}
        >
          {priority}
        </Tag>
      )
    },
    {
      title: 'Task Status',
      key: 'status',
      render: (_, record) => (
        <Select 
          value={record.status}
          onChange={(val) => handleStatusChange(record._id, val)}
          size="small"
          style={{ width: 120 }}
          options={STATUS_OPTIONS.slice(1).map(opt => ({ label: opt.label, value: opt.value }))}
        />
      )
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (date) => date ? (
        <Text style={{ fontSize: '12px', color: '#475569' }}>
          <Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          {new Date(date).toLocaleDateString()}
        </Text>
      ) : (
        <Text type="secondary" style={{ fontSize: '11px' }}>--</Text>
      )
    },
    {
      title: 'Actions',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Popconfirm
          title="Delete optimization task?"
          description="This cannot be undone."
          onConfirm={() => handleDeleteTask(record._id)}
          okText="Delete"
          cancelText="Cancel"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" danger icon={<Trash2 size={14} />} size="small" />
        </Popconfirm>
      )
    }
  ];

  // Table columns for OKR Linked Tasks
  const linkedTaskColumns = [
    {
      title: 'Task',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <Text strong style={{ fontSize: '12px', color: '#475569' }}>{text}</Text>
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => (
        <Tag color={PRIORITY_COLORS[p]?.color} style={{ border: 'none', fontWeight: 650, fontSize: '9px' }}>
          {p}
        </Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => (
        <Tag color={s === 'COMPLETED' ? 'success' : 'warning'} style={{ fontSize: '9px', fontWeight: 600 }}>
          {s}
        </Tag>
      )
    },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (d) => d ? <span style={{ fontSize: '11px', color: '#64748b' }}>{new Date(d).toLocaleDateString()}</span> : '--'
    }
  ];

  if (objectivesLoading || tasksLoading) {
    return <PageLoader message="Loading OKR Dashboard..." />;
  }

  return (
    <div className="actions-page-container">
      {contextHolder}
      
      {/* Custom CSS rules injected to support viewport height fills */}
      <style>{`
        .actions-page-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 60px);
          overflow: hidden;
          background-color: #f8fafc;
          margin: -1.5rem -2rem;
        }
        .actions-header {
          flex-shrink: 0;
          background: #ffffff;
          padding: 16px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
          box-shadow: 0 2px 4px rgba(0,0,0,0.01);
        }
        .actions-main-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        /* Visual Animations */
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        
        /* KPI Metrics & Board styling */
        .dashboard-segmented .ant-segmented-item-selected {
          background-color: #3b82f6 !important;
          color: #ffffff !important;
          font-weight: 650 !important;
        }
        
        .okr-collapsible-card {
          border-radius: 12px !important;
          overflow: hidden !important;
          transition: all 0.2s ease;
          border: 1px solid #e2e8f0 !important;
        }
        .okr-collapsible-card:hover {
          box-shadow: 0 8px 20px rgba(0,0,0,0.04) !important;
          border-color: #cbd5e1 !important;
        }
        
        .kanban-lane {
          background-color: #f1f5f9;
          border-radius: 12px;
          padding: 12px;
          min-height: 450px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .kanban-card {
          background: #ffffff;
          border-radius: 8px;
          padding: 14px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.03);
          border: 1px solid #e2e8f0;
          transition: all 0.2s ease;
        }
        .kanban-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.07);
          transform: translateY(-2px);
        }
        .auto-category-card {
          border-radius: 12px !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02) !important;
        }

        .spin { animation: spin 1.2s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        @media (max-width: 992px) {
          .actions-page-container {
            margin: -0.75rem;
            height: auto;
            overflow: visible;
          }
          .actions-header {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }
        }
      `}</style>

      {/* HEADER BAR */}
      <div className="actions-header">
        <div>
          <Title level={3} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.03em' }}>
            OKR <span style={{ color: '#3b82f6' }}>Command Center</span>
          </Title>
          <Paragraph style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
            Strategic Objectives, Operational Key Results & Advanced Optimization Tasks
          </Paragraph>
        </div>
        <Space>
          <Button 
            onClick={() => { refetchObjectives(); refetchTasks(); }}
            icon={<RefreshCw size={13} />}
            className="d-flex align-items-center"
          >
            Refresh
          </Button>
          <Button 
            type="default" 
            style={{ borderColor: '#f59e0b', color: '#d97706', backgroundColor: '#fffbeb' }}
            icon={<Zap size={13} />} 
            onClick={() => setShowAutoGenerateModal(true)}
            className="fw-bold"
          >
            Auto-Generate
          </Button>
          <Button 
            type="primary" 
            style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}
            icon={<Plus size={14} />} 
            onClick={() => setShowTaskModal(true)}
            className="fw-bold"
          >
            New Task
          </Button>
        </Space>
      </div>

      {/* MAIN CONTENT LAYOUT */}
      <div className="actions-main-content animate-slide-up">
        
        {/* TOP KPI WIDGETS & VIEW SWITCHER */}
        <Row gutter={[16, 16]} align="stretch">
          <Col xs={24} lg={16}>
            <Card styles={{ body: { padding: 12 } }} style={{ height: '100%', borderRadius: 12 }}>
              <div className="d-flex justify-content-between align-items-center h-100 flex-wrap gap-3">
                <Segmented
                  className="dashboard-segmented"
                  size="large"
                  options={[
                    { label: <Space size={6}><Flag size={14} /><span>OKR Board</span></Space>, value: 'okr' },
                    { label: <Space size={6}><ListChecks size={14} /><span>All Tasks</span></Space>, value: 'tasks' },
                    { label: <Space size={6}><LayoutGrid size={14} /><span>Kanban</span></Space>, value: 'board' },
                    { label: <Space size={6}><Zap size={14} /><span>Auto-Tasks</span></Space>, value: 'auto' }
                  ]}
                  value={activeView}
                  onChange={setActiveView}
                />
                
                <div className="d-flex gap-4 px-2 flex-wrap">
                  <Statistic title="Objectives" value={stats.objectivesTotal} styles={{ content: { fontSize: 20, fontWeight: 800, color: '#3b82f6' } }} />
                  <Divider orientation="vertical" style={{ height: 40, alignSelf: 'center' }} />
                  <Statistic title="Completed" value={stats.completed} styles={{ content: { fontSize: 20, fontWeight: 800, color: '#10b981' } }} />
                  <Divider orientation="vertical" style={{ height: 40, alignSelf: 'center' }} />
                  <Statistic title="In Progress" value={stats.inProgress} styles={{ content: { fontSize: 20, fontWeight: 800, color: '#f59e0b' } }} />
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card styles={{ body: { padding: 16 } }} style={{ height: '100%', borderRadius: 12 }}>
              <div className="d-flex align-items-center justify-content-between gap-3 h-100">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-3" style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe' }}>
                    <TrendingUp size={20} style={{ color: '#2563eb' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>OVERALL TASKS METRIC</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', color: '#0f172a' }}>
                      {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% Completed
                    </div>
                  </div>
                </div>
                <div style={{ width: '100px', flexGrow: 1, maxWidth: '160px' }}>
                  <Progress 
                    percent={stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0} 
                    size="small" 
                    strokeColor="#10b981" 
                    railColor="#f1f5f9"
                  />
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* ================= VIEW 1: OKR BOARD ================= */}
        {activeView === 'okr' && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <div className="d-flex justify-content-between align-items-center">
              <Title level={5} style={{ margin: 0, fontWeight: 700, color: '#334155' }}>Objectives & Strategic Milestones</Title>
              <Button 
                type="primary" 
                ghost 
                icon={<Plus size={13} />} 
                onClick={() => setShowObjectiveModal(true)}
                size="small"
                className="fw-bold"
              >
                Add Objective
              </Button>
            </div>

            {objectives && objectives.length > 0 ? (
              objectives.map((objective, idx) => {
                const progress = getObjectiveProgress(objective);
                const status = progress >= 70 ? 'ON_TRACK' : progress >= 30 ? 'AT_RISK' : 'BEHIND';
                const statusStyle = OKR_STATUS_COLORS[status] || OKR_STATUS_COLORS.BEHIND;
                const isExpanded = expandedObjectives[objective._id];
                
                return (
                  <Card 
                    key={objective._id || idx} 
                    className="okr-collapsible-card"
                    styles={{ body: { padding: 0 } }}
                  >
                    {/* Card Interactive Header */}
                    <div 
                      className="d-flex justify-content-between align-items-center flex-wrap gap-3" 
                      style={{ padding: '16px 20px', cursor: 'pointer', background: '#ffffff' }}
                      onClick={() => toggleObjectiveExpand(objective._id)}
                    >
                      <div className="d-flex align-items-center gap-3 flex-grow-1">
                        <div className="p-2 rounded-3" style={{ backgroundColor: statusStyle.bg }}>
                          <Gauge size={18} style={{ color: statusStyle.color }} />
                        </div>
                        <div>
                          <Text strong style={{ fontSize: '15px', color: '#1e293b' }}>{objective.title}</Text>
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span style={{ fontSize: '12px', color: '#64748b' }}>{objective.description || 'No description defined'}</span>
                            {objective.startDate && objective.endDate && (
                              <Tag color="default" style={{ fontSize: '10px', borderRadius: '4px', fontWeight: 600 }}>
                                {new Date(objective.startDate).toLocaleDateString()} - {new Date(objective.endDate).toLocaleDateString()}
                              </Tag>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="d-flex align-items-center gap-4">
                        <div style={{ minWidth: '80px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 800, color: statusStyle.color, fontSize: '16px' }}>{progress}%</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>COMPLETION</div>
                        </div>
                        <Tag color={statusStyle.color} style={{ border: 'none', fontWeight: 700, textTransform: 'uppercase', borderRadius: '4px' }}>
                          {statusStyle.label}
                        </Tag>
                        {isExpanded ? <ChevronUp size={16} style={{ color: '#94a3b8' }} /> : <ChevronDown size={16} style={{ color: '#94a3b8' }} />}
                      </div>
                    </div>

                    {/* Expanded Objective Details Body */}
                    {isExpanded && (
                      <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                        
                        {/* Key Results Internal Grid */}
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <Title level={5} style={{ margin: 0, fontSize: '13px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Operational Key Results</Title>
                          <Button 
                            type="dashed" 
                            size="small" 
                            icon={<Plus size={12} />} 
                            onClick={(e) => { e.stopPropagation(); setSelectedObjective(objective); setShowKeyResultModal(true); }}
                          >
                            Add Key Result
                          </Button>
                        </div>

                        <Row gutter={[16, 16]}>
                          {(objective.keyResults || []).map((kr, krIdx) => {
                            const krProgress = kr.targetValue ? Math.min(100, ((kr.currentValue || 0) / kr.targetValue) * 100) : 0;
                            const progressColor = krProgress >= 70 ? '#10b981' : krProgress >= 30 ? '#f59e0b' : '#ef4444';
                            return (
                              <Col xs={24} md={12} key={krIdx}>
                                <Card style={{ borderRadius: 8, border: '1px solid #e2e8f0', height: '100%' }} styles={{ body: { padding: 16 } }}>
                                  <div className="d-flex justify-content-between align-items-start mb-1">
                                    <Text strong style={{ fontSize: '13px', color: '#334155' }}>{kr.title}</Text>
                                    <Tag style={{ border: 'none', fontWeight: 700, color: '#64748b', backgroundColor: '#f1f5f9' }}>{kr.metric}</Tag>
                                  </div>
                                  
                                  <div className="mb-3 mt-2">
                                    <Progress percent={Math.round(krProgress)} strokeColor={progressColor} size="small" />
                                  </div>

                                  <div className="d-flex justify-content-between align-items-center pt-1 border-top" style={{ borderColor: '#f1f5f9' }}>
                                    <Input 
                                      type="number" 
                                      size="small"
                                      addonBefore="Value Now" 
                                      style={{ maxWidth: 130 }} 
                                      defaultValue={kr.currentValue || 0}
                                      onBlur={(e) => handleUpdateKeyResult(kr._id, e.target.value)}
                                    />
                                    <Text style={{ fontSize: '12px', color: '#64748b' }}>
                                      Target: <Text strong style={{ color: '#1e293b' }}>{kr.targetValue} {kr.unit}</Text>
                                    </Text>
                                  </div>
                                </Card>
                              </Col>
                            );
                          })}
                          {(objective.keyResults || []).length === 0 && (
                            <Col span={24}>
                              <div className="text-center py-3 border rounded-3 bg-white" style={{ borderStyle: 'dashed', color: '#94a3b8', fontSize: '13px' }}>
                                No key results added to this objective milestone yet.
                              </div>
                            </Col>
                          )}
                        </Row>

                        {/* Linked Tasks List */}
                        <div className="mt-4">
                          <div style={{ fontSize: '13px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px' }}>
                            Linked Optimization Tasks
                          </div>
                          <div className="border rounded-3 overflow-hidden bg-white">
                            <Table 
                              dataSource={tasks.filter(t => t.objectiveId === objective._id).slice(0, 5)}
                              columns={linkedTaskColumns}
                              pagination={false}
                              rowKey="_id"
                              size="small"
                              locale={{ emptyText: 'No active tasks mapped to this objective.' }}
                            />
                          </div>
                        </div>

                      </div>
                    )}
                  </Card>
                );
              })
            ) : (
              <Card style={{ borderRadius: 12, borderStyle: 'dashed' }}>
                <div className="text-center py-5">
                  <Flag size={44} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                  <div style={{ color: '#475569', fontWeight: 700, fontSize: '16px' }}>No Strategic Objectives Found</div>
                  <Paragraph style={{ color: '#94a3b8', marginBottom: 16 }}>Create high-level monthly or quarterly goals to start cascading down tracking mechanisms.</Paragraph>
                  <Button type="primary" icon={<Plus size={14} />} onClick={() => setShowObjectiveModal(true)}>
                    Create First Objective
                  </Button>
                </div>
              </Card>
            )}
          </Space>
        )}

        {/* ================= VIEW 2: ALL TASKS ================= */}
        {activeView === 'tasks' && (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            
            {/* Filter Controls Strip */}
            <Card styles={{ body: { padding: 12 } }} style={{ borderRadius: 12 }}>
              <Row gutter={[12, 12]} align="middle">
                <Col xs={24} md={10}>
                  <Input 
                    placeholder="Search tasks description or titles..." 
                    prefix={<Search size={14} style={{ color: '#94a3b8' }} />} 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    allowClear
                  />
                </Col>
                
                <Col xs={12} md={5}>
                  <Select 
                    style={{ width: '100%' }} 
                    placeholder="Filter Status" 
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={STATUS_OPTIONS.map(o => ({ label: o.label || 'All Statuses', value: o.value }))}
                  />
                </Col>
                
                <Col xs={12} md={5}>
                  <Select 
                    style={{ width: '100%' }} 
                    placeholder="Filter Priority" 
                    value={filterPriority}
                    onChange={setFilterPriority}
                    options={[
                      { label: 'All Priorities', value: '' },
                      { label: 'Urgent', value: 'URGENT' },
                      { label: 'High', value: 'HIGH' },
                      { label: 'Medium', value: 'MEDIUM' },
                      { label: 'Low', value: 'LOW' }
                    ]}
                  />
                </Col>
                
                <Col xs={24} md={4} style={{ textAlign: 'right' }}>
                  <Text type="secondary" style={{ fontSize: '13px', fontWeight: 600 }}>{tasks.length} tasks filtered</Text>
                </Col>
              </Row>
            </Card>

            {/* Main Dynamic Datatable */}
            <div className="border rounded-3 bg-white" style={{ overflow: 'hidden', borderColor: '#e2e8f0' }}>
              <Table 
                dataSource={tasks}
                columns={taskColumns}
                rowKey={(record) => record._id}
                pagination={{ pageSize: 10, showSizeChanger: false, size: 'small' }}
                scroll={{ x: 'max-content' }}
                size="middle"
              />
            </div>
          </Space>
        )}

        {/* ================= VIEW 3: KANBAN BOARD ================= */}
        {activeView === 'board' && (
          <Row gutter={[16, 16]}>
            {['PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map(status => {
              const laneTasks = tasks.filter(t => t.status === status);
              const colorMap = {
                'PENDING': '#64748b',
                'IN_PROGRESS': '#f59e0b',
                'REVIEW': '#3b82f6',
                'COMPLETED': '#10b981'
              };
              
              return (
                <Col xs={24} sm={12} lg={6} key={status}>
                  <div className="kanban-lane">
                    <div className="d-flex justify-content-between align-items-center mb-1 px-1">
                      <Text strong style={{ textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.04em', color: '#475569' }}>
                        {status.replace('_', ' ')}
                      </Text>
                      <Badge 
                        count={laneTasks.length} 
                        showZero 
                        style={{ backgroundColor: colorMap[status] || '#94a3b8', border: 'none' }} 
                      />
                    </div>

                    {/* Scroll Container for Cards */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 290px)', paddingBottom: 20 }}>
                      {laneTasks.map(task => (
                        <div className="kanban-card" key={task._id}>
                          <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', marginBottom: 4 }}>{task.title}</div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: 12 }} className="text-truncate">{task.description || 'No details'}</div>
                          
                          <div className="d-flex justify-content-between align-items-center">
                            <Tag 
                              color={PRIORITY_COLORS[task.priority]?.color || '#64748b'} 
                              style={{ border: 'none', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase' }}
                            >
                              {task.priority}
                            </Tag>

                            {/* Fast Action Toggle */}
                            <Tooltip title={status === 'COMPLETED' ? "Re-open task" : "Mark completed"}>
                              <Button 
                                type="text" 
                                size="small" 
                                icon={status === 'COMPLETED' ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} className="text-muted" />} 
                                onClick={() => handleStatusChange(task._id, status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                              />
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                      
                      {laneTasks.length === 0 && (
                        <div style={{ margin: 'auto', padding: '20px 0', color: '#94a3b8', textAlign: 'center', fontSize: '12px', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                          No tasks here.
                        </div>
                      )}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>
        )}

        {/* ================= VIEW 4: AUTO-TASKS GENERATION ================= */}
        {activeView === 'auto' && (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <Title level={5} style={{ margin: 0, color: '#334155' }}>System Inferred Optimization Tasks</Title>
                <Paragraph style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Tasks extracted automatically through real-time catalog structure parsing and ASIN analytics.</Paragraph>
              </div>
              <Button 
                type="primary" 
                style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}
                icon={<Zap size={14} />}
                onClick={() => setShowAutoGenerateModal(true)}
              >
                Auto-Generate Stream
              </Button>
            </div>

            <Row gutter={[16, 16]}>
              {TASK_CATEGORIES.map(category => {
                const categoryTasks = tasksByCategory[category] || [];
                if (categoryTasks.length === 0) return null;

                return (
                  <Col span={24} key={category}>
                    <Card 
                      className="auto-category-card"
                      title={
                        <div className="d-flex justify-content-between align-items-center">
                          <Text strong style={{ color: '#1e293b' }}>{category}</Text>
                          <Tag color="blue" style={{ borderRadius: '12px', fontWeight: 700 }}>{categoryTasks.length}</Tag>
                        </div>
                      }
                      styles={{ body: { padding: '12px 16px' } }}
                    >
                      <Row gutter={[12, 12]}>
                        {categoryTasks.map(task => (
                          <Col xs={24} md={12} key={task._id}>
                            <Card hoverable styles={{ body: { padding: 14 } }} style={{ border: '1px solid #f1f5f9', borderRadius: 8 }}>
                              <div className="d-flex justify-content-between align-items-start">
                                <div>
                                  <Text strong style={{ color: '#334155', fontSize: '13px' }}>{task.title}</Text>
                                  <div style={{ fontSize: '11px', color: '#64748b', maxWidth: 400 }} className="text-truncate">{task.description}</div>
                                  {task.autoGenerated?.isAuto && (
                                    <Tag color="cyan" style={{ fontSize: '9px', marginTop: 6, border: 'none', fontWeight: 700 }}>AUTO_GENERATED</Tag>
                                  )}
                                </div>
                                <div className="d-flex flex-column align-items-end gap-1 flex-shrink-0">
                                  <Tag color={PRIORITY_COLORS[task.priority]?.color} style={{ fontSize: '9px', fontWeight: 750, border: 'none' }}>{task.priority}</Tag>
                                  <Tag color={task.status === 'COMPLETED' ? 'success' : 'warning'} style={{ fontSize: '9px', fontWeight: 600 }}>{task.status}</Tag>
                                </div>
                              </div>
                              
                              <Divider style={{ margin: '10px 0' }} />
                              
                              <div className="d-flex justify-content-between align-items-center">
                                <Text code style={{ fontSize: '10px' }}>{task.type}</Text>
                                <Space>
                                  <Button 
                                    size="small" 
                                    type="primary"
                                    ghost
                                    onClick={() => handleStatusChange(task._id, task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                                  >
                                    {task.status === 'COMPLETED' ? 'Reopen' : 'Complete'}
                                  </Button>
                                  <Popconfirm
                                    title="Delete Task?"
                                    onConfirm={() => handleDeleteTask(task._id)}
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button size="small" danger type="text" icon={<Trash2 size={12} />} />
                                  </Popconfirm>
                                </Space>
                              </div>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  </Col>
                );
              })}
            </Row>

            {tasks.length === 0 && (
              <Card style={{ borderRadius: 12, borderStyle: 'dashed' }}>
                <div className="text-center py-5">
                  <Zap size={40} style={{ color: '#f59e0b', marginBottom: 12 }} />
                  <div style={{ color: '#475569', fontWeight: 700, fontSize: '16px' }}>No Auto-Generated Tasks Pipeline</div>
                  <Paragraph style={{ color: '#94a3b8', marginBottom: 16 }}>No tasks found. Run the intelligent generation mechanism to derive optimizing workflows automatically.</Paragraph>
                  <Button type="primary" style={{ backgroundColor: '#d97706', borderColor: '#d97706' }} icon={<Zap size={14} />} onClick={() => setShowAutoGenerateModal(true)}>
                    Run AI Stream Generator
                  </Button>
                </div>
              </Card>
            )}
          </Space>
        )}

      </div>

      {/* ================= MODALS (ANT DESIGN OVERLAYS) ================= */}

      {/* Objective Creation Modal */}
      <Modal
        open={showObjectiveModal}
        title={<Title level={4} style={{ margin: 0 }}>Create Strategic Objective</Title>}
        onCancel={() => setShowObjectiveModal(false)}
        footer={null}
        centered
        destroyOnHidden
      >
        <form onSubmit={handleCreateObjective} style={{ marginTop: 16 }}>
          <div className="mb-3">
            <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Objective Title</label>
            <Input placeholder="What is the core goal?" required value={objectiveForm.title} onChange={(e) => setObjectiveForm({...objectiveForm, title: e.target.value})} />
          </div>
          <div className="mb-3">
            <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Detailed Description</label>
            <TextArea rows={3} placeholder="Explain the logic/impact of this goal..." value={objectiveForm.description} onChange={(e) => setObjectiveForm({...objectiveForm, description: e.target.value})} />
          </div>
          
          <Row gutter={16} className="mb-3">
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Period Type</label>
              <Select 
                style={{ width: '100%' }} 
                value={objectiveForm.type} 
                onChange={(val) => setObjectiveForm({...objectiveForm, type: val})}
                options={[
                  { label: 'Daily', value: 'DAILY' },
                  { label: 'Weekly', value: 'WEEKLY' },
                  { label: 'Monthly', value: 'MONTHLY' },
                  { label: 'Quarterly', value: 'QUARTERLY' }
                ]}
              />
            </Col>
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Goal Owner</label>
              <Select 
                style={{ width: '100%' }} 
                placeholder="Select Owner"
                value={objectiveForm.owner} 
                onChange={(val) => setObjectiveForm({...objectiveForm, owner: val})}
                options={Array.isArray(usersData) ? usersData.map(u => ({ label: u.name || u.email, value: u._id })) : []}
              />
            </Col>
          </Row>

          <Row gutter={16} className="mb-4">
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Start Date</label>
              <Input type="date" required value={objectiveForm.startDate ? new Date(objectiveForm.startDate).toISOString().split('T')[0] : ''} onChange={(e) => setObjectiveForm({...objectiveForm, startDate: new Date(e.target.value)})} />
            </Col>
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>End/Deadline Date</label>
              <Input type="date" required value={objectiveForm.endDate ? new Date(objectiveForm.endDate).toISOString().split('T')[0] : ''} onChange={(e) => setObjectiveForm({...objectiveForm, endDate: new Date(e.target.value)})} />
            </Col>
          </Row>

          <div className="d-flex justify-content-end gap-2">
            <Button onClick={() => setShowObjectiveModal(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting} style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6' }} icon={<Check size={14} />}>
              Create Objective
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Key Result Modal */}
      <Modal
        open={showKeyResultModal && !!selectedObjective}
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>Add Metric/Key Result</Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>Targeted to Objective: {selectedObjective?.title}</Text>
          </div>
        }
        onCancel={() => setShowKeyResultModal(false)}
        footer={null}
        centered
        destroyOnHidden
      >
        <form onSubmit={handleCreateKeyResult} style={{ marginTop: 16 }}>
          <div className="mb-3">
            <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Key Result Title</label>
            <Input placeholder="e.g., Scale overall storefront GMS by 15%" required value={keyResultForm.title} onChange={(e) => setKeyResultForm({...keyResultForm, title: e.target.value})} />
          </div>

          <Row gutter={16} className="mb-3">
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Target Value</label>
              <Input type="number" placeholder="e.g., 150" required value={keyResultForm.targetValue} onChange={(e) => setKeyResultForm({...keyResultForm, targetValue: e.target.value})} />
            </Col>
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Target Unit</label>
              <Select 
                style={{ width: '100%' }} 
                value={keyResultForm.unit} 
                onChange={(val) => setKeyResultForm({...keyResultForm, unit: val})}
                options={[
                  { label: '% (Percentage)', value: '%' },
                  { label: '$ (Currency Value)', value: '$' },
                  { label: '# (Quantitative Count)', value: '#' }
                ]}
              />
            </Col>
          </Row>

          <Row gutter={16} className="mb-4">
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Metric Indicator</label>
              <Select 
                style={{ width: '100%' }} 
                value={keyResultForm.metric} 
                onChange={(val) => setKeyResultForm({...keyResultForm, metric: val})}
                options={[
                  { label: 'GMS Revenue', value: 'GMS' },
                  { label: 'Units Sold', value: 'UNITS' },
                  { label: 'ROAS', value: 'ROAS' },
                  { label: 'ACOS', value: 'ACOS' },
                  { label: 'Rating Index', value: 'RATING' },
                  { label: 'Reviews Generation', value: 'REVIEW' },
                  { label: 'BSR Ranking Tracking', value: 'BSR' },
                  { label: 'Net Oper. Profit', value: 'PROFIT' }
                ]}
              />
            </Col>
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Metric Deadline</label>
              <Input type="date" value={keyResultForm.deadline ? new Date(keyResultForm.deadline).toISOString().split('T')[0] : ''} onChange={(e) => setKeyResultForm({...keyResultForm, deadline: new Date(e.target.value)})} />
            </Col>
          </Row>

          <div className="d-flex justify-content-end gap-2">
            <Button onClick={() => setShowKeyResultModal(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting} style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}>
              Add Key Result
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Creation Modal */}
      <Modal
        open={showTaskModal}
        title={<Title level={4} style={{ margin: 0 }}>Create Optimization Task</Title>}
        onCancel={() => setShowTaskModal(false)}
        footer={null}
        centered
        destroyOnHidden
      >
        <form onSubmit={handleCreateTask} style={{ marginTop: 16 }}>
          <div className="mb-3">
            <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Task Short Title</label>
            <Input placeholder="e.g., Revise PPC bidding keywords" required value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} />
          </div>
          
          <div className="mb-3">
            <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Action Items / Steps</label>
            <TextArea rows={3} placeholder="List operational execution checklist..." value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} />
          </div>

          <Row gutter={16} className="mb-3">
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Operation Type</label>
              <Select 
                style={{ width: '100%' }} 
                value={taskForm.type} 
                onChange={(val) => setTaskForm({...taskForm, type: val})}
                options={TASK_TYPES.map(t => ({ label: t.label, value: t.value }))}
              />
            </Col>
            <Col span={12}>
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Priority Priority</label>
              <Select 
                style={{ width: '100%' }} 
                value={taskForm.priority} 
                onChange={(val) => setTaskForm({...taskForm, priority: val})}
                options={[
                  { label: 'Low Impact', value: 'LOW' },
                  { label: 'Medium Baseline', value: 'MEDIUM' },
                  { label: 'High Focus', value: 'HIGH' },
                  { label: 'Urgent Immediate', value: 'URGENT' }
                ]}
              />
            </Col>
          </Row>

          <div className="mb-3">
            <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Cascade/Link to Objective (Optional)</label>
            <Select 
              style={{ width: '100%' }} 
              placeholder="No direct link"
              value={taskForm.objectiveId} 
              onChange={(val) => setTaskForm({...taskForm, objectiveId: val, keyResultId: ''})}
              options={[{ label: 'None / Loose Standing', value: '' }, ...(objectives || []).map(o => ({ label: o.title, value: o._id }))] }
            />
          </div>

          {taskForm.objectiveId && (
            <div className="mb-4">
              <label className="form-label smallest fw-bold text-muted text-uppercase" style={{ fontSize: '11px' }}>Direct to Key Result Mapping</label>
              <Select 
                style={{ width: '100%' }} 
                placeholder="Link to specific KR"
                value={taskForm.keyResultId} 
                onChange={(val) => setTaskForm({...taskForm, keyResultId: val})}
                options={[{ label: 'Any related key result', value: '' }, ...(objectives?.find(o => o._id === taskForm.objectiveId)?.keyResults?.map(kr => ({ label: kr.title, value: kr._id })) || [])]}
              />
            </div>
          )}

          <div className="d-flex justify-content-end gap-2 mt-4">
            <Button onClick={() => setShowTaskModal(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting} style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}>
              Create Optimization Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Auto-Tasks Batch Stream Processing confirmation */}
      <Modal
        open={showAutoGenerateModal}
        title={
          <div className="d-flex align-items-center gap-2">
            <Zap size={20} style={{ color: '#d97706' }} />
            <Title level={4} style={{ margin: 0 }}>Batch Auto-Generate Workflow Streams</Title>
          </div>
        }
        onCancel={() => setShowAutoGenerateModal(false)}
        footer={null}
        centered
      >
        <div style={{ marginTop: 12 }}>
          <Paragraph>This will automatically cross-reference active ASIN catalog diagnostics and generate critical optimization tasks targeting:</Paragraph>
          
          <ul className="list-unstyled" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            <li className="d-flex align-items-center gap-2"><Badge status="processing" color="blue" /> <Text strong style={{ fontSize: '13px' }}>Catalog Titles:</Text> Missing SEO markers</li>
            <li className="d-flex align-items-center gap-2"><Badge status="processing" color="blue" /> <Text strong style={{ fontSize: '13px' }}>Media Ingest:</Text> Underdeveloped Image arrays</li>
            <li className="d-flex align-items-center gap-2"><Badge status="processing" color="blue" /> <Text strong style={{ fontSize: '13px' }}>Structural A+:</Text> Missing modules on top listings</li>
            <li className="d-flex align-items-center gap-2"><Badge status="processing" color="blue" /> <Text strong style={{ fontSize: '13px' }}>LQS Health:</Text> Items performing below quality threshold</li>
          </ul>

          <Alert 
            title="Tasks created will be grouped into Categories and displayed directly within the Auto-Tasks Dashboard panel." 
            type="info" 
            showIcon 
            style={{ marginBottom: 24, borderRadius: 6 }}
          />

          <div className="d-flex justify-content-end gap-2">
            <Button onClick={() => setShowAutoGenerateModal(false)}>Cancel</Button>
            <Button 
              type="primary" 
              loading={autoGenerating} 
              style={{ backgroundColor: '#d97706', borderColor: '#d97706' }}
              icon={!autoGenerating && <Zap size={14} />}
              onClick={handleAutoGenerateTasks}
            >
              {autoGenerating ? 'Processing Streams...' : 'Trigger Generation'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default ActionsPage;