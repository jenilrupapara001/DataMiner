import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  RefreshCw, Package, Search, Zap, Activity, AlertTriangle,
  ExternalLink, BarChart2, Store, Plus, Database, Globe
} from 'lucide-react';
import {
  Layout, Card, Row, Col, Typography, Space, Button, Input,
  Select, Table, Tag, Avatar, Tooltip, Collapse, Alert, Statistic, message, Badge
} from 'antd';
import api from '../services/api';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

const { Title, Text, Paragraph } = Typography;

const MARKETPLACE_FLAGS = { 'amazon.in': '🇮🇳', 'ajio': '💜', 'myntra': '💖' };

/* ── Badge Helpers ─────────────────────────────────────── */
const getLqsBadge = (lqs, cdqGrade) => {
  if (lqs == null && cdqGrade == null) return <span style={{ color: '#a1a1aa' }}>—</span>;

  // Use CDQ grade if available, otherwise fallback to LQS-based grade
  const grade = cdqGrade || (lqs >= 80 ? 'A' : lqs >= 60 ? 'B' : lqs >= 40 ? 'C' : 'D');

  let color = 'default';
  if (grade === 'A') color = 'success';
  else if (grade === 'B') color = 'warning';
  else color = 'error';

  return (
    <Tag color={color} style={{ fontWeight: 600, fontSize: '11px', borderRadius: '4px', border: 'none' }}>
      {grade} ({lqs || 0})
    </Tag>
  );
};

const getScrapeStatusBadge = (status) => {
  const map = {
    PENDING: { color: 'warning', text: 'Pending' },
    SCRAPED: { color: 'success', text: 'Scraped' },
    FAILED: { color: 'error', text: 'Failed' },
    SCRAPING: { color: 'processing', text: 'Scraping' },
    Active: { color: 'success', text: 'Active' },
  };
  const s = map[status] || { color: 'default', text: status || 'Unknown' };

  return (
    <Tag color={s.color} style={{ fontWeight: 600, fontSize: '10px', borderRadius: '4px', border: 'none', textTransform: 'uppercase' }}>
      {s.text}
    </Tag>
  );
};

/* ── Main Seller Expandable Panel ────────────────────── */
const SellerAsinPanel = ({ seller, onSync, syncing, refreshKey }) => {
  const { sellerId: urlSellerId } = useParams();
  const [asins, setAsins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(seller._id === urlSellerId);
  const [search, setSearch] = useState('');
  const [lqsFilter, setLqsFilter] = useState('');

  // Auto-open if URL matches
  useEffect(() => {
    if (seller._id === urlSellerId) {
      setIsOpen(true);
      // Scroll into view
      const el = document.getElementById(`seller-${seller._id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [urlSellerId, seller._id]);

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await api.sellerTrackerApi.getSellerAsins(seller._id);
      if (res.success) setAsins(res.data || []);
    } catch (e) {
      console.error('Failed to load ASINs for seller:', e.message);
    } finally {
      setLoading(false);
    }
  }, [isOpen, seller._id]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const filtered = useMemo(() => {
    let result = asins;
    if (search) {
      result = result.filter(a =>
        a.asinCode?.toLowerCase().includes(search.toLowerCase()) ||
        a.title?.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (lqsFilter) {
      if (lqsFilter === 'high') {
        result = result.filter(a => (a.cdqGrade || (a.lqs >= 80 ? 'A' : a.lqs >= 60 ? 'B' : a.lqs >= 40 ? 'C' : 'D')) === 'A');
      } else if (lqsFilter === 'medium') {
        result = result.filter(a => {
          const grade = a.cdqGrade || (a.lqs >= 80 ? 'A' : a.lqs >= 60 ? 'B' : a.lqs >= 40 ? 'C' : 'D');
          return grade === 'B';
        });
      } else if (lqsFilter === 'low') {
        result = result.filter(a => {
          const grade = a.cdqGrade || (a.lqs >= 80 ? 'A' : a.lqs >= 60 ? 'B' : a.lqs >= 40 ? 'C' : 'D');
          return grade === 'C' || grade === 'D';
        });
      }
    }
    return result;
  }, [asins, search, lqsFilter]);

  const flag = MARKETPLACE_FLAGS[seller.marketplace] || '🌐';
  const lastSync = seller.lastKeepaSync ? new Date(seller.lastKeepaSync) : null;
  const isNew24h = (date) => date && new Date(date) > new Date(Date.now() - 86400000);

  // Custom Panel Header to match standard listing structure perfectly
  const renderHeader = () => (
    <div className="seller-header-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '10px', background: '#f4f4f5',
          border: '1px solid #e4e4e7', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '1.2rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          {flag}
        </div>
        <div>
          <Text strong style={{ color: '#18181b', fontSize: '14px', display: 'block' }}>{seller.name}</Text>
          <Space size={6} separator={<span style={{ color: '#d4d4d8', fontSize: '10px' }}>•</span>}>
            <Tag style={{ margin: 0, fontSize: '10px', fontWeight: 600, background: '#f4f4f5', border: 'none', color: '#71717a' }}>
              {seller.sellerId}
            </Tag>
            <span style={{ color: '#71717a', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Globe size={11} /> {seller.marketplace}
            </span>
          </Space>
        </div>
      </div>

      <div className="seller-header-stats" onClick={e => e.stopPropagation()}>
        {/* Inventory Counter */}
        <div style={{ textAlign: 'center', minWidth: '70px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#a1a1aa', letterSpacing: '0.05em' }}>Inventory</div>
          <Text strong style={{ fontSize: '13px', color: '#18181b' }}>{seller.dbAsinCount ?? seller.totalAsins ?? 0}</Text>
        </div>

        {/* Keepa catalog */}
        <div style={{ textAlign: 'center', minWidth: '70px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#a1a1aa', letterSpacing: '0.05em' }}>Keepa Cat</div>
          <Text strong style={{ fontSize: '13px', color: '#18181b' }}>{seller.keepaAsinCount ?? 0}</Text>
        </div>

        {/* Sync Status Notification */}
        {seller.newAsinCount > 0 && (
          <Tag color="success" style={{ margin: 0, fontWeight: 700, borderRadius: '20px', padding: '2px 10px', border: 'none' }}>
            +{seller.newAsinCount} New Today
          </Tag>
        )}

        {/* Last Sync */}
        <div style={{ textAlign: 'right', minWidth: '85px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#a1a1aa' }}>Last Sync</div>
          <Text style={{ fontSize: '12px', color: '#52525b', fontWeight: 500 }}>
            {lastSync ? lastSync.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}
          </Text>
        </div>

        {/* Panel Sync Action */}
        <Button
          icon={<RefreshCw size={13} className={syncing ? 'spin' : ''} />}
          loading={syncing}
          onClick={(e) => { e.stopPropagation(); onSync(seller._id); }}
          shape="round"
          size="middle"
          style={{ fontWeight: 600, fontSize: '12px', border: '1px solid #e4e4e7', color: '#18181b' }}
        >
          Sync Now
        </Button>
      </div>
    </div>
  );

  // Ant Design Table Column Mapping
  const columns = [
    {
      title: 'ASIN CODE',
      dataIndex: 'asinCode',
      key: 'asinCode',
      width: 120,
      render: (code, record) => (
        <Space size={4}>
          <Text strong style={{ fontFamily: 'monospace', color: '#18181b', fontSize: '13px' }}>{code}</Text>
          {isNew24h(record.createdAt) && <Tag color="success" style={{ fontSize: '9px', padding: '0 4px', margin: 0, border: 'none', fontWeight: 800 }}>NEW</Tag>}
        </Space>
      )
    },
    {
      title: 'PRODUCT TITLE',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title, record) => (
        <Space size={8}>
          {record.imageUrl && (
            <Avatar shape="square" size={28} src={record.imageUrl} style={{ border: '1px solid #f4f4f5', borderRadius: '4px' }} />
          )}
          <Tooltip title={title}>
            <span style={{ fontWeight: 500, color: '#3f3f46' }}>
              {title || <Text italic type="secondary" style={{ fontSize: '12px' }}>Not available</Text>}
            </span>
          </Tooltip>
        </Space>
      )
    },
    {
      title: 'CDQ',
      key: 'cdq',
      align: 'center',
      width: 100,
      render: (_, record) => getLqsBadge(record.lqs, record.cdqGrade)
    },
    {
      title: 'IMAGES',
      dataIndex: 'imagesCount',
      key: 'imagesCount',
      align: 'center',
      width: 90,
      render: (count) => count != null ? (
        <Tag style={{ fontWeight: 600, margin: 0, background: '#f4f4f5', border: '1px solid #e4e4e7', color: '#27272a' }}>{count}</Tag>
      ) : <span style={{ color: '#d4d4d8' }}>—</span>
    },
    {
      title: 'DESC LEN',
      dataIndex: 'descLength',
      key: 'descLength',
      align: 'center',
      width: 100,
      render: (len) => len != null ? <Text style={{ fontSize: '12px', color: '#71717a' }}>{len}</Text> : <span style={{ color: '#d4d4d8' }}>—</span>
    },
    {
      title: 'STATUS',
      key: 'status',
      align: 'center',
      width: 120,
      render: (_, record) => getScrapeStatusBadge(record.scrapeStatus || record.status)
    },
    {
      title: 'DATE ADDED',
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center',
      width: 120,
      render: (date) => date ? (
        <Text style={{ fontSize: '12px', color: '#71717a' }}>
          {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
      ) : <span style={{ color: '#d4d4d8' }}>—</span>
    },
    {
      title: 'VIEW',
      key: 'link',
      align: 'center',
      width: 70,
      render: (_, record) => (
        <Tooltip title={`View Live Link on ${seller.marketplace}`}>
          <Button
            type="text"
            shape="circle"
            size="small"
            icon={<ExternalLink size={13} style={{ color: '#71717a' }} />}
            href={record.pageUrl || (seller.marketplace === 'ajio' ? `https://www.ajio.com/p/${record.asinCode}` : seller.marketplace === 'myntra' ? 'https://www.myntra.com' : `https://amazon.in/dp/${record.asinCode}`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
          />
        </Tooltip>
      )
    }
  ];

  return (
    <div id={`seller-${seller._id}`} style={{ marginBottom: '12px' }}>
      <Collapse
        activeKey={isOpen ? ['panel'] : []}
        onChange={(keys) => setIsOpen(keys.includes('panel'))}
        ghost
        expandIconPlacement="end"
        style={{
          background: '#ffffff', borderRadius: '16px', border: '1px solid #e4e4e7',
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}
        items={[
          {
            key: 'panel',
            label: renderHeader(),
            style: { padding: 0 },
            children: (
              <div style={{ borderTop: '1px solid #f4f4f5', background: '#fafafa' }}>
                {/* Filter Operations Toolbar */}
                <div style={{
                  padding: '12px 24px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid #f4f4f5'
                }}>
                  <Space size={12} style={{ flexWrap: 'wrap' }}>
                    <Input
                      placeholder="Filter ASINs or product title..."
                      prefix={<Search size={14} style={{ color: '#a1a1aa' }} />}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ width: 280, borderRadius: '8px' }}
                      allowClear
                    />
                    <Select
                      value={lqsFilter}
                      onChange={val => setLqsFilter(val)}
                      style={{ width: 180 }}
                      variant="outlined"
                      options={[
                        { value: '', label: 'All Quality Scores' },
                        { value: 'high', label: 'Grade A (80-100%)' },
                        { value: 'medium', label: 'Grade B (60-79%)' },
                        { value: 'low', label: 'Grade C/D (<60%)' }
                      ]}
                    />
                  </Space>
                  <Text type="secondary" style={{ fontSize: '12px', fontWeight: 500 }}>
                    {filtered.length} items identified
                  </Text>
                </div>

                {/* Ant Table Implementation */}
                <Table
                  columns={columns}
                  dataSource={filtered}
                  rowKey={record => record._id || record.asinCode}
                  scroll={{ x: 'max-content' }}
                  loading={loading}
                  pagination={{
                    pageSize: 10,
                    size: 'small',
                    showTotal: (total) => `Total ${total} items`,
                    showSizeChanger: false
                  }}
                  locale={{
                    emptyText: (
                      <div style={{ padding: '32px 0' }}>
                        <Package size={32} style={{ color: '#d4d4d8', marginBottom: '8px' }} />
                        <Paragraph strong style={{ color: '#18181b', margin: 0 }}>No matching inventory data found</Paragraph>
                        <Text type="secondary" style={{ fontSize: '12px' }}>Connect through Keepa synchronization or clear filters.</Text>
                      </div>
                    )
                  }}
                  style={{ background: '#ffffff' }}
                  className="modern-ant-table"
                  size="small"
                />
              </div>
            )
          }
        ]}
      />
    </div>
  );
};

/* ── Main Page Component ───────────────────────────────── */
const SellerAsinTrackerPage = () => {
  const [sellers, setSellers] = useState([]);
  const [tokenStatus, setTokenStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingSeller, setSyncingSeller] = useState(null);
  const [keepaKeyMissing, setKeepaKeyMissing] = useState(false);
  const [refreshKeys, setRefreshKeys] = useState({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.sellerTrackerApi.getTrackers();
      if (res.success) {
        setSellers(res.data || []);
        setTokenStatus(res.tokenStatus);
        setKeepaKeyMissing(false);
      }
    } catch (e) {
      if (e.message && e.message.includes('KEEPA_API_KEY')) {
        setKeepaKeyMissing(true);
      } else {
        message.error(`Failed to fetch trackers: ${e.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSyncSeller = async (sellerId) => {
    setSyncingSeller(sellerId);
    try {
      const res = await api.sellerTrackerApi.syncSeller(sellerId);
      if (res.success) {
        message.success(`✅ ${res.seller}: +${res.added} new ASINs synchronized`);
        setRefreshKeys(prev => ({ ...prev, [sellerId]: Date.now() }));
        await loadData();
      }
    } catch (e) {
      message.error(`Sync operation failed: ${e.message}`);
    } finally {
      setSyncingSeller(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await api.sellerTrackerApi.syncAll();
      if (res.success) {
        message.success(`✅ System catalog sync complete. Found ${res.totalAdded} new discovery assets.`);
        const newKeys = {};
        sellers.forEach(s => { newKeys[s._id] = Date.now(); });
        setRefreshKeys(newKeys);
        await loadData();
      }
    } catch (e) {
      message.error(`Total system sync failure: ${e.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const fleetMetrics = useMemo(() => [
    { title: 'Tracked Sellers', value: sellers.length, icon: <Store size={18} />, subtitle: 'Registered Sellers', color: '#6366f1' },
    { title: 'System Inventory', value: sellers.reduce((s, x) => s + (x.dbAsinCount || 0), 0), icon: <Database size={18} />, subtitle: 'Assets in database', color: '#10b981' },
    { title: 'Keepa Matches', value: sellers.reduce((s, x) => s + (x.keepaAsinCount || 0), 0), icon: <Activity size={18} />, subtitle: 'Live seller offers', color: '#2563eb' },
    { title: 'New Discoveries', value: sellers.reduce((s, x) => s + (x.newAsinCount || 0), 0), icon: <Zap size={18} />, subtitle: 'Added in last 24h', prefix: '+', color: '#f59e0b' },
  ], [sellers]);

  /* ── CSS Global Overrides for UI Polish ─── */
  const pageStyles = (
    <style>{`
      .spin { animation: spin 1s linear infinite; } 
      @keyframes spin { to { transform: rotate(360deg); } }
      .modern-ant-table .ant-table {
          background: #fafafa !important;
      }
      .modern-ant-table .ant-table-thead > tr > th {
          background: #fafafa !important;
          font-size: 10px !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em !important;
          font-weight: 700 !important;
          color: #71717a !important;
          border-bottom: 1px solid #f4f4f5 !important;
          padding: 12px 16px !important;
      }
      .modern-ant-table .ant-table-tbody > tr > td {
          padding: 10px 16px !important;
          border-bottom: 1px solid #f4f4f5 !important;
      }
      .modern-ant-table .ant-table-tbody > tr:hover > td {
          background: #f4f4f5/40 !important;
      }
      .tracker-kpi-card {
          border-radius: 16px !important;
          border: 1px solid #e4e4e7 !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.02) !important;
          transition: transform 0.2s ease, box-shadow 0.2s ease !important;
      }
      .tracker-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.04) !important;
      }
      .tracker-page-content {
          padding: 24px 32px !important;
      }
      .seller-header-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
          padding-right: 8px;
      }
      .seller-header-stats {
          display: flex;
          align-items: center;
          gap: 24px;
      }
      @media (max-width: 992px) {
          .tracker-page-content {
              padding: 12px 16px !important;
          }
          .seller-header-container {
              flex-direction: column;
              align-items: flex-start !important;
              gap: 16px;
          }
          .seller-header-stats {
              width: 100%;
              justify-content: space-between;
              flex-wrap: wrap;
              gap: 12px;
          }
      }
      @media (max-width: 576px) {
          .seller-header-stats {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
          }
          .seller-header-stats > * {
              text-align: left !important;
          }
      }
    `}</style>
  );

  if (loading && sellers.length === 0) {
    return <PageLoader message="Analyzing Keepa catalog metrics..." />;
  }

  return (
    <Layout.Content className="tracker-page-content" style={{ background: '#fafafa', minHeight: '100vh' }}>
      {pageStyles}

      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      {/* ── Professional Hero Header ─── */}
      <div style={{ background: '#ffffff', padding: '24px 28px', borderRadius: '16px', border: '1px solid #e4e4e7', marginBottom: '24px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Space size={16} align="center">
              <div style={{
                width: 48, height: 48, borderRadius: '12px', background: '#18181b',
                color: '#ffffff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
              }}>
                <Zap size={24} />
              </div>
              <div>
                <Title level={2} style={{ margin: 0, fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em', color: '#18181b' }}>
                  ASIN Catalog <span style={{ color: '#a1a1aa', fontWeight: 500 }}>Discovery</span>
                </Title>
                <Paragraph type="secondary" style={{ margin: 0, fontSize: '13px', fontWeight: 500 }}>
                  Automated fleet monitoring via Keepa APIs • Autonomous offer acquisition
                </Paragraph>
              </div>
            </Space>
          </Col>
          <Col>
            <Space size={24}>
              {tokenStatus && (
                <div style={{ textAlign: 'right' }} className="d-none d-md-block">
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#a1a1aa' }}>API QUOTA REMAINING</div>
                  <Text strong style={{ fontSize: '15px', color: '#18181b' }}>
                    {tokenStatus.tokensLeft?.toLocaleString()} <span style={{ fontSize: '10px', color: '#a1a1aa', fontWeight: 500 }}>units</span>
                  </Text>
                </div>
              )}
              <Button
                type="primary"
                icon={<RefreshCw size={15} className={syncingAll ? 'spin' : ''} />}
                onClick={handleSyncAll}
                loading={syncingAll}
                size="large"
                style={{
                  borderRadius: '24px', fontWeight: 700, fontSize: '13px',
                  height: '44px', background: '#18181b', borderColor: '#18181b',
                  display: 'inline-flex', alignItems: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
              >
                Sync All Sellers
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* ── Keepa Missing Warning Banner ─── */}
      {keepaKeyMissing && (
        <div style={{ marginBottom: '24px' }}>
          <Alert
            message={
              <Text strong style={{ color: '#92400e', fontSize: '15px' }}>
                Keepa API Config Required
              </Text>
            }
            description={
              <div>
                <Paragraph style={{ color: '#92400e', fontSize: '13px', margin: '4px 0 12px 0' }}>
                  Please provision valid credentials to connect your platform and automate strategic ASIN inventory tracking across your seller fleets.
                </Paragraph>
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    href="https://keepa.com/#!api"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ background: '#d97706', borderColor: '#d97706', fontWeight: 700, borderRadius: '20px' }}
                  >
                    Get API Access
                  </Button>
                  <Tag style={{ background: '#ffffff', border: '1px solid #fcd34d', borderRadius: '6px', padding: '2px 10px' }}>
                    <code style={{ color: '#b45309' }}>KEEPA_API_KEY=•••</code>
                  </Tag>
                </Space>
              </div>
            }
            type="warning"
            showIcon
            icon={<AlertTriangle size={20} style={{ color: '#d97706' }} />}
            style={{
              borderRadius: '16px', border: '1px solid #fef3c7',
              background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', padding: '16px 24px'
            }}
          />
        </div>
      )}

      {/* ── Fleet Metrics Statistics Board ─── */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '14px' }}>
          <BarChart2 size={15} style={{ color: '#71717a' }} />
          <Text type="secondary" style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fleet Intelligence Overview
          </Text>
        </div>

        <Row gutter={[16, 16]}>
          {fleetMetrics.map((metric, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <Card className="tracker-kpi-card">
                <Statistic
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#a1a1aa' }}>{metric.title}</span>
                      <div style={{
                        width: 32, height: 32, borderRadius: '8px', background: `${metric.color}15`,
                        color: metric.color, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {metric.icon}
                      </div>
                    </div>
                  }
                  value={metric.value}
                  styles={{ content: { fontWeight: 800, fontSize: '26px', color: '#18181b', letterSpacing: '-0.02em' } }}
                  formatter={(value) => (
                    <span>
                      {metric.prefix || ''}
                      {value.toLocaleString()}
                    </span>
                  )}
                />
                <div style={{ marginTop: '4px' }}>
                  <Text style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500 }}>{metric.subtitle}</Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </div>

      {/* ── Seller Catalog Listing ─── */}
      <Card
        styles={{
          header: { borderBottom: '1px solid #e4e4e7', padding: '16px 24px' },
          body: { background: '#fafafa', padding: '20px 24px' }
        }}
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <Space size={10}>
              <Store size={18} style={{ color: '#6366f1' }} />
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#18181b' }}>Managed Sellers</span>
              <Badge
                count={`${sellers.length} Active`}
                style={{ background: '#f4f4f5', color: '#71717a', border: '1px solid #e4e4e7', fontWeight: 700, borderRadius: '12px' }}
              />
            </Space>
            <Button
              icon={<RefreshCw size={12} className={loading ? 'spin' : ''} />}
              onClick={loadData}
              size="small"
              style={{ fontWeight: 600, fontSize: '11px', borderRadius: '20px', border: '1px solid #e4e4e7', padding: '2px 12px' }}
            >
              Refresh Fleet
            </Button>
          </div>
        }
        style={{ borderRadius: '16px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px rgba(0,0,0,0.02)', overflow: 'hidden' }}
      >
        {sellers.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '56px 0', background: '#ffffff', borderRadius: '16px', border: '2px dashed #e4e4e7' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: '#fafafa', border: '1px solid #f4f4f5', marginBottom: '16px' }}>
              <Store size={28} style={{ color: '#a1a1aa' }} />
            </div>
            <Title level={4} style={{ margin: 0, color: '#18181b', fontWeight: 700 }}>Connect your first seller</Title>
            <Paragraph type="secondary" style={{ fontSize: '13px', marginTop: '4px', marginBottom: '20px' }}>
              You haven't initialized Amazon sellers inside the global dashboard catalog tracker yet.
            </Paragraph>
            <Button
              type="primary"
              icon={<Plus size={16} />}
              style={{ background: '#6366f1', borderColor: '#6366f1', fontWeight: 700, height: '40px', borderRadius: '20px' }}
            >
              Add New Seller
            </Button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {sellers.map(seller => (
              <SellerAsinPanel
                key={seller._id}
                seller={seller}
                onSync={handleSyncSeller}
                syncing={syncingSeller === seller._id}
                refreshKey={refreshKeys[seller._id]}
              />
            ))}
          </div>
        )}
      </Card>
    </Layout.Content>
  );
};

export default SellerAsinTrackerPage;
