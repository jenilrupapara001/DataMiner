import React, { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Table, Tag, Typography, Space, Spin, Button, Progress, Empty, Tooltip } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined, ShopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Text } = Typography;
const API_BASE = import.meta.env?.VITE_API_URL || '/api';

const authHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function LiveSyncTrackerPage() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/live-sync-tracker/sellers`, { headers: authHeaders() }).then(r => r.json());
      if (res.success) setSellers(res.data || []);
      setLastRefresh(new Date());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // Stats
  const synced = sellers.filter(s => s.syncPercentage > 0).length;
  const total = sellers.length;
  const totalAsins = sellers.reduce((s, sell) => s + (sell.totalAsins || 0), 0);
  const syncedAsins = sellers.reduce((s, sell) => s + (sell.liveSyncedAsins || 0), 0);

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', padding: '0 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', marginBottom: 16 }}>
        <Space>
          <Text strong style={{ fontSize: 18 }}>Live Sync Status</Text>
          {lastRefresh && <Text style={{ fontSize: 11, color: '#94a3b8' }}>Last refresh: {dayjs(lastRefresh).format('HH:mm:ss')}</Text>}
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="small">Refresh</Button>
      </div>

      {/* Summary Cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center', borderLeft: '3px solid #2563eb' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{synced}/{total}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Brands Synced</div>
            <Progress showInfo={false} percent={total > 0 ? Math.round((synced / total) * 100) : 0} size="small" strokeColor="#16a34a" style={{ marginTop: 4 }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center', borderLeft: '3px solid #16a34a' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{syncedAsins.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>ASINs Synced</div>
            <Progress showInfo={false} percent={totalAsins > 0 ? Math.round((syncedAsins / totalAsins) * 100) : 0} size="small" strokeColor="#2563eb" style={{ marginTop: 4 }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center', borderLeft: '3px solid #94a3b8' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#94a3b8' }}>{total - synced}</div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Pending Sync</div>
          </Card>
        </Col>
      </Row>

      {/* Brand Sync Status Table */}
      <Card size="small" title={<Space><ShopOutlined /> Brand Sync Status</Space>} style={{ borderRadius: 10 }}>
        <Table
          dataSource={sellers}
          rowKey="Id"
          size="small"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (t) => <Text type="secondary" style={{ fontSize: 11 }}>{t} brands</Text> }}
          columns={[
            {
              title: 'Brand', dataIndex: 'Name', key: 'name', width: 220,
              render: (name) => <Text strong style={{ fontSize: 12 }}>{name}</Text>,
            },
            {
              title: 'Marketplace', dataIndex: 'Marketplace', key: 'mp', width: 100,
              render: (mp) => <Tag style={{ fontSize: 9, borderRadius: 8 }}>{mp}</Tag>,
            },
            {
              title: 'ASINs', dataIndex: 'totalAsins', key: 'total', width: 70, align: 'center',
            },
            {
              title: 'Live Synced', dataIndex: 'liveSyncedAsins', key: 'live', width: 90, align: 'center',
              render: (v) => <Text style={{ fontWeight: 600, color: '#2563eb' }}>{v}</Text>,
            },
            {
              title: 'Progress', key: 'progress', width: 140,
              render: (_, r) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Progress percent={r.syncPercentage} size="small" showInfo={false}
                    strokeColor={r.syncPercentage >= 80 ? '#16a34a' : r.syncPercentage >= 30 ? '#f59e0b' : '#dc2626'}
                    style={{ width: 80, margin: 0 }} />
                  <Text style={{ fontSize: 10, fontWeight: 600 }}>{r.syncPercentage}%</Text>
                </div>
              ),
            },
            {
              title: 'Status', key: 'status', width: 120,
              render: (_, r) => {
                if (r.syncPercentage >= 80) return <Tag color="success" style={{ fontSize: 9, borderRadius: 8 }}><CheckCircleOutlined /> Synced</Tag>;
                if (r.syncPercentage > 0) return <Tag color="warning" style={{ fontSize: 9, borderRadius: 8 }}><SyncOutlined /> Partial</Tag>;
                return <Tag style={{ fontSize: 9, borderRadius: 8, color: '#94a3b8' }}><ClockCircleOutlined /> Pending</Tag>;
              },
            },
            {
              title: 'Last Sync', key: 'lastSync', width: 130,
              render: (_, r) => r.lastLiveSyncAt ? (
                <Tooltip title={dayjs(r.lastLiveSyncAt).format('DD MMM YYYY HH:mm')}>
                  <Text style={{ fontSize: 10, color: '#64748b' }}>{dayjs(r.lastLiveSyncAt).fromNow?.() || dayjs(r.lastLiveSyncAt).format('DD MMM HH:mm')}</Text>
                </Tooltip>
              ) : <Text type="secondary" style={{ fontSize: 10 }}>Never synced</Text>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
