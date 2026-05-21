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
import { PermissionGuard } from '../components/common/PermissionGuard';
import { ReadOnlyBanner } from '../components/targets/ReadOnlyBanner';
import { ConnectionBanner } from './TargetVsAchievement';
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
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const COLOR = {
    primary:   '#4f46e5',
    success:   '#10b981',
    warning:   '#f59e0b',
    danger:    '#ef4444',
    muted:     '#94a3b8',
    surface:   '#f8faff',
    border:    '#e2e8f0',
};

// ─── Custom Eased Counter Animation ─────────────────────────────
const AnimatedCounter = memo(({ end, duration = 1.0, isCurrency = false, suffix = "", prefix = "" }) => {
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
        const val = Math.round(count);
        if (isCurrency) {
            return `₹${val.toLocaleString('en-IN')}`;
        }
        return val.toLocaleString('en-IN');
    }, [count, isCurrency]);
    
    return <span>{prefix}{formatted}{suffix}</span>;
});

// ─── Eased KPI Card Component ────────────────────────────────────────────────
const KpiCard = memo(({ title, value, subtext, icon, color = '#4f46e5', isCurrency = false, trend = null, suffix = "" }) => {
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
                    <AnimatedCounter end={value} isCurrency={isCurrency} suffix={suffix} />
                </h3>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {trend !== null && (
                    <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        fontSize: 11,
                        fontWeight: 700,
                        color: trend >= 80 ? '#10b981' : trend >= 50 ? '#f59e0b' : '#ef4444',
                        background: trend >= 80 ? '#ecfdf5' : trend >= 50 ? '#fffbeb' : '#fef2f2',
                        padding: '2px 6px',
                        borderRadius: 6
                    }}>
                        {trend >= 80 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {trend.toFixed(1)}%
                    </span>
                )}
                <span style={{ color: '#64748b', fontSize: 12 }}>{subtext}</span>
            </div>
        </Card>
    );
});

// Achievement Tier helper
function getAchievementTier(pct) {
    if (pct >= 100) return { label: 'ELITE STATUS', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' };
    if (pct >= 80)  return { label: 'HIGH TARGET',  color: '#4f46e5', bg: '#e0e7ff', border: '#c7d2fe' };
    if (pct >= 50)  return { label: 'ON TRACK',    color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' };
    return                 { label: 'CRITICAL',    color: '#ef4444', bg: '#fef2f2', border: '#fca5a5' };
}

const TargetVsAchievementDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { canView, isBrandManager, isViewer } = useTargetPermissions();
    
    // Set dynamic page title
    usePageTitle('Revenue Targets Dashboard');

    const [selectedYear, setSelectedYear] = useState(2026);
    const [selectedPlanType, setSelectedPlanType] = useState('YEARLY');
    const [searchText, setSearchText] = useState('');
    
    const { targets, loading, refresh } = useTargetsData();

    // Available years list
    const availableYears = useMemo(() => {
        if (!targets || targets.length === 0) return [2026, 2025, 2024];
        const years = new Set(targets.map(t => t.Year).filter(Boolean));
        return Array.from(years).sort((a,b) => b - a);
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
                    name: s.name || s.SellerName || sid,
                    marketplace: s.marketplace || 'Amazon'
                };
            });
        }
        
        // Admins can see all sellers present in targets or database
        const sellerCodes = Array.from(new Set((targets || []).map(t => t.SellerId).filter(Boolean)));
        return sellerCodes.map(code => ({
            sellerId: code,
            name: code,
            marketplace: 'Amazon'
        }));
    }, [user, targets]);

    // Filter targets by selected configurations
    const filteredTargets = useMemo(() => {
        return (targets || []).filter((t) => {
            const matchesPlan = t.TargetType === selectedPlanType;
            const matchesYear = t.Year === selectedYear;
            
            // Search query matches seller ID or manager
            const sLower = searchText.toLowerCase();
            const matchesSearch = 
                (t.SellerId || '').toLowerCase().includes(sLower) || 
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
            
            return matchesPlan && matchesYear && matchesSearch;
        });
    }, [targets, selectedPlanType, selectedYear, searchText, isBrandManager, filteredSellers, user]);

    // Compute aggregated KPI stats
    const kpiStats = useMemo(() => {
        let totalTarget = 0;
        let totalAchieved = 0;
        let brandCount = 0;
        let premiumCount = 0;
        const brandSet = new Set();

        filteredTargets.forEach((t) => {
            totalTarget += (t.TotalTargetValue || 0);
            totalAchieved += (t.overallAchieved || 0);
            if (t.SellerId) {
                brandSet.add(t.SellerId);
            }
            const pct = t.TotalTargetValue > 0 ? (t.overallAchieved / t.TotalTargetValue) * 100 : 0;
            if (pct >= 80) {
                premiumCount++;
            }
        });

        brandCount = brandSet.size;
        const achievementRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

        return {
            totalTarget,
            totalAchieved,
            brandCount,
            premiumCount,
            achievementRate
        };
    }, [filteredTargets]);

    // Prepare monthly target vs achievement data for Recharts Bar Chart
    const monthlyChartData = useMemo(() => {
        const months = Array.from({ length: 12 }, (_, i) => ({
            monthNum: i + 1,
            name: MONTH_SHORT[i],
            Target: 0,
            Achieved: 0
        }));

        filteredTargets.forEach((t) => {
            if (t.TargetType === 'YEARLY' && t.monthlyBreakdown) {
                t.monthlyBreakdown.forEach((mb) => {
                    const mIdx = mb.PeriodValue - 1;
                    if (mIdx >= 0 && mIdx < 12) {
                        months[mIdx].Target += (mb.TargetValue || 0);
                        months[mIdx].Achieved += (mb.AchievedValue || 0);
                    }
                });
            } else if (t.TargetType === 'MONTHLY' && t.Month) {
                // If it is a monthly target, contribution falls to that explicit month
                const mIdx = t.Month - 1;
                if (mIdx >= 0 && mIdx < 12) {
                    months[mIdx].Target += (t.TotalTargetValue || 0);
                    months[mIdx].Achieved += (t.overallAchieved || 0);
                }
            }
        });

        return months;
    }, [filteredTargets]);

    // Top 5 performing brands
    const topPerformingBrands = useMemo(() => {
        return filteredTargets
            .map(t => {
                const pct = t.TotalTargetValue > 0 ? (t.overallAchieved / t.TotalTargetValue) * 100 : 0;
                return {
                    name: t.SellerId || 'Unknown',
                    target: t.TotalTargetValue || 0,
                    achieved: t.overallAchieved || 0,
                    rate: parseFloat(pct.toFixed(1))
                };
            })
            .sort((a, b) => b.rate - a.rate)
            .slice(0, 5);
    }, [filteredTargets]);

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
                const tier = getAchievementTier(pct);
                const initial = text ? text.charAt(0).toUpperCase() : 'B';
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', fontWeight: 800 }}>
                            {initial}
                        </Avatar>
                        <div>
                            <Text strong style={{ fontSize: 13 }}>{text}</Text>
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
            render: (val) => (
                <span style={{ color: '#4f46e5', fontWeight: 800 }}>
                    ₹{Math.round(val || 0).toLocaleString('en-IN')}
                </span>
            ),
            width: 130
        },
        {
            title: 'Achieved Sales',
            dataIndex: 'overallAchieved',
            key: 'overallAchieved',
            render: (val) => (
                <span style={{ color: '#10b981', fontWeight: 800 }}>
                    ₹{Math.round(val || 0).toLocaleString('en-IN')}
                </span>
            ),
            width: 130
        },
        {
            title: 'Achievement Progress',
            key: 'progress',
            render: (_, record) => {
                const pct = record.TotalTargetValue > 0 ? (record.overallAchieved / record.TotalTargetValue) * 100 : 0;
                let strokeColor = '#ef4444';
                if (pct >= 100) strokeColor = '#10b981';
                else if (pct >= 80) strokeColor = '#4f46e5';
                else if (pct >= 50) strokeColor = '#f59e0b';
                
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
                                            Goal: <strong>₹{Math.round(target).toLocaleString('en-IN')}</strong>
                                        </div>
                                        <div style={{ fontSize: 10, color: '#0f172a' }}>
                                            Sales: <strong>₹{Math.round(achieved).toLocaleString('en-IN')}</strong>
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
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .hover-lift:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }
                .kpi-card {
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .kpi-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.08);
                    border-color: #cbd5e1;
                }
                .premium-header {
                    background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #1e3a8a 100%);
                    position: relative;
                    overflow: hidden;
                    border-radius: 16px;
                    padding: 24px 32px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    box-shadow: 0 10px 30px -10px rgba(30, 27, 75, 0.5);
                }
                .premium-header::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -50%;
                    width: 200%;
                    height: 200%;
                    background: radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 60%);
                    pointer-events: none;
                }
                .chart-container-card {
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.03);
                    height: 100%;
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
                                { label: 'Yearly Plans',  value: 'YEARLY' },
                                { label: 'Monthly Plans', value: 'MONTHLY' }
                            ]}
                            style={{ background: 'transparent', fontWeight: 650, color: '#ffffff' }}
                        />
                    </div>

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
                        title="TOTAL TARGET POOL"
                        value={kpiStats.totalTarget}
                        isCurrency={true}
                        icon={<Target size={20} />}
                        color="#4f46e5"
                        subtext={`Across ${kpiStats.brandCount} revenue plans`}
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KpiCard
                        title="TOTAL SALES ACHIEVED"
                        value={kpiStats.totalAchieved}
                        isCurrency={true}
                        icon={<BarChart3 size={20} />}
                        color="#10b981"
                        subtext="Paced cumulative sales contribution"
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KpiCard
                        title="AGGREGATED ACHIEVEMENT RATE"
                        value={kpiStats.achievementRate}
                        trend={kpiStats.achievementRate}
                        suffix="%"
                        icon={<TrendingUp size={20} />}
                        color={kpiStats.achievementRate >= 80 ? '#10b981' : kpiStats.achievementRate >= 50 ? '#f59e0b' : '#ef4444'}
                        subtext="Cumulative performance quotient"
                    />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <KpiCard
                        title="HIGH PERFORMING BRANDS"
                        value={kpiStats.premiumCount}
                        icon={<Award size={20} />}
                        color="#f59e0b"
                        subtext={`GMS achievement pacing >= 80%`}
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
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis 
                                        stroke="#94a3b8" 
                                        fontSize={11} 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                                    />
                                    <RechartsTooltip 
                                        formatter={(val) => [`₹${Math.round(val).toLocaleString('en-IN')}`, '']}
                                        contentStyle={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                                    <Bar dataKey="Target" fill="#818cf8" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="Achieved" fill="#34d399" radius={[4, 4, 0, 0]} barSize={20} />
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
                                                innerRadius={60}
                                                outerRadius={85}
                                                paddingAngle={4}
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
                                    let progressColor = '#ef4444';
                                    if (item.rate >= 100) progressColor = '#10b981';
                                    else if (item.rate >= 80) progressColor = '#4f46e5';
                                    else if (item.rate >= 50) progressColor = '#f59e0b';
                                    
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
                                                <Progress percent={Math.min(item.rate, 100)} strokeColor={progressColor} showInfo={false} size="small" />
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                                    <span>Goal: ₹{Math.round(item.target).toLocaleString('en-IN')}</span>
                                                    <span>Sales: ₹{Math.round(item.achieved).toLocaleString('en-IN')}</span>
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
                                    <span style={{ fontWeight: 700, color: '#475569', fontSize: 12 }}>Cumulative Plans Target Pool</span>
                                    <span style={{ fontWeight: 850, color: '#4f46e5' }}>₹{Math.round(kpiStats.totalTarget).toLocaleString('en-IN')}</span>
                                </div>
                                <Text type="secondary" style={{ fontSize: 11 }}>Aggregated targets set for all premium and secondary sellers under active tracking status.</Text>
                            </div>

                            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontWeight: 700, color: '#475569', fontSize: 12 }}>Total Realized Achievement Sales</span>
                                    <span style={{ fontWeight: 850, color: '#10b981' }}>₹{Math.round(kpiStats.totalAchieved).toLocaleString('en-IN')}</span>
                                </div>
                                <Text type="secondary" style={{ fontSize: 11 }}>Accumulated paced sales verified from transactional pipelines and synced inventory metrics.</Text>
                            </div>

                            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span style={{ fontWeight: 700, color: '#475569', fontSize: 12 }}>Unrealized Goal Target Gap</span>
                                    <span style={{ fontWeight: 850, color: '#ef4444' }}>
                                        ₹{Math.round(Math.max(0, kpiStats.totalTarget - kpiStats.totalAchieved)).toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <Text type="secondary" style={{ fontSize: 11 }}>The revenue gap remaining to satisfy 100% of established goals across active portfolios.</Text>
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
