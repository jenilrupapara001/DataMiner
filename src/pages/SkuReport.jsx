import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import {
    IndianRupee, Package, Percent, Activity, TrendingUp, PieChart as PieChartIcon,
    Filter, BarChart3, Download, Search, RefreshCw, Layers, Target, Coins,
    ArrowUpRight, ArrowDownRight, Database, Hash, ExternalLink
} from 'lucide-react';
import { useDateRange } from '../contexts/DateRangeContext';
import { format } from 'date-fns';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
    Space, Button, Table, Card, Progress, Row, Col, Tag, Typography,
    Input, Select, Skeleton, Tooltip, Divider, Empty
} from 'antd';
import { usePageTitle } from '../contexts/PageTitleContext';
import DateRangePicker from '../components/common/DateRangePicker';

const { Text } = Typography;
const Chart = React.lazy(() => import('react-apexcharts'));

const formatCategoryName = (name) => {
    if (!name) return 'General';
    const parts = name.split(' - ');
    if (parts.length > 1) return parts[parts.length - 1];
    return name.length > 18 ? name.substring(0, 18) + '...' : name;
};

const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '₹0';
    const num = Math.round(val);
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)}Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)}L`;
    if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
    return `₹${num.toLocaleString('en-IN')}`;
};

// ═══════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════
const StatCard = ({ icon: Icon, label, value, sublabel, color = '#1e293b' }) => (
    <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: '16px 18px' } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
                width: 36, height: 36, borderRadius: 6,
                background: '#f8fafc', border: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color
            }}>
                <Icon size={16} strokeWidth={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 11, fontWeight: 600, color: '#64748b',
                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3
                }}>
                    {label}
                </div>
                <div style={{
                    fontSize: 20, fontWeight: 700, color: '#0f172a',
                    letterSpacing: '-0.3px', lineHeight: 1
                }}>
                    {value}
                </div>
                {sublabel && (
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginTop: 4 }}>
                        {sublabel}
                    </div>
                )}
            </div>
        </div>
    </Card>
);

// ═══════════════════════════════════════════════════════════════
// SECTION CARD
// ═══════════════════════════════════════════════════════════════
const SectionCard = ({ title, subtitle, icon: Icon, extra, children, noPadding = false }) => (
    <Card
        style={{ borderRadius: 6, border: '1px solid #e5e7eb', height: '100%' }}
        styles={{
            header: { padding: '12px 18px', borderBottom: '1px solid #f1f5f9', minHeight: 'auto', background: '#fafbfc' },
            body: { padding: noPadding ? 0 : 18 }
        }}
        title={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {Icon && (
                        <div style={{
                            width: 26, height: 26, borderRadius: 5,
                            background: '#f8fafc', border: '1px solid #e5e7eb',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569'
                        }}>
                            <Icon size={13} strokeWidth={2} />
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                            {title}
                        </div>
                        {subtitle && <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 1 }}>{subtitle}</div>}
                    </div>
                </div>
                {extra}
            </div>
        }
    >
        {children}
    </Card>
);

const FieldLabel = ({ children }) => (
    <div style={{
        fontSize: 11, fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6
    }}>
        {children}
    </div>
);

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const SkuReport = () => {
    const { startDate, endDate, rangeType, updateDateRange } = useDateRange();
    const [searchParams] = useSearchParams();
    const initialAsin = searchParams.get('asin') || '';
    const navigate = useNavigate();
    const { setPageTitle } = usePageTitle();

    const [searchTerm, setSearchTerm] = useState(initialAsin);
    const [filters, setFilters] = useState({ category: 'all', searchTerm: initialAsin });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [kpiSummary, setKpiSummary] = useState({
        total_revenue: 0, units_sold: 0, ad_sales: 0, ad_spend: 0,
        clicks: 0, impressions: 0, sessions: 0
    });
    const [categoryMix, setCategoryMix] = useState([]);

    useEffect(() => { setPageTitle('SKU Report'); }, [setPageTitle]);

    useEffect(() => {
        if (initialAsin) {
            setSearchTerm(initialAsin);
            setFilters(prev => ({ ...prev, searchTerm: initialAsin }));
            setCurrentPage(1);
        }
    }, [initialAsin]);

    useEffect(() => {
        const t = setTimeout(() => {
            setFilters(prev => ({ ...prev, searchTerm }));
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(t);
    }, [searchTerm]);

    const loadSkuData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
                endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
                rangeType, search: filters.searchTerm, category: filters.category,
                page: currentPage, limit: pageSize
            };
            const cleanParams = Object.fromEntries(
                Object.entries(params).filter(([_, v]) => v !== null && v !== undefined && v !== 'null')
            );
            const query = new URLSearchParams(cleanParams).toString();
            const response = await api.get(`/data/sku-report?${query}`);

            const rawData = response.data || [];
            const mappedData = rawData.map((item, idx) => ({
                id: (currentPage - 1) * pageSize + idx + 1,
                sku: item.sku || 'N/A',
                asin: item.asin || 'N/A',
                title: item.title || `Product ${idx + 1}`,
                category: item.category || 'General',
                revenue: item.total_revenue || 0,
                units: item.units_sold || 0,
                aov: item.units_sold > 0 ? (item.total_revenue / item.units_sold).toFixed(2) : Number(item.price || 0).toFixed(2),
                acos: item.ad_sales > 0 ? ((item.ad_spend / item.ad_sales) * 100).toFixed(1) : '0.0',
                roas: item.ad_spend > 0 ? (item.ad_sales / item.ad_spend).toFixed(2) : '0.00',
                clicks: item.clicks || 0,
                impressions: item.impressions || 0,
                sessions: item.sessions || 0,
                conversion: item.clicks > 0 ? ((item.units_sold / item.clicks) * 100).toFixed(1) : '0.0',
                status: 'Active'
            }));

            setData(mappedData);
            setTotalCount(response.pagination?.total || 0);
            if (response.kpis) setKpiSummary(response.kpis);
            if (response.categories) setCategoryMix(response.categories);
        } catch (error) {
            console.error('Failed to load SKU data:', error);
        }
        setLoading(false);
    }, [startDate, endDate, rangeType, filters.searchTerm, filters.category, currentPage, pageSize]);

    useEffect(() => { loadSkuData(); }, [loadSkuData]);

    const kpis = useMemo(() => {
        const adSales = kpiSummary.ad_sales || 0;
        const adSpend = kpiSummary.ad_spend || 0;
        const acos = adSales > 0 ? ((adSpend / adSales) * 100).toFixed(1) : '0.0';
        return [
            { label: 'Total Revenue', value: formatCurrency(kpiSummary.total_revenue), icon: IndianRupee, sublabel: 'Combined channel sales', color: '#1e293b' },
            { label: 'Units Sold', value: (kpiSummary.units_sold || 0).toLocaleString('en-IN'), icon: Package, sublabel: 'Units dispatched', color: '#1e293b' },
            { label: 'Ad Spend', value: formatCurrency(adSpend), icon: Coins, sublabel: `ACOS: ${acos}%`, color: '#a16207' },
            { label: 'Sessions', value: (kpiSummary.sessions || 0).toLocaleString('en-IN'), icon: Activity, sublabel: 'Unique listing views', color: '#15803d' }
        ];
    }, [kpiSummary]);

    const handleExport = () => {
        const headers = ['SKU', 'ASIN', 'Product', 'Category', 'Revenue', 'Units', 'AOV', 'Conversion', 'Status'];
        const csvRows = [headers.join(',')];
        data.forEach(r => {
            csvRows.push([
                r.sku, r.asin, `"${(r.title || '').replace(/"/g, '""')}"`,
                r.category, r.revenue, r.units, r.aov, `${r.conversion}%`, r.status
            ].join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sku_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const performanceChartOptions = useMemo(() => ({
        chart: { type: 'line', toolbar: { show: false }, background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif' },
        colors: ['#1e293b', '#15803d'],
        stroke: { curve: 'smooth', width: [0, 2.5] },
        plotOptions: { bar: { columnWidth: '50%', borderRadius: 4 } },
        dataLabels: { enabled: false },
        xaxis: {
            categories: data.slice(0, 10).map(d => d.sku.length > 14 ? d.sku.substring(0, 14) + '...' : d.sku),
            labels: { style: { colors: '#64748b', fontSize: '10px', fontWeight: 600 }, rotate: -25 },
            axisBorder: { show: false }, axisTicks: { show: false }
        },
        yaxis: [
            { labels: { formatter: (v) => formatCurrency(v), style: { colors: '#64748b', fontSize: '10px', fontWeight: 600 } } },
            { opposite: true, labels: { style: { colors: '#64748b', fontSize: '10px', fontWeight: 600 } } }
        ],
        tooltip: { theme: 'light', shared: true, intersect: false, y: { formatter: (val, { seriesIndex }) => seriesIndex === 0 ? formatCurrency(val) : val } },
        grid: { show: true, borderColor: '#f1f5f9', strokeDashArray: 4, xaxis: { lines: { show: false } } },
        legend: { show: true, position: 'top', horizontalAlign: 'right', fontSize: '11px', fontWeight: 600 }
    }), [data]);

    const donutLabels = categoryMix.length > 0 ? categoryMix.map(c => formatCategoryName(c.category)) : ['General'];
    const donutSeries = categoryMix.length > 0 ? categoryMix.map(c => c.revenue) : [0.001];

    const donutOptions = useMemo(() => ({
        chart: { fontFamily: 'Inter, system-ui, sans-serif' },
        labels: donutLabels,
        colors: ['#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1'],
        legend: { position: 'bottom', fontSize: '11px', fontWeight: 600, markers: { radius: 2 }, itemMargin: { horizontal: 6, vertical: 3 } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['#ffffff'] },
        plotOptions: {
            pie: {
                donut: {
                    size: '72%',
                    labels: {
                        show: true,
                        value: { fontSize: '16px', fontWeight: 700, color: '#0f172a', formatter: (val) => formatCurrency(Number(val)) },
                        total: {
                            show: true, label: 'Total', color: '#64748b', fontSize: '11px', fontWeight: 600,
                            formatter: (w) => formatCurrency(w.globals.seriesTotals.reduce((a, b) => a + b, 0))
                        }
                    }
                }
            }
        },
        tooltip: { y: { formatter: (val) => formatCurrency(val) } }
    }), [donutLabels]);

    const columns = [
        {
            title: 'SKU / ASIN',
            dataIndex: 'sku',
            key: 'sku',
            width: 200,
            sorter: (a, b) => (a.sku || '').localeCompare(b.sku || ''),
            render: (sku, record) => (
                <div>
                    <span style={{
                        fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600,
                        color: '#0f172a', background: '#f8fafc', border: '1px solid #e5e7eb',
                        padding: '2px 8px', borderRadius: 4, display: 'inline-block'
                    }}>
                        {sku}
                    </span>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, fontFamily: 'monospace' }}>
                        {record.asin}
                    </div>
                </div>
            )
        },
        {
            title: 'Product',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
            sorter: (a, b) => (a.title || '').localeCompare(b.title || ''),
            render: (title) => <Text style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>{title || 'N/A'}</Text>
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            width: 130,
            sorter: (a, b) => (a.category || '').localeCompare(b.category || ''),
            render: (cat) => (
                <span style={{
                    fontSize: 10, fontWeight: 700, color: '#475569', background: '#f1f5f9',
                    border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: 4,
                    textTransform: 'uppercase', letterSpacing: '0.03em'
                }}>
                    {cat || 'General'}
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
            render: (val) => <Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{formatCurrency(val)}</Text>
        },
        {
            title: 'Units',
            dataIndex: 'units',
            key: 'units',
            width: 90,
            align: 'right',
            sorter: (a, b) => a.units - b.units,
            render: (val) => <Text style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{val.toLocaleString('en-IN')}</Text>
        },
        {
            title: 'CVR',
            dataIndex: 'conversion',
            key: 'conversion',
            width: 90,
            align: 'center',
            sorter: (a, b) => parseFloat(a.conversion) - parseFloat(b.conversion),
            render: (val) => {
                const v = parseFloat(val);
                const isGood = v >= 15;
                return (
                    <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: isGood ? '#15803d' : v >= 5 ? '#a16207' : '#b91c1c',
                        background: isGood ? '#f0fdf4' : v >= 5 ? '#fffbeb' : '#fef2f2',
                        border: `1px solid ${isGood ? '#bbf7d0' : v >= 5 ? '#fde68a' : '#fecaca'}`,
                        padding: '2px 8px', borderRadius: 4
                    }}>
                        {val}%
                    </span>
                );
            }
        },
        {
            title: 'Status',
            key: 'status',
            width: 80,
            align: 'center',
            render: () => (
                <span style={{
                    fontSize: 10, fontWeight: 700, color: '#15803d',
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase'
                }}>
                    Active
                </span>
            )
        }
    ];

    const isInitialLoad = loading && data.length === 0;

    return (
        <div className="sku-report-pro">
            <style>{`
                .sku-report-pro {
                    background: #fafafa;
                    min-height: calc(100vh - 60px);
                    padding: 24px 28px;
                }
                .pro-table .ant-table-thead > tr > th {
                    background: #f8fafc !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    color: #475569 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.04em !important;
                    border-bottom: 1px solid #e5e7eb !important;
                    padding: 10px 16px !important;
                }
                .pro-table .ant-table-tbody > tr > td {
                    border-bottom: 1px solid #f1f5f9 !important;
                    padding: 10px 16px !important;
                }
                .pro-table .ant-table-tbody > tr:hover > td {
                    background: #fafbfc !important;
                }
                @keyframes spin-animation {
                    to { transform: rotate(360deg); }
                }
                .spin-animation {
                    animation: spin-animation 1s linear infinite;
                }
            `}</style>

            {/* Header */}
            <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 20, flexWrap: 'wrap', gap: 12
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: 6, background: '#1e293b',
                        border: '1px solid #0f172a', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#ffffff'
                    }}>
                        <Layers size={18} strokeWidth={2} />
                    </div>
                    <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.2px' }}>
                            SKU Performance Report
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                            Product-level analytics and conversion metrics
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <DateRangePicker
                        startDate={startDate}
                        endDate={endDate}
                        onDateChange={(type, s, e) => updateDateRange({ startDate: s, endDate: e, rangeType: type })}
                    />
                    <Button
                        icon={<Download size={13} strokeWidth={2} />}
                        onClick={handleExport}
                        style={{ borderRadius: 6, fontWeight: 600, fontSize: 12, height: 34 }}
                    >
                        Export
                    </Button>
                    <Button
                        type="primary"
                        icon={<RefreshCw size={13} strokeWidth={2} className={loading ? 'spin-animation' : ''} />}
                        onClick={loadSkuData}
                        style={{ background: '#1e293b', borderColor: '#1e293b', borderRadius: 6, fontWeight: 600, fontSize: 12, height: 34 }}
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {/* KPIs */}
            {isInitialLoad ? (
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    {[1, 2, 3, 4].map(i => (
                        <Col key={i} xs={24} sm={12} md={6}>
                            <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: 18 } }}>
                                <Skeleton active paragraph={{ rows: 2 }} />
                            </Card>
                        </Col>
                    ))}
                </Row>
            ) : (
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    {kpis.map((k, i) => (
                        <Col key={i} xs={24} sm={12} md={6}>
                            <StatCard {...k} />
                        </Col>
                    ))}
                </Row>
            )}

            {/* Charts */}
            {isInitialLoad ? (
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col xs={24} lg={16}>
                        <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb', height: 360 }} styles={{ body: { padding: 20 } }}>
                            <Skeleton active paragraph={{ rows: 8 }} />
                        </Card>
                    </Col>
                    <Col xs={24} lg={8}>
                        <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb', height: 360 }} styles={{ body: { padding: 20 } }}>
                            <Skeleton active paragraph={{ rows: 8 }} />
                        </Card>
                    </Col>
                </Row>
            ) : (
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col xs={24} lg={16}>
                        <SectionCard
                            title="Revenue vs Volume"
                            subtitle="Top 10 SKUs on current page"
                            icon={BarChart3}
                            extra={
                                <span style={{
                                    fontSize: 10, fontWeight: 700, color: '#475569', background: '#f1f5f9',
                                    border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: 4,
                                    textTransform: 'uppercase', letterSpacing: '0.04em'
                                }}>
                                    Current Page
                                </span>
                            }
                        >
                            <div style={{ height: 300 }}>
                                <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
                                    <Chart
                                        options={performanceChartOptions}
                                        series={[
                                            { name: 'Revenue', type: 'column', data: data.slice(0, 10).map(d => d.revenue) },
                                            { name: 'Units', type: 'line', data: data.slice(0, 10).map(d => d.units) }
                                        ]}
                                        type="line"
                                        height="100%"
                                    />
                                </Suspense>
                            </div>
                        </SectionCard>
                    </Col>
                    <Col xs={24} lg={8}>
                        <SectionCard title="Category Distribution" icon={PieChartIcon}>
                            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Suspense fallback={<Skeleton active paragraph={{ rows: 6 }} />}>
                                    <Chart options={donutOptions} series={donutSeries} type="donut" width="100%" height={280} />
                                </Suspense>
                            </div>
                        </SectionCard>
                    </Col>
                </Row>
            )}

            {/* Filters + Table */}
            {isInitialLoad ? (
                <Row gutter={[12, 12]}>
                    <Col xs={24} lg={6}>
                        <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb', height: 400 }} styles={{ body: { padding: 18 } }}>
                            <Skeleton active paragraph={{ rows: 6 }} />
                        </Card>
                    </Col>
                    <Col xs={24} lg={18}>
                        <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb', height: 400 }} styles={{ body: { padding: 18 } }}>
                            <Skeleton active paragraph={{ rows: 8 }} />
                        </Card>
                    </Col>
                </Row>
            ) : (
                <Row gutter={[12, 12]}>
                    {/* Filter Sidebar */}
                    <Col xs={24} lg={6}>
                        <SectionCard title="Filters" icon={Filter}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <FieldLabel>Search</FieldLabel>
                                    <Input
                                        prefix={<Search size={13} style={{ color: '#94a3b8' }} />}
                                        placeholder="SKU or ASIN..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        allowClear
                                        style={{ borderRadius: 6 }}
                                    />
                                </div>
                                <div>
                                    <FieldLabel>Category</FieldLabel>
                                    <Select
                                        style={{ width: '100%' }}
                                        value={filters.category}
                                        onChange={val => {
                                            setFilters(prev => ({ ...prev, category: val }));
                                            setCurrentPage(1);
                                        }}
                                        options={[
                                            { value: 'all', label: 'All Categories' },
                                            { value: 'General', label: 'General' },
                                            { value: 'Clothing', label: 'Clothing' },
                                            { value: 'Footwear', label: 'Footwear' },
                                            { value: 'Accessories', label: 'Accessories' }
                                        ]}
                                    />
                                </div>

                                <Divider style={{ margin: '4px 0' }} />

                                {/* Conversion Target */}
                                <div style={{
                                    background: '#f8fafc', border: '1px solid #e5e7eb',
                                    borderRadius: 6, padding: 14
                                }}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10
                                    }}>
                                        <Target size={13} strokeWidth={2} style={{ color: '#475569' }} />
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>
                                            Conversion Target: 15%
                                        </span>
                                    </div>
                                    <Progress
                                        percent={Math.min(100, ((kpiSummary.units_sold / (kpiSummary.clicks || 1)) * 100 / 15) * 100)}
                                        strokeColor="#1e293b"
                                        size="small"
                                        showInfo={false}
                                    />
                                    <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#64748b' }}>
                                        Current: <span style={{ color: '#0f172a', fontWeight: 700 }}>
                                            {((kpiSummary.units_sold / (kpiSummary.clicks || 1)) * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div style={{
                                    background: '#f8fafc', border: '1px solid #e5e7eb',
                                    borderRadius: 6, padding: 14
                                }}>
                                    <div style={{
                                        fontSize: 10, fontWeight: 700, color: '#64748b',
                                        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8
                                    }}>
                                        Filter Summary
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {[
                                            { label: 'Showing', value: `${data.length} of ${totalCount}` },
                                            { label: 'Revenue', value: formatCurrency(data.reduce((s, d) => s + d.revenue, 0)) },
                                            { label: 'Units', value: data.reduce((s, d) => s + d.units, 0).toLocaleString('en-IN') }
                                        ].map((item, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                                <span style={{ color: '#64748b' }}>{item.label}</span>
                                                <span style={{ fontWeight: 700, color: '#0f172a' }}>{item.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </SectionCard>
                    </Col>

                    {/* Data Table */}
                    <Col xs={24} lg={18}>
                        <SectionCard
                            title="SKU Performance Ledger"
                            subtitle={`${totalCount} SKUs total`}
                            icon={Database}
                            noPadding
                            extra={
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<Download size={11} strokeWidth={2} />}
                                    onClick={handleExport}
                                    style={{
                                        background: '#1e293b', borderColor: '#1e293b', borderRadius: 4,
                                        fontWeight: 600, fontSize: 11, height: 28
                                    }}
                                >
                                    Export
                                </Button>
                            }
                        >
                            <Table
                                dataSource={data}
                                columns={columns}
                                rowKey={record => record.sku + record.asin}
                                loading={loading}
                                className="pro-table"
                                pagination={{
                                    current: currentPage,
                                    pageSize,
                                    total: totalCount,
                                    onChange: (page, size) => { setCurrentPage(page); setPageSize(size); },
                                    showSizeChanger: true,
                                    pageSizeOptions: ['10', '20', '50'],
                                    showTotal: (total, range) => (
                                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                                            {range[0]}-{range[1]} of {total} SKUs
                                        </span>
                                    ),
                                    style: { padding: '12px 16px', margin: 0 }
                                }}
                                scroll={{ x: 900 }}
                                size="middle"
                                locale={{
                                    emptyText: (
                                        <div style={{ padding: 48, textAlign: 'center' }}>
                                            <Layers size={32} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                                            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                                                No SKUs found
                                            </div>
                                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                                                Adjust filters or refresh data
                                            </div>
                                        </div>
                                    )
                                }}
                            />
                        </SectionCard>
                    </Col>
                </Row>
            )}
        </div>
    );
};

export default SkuReport;