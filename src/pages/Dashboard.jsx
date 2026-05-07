// Dashboard - RetailOps Command Center
import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import NumberChart from '../components/common/NumberChart';
const Chart = lazy(() => import('react-apexcharts'));
import Box from '@mui/material/Box';
const BarChart = lazy(() => import('@mui/x-charts/BarChart').then(module => ({ default: module.BarChart })));
import { CHART_COLORS, mergeApexOptions, areaChartOptions } from '../utils/chartTheme';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  Users,
  Package,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PlayCircle,
  IndianRupee,
  ShoppingBag,
  Zap,
  MoreVertical,
  MousePointer2,
  Target,
  FileBarChart,
  Settings,
  PieChart,
  ChevronRight,
  MessageSquareCode,
  ArrowRight,
  Activity,
  Upload
} from 'lucide-react';
import DataTable from '../components/DataTable';
import api, { seedApi } from '../services/api';
import Card from '../components/common/Card';
import PageHeader from '../components/common/PageHeader';
import { SkeletonKpiCard, SkeletonChart } from '../components/common/Skeleton';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { format } from 'date-fns';
import ErrorState from '../components/common/ErrorState';
import { useAuth } from '../contexts/AuthContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useRefresh } from '../contexts/RefreshContext';

const Dashboard = () => {
  const { user, isGlobalUser, isAdmin } = useAuth();
  const { startDate, endDate, rangeType } = useDateRange();
  const { refreshCount } = useRefresh();
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [data, setData] = useState({
    kpis: [],
    revenueData: [],
    stackedBarSeries: [],
    areaSeries: [],
    adsPerformanceSeries: [],
    categoryData: [],
    topProducts: [],
    labels: [],
    userStats: null,
    teamStats: null,
    alerts: [],
  });
  const [error, setError] = useState(null);

  // Load dashboard data from database
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
        rangeType
      };

      // Remove undefined keys so they don't become "undefined" strings in URL
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
      );

      const query = new URLSearchParams(cleanParams).toString();
      const response = await api.dashboardApi.getSummary(query);
      const { kpi, revenue, areaSeries, stackedBarSeries, labels, category, tableData, userStats, teamStats, alerts } = response;

      setData({
        kpis: kpi || [],
        revenueData: revenue?.[0]?.data || [],
        stackedBarSeries: stackedBarSeries || [],
        areaSeries: areaSeries || [],
        adsPerformanceSeries: response.adsPerformanceSeries || [],
        labels: labels || [],
        categoryData: category || [],
        topProducts: tableData?.map((p, idx) => ({ ...p, rank: idx + 1, name: p.title })) || [],
        userStats,
        teamStats,
        alerts: alerts || [],
      });

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data. Please check your connection.');
    }
    setLoading(false);
  }, [rangeType, startDate, endDate]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, refreshCount]);

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(loadDashboardData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, loadDashboardData]);

  const handleSeedDemoData = async () => {
    setSeeding(true);
    setError(null);
    try {
      const result = await seedApi.seedAll();
      if (result.success) {
        alert('Demo data seeded successfully!');
        loadDashboardData();
      }
    } catch (err) {
      console.error('Seeding failed:', err);
      setError('Failed to seed demo data.');
    }
    setSeeding(false);
  };

  // ApexCharts Configurations
  const stackedBarOptions = {
    chart: {
      type: 'bar',
      stacked: true,
      toolbar: { show: false },
      sparkline: { enabled: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 4,
        borderRadiusApplication: 'end',
      },
    },
    xaxis: {
      categories: data.labels && data.labels.length > 0 ? data.labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#64748b', fontSize: '10px' } }
    },
    yaxis: {
      labels: { style: { colors: '#64748b', fontSize: '10px' } }
    },
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 4,
      padding: { left: 0, right: 0 }
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '11px',
      fontFamily: 'inherit',
      fontWeight: 600,
      labels: { colors: '#64748b' },
      markers: { radius: 12 }
    },
    colors: [CHART_COLORS[0], CHART_COLORS[1], CHART_COLORS[5]],
    dataLabels: { enabled: false },
    tooltip: { theme: 'light' }
  };

  const donutChartOptions = {
    chart: { type: 'donut' },
    labels: data.categoryData.map(c => c.name),
    colors: CHART_COLORS.slice(0, 5),
    stroke: { width: 0 },
    legend: {
      position: 'bottom',
      fontSize: '12px',
      fontWeight: 600,
      labels: { colors: '#64748b' }
    },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            name: { show: true, fontSize: '14px', fontWeight: 600, color: '#64748b' },
            value: { show: true, fontSize: '20px', fontWeight: 700, color: '#111827' },
            total: {
              show: true,
              label: 'Total',
              color: '#64748b',
              formatter: () => data.kpis.find(k => k.title === 'Active ASINs')?.value || 0
            }
          }
        }
      }
    }
  };


  // Removed local DashboardCard as we now use common Card component

  // Loading state with skeletons
  if (loading) {
    return (
      <div className="dashboard-container p-3" style={{ backgroundColor: 'var(--color-surface-1)', minHeight: '100vh' }}>
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
        <PageHeader
          title="Dashboard"
          subtitle="Market Intelligence Command Center"
          actions={
            <button className="btn btn-white btn-sm shadow-sm border border-zinc-200" style={{ borderRadius: 'var(--radius-full)' }} onClick={loadDashboardData}>
              <RefreshCw size={14} className={loading ? 'spin text-zinc-900' : 'text-zinc-500'} />
            </button>
          }
        />
        {/* KPI Skeletons */}
        <div className="row g-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-md-3 col-6">

            </div>
          ))}
        </div>
        {/* Chart Skeletons */}
        <div className="row g-2 mb-2">
          <div className="col-lg-8">
            {/* <SkeletonChart height={240} /> */}
          </div>
          <div className="col-lg-4">
            {/* <SkeletonChart height={240} /> */}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="dashboard-container p-3" style={{ backgroundColor: 'var(--color-surface-1)', minHeight: '100vh' }}>
        <PageHeader
          title="Dashboard"
          subtitle="Market Intelligence Command Center"
        />
        <ErrorState
          title="Failed to load dashboard"
          description={error}
          onRetry={loadDashboardData}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-container p-3" style={{ backgroundColor: 'var(--color-surface-1)', minHeight: '100vh' }}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Market Intelligence Command Center"
        actions={
          <>
            <button className="btn btn-sm btn-secondary" onClick={loadDashboardData}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
            {isGlobalUser && (
              <>
                <button
                  onClick={() => window.location.href = '/ads-report'}
                  className="btn btn-sm btn-white border border-zinc-200 shadow-sm"
                  style={{ borderRadius: 'var(--radius-full)', fontWeight: 600, fontSize: '11px' }}
                >
                  <Upload size={14} className="me-1" /> IMPORT ADS
                </button>
                <button onClick={handleSeedDemoData} className="btn btn-sm btn-zinc-900 border-0 shadow-sm" style={{ backgroundColor: '#18181B', color: '#fff', borderRadius: 'var(--radius-full)' }} disabled={seeding}>
                  {seeding ? <RefreshCw size={14} className="spin" /> : <Zap size={14} />}
                  <span className="ms-1">{seeding ? 'SEEDING...' : 'POPULATE'}</span>
                </button>
              </>
            )}
          </>
        }
      />

      {/* Standardized Metric Grid */}
      <div className="row g-2 mb-2">
        {data.kpis.map((kpi, idx) => (
          <div key={idx} className="col-md-3 col-6">
            <NumberChart
              label={kpi.title}
              value={kpi.value}
              icon={kpi.icon.includes('shop') ? ShoppingBag : kpi.icon.includes('box') ? Package : kpi.icon.includes('rupee') ? IndianRupee : TrendingUp}
              delta={kpi.trend}
              deltaType={kpi.trendType}
              color="#18181B"
            />
          </div>
        ))}
      </div>

      <div className="row g-2 mb-2">
        {/* Main Area Chart */}
        <div className="col-lg-8">
          <Card
            title="Daily Ads Performance"
            icon={TrendingUp}
            extra={<span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill smallest">ADS SPEND VS REVENUE</span>}
          >
            <Box sx={{ width: '100%', height: data.adsPerformanceSeries.length > 0 ? 240 : 120, mt: 2 }}>
              <Suspense fallback={<div className="d-flex align-items-center justify-content-center h-100"><SkeletonChart height={240} /></div>}>
                {data.adsPerformanceSeries.length > 0 ? (
                  <BarChart
                    series={data.adsPerformanceSeries.map(s => ({
                      data: s.data,
                      label: s.name,
                      id: s.name.replace(/\s+/g, '').toLowerCase() + 'Id',
                      valueFormatter: (val) => `₹${val.toLocaleString()}`
                    }))}
                    xAxis={[{
                      data: data.labels,
                      scaleType: 'band',
                      tickLabelStyle: { fontSize: 9, fill: '#94a3b8' }
                    }]}
                    yAxis={[{
                      valueFormatter: (val) => val >= 1000 ? `₹${(val / 1000).toFixed(1)}K` : `₹${val}`,
                      tickLabelStyle: { fontSize: 9, fill: '#94a3b8' }
                    }]}
                    height={240}
                    margin={{ top: 20, bottom: 40, left: 60, right: 20 }}
                    colors={['#06b6d4', '#f59e0b']} // Ad Sales (Teal), Ad Spend (Orange)
                  />
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 p-3 rounded" style={{ backgroundColor: 'var(--color-surface-2)', border: '1px dashed var(--color-border)' }}>
                    <TrendingUp size={24} className="text-muted mb-2 opacity-50" />
                    <span className="text-muted fw-bold" style={{ fontSize: '11px' }}>AWAITING PIPELINE DATA</span>
                    <span className="text-muted text-center mt-1" style={{ fontSize: '9px', maxWidth: '200px' }}>To view daily ad performance, ensure the ad data pipeline has synchronized at least one report.</span>
                  </div>
                )}
              </Suspense>
            </Box>
          </Card>
        </div>

        {/* Portfolio Distribution (Donut) */}
        <div className="col-lg-4">
          <Card title="Portfolio Mix" icon={PieChart}>
            <div className={`d-flex align-items-center justify-content-center ${data.categoryData.length > 0 ? 'h-100' : ''}`} style={{ minHeight: data.categoryData.length > 0 ? '240px' : '120px' }}>
              <Suspense fallback={<SkeletonChart height={240} />}>
                {data.categoryData.length > 0 ? (
                  <Chart options={donutChartOptions} series={data.categoryData.map(c => c.data[0])} type="donut" width="100%" height={240} />
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center w-100 h-100 p-3 rounded" style={{ backgroundColor: 'var(--color-surface-2)', border: '1px dashed var(--color-border)' }}>
                    <PieChart size={24} className="text-muted mb-2 opacity-50" />
                    <span className="text-muted fw-bold" style={{ fontSize: '11px' }}>NO CATEGORY MIX</span>
                  </div>
                )}
              </Suspense>
            </div>
          </Card>
        </div>
      </div>

      {/* Stacked Bar Chart Row */}
      <div className="row g-2 mb-2">
        <div className="col-12">
          <Card title="Monthly Performance Breakdown" icon={BarChart2} extra={<span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0.5 rounded-pill smallest">STACKED PERFORMANCE</span>}>
            <div style={{ minHeight: data.stackedBarSeries.some(s => s.data.some(d => d > 0)) ? '240px' : '120px' }}>
              <Suspense fallback={<SkeletonChart height={240} />}>
                {data.stackedBarSeries.some(s => s.data.some(d => d > 0)) ? (
                  <Chart options={stackedBarOptions} series={data.stackedBarSeries} type="bar" height={240} />
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center w-100 h-100 p-3 rounded" style={{ height: '120px', backgroundColor: 'var(--color-surface-2)', border: '1px dashed var(--color-border)' }}>
                    <BarChart2 size={24} className="text-muted mb-2 opacity-50" />
                    <span className="text-muted fw-bold" style={{ fontSize: '11px' }}>INSUFFICIENT PERFORMANCE DATA</span>
                  </div>
                )}
              </Suspense>
            </div>
          </Card>
        </div>
      </div>

      <div className="row g-2 mb-2">
        {/* Quick Access Column - 3-column grid of action cards */}
        <div className="col-lg-3">
          <div style={{
            backgroundColor: 'var(--color-surface-0)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: '16px',
            height: '100%'
          }}>
            <h6 style={{
              fontWeight: 600,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px'
            }}>
              <MousePointer2 size={16} style={{ color: 'var(--color-brand-600)' }} />
              Quick Access
            </h6>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Inventory Hub', icon: Package, href: '/inventory', color: 'var(--color-brand-600)' },
                { label: 'Strategic OKRs', icon: Target, href: '/actions', color: '#8b5cf6' },
                { label: 'Market Scraper', icon: Zap, href: '/scrape-tasks', color: '#f59e0b' },
                { label: 'Alert Manager', icon: AlertCircle, href: '/alerts', color: '#ef4444' },
                { label: 'Rule Sets', icon: Settings, href: '/rule-sets', color: '#06b6d4' },
                { label: 'Performance', icon: FileBarChart, href: '/performance-reports', color: '#10b981' },
              ].map((item, idx) => (
                <a
                  key={idx}
                  href={item.href}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 8px',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-fast)',
                    cursor: 'pointer',
                    position: 'relative',
                    border: '1px solid transparent',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-2)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: `${item.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.color,
                  }}>
                    <item.icon size={20} />
                  </div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    textAlign: 'center'
                  }}>
                    {item.label}
                  </span>
                  <ArrowRight
                    size={12}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      color: 'var(--color-text-muted)',
                      opacity: 0,
                      transition: 'opacity var(--transition-fast)'
                    }}
                    className="arrow-icon"
                  />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Action Center - Horizontal Progress Bars */}
        <div className="col-lg-9">
          <div style={{
            backgroundColor: 'var(--color-surface-0)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            padding: '20px'
          }}>
            <h6 style={{
              fontWeight: 600,
              marginBottom: '20px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Activity size={16} style={{ color: 'var(--color-brand-600)' }} />
              Action Center
            </h6>
            <div className="row g-4">
              {/* My Operations */}
              <div className="col-md-6">
                <div style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                      <ShoppingBag size={14} style={{ marginRight: '6px', color: 'var(--color-brand-600)' }} />
                      My Operations
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{data.userStats?.total || 0} items</span>
                  </div>
                  {/* Horizontal 4-segment progress bar */}
                  <div style={{ display: 'flex', gap: '4px', height: '10px', marginBottom: '12px' }}>
                    {[
                      { value: data.userStats?.pending || 0, color: 'var(--color-neutral-400)' },
                      { value: data.userStats?.inProgress || 0, color: 'var(--color-brand-500)' },
                      { value: data.userStats?.review || 0, color: 'var(--color-warning-500)' },
                      { value: data.userStats?.completed || 0, color: 'var(--color-success-500)' }
                    ].map((seg, i) => (
                      <div key={i} style={{
                        flex: 1,
                        borderRadius: i === 0 ? '5px 0 0 5px' : i === 3 ? '0 5px 5px 0' : '0',
                        backgroundColor: seg.color,
                        border: i === 0 ? '1px solid var(--color-neutral-500)' : i === 3 ? '1px solid var(--color-success-600)' : 'none',
                      }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {data.userStats?.completed || 0} of {data.userStats?.total || 0} completed
                    </span>
                    <a href="/actions" style={{ color: 'var(--color-brand-600)', textDecoration: 'none', fontWeight: 500 }}>View all →</a>
                  </div>
                </div>
              </div>
              {/* Team Health */}
              <div className="col-md-6">
                <div style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: 'var(--color-surface-1)',
                  border: '1px solid var(--color-border)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--color-text-primary)' }}>
                      <Users size={14} style={{ marginRight: '6px', color: 'var(--color-text-secondary)' }} />
                      Team Health
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-success-600)', fontWeight: 600 }}>
                      <TrendingUp size={10} style={{ marginRight: '4px' }} />
                      {data.teamStats?.total ? Math.round((data.teamStats.completed / data.teamStats.total) * 100) : 0}% EFF.
                    </span>
                  </div>
                  {/* Horizontal 4-segment progress bar */}
                  <div style={{ display: 'flex', gap: '4px', height: '10px', marginBottom: '12px' }}>
                    {[
                      { value: data.teamStats?.pending || 0, color: 'var(--color-neutral-400)' },
                      { value: data.teamStats?.inProgress || 0, color: 'var(--color-brand-500)' },
                      { value: data.teamStats?.review || 0, color: 'var(--color-warning-500)' },
                      { value: data.teamStats?.completed || 0, color: 'var(--color-success-500)' }
                    ].map((seg, i) => (
                      <div key={i} style={{
                        flex: 1,
                        borderRadius: i === 0 ? '5px 0 0 5px' : i === 3 ? '0 5px 5px 0' : '0',
                        backgroundColor: seg.color,
                        border: i === 0 ? '1px solid var(--color-neutral-500)' : i === 3 ? '1px solid var(--color-success-600)' : 'none',
                      }} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {data.teamStats?.completed || 0} of {data.teamStats?.total || 0} completed
                    </span>
                    <a href="/actions" style={{ color: 'var(--color-brand-600)', textDecoration: 'none', fontWeight: 500 }}>View all →</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-2">
        {/* Alerts / Activity */}
        <div className="col-lg-4">
          <Card
            title={
              <div className="d-flex align-items-center gap-2">
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-error)', boxShadow: '0 0 8px var(--color-error)' }} className="pulse-indicator"></div>
                Live Event Stream
              </div>
            }
            icon={Activity}
          >
            <div className="d-grid gap-2" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {data.alerts.length > 0 ? data.alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`live-alert-item p-2 rounded-2 ${alert.type === 'critical' ? 'live-alert-critical' : ''}`}
                  style={{
                    backgroundColor: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <div
                    className="alert-icon-wrapper d-flex align-items-center justify-content-center mt-1"
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: alert.type === 'critical' ? 'rgba(238, 0, 0, 0.1)' : 'rgba(245, 166, 35, 0.1)',
                      color: alert.type === 'critical' ? 'var(--color-error)' : 'var(--color-warning)'
                    }}
                  >
                    <AlertTriangle size={12} strokeWidth={3} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: '1.4' }}>
                      {alert.message}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{alert.type === 'critical' ? 'SYSTEM CRITICAL' : 'WARNING'}</span>
                      <span>{alert.time}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center py-5" style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
                  <CheckCircle2 size={24} style={{ color: 'var(--color-success)', marginBottom: '8px', opacity: 0.5 }} />
                  <div>All systems operational</div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Dynamic Intelligence Hubs */}
        <div className="col-lg-8">
          <div className="row g-2">
            {/* Ads Intelligence Hub */}
            <div className="col-md-6">
              <Card title="Advertising Stats" icon={Target}>
                <div className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-center p-3 rounded-2 border live-alert-item" style={{ backgroundColor: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
                    <div>
                      <div className="text-muted smallest" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current ROAS</div>
                      <div className="fw-bold" style={{ fontSize: '24px', color: 'var(--color-text-primary)' }}>{data.roas || '0.00'}x</div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '3px solid var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={20} style={{ color: 'var(--color-success)' }} />
                    </div>
                  </div>

                  <div className="p-3 rounded-2 border live-alert-item" style={{ backgroundColor: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
                    <div className="d-flex justify-content-between mb-2">
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Daily Spend Velocity</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-warning)' }}>₹{data.dailySpend?.toLocaleString() || 0} / day</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--color-surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '75%', height: '100%', backgroundColor: 'var(--color-warning)', boxShadow: '0 0 8px var(--color-warning)' }}></div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Active Operations Feed */}
            <div className="col-md-6">
              <Card
                title={
                  <div className="d-flex align-items-center gap-2">
                    <Settings size={16} style={{ color: 'var(--color-text-muted)' }} />
                    Active Operations
                  </div>
                }
                icon={null}
                extra={<span className="pulse-indicator" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-info)', display: 'inline-block', boxShadow: '0 0 8px var(--color-info)' }}></span>}
              >
                <div className="d-flex flex-column gap-2" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                  {[
                    { name: 'Competitor Price Scrape', status: 'Running', progress: 65, color: 'var(--color-info)' },
                    { name: 'Inventory Sync (IN)', status: 'Queued', progress: 0, color: 'var(--color-text-muted)' },
                    { name: 'Ad Campaign Rules', status: 'Completed', progress: 100, color: 'var(--color-success)' },
                    { name: 'Supplier Feed Fetch', status: 'Running', progress: 30, color: 'var(--color-info)' },
                  ].map((op, idx) => (
                    <div key={idx} className="p-2 rounded-2 border live-alert-item" style={{ backgroundColor: 'var(--color-surface-1)', borderColor: 'var(--color-border)' }}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{op.name}</span>
                        <span style={{ fontSize: '10px', color: op.color, fontWeight: 700, letterSpacing: '0.05em' }}>{op.status.toUpperCase()}</span>
                      </div>
                      <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--color-surface-2)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${op.progress}%`, height: '100%', backgroundColor: op.color, boxShadow: op.progress > 0 && op.progress < 100 ? `0 0 6px ${op.color}` : 'none' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-2">
        <div className="col-12">
          <Card title="Top ASIN / SKU Intelligence" icon={FileBarChart} extra={<span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-0.5 rounded-pill smallest">TOP PERFORMERS</span>}>
            <div className="table-responsive">
              <table className="table table-hover table-sm mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th className="text-muted" style={{ fontSize: '10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>RANK</th>
                    <th className="text-muted" style={{ fontSize: '10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>PRODUCT</th>
                    <th className="text-muted" style={{ fontSize: '10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>CATEGORY</th>
                    <th className="text-muted text-end" style={{ fontSize: '10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>UNIT SALES</th>
                    <th className="text-muted text-end" style={{ fontSize: '10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>REVENUE</th>
                    <th className="text-muted text-end" style={{ fontSize: '10px', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>ACOS</th>
                  </tr>
                </thead>
                <tbody style={{ borderTop: 'none' }}>
                  {data.topProducts?.length > 0 ? data.topProducts.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-surface-2)' }}>
                      <td style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-muted)' }}>#{p.rank || idx + 1}</td>
                      <td>
                        <div className="d-flex flex-column">
                          <span className="fw-bold text-truncate" style={{ fontSize: '12px', maxWidth: '300px', color: 'var(--color-text-primary)' }}>{p.title}</span>
                          <span className="text-muted font-monospace" style={{ fontSize: '10px' }}>{p.sku} | {p.asin}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-secondary-subtle text-secondary" style={{ fontSize: '9px', textTransform: 'uppercase' }}>
                          {p.category}
                        </span>
                      </td>
                      <td className="text-end fw-bold" style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>{p.units?.toLocaleString()}</td>
                      <td className="text-end fw-bold text-success" style={{ fontSize: '12px' }}>₹{p.revenue?.toLocaleString()}</td>
                      <td className="text-end fw-bold" style={{ fontSize: '12px', color: p.acos && p.acos !== '0.0%' ? '#f59e0b' : 'var(--color-text-muted)' }}>{p.acos}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="6" className="text-center py-4">
                        <div className="d-flex flex-column align-items-center justify-content-center">
                          <Package size={24} className="text-muted mb-2 opacity-50" />
                          <span className="text-muted fw-bold" style={{ fontSize: '11px' }}>NO PRODUCT DATA</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>

  );
};

export default Dashboard;
