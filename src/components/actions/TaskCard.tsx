/**
 * TaskCard - Full task card with lifecycle management
 * Supports: START, BLOCK, REVIEW, COMPLETE, EDIT, DELETE actions
 */

import React, { useState } from 'react';
import {
    Play,
    Pause,
    CheckCircle,
    XCircle,
    Edit2,
    Trash2,
    AlertCircle,
    Clock,
    Target,
    TrendingUp,
    ChevronDown,
    ChevronUp,
    Zap
} from 'lucide-react';
import { METRIC_CONFIG, MetricType, Task, TaskStatus, TaskPriority, TaskActionType } from '../../models/growth.types';

// Priority colors
const getPriorityColor = (priority: TaskPriority): string => {
    switch (priority) {
        case 'URGENT': return '#D32F2F';
        case 'HIGH': return '#ED6C02';
        case 'MEDIUM': return '#0288D1';
        case 'LOW': return '#94a3b8';
        default: return '#94a3b8';
    }
};

// Status badge
const getStatusBadge = (status: TaskStatus) => {
    const styles = {
        TODO: { bg: '#f1f5f9', color: '#64748b', label: 'TODO' },
        IN_PROGRESS: { bg: '#eff6ff', color: '#0288D1', label: 'IN PROGRESS' },
        BLOCKED: { bg: '#fef2f2', color: '#D32F2F', label: 'BLOCKED' },
        REVIEW: { bg: '#fefce8', color: '#eab308', label: 'REVIEW' },
        COMPLETED: { bg: '#f0fdf4', color: '#2E7D32', label: 'COMPLETED' },
        CANCELLED: { bg: '#f1f5f9', color: '#94a3b8', label: 'CANCELLED' },
        REJECTED: { bg: '#fef2f2', color: '#C62828', label: 'REJECTED' },
    };
    const style = styles[status] || styles.TODO;
    return (
        <span
            className="badge rounded-pill border-0 smallest px-2 py-1"
            style={{ backgroundColor: style.bg, color: style.color, fontWeight: 600 }}
        >
            {style.label}
        </span>
    );
};

// Metric badge
const getMetricBadge = (metricType: MetricType) => {
    const config = METRIC_CONFIG[metricType];
    return (
        <span
            className="badge rounded-pill border-0 smallest px-2 py-1"
            style={{ backgroundColor: `${config.color}20`, color: config.color, fontWeight: 600 }}
        >
            {metricType.replace('_', ' ')}
        </span>
    );
};

// Format date
const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// Lifecycle buttons based on current status
const LifecycleButtons = ({
    status,
    onAction
}: {
    status: TaskStatus;
    onAction: (action: TaskActionType) => void;
}) => {
    switch (status) {
        case 'TODO':
            return (
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-sm btn-primary rounded-pill px-3 d-flex align-items-center gap-1"
                        onClick={() => onAction('START')}
                    >
                        <Play size={12} /> Start
                    </button>
                    <button
                        className="btn btn-sm btn-outline-secondary rounded-pill px-2"
                        onClick={() => onAction('BLOCK')}
                        title="Block"
                    >
                        <Pause size={12} />
                    </button>
                </div>
            );
        case 'IN_PROGRESS':
            return (
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-sm btn-warning rounded-pill px-3 d-flex align-items-center gap-1"
                        onClick={() => onAction('SUBMIT_REVIEW')}
                    >
                        <Clock size={12} /> Review
                    </button>
                    <button
                        className="btn btn-sm btn-outline-secondary rounded-pill px-2"
                        onClick={() => onAction('BLOCK')}
                        title="Block"
                    >
                        <Pause size={12} />
                    </button>
                </div>
            );
        case 'BLOCKED':
            return (
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-sm btn-outline-primary rounded-pill px-3 d-flex align-items-center gap-1"
                        onClick={() => onAction('UNBLOCK')}
                    >
                        <Play size={12} /> Unblock
                    </button>
                </div>
            );
        case 'REVIEW':
            return (
                <div className="d-flex gap-2">
                    <button
                        className="btn btn-sm btn-success rounded-pill px-3 d-flex align-items-center gap-1"
                        onClick={() => onAction('COMPLETE')}
                    >
                        <CheckCircle size={12} /> Approve
                    </button>
                    <button
                        className="btn btn-sm btn-danger rounded-pill px-2"
                        onClick={() => onAction('REJECT')}
                        title="Reject"
                    >
                        <XCircle size={12} />
                    </button>
                </div>
            );
        case 'COMPLETED':
            return (
                <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill smallest">
                    <CheckCircle size={12} className="me-1" />
                    Done
                </span>
            );
        default:
            return null;
    }
};

// Main TaskCard component
const TaskCard = ({
    task,
    onAction,
    onEdit,
    onDelete,
    expanded = false,
    onToggleExpand
}: {
    task: Task;
    onAction?: (action: TaskActionType, taskId: string) => void;
    onEdit?: (task: Task) => void;
    onDelete?: (taskId: string) => void;
    expanded?: boolean;
    onToggleExpand?: () => void;
}) => {
    const handleAction = (action: TaskActionType) => {
        if (onAction) {
            onAction(action, task.id);
        }
    };

    return (
        <div
            className="task-card border rounded-3 mb-2"
            style={{
                backgroundColor: 'var(--color-surface-0)',
                borderColor: 'var(--color-border)',
                transition: 'all var(--transition-fast)',
            }}
        >
            {/* Header */}
            <div
                className="d-flex justify-content-between align-items-start p-3"
                style={{ cursor: onToggleExpand ? 'pointer' : 'default' }}
                onClick={onToggleExpand}
            >
                <div className="d-flex align-items-start gap-2" style={{ flex: 1 }}>
                    {/* Metric Badge */}
                    {task.metricType && getMetricBadge(task.metricType)}

                    <div style={{ flex: 1 }}>
                        {/* Title */}
                        <div className="d-flex align-items-center gap-2 mb-1">
                            <h6 className="mb-0" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {task.title}
                            </h6>
                            {task.isAISuggested && (
                                <span className="badge bg-purple-100 text-purple-700 border-0 rounded-pill smallest">
                                    <Zap size={10} className="me-1" />
                                    AI
                                </span>
                            )}
                        </div>

                        {/* Description (truncated) */}
                        <p className="mb-0 smallest text-muted" style={{ lineHeight: 1.4 }}>
                            {expanded ? task.description : task.description?.substring(0, 100)}
                            {!expanded && task.description && task.description.length > 100 && '...'}
                        </p>
                    </div>
                </div>

                {/* Expand/Collapse button */}
                {onToggleExpand && (
                    <button className="btn btn-link btn-sm p-0 ms-2 text-muted">
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                )}
            </div>

            {/* Expanded Content */}
            {expanded && (
                <div className="px-3 pb-3">
                    {/* Recommendation */}
                    {task.recommendation && (
                        <div className="mb-2 p-2 rounded-2" style={{ backgroundColor: 'var(--color-surface-1)' }}>
                            <div className="smallest text-muted mb-1 fw-semibold">RECOMMENDATION</div>
                            <div className="small" style={{ color: 'var(--color-text-primary)' }}>{task.recommendation}</div>
                        </div>
                    )}

                    {/* Hints */}
                    {task.hints && task.hints.length > 0 && (
                        <div className="mb-2">
                            <div className="smallest text-muted mb-1 fw-semibold">HINTS</div>
                            <ul className="list-unstyled mb-0">
                                {task.hints.map((hint, idx) => (
                                    <li key={idx} className="small text-muted d-flex align-items-start gap-2">
                                        <span style={{ color: 'var(--color-brand-600)' }}>•</span>
                                        {hint}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Meta Info */}
                    <div className="d-flex flex-wrap gap-3 mb-3 smallest text-muted">
                        {task.scopeType && (
                            <span className="d-flex align-items-center gap-1">
                                <Target size={12} />
                                {task.scopeType}
                            </span>
                        )}
                        {task.resolvedAsins && task.resolvedAsins.length > 0 && (
                            <span className="d-flex align-items-center gap-1">
                                <TrendingUp size={12} />
                                {task.resolvedAsins.length} ASINs
                            </span>
                        )}
                        {task.deadline && (
                            <span className="d-flex align-items-center gap-1">
                                <Clock size={12} />
                                Due: {formatDate(task.deadline)}
                            </span>
                        )}
                        {task.impactScore && (
                            <span className="d-flex align-items-center gap-1">
                                <TrendingUp size={12} />
                                Impact: {task.impactScore}
                            </span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex gap-2">
                            {LifecycleButtons({ status: task.status, onAction: handleAction })}
                        </div>
                        <div className="d-flex gap-2">
                            {onEdit && task.status !== 'COMPLETED' && (
                                <button
                                    className="btn btn-sm btn-outline-secondary rounded-pill px-2"
                                    onClick={() => onEdit(task)}
                                    title="Edit"
                                >
                                    <Edit2 size={14} />
                                </button>
                            )}
                            {onDelete && task.status !== 'COMPLETED' && (
                                <button
                                    className="btn btn-sm btn-outline-danger rounded-pill px-2"
                                    onClick={() => onDelete(task.id)}
                                    title="Delete"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Footer (collapsed view) */}
            {!expanded && (
                <div className="px-3 pb-2 d-flex justify-content-between align-items-center border-top" style={{ borderColor: 'var(--color-border) !important' }}>
                    <div className="d-flex align-items-center gap-2">
                        {getStatusBadge(task.status)}
                        <span
                            className="badge rounded-pill border-0 smallest"
                            style={{ backgroundColor: `${getPriorityColor(task.priority)}20`, color: getPriorityColor(task.priority), fontWeight: 600 }}
                        >
                            {task.priority}
                        </span>
                    </div>
                    <div className="d-flex gap-1">
                        {LifecycleButtons({ status: task.status, onAction: handleAction })}
                    </div>
                </div>
            )}
        </div>
    );
};

// Loading skeleton
export const TaskCardSkeleton = () => (
    <div className="border rounded-3 p-3 mb-2" style={{ backgroundColor: 'var(--color-surface-0)' }}>
        <div className="d-flex gap-2 mb-2">
            <div className="skeleton" style={{ width: '60px', height: '20px', borderRadius: '12px' }} />
            <div className="skeleton" style={{ width: '100px', height: '20px', borderRadius: '12px' }} />
        </div>
        <div className="skeleton mb-2" style={{ width: '80%', height: '16px', borderRadius: '4px' }} />
        <div className="skeleton" style={{ width: '60%', height: '14px', borderRadius: '4px' }} />
    </div>
);

// Compact version for lists
export const TaskCardCompact = ({ task, onAction }: { task: Task; onAction?: (action: TaskActionType, taskId: string) => void }) => {
    const handleAction = (action: TaskActionType) => {
        if (onAction) {
            onAction(action, task.id);
        }
    };

    return (
        <div
            className="d-flex align-items-center justify-content-between p-2 border-bottom"
            style={{ backgroundColor: 'var(--color-surface-0)' }}
        >
            <div className="d-flex align-items-center gap-2" style={{ flex: 1, minWidth: 0 }}>
                {task.metricType && getMetricBadge(task.metricType)}
                <span className="text-truncate" style={{ fontSize: '13px' }}>{task.title}</span>
            </div>
            <div className="d-flex align-items-center gap-2">
                {getStatusBadge(task.status)}
                <div className="d-flex gap-1">
                    {task.status === 'TODO' && (
                        <button className="btn btn-sm btn-link p-0" onClick={() => handleAction('START')}>
                            <Play size={14} />
                        </button>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                        <button className="btn btn-sm btn-link p-0" onClick={() => handleAction('SUBMIT_REVIEW')}>
                            <Clock size={14} />
                        </button>
                    )}
                    {task.status === 'REVIEW' && (
                        <button className="btn btn-sm btn-link p-0 text-success" onClick={() => handleAction('COMPLETE')}>
                            <CheckCircle size={14} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskCard;
