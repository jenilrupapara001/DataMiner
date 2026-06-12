import React, { memo, useMemo } from 'react';
import { Card, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
    Target, Package, Zap, ClipboardList, AlertCircle, RefreshCw,
    ArrowUpRight, CheckCircle2, Clock, AlertTriangle, TrendingUp,
    Activity, ChevronRight, Layers, Sparkles
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const formatIndianCurrencyShort = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    const num = Math.round(val);
    const absNum = Math.abs(num);
    if (absNum >= 10000000) return `₹${(num / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`;
    if (absNum >= 100000) return `₹${(num / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
    if (absNum >= 1000) return `₹${(num / 1000).toFixed(1).replace(/\.?0+$/, '')}k`;
    return `₹${num}`;
};

const formatNumber = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Math.round(val).toLocaleString('en-IN');
};

// ═══════════════════════════════════════════════════════════════
// SEGMENTED PROGRESS BAR (Multi-color stacked)
// ═══════════════════════════════════════════════════════════════
const SegmentedProgress = memo(({ segments = [], height = 8 }) => {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    if (total === 0) {
        return (
            <div style={{
                height,
                background: '#f1f5f9',
                borderRadius: height / 2,
                overflow: 'hidden'
            }} />
        );
    }

    return (
        <div style={{
            display: 'flex',
            height,
            background: '#f1f5f9',
            borderRadius: height / 2,
            overflow: 'hidden',
            gap: 1
        }}>
            {segments.map((seg, i) => {
                const pct = (seg.value / total) * 100;
                if (pct < 0.5) return null;
                return (
                    <Tooltip key={i} title={`${seg.label}: ${seg.value}`}>
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
// CIRCULAR RING PROGRESS
// ═══════════════════════════════════════════════════════════════
const CircularRing = memo(({ percent = 0, color = '#10b981', size = 50, strokeWidth = 4 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

    return (
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
            </svg>
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
                color: color
            }}>
                {Math.round(percent)}%
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// STAT MINI BLOCK (small metric display)
// ═══════════════════════════════════════════════════════════════
const StatMini = memo(({ label, value, color, icon: Icon, pulse, animate }) => (
    <div
        className={pulse ? 'stat-pulse' : ''}
        style={{
            flex: 1,
            minWidth: 0,
            padding: '8px 10px',
            background: color ? `${color}08` : '#f8fafc',
            border: `1px solid ${color ? `${color}20` : '#e2e8f0'}`,
            borderRadius: 8,
            transition: 'all 0.2s',
            cursor: 'default'
        }}
    >
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 2
        }}>
            {Icon && (
                <Icon
                    size={9}
                    className={animate ? 'rotating-icon-mini' : ''}
                    style={{ color: color || '#94a3b8', flexShrink: 0 }}
                />
            )}
            <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: color ? `${color}` : '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {label}
            </span>
        </div>
        <div style={{
            fontSize: 14,
            fontWeight: 800,
            color: color || '#0f172a',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        }}>
            {value}
        </div>
    </div>
));

// ═══════════════════════════════════════════════════════════════
// PREMIUM MODULE CARD
// ═══════════════════════════════════════════════════════════════
const ModuleCard = memo(({ module, onClick }) => {
    const {
        title, subtitle, icon: Icon, color, gradient, badge,
        primaryMetric, stats, segments, progress, statusText, statusColor,
        hasAnimation
    } = module;

    return (
        <div
            onClick={onClick}
            className="module-card"
            style={{
                position: 'relative',
                background: '#ffffff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
        >
            {/* Top gradient accent */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: gradient || color,
                borderRadius: '16px 16px 0 0'
            }} />

            {/* Top section: Icon + Title + Badge */}
            <div style={{ padding: '18px 18px 12px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    marginBottom: 14
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                        <div style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            background: gradient || `${color}15`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: gradient ? '#ffffff' : color,
                            flexShrink: 0,
                            boxShadow: gradient ? `0 4px 12px -2px ${color}40` : 'none'
                        }}>
                            <Icon
                                size={20}
                                strokeWidth={2.5}
                                className={hasAnimation ? 'rotating-icon' : ''}
                            />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 14,
                                fontWeight: 800,
                                color: '#0f172a',
                                letterSpacing: '-0.01em',
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {title}
                            </div>
                            {subtitle && (
                                <div style={{
                                    fontSize: 11,
                                    color: '#94a3b8',
                                    fontWeight: 500,
                                    marginTop: 2,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}>
                                    {subtitle}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status Badge / Action arrow */}
                    {badge ? (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            background: `${badge.color}15`,
                            border: `1px solid ${badge.color}30`,
                            borderRadius: 12,
                            fontSize: 9,
                            fontWeight: 700,
                            color: badge.color,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                        }}>
                            {badge.icon && <badge.icon size={10} strokeWidth={2.5} />}
                            {badge.text}
                        </div>
                    ) : (
                        <div className="action-arrow" style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#94a3b8',
                            transition: 'all 0.2s'
                        }}>
                            <ChevronRight size={14} strokeWidth={2.5} />
                        </div>
                    )}
                </div>

                {/* Primary Metric (Big number with optional ring) */}
                {primaryMetric && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '12px 14px',
                        background: `linear-gradient(135deg, ${color}06 0%, ${color}02 100%)`,
                        border: `1px solid ${color}15`,
                        borderRadius: 12,
                        marginBottom: 12
                    }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#94a3b8',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                marginBottom: 2
                            }}>
                                {primaryMetric.label}
                            </div>
                            <div style={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: '#0f172a',
                                letterSpacing: '-0.5px',
                                lineHeight: 1,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {primaryMetric.value}
                            </div>
                            {primaryMetric.subValue && (
                                <div style={{
                                    fontSize: 10,
                                    color: '#94a3b8',
                                    fontWeight: 500,
                                    marginTop: 3
                                }}>
                                    {primaryMetric.subValue}
                                </div>
                            )}
                        </div>
                        {progress !== undefined && (
                            <CircularRing
                                percent={progress}
                                color={color}
                                size={50}
                                strokeWidth={4}
                            />
                        )}
                    </div>
                )}

                {/* Stats Grid (2x2 mini stat blocks) */}
                {stats && stats.length > 0 && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: 6,
                        marginBottom: segments && segments.length > 0 ? 12 : 0
                    }}>
                        {stats.map((s, i) => (
                            <StatMini
                                key={i}
                                label={s.label}
                                value={s.value}
                                color={s.color}
                                icon={s.icon}
                                pulse={s.pulse}
                                animate={s.animate}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Bottom: Segmented progress + Status */}
            {(segments || statusText) && (
                <div style={{
                    padding: '12px 18px 14px',
                    background: '#fafbfc',
                    borderTop: '1px solid #f1f5f9',
                    marginTop: 'auto'
                }}>
                    {segments && segments.length > 0 && (
                        <>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 6
                            }}>
                                <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: '#64748b',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Distribution
                                </span>
                                {statusText && (
                                    <span style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: statusColor || '#64748b',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3
                                    }}>
                                        <Activity size={9} />
                                        {statusText}
                                    </span>
                                )}
                            </div>
                            <SegmentedProgress segments={segments} height={6} />
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '4px 10px',
                                marginTop: 8
                            }}>
                                {segments.map((seg, i) => (
                                    <div key={i} style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        fontSize: 9,
                                        fontWeight: 600,
                                        color: '#64748b'
                                    }}>
                                        <div style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: '50%',
                                            background: seg.color
                                        }} />
                                        <span style={{ color: seg.color }}>{seg.value}</span>
                                        <span>{seg.label}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {!segments && statusText && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: statusColor || '#64748b',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                            }}>
                                <Activity size={11} />
                                {statusText}
                            </span>
                            <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#94a3b8',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3
                            }}>
                                View Details
                                <ArrowUpRight size={11} strokeWidth={2.5} />
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const ModuleStatusGrid = ({ moduleStats }) => {
    const navigate = useNavigate();

    const modules = useMemo(() => [
        // ═══ 1. TARGET MANAGEMENT ═══
        {
            title: 'Target Management',
            subtitle: 'Revenue & sales tracking',
            path: '/target-achievement/dashboard',
            color: '#4f46e5',
            gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            icon: Target,
            badge: {
                text: `${moduleStats.targets.rate.toFixed(0)}% Pacing`,
                color: moduleStats.targets.rate >= 80 ? '#10b981' : moduleStats.targets.rate >= 50 ? '#f59e0b' : '#ef4444',
                icon: TrendingUp
            },
            primaryMetric: {
                label: 'Total Targets',
                value: moduleStats.targets.total.toString(),
                subValue: `Achievement rate: ${moduleStats.targets.rate.toFixed(1)}%`
            },
            progress: moduleStats.targets.rate,
            stats: [
                { label: 'Completed', value: moduleStats.targets.completed, color: '#10b981', icon: CheckCircle2 },
                { label: 'On Track', value: moduleStats.targets.onTrack, color: '#3b82f6', icon: TrendingUp },
                { label: 'At Risk', value: moduleStats.targets.atRisk, color: '#ef4444', icon: AlertTriangle },
                { label: 'Plans', value: moduleStats.targets.total, color: '#6366f1', icon: Layers }
            ],
            segments: [
                { label: 'Completed', value: moduleStats.targets.completed, color: '#10b981' },
                { label: 'On Track', value: moduleStats.targets.onTrack, color: '#3b82f6' },
                { label: 'At Risk', value: moduleStats.targets.atRisk, color: '#ef4444' }
            ],
            statusText: moduleStats.targets.rate >= 80 ? 'Excellent' : moduleStats.targets.rate >= 50 ? 'On Track' : 'Needs Attention',
            statusColor: moduleStats.targets.rate >= 80 ? '#10b981' : moduleStats.targets.rate >= 50 ? '#f59e0b' : '#ef4444'
        },

        // ═══ 2. ASIN CATALOG ═══
        {
            title: 'ASIN Catalog',
            subtitle: 'Product portfolio tracking',
            path: '/asin-tracker',
            color: '#2563eb',
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            icon: Package,
            badge: {
                text: 'Live',
                color: '#10b981',
                icon: Activity
            },
            primaryMetric: {
                label: 'Tracked ASINs',
                value: formatNumber(moduleStats.asins.total),
                subValue: `${moduleStats.asins.active} active products`
            },
            stats: [
                { label: 'Active', value: formatNumber(moduleStats.asins.active), color: '#10b981', icon: CheckCircle2 },
                { label: 'Out of Stock', value: moduleStats.asins.outOfStock, color: '#ef4444', icon: AlertCircle, pulse: moduleStats.asins.outOfStock > 0 },
                { label: 'New', value: moduleStats.asins.newThisMonth, color: '#8b5cf6', icon: Sparkles },
                { label: 'Total', value: formatNumber(moduleStats.asins.total), color: '#2563eb', icon: Package }
            ],
            statusText: 'Catalog Healthy',
            statusColor: '#10b981'
        },

        // ═══ 3. ADS PERFORMANCE ═══
        {
            title: 'Ads Performance',
            subtitle: 'Campaign metrics & ROAS',
            path: '/ads-report',
            color: '#10b981',
            gradient: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
            icon: Zap,
            badge: {
                text: moduleStats.ads.acos <= 25 ? 'Healthy' : 'High ACoS',
                color: moduleStats.ads.acos <= 25 ? '#10b981' : '#f59e0b',
                icon: moduleStats.ads.acos <= 25 ? CheckCircle2 : AlertTriangle
            },
            primaryMetric: {
                label: 'Total Ad Sales',
                value: formatIndianCurrencyShort(moduleStats.ads.totalSales),
                subValue: `Spend: ${formatIndianCurrencyShort(moduleStats.ads.totalSpend)}`
            },
            stats: [
                { label: 'ACoS', value: `${moduleStats.ads.acos.toFixed(1)}%`, color: moduleStats.ads.acos <= 25 ? '#10b981' : '#f59e0b' },
                { label: 'ROAS', value: `${moduleStats.ads.roas.toFixed(2)}x`, color: moduleStats.ads.roas >= 4 ? '#10b981' : '#f59e0b' },
                { label: 'Spend', value: formatIndianCurrencyShort(moduleStats.ads.totalSpend), color: '#ef4444' },
                { label: 'Sales', value: formatIndianCurrencyShort(moduleStats.ads.totalSales), color: '#10b981' }
            ],
            statusText: moduleStats.ads.roas >= 4 ? 'High ROAS' : 'Moderate Performance',
            statusColor: moduleStats.ads.roas >= 4 ? '#10b981' : '#f59e0b'
        },

        // ═══ 4. OPTIMIZATION TASKS ═══
        {
            title: 'Optimization Tasks',
            subtitle: 'Workflow management',
            path: '/tasks',
            color: '#f59e0b',
            gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            icon: ClipboardList,
            badge: moduleStats.tasks.overdue > 0 ? {
                text: `${moduleStats.tasks.overdue} Overdue`,
                color: '#ef4444',
                icon: AlertTriangle
            } : {
                text: 'On Schedule',
                color: '#10b981',
                icon: CheckCircle2
            },
            primaryMetric: {
                label: 'Total Tasks',
                value: moduleStats.tasks.total.toString(),
                subValue: `${moduleStats.tasks.completed} completed of ${moduleStats.tasks.total}`
            },
            progress: moduleStats.tasks.total > 0 ? (moduleStats.tasks.completed / moduleStats.tasks.total) * 100 : 0,
            stats: [
                { label: 'Completed', value: moduleStats.tasks.completed, color: '#10b981', icon: CheckCircle2 },
                { label: 'In Progress', value: moduleStats.tasks.inProgress, color: '#3b82f6', icon: Activity },
                { label: 'Pending', value: moduleStats.tasks.pending, color: '#f59e0b', icon: Clock },
                { label: 'Overdue', value: moduleStats.tasks.overdue, color: '#ef4444', icon: AlertTriangle, pulse: moduleStats.tasks.overdue > 0 }
            ],
            segments: [
                { label: 'Done', value: moduleStats.tasks.completed, color: '#10b981' },
                { label: 'Active', value: moduleStats.tasks.inProgress, color: '#3b82f6' },
                { label: 'Pending', value: moduleStats.tasks.pending, color: '#f59e0b' },
                { label: 'Overdue', value: moduleStats.tasks.overdue, color: '#ef4444' }
            ]
        },

        // ═══ 5. ALERTS & RULES ═══
        {
            title: 'Alerts & Rules',
            subtitle: 'Active monitoring system',
            path: '/alerts',
            color: '#ef4444',
            gradient: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
            icon: AlertCircle,
            badge: moduleStats.alerts.critical > 0 ? {
                text: `${moduleStats.alerts.critical} Critical`,
                color: '#ef4444',
                icon: AlertCircle
            } : {
                text: 'All Clear',
                color: '#10b981',
                icon: CheckCircle2
            },
            primaryMetric: {
                label: 'Active Alerts',
                value: moduleStats.alerts.total.toString(),
                subValue: `${moduleStats.alerts.critical} require attention`
            },
            stats: [
                { label: 'Critical', value: moduleStats.alerts.critical, color: '#ef4444', icon: AlertCircle, pulse: moduleStats.alerts.critical > 0 },
                { label: 'Warning', value: moduleStats.alerts.warning, color: '#f59e0b', icon: AlertTriangle },
                { label: 'Info', value: moduleStats.alerts.info, color: '#3b82f6', icon: Activity },
                { label: 'Total', value: moduleStats.alerts.total, color: '#64748b', icon: Layers }
            ],
            segments: [
                { label: 'Critical', value: moduleStats.alerts.critical, color: '#ef4444' },
                { label: 'Warning', value: moduleStats.alerts.warning, color: '#f59e0b' },
                { label: 'Info', value: moduleStats.alerts.info, color: '#3b82f6' }
            ]
        },

        // ═══ 6. DATA PIPELINE ═══
        {
            title: 'Data Pipeline',
            subtitle: 'Octoparse sync engine',
            path: '/scrape-tasks',
            color: '#06b6d4',
            gradient: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
            icon: RefreshCw,
            hasAnimation: moduleStats.pipeline.running > 0,
            badge: moduleStats.pipeline.running > 0 ? {
                text: 'Syncing',
                color: '#06b6d4',
                icon: RefreshCw
            } : {
                text: 'Idle',
                color: '#64748b',
                icon: Clock
            },
            primaryMetric: {
                label: 'Pipeline Tasks',
                value: moduleStats.pipeline.total.toString(),
                subValue: moduleStats.pipeline.running > 0 ? `${moduleStats.pipeline.running} running now` : 'No active jobs'
            },
            stats: [
                { label: 'Running', value: moduleStats.pipeline.running, color: '#3b82f6', icon: RefreshCw, animate: moduleStats.pipeline.running > 0 },
                { label: 'Completed', value: moduleStats.pipeline.completed, color: '#10b981', icon: CheckCircle2 },
                { label: 'Failed', value: moduleStats.pipeline.failed, color: '#ef4444', icon: AlertCircle, pulse: moduleStats.pipeline.failed > 0 },
                { label: 'Idle', value: moduleStats.pipeline.idle, color: '#64748b', icon: Clock }
            ],
            segments: [
                { label: 'Done', value: moduleStats.pipeline.completed, color: '#10b981' },
                { label: 'Running', value: moduleStats.pipeline.running, color: '#3b82f6' },
                { label: 'Failed', value: moduleStats.pipeline.failed, color: '#ef4444' },
                { label: 'Idle', value: moduleStats.pipeline.idle, color: '#64748b' }
            ]
        }
    ], [moduleStats]);

    return (
        <>
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { 
                        box-shadow: 0 0 0 0 currentColor; 
                        opacity: 1;
                    }
                    50% { 
                        box-shadow: 0 0 0 4px transparent; 
                        opacity: 0.7;
                    }
                }
                @keyframes spin-slow {
                    to { transform: rotate(360deg); }
                }
                @keyframes scale-pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.03); opacity: 0.9; }
                }
                .rotating-icon {
                    animation: spin-slow 3s linear infinite;
                }
                .rotating-icon-mini {
                    animation: spin-slow 2s linear infinite;
                }
                .stat-pulse {
                    animation: scale-pulse 2s ease-in-out infinite;
                }
                .module-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.12);
                    border-color: #cbd5e1;
                }
                .module-card:hover .action-arrow {
                    background: #4f46e5 !important;
                    color: #ffffff !important;
                    transform: translateX(2px);
                }
            `}</style>

            {/* Section Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 14
            }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: '1px solid #99f6e4'
                }}>
                    <Layers size={13} style={{ color: '#0d9488' }} />
                    <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#115e59',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em'
                    }}>
                        Module Health Overview
                    </span>
                </div>
                <div style={{
                    flex: 1,
                    height: 1,
                    background: 'linear-gradient(90deg, #e2e8f0 0%, transparent 100%)'
                }} />
                <span style={{
                    fontSize: 11,
                    color: '#94a3b8',
                    fontWeight: 600
                }}>
                    {modules.length} modules · Real-time sync
                </span>
            </div>

            {/* Module Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 18,
                marginBottom: 24
            }}>
                {modules.map((m, idx) => (
                    <ModuleCard
                        key={idx}
                        module={m}
                        onClick={() => navigate(m.path)}
                    />
                ))}
            </div>
        </>
    );
};

export default memo(ModuleStatusGrid);