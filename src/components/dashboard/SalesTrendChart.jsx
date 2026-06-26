import React, { Suspense, lazy, useState, useMemo, memo } from 'react';
import { Card, Segmented, Tooltip } from 'antd';
import {
    TrendingUp, TrendingDown, DollarSign, Target,
    BarChart3, Activity, ArrowUpRight, ArrowDownRight,
    Calendar, Eye, EyeOff, Sparkles
} from 'lucide-react';
import { SkeletonChart } from '../common/Skeleton';

const Chart = lazy(() => import('react-apexcharts'));

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const formatIndianCurrencyShort = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    const num = Math.round(val);
    const absNum = Math.abs(num);
    if (absNum >= 10000000) return `₹${(num / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`;
    if (absNum >= 100000) return `₹${(num / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
    if (absNum >= 1000) return `₹${(num / 1000).toFixed(1).replace(/\.?0+$/, '')}K`;
    return `₹${num}`;
};

const formatIndianCurrencyFull = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
};

// ═══════════════════════════════════════════════════════════════
// METRIC SUMMARY CARD (top mini stats)
// ═══════════════════════════════════════════════════════════════
const MetricSummary = memo(({ label, value, change, color, icon: Icon, isPositive }) => (
    <div style={{
        padding: '10px 14px',
        background: `linear-gradient(135deg, ${color}08 0%, ${color}03 100%)`,
        border: `1px solid ${color}20`,
        borderRadius: 10,
        minWidth: 130,
        flex: 1
    }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 4
        }}>
            <Icon size={10} style={{ color }} strokeWidth={2.5} />
            <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#8c8e8f',
                    textTransform: 'uppercase',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {label}
            </span>
        </div>
        <div style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#121b1e',
            letterSpacing: '-0.3px',
            lineHeight: 1.1,
            marginBottom: 3
        }}>
            {value}
        </div>
        {change !== undefined && (
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                fontSize: 9,
                fontWeight: 700,
                color: isPositive ? '#2E7D32' : '#C62828',
                background: isPositive ? '#d1fae5' : '#fee2e2',
                padding: '1px 6px',
                borderRadius: 8
            }}>
                {isPositive ? <ArrowUpRight size={9} strokeWidth={2.5} /> : <ArrowDownRight size={9} strokeWidth={2.5} />}
                {Math.abs(change).toFixed(1)}%
            </div>
        )}
    </div>
));

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const SalesTrendChart = ({
    labels = [],
    revenueData = [],
    spendData = [],
    title = 'Sales & Spend Trend',
    subtitle = 'Revenue vs Ad Spend Performance'
}) => {
    const [chartType, setChartType] = useState('area'); // area, line, bar
    const [showRevenue, setShowRevenue] = useState(true);
    const [showSpend, setShowSpend] = useState(true);

    // ═══════════════════════════════════════════════════════════════
    // CALCULATIONS
    // ═══════════════════════════════════════════════════════════════
    const stats = useMemo(() => {
        const totalRevenue = revenueData.reduce((sum, v) => sum + (Number(v) || 0), 0);
        const totalSpend = spendData.reduce((sum, v) => sum + (Number(v) || 0), 0);
        const profit = totalRevenue - totalSpend;
        const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        const acos = totalRevenue > 0 ? (totalSpend / totalRevenue) * 100 : 0;

        // Calculate trends (compare first half vs second half)
        const mid = Math.floor(revenueData.length / 2);
        const firstHalfRev = revenueData.slice(0, mid).reduce((s, v) => s + (Number(v) || 0), 0);
        const secondHalfRev = revenueData.slice(mid).reduce((s, v) => s + (Number(v) || 0), 0);
        const revenueChange = firstHalfRev > 0 ? ((secondHalfRev - firstHalfRev) / firstHalfRev) * 100 : 0;

        const firstHalfSpend = spendData.slice(0, mid).reduce((s, v) => s + (Number(v) || 0), 0);
        const secondHalfSpend = spendData.slice(mid).reduce((s, v) => s + (Number(v) || 0), 0);
        const spendChange = firstHalfSpend > 0 ? ((secondHalfSpend - firstHalfSpend) / firstHalfSpend) * 100 : 0;

        // Find peak day
        let peakValue = 0;
        let peakIndex = 0;
        revenueData.forEach((v, i) => {
            if (v > peakValue) {
                peakValue = v;
                peakIndex = i;
            }
        });

        return {
            totalRevenue,
            totalSpend,
            profit,
            roas,
            acos,
            revenueChange,
            spendChange,
            peakValue,
            peakDay: labels[peakIndex] || '—',
            avgRevenue: revenueData.length > 0 ? totalRevenue / revenueData.length : 0
        };
    }, [revenueData, spendData, labels]);

    // ═══════════════════════════════════════════════════════════════
    // CHART CONFIG
    // ═══════════════════════════════════════════════════════════════
    const series = useMemo(() => {
        const s = [];
        if (showRevenue) {
            s.push({
                name: 'Revenue',
                type: chartType,
                data: revenueData
            });
        }
        if (showSpend) {
            s.push({
                name: 'Ad Spend',
                type: chartType,
                data: spendData
            });
        }
        return s;
    }, [showRevenue, showSpend, revenueData, spendData, chartType]);

    const colors = useMemo(() => {
        const c = [];
        if (showRevenue) c.push('#0288D1');
        if (showSpend) c.push('#ED6C02');
        return c;
    }, [showRevenue, showSpend]);

    const options = useMemo(() => ({
        chart: {
            type: chartType,
            toolbar: {
                show: false
            },
            zoom: { enabled: false },
            sparkline: { enabled: false },
            fontFamily: 'Inter, -apple-system, sans-serif',
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 600
            },
            dropShadow: {
                enabled: chartType === 'line',
                top: 4,
                left: 0,
                blur: 8,
                opacity: 0.15
            }
        },
        stroke: {
            curve: 'smooth',
            width: chartType === 'bar' ? 0 : [3, 2.5]
        },
        fill: chartType === 'area' ? {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.05,
                stops: [0, 95, 100]
            }
        } : {
            type: 'solid',
            opacity: chartType === 'bar' ? 0.85 : 1
        },
        plotOptions: chartType === 'bar' ? {
            bar: {
                borderRadius: 6,
                borderRadiusApplication: 'end',
                columnWidth: '55%',
                dataLabels: { position: 'top' }
            }
        } : {},
        colors,
        xaxis: {
            categories: labels.length > 0 ? labels : ['01 Jun', '02 Jun', '03 Jun', '04 Jun', '05 Jun', '06 Jun', '07 Jun'],
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                style: {
                    colors: '#94a3b8',
                    fontSize: '10px',
                    fontWeight: 600
                },
                rotate: 0
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#94a3b8',
                    fontSize: '10px',
                    fontWeight: 600
                },
                formatter: (val) => val === 0 ? '0' : formatIndianCurrencyShort(val)
            }
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
            padding: { top: 0, right: 10, bottom: 0, left: 10 }
        },
        legend: {
            show: false
        },
        dataLabels: { enabled: false },
        markers: {
            size: chartType === 'line' ? 0 : 0,
            strokeWidth: 2,
            strokeColors: '#fff',
            hover: {
                size: 7,
                sizeOffset: 3
            }
        },
        tooltip: {
            theme: 'light',
            shared: true,
            intersect: false,
            style: {
                fontSize: '12px',
                fontFamily: 'Inter, sans-serif'
            },
            y: {
                formatter: (val) => formatIndianCurrencyFull(val)
            },
            marker: { show: true },
            x: {
                show: true
            }
        }
    }), [chartType, colors, labels]);

    return (
        <>
            <style>{`
                .sales-trend-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .sales-trend-card:hover {
                    box-shadow: 0 12px 28px -8px rgba(0, 0, 0, 0.08);
                }
                .legend-toggle {
                    cursor: pointer;
                    transition: all 0.2s;
                    user-select: none;
                }
                .legend-toggle:hover {
                    transform: translateY(-1px);
                }
                .legend-toggle.disabled {
                    opacity: 0.4;
                }
                @keyframes pulse-dot {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.3); opacity: 0.7; }
                }
                .live-pulse {
                    animation: pulse-dot 2s ease-in-out infinite;
                }
            `}</style>

            <Card
                className="sales-trend-card"
                styles={{ body: { padding: 0 } }}
                style={{
                    borderRadius: 16,
                    border: '1px solid #d9e6e9',
                    background: '#ffffff',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02)',
                    height: '100%',
                    overflow: 'hidden'
                }}
            >
                {/* ═══════════════════════════════════════════════════
                    HEADER SECTION
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '18px 20px 14px',
                    borderBottom: '1px solid #d9e6e9'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        marginBottom: 14,
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: 11,
                                background: 'linear-gradient(135deg, #D32F2F 0%, #d94033 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                boxShadow: '0 4px 12px -2px rgba(251, 79, 64, 0.4)',
                                flexShrink: 0
                            }}>
                                <BarChart3 size={20} strokeWidth={2.5} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 15,
                                    fontWeight: 800,
                                    color: '#121b1e',
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1.2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    {title}
                                    <span className="live-pulse" style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: '#2E7D32',
                                        display: 'inline-block'
                                    }} />
                                </div>
                                <div style={{
                                    fontSize: 11,
                                    color: '#8c8e8f',
                                    fontWeight: 500,
                                    marginTop: 2
                                }}>
                                    {subtitle}
                                </div>
                            </div>
                        </div>

                        {/* Chart Type Toggle */}
                        <Segmented
                            value={chartType}
                            onChange={setChartType}
                            size="small"
                            options={[
                                {
                                    label: <Tooltip title="Area Chart"><Activity size={12} /></Tooltip>,
                                    value: 'area'
                                },
                                {
                                    label: <Tooltip title="Line Chart"><TrendingUp size={12} /></Tooltip>,
                                    value: 'line'
                                },
                                {
                                    label: <Tooltip title="Bar Chart"><BarChart3 size={12} /></Tooltip>,
                                    value: 'bar'
                                }
                            ]}
                            style={{
                                background: '#f1f5f9',
                                fontWeight: 600
                            }}
                        />
                    </div>

                    {/* ═══════════════════════════════════════════════════
                        METRICS SUMMARY (4 mini cards)
                    ═══════════════════════════════════════════════════ */}
                    <div style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap'
                    }}>
                        <MetricSummary
                            label="Total Revenue"
                            value={formatIndianCurrencyShort(stats.totalRevenue)}
                            change={stats.revenueChange}
                            isPositive={stats.revenueChange >= 0}
                            color="#0288D1"
                            icon={DollarSign}
                        />
                        <MetricSummary
                            label="Total Spend"
                            value={formatIndianCurrencyShort(stats.totalSpend)}
                            change={stats.spendChange}
                            isPositive={stats.spendChange <= 0}
                            color="#ED6C02"
                            icon={Target}
                        />
                        <MetricSummary
                            label="Net Profit"
                            value={formatIndianCurrencyShort(stats.profit)}
                            color={stats.profit >= 0 ? '#2E7D32' : '#D32F2F'}
                            icon={TrendingUp}
                        />
                        <MetricSummary
                            label="ROAS"
                            value={`${stats.roas.toFixed(2)}x`}
                            color={stats.roas >= 4 ? '#2E7D32' : stats.roas >= 2 ? '#ED6C02' : '#D32F2F'}
                            icon={Sparkles}
                        />
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    LEGEND CONTROLS
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#fafbfc',
                    borderBottom: '1px solid #d9e6e9'
                }}>
                    <div style={{ display: 'flex', gap: 14 }}>
                        <div
                            className={`legend-toggle ${!showRevenue ? 'disabled' : ''}`}
                            onClick={() => setShowRevenue(!showRevenue)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                background: showRevenue ? '#eff6ff' : '#f1f5f9',
                                border: `1px solid ${showRevenue ? '#bfdbfe' : '#e2e8f0'}`,
                                borderRadius: 8
                            }}
                        >
                            {showRevenue ? <Eye size={10} style={{ color: '#0288D1' }} /> : <EyeOff size={10} style={{ color: '#94a3b8' }} />}
                            <div style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: showRevenue
                                    ? 'linear-gradient(135deg, #0288D1 0%, #0288D1 100%)'
                                    : '#cbd5e1'
                            }} />
                            <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: showRevenue ? '#1e40af' : '#94a3b8'
                            }}>
                                Revenue
                            </span>
                        </div>

                        <div
                            className={`legend-toggle ${!showSpend ? 'disabled' : ''}`}
                            onClick={() => setShowSpend(!showSpend)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '4px 10px',
                                background: showSpend ? '#fffbeb' : '#f1f5f9',
                                border: `1px solid ${showSpend ? '#fde68a' : '#e2e8f0'}`,
                                borderRadius: 8
                            }}
                        >
                            {showSpend ? <Eye size={10} style={{ color: '#E65100' }} /> : <EyeOff size={10} style={{ color: '#94a3b8' }} />}
                            <div style={{
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: showSpend
                                    ? 'linear-gradient(135deg, #fbbf24 0%, #ED6C02 100%)'
                                    : '#cbd5e1'
                            }} />
                            <span style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: showSpend ? '#92400e' : '#94a3b8'
                            }}>
                                Ad Spend
                            </span>
                        </div>
                    </div>

                    {/* Peak Indicator */}
                    {stats.peakValue > 0 && (
                        <Tooltip title={`Peak revenue day: ${formatIndianCurrencyFull(stats.peakValue)}`}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#9C27B0',
                                background: '#f5f3ff',
                                padding: '3px 9px',
                                borderRadius: 12,
                                border: '1px solid #ddd6fe',
                                cursor: 'help'
                            }}>
                                <Sparkles size={10} strokeWidth={2.5} />
                                Peak: {stats.peakDay}
                            </div>
                        </Tooltip>
                    )}
                </div>

                {/* ═══════════════════════════════════════════════════
                    CHART AREA
                ═══════════════════════════════════════════════════ */}
                <div style={{ padding: '16px 12px 20px' }}>
                    <Suspense fallback={<SkeletonChart height={260} />}>
                        {series.length > 0 ? (
                            <Chart
                                options={options}
                                series={series}
                                type={chartType === 'bar' ? 'bar' : chartType === 'line' ? 'line' : 'area'}
                                height={260}
                            />
                        ) : (
                            <div style={{
                                height: 260,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#94a3b8',
                                gap: 8
                            }}>
                                <EyeOff size={24} />
                                <div style={{ fontSize: 13, fontWeight: 600 }}>
                                    No series selected
                                </div>
                                <div style={{ fontSize: 11 }}>
                                    Toggle Revenue or Ad Spend above to view data
                                </div>
                            </div>
                        )}
                    </Suspense>
                </div>

                {/* ═══════════════════════════════════════════════════
                    FOOTER (Average info)
                ═══════════════════════════════════════════════════ */}
                <div style={{
                    padding: '10px 20px',
                    background: '#fafbfc',
                    borderTop: '1px solid #d9e6e9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            color: '#8c8e8f',
                            fontWeight: 600
                        }}>
                            <Calendar size={10} />
                            {labels.length || 0} data points
                        </div>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            color: '#8c8e8f',
                            fontWeight: 600
                        }}>
                            <Activity size={10} />
                            Avg: {formatIndianCurrencyShort(stats.avgRevenue)}/day
                        </div>
                    </div>

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 10,
                        fontWeight: 700,
                        color: stats.acos <= 25 ? '#2E7D32' : '#E65100',
                        background: stats.acos <= 25 ? '#d1fae5' : '#fef3c7',
                        padding: '3px 9px',
                        borderRadius: 12,
                        border: `1px solid ${stats.acos <= 25 ? '#a7f3d0' : '#fde68a'}`
                    }}>
                        Blended ACoS: {stats.acos.toFixed(1)}%
                    </div>
                </div>
            </Card>
        </>
    );
};

export default memo(SalesTrendChart);