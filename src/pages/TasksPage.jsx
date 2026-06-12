import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../services/db';
import ActionListEnhanced from '../components/actions/ActionListEnhanced';
import ActionModal from '../components/actions/ActionModal';
import ObjectiveManager from '../components/actions/ObjectiveManager';
import CompletionModal from '../components/actions/CompletionModal';
import ReviewModal from '../components/actions/ReviewModal';
import BrandTaskView from '../components/actions/BrandTaskView';
import BrandTaskWizard from '../components/actions/BrandTaskWizard';
import {
  Plus, Calendar, AlertTriangle, List, BarChart2, TrendingUp,
  ClipboardList, Search, LayoutGrid, Activity, CheckCircle2,
  Clock, XCircle, PlayCircle, Target, Sparkles, Filter,
  ArrowUpRight, Trash2, Zap, FileText, Users, Award,
  TrendingDown, X, Building2
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import {
  Space, Button, Segmented, Modal, Divider,
  message as antdMessage, Typography, Spin, Tag, Tooltip
} from 'antd';

const { Title, Text } = Typography;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const formatNumber = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  const num = Math.round(val);
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('en-IN');
};

// ═══════════════════════════════════════════════════════════════
// STAT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════
const StatCard = ({ icon: Icon, label, value, color, animate, highlight }) => (
  <div
    className={`task-stat-premium ${highlight ? 'highlight-card' : ''}`}
    style={{
      background: highlight ? `${color}08` : '#ffffff',
      border: `1px solid ${highlight ? `${color}30` : '#e2e8f0'}`,
      borderRadius: 12,
      padding: '10px 14px',
      minWidth: 110,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'default',
      position: 'relative',
      overflow: 'hidden'
    }}
  >
    {/* Top accent for highlighted */}
    {highlight && (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: color
      }} />
    )}

    <div style={{
      width: 32,
      height: 32,
      borderRadius: 9,
      background: `${color}12`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color,
      flexShrink: 0
    }}>
      <Icon
        size={15}
        strokeWidth={2.5}
        className={animate ? 'spin-animation' : ''}
      />
    </div>

    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 18,
        fontWeight: 800,
        color: highlight ? color : '#0f172a',
        letterSpacing: '-0.3px',
        lineHeight: 1
      }}>
        {formatNumber(value)}
      </div>
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginTop: 3
      }}>
        {label}
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// FILTER PILL COMPONENT
// ═══════════════════════════════════════════════════════════════
const FilterPill = ({ pill, isActive, onClick }) => {
  if (pill.isDivider) {
    return (
      <div style={{
        width: 1,
        height: 20,
        background: '#cbd5e1',
        margin: '0 6px',
        flexShrink: 0
      }} />
    );
  }

  return (
    <button
      onClick={() => onClick(pill.type)}
      className="filter-pill-premium"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        borderRadius: 16,
        border: `1.5px solid ${isActive ? pill.color : '#e2e8f0'}`,
        background: isActive ? `${pill.color}10` : '#ffffff',
        color: isActive ? pill.color : '#475569',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        boxShadow: isActive ? `0 4px 10px -2px ${pill.color}30` : 'none'
      }}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: pill.color,
        boxShadow: isActive ? `0 0 6px ${pill.color}` : 'none',
        transition: 'box-shadow 0.2s'
      }} />
      <span style={{
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        fontSize: 10
      }}>
        {pill.label}
      </span>
      <span style={{
        background: isActive ? pill.color : '#f1f5f9',
        color: isActive ? '#ffffff' : '#475569',
        fontSize: 10,
        fontWeight: 800,
        borderRadius: 10,
        padding: '1px 7px',
        minWidth: 18,
        textAlign: 'center',
        transition: 'all 0.2s'
      }}>
        {pill.count}
      </span>
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const TasksPage = () => {
  const [messageApi, contextHolder] = antdMessage.useMessage();
  const { user: currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle('Optimization Tasks');
  }, [setPageTitle]);

  const [objectives, setObjectives] = useState([]);
  const [allActions, setAllActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [completingAction, setCompletingAction] = useState(null);
  const [reviewingAction, setReviewingAction] = useState(null);
  const [editingObjective, setEditingObjective] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isBrandWizardOpen, setIsBrandWizardOpen] = useState(false);
  const [viewMode, setViewMode] = useState('STRATEGIC');
  const [searchParams, setSearchParams] = useSearchParams();

  const activeFilter = searchParams.get('filter') || 'ALL';
  const searchQuery = searchParams.get('q') || '';
  const selectedKeyResultIdFromUrl = searchParams.get('krId');

  const [selectedKeyResultId, setSelectedKeyResultId] = useState(selectedKeyResultIdFromUrl);
  const [users, setUsers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [asins, setAsins] = useState([]);

  // KPI States
  const [kpis, setKpis] = useState({
    all: 0, todo: 0, overdue: 0, tomorrow: 0, upcoming: 0,
    status: { pending: 0, inProgress: 0, review: 0, completed: 0, rejected: 0 }
  });

  const navigate = useNavigate();

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════
  const loadData = async () => {
    setLoading(true);
    try {
      const objectivesData = await db.getObjectives();
      const loadedObjectives = objectivesData?.data || objectivesData || [];
      setObjectives(loadedObjectives);

      const actionsData = await db.getActions();
      const loadedActions = actionsData?.data || actionsData || [];

      calculateKPIs(loadedObjectives, loadedActions);

      const usersRes = await db.getUsers();
      if (usersRes && usersRes.success !== false) {
        const usersList = Array.isArray(usersRes) ? usersRes : (usersRes.data?.users || usersRes.data || []);
        setUsers(Array.isArray(usersList) ? usersList : []);
      }

      const sellersRes = await db.getSellers();
      if (sellersRes) {
        const sellersList = Array.isArray(sellersRes) ? sellersRes : (sellersRes.sellers || sellersRes.data || []);
        setSellers(Array.isArray(sellersList) ? sellersList : []);
      }

      const asinsRes = await db.getAsins();
      if (asinsRes && asinsRes.success !== false) setAsins(Array.isArray(asinsRes) ? asinsRes : asinsRes.asins || asinsRes.data || []);

    } catch (error) {
      console.error('Failed to load OKR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addToast = (message, type = 'success') => {
    if (type === 'danger' || type === 'error') {
      messageApi.error(message);
    } else {
      messageApi.success(message);
    }
  };

  const calculateKPIs = (objs, directActions = []) => {
    const actions = [...directActions];

    objs.forEach(obj => {
      if (obj.keyResults) {
        obj.keyResults.forEach(kr => {
          if (kr.actions) {
            kr.actions.forEach(a => {
              const id = a._id || a.id;
              if (!actions.some(existing => (existing._id || existing.id) === id)) {
                actions.push(a);
              }
            });
          }
        });
      }
    });

    setAllActions(actions);

    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(tomorrow.getDate() + 1);

    const counts = {
      all: actions.length, todo: 0, overdue: 0, tomorrow: 0, upcoming: 0,
      status: { pending: 0, inProgress: 0, review: 0, completed: 0, rejected: 0 }
    };

    actions.forEach(a => {
      const currentStatus = String(a.status || a.Status || 'PENDING').toUpperCase();
      let statusKey = 'pending';
      if (currentStatus === 'IN_PROGRESS') statusKey = 'inProgress';
      else if (currentStatus === 'COMPLETED' || currentStatus === 'DONE') statusKey = 'completed';
      else if (currentStatus === 'REVIEW' || currentStatus === 'IN_REVIEW') statusKey = 'review';
      else if (currentStatus === 'REJECTED') statusKey = 'rejected';
      else statusKey = 'pending';

      if (counts.status[statusKey] !== undefined) {
        counts.status[statusKey]++;
      }

      if (currentStatus !== 'COMPLETED') {
        counts.todo++;
        const deadlineVal = a.timeTracking?.deadline || a.DueDate;
        if (deadlineVal) {
          const deadline = new Date(deadlineVal);
          if (deadline < now) counts.overdue++;
          else if (deadline >= tomorrow && deadline < dayAfter) counts.tomorrow++;
          else if (deadline >= dayAfter) counts.upcoming++;
        }
      }
    });

    setKpis(counts);
  };

  useEffect(() => {
    loadData();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS (Same as before - all functionality preserved)
  // ═══════════════════════════════════════════════════════════════
  const handleCreateObjective = () => {
    setEditingObjective(null);
    setIsObjectiveModalOpen(true);
  };

  const handleCreateAction = () => {
    setEditingAction(null);
    setIsActionModalOpen(true);
  };

  const handleEdit = (item, type = 'ACTION') => {
    if (type === 'ACTION') {
      setEditingAction(item);
      setIsActionModalOpen(true);
    } else if (type === 'OBJECTIVE') {
      setEditingObjective(item);
      setIsObjectiveModalOpen(true);
    } else if (type === 'KR') {
      const newTitle = prompt('Update Key Result Title:', item.title);
      if (newTitle) {
        db.updateKeyResult(item._id || item.id, { title: newTitle }).then(() => loadData());
      }
    }
  };

  const handleDelete = (id, type = 'ACTION') => {
    Modal.confirm({
      title: `Delete this ${type.toLowerCase()}?`,
      content: `Are you sure you want to delete this ${type.toLowerCase()}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          if (type === 'ACTION') {
            await db.deleteAction(id);
          } else if (type === 'OBJECTIVE') {
            await db.deleteObjective(id);
          } else if (type === 'KR') {
            await db.deleteKeyResult(id);
          }
          loadData();
          addToast(`${type} deleted successfully`, 'success');
        } catch (error) {
          console.error(`Failed to delete ${type}`, error);
          addToast(`Failed to delete ${type}`, 'danger');
        }
      }
    });
  };

  const handleDeleteAll = () => {
    const totalObjectives = objectives.length;
    Modal.confirm({
      title: '⚠️ Permanent Deletion Prompt',
      content: `This will permanently delete ALL ${totalObjectives} objectives, their key results, and ALL actions from the database. This cannot be undone. Continue?`,
      okText: 'Delete All Data',
      okType: 'danger',
      cancelText: 'Cancel',
      centered: true,
      onOk: async () => {
        try {
          await db.deleteAllObjectives();
          addToast(`All objectives, key results, and actions deleted successfully`, 'success');
          loadData();
        } catch (error) {
          console.error('Failed to delete all data', error);
          addToast('Failed to delete all data', 'danger');
        }
      }
    });
  };

  const handleAddActionForKR = (krId) => {
    setSelectedKeyResultId(krId);
    setEditingAction(null);
    setIsActionModalOpen(true);
  };

  const handleSaveAction = async (data) => {
    try {
      if (data._id || data.id) {
        await db.updateAction(data._id || data.id, data);
      } else {
        await db.createAction(data);
      }
      setIsActionModalOpen(false);
      loadData();
      setSelectedKeyResultId(null);
      addToast('Action saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save action', error);
      addToast('Failed to save action', 'danger');
    }
  };

  const handleStartTask = async (action) => {
    const id = action?._id || action?.id || action;
    try {
      await db.startAction(id);
      loadData();
      addToast('Task marked as in progress', 'success');
    } catch (error) {
      console.error('Failed to start task:', error);
      addToast('Failed to start task', 'danger');
    }
  };

  const handleCompleteTask = async (action, data) => {
    const id = action?._id || action?.id || action;
    try {
      setLoading(true);
      await db.completeAction(id, data);
      setIsCompletionModalOpen(false);
      setCompletingAction(null);
      loadData();
      addToast('Task completed successfully', 'success');
    } catch (error) {
      console.error('Failed to complete task:', error);
      addToast('Failed to complete task', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForReview = (action) => {
    setCompletingAction(action);
    setIsCompletionModalOpen(true);
  };

  const handleCompletionSubmit = async (actionId, data) => {
    try {
      setLoading(true);

      if (data.stage === 'REVIEW') {
        await db.submitActionForReview(actionId, data);
        addToast('Submitted for review', 'success');
      } else {
        await db.completeAction(actionId, data);
        addToast('Task completed successfully', 'success');
      }

      setIsCompletionModalOpen(false);
      setCompletingAction(null);
      loadData();
    } catch (error) {
      console.error('Failed to process task completion:', error);
      messageApi.error('Action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (action, decision, comments) => {
    if (!action) return;

    try {
      setLoading(true);
      await db.reviewAction(action._id || action.id, decision, comments);
      await loadData();

      if (decision === 'APPROVE') {
        addToast(`Task "${action.title}" approved successfully!`, 'success');
      } else {
        addToast(`Task "${action.title}" rejected and moved back to pending.`, 'danger');
      }

      return true;
    } catch (error) {
      console.error('Failed to review action:', error);
      addToast('Review failed. Please try again.', 'danger');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (action) => {
    setReviewingAction(action);
    setIsReviewModalOpen(true);
  };

  const handleCreateBrandTask = () => {
    setIsBrandWizardOpen(true);
  };

  const handleSaveBulkTasks = async (tasks) => {
    try {
      setLoading(true);
      const promises = tasks.map(task => db.createAction(task));
      await Promise.all(promises);
      setIsBrandWizardOpen(false);
      loadData();
      addToast(`${tasks.length} brand task${tasks.length !== 1 ? 's' : ''} created successfully`, 'success');
    } catch (error) {
      console.error('Failed to create brand tasks:', error);
      addToast('Failed to create brand tasks', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const handleAISuggest = async (kr) => {
    try {
      setLoading(true);
      const result = await db.getAISuggestions(kr.title);

      if (result && result.success && result.data) {
        const tasks = Array.isArray(result.data) ? result.data : (result.data.tasks || []);

        const taskPromises = tasks.map(task => {
          return db.createAction({
            title: task.title || task.name || 'Suggested Task',
            type: task.type || 'GENERAL_OPTIMIZATION',
            priority: task.priority || 'MEDIUM',
            keyResultId: kr.id || kr._id,
            status: 'PENDING',
            description: task.description || `AI suggested task for: ${kr.title}`
          });
        });

        await Promise.all(taskPromises);
        loadData();
        messageApi.success('AI Suggestions generated successfully');
      }
    } catch (error) {
      console.error('AI Suggestion failed', error);
      messageApi.error('AI Suggestion failed. Please check your configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterClick = (filterType) => {
    const newFilter = activeFilter === filterType ? 'ALL' : filterType;
    setSearchParams(prev => {
      if (newFilter === 'ALL') {
        prev.delete('filter');
      } else {
        prev.set('filter', newFilter);
      }
      return prev;
    });
  };

  const handleSearchChange = (query) => {
    setSearchParams(prev => {
      if (!query) {
        prev.delete('q');
      } else {
        prev.set('q', query);
      }
      return prev;
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // COMPLETION RATE
  // ═══════════════════════════════════════════════════════════════
  const completionRate = useMemo(() => {
    if (kpis.all === 0) return 0;
    return Math.round((kpis.status.completed / kpis.all) * 100);
  }, [kpis]);

  // Pill options mapping
  const filterPills = [
    { type: 'ALL', label: 'All', count: kpis.all, color: '#6366f1' },
    { type: 'TODO', label: 'To Do', count: kpis.todo, color: '#3b82f6' },
    { type: 'OVERDUE', label: 'Overdue', count: kpis.overdue, color: '#ef4444' },
    { type: 'TOMORROW', label: 'Tomorrow', count: kpis.tomorrow, color: '#f59e0b' },
    { type: 'UPCOMING', label: 'Upcoming', count: kpis.upcoming, color: '#06b6d4' },
    { isDivider: true },
    { type: 'PENDING', label: 'Pending', count: kpis.status.pending, color: '#f59e0b' },
    { type: 'IN_PROGRESS', label: 'In Progress', count: kpis.status.inProgress, color: '#3b82f6' },
    { type: 'REVIEW', label: 'Review', count: kpis.status.review, color: '#06b6d4' },
    { type: 'REJECTED', label: 'Rejected', count: kpis.status.rejected, color: '#ef4444' },
    { type: 'COMPLETED', label: 'Completed', count: kpis.status.completed, color: '#10b981' },
  ];

  const isAdmin = currentUser?.role?.name === 'admin' || currentUser?.role === 'admin';

  return (
    <div className="tasks-page-container">
      {contextHolder}

      {/* ═══════════════════════════════════════════════════
          1. PREMIUM HEADER
      ═══════════════════════════════════════════════════ */}
      <div className="tasks-header-premium">
        {/* Decorative gradient */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          {/* LEFT: Title with Icon */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="page-header-icon-badge" style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.5)',
              position: 'relative',
              flexShrink: 0
            }}>
              <ClipboardList size={22} strokeWidth={2.5} />
              <span className="status-pulse-dot" style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 12,
                height: 12,
                background: '#10b981',
                border: '2px solid #ffffff',
                borderRadius: '50%'
              }} />
            </div>

            <div>
              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#7c3aed',
                  background: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  padding: '2px 8px',
                  borderRadius: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}>
                  <Sparkles size={9} strokeWidth={2.5} />
                  Strategy Workbench
                </span>
              </div>

              <h1 style={{
                margin: 0,
                fontSize: 20,
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.5px',
                lineHeight: 1.2
              }}>
                Task Matrix & OKR Operations
              </h1>
              <Text style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'block' }}>
                Synthesize objectives, orchestrate key results & track optimization protocols
              </Text>
            </div>
          </div>

          {/* RIGHT: Stats Cards */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <StatCard
              icon={Target}
              label="Total"
              value={kpis.all}
              color="#6366f1"
            />
            <StatCard
              icon={Clock}
              label="Outstanding"
              value={kpis.todo}
              color="#3b82f6"
            />
            {kpis.overdue > 0 && (
              <StatCard
                icon={AlertTriangle}
                label="Overdue"
                value={kpis.overdue}
                color="#ef4444"
                highlight
              />
            )}
            {kpis.status.review > 0 && (
              <StatCard
                icon={Activity}
                label="In Review"
                value={kpis.status.review}
                color="#f59e0b"
                highlight
                animate
              />
            )}
            {completionRate > 0 && (
              <StatCard
                icon={Award}
                label="Completion"
                value={`${completionRate}%`}
                color={completionRate >= 70 ? '#10b981' : completionRate >= 40 ? '#f59e0b' : '#64748b'}
              />
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          2. CONTROL STRIP (View + Search + Actions)
      ═══════════════════════════════════════════════════ */}
      <div className="tasks-control-strip">
        {/* LEFT: View Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 10,
            fontWeight: 800,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}>
            <LayoutGrid size={11} strokeWidth={2.5} />
            View
          </span>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              {
                label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <List size={12} strokeWidth={2.5} /> Strategic
                </span>,
                value: 'STRATEGIC'
              },
              {
                label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <BarChart2 size={12} strokeWidth={2.5} /> Kanban
                </span>,
                value: 'BOARD'
              },
              {
                label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Calendar size={12} strokeWidth={2.5} /> Registry
                </span>,
                value: 'FLAT'
              },
              {
                label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={12} strokeWidth={2.5} /> Brand View
                </span>,
                value: 'BRAND'
              }
            ]}
            className="segmented-tasks-premium"
          />
        </div>

        {/* RIGHT: Search + Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: 240 }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8'
              }}
              strokeWidth={2.5}
            />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="task-search-input"
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 10,
                border: '1.5px solid #e2e8f0',
                background: '#ffffff',
                outline: 'none',
                transition: 'all 0.2s',
                color: '#0f172a'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: '#f1f5f9',
                  border: 'none',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            )}
          </div>

          <Tooltip title="View Performance Report">
            <button
              onClick={() => navigate('/actions/achievement-report')}
              className="header-action-btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 13px',
                background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                color: '#7c3aed',
                border: '1px solid #ddd6fe',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: 34
              }}
            >
              <TrendingUp size={12} strokeWidth={2.5} />
              Performance
            </button>
          </Tooltip>

          {viewMode === 'BRAND' && (
            <button
              onClick={handleCreateBrandTask}
              className="header-action-btn-brand"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 13px',
                background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                color: '#7c3aed',
                border: '1px solid #c4b5fd',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                height: 34
              }}
            >
              <Building2 size={12} strokeWidth={2.5} />
              Brand Task
            </button>
          )}

          <div style={{ width: 1, height: 22, background: '#e2e8f0', margin: '0 2px' }} />

          <button
            onClick={handleCreateAction}
            className="header-action-btn-default"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 13px',
              background: '#ffffff',
              color: '#475569',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              height: 34
            }}
          >
            <Zap size={12} strokeWidth={2.5} />
            Quick Task
          </button>

          <button
            onClick={handleCreateObjective}
            className="header-action-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px -2px rgba(99, 102, 241, 0.4)',
              height: 34
            }}
          >
            <Plus size={13} strokeWidth={2.5} />
            New Project
          </button>

          {isAdmin && (
            <Tooltip title="Admin: Delete all data">
              <button
                onClick={handleDeleteAll}
                className="header-action-btn-danger"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '7px 10px',
                  background: '#fef2f2',
                  color: '#ef4444',
                  border: '1.5px dashed #fecaca',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  height: 34
                }}
              >
                <Trash2 size={12} strokeWidth={2.5} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          3. FILTER PILLS RIBBON
      ═══════════════════════════════════════════════════ */}
      <div className="tasks-filter-ribbon">
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10,
          fontWeight: 800,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginRight: 10,
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}>
          <Filter size={11} strokeWidth={2.5} />
          Filters
        </span>

        <div style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexWrap: 'nowrap',
          overflowX: 'auto'
        }} className="scrollbar-hidden">
          {filterPills.map((pill, idx) => (
            <FilterPill
              key={pill.type || `divider-${idx}`}
              pill={pill}
              isActive={activeFilter === pill.type}
              onClick={handleFilterClick}
            />
          ))}
        </div>

        {/* Active filter indicator */}
        {(activeFilter !== 'ALL' || searchQuery) && (
          <button
            onClick={() => {
              setSearchParams(prev => {
                prev.delete('filter');
                prev.delete('q');
                return prev;
              });
            }}
            style={{
              marginLeft: 'auto',
              padding: '4px 10px',
              background: '#fef2f2',
              color: '#ef4444',
              border: '1px solid #fecaca',
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s',
              flexShrink: 0
            }}
          >
            <X size={11} strokeWidth={2.5} />
            Clear
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          4. TASKS CONTENT AREA
      ═══════════════════════════════════════════════════ */}
      <div className="tasks-scroll-content animate-fade-up">
        {loading ? (
          <div style={{
            display: 'flex',
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #eef2ff 0%, #ddd6fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #c7d2fe'
            }}>
              <Spin size="large" />
            </div>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              Syncing Optimization Matrix...
            </div>
          </div>
        ) : viewMode === 'BRAND' ? (
          <div style={{ flex: 1 }}>
            <BrandTaskView
              actions={allActions}
              sellers={sellers}
              currentUser={currentUser}
              activeFilter={activeFilter}
              searchQuery={searchQuery}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onStart={handleStartTask}
              onSubmitForReview={handleSubmitForReview}
              onReviewAction={(action) => openReviewModal(action)}
              onCreateBrandTask={handleCreateBrandTask}
            />
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <ActionListEnhanced
              objectives={objectives}
              actions={allActions}
              standaloneActions={allActions.filter(a => !a.GoalId && !a.ObjectiveId && !a.KeyResultId && !a.keyResultId)}
              loading={loading}
              activeFilter={activeFilter}
              searchQuery={searchQuery}
              currentUser={currentUser}
              onSearchChange={handleSearchChange}
              onEdit={handleEdit}
              onAddAction={handleAddActionForKR}
              onAISuggest={handleAISuggest}
              onDelete={handleDelete}
              onStartTask={handleStartTask}
              onCompleteTask={handleCompleteTask}
              onSubmitForReview={handleSubmitForReview}
              onReviewAction={(action) => openReviewModal(action)}
              viewMode={viewMode}
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
          MODALS (Same as before)
      ═══════════════════════════════════════════════════ */}
      <Modal
        open={isObjectiveModalOpen}
        onCancel={() => {
          setIsObjectiveModalOpen(false);
          setEditingObjective(null);
        }}
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
          onClose={() => {
            setIsObjectiveModalOpen(false);
            setEditingObjective(null);
          }}
          onObjectiveCreated={() => {
            setIsObjectiveModalOpen(false);
            setEditingObjective(null);
            loadData();
          }}
        />
      </Modal>

      <ActionModal
        isOpen={isActionModalOpen}
        onClose={() => {
          setIsActionModalOpen(false);
          setEditingAction(null);
          setSelectedKeyResultId(null);
        }}
        onSave={handleSaveAction}
        action={editingAction}
        currentUser={currentUser}
        asins={asins}
        users={users}
        sellers={sellers}
        initialKeyResultId={selectedKeyResultId}
      />

      <ReviewModal
        isOpen={isReviewModalOpen}
        action={reviewingAction}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewingAction(null);
        }}
        onReview={handleReviewAction}
      />

      <BrandTaskWizard
        isOpen={isBrandWizardOpen}
        onClose={() => setIsBrandWizardOpen(false)}
        sellers={sellers}
        asins={asins}
        users={users}
        onSaveMultiple={handleSaveBulkTasks}
      />

      {isCompletionModalOpen && completingAction && (
        <CompletionModal
          isOpen={isCompletionModalOpen}
          action={completingAction}
          onClose={() => {
            setIsCompletionModalOpen(false);
            setCompletingAction(null);
          }}
          onComplete={handleCompletionSubmit}
        />
      )}

      {/* ═══════════════════════════════════════════════════
          STYLES
      ═══════════════════════════════════════════════════ */}
      <style>{`
        .tasks-page-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 60px);
          overflow: hidden;
          background-color: #f8fafc;
          margin: -1.5rem -2rem;
        }

        .tasks-header-premium {
          background: linear-gradient(135deg, #ffffff 0%, #fafbff 100%);
          padding: 18px 24px;
          border-bottom: 1px solid #e2e8f0;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }

        .tasks-control-strip {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 24px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
          flex-wrap: wrap;
          gap: 16px;
          flex-shrink: 0;
        }

        .tasks-filter-ribbon {
          padding: 10px 24px;
          background: linear-gradient(180deg, #fafbfc 0%, #f8fafc 100%);
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .tasks-scroll-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
        }

        .task-stat-premium:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.06);
          border-color: #cbd5e1 !important;
        }
        .task-stat-premium.highlight-card:hover {
          border-color: currentColor !important;
        }

        .filter-pill-premium:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px -2px rgba(0, 0, 0, 0.06);
          border-color: currentColor !important;
        }

        .task-search-input:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
        }
        .task-search-input:hover {
          border-color: #cbd5e1 !important;
        }
        .task-search-input::placeholder {
          color: #94a3b8;
          font-weight: 500;
        }

        .header-action-btn-default:hover {
          background: #f8fafc !important;
          border-color: #cbd5e1 !important;
          color: #0f172a !important;
          transform: translateY(-1px);
        }

        .header-action-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px -2px rgba(99, 102, 241, 0.5) !important;
        }

        .header-action-btn-secondary:hover {
          background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%) !important;
          border-color: #c4b5fd !important;
          transform: translateY(-1px);
        }

        .header-action-btn-danger:hover {
          background: #fee2e2 !important;
          transform: translateY(-1px);
        }

        .header-action-btn-brand:hover {
          background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%) !important;
          border-color: #a78bfa !important;
          transform: translateY(-1px);
        }

        .segmented-tasks-premium .ant-segmented-item-selected {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          box-shadow: 0 4px 8px -2px rgba(99, 102, 241, 0.4) !important;
        }
        .segmented-tasks-premium .ant-segmented-item-selected .ant-segmented-item-label {
          color: #ffffff !important;
        }
        .segmented-tasks-premium .ant-segmented-item {
          font-weight: 600;
          font-size: 11px;
          color: #475569;
        }

        @keyframes pulse-status {
          0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
          50% { transform: scale(1.15); opacity: 0.9; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0); }
        }
        .status-pulse-dot {
          animation: pulse-status 2s ease-in-out infinite;
        }

        @keyframes spin-animation {
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin-animation 1.5s linear infinite;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hidden {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        @media (max-width: 992px) {
          .tasks-page-container {
            margin: -0.75rem;
            height: auto;
            overflow: visible;
          }
        }
      `}</style>
    </div>
  );
};

export default TasksPage;