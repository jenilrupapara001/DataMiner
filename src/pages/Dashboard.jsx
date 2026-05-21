// pages/Dashboard.tsx — fully fixed

import React, {
  useState, useCallback, useMemo,
  Suspense, lazy, useEffect, useRef
} from 'react';
import { motion } from 'framer-motion';
import {
  Row, Col, Card, Table, Button, Tag, Space,
  Typography, Tooltip, Empty, Badge,
  Divider, Switch, Modal, Select, Tabs, Skeleton
} from 'antd';
import {
  TrendingUp, Package, RefreshCw, IndianRupee,
  ShoppingBag, Zap, Target, FileBarChart,
  Settings, PieChart, Activity, Sparkles,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

const Chart = lazy(() => import('react-apexcharts'));

import api from '../services/api';
import { SkeletonChart } from '../components/common/Skeleton';
import { useAuth } from '../contexts/AuthContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useRefresh } from '../contexts/RefreshContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useDashboardOrchestration } from '../hooks/useDashboardOrchestration';

const { Text, Title } = Typography;

// ─── Fix 1: move pure helpers OUTSIDE component ───────────────────────────────
// syncDisplayLabel was defined AFTER the component — hoisting bug in strict mode

function syncDisplayLabel(status) {
  switch (status) {
    case 'connected': return 'Active Network Stream';
    case 'reconnecting': return 'Reconnecting…';
    default: return 'Cached / Offline';
  }
}

function getKpiTheme(title) {
  const t = title.toLowerCase();
  if (t.includes('sales')) return { color: '#6366f1', bg: '#f5f3ff', border: '#e0e7ff', icon: ShoppingBag };
  if (t.includes('spend')) return { color: '#3b82f6', bg: '#eff6ff', border: '#dbeafe', icon: IndianRupee };
  if (t.includes('asin')) return { color: '#10b981', bg: '#ecfdf5', border: '#d1fae5', icon: Package };
  return { color: '#f59e0b', bg: '#fef3c7', border: '#fef3c7', icon: TrendingUp };
}

// ─── Animation variants (outside component — never recreated) ─────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 120, damping: 20 } }
};

const cardStyle = {
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  boxShadow: '0 4px 18px -4px rgba(15,23,42,0.05), 0 1px 3px rgba(15,23,42,0.02)',
  height: '100%',
  overflow: 'hidden',
  transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)'
};

// ─── Default layout ───────────────────────────────────────────────────────────

const DEFAULT_LAYOUT = [
  { id: 'kpi', label: 'KPI Scorecards', enabled: true, order: 1, span: 24 },
  { id: 'charts', label: 'Performance Analytics Chart', enabled: true, order: 2, span: 24 },
  { id: 'satellite', label: 'Quick Navigation Links', enabled: true, order: 3, span: 24 },
  { id: 'velocity', label: 'Product Velocity Matrix', enabled: true, order: 4, span: 24 },
];

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const { isGlobalUser } = useAuth();
  const { startDate, endDate, rangeType } = useDateRange();
  const { refreshCount } = useRefresh();
  const { setPageTitle } = usePageTitle();

  useEffect(() => { setPageTitle('Market Intelligence'); }, [setPageTitle]);

  // ── Sellers ────────────────────────────────────────────────────────────
  const [sellers, setSellers] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState('all');

  useEffect(() => {
    // ✅ Fix 4: AbortController for cleanup — prevents memory leak
    const controller = new AbortController();

    (async () => {
      try {
        const res = await api.sellerApi.getAll({ page: 1, limit: 100 });
        if (controller.signal.aborted) return;
        const list =
          res?.data?.sellers ||
          res?.sellers ||
          (Array.isArray(res) ? res : []);
        setSellers(list);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error('[Dashboard] Failed to fetch sellers:', err);
        }
      }
    })();

    return () => controller.abort();
  }, []);

  // ── Layout state ───────────────────────────────────────────────────────
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [layout, setLayout] = useState(() => {
    try {
      const saved = localStorage.getItem('retailops_dashboard_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Invalidate stale layout versions
        if (!parsed.some(p => p.id === 'kpi')) {
          localStorage.removeItem('retailops_dashboard_layout');
          return DEFAULT_LAYOUT;
        }
        return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_LAYOUT;
  });

  // ✅ Fix 9: all layout handlers wrapped in useCallback
  const saveLayout = useCallback(newLayout => {
    setLayout(newLayout);
    localStorage.setItem('retailops_dashboard_layout', JSON.stringify(newLayout));
  }, []);

  const handleToggleItem = useCallback((id, checked) => {
    setLayout(prev => {
      const next = prev.map(item => item.id === id ? { ...item, enabled: checked } : item);
      localStorage.setItem('retailops_dashboard_layout', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSpanChange = useCallback((id, newSpan) => {
    setLayout(prev => {
      const next = prev.map(item => item.id === id ? { ...item, span: newSpan } : item);
      localStorage.setItem('retailops_dashboard_layout', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleMoveItem = useCallback((index, direction) => {
    setLayout(prev => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const updated = [...prev];
      [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
      const next = updated.map((item, idx) => ({ ...item, order: idx + 1 }));
      localStorage.setItem('retailops_dashboard_layout', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleResetLayout = useCallback(() => {
    saveLayout(DEFAULT_LAYOUT);
  }, [saveLayout]);

  // ── Orchestration ──────────────────────────────────────────────────────
  const orch = useDashboardOrchestration({
    sellerId: selectedSellerId,
    startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
    endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
    period: rangeType
  });

  // ✅ Fix 3: include orch.refetch in deps via ref to avoid stale closure
  const refetchRef = useRef(orch.refetch);
  useEffect(() => { refetchRef.current = orch.refetch; });

  useEffect(() => {
    if (refreshCount > 0) refetchRef.current?.();
  }, [refreshCount]);

  // ── Data normalisation ─────────────────────────────────────────────────
  const kpisRaw = useMemo(() => Array.isArray(orch.kpis) ? orch.kpis : [], [orch.kpis]);
  const topProducts = useMemo(() => Array.isArray(orch.topProducts) ? orch.topProducts : [], [orch.topProducts]);

  const raw = orch.dashboardRaw ?? {};
  const stackedBarSeries = useMemo(() => Array.isArray(raw?.stackedBarSeries) ? raw.stackedBarSeries : [], [raw?.stackedBarSeries]);
  const adsPerformanceSeries = useMemo(() => Array.isArray(raw?.adsPerformanceSeries) ? raw.adsPerformanceSeries : [], [raw?.adsPerformanceSeries]);

  // ✅ Fix 6+7: chart labels memoized
  const chartLabels = useMemo(() =>
    stackedBarSeries.length > 0
      ? (stackedBarSeries[0]?.data ?? []).map((_, i) => `D${i + 1}`)
      : [],
    [stackedBarSeries]
  );

  const categoryLabels = useMemo(() =>
    adsPerformanceSeries.length > 0
      ? (adsPerformanceSeries[0]?.data ?? []).map((_, i) => `Period ${i + 1}`)
      : ['P1', 'P2', 'P3', 'P4'],
    [adsPerformanceSeries]
  );

  // ✅ Fix 8: topProductsWithMeta memoized — not inline in render
  const topProductsWithMeta = useMemo(() =>
    topProducts.map((p, idx) => ({
      ...p,
      rank: idx + 1,
      key: `${p.asin || ''}_${p.sku || ''}_${idx}`
    })),
    [topProducts]
  );

  // ── Chart options ──────────────────────────────────────────────────────
  // ✅ Fix 11: removed `token` from deps — it was never used inside
  const adsChartOptions = useMemo(() => ({
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
    colors: ['#6366f1', '#eab308'],
    dataLabels: { enabled: false },
    xaxis: {
      categories: chartLabels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#64748b', fontSize: '10px', fontWeight: 600 } }
    },
    yaxis: {
      labels: {
        style: { colors: '#64748b', fontSize: '10px', fontWeight: 600 },
        formatter: val => val >= 1000 ? `₹${(val / 1000).toFixed(1)}K` : `₹${val}`
      }
    },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', fontWeight: 600, markers: { radius: 12 } },
    tooltip: { theme: 'light' }
  }), [chartLabels]);   // ← token removed

  const adsPerfFlattened = useMemo(() => {
    if (!Array.isArray(adsPerformanceSeries?.[0]?.data)) return [];
    const salesData = adsPerformanceSeries[0]?.data || [];
    const spendData = adsPerformanceSeries[1]?.data || [];
    return [{
      name: 'Advertising ROAS',
      data: salesData.map((sv, i) => {
        const sp = spendData[i] || 0;
        return sp === 0 ? 0 : parseFloat((sv / sp).toFixed(2));
      })
    }];
  }, [adsPerformanceSeries]);

  const roasChartOptions = useMemo(() => ({
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 100] } },
    colors: ['#10b981'],
    dataLabels: { enabled: false },
    xaxis: {
      categories: chartLabels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#64748b', fontSize: '10px', fontWeight: 600 } }
    },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '10px', fontWeight: 600 }, formatter: v => `${v}x` } },
    grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
    tooltip: { theme: 'light' }
  }), [chartLabels]);

  // ✅ Fix 10: donutColors extracted to avoid self-reference
  const donutColors = ['#6366f1', '#3b82f6', '#10b981', '#eab308', '#f43f5e'];

  const donutOptions = useMemo(() => ({
    chart: { type: 'donut', fontFamily: 'Inter, sans-serif' },
    labels: categoryLabels,
    colors: donutColors,
    stroke: { show: false },
    dataLabels: { enabled: false },
    legend: { position: 'right', fontSize: '11px', fontWeight: 600 },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            name: { fontSize: '12px', fontWeight: 600, color: '#64748b' },
            value: { fontSize: '18px', fontWeight: 800, color: '#0f172a' },
            total: {
              show: true, label: 'ASINs', color: '#64748b', fontWeight: 600,
              formatter: w => w.globals.seriesTotals.reduce((a, b) => a + b, 0)
            }
          }
        }
      }
    }
  }), [categoryLabels]);

  // ── Table columns ──────────────────────────────────────────────────────
  const tableColumns = useMemo(() => [
    {
      title: 'RANK', dataIndex: 'rank', width: 60,
      render: val => (
        <Text strong style={{ color: val <= 3 ? '#6366f1' : '#bfbfbf' }}>#{val}</Text>
      )
    },
    {
      title: 'PRODUCT INTEL', dataIndex: 'title', ellipsis: true,
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ fontSize: 13, color: '#1e293b' }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.asin} · {record.sku}
          </Text>
        </Space>
      )
    },
    {
      title: 'VELOCITY', dataIndex: 'units', align: 'right',
      render: val => <Text strong>{val?.toLocaleString()}</Text>
    },
    {
      title: 'YIELD', dataIndex: 'revenue', align: 'right',
      render: val => (
        <Text strong style={{ color: '#10b981' }}>₹{val?.toLocaleString()}</Text>
      )
    },
    {
      title: 'ACOS', dataIndex: 'acos', align: 'right',
      render: val => {
        const isHigh = parseFloat(val) > 30;
        return (
          <Tag
            color={isHigh ? 'warning' : 'success'}
            style={{ borderRadius: 12, fontWeight: 700, margin: 0, padding: '2px 10px', border: 'none' }}
          >
            {val}
          </Tag>
        );
      }
    }
  ], []);

  // ── Sorted layout ──────────────────────────────────────────────────────
  const sortedLayout = useMemo(
    () => [...layout].filter(item => item.enabled).sort((a, b) => a.order - b.order),
    [layout]
  );

  // ── Skeleton phase ─────────────────────────────────────────────────────
  // ✅ Fix 12: guard against infinite skeleton — use timeout fallback
  const [skeletonTimeout, setSkeletonTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSkeletonTimeout(true), 8000); // 8s max skeleton
    return () => clearTimeout(t);
  }, []);

  const showSkeleton = (orch.isLoadingKpis || !orch.isHydrated) && !skeletonTimeout;

  if (showSkeleton) {
    return (
      <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh', margin: '-1.5rem -2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Space direction="vertical" size={2}>
            <Skeleton.Input active size="large" style={{ width: 220, height: 32 }} />
            <Skeleton.Input active size="small" style={{ width: 320, height: 16 }} />
          </Space>
          <Space size={8}>
            <Skeleton.Input active size="default" style={{ width: 180 }} />
            <Skeleton.Button active size="default" shape="round" style={{ width: 100 }} />
            <Skeleton.Button active size="default" shape="circle" />
          </Space>
        </div>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => (
            <Col key={i} xs={24} sm={12} md={6}>
              <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', padding: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Skeleton.Avatar active size="large" shape="square" style={{ borderRadius: 8 }} />
                  <Skeleton.Input active size="small" style={{ width: 60, height: 22 }} />
                </div>
                <Skeleton active paragraph={{ rows: 2 }} title={{ width: '80%' }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', minHeight: 340 }}>
              <Skeleton active paragraph={{ rows: 6 }} />
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </Card>
            <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <Skeleton active paragraph={{ rows: 3 }} />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ padding: '24px 32px', background: '#f8fafc', minHeight: '100vh', margin: '-1.5rem -2rem' }}
    >
      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12, marginBottom: 24, width: '100%'
      }}>
        <div>
          <Title level={4} style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 22 }}>
            Command Center
          </Title>
          <Space size={8} style={{ marginTop: 2 }}>
            <Badge
              status={orch.connectionStatus === 'connected' ? 'processing' : 'error'}
              color={orch.connectionStatus === 'connected' ? '#10b981' : '#ef4444'}
            />
            <Text type="secondary" style={{ fontWeight: 600, color: '#64748b', fontSize: 12 }}>
              {syncDisplayLabel(orch.connectionStatus)}
              {orch.syncTimestamp
                ? ` · Last Sync: ${format(new Date(orch.syncTimestamp), 'HH:mm:ss')}`
                : ''}
            </Text>
          </Space>
        </div>

        <Space size={8} wrap>
          <Select
            placeholder="Select Merchant"
            value={selectedSellerId}
            onChange={setSelectedSellerId}
            style={{ width: 220, height: 36 }}
            options={[
              { value: 'all', label: 'All Merchants / Aggregate' },
              ...sellers.map(s => ({ value: s._id || s.id, label: s.name }))
            ]}
          />
          <Button
            icon={<Settings size={14} />}
            onClick={() => setIsCustomizing(true)}
            style={{ fontWeight: 600, height: 36, fontSize: 13, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Customize
          </Button>
          <Tooltip title="Force sync">
            <Button
              icon={<RefreshCw size={14} className={(orch.isLoadingKpis || orch.isMutating) ? 'spin' : ''} />}
              onClick={() => orch.forceRefresh?.()}
              disabled={orch.isLoadingKpis || orch.isMutating}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, width: 36, borderRadius: 8 }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* ── Widget Grid ───────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ width: '100%', margin: 0 }}>
        {sortedLayout.map(item => (
          <Col xs={24} lg={item.span} key={item.id} style={{ padding: 0, marginBottom: 8 }}>

            {/* KPI cards */}
            {item.id === 'kpi' && (
              <Row gutter={[16, 16]} style={{ width: '100%', margin: 0 }}>
                {kpisRaw.map((kpi, idx) => {
                  const kpiTheme = getKpiTheme(kpi.title);
                  const KpiIcon = kpiTheme.icon;
                  return (
                    <Col key={kpi.id ?? idx} xs={24} sm={12} md={6}>
                      <motion.div
                        whileHover={{ translateY: -3, scale: 1.01 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card styles={{ body: { padding: '20px 24px' } }} style={cardStyle}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{
                              padding: 10, borderRadius: 10,
                              background: kpiTheme.bg, color: kpiTheme.color,
                              border: `1px solid ${kpiTheme.border}`
                            }}>
                              <KpiIcon size={20} />
                            </div>
                            {kpi.trend != null && kpi.trendType != null && (
                              <Tag
                                color={kpi.trendType === 'positive' ? 'success' : kpi.trendType === 'negative' ? 'error' : 'default'}
                                style={{ borderRadius: 20, fontWeight: 800, fontSize: 10, margin: 0, border: 'none', padding: '2px 8px' }}
                              >
                                {kpi.trendType === 'positive' ? '+' : '-'}{kpi.trend}%
                              </Tag>
                            )}
                          </div>
                          <div style={{ marginTop: 16 }}>
                            <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
                              {kpi.title}
                            </Text>
                            <Title level={3} style={{ margin: '4px 0 0', fontWeight: 800, fontSize: 24, color: '#0f172a' }}>
                              {kpi.value}
                            </Title>
                          </div>
                        </Card>
                      </motion.div>
                    </Col>
                  );
                })}
              </Row>
            )}

            {/* Charts */}
            {item.id === 'charts' && (
              <Card style={cardStyle} styles={{ body: { padding: '12px 24px 20px' } }}>
                <Tabs
                  defaultActiveKey="sales"
                  size="middle"
                  tabBarExtraContent={
                    <Tag color="blue" style={{ fontSize: 9, fontWeight: 800, border: 'none', borderRadius: 12 }}>
                      LIVE ANALYTICS
                    </Tag>
                  }
                  items={[
                    {
                      key: 'sales',
                      label: (
                        <Space>
                          <TrendingUp size={14} />
                          <Text strong style={{ color: '#475569' }}>Sales &amp; Spend</Text>
                        </Space>
                      ),
                      children: (
                        <Suspense fallback={<SkeletonChart height={250} />}>
                          {adsPerformanceSeries.length > 0 ? (
                            <Chart options={adsChartOptions} series={adsPerformanceSeries} type="bar" height={260} />
                          ) : (
                            <Empty description="Collecting metrics…" style={{ padding: '24px 0' }} />
                          )}
                        </Suspense>
                      )
                    },
                    {
                      key: 'roas',
                      label: (
                        <Space>
                          <Activity size={14} />
                          <Text strong style={{ color: '#475569' }}>ROAS Efficiency</Text>
                        </Space>
                      ),
                      children: (
                        <Suspense fallback={<SkeletonChart height={250} />}>
                          {adsPerfFlattened.length > 0 && adsPerfFlattened[0]?.data?.some(v => v > 0) ? (
                            <Chart options={roasChartOptions} series={adsPerfFlattened} type="area" height={260} />
                          ) : (
                            <Empty description="Calculating ROAS…" style={{ padding: '24px 0' }} />
                          )}
                        </Suspense>
                      )
                    },
                    {
                      key: 'categories',
                      label: (
                        <Space>
                          <PieChart size={14} />
                          <Text strong style={{ color: '#475569' }}>Segment Distribution</Text>
                        </Space>
                      ),
                      children: (
                        <Suspense fallback={<SkeletonChart height={250} />}>
                          <Row align="middle" style={{ minHeight: 260 }}>
                            <Col xs={24} md={14}>
                              <Chart
                                options={donutOptions}
                                series={categoryLabels.map((_, i) => {
                                  const valStr = kpisRaw[i + 1]?.value;
                                  if (!valStr) return 1;
                                  const cleaned = parseFloat(String(valStr).replace(/[^\d.]/g, ''));
                                  return isNaN(cleaned) ? 1 : cleaned;
                                })}
                                type="donut"
                                height={240}
                              />
                            </Col>
                            <Col xs={24} md={10} style={{ paddingLeft: 24 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <Text type="secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#94a3b8' }}>
                                  Active ASINs Portfolio
                                </Text>
                                {kpisRaw.map((k, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                    <Space size={8}>
                                      {/* ✅ Fix 10: use donutColors array, not self-ref */}
                                      <Badge color={donutColors[i % donutColors.length]} />
                                      <Text strong style={{ color: '#334155' }}>{k.title}</Text>
                                    </Space>
                                    <Text type="secondary" style={{ fontWeight: 600 }}>{k.value}</Text>
                                  </div>
                                ))}
                              </div>
                            </Col>
                          </Row>
                        </Suspense>
                      )
                    }
                  ]}
                />
              </Card>
            )}

            {/* Quick Nav */}
            {item.id === 'satellite' && (
              <Card
                title={
                  <Space>
                    <Zap size={16} color="#eab308" />
                    <Text strong style={{ color: '#0f172a' }}>Quick Navigation Links</Text>
                  </Space>
                }
                style={cardStyle}
                styles={{ body: { padding: '16px 20px' } }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Inventory', icon: Package, href: '/inventory', color: '#3b82f6', bg: '#eff6ff', border: '#dbeafe' },
                    { label: 'Workflows', icon: Target, href: '/actions', color: '#8b5cf6', bg: '#f5f3ff', border: '#e0e7ff' },
                    { label: 'Scrapers', icon: Zap, href: '/scrape-tasks', color: '#eab308', bg: '#fef9c3', border: '#fef3c7' },
                    { label: 'Alerts', icon: AlertCircle, href: '/alerts', color: '#ef4444', bg: '#fef2f2', border: '#fee2e2' },
                    { label: 'Engines', icon: Settings, href: '/rule-sets', color: '#14b8a6', bg: '#f0fdfa', border: '#ccfbf1' },
                    { label: 'Reports', icon: FileBarChart, href: '/performance-reports', color: '#10b981', bg: '#ecfdf5', border: '#d1fae5' },
                  ].map((btn, idx) => (
                    <a
                      key={idx}
                      href={btn.href}
                      className="quick-op-btn"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', borderRadius: 10,
                        background: btn.bg, border: `1px solid ${btn.border}`,
                        color: 'inherit', textDecoration: 'none',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
                      }}
                    >
                      <btn.icon size={16} style={{ color: btn.color }} strokeWidth={2.5} />
                      <Text style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{btn.label}</Text>
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {/* Velocity table */}
            {item.id === 'velocity' && (
              <Card
                title={
                  <Space>
                    <FileBarChart size={16} color="#6366f1" />
                    <Text strong style={{ color: '#0f172a' }}>Product Velocity Matrix</Text>
                  </Space>
                }
                extra={<Button type="link" size="small" style={{ fontWeight: 700 }}>EXPORT DATA</Button>}
                style={cardStyle}
                styles={{ body: { padding: 0 } }}
              >
                <Table
                  columns={tableColumns}
                  dataSource={topProductsWithMeta}
                  pagination={{ pageSize: 5, hideOnSinglePage: true }}
                  size="middle"
                  className="premium-table"
                />
              </Card>
            )}
          </Col>
        ))}
      </Row>

      {/* ── Customize Modal ───────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <Sparkles size={16} style={{ color: '#6366f1' }} />
            <Text strong style={{ fontSize: 16, color: '#0f172a' }}>
              Customize Your Command Center
            </Text>
          </Space>
        }
        open={isCustomizing}
        onCancel={() => setIsCustomizing(false)}
        footer={[
          <Button key="reset" danger onClick={handleResetLayout} style={{ fontWeight: 600, borderRadius: 8 }}>
            Reset to Default
          </Button>,
          <Button key="close" type="primary" onClick={() => setIsCustomizing(false)}
            style={{ fontWeight: 600, background: '#6366f1', borderColor: '#6366f1', borderRadius: 8 }}>
            Apply Settings
          </Button>
        ]}
        width={540}
        styles={{ body: { padding: '12px 0' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Toggle modules, set display widths, and reorder widgets.
          </Text>
          <Divider style={{ margin: '8px 0' }} />
          {layout.map((item, idx) => (
            <Card
              key={item.id}
              styles={{ body: { padding: '12px 16px' } }}
              style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 6 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size={12}>
                  <Switch
                    size="small"
                    checked={item.enabled}
                    onChange={checked => handleToggleItem(item.id, checked)}
                  />
                  <Text strong style={{ fontSize: 13.5, color: item.enabled ? '#1e293b' : '#94a3b8' }}>
                    {item.label}
                  </Text>
                </Space>
                <Space size={8}>
                  <Select
                    value={item.span}
                    onChange={val => handleSpanChange(item.id, val)}
                    size="small"
                    style={{ width: 110 }}
                    disabled={!item.enabled}
                    options={[
                      { value: 8, label: '1/3 Width' },
                      { value: 12, label: 'Half Width' },
                      { value: 16, label: '2/3 Width' },
                      { value: 24, label: 'Full Width' },
                    ]}
                  />
                  <Button size="small" shape="circle" disabled={idx === 0}
                    onClick={() => handleMoveItem(idx, -1)}
                    style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                    ↑
                  </Button>
                  <Button size="small" shape="circle" disabled={idx === layout.length - 1}
                    onClick={() => handleMoveItem(idx, 1)}
                    style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                    ↓
                  </Button>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      </Modal>

      <style>{`
                .spin { animation: spin 1.5s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .quick-op-btn:hover {
                    border-color: #cbd5e1 !important;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(0,0,0,0.03) !important;
                }
                .premium-table .ant-table-thead > tr > th {
                    background: #f8fafc !important; font-size: 11px !important;
                    color: #475569 !important; font-weight: 700 !important;
                    letter-spacing: 0.08em !important; padding: 14px 16px !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                }
                .premium-table .ant-table-row:hover > td { background: #fafafa !important; }
                .ant-card-head { border-bottom: 1px solid #f0f0f0 !important; min-height: 40px !important; padding: 0 12px !important; }
                .ant-card-head-title { font-size: 13.5px !important; color: #0f172a !important; }
            `}</style>
    </motion.div>
  );
};

export default Dashboard;