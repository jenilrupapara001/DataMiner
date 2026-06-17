import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
    Table, Button, Select, Space, Card, Row, Col, Typography,
    Progress, Badge, Divider, Segmented, Tag, Tooltip, Input,
    List, Avatar, Skeleton
} from 'antd';
import {
    Target, DollarSign, Percent, RefreshCw, TrendingUp,
    Award, BarChart3, Search, ChevronRight, ChevronLeft,
    TrendingDown, Sparkles, Layers, Grid, BarChart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useTargetsData } from '../hooks/useTargetsData';
import { useAuth } from '../contexts/AuthContext';
import { useTargetPermissions } from '../hooks/useTargetPermissions';
import { sellerApi } from '../services/api';
import { PermissionGuard } from '../components/common/PermissionGuard';
import { ReadOnlyBanner } from '../components/targets/ReadOnlyBanner';
import Chart from 'react-apexcharts';
import {
    ResponsiveContainer,
    BarChart as RechartsBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    PieChart as RechartsPieChart,
    Pie,
    Cell
} from 'recharts';

const { Text, Title } = Typography;
const { Option } = Select;

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const COLOR = {
    primary: '#4f46e5',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    muted: '#94a3b8',
    surface: '#f8faff',
    border: '#e2e8f0',
};

const GOAL_META = {
    GMS: { label: 'GMS', unit: '₹', color: '#4f46e5', bg: '#ede9fe' },
    ADS: { label: 'ADS', unit: '₹', color: '#2563eb', bg: '#dbeafe' },
    ACOS: { label: 'ACOS', unit: '%', color: '#dc2626', bg: '#fee2e2' },
    NEW_RC: { label: 'New RC', unit: '#', color: '#059669', bg: '#d1fae5' },
    RNR: { label: 'RNR', unit: '#', color: '#3b82f6', bg: '#eff6ff' },
    PO_FULFILMENT: { label: 'PO Fulfilment', unit: '%', color: '#0891b2', bg: '#cffafe' },
    PO_DAYS: { label: 'PO Days', unit: 'd', color: '#be185d', bg: '#fce7f3' },
    SELLER_CENTRAL_BUSINESS: { label: 'SC Business', unit: '₹', color: '#b45309', bg: '#fef3c7' },
};

const getGoalMeta = (goalType) => {
    return GOAL_META[goalType] || { label: goalType || 'GMS', unit: '₹', color: '#4f46e5', bg: '#ede9fe' };
};

const formatValue = (val, unit) => {
    if (val === undefined || val === null || isNaN(val)) {
        return unit === '₹' ? '₹0' : `0${unit === '#' ? '' : unit}`;
    }
    const rounded = Math.round(val);
    if (unit === '₹') {
        return `₹${rounded.toLocaleString('en-IN')}`;
    }
    if (unit === '%') {
        return `${val.toFixed(1)}%`;
    }
    if (unit === 'd') {
        return `${rounded}d`;
    }
    return rounded.toLocaleString('en-IN');
};

const formatValueShort = (val, unit) => {
    if (val === undefined || val === null || isNaN(val)) {
        return unit === '₹' ? '₹0' : `0${unit === '#' ? '' : unit}`;
    }
    if (unit !== '₹') {
        if (unit === '%') return `${val.toFixed(1)}%`;
        if (unit === 'd') return `${Math.round(val)}d`;
        return Math.round(val).toLocaleString('en-IN');
    }
    const num = Math.round(val);
    const absNum = Math.abs(num);
    if (absNum >= 10000000) { // Crore
        return `₹${(num / 10000000).toFixed(2).replace(/\.?0+$/, '')}Cr`;
    }
    if (absNum >= 100000) { // Lakh
        return `₹${(num / 100000).toFixed(2).replace(/\.?0+$/, '')}L`;
    }
    if (absNum >= 1000) {
        return `₹${(num / 1000).toFixed(1).replace(/\.?0+$/, '')}k`;
    }
    return `₹${num}`;
};

// ─── Custom Eased Counter Animation ─────────────────────────────
const AnimatedCounter = memo(({ end, duration = 1.0, unit = "₹" }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTimestamp = null;
        const endVal = parseFloat(end) || 0;
        if (endVal === 0) {
            setCount(0);
            return;
        }

        let active = true;
        const step = (timestamp) => {
            if (!active) return;
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / (duration * 1000), 1);

            const easeOutQuad = progress * (2 - progress);
            setCount(easeOutQuad * endVal);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setCount(endVal);
            }
        };

        window.requestAnimationFrame(step);
        return () => {
            active = false;
        };
    }, [end, duration]);

    const formatted = useMemo(() => {
        return formatValue(count, unit);
    }, [count, unit]);

    return <span>{formatted}</span>;
});

// ─── Eased KPI Card Component ────────────────────────────────────────────────
const KpiCard = memo(({ title, value, subtext, icon, color = '#4f46e5', unit = "₹", trend = null, isAcos = false }) => {
    return (
        <Card className="kpi-card" style={{ borderRadius: 16, border: '1px solid #e2e8f0', height: '100%' }} styles={{ body: { padding: 20 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>{title}</span>
                <div style={{
                    background: `${color}15`,
                    color: color,
                    padding: 8,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {icon}
                </div>
            </div>

            <div style={{ marginBottom: 8 }}>
                <h3 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>
                    <AnimatedCounter end={value} unit={unit} />
                </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {trend !== null && (() => {
                    const tier = getAchievementTier(trend, isAcos);
                    return (
                        <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            fontSize: 11,
                            fontWeight: 700,
                            color: tier.color,
                            background: tier.bg,
                            border: `1px solid ${tier.border}`,
                            padding: '2px 6px',
                            borderRadius: 6
                        }}>
                            {isAcos ? (trend <= 100 ? <TrendingDown size={13} /> : <TrendingUp size={13} />) : (trend >= 80 ? <TrendingUp size={13} /> : <TrendingDown size={13} />)}
                            {trend.toFixed(1)}%
                        </span>
                    );
                })()}
                <span style={{ color: '#64748b', fontSize: 12 }}>{subtext}</span>
            </div>
        </Card>
    );
});

// Achievement Tier helper
function getAchievementTier(pct, isAcos = false) {
    if (isAcos) {
        if (pct === 0) return { label: 'CRITICAL', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' };
        if (pct <= 100) return { label: 'ELITE STATUS', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' };
        if (pct <= 110) return { label: 'HIGH TARGET', color: '#4f46e5', bg: '#e0e7ff', border: '#c7d2fe' };
        if (pct <= 125) return { label: 'ON TRACK', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' };
        return { label: 'CRITICAL', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' };
    }
    if (pct >= 100) return { label: 'ELITE STATUS', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' };
    if (pct >= 80) return { label: 'HIGH TARGET', color: '#4f46e5', bg: '#e0e7ff', border: '#c7d2fe' };
    if (pct >= 50) return { label: 'ON TRACK', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' };
    return { label: 'CRITICAL', color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' };
}

export const ConnectionBanner = memo(({ targets }) => {
    if (!targets || targets.length > 0) return null;
    return (
        <div style={{
            padding: '10px 16px', background: '#fffbeb',
            border: '1px solid #fde68a', borderRadius: 8,
            marginBottom: 12, fontSize: 12, fontWeight: 500, color: '#92400e'
        }}>
            ⚠ No target data loaded. Create targets or check your connection.
        </div>
    );
});

const TargetVsAchievementDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { canView, isBrandManager, isViewer } = useTargetPermissions();

    // Set dynamic page title
    usePageTitle('Revenue Targets Dashboard');

    const [selectedYear, setSelectedYear] = useState(2026);
    const [selectedPlanType, setSelectedPlanType] = useState('YEARLY');
    const [selectedGoalType, setSelectedGoalType] = useState('GMS');
    const [searchText, setSearchText] = useState('');

    const { targets, loading, refresh } = useTargetsData();

    const [sellers, setSellers] = useState([]);

    useEffect(() => {
        sellerApi.getAll({ limit: 500 })
            .then((res) => {
                const list = res?.data?.sellers || res?.data || res?.sellers || [];
                setSellers(Array.isArray(list) ? list : []);
            })
            .catch(err => console.error('[Sellers] load error:', err));
    }, []);

    const sellerMap = useMemo(() => {
        const map = new Map();
        sellers.forEach(s => {
            map.set(s._id || s.id, s.name || '');
        });
        return map;
    }, [sellers]);

    // Available goal types
    const availableGoalTypes = useMemo(() => {
        if (!targets) return ['GMS', 'ADS', 'ACOS', 'RNR'];
        const types = new Set(targets.map(t => t.GoalType).filter(Boolean));
        return Array.from(types).sort();
    }, [targets]);

    // Available years list
    const availableYears = useMemo(() => {
        if (!targets || targets.length === 0) return [2026, 2025, 2024];
        const years = new Set(targets.map(t => t.Year).filter(Boolean));
        return Array.from(years).sort((a, b) => b - a);
    }, [targets]);

    // Handle view change from Segmented controller
    const handleViewChange = useCallback((val) => {
        if (val === 'table') {
            navigate('/target-achievement');
        }
    }, [navigate]);

    // Filtered sellers (mapped from user profiles or list of targets)
    const filteredSellers = useMemo(() => {
        if (!user) return [];
        const roleName = (user.role?.name || user.role || '').toString().toLowerCase().trim();
        const isMgr = roleName === 'brand manager' || roleName === 'brand_manager';

        if (isMgr) {
            // Find sellers assigned to this brand manager
            const userSellers = user.assignedSellers || [];
            return userSellers.map(s => {
                const sid = s.sellerId || s.SellerId || s._id || s.Id || s;
                return {
                    sellerId: sid,
                    name: s.name || s.SellerName || sellerMap.get(sid) || sid,
                    marketplace: s.marketplace || 'Amazon'
                };
            });
        }

        // Admins can see all sellers present in targets or database
        const sellerCodes = Array.from(new Set((targets || []).map(t => t.SellerId).filter(Boolean)));
        return sellerCodes.map(code => ({
            sellerId: code,
            name: sellerMap.get(code) || code,
            marketplace: 'Amazon'
        }));
    }, [user, targets, sellerMap]);

    // Filter targets by selected configurations
    const filteredTargets = useMemo(() => {
        return (targets || []).filter((t) => {
            const matchesPlan = t.TargetType === selectedPlanType;
            const matchesGoal = selectedGoalType === 'ALL' || t.GoalType === selectedGoalType;
            const matchesYear = t.Year === selectedYear;

            // Search query matches seller ID or manager
            const sLower = searchText.toLowerCase();
            const sellerName = (sellerMap.get(t.SellerId) || t.SellerId || '').toLowerCase();
            const matchesSearch =
                sellerName.includes(sLower) ||
                (t.BrandManager || '').toLowerCase().includes(sLower);

            if (isBrandManager) {
                const sellerIdLower = (t.SellerId || '').toString().toLowerCase();
                const matchesSeller = filteredSellers.some(s => {
                    const code = (s.sellerId || s.SellerId || s.Id || s._id || '').toString().toLowerCase();
                    return code === sellerIdLower;
                });

                const targetManagerLower = (t.BrandManager || '').toString().toLowerCase().trim();
                const currentUserName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim().toLowerCase();
                const matchesManagerName = targetManagerLower === currentUserName;

                if (!matchesSeller && !matchesManagerName) {
                    return false;
                }
            }

            return matchesPlan && matchesYear && matchesSearch && matchesGoal;
        });
    }, [targets, selectedPlanType, selectedYear, searchText, isBrandManager, filteredSellers, user, sellerMap]);

    // Compute aggregated KPI stats
    const kpiStats = useMemo(() => {
        let totalTarget = 0;
        let totalAchieved = 0;
        let brandCount = 0;
        let premiumCount = 0;
        const brandSet = new Set();
        let targetCount = 0;

        filteredTargets.forEach((t) => {
            const goalType = t.GoalType || 'GMS';
            const isAcos = goalType === 'ACOS';
            totalTarget += (t.TotalTargetValue || 0);
            totalAchieved += (t.overallAchieved || 0);
            targetCount++;

            if (t.SellerId) {
                brandSet.add(t.SellerId);
            }
            const pct = t.TotalTargetValue > 0 ? (t.overallAchieved / t.TotalTargetValue) * 100 : 0;
            const tier = getAchievementTier(pct, isAcos);
            if (tier.label === 'ELITE STATUS' || tier.label === 'HIGH TARGET') {
                premiumCount++;
            }
        });

        brandCount = brandSet.size;

        const isAverageGoal = ['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType);

        let displayTarget = totalTarget;
        let displayAchieved = totalAchieved;

        if (isAverageGoal && targetCount > 0) {
            displayTarget = totalTarget / targetCount;
            displayAchieved = totalAchieved / targetCount;
        }

        const achievementRate = displayTarget > 0 ? (displayAchieved / displayTarget) * 100 : 0;

        return {
            totalTarget: displayTarget,
            totalAchieved: displayAchieved,
            brandCount,
            premiumCount,
            achievementRate
        };
    }, [filteredTargets, selectedGoalType]);

    // Compute Manager-wise Analytics
    const managerChartData = useMemo(() => {
        const mgrMap = new Map();
        filteredTargets.forEach(t => {
            const mgr = t.BrandManager || 'Unassigned';
            if (!mgrMap.has(mgr)) {
                mgrMap.set(mgr, { TargetSum: 0, AchievedSum: 0, count: 0 });
            }
            const data = mgrMap.get(mgr);
            data.TargetSum += (t.TotalTargetValue || 0);
            data.AchievedSum += (t.overallAchieved || 0);
            data.count++;
        });
        const categories = [];
        const targets = [];
        const achieved = [];

        // Sort by Target descending
        const sortedMgrs = Array.from(mgrMap.entries()).sort((a, b) => b[1].TargetSum - a[1].TargetSum);

        const isAverageGoal = ['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType);

        sortedMgrs.forEach(([mgr, data]) => {
            categories.push(mgr);
            const targetVal = isAverageGoal ? (data.TargetSum / data.count) : data.TargetSum;
            const achievedVal = isAverageGoal ? (data.AchievedSum / data.count) : data.AchievedSum;
            targets.push(parseFloat(targetVal.toFixed(1)));
            achieved.push(parseFloat(achievedVal.toFixed(1)));
        });

        return { categories, targets, achieved };
    }, [filteredTargets, selectedGoalType]);

    // Compute Seller-wise Analytics
    const sellerChartData = useMemo(() => {
        const selMap = new Map();
        filteredTargets.forEach(t => {
            const seller = sellerMap.get(t.SellerId) || t.SellerId || 'Unknown';
            if (!selMap.has(seller)) {
                selMap.set(seller, { TargetSum: 0, AchievedSum: 0, count: 0 });
            }
            const data = selMap.get(seller);
            data.TargetSum += (t.TotalTargetValue || 0);
            data.AchievedSum += (t.overallAchieved || 0);
            data.count++;
        });
        const categories = [];
        const targets = [];
        const achieved = [];

        // Sort by Target descending, take top 15 for chart readability
        const sortedSels = Array.from(selMap.entries()).sort((a, b) => b[1].TargetSum - a[1].TargetSum).slice(0, 15);

        const isAverageGoal = ['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType);

        sortedSels.forEach(([seller, data]) => {
            categories.push(seller);
            const targetVal = isAverageGoal ? (data.TargetSum / data.count) : data.TargetSum;
            const achievedVal = isAverageGoal ? (data.AchievedSum / data.count) : data.AchievedSum;
            targets.push(parseFloat(targetVal.toFixed(1)));
            achieved.push(parseFloat(achievedVal.toFixed(1)));
        });

        return { categories, targets, achieved };
    }, [filteredTargets, sellerMap, selectedGoalType]);

    // Prepare monthly target vs achievement data for Recharts Bar Chart
    const monthlyChartData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => ({
            monthNum: i + 1,
            name: MONTH_SHORT[i],
            TargetSum: 0,
            AchievedSum: 0,
            count: 0
        }));

        filteredTargets.forEach((t) => {
            if (t.TargetType === 'YEARLY' && t.monthlyBreakdown) {
                t.monthlyBreakdown.forEach((mb) => {
                    const mIdx = mb.PeriodValue - 1;
                    if (mIdx >= 0 && mIdx < 12) {
                        months[mIdx].TargetSum += (mb.TargetValue || 0);
                        months[mIdx].AchievedSum += (mb.AchievedValue || 0);
                        months[mIdx].count++;
                    }
                });
            } else if (t.TargetType === 'MONTHLY' && t.Month) {
                const mIdx = t.Month - 1;
                if (mIdx >= 0 && mIdx < 12) {
                    months[mIdx].TargetSum += (t.TotalTargetValue || 0);
                    months[mIdx].AchievedSum += (t.overallAchieved || 0);
                    months[mIdx].count++;
                }
            }
        });

        const isAverageGoal = ['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType);

        return months.map(m => {
            const targetVal = isAverageGoal && m.count > 0 ? (m.TargetSum / m.count) : m.TargetSum;
            const achievedVal = isAverageGoal && m.count > 0 ? (m.AchievedSum / m.count) : m.AchievedSum;
            return {
                name: m.name,
                Target: parseFloat(targetVal.toFixed(1)),
                Achieved: parseFloat(achievedVal.toFixed(1))
            };
        });
    }, [filteredTargets, selectedGoalType]);

    // Top 5 performing brands
    const topPerformingBrands = useMemo(() => {
        return filteredTargets
            .map(t => {
                const pct = t.TotalTargetValue > 0 ? (t.overallAchieved / t.TotalTargetValue) * 100 : 0;
                return {
                    name: sellerMap.get(t.SellerId) || t.SellerId || 'Unknown',
                    target: t.TotalTargetValue || 0,
                    achieved: t.overallAchieved || 0,
                    rate: parseFloat(pct.toFixed(1))
                };
            })
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 5);
    }, [filteredTargets, sellerMap]);

    // Status Distribution pie chart data
    const statusDistributionData = useMemo(() => {
        let elite = 0;
        let high = 0;
        let track = 0;
        let critical = 0;

        filteredTargets.forEach(t => {
            const pct = t.TotalTargetValue > 0 ? (t.overallAchieved / t.TotalTargetValue) * 100 : 0;
            if (pct >= 100) elite++;
            else if (pct >= 80) high++;
            else if (pct >= 50) track++;
            else critical++;
        });

        return [
            { name: 'Elite (100%+)', value: elite, color: '#10b981' },
            { name: 'High (80%+)', value: high, color: '#4f46e5' },
            { name: 'Track (50%+)', value: track, color: '#f59e0b' },
            { name: 'Critical (<50%)', value: critical, color: '#ef4444' }
        ].filter(item => item.value > 0);
    }, [filteredTargets]);
    // Breakdown table columns
    const columns = [
        {
            title: 'Brand / Seller',
            dataIndex: 'SellerId',
            key: 'sellerId',
            render: (text, record) => {
                const pct = record.TotalTargetValue > 0 ? (record.overallAchieved / record.TotalTargetValue) * 100 : 0;
                const tier = getAchievementTier(pct, record.GoalType === 'ACOS');
                const displayName = sellerMap.get(text) || text;
                const initial = displayName ? displayName.charAt(0).toUpperCase() : 'B';
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', fontWeight: 800 }}>
                            {initial}
                        </Avatar>
                        <div>
                            <Text strong style={{ fontSize: 13 }}>{displayName}</Text>
                            <div style={{ marginTop: 2 }}>
                                <Tag color={tier.color === '#4f46e5' ? 'blue' : tier.color === '#10b981' ? 'success' : tier.color === '#f59e0b' ? 'warning' : 'error'} style={{ fontSize: 9, fontWeight: 700 }}>
                                    {tier.label}
                                </Tag>
                            </div>
                        </div>
                    </div>
                );
            },
            width: 200
        },
        {
            title: 'Manager',
            dataIndex: 'BrandManager',
            key: 'brandManager',
            render: (text) => (
                <span style={{ fontSize: 12, fontWeight: 650, color: '#475569' }}>{text || 'Unassigned'}</span>
            ),
            width: 150
        },
        {
            title: 'Target Goal',
            dataIndex: 'TotalTargetValue',
            key: 'targetGoal',
            render: (val, record) => {
                const meta = getGoalMeta(record.GoalType);
                return (
                    <span style={{ color: '#4f46e5', fontWeight: 800 }}>
                        {formatValue(val, meta.unit)}
                    </span>
                );
            },
            width: 130
        },
        {
            title: 'Achievement',
            dataIndex: 'overallAchieved',
            key: 'overallAchieved',
            render: (val, record) => {
                const meta = getGoalMeta(record.GoalType);
                return (
                    <span style={{ color: '#10b981', fontWeight: 800 }}>
                        {formatValue(val, meta.unit)}
                    </span>
                );
            },
            width: 130
        },
        {
            title: 'Achievement Progress',
            key: 'progress',
            render: (_, record) => {
                const pct = record.TotalTargetValue > 0 ? (record.overallAchieved / record.TotalTargetValue) * 100 : 0;
                const isAcos = record.GoalType === 'ACOS';
                const tier = getAchievementTier(pct, isAcos);
                const strokeColor = tier.color;

                return (
                    <div style={{ width: '100%', minWidth: 120 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 750, color: '#334155', marginBottom: 4 }}>
                            <span>Pacing Rate</span>
                            <span>{pct.toFixed(1)}%</span>
                        </div>
                        <Progress percent={Math.min(pct, 100)} strokeColor={strokeColor} showInfo={false} size="small" />
                    </div>
                );
            }
        }
    ];

    // Expanded Row Rendering showing Monthly Allocation Card Details
    const expandedRowRender = useCallback((record) => {
        if (!record.monthlyBreakdown || record.monthlyBreakdown.length === 0) {
            return (
                <div style={{ padding: '12px 24px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <Text type="secondary">No monthly breakdown allocations set for this target plan.</Text>
                </div>
            );
        }

        const meta = getGoalMeta(record.GoalType);

        return (
            <div style={{ padding: '16px 24px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <Title level={5} style={{ margin: '0 0 12px 0', fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={15} style={{ color: '#4f46e5' }} />
                    Monthly Breakdown Allocation Plan ({record.Year})
                </Title>
                <Row gutter={[12, 12]}>
                    {MONTH_NAMES.map((monthName, idx) => {
                        const mNum = idx + 1;
                        const breakdown = record.monthlyBreakdown.find(mb => mb.PeriodValue === mNum);
                        const target = breakdown?.TargetValue || 0;
                        const achieved = breakdown?.AchievedValue || 0;
                        const pct = target > 0 ? (achieved / target) * 100 : 0;

                        return (
                            <Col xs={12} sm={8} md={6} lg={4} key={monthName}>
                                <Card size="small" style={{ borderRadius: 8, border: '1px solid #cbd5e1' }} styles={{ body: { padding: 10 } }}>
                                    <div style={{ fontWeight: 700, fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                                        {MONTH_SHORT[idx]}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <div style={{ fontSize: 10, color: '#475569' }}>
                                            Goal: <strong>{formatValue(target, meta.unit)}</strong>
                                        </div>
                                        <div style={{ fontSize: 10, color: '#0f172a' }}>
                                            Actual: <strong>{formatValue(achieved, meta.unit)}</strong>
                                        </div>
                                        <div style={{ marginTop: 4 }}>
                                            <Progress
                                                percent={Math.min(pct, 100)}
                                                size="tiny"
                                                strokeColor={pct >= 100 ? '#10b981' : pct >= 80 ? '#4f46e5' : pct >= 50 ? '#f59e0b' : '#ef4444'}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            </div>
        );
    }, []);

    return (
        <PermissionGuard allowed={canView} mode="lock">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <style>{`
                .hover-lift {
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .hover-lift:hover {
                    transform: translateY(-4px) scale(1.01);
                    box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.1);
                }
                .kpi-card {
                    border-radius: 24px;
                    border: 1px solid rgba(255, 255, 255, 0.9);
                    background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
                    box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.05), inset 0 2px 4px rgba(255,255,255,0.8);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    position: relative;
                    overflow: hidden;
                }
                .kpi-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; height: 4px;
                    background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
                    opacity: 0;
                    transition: opacity 0.4s ease;
                }
                .kpi-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 25px 50px -12px rgba(99, 102, 241, 0.15);
                    border-color: rgba(99, 102, 241, 0.2);
                }
                .kpi-card:hover::before {
                    opacity: 1;
                }
                .premium-header {
                    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%);
                    position: relative;
                    overflow: hidden;
                    border-radius: 24px;
                    padding: 28px 36px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.6), inset 0 1px 0 rgba(255,255,255,0.1);
                }
                .premium-header::after {
                    content: '';
                    position: absolute;
                    top: -50%;
                    right: -20%;
                    width: 80%;
                    height: 200%;
                    background: radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, transparent 70%);
                    pointer-events: none;
                }
                .chart-container-card {
                    border-radius: 24px;
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    box-shadow: 0 12px 30px -10px rgba(15, 23, 42, 0.06);
                    background: #ffffff;
                    height: 100%;
                    transition: all 0.3s ease;
                }
                .chart-container-card:hover {
                    box-shadow: 0 20px 40px -10px rgba(15, 23, 42, 0.08);
                }
                .chart-container-card .ant-card-head {
                    border-bottom: 1px solid rgba(241, 245, 249, 0.8);
                    padding: 20px 24px;
                    background: rgba(255,255,255,0.5);
                    backdrop-filter: blur(8px);
                    border-radius: 24px 24px 0 0;
                }
                .chart-container-card .ant-card-body {
                    padding: 24px;
                }
            `}</style>

                <ConnectionBanner targets={targets} />

                {isViewer && <ReadOnlyBanner isBrandManager={isBrandManager} />}

                {/* 1. Page Header (Premium Redesigned) */}
                <div className="premium-header" style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
                }}>
                    <Space size={16}>
                        <div style={{
                            background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px)',
                            color: '#a5b4fc', padding: 14, borderRadius: 12, display: 'flex',
                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2)'
                        }}>
                            <BarChart size={28} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontWeight: 900, color: '#ffffff', fontSize: 24, letterSpacing: '-0.5px' }}>
                                Target Analytics Dashboard
                            </h2>
                            <Text style={{ color: '#c7d2fe', fontSize: 13, fontWeight: 500 }}>
                                Analyze sales achievements, trend models, brand comparisons, and plan Recaps in real-time.
                            </Text>
                        </div>
                    </Space>

                    <Space size={12} style={{ flexWrap: 'wrap' }}>
                        {/* Table / Dashboard Navigation Switch */}
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.12)', borderRadius: 10, padding: 3, border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                            <Segmented
                                value="dashboard"
                                onChange={handleViewChange}
                                options={[
                                    { label: 'Table View', value: 'table' },
                                    { label: 'Analytics Dashboard', value: 'dashboard' }
                                ]}
                                style={{ background: 'transparent', fontWeight: 650, color: '#ffffff' }}
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 10, padding: 4, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            <Segmented
                                value={selectedPlanType}
                                onChange={setSelectedPlanType}
                                options={[
                                    { label: 'Yearly Plans', value: 'YEARLY' },
                                    { label: 'Monthly Plans', value: 'MONTHLY' }
                                ]}
                                style={{ background: 'transparent', fontWeight: 650, color: '#ffffff' }}
                            />
                        </div>

                        <Select
                            value={selectedGoalType}
                            onChange={setSelectedGoalType}
                            style={{ width: 120, height: 40 }}
                            className="glass-select"
                        >
                            <Option value="ALL">All Goals</Option>
                            {availableGoalTypes.map(gt => (
                                <Option key={gt} value={gt}>{gt}</Option>
                            ))}
                        </Select>

                        <Select
                            value={selectedYear}
                            onChange={setSelectedYear}
                            style={{ width: 100, height: 40 }}
                            className="glass-select"
                        >
                            {availableYears.map(year => (
                                <Option key={year} value={year}>{year}</Option>
                            ))}
                        </Select>

                        <Button
                            shape="round"
                            icon={<RefreshCw size={15} />}
                            onClick={refresh}
                            loading={loading}
                            style={{
                                height: 40,
                                fontWeight: 600,
                                background: 'rgba(255, 255, 255, 0.08)',
                                borderColor: 'rgba(255, 255, 255, 0.15)',
                                color: '#ffffff'
                            }}
                        >
                            Refresh
                        </Button>
                    </Space>
                </div>

                {/* 2. KPI Metric Panel */}
                <Row gutter={[20, 20]}>
                    <Col xs={24} sm={12} lg={6}>
                        <KpiCard
                            title={['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType) ? "AVERAGE TARGET GOAL" : "TOTAL TARGET POOL"}
                            value={kpiStats.totalTarget}
                            unit={getGoalMeta(selectedGoalType).unit}
                            icon={<Target size={20} />}
                            color="#4f46e5"
                            subtext={`Across ${kpiStats.brandCount} brand targets`}
                        />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <KpiCard
                            title={['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType) ? "AVERAGE ACHIEVEMENT" : "TOTAL ACHIEVED"}
                            value={kpiStats.totalAchieved}
                            unit={getGoalMeta(selectedGoalType).unit}
                            icon={<BarChart3 size={20} />}
                            color="#10b981"
                            subtext={['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType) ? "Paced average realization" : "Paced cumulative achievement"}
                        />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <KpiCard
                            title="AGGREGATED ACHIEVEMENT RATE"
                            value={kpiStats.achievementRate}
                            trend={kpiStats.achievementRate}
                            unit="%"
                            isAcos={selectedGoalType === 'ACOS'}
                            icon={<TrendingUp size={20} />}
                            color={getAchievementTier(kpiStats.achievementRate, selectedGoalType === 'ACOS').color}
                            subtext="Cumulative performance quotient"
                        />
                    </Col>
                    <Col xs={24} sm={12} lg={6}>
                        <KpiCard
                            title={selectedGoalType === 'ACOS' ? "COMPLIANT BRANDS" : "HIGH PERFORMING BRANDS"}
                            value={kpiStats.premiumCount}
                            icon={<Award size={20} />}
                            color="#f59e0b"
                            unit=""
                            subtext={selectedGoalType === 'ACOS' ? "ACOS pacing within target limits" : "Goal achievements pacing >= 80%"}
                        />
                    </Col>
                </Row>

                {/* 3. Charts Visualization Area */}
                <Row gutter={[20, 20]}>
                    {/* Monthly Bar Chart */}
                    <Col xs={24} lg={16}>
                        <Card
                            className="chart-container-card"
                            title={
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Sparkles size={16} style={{ color: '#4f46e5' }} />
                                    Monthly Allocation Progress ({selectedYear})
                                </span>
                            }
                        >
                            <div style={{ width: '100%', height: 320 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RechartsBarChart
                                        data={monthlyChartData}
                                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                                    >
                                        <defs>
                                            <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                                                <stop offset="100%" stopColor="#4338ca" stopOpacity={0.8} />
                                            </linearGradient>
                                            <linearGradient id="colorAchieved" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                                <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                        <YAxis
                                            stroke="#94a3b8"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => formatValueShort(val, getGoalMeta(selectedGoalType).unit)}
                                        />
                                        <RechartsTooltip
                                            formatter={(val) => [formatValue(val, getGoalMeta(selectedGoalType).unit), '']}
                                            contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                                        <Bar dataKey="Target" fill="url(#colorTarget)" radius={[4, 4, 0, 0]} barSize={20} />
                                        <Bar dataKey="Achieved" fill="url(#colorAchieved)" radius={[4, 4, 0, 0]} barSize={20} />
                                    </RechartsBarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </Col>

                    {/* Status Doughnut Chart */}
                    <Col xs={24} lg={8}>
                        <Card
                            className="chart-container-card"
                            title={
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Grid size={16} style={{ color: '#4f46e5' }} />
                                    Plan Performance Status Ratio
                                </span>
                            }
                        >
                            {statusDistributionData.length === 0 ? (
                                <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text type="secondary">No targets present for the current selection.</Text>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320 }}>
                                    <div style={{ width: '100%', height: 200 }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RechartsPieChart>
                                                <Pie
                                                    data={statusDistributionData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={95}
                                                    paddingAngle={5}
                                                    cornerRadius={8}
                                                    stroke="none"
                                                    dataKey="value"
                                                >
                                                    {statusDistributionData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip />
                                            </RechartsPieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 12 }}>
                                        {statusDistributionData.map((item) => (
                                            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                                <span style={{ color: '#475569', fontWeight: 600 }}>{item.name}: {item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* Manager and Seller Analytics */}
                <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
                    {/* Manager-wise Bar Chart */}
                    <Col xs={24} lg={12}>
                        <Card
                            className="chart-container-card"
                            title={
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <BarChart3 size={16} style={{ color: '#4f46e5' }} />
                                    Manager-wise Fulfillment
                                </span>
                            }
                        >
                            {managerChartData.categories.length === 0 ? (
                                <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text type="secondary">No data available for the current selection.</Text>
                                </div>
                            ) : (
                                <div style={{ width: '100%', height: 320 }}>
                                    <Chart
                                        type="bar"
                                        height="100%"
                                        series={[
                                            { name: 'Target', data: managerChartData.targets },
                                            { name: 'Achieved', data: managerChartData.achieved }
                                        ]}
                                        options={{
                                            chart: { toolbar: { show: false }, stacked: false },
                                            plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
                                            dataLabels: { enabled: false },
                                            stroke: { show: true, width: 4, colors: ['transparent'] },
                                            grid: { strokeDashArray: 4, borderColor: '#f1f5f9', xaxis: { lines: { show: false } } },
                                            xaxis: {
                                                categories: managerChartData.categories,
                                                labels: { style: { fontSize: '11px', fontWeight: 600, colors: '#64748b' } }
                                            },
                                            yaxis: {
                                                labels: {
                                                    style: { fontSize: '11px', fontWeight: 600, colors: '#64748b' },
                                                    formatter: (val) => formatValueShort(val, getGoalMeta(selectedGoalType).unit)
                                                }
                                            },
                                            colors: ['#4f46e5', '#10b981'],
                                            fill: {
                                                type: 'gradient',
                                                gradient: { shade: 'light', type: 'vertical', shadeIntensity: 0.25, inverseColors: false, opacityFrom: 1, opacityTo: 0.8, stops: [0, 100] }
                                            },
                                            legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', fontWeight: 600, markers: { radius: 12 } },
                                            tooltip: {
                                                y: { formatter: (val) => formatValue(val, getGoalMeta(selectedGoalType).unit) }
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </Card>
                    </Col>

                    {/* Seller-wise Horizontal Bar Chart */}
                    <Col xs={24} lg={12}>
                        <Card
                            className="chart-container-card"
                            title={
                                <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Layers size={16} style={{ color: '#f59e0b' }} />
                                    Brand-wise Progress Overview (Top 15)
                                </span>
                            }
                        >
                            {sellerChartData.categories.length === 0 ? (
                                <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text type="secondary">No data available for the current selection.</Text>
                                </div>
                            ) : (
                                <div style={{ width: '100%', height: 320 }}>
                                    <Chart
                                        type="bar"
                                        height="100%"
                                        series={[
                                            { name: 'Target', data: sellerChartData.targets },
                                            { name: 'Achieved', data: sellerChartData.achieved }
                                        ]}
                                        options={{
                                            chart: { toolbar: { show: false }, stacked: false },
                                            plotOptions: { bar: { horizontal: true, barHeight: '60%', borderRadius: 3 } },
                                            dataLabels: { enabled: false },
                                            stroke: { show: true, width: 3, colors: ['transparent'] },
                                            grid: { strokeDashArray: 4, borderColor: '#f1f5f9', xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
                                            xaxis: {
                                                categories: sellerChartData.categories,
                                                labels: {
                                                    style: { fontSize: '10px', fontWeight: 600, colors: '#64748b' },
                                                    formatter: (val) => formatValueShort(val, getGoalMeta(selectedGoalType).unit)
                                                }
                                            },
                                            yaxis: {
                                                labels: { style: { fontSize: '10px', fontWeight: 600, colors: '#475569' } }
                                            },
                                            colors: ['#cbd5e1', '#34d399'],
                                            fill: {
                                                type: 'gradient',
                                                gradient: { shade: 'light', type: 'horizontal', shadeIntensity: 0.25, inverseColors: false, opacityFrom: 1, opacityTo: 0.8, stops: [0, 100] }
                                            },
                                            legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', fontWeight: 600, markers: { radius: 12 } },
                                            tooltip: {
                                                y: { formatter: (val) => formatValue(val, getGoalMeta(selectedGoalType).unit) }
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* Row 2: Top Brands & High Performers */}
                <Row gutter={[20, 20]}>
                    <Col xs={24} md={12}>
                        <Card className="chart-container-card" title="Top 5 Performing Brands & Pacing Rate">
                            {topPerformingBrands.length === 0 ? (
                                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text type="secondary">No achievements logged.</Text>
                                </div>
                            ) : (
                                <List
                                    dataSource={topPerformingBrands}
                                    renderItem={(item, index) => {
                                        const isAcos = selectedGoalType === 'ACOS';
                                        const tier = getAchievementTier(item.rate, isAcos);
                                        const progressColor = tier.color;

                                        return (
                                            <List.Item style={{ borderBottom: '1px solid #f1f5f9', padding: '12px 0' }}>
                                                <div style={{ width: '100%' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Space>
                                                            <span style={{ fontWeight: 800, color: '#4f46e5', minWidth: 20 }}>#{index + 1}</span>
                                                            <Text strong style={{ color: '#0f172a' }}>{item.name}</Text>
                                                        </Space>
                                                        <span style={{ fontWeight: 800, color: progressColor }}>{item.rate}%</span>
                                                    </div>
                                                    <Progress percent={Math.min(item.rate, 100)} strokeColor={{ '0%': progressColor, '100%': progressColor === '#ef4444' ? '#f87171' : progressColor === '#f59e0b' ? '#fbbf24' : progressColor === '#10b981' ? '#34d399' : '#818cf8' }} showInfo={false} size="small" trailColor="#f1f5f9" />
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                                        <span>Goal: {formatValue(item.target, getGoalMeta(selectedGoalType).unit)}</span>
                                                        <span>Actual: {formatValue(item.achieved, getGoalMeta(selectedGoalType).unit)}</span>
                                                    </div>
                                                </div>
                                            </List.Item>
                                        );
                                    }}
                                />
                            )}
                        </Card>
                    </Col>

                    <Col xs={24} md={12}>
                        <Card className="chart-container-card" title="Operational Targets Breakdown recap">
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontWeight: 700, color: '#475569', fontSize: 12 }}>
                                            {['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType) ? "Average Target Goal" : "Cumulative Plans Target Pool"}
                                        </span>
                                        <span style={{ fontWeight: 850, color: '#4f46e5' }}>
                                            {formatValue(kpiStats.totalTarget, getGoalMeta(selectedGoalType).unit)}
                                        </span>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                        {['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType)
                                            ? "Average targets set across active brand portfolios under tracking."
                                            : "Aggregated targets set for all premium and secondary sellers under active tracking status."}
                                    </Text>
                                </div>

                                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontWeight: 700, color: '#475569', fontSize: 12 }}>
                                            {['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType) ? "Average Realized Achievement" : "Total Realized Achievement Value"}
                                        </span>
                                        <span style={{ fontWeight: 850, color: '#10b981' }}>
                                            {formatValue(kpiStats.totalAchieved, getGoalMeta(selectedGoalType).unit)}
                                        </span>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                        {['ACOS', 'PO_FULFILMENT', 'PO_DAYS'].includes(selectedGoalType)
                                            ? "Average realized values computed from transactional and advertising pipelines."
                                            : "Accumulated paced values verified from transactional pipelines and synced inventory metrics."}
                                    </Text>
                                </div>

                                <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontWeight: 700, color: '#475569', fontSize: 12 }}>
                                            {getGoalMeta(selectedGoalType).unit === '₹' ? 'Unrealized Goal Target Gap' : 'Target vs Achievement Gap'}
                                        </span>
                                        <span style={{ fontWeight: 850, color: '#ef4444' }}>
                                            {formatValue(Math.max(0, kpiStats.totalTarget - kpiStats.totalAchieved), getGoalMeta(selectedGoalType).unit)}
                                        </span>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                        {getGoalMeta(selectedGoalType).unit === '₹'
                                            ? "The revenue/spend gap remaining to satisfy 100% of established goals across active portfolios."
                                            : "The physical value difference remaining to satisfy established goals."}
                                    </Text>
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>

                {/* 4. Filter search bar & Interactive Table */}
                <Card style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }} styles={{ body: { padding: 0 } }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        borderBottom: '1px solid #e2e8f0', padding: '16px 20px', gap: 16, flexWrap: 'wrap'
                    }}>
                        <Title level={4} style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                            Brand-wise Target Fulfillment Status
                        </Title>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Input
                                placeholder="Search brand or manager..."
                                prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                allowClear
                                style={{ borderRadius: 8, width: 220 }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 650, color: '#64748b', whiteSpace: 'nowrap' }}>
                                {filteredTargets.length} Brands
                            </span>
                        </div>
                    </div>

                    <Table
                        dataSource={filteredTargets}
                        columns={columns}
                        rowKey="Id"
                        loading={loading}
                        expandable={{
                            expandedRowRender,
                            rowExpandable: () => true
                        }}
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: false,
                            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} brands`
                        }}
                        scroll={{ x: 800 }}
                        size="middle"
                    />
                </Card>
            </div>
        </PermissionGuard>
    );
};

export default TargetVsAchievementDashboard;
