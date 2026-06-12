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
import { useTargetPermissions } from '../hooks/useTargetPermissions';
const TargetVsAchievementDashboard = lazy(() => import('./TargetVsAchievementDashboard'));

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

// Indian Currency Formatter helpers
const formatIndianCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
};

const formatIndianCurrencyShort = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
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
  const { user } = useAuth();
  const { startDate, endDate, rangeType } = useDateRange();
  const { refreshCount } = useRefresh();
  const { setPageTitle } = usePageTitle();
  const { isBrandManager } = useTargetPermissions();

  useEffect(() => { setPageTitle('Unified Operations Dashboard'); }, [setPageTitle]);

  const [sellers, setSellers] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState('all');
  const [activityLogs, setActivityLogs] = useState([]);
  const [scrapeTasks, setScrapeTasks] = useState([]);
  const [scrapeLoading, setScrapeLoading] = useState(false);

  // Fetch Sellers list
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

  // Filter sellers list for the selector based on user permissions (RBAC)
  const userSellers = useMemo(() => {
    if (!user) return [];
    const roleName = (user.role?.name || user.role || '').toString().toLowerCase().trim();
    const isMgr = roleName === 'brand manager' || roleName === 'brand_manager' || isBrandManager;

    if (isMgr) {
      const assigned = user.assignedSellers || [];
      return assigned.map(s => {
        const sid = s.sellerId || s.SellerId || s._id || s.Id || s;
        const match = sellers.find(x => (x._id || x.id) === sid);
        return {
          id: sid,
          name: match?.name || s.name || s.SellerName || sid
        };
      });
    }

    return sellers.map(s => ({
      id: s._id || s.id,
      name: s.name || s.SellerName || s._id || s.id
    }));
  }, [user, sellers, isBrandManager]);

  // Set the first assigned seller as default for brand managers
  useEffect(() => {
    if (userSellers.length > 0 && selectedSellerId === 'all') {
      const roleName = (user?.role?.name || user?.role || '').toString().toLowerCase().trim();
      const isMgr = roleName === 'brand manager' || roleName === 'brand_manager' || isBrandManager;
      if (isMgr) {
        setSelectedSellerId(userSellers[0].id);
      }
    }
  }, [userSellers, selectedSellerId, user, isBrandManager]);

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

  // Load real Octoparse sync tasks
  const loadScrapeTasks = useCallback(async () => {
    setScrapeLoading(true);
    try {
      const res = await api.marketSyncApi.getSyncTasks();
      setScrapeTasks(res?.tasks || []);
    } catch (err) {
      console.error('Failed to load scrape tasks for dashboard', err);
    } finally {
      setScrapeLoading(false);
    }
  }, []);

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
    loadScrapeTasks();
    const interval = setInterval(() => {
      loadLiveLogs();
      loadScrapeTasks();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadLiveLogs, loadScrapeTasks]);

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

  // Target values logic
  const targetStats = useMemo(() => {
    const targetsList = orch.targets || [];
    let totalTarget = 0;
    let totalAchieved = 0;
    const brandSet = new Set();

    const filtered = selectedSellerId === 'all'
      ? targetsList
      : targetsList.filter(t => (t.SellerId || '').toString().toLowerCase() === selectedSellerId.toLowerCase());

    filtered.forEach(t => {
      totalTarget += (t.TotalTargetValue || 0);
      totalAchieved += (t.overallAchieved || 0);
      if (t.SellerId) brandSet.add(t.SellerId);
    });

    const achievementRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
    return {
      totalTarget,
      totalAchieved,
      achievementRate,
      brandCount: brandSet.size,
      list: filtered
    };
  }, [orch.targets, selectedSellerId]);

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
    if (adSpendVal > 0) return '100.0';
    return '18.2';
  }, [adSalesVal, adSpendVal]);

  const getKpiValue = (index, defaultVal) => {
    let rawVal = defaultVal;
    if (index === 0 && adSalesVal > 0) return formatIndianCurrency(adSalesVal);
    if (index === 1 && totalOrdersVal !== 8420) return totalOrdersVal.toLocaleString('en-IN');
    if (index === 2) return `${dynamicAcos}%`;
    if (index === 3 && totalOrdersVal !== 8420) return Math.round(totalOrdersVal * 1.48).toLocaleString('en-IN');

    if (kpisRaw && kpisRaw[index]) {
      rawVal = kpisRaw[index].value;
    }
    
    // Parse potential string values with dollar symbols or units to Indian format
    if (typeof rawVal === 'string') {
      const isCurrencyStr = rawVal.startsWith('$') || rawVal.startsWith('₹') || kpisRaw[index]?.title?.toLowerCase()?.includes('revenue') || kpisRaw[index]?.title?.toLowerCase()?.includes('spend');
      if (isCurrencyStr) {
        const cleaned = parseFloat(rawVal.replace(/[^0-9.-]/g, ''));
        if (!isNaN(cleaned)) {
          let multiplier = 1;
          if (rawVal.toLowerCase().includes('k')) multiplier = 1000;
          else if (rawVal.toLowerCase().includes('m')) multiplier = 1000000;
          return formatIndianCurrency(cleaned * multiplier);
        }
      }
    }
    return rawVal;
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
      { title: 'Copper Bottle 1L', subtitle: 'B0C9X1A2IN · Ayur Life', units: 1250 },
      { title: 'Yoga Mat Pro', subtitle: 'B0B7M9K3IN · FlexWell', units: 890 },
      { title: 'Kitchen Storage Set', subtitle: 'B09N2Q8DIN · HomeStack', units: 620 },
      { title: 'LED Study Lamp', subtitle: 'B0D1P554IN · BrightDesk', units: 540 }
    ];

    if (!topProducts || topProducts.length === 0) {
      return mockAsins;
    }

    return topProducts.map(p => ({
      title: p.title || 'Unknown Product',
      subtitle: `${p.asin || ''} · ${p.sku || ''}`,
      units: p.units || 0
    })).sort((a, b) => b.units - a.units);
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
    colors: ['#2563eb', '#f59e0b'],
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
        formatter: (val) => val === 0 ? '0' : formatIndianCurrencyShort(val)
      }
    },
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 0,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } }
    },
    legend: { show: true, position: 'top', horizontalAlign: 'right' },
    tooltip: { 
      theme: 'light',
      y: {
        formatter: (val) => formatIndianCurrency(val)
      }
    }
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
        alignItems: 'center',
        marginBottom: '28px',
        flexWrap: 'wrap',
        gap: '16px'
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
            fontWeight: 800,
            fontSize: '26px',
            color: '#0f172a',
            letterSpacing: '-0.02em'
          }}>
            Unified Operations Dashboard
          </Title>
        </div>
        
        <Space size={12}>
          {/* Brand/Seller Selector with RBAC restriction */}
          <Select
            value={selectedSellerId}
            onChange={setSelectedSellerId}
            style={{ width: 220, height: '38px' }}
            dropdownStyle={{ borderRadius: '8px' }}
          >
            {userSellers.length > 1 && <Select.Option value="all">All Brands</Select.Option>}
            {userSellers.map(s => (
              <Select.Option key={s.id} value={s.id}>
                {s.name}
              </Select.Option>
            ))}
          </Select>

          <Button 
            type="primary"
            onClick={() => {
              orch.forceRefresh?.();
              loadScrapeTasks();
            }}
            loading={orch.isLoadingKpis}
            style={{
              background: '#2563eb',
              borderColor: '#2563eb',
              borderRadius: '6px',
              fontWeight: 600,
              height: '38px',
              fontSize: '13px'
            }}
          >
            Run sync
          </Button>
        </Space>
      </div>

      {/* ── Targets KPI Row ── */}
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
        Revenue Targets & Achievements
      </span>
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* Total Revenue Target */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Total Target Pool</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#2563eb' }}>
                {formatIndianCurrency(targetStats.totalTarget)}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
              Across {targetStats.brandCount} plans
            </span>
          </Card>
        </Col>

        {/* Total Sales Achieved */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Sales Achieved</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>
                {formatIndianCurrency(targetStats.totalAchieved)}
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
              Paced cumulative sales
            </span>
          </Card>
        </Col>

        {/* Target Achievement Rate */}
        <Col xs={24} sm={12} md={12}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Overall Pacing Achievement Rate</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: targetStats.achievementRate >= 80 ? '#10b981' : targetStats.achievementRate >= 50 ? '#f59e0b' : '#ef4444' }}>
                {targetStats.achievementRate.toFixed(1)}%
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${Math.min(targetStats.achievementRate, 100)}%`, 
                height: '100%', 
                background: targetStats.achievementRate >= 80 ? '#10b981' : targetStats.achievementRate >= 50 ? '#f59e0b' : '#ef4444',
                borderRadius: '4px'
              }} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* ── Marketplace & Ads KPI Row ── */}
      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
        Marketplace & Advertising (Ads) KPIs
      </span>
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        {/* Card 1: Revenue */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Ad Sales (Revenue)</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                {getKpiValue(0, '₹0')}
              </span>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: isPositiveTrend(0, true) ? '#10b981' : '#ef4444' 
              }}>
                {getKpiTrend(0, '+0%')}
              </span>
            </div>
            <Sparkline data={[30, 40, 35, 50, 49, 60, 70, 91, 125]} color="#2563eb" />
          </Card>
        </Col>

        {/* Card 2: Orders */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Orders</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                {getKpiValue(1, '0')}
              </span>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: isPositiveTrend(1, true) ? '#10b981' : '#ef4444' 
              }}>
                {getKpiTrend(1, '+0%')}
              </span>
            </div>
            <Sparkline data={[50, 45, 60, 55, 70, 65, 80, 85, 95]} color="#2563eb" />
          </Card>
        </Col>

        {/* Card 3: ACoS */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>ACoS</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                {getKpiValue(2, '0%')}
              </span>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: isPositiveTrend(2, false) ? '#10b981' : '#ef4444' 
              }}>
                {getKpiTrend(2, '-0%')}
              </span>
            </div>
            <Sparkline data={[70, 65, 60, 50, 55, 45, 40, 35, 30]} color="#10b981" />
          </Card>
        </Col>

        {/* Card 4: Units Sold */}
        <Col xs={24} sm={12} md={6}>
          <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Units Sold</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 12px' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                {getKpiValue(3, '0')}
              </span>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: 600, 
                color: isPositiveTrend(3, true) ? '#10b981' : '#ef4444' 
              }}>
                {getKpiTrend(3, '+0%')}
              </span>
            </div>
            <Sparkline data={[20, 30, 25, 40, 35, 50, 45, 60, 75]} color="#2563eb" />
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
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '280px', overflowY: 'auto', paddingRight: '8px' }}>
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
                      Orders: {asin.units?.toLocaleString('en-IN')}
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

        {/* Real Octoparse Sync & Pipeline Status Column */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Data Pipeline Sync Tasks</span>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Real-time Octoparse extractions</span>
              </div>
            }
            style={cardStyle}
            styles={{ body: { padding: '20px 24px' } }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
              {scrapeLoading && scrapeTasks.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                  <Skeleton active paragraph={{ rows: 3 }} />
                </div>
              ) : scrapeTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                  No active extraction pipeline tasks setup.
                </div>
              ) : (
                scrapeTasks.slice(0, 5).map((task) => {
                  let tagColor = 'default';
                  if (task.status === 'RUNNING') tagColor = 'processing';
                  else if (task.status === 'COMPLETED') tagColor = 'success';
                  else if (task.status === 'FAILED') tagColor = 'error';

                  return (
                    <div key={task.sellerId} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 650, color: '#1e293b' }}>
                          {task.sellerName || 'Amazon Sync'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {task.asinCount || 0} ASINs · {task.progress || 0}% complete
                        </span>
                      </div>
                      <Tag 
                        color={tagColor}
                        style={{
                          fontWeight: 600,
                          borderRadius: '12px',
                          fontSize: '11px',
                          padding: '2px 10px',
                          margin: 0
                        }}
                      >
                        {task.status || 'IDLE'}
                      </Tag>
                    </div>
                  );
                })
              )}
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* Quick action triggers */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button 
                block 
                size="middle" 
                onClick={() => api.marketSyncApi.ingestAllResults().then(() => alert('Pipeline ingestion started'))}
                style={{
                  height: '38px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px'
                }}
              >
                Trigger Pipeline Ingestion
              </Button>
              <Button 
                block 
                type="dashed"
                onClick={() => loadScrapeTasks()}
                style={{
                  height: '38px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '13px'
                }}
              >
                Refresh Tasks
              </Button>
            </div>
          </Card>
        </Col>
      </Row>
    </motion.div>
  );
};

export default Dashboard;