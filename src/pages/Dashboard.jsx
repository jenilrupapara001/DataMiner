import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Row, Col, Card, Skeleton, Space } from 'antd';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useDashboardData } from '../hooks/useDashboardData';

// Subcomponents
import DashboardHeader from '../components/dashboard/DashboardHeader';
import KpiStrip from '../components/dashboard/KpiStrip';
import ModuleStatusGrid from '../components/dashboard/ModuleStatusGrid';
import SalesTrendChart from '../components/dashboard/SalesTrendChart';
import AchievementDonut from '../components/dashboard/AchievementDonut';
import TopAsinsCard from '../components/dashboard/TopAsinsCard';
import TasksOverviewCard from '../components/dashboard/TasksOverviewCard';
import AlertsPipelineCard from '../components/dashboard/AlertsPipelineCard';

const containerVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { 
        opacity: 1, 
        y: 0,
        transition: { 
            duration: 0.4,
            ease: 'easeOut',
            staggerChildren: 0.1
        } 
    }
};

const Dashboard = () => {
    const { setPageTitle } = usePageTitle();
    const { startDate, endDate } = useDateRange();

    useEffect(() => {
        setPageTitle('Unified Operations Dashboard');
    }, [setPageTitle]);

    const [filters, setFilters] = useState({
        sellerId: 'all',
        managerId: 'all',
        goalType: 'all',
        dateRange: { start: startDate, end: endDate }
    });

    // Sync context date range changes to filters state
    useEffect(() => {
        setFilters(prev => ({
            ...prev,
            dateRange: { start: startDate, end: endDate }
        }));
    }, [startDate, endDate]);

    const {
        userSellers,
        managers,
        activityLogs,
        scrapeTasks,
        optimizationTasks,
        topProducts,
        orch,
        moduleStats,
        loading,
        isHydrated,
        refresh
    } = useDashboardData(filters);

    // Dynamic calculations for KPI values
    const kpiValues = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        const adSalesData = adsPerf[0]?.data || [];
        const adSpendData = adsPerf[1]?.data || [];
        
        const adSales = adSalesData.reduce((a, b) => a + b, 0);
        const adSpend = adSpendData.reduce((a, b) => a + b, 0);
        const orders = orch.dashboardRaw?.kpi?.[0]?.trend || 0;
        const acos = adSales > 0 ? (adSpend / adSales) * 100 : 0;
        const units = Math.round(orders * 1.48);

        // Target stats based on applied filters
        const targetsList = orch.targets || [];
        let totalTarget = 0;
        let totalAchieved = 0;
        const brandSet = new Set();

        let filteredTargets = targetsList;
        if (filters.sellerId && filters.sellerId !== 'all') {
            filteredTargets = filteredTargets.filter(t => t.SellerId === filters.sellerId);
        }
        if (filters.managerId && filters.managerId !== 'all') {
            filteredTargets = filteredTargets.filter(t => t.BrandManager === filters.managerId);
        }
        if (filters.goalType && filters.goalType !== 'all') {
            filteredTargets = filteredTargets.filter(t => (t.GoalType || 'GMS').toUpperCase() === filters.goalType);
        }

        filteredTargets.forEach(t => {
            totalTarget += (t.TotalTargetValue || 0);
            totalAchieved += (t.overallAchieved || 0);
            if (t.SellerId) brandSet.add(t.SellerId);
        });

        const achievementRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

        return {
            adSales,
            adSpend,
            orders,
            acos,
            units,
            targetTotal: totalTarget,
            targetAchieved: totalAchieved,
            achievementRate,
            brandCount: brandSet.size
        };
    }, [orch.dashboardRaw, orch.targets, filters]);

    // Trend sparkline series
    const sparklineData = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        return {
            adSales: adsPerf[0]?.data || [],
            orders: orch.dashboardRaw?.ordersSeries || [],
            acos: orch.dashboardRaw?.acosSeries || [],
            units: orch.dashboardRaw?.unitsSeries || [],
            targetPool: [],
            achieved: [],
            rate: [],
            brands: []
        };
    }, [orch.dashboardRaw]);

    // Graph data formatters
    const salesTrendLabels = useMemo(() => {
        return orch.dashboardRaw?.labels || [];
    }, [orch.dashboardRaw]);

    const salesTrendRevenue = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        return adsPerf[0]?.data || [];
    }, [orch.dashboardRaw]);

    const salesTrendSpend = useMemo(() => {
        const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
        return adsPerf[1]?.data || [];
    }, [orch.dashboardRaw]);

    const initialLoading = loading && !isHydrated;

    if (initialLoading) {
        return (
            <div style={{ background: '#f4f5f7', minHeight: '100%', padding: '0 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 60 }}>
                    <Space orientation="vertical" size={2}>
                        <Skeleton.Input active size="large" style={{ width: 220, height: 32 }} />
                        <Skeleton.Input active size="small" style={{ width: 320, height: 16 }} />
                    </Space>
                </div>
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <Col key={i} xs={12} sm={6} md={3}>
                            <Card style={{ borderRadius: 12, border: '1px solid #d9e6e9', padding: 8 }}>
                                <Skeleton active paragraph={{ rows: 1 }} />
                            </Card>
                        </Col>
                    ))}
                </Row>
                <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <Col key={i} xs={24} sm={12} md={8}>
                            <Card style={{ borderRadius: 12, border: '1px solid #d9e6e9', padding: 16 }}>
                                <Skeleton active paragraph={{ rows: 2 }} />
                            </Card>
                        </Col>
                    ))}
                </Row>
            </div>
        );
    }

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            style={{ background: '#f4f5f7', minHeight: '100%', padding: '0 24px' }}
        >
            {/* Section 1: Header */}
            <DashboardHeader
                filters={filters}
                setFilters={setFilters}
                userSellers={userSellers}
                managers={managers}
                onSync={refresh}
                loading={loading}
            />

            {/* Section 2: KPI Strip -- shows skeleton until KPIs arrive */}
            {orch.isLoadingKpis ? (
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <Col key={i} xs={12} sm={6} md={3}>
                            <Card style={{ borderRadius: 12, border: '1px solid #d9e6e9', padding: 8 }}>
                                <Skeleton active paragraph={{ rows: 1 }} />
                            </Card>
                        </Col>
                    ))}
                </Row>
            ) : (
                <KpiStrip
                    adSales={kpiValues.adSales}
                    adSpend={kpiValues.adSpend}
                    orders={kpiValues.orders}
                    acos={kpiValues.acos}
                    units={kpiValues.units}
                    targetTotal={kpiValues.targetTotal}
                    targetAchieved={kpiValues.targetAchieved}
                    achievementRate={kpiValues.achievementRate}
                    brandCount={kpiValues.brandCount}
                    sparklineData={sparklineData}
                />
            )}

            {/* Section 3: Module Status Grid */}
            <ModuleStatusGrid moduleStats={moduleStats} />

            {/* Section 4: Charts Row */}
            <Row gutter={[20, 20]} style={{ marginBottom: '24px' }}>
                <Col xs={24} lg={14}>
                    {orch.isLoadingKpis ? (
                        <Card style={{ borderRadius: 12, border: '1px solid #d9e6e9' }}>
                            <Skeleton active paragraph={{ rows: 6 }} style={{ padding: 16 }} />
                        </Card>
                    ) : (
                        <SalesTrendChart
                            labels={salesTrendLabels}
                            revenueData={salesTrendRevenue}
                            spendData={salesTrendSpend}
                        />
                    )}
                </Col>
                <Col xs={24} lg={10}>
                    {orch.isLoadingTargets ? (
                        <Card style={{ borderRadius: 12, border: '1px solid #d9e6e9' }}>
                            <Skeleton active paragraph={{ rows: 4 }} style={{ padding: 16 }} />
                        </Card>
                    ) : (
                        <AchievementDonut
                            targets={orch.targets || []}
                            overallRate={kpiValues.achievementRate}
                        />
                    )}
                </Col>
            </Row>

            {/* Section 5: Data Row */}
            <Row gutter={[20, 20]}>
                <Col xs={24} md={8}>
                    <TopAsinsCard products={topProducts || []} />
                </Col>
                <Col xs={24} md={8}>
                    <TasksOverviewCard tasks={optimizationTasks} loading={loading} />
                </Col>
                <Col xs={24} md={8}>
                    <AlertsPipelineCard
                        alerts={activityLogs}
                        pipelineTasks={scrapeTasks}
                        onSyncClick={refresh}
                        syncLoading={loading}
                    />
                </Col>
            </Row>
        </motion.div>
    );
};

export default Dashboard;