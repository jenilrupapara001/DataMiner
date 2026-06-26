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
                background: '#d9e6e9',
                borderRadius: height / 2,
                overflow: 'hidden'
            }} />
        );
    }

    return (
        <div style={{
            display: 'flex',
            height,
            background: '#d9e6e9',
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
const CircularRing = memo(({ percent = 0, color = '#2E7D32', size = 50, strokeWidth = 4 }) => {
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
            border: `1px solid ${color ? `${color}20` : '#d9e6e9'}`,
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
                    style={{ color: color || '#8c8e8f', flexShrink: 0 }}
                />
            )}
            <span style={{
                fontSize: 9,
                fontWeight: 700,
                color: color ? `${color}` : '#8c8e8f',
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
            color: color || '#121b1e',
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
                border: '1px solid #d9e6e9',
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
                                color: '#121b1e',
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
                                    color: '#8c8e8f',
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
                                color: '#8c8e8f',
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                marginBottom: 2
                            }}>
                                {primaryMetric.label}
                            </div>
                            <div style={{
                                fontSize: 22,
                                fontWeight: 800,
                                color: '#121b1e',
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
                                    color: '#8c8e8f',
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
                    borderTop: '1px solid #d9e6e9',
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
            color: '#1976D2',
            gradient: 'linear-gradient(135deg, #1976D2 0%, #1976D2 100%)',
            icon: Target,
            badge: {
                text: `${moduleStats.targets.rate.toFixed(0)}% Pacing`,
                color: moduleStats.targets.rate >= 80 ? '#2E7D32' : moduleStats.targets.rate >= 50 ? '#ED6C02' : '#D32F2F',
                icon: TrendingUp
            },
            primaryMetric: {
                label: 'Total Targets',
                value: moduleStats.targets.total.toString(),
                subValue: `Achievement rate: ${moduleStats.targets.rate.toFixed(1)}%`
            },
            progress: moduleStats.targets.rate,
            stats: [
                { label: 'Completed', value: moduleStats.targets.completed, color: '#2E7D32', icon: CheckCircle2 },
                { label: 'On Track', value: moduleStats.targets.onTrack, color: '#0288D1', icon: TrendingUp },
                { label: 'At Risk', value: moduleStats.targets.atRisk, color: '#D32F2F', icon: AlertTriangle },
                { label: 'Plans', value: moduleStats.targets.total, color: '#1976D2', icon: Layers }
            ],
            segments: [
                { label: 'Completed', value: moduleStats.targets.completed, color: '#2E7D32' },
                { label: 'On Track', value: moduleStats.targets.onTrack, color: '#0288D1' },
                { label: 'At Risk', value: moduleStats.targets.atRisk, color: '#D32F2F' }
            ],
            statusText: moduleStats.targets.rate >= 80 ? 'Excellent' : moduleStats.targets.rate >= 50 ? 'On Track' : 'Needs Attention',
            statusColor: moduleStats.targets.rate >= 80 ? '#2E7D32' : moduleStats.targets.rate >= 50 ? '#ED6C02' : '#D32F2F'
        },

        // ═══ 2. ASIN CATALOG ═══
        {
            title: 'ASIN Catalog',
            subtitle: 'Product portfolio tracking',
            path: '/asin-tracker',
            color: '#0288D1',
            gradient: 'linear-gradient(135deg, #0288D1 0%, #0288D1 100%)',
            icon: Package,
            badge: {
                text: 'Live',
                color: '#2E7D32',
                icon: Activity
            },
            primaryMetric: {
                label: 'Tracked ASINs',
                value: formatNumber(moduleStats.asins.total),
                subValue: `${moduleStats.asins.active} active products`
            },
            stats: [
                { label: 'Active', value: formatNumber(moduleStats.asins.active), color: '#2E7D32', icon: CheckCircle2 },
                { label: 'Out of Stock', value: moduleStats.asins.outOfStock, color: '#D32F2F', icon: AlertCircle, pulse: moduleStats.asins.outOfStock > 0 },
                { label: 'New', value: moduleStats.asins.newThisMonth, color: '#9C27B0', icon: Sparkles },
                { label: 'Total', value: formatNumber(moduleStats.asins.total), color: '#0288D1', icon: Package }
            ],
            statusText: 'Catalog Healthy',
            statusColor: '#2E7D32'
        },

        // ═══ 3. ADS PERFORMANCE ═══
        {
            title: 'Ads Performance',
            subtitle: 'Campaign metrics & ROAS',
            path: '/ads-report',
            color: '#2E7D32',
            gradient: 'linear-gradient(135deg, #34d399 0%, #2E7D32 100%)',
            icon: Zap,
            badge: {
                text: moduleStats.ads.acos <= 25 ? 'Healthy' : 'High ACoS',
                color: moduleStats.ads.acos <= 25 ? '#2E7D32' : '#ED6C02',
                icon: moduleStats.ads.acos <= 25 ? CheckCircle2 : AlertTriangle
            },
            primaryMetric: {
                label: 'Total Ad Sales',
                value: formatIndianCurrencyShort(moduleStats.ads.totalSales),
                subValue: `Spend: ${formatIndianCurrencyShort(moduleStats.ads.totalSpend)}`
            },
            stats: [
                { label: 'ACoS', value: `${moduleStats.ads.acos.toFixed(1)}%`, color: moduleStats.ads.acos <= 25 ? '#2E7D32' : '#ED6C02' },
                { label: 'ROAS', value: `${moduleStats.ads.roas.toFixed(2)}x`, color: moduleStats.ads.roas >= 4 ? '#2E7D32' : '#ED6C02' },
                { label: 'Spend', value: formatIndianCurrencyShort(moduleStats.ads.totalSpend), color: '#D32F2F' },
                { label: 'Sales', value: formatIndianCurrencyShort(moduleStats.ads.totalSales), color: '#2E7D32' }
            ],
            statusText: moduleStats.ads.roas >= 4 ? 'High ROAS' : 'Moderate Performance',
            statusColor: moduleStats.ads.roas >= 4 ? '#2E7D32' : '#ED6C02'
        },

        // ═══ 4. OPTIMIZATION TASKS ═══
        {
            title: 'Optimization Tasks',
            subtitle: 'Workflow management',
            path: '/tasks',
            color: '#ED6C02',
            gradient: 'linear-gradient(135deg, #fbbf24 0%, #ED6C02 100%)',
            icon: ClipboardList,
            badge: moduleStats.tasks.overdue > 0 ? {
                text: `${moduleStats.tasks.overdue} Overdue`,
                color: '#D32F2F',
                icon: AlertTriangle
            } : {
                text: 'On Schedule',
                color: '#2E7D32',
                icon: CheckCircle2
            },
            primaryMetric: {
                label: 'Total Tasks',
                value: moduleStats.tasks.total.toString(),
                subValue: `${moduleStats.tasks.completed} completed of ${moduleStats.tasks.total}`
            },
            progress: moduleStats.tasks.total > 0 ? (moduleStats.tasks.completed / moduleStats.tasks.total) * 100 : 0,
            stats: [
                { label: 'Completed', value: moduleStats.tasks.completed, color: '#2E7D32', icon: CheckCircle2 },
                { label: 'In Progress', value: moduleStats.tasks.inProgress, color: '#0288D1', icon: Activity },
                { label: 'Pending', value: moduleStats.tasks.pending, color: '#ED6C02', icon: Clock },
                { label: 'Overdue', value: moduleStats.tasks.overdue, color: '#D32F2F', icon: AlertTriangle, pulse: moduleStats.tasks.overdue > 0 }
            ],
            segments: [
                { label: 'Done', value: moduleStats.tasks.completed, color: '#2E7D32' },
                { label: 'Active', value: moduleStats.tasks.inProgress, color: '#0288D1' },
                { label: 'Pending', value: moduleStats.tasks.pending, color: '#ED6C02' },
                { label: 'Overdue', value: moduleStats.tasks.overdue, color: '#D32F2F' }
            ]
        },

        // ═══ 5. ALERTS & RULES ═══
        {
            title: 'Alerts & Rules',
            subtitle: 'Active monitoring system',
            path: '/alerts',
            color: '#D32F2F',
            gradient: 'linear-gradient(135deg, #f87171 0%, #D32F2F 100%)',
            icon: AlertCircle,
            badge: moduleStats.alerts.critical > 0 ? {
                text: `${moduleStats.alerts.critical} Critical`,
                color: '#D32F2F',
                icon: AlertCircle
            } : {
                text: 'All Clear',
                color: '#2E7D32',
                icon: CheckCircle2
            },
            primaryMetric: {
                label: 'Active Alerts',
                value: moduleStats.alerts.total.toString(),
                subValue: `${moduleStats.alerts.critical} require attention`
            },
            stats: [
                { label: 'Critical', value: moduleStats.alerts.critical, color: '#D32F2F', icon: AlertCircle, pulse: moduleStats.alerts.critical > 0 },
                { label: 'Warning', value: moduleStats.alerts.warning, color: '#ED6C02', icon: AlertTriangle },
                { label: 'Info', value: moduleStats.alerts.info, color: '#0288D1', icon: Activity },
                { label: 'Total', value: moduleStats.alerts.total, color: '#64748b', icon: Layers }
            ],
            segments: [
                { label: 'Critical', value: moduleStats.alerts.critical, color: '#D32F2F' },
                { label: 'Warning', value: moduleStats.alerts.warning, color: '#ED6C02' },
                { label: 'Info', value: moduleStats.alerts.info, color: '#0288D1' }
            ]
        },

        // ═══ 6. DATA PIPELINE ═══
        {
            title: 'Data Pipeline',
            subtitle: 'Octoparse sync engine',
            path: '/scrape-tasks',
            color: '#0288D1',
            gradient: 'linear-gradient(135deg, #22d3ee 0%, #0288D1 100%)',
            icon: RefreshCw,
            hasAnimation: moduleStats.pipeline.running > 0,
            badge: moduleStats.pipeline.running > 0 ? {
                text: 'Syncing',
                color: '#0288D1',
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
                { label: 'Running', value: moduleStats.pipeline.running, color: '#0288D1', icon: RefreshCw, animate: moduleStats.pipeline.running > 0 },
                { label: 'Completed', value: moduleStats.pipeline.completed, color: '#2E7D32', icon: CheckCircle2 },
                { label: 'Failed', value: moduleStats.pipeline.failed, color: '#D32F2F', icon: AlertCircle, pulse: moduleStats.pipeline.failed > 0 },
                { label: 'Idle', value: moduleStats.pipeline.idle, color: '#64748b', icon: Clock }
            ],
            segments: [
                { label: 'Done', value: moduleStats.pipeline.completed, color: '#2E7D32' },
                { label: 'Running', value: moduleStats.pipeline.running, color: '#0288D1' },
                { label: 'Failed', value: moduleStats.pipeline.failed, color: '#D32F2F' },
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
                    border-color: #cbd0d4;
                }
                .module-card:hover .action-arrow {
                    background: #1976D2 !important;
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
                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: '1px solid #fecaca'
                }}>
                    <Layers size={13} style={{ color: '#D32F2F' }} />
                    <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: '#C62828',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em'
                    }}>
                        Module Health Overview
                    </span>
                </div>
                <div style={{
                    flex: 1,
                    height: 1,
                    background: 'linear-gradient(90deg, #d9e6e9 0%, transparent 100%)'
                }} />
                <span style={{
                    fontSize: 11,
                    color: '#8c8e8f',
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