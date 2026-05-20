import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { 
    IndianRupee, Package, Percent, Activity, TrendingUp, PieChart, 
    Filter, BarChart3, Download, Search, RefreshCw, Layers, Target, Coins 
} from 'lucide-react';
import { useDateRange } from '../contexts/DateRangeContext';
import { format } from 'date-fns';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
    Space, Button, Table, Card, Progress, Row, Col, Tag, Typography, 
    Input, Select, Skeleton 
} from 'antd';
import { usePageTitle } from '../contexts/PageTitleContext';

const { Text, Title } = Typography;

// Lazy-load ApexCharts for performance optimization
const Chart = React.lazy(() => import('react-apexcharts'));

// Helper to sanitize long category names for legend presentation
const formatCategoryName = (name) => {
    if (!name) return 'General';
    const parts = name.split(' - ');
    if (parts.length > 1) {
        return parts[parts.length - 1];
    }
    return name.length > 18 ? name.substring(0, 18) + '...' : name;
};

// 1. KPI Skeleton Placeholder Component
const KpiSkeleton = () => (
    <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map((i) => (
            <Col key={i} xs={24} sm={12} md={6}>
                <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: 106 }} styles={{ body: { padding: '16px 20px' } }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <Skeleton.Button active shape="square" size="large" style={{ width: 38, height: 38, borderRadius: 10 }} />
                        <div style={{ flex: 1 }}>
                            <Skeleton active title={{ width: 80 }} paragraph={{ rows: 1, width: 140 }} />
                        </div>
                    </div>
                </Card>
            </Col>
        ))}
    </Row>
);

// 2. Charts Skeleton Placeholder Component
const ChartSkeleton = () => (
    <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
            <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: 380 }} styles={{ body: { padding: '24px' } }}>
                <Skeleton active title={{ width: 220 }} paragraph={{ rows: 8 }} />
            </Card>
        </Col>
        <Col xs={24} lg={8}>
            <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: 380 }} styles={{ body: { padding: '24px' } }}>
                <Skeleton active title={{ width: 180 }} paragraph={{ rows: 8 }} />
            </Card>
        </Col>
    </Row>
);

// 3. Table Skeleton Placeholder Component
const TableSkeleton = () => (
    <Row gutter={[16, 16]}>
        <Col xs={24} lg={6}>
            <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: 420 }} styles={{ body: { padding: '20px' } }}>
                <Skeleton active title={{ width: 120 }} paragraph={{ rows: 8 }} />
            </Card>
        </Col>
        <Col xs={24} lg={18}>
            <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', height: 420 }} styles={{ body: { padding: '20px' } }}>
                <Skeleton active title={{ width: 200 }} paragraph={{ rows: 8 }} />
            </Card>
        </Col>
    </Row>
);

const SkuReport = () => {
    const { startDate, endDate, rangeType } = useDateRange();
    const [searchParams] = useSearchParams();
    const initialAsin = searchParams.get('asin') || '';
    const navigate = useNavigate();
    const { setPageTitle } = usePageTitle();

    // 1. Pagination & Search/Filter states
    const [searchTerm, setSearchTerm] = useState(initialAsin);
    const [filters, setFilters] = useState({
        category: 'all',
        searchTerm: initialAsin
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // 2. Data states
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [kpiSummary, setKpiSummary] = useState({
        total_revenue: 0,
        units_sold: 0,
        ad_sales: 0,
        ad_spend: 0,
        clicks: 0,
        impressions: 0,
        sessions: 0
    });
    const [categoryMix, setCategoryMix] = useState([]);

    useEffect(() => {
        setPageTitle('SKU Intelligence');
    }, [setPageTitle]);

    // Update searchTerm if asin param changes
    useEffect(() => {
        if (initialAsin) {
            setSearchTerm(initialAsin);
            setFilters(prev => ({ ...prev, searchTerm: initialAsin }));
            setCurrentPage(1);
        }
    }, [initialAsin]);

    // Debounce search input to avoid hitting backend database on every keystroke
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setFilters(prev => ({ ...prev, searchTerm }));
            setCurrentPage(1);
        }, 400);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    // Fetch analytical data from Server with server-side filtering & paging
    const loadSkuData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
                endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
                rangeType,
                search: filters.searchTerm,
                category: filters.category,
                page: currentPage,
                limit: pageSize
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
                title: item.title || 'Product ' + (idx + 1),
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
            
            if (response.kpis) {
                setKpiSummary(response.kpis);
            }
            if (response.categories) {
                setCategoryMix(response.categories);
            }
        } catch (error) {
            console.error('Failed to load SKU data:', error);
        }
        setLoading(false);
    }, [startDate, endDate, rangeType, filters.searchTerm, filters.category, currentPage, pageSize]);

    useEffect(() => {
        loadSkuData();
    }, [loadSkuData]);

    // Build Premium KPI Summary metrics with mapped sessions
    const kpis = useMemo(() => {
        const adSales = kpiSummary.ad_sales || 0;
        const adSpend = kpiSummary.ad_spend || 0;
        const acos = adSales > 0 ? ((adSpend / adSales) * 100).toFixed(1) : '0.0';
        const conversionRate = kpiSummary.clicks > 0 ? ((kpiSummary.units_sold / kpiSummary.clicks) * 100).toFixed(1) : '0.0';

        return [
            { 
                title: 'Total Revenue', 
                value: `₹${(kpiSummary.total_revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 
                icon: IndianRupee, 
                color: '#4f46e5', 
                bg: '#f5f3ff', 
                label: 'Combined Channel Sales' 
            },
            { 
                title: 'Units Sold', 
                value: (kpiSummary.units_sold || 0).toLocaleString(), 
                icon: Package, 
                color: '#8b5cf6', 
                bg: '#f5f3ff', 
                label: 'Units dispatched' 
            },
            { 
                title: 'Ad Spend & ACoS', 
                value: `₹${(kpiSummary.ad_spend || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, 
                icon: Coins, 
                color: '#f59e0b', 
                bg: '#fffbeb', 
                label: `Avg ACoS: ${acos}%` 
            },
            { 
                title: 'Listing Sessions', 
                value: (kpiSummary.sessions || 0).toLocaleString(), 
                icon: Activity, 
                color: '#10b981', 
                bg: '#ecfdf5', 
                label: `Total unique sessions` 
            },
        ];
    }, [kpiSummary]);

    const handleExport = () => {
        const headers = ['SKU', 'ASIN', 'Product Name', 'Category', 'Revenue', 'Units Sold', 'AOV', 'Conversion Rate', 'Status'];
        const csvRows = [headers.join(',')];
        data.forEach(r => {
            csvRows.push([
                r.sku, 
                r.asin, 
                `"${(r.title || '').replace(/"/g, '""')}"`, 
                r.category, 
                r.revenue, 
                r.units, 
                r.aov, 
                `${r.conversion}%`, 
                r.status
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
        window.URL.revokeObjectURL(url);
    };

    const columns = [
        {
            title: 'SKU / ASIN',
            dataIndex: 'sku',
            key: 'sku',
            width: 220,
            sorter: (a, b) => (a.sku || '').localeCompare(b.sku || ''),
            render: (sku, record) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong style={{ fontSize: '13px', color: '#0f172a', letterSpacing: '-0.01em' }}>{sku}</Text>
                    <Text type="secondary" style={{ fontSize: '11px', marginTop: 2 }}>{record.asin}</Text>
                </div>
            )
        },
        {
            title: 'Product Title',
            dataIndex: 'title',
            key: 'title',
            ellipsis: true,
            sorter: (a, b) => (a.title || '').localeCompare(b.title || ''),
            render: (title) => <Text style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500 }}>{title || 'Unknown Product'}</Text>
        },
        {
            title: 'Category',
            dataIndex: 'category',
            key: 'category',
            width: 140,
            sorter: (a, b) => (a.category || '').localeCompare(b.category || ''),
            render: (category) => <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, fontSize: '11px' }}>{category || 'General'}</Tag>
        },
        {
            title: 'Revenue',
            dataIndex: 'revenue',
            key: 'revenue',
            width: 130,
            sorter: (a, b) => a.revenue - b.revenue,
            render: (revenue) => <Text style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>₹{revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
        },
        {
            title: 'Units Sold',
            dataIndex: 'units',
            key: 'units',
            width: 100,
            sorter: (a, b) => a.units - b.units,
            render: (units) => <Text style={{ fontSize: '12.5px', fontWeight: 600, color: '#475569' }}>{units}</Text>
        },
        {
            title: 'Conversion',
            dataIndex: 'conversion',
            key: 'conversion',
            width: 120,
            sorter: (a, b) => parseFloat(a.conversion) - parseFloat(b.conversion),
            render: (conversion) => (
                <Tag 
                    color={parseFloat(conversion) >= 15 ? 'success' : parseFloat(conversion) >= 5 ? 'warning' : 'default'} 
                    style={{ borderRadius: 6, fontWeight: 700, fontSize: '11px', padding: '1px 6px' }}
                >
                    {conversion}%
                </Tag>
            )
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            align: 'right',
            render: () => (
                <Tag 
                    color="green" 
                    variant="filled" 
                    style={{ borderRadius: 8, fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', padding: '2px 8px' }}
                >
                    Active
                </Tag>
            )
        }
    ];

    const performanceChartOptions = {
        chart: { type: 'line', toolbar: { show: false }, background: 'transparent' },
        colors: ['#4F46E5', '#10B981'],
        stroke: { curve: 'smooth', width: [3, 3] },
        plotOptions: { bar: { columnWidth: '35%', borderRadius: 6 } },
        dataLabels: { enabled: false },
        xaxis: {
            categories: data.slice(0, 10).map(d => d.sku.length > 15 ? d.sku.substring(0, 15) + '...' : d.sku),
            labels: { style: { colors: '#64748b', fontSize: '9px', fontWeight: 600 } },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: [
            { title: { text: 'Revenue (₹)', style: { color: '#64748b', fontWeight: 600 } }, labels: { style: { colors: '#64748b' } } },
            { opposite: true, title: { text: 'Units', style: { color: '#64748b', fontWeight: 600 } }, labels: { style: { colors: '#64748b' } } }
        ],
        tooltip: { theme: 'light', shared: true, intersect: false },
        grid: { show: true, borderColor: '#f1f5f9', strokeDashArray: 4 }
    };

    // Calculate dynamic donut series & labels with clean formatting
    const donutLabels = categoryMix.length > 0 ? categoryMix.map(c => formatCategoryName(c.category)) : ['General'];
    const donutSeries = categoryMix.length > 0 ? categoryMix.map(c => c.revenue) : [0.001];

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* 1. TOP DYNAMIC WORKBAR */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '10px 16px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}>
                    <Space size={4}>
                        <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventory</Text>
                        <span style={{ color: '#cbd5e1', fontSize: 11 }}>/</span>
                        <Text strong style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0f172a' }}>SKU Intelligence Analysis</Text>
                    </Space>

                    <Button 
                        icon={<RefreshCw size={13} className={loading ? 'spin text-primary' : ''} />} 
                        onClick={loadSkuData}
                        shape="circle"
                        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: '#cbd5e1' }}
                    />
                </div>

                {/* 2. DYNAMIC KPI ROW (SKELETON OR ACTUAL CONTENT) */}
                {loading && data.length === 0 ? (
                    <KpiSkeleton />
                ) : (
                    <Row gutter={[16, 16]}>
                        {kpis.map((k, i) => (
                            <Col key={i} xs={24} sm={12} md={6}>
                                <Card 
                                    style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                                    styles={{ body: { padding: '16px 20px' } }}
                                >
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <div style={{ background: k.bg, color: k.color, padding: 10, borderRadius: 10, display: 'flex' }}>
                                            <k.icon size={18} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 750, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{k.title}</div>
                                            <h2 style={{ margin: 0, fontWeight: 800, color: '#0f172a', fontSize: 20, letterSpacing: '-0.02em' }}>{k.value}</h2>
                                            <Text type="secondary" style={{ fontSize: 11 }}>{k.label}</Text>
                                        </div>
                                    </div>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                )}

                {/* 3. CHARTS ROW (SKELETON OR ACTUAL CONTENT) */}
                {loading && data.length === 0 ? (
                    <ChartSkeleton />
                ) : (
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={16}>
                            <Card
                                title={<span style={{ fontWeight: 800, color: '#0f172a', fontSize: 14, letterSpacing: '-0.01em' }}>Top Performing SKUs (Revenue vs. Volume)</span>}
                                extra={<Tag color="purple" style={{ borderRadius: 10, fontWeight: 700, fontSize: '10px' }}>CURRENT PAGE TOP 10</Tag>}
                                style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                                styles={{ header: { borderBottom: '1px solid #f1f5f9', padding: '12px 20px' } }}
                            >
                                <div style={{ height: '320px' }}>
                                    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
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
                            </Card>
                        </Col>

                        <Col xs={24} lg={8}>
                            <Card
                                title={<span style={{ fontWeight: 800, color: '#0f172a', fontSize: 14, letterSpacing: '-0.01em' }}>Category Revenue Mix</span>}
                                style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                                styles={{ header: { borderBottom: '1px solid #f1f5f9', padding: '12px 20px' } }}
                            >
                                <div style={{ height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
                                        <Chart
                                            options={{
                                                labels: donutLabels,
                                                colors: ['#4F46E5', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'],
                                                legend: { position: 'bottom', labels: { colors: '#64748b', useSeriesColors: false } },
                                                dataLabels: { enabled: false },
                                                stroke: { show: false },
                                                plotOptions: { 
                                                    pie: { 
                                                        donut: { 
                                                            size: '75%', 
                                                            labels: { 
                                                                show: true, 
                                                                value: {
                                                                    show: true,
                                                                    fontSize: '15px',
                                                                    fontWeight: '800',
                                                                    color: '#0f172a',
                                                                    formatter: (val) => `₹${Math.round(Number(val)).toLocaleString()}`
                                                                },
                                                                total: { 
                                                                    show: true, 
                                                                    label: 'TOTAL', 
                                                                    color: '#64748b', 
                                                                    fontSize: '11px', 
                                                                    fontWeight: '700', 
                                                                    formatter: (w) => {
                                                                        const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                                                        return `₹${Math.round(sum).toLocaleString()}`;
                                                                    } 
                                                                } 
                                                            } 
                                                        } 
                                                    } 
                                                }
                                            }}
                                            series={donutSeries}
                                            type="donut"
                                            width="100%"
                                            height={300}
                                        />
                                    </Suspense>
                                </div>
                            </Card>
                        </Col>
                    </Row>
                )}

                {/* 4. FILTERS & DATA LEDGER COLUMN GRID (SKELETON OR ACTUAL CONTENT) */}
                {loading && data.length === 0 ? (
                    <TableSkeleton />
                ) : (
                    <Row gutter={[16, 16]}>
                        <Col xs={24} lg={6}>
                            <Card
                                title={<span style={{ fontWeight: 800, color: '#0f172a', fontSize: 14, letterSpacing: '-0.01em' }}>Optimization Filters</span>}
                                style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', height: '100%' }}
                                styles={{ header: { borderBottom: '1px solid #f1f5f9', padding: '12px 20px' } }}
                            >
                                <Space orientation="vertical" size={20} style={{ width: '100%' }}>
                                    <div>
                                        <Text strong style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Search Inventory</Text>
                                        <Input 
                                            size="large"
                                            placeholder="SKU, ASIN..."
                                            prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            style={{ borderRadius: 8 }}
                                            allowClear
                                        />
                                    </div>

                                    <div>
                                        <Text strong style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Brand / Category</Text>
                                        <Select 
                                            size="large"
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

                                    <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <div style={{ background: '#4f46e5', color: '#ffffff', padding: 6, borderRadius: 8, display: 'flex' }}>
                                                <Target size={14} />
                                            </div>
                                            <Text strong style={{ color: '#4f46e5', fontSize: 11.5 }}>Conversion Target: 15%</Text>
                                        </div>
                                        <Progress 
                                            percent={45} 
                                            strokeColor="#4f46e5"
                                            size="small"
                                            showInfo={false}
                                        />
                                        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: '#64748b' }}>
                                            Average Performance: <span style={{ color: '#0f172a', fontWeight: 800 }}>{((kpiSummary.units_sold / (kpiSummary.clicks || 1)) * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </Space>
                            </Card>
                        </Col>

                        <Col xs={24} lg={18}>
                            <Card
                                title={<span style={{ fontWeight: 800, color: '#0f172a', fontSize: 14, letterSpacing: '-0.01em' }}>SKU Performance Ledger</span>}
                                extra={
                                    <Button 
                                        type="primary"
                                        shape="round"
                                        icon={<Download size={13} />}
                                        onClick={handleExport}
                                        style={{ 
                                            background: '#4f46e5', 
                                            borderColor: '#4f46e5', 
                                            fontWeight: 700,
                                            fontSize: 12,
                                            height: 32,
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        Export Dataset
                                    </Button>
                                }
                                style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                                styles={{ header: { borderBottom: '1px solid #f1f5f9', padding: '12px 20px' }, body: { padding: 0 } }}
                            >
                                <Table 
                                    dataSource={data}
                                    columns={columns}
                                    rowKey={record => record.sku + record.asin}
                                    loading={loading}
                                    pagination={{
                                        current: currentPage,
                                        pageSize: pageSize,
                                        total: totalCount,
                                        onChange: (page, size) => {
                                            setCurrentPage(page);
                                            setPageSize(size);
                                        },
                                        showSizeChanger: true,
                                        pageSizeOptions: ['10', '20', '50', '100'],
                                        showTotal: (total, range) => <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Viewing {range[0]}-{range[1]} of {total} listings</span>,
                                        placement: 'bottomRight'
                                    }}
                                    scroll={{ x: 800 }}
                                    size="small"
                                    className="custom-table-ant"
                                    locale={{
                                        emptyText: (
                                            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                                                <Layers className="mb-2 opacity-25" size={32} />
                                                <div style={{ fontSize: 12, fontWeight: 600 }}>No inventory records found</div>
                                            </div>
                                        )
                                    }}
                                />
                            </Card>
                        </Col>
                    </Row>
                )}

            </div>
        </>
    );
};

export default SkuReport;
