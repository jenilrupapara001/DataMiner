// Dashboard — RetailOps Command Center
// Data orchestration: https://src/hooks/useDashboardOrchestration.ts
import React, { useState, useCallback, useMemo, Suspense, lazy, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Row,
  Col,
  Card,
  Table,
  Button,
  Progress,
  Tag,
  Space,
  Typography,
  Tooltip,
  Empty,
  theme,
  Badge,
  Avatar,
  Divider,
  Switch,
  Modal,
  Select,
  Tabs
} from 'antd';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  RefreshCw,
  IndianRupee,
  ShoppingBag,
  Zap,
  Target,
  FileBarChart,
  Settings,
  PieChart,
  Activity,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';

// Lazy loaded charts
const Chart = lazy(() => import('react-apexcharts'));

// Local imports
// Local imports
import api, { seedApi } from '../services/api';
import { SkeletonChart } from '../components/common/Skeleton';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import ErrorState from '../components/common/ErrorState';
import { useAuth } from '../contexts/AuthContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useRefresh } from '../contexts/RefreshContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { METRIC_CONFIG } from '../models/growth.types';
import { useDashboardOrchestration } from '../hooks/useDashboardOrchestration';
const { Text, Title } = Typography;

// ── Animation Variants ─────────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};
const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 120, damping: 20 } }
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const cardStyle = {
  borderRadius: '8px',
  border: '1px solid #d5dbdb',
  background: '#ffffff',
  boxShadow: 'none',
  height: '100%',
  overflow: 'hidden'
};

// ── KpiIcon helper ─────────────────────────────────────────────────────────────
// Maps the kpi.title → a contextually relevant icon.
// If the raw kpi response already carries an `icon` string (GDP API), we
// pass it through so the UI stays consistent.
function resolveKpiIcon(kpi, useFallback) {
  if (kpi.metricType && METRIC_CONFIG[kpi.metricType]) {
    const IconName = METRIC_CONFIG[kpi.metricType].icon;
    const LucideIcons = {
      TrendingUp, IndianRupee: IndianRupee, Target, Package, Star, Percent,
      Activity,
    };
    const Comp = LucideIcons[IconName] ?? TrendingUp;
    return <Comp size={18} />;
  }
  if (!useFallback) return null;
  return <TrendingUp size={18} />;
}

// ── Helper to map raw alert objects to the UI AlertItem shape ──────────────────

// ── Dashboard component ───────────────────────────────────────────────────────
const Dashboard = () => {
  const { isGlobalUser } = useAuth();
  const { startDate, endDate, rangeType } = useDateRange();
  const { refreshCount } = useRefresh();
  const { token } = theme.useToken();
  const { setPageTitle } = usePageTitle();

  // ── Sellers list (for merchant selector) ────────────────────────────────────
  const [sellers, setSellers] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState('all');

  useEffect(() => { setPageTitle('Market Intelligence'); }, [setPageTitle]);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const response = await api.sellerApi.getAll({ page: 1, limit: 100 });
        if (response?.success && response?.data?.sellers) {
          setSellers(response.data.sellers);
        } else if (response?.sellers) {
          setSellers(response.sellers);
        } else if (Array.isArray(response)) {
          setSellers(response);
        }
      } catch (err) { console.error('Failed to fetch sellers:', err); }
    };
    fetchSellers();
  }, []);

  // ── Layout state ────────────────────────────────────────────────────────────
  const [seeding, setSeeding] = useState(false);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [layout, setLayout] = useState(() => {
    const saved = localStorage.getItem('retailops_dashboard_layout');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.some(p => p.id === 'alerts')) {
          localStorage.removeItem('retailops_dashboard_layout');
        } else {
          return parsed;
        }
      } catch (_e) { /* _e */ }
    }
    return [
      { id: 'kpi', label: 'KPI Scorecards', enabled: true, order: 1, span: 24 },
      { id: 'charts', label: 'Performance Analytics Chart', enabled: true, order: 2, span: 24 },
      { id: 'satellite', label: 'Quick Navigation Links', enabled: true, order: 3, span: 24 },
      { id: 'velocity', label: 'Product Velocity Matrix', enabled: true, order: 4, span: 24 },
    ];
  });

  const saveLayout = (newLayout) => { setLayout(newLayout); localStorage.setItem('retailops_dashboard_layout', JSON.stringify(newLayout)); };

  const handleToggleItem = (id, checked) => { saveLayout(layout.map(item => item.id === id ? { ...item, enabled: checked } : item)); };
  const handleSpanChange = (id, newSpan) => { saveLayout(layout.map(item => item.id === id ? { ...item, span: newSpan } : item)); };
  const handleMoveItem = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= layout.length) return;
    const updated = [...layout];
    [updated[index], updated[nextIndex]] = [updated[nextIndex], updated[index]];
    saveLayout(updated.map((item, idx) => ({ ...item, order: idx + 1 })));
  };
  const handleResetLayout = () => {
    saveLayout([
      { id: 'kpi', label: 'KPI Scorecards', enabled: true, order: 1, span: 24 },
      { id: 'charts', label: 'Performance Analytics Chart', enabled: true, order: 2, span: 24 },
      { id: 'satellite', label: 'Quick Navigation Links', enabled: true, order: 3, span: 24 },
      { id: 'velocity', label: 'Product Velocity Matrix', enabled: true, order: 4, span: 24 },
    ]);
  };

  // ── Orchestration layer — single hook, composable surface ───────────────────
  const orch = useDashboardOrchestration();

  const sortedLayout = useMemo(
    () => [...layout].filter(item => item.enabled).sort((a, b) => a.order - b.order),
    [layout],
  );

  // ── Graceful fallback ─────────────────────────────────────────────────────────
  const kpisRaw = Array.isArray(orch.kpis) ? orch.kpis : [];
  const alertsList = Array.isArray(orch.alerts) ? orch.alerts : [];
  const _topProducts = Array.isArray(orch.topProducts) ? orch.topProducts : [];

  // Full /dashboard API response carries chart data outside kpi cards.
  // `dashboardRaw` is identical in shape to loadDashboardData's `response`.
  const raw = orch.dashboardRaw ?? {};

  const stackedBarSeries = Array.isArray(raw?.stackedBarSeries) ? raw.stackedBarSeries : [];
  const adsPerformanceSeries = Array.isArray(raw?.adsPerformanceSeries) ? raw.adsPerformanceSeries : [];
  const _labels = Array.isArray(raw?.labels) ? raw.labels : [];
  const _categoryData = Array.isArray(raw?.category) ? raw.category : [];
  const _roas = typeof raw?.roas === 'string' ? raw.roas : '0.00';
  const _dailySpend = typeof raw?.dailySpend === 'number' ? raw.dailySpend : 0;

  // KPI cards are shaped by the GDP dashboard endpoint:
  // [{ id, title, value, icon, trend, trendType }]
  const topProducts = _topProducts;

  // Watched once to trigger refresh cycle when the RefreshContext fires
  useEffect(() => {
    // RefreshContext fires `triggerRefresh` which increments `refreshCount`.
    // Board that counter to invalidate the query cache.
    if (refreshCount > 0) orch.refetch();
  }, [refreshCount]);

  const handleSeedDemoData = async () => {
    setSeeding(true);
    try {
      const result = await seedApi.seedAll();
      if (result?.success) orch.forceRefresh();
    } catch (err) {
      console.error('Seed failed:', err);
    } finally {
      setSeeding(false);
    }
  };

  // ── Computed chart options ───────────────────────────────────────────────────
  const chartLabels = stackedBarSeries.length > 0
    ? (stackedBarSeries[0]?.data ?? []).map((_v, i) => `D${i + 1}`)
    : [];

  const adsChartOptions = useMemo(() => ({
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '55%', distributed: false } },
    colors: ['#002f36', '#ff9900'],
    dataLabels: { enabled: false },
    xaxis: {
      categories: chartLabels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#8c8c8c', fontSize: '10px', fontWeight: 500 } }
    },
    yaxis: {
      labels: {
        style: { colors: '#8c8c8c', fontSize: '10px', fontWeight: 500 },
        formatter: (val) => val >= 1000 ? `₹${(val / 1000).toFixed(1)}K` : `₹${val}`
      }
    },
    grid: { borderColor: '#f0f0f0', strokeDashArray: 4 },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px', markers: { radius: 12 } },
    tooltip: { theme: 'light' }
  }), [chartLabels, token]);

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
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] } },
    colors: ['#e47911'],
    dataLabels: { enabled: false },
    xaxis: {
      categories: chartLabels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: '#8c8c8c', fontSize: '10px', fontWeight: 500 } }
    },
    yaxis: { labels: { style: { colors: '#8c8c8c', fontSize: '10px', fontWeight: 500 }, formatter: (v) => `${v}x` } },
    grid: { borderColor: '#f0f0f0', strokeDashArray: 4 },
    tooltip: { theme: 'light' }
  }), [chartLabels]);

  const categoryLabels = adsPerformanceSeries.length > 0
    ? (adsPerformanceSeries[0]?.data ?? []).map((_v, i) => `Period ${i + 1}`)
    : ['P1', 'P2', 'P3', 'P4'];

  const donutOptions = useMemo(() => ({
    chart: { type: 'donut', fontFamily: 'Inter, sans-serif' },
    labels: categoryLabels,
    colors: ['#002f36', '#ff9900', '#232f3e', '#565959', '#e47911'],
    stroke: { show: false },
    dataLabels: { enabled: false },
    legend: { position: 'right', fontSize: '11px', fontWeight: 500 },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            name: { fontSize: '12px', fontWeight: 600, color: '#8c8c8c' },
            value: { fontSize: '18px', fontWeight: 800, color: '#262626' },
            total: {
              show: true, label: 'ASINs', color: '#8c8c8c', fontWeight: 600,
              formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0)
            }
          }
        }
      }
    }
  }), [categoryLabels]);

  const tableColumns = useMemo(() => [
    {
      title: 'RANK', dataIndex: 'rank', width: 60,
      render: (val) => <Text strong style={{ color: val <= 3 ? token.colorPrimary : '#bfbfbf' }}>#{val}</Text>
    },
    {
      title: 'PRODUCT INTEL', dataIndex: 'title', ellipsis: true,
      render: (text, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong style={{ fontSize: '13px' }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>{record.asin} • {record.sku}</Text>
        </Space>
      )
    },
    {
      title: 'VELOCITY', dataIndex: 'units', align: 'right',
      render: (val) => <Text strong>{val?.toLocaleString()}</Text>
    },
    {
      title: 'YIELD', dataIndex: 'revenue', align: 'right',
      render: (val) => <Text strong style={{ color: token.colorSuccess }}>₹{val?.toLocaleString()}</Text>
    },
    {
      title: 'ACOS', dataIndex: 'acos', align: 'right',
      render: (val) => {
        const isHigh = parseFloat(val) > 30;
        return <Tag color={isHigh ? 'error' : 'default'} variant="filled" style={{ fontWeight: 700, margin: 0 }}>{val}</Tag>;
      }
    }
  ], [token]);

  // ══════════════════════════════════════════════════════════════════════════════
  // RENDER — skeleton phase
  // ══════════════════════════════════════════════════════════════════════════════
  if ((orch.isLoadingKpis && kpisRaw.length === 0) ||
    (orch.isLoadingAlerts && alertsList.length === 0)) {
    return (
      <div style={{ padding: '24px' }}>
        <LoadingIndicator type="line-simple" size="md" />
        <Title level={3} style={{ marginBottom: 24 }}>Dashboard</Title>
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map(i => (
            <Col key={i} xs={12} sm={6}><Card loading style={cardStyle} /></Col>
          ))}
        </Row>
      </div>
    );
  }

  // ── Data is loaded at this point (orchestration guarantees non-null arrays) ─────
  const topProductsWithMeta = topProducts.map((p, idx) => ({ ...p, rank: idx + 1, key: `${p.asin || ''}_${p.sku || ''}` }));

  // ROAS / daily spend from the orchestrator link GDP API workspace
  const roasValue = '0.00';
  const dailySpend = 0;

  // Connection badge text
  const connLabel = orch.connectionStatus === 'connected' ? 'Live'
    : orch.connectionStatus === 'reconnecting' ? 'Reconnecting…'
      : 'Offline / Cached';

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ padding: '12px 16px', background: '#eaeded', minHeight: '100vh' }}
    >
      {/* ── Dashboard Control Toolbar ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '10px', marginBottom: '12px', width: '100%'
      }}>
        <Space size={8} style={{ fontSize: '12px', color: token.colorTextDescription }}>
          <Badge status={orch.connectionStatus === 'connected' ? 'processing' : 'error'}
            color={orch.connectionStatus === 'connected' ? '#52c41a' : '#ff4d4f'} />
          <Text type="secondary" style={{ fontWeight: 600, color: '#565959' }}>
            {syncDisplayLabel(orch.connectionStatus)} {orch.syncTimestamp ? `• Last Sync: ${format(new Date(orch.syncTimestamp), 'HH:mm:ss')}` : ''}
          </Text>
        </Space>

        <Space size={6} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <Select
            placeholder="Select Merchant"
            value={selectedSellerId}
            onChange={(val) => setSelectedSellerId(val)}
            style={{ width: 220, height: '32px' }}
            variant="outlined"
            options={[
              { value: 'all', label: 'All Merchants / Aggregate' },
              ...sellers.map((s) => ({ value: s._id || s.id, label: s.name })),
            ]}
          />

          <Button
            type="dashed"
            icon={<Settings size={13} />}
            onClick={() => setIsCustomizing(true)}
            style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', height: '32px', fontSize: '12px' }}
          >
            Customize
          </Button>

          <Tooltip title="Force sync database">
            <Button
              icon={<RefreshCw size={13} className={(orch.isLoadingKpis || orch.isMutating) ? 'spin' : ''} />}
              onClick={() => orch.forceRefresh()}
              disabled={orch.isLoadingKpis || orch.isMutating}
              shape="circle"
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                height: '32px', width: '32px'
              }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* ── Reactive widget grid ─────────────────────────────────────────────── */}
      <Row gutter={[12, 12]} style={{ width: '100%', margin: 0 }}>
        {sortedLayout.map(item => (
          <Col xs={24} lg={item.span} key={item.id} style={{ padding: 0, marginBottom: '4px' }}>
            {item.id === 'kpi' && (
              <Row gutter={[12, 12]} style={{ width: '100%', margin: 0 }}>
                {kpisRaw.map((kpi, idx) => (
                  <Col key={kpi.id ?? idx} xs={24} sm={12} md={6}>
                    <Card styles={{ body: { padding: '16px' } }} style={cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{
                          padding: '8px',
                          background: `${token.colorPrimary}10`,
                          borderRadius: '8px', color: token.colorPrimary
                        }}>
                          {kpi.icon.includes('shop') ? <ShoppingBag size={18} />
                            : kpi.icon.includes('box') ? <Package size={18} />
                              : kpi.icon.includes('rupee') ? <IndianRupee size={18} />
                                : <TrendingUp size={18} />}
                        </div>
                        {kpi.trend != null && kpi.trendType != null && (
                          <Tag
                            color={kpi.trendType === 'positive' ? 'success'
                              : kpi.trendType === 'negative' ? 'error' : 'default'}
                            variant="filled"
                            style={{ borderRadius: '6px', fontWeight: 800, fontSize: '10px', margin: 0 }}
                          >
                            {kpi.trendType === 'positive' ? '+' : '-'}{kpi.trend}%
                          </Tag>
                        )}
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <Text type="secondary" style={{
                          fontSize: '10px', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '0.08em'
                        }}>
                          {kpi.title}
                        </Text>
                        <Title level={3} style={{ margin: '2px 0 0', fontWeight: 900, fontSize: '20px' }}>
                          {kpi.value}
                        </Title>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}

            {item.id === 'charts' && (
              <Card style={cardStyle} styles={{ body: { padding: '8px 16px' } }}>
                <Tabs
                  defaultActiveKey="sales" size="middle"
                  tabBarExtraContent={
                    <Tag color="blue" variant="filled" style={{ fontSize: '9px', fontWeight: 800 }}>
                      LIVE ANALYTICS
                    </Tag>
                  }
                  items={[
                    {
                      key: 'sales',
                      label: <Space><TrendingUp size={14} /> <Text strong>Sales &amp; Spend Performance</Text></Space>,
                      children: (
                        <Suspense fallback={<SkeletonChart height={250} />}>
                          {adsPerformanceSeries.length > 0 ? (
                            <Chart options={adsChartOptions}
                              series={adsPerformanceSeries}
                              type="bar" height={250} />
                          ) : (
                            <Empty description="Collecting performance metrics…" style={{ padding: '24px 0' }} />
                          )}
                        </Suspense>
                      ),
                    },
                    {
                      key: 'roas',
                      label: <Space><Activity size={14} /> <Text strong>Advertising Efficiency (ROAS)</Text></Space>,
                      children: (
                        <Suspense fallback={<SkeletonChart height={250} />}>
                          {adsPerfFlattened.length > 0 && adsPerfFlattened[0]?.data?.some((v) => v > 0) ? (
                            <Chart options={roasChartOptions} series={adsPerfFlattened} type="area" height={250} />
                          ) : (
                            <Empty description="Calculating ROAS metrics stream…" style={{ padding: '24px 0' }} />
                          )}
                        </Suspense>
                      ),
                    },
                    {
                      key: 'categories',
                      label: <Space><PieChart size={14} /> <Text strong>Product Segment Distribution</Text></Space>,
                      children: (
                        <Suspense fallback={<SkeletonChart height={250} />}>
                          <Row align="middle" style={{ minHeight: 250 }}>
                            <Col xs={24} md={14}>
                              <Chart options={donutOptions}
                                series={categoryLabels.map((_c, i) => kpisRaw[i + 1]?.value || 1)}
                                type="donut" height={230} />
                            </Col>
                            <Col xs={24} md={10} style={{ paddingLeft: '16px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <Text type="secondary" style={{ fontSize: '12px', fontWeight: 600 }}>
                                  Active ASINs Portfolio
                                </Text>
                                {kpisRaw.map((k, i) => (
                                  <div key={i} style={{
                                    display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', fontSize: '12px'
                                  }}>
                                    <Space size={6}>
                                      <Badge color={donutOptions.colors[i % donutOptions.colors.length]} />
                                      <Text strong>{k.title}</Text>
                                    </Space>
                                    <Text type="secondary">{k.value}</Text>
                                  </div>
                                ))}
                              </div>
                            </Col>
                          </Row>
                        </Suspense>
                      ),
                    },
                  ]}
                />
              </Card>
            )}

            {item.id === 'satellite' && (
              <Card
                title={<Space><Zap size={15} color="#faad14" /> <Text strong>Quick Navigation Links</Text></Space>}
                style={cardStyle} styles={{ body: { padding: '12px 16px' } }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  {[
                    { label: 'Inventory', icon: Package, href: '/inventory', color: '#1890ff', bg: '#e6f7ff' },
                    { label: 'Workflows', icon: Target, href: '/actions', color: '#722ed1', bg: '#f9f0ff' },
                    { label: 'Scrapers', icon: Zap, href: '/scrape-tasks', color: '#faad14', bg: '#fffbe6' },
                    { label: 'Alerts', icon: AlertCircle, href: '/alerts', color: '#ff4d4f', bg: '#fff1f0' },
                    { label: 'Engines', icon: Settings, href: '/rule-sets', color: '#13c2c2', bg: '#e6fffb' },
                    { label: 'Reports', icon: FileBarChart, href: '/performance-reports', color: '#52c41a', bg: '#f6ffed' },
                  ].map((btn, idx) => (
                    <a key={idx} href={btn.href} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '10px 14px', borderRadius: '8px', background: btn.bg,
                      color: 'inherit', transition: 'all 0.2s', border: '1px solid transparent',
                      textDecoration: 'none'
                    }} className="quick-op-btn">
                      <btn.icon size={15} style={{ color: btn.color }} strokeWidth={2.5} />
                      <Text style={{ fontSize: '11.5px', fontWeight: 700, color: '#262626' }}>{btn.label}</Text>
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {item.id === 'velocity' && (
              <Card
                title={<Space><FileBarChart size={16} color={token.colorPrimary} /> <Text strong>Product Velocity Matrix</Text></Space>}
                style={cardStyle}
                styles={{ body: { padding: 0 } }}
                extra={<Button type="link" size="small" style={{ fontWeight: 700 }}>EXPORT DATA</Button>}
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

      {/* ── Customize Drawer Modal ────────────────────────────────────────────── */}
      <Modal
        title={<Space><Sparkles size={15} style={{ color: token.colorPrimary }} /> <Text strong style={{ fontSize: '15px' }}>Customize Your Command Center</Text></Space>}
        open={isCustomizing}
        onCancel={() => setIsCustomizing(false)}
        footer={[
          <Button key="reset" danger size="middle" onClick={handleResetLayout} style={{ fontWeight: 600 }}>
            Reset to Default
          </Button>,
          <Button key="close" type="primary" size="middle" onClick={() => setIsCustomizing(false)}
            style={{ fontWeight: 600, backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}>
            Apply Settings
          </Button>,
        ]}
        width={540}
        styles={{ body: { padding: '12px 0' } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '0 8px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Toggle modules, assign display width parameters, and arrange widget position sequence
            to fit your operational focus.
          </Text>
          <Divider style={{ margin: '6px 0' }} />
          {layout.map((item, idx) => (
            <Card
              key={item.id}
              styles={{ body: { padding: '10px 14px' } }}
              style={{ border: '1px solid #f0f0f0', borderRadius: '8px', marginBottom: '4px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Switch size="small" checked={item.enabled} onChange={(checked) => handleToggleItem(item.id, checked)} />
                  <Text strong style={{ fontSize: '13px', color: item.enabled ? '#1f1f1f' : '#bfbfbf' }}>{item.label}</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Select value={item.span} onChange={(val) => handleSpanChange(item.id, val)} size="small"
                    style={{ width: 110 }} disabled={!item.enabled}
                    options={[
                      { value: 8, label: '1/3 Width' },
                      { value: 12, label: 'Half Width' },
                      { value: 16, label: '2/3 Width' },
                      { value: 24, label: 'Full Width' },
                    ]} />
                  <Button size="small" shape="circle" disabled={idx === 0}
                    onClick={() => handleMoveItem(idx, -1)}
                    style={{
                      width: '24px', height: '24px', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '10px'
                    }}>
                    ↑
                  </Button>
                  <Button size="small" shape="circle" disabled={idx === layout.length - 1}
                    onClick={() => handleMoveItem(idx, 1)}
                    style={{
                      width: '24px', height: '24px', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: '10px'
                    }}>
                    ↓
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Modal>

      <style>{`
        .spin { animation: spin 1.5s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .quick-op-btn:hover { border-color: #d9d9d9 !important; transform: translateY(-3px);
                             box-shadow: 0 6px 16px rgba(0,0,0,.06); }
        .premium-table .ant-table-thead > tr > th { background: #fafafa !important; font-size: 11px !important;
          color: #8c8c8c !important; font-weight: 800 !important; letter-spacing: .1em !important;
          padding: 12px 16px !important; }
        .premium-table .ant-table-row:hover > td { background: #fdfdfd !important; }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #e8e8e8; border-radius: 10px; }
        .ant-card-head { border-bottom: 1px solid #f0f0f0 !important; min-height: 40px !important; padding: 0 12px !important; }
        .ant-card-head-title { font-size: 13px !important; color: #262626 !important; }
      `}</style>
    </motion.div>
  );
};

function syncDisplayLabel(status) {
  switch (status) {
    case 'connected': return 'Active Network Stream';
    case 'reconnecting': return 'Reconnecting…';
    default: return 'Cached / Offline';
  }
}

export default Dashboard;
