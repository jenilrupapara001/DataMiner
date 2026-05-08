import React, { useState, useEffect, useMemo } from 'react';
import { Edit2, Trash2, CheckCircle, Clock, AlertTriangle, Filter, Search, Play, Square, Plus, Sparkles, Loader2, BarChart2, Calendar, AlertCircle, ArrowDown, Minus, ThumbsUp, ThumbsDown, RotateCcw, FileText } from 'lucide-react';
import CompletionModal from './CompletionModal';
import Tooltip from '../base/Tooltip';

const ActionList = ({
    actions = [],
    objectives = [],
    loading,
    activeFilter = 'ALL',
    searchQuery = '',
    currentUser,
    onSearchChange,
    onDelete,
    onEdit,
    onAddAction,
    onAISuggest,
    onStatusChange,
    onStartTask,
    onCompleteTask,
    onSubmitForReview,
    onReviewAction,
    viewMode = 'STRATEGIC' // STRATEGIC or OPERATIONS
}) => {
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [completionModalOpen, setCompletionModalOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState(null);
    const [timers, setTimers] = useState({});
    const [expandedRows, setExpandedRows] = useState({});

    // Update timers every second for actions in progress
    useEffect(() => {
        const interval = setInterval(() => {
            const newTimers = {};
            actions.forEach(action => {
                const id = action._id || action.id;
                if (action.timeTracking?.startedAt && !action.timeTracking?.completedAt) {
                    const elapsed = Math.floor((new Date() - new Date(action.timeTracking.startedAt)) / 1000 / 60);
                    newTimers[id] = elapsed;
                }
            });
            setTimers(newTimers);
        }, 1000);

        return () => clearInterval(interval);
    }, [actions]);

    const isTaskStarted = (action) => {
        return action.timeTracking?.startedAt && !action.timeTracking?.completedAt;
    };

    const isTaskCompleted = (action) => {
        return action.timeTracking?.completedAt || action.status === 'COMPLETED';
    };

    // Robust Permission Helpers
    const hasAdminPrivileges = (user) => {
        if (!user) return false;
        const role = (user.role?.name || user.role || '').toLowerCase();
        return ['admin', 'manager', 'administrator', 'superadmin'].includes(role);
    };

    const isActuallyAdmin = (user) => {
        if (!user) return false;
        const role = (user.role?.name || user.role || '').toLowerCase();
        return ['admin', 'administrator', 'superadmin'].includes(role);
    };

    const isOwnerOfItem = (item, user) => {
        if (!item || !user) return false;
        const userId = (user._id || user.id)?.toString();
        if (!userId) return false;

        // Check various owner/assignee fields
        const ownerId = (item.owner?._id || item.owner)?.toString();
        const assignedId = (item.assignedTo?._id || item.assignedTo)?.toString();
        const createdById = (item.createdBy?._id || item.createdBy)?.toString();

        return userId === ownerId || userId === assignedId || userId === createdById;
    };

    // Shared Filtering Logic
    const matchesFilters = (action) => {
        const now = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const matchesSearch = !searchQuery ||
            action.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            action.description?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;
        if (filterStatus && action.status !== filterStatus) return false;
        if (filterPriority && action.priority !== filterPriority) return false;

        // KPI active filters
        if (activeFilter === 'ALL') return true;
        if (activeFilter === 'TODO') return action.status !== 'COMPLETED';
        if (activeFilter === 'PENDING') return action.status === 'PENDING';
        if (activeFilter === 'IN_PROGRESS') return action.status === 'IN_PROGRESS';
        if (activeFilter === 'REVIEW') return action.status === 'REVIEW';
        if (activeFilter === 'COMPLETED') return action.status === 'COMPLETED';
        if (activeFilter === 'REJECTED') return action.status === 'REJECTED';
        if (activeFilter === 'OVERDUE') return action.timeTracking?.deadline && new Date(action.timeTracking.deadline) < now && action.status !== 'COMPLETED';
        if (activeFilter === 'TOMORROW') {
            if (!action.timeTracking?.deadline) return false;
            const d = new Date(action.timeTracking.deadline);
            const dayAfter = new Date(tomorrow);
            dayAfter.setDate(tomorrow.getDate() + 1);
            return d >= tomorrow && d < dayAfter && action.status !== 'COMPLETED';
        }
        if (activeFilter === 'UPCOMING') {
            if (!action.timeTracking?.deadline) return false;
            const d = new Date(action.timeTracking.deadline);
            const dayAfter = new Date(tomorrow);
            dayAfter.setDate(tomorrow.getDate() + 1);
            return d >= dayAfter && action.status !== 'COMPLETED';
        }

        return true;
    };

    // Auto-expand everything if filtering or searching
    useEffect(() => {
        if (activeFilter !== 'ALL' || searchQuery || filterStatus) {
            const newExpanded = {};
            objectives.forEach(obj => {
                newExpanded[obj.id || obj._id] = true;
                (obj.keyResults || []).forEach(kr => {
                    newExpanded[kr.id || kr._id] = true;
                });
            });
            setExpandedRows(newExpanded);
        }
    }, [activeFilter, searchQuery, filterStatus, objectives]);

    const handleStartTask = (action) => {
        if (onStartTask) onStartTask(action);
    };

    const toggleRow = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getStatusDot = (status) => {
        if (status === 'COMPLETED') return <span className="status-dot status-dot-green"></span>;
        if (status === 'IN_PROGRESS') return <span className="status-dot status-dot-yellow"></span>;
        if (status === 'REVIEW') return <span className="status-dot status-dot-purple"></span>;
        if (status === 'PENDING') return <span className="status-dot status-dot-gray"></span>;
        return <span className="status-dot status-dot-red"></span>;
    };

    const renderPriorityIcon = (priority) => {
        switch (priority) {
            case 'HIGH':
            case 'URGENT':
                return <AlertCircle size={14} className="priority-high" />;
            case 'MEDIUM':
                return <Minus size={14} className="priority-medium" />;
            case 'LOW':
                return <ArrowDown size={14} className="priority-low" />;
            default:
                return null;
        }
    };

    const formatUserName = (user) => {
        if (!user) return null;
        const first = user.firstName || '';
        const last = user.lastName || '';
        return `${first} ${last}`.trim() || user.email?.split('@')[0] || 'User';
    };

    const ChevronIcon = ({ expanded }) => (
        <span className="me-2 text-muted" style={{ cursor: 'pointer', transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none' }}>
            <Play size={10} fill="currentColor" />
        </span>
    );

    const renderTreeTable = () => {
        const normalizedObjectives = (objectives || []).map(obj => {
            let totalActions = 0;
            let completedActions = 0;
            const krs = obj.keyResults || [];
            krs.forEach(kr => {
                const actions = kr.actions || [];
                totalActions += actions.length;
                completedActions += actions.filter(a => isTaskCompleted(a)).length;
            });
            return {
                ...obj,
                id: obj._id || obj.id,
                stats: {
                    total: totalActions,
                    completed: completedActions,
                    progress: obj.progress || (totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0)
                }
            };
        });

        const filteredObjectives = normalizedObjectives.map(obj => {
            const filteredKRs = (obj.keyResults || []).map(kr => {
                const filteredActions = (kr.actions || []).filter(matchesFilters);
                if (filteredActions.length === 0 && (searchQuery || filterStatus || activeFilter !== 'ALL')) return null;
                return { ...kr, actions: filteredActions };
            }).filter(Boolean);

            if (filteredKRs.length === 0 && (obj.keyResults || []).length > 0 && (searchQuery || filterStatus || activeFilter !== 'ALL')) return null;
            return { ...obj, keyResults: filteredKRs };
        }).filter(Boolean);

        const rows = [];
        filteredObjectives.forEach(obj => {
            const objId = obj.id || obj._id;
            rows.push({ type: 'OBJECTIVE', level: 0, id: objId, data: obj });
            if (expandedRows[objId]) {
                (obj.keyResults || []).forEach(kr => {
                    const krId = kr.id || kr._id;
                    rows.push({ type: 'KR', level: 1, id: krId, data: kr, parentId: objId });
                    if (expandedRows[krId]) {
                        (kr.actions || []).forEach(action => {
                            rows.push({ type: 'ACTION', level: 2, id: action.id || action._id, data: action, parentId: krId });
                        });
                    }
                });
            }
        });

        return (
            <div className="smartsheet-container mt-4">
                <table className="smartsheet-table">
                    <thead>
                        <tr>
                            <th className="row-index">#</th>
                            <th style={{ width: '25%' }}>Task / Objective Name</th>
                            <th style={{ width: '20%' }}>Details</th>
                            <th style={{ width: '10%' }}>Type</th>
                            <th style={{ width: '10%' }}>Seller</th>
                            <th style={{ width: '10%' }}>ASINs</th>
                            <th className="text-center">Progress</th>
                            <th>Resource</th>
                            <th className="text-center">Priority</th>
                            <th style={{ width: '15%' }}>Review</th>
                            <th className="text-center">Activity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => {
                            const isExpanded = expandedRows[row.id];
                            const { data, level, type } = row;
                            return (
                                <tr key={row.id + '-' + type} className={`row-level-${level} ${type.toLowerCase()}-row`}>
                                    <td className="row-index">{index + 1}</td>
                                    <td style={{ paddingLeft: `${12 + (level * 24)}px` }}>
                                        <div className="d-flex align-items-center">
                                            {(type === 'OBJECTIVE' || type === 'KR') && (
                                                <span onClick={() => toggleRow(row.id)}>
                                                    <ChevronIcon expanded={isExpanded} />
                                                </span>
                                            )}
                                            {type === 'ACTION' && <span className="me-2 opacity-25"><div style={{ width: '10px' }}></div></span>}
                                            <div className="d-flex align-items-center gap-2">
                                                {type === 'ACTION' && getStatusDot(data.status)}
                                                <div className={`sm-task-title ${type !== 'ACTION' ? 'fw-bold' : ''}`}>
                                                    {type === 'OBJECTIVE' && <span className="badge bg-primary-subtle text-primary border-primary-subtle me-2" style={{ fontSize: '9px' }}>OBJ</span>}
                                                    {type === 'KR' && <span className="badge bg-info-subtle text-info border-info-subtle me-2" style={{ fontSize: '9px' }}>KR</span>}
                                                    {data.title}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="text-muted small text-truncate" style={{ maxWidth: '200px' }}>
                                            {data.description || (type === 'OBJECTIVE' ? 'Strategic Goal' : type === 'KR' ? 'Key Metric' : '--')}
                                        </div>
                                    </td>
                                    <td>
                                        {type === 'ACTION' ? (
                                            <span className="badge bg-secondary-subtle text-secondary border-secondary-subtle" style={{ fontSize: '10px' }}>
                                                {data.type?.replace('_', ' ')}
                                            </span>
                                        ) : '--'}
                                    </td>
                                    <td>
                                        {type === 'ACTION' ? data.sellerId?.name || '--' : '--'}
                                    </td>
                                    <td>
                                        {type === 'ACTION' ? (
                                            <div className="d-flex flex-wrap gap-1">
                                                {data.asins?.slice(0, 2).map((asin, i) => (
                                                    <span key={i} className="badge bg-light text-dark border" style={{ fontSize: '9px' }}>
                                                        {asin.asinCode || asin.asin || asin}
                                                    </span>
                                                ))}
                                                {data.asins?.length > 2 && <span className="text-muted smallest">+{data.asins.length - 2}</span>}
                                            </div>
                                        ) : '--'}
                                    </td>
                                    <td className="text-center">
                                        {type === 'ACTION' ? (
                                            <span className="small fw-bold" style={{ color: data.status === 'COMPLETED' ? '#198754' : '#6c757d' }}>
                                                {data.status === 'COMPLETED' ? '100%' : data.status === 'IN_PROGRESS' ? '50%' : '0%'}
                                            </span>
                                        ) : (
                                            <div className="d-flex align-items-center justify-content-center gap-2">
                                                <div className="progress" style={{ height: '4px', width: '40px' }}>
                                                    <div className="progress-bar" style={{ width: `${type === 'OBJECTIVE' ? data.stats.progress : data.progress}%` }}></div>
                                                </div>
                                                <span className="small fw-bold" style={{ fontSize: '10px' }}>
                                                    {type === 'OBJECTIVE' ? data.stats.progress : data.progress}%
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="avatar-initial bg-light text-dark border rounded-circle" style={{ width: '20px', height: '20px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                {(
                                                    data.assignedTo?.firstName ||
                                                    data.owner?.firstName ||
                                                    data.owners?.[0]?.firstName ||
                                                    data.createdBy?.firstName ||
                                                    'U'
                                                ).charAt(0)}
                                            </div>
                                            <div className="d-flex flex-column">
                                                <span className="fw-bold" style={{ fontSize: '11px', color: '#374151' }}>
                                                    {formatUserName(data.assignedTo) ||
                                                        formatUserName(data.owner) ||
                                                        (type === 'OBJECTIVE' && data.owners?.length > 0 ? formatUserName(data.owners[0]) : null) ||
                                                        formatUserName(data.createdBy) || 'Unassigned'}
                                                </span>

                                                {/* Assigned By logic for Projects/Objectives */}
                                                {type === 'OBJECTIVE' && data.createdBy && (
                                                    <span className="text-muted" style={{ fontSize: '9px' }}>
                                                        Assigned By {data.createdBy.firstName}
                                                    </span>
                                                )}

                                                {/* Creator info for KRs/Actions */}
                                                {type !== 'OBJECTIVE' && data.createdBy && (
                                                    <span className="text-muted" style={{ fontSize: '9px' }}>
                                                        by {data.createdBy.firstName}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="text-center">{renderPriorityIcon(data.priority)}</td>
                                    <td>
                                        {type === 'ACTION' && data.review?.comments ? (
                                            <Tooltip content={data.review.comments}>
                                                <div className="d-flex align-items-center">
                                                    <span className={`small text-truncate d-inline-block ${data.review.status === 'REJECTED' ? 'text-danger' : 'text-success'}`} style={{ maxWidth: '150px', fontSize: '11px' }}>
                                                        {data.review.status === 'REJECTED' && <AlertCircle size={10} className="me-1" />}
                                                        {data.review.comments}
                                                    </span>
                                                </div>
                                            </Tooltip>
                                        ) : (
                                            <span className="text-muted smallest">--</span>
                                        )}
                                    </td>
                                    <td className="text-center">
                                        <div className="d-flex gap-2 justify-content-center">
                                            {type === 'ACTION' ? (
                                                <>
                                                    {(isOwnerOfItem(data, currentUser) || hasAdminPrivileges(currentUser)) && (
                                                        <>
                                                            {!isTaskCompleted(data) && !isTaskStarted(data) && data.status !== 'REVIEW' && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleStartTask(data); }} className="btn btn-sm btn-link p-0 text-primary" title="Start Task"><Play size={14} /></button>
                                                            )}
                                                            {!isTaskCompleted(data) && isTaskStarted(data) && data.status === 'IN_PROGRESS' && (
                                                                <button onClick={(e) => { e.stopPropagation(); onSubmitForReview(data); }} className="btn btn-sm btn-link p-0 text-info" title="Submit for Review"><FileText size={14} /></button>
                                                            )}
                                                        </>
                                                    )}
                                                    {data.status === 'REVIEW' && hasAdminPrivileges(currentUser) && (
                                                        <div className="d-flex gap-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onReviewAction(data); }}
                                                                className="btn btn-sm btn-link p-0 text-success"
                                                                title="Review Approval"
                                                            >
                                                                <ThumbsUp size={14} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); onReviewAction(data); }}
                                                                className="btn btn-sm btn-link p-0 text-danger"
                                                                title="Review Rejection"
                                                            >
                                                                <ThumbsDown size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {(isOwnerOfItem(data, currentUser) || hasAdminPrivileges(currentUser)) && (
                                                        <button onClick={(e) => { e.stopPropagation(); onEdit(data, 'ACTION'); }} className="btn btn-sm btn-link p-0 text-muted" title="Edit Task"><Edit2 size={14} /></button>
                                                    )}
                                                    {hasAdminPrivileges(currentUser) && (
                                                        <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(data._id || data.id, 'ACTION'); }} className="btn btn-sm btn-link p-0 text-danger" title="Delete Task"><Trash2 size={14} /></button>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="d-flex gap-2 justify-content-center">
                                                    {(isOwnerOfItem(data, currentUser) || hasAdminPrivileges(currentUser)) && (
                                                        <button onClick={(e) => { e.stopPropagation(); onEdit(data, type); }} className="btn btn-sm btn-link p-0 text-muted" title={`Edit ${type}`}><Edit2 size={14} /></button>
                                                    )}
                                                    {hasAdminPrivileges(currentUser) && (
                                                        <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(data._id || data.id, type); }} className="btn btn-sm btn-link p-0 text-danger" title={`Delete ${type}`}><Trash2 size={14} /></button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {filteredObjectives.length === 0 && (
                    <div className="text-center py-5 text-muted">
                        <Filter className="mb-2 opacity-25" size={32} />
                        <div style={{ fontSize: '13px' }}>No items found matching the current filters.</div>
                    </div>
                )}
            </div>
        );
    };

    const renderFlatTable = () => {
        let flattenedActions = [];
        objectives.forEach(obj => {
            (obj.keyResults || []).forEach(kr => {
                (kr.actions || []).forEach(action => {
                    flattenedActions.push({ ...action, objectiveTitle: obj.title, krTitle: kr.title });
                });
            });
        });

        const filtered = flattenedActions.filter(matchesFilters);

        return (
            <div className="smartsheet-container mt-4">
                <table className="smartsheet-table">
                    <thead>
                        <tr>
                            <th className="row-index">#</th>
                            <th style={{ width: '30%' }}>Task Name</th>
                            <th style={{ width: '15%' }}>Context</th>
                            <th style={{ width: '10%' }}>Status</th>
                            <th style={{ width: '10%' }}>Seller</th>
                            <th style={{ width: '10%' }}>ASINs</th>
                            <th className="text-center">Timer</th>
                            <th style={{ width: '12%' }}>Assignee</th>
                            <th className="text-center">Priority</th>
                            <th style={{ width: '15%' }}>Review</th>
                            <th className="text-center">Activity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((action, index) => (
                            <tr key={action._id || action.id}>
                                <td className="row-index">{index + 1}</td>
                                <td>
                                    <div className="fw-bold">{action.title}</div>
                                    <div className="text-muted smallest text-truncate">{action.description}</div>
                                </td>
                                <td>
                                    <div className="smallest text-primary fw-bold text-uppercase">{action.objectiveTitle}</div>
                                    <div className="smallest text-muted">{action.krTitle}</div>
                                </td>
                                <td>
                                    <span className={`badge ${action.status === 'COMPLETED' ? 'bg-success-subtle text-success' :
                                        action.status === 'IN_PROGRESS' ? 'bg-primary-subtle text-primary' :
                                            action.status === 'REVIEW' ? 'bg-info-subtle text-info' :
                                                'bg-warning-subtle text-warning-emphasis'
                                        }`} style={{ fontSize: '10px' }}>
                                        {action.status?.replace('_', ' ')}
                                    </span>
                                </td>
                                <td className="small text-muted">{action.sellerId?.name || '--'}</td>
                                <td>
                                    <div className="d-flex flex-wrap gap-1">
                                        {action.asins?.slice(0, 2).map((asin, i) => (
                                            <span key={i} className="badge bg-light text-dark border" style={{ fontSize: '9px' }}>
                                                {asin.asinCode || asin.asin || asin}
                                            </span>
                                        ))}
                                        {action.asins?.length > 2 && <span className="smallest text-muted">+{action.asins.length - 2}</span>}
                                    </div>
                                </td>
                                <td className="text-center">
                                    {isTaskStarted(action) ? `${timers[action._id || action.id] || 0}m` : '--'}
                                </td>
                                <td>
                                    <div className="d-flex align-items-center gap-2">
                                        <div className="avatar-initial bg-light text-dark border rounded-circle" style={{ width: '18px', height: '18px', fontSize: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {(action.assignedTo?.firstName || action.createdBy?.firstName || 'U').charAt(0)}
                                        </div>
                                        <div className="d-flex flex-column">
                                            <span className="small fw-bold" style={{ fontSize: '10px', color: '#4b5563' }}>
                                                {formatUserName(action.assignedTo) || 'Unassigned'}
                                            </span>
                                            {action.createdBy && action.assignedTo?._id !== action.createdBy?._id && (
                                                <span className="text-muted" style={{ fontSize: '8px' }}>
                                                    by {action.createdBy.firstName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="text-center">{renderPriorityIcon(action.priority)}</td>
                                <td>
                                    {action.review?.comments ? (
                                        <Tooltip content={action.review.comments}>
                                            <div className="d-flex align-items-center">
                                                <span className={`small text-truncate d-inline-block ${action.review.status === 'REJECTED' ? 'text-danger' : 'text-success'}`} style={{ maxWidth: '150px', fontSize: '11px' }}>
                                                    {action.review.status === 'REJECTED' && <AlertCircle size={10} className="me-1" />}
                                                    {action.review.comments}
                                                </span>
                                            </div>
                                        </Tooltip>
                                    ) : (
                                        <span className="text-muted smallest">--</span>
                                    )}
                                </td>
                                <td className="text-center">
                                    <div className="d-flex gap-2 justify-content-center">
                                        {(isOwnerOfItem(action, currentUser) || hasAdminPrivileges(currentUser)) && (
                                            <>
                                                {!isTaskCompleted(action) && !isTaskStarted(action) && action.status !== 'REVIEW' && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleStartTask(action); }} className="btn btn-sm btn-link p-0 text-primary" title="Start Task"><Play size={14} /></button>
                                                )}
                                                {!isTaskCompleted(action) && isTaskStarted(action) && action.status === 'IN_PROGRESS' && (
                                                    <button onClick={(e) => { e.stopPropagation(); onSubmitForReview(action); }} className="btn btn-sm btn-link p-0 text-info" title="Submit for Review"><FileText size={14} /></button>
                                                )}
                                            </>
                                        )}
                                        {action.status === 'REVIEW' && isActuallyAdmin(currentUser) && (
                                            <div className="d-flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onReviewAction(action); }}
                                                    className="btn btn-sm btn-link p-0 text-success"
                                                    title="Review Approval"
                                                >
                                                    <ThumbsUp size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onReviewAction(action); }}
                                                    className="btn btn-sm btn-link p-0 text-danger"
                                                    title="Review Rejection"
                                                >
                                                    <ThumbsDown size={14} />
                                                </button>
                                            </div>
                                        )}
                                        {(isOwnerOfItem(action, currentUser) || hasAdminPrivileges(currentUser)) && (
                                            <button onClick={(e) => { e.stopPropagation(); onEdit(action, 'ACTION'); }} className="btn btn-sm btn-link p-0 text-muted" title="Edit Task"><Edit2 size={14} /></button>
                                        )}
                                        {hasAdminPrivileges(currentUser) && (
                                            <button onClick={(e) => { e.stopPropagation(); onDelete && onDelete(action._id || action.id, 'ACTION'); }} className="btn btn-sm btn-link p-0 text-danger" title="Delete Task"><Trash2 size={14} /></button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <div className="text-center py-5 text-muted">
                        <Filter className="mb-2 opacity-25" size={32} />
                        <div style={{ fontSize: '13px' }}>No tasks found matching the current filters.</div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="action-list-container">
            <div className="card mb-4 border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <div className="position-relative">
                                <Search className="position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#6b7280' }} />
                                <input
                                    type="text"
                                    placeholder="Search initiatives & tasks..."
                                    value={searchQuery}
                                    onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
                                    className="form-control ps-5 border-0 bg-light"
                                    style={{ borderRadius: '10px' }}
                                />
                            </div>
                        </div>
                        <div className="col-md-3">
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="form-select border-0 bg-light"
                                style={{ borderRadius: '10px' }}
                            >
                                <option value="">All Statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="REVIEW">Needs Review</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </div>
                        <div className="col-md-3">
                            <select
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="form-select border-0 bg-light"
                                style={{ borderRadius: '10px' }}
                            >
                                <option value="">All Priorities</option>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {viewMode === 'STRATEGIC' ? renderTreeTable() : renderFlatTable()}
        </div>
    );
};

export default ActionList;
