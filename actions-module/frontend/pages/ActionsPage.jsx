import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import ActionListEnhanced from '../components/actions/ActionListEnhanced';
import ActionModal from '../components/actions/ActionModal';
import ObjectiveManager from '../components/actions/ObjectiveManager';
import CompletionModal from '../components/actions/CompletionModal';
import ReviewModal from '../components/actions/ReviewModal';
import { Plus, CheckCircle, Clock, Calendar, AlertTriangle, List, BarChart2, TrendingUp, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ActionsPage = () => {
  const { user: currentUser } = useAuth();
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
  const [toasts, setToasts] = useState([]);
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
      calculateKPIs(loadedObjectives);

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
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const calculateKPIs = (objs) => {
    const actions = [];

    // Flatten actions from hierarchy
    objs.forEach(obj => {
      if (obj.keyResults) {
        obj.keyResults.forEach(kr => {
          if (kr.actions) {
            actions.push(...kr.actions);
          }
        });
      }
    });

    // Also fetch orphan actions if needed (omitted for now to focus on OKRs)
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
      const statusKey = a.status === 'IN_PROGRESS' ? 'inProgress' : a.status.toLowerCase();
      if (counts.status[statusKey] !== undefined) {
        counts.status[statusKey]++;
      }

      // High Level KPIs
      if (a.status !== 'COMPLETED') {
        counts.todo++;

        if (a.timeTracking?.deadline) {
          const deadline = new Date(a.timeTracking.deadline);
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
      // For now, toggle simple prompt or implementation later
      const newTitle = prompt('Update Key Result Title:', item.title);
      if (newTitle) {
        db.updateKeyResult(item._id || item.id, { title: newTitle }).then(() => loadData());
      }
    }
  };

  const handleDelete = async (id, type = 'ACTION') => {
    if (!window.confirm(`Are you sure you want to delete this ${type.toLowerCase()}? This action cannot be undone.`)) {
      return;
    }

    try {
      if (type === 'ACTION') {
        await db.deleteAction(id);
      } else if (type === 'OBJECTIVE') {
        await db.deleteObjective(id);
      } else if (type === 'KR') {
        await db.deleteKeyResult(id);
      }
      loadData();
    } catch (error) {
      console.error(`Failed to delete ${type}`, error);
    }
  };

  const handleDeleteAll = async () => {
    const totalObjectives = objectives.length;
    if (!window.confirm(`⚠️ This will permanently delete ALL ${totalObjectives} objectives, their key results, and ALL actions from the database. This cannot be undone. Continue?`)) {
      return;
    }
    try {
      await db.deleteAllObjectives();
      addToast(`All objectives, key results, and actions deleted successfully`, 'success');
      loadData();
    } catch (error) {
      console.error('Failed to delete all data', error);
      addToast('Failed to delete all data', 'danger');
    }
  };

  const handleAddActionForKR = (krId) => {
    setSelectedKeyResultId(krId);
    setEditingAction(null); // Ensure we are creating new
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
      loadData(); // Reload to refresh KPIs and hierarchy
      setSelectedKeyResultId(null); // Reset
    } catch (error) {
      console.error('Failed to save action', error);
    }
  };

  const handleDeleteAction = async (id) => {
    if (confirm('Delete this action?')) {
      await db.deleteAction(id);
      loadData();
    }
  };

  // Forward start/complete handlers to ActionListEnhanced (which handles API calls generally, but here likely needs reload)
  // Actually ActionListEnhanced has handlers, but we might want to refresh KPIs after status change
  const refreshData = () => {
    loadData();
  };

  const handleStartTask = async (action) => {
    const id = action?._id || action?.id || action;
    try {
      await db.startAction(id);
      loadData();
    } catch (error) {
      console.error('Failed to start task:', error);
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
    } catch (error) {
      console.error('Failed to complete task:', error);
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

      // Distinguish between direct completion and review submission based on modal data
      if (data.stage === 'REVIEW') {
        await db.submitActionForReview(actionId, data);
      } else {
        await db.completeAction(actionId, data);
      }

      setIsCompletionModalOpen(false);
      setCompletingAction(null);
      loadData();
    } catch (error) {
      console.error('Failed to process task completion:', error);
      alert('Action failed. Please try again.');
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
      }
    } catch (error) {
      console.error('AI Suggestion failed', error);
      alert('AI Suggestion failed. Please ensure your API key is configured.');
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


  return (
    <div className="container-fluid p-0">
      {/* Header Area */}
      <div className="d-flex justify-content-between align-items-center mb-5 mt-4">
        <div>
          <h1 className="fw-700 mb-1" style={{ fontSize: '2rem', letterSpacing: '-0.02em', color: '#1e293b' }}>
            Action <span className="text-primary">Operations</span> Hub
          </h1>
          <p className="text-muted mb-0">Strategic Performance & Tactical Oversight</p>
        </div>


        <div className="d-flex align-items-center gap-3">
          <div className="btn-group p-1 bg-white border shadow-sm rounded-pill">
            <button
              onClick={() => setViewMode('STRATEGIC')}
              className={`btn btn-sm px-3 rounded-pill border-0 transition-all ${viewMode === 'STRATEGIC' ? 'btn-primary shadow-sm' : 'text-muted hover-bg-light'}`}
              style={{ fontSize: '12px', fontWeight: '600' }}
            >
              <TrendingUp size={14} className="me-1" /> Strategic
            </button>
            <button
              onClick={() => setViewMode('OPERATIONS')}
              className={`btn btn-sm px-3 rounded-pill border-0 transition-all ${viewMode === 'OPERATIONS' ? 'btn-primary shadow-sm' : 'text-muted hover-bg-light'}`}
              style={{ fontSize: '12px', fontWeight: '600' }}
            >
              <List size={14} className="me-1" /> Operations
            </button>
          </div>

          <div className="vr mx-1 opacity-25" style={{ height: '32px' }}></div>

          <button onClick={handleCreateAction} className="btn btn-light d-flex align-items-center gap-2 rounded-pill px-3 shadow-sm border-0">
            <Plus size={18} /> Quick Task
          </button>
          <button onClick={handleCreateObjective} className="btn btn-primary d-flex align-items-center gap-2 rounded-pill px-4 shadow-sm">
            <BarChart2 size={18} /> New Project
          </button>
          {currentUser?.role?.name === 'admin' || currentUser?.role === 'admin' ? (
            <button onClick={handleDeleteAll} className="btn btn-outline-danger d-flex align-items-center gap-2 rounded-pill px-3" title="Admin: Delete all actions from database">
              <AlertTriangle size={16} /> Clear All
            </button>
          ) : null}
        </div>
      </div>

      {/* KPI Dashboard - Compact Dot Badges */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <div
          onClick={() => handleFilterClick('ALL')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'ALL' ? 'bg-primary text-white border-primary' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: activeFilter === 'ALL' ? 'white' : '#6c757d' }}></div>
          <span className={activeFilter === 'ALL' ? 'text-white' : 'text-muted text-uppercase'} style={{ fontSize: '11px', letterSpacing: '0.05em' }}>All</span>
          <span className="fw-bold">{kpis.all}</span>
        </div>

        <div
          onClick={() => handleFilterClick('TODO')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'TODO' ? 'bg-primary-subtle border-primary' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0d6efd' }}></div>
          <span className="text-muted text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>To Do</span>
          <span className="fw-bold">{kpis.todo}</span>
        </div>

        <div
          onClick={() => handleFilterClick('OVERDUE')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'OVERDUE' ? 'bg-danger-subtle border-danger' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc3545' }}></div>
          <span className="text-danger text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Overdue</span>
          <span className="fw-bold text-danger">{kpis.overdue}</span>
        </div>

        <div
          onClick={() => handleFilterClick('TOMORROW')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'TOMORROW' ? 'bg-warning-subtle border-warning' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffc107' }}></div>
          <span className="text-warning-emphasis text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Tomorrow</span>
          <span className="fw-bold">{kpis.tomorrow}</span>
        </div>

        <div
          onClick={() => handleFilterClick('UPCOMING')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'UPCOMING' ? 'bg-info-subtle border-info' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0dcaf0' }}></div>
          <span className="text-info-emphasis text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Upcoming</span>
          <span className="fw-bold">{kpis.upcoming}</span>
        </div>

        <div className="mx-1 border-end" style={{ height: '24px' }}></div>

        <div
          onClick={() => handleFilterClick('PENDING')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'PENDING' ? 'bg-warning-subtle border-warning' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ffc107' }}></div>
          <span className="text-warning-emphasis text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Pending</span>
          <span className="fw-bold">{kpis.status.pending}</span>
        </div>

        <div
          onClick={() => handleFilterClick('IN_PROGRESS')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'IN_PROGRESS' ? 'bg-primary-subtle border-primary' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0d6efd' }}></div>
          <span className="text-primary text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>In Progress</span>
          <span className="fw-bold">{kpis.status.inProgress}</span>
        </div>

        <div
          onClick={() => handleFilterClick('REVIEW')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'REVIEW' ? 'bg-info-subtle border-info' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0dcaf0' }}></div>
          <span className="text-info text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Review</span>
          <span className="fw-bold">{kpis.status.review}</span>
        </div>

        <div
          onClick={() => handleFilterClick('REJECTED')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'REJECTED' ? 'bg-danger-subtle border-danger' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#dc3545' }}></div>
          <span className="text-danger text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Rejected</span>
          <span className="fw-bold">{kpis.status.rejected}</span>
        </div>

        <div
          onClick={() => handleFilterClick('COMPLETED')}
          className={`d-flex align-items-center gap-2 px-3 py-1 rounded-pill border cursor-pointer transition-all ${activeFilter === 'COMPLETED' ? 'bg-success-subtle border-success' : 'bg-white border-light-subtle shadow-sm'}`}
          style={{ fontSize: '13px', fontWeight: '500' }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#198754' }}></div>
          <span className="text-success text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Completed</span>
          <span className="fw-bold">{kpis.status.completed}</span>
        </div>

        <div className="ms-auto">
          <button
            onClick={() => navigate('/actions/achievement-report')}
            className="btn btn-sm btn-outline-primary rounded-pill px-3 d-flex align-items-center gap-2"
            style={{ fontSize: '12px', fontWeight: '600' }}
          >
            <TrendingUp size={14} /> Performance Report
          </button>
        </div>
      </div>


      {/* Strategic Objectives List */}
      {
        loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <ActionListEnhanced
            objectives={objectives}
            actions={allActions}
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
        )
      }

      {/* Modals */}
      {
        isObjectiveModalOpen && (
          <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
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
              </div>
            </div>
          </div>
        )
      }

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

      {/* Toast Container */}
      <div className="toast-container position-fixed bottom-0 end-0 p-4" style={{ zIndex: 2000 }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast show align-items-center text-white bg-${toast.type} border-0 mb-2 shadow-lg animate-slide-in`}
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            style={{ borderRadius: '12px', minWidth: '300px' }}
          >
            <div className="d-flex">
              <div className="toast-body d-flex align-items-center gap-3 py-3">
                {toast.type === 'success' ? <ThumbsUp size={18} /> : <AlertTriangle size={18} />}
                <span className="fw-medium">{toast.message}</span>
              </div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              ></button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .animate-slide-in {
          animation: slideIn 0.3s ease-out forwards;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ActionsPage;
