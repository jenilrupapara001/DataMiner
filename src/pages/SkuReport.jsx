import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
  IndianRupee, Package, Percent, Activity, TrendingUp,
  Filter, BarChart3, Download, Search, RefreshCw, Layers, Target, Coins,
  ArrowUpRight, ArrowDownRight, Database, Hash
} from 'lucide-react';
import { useDateRange } from '../contexts/DateRangeContext';
import api from '../services/api';
import {
  Space, Button, Table, Card, Progress, Row, Col, Tag, Typography,
  Input, Select, Skeleton, Tooltip, Divider, Empty, Segmented
} from 'antd';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import dayjs from 'dayjs';
import { PageLoading } from '../components/application/loading-indicator';

const { Text } = Typography;

const COLORS = ['#1e293b', '#0288D1', '#2E7D32', '#ED6C02', '#9C27B0', '#0ea5e9', '#f43f5e', '#ED6C02'];

const fmtCur = (v) => {
  if (v == null || isNaN(v)) return '₹0';
  const n = Math.round(v);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const fmtCompact = (v) => {
  if (v == null || isNaN(v)) return '0';
  const n = Math.round(v);
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString('en-IN');
};

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

const SkuReport = () => {
  const { startDate, endDate, updateDateRange } = useDateRange();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [view, setView] = useState('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [kpiSummary, setKpiSummary] = useState({ total_revenue: 0, units_sold: 0, ad_sales: 0, ad_spend: 0, clicks: 0, impressions: 0, sessions: 0 });
  const [categoryMix, setCategoryMix] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, category]);

  const loadSkuData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        startDate: startDate ? dayjs(startDate).format('YYYY-MM-DD') : null,
        endDate: endDate ? dayjs(endDate).format('YYYY-MM-DD') : null,
        search: debouncedSearch || undefined,
        category: category !== 'all' ? category : undefined,
        page: currentPage, limit: pageSize
      };
      const cleanParams = Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null && v !== 'null'));
      const query = new URLSearchParams(cleanParams).toString();
      const res = await api.get(`/data/sku-report?${query}`);

      const rawData = res.data || [];
      setData(rawData.map((item, idx) => ({
        id: (currentPage - 1) * pageSize + idx + 1,
        sku: item.sku || 'N/A',
        asin: item.asin || 'N/A',
        title: item.title || '',
        category: item.category || 'General',
        revenue: item.total_revenue || 0,
        units: item.units_sold || 0,
        aov: item.units_sold > 0 ? (item.total_revenue / item.units_sold).toFixed(2) : '0.00',
        acos: item.ad_sales > 0 ? ((item.ad_spend / item.ad_sales) * 100).toFixed(1) : '0.0',
        roas: item.ad_spend > 0 ? (item.ad_sales / item.ad_spend).toFixed(2) : '0.00',
        clicks: item.clicks || 0,
        impressions: item.impressions || 0,
        sessions: item.sessions || 0,
        conversion: item.clicks > 0 ? ((item.units_sold / item.clicks) * 100).toFixed(1) : '0.0',
      })));
      setTotalCount(res.pagination?.total || rawData.length);
      if (res.kpis) setKpiSummary(res.kpis);
      if (res.categories) setCategoryMix(res.categories);
    } catch (error) {
      console.error('Failed to load SKU data:', error);
    }
    setLoading(false);
  }, [startDate, endDate, debouncedSearch, category, currentPage, pageSize]);

  useEffect(() => { loadSkuData(); }, [loadSkuData]);

  const kpis = useMemo(() => {
    const adSales = kpiSummary.ad_sales || 0;
    const adSpend = kpiSummary.ad_spend || 0;
    const acos = adSales > 0 ? ((adSpend / adSales) * 100).toFixed(1) : '0.0';
    return [
      { label: 'REVENUE', value: fmtCur(kpiSummary.total_revenue), trend: '+8.2%', color: '#1e293b', inv: false },
      { label: 'UNITS SOLD', value: (kpiSummary.units_sold || 0).toLocaleString('en-IN'), trend: '+5.1%', color: '#0288D1', inv: false },
      { label: 'AD SPEND', value: fmtCur(adSpend), trend: '+3.1%', color: '#f43f5e', inv: false },
      { label: 'ACOS', value: `${acos}%`, trend: '-1.2%', color: '#ED6C02', inv: true },
      { label: 'SESSIONS', value: (kpiSummary.sessions || 0).toLocaleString('en-IN'), trend: '+2.4%', color: '#2E7D32', inv: false },
      { label: 'CLICKS', value: (kpiSummary.clicks || 0).toLocaleString('en-IN'), trend: '+4.0%', color: '#9C27B0', inv: false },
    ];
  }, [kpiSummary]);

  const handleExport = useCallback(() => {
    const headers = ['SKU', 'ASIN', 'Product', 'Category', 'Revenue', 'Units', 'AOV', 'ACOS', 'Conversion'];
    const csvRows = [headers.join(',')];
    data.forEach(r => {
      csvRows.push([r.sku, r.asin, `"${(r.title || '').replace(/"/g, '""')}"`, r.category, r.revenue, r.units, r.aov, `${r.acos}%`, `${r.conversion}%`].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sku_report_${dayjs().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data]);

  const chartData = useMemo(() => {
    const top10 = [...data].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    return {
      revenue: top10.map(d => ({ name: d.sku.length > 12 ? d.sku.substring(0, 12) + '...' : d.sku, revenue: Math.round(d.revenue), units: d.units })),
      donut: categoryMix.length > 0 ? categoryMix.map(c => ({ name: c.category?.length > 18 ? c.category.substring(0, 18) + '...' : (c.category || 'General'), value: Math.round(c.revenue) })) : [{ name: 'No data', value: 1 }],
    };
  }, [data, categoryMix]);

  const acosBadge = (acos) => {
    const v = parseFloat(acos);
    if (!v) return <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>;
    return <span style={{ fontSize: 11, fontWeight: 700, color: v < 15 ? '#2E7D32' : v < 25 ? '#E65100' : '#C62828', background: v < 15 ? '#ecfdf5' : v < 25 ? '#fffbeb' : '#fef2f2', padding: '2px 8px', borderRadius: 20 }}>{v}%</span>;
  };

  const columns = [
    { title: 'SKU / ASIN', dataIndex: 'sku', key: 'sku', width: 180, fixed: 'left',
      sorter: (a, b) => (a.sku || '').localeCompare(b.sku || ''),
      render: (sku, record) => (
        <div>
          <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#0f172a', background: '#f8fafc', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>{sku}</span>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, fontFamily: 'monospace' }}>{record.asin}</div>
        </div>
      ) },
    { title: 'Product', dataIndex: 'title', key: 'title', ellipsis: true,
      sorter: (a, b) => (a.title || '').localeCompare(b.title || ''),
      render: (title) => <Text style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>{title || 'N/A'}</Text> },
    { title: 'Category', dataIndex: 'category', key: 'category', width: 120,
      sorter: (a, b) => (a.category || '').localeCompare(b.category || ''),
      render: (cat) => <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{cat || 'General'}</span> },
    { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', width: 120, align: 'right',
      sorter: (a, b) => a.revenue - b.revenue,
      render: (v) => <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmtCur(v)}</span> },
    { title: 'Units', dataIndex: 'units', key: 'units', width: 90, align: 'right',
      sorter: (a, b) => a.units - b.units,
      render: (v) => <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{(v || 0).toLocaleString('en-IN')}</span> },
    { title: 'CVR', dataIndex: 'conversion', key: 'cvr', width: 85, align: 'center',
      sorter: (a, b) => parseFloat(a.conversion) - parseFloat(b.conversion),
      render: (val) => { const v = parseFloat(val); return acosBadge(v >= 15 ? '0' : v >= 5 ? '16' : '26'); } },
    { title: 'ACOS', dataIndex: 'acos', key: 'acos', width: 85, align: 'center',
      sorter: (a, b) => parseFloat(a.acos) - parseFloat(b.acos),
      render: (acos) => acosBadge(acos) },
    { title: 'ROAS', dataIndex: 'roas', key: 'roas', width: 80, align: 'center',
      sorter: (a, b) => parseFloat(a.roas) - parseFloat(b.roas),
      render: (v) => {
        const num = parseFloat(v);
        if (!num) return <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>;
        return <span style={{ fontWeight: num >= 8 ? 700 : num >= 5 ? 600 : 500, fontSize: 12, color: num >= 8 ? '#2E7D32' : num >= 5 ? '#0f172a' : '#E65100' }}>{num}<span style={{ color: '#8c8e8f', fontWeight: 400, fontSize: 11, marginLeft: 1 }}>x</span></span>;
      } },
  ];

  if (loading && !data.length) {
    return <PageLoading message="Loading SKU report..." subMessage="Fetching product analytics and metrics" />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#f4f5f7' }}>

      {/* TOOLBAR */}
      <div style={{ background: '#fff', padding: '12px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
        <Input.Search placeholder="Search SKU, ASIN..." allowClear size="small" style={{ width: 220, borderRadius: 8 }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <Select placeholder="All Categories" size="small" allowClear showSearch optionFilterProp="label" style={{ minWidth: 160, maxWidth: 240 }} value={category !== 'all' ? category : undefined} onChange={v => setCategory(v || 'all')}
          options={[
            { value: 'General', label: 'General' }, { value: 'Clothing', label: 'Clothing' },
            { value: 'Footwear', label: 'Footwear' }, { value: 'Accessories', label: 'Accessories' },
          ]} />
        <Segmented size="small" value={view} onChange={setView}
          options={[{ label: 'Table', value: 'table' }, { label: 'Charts', value: 'charts' }]} />
        <Button size="small" icon={<RefreshCw size={13} className={loading ? 'spin-animation' : ''} />} loading={loading} onClick={loadSkuData} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Refresh</Button>
        <Button size="small" icon={<Download size={13} />} onClick={handleExport} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Export</Button>
      </div>

      {/* KPI STRIP */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 20px', flexShrink: 0, overflowX: 'auto', background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
        {kpis.map((k, i) => {
          const pos = k.trend.startsWith('+') || parseFloat(k.trend) > 0;
          const good = k.inv ? !pos : pos;
          return (
            <div key={i} style={{ minWidth: 140, flexShrink: 0, padding: '10px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, transition: 'all 0.2s' }}
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
            <Col xs={24} lg={16}>
              <Card style={{ borderRadius: 10, border: '1px solid #d9e6e9' }} styles={{ body: { padding: '14px 16px' } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <Text strong style={{ fontSize: 13, color: '#0f172a' }}>Revenue vs Units</Text>
                    <div style={{ fontSize: 11, color: '#8c8e8f', marginTop: 2 }}>Top 10 SKUs on current page</div>
                  </div>
                  <Tag color="blue" style={{ borderRadius: 20, fontSize: 10, fontWeight: 600, border: 'none' }}>Current Page</Tag>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData.revenue} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} angle={-35} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="l" tickFormatter={fmtCompact} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RTooltip content={<TooltipBox />} />
                    <Bar yAxisId="l" dataKey="revenue" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={24} name="Revenue" />
                    <Bar yAxisId="r" dataKey="units" fill="#2E7D32" radius={[4, 4, 0, 0]} barSize={24} name="Units" />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 8 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#1e293b', display: 'inline-block' }} />Revenue</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#64748b' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#2E7D32', display: 'inline-block' }} />Units</span>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card style={{ borderRadius: 10, border: '1px solid #d9e6e9' }} styles={{ body: { padding: '14px 16px' } }}>
                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>Category Distribution</Text>
                <div style={{ fontSize: 11, color: '#8c8e8f', marginTop: 2, marginBottom: 8 }}>Revenue by category</div>
                <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData.donut} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" nameKey="name">
                        {chartData.donut.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <RTooltip content={<TooltipBox formatter={(v) => fmtCur(v)} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 8 }}>
                  {chartData.donut.slice(0, 5).map((d, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                      {d.name}
                    </span>
                  ))}
                </div>
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
                <Text strong style={{ fontSize: 13, color: '#0f172a' }}>SKU Performance Ledger</Text>
                <div style={{ fontSize: 11, color: '#8c8e8f', marginTop: 2 }}>Showing {data.length} of {totalCount} SKUs</div>
              </div>
              <Tag style={{ borderRadius: 20, fontSize: 11, fontWeight: 600, color: '#475569', background: '#f1f5f9', border: 'none' }}>{totalCount.toLocaleString('en-IN')} SKUs</Tag>
            </div>
            <Table dataSource={data} columns={columns} rowKey={r => r.sku + r.asin} loading={loading} size="small"
              scroll={{ x: 900 }} bordered
              pagination={{ current: currentPage, pageSize, total: totalCount, onChange: (p, s) => { setCurrentPage(p); setPageSize(s); },
                showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], size: 'small',
                showTotal: (t) => <span style={{ fontSize: 11, color: '#8c8e8f' }}>{t} SKUs</span> }}
            />
          </Card>
        </div>
      )}

      <style>{`.spin-animation{animation:spin-animation 1s linear infinite}@keyframes spin-animation{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default SkuReport;
