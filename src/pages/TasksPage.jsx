import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import ActionListEnhanced from '../components/actions/ActionListEnhanced';
import ActionModal from '../components/actions/ActionModal';
import ObjectiveManager from '../components/actions/ObjectiveManager';
import CompletionModal from '../components/actions/CompletionModal';
import ReviewModal from '../components/actions/ReviewModal';
import { Plus, Calendar, AlertTriangle, List, BarChart2, TrendingUp, ClipboardList, Search } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { 
  Space, Button, Segmented, Modal, Divider, 
  message as antdMessage, Typography, Spin, Tag, Badge
} from 'antd';

const { Title, Text } = Typography;

const TasksPage = () => {
  const [messageApi, contextHolder] = antdMessage.useMessage();
  const { user: currentUser } = useAuth();
  const { setPageTitle } = usePageTitle();
  
  useEffect(() => {
    setPageTitle('Optimization Tasks');
  }, [setPageTitle]);

  const [objectives, setObjectives] = useState([]);
  const [allActions, setAllActions] = useState([]); // Flatted actions for KPIs
  const [loading, setLoading] = useState(true);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState(false);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [editingAction, setEditingAction] = useState(null);
  const [completingAction, setCompletingAction] = useState(null);
  const [reviewingAction, setReviewingAction] = useState(null);
  const [editingObjective, setEditingObjective] = useState(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('STRATEGIC');
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeFilter = searchParams.get('filter') || 'ALL';
  const searchQuery = searchParams.get('q') || '';
  const selectedKeyResultIdFromUrl = searchParams.get('krId');

  const [selectedKeyResultId, setSelectedKeyResultId] = useState(selectedKeyResultIdFromUrl); // Track target KR for new action
  const [users, setUsers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [asins, setAsins] = useState([]);

  // KPI States
  const [kpis, setKpis] = useState({
    all: 0,
    todo: 0,
    overdue: 0,
    tomorrow: 0,
    upcoming: 0,
    status: {
      pending: 0,
      inProgress: 0,
      review: 0,
      completed: 0,
      rejected: 0
    }
  });

  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch Objectives with full hierarchy
      const objectivesData = await db.getObjectives();
      const loadedObjectives = objectivesData?.data || objectivesData || [];
      setObjectives(loadedObjectives);

      // Fetch All Actions directly from Database
      const actionsData = await db.getActions();
      const loadedActions = actionsData?.data || actionsData || [];

      calculateKPIs(loadedObjectives, loadedActions);

      // Fetch Users, Sellers & ASINs for assignment/tagging
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

    // Flatten actions from hierarchy (avoid duplicate IDs)
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
      all: actions.length,
      todo: 0,
      overdue: 0,
      tomorrow: 0,
      upcoming: 0,
      status: {
        pending: 0,
        inProgress: 0,
        review: 0,
        completed: 0,
        rejected: 0
      }
    };

    actions.forEach(a => {
      // Status Counts
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

      // High Level KPIs
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
      // Use simple prompt
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

  const handleAISuggest = async (kr) => {
    try {
      setLoading(true);
      const result = await db.getAISuggestions(kr.title);

      if (result && result.success && result.data) {
        console.log('AI Suggestions Received:', result.data);
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
        loadData(); // Reload to show new tasks
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

  // Pill options mapping
  const filterPills = [
    { type: 'ALL', label: 'All', count: kpis.all, color: '#64748b', activeStyle: { background: '#3b82f6', color: '#ffffff', borderColor: '#3b82f6' } },
    { type: 'TODO', label: 'To Do', count: kpis.todo, color: '#3b82f6', activeStyle: { background: '#eff6ff', color: '#1d4ed8', borderColor: '#3b82f6' } },
    { type: 'OVERDUE', label: 'Overdue', count: kpis.overdue, color: '#ef4444', activeStyle: { background: '#fef2f2', color: '#b91c1c', borderColor: '#ef4444' } },
    { type: 'TOMORROW', label: 'Tomorrow', count: kpis.tomorrow, color: '#f59e0b', activeStyle: { background: '#fffbeb', color: '#b45309', borderColor: '#f59e0b' } },
    { type: 'UPCOMING', label: 'Upcoming', count: kpis.upcoming, color: '#06b6d4', activeStyle: { background: '#ecfeff', color: '#0e7490', borderColor: '#06b6d4' } },
    { isDivider: true },
    { type: 'PENDING', label: 'Pending', count: kpis.status.pending, color: '#f59e0b', activeStyle: { background: '#fffbeb', color: '#b45309', borderColor: '#f59e0b' } },
    { type: 'IN_PROGRESS', label: 'In Progress', count: kpis.status.inProgress, color: '#3b82f6', activeStyle: { background: '#eff6ff', color: '#1d4ed8', borderColor: '#3b82f6' } },
    { type: 'REVIEW', label: 'Review', count: kpis.status.review, color: '#06b6d4', activeStyle: { background: '#ecfeff', color: '#0e7490', borderColor: '#06b6d4' } },
    { type: 'REJECTED', label: 'Rejected', count: kpis.status.rejected, color: '#ef4444', activeStyle: { background: '#fef2f2', color: '#b91c1c', borderColor: '#ef4444' } },
    { type: 'COMPLETED', label: 'Completed', count: kpis.status.completed, color: '#10b981', activeStyle: { background: '#f0fdf4', color: '#047857', borderColor: '#10b981' } },
  ];

  return (
    <div className="tasks-page-container">
      {contextHolder}
      <style>{`
        .tasks-page-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 60px);
          overflow: hidden;
          background-color: #f8fafc;
          margin: -1.5rem -2rem;
        }
        .tasks-header {
          background: #ffffff;
          padding: 18px 24px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 16px;
        }
        .tasks-scroll-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
        }
        .task-stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 8px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-width: 100px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
          transition: all 0.2s ease;
        }
        .task-stat-card:hover {
          border-color: #cbd5e1;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.04);
        }
        .task-stat-card .task-stat-label {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }
        .task-stat-card .task-stat-value {
          font-size: 18px;
          font-weight: 800;
        }
        .task-stat-card.highlight-overdue {
          background: #fff5f5;
          border-color: #feb2b2;
        }
        .task-stat-card.highlight-review {
          background: #fffaf0;
          border-color: #fbd38d;
        }
        .scrollbar-hidden::-webkit-scrollbar {
          display: none;
        }
        .segmented-tasks .ant-segmented-item-selected {
          background-color: #3b82f6 !important;
          color: #ffffff !important;
          font-weight: 700 !important;
        }
        .segmented-tasks .ant-segmented-item {
          font-weight: 600;
          font-size: 11.5px;
          color: #475569;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fadeInUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @media (max-width: 992px) {
          .tasks-page-container {
            margin: -0.75rem;
            height: auto;
            overflow: visible;
          }
        }
      `}</style>

      {/* 1. PREMIUM HEADER PANEL */}
      <div className="tasks-header">
        <div>
          <Space align="center" size={12}>
            <div style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)', color: '#4f46e5', padding: 10, borderRadius: 12, display: 'flex', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.1)' }}>
              <ClipboardList size={22} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Workspace Operations</div>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 18, letterSpacing: '-0.02em' }}>Strategy Workbench & Task Matrix</h3>
              <Text type="secondary" style={{ fontSize: 12 }}>Synthesize brand objectives, map key results, and orchestrate optimization protocols.</Text>
            </div>
          </Space>
        </div>

        {/* Right Side Statistics Panel */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="task-stat-card">
            <span className="task-stat-label">Initiatives</span>
            <span className="task-stat-value text-slate-800">{kpis.all}</span>
          </div>
          <div className="task-stat-card">
            <span className="task-stat-label">Outstanding</span>
            <span className="task-stat-value text-indigo-600">{kpis.todo}</span>
          </div>
          {kpis.overdue > 0 && (
            <div className="task-stat-card highlight-overdue">
              <span className="task-stat-label">Overdue</span>
              <span className="task-stat-value text-rose-500">{kpis.overdue}</span>
            </div>
          )}
          {kpis.status.review > 0 && (
            <div className="task-stat-card highlight-review">
              <span className="task-stat-label">In Review</span>
              <span className="task-stat-value text-amber-500">{kpis.status.review}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. DYNAMIC WORKBENCH CONTROL STRIP */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 24px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        flexWrap: 'wrap',
        gap: 16
      }}>
        {/* Left Side: View Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 750, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>View Mode:</span>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: 'Strategic Matrix', value: 'STRATEGIC', icon: <List size={13} style={{ marginRight: 4 }} /> },
              { label: 'Kanban Desk', value: 'BOARD', icon: <BarChart2 size={13} style={{ marginRight: 4 }} /> },
              { label: 'Task Registry', value: 'FLAT', icon: <Calendar size={13} style={{ marginRight: 4 }} /> }
            ]}
            className="segmented-tasks"
          />
        </div>

        {/* Right Side: Search + Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <div style={{ position: 'relative', width: 220 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              placeholder="Search current view..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px 6px 28px',
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                outline: 'none',
                transition: 'all 0.2s',
                fontWeight: 500
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.background = '#ffffff';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.background = '#f8fafc';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <Button 
            type="text" 
            onClick={() => navigate('/actions/achievement-report')} 
            icon={<TrendingUp size={13} />}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 12, color: '#4f46e5', borderRadius: 8 }}
          >
            Performance
          </Button>
          
          <Divider orientation="vertical" style={{ height: 16, borderColor: '#e2e8f0', margin: '0 2px' }} />

          <Button 
            type="default" 
            onClick={handleCreateAction} 
            shape="round" 
            icon={<Plus size={13} />} 
            style={{ display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 12, borderRadius: 8, height: 32 }}
          >
            Quick Task
          </Button>
          
          <Button 
            type="primary" 
            onClick={handleCreateObjective} 
            shape="round" 
            style={{ display: 'flex', alignItems: 'center', backgroundColor: '#3b82f6', borderColor: '#3b82f6', fontWeight: 700, fontSize: 12, borderRadius: 8, height: 32 }} 
            icon={<BarChart2 size={13} />}
          >
            New Project
          </Button>

          {(currentUser?.role?.name === 'admin' || currentUser?.role === 'admin') && (
            <Button 
              danger 
              type="dashed"
              onClick={handleDeleteAll} 
              shape="round" 
              style={{ display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 12, borderRadius: 8, height: 32 }} 
              icon={<AlertTriangle size={13} />}
              title="Admin: Delete all actions"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* 3. SCROLLABLE QUICK FILTERS RIBBON */}
      <div style={{
        padding: '10px 24px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        gap: 6,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }} className="scrollbar-hidden">
        <span style={{ fontSize: 10, fontWeight: 750, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 8, whiteSpace: 'nowrap' }}>
          Quick Filters:
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {filterPills.map((pill, idx) => {
            if (pill.isDivider) {
              return <Divider orientation="vertical" key={`div-${idx}`} style={{ height: 14, margin: '0 4px', borderColor: '#cbd5e1' }} />;
            }

            const isActive = activeFilter === pill.type;
            const dotBg = pill.color;

            return (
              <Tag
                key={pill.type}
                onClick={() => handleFilterClick(pill.type)}
                style={{
                  cursor: 'pointer',
                  padding: '3px 10px',
                  borderRadius: '16px',
                  fontSize: '11px',
                  fontWeight: 600,
                  transition: 'all 0.2s ease',
                  border: isActive ? `1px solid ${pill.color}` : '1px solid #cbd5e1',
                  background: isActive ? `${pill.color}15` : '#ffffff',
                  color: isActive ? pill.color : '#475569',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  userSelect: 'none',
                  boxShadow: isActive ? `0 2px 6px ${pill.color}25` : 'none',
                  margin: 0
                }}
              >
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: dotBg }} />
                <span style={{ textTransform: 'uppercase', letterSpacing: '0.01em', fontSize: '9.5px', whiteSpace: 'nowrap' }}>{pill.label}</span>
                <span style={{
                  background: isActive ? pill.color : '#f1f5f9',
                  color: isActive ? '#ffffff' : '#475569',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  borderRadius: '10px',
                  padding: '0px 5px',
                  minWidth: '16px',
                  textAlign: 'center',
                  display: 'inline-block'
                }}>{pill.count}</span>
              </Tag>
            );
          })}
        </div>
      </div>

      {/* 4. DYNAMIC ACTION MATRIX BODY */}
      <div className="tasks-scroll-content animate-fade-up">
        {loading ? (
          <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <Spin size="large" description="Syncing Optimization Matrix..." />
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

      {/* ================= ANT DESIGN MODALS ================= */}

      {/* Objective Creation Modal Overlay */}
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

      {/* Tasks Editor Overlay Container */}
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

      {/* Action Review Overlay Container */}
      <ReviewModal
        isOpen={isReviewModalOpen}
        action={reviewingAction}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewingAction(null);
        }}
        onReview={handleReviewAction}
      />

      {/* Completing Tasks Multi-Step Modal Container */}
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
      
    </div>
  );
};

export default TasksPage;
