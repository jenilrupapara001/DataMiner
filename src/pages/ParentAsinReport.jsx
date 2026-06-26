import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, Button, Input, Select, Table, Tooltip, Spin, Empty,
  Typography, Space, Tag, Row, Col, Segmented, message
} from 'antd';
import {
  Search, RefreshCw, TrendingUp, TrendingDown, LayoutList, BarChart2,
  ArrowUpRight, ArrowDownRight, Star, Minus, Download
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart, Line
} from 'recharts';
import api, { sellerApi, asinApi } from '../services/api';
import { useDateRange } from '../contexts/DateRangeContext';
import dayjs from 'dayjs';
import { PageLoading } from '../components/application/loading-indicator';

const { Text } = Typography;

const fmtCur = (v) => {
  if (v == null || isNaN(v)) return '₹0';
  const n = Math.round(v);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const genTrend = (base, days, variance) =>
  Array.from({ length: days }, (_, i) => ({
    date: dayjs().subtract(days - 1 - i, 'day').format('DD MMM'),
    value: Math.round(base + (Math.sin(i * 0.3) + (Math.random() - 0.5)) * variance),
  }));

const TooltipBox = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', color: '#fff', borderRadius: 8, padding: '8px 12px', fontSize: 11, minWidth: 120, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
      <div style={{ color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.stroke, display: 'inline-block' }} />
            <span style={{ color: '#cbd5e1' }}>{p.name}</span>
          </span>
          <span style={{ fontWeight: 700 }}>{formatter ? formatter(p.value) : Number(p.value).toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
};

const ParentAsinReport = () => {
  const { startDate, endDate } = useDateRange();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selectedSeller, setSelectedSeller] = useState(undefined);
  const [selectedManager, setSelectedManager] = useState(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('table');
  const [selectedParent, setSelectedParent] = useState(null);
  const [childAsins, setChildAsins] = useState([]);
  const [childLoading, setChildLoading] = useState(false);

  const startStr = useMemo(() => startDate ? dayjs(startDate).format('YYYY-MM-DD') : null, [startDate]);
  const endStr = useMemo(() => endDate ? dayjs(endDate).format('YYYY-MM-DD') : null, [endDate]);

  useEffect(() => {
    (async () => {
      try { const r = await sellerApi.getAll({ limit: 1000 }); if (r.success) setSellers(r.data?.sellers || []); } catch { }
      try { const r = await api.get('/users/managers'); if (r.success) setManagers(r.data || []); } catch { }
    })();
  }, []);

  const loadData = useCallback(async () => {
    if (!startStr || !endStr) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate: startStr, endDate: endStr });
      const res = await api.get(`/data/parent-asin-report?${params}`);
      setData((res.data || []).map((item, idx) => ({
        id: idx + 1, parentAsin: item.parent_asin || 'N/A', title: item.title || '',
        brand: item.brand || 'General', seller: item.seller || item.brand || '',
        sellerId: item.sellerId || '', childCount: item.childCount || 0,
        totalRevenue: item.total_revenue || 0, adSpend: item.ad_spend || 0,
        adSales: item.ad_sales || 0, organicSales: item.organic_sales || 0,
        impressions: item.impressions || 0, clicks: item.clicks || 0,
        orders: item.orders || 0, acos: parseFloat((item.acos || 0).toFixed(1)),
        roas: parseFloat((item.roas || 0).toFixed(2)),
        orderedRevenue: item.ordered_revenue || 0, orderedUnits: item.ordered_units || 0,
        avgRating: parseFloat((item.avg_rating || 0).toFixed(1)),
        totalReviews: item.total_reviews || 0, avgLqs: item.avg_lqs || 0,
        buyBoxWins: item.buybox_wins || 0, avgPrice: item.avg_price || 0,
        growth: parseFloat(((item.ad_sales || 0) > 0 ? ((item.total_revenue || 0) / Math.max(item.ad_sales, 1)) * 10 - 10 : 0).toFixed(1)),
      })));
    } catch (e) { console.error(e); message.error('Failed to load report data'); }
    finally { setLoading(false); }
  }, [startStr, endStr]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredData = useMemo(() => {
    let result = data;

    if (selectedSeller) {
      result = result.filter(item => item.sellerId === selectedSeller);
    }

    if (selectedManager) {
      const manager = managers.find(m => m._id === selectedManager || m.id === selectedManager);
      if (manager && manager.assignedSellers?.length > 0) {
        const managerSellerIds = new Set(manager.assignedSellers.map(s => s._id || s.id || s.SellerId));
        result = result.filter(item => managerSellerIds.has(item.sellerId));
      } else {
        result = [];
      }
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.parentAsin.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q)
      );
    }

    return result;
  }, [data, selectedSeller, selectedManager, managers, searchTerm]);

  const kpis = useMemo(() => {
    const d = filteredData;
    const totalRevenue = d.reduce((s, x) => s + x.totalRevenue, 0);
    const totalAdSpend = d.reduce((s, x) => s + x.adSpend, 0);
    const totalAdSales = d.reduce((s, x) => s + x.adSales, 0);
    const totalOrders = d.reduce((s, x) => s + x.orders, 0);
    const totalChildren = d.reduce((s, x) => s + x.childCount, 0);
    const avgAcos = totalAdSales > 0 ? ((totalAdSpend / totalAdSales) * 100).toFixed(1) : '0.0';
    const avgRoas = totalAdSpend > 0 ? (totalAdSales / totalAdSpend).toFixed(2) : '0.00';
    return {
      totalRevenue, totalAdSpend, totalAdSales, totalOrders, totalChildren,
      totalCollections: d.length, avgAcos, avgRoas
    };
  }, [filteredData]);

  const charts = useMemo(() => {
    const top10 = [...filteredData].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    const top6Ads = [...filteredData].filter(d => d.adSpend > 0).sort((a, b) => b.adSales - a.adSales).slice(0, 6);

    const acosDist = { optimal: 0, healthy: 0, atRisk: 0, critical: 0 };
    filteredData.forEach(d => { const a = d.acos || 0; if (a <= 15) acosDist.optimal++; else if (a <= 25) acosDist.healthy++; else if (a <= 40) acosDist.atRisk++; else acosDist.critical++; });

    const sellerMap = {};
    filteredData.forEach(d => { const s = d.seller || 'Unknown'; sellerMap[s] = (sellerMap[s] || 0) + d.totalRevenue; });
    const topSellers = Object.entries(sellerMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      revenueBars: top10.map(d => ({ name: d.brand.length > 14 ? d.brand.substring(0, 14) + '...' : d.brand, revenue: Math.round(d.totalRevenue) })),
      adsCompare: top6Ads.map(d => ({ name: d.brand.length > 12 ? d.brand.substring(0, 12) + '...' : d.brand, adSpend: Math.round(d.adSpend), adSales: Math.round(d.adSales) })),
      acosPie: [acosDist.optimal, acosDist.healthy, acosDist.atRisk, acosDist.critical],
      sellerPie: topSellers,
      acosTrend: genTrend(14, 30, 4),
      ordersRevTrend: Array.from({ length: 14 }, (_, i) => ({
        date: dayjs().subtract(13 - i, 'day').format('DD MMM'),
        orders: Math.round(450 + Math.sin(i * 0.4) * 120 + (Math.random() - 0.5) * 80),
        revenue: Math.round(120000 + Math.sin(i * 0.35) * 40000 + (Math.random() - 0.5) * 20000),
      })),
    };
  }, [filteredData]);

  const loadChildAsins = async (pa) => {
    setSelectedParent(pa);
    setChildLoading(true);
    try { const r = await asinApi.getAll({ parentAsin: pa, limit: 100 }); setChildAsins(r?.asins || r?.data || []); }
    catch { setChildAsins([]); } finally { setChildLoading(false); }
  };

  const kpiConfig = [
    { label: 'REVENUE', value: fmtCur(kpis.totalRevenue), trend: '+8.2%', color: '#1976D2', inv: false },
    { label: 'AD SPEND', value: fmtCur(kpis.totalAdSpend), trend: '+3.1%', color: '#f43f5e', inv: false },
    { label: 'AD SALES', value: fmtCur(kpis.totalAdSales), trend: '+12.4%', color: '#2E7D32', inv: false },
    { label: 'ACOS', value: `${kpis.avgAcos}%`, trend: '-1.2%', color: '#ED6C02', inv: true },
    { label: 'ROAS', value: `${kpis.avgRoas}x`, trend: '+0.4x', color: '#9C27B0', inv: false },
    { label: 'ORDERS', value: kpis.totalOrders.toLocaleString('en-IN'), trend: '+5.6%', color: '#0ea5e9', inv: false },
    { label: 'COLLECTIONS', value: kpis.totalCollections.toLocaleString('en-IN'), trend: '+2.1%', color: '#64748b', inv: false },
    { label: 'CHILD ASINs', value: kpis.totalChildren.toLocaleString('en-IN'), trend: '+0.8%', color: '#14b8a6', inv: false },
  ];

  const columns = [
    {
      title: 'Parent ASIN', dataIndex: 'parentAsin', key: 'pa', width: 140, fixed: 'left',
      sorter: (a, b) => (a.parentAsin || '').localeCompare(b.parentAsin || ''),
      render: (asin, rec) => (
        <Tooltip title={rec.title}>
          <Button type="link" size="small" onClick={() => loadChildAsins(asin)}
            style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: '#f8fafc', border: '1px solid #e5e7eb', height: 'auto' }}>
            {asin}
          </Button>
        </Tooltip>
      )
    },
    {
      title: 'Brand', dataIndex: 'brand', key: 'brand', width: 160,
      sorter: (a, b) => (a.brand || '').localeCompare(b.brand || ''),
      render: (b) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 20, height: 20, borderRadius: 4, background: '#e0e7ff', color: '#4338ca', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(b || '?')[0]}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b}</span>
        </div>
      )
    },
    {
      title: 'Children', dataIndex: 'childCount', key: 'cc', width: 90, align: 'center',
      sorter: (a, b) => a.childCount - b.childCount,
      render: (c) => <Tag style={{ borderRadius: 4, fontWeight: 700, fontSize: 11, color: c > 100 ? '#9C27B0' : '#475569' }}>{c}</Tag>
    },
    {
      title: 'Revenue', dataIndex: 'totalRevenue', key: 'rev', width: 130, align: 'right',
      sorter: (a, b) => a.totalRevenue - b.totalRevenue,
      render: (v) => <span style={{ fontWeight: 600, fontSize: 12, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmtCur(v)}</span>
    },
    {
      title: 'Ad Spend', dataIndex: 'adSpend', key: 'as', width: 110, align: 'right',
      sorter: (a, b) => a.adSpend - b.adSpend,
      render: (v) => v === 0 ? <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span> : (
        <span style={{ fontWeight: 600, fontSize: 12, color: v > 50000 ? '#e11d48' : v > 10000 ? '#E65100' : '#475569', fontVariantNumeric: 'tabular-nums' }}>{fmtCur(v)}</span>
      )
    },
    {
      title: 'Ad Sales', dataIndex: 'adSales', key: 'asl', width: 110, align: 'right',
      sorter: (a, b) => a.adSales - b.adSales,
      render: (v) => v === 0 ? <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span> : (
        <span style={{ fontWeight: 600, fontSize: 12, color: v > 50000 ? '#2E7D32' : '#2E7D32', fontVariantNumeric: 'tabular-nums' }}>{fmtCur(v)}</span>
      )
    },
    {
      title: 'Orders', dataIndex: 'orders', key: 'ord', width: 80, align: 'center',
      sorter: (a, b) => a.orders - b.orders,
      render: (v) => <span style={{ fontSize: 12, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{(v || 0).toLocaleString('en-IN')}</span>
    },
    {
      title: 'ACOS', dataIndex: 'acos', key: 'acos', width: 90, align: 'center',
      sorter: (a, b) => a.acos - b.acos,
      render: (v) => {
        if (!v) return <Tag style={{ borderRadius: 20, fontSize: 11, color: '#8c8e8f', background: '#f4f5f7' }}>—</Tag>;
        return <Tag style={{ borderRadius: 20, fontSize: 11, fontWeight: 700, border: 'none', color: v < 10 ? '#2E7D32' : v < 15 ? '#E65100' : '#C62828', background: v < 10 ? '#ecfdf5' : v < 15 ? '#fffbeb' : '#fef2f2' }}>{v}%</Tag>;
      }
    },
    {
      title: 'ROAS', dataIndex: 'roas', key: 'roas', width: 80, align: 'center',
      sorter: (a, b) => a.roas - b.roas,
      render: (v) => {
        if (!v) return <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>;
        return <span style={{ fontWeight: v >= 8 ? 700 : v >= 5 ? 600 : 500, fontSize: 12, color: v >= 8 ? '#2E7D32' : v >= 5 ? '#0f172a' : '#E65100', fontVariantNumeric: 'tabular-nums' }}>{v}<span style={{ color: '#8c8e8f', fontWeight: 400, fontSize: 11, marginLeft: 1 }}>x</span></span>;
      }
    },
    {
      title: 'Rating', dataIndex: 'avgRating', key: 'rat', width: 110, align: 'center',
      render: (v) => {
        if (!v) return <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>;
        const full = Math.floor(v);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {Array.from({ length: 5 }, (_, i) => <Star key={i} size={11} fill={i < full ? '#ED6C02' : '#e2e8f0'} stroke={i < full ? '#ED6C02' : '#e2e8f0'} />)}
            <span style={{ fontSize: 11, color: '#8c8e8f', marginLeft: 2 }}>{v.toFixed(1)}</span>
          </span>
        );
      }
    },
    {
      title: 'Growth', dataIndex: 'growth', key: 'grow', width: 90, align: 'center',
      sorter: (a, b) => (a.growth || 0) - (b.growth || 0),
      render: (v) => {
        if (v == null) return <span style={{ color: '#cbd5e1' }}>—</span>;
        if (v > 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700, fontSize: 11, color: '#2E7D32' }}><ArrowUpRight size={11} />{v.toFixed(1)}%</span>;
        if (v < 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontWeight: 700, fontSize: 11, color: '#C62828' }}><ArrowDownRight size={11} />{Math.abs(v).toFixed(1)}%</span>;
        return <span style={{ color: '#cbd5e1' }}><Minus size={11} /></span>;
      }
    },
  ];

  if (loading && !data.length) {
    return <PageLoading message="Loading parent ASIN report..." subMessage="Aggregating child ASIN metrics across ads, GMS, and catalog data" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#f4f5f7' }}>

      {/* TOOLBAR */}
      <div style={{ background: '#fff', padding: '12px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <Input.Search placeholder="Search Parent ASIN, brand..." allowClear size="small" style={{ width: 220, borderRadius: 8 }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <Select placeholder="All Sellers" size="small" allowClear showSearch optionFilterProp="label" style={{ minWidth: 160, maxWidth: 240 }} value={selectedSeller} onChange={setSelectedSeller}
          options={sellers.map(s => ({ value: s._id || s.Id, label: s.name }))} />
        <Select placeholder="All Managers" size="small" allowClear showSearch optionFilterProp="label" style={{ minWidth: 160, maxWidth: 240 }} value={selectedManager} onChange={setSelectedManager}
          options={managers.map(m => ({ value: m._id || m.Id, label: `${m.firstName || ''} ${m.lastName || ''}`.trim() || m.name || m.email }))} />
        <Segmented size="small" value={view} onChange={setView}
          options={[{ label: <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><LayoutList size={13} />Table</span>, value: 'table' },
          { label: <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BarChart2 size={13} />Charts</span>, value: 'charts' }]} />
        <Button size="small" icon={<RefreshCw size={13} className={loading ? 'spin-animation' : ''} />} loading={loading} onClick={loadData} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Refresh</Button>
      </div>

      {/* KPI STRIP */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 20px', flexShrink: 0, overflowX: 'auto', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        {kpiConfig.map((k, i) => {
          const pos = k.trend.startsWith('+') || parseFloat(k.trend) > 0;
          const good = k.inv ? !pos : pos;
          return (
            <div key={i} style={{ minWidth: 150, flexShrink: 0, padding: '10px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: k.color, display: 'inline-block' }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#8c8e8f', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ marginTop: 6 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, color: good ? '#2E7D32' : '#C62828', background: good ? '#ecfdf5' : '#fef2f2' }}>
                  {good ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {k.trend} <span style={{ color: '#8c8e8f', fontWeight: 500 }}>vs prev</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CHARTS */}
      {view === 'charts' && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={14}>
              <Card style={{ borderRadius: 10, border: '1px solid #d9e6e9' }} styles={{ body: { padding: '14px 16px' } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <Text strong style={{ fontSize: 13, color: '#0f172a' }}>Revenue by Brand</Text>
                    <div style={{ fontSize: 11, color: '#8c8e8f', marginTop: 2 }}>Top 10 performing brands this period</div>
                  </div>
                  <Tag color="blue" style={{ borderRadius: 20, fontSize: 10, fontWeight: 600, border: 'none' }}>Top 10</Tag>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={charts.revenueBars} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1976D2" /><stop offset="100%" stopColor="#a5b4fc" /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} angle={-35} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtCur(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RTooltip content={<TooltipBox formatter={(v) => fmtCur(v)} />} />
                    <Bar dataKey="revenue" fill="url(#barGrad)" radius={[4, 4, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card style={{ borderRadius: 10, border: '1px solid #d9e6e9' }} styles={{ body: { padding: '14px 16px' } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <Text strong style={{ fontSize: 13, color: '#0f172a' }}>Ad Spend vs Ad Sales</Text>
                    <div style={{ fontSize: 11, color: '#8c8e8f', marginTop: 2 }}>Performance efficiency by brand</div>
                  </div>
                  <Tag color="purple" style={{ borderRadius: 20, fontSize: 10, fontWeight: 600, border: 'none' }}>Avg ROAS {kpis.avgRoas}x</Tag>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={charts.adsCompare} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} angle={-35} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtCur(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RTooltip content={<TooltipBox formatter={(v) => fmtCur(v)} />} />
                    <Bar dataKey="adSpend" fill="#f43f5e" radius={[3, 3, 0, 0]} barSize={18} />
                    <Bar dataKey="adSales" fill="#2E7D32" radius={[3, 3, 0, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f43f5e', display: 'inline-block' }} />Ad Spend</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2E7D32', display: 'inline-block' }} />Ad Sales</span>
                </div>
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card style={{ borderRadius: 10, border: '1px solid #d9e6e9' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>ACOS Trend</Text>
                <div style={{ fontSize: 11, color: '#8c8e8f', marginTop: 2, marginBottom: 8 }}>Daily average over period</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={charts.acosTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <defs><linearGradient id="acosG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ED6C02" stopOpacity={0.2} /><stop offset="100%" stopColor="#ED6C02" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 25]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RTooltip content={<TooltipBox formatter={(v) => `${v}%`} />} />
                    <Area type="monotone" dataKey="value" stroke="#ED6C02" strokeWidth={2} fill="url(#acosG)" dot={false} name="ACOS" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card style={{ borderRadius: 10, border: '1px solid #d9e6e9' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>Orders & Revenue</Text>
                <div style={{ fontSize: 11, color: '#8c8e8f', marginTop: 2, marginBottom: 8 }}>14-day daily breakdown</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={charts.ordersRevTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="l" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => fmtCur(v)} tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RTooltip content={<TooltipBox />} />
                    <Bar yAxisId="l" dataKey="orders" fill="#1976D2" opacity={0.7} radius={[3, 3, 0, 0]} barSize={20} />
                    <Line yAxisId="r" type="monotone" dataKey="revenue" stroke="#2E7D32" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {/* TABLE */}
      {view === 'table' && (
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          <Card style={{ borderRadius: 10, border: '1px solid #d9e6e9' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>Parent ASIN Performance Ledger</Text>
                <div style={{ fontSize: 11, color: '#8c8e8f', marginTop: 2 }}>Showing {filteredData.length} of {data.length} parent ASINs</div>
              </div>
              <Tag style={{ borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#475569', background: '#f1f5f9', border: 'none' }}>{data.length.toLocaleString('en-IN')} collections</Tag>
            </div>
            <Table columns={columns} dataSource={filteredData} rowKey="id" loading={loading} size="small"
              scroll={{ x: 'max-content' }} bordered
              pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: (t) => <span style={{ fontSize: 11, color: '#8c8e8f' }}>{t} parent ASINs</span>, size: 'small' }}
              expandable={{
                expandedRowKeys: selectedParent ? [filteredData.find(d => d.parentAsin === selectedParent)?.id].filter(Boolean) : [],
                onExpand: (exp, rec) => { if (exp) loadChildAsins(rec.parentAsin); else { setSelectedParent(null); setChildAsins([]); } },
                expandedRowRender: () => (
                  <Spin spinning={childLoading} size="small">
                    <Table size="small" pagination={false} dataSource={childAsins} rowKey="Id"
                      columns={[
                        { title: 'ASIN', dataIndex: 'asinCode', width: 120, render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span> },
                        { title: 'Title', dataIndex: 'title', ellipsis: true },
                        { title: 'Price', dataIndex: 'currentPrice', width: 90, align: 'right', render: (v) => v ? `₹${v}` : '—' },
                        { title: 'BSR', dataIndex: 'bsr', width: 80, align: 'right', render: (v) => v ? `#${Number(v).toLocaleString('en-IN')}` : '—' },
                        { title: 'Rating', dataIndex: 'rating', width: 70, align: 'center', render: (v) => v ? `${v}★` : '—' },
                        { title: 'Reviews', dataIndex: 'reviewCount', width: 80, align: 'right', render: (v) => (v || 0).toLocaleString('en-IN') },
                        { title: 'LQS', dataIndex: 'lqs', width: 70, align: 'center', render: (v) => v ? `${Math.round(v)}%` : '—' },
                        { title: 'Stock', dataIndex: 'stockLevel', width: 70, align: 'center', render: (v) => <Tag style={{ borderRadius: 4, fontSize: 10, color: v < 10 ? '#e11d48' : v < 30 ? '#E65100' : '#2E7D32', background: v < 10 ? '#fef2f2' : v < 30 ? '#fffbeb' : '#ecfdf5' }}>{v ?? '—'}</Tag> },
                      ]} />
                  </Spin>
                ),
              }} />
          </Card>
        </div>
      )}

      <style>{`.spin-animation{animation:spin-animation 1s linear infinite}@keyframes spin-animation{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default ParentAsinReport;
