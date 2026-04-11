import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, Play, LayoutGrid, TrendingUp, Search, Filter, Plus, PlusCircle,
  MoreVertical, ArrowRight, Target, Trash2, Loader2, Check, ChevronDown,
  ChevronRight, ChevronUp, Flag, BarChart3, Calendar, Users, Eye, Edit2,
  Circle, CheckCircle2, AlertCircle, ArrowUp, ArrowDown, Minus, Zap,
  PieChart, Activity, Clock, X, ListChecks, Gauge, Briefcase
} from 'lucide-react';
import { db } from '../services/db';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';

const OKR_STATUS_COLORS = {
  'ON_TRACK': { bg: '#dcfce7', color: '#16a34a', label: 'On Track' },
  'AT_RISK': { bg: '#fef3c7', color: '#d97706', label: 'At Risk' },
  'BEHIND': { bg: '#fee2e2', color: '#dc2626', label: 'Behind' },
  'COMPLETED': { bg: '#dbeafe', color: '#2563eb', label: 'Completed' }
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

  // Helper function to get category from task type - must be defined before useMemo
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
        const data = Array.isArray(res) ? res : (res?.data || []);
        return data;
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
        const data = Array.isArray(res) ? res : (res?.data || []);
        return data;
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
      }
    } catch (error) {
      console.error('Create objective error:', error);
      alert('Failed to create objective: ' + (error.message || 'Server error'));
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
          title: '',
          targetValue: '',
          currentValue: 0,
          unit: '%',
          metric: 'GMS',
          deadline: new Date()
        });
      }
    } catch (error) {
      console.error('Create key result error:', error);
      alert('Failed to create key result: ' + (error.message || 'Server error'));
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
      } else {
        alert(result?.message || 'Failed to update key result');
      }
    } catch (error) {
      console.error('Key result update error:', error);
      alert('Failed to update key result: ' + (error.message || 'Server error'));
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
      }
    } catch (error) {
      console.error('Create task error:', error);
      alert('Failed to create task: ' + (error.message || 'Server error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle status change
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const result = await db.updateAction(taskId, { status: newStatus });
      if (!result?.success) {
        alert(result?.message || 'Failed to update status - you may not have permission to modify this task');
        return;
      }
      await refetchTasks();
    } catch (error) {
      console.error('Status update error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Server error';
      alert('Failed to update status: ' + errorMsg);
    }
  };

  // Handle delete task
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      const result = await db.deleteAction(taskId);
      if (!result?.success) {
        alert(result?.message || 'Failed to delete - you may not have permission to delete this task');
        return;
      }
      await refetchTasks();
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message || 'Server error';
      alert('Failed to delete: ' + errorMsg);
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
        alert(`Successfully generated ${result?.count || 0} auto-tasks from ASIN analysis`);
      } else if (result?.message) {
        alert(result.message);
      }
    } catch (error) {
      console.error('Auto-generate error:', error);
      alert('Failed to auto-generate tasks: ' + (error.message || 'Server error'));
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

  if (objectivesLoading || tasksLoading) {
    return <PageLoader message="Loading OKR Dashboard..." />;
  }

  return (
    <div className="dashboard-container p-3" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <header className="mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="fw-bold h3 mb-1">OKR <span style={{ color: '#4f46e5' }}>Command Center</span></h1>
            <p className="text-muted small mb-0">Objectives, Key Results & Task Management</p>
          </div>
          <div className="d-flex gap-2">
            <button className="btn btn-white border shadow-sm rounded-pill px-3 d-flex align-items-center gap-2" onClick={() => refetchObjectives()}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button className="btn btn-info rounded-pill px-4 shadow-sm d-flex align-items-center gap-2" onClick={() => setShowAutoGenerateModal(true)}>
              <Zap size={16} /> Auto-Generate
            </button>
            <button className="btn btn-primary rounded-pill px-4 shadow-sm d-flex align-items-center gap-2" onClick={() => setShowTaskModal(true)}>
              <Plus size={16} /> New Task
            </button>
          </div>
        </div>
      </header>

      {/* View Toggle & Stats */}
      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
            <div className="card-body p-2">
              <div className="d-flex align-items-center justify-content-between">
                <div className="btn-group bg-light p-1 rounded-pill">
                  {[
                    { id: 'okr', label: 'OKR Board', icon: Flag },
                    { id: 'tasks', label: 'All Tasks', icon: ListChecks },
                    { id: 'board', label: 'Kanban', icon: LayoutGrid },
                    { id: 'auto', label: 'Auto-Tasks', icon: Zap }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      className={`btn btn-sm rounded-pill px-4 d-flex align-items-center gap-2 border-0 ${activeView === tab.id ? 'bg-white shadow-sm fw-bold text-primary' : 'text-muted'}`}
                      onClick={() => setActiveView(tab.id)}
                    >
                      <tab.icon size={14} /> {tab.label}
                    </button>
                  ))}
                </div>
                <div className="d-flex gap-3">
                  <div className="text-center">
                    <div className="h4 mb-0 fw-bold text-primary">{stats.objectivesTotal}</div>
                    <div className="small text-muted">Objectives</div>
                  </div>
                  <div className="vr"></div>
                  <div className="text-center">
                    <div className="h4 mb-0 fw-bold text-success">{stats.completed}</div>
                    <div className="small text-muted">Completed</div>
                  </div>
                  <div className="vr"></div>
                  <div className="text-center">
                    <div className="h4 mb-0 fw-bold text-warning">{stats.inProgress}</div>
                    <div className="small text-muted">In Progress</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
            <div className="card-body p-3">
              <div className="d-flex align-items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <TrendingUp size={20} className="text-indigo-600" />
                </div>
                <div>
                  <div className="text-muted small">Overall Progress</div>
                  <div className="h5 mb-0 fw-bold">
                    {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                  </div>
                </div>
                <div className="flex-grow-1">
                  <div className="progress" style={{ height: '8px' }}>
                    <div className="progress-bar bg-success" style={{ width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OKR View */}
      {activeView === 'okr' && (
        <div className="row g-3 mb-4">
          <div className="col-12">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="fw-bold mb-0">Objectives & Key Results</h5>
              <button className="btn btn-sm btn-outline-primary rounded-pill d-flex align-items-center gap-1" onClick={() => setShowObjectiveModal(true)}>
                <Plus size={14} /> Add Objective
              </button>
            </div>
          </div>
          
          {objectives && objectives.length > 0 ? (
            objectives.map((objective, idx) => {
              const progress = getObjectiveProgress(objective);
              const status = progress >= 70 ? 'ON_TRACK' : progress >= 30 ? 'AT_RISK' : 'BEHIND';
              const statusStyle = OKR_STATUS_COLORS[status];
              
              return (
                <div key={objective._id || idx} className="col-12">
                  <div className="card border-0 shadow-sm" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                    {/* Objective Header */}
                    <div 
                      className="card-header bg-white border-0 p-3 d-flex align-items-center justify-content-between"
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleObjectiveExpand(objective._id)}
                    >
                      <div className="d-flex align-items-center gap-3">
                        <div 
                          className="p-2 rounded-lg"
                          style={{ backgroundColor: statusStyle.bg }}
                        >
                          <Gauge size={18} style={{ color: statusStyle.color }} />
                        </div>
                        <div>
                          <div className="fw-bold text-dark">{objective.title}</div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="small text-muted">{objective.description || 'No description'}</span>
                            {objective.startDate && objective.endDate && (
                              <span className="badge bg-light text-muted" style={{ fontSize: '10px' }}>
                                {new Date(objective.startDate).toLocaleDateString()} - {new Date(objective.endDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-4">
                        <div className="text-end">
                          <div className="fw-bold" style={{ color: statusStyle.color }}>{progress}%</div>
                          <div className="small text-muted">Progress</div>
                        </div>
                        <span 
                          className="badge rounded-pill px-3"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, fontWeight: 600 }}
                        >
                          {statusStyle.label}
                        </span>
                        {expandedObjectives[objective._id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                    
                    {/* Key Results Section */}
                    {expandedObjectives[objective._id] && (
                      <div className="card-body bg-light border-top pt-3">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="fw-bold mb-0">Key Results</h6>
                          <button className="btn btn-sm btn-light rounded-pill d-flex align-items-center gap-1" onClick={() => { setSelectedObjective(objective); setShowKeyResultModal(true); }}>
                            <Plus size={12} /> Add Key Result
                          </button>
                        </div>
                        <div className="row g-3">
                          {(objective.keyResults || []).map((kr, krIdx) => {
                            const krProgress = kr.targetValue ? Math.min(100, ((kr.currentValue || 0) / kr.targetValue) * 100) : 0;
                            return (
                              <div key={krIdx} className="col-md-6">
                                <div className="card border bg-white" style={{ borderRadius: '12px' }}>
                                  <div className="card-body p-3">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                      <div className="fw-medium">{kr.title}</div>
                                      <div className="badge bg-light text-muted small">{kr.metric}</div>
                                    </div>
                                    <div className="d-flex align-items-center gap-2 mb-2">
                                      <div className="progress flex-grow-1" style={{ height: '8px' }}>
                                        <div className={`progress-bar ${krProgress >= 70 ? 'bg-success' : krProgress >= 30 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${krProgress}%` }}></div>
                                      </div>
                                      <span className="small fw-bold">{Math.round(krProgress)}%</span>
                                    </div>
                                    <div className="d-flex justify-content-between align-items-center">
                                      <div className="input-group input-group-sm" style={{ maxWidth: '120px' }}>
                                        <span className="input-group-text bg-light border-0 py-1 px-2" style={{ fontSize: '11px' }}>Now</span>
                                        <input 
                                          type="number" 
                                          className="form-control border-0 py-1" 
                                          style={{ fontSize: '11px' }}
                                          defaultValue={kr.currentValue || 0}
                                          onBlur={(e) => handleUpdateKeyResult(kr._id, e.target.value)}
                                        />
                                      </div>
                                      <span className="text-muted small">/ {kr.targetValue} {kr.unit}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {(objective.keyResults || []).length === 0 && (
                            <div className="col-12 text-center py-3 text-muted">
                              No key results defined yet.
                            </div>
                          )}
                        </div>
                        
                        {/* Linked Tasks */}
                        <div className="mt-4">
                          <h6 className="fw-bold mb-3">Linked Tasks</h6>
                          <div className="table-responsive">
                            <table className="table table-sm table-hover">
                              <thead className="table-light">
                                <tr>
                                  <th>Task</th>
                                  <th>Priority</th>
                                  <th>Status</th>
                                  <th>Due</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tasks.filter(t => t.objectiveId === objective._id).slice(0, 5).map(task => (
                                  <tr key={task._id}>
                                    <td className="fw-medium">{task.title}</td>
                                    <td>
                                      <span className="badge" style={{ 
                                        backgroundColor: PRIORITY_COLORS[task.priority]?.bg, 
                                        color: PRIORITY_COLORS[task.priority]?.color 
                                      }}>
                                        {task.priority}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={`badge ${task.status === 'COMPLETED' ? 'bg-success' : 'bg-warning'}`}>
                                        {task.status}
                                      </span>
                                    </td>
                                    <td className="text-muted small">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '--'}</td>
                                  </tr>
                                ))}
                                {tasks.filter(t => t.objectiveId === objective._id).length === 0 && (
                                  <tr><td colSpan="4" className="text-center text-muted py-2">No linked tasks</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-12">
              <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                <div className="card-body text-center py-5">
                  <Flag size={48} className="text-muted mb-3" />
                  <h5 className="text-muted">No Objectives Created</h5>
                  <p className="text-muted small mb-3">Create your first objective to start tracking OKRs</p>
                  <button className="btn btn-primary rounded-pill" onClick={() => setShowObjectiveModal(true)}>
                    <Plus size={16} className="me-2" /> Create Objective
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tasks View */}
      {activeView === 'tasks' && (
        <>
          {/* Filters */}
          <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px' }}>
            <div className="card-body p-2">
              <div className="row g-2 align-items-center">
                <div className="col-md-5">
                  <div className="position-relative">
                    <Search className="position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
                    <input 
                      type="text" 
                      placeholder="Search tasks..." 
                      className="form-control border-0 bg-transparent ps-5 shadow-none"
                      style={{ height: '40px', fontSize: '13px' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-3">
                  <select 
                    className="form-select border-0 bg-light shadow-none" 
                    style={{ height: '40px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <select 
                    className="form-select border-0 bg-light shadow-none" 
                    style={{ height: '40px', fontSize: '12px', fontWeight: 600, color: '#64748b' }}
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                  >
                    <option value="">All Priorities</option>
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
                <div className="col-md-2 text-end">
                  <span className="text-muted small">{tasks.length} tasks</span>
                </div>
              </div>
            </div>
          </div>

          {/* Task Table */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0" style={{ fontSize: '12px' }}>
                <thead className="table-light text-muted fw-bold" style={{ fontSize: '10px', letterSpacing: '0.05em' }}>
                  <tr>
                    <th className="ps-4 border-0">#</th>
                    <th className="border-0">Task</th>
                    <th className="border-0">Objective</th>
                    <th className="border-0">Priority</th>
                    <th className="border-0">Status</th>
                    <th className="border-0">Due Date</th>
                    <th className="text-end pe-4 border-0">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length > 0 ? (
                    tasks.map((task, idx) => (
                      <tr key={task._id || idx}>
                        <td className="ps-4 text-muted smallest">{idx + 1}</td>
                        <td className="py-3">
                          <div className="fw-bold text-dark">{task.title}</div>
                          <div className="text-muted small text-truncate" style={{ maxWidth: '300px' }}>{task.description}</div>
                        </td>
                        <td>
                          {task.objectiveId ? (
                            <span className="badge bg-light text-dark">{objectives.find(o => o._id === task.objectiveId)?.title || 'Linked'}</span>
                          ) : <span className="text-muted">--</span>}
                        </td>
                        <td>
                          <span className="badge" style={{ 
                            backgroundColor: PRIORITY_COLORS[task.priority]?.bg, 
                            color: PRIORITY_COLORS[task.priority]?.color 
                          }}>
                            {task.priority}
                          </span>
                        </td>
                        <td>
                          <select 
                            className="form-select form-select-sm border-0 bg-light fw-bold" 
                            style={{ fontSize: '10px', width: '120px', borderRadius: '6px' }}
                            value={task.status}
                            onChange={(e) => handleStatusChange(task._id, e.target.value)}
                          >
                            {STATUS_OPTIONS.slice(1).map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="text-muted small">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '--'}</td>
                        <td className="text-end pe-4">
                          <button className="btn btn-sm btn-icon btn-light rounded-circle text-danger" onClick={() => handleDeleteTask(task._id)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="7" className="text-center py-5 text-muted">No tasks found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Kanban View */}
      {activeView === 'board' && (
        <div className="row g-3">
          {['PENDING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].map(status => (
            <div key={status} className="col-lg-3">
              <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                <div className="card-header bg-white border-0 p-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-bold">{status.replace('_', ' ')}</span>
                    <span className="badge bg-light">{tasks.filter(t => t.status === status).length}</span>
                  </div>
                </div>
                <div className="card-body p-2" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {tasks.filter(t => t.status === status).map(task => (
                    <div key={task._id} className="card mb-2 border shadow-sm" style={{ borderRadius: '8px' }}>
                      <div className="card-body p-2">
                        <div className="fw-medium small mb-1">{task.title}</div>
                        <div className="d-flex justify-content-between align-items-center">
                          <span className="badge" style={{ 
                            backgroundColor: PRIORITY_COLORS[task.priority]?.bg, 
                            color: PRIORITY_COLORS[task.priority]?.color,
                            fontSize: '9px'
                          }}>
                            {task.priority}
                          </span>
                          <button className="btn btn-sm btn-icon p-0" onClick={() => handleStatusChange(task._id, status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}>
                            {status === 'COMPLETED' ? <CheckCircle2 size={16} className="text-success" /> : <Circle size={16} className="text-muted" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Auto-Tasks View - Grouped by Category */}
      {activeView === 'auto' && (
        <div className="row g-4">
          {TASK_CATEGORIES.map(category => (
            tasksByCategory[category]?.length > 0 && (
              <div key={category} className="col-12">
                <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                  <div className="card-header bg-white border-0 p-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="fw-bold mb-0">{category}</h6>
                      <span className="badge bg-primary rounded-pill">{tasksByCategory[category].length}</span>
                    </div>
                  </div>
                  <div className="card-body p-2">
                    {tasksByCategory[category].map(task => (
                      <div key={task._id} className="card mb-2 border shadow-sm" style={{ borderRadius: '8px' }}>
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <div className="fw-medium">{task.title}</div>
                              <div className="text-muted small text-truncate" style={{ maxWidth: '400px' }}>{task.description}</div>
                              {task.autoGenerated?.isAuto && (
                                <span className="badge bg-info text-white mt-1" style={{ fontSize: '9px' }}>Auto-Generated</span>
                              )}
                            </div>
                            <div className="d-flex flex-column align-items-end gap-1">
                              <span className="badge" style={{ 
                                backgroundColor: PRIORITY_COLORS[task.priority]?.bg, 
                                color: PRIORITY_COLORS[task.priority]?.color,
                                fontSize: '10px'
                              }}>
                                {task.priority}
                              </span>
                              <span className={`badge ${task.status === 'COMPLETED' ? 'bg-success' : 'bg-warning'}`} style={{ fontSize: '10px' }}>
                                {task.status}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 d-flex justify-content-between align-items-center">
                            <span className="text-muted small">{task.type}</span>
                            <div>
                              <button className="btn btn-sm btn-outline-primary me-1" onClick={() => handleStatusChange(task._id, task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}>
                                {task.status === 'COMPLETED' ? 'Reopen' : 'Complete'}
                              </button>
                              <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteTask(task._id)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          ))}
          {tasks.length === 0 && (
            <div className="col-12">
              <div className="card border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                <div className="card-body text-center py-5">
                  <Zap size={48} className="text-muted mb-3" />
                  <h5 className="text-muted">No Auto-Generated Tasks</h5>
                  <p className="text-muted small mb-3">Click "Auto-Generate" to create tasks based on ASIN analysis</p>
                  <button className="btn btn-primary rounded-pill" onClick={() => setShowAutoGenerateModal(true)}>
                    <Zap size={16} className="me-2" /> Auto-Generate Tasks
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auto-Generate Confirmation Modal */}
      {showObjectiveModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <form onSubmit={handleCreateObjective}>
                <div className="modal-header border-0 pb-0 pe-4 pt-4">
                  <h5 className="fw-bold mb-0">Create Objective</h5>
                  <button type="button" className="btn-close shadow-none" onClick={() => setShowObjectiveModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label smallest fw-bold text-muted text-uppercase">Objective Title</label>
                    <input type="text" className="form-control" placeholder="What do you want to achieve?" required value={objectiveForm.title} onChange={(e) => setObjectiveForm({...objectiveForm, title: e.target.value})} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label smallest fw-bold text-muted text-uppercase">Description</label>
                    <textarea className="form-control" rows="2" placeholder="Why is this important?" value={objectiveForm.description} onChange={(e) => setObjectiveForm({...objectiveForm, description: e.target.value})} />
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Type</label>
                      <select className="form-select" value={objectiveForm.type} onChange={(e) => setObjectiveForm({...objectiveForm, type: e.target.value})}>
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Owner</label>
                      <select className="form-select" value={objectiveForm.owner} onChange={(e) => setObjectiveForm({...objectiveForm, owner: e.target.value})}>
                        <option value="">Select Owner</option>
                        {Array.isArray(usersData) && usersData.map(u => (
                          <option key={u._id} value={u._id}>{u.name || u.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="row g-3">
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Start Date</label>
                      <input type="date" className="form-control" value={objectiveForm.startDate ? new Date(objectiveForm.startDate).toISOString().split('T')[0] : ''} onChange={(e) => setObjectiveForm({...objectiveForm, startDate: new Date(e.target.value)})} />
                    </div>
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">End Date</label>
                      <input type="date" className="form-control" value={objectiveForm.endDate ? new Date(objectiveForm.endDate).toISOString().split('T')[0] : ''} onChange={(e) => setObjectiveForm({...objectiveForm, endDate: new Date(e.target.value)})} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0 p-4">
                  <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowObjectiveModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 size={16} className="animate-spin me-2" /> : <Check size={16} className="me-2" />}
                    Create Objective
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Key Result Modal */}
      {showKeyResultModal && selectedObjective && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <form onSubmit={handleCreateKeyResult}>
                <div className="modal-header border-0 pb-0 pe-4 pt-4">
                  <div>
                    <h5 className="fw-bold mb-0">Add Key Result</h5>
                    <p className="text-muted small mb-0">For: {selectedObjective.title}</p>
                  </div>
                  <button type="button" className="btn-close shadow-none" onClick={() => setShowKeyResultModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label smallest fw-bold text-muted text-uppercase">Key Result Title</label>
                    <input type="text" className="form-control" placeholder="e.g., Increase GMS by 20%" required value={keyResultForm.title} onChange={(e) => setKeyResultForm({...keyResultForm, title: e.target.value})} />
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Target Value</label>
                      <input type="number" className="form-control" placeholder="100" value={keyResultForm.targetValue} onChange={(e) => setKeyResultForm({...keyResultForm, targetValue: e.target.value})} />
                    </div>
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Unit</label>
                      <select className="form-select" value={keyResultForm.unit} onChange={(e) => setKeyResultForm({...keyResultForm, unit: e.target.value})}>
                        <option value="%">% (Percentage)</option>
                        <option value="$">$ (Dollar)</option>
                        <option value="#"># (Count)</option>
                      </select>
                    </div>
                  </div>
                  <div className="row g-3">
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Metric Type</label>
                      <select className="form-select" value={keyResultForm.metric} onChange={(e) => setKeyResultForm({...keyResultForm, metric: e.target.value})}>
                        <option value="GMS">GMS Revenue</option>
                        <option value="UNITS">Units Sold</option>
                        <option value="ROAS">ROAS</option>
                        <option value="ACOS">ACOS</option>
                        <option value="RATING">Rating</option>
                        <option value="REVIEW">Reviews</option>
                        <option value="BSR">BSR Rank</option>
                        <option value="PROFIT">Profit</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Deadline</label>
                      <input type="date" className="form-control" value={keyResultForm.deadline ? new Date(keyResultForm.deadline).toISOString().split('T')[0] : ''} onChange={(e) => setKeyResultForm({...keyResultForm, deadline: new Date(e.target.value)})} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer border-0 pt-0 p-4">
                  <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowKeyResultModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 size={16} className="animate-spin me-2" /> : <Check size={16} className="me-2" />}
                    Add Key Result
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <form onSubmit={handleCreateTask}>
                <div className="modal-header border-0 pb-0 pe-4 pt-4">
                  <h5 className="fw-bold mb-0">Create Task</h5>
                  <button type="button" className="btn-close shadow-none" onClick={() => setShowTaskModal(false)}></button>
                </div>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label smallest fw-bold text-muted text-uppercase">Task Title</label>
                    <input type="text" className="form-control" placeholder="What needs to be done?" required value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} />
                  </div>
                  <div className="mb-3">
                    <label className="form-label smallest fw-bold text-muted text-uppercase">Description</label>
                    <textarea className="form-control" rows="2" placeholder="Add details..." value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} />
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Type</label>
                      <select className="form-select" value={taskForm.type} onChange={(e) => setTaskForm({...taskForm, type: e.target.value})}>
                        {TASK_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Priority</label>
                      <select className="form-select" value={taskForm.priority} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label smallest fw-bold text-muted text-uppercase">Link to Objective (Optional)</label>
                    <select className="form-select" value={taskForm.objectiveId} onChange={(e) => setTaskForm({...taskForm, objectiveId: e.target.value, keyResultId: ''})}>
                      <option value="">No Objective</option>
                      {(objectives || []).map(o => (
                        <option key={o._id} value={o._id}>{o.title}</option>
                      ))}
                    </select>
                  </div>
                  {taskForm.objectiveId && (
                    <div className="mb-3">
                      <label className="form-label smallest fw-bold text-muted text-uppercase">Link to Key Result (Optional)</label>
                      <select className="form-select" value={taskForm.keyResultId} onChange={(e) => setTaskForm({...taskForm, keyResultId: e.target.value})}>
                        <option value="">Any Key Result</option>
                        {objectives?.find(o => o._id === taskForm.objectiveId)?.keyResults?.map(kr => (
                          <option key={kr._id} value={kr._id}>{kr.title}</option>
                        )) || []}
                      </select>
                    </div>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0 p-4">
                  <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowTaskModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 size={16} className="animate-spin me-2" /> : <Check size={16} className="me-2" />}
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Generate Confirmation Modal */}
      {showAutoGenerateModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-0 pb-0 pe-4 pt-4">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning-subtle">
                    <Zap size={24} className="text-warning" />
                  </div>
                  <div>
                    <h5 className="fw-bold mb-0">Auto-Generate Tasks</h5>
                    <p className="text-muted small mb-0">Based on ASIN analysis</p>
                  </div>
                </div>
                <button type="button" className="btn-close shadow-none" onClick={() => setShowAutoGenerateModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <p>This will analyze your ASINs and automatically generate tasks for:</p>
                <ul className="list-unstyled">
                  <li className="mb-2 d-flex align-items-center gap-2">
                    <span className="badge bg-primary">TITLE</span> Titles that need optimization
                  </li>
                  <li className="mb-2 d-flex align-items-center gap-2">
                    <span className="badge bg-primary">IMAGES</span> Low image count ASINs
                  </li>
                  <li className="mb-2 d-flex align-items-center gap-2">
                    <span className="badge bg-primary">DESCRIPTION</span> Short descriptions
                  </li>
                  <li className="mb-2 d-flex align-items-center gap-2">
                    <span className="badge bg-primary">A+ CONTENT</span> Missing A+ Content
                  </li>
                  <li className="mb-2 d-flex align-items-center gap-2">
                    <span className="badge bg-primary">LQS</span> Low listing quality scores
                  </li>
                </ul>
                <div className="alert alert-info mb-0">
                  <Zap size={16} className="me-2" />
                  Tasks will be grouped by category and can be viewed in the Auto-Tasks tab.
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 p-4">
                <button type="button" className="btn btn-light rounded-pill px-4" onClick={() => setShowAutoGenerateModal(false)}>Cancel</button>
                <button type="button" className="btn btn-warning rounded-pill px-4 d-flex align-items-center gap-2" onClick={handleAutoGenerateTasks} disabled={autoGenerating}>
                  {autoGenerating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  {autoGenerating ? 'Generating...' : 'Generate Tasks'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionsPage;