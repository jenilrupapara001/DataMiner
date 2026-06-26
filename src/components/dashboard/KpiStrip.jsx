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
const PremiumSparkline = memo(({ data = [0], color = '#0288D1', height = 36 }) => {
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
const CircularProgress = memo(({ percent = 0, color = '#2E7D32', size = 60 }) => {
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
        label, value, subValue, trend, isPositive, color, sparkline, showProgress, progressValue
    } = card;

    const trendVal = trend ? trend.split(' ')[0] : '';
    const hasPercent = trendVal.includes('%');
    const displayTrend = hasPercent ? `${isPositive ? '+' : '-'}${trendVal.replace(/[+-]/g, '')}` : trendVal;
    const indicatorColor = isPositive ? '#22c55e' : '#D32F2F';

    return (
        <div
            className="kpi-premium-card"
            style={{
                borderRadius: 8,
                border: '1px solid #d9e6e9',
                background: '#ffffff',
                overflow: 'hidden',
                height: 135,
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'default'
            }}
        >
            <div style={{ padding: '12px 12px 6px 12px', display: 'flex', flexDirection: 'column', height: '100%', flexGrow: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8c8e8f' }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: indicatorColor }}>
                        {displayTrend}
                    </span>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#121b1e', marginBottom: 6, fontFamily: 'system-ui, -apple-system' }}>
                    {value}
                </div>
                {subValue && (
                    <div style={{ fontSize: 9.5, color: '#8c8e8f', fontWeight: 500, marginBottom: 4 }}>
                        {subValue}
                    </div>
                )}
                <div style={{ marginTop: 'auto', marginBottom: 4 }}>
                    {showProgress ? (
                        <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.min(progressValue, 100)}%`, background: color, borderRadius: 3 }} />
                        </div>
                    ) : sparkline ? (
                        <PremiumSparkline data={sparkline} color={indicatorColor} height={32} />
                    ) : (
                        <PremiumSparkline data={[10, 15, 12, 18, 16, 22, 20]} color={indicatorColor} height={32} />
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #d9e6e9', padding: '6px 12px', background: '#ffffff' }}>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: '#8c8e8f', display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                    See more details <span style={{ fontSize: 8 }}>&gt;</span>
                </span>
            </div>
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
            color: '#0288D1',
            gradient: 'linear-gradient(135deg, #0288D1 0%, #0288D1 100%)',
            sparkline: sparklineData.adSales || defaultSparklines.adSales,
        },
        {
            label: 'TOTAL ORDERS',
            value: formatNumber(orders),
            subValue: 'All channels combined',
            trend: '+8.4% vs prior',
            isPositive: true,
            icon: <ShoppingBag size={16} strokeWidth={2.5} />,
            color: '#0288D1',
            gradient: 'linear-gradient(135deg, #22d3ee 0%, #0288D1 100%)',
            sparkline: sparklineData.orders || defaultSparklines.orders,
        },
        {
            label: 'ACoS RATIO',
            value: `${acos.toFixed(1)}%`,
            subValue: acos <= 25 ? 'Healthy range' : 'Needs attention',
            trend: '-2.1% improved',
            isPositive: true,
            icon: <Percent size={16} strokeWidth={2.5} />,
            color: '#2E7D32',
            gradient: 'linear-gradient(135deg, #34d399 0%, #2E7D32 100%)',
            sparkline: sparklineData.acos || defaultSparklines.acos,
        },
        {
            label: 'UNITS SOLD',
            value: formatNumber(units),
            subValue: 'Across all SKUs',
            trend: '+15.2% vs prior',
            isPositive: true,
            icon: <Package size={16} strokeWidth={2.5} />,
            color: '#9C27B0',
            gradient: 'linear-gradient(135deg, #a78bfa 0%, #9C27B0 100%)',
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
            color: '#1976D2',
            gradient: 'linear-gradient(135deg, #818cf8 0%, #1976D2 100%)',
            accentLeft: false,
        },
        {
            label: 'REVENUE ACHIEVED',
            value: formatIndianCurrency(targetAchieved),
            subValue: 'Cumulative pacing',
            trend: 'Realized',
            isPositive: true,
            icon: <Zap size={16} strokeWidth={2.5} />,
            color: '#2E7D32',
            gradient: 'linear-gradient(135deg, #34d399 0%, #2E7D32 100%)',
            accentLeft: false,
        },
        {
            label: 'PACING RATE',
            value: `${achievementRate.toFixed(1)}%`,
            subValue: achievementRate >= 100 ? 'Elite' : achievementRate >= 80 ? 'High' : achievementRate >= 50 ? 'On Track' : 'Critical',
            trend: achievementRate >= 100 ? 'Outperforming' : achievementRate >= 50 ? 'On Schedule' : 'Below Target',
            isPositive: achievementRate >= 50,
            icon: <Award size={16} strokeWidth={2.5} />,
            color: achievementRate >= 100 ? '#2E7D32' : achievementRate >= 80 ? '#0288D1' : achievementRate >= 50 ? '#ED6C02' : '#D32F2F',
            gradient: achievementRate >= 100
                ? 'linear-gradient(135deg, #34d399 0%, #2E7D32 100%)'
                : achievementRate >= 80
                    ? 'linear-gradient(135deg, #60a5fa 0%, #0288D1 100%)'
                    : achievementRate >= 50
                        ? 'linear-gradient(135deg, #fbbf24 0%, #E65100 100%)'
                        : 'linear-gradient(135deg, #f87171 0%, #C62828 100%)',
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
            color: '#9C27B0',
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
                    border-color: #cbd0d4;
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
                    background: linear-gradient(90deg, #d9e6e9 0%, transparent 100%);
                }
                @keyframes pulseGlow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(251,79,64,0.4); }
                    50% { box-shadow: 0 0 0 6px rgba(251,79,64,0); }
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
                        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                        padding: '5px 12px',
                        borderRadius: 20,
                        border: '1px solid #fecaca'
                    }}>
                        <BarChart3 size={13} style={{ color: '#D32F2F' }} />
                        <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#C62828',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            Marketplace & Ads Performance
                        </span>
                        <div className="kpi-live-indicator" style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#D32F2F',
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
                        background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                        padding: '5px 12px',
                        borderRadius: 20,
                        border: '1px solid #fecaca'
                    }}>
                        <Target size={13} style={{ color: '#D32F2F' }} />
                        <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#C62828',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em'
                        }}>
                            Revenue Targets & Achievements
                        </span>
                        <div className="kpi-live-indicator" style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#D32F2F',
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