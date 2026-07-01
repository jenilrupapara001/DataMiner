import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Table, Tag, Progress, Typography, Space, Segmented, Spin, Button, Tabs, Statistic, Empty, Tooltip } from 'antd';
import {
  TrophyOutlined, TeamOutlined, UserOutlined, BarChartOutlined,
  ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined,
  AimOutlined, StarOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ShopOutlined
} from '@ant-design/icons';
import pemsApi from '../services/pemsApi';
import { DEPARTMENTS } from '../constants';

const { Text, Title } = Typography;

export default function PemsAnalyticsPage() {
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [deptData, setDeptData] = useState([]);
  const [sellerData, setSellerData] = useState([]);
  const [managerData, setManagerData] = useState([]);
  const [reviewerData, setReviewerData] = useState([]);
  const [activeTab, setActiveTab] = useState('department');

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      const now = new Date();
      if (period === 'week') params.dateFrom = new Date(now.setDate(now.getDate() - 7)).toISOString();
      else if (period === 'month') params.dateFrom = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      else if (period === 'quarter') params.dateFrom = new Date(now.setMonth(now.getMonth() - 3)).toISOString();

      const [deptRes, sellerRes, mgrRes, revRes] = await Promise.all([
        pemsApi.getDepartmentPerformance(params),
        pemsApi.getSellerPerformance(params),
        pemsApi.getBrandManagerPerformance(params),
        pemsApi.getReviewerPerformance(params),
      ]);
      if (deptRes.success) setDeptData(deptRes.data);
      if (sellerRes.success) setSellerData(sellerRes.data);
      if (mgrRes.success) setManagerData(mgrRes.data);
      if (revRes.success) setReviewerData(revRes.data);
    } catch (err) { console.error('Analytics error:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [period]);

  // Summary KPIs
  const summaryKpis = useMemo(() => {
    const allTasks = deptData.reduce((s, d) => s + (d.totalTasks || 0), 0);
    const allCompleted = deptData.reduce((s, d) => s + (d.completedTasks || 0), 0);
    const allBreached = deptData.reduce((s, d) => s + (d.slaBreached || 0), 0);
    const avgAchievement = deptData.length > 0
      ? Math.round(deptData.reduce((s, d) => s + (d.avgAchievementPct || 0), 0) / deptData.length * 100) / 100
      : 0;
    const avgCompletion = allTasks > 0 ? Math.round((allCompleted / allTasks) * 100) : 0;
    const avgSla = allTasks > 0 ? Math.round(((allTasks - allBreached) / allTasks) * 100) : 100;
    return { allTasks, allCompleted, allBreached, avgAchievement, avgCompletion, avgSla };
  }, [deptData]);

  // Summary cards
  const summaryCards = [
    { title: 'Total Tasks', value: summaryKpis.allTasks, color: '#1976D2', icon: <AimOutlined /> },
    { title: 'Completion Rate', value: `${summaryKpis.avgCompletion}%`, color: '#2E7D32', icon: <CheckCircleOutlined /> },
    { title: 'Avg Achievement', value: `${summaryKpis.avgAchievement}%`, color: '#ED6C02', icon: <TrophyOutlined /> },
    { title: 'SLA Compliance', value: `${summaryKpis.avgSla}%`, color: summaryKpis.avgSla >= 90 ? '#2E7D32' : '#D32F2F', icon: <ClockCircleOutlined /> },
    { title: 'SLA Breaches', value: summaryKpis.allBreached, color: '#D32F2F', icon: <ArrowDownOutlined /> },
  ];

  // Department Performance Columns
  const deptColumns = [
    { title: 'Department', dataIndex: 'Department', key: 'dept', width: 140,
      render: (d) => (
        <Space>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: d === 'Operations' ? '#1976D2' : d === 'Brand Managers' ? '#9C27B0' : '#0288D1' }} />
          <Text strong>{d}</Text>
        </Space>
      ),
    },
    { title: 'Tasks', dataIndex: 'totalTasks', width: 70, align: 'center',
      render: (v) => <Text style={{ fontSize: 13, fontWeight: 700 }}>{v}</Text>,
    },
    { title: 'Completed', dataIndex: 'completedTasks', width: 90, align: 'center',
      render: (v) => <Text style={{ color: '#2E7D32', fontWeight: 700 }}>{v}</Text>,
    },
    { title: 'Active', dataIndex: 'activeTasks', width: 70, align: 'center',
      render: (v) => <Text style={{ color: '#1976D2', fontWeight: 700 }}>{v}</Text>,
    },
    { title: 'Completion %', key: 'cr', width: 130,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress percent={r.completionRate} size="small" strokeColor={r.completionRate >= 80 ? '#2E7D32' : r.completionRate >= 50 ? '#ED6C02' : '#D32F2F'} style={{ width: 70, margin: 0 }} />
          <Text style={{ fontSize: 11, fontWeight: 700, color: r.completionRate >= 80 ? '#2E7D32' : '#ED6C02' }}>{r.completionRate}%</Text>
        </div>
      ),
    },
    { title: 'Achievement %', dataIndex: 'avgAchievementPct', width: 120,
      render: (v) => (
        <Tag color={v >= 80 ? 'success' : v >= 50 ? 'warning' : 'error'} style={{ borderRadius: 10, fontWeight: 700, fontSize: 11 }}>{v}%</Tag>
      ),
    },
    { title: 'SLA %', dataIndex: 'slaCompliance', width: 100,
      render: (v) => (
        <Space>
          <Progress percent={v} size="small" strokeColor={v >= 90 ? '#2E7D32' : '#D32F2F'} showInfo={false} style={{ width: 50, margin: 0 }} />
          <Text style={{ fontSize: 11, fontWeight: 700, color: v >= 90 ? '#2E7D32' : '#D32F2F' }}>{v}%</Text>
        </Space>
      ),
    },
  ];

  // Seller Performance Columns
  const sellerColumns = [
    { title: 'Seller', dataIndex: 'SellerName', key: 'seller', width: 200,
      render: (name) => (
        <Space>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1976D2', fontWeight: 700, fontSize: 11 }}>
            {(name || '?')[0]}
          </div>
          <Text strong style={{ fontSize: 12 }}>{name || 'Unknown'}</Text>
        </Space>
      ),
    },
    { title: 'Tasks', dataIndex: 'totalTasks', width: 70, align: 'center' },
    { title: 'Completed', dataIndex: 'completedTasks', width: 90, align: 'center',
      render: (v) => <Text style={{ color: '#2E7D32', fontWeight: 700 }}>{v}</Text>,
    },
    { title: 'Completion %', key: 'cr', width: 130,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress percent={r.completionRate} size="small" strokeColor={r.completionRate >= 80 ? '#2E7D32' : r.completionRate >= 50 ? '#ED6C02' : '#D32F2F'} style={{ width: 70, margin: 0 }} />
          <Text style={{ fontSize: 11, fontWeight: 700, color: r.completionRate >= 80 ? '#2E7D32' : '#ED6C02' }}>{r.completionRate}%</Text>
        </div>
      ),
    },
    { title: 'Achievement %', dataIndex: 'avgAchievementPct', width: 110,
      render: (v) => <Tag color={v >= 80 ? 'success' : v >= 50 ? 'warning' : 'error'} style={{ borderRadius: 10, fontWeight: 700 }}>{v}%</Tag>,
    },
    { title: 'SLA Breached', dataIndex: 'slaBreached', width: 100, align: 'center',
      render: (v) => v > 0 ? <Tag color="error" style={{ borderRadius: 10 }}>{v}</Tag> : <Text type="secondary">0</Text>,
    },
  ];

  // Brand Manager Performance Columns
  const managerColumns = [
    { title: 'Brand Manager', dataIndex: 'AssigneeName', key: 'mgr', width: 200,
      render: (name) => (
        <Space>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9C27B0', fontWeight: 700, fontSize: 11 }}>
            {(name || '?')[0]}
          </div>
          <Text strong style={{ fontSize: 12 }}>{name || 'Unknown'}</Text>
        </Space>
      ),
    },
    { title: 'Tasks', dataIndex: 'totalTasks', width: 70, align: 'center' },
    { title: 'Completed', dataIndex: 'completedTasks', width: 90, align: 'center',
      render: (v) => <Text style={{ color: '#2E7D32', fontWeight: 700 }}>{v}</Text>,
    },
    { title: 'Completion %', key: 'cr', width: 130,
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress percent={r.completionRate} size="small" strokeColor={r.completionRate >= 80 ? '#2E7D32' : r.completionRate >= 50 ? '#ED6C02' : '#D32F2F'} style={{ width: 70, margin: 0 }} />
          <Text style={{ fontSize: 11, fontWeight: 700, color: r.completionRate >= 80 ? '#2E7D32' : '#ED6C02' }}>{r.completionRate}%</Text>
        </div>
      ),
    },
    { title: 'Achievement %', dataIndex: 'avgAchievementPct', width: 110,
      render: (v) => <Tag color={v >= 80 ? 'success' : v >= 50 ? 'warning' : 'error'} style={{ borderRadius: 10, fontWeight: 700 }}>{v}%</Tag>,
    },
    { title: 'Progress', dataIndex: 'avgProgress', width: 110,
      render: (v) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Progress percent={v || 0} size="small" style={{ width: 60, margin: 0 }} />
          <Text style={{ fontSize: 10, color: '#64748b' }}>{v}%</Text>
        </div>
      ),
    },
    { title: 'SLA Breached', dataIndex: 'slaBreached', width: 100, align: 'center',
      render: (v) => v > 0 ? <Tag color="error" style={{ borderRadius: 10 }}>{v}</Tag> : <Text type="secondary">0</Text>,
    },
  ];

  // Reviewer Performance Columns
  const reviewerColumns = [
    { title: 'Reviewer', dataIndex: 'ReviewerName', key: 'reviewer', width: 200,
      render: (name) => (
        <Space>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2E7D32', fontWeight: 700, fontSize: 11 }}>
            {(name || '?')[0]}
          </div>
          <Text strong style={{ fontSize: 12 }}>{name || 'Unknown'}</Text>
        </Space>
      ),
    },
    { title: 'Reviews', dataIndex: 'totalReviews', width: 80, align: 'center' },
    { title: 'Approved', dataIndex: 'approved', width: 80, align: 'center',
      render: (v) => <Text style={{ color: '#2E7D32', fontWeight: 700 }}>{v}</Text>,
    },
    { title: 'Rejected', dataIndex: 'rejected', width: 80, align: 'center',
      render: (v) => v > 0 ? <Text style={{ color: '#D32F2F', fontWeight: 700 }}>{v}</Text> : <Text type="secondary">0</Text>,
    },
    { title: 'Approval Rate', key: 'rate', width: 120,
      render: (_, r) => {
        const rate = r.totalReviews > 0 ? Math.round((r.approved / r.totalReviews) * 100) : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress percent={rate} size="small" strokeColor={rate >= 80 ? '#2E7D32' : '#ED6C02'} style={{ width: 60, margin: 0 }} />
            <Text style={{ fontSize: 11, fontWeight: 700, color: rate >= 80 ? '#2E7D32' : '#ED6C02' }}>{rate}%</Text>
          </div>
        );
      },
    },
    { title: 'Quality Score', dataIndex: 'avgQualityScore', width: 110,
      render: (v) => (
        <Space>
          <span style={{ color: '#ED6C02', fontSize: 12 }}>★</span>
          <Text style={{ fontSize: 12, fontWeight: 700, color: v >= 4 ? '#2E7D32' : v >= 3 ? '#ED6C02' : '#D32F2F' }}>{v}/5</Text>
        </Space>
      ),
    },
    { title: 'Avg Time', dataIndex: 'avgReviewTime', width: 90,
      render: (v) => v > 0 ? <Text style={{ fontSize: 11, color: '#64748b' }}>{Math.round(v)}m</Text> : <Text type="secondary">-</Text>,
    },
  ];

  const tabItems = [
    {
      key: 'department',
      label: <Space><BarChartOutlined /> Department</Space>,
      children: (
        <Table dataSource={deptData} columns={deptColumns} rowKey="Department" size="small" pagination={false}
          locale={{ emptyText: <Empty description="No department data" /> }} />
      ),
    },
    {
      key: 'seller',
      label: <Space><ShopOutlined /> Sellers</Space>,
      children: (
        <Table dataSource={sellerData} columns={sellerColumns} rowKey="SellerId" size="small"
          pagination={sellerData.length > 10 ? { pageSize: 10, showTotal: t => <Text type="secondary">{t} sellers</Text> } : false}
          locale={{ emptyText: <Empty description="No seller data" /> }} />
      ),
    },
    {
      key: 'manager',
      label: <Space><TeamOutlined /> Brand Managers</Space>,
      children: (
        <Table dataSource={managerData} columns={managerColumns} rowKey="AssignedTo" size="small"
          pagination={managerData.length > 10 ? { pageSize: 10, showTotal: t => <Text type="secondary">{t} managers</Text> } : false}
          locale={{ emptyText: <Empty description="No brand manager data" /> }} />
      ),
    },
    {
      key: 'reviewer',
      label: <Space><UserOutlined /> Reviewers</Space>,
      children: (
        <Table dataSource={reviewerData} columns={reviewerColumns} rowKey="ReviewerId" size="small"
          pagination={reviewerData.length > 10 ? { pageSize: 10, showTotal: t => <Text type="secondary">{t} reviewers</Text> } : false}
          locale={{ emptyText: <Empty description="No reviewer data" /> }} />
      ),
    },
  ];

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', padding: '0 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', marginBottom: 12 }}>
        <Space>
          <Title level={4} style={{ margin: 0 }}>Analytics</Title>
          <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600 }}>Performance Reports</Tag>
        </Space>
        <Space>
          <Segmented
            value={period} onChange={setPeriod} size="small"
            options={[
              { label: 'All Time', value: 'all' },
              { label: 'Week', value: 'week' },
              { label: 'Month', value: 'month' },
              { label: 'Quarter', value: 'quarter' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="small">Refresh</Button>
        </Space>
      </div>

      {/* Summary KPI Row */}
      <Row gutter={[10, 10]} style={{ marginBottom: 16 }}>
        {summaryCards.map((card, i) => (
          <Col key={i} xs={12} sm={8} md={4} lg={4} style={{ flex: '1 1 140px' }}>
            <Card size="small" style={{ borderRadius: 8, borderLeft: `3px solid ${card.color}` }} styles={{ body: { padding: '10px 12px' } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${card.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, fontSize: 15 }}>
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>{card.value}</div>
                  <div style={{ fontSize: 9, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{card.title}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Analytics Tabs */}
      <Card size="small" style={{ borderRadius: 8 }} styles={{ body: { padding: '4px 0' } }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            style={{ padding: '0 12px' }}
          />
        )}
      </Card>
    </div>
  );
}
