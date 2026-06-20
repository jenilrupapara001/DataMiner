import React, { useMemo, memo } from 'react';
import { Card, Tooltip, Empty } from 'antd';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow, isYesterday, differenceInDays } from 'date-fns';
import {
    User, CheckCircle2, Clock, AlertTriangle, ListTodo,
    PlayCircle, ArrowUpRight, ClipboardList, Sparkles,
    TrendingUp, Activity, Flag, Calendar, Zap, Award
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const formatDueDate = (date) => {
    if (!date) return { label: 'No due date', color: '#94a3b8', urgent: false };
    const d = new Date(date);
    if (isNaN(d.getTime())) return { label: 'No due date', color: '#94a3b8', urgent: false };

    const now = new Date();
    const days = differenceInDays(d, now);

    if (days < 0) {
        const overdueDays = Math.abs(days);
        return {
            label: overdueDays === 1 ? '1 day overdue' : `${overdueDays}d overdue`,
            color: '#ef4444',
            urgent: true
        };
    }
    if (isToday(d)) return { label: 'Due today', color: '#f59e0b', urgent: true };
    if (isTomorrow(d)) return { label: 'Due tomorrow', color: '#f59e0b', urgent: false };
    if (days <= 3) return { label: `Due in ${days}d`, color: '#f59e0b', urgent: false };
    if (days <= 7) return { label: format(d, 'EEE, MMM d'), color: '#64748b', urgent: false };
    return { label: format(d, 'MMM d, yyyy'), color: '#94a3b8', urgent: false };
};

const getStatusConfig = (task) => {
    const status = (task.status || 'todo').toUpperCase();
    const isOverdue = status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < new Date();

    if (isOverdue) {
        return {
            label: 'OVERDUE',
            color: '#ef4444',
            bg: '#fef2f2',
            border: '#fecaca',
            icon: AlertTriangle,
            pulse: true
        };
    }

    switch (status) {
        case 'COMPLETED':
            return {
                label: 'DONE',
                color: '#10b981',
                bg: '#ecfdf5',
                border: '#a7f3d0',
                icon: CheckCircle2
            };
        case 'IN_PROGRESS':
            return {
                label: 'ACTIVE',
                color: '#3b82f6',
                bg: '#eff6ff',
                border: '#bfdbfe',
                icon: PlayCircle,
                pulse: true
            };
        case 'PENDING':
            return {
                label: 'PENDING',
                color: '#f59e0b',
                bg: '#fffbeb',
                border: '#fde68a',
                icon: Clock
            };
        default:
            return {
                label: 'TODO',
                color: '#64748b',
                bg: '#f8fafc',
                border: '#e2e8f0',
                icon: ListTodo
            };
    }
};

const getPriorityConfig = (priority = 'NORMAL') => {
    const p = String(priority).toUpperCase();
    if (p === 'HIGH' || p === 'URGENT' || p === 'CRITICAL') {
        return { color: '#ef4444', label: 'High', icon: '🔴' };
    }
    if (p === 'MEDIUM') {
        return { color: '#f59e0b', label: 'Medium', icon: '🟡' };
    }
    if (p === 'LOW') {
        return { color: '#10b981', label: 'Low', icon: '🟢' };
    }
    return { color: '#64748b', label: 'Normal', icon: '⚪' };
};

const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
};

const getAvatarColor = (name) => {
    if (!name) return { bg: '#f1f5f9', text: '#64748b' };
    const colors = [
        { bg: '#dbeafe', text: '#2563eb' },
        { bg: '#fce7f3', text: '#db2777' },
        { bg: '#d1fae5', text: '#059669' },
        { bg: '#fef3c7', text: '#d97706' },
        { bg: '#e0e7ff', text: '#4f46e5' },
        { bg: '#fee2e2', text: '#dc2626' },
        { bg: '#cffafe', text: '#0891b2' },
        { bg: '#f3e8ff', text: '#9333ea' }
    ];
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

// ═══════════════════════════════════════════════════════════════
// STAT CHIP COMPONENT
// ═══════════════════════════════════════════════════════════════
const StatChip = memo(({ icon: Icon, value, label, color, animate }) => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        background: `${color}10`,
        border: `1px solid ${color}25`,
        borderRadius: 12,
        whiteSpace: 'nowrap'
    }}>
        <Icon
            size={11}
            style={{ color }}
            strokeWidth={2.5}
            className={animate ? 'pulse-task-icon' : ''}
        />
        <span style={{ fontSize: 12, fontWeight: 800, color }}>
            {value}
        </span>
        <span style={{ fontSize: 9, color: '#8c8e8f', fontWeight: 600 }}>
            {label}
        </span>
    </div>
));

// ═══════════════════════════════════════════════════════════════
// SEGMENTED PROGRESS BAR
// ═══════════════════════════════════════════════════════════════
const SegmentedProgress = memo(({ counts, total }) => {
    if (total === 0) {
        return (
            <div style={{
                height: 6,
                background: '#d9e6e9',
                borderRadius: 3,
                overflow: 'hidden'
            }} />
        );
    }

    const segments = [
        { label: 'Completed', value: counts.completed, color: '#10b981' },
        { label: 'In Progress', value: counts.inProgress, color: '#3b82f6' },
        { label: 'Pending', value: counts.pending, color: '#f59e0b' },
        { label: 'Overdue', value: counts.overdue, color: '#ef4444' },
        { label: 'Todo', value: counts.todo, color: '#94a3b8' },
    ].filter(s => s.value > 0);

    return (
        <div style={{
            display: 'flex',
            height: 6,
            background: '#d9e6e9',
            borderRadius: 3,
            overflow: 'hidden',
            gap: 1
        }}>
            {segments.map((seg, i) => {
                const pct = (seg.value / total) * 100;
                if (pct < 1) return null;
                return (
                    <Tooltip key={i} title={`${seg.label}: ${seg.value} (${pct.toFixed(0)}%)`}>
                        <div
                            style={{
                                width: `${pct}%`,
                                background: seg.color,
                                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer'
                            }}
                        />
                    </Tooltip>
                );
            })}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// TASK ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════
const TaskItem = memo(({ task, isLast }) => {
    const status = getStatusConfig(task);
    const priority = getPriorityConfig(task.priority || task.Priority);
    const StatusIcon = status.icon;
    const dueDateInfo = formatDueDate(task.dueDate || task.DueDate);
    const assigneeName = task.assigneeName || task.AssigneeName || '';
    const avatarColor = getAvatarColor(assigneeName);
    const title = task.title || task.Title || 'Untitled Task';
    const isCompleted = (task.status || '').toUpperCase() === 'COMPLETED';

    return (
        <div
            className="task-item-hover"
            style={{
                padding: '12px 14px',
                background: '#ffffff',
                border: '1px solid #d9e6e9',
                borderLeft: `3px solid ${status.color}`,
                borderRadius: 10,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Top Row: Status + Priority + Time */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
                flexWrap: 'wrap'
            }}>
                {/* Status badge */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 8px',
                    background: status.bg,
                    border: `1px solid ${status.border}`,
                    borderRadius: 12,
                    fontSize: 9,
                    fontWeight: 800,
                    color: status.color,
                    letterSpacing: '0.04em'
                }}>
                    <StatusIcon
                        size={10}
                        strokeWidth={2.5}
                        className={status.pulse ? 'pulse-task-icon' : ''}
                    />
                    {status.label}
                </div>

                {/* Priority indicator */}
                {task.priority && (
                    <Tooltip title={`Priority: ${priority.label}`}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 9,
                            fontWeight: 700,
                            color: priority.color
                        }}>
                            <Flag size={9} strokeWidth={2.5} />
                            {priority.label}
                        </div>
                    </Tooltip>
                )}

                {/* Due date */}
                <div style={{
                    marginLeft: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 10,
                    fontWeight: 600,
                    color: dueDateInfo.color,
                    background: dueDateInfo.urgent ? `${dueDateInfo.color}10` : 'transparent',
                    padding: dueDateInfo.urgent ? '2px 6px' : '0',
                    borderRadius: 6,
                    border: dueDateInfo.urgent ? `1px solid ${dueDateInfo.color}25` : 'none'
                }}>
                    {dueDateInfo.urgent && <Zap size={9} strokeWidth={2.5} />}
                    {!dueDateInfo.urgent && <Calendar size={9} strokeWidth={2.5} />}
                    {dueDateInfo.label}
                </div>
            </div>

            {/* Title */}
            <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: isCompleted ? '#8c8e8f' : '#121b1e',
                lineHeight: 1.3,
                marginBottom: 6,
                textDecoration: isCompleted ? 'line-through' : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }} title={title}>
                {title}
            </div>

            {/* Bottom: Assignee + Tags */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
            }}>
                {/* Assignee */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                    <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: avatarColor.bg,
                        color: avatarColor.text,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 800,
                        flexShrink: 0,
                        border: `1.5px solid ${avatarColor.text}20`
                    }}>
                        {assigneeName ? getInitials(assigneeName) : <User size={11} />}
                    </div>
                    <span style={{
                        fontSize: 11,
                        color: '#8c8e8f',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {assigneeName || 'Unassigned'}
                    </span>
                </div>

                {/* Task tag/category */}
                {(task.category || task.Category) && (
                    <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#8c8e8f',
                        background: '#f1f5f9',
                        padding: '2px 7px',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                    }}>
                        {task.category || task.Category}
                    </span>
                )}
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const TasksOverviewCard = ({ tasks = [], loading = false }) => {
    const counts = useMemo(() => {
        const total = tasks.length;
        const completed = tasks.filter((t) => (t.status || '').toUpperCase() === 'COMPLETED').length;
        const inProgress = tasks.filter((t) => (t.status || '').toUpperCase() === 'IN_PROGRESS').length;
        const pending = tasks.filter((t) => (t.status || '').toUpperCase() === 'PENDING').length;
        const overdue = tasks.filter((t) => {
            if ((t.status || '').toUpperCase() === 'COMPLETED') return false;
            if (t.dueDate) return new Date(t.dueDate) < new Date();
            return false;
        }).length;
        const todo = Math.max(0, total - completed - inProgress - pending - overdue);
        const completionRate = total > 0 ? (completed / total) * 100 : 0;

        return { total, completed, inProgress, pending, overdue, todo, completionRate };
    }, [tasks]);

    // Sort tasks: Overdue → Active → Pending → Todo → Completed
    const sortedTasks = useMemo(() => {
        const priorityOrder = (t) => {
            const status = (t.status || '').toUpperCase();
            const isOverdue = status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < new Date();
            if (isOverdue) return 0;
            if (status === 'IN_PROGRESS') return 1;
            if (status === 'PENDING') return 2;
            if (status === 'TODO' || !status) return 3;
            return 4; // Completed
        };

        return [...tasks]
            .sort((a, b) => {
                const orderDiff = priorityOrder(a) - priorityOrder(b);
                if (orderDiff !== 0) return orderDiff;
                // Then by created date desc
                return new Date(b.createdAt || b.CreatedAt || 0).getTime() -
                    new Date(a.createdAt || a.CreatedAt || 0).getTime();
            })
            .slice(0, 5);
    }, [tasks]);

    return (
        <>
            <style>{`
                @keyframes pulse-task {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.1); }
                }
                .pulse-task-icon {
                    animation: pulse-task 1.5s ease-in-out infinite;
                }
                .task-item-hover:hover {
                    transform: translateX(2px) translateY(-1px);
                    box-shadow: 0 8px 16px -4px rgba(0,0,0,0.08);
                    border-color: #cbd0d4 !important;
                }
                .section-link-tasks:hover {
                    color: #fb4f40 !important;
                    transform: translateX(2px);
                }
                @keyframes shimmer-stat {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                .live-dot-tasks {
                    animation: shimmer-stat 2s ease-in-out infinite;
                }
            `}</style>

            <Card
                styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
                style={{
                    borderRadius: 16,
                    border: '1px solid #d9e6e9',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    background: '#ffffff',
                    height: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                {/* ═══════════════════════════════════════════════════
                    HEADER
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #d9e6e9',
                    background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 14
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: 11,
                                background: 'linear-gradient(135deg, #fb4f40 0%, #d94033 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 4px 12px -2px rgba(251, 79, 64, 0.4)',
                                flexShrink: 0
                            }}>
                                <ClipboardList size={20} strokeWidth={2.5} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 15,
                                    fontWeight: 800,
                                    color: '#121b1e',
                                    letterSpacing: '-0.01em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    lineHeight: 1.2
                                }}>
                                    Optimization Tasks
                                    {counts.overdue > 0 && (
                                        <span className="live-dot-tasks" style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 3,
                                            fontSize: 9,
                                            fontWeight: 800,
                                            color: '#dc2626',
                                            background: '#fef2f2',
                                            border: '1px solid #fecaca',
                                            padding: '1px 6px',
                                            borderRadius: 10
                                        }}>
                                            <AlertTriangle size={9} strokeWidth={2.5} />
                                            {counts.overdue} overdue
                                        </span>
                                    )}
                                </div>
                                <div style={{
                                    fontSize: 11,
                                    color: '#8c8e8f',
                                    fontWeight: 500,
                                    marginTop: 1
                                }}>
                                    Workflow management & assignments
                                </div>
                            </div>
                        </div>

                        <Link
                            to="/tasks"
                            className="section-link-tasks"
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#fb4f40',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            View All
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>

                    {/* Completion Rate + Progress */}
                        <div style={{
                            padding: '10px 14px',
                            background: '#ffffff',
                            border: '1px solid #d9e6e9',
                            borderRadius: 10
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 8
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Award size={13} style={{ color: counts.completionRate >= 70 ? '#10b981' : counts.completionRate >= 40 ? '#f59e0b' : '#94a3b8' }} strokeWidth={2.5} />
                                    <span style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#8c8e8f',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                }}>
                                    Completion Rate
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                <span style={{
                                    fontSize: 18,
                                    fontWeight: 800,
                                    color: counts.completionRate >= 70 ? '#10b981' : counts.completionRate >= 40 ? '#f59e0b' : '#64748b',
                                    letterSpacing: '-0.3px'
                                }}>
                                    {counts.completionRate.toFixed(0)}%
                                </span>
                                <span style={{ fontSize: 10, color: '#8c8e8f', fontWeight: 600 }}>
                                    ({counts.completed}/{counts.total})
                                </span>
                            </div>
                        </div>
                        <SegmentedProgress counts={counts} total={counts.total} />
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    STAT CHIPS ROW
                ═══════════════════════════════════════════════════ */}
                {counts.total > 0 && (
                    <div style={{
                        padding: '12px 20px',
                        background: '#fafbfc',
                        borderBottom: '1px solid #d9e6e9',
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap'
                    }}>
                        {counts.overdue > 0 && (
                            <StatChip
                                icon={AlertTriangle}
                                value={counts.overdue}
                                label="Overdue"
                                color="#ef4444"
                                animate
                            />
                        )}
                        {counts.inProgress > 0 && (
                            <StatChip
                                icon={PlayCircle}
                                value={counts.inProgress}
                                label="Active"
                                color="#3b82f6"
                                animate
                            />
                        )}
                        {counts.pending > 0 && (
                            <StatChip
                                icon={Clock}
                                value={counts.pending}
                                label="Pending"
                                color="#f59e0b"
                            />
                        )}
                        {counts.todo > 0 && (
                            <StatChip
                                icon={ListTodo}
                                value={counts.todo}
                                label="Todo"
                                color="#94a3b8"
                            />
                        )}
                        {counts.completed > 0 && (
                            <StatChip
                                icon={CheckCircle2}
                                value={counts.completed}
                                label="Done"
                                color="#10b981"
                            />
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════
                    TASK LIST
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '14px 20px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    overflowY: 'auto'
                }}>
                    {sortedTasks.length === 0 ? (
                        loading ? (
                            <div style={{
                                padding: '40px 12px',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    display: 'inline-block',
                                    width: 32,
                                    height: 32,
                                    border: '3px solid #f1f5f9',
                                    borderTop: '3px solid #f59e0b',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    marginBottom: 12
                                }} />
                                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                                    Loading tasks...
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                padding: '32px 12px',
                                textAlign: 'center',
                                background: '#fafbfc',
                                border: '1px dashed #e2e8f0',
                                borderRadius: 10,
                                margin: 'auto'
                            }}>
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 12,
                                    border: '2px solid #a7f3d0'
                                }}>
                                    <Sparkles size={20} style={{ color: '#10b981' }} strokeWidth={2.5} />
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                                    All Caught Up! 🎉
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>
                                    No optimization tasks at this time
                                </div>
                            </div>
                        )
                    ) : (
                        sortedTasks.map((task, idx) => (
                            <TaskItem
                                key={task.id || task._id || idx}
                                task={task}
                                isLast={idx === sortedTasks.length - 1}
                            />
                        ))
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════
                    FOOTER (Summary stats)
                ═══════════════════════════════════════════════════ */}
                {counts.total > 0 && (
                    <div style={{
                        padding: '10px 20px',
                        background: '#fafbfc',
                        borderTop: '1px solid #d9e6e9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8
                    }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            color: '#8c8e8f',
                            fontWeight: 600
                        }}>
                            <Activity size={10} strokeWidth={2.5} />
                            Showing top {sortedTasks.length} of {counts.total}
                        </div>

                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            fontWeight: 700,
                            color: counts.completionRate >= 70 ? '#059669' : counts.completionRate >= 40 ? '#d97706' : '#64748b',
                            background: counts.completionRate >= 70 ? '#d1fae5' : counts.completionRate >= 40 ? '#fef3c7' : '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: 12,
                            border: `1px solid ${counts.completionRate >= 70 ? '#a7f3d0' : counts.completionRate >= 40 ? '#fde68a' : '#e2e8f0'}`
                        }}>
                            <TrendingUp size={10} strokeWidth={2.5} />
                            {counts.completionRate >= 70 ? 'Healthy' : counts.completionRate >= 40 ? 'Moderate' : 'Needs Focus'}
                        </div>
                    </div>
                )}

                <style>{`
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </Card>
        </>
    );
};

export default memo(TasksOverviewCard);