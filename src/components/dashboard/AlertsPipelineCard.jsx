import React, { memo, useMemo } from 'react';
import { Card, Tooltip, Progress } from 'antd';
import { Link } from 'react-router-dom';
import {
    Play, Activity, AlertTriangle, CheckCircle2, RefreshCw,
    AlertCircle, Bell, Shield, ChevronRight, Zap, Clock,
    Database, ArrowUpRight, XCircle, Info, Loader2,
    Sparkles, TrendingUp, Eye
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const getAlertSeverity = (type = '') => {
    const t = String(type).toUpperCase();
    if (t.includes('ERROR') || t.includes('FAILURE') || t.includes('CRITICAL')) {
        return {
            level: 'critical',
            color: '#ef4444',
            bg: '#fef2f2',
            border: '#fecaca',
            icon: AlertCircle,
            label: 'CRITICAL'
        };
    }
    if (t === 'DELETE' || t.includes('WARN')) {
        return {
            level: 'warning',
            color: '#f59e0b',
            bg: '#fffbeb',
            border: '#fde68a',
            icon: AlertTriangle,
            label: 'WARNING'
        };
    }
    if (t === 'UPDATE' || t.includes('STATUS')) {
        return {
            level: 'info',
            color: '#f97316',
            bg: '#fff7ed',
            border: '#fed7aa',
            icon: Info,
            label: 'UPDATE'
        };
    }
    if (t === 'CREATE' || t.includes('SUCCESS') || t === 'IMPORT') {
        return {
            level: 'success',
            color: '#10b981',
            bg: '#ecfdf5',
            border: '#a7f3d0',
            icon: CheckCircle2,
            label: 'SUCCESS'
        };
    }
    return {
        level: 'neutral',
        color: '#3b82f6',
        bg: '#eff6ff',
        border: '#bfdbfe',
        icon: Info,
        label: 'INFO'
    };
};

const formatLogTime = (dateString) => {
    if (!dateString) return 'Now';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Now';
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    if (diffSec < 30) return 'just now';
    if (diffMin < 1) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const getPipelineStatus = (status = '') => {
    const s = String(status).toUpperCase();
    if (s === 'RUNNING' || s === 'IN_PROGRESS') {
        return {
            color: '#3b82f6',
            bg: '#eff6ff',
            border: '#bfdbfe',
            icon: Loader2,
            label: 'RUNNING',
            isAnimated: true
        };
    }
    if (s === 'COMPLETED' || s === 'SUCCESS') {
        return {
            color: '#10b981',
            bg: '#ecfdf5',
            border: '#a7f3d0',
            icon: CheckCircle2,
            label: 'COMPLETED'
        };
    }
    if (s === 'FAILED' || s === 'ERROR') {
        return {
            color: '#ef4444',
            bg: '#fef2f2',
            border: '#fecaca',
            icon: XCircle,
            label: 'FAILED'
        };
    }
    return {
        color: '#64748b',
        bg: '#f8fafc',
        border: '#e2e8f0',
        icon: Clock,
        label: 'IDLE'
    };
};

// ═══════════════════════════════════════════════════════════════
// ALERT ITEM COMPONENT
// ═══════════════════════════════════════════════════════════════
const AlertItem = memo(({ alert }) => {
    const type = alert.Type || alert.type;
    const severity = getAlertSeverity(type);
    const SeverityIcon = severity.icon;
    const title = alert.EntityTitle || alert.entityTitle || alert.title || 'System Alert';
    const subtitle = alert.Description || alert.description || alert.subtitle || 'Activity detected';
    const timeStr = formatLogTime(alert.CreatedAt || alert.createdAt);
    const isFresh = (() => {
        const dt = alert.CreatedAt || alert.createdAt;
        if (!dt) return false;
        const diff = Date.now() - new Date(dt).getTime();
        return diff < 60000; // less than 1 min
    })();

    return (
        <div
            className="alert-item-hover"
            style={{
                position: 'relative',
                padding: '12px 14px',
                background: severity.bg,
                border: `1px solid ${severity.border}`,
                borderLeft: `3px solid ${severity.color}`,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                transition: 'all 0.2s',
                cursor: 'pointer'
            }}
        >
            {/* Severity Icon */}
            <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: `${severity.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: severity.color,
                flexShrink: 0
            }}>
                <SeverityIcon size={14} strokeWidth={2.5} />
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 2
                }}>
                    <span style={{
                        fontSize: 8,
                        fontWeight: 800,
                        color: severity.color,
                        background: '#ffffff',
                        padding: '1px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        border: `1px solid ${severity.border}`,
                        whiteSpace: 'nowrap'
                    }}>
                        {severity.label}
                    </span>
                    {isFresh && (
                        <span className="fresh-dot" style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#10b981',
                            display: 'inline-block'
                        }} />
                    )}
                    <span style={{
                        fontSize: 9,
                        color: '#94a3b8',
                        fontWeight: 600,
                        marginLeft: 'auto',
                        whiteSpace: 'nowrap'
                    }}>
                        {timeStr}
                    </span>
                </div>
                <div style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#0f172a',
                    lineHeight: 1.3,
                    marginBottom: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {title}
                </div>
                <div style={{
                    fontSize: 11,
                    color: '#64748b',
                    fontWeight: 500,
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {subtitle}
                </div>
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// PIPELINE TASK COMPONENT
// ═══════════════════════════════════════════════════════════════
const PipelineTaskItem = memo(({ task }) => {
    const status = getPipelineStatus(task.status);
    const StatusIcon = status.icon;
    const taskName = task.taskName || task.TaskName || task.sellerName || `Sync #${task.id || ''}`;
    const progress = task.progress || (status.label === 'COMPLETED' ? 100 : status.label === 'RUNNING' ? 65 : 0);
    const asinCount = task.asinCount || 0;

    return (
        <div
            className="pipeline-task-hover"
            style={{
                position: 'relative',
                padding: '11px 14px',
                background: '#ffffff',
                border: `1px solid ${status.border}`,
                borderRadius: 10,
                transition: 'all 0.2s',
                overflow: 'hidden'
            }}
        >
            {/* Top: Task name + Status */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: progress > 0 && status.label === 'RUNNING' ? 8 : 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: `${status.color}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: status.color,
                        flexShrink: 0
                    }}>
                        <StatusIcon
                            size={13}
                            strokeWidth={2.5}
                            className={status.isAnimated ? 'spinning-icon' : ''}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: 1.2
                        }}>
                            {taskName}
                        </div>
                        {asinCount > 0 && (
                            <div style={{
                                fontSize: 10,
                                color: '#94a3b8',
                                fontWeight: 500,
                                marginTop: 1
                            }}>
                                {asinCount.toLocaleString('en-IN')} ASINs
                            </div>
                        )}
                    </div>
                </div>

                {/* Status badge */}
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 9,
                    fontWeight: 800,
                    color: status.color,
                    background: status.bg,
                    padding: '3px 8px',
                    borderRadius: 12,
                    border: `1px solid ${status.border}`,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    marginLeft: 6
                }}>
                    {status.isAnimated && (
                        <span className="status-pulse" style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            background: status.color,
                            display: 'inline-block'
                        }} />
                    )}
                    {status.label}
                </div>
            </div>

            {/* Progress Bar (only for running) */}
            {progress > 0 && status.label === 'RUNNING' && (
                <div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 3
                    }}>
                        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>
                            Progress
                        </span>
                        <span style={{ fontSize: 9, color: status.color, fontWeight: 800 }}>
                            {progress}%
                        </span>
                    </div>
                    <div style={{
                        height: 4,
                        background: '#f1f5f9',
                        borderRadius: 2,
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        <div
                            className="progress-fill-animated"
                            style={{
                                height: '100%',
                                width: `${progress}%`,
                                background: `linear-gradient(90deg, ${status.color}80 0%, ${status.color} 100%)`,
                                borderRadius: 2,
                                transition: 'width 0.6s ease',
                                boxShadow: `0 0 8px ${status.color}50`
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// SUMMARY STAT CHIP
// ═══════════════════════════════════════════════════════════════
const StatChip = memo(({ icon: Icon, value, label, color, animate }) => (
    <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 9px',
        background: `${color}10`,
        border: `1px solid ${color}25`,
        borderRadius: 12
    }}>
        <Icon
            size={11}
            style={{ color }}
            strokeWidth={2.5}
            className={animate ? 'spinning-icon' : ''}
        />
        <span style={{ fontSize: 11, fontWeight: 800, color }}>
            {value}
        </span>
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600 }}>
            {label}
        </span>
    </div>
));

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const AlertsPipelineCard = ({
    alerts = [],
    pipelineTasks = [],
    onSyncClick,
    syncLoading
}) => {
    const displayAlerts = alerts.slice(0, 3);
    const activeTasks = pipelineTasks.slice(0, 3);

    // Compute alert stats
    const alertStats = useMemo(() => {
        let critical = 0, warning = 0, info = 0;
        alerts.forEach(a => {
            const type = String(a.Type || a.type || '').toUpperCase();
            if (type.includes('ERROR') || type.includes('FAILURE') || type.includes('CRITICAL')) critical++;
            else if (type === 'DELETE' || type.includes('WARN')) warning++;
            else info++;
        });
        return { critical, warning, info, total: alerts.length };
    }, [alerts]);

    // Compute pipeline stats
    const pipelineStats = useMemo(() => {
        let running = 0, completed = 0, failed = 0, idle = 0;
        pipelineTasks.forEach(t => {
            const s = String(t.status || '').toUpperCase();
            if (s === 'RUNNING' || s === 'IN_PROGRESS') running++;
            else if (s === 'COMPLETED' || s === 'SUCCESS') completed++;
            else if (s === 'FAILED' || s === 'ERROR') failed++;
            else idle++;
        });
        return { running, completed, failed, idle, total: pipelineTasks.length };
    }, [pipelineTasks]);

    return (
        <>
            <style>{`
                @keyframes spin-icon {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse-status {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.2); }
                }
                @keyframes pulse-fresh {
                    0%, 100% { box-shadow: 0 0 0 0 #10b981; }
                    50% { box-shadow: 0 0 0 4px transparent; }
                }
                @keyframes shimmer {
                    0% { background-position: -1000px 0; }
                    100% { background-position: 1000px 0; }
                }
                .spinning-icon {
                    animation: spin-icon 1.5s linear infinite;
                }
                .status-pulse {
                    animation: pulse-status 1.5s ease-in-out infinite;
                }
                .fresh-dot {
                    animation: pulse-fresh 2s ease-in-out infinite;
                }
                .progress-fill-animated {
                    background-size: 1000px 100%;
                    animation: shimmer 2s linear infinite;
                }
                .alert-item-hover:hover {
                    transform: translateX(2px);
                    box-shadow: 0 4px 12px -2px rgba(0,0,0,0.06);
                }
                .pipeline-task-hover:hover {
                    border-color: #cbd5e1 !important;
                    box-shadow: 0 4px 12px -2px rgba(0,0,0,0.06);
                }
                .section-link:hover {
                    color: #1d4ed8 !important;
                    transform: translateX(2px);
                }
                .sync-button-premium:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 16px -4px rgba(37,99,235,0.3) !important;
                }
            `}</style>

            <Card
                styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
                style={{
                    borderRadius: 16,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    background: '#ffffff',
                    height: 850,
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
                    borderBottom: '1px solid #f1f5f9',
                    background: 'linear-gradient(135deg, #fafbff 0%, #ffffff 100%)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: 11,
                                background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 4px 12px -2px rgba(239, 68, 68, 0.4)'
                            }}>
                                <Bell size={18} strokeWidth={2.5} />
                            </div>
                            <div>
                                <div style={{
                                    fontSize: 15,
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    letterSpacing: '-0.01em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    lineHeight: 1.2
                                }}>
                                    Alerts & Pipeline
                                    <span className="status-pulse" style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: '#10b981'
                                    }} />
                                </div>
                                <div style={{
                                    fontSize: 11,
                                    color: '#94a3b8',
                                    fontWeight: 500,
                                    marginTop: 1
                                }}>
                                    Real-time monitoring & sync status
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    SYSTEM ALERTS SECTION
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '14px 20px 12px',
                    borderBottom: '1px solid #f1f5f9'
                }}>
                    {/* Section header with stats */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        flexWrap: 'wrap',
                        gap: 8
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 10,
                                fontWeight: 800,
                                color: '#dc2626',
                                background: '#fef2f2',
                                padding: '3px 9px',
                                borderRadius: 12,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                border: '1px solid #fecaca'
                            }}>
                                <Shield size={10} strokeWidth={2.5} />
                                System Alerts
                            </div>
                            {alertStats.total > 0 && (
                                <span style={{
                                    fontSize: 11,
                                    color: '#64748b',
                                    fontWeight: 700
                                }}>
                                    {alertStats.total}
                                </span>
                            )}
                        </div>
                        <Link
                            to="/activity-log"
                            className="section-link"
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#2563eb',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none'
                            }}
                        >
                            View All
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>

                    {/* Alert stats chips */}
                    {alertStats.total > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {alertStats.critical > 0 && (
                                <StatChip
                                    icon={AlertCircle}
                                    value={alertStats.critical}
                                    label="Critical"
                                    color="#ef4444"
                                />
                            )}
                            {alertStats.warning > 0 && (
                                <StatChip
                                    icon={AlertTriangle}
                                    value={alertStats.warning}
                                    label="Warning"
                                    color="#f59e0b"
                                />
                            )}
                            {alertStats.info > 0 && (
                                <StatChip
                                    icon={Info}
                                    value={alertStats.info}
                                    label="Info"
                                    color="#3b82f6"
                                />
                            )}
                        </div>
                    )}

                    {/* Alert items list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {displayAlerts.length === 0 ? (
                            <div style={{
                                padding: '20px 12px',
                                textAlign: 'center',
                                background: '#f0fdf4',
                                border: '1px dashed #a7f3d0',
                                borderRadius: 10
                            }}>
                                <CheckCircle2 size={24} style={{ color: '#10b981', margin: '0 auto 6px' }} />
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 2 }}>
                                    All Clear
                                </div>
                                <div style={{ fontSize: 10, color: '#64748b' }}>
                                    No active alerts at this time
                                </div>
                            </div>
                        ) : (
                            displayAlerts.map((alert, idx) => (
                                <AlertItem key={idx} alert={alert} />
                            ))
                        )}
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    DATA PIPELINE SECTION
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '14px 20px',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Section header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 12,
                        flexWrap: 'wrap',
                        gap: 8
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 10,
                                fontWeight: 800,
                                color: '#0891b2',
                                background: '#ecfeff',
                                padding: '3px 9px',
                                borderRadius: 12,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                border: '1px solid #a5f3fc'
                            }}>
                                <Database size={10} strokeWidth={2.5} />
                                Data Pipeline
                            </div>
                            {pipelineStats.running > 0 && (
                                <span style={{
                                    fontSize: 11,
                                    color: '#0891b2',
                                    fontWeight: 700,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}>
                                    <Loader2 size={11} className="spinning-icon" />
                                    {pipelineStats.running} active
                                </span>
                            )}
                        </div>
                        <Link
                            to="/scrape-tasks"
                            className="section-link"
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#2563eb',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none'
                            }}
                        >
                            All Tasks
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>

                    {/* Pipeline stats chips */}
                    {pipelineStats.total > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                            {pipelineStats.running > 0 && (
                                <StatChip
                                    icon={Loader2}
                                    value={pipelineStats.running}
                                    label="Running"
                                    color="#3b82f6"
                                    animate
                                />
                            )}
                            {pipelineStats.completed > 0 && (
                                <StatChip
                                    icon={CheckCircle2}
                                    value={pipelineStats.completed}
                                    label="Done"
                                    color="#10b981"
                                />
                            )}
                            {pipelineStats.failed > 0 && (
                                <StatChip
                                    icon={XCircle}
                                    value={pipelineStats.failed}
                                    label="Failed"
                                    color="#ef4444"
                                />
                            )}
                            {pipelineStats.idle > 0 && (
                                <StatChip
                                    icon={Clock}
                                    value={pipelineStats.idle}
                                    label="Idle"
                                    color="#64748b"
                                />
                            )}
                        </div>
                    )}

                    {/* Pipeline tasks list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, marginBottom: 12, overflowY: 'auto' }}>
                        {activeTasks.length === 0 ? (
                            <div style={{
                                padding: '20px 12px',
                                textAlign: 'center',
                                background: '#f8fafc',
                                border: '1px dashed #e2e8f0',
                                borderRadius: 10
                            }}>
                                <Database size={24} style={{ color: '#94a3b8', margin: '0 auto 6px' }} />
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 2 }}>
                                    No Pipeline Activity
                                </div>
                                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                    Click sync below to start extraction
                                </div>
                            </div>
                        ) : (
                            activeTasks.map((task, idx) => (
                                <PipelineTaskItem key={idx} task={task} />
                            ))
                        )}
                    </div>

                    {/* Sync Now Button */}
                    <button
                        className="sync-button-premium"
                        onClick={onSyncClick}
                        disabled={syncLoading}
                        style={{
                            width: '100%',
                            padding: '11px 18px',
                            background: syncLoading
                                ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: syncLoading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 7,
                            boxShadow: syncLoading
                                ? 'none'
                                : '0 4px 12px -2px rgba(37, 99, 235, 0.4)',
                            transition: 'all 0.2s',
                            letterSpacing: '0.02em'
                        }}
                    >
                        {syncLoading ? (
                            <>
                                <Loader2 size={14} className="spinning-icon" strokeWidth={2.5} />
                                Syncing Pipeline...
                            </>
                        ) : (
                            <>
                                <Zap size={14} strokeWidth={2.5} />
                                Trigger Pipeline Sync
                                <ArrowUpRight size={12} strokeWidth={2.5} />
                            </>
                        )}
                    </button>
                </div>
            </Card>
        </>
    );
};

export default memo(AlertsPipelineCard);