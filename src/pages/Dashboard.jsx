// Dashboard - RetailOps Command Center - PRO MAX LUX EDITION
import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Box from '@mui/material/Box';
const Chart = lazy(() => import('react-apexcharts'));
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
  Upload,
  Sparkles,
  Rocket
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
import {
  Table, Button, Progress, ConfigProvider, Tag, Space,
  Typography, Tooltip, Empty, Avatar
} from 'antd';

const { Text } = Typography;

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 100, damping: 15 }
  }
};

const premiumCardStyle = {
  background: 'linear-gradient(to bottom right, #ffffff, #fcfdff)',
  borderRadius: '20px',
  border: '1px solid rgba(229, 231, 235, 0.5)',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.02), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
  overflow: 'hidden',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease'
};

// Enhanced StatCard to replace number chart
const PremiumStatCard = ({ label, value, trend, trendType, icon: Icon, index, color = '#4f46e5' }) => {
  const isPositive = trendType === 'positive';
  const isNegative = trendType === 'negative';
  const accentColor = isPositive ? '#10b981' : isNegative ? '#ef4444' : color;

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -4, boxShadow: '0 12px 20px -5px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)' }}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02), 0 1px 2px 0 rgba(0, 0, 0, 0.01)',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Glow highlight */}
      <div style={{
        position: 'absolute',
        top: '-20px',
        right: '-20px',
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: `radial-gradient(circle, ${accentColor}10 0%, transparent 70%)`,
        zIndex: 0
      }} />

      <div className="d-flex justify-content-between align-items-start position-relative" style={{ zIndex: 1 }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          backgroundColor: `${accentColor}10`,
          color: accentColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={20} strokeWidth={2} />
        </div>

        {trend && (
          <div style={{
            backgroundColor: isPositive ? '#ecfdf5' : isNegative ? '#fef2f2' : '#f3f4f6',
            color: isPositive ? '#065f46' : isNegative ? '#991b1b' : '#374151',
            padding: '2px 8px',
            borderRadius: '100px',
            fontSize: '11px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            {isPositive ? <ArrowUpRight size={12} strokeWidth={3} /> : isNegative ? <ArrowDownRight size={12} strokeWidth={3} /> : null}
            {trend}%
          </div>
        )}
      </div>

      <div className="mt-3 pt-1 position-relative" style={{ zIndex: 1 }}>
        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </div>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 + index * 0.1 }}
          style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em', marginTop: '4px' }}
        >
          {value}
        </motion.div>
      </div>
    </motion.div>
  );
};

const Dashboard = () => {
  // Antd Table Columns Config
  const tableColumns = useMemo(() => [
    {
      title: 'RANK',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (text, record, index) => (
        <span style={{ fontSize: '12px', fontWeight: 800, color: index < 3 ? '#4f46e5' : '#94a3b8' }}>
          #{text || index + 1}
        </span>
      ),
    },
    {
      title: 'INTELLIGENCE OBJECT',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div className="d-flex flex-column">
          <Text strong style={{ fontSize: '13px', color: '#0f172a', maxWidth: '320px' }} ellipsis={{ tooltip: text }}>
            {text}
          </Text>
          <span className="font-monospace text-slate-400" style={{ fontSize: '10px', fontWeight: 600 }}>
            {record.asin} | {record.sku}
          </span>
        </div>
      ),
    },
    {
      title: 'SECTOR',
      dataIndex: 'category',
      key: 'category',
      render: (text) => (
        <Tag color="default" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', borderRadius: '6px', border: 'none', backgroundColor: '#f1f5f9', color: '#475569' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'VELOCITY',
      dataIndex: 'units',
      key: 'units',
      align: 'right',
      sorter: (a, b) => (a.units || 0) - (b.units || 0),
      render: (text) => <span className="fw-bold text-slate-700" style={{ fontSize: '13px' }}>{Number(text || 0).toLocaleString()}</span>,
    },
    {
      title: 'YIELD',
      dataIndex: 'revenue',
      key: 'revenue',
      align: 'right',
      sorter: (a, b) => (a.revenue || 0) - (b.revenue || 0),
      render: (text) => <span className="fw-bold" style={{ fontSize: '13px', color: '#059669' }}>₹{Number(text || 0).toLocaleString()}</span>,
    },
    {
      title: 'ACOS',
      dataIndex: 'acos',
      key: 'acos',
      align: 'right',
      render: (text) => {
        const isHigh = text && text !== '0.0%' && parseFloat(text) > 30;
        return <span className="fw-bold" style={{ fontSize: '13px', color: isHigh ? '#ef4444' : '#64748b' }}>{text}</span>;
      }
    }
  ], []);

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
    roas: '0.00',
    dailySpend: 0
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
      const { kpi, revenue, areaSeries, stackedBarSeries, labels, category, tableData, userStats, teamStats, alerts, roas, dailySpend } = response;

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
        roas: roas || '0.00',
        dailySpend: dailySpend || 0
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

  // ApexCharts Configurations (Refined)
  const stackedBarOptions = useMemo(() => ({
    chart: {
      type: 'bar',
      stacked: true,
      toolbar: { show: false },
      sparkline: { enabled: false },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '45%',
        borderRadius: 6,
        borderRadiusApplication: 'end',
      },
    },
    xaxis: {
      categories: data.labels && data.labels.length > 0 ? data.labels : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#94a3b8', fontSize: '10px', fontWeight: 500 } }
    },
    yaxis: {
      labels: {
        style: { colors: '#94a3b8', fontSize: '10px', fontWeight: 500 },
        formatter: (val) => val >= 1000 ? `₹${(val / 1000).toFixed(0)}K` : `₹${val}`
      }
    },
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 6,
      padding: { left: 10, right: 10, top: 0 }
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'right',
      fontSize: '11px',
      fontFamily: 'inherit',
      fontWeight: 600,
      labels: { colors: '#64748b' },
      markers: { radius: 12, offsetX: -4 },
      itemMargin: { horizontal: 10 }
    },
    colors: ['#4f46e5', '#0ea5e9', '#10b981'], // Indigo, Sky, Emerald
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    fill: { opacity: 0.85 },
    tooltip: {
      theme: 'light',
      style: { fontSize: '12px', fontFamily: 'inherit' },
      y: { formatter: (val) => `₹${val.toLocaleString()}` }
    }
  }), [data.labels]);

  const donutChartOptions = useMemo(() => ({
    chart: {
      type: 'donut',
      animations: {
        enabled: true,
        dynamicAnimation: { speed: 1000 }
      }
    },
    labels: data.categoryData.map(c => c.name),
    colors: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'],
    stroke: { width: 3, colors: ['#ffffff'] },
    legend: {
      position: 'bottom',
      fontSize: '11px',
      fontWeight: 600,
      labels: { colors: '#64748b' },
      markers: { width: 8, height: 8, radius: 4 }
    },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: '78%',
          labels: {
            show: true,
            name: { show: true, fontSize: '12px', fontWeight: 600, color: '#64748b', offsetY: -4 },
            value: { show: true, fontSize: '24px', fontWeight: 800, color: '#0f172a', offsetY: 8, formatter: (v) => v },
            total: {
              show: true,
              label: 'Items',
              color: '#94a3b8',
              fontWeight: 600,
              formatter: (w) => {
                return w.globals.seriesTotals.reduce((a, b) => a + b, 0);
              }
            }
          }
        }
      }
    },
    tooltip: { enabled: true, theme: 'light' }
  }), [data.categoryData]);

  // Elegant decorative backgrounds to create premium atmosphere
  const DecorativeBackdrop = () => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: -1,
      overflow: 'hidden',
      pointerEvents: 'none',
      backgroundColor: '#f8fafc'
    }}>
      <div style={{
        position: 'absolute',
        top: '0%',
        right: '0%',
        width: '60vw',
        height: '60vw',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.04) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        left: '-10%',
        width: '50vw',
        height: '50vw',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.03) 0%, transparent 70%)',
        filter: 'blur(80px)',
      }} />
    </div>
  );

  // Loading state with skeletons
  if (loading) {
    return (
      <div className="dashboard-container p-4" style={{ minHeight: '100vh', position: 'relative' }}>
        <DecorativeBackdrop />
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
        <PageHeader
          title="Dashboard"
          subtitle="Gathering real-time performance data..."
          actions={<button className="btn btn-sm btn-white border opacity-50"><RefreshCw size={14} className="spin" /></button>}
        />
        <div className="row g-3 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="col-md-3 col-6">
              <div style={{ height: '140px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}></div>
            </div>
          ))}
        </div>
        <div className="row g-3">
          <div className="col-lg-8"><SkeletonChart height={300} /></div>
          <div className="col-lg-4"><SkeletonChart height={300} /></div>
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }`}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="dashboard-container p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh' }}>
        <PageHeader title="Dashboard" subtitle="Error loading module" />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <ErrorState title="Dashboard Interruption" description={error} onRetry={loadDashboardData} />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="dashboard-container p-4"
      style={{ minHeight: '100vh', position: 'relative' }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <DecorativeBackdrop />

      {/* Header Layout */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <div style={{ padding: '6px', background: '#eff6ff', borderRadius: '8px', color: '#3b82f6' }}>
              <LayoutDashboard size={18} strokeWidth={2.5} />
            </div>
            <h2 className="mb-0 fw-bold tracking-tight" style={{ color: '#0f172a', fontSize: '1.75rem' }}>Workspace</h2>
          </div>
          <p className="text-muted mb-0" style={{ fontSize: '13px', fontWeight: 500 }}>
            Market Intelligence Command Center &bull; Last updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Tooltip title="Refresh Data">
            <Button
              type="text"
              shape="circle"
              icon={<RefreshCw size={14} className={loading ? 'spin text-primary' : 'text-slate-500'} />}
              onClick={loadDashboardData}
              style={{ border: '1px solid #e2e8f0', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              loading={loading}
            />
          </Tooltip>

          {isGlobalUser && (
            <Space size="small">
              <Button
                icon={<Upload size={14} />}
                onClick={() => window.location.href = '/ads-report'}
                style={{ fontWeight: 700, fontSize: '11px', borderRadius: '10px', height: '36px' }}
              >
                IMPORT ADS
              </Button>

              <Button
                type="primary"
                icon={!seeding ? <Sparkles size={14} fill="currentColor" /> : null}
                onClick={handleSeedDemoData}
                loading={seeding}
                style={{
                  fontWeight: 700,
                  fontSize: '11px',
                  borderRadius: '10px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  border: 'none'
                }}
              >
                {seeding ? 'SYNCING...' : 'RUN SIMULATION'}
              </Button>
            </Space>
          )}
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="row g-3 mb-3">
        {data.kpis.map((kpi, idx) => (
          <div key={idx} className="col-md-3 col-6">
            <PremiumStatCard
              label={kpi.title}
              value={kpi.value}
              icon={kpi.icon.includes('shop') ? ShoppingBag : kpi.icon.includes('box') ? Package : kpi.icon.includes('rupee') ? IndianRupee : TrendingUp}
              trend={kpi.trend}
              trendType={kpi.trendType}
              index={idx}
              color={idx === 0 ? '#4f46e5' : idx === 1 ? '#06b6d4' : idx === 2 ? '#8b5cf6' : '#f59e0b'}
            />
          </div>
        ))}
      </div>

      {/* Middle Row Charts */}
      <div className="row g-3 mb-3">
        <motion.div variants={itemVariants} className="col-lg-8">
          <div style={{ ...premiumCardStyle, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#ffffff' }}>
              <div className="d-flex align-items-center gap-2">
                <div style={{ color: '#0ea5e9' }}><TrendingUp size={16} strokeWidth={2.5} /></div>
                <h6 className="mb-0 fw-bold text-slate-800" style={{ fontSize: '14px' }}>Ad Expenditure vs Revenue</h6>
              </div>
              <span className="badge px-2 py-1 rounded-pill" style={{ fontSize: '10px', background: '#f0f9ff', color: '#0369a1', fontWeight: 700, letterSpacing: '0.02em' }}>LIVE STREAM</span>
            </div>
            <div className="p-4 pt-3 flex-grow-1">
              <Box sx={{ width: '100%', height: data.adsPerformanceSeries.length > 0 ? 260 : 120 }}>
                <Suspense fallback={<SkeletonChart height={260} />}>
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
                        tickLabelStyle: { fontSize: 10, fill: '#94a3b8', fontWeight: 500 }
                      }]}
                      yAxis={[{
                        valueFormatter: (val) => val >= 1000 ? `₹${(val / 1000).toFixed(0)}K` : `₹${val}`,
                        tickLabelStyle: { fontSize: 10, fill: '#94a3b8', fontWeight: 500 }
                      }]}
                      height={260}
                      margin={{ top: 10, bottom: 30, left: 50, right: 10 }}
                      colors={['#3b82f6', '#fbbf24']} // Clean Modern Colors
                      slotProps={{
                        legend: {
                          direction: 'row',
                          position: { vertical: 'bottom', horizontal: 'middle' },
                          padding: 0,
                          labelStyle: { fontSize: 12, fill: '#64748b', fontWeight: 500 }
                        }
                      }}
                    />
                  ) : (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 bg-slate-50 rounded-3 border border-dashed">
                      <Rocket size={28} className="text-slate-300 mb-2" />
                      <span className="text-slate-400 fw-bold" style={{ fontSize: '12px' }}>AWAITING DATAPOINTS</span>
                    </div>
                  )}
                </Suspense>
              </Box>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="col-lg-4">
          <div style={{ ...premiumCardStyle, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#ffffff' }}>
              <div className="d-flex align-items-center gap-2">
                <div style={{ color: '#ec4899' }}><PieChart size={16} strokeWidth={2.5} /></div>
                <h6 className="mb-0 fw-bold text-slate-800" style={{ fontSize: '14px' }}>Channel Coverage</h6>
              </div>
            </div>
            <div className="p-4 d-flex flex-column justify-content-center align-items-center flex-grow-1" style={{ minHeight: '260px' }}>
              <Suspense fallback={<SkeletonChart height={200} />}>
                {data.categoryData.length > 0 ? (
                  <Chart
                    options={{
                      ...donutChartOptions,
                      plotOptions: {
                        pie: {
                          donut: {
                            ...donutChartOptions.plotOptions.pie.donut,
                            labels: {
                              ...donutChartOptions.plotOptions.pie.donut.labels,
                              total: {
                                ...donutChartOptions.plotOptions.pie.donut.labels.total,
                                label: 'TOTAL ASINs'
                              }
                            }
                          }
                        }
                      }
                    }}
                    series={data.categoryData.map(c => c.data[0])}
                    type="donut"
                    width="100%"
                    height={240}
                  />
                ) : (
                  <div className="text-center text-slate-400 py-4">
                    <PieChart size={24} className="opacity-30 mb-2 mx-auto" />
                    <p style={{ fontSize: '12px' }}>No channel data mapped.</p>
                  </div>
                )}
              </Suspense>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Full Width Breakdown Chart */}
      <motion.div variants={itemVariants} className="row g-3 mb-3">
        <div className="col-12">
          <div style={premiumCardStyle}>
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#ffffff' }}>
              <div className="d-flex align-items-center gap-2">
                <div style={{ color: '#4f46e5' }}><BarChart2 size={16} strokeWidth={2.5} /></div>
                <h6 className="mb-0 fw-bold text-slate-800" style={{ fontSize: '14px' }}>Segmented Temporal Performance</h6>
              </div>
            </div>
            <div className="p-4">
              <Suspense fallback={<SkeletonChart height={240} />}>
                {data.stackedBarSeries.some(s => s.data.some(d => d > 0)) ? (
                  <Chart options={stackedBarOptions} series={data.stackedBarSeries} type="bar" height={260} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center" style={{ height: '200px', backgroundColor: '#f8fafc', border: '1px dashed #e2e8f0', borderRadius: '12px' }}>
                    <span className="text-slate-400 fw-semibold" style={{ fontSize: '13px' }}>Detailed temporal metrics not yet mapped.</span>
                  </div>
                )}
              </Suspense>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Action Central Grid */}
      <div className="row g-3 mb-3">
        {/* Widgets: Quick Actions */}
        <motion.div variants={itemVariants} className="col-lg-4">
          <div style={{ ...premiumCardStyle, height: '100%', padding: '24px' }}>
            <h6 style={{ fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', color: '#0f172a' }}>
              <MousePointer2 size={18} style={{ color: '#4f46e5' }} />
              Quick Access
            </h6>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { label: 'Catalog', icon: Package, href: '/inventory', bg: '#eef2ff', color: '#4f46e5' },
                { label: 'OKRs', icon: Target, href: '/actions', bg: '#f5f3ff', color: '#8b5cf6' },
                { label: 'Scraper', icon: Zap, href: '/scrape-tasks', bg: '#fffbeb', color: '#f59e0b' },
                { label: 'Alerts', icon: AlertCircle, href: '/alerts', bg: '#fef2f2', color: '#ef4444' },
                { label: 'Settings', icon: Settings, href: '/rule-sets', bg: '#ecfeff', color: '#0891b2' },
                { label: 'Reports', icon: FileBarChart, href: '/performance-reports', bg: '#f0fdf4', color: '#10b981' },
              ].map((item, idx) => (
                <motion.a
                  key={idx}
                  href={item.href}
                  whileHover={{ scale: 1.05, backgroundColor: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '16px 8px',
                    borderRadius: '16px',
                    textDecoration: 'none',
                    border: '1px solid transparent',
                    transition: 'all 0.2s ease',
                    background: '#f8fafc'
                  }}
                >
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    backgroundColor: item.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.color,
                  }}>
                    <item.icon size={18} strokeWidth={2.5} />
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                    {item.label}
                  </span>
                </motion.a>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Operation Hub: Detailed Status Indicators */}
        <motion.div variants={itemVariants} className="col-lg-8">
          <div style={{ ...premiumCardStyle, height: '100%', padding: '24px' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h6 style={{ fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', marginBottom: 0 }}>
                <Activity size={18} style={{ color: '#0ea5e9' }} />
                Enterprise Action Tracker
              </h6>
              <div style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '100px', fontWeight: 700 }}>STATUS ACTIVE</div>
            </div>

            <div className="row g-3">
              {/* User Operations */}
              <div className="col-md-6">
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: '8px', height: '8px', background: '#4f46e5', borderRadius: '50%' }}></div>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#334155' }}>Personal Backlog</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>{data.userStats?.total || 0} tasks</span>
                  </div>

                  <Progress
                    percent={Math.round(((data.userStats?.completed + (data.userStats?.inProgress || 0)) / (data.userStats?.total || 1)) * 100) || 0}
                    success={{ percent: Math.round((data.userStats?.completed / (data.userStats?.total || 1)) * 100) || 0 }}
                    strokeColor="#3b82f6"
                    railColor="#f1f5f9"
                    showInfo={false}
                    style={{ marginBottom: '16px' }}
                  />

                  <div className="d-flex justify-content-between align-items-center">
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                      <span style={{ color: '#0f172a', fontWeight: 700 }}>{data.userStats?.completed || 0}</span> ready
                    </div>
                    <a href="/actions" style={{ fontSize: '11px', fontWeight: 700, color: '#4f46e5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Go <ArrowRight size={12} />
                    </a>
                  </div>
                </div>
              </div>

              {/* Team Health */}
              <div className="col-md-6">
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)' }}>
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#334155' }}>Global Efficiency</span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700, background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                      {data.teamStats?.total ? Math.round((data.teamStats.completed / data.teamStats.total) * 100) : 0}%
                    </span>
                  </div>

                  <Progress
                    percent={Math.round(((data.teamStats?.completed + (data.teamStats?.inProgress || 0)) / (data.teamStats?.total || 1)) * 100) || 0}
                    success={{ percent: Math.round((data.teamStats?.completed / (data.teamStats?.total || 1)) * 100) || 0 }}
                    strokeColor="#0ea5e9"
                    railColor="#f1f5f9"
                    showInfo={false}
                    style={{ marginBottom: '16px' }}
                  />

                  <div className="d-flex justify-content-between align-items-center">
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                      Overall throughput
                    </div>
                    <a href="/actions" style={{ fontSize: '11px', fontWeight: 700, color: '#4f46e5', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      Drill Down <ArrowRight size={12} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Final Row - Live Streams and Detail Intel */}
      <div className="row g-3 mb-3">
        {/* Alerts Feed */}
        <motion.div variants={itemVariants} className="col-lg-4">
          <div style={{ ...premiumCardStyle, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="px-4 py-3 border-bottom d-flex align-items-center gap-2">
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444' }} className="pulse-dot"></div>
              <h6 className="mb-0 fw-bold text-slate-800" style={{ fontSize: '14px' }}>Live Event Matrix</h6>
            </div>
            <div className="p-3 flex-grow-1" style={{ maxHeight: '320px', overflowY: 'auto' }}>
              <div className="d-grid gap-2">
                {data.alerts.length > 0 ? data.alerts.map((alert, i) => (
                  <motion.div
                    key={alert.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #f1f5f9',
                      padding: '12px',
                      borderRadius: '12px',
                      display: 'flex',
                      gap: '12px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '8px',
                      backgroundColor: alert.type === 'critical' ? '#fef2f2' : '#fffbeb',
                      color: alert.type === 'critical' ? '#ef4444' : '#f59e0b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}>
                      <AlertTriangle size={12} strokeWidth={3} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p className="mb-0 text-slate-800" style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.4 }}>{alert.message}</p>
                      <div className="d-flex justify-content-between mt-1" style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8' }}>
                        <span style={{ color: alert.type === 'critical' ? '#ef4444' : '#d97706' }}>{alert.type?.toUpperCase()}</span>
                        <span>{alert.time || 'Just now'}</span>
                      </div>
                    </div>
                  </motion.div>
                )) : (
                  <div className="d-flex flex-column align-items-center justify-content-center py-5 text-center">
                    <CheckCircle2 size={32} style={{ color: '#10b981', opacity: 0.4, marginBottom: '12px' }} />
                    <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>Satellite systems nominal</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Ads & Processes Split */}
        <div className="col-lg-8">
          <div className="row g-3">
            {/* Advanced Ads Gauge */}
            <motion.div variants={itemVariants} className="col-md-6">
              <div style={{ ...premiumCardStyle, height: '100%', padding: '20px' }}>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <Target size={16} style={{ color: '#8b5cf6' }} strokeWidth={2.5} />
                  <h6 className="mb-0 fw-bold text-slate-800" style={{ fontSize: '14px' }}>Advertising Intelligence</h6>
                </div>

                <div className="p-3 rounded-3 mb-3" style={{ background: 'linear-gradient(135deg, #4f46e5, #3730a3)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.1 }}><Target size={100} /></div>
                  <div style={{ fontSize: '11px', opacity: 0.8, fontWeight: 700, letterSpacing: '0.05em' }}>ESTIMATED ROAS</div>
                  <div className="d-flex align-items-baseline gap-1 mt-1">
                    <h3 className="mb-0 fw-bolder" style={{ fontSize: '32px', letterSpacing: '-0.02em' }}>{data.roas || '0.00'}</h3>
                    <span style={{ fontSize: '16px', fontWeight: 700, opacity: 0.8 }}>x</span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Ad Spend Velocity</span>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>₹{Number(data.dailySpend || 0).toLocaleString()} / day</span>
                  </div>
                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} style={{ height: '100%', background: '#8b5cf6' }} />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Active Operations Stream */}
            <motion.div variants={itemVariants} className="col-md-6">
              <div style={{ ...premiumCardStyle, height: '100%', padding: '20px' }}>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <Zap size={16} style={{ color: '#f59e0b' }} strokeWidth={2.5} />
                  <h6 className="mb-0 fw-bold text-slate-800" style={{ fontSize: '14px' }}>Sync Pipeline</h6>
                </div>
                <div className="d-flex flex-column gap-2">
                  {[
                    { name: 'Dynamic Competitor Scrape', status: 'Active', p: 65, color: '#3b82f6' },
                    { name: 'Inventory Reconciliation', status: 'Queued', p: 0, color: '#94a3b8' },
                    { name: 'Rules Evaluator engine', status: 'SyncComplete', p: 100, color: '#10b981' },
                    { name: 'Ads Reporting Pipeline', status: 'Active', p: 30, color: '#3b82f6' },
                  ].map((op, i) => (
                    <div key={i} style={{ padding: '10px 12px', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px' }}>
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <Text strong style={{ fontSize: '11px', color: '#334155' }}>{op.name}</Text>
                      </div>
                      <Progress
                        percent={op.p}
                        strokeColor={op.color}
                        size={[null, 4]}
                        showInfo={true}
                        format={p => <span style={{ fontSize: '9px', fontWeight: 800, color: op.color }}>{p}%</span>}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Leaderboard / Top Product Table */}
      <motion.div variants={itemVariants} className="row g-3">
        <div className="col-12">
          <div style={premiumCardStyle}>
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center" style={{ background: '#ffffff' }}>
              <div className="d-flex align-items-center gap-2">
                <div style={{ color: '#0f172a' }}><FileBarChart size={18} strokeWidth={2} /></div>
                <h6 className="mb-0 fw-bold text-slate-800" style={{ fontSize: '14px' }}>ASIN Velocity Grid</h6>
              </div>
            </div>
            <div className="p-0 custom-antd-table-container">
              <Table
                columns={tableColumns}
                dataSource={data.topProducts}
                rowKey={(record) => record.asin + record.sku}
                scroll={{ x: 'max-content' }}
                pagination={{ pageSize: 5, hideOnSinglePage: true, size: 'small' }}
                size="middle"
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={<span style={{ fontWeight: 600, fontSize: '13px', color: '#94a3b8' }}>Grid structure awaiting throughput</span>}
                    />
                  )
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Inline Styles for Pulse Animation and Antd overrides */}
      <style>{`
        .pulse-dot {
          animation: pulse-red 2s infinite;
        }
        @keyframes pulse-red {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        .custom-antd-table-container .ant-table-thead .ant-table-cell {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding-top: 12px;
          padding-bottom: 12px;
        }
        .custom-antd-table-container .ant-table {
          border-radius: 0 0 20px 20px;
        }
      `}</style>
    </motion.div>
  );
};

export default Dashboard;