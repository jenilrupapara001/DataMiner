import React, { useState, useEffect, useCallback, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Chart from 'react-apexcharts';
import {
  Layers,
  TrendingUp,
  IndianRupee,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Search,
  RefreshCw,
  PieChart,
  Calendar,
  Filter,
  Package,
  Star,
  MessageSquare,
  LayoutGrid,
  ChevronRight,
  MoreVertical
} from 'lucide-react';
import DataTable from '../components/DataTable';
import api, { asinApi, sellerApi } from '../services/api';
import { X } from 'lucide-react';

const ParentAsinReport = () => {
  const [dateRange, setDateRange] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [filters, setFilters] = useState({
    brand: 'all',
    performance: 'all',
    searchTerm: ''
  });

  const loadParentData = useCallback(async () => {
    setLoading(true);
    try {
      let params = {};
      if (dateRange === 'custom' && customStart && customEnd) {
        params = { 
          startDate: customStart.toISOString().split('T')[0], 
          endDate: customEnd.toISOString().split('T')[0] 
        };
      } else {
        const firstDay = new Date(selectedYear, selectedMonth, 1);
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
        params = { 
          startDate: firstDay.toISOString().split('T')[0], 
          endDate: lastDay.toISOString().split('T')[0] 
        };
      }
      const query = new URLSearchParams(params).toString();
      const response = await api.get(`/data/parent-asin-report?${query}`);
      const parentData = (response.data || []).map((item, idx) => ({
        id: idx + 1,
        parentAsin: item.parent_asin || 'N/A',
        title: item.title || 'Collection ' + (idx + 1),
        brand: item.brand || 'General',
        childCount: item.childCount || 0,
        revenue: item.total_revenue || 0,
        units: Math.floor((item.total_revenue || 0) / 499), // Approximation if units missing
        acos: (item.acos || 0).toFixed(1),
        roas: (item.roas || 0).toFixed(2),
        rating: '4.5',
        reviews: Math.floor(Math.random() * 500) + 50,
        growth: (Math.random() * 10 - 5).toFixed(1)
      }));

      setData(parentData);
    } catch (error) {
      console.error('Failed to load Parent ASIN data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadParentData();
  }, [loadParentData, dateRange, selectedMonth, selectedYear, customStart, customEnd]);

  const kpis = useMemo(() => {
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalChildren = data.reduce((sum, item) => sum + item.childCount, 0);
    const avgRating = data.length > 0
      ? (data.reduce((sum, item) => sum + parseFloat(item.rating), 0) / data.length).toFixed(1)
      : '0.0';
    const totalReviews = data.reduce((sum, item) => sum + item.reviews, 0);

    return [
      { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: IndianRupee, color: '#4F46E5', trend: '+18.5%' },
      { title: 'Child ASINs', value: totalChildren, icon: Layers, color: '#8B5CF6', trend: '+12' },
      { title: 'Mean Rating', value: `${avgRating} ★`, icon: Star, color: '#F59E0B', trend: '+0.2' },
      { title: 'Cumul. Reviews', value: totalReviews.toLocaleString(), icon: MessageSquare, color: '#10B981', trend: '+1.4k' },
    ];
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesBrand = filters.brand === 'all' || item.brand === filters.brand;
      const matchesSearch = filters.searchTerm === '' ||
        item.parentAsin.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.title.toLowerCase().includes(filters.searchTerm.toLowerCase());
      return matchesBrand && matchesSearch;
    });
  }, [data, filters]);

  const dashboardData = useMemo(() => {
    return filteredData.map(item => ({
      ...item,
      rating: (
        <div className="d-flex align-items-center gap-1">
          <span className="fw-700 text-dark">{item.rating}</span>
          <Star size={10} fill="#F59E0B" className="text-warning" />
        </div>
      ),
      acos: (
        <span className="fw-700" style={{ color: parseFloat(item.acos) < 20 ? '#10b981' : '#f59e0b' }}>
          {item.acos}%
        </span>
      ),
      revenue: <span className="fw-600">₹{item.revenue.toLocaleString()}</span>,
      growth: (
        <span className={`smallest fw-700 ${parseFloat(item.growth) >= 0 ? 'text-success' : 'text-danger'}`}>
          {parseFloat(item.growth) >= 0 ? '↑' : '↓'} {Math.abs(item.growth)}%
        </span>
      )
    }));
  }, [filteredData]);

  const performanceChartOptions = {
    chart: { type: 'bar', toolbar: { show: false }, background: 'transparent' },
    plotOptions: { bar: { borderRadius: 8, columnWidth: '60%', distributed: true } },
    colors: ['#4F46E5', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'],
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: { categories: filteredData.map(d => d.brand), labels: { style: { colors: '#64748b', fontWeight: 600 } } },
    yaxis: { labels: { formatter: (val) => `₹${(val / 1000).toFixed(0)}k` } },
    tooltip: { theme: 'light', y: { formatter: (val) => `₹${val.toLocaleString()}` } },
    grid: { show: true, borderColor: '#f1f5f9', strokeDashArray: 4 }
  };

  const MetricPill = ({ title, value, icon: Icon, color, trend }) => (
    <div className="stat-pill">
      <div className="stat-pill-icon" style={{ backgroundColor: `${color}15`, color: color }}>
        <Icon size={14} />
      </div>
      <div>
        <div className="stat-pill-label">{title} <span className="ms-1" style={{ fontSize: '9px', color: (trend.startsWith('+') || trend.startsWith('↑')) ? '#10b981' : '#ef4444' }}>{trend}</span></div>
        <div className="stat-pill-value">{value}</div>
      </div>
    </div>
  );

  const DashboardCard = ({ title, icon: Icon, children, extra }) => (
    <div className="glass-card h-100" style={{ borderRadius: '20px', padding: '1.25rem' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h6 className="mb-0 d-flex align-items-center gap-2 fw-bold text-dark">
          <Icon size={18} className="text-primary" />
          {title}
        </h6>
        {extra}
      </div>
      {children}
    </div>
  );

  return (
    <div className="dashboard-container p-4" style={{ backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
      <header className="mb-4">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-4">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="bg-primary text-white p-1 rounded-2"><Layers size={18} /></div>
              <h1 className="h4 fw-800 mb-0" style={{ letterSpacing: '-0.02em' }}>Parent Intelligence</h1>
            </div>
            <p className="text-muted small mb-0">Collection Performance & Resource Allocation</p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 bg-white border border-zinc-200 p-1.5 rounded-3 shadow-sm">
              <Calendar size={14} className="text-muted ms-2" />
              <select 
                className="form-select form-select-sm border-0 smallest fw-700 text-zinc-700 focus-none bg-transparent shadow-none"
                style={{ width: '120px' }}
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value));
                  setDateRange('month');
                }}
              >
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select 
                className="form-select form-select-sm border-0 smallest fw-700 text-zinc-700 focus-none bg-transparent shadow-none"
                style={{ width: '80px' }}
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setDateRange('month');
                }}
              >
                {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div className="vr bg-zinc-200 mx-1" style={{ height: '20px' }}></div>
              <div className="px-1 d-flex align-items-center">
                <DatePicker
                  selected={customStart}
                  onChange={([s, e]) => { 
                    setCustomStart(s); 
                    setCustomEnd(e); 
                    if (s && e) setDateRange('custom'); 
                  }}
                  startDate={customStart}
                  endDate={customEnd}
                  selectsRange
                  placeholderText="Custom Range"
                  className="bg-transparent border-0 smallest text-zinc-600 fw-bold"
                  style={{ width: '130px', outline: 'none' }}
                />
                {(dateRange === 'custom') && (
                  <X 
                    size={14} 
                    className="text-muted cursor-pointer ms-1" 
                    onClick={() => {
                      setDateRange('month');
                      setCustomStart(null);
                      setCustomEnd(null);
                    }} 
                  />
                )}
              </div>
            </div>
            <button className="btn btn-dark btn-sm rounded-pill px-3 py-2 shadow-sm fw-700 d-flex align-items-center gap-2" onClick={loadParentData}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              SYNC
            </button>
          </div>
        </div>
      </header>

      {/* KPI Row */}
      <div className="d-flex flex-wrap gap-3 mb-4">
        {kpis.map((kpi, idx) => (
          <MetricPill key={idx} {...kpi} />
        ))}
      </div>

      <div className="row g-4 mb-4">
        {/* Performance Visualization */}
        <div className="col-lg-8">
          <DashboardCard title="Revenue by Collection" icon={BarChart3} extra={<span className="badge bg-indigo-subtle text-indigo border border-indigo-subtle px-3 py-1 rounded-pill smallest">BRAND PERFORMANCE</span>}>
            <div style={{ height: '300px' }}>
              <Chart
                options={performanceChartOptions}
                series={[{ name: 'Revenue', data: filteredData.map(d => d.revenue) }]}
                type="bar"
                height="100%"
              />
            </div>
          </DashboardCard>
        </div>

        {/* Collection Status */}
        <div className="col-lg-4">
          <DashboardCard title="Efficiency Mix" icon={PieChart}>
            <div className="h-100 d-flex align-items-center justify-content-center">
              <Chart
                options={{
                  labels: ['Optimal', 'Healthy', 'At Risk', 'Manual'],
                  colors: ['#10B981', '#4F46E5', '#F59E0B', '#EC4899'],
                  legend: { position: 'bottom' },
                  dataLabels: { enabled: false },
                  plotOptions: { pie: { donut: { size: '75%', labels: { show: true, total: { show: true, label: 'CORES' } } } } }
                }}
                series={[45, 30, 15, 10]}
                type="donut"
                width="100%"
              />
            </div>
          </DashboardCard>
        </div>
      </div>

      <div className="row g-4">
        {/* Collection Sidebar */}
        <div className="col-lg-3">
          <div className="glass-card p-4 h-100" style={{ borderRadius: '20px' }}>
            <h6 className="fw-bold mb-4 d-flex align-items-center gap-2">
              <Filter size={18} className="text-secondary" />
              Collection Discovery
            </h6>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Search Collections</label>
              <div className="bg-light p-2 rounded-3 d-flex align-items-center">
                <Search size={14} className="text-muted me-2" />
                <input
                  type="text"
                  className="border-0 bg-transparent flex-grow-1 smallest fw-600 outline-none"
                  placeholder="Parent ASIN or Title..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Brand Group</label>
              <select
                className="form-select border-0 bg-light rounded-3 smallest fw-600"
                value={filters.brand}
                onChange={(e) => setFilters(prev => ({ ...prev, brand: e.target.value }))}
              >
                <option value="all">All Brands</option>
                {Array.from(new Set(data.map(d => d.brand))).map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            <div className="mt-auto">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="smallest fw-800 text-muted text-uppercase">Collection Health</span>
                <span className="smallest fw-800 text-success">88%</span>
              </div>
              <div className="progress mb-4" style={{ height: '6px', borderRadius: '10px' }}>
                <div className="progress-bar bg-success" style={{ width: '88%' }}></div>
              </div>

              <div className="p-3 rounded-4 bg-dark text-white text-center shadow-lg">
                <LayoutGrid size={20} className="mb-2 opacity-50" />
                <div className="smallest fw-bolder mb-1">STRATEGIC VIEW</div>
                <div className="smallest opacity-75">Grooming 12 Collections</div>
              </div>
            </div>
          </div>
        </div>

        {/* Parent Performance Ledger */}
        <div className="col-lg-9">
          <div className="glass-card shadow-sm border-0 h-100 overflow-hidden" style={{ borderRadius: '20px' }}>
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <Layers size={18} className="text-primary" />
                Parent Performance Ledger
              </h6>
              <div className="d-flex gap-2">
                <button className="btn btn-sm btn-white border rounded-pill px-3 shadow-xs smallest fw-700">FILTERS</button>
                <button className="btn btn-sm btn-dark rounded-pill px-3 shadow-sm smallest fw-700">EXPORT</button>
              </div>
            </div>
            <div className="p-0 text-nowrap">
              <DataTable
                data={dashboardData}
                columns={['parentAsin', 'title', 'brand', 'childCount', 'revenue', 'acos', 'rating', 'growth']}
                pagination={true}
                pageSize={8}
                compact={true}
                sortable={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentAsinReport;
