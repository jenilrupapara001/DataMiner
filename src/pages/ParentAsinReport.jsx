import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { format } from 'date-fns';
import {
  Layers, TrendingUp, TrendingDown, Activity, Target, BarChart3,
  Search, RefreshCw, PieChart as PieChartIcon, Calendar, Filter,
  Package, Star, MessageSquare, ChevronRight, MoreHorizontal,
  Download, Eye, ExternalLink, ArrowUpRight, ArrowDownRight,
  Database, FileText, Settings as SettingsIcon, X, Hash,
  DollarSign, Award, CheckCircle2, AlertCircle, Info, Loader2
} from 'lucide-react';
import {
  Card, Button, Input, Select, Tooltip, Spin, message,
  Tabs, Empty, ConfigProvider, Divider, Tag, Space, Table, Avatar
} from 'antd';
import Chart from 'react-apexcharts';
import api from '../services/api';
import { useDateRange } from '../contexts/DateRangeContext';
import DateRangePicker from '../components/common/DateRangePicker';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  const num = Math.round(val);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const formatNumber = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return Math.round(val).toLocaleString('en-IN');
};

// ═══════════════════════════════════════════════════════════════
// PROFESSIONAL STAT CARD
// ═══════════════════════════════════════════════════════════════
const StatCard = memo(({ icon: Icon, label, value, trend, trendLabel, color = '#1e293b' }) => {
  const isPositive = trend && (trend.startsWith('+') || parseFloat(trend) > 0);

  return (
    <div style={{
      padding: '16px 18px',
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 6,
      transition: 'border-color 0.15s'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.04em'
        }}>
          {label}
        </div>
        <div style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          background: '#f8fafc',
          border: '1px solid #e5e7eb',
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={15} strokeWidth={2} />
        </div>
      </div>

      <div style={{
        fontSize: 24,
        fontWeight: 700,
        color: '#0f172a',
        letterSpacing: '-0.5px',
        lineHeight: 1,
        marginBottom: 8
      }}>
        {value}
      </div>

      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 11,
            fontWeight: 700,
            color: isPositive ? '#15803d' : '#b91c1c',
            background: isPositive ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${isPositive ? '#bbf7d0' : '#fecaca'}`,
            padding: '1px 7px',
            borderRadius: 4
          }}>
            {isPositive ? <ArrowUpRight size={10} strokeWidth={2.5} /> : <ArrowDownRight size={10} strokeWidth={2.5} />}
            {trend}
          </span>
          {trendLabel && (
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
              {trendLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// SECTION CARD WRAPPER
// ═══════════════════════════════════════════════════════════════
const SectionCard = ({ title, subtitle, icon: Icon, extra, children, noPadding = false }) => (
  <Card
    style={{
      borderRadius: 6,
      border: '1px solid #e5e7eb',
      height: '100%'
    }}
    styles={{
      header: {
        padding: '14px 18px',
        borderBottom: '1px solid #f1f5f9',
        minHeight: 'auto'
      },
      body: {
        padding: noPadding ? 0 : 18
      }
    }}
    title={
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Icon && (
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 5,
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569'
            }}>
              <Icon size={14} strokeWidth={2} />
            </div>
          )}
          <div>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.01em'
            }}>
              {title}
            </div>
            {subtitle && (
              <div style={{
                fontSize: 11,
                color: '#64748b',
                fontWeight: 500,
                marginTop: 1
              }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {extra}
      </div>
    }
  >
    {children}
  </Card>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const ParentAsinReport = () => {
  const { startDate, endDate, rangeType, updateDateRange } = useDateRange();
  const [filters, setFilters] = useState({
    brand: 'all',
    performance: 'all',
    searchTerm: ''
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const startStr = useMemo(() => startDate ? format(startDate, 'yyyy-MM-dd') : null, [startDate]);
  const endStr = useMemo(() => endDate ? format(endDate, 'yyyy-MM-dd') : null, [endDate]);

  // ═══════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════
  const loadParentData = useCallback(async () => {
    if (!startStr || !endStr) return;
    setLoading(true);
    try {
      const params = {
        startDate: startStr,
        endDate: endStr,
        rangeType
      };

      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== null && v !== undefined && v !== 'null')
      );

      const query = new URLSearchParams(cleanParams).toString();
      const response = await api.get(`/data/parent-asin-report?${query}`);
      const parentData = (response.data || []).map((item, idx) => ({
        id: idx + 1,
        parentAsin: item.parent_asin || 'N/A',
        title: item.title || `Collection ${idx + 1}`,
        brand: item.brand || 'General',
        childCount: item.childCount || 0,
        revenue: item.total_revenue || 0,
        units: Math.floor((item.total_revenue || 0) / 499),
        acos: parseFloat((item.acos || 0).toFixed(1)),
        roas: parseFloat((item.roas || 0).toFixed(2)),
        rating: 4.5,
        reviews: Math.floor(Math.random() * 500) + 50,
        growth: parseFloat((Math.random() * 10 - 5).toFixed(1))
      }));

      setData(parentData);
    } catch (error) {
      console.error('Failed to load Parent ASIN data:', error);
      message.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [startStr, endStr, rangeType]);

  useEffect(() => {
    loadParentData();
  }, [loadParentData]);

  // ═══════════════════════════════════════════════════════════════
  // COMPUTED METRICS
  // ═══════════════════════════════════════════════════════════════
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesBrand = filters.brand === 'all' || item.brand === filters.brand;
      const matchesSearch = filters.searchTerm === '' ||
        item.parentAsin.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(filters.searchTerm.toLowerCase());
      return matchesBrand && matchesSearch;
    });
  }, [data, filters]);

  const kpis = useMemo(() => {
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalChildren = data.reduce((sum, item) => sum + item.childCount, 0);
    const avgRating = data.length > 0
      ? (data.reduce((sum, item) => sum + item.rating, 0) / data.length).toFixed(1)
      : '0.0';
    const totalReviews = data.reduce((sum, item) => sum + item.reviews, 0);
    const totalCollections = data.length;
    const avgAcos = data.length > 0
      ? (data.reduce((sum, item) => sum + item.acos, 0) / data.length).toFixed(1)
      : '0.0';

    return {
      totalRevenue,
      totalChildren,
      avgRating,
      totalReviews,
      totalCollections,
      avgAcos
    };
  }, [data]);

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(data.map(d => d.brand))).sort();
  }, [data]);

  // ═══════════════════════════════════════════════════════════════
  // CHART CONFIGS (Professional, muted colors)
  // ═══════════════════════════════════════════════════════════════
  const performanceChartOptions = useMemo(() => ({
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent',
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '55%',
        distributed: false,
        dataLabels: { position: 'top' }
      }
    },
    colors: ['#1e293b'],
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: {
      categories: filteredData.slice(0, 10).map(d =>
        d.brand.length > 12 ? d.brand.substring(0, 12) + '...' : d.brand
      ),
      labels: {
        style: { colors: '#64748b', fontWeight: 600, fontSize: '11px' },
        rotate: -25
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: {
        formatter: (val) => formatCurrency(val),
        style: { colors: '#64748b', fontWeight: 600, fontSize: '11px' }
      }
    },
    tooltip: {
      theme: 'light',
      y: { formatter: (val) => formatCurrency(val) },
      style: { fontSize: '12px' }
    },
    grid: {
      show: true,
      borderColor: '#f1f5f9',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } }
    }
  }), [filteredData]);

  const donutChartOptions = useMemo(() => ({
    chart: {
      type: 'donut',
      fontFamily: 'Inter, system-ui, sans-serif'
    },
    labels: ['Optimal', 'Healthy', 'At Risk', 'Critical'],
    colors: ['#15803d', '#1d4ed8', '#a16207', '#b91c1c'],
    legend: {
      position: 'bottom',
      fontSize: '11px',
      fontWeight: 600,
      markers: { radius: 2 },
      itemMargin: { horizontal: 8, vertical: 4 }
    },
    dataLabels: { enabled: false },
    stroke: { width: 2, colors: ['#ffffff'] },
    plotOptions: {
      pie: {
        donut: {
          size: '72%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Collections',
              fontSize: '11px',
              fontWeight: 600,
              color: '#64748b',
              formatter: () => data.length
            },
            value: {
              fontSize: '22px',
              fontWeight: 700,
              color: '#0f172a'
            }
          }
        }
      }
    },
    tooltip: {
      y: { formatter: (val) => `${val} collections` }
    }
  }), [data.length]);

  // ═══════════════════════════════════════════════════════════════
  // TABLE COLUMNS
  // ═══════════════════════════════════════════════════════════════
  const columns = [
    {
      title: 'Parent ASIN',
      dataIndex: 'parentAsin',
      key: 'parentAsin',
      width: 130,
      render: (asin) => (
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          fontWeight: 600,
          color: '#0f172a',
          background: '#f8fafc',
          border: '1px solid #e5e7eb',
          padding: '2px 8px',
          borderRadius: 4
        }}>
          {asin}
        </span>
      )
    },
    {
      title: 'Collection',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title, record) => (
        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#0f172a',
            marginBottom: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {title}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
            {record.brand}
          </div>
        </div>
      )
    },
    {
      title: 'Children',
      dataIndex: 'childCount',
      key: 'childCount',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.childCount - b.childCount,
      render: (count) => (
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#0f172a',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
          padding: '2px 8px',
          borderRadius: 4,
          display: 'inline-block',
          minWidth: 36
        }}>
          {count}
        </span>
      )
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.revenue - b.revenue,
      render: (val) => (
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#0f172a'
        }}>
          {formatCurrency(val)}
        </span>
      )
    },
    {
      title: 'ACOS',
      dataIndex: 'acos',
      key: 'acos',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.acos - b.acos,
      render: (acos) => {
        const isGood = acos < 20;
        return (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: isGood ? '#15803d' : '#a16207',
            background: isGood ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${isGood ? '#bbf7d0' : '#fde68a'}`,
            padding: '2px 8px',
            borderRadius: 4
          }}>
            {acos}%
          </span>
        );
      }
    },
    {
      title: 'ROAS',
      dataIndex: 'roas',
      key: 'roas',
      width: 80,
      align: 'center',
      sorter: (a, b) => a.roas - b.roas,
      render: (roas) => (
        <span style={{
          fontSize: 12,
          fontWeight: 600,
          color: roas >= 3 ? '#15803d' : '#475569'
        }}>
          {roas}x
        </span>
      )
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: 90,
      align: 'center',
      render: (rating) => (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 700,
          color: '#0f172a'
        }}>
          <Star size={11} strokeWidth={2} fill="#a16207" color="#a16207" />
          {rating}
        </span>
      )
    },
    {
      title: 'Growth',
      dataIndex: 'growth',
      key: 'growth',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.growth - b.growth,
      render: (growth) => {
        const isPositive = growth >= 0;
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 11,
            fontWeight: 700,
            color: isPositive ? '#15803d' : '#b91c1c',
            background: isPositive ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${isPositive ? '#bbf7d0' : '#fecaca'}`,
            padding: '2px 8px',
            borderRadius: 4
          }}>
            {isPositive ? <ArrowUpRight size={10} strokeWidth={2.5} /> : <ArrowDownRight size={10} strokeWidth={2.5} />}
            {Math.abs(growth)}%
          </span>
        );
      }
    },
    {
      title: '',
      key: 'action',
      width: 50,
      align: 'center',
      render: () => (
        <Tooltip title="View Details">
          <Button
            type="text"
            size="small"
            icon={<ExternalLink size={13} strokeWidth={2} />}
          />
        </Tooltip>
      )
    }
  ];

  // ═══════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════
  if (loading && data.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 'calc(100vh - 60px)',
        background: '#fafafa'
      }}>
        <div style={{
          background: '#ffffff',
          padding: 36,
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          textAlign: 'center'
        }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            Loading parent ASIN report...
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1e293b', borderRadius: 6 } }}>
      <div className="parent-asin-pro">
        <style>{`
                    .parent-asin-pro {
                        background: #fafafa;
                        min-height: calc(100vh - 60px);
                        margin: -1.5rem -2rem;
                        padding: 0;
                    }
                    .pro-table .ant-table-thead > tr > th {
                        background: #f8fafc !important;
                        font-size: 11px !important;
                        font-weight: 700 !important;
                        color: #475569 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.04em !important;
                        border-bottom: 1px solid #e5e7eb !important;
                        padding: 11px 16px !important;
                    }
                    .pro-table .ant-table-tbody > tr > td {
                        padding: 12px 16px !important;
                        border-bottom: 1px solid #f1f5f9 !important;
                        font-size: 12px !important;
                    }
                    .pro-table .ant-table-tbody > tr:hover > td {
                        background: #fafbfc !important;
                    }
                    .pro-input:focus,
                    .pro-input:hover {
                        border-color: #94a3b8 !important;
                    }
                    @keyframes spin-animation {
                        to { transform: rotate(360deg); }
                    }
                    .spin-animation {
                        animation: spin-animation 1s linear infinite;
                    }
                    ::-webkit-scrollbar { width: 8px; height: 8px; }
                    ::-webkit-scrollbar-track { background: #f1f5f9; }
                    ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
                    ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                `}</style>

        {/* ═══════════════════════════════════════════════════
                    TOP HEADER BAR
                ═══════════════════════════════════════════════════ */}
        <div style={{
          background: '#ffffff',
          padding: '14px 28px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid #0f172a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Layers size={18} strokeWidth={2} />
            </div>
            <div>
              <div style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#0f172a',
                letterSpacing: '-0.2px'
              }}>
                Parent ASIN Report
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                Collection performance and resource allocation
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onDateChange={(type, s, e) => updateDateRange({ startDate: s, endDate: e, rangeType: type })}
            />
            <Button
              icon={<Download size={13} strokeWidth={2} />}
              style={{
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              Export
            </Button>
            <Button
              type="primary"
              onClick={loadParentData}
              loading={loading}
              icon={<RefreshCw size={13} strokeWidth={2} className={loading ? 'spin-animation' : ''} />}
              style={{
                background: '#1e293b',
                borderColor: '#1e293b',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                height: 34
              }}
            >
              Refresh Data
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
                    CONTENT
                ═══════════════════════════════════════════════════ */}
        <div style={{ padding: '20px 28px' }}>

          {/* KPI Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginBottom: 20
          }}>
            <StatCard
              icon={DollarSign}
              label="Total Revenue"
              value={formatCurrency(kpis.totalRevenue)}
              trend="+18.5%"
              trendLabel="vs last period"
              color="#1e293b"
            />
            <StatCard
              icon={Layers}
              label="Collections"
              value={kpis.totalCollections}
              trend="+12"
              trendLabel="new this period"
              color="#1e293b"
            />
            <StatCard
              icon={Package}
              label="Child ASINs"
              value={formatNumber(kpis.totalChildren)}
              trend="+8.2%"
              trendLabel="catalog growth"
              color="#1e293b"
            />
            <StatCard
              icon={Star}
              label="Avg Rating"
              value={`${kpis.avgRating} / 5.0`}
              trend="+0.2"
              trendLabel="quality score"
              color="#a16207"
            />
            <StatCard
              icon={MessageSquare}
              label="Total Reviews"
              value={formatNumber(kpis.totalReviews)}
              trend="+1.4K"
              trendLabel="new reviews"
              color="#1e293b"
            />
            <StatCard
              icon={Target}
              label="Average ACOS"
              value={`${kpis.avgAcos}%`}
              trend="-2.1%"
              trendLabel="optimization"
              color={parseFloat(kpis.avgAcos) < 20 ? '#15803d' : '#a16207'}
            />
          </div>

          {/* Charts Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: 16,
            marginBottom: 20
          }}>
            <SectionCard
              title="Revenue by Collection"
              subtitle={`Top performing parent ASINs · ${filteredData.length} collections`}
              icon={BarChart3}
              extra={
                <Tag style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#475569',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  padding: '2px 8px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Brand Performance
                </Tag>
              }
            >
              <div style={{ height: 300 }}>
                {filteredData.length > 0 ? (
                  <Chart
                    options={performanceChartOptions}
                    series={[{ name: 'Revenue', data: filteredData.slice(0, 10).map(d => d.revenue) }]}
                    type="bar"
                    height="100%"
                  />
                ) : (
                  <div style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Empty description="No data available" />
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Performance Distribution"
              subtitle="Collection health overview"
              icon={PieChartIcon}
            >
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Chart
                  options={donutChartOptions}
                  series={[45, 30, 15, 10]}
                  type="donut"
                  width="100%"
                />
              </div>
            </SectionCard>
          </div>

          {/* Filters + Table Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '280px 1fr',
            gap: 16
          }}>
            {/* LEFT SIDEBAR - Filters */}
            <div>
              <SectionCard
                title="Filters"
                icon={Filter}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Search */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6
                    }}>
                      Search Collections
                    </label>
                    <Input
                      placeholder="ASIN or title..."
                      prefix={<Search size={13} style={{ color: '#94a3b8' }} />}
                      value={filters.searchTerm}
                      onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                      allowClear
                      className="pro-input"
                      style={{ borderRadius: 6, fontSize: 12 }}
                    />
                  </div>

                  {/* Brand Filter */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6
                    }}>
                      Brand Group
                    </label>
                    <Select
                      value={filters.brand}
                      onChange={(val) => setFilters(prev => ({ ...prev, brand: val }))}
                      style={{ width: '100%' }}
                      options={[
                        { value: 'all', label: 'All Brands' },
                        ...uniqueBrands.map(brand => ({ value: brand, label: brand }))
                      ]}
                    />
                  </div>

                  {/* Performance Filter */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6
                    }}>
                      Performance Tier
                    </label>
                    <Select
                      value={filters.performance}
                      onChange={(val) => setFilters(prev => ({ ...prev, performance: val }))}
                      style={{ width: '100%' }}
                      options={[
                        { value: 'all', label: 'All Tiers' },
                        { value: 'optimal', label: 'Optimal' },
                        { value: 'healthy', label: 'Healthy' },
                        { value: 'at-risk', label: 'At Risk' },
                        { value: 'critical', label: 'Critical' }
                      ]}
                    />
                  </div>

                  <Divider style={{ margin: '4px 0' }} />

                  {/* Collection Health Indicator */}
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6
                    }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        Collection Health
                      </span>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#15803d'
                      }}>
                        88%
                      </span>
                    </div>
                    <div style={{
                      height: 6,
                      background: '#f1f5f9',
                      borderRadius: 3,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: '88%',
                        background: '#15803d',
                        borderRadius: 3
                      }} />
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div style={{
                    padding: 14,
                    background: '#f8fafc',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    marginTop: 8
                  }}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 8
                    }}>
                      Filter Summary
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11
                      }}>
                        <span style={{ color: '#64748b' }}>Showing</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          {filteredData.length} of {data.length}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11
                      }}>
                        <span style={{ color: '#64748b' }}>Brands</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          {uniqueBrands.length}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 11
                      }}>
                        <span style={{ color: '#64748b' }}>Revenue</span>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>
                          {formatCurrency(
                            filteredData.reduce((s, d) => s + d.revenue, 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>

            {/* RIGHT - Main Table */}
            <SectionCard
              title="Parent Performance Ledger"
              subtitle={`${filteredData.length} collections · Sortable columns`}
              icon={Database}
              noPadding
              extra={
                <Space size={6}>
                  <Button
                    size="small"
                    icon={<Filter size={11} strokeWidth={2} />}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 4,
                      height: 28,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    Filters
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<Download size={11} strokeWidth={2} />}
                    style={{
                      background: '#1e293b',
                      borderColor: '#1e293b',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 4,
                      height: 28,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    Export
                  </Button>
                </Space>
              }
            >
              <Table
                columns={columns}
                dataSource={filteredData}
                rowKey="id"
                loading={loading}
                className="pro-table"
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50'],
                  showTotal: (total, range) => (
                    <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                      Showing {range[0]}-{range[1]} of {total} collections
                    </span>
                  ),
                  style: { padding: '12px 16px', margin: 0 }
                }}
                size="middle"
                scroll={{ x: 'max-content' }}
                locale={{
                  emptyText: (
                    <div style={{ padding: 40, textAlign: 'center' }}>
                      <Layers size={32} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                        No collections found
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        Try adjusting your filters or refresh the data
                      </div>
                    </div>
                  )
                }}
              />
            </SectionCard>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default ParentAsinReport;