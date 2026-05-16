// Dashboard - RetailOps Command Center - ANTD PREMIUM EDITION
import React, { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
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
  Divider
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
import api, { seedApi } from '../services/api';
import { SkeletonChart } from '../components/common/Skeleton';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import ErrorState from '../components/common/ErrorState';
import { useAuth } from '../contexts/AuthContext';
import { useDateRange } from '../contexts/DateRangeContext';
import { useRefresh } from '../contexts/RefreshContext';

const { Text, Title } = Typography;

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 120, damping: 20 }
  }
};

// Premium Styles
const cardStyle = {
  borderRadius: '12px',
  border: '1px solid #f0f0f0',
  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
  height: '100%',
  overflow: 'hidden'
};

const Dashboard = () => {
  const { isGlobalUser } = useAuth();
  const { startDate, endDate, rangeType } = useDateRange();
  const { refreshCount } = useRefresh();
  const { token } = theme.useToken();

  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [refreshInterval] = useState(0); // Can be linked to a setting
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

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
        rangeType
      };

      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null)
      );

      const query = new URLSearchParams(cleanParams).toString();
      const response = await api.dashboardApi.getSummary(query);
      
      const { 
        kpi, stackedBarSeries, labels, 
        category, tableData, userStats, teamStats, 
        alerts, roas, dailySpend, adsPerformanceSeries 
      } = response;

      setData({
        kpis: kpi || [],
        stackedBarSeries: stackedBarSeries || [],
        adsPerformanceSeries: adsPerformanceSeries || [],
        labels: labels || [],
        categoryData: category || [],
        topProducts: tableData?.map((p, idx) => ({ ...p, rank: idx + 1, key: p.asin + p.sku })) || [],
        userStats,
        teamStats,
        alerts: alerts || [],
        roas: roas || '0.00',
        dailySpend: dailySpend || 0
      });

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('System interruption: Data pipeline failed to respond.');
    } finally {
      setLoading(false);
    }
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
    try {
      const result = await seedApi.seedAll();
      if (result.success) loadDashboardData();
    } catch (err) {
      setError('Failed to initialize simulation.');
    } finally {
      setSeeding(false);
    }
  };

  // Chart Options
  const adsChartOptions = useMemo(() => ({
    chart: {
      type: 'bar',
      toolbar: { show: false },
      fontFamily: 'Inter, sans-serif'
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '55%',
        distributed: false
      },
    },
    colors: [token.colorPrimary, '#faad14'],
    dataLabels: { enabled: false },
    xaxis: {
      categories: data.labels,
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
    legend: { 
      position: 'top', 
      horizontalAlign: 'right', 
      fontSize: '12px',
      markers: { radius: 12 }
    },
    tooltip: { theme: 'light' }
  }), [data.labels, token]);

  const donutOptions = useMemo(() => ({
    chart: { type: 'donut', fontFamily: 'Inter, sans-serif' },
    labels: data.categoryData.map(c => c.name),
    colors: [token.colorPrimary, '#13c2c2', '#722ed1', '#eb2f96', '#faad14'],
    stroke: { show: false },
    dataLabels: { enabled: false },
    legend: { position: 'bottom', fontSize: '11px', fontWeight: 500 },
    plotOptions: {
      pie: {
        donut: {
          size: '75%',
          labels: {
            show: true,
            name: { fontSize: '12px', fontWeight: 600, color: '#8c8c8c' },
            value: { fontSize: '20px', fontWeight: 800, color: '#262626' },
            total: {
              show: true,
              label: 'ASINs',
              color: '#8c8c8c',
              fontWeight: 600,
              formatter: (w) => w.globals.seriesTotals.reduce((a, b) => a + b, 0)
            }
          }
        }
      }
    }
  }), [data.categoryData, token]);

  const tableColumns = useMemo(() => [
    {
      title: 'RANK',
      dataIndex: 'rank',
      width: 60,
      render: (val) => <Text strong style={{ color: val <= 3 ? token.colorPrimary : '#bfbfbf' }}>#{val}</Text>
    },
    {
      title: 'PRODUCT INTEL',
      dataIndex: 'title',
      ellipsis: true,
      render: (text, record) => (
        <Space orientation="vertical" size={0}>
          <Text strong style={{ fontSize: '13px' }}>{text}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>{record.asin} • {record.sku}</Text>
        </Space>
      )
    },
    {
      title: 'VELOCITY',
      dataIndex: 'units',
      align: 'right',
      render: (val) => <Text strong>{val?.toLocaleString()}</Text>
    },
    {
      title: 'YIELD',
      dataIndex: 'revenue',
      align: 'right',
      render: (val) => <Text strong style={{ color: token.colorSuccess }}>₹{val?.toLocaleString()}</Text>
    },
    {
      title: 'ACOS',
      dataIndex: 'acos',
      align: 'right',
      render: (val) => {
        const isHigh = parseFloat(val) > 30;
        return <Tag color={isHigh ? 'error' : 'default'} variant="filled" style={{ fontWeight: 700, margin: 0 }}>{val}</Tag>;
      }
    }
  ], [token]);

  if (loading && !data.kpis.length) {
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

  if (error) return <div style={{ padding: '24px' }}><ErrorState title="System Fault" description={error} onRetry={loadDashboardData} /></div>;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ padding: '16px', background: '#fafafa', minHeight: '100vh' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <Space orientation="vertical" size={0}>
          <Title level={3} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.03em' }}>
            <LayoutDashboard size={22} style={{ marginRight: 10, verticalAlign: 'middle', color: token.colorPrimary }} />
            Market Intelligence
          </Title>
          <Space size={4} style={{ fontSize: '12px', color: token.colorTextDescription }}>
            <Badge status="processing" color={token.colorSuccess} />
            <Text type="secondary">Network Active • Sync: {format(new Date(), 'HH:mm:ss')}</Text>
          </Space>
        </Space>

        <Space>
          <Tooltip title="Force Sync">
            <Button 
              icon={<RefreshCw size={14} className={loading ? 'spin' : ''} />} 
              onClick={loadDashboardData}
              disabled={loading}
              shape="circle"
            />
          </Tooltip>
          {isGlobalUser && (
            <Button 
              type="primary" 
              icon={<Sparkles size={14} />} 
              loading={seeding} 
              onClick={handleSeedDemoData}
              style={{ fontWeight: 600, borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
            >
              RUN SIMULATION
            </Button>
          )}
        </Space>
      </div>

      {/* KPI Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: '16px' }}>
        {data.kpis.map((kpi, idx) => (
          <Col key={idx} xs={12} sm={12} md={6}>
            <Card styles={{ body: { padding: '16px' } }} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ padding: '10px', background: `${token.colorPrimary}10`, borderRadius: '10px', color: token.colorPrimary }}>
                  {kpi.icon.includes('shop') ? <ShoppingBag size={20} /> : kpi.icon.includes('box') ? <Package size={20} /> : kpi.icon.includes('rupee') ? <IndianRupee size={20} /> : <TrendingUp size={20} />}
                </div>
                {kpi.trend && (
                  <Tag color={kpi.trendType === 'positive' ? 'success' : 'error'} variant="filled" style={{ borderRadius: '6px', fontWeight: 800, fontSize: '10px', margin: 0 }}>
                    {kpi.trendType === 'positive' ? '+' : '-'}{kpi.trend}%
                  </Tag>
                )}
              </div>
              <div style={{ marginTop: '16px' }}>
                <Text type="secondary" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{kpi.title}</Text>
                <Title level={3} style={{ margin: '2px 0 0', fontWeight: 900 }}>{kpi.value}</Title>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Charts & Matrix Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: '16px' }}>
        <Col xs={24} lg={16}>
          <Card 
            title={<Space><Activity size={16} color={token.colorPrimary} /> <Text strong>Performance Analytics</Text></Space>}
            style={cardStyle}
            styles={{ body: { padding: '16px 20px' } }}
            extra={<Tag color="blue" variant="filled" style={{ fontSize: '10px', fontWeight: 700 }}>REAL-TIME</Tag>}
          >
            <Suspense fallback={<SkeletonChart height={260} />}>
              {data.adsPerformanceSeries.length > 0 ? (
                <Chart options={adsChartOptions} series={data.adsPerformanceSeries} type="bar" height={260} />
              ) : <Empty description="Collecting performance metrics..." />}
            </Suspense>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title={<Space><Bell size={16} color="#ff4d4f" /> <Text strong>Live Event Feed</Text></Space>}
            style={cardStyle}
            styles={{ body: { padding: '12px' } }}
          >
            <div style={{ height: '272px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scroll">
              {data.alerts.length > 0 ? (
                <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                  {data.alerts.map((alert, i) => (
                    <div key={i} style={{ padding: '10px', background: '#f9f9f9', borderRadius: '8px', border: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <AlertTriangle size={14} color={alert.type === 'critical' ? '#ff4d4f' : '#faad14'} style={{ marginTop: 2 }} />
                        <div>
                          <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', lineHeight: 1.3 }}>{alert.message}</Text>
                          <Space split={<Divider type="vertical" />} style={{ fontSize: '10px', marginTop: 4 }}>
                            <Text type="secondary">{alert.time || 'Just now'}</Text>
                            <Text strong style={{ color: alert.type === 'critical' ? '#ff4d4f' : '#faad14' }}>{alert.type?.toUpperCase()}</Text>
                          </Space>
                        </div>
                      </div>
                    </div>
                  ))}
                </Space>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  <CheckCircle2 size={32} color={token.colorSuccess} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <Text type="secondary" style={{ fontSize: '13px', fontWeight: 500 }}>All systems nominal</Text>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Operations Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: '16px' }}>
        <Col xs={24} md={8}>
          <Card title={<Space><Zap size={16} color="#faad14" /> <Text strong>Satellite Control</Text></Space>} style={cardStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                { label: 'Inventory', icon: Package, href: '/inventory', color: '#1890ff', bg: '#e6f7ff' },
                { label: 'Actions', icon: Target, href: '/actions', color: '#722ed1', bg: '#f9f0ff' },
                { label: 'Scrapers', icon: Zap, href: '/scrape-tasks', color: '#faad14', bg: '#fffbe6' },
                { label: 'Alerts', icon: AlertCircle, href: '/alerts', color: '#ff4d4f', bg: '#fff1f0' },
                { label: 'Engines', icon: Settings, href: '/rule-sets', color: '#13c2c2', bg: '#e6fffb' },
                { label: 'Reports', icon: FileBarChart, href: '/performance-reports', color: '#52c41a', bg: '#f6ffed' },
              ].map((item, idx) => (
                <a key={idx} href={item.href} style={{ 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', 
                  padding: '14px 8px', borderRadius: '12px', background: item.bg, color: 'inherit',
                  transition: 'all 0.2s', border: '1px solid transparent'
                }} className="quick-op-btn">
                  <item.icon size={18} style={{ color: item.color }} strokeWidth={2.5} />
                  <Text style={{ fontSize: '11px', fontWeight: 700, color: '#262626' }}>{item.label}</Text>
                </a>
              ))}
            </div>
          </Card>
        </Col>
        
        <Col xs={24} md={16}>
          <Card 
            title={<Space><Activity size={16} color={token.colorSuccess} /> <Text strong>Pipeline Health</Text></Space>} 
            style={cardStyle}
          >
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Card styles={{ body: { padding: '12px' } }} style={{ background: '#fcfcfc', border: '1px solid #f0f0f0' }} variant="borderless">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text strong style={{ fontSize: '12px' }}>Node Throughput</Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>{data.userStats?.completed || 0} / {data.userStats?.total || 0}</Text>
                  </div>
                  <Progress 
                    percent={Math.round(((data.userStats?.completed + (data.userStats?.inProgress || 0)) / (data.userStats?.total || 1)) * 100) || 0} 
                    success={{ percent: Math.round((data.userStats?.completed / (data.userStats?.total || 1)) * 100) || 0 }}
                    size={8} showInfo={false}
                  />
                  <Text style={{ fontSize: '10px', marginTop: 8, display: 'block' }} type="secondary">Personal backlog efficiency</Text>
                </Card>
              </Col>
              <Col span={12}>
                <Card styles={{ body: { padding: '12px' } }} style={{ background: '#fcfcfc', border: '1px solid #f0f0f0' }} variant="borderless">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text strong style={{ fontSize: '12px' }}>Network Yield</Text>
                    <Tag color="success" variant="filled" style={{ margin: 0, fontWeight: 800, fontSize: '10px' }}>{data.teamStats?.total ? Math.round((data.teamStats.completed / data.teamStats.total) * 100) : 0}%</Tag>
                  </div>
                  <Progress 
                    percent={Math.round(((data.teamStats?.completed + (data.teamStats?.inProgress || 0)) / (data.teamStats?.total || 1)) * 100) || 0} 
                    success={{ percent: Math.round((data.teamStats?.completed / (data.teamStats?.total || 1)) * 100) || 0 }}
                    size={8} showInfo={false} strokeColor={token.colorInfo}
                  />
                  <Text style={{ fontSize: '10px', marginTop: 8, display: 'block' }} type="secondary">Global system throughput</Text>
                </Card>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      {/* Velocity Grid */}
      <Row gutter={[12, 12]}>
        <Col span={24}>
          <Card 
            title={<Space><FileBarChart size={18} color={token.colorPrimary} /> <Text strong>Product Velocity Matrix</Text></Space>} 
            style={cardStyle}
            styles={{ body: { padding: 0 } }}
            extra={<Button type="link" size="small" style={{ fontWeight: 700 }}>EXPORT DATA</Button>}
          >
            <Table
              columns={tableColumns}
              dataSource={data.topProducts}
              pagination={{ pageSize: 5, hideOnSinglePage: true }}
              size="middle"
              className="premium-table"
            />
          </Card>
        </Col>
      </Row>

      <style>{`
        .spin { animation: spin 1.5s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .quick-op-btn:hover { border-color: #d9d9d9 !important; transform: translateY(-3px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
        .premium-table .ant-table-thead > tr > th { background: #fafafa !important; font-size: 11px !important; color: #8c8c8c !important; font-weight: 800 !important; letter-spacing: 0.1em !important; padding: 16px !important; }
        .premium-table .ant-table-row:hover > td { background: #fdfdfd !important; }
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #e8e8e8; border-radius: 10px; }
        .ant-card-head { border-bottom: 1px solid #f0f0f0 !important; min-height: 48px !important; padding: 0 16px !important; }
        .ant-card-head-title { font-size: 14px !important; color: #262626 !important; }
      `}</style>
    </motion.div>
  );
};

export default Dashboard;