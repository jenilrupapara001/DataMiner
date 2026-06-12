import React, { memo, useMemo } from 'react';
import { Card, Tooltip } from 'antd';
import {
    TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Target, Activity, Zap, Award, Users, ShoppingBag,
    DollarSign, Percent, Package, BarChart3, Sparkles
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

const formatIndianCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    const num = Math.round(val);
    const absNum = Math.abs(num);
    if (absNum >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (absNum >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    if (absNum >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
    return `₹${num.toLocaleString('en-IN')}`;
};

const formatNumber = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    const num = Math.round(val);
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString('en-IN');
};

// ═══════════════════════════════════════════════════════════════
// PREMIUM SPARKLINE COMPONENT
// ═══════════════════════════════════════════════════════════════
const PremiumSparkline = memo(({ data = [0], color = '#2563eb', height = 36 }) => {
    const width = 200;
    const chartData = data.length > 0 ? data : [0];
    const max = Math.max(...chartData);
    const min = Math.min(...chartData);
    const range = max - min || 1;

    const points = chartData.map((val, index) => {
        const x = chartData.length > 1 ? (index / (chartData.length - 1)) * width : 0;
        const y = height - ((val - min) / range) * (height - 6) - 3;
        return { x, y };
    });

    if (points.length === 0) return null;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i];
        const p1 = points[i + 1];
        const cpX1 = p0.x + (p1.x - p0.x) / 2;
        const cpY1 = p0.y;
        const cpX2 = p0.x + (p1.x - p0.x) / 2;
        const cpY2 = p1.y;
        path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }

    const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;
    const gradientId = `spark-grad-${color.replace('#', '')}-${Math.random().toString(36).substr(2, 5)}`;

    // Last point for end indicator
    const lastPoint = points[points.length - 1];

    return (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.00" />
                </linearGradient>
            </defs>
            <path d={fillPath} fill={`url(#${gradientId})`} />
            <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            {/* End point indicator */}
            <circle cx={lastPoint.x} cy={lastPoint.y} r="3" fill={color} />
            <circle cx={lastPoint.x} cy={lastPoint.y} r="6" fill={color} fillOpacity="0.15" />
        </svg>
    );
});

// ═══════════════════════════════════════════════════════════════
// CIRCULAR PROGRESS (for Achievement Rate)
// ═══════════════════════════════════════════════════════════════
const CircularProgress = memo(({ percent = 0, color = '#10b981', size = 60 }) => {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="4"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="4"
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
                fontSize: 12,
                fontWeight: 800,
                color: color
            }}>
                {Math.round(percent)}%
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// PREMIUM KPI CARD
// ═══════════════════════════════════════════════════════════════
const KpiCard = memo(({ card, isLast }) => {
    const {
        label, value, subValue, trend, isPositive, icon, color, gradient,
        sparkline, showProgress, progressValue, badge, accentLeft
    } = card;

    return (
        <div
            className="kpi-premium-card"
            style={{
                position: 'relative',
                borderRadius: 16,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                height: 145,
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default'
            }}
        >
            {/* Left accent strip */}
            {accentLeft && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 3,
                    background: gradient || color,
                }} />
            )}

            {/* Top accent strip */}
            {!accentLeft && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: gradient || color,
                    borderRadius: '16px 16px 0 0'
                }} />
            )}

            {/* Content area */}
            <div style={{
                padding: '14px 16px 10px',
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
            }}>
                {/* Top section: Label + Icon */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 8
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: 2,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {label}
                        </div>
                        {badge && (
                            <span style={{
                                display: 'inline-block',
                                fontSize: 9,
                                fontWeight: 700,
                                color: color,
                                background: `${color}15`,
                                padding: '1px 6px',
                                borderRadius: 4,
                                marginTop: 2
                            }}>
                                {badge}
                            </span>
                        )}
                    </div>
                    <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: `${color}12`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: color,
                        flexShrink: 0
                    }}>
                        {icon}
                    </div>
                </div>

                {/* Middle: Value */}
                <div style={{ marginBottom: 6 }}>
                    <div style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: '#0f172a',
                        letterSpacing: '-0.5px',
                        lineHeight: 1.1,
                        marginBottom: 2,
                        wordBreak: 'break-all'
                    }}>
                        {value}
                    </div>
                    {subValue && (
                        <div style={{
                            fontSize: 11,
                            color: '#94a3b8',
                            fontWeight: 500,
                            marginTop: 2
                        }}>
                            {subValue}
                        </div>
                    )}
                </div>

                {/* Bottom: Trend */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 10,
                        fontWeight: 700,
                        color: isPositive ? '#059669' : '#dc2626',
                        background: isPositive ? '#d1fae5' : '#fee2e2',
                        padding: '2px 7px',
                        borderRadius: 12,
                        whiteSpace: 'nowrap'
                    }}>
                        {isPositive ? <ArrowUpRight size={11} strokeWidth={2.5} /> : <ArrowDownRight size={11} strokeWidth={2.5} />}
                        {trend?.split(' ')[0]}
                    </span>
                    <span style={{
                        fontSize: 10,
                        color: '#94a3b8',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {trend?.split(' ').slice(1).join(' ')}
                    </span>
                </div>
            </div>

            {/* Bottom visualization: Sparkline OR Progress Bar */}
            {showProgress ? (
                <div style={{
                    padding: '0 16px 12px',
                    marginTop: 'auto'
                }}>
                    <div style={{
                        height: 6,
                        background: '#f1f5f9',
                        borderRadius: 3,
                        overflow: 'hidden',
                        position: 'relative'
                    }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.min(progressValue, 100)}%`,
                            background: gradient || color,
                            borderRadius: 3,
                            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: `0 0 12px ${color}40`
                        }} />
                    </div>
                </div>
            ) : sparkline ? (
                <div style={{
                    marginTop: 'auto',
                    width: '100%',
                    height: 36,
                    borderTop: '1px solid #f8fafc'
                }}>
                    <PremiumSparkline data={sparkline} color={color} height={36} />
                </div>
            ) : (
                <div style={{
                    height: 36,
                    marginTop: 'auto',
                    background: `linear-gradient(180deg, transparent 0%, ${color}08 100%)`,
                    borderTop: '1px solid #f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <Sparkles size={14} style={{ color: `${color}50` }} />
                </div>
            )}
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN KPI STRIP
// ═══════════════════════════════════════════════════════════════
const KpiStrip = ({
    adSales = 0,
    adSpend = 0,
    orders = 0,
    acos = 0,
    units = 0,
    targetTotal = 0,
    targetAchieved = 0,
    achievementRate = 0,
    brandCount = 0,
    sparklineData = {}
}) => {
    const defaultSparklines = useMemo(() => ({
        adSales: [30, 40, 35, 50, 49, 60, 70, 91, 125],
        orders: [50, 45, 60, 55, 70, 65, 80, 85, 95],
        acos: [70, 65, 60, 50, 55, 45, 40, 35, 30],
        units: [20, 30, 25, 40, 35, 50, 45, 60, 75],
    }), []);

    // ═══════════════════════════════════════════════════════════════
    // CARD DEFINITIONS — SPLIT INTO 2 GROUPS
    // ═══════════════════════════════════════════════════════════════

    // GROUP 1: Marketplace & Ads (4 cards)
    const marketplaceCards = [
        {
            label: 'AD REVENUE',
            value: formatIndianCurrency(adSales),
            subValue: `Spend ${formatIndianCurrency(adSpend)}`,
            trend: '+12.4% vs prior',
            isPositive: true,
            icon: <DollarSign size={16} strokeWidth={2.5} />,
            color: '#2563eb',
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            sparkline: sparklineData.adSales || defaultSparklines.adSales,
        },
        {
            label: 'TOTAL ORDERS',
            value: formatNumber(orders),
            subValue: 'All channels combined',
            trend: '+8.4% vs prior',
            isPositive: true,
            icon: <ShoppingBag size={16} strokeWidth={2.5} />,
            color: '#06b6d4',
            gradient: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
            sparkline: sparklineData.orders || defaultSparklines.orders,
        },
        {
            label: 'ACoS RATIO',
            value: `${acos.toFixed(1)}%`,
            subValue: acos <= 25 ? 'Healthy range' : 'Needs attention',
            trend: '-2.1% improved',
            isPositive: true,
            icon: <Percent size={16} strokeWidth={2.5} />,
            color: '#10b981',
            gradient: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
            sparkline: sparklineData.acos || defaultSparklines.acos,
        },
        {
            label: 'UNITS SOLD',
            value: formatNumber(units),
            subValue: 'Across all SKUs',
            trend: '+15.2% vs prior',
            isPositive: true,
            icon: <Package size={16} strokeWidth={2.5} />,
            color: '#8b5cf6',
            gradient: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
            sparkline: sparklineData.units || defaultSparklines.units,
        },
    ];

    // GROUP 2: Targets & Achievement (4 cards)
    const targetCards = [
        {
            label: 'TARGET POOL',
            value: formatIndianCurrency(targetTotal),
            subValue: `${brandCount} active plans`,
            trend: 'Goal Set',
            isPositive: true,
            icon: <Target size={16} strokeWidth={2.5} />,
            color: '#6366f1',
            gradient: 'linear-gradient(135deg, #818cf8 0%, #6366f1 100%)',
            accentLeft: false,
        },
        {
            label: 'REVENUE ACHIEVED',
            value: formatIndianCurrency(targetAchieved),
            subValue: 'Cumulative pacing',
            trend: 'Realized',
            isPositive: true,
            icon: <Zap size={16} strokeWidth={2.5} />,
            color: '#10b981',
            gradient: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
            accentLeft: false,
        },
        {
            label: 'PACING RATE',
            value: `${achievementRate.toFixed(1)}%`,
            subValue: achievementRate >= 100 ? '🏆 Elite' : achievementRate >= 80 ? '⭐ High' : achievementRate >= 50 ? '✅ On Track' : '⚠️ Critical',
            trend: achievementRate >= 100 ? 'Outperforming' : achievementRate >= 50 ? 'On Schedule' : 'Below Target',
            isPositive: achievementRate >= 50,
            icon: <Award size={16} strokeWidth={2.5} />,
            color: achievementRate >= 100 ? '#10b981' : achievementRate >= 80 ? '#3b82f6' : achievementRate >= 50 ? '#f59e0b' : '#ef4444',
            gradient: achievementRate >= 100
                ? 'linear-gradient(135deg, #34d399 0%, #059669 100%)'
                : achievementRate >= 80
                    ? 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)'
                    : achievementRate >= 50
                        ? 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)'
                        : 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)',
            showProgress: true,
            progressValue: achievementRate,
            accentLeft: false,
        },
        {
            label: 'ACTIVE BRANDS',
            value: brandCount.toString(),
            subValue: 'Portfolio coverage',
            trend: 'Managed',
            isPositive: true,
            icon: <Users size={16} strokeWidth={2.5} />,
            color: '#ec4899',
            gradient: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
            accentLeft: false,
        },
    ];

    return (
        <>
            <style>{`
                .kpi-premium-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.1);
                    border-color: #cbd5e1;
                }
                .kpi-section-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                .kpi-section-divider {
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(90deg, #e2e8f0 0%, transparent 100%);
                }
                @keyframes pulseGlow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
                    50% { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
                }
                .kpi-live-indicator {
                    animation: pulseGlow 2s ease-in-out infinite;
                }
            `}</style>

            {/* GROUP 1: MARKETPLACE METRICS */}
            <div style={{ marginBottom: 20 }}>
                <div className="kpi-section-header">
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        padding: '5px 12px',
                        borderRadius: 20,
                        border: '1px solid #bfdbfe'
                    }}>
                        <BarChart3 size={13} style={{ color: '#2563eb' }} />
                        <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#1e40af',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            Marketplace & Ads Performance
                        </span>
                        <div className="kpi-live-indicator" style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#2563eb',
                            marginLeft: 4
                        }} />
                    </div>
                    <div className="kpi-section-divider" />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 14
                }}>
                    {marketplaceCards.map((card, idx) => (
                        <KpiCard
                            key={`mkt-${idx}`}
                            card={card}
                            isLast={idx === marketplaceCards.length - 1}
                        />
                    ))}
                </div>
            </div>

            {/* GROUP 2: TARGETS & ACHIEVEMENT */}
            <div style={{ marginBottom: 24 }}>
                <div className="kpi-section-header">
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                        padding: '5px 12px',
                        borderRadius: 20,
                        border: '1px solid #c4b5fd'
                    }}>
                        <Target size={13} style={{ color: '#7c3aed' }} />
                        <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#5b21b6',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            Revenue Targets & Achievements
                        </span>
                        <div className="kpi-live-indicator" style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#7c3aed',
                            marginLeft: 4
                        }} />
                    </div>
                    <div className="kpi-section-divider" />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 14
                }}>
                    {targetCards.map((card, idx) => (
                        <KpiCard
                            key={`tgt-${idx}`}
                            card={card}
                            isLast={idx === targetCards.length - 1}
                        />
                    ))}
                </div>
            </div>
        </>
    );
};

export default memo(KpiStrip);