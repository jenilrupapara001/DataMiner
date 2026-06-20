import React, { useMemo, memo, useState, useEffect, useRef } from 'react';
import { Card, Tooltip } from 'antd';
import {
    Award, Crown, Star, Activity, AlertTriangle,
    TrendingUp, TrendingDown, Sparkles, Target,
    ArrowUpRight, CheckCircle2, Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════
// ANIMATED COUNTER HOOK
// ═══════════════════════════════════════════════════════════════
const useAnimatedCounter = (endValue, duration = 1200) => {
    const [count, setCount] = useState(0);
    const rafRef = useRef(null);

    useEffect(() => {
        const end = parseFloat(endValue) || 0;
        if (end === 0) {
            setCount(0);
            return;
        }

        let start = null;
        const step = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 4);
            setCount(eased * end);
            if (p < 1) rafRef.current = requestAnimationFrame(step);
            else setCount(end);
        };

        rafRef.current = requestAnimationFrame(step);
        return () => cancelAnimationFrame(rafRef.current);
    }, [endValue, duration]);

    return count;
};

// ═══════════════════════════════════════════════════════════════
// CUSTOM SVG DONUT CHART
// ═══════════════════════════════════════════════════════════════
const PremiumDonutChart = memo(({ segments, total, overallRate, color }) => {
    const size = 200;
    const strokeWidth = 22;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const center = size / 2;

    // Calculate stroke offsets for each segment
    let accumulated = 0;
    const segmentData = segments
        .filter(s => s.value > 0)
        .map(s => {
            const pct = total > 0 ? s.value / total : 0;
            const length = pct * circumference;
            const offset = -accumulated;
            accumulated += length;
            return {
                ...s,
                length,
                offset,
                pct
            };
        });

    const animatedRate = useAnimatedCounter(overallRate, 1500);

    return (
        <div style={{
            position: 'relative',
            width: size,
            height: size,
            margin: '0 auto'
        }}>
            {/* Background glow */}
            <div style={{
                position: 'absolute',
                inset: '-10px',
                background: `radial-gradient(circle, ${color}15 0%, transparent 70%)`,
                borderRadius: '50%',
                pointerEvents: 'none'
            }} />

            <svg
                width={size}
                height={size}
                style={{ transform: 'rotate(-90deg)', position: 'relative' }}
            >
                {/* Background ring */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                />

                {/* Segments */}
                {segmentData.map((seg, i) => (
                    <Tooltip key={i} title={`${seg.label}: ${seg.value} (${(seg.pct * 100).toFixed(1)}%)`}>
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${seg.length} ${circumference}`}
                            strokeDashoffset={seg.offset}
                            strokeLinecap="butt"
                            style={{
                                cursor: 'pointer',
                                transition: 'stroke-width 0.2s, opacity 0.2s',
                                opacity: 0.95
                            }}
                            className="donut-segment"
                        />
                    </Tooltip>
                ))}

                {/* Inner ring decoration */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius - strokeWidth / 2 - 4}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray="2 4"
                    opacity="0.5"
                />
            </svg>

            {/* Center content */}
            <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
            }}>
                <div style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#8c8e8f',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 2
                }}>
                    Overall
                </div>
                <div style={{
                    fontSize: 36,
                    fontWeight: 800,
                    color,
                    letterSpacing: '-1.5px',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 2
                }}>
                    {animatedRate.toFixed(1)}
                    <span style={{ fontSize: 16, fontWeight: 700, marginLeft: 2 }}>%</span>
                </div>
                <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#8c8e8f',
                    marginTop: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    background: `${color}10`,
                    border: `1px solid ${color}25`,
                    padding: '2px 8px',
                    borderRadius: 10
                }}>
                    <Target size={10} strokeWidth={2.5} style={{ color }} />
                    {total} {total === 1 ? 'plan' : 'plans'}
                </div>
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// TIER ROW COMPONENT
// ═══════════════════════════════════════════════════════════════
const TierRow = memo(({ tier, total }) => {
    const TierIcon = tier.icon;
    const pct = total > 0 ? (tier.value / total) * 100 : 0;

    return (
        <div
            className="tier-row-hover"
            style={{
                padding: '10px 12px',
                background: '#ffffff',
                border: `1px solid ${tier.color}20`,
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Background fill bar */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${tier.color}10 0%, transparent 100%)`,
                pointerEvents: 'none',
                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
            }} />

            <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 10
            }}>
                {/* Icon */}
                <div style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: tier.bg,
                    border: `1px solid ${tier.color}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: tier.color,
                    flexShrink: 0
                }}>
                    <TierIcon size={14} strokeWidth={2.5} />
                </div>

                {/* Label + Range */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 1
                    }}>
                        <span style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: tier.color,
                            letterSpacing: '0.01em'
                        }}>
                            {tier.label}
                        </span>
                        <span style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: '#8c8e8f',
                            background: '#d9e6e9',
                            padding: '1px 5px',
                            borderRadius: 4
                        }}>
                            {tier.range}
                        </span>
                    </div>
                    <div style={{
                        fontSize: 10,
                        color: '#8c8e8f',
                        fontWeight: 500
                    }}>
                        {tier.description}
                    </div>
                </div>

                {/* Value + Percentage */}
                <div style={{
                    textAlign: 'right',
                    flexShrink: 0
                }}>
                    <div style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: tier.color,
                        lineHeight: 1,
                        letterSpacing: '-0.3px'
                    }}>
                        {tier.value}
                    </div>
                    <div style={{
                        fontSize: 10,
                        color: '#8c8e8f',
                        fontWeight: 700,
                        marginTop: 2
                    }}>
                        {pct.toFixed(0)}%
                    </div>
                </div>
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const AchievementDonut = ({ targets = [], overallRate = 0 }) => {
    // ═══════════════════════════════════════════════════════════════
    // CALCULATE SEGMENTS
    // ═══════════════════════════════════════════════════════════════
    const tiers = useMemo(() => {
        let elite = 0;
        let high = 0;
        let onTrack = 0;
        let critical = 0;

        targets.forEach((t) => {
            const total = t.TotalTargetValue || 0;
            const achieved = t.overallAchieved || 0;
            const pct = total > 0 ? (achieved / total) * 100 : 0;

            if (pct >= 100) elite++;
            else if (pct >= 80) high++;
            else if (pct >= 50) onTrack++;
            else critical++;
        });

        return [
            {
                key: 'elite',
                label: 'Elite',
                range: '100%+',
                description: 'Exceeded all targets',
                value: elite,
                color: '#10b981',
                bg: '#d1fae5',
                icon: Crown
            },
            {
                key: 'high',
                label: 'High',
                range: '80-99%',
                description: 'Strong performance',
                value: high,
                color: '#3b82f6',
                bg: '#dbeafe',
                icon: Star
            },
            {
                key: 'ontrack',
                label: 'On Track',
                range: '50-79%',
                description: 'Steady progress',
                value: onTrack,
                color: '#f59e0b',
                bg: '#fef3c7',
                icon: Activity
            },
            {
                key: 'critical',
                label: 'Critical',
                range: '<50%',
                description: 'Needs attention',
                value: critical,
                color: '#ef4444',
                bg: '#fee2e2',
                icon: AlertTriangle
            }
        ];
    }, [targets]);

    const total = tiers.reduce((sum, t) => sum + t.value, 0);

    // ═══════════════════════════════════════════════════════════════
    // OVERALL STATUS
    // ═══════════════════════════════════════════════════════════════
    const overallStatus = useMemo(() => {
        if (overallRate >= 100) return {
            label: 'Outperforming',
            color: '#10b981',
            bg: '#d1fae5',
            border: '#a7f3d0',
            icon: Sparkles,
            message: 'Exceptional results across portfolio'
        };
        if (overallRate >= 80) return {
            label: 'High Performance',
            color: '#3b82f6',
            bg: '#dbeafe',
            border: '#bfdbfe',
            icon: TrendingUp,
            message: 'Strong overall achievement'
        };
        if (overallRate >= 50) return {
            label: 'On Track',
            color: '#f59e0b',
            bg: '#fef3c7',
            border: '#fde68a',
            icon: Activity,
            message: 'Steady progress towards goals'
        };
        return {
            label: 'Critical',
            color: '#ef4444',
            bg: '#fee2e2',
            border: '#fecaca',
            icon: AlertTriangle,
            message: 'Immediate attention required'
        };
    }, [overallRate]);

    const StatusIcon = overallStatus.icon;

    // ═══════════════════════════════════════════════════════════════
    // INSIGHTS
    // ═══════════════════════════════════════════════════════════════
    const insights = useMemo(() => {
        if (total === 0) return null;

        const elitePct = ((tiers[0].value / total) * 100).toFixed(0);
        const criticalPct = ((tiers[3].value / total) * 100).toFixed(0);
        const healthyCount = tiers[0].value + tiers[1].value;
        const healthyPct = ((healthyCount / total) * 100).toFixed(0);

        return {
            elitePct,
            criticalPct,
            healthyCount,
            healthyPct,
            isHealthy: healthyCount >= total / 2
        };
    }, [tiers, total]);

    return (
        <>
            <style>{`
                .donut-segment:hover {
                    stroke-width: 26 !important;
                    opacity: 1 !important;
                }
                .tier-row-hover:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px -2px rgba(0,0,0,0.08);
                    border-color: currentColor !important;
                }
                .section-link-donut:hover {
                    color: #fb4f40 !important;
                    transform: translateX(2px);
                }
                @keyframes float-icon {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }
                .floating-icon {
                    animation: float-icon 3s ease-in-out infinite;
                }
                @keyframes glow-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
                .status-glow {
                    animation: glow-pulse 2.5s ease-in-out infinite;
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
                        gap: 12
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
                                <Award size={20} strokeWidth={2.5} className="floating-icon" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 15,
                                    fontWeight: 800,
                                    color: '#121b1e',
                                    letterSpacing: '-0.01em',
                                    lineHeight: 1.2
                                }}>
                                    Achievement Status
                                </div>
                                <div style={{
                                    fontSize: 11,
                                    color: '#8c8e8f',
                                    fontWeight: 500,
                                    marginTop: 1
                                }}>
                                    Target tier distribution & performance
                                </div>
                            </div>
                        </div>

                        <Link
                            to="/target-achievement/dashboard"
                            className="section-link-donut"
                            style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#fb4f40',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                transition: 'all 0.2s',
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                            }}
                        >
                            Details
                            <ArrowUpRight size={11} strokeWidth={2.5} />
                        </Link>
                    </div>
                </div>

                {/* ═══════════════════════════════════════════════════
                    BODY
                ═══════════════════════════════════════════════════ */}
                {targets.length === 0 ? (
                    /* Empty State */
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 40,
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 14,
                            border: '2px solid #fbbf24'
                        }}>
                            <Target size={28} style={{ color: '#d97706' }} strokeWidth={2.5} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#121b1e', marginBottom: 4 }}>
                            No Targets Defined
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                            Create target plans to see achievement distribution
                        </div>
                    </div>
                ) : (
                    <>
                        {/* ═══════════════════════════════════════════════════
                            DONUT CHART
                        ═══════════════════════════════════════════════════ */}
                        <div style={{
                            padding: '24px 20px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center'
                        }}>
                            <PremiumDonutChart
                                segments={tiers}
                                total={total}
                                overallRate={overallRate}
                                color={overallStatus.color}
                            />

                            {/* Status Badge */}
                            <div
                                className="status-glow"
                                style={{
                                    marginTop: 18,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '6px 14px',
                                    background: overallStatus.bg,
                                    border: `1px solid ${overallStatus.border}`,
                                    borderRadius: 20,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: overallStatus.color,
                                    boxShadow: `0 4px 12px -2px ${overallStatus.color}30`
                                }}
                            >
                                <StatusIcon size={12} strokeWidth={2.5} />
                                {overallStatus.label}
                            </div>

                            <div style={{
                                fontSize: 11,
                                color: '#64748b',
                                fontWeight: 500,
                                marginTop: 6,
                                textAlign: 'center'
                            }}>
                                {overallStatus.message}
                            </div>
                        </div>

                        {/* ═══════════════════════════════════════════════════
                            INSIGHT CARDS (Health summary)
                        ═══════════════════════════════════════════════════ */}
                        {insights && (
                            <div style={{
                                padding: '0 20px 14px',
                                display: 'flex',
                                gap: 8
                            }}>
                                <div style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    background: insights.isHealthy ? '#ecfdf5' : '#fffbeb',
                                    border: `1px solid ${insights.isHealthy ? '#a7f3d0' : '#fde68a'}`,
                                    borderRadius: 10
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        marginBottom: 4
                                    }}>
                                        {insights.isHealthy ? (
                                            <CheckCircle2 size={11} style={{ color: '#10b981' }} strokeWidth={2.5} />
                                        ) : (
                                            <Activity size={11} style={{ color: '#f59e0b' }} strokeWidth={2.5} />
                                        )}
                                        <span style={{
                                            fontSize: 9,
                                            fontWeight: 800,
                                            color: insights.isHealthy ? '#059669' : '#d97706',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Healthy
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: 16,
                                        fontWeight: 800,
                                        color: insights.isHealthy ? '#059669' : '#d97706',
                                        letterSpacing: '-0.3px'
                                    }}>
                                        {insights.healthyCount}/{total}
                                    </div>
                                    <div style={{
                                        fontSize: 9,
                                        color: '#64748b',
                                        fontWeight: 600,
                                        marginTop: 1
                                    }}>
                                        {insights.healthyPct}% performing well
                                    </div>
                                </div>

                                <div style={{
                                    flex: 1,
                                    padding: '10px 12px',
                                    background: parseInt(insights.criticalPct) > 30 ? '#fef2f2' : '#f8fafc',
                                    border: `1px solid ${parseInt(insights.criticalPct) > 30 ? '#fecaca' : '#d9e6e9'}`,
                                    borderRadius: 10
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        marginBottom: 4
                                    }}>
                                        {parseInt(insights.criticalPct) > 30 ? (
                                            <AlertTriangle size={11} style={{ color: '#ef4444' }} strokeWidth={2.5} />
                                        ) : (
                                            <Zap size={11} style={{ color: '#64748b' }} strokeWidth={2.5} />
                                        )}
                                        <span style={{
                                            fontSize: 9,
                                            fontWeight: 800,
                                            color: parseInt(insights.criticalPct) > 30 ? '#dc2626' : '#64748b',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Need Focus
                                        </span>
                                    </div>
                                    <div style={{
                                        fontSize: 16,
                                        fontWeight: 800,
                                        color: parseInt(insights.criticalPct) > 30 ? '#dc2626' : '#64748b',
                                        letterSpacing: '-0.3px'
                                    }}>
                                        {tiers[3].value}/{total}
                                    </div>
                                    <div style={{
                                        fontSize: 9,
                                        color: '#64748b',
                                        fontWeight: 600,
                                        marginTop: 1
                                    }}>
                                        {insights.criticalPct}% below 50%
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ═══════════════════════════════════════════════════
                            TIER BREAKDOWN ROWS
                        ═══════════════════════════════════════════════════ */}
                        <div style={{
                            padding: '0 20px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6
                        }}>
                            <div style={{
                                fontSize: 9,
                                fontWeight: 800,
                                color: '#8c8e8f',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                marginBottom: 4,
                                paddingLeft: 2
                            }}>
                                Tier Breakdown
                            </div>
                            {tiers.map((tier) => (
                                <TierRow
                                    key={tier.key}
                                    tier={tier}
                                    total={total}
                                />
                            ))}
                        </div>
                    </>
                )}
            </Card>
        </>
    );
};

export default memo(AchievementDonut);