import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Plus, Search, Filter, Play, FileText, CheckCircle, Clock, Check, X as CloseIcon, ThumbsUp, ThumbsDown } from 'lucide-react';
import ActionModal from '../components/actions/ActionModal';
import CompletionModal from '../components/actions/CompletionModal';
import ReviewModal from '../components/actions/ReviewModal';
import { useNavigate } from 'react-router-dom';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

const TasksOperationsPage = ({ isEmbedded = false }) => {
    const [actions, setActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
    const [editingAction, setEditingAction] = useState(null);
    const [completingAction, setCompletingAction] = useState(null);
    const [reviewingAction, setReviewingAction] = useState(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [users, setUsers] = useState([]);
    const [asins, setAsins] = useState([]);
    const navigate = useNavigate();
    const currentUser = db.getUser();

    if (loading && actions.length === 0) {
        return isEmbedded ? (
            <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading Operations...</span>
                </div>
            </div>
        ) : (
            <PageLoader message="Loading Tasks Operations..." />
        );
    }

    const loadTasks = async () => {
        setLoading(true);
        try {
            const res = await db.getActions();
            const loadedActions = res?.data || (Array.isArray(res) ? res : []);
            setActions(loadedActions);

            // Fetch Users & ASINs
            const usersRes = await db.getUsers();
            if (usersRes && usersRes.success !== false) setUsers(Array.isArray(usersRes) ? usersRes : usersRes.data || []);

            const asinsRes = await db.getAsins();
            if (asinsRes && asinsRes.success !== false) setAsins(Array.isArray(asinsRes) ? asinsRes : asinsRes.asins || asinsRes.data || []);
        } catch (err) {
            console.error("Failed to load tasks:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, []);

    const filteredActions = actions.filter(action => {
        const matchesStatus = filterStatus ? action.status === filterStatus : true;
        const matchesSearch = searchQuery
            ? action.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            action.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            action.sellerId?.name?.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
        return matchesStatus && matchesSearch;
    });

    const handleEditAction = (action) => {
        setEditingAction(action);
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
            loadTasks();
        } catch (error) {
            console.error('Failed to save action', error);
        }
    };

    const handleStartTask = async (action) => {
        const id = action?._id || action?.id || action;
        try {
            setLoading(true);
            await db.startAction(id);
            loadTasks();
        } catch (err) {
            console.error("Failed to start task:", err);
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
            } else {
                await db.completeAction(actionId, data);
            }
            setIsCompletionModalOpen(false);
            setCompletingAction(null);
            loadTasks();
        } catch (err) {
            console.error("Failed to process task completion:", err);
            alert("Action failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleReviewAction = async (action, decision, comments) => {
        if (!action) return;

        try {
            setLoading(true);
            await db.reviewAction(action._id || action.id, { decision, comments });
            await loadTasks();
            return true;
        } catch (error) {
            console.error('Failed to review action:', error);
            alert('Review failed. Please try again.');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const openReviewModal = (action) => {
        setReviewingAction(action);
        setIsReviewModalOpen(true);
    };

    const getStatusDot = (status) => {
        if (status === 'COMPLETED') return <span className="status-dot status-dot-green"></span>;
        if (status === 'IN_PROGRESS') return <span className="status-dot status-dot-yellow"></span>;
        if (status === 'REVIEW') return <span className="status-dot status-dot-purple"></span>;
        if (status === 'PENDING') return <span className="status-dot status-dot-gray"></span>;
        return <span className="status-dot status-dot-red"></span>;
    };

    return (
        <div className={isEmbedded ? "" : "container-fluid p-4"}>
            {loading && !isEmbedded && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
                    <LoadingIndicator type="line-simple" size="md" />
                </div>
            )}
            {!isEmbedded && (
                <header className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h1 className="fw-bold h2 mb-1">Task Operations</h1>
                        <p className="text-muted small">Flat execution view for all tactical actions</p>
                    </div>
                    <button
                        className="btn btn-primary rounded-pill px-4 d-flex align-items-center gap-2"
                        onClick={() => { setEditingAction(null); setIsActionModalOpen(true); }}
                    >
                        <Plus size={18} /> Create Task
                    </button>
                </header>
            )}

            <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '16px' }}>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-8">
                            <div className="position-relative">
                                <Search className="position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6b7280' }} />
                                <input
                                    type="text"
                                    placeholder="Search tasks, sellers, or descriptions..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="form-control ps-5 border-0 bg-light"
                                    style={{ borderRadius: '10px' }}
                                />
                            </div>
                        </div>
                        <div className="col-md-4">
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="form-select border-0 bg-light"
                                style={{ borderRadius: '10px' }}
                            >
                                <option value="">All Statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="REVIEW">Review</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card border-0 shadow-sm overflow-hidden" style={{ borderRadius: '16px' }}>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0" style={{ fontSize: '13px' }}>
                            <thead className="table-light text-muted text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>
                                <tr>
                                    <th className="ps-4">Action</th>
                                    <th>Type</th>
                                    <th>Seller</th>
                                    <th>Linked ASINs</th>
                                    <th>Assignee</th>
                                    <th>Status</th>
                                    <th className="text-end pe-4">Activity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredActions.length > 0 ? (
                                    filteredActions.map(action => (
                                        <tr key={action._id} onClick={() => handleEditAction(action)} style={{ cursor: 'pointer' }}>
                                            <td className="ps-4">
                                                <div className="d-flex align-items-center gap-2">
                                                    {getStatusDot(action.status)}
                                                    <span className="fw-bold text-dark">{action.title}</span>
                                                </div>
                                                <div className="text-muted smallest mt-1 text-truncate" style={{ maxWidth: '250px' }}>
                                                    {action.description}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge bg-secondary-subtle text-secondary border-secondary-subtle capitalize">
                                                    {action.type?.toLowerCase().replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="fw-medium">{action.sellerId?.name || '--'}</div>
                                                <div className="smallest text-muted">{action.sellerId?.marketplace}</div>
                                            </td>
                                            <td>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {action.asins?.slice(0, 3).map((asin, i) => (
                                                        <span key={asin._id || asin.id || i} className="badge bg-light text-dark border fw-normal" style={{ fontSize: '10px' }}>
                                                            {asin.asinCode || asin.asin || asin}
                                                        </span>
                                                    ))}
                                                    {action.asins?.length > 3 && <span className="text-muted small">+{action.asins.length - 3}</span>}
                                                    {(!action.asins || action.asins.length === 0) && '--'}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="avatar-initial bg-primary-subtle text-primary rounded-circle small" style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                                                        {(action.assignedTo?.firstName || 'U').charAt(0)}
                                                    </div>
                                                    <span>{action.assignedTo?.firstName ? `${action.assignedTo.firstName} ${action.assignedTo.lastName}` : 'Unassigned'}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${action.status === 'COMPLETED' ? 'bg-success-subtle text-success' :
                                                    action.status === 'IN_PROGRESS' ? 'bg-primary-subtle text-primary' :
                                                    action.status === 'REVIEW' ? 'bg-info-subtle text-info' :
                                                        'bg-warning-subtle text-warning-emphasis'
                                                }`}>
                                                    {action.status?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="text-end pe-4">
                                                <div className="d-flex gap-2 justify-content-end">
                                                    {action.status === 'PENDING' && (
                                                        <button
                                                            className="btn btn-sm btn-outline-primary rounded-circle"
                                                            title="Start Task"
                                                            onClick={(e) => { e.stopPropagation(); handleStartTask(action); }}
                                                        >
                                                            <Play size={14} />
                                                        </button>
                                                    )}
                                                    {action.status === 'IN_PROGRESS' && (
                                                        <button
                                                            className="btn btn-sm btn-outline-info rounded-circle"
                                                            title="Submit for Review"
                                                            onClick={(e) => { e.stopPropagation(); handleSubmitForReview(action); }}
                                                        >
                                                            <FileText size={14} />
                                                        </button>
                                                    )}
                                                    {action.status === 'REVIEW' && (
                                                        <>
                                                            {/* Admin can review all, Manager can review if not owner */}
                                                            {((currentUser?.role === 'admin' || currentUser?.role?.name === 'admin') ||
                                                                ((currentUser?.role === 'manager' || currentUser?.role?.name === 'manager') &&
                                                                    (action.assignedTo?._id || action.assignedTo) !== currentUser?._id)) && (
                                                                    <>
                                                                        <button
                                                                            className="btn btn-sm btn-outline-success rounded-circle"
                                                                            title="Approve"
                                                                            onClick={(e) => { e.stopPropagation(); openReviewModal(action); }}
                                                                        >
                                                                            <ThumbsUp size={14} />
                                                                        </button>
                                                                        <button
                                                                            className="btn btn-sm btn-outline-danger rounded-circle"
                                                                            title="Reject"
                                                                            onClick={(e) => { e.stopPropagation(); openReviewModal(action); }}
                                                                        >
                                                                            <ThumbsDown size={14} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                        </>
                                                    )}
                                                    <button className="btn btn-sm btn-icon btn-light rounded-circle" onClick={(e) => { e.stopPropagation(); handleEditAction(action); }} title="Edit">
                                                        <Plus size={14} style={{ transform: 'rotate(45deg)' }} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-5 text-muted">
                                            No tasks found matching your filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ActionModal
                isOpen={isActionModalOpen}
                onClose={() => { setIsActionModalOpen(false); setEditingAction(null); }}
                onSave={handleSaveAction}
                action={editingAction}
                currentUser={currentUser}
                asins={asins}
                users={users}
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
                    onClose={() => { setIsCompletionModalOpen(false); setCompletingAction(null); }}
                    onComplete={handleCompletionSubmit}
                />
            )}
        </div>
    );
};

export default TasksOperationsPage;