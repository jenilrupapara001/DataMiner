// pages/Dashboard.jsx
import React, {
  useState, useCallback, useMemo,
  Suspense, lazy, useEffect, useRef
} from 'react';
import { motion } from 'framer-motion';
import {
  Row, Col, Card, Button, Tag, Space,
  Typography, Tooltip, Empty, Badge,
  Divider, Switch, Modal, Select, Skeleton
} from 'antd';
import {
  TrendingUp, Package, RefreshCw, IndianRupee,
  ShoppingBag, Zap, Target, FileBarChart,
  Settings, PieChart, Activity, Sparkles,
  AlertCircle, Store, Trophy
} from 'lucide-react';
import { format } from 'date-fns';

const Chart = lazy(() => import('react-apexcharts'));

import api from '../services/api';
import { db } from '../services/db';
import { SkeletonChart } from '../components/common/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useRefresh } from '../contexts/RefreshContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDashboardOrchestration } from '../hooks/useDashboardOrchestration';
import { useSocket } from '../contexts/SocketContext';

const { Text, Title } = Typography;

// Helper to format timestamps for activity logs
function formatLogTime(dateString) {
  if (!dateString) return 'Now';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Now';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// Helper to get alert card colors based on system log types
const getAlertColor = (type = '') => {
  const t = String(type).toUpperCase();
  if (t.includes('ERROR') || t.includes('FAILURE') || t === 'DELETE') return '#ef4444';
  if (t === 'UPDATE' || t.includes('STATUS')) return '#f97316';
  if (t === 'CREATE' || t.includes('SUCCESS') || t === 'IMPORT') return '#10b981';
  return '#3b82f6';
};

// Sparkline renderer for clean visual indicators
const Sparkline = ({ data, color }) => {
  const width = 240;
  const height = 30;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((val, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return { x, y };
  });

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

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const cardStyle = {
  borderRadius: '12px',
  border: '1px solid #f1f5f9',
  background: '#ffffff',
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
  height: '100%',
  overflow: 'hidden'
};

const Dashboard = () => {
  const { isGlobalUser } = useAuth();
  const { startDate, endDate, rangeType } = useDateRange();
  const { refreshCount } = useRefresh();
  const { setPageTitle } = usePageTitle();

  useEffect(() => { setPageTitle('Market Intelligence'); }, [setPageTitle]);

  const [sellers, setSellers] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState('all');
  const [activityLogs, setActivityLogs] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await api.sellerApi.getAll({ page: 1, limit: 100 });
        if (controller.signal.aborted) return;
        const list = res?.data?.sellers || res?.sellers || (Array.isArray(res) ? res : []);
        setSellers(list);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error('[Dashboard] Failed to fetch sellers:', err);
        }
      }
    })();
    return () => controller.abort();
  }, []);

  const orch = useDashboardOrchestration({
    sellerId: selectedSellerId,
    startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
    endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    period: rangeType
  });

  const refetchRef = useRef(orch.refetch);
  useEffect(() => { refetchRef.current = orch.refetch; });

  useEffect(() => {
    if (refreshCount > 0) refetchRef.current?.();
  }, [refreshCount]);

  // Load live activity logs for Recent Alerts
  const loadLiveLogs = useCallback(async () => {
    try {
      const data = await db.getSystemLogs();
      if (Array.isArray(data)) {
        const normalized = data.slice(0, 5).map(log => ({
          title: log.EntityTitle || log.entityTitle || 'System Activity',
          subtitle: log.Description || log.description || 'Action performed on the system.',
          time: formatLogTime(log.CreatedAt || log.createdAt),
          color: getAlertColor(log.Type || log.type)
        }));
        setActivityLogs(normalized);
      }
    } catch (err) {
      console.error('Failed to load system logs for dashboard', err);
    }
  }, []);

  const socket = useSocket();

  useEffect(() => {
    loadLiveLogs();
    const interval = setInterval(loadLiveLogs, 30000);
    return () => clearInterval(interval);
  }, [loadLiveLogs]);

  useEffect(() => {
    if (!socket) return;
    const handleNewSystemLog = (log) => {
      setActivityLogs(prev => {
        const item = {
          title: log.EntityTitle || log.entityTitle || 'System Activity',
          subtitle: log.Description || log.description || 'Action performed on the system.',
          time: 'Now',
          color: getAlertColor(log.Type || log.type)
        };
        return [item, ...prev].slice(0, 5);
      });
    };
    socket.on('new_system_log', handleNewSystemLog);
    return () => socket.off('new_system_log', handleNewSystemLog);
  }, [socket]);

  const kpisRaw = useMemo(() => Array.isArray(orch.kpis) ? orch.kpis : [], [orch.kpis]);
  const topProducts = useMemo(() => Array.isArray(orch.topProducts) ? orch.topProducts : [], [orch.topProducts]);

  // Dynamic KPI calculations from database raw series
  const adSalesVal = useMemo(() => {
    const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
    const data = adsPerf[0]?.data || [];
    return data.reduce((a, b) => a + b, 0);
  }, [orch.dashboardRaw]);

  const adSpendVal = useMemo(() => {
    const adsPerf = orch.dashboardRaw?.adsPerformanceSeries || [];
    const data = adsPerf[1]?.data || [];
    return data.reduce((a, b) => a + b, 0);
  }, [orch.dashboardRaw]);

  const totalOrdersVal = useMemo(() => {
    const kpis = orch.dashboardRaw?.kpi || [];
    return kpis[0]?.trend || 8420;
  }, [orch.dashboardRaw]);

  const dynamicAcos = useMemo(() => {
    if (adSalesVal > 0) {
      return ((adSpendVal / adSalesVal) * 100).toFixed(1);
    }
    // Fallback if sales is 0 but we have spend (100% or more) or mock default
    if (adSpendVal > 0) return '100.0';
    return '18.2';
  }, [adSalesVal, adSpendVal]);

  const getKpiValue = (index, defaultVal) => {
    if (index === 0 && adSalesVal > 0) return `₹${adSalesVal.toLocaleString('en-IN')}`;
    if (index === 1 && totalOrdersVal !== 8420) return totalOrdersVal.toLocaleString('en-IN');
    if (index === 2) return `${dynamicAcos}%`;
    if (index === 3 && totalOrdersVal !== 8420) return Math.round(totalOrdersVal * 1.48).toLocaleString('en-IN');

    if (kpisRaw && kpisRaw[index]) {
      return kpisRaw[index].value;
    }
    return defaultVal;
  };

  const getKpiTrend = (index, defaultTrend) => {
    if (kpisRaw && kpisRaw[index]) {
      const kpi = kpisRaw[index];
      const sign = kpi.trendType === 'positive' ? '+' : kpi.trendType === 'negative' ? '-' : '';
      return `${sign}${kpi.trend}% vs prior`;
    }
    return defaultTrend;
  };

  const isPositiveTrend = (index, defaultVal) => {
    if (kpisRaw && kpisRaw[index]) {
      return kpisRaw[index].trendType === 'positive';
    }
    return defaultVal;
  };

  // Dynamic Top ASINs mapping with mockup fallbacks
  const displayAsins = useMemo(() => {
    const mockAsins = [
      { title: 'Copper Bottle 1L', subtitle: 'B0C9X1A2IN · Ayur Life', lqs: 91, cdq: 87 },
      { title: 'Yoga Mat Pro', subtitle: 'B0B7M9K3IN · FlexWell', lqs: 76, cdq: 82 },
      { title: 'Kitchen Storage Set', subtitle: 'B09N2Q8DIN · HomeStack', lqs: 63, cdq: 71 },
      { title: 'LED Study Lamp', subtitle: 'B0D1P554IN · BrightDesk', lqs: 88, cdq: 91 }
    ];

    const result = [];
    for (let i = 0; i < 4; i++) {
      if (topProducts && topProducts[i]) {
        const p = topProducts[i];
        result.push({
          title: p.title || 'Unknown Product',
          subtitle: `${p.asin || ''} · ${p.sku || ''}`,
          lqs: p.lqs || 85,
          cdq: p.cdq || 80
        });
      } else {
        result.push(mockAsins[i]);
      }
    }
    return result;
  }, [topProducts]);

  // Dynamic Alerts list backed by live activity logs
  const displayAlerts = useMemo(() => {
    const mockAlerts = [
      { title: 'Low inventory risk', subtitle: 'B08P6T2LIN · Inventory < 45 units', time: 'Now', color: '#ef4444' },
      { title: 'ACoS crossed guardrail', subtitle: 'Yoga Mat Pro · ACoS > 28% for 3 days', time: '18m', color: '#f97316' },
      { title: 'New competitor ASIN found', subtitle: 'Copper Bottle 1L · Keepa discovery', time: '1h', color: '#3b82f6' }
    ];

    if (activityLogs.length > 0) {
      return activityLogs;
    }
    return mockAlerts;
  }, [activityLogs]);

  // Dynamic Chart Date-wise resolution
  const chartLabels = useMemo(() => {
    if (orch.dashboardRaw?.labels && orch.dashboardRaw.labels.length > 0) {
      return orch.dashboardRaw.labels;
    }
    return ['01 Jun', '02 Jun', '03 Jun', '04 Jun', '05 Jun', '06 Jun', '07 Jun'];
  }, [orch.dashboardRaw]);

  const dynamicSalesTrendSeries = useMemo(() => {
    const defaultRevenue = [650000, 750000, 800000, 780000, 910000, 980000, 990000];
    const defaultSpend = [180000, 190000, 210000, 200000, 220000, 230000, 240000];

    const revenueData = orch.dashboardRaw?.stackedBarSeries?.[0]?.data || 
                        orch.dashboardRaw?.adsPerformanceSeries?.[0]?.data || 
                        defaultRevenue;

    const spendData = orch.dashboardRaw?.adsPerformanceSeries?.[1]?.data || 
                      defaultSpend;

    return [
      {
        name: 'Revenue',
        data: revenueData
      },
      {
        name: 'Ad Spend',
        data: spendData
      }
    ];
  }, [orch.dashboardRaw]);

  // Chart configuration for Sales Trend
  const salesTrendChartOptions = {
    chart: {
      type: 'line',
      toolbar: { show: false },
      sparkline: { enabled: false },
      fontFamily: 'Inter, sans-serif'
    },
    stroke: {
      curve: 'smooth',
      width: [3, 2]
    },
    colors: ['#3b82f6', '#818cf8'],
    xaxis: {
      categories: chartLabels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 }
      }
    },
    yaxis: {
      labels: {
        style: { colors: '#94a3b8', fontSize: '11px', fontWeight: 500 },
        formatter: (val) => val === 0 ? '0' : val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val
      }
    },
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    legend: { show: false },
    tooltip: { theme: 'light' }
  };

  const [skeletonTimeout, setSkeletonTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSkeletonTimeout(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const showSkeleton = (orch.isLoadingKpis || !orch.isHydrated) && !skeletonTimeout;

  if (showSkeleton) {
    return (
      <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space direction="vertical" size={2}>
            <Skeleton.Input active size="large" style={{ width: 220, height: 32 }} />
            <Skeleton.Input active size="small" style={{ width: 320, height: 16 }} />
          </Space>
        </div>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <Col key={i} xs={24} sm={12} md={6}>
              <Card style={{ borderRadius: 12, border: '1px solid #f1f5f9', padding: 8 }}>
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
      style={{ padding: '32px', background: '#f8fafc', minHeight: '100vh' }}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: '28px'
      }}>
        <div>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#64748b',
            display: 'block'
          }}>
            MISSION CONTROL
          </span>
          <Title level={1} style={{
            margin: '4px 0 0',
            fontWeight: 700,
            fontSize: '26px',
            color: '#0f172a',
            letterSpacing: '-0.02em'
          }}>
            Marketplace health, execution, and risk
          </Title>
        </div>
        
        <Button 
          type="primary"
          onClick={() => orch.forceRefresh?.()}
          loading={orch.isLoadingKpis}
          style={{
            background: '#2563eb',
            borderColor: '#2563eb',
            borderRadius: '6px',
            fontWeight: 600,
            height: '36px',
            fontSize: '13px'
          }}
        >
          Run sync
        </Button>
      </div>

      {/* ── KPI Row ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* Card 1: Revenue */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Revenue</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>
                {getKpiValue(0, '₹1.2Cr')}
              </span>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: isPositiveTrend(0, true) ? '#10b981' : '#ef4444' 
              }}>
                {getKpiTrend(0, '+12.4% vs prior')}
              </span>
            </div>
            <Sparkline data={[30, 40, 35, 50, 49, 60, 70, 91, 125]} color="#3b82f6" />
          </Card>
        </Col>

        {/* Card 2: Orders */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Orders</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>
                {getKpiValue(1, '8,420')}
              </span>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: isPositiveTrend(1, true) ? '#10b981' : '#ef4444' 
              }}>
                {getKpiTrend(1, '+8.1% vs prior')}
              </span>
            </div>
            <Sparkline data={[50, 45, 60, 55, 70, 65, 80, 85, 95]} color="#3b82f6" />
          </Card>
        </Col>

        {/* Card 3: ACoS */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>ACoS</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>
                {getKpiValue(2, '18.2%')}
              </span>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: isPositiveTrend(2, false) ? '#10b981' : '#ef4444' 
              }}>
                {getKpiTrend(2, '-2.7% vs prior')}
              </span>
            </div>
            <Sparkline data={[70, 65, 60, 50, 55, 45, 40, 35, 30]} color="#3b82f6" />
          </Card>
        </Col>

        {/* Card 4: Units Sold */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Units Sold</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, color: '#0f172a' }}>
                {getKpiValue(3, '12.5k')}
              </span>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: isPositiveTrend(3, true) ? '#10b981' : '#ef4444' 
              }}>
                {getKpiTrend(3, '+15.8% vs prior')}
              </span>
            </div>
            <Sparkline data={[20, 30, 25, 40, 35, 50, 45, 60, 75]} color="#3b82f6" />
          </Card>
        </Col>
      </Row>

      {/* ── Middle Row ── */}
      <Row gutter={[20, 20]} style={{ marginBottom: '24px' }}>
        {/* Sales Trend Line Chart */}
        <Col xs={24} lg={16}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Sales Trend</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Revenue, ad spend, and order context</span>
              </div>
            }
            style={cardStyle}
          >
            <Suspense fallback={<SkeletonChart height={250} />}>
              <Chart options={salesTrendChartOptions} series={dynamicSalesTrendSeries} type="line" height={250} />
            </Suspense>
          </Card>
        </Col>

        {/* Top ASINs List */}
        <Col xs={24} lg={8}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Top ASINs</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Quality, inventory, and trend signals</span>
              </div>
            }
            style={cardStyle}
            styles={{ body: { padding: '8px 24px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayAsins.map((asin, index) => (
                <div 
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: index < displayAsins.length - 1 ? '1px solid #f1f5f9' : 'none'
                  }}
                >
                  <div>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                      {asin.title}
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {asin.subtitle}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>
                      LQS {asin.lqs}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb' }}>
                      CDQ {asin.cdq}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Bottom Row ── */}
      <Row gutter={[20, 20]}>
        {/* Recent Alerts Column */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Recent Alerts</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Rules requiring operator attention</span>
              </div>
            }
            style={cardStyle}
            styles={{ body: { padding: '16px 24px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {displayAlerts.map((alert, index) => (
                <div 
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '14px 16px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${alert.color}`
                  }}
                >
                  <div>
                    <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                      {alert.title}
                    </span>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {alert.subtitle}
                    </span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                    {alert.time}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* Quick Actions Column */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Quick Actions</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Templates for recurring execution</span>
              </div>
            }
            style={cardStyle}
            styles={{ body: { padding: '20px 24px' } }}
          >
            {/* Grid of buttons */}
            <Row gutter={[12, 12]} style={{ marginBottom: '20px' }}>
              {[
                { label: 'Create Task', icon: Target },
                { label: 'Upload Report', icon: FileBarChart },
                { label: 'Generate Image', icon: Zap },
                { label: 'Preview 4-week Plan', icon: TrendingUp }
              ].map((btn, idx) => (
                <Col span={12} key={idx}>
                  <Button 
                    block
                    style={{
                      height: '42px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      fontWeight: 600,
                      color: '#334155',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <btn.icon size={15} style={{ color: '#64748b' }} />
                    {btn.label}
                  </Button>
                </Col>
              ))}
            </Row>

            {/* Running Tasks list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Task 1 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff'
              }}>
                <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>
                  Refresh parent ASIN report
                </span>
                <Tag 
                  color="processing"
                  style={{
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: 'none',
                    fontWeight: 600,
                    borderRadius: '12px',
                    fontSize: '11px',
                    padding: '2px 10px',
                    margin: 0
                  }}
                >
                  In progress
                </Tag>
              </div>

              {/* Task 2 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff'
              }}>
                <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#334155' }}>
                  Generate AI lifestyle image set
                </span>
                <Tag 
                  style={{
                    background: '#f1f5f9',
                    color: '#64748b',
                    border: 'none',
                    fontWeight: 600,
                    borderRadius: '12px',
                    fontSize: '11px',
                    padding: '2px 10px',
                    margin: 0
                  }}
                >
                  Queued
                </Tag>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </motion.div>
  );
};

export default Dashboard;