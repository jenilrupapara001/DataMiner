import React, { useState } from 'react';
import { Edit2, Trash2, CheckCircle, Clock, AlertTriangle, Filter, Search } from 'lucide-react';

const ActionList = ({ actions, onDelete, onEdit, onStatusChange }) => {
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredActions = actions.filter(action => {
        const matchesStatus = filterStatus ? action.status === filterStatus : true;
        const matchesPriority = filterPriority ? action.priority === filterPriority : true;
        const matchesSearch = searchQuery
            ? action.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            action.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            action.asin?.asinCode?.toLowerCase().includes(searchQuery.toLowerCase())
            : true;
        return matchesStatus && matchesPriority && matchesSearch;
    });

    const getPriorityBadge = (priority) => {
        const styles = {
            LOW: 'badge-secondary',
            MEDIUM: 'badge-info',
            HIGH: 'badge-warning',
            URGENT: 'badge-danger',
        };
        return (
            <span className={`badge ${styles[priority] || styles.LOW}`}>
                {priority}
            </span>
        );
    };

    const getStatusBadge = (status) => {
        const styles = {
            PENDING: 'badge-warning',
            IN_PROGRESS: 'badge-info',
            COMPLETED: 'badge-success',
            CANCELLED: 'badge-secondary',
        };
        return (
            <span className={`badge ${styles[status] || styles.PENDING}`}>
                {status?.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="action-list-container">
            {/* Filters */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-12 col-md-6">
                            <div className="input-group">
                                <span className="input-group-text">
                                    <Search className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Search actions..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="form-control"
                                />
                            </div>
                        </div>
                        <div className="col-6 col-md-3">
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="form-select"
                            >
                                <option value="">All Status</option>
                                <option value="PENDING">Pending</option>
                                <option value="IN_PROGRESS">In Progress</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </div>
                        <div className="col-6 col-md-3">
                            <select
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="form-select"
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

            {/* List */}
            <div className="card">
                <div className="card-body p-0">
                    {filteredActions.length === 0 ? (
                        <div className="text-center py-5">
                            <CheckCircle className="mx-auto mb-3 text-muted" style={{ width: '48px', height: '48px', opacity: 0.3 }} />
                            <p className="text-muted mb-0">No actions found matching your criteria.</p>
                        </div>
                    ) : (
                        <div className="action-items-list">
                            {filteredActions.map((action) => (
                                <div key={action._id || action.id} className="action-item">
                                    <div className="action-content">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <h5 className="action-title mb-0">{action.title}</h5>
                                            <div className="d-flex gap-2">
                                                {getPriorityBadge(action.priority)}
                                                {getStatusBadge(action.status)}
                                            </div>
                                        </div>

                                        <p className="action-description text-muted mb-2">{action.description}</p>

                                        <div className="action-meta">
                                            {action.asin && (
                                                <span className="meta-item">
                                                    <strong>ASIN:</strong> {action.asin.asinCode || action.asin}
                                                </span>
                                            )}
                                            {action.assignee && (
                                                <span className="meta-item">
                                                    <strong>Assignee:</strong> {action.assignee.name || 'Unknown'}
                                                </span>
                                            )}
                                            {action.dueDate && (
                                                <span className="meta-item">
                                                    <Clock style={{ width: '14px', height: '14px' }} />
                                                    {new Date(action.dueDate).toLocaleDateString()}
                                                </span>
                                            )}
                                            <span className="badge badge-light">
                                                {action.type}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="action-buttons">
                                        <button
                                            onClick={() => onEdit(action)}
                                            className="btn btn-sm btn-outline-primary"
                                            title="Edit"
                                        >
                                            <Edit2 style={{ width: '16px', height: '16px' }} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(action._id || action.id)}
                                            className="btn btn-sm btn-outline-danger"
                                            title="Delete"
                                        >
                                            <Trash2 style={{ width: '16px', height: '16px' }} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActionList;
