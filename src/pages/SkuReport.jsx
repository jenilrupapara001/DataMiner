import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { IndianRupee, Package, Percent, Activity, TrendingUp, PieChart, Filter, BarChart3, Download, Search, RefreshCw, Layers, Target, Calendar, X } from 'lucide-react';
import { useDateRange } from '../contexts/DateRangeContext';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import Chart from 'react-apexcharts';
import KPICard from '../components/KPICard';
import Card from '../components/common/Card';
import DataTable from '../components/DataTable';
import api from '../services/api';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

const SkuReport = () => {
  const { startDate, endDate, rangeType } = useDateRange();
  const [searchParams] = useSearchParams();
  const initialAsin = searchParams.get('asin') || '';

  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    searchTerm: initialAsin
  });
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Update searchTerm if asin param changes
  useEffect(() => {
    if (initialAsin) {
      setFilters(prev => ({ ...prev, searchTerm: initialAsin }));
    }
  }, [initialAsin]);

  const loadSkuData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        startDate: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        endDate: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        rangeType
      };

      // Clean params: remove null/undefined/string 'null'
      const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== null && v !== undefined && v !== 'null')
      );

      const query = new URLSearchParams(cleanParams).toString();
      const response = await api.get(`/data/sku-report?${query}`);
      const skuData = (response.data || []).map((item, idx) => ({
        id: idx + 1,
        sku: item.sku || 'N/A',
        asin: item.asin || 'N/A',
        title: item.title || 'Product ' + (idx + 1),
        category: item.category || 'General',
        revenue: item.total_revenue || 0,
        units: item.units_sold || 0,
        aov: item.units_sold > 0 ? (item.total_revenue / item.units_sold).toFixed(2) : (item.price || 0).toFixed(2),
        acos: item.ad_sales > 0 ? ((item.ad_spend / item.ad_sales) * 100).toFixed(1) : '0.0',
        roas: item.ad_spend > 0 ? (item.ad_sales / item.ad_spend).toFixed(2) : '0.00',
        clicks: item.clicks || 0,
        impressions: item.impressions || 0,
        conversion: item.clicks > 0 ? ((item.units_sold / item.clicks) * 100).toFixed(1) : '0.0',
        status: 'Active'
      }));

      setData(skuData);
    } catch (error) {
      console.error('Failed to load SKU data:', error);
    }
    setLoading(false);
  }, [startDate, endDate, rangeType]);

  useEffect(() => {
    loadSkuData();
  }, [loadSkuData]);

  const kpis = useMemo(() => {
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalUnits = data.reduce((sum, item) => sum + item.units, 0);
    const avgConversion = data.length > 0
      ? (data.reduce((sum, item) => sum + parseFloat(item.conversion), 0) / data.length).toFixed(1)
      : '0.0';
    const totalSessions = data.reduce((sum, item) => sum + item.sessions, 0);

    return [
      { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: IndianRupee, color: 'indigo', trend: 'up', change: '+14%' },
      { title: 'Units Sold', value: totalUnits.toLocaleString(), icon: Package, color: 'violet', trend: 'up', change: '+8%' },
      { title: 'Avg Conversion', value: `${avgConversion}%`, icon: Percent, color: 'emerald', trend: 'up', change: '+1.2%' },
      { title: 'Total Sessions', value: totalSessions.toLocaleString(), icon: Activity, color: 'amber', trend: 'up', change: '+22%' },
    ];
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesCategory = filters.category === 'all' || item.category === filters.category;
      const matchesSearch = filters.searchTerm === '' ||
        item.sku.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.asin.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(filters.searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [data, filters]);

  const dashboardData = useMemo(() => {
    return filteredData.map(item => ({
      ...item,
      status: (
        <span className="badge rounded-pill bg-success-subtle text-success border border-success-subtle smallest fw-600 px-2 py-1">
          {item.status.toUpperCase()}
        </span>
      ),
      conversion: (
        <span className="fw-700 text-zinc-900">
          {item.conversion}%
        </span>
      ),
      revenue: <span className="fw-600 text-zinc-900">₹{item.revenue.toLocaleString()}</span>,
      units: <span className="fw-600 text-zinc-700">{item.units}</span>
    }));
  }, [filteredData]);

  const performanceChartOptions = {
    chart: { type: 'line', toolbar: { show: false }, background: 'transparent' },
    colors: ['#4F46E5', '#10B981'],
    stroke: { curve: 'smooth', width: [3, 3] },
    plotOptions: { bar: { columnWidth: '35%', borderRadius: 6 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: filteredData.slice(0, 10).map(d => d.sku),
      labels: { style: { colors: 'var(--zinc-500)', fontSize: '10px' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: [
      { title: { text: 'Revenue (₹)', style: { color: 'var(--zinc-500)', fontWeight: 500 } }, labels: { style: { colors: 'var(--zinc-500)' } } },
      { opposite: true, title: { text: 'Units', style: { color: 'var(--zinc-500)', fontWeight: 500 } }, labels: { style: { colors: 'var(--zinc-500)' } } }
    ],
    tooltip: { theme: 'light', shared: true, intersect: false },
    grid: { show: true, borderColor: 'var(--zinc-100)', strokeDashArray: 4 }
  };

  if (loading && data.length === 0) {
    return <PageLoader message="Loading SKU Intelligence..." />;
  }

  return (
    <div className="page-container pb-5">
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}
      <div className="page-header mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="p-2 bg-indigo-subtle text-indigo-600 rounded-3">
                <Layers size={20} />
              </div>
              <h1 className="page-title mb-0">SKU Intelligence</h1>
            </div>
            <p className="text-muted small mb-0">Deep Insights & Inventory Analytics</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-white btn-sm rounded-circle p-2 shadow-sm border border-zinc-200" onClick={loadSkuData}>
              <RefreshCw size={14} className={loading ? 'spin text-primary' : 'text-zinc-500'} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="row g-3 mb-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="col-md-3">
            <KPICard {...kpi} />
          </div>
        ))}
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-8">
          <Card
            title="Revenue vs. Volume"
            icon={TrendingUp}
            className="border-zinc-200 shadow-sm rounded-4"
            extra={<span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 rounded-pill smallest fw-600">TOP 10 SKUS</span>}
          >
            <div style={{ height: '320px' }}>
              <Chart
                options={performanceChartOptions}
                series={[
                  { name: 'Revenue', type: 'column', data: filteredData.slice(0, 10).map(d => d.revenue) },
                  { name: 'Units', type: 'line', data: filteredData.slice(0, 10).map(d => d.units) }
                ]}
                height="100%"
              />
            </div>
          </Card>
        </div>

        <div className="col-lg-4">
          <Card
            title="Category Mix"
            icon={PieChart}
            className="border-zinc-200 shadow-sm rounded-4"
          >
            <div className="h-100 d-flex align-items-center justify-content-center">
              <Chart
                options={{
                  labels: Array.from(new Set(data.map(d => d.category))).slice(0, 4),
                  colors: ['#4F46E5', '#8B5CF6', '#EC4899', '#F59E0B'],
                  legend: { position: 'bottom', labels: { colors: 'var(--zinc-500)', useSeriesColors: false } },
                  dataLabels: { enabled: false },
                  stroke: { show: false },
                  plotOptions: { pie: { donut: { size: '75%', labels: { show: true, total: { show: true, label: 'TOTAL', color: 'var(--zinc-900)' } } } } }
                }}
                series={[40, 30, 20, 10]}
                type="donut"
                width="100%"
                height={320}
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-3">
          <Card
            title="Optimization Filters"
            icon={Filter}
            className="border-zinc-200 shadow-sm rounded-4"
          >
            <div className="mb-4">
              <label className="smallest fw-bold text-zinc-500 mb-2 d-block text-uppercase tracking-wider">Search Inventory</label>
              <div className="input-group input-group-sm rounded-pill overflow-hidden border border-zinc-200 shadow-sm bg-white p-1">
                <span className="input-group-text bg-transparent border-0 text-muted ps-2"><Search size={14} /></span>
                <input
                  type="text"
                  className="form-control border-0 ps-1"
                  placeholder="SKU, ASIN..."
                  value={filters.searchTerm}
                  style={{ fontSize: '13px' }}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="smallest fw-bold text-zinc-500 mb-2 d-block text-uppercase tracking-wider">Brand / Category</label>
              <select
                className="form-select form-select-sm border-zinc-200 rounded-pill shadow-sm bg-white ps-3"
                value={filters.category}
                style={{ fontSize: '13px' }}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              >
                <option value="all">All Channels</option>
                {Array.from(new Set(data.map(d => d.category))).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="p-4 rounded-4 bg-primary-subtle border border-primary-subtle shadow-sm">
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="p-1.5 bg-primary text-white rounded-circle">
                  <Target size={14} />
                </div>
                <span className="text-primary smallest fw-bold">Conversion Target: 15%</span>
              </div>
              <div className="progress bg-white" style={{ height: '6px', borderRadius: '10px' }}>
                <div className="progress-bar bg-primary shadow-sm" style={{ width: '45%' }}></div>
              </div>
              <div className="text-muted smallest mt-3 text-center fw-medium">Average Performance: <span className="text-zinc-900 fw-bold">6.8%</span></div>
            </div>
          </Card>
        </div>

        <div className="col-lg-9">
          <Card
            title="SKU Performance Ledger"
            icon={BarChart3}
            className="border-zinc-200 shadow-sm rounded-4 overflow-hidden"
            extra={
              <button className="btn btn-white btn-sm fw-bold d-flex align-items-center gap-2 shadow-sm border border-zinc-200 rounded-pill px-3 py-1.5" style={{ fontSize: '11px' }}>
                <Download size={14} className="text-primary" /> Export Dataset
              </button>
            }
            padding="0"
          >
            <div className="p-0 table-responsive border-top border-zinc-100">
              <DataTable
                data={dashboardData}
                columns={['sku', 'asin', 'title', 'category', 'status', 'revenue', 'units', 'conversion']}
                pagination={true}
                pageSize={10}
                compact={true}
                sortable={true}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SkuReport;
