import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Chart from 'react-apexcharts';
import {
  Megaphone,
  TrendingUp,
  IndianRupee,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Layers,
  Search,
  RefreshCw,
  PieChart,
  Calendar,
  Filter,
  MoreVertical,
  FileUp,
  Download,
  XCircle,
  ChevronLeft
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import DataTable from '../components/DataTable';
import api, { asinApi, sellerApi } from '../services/api';

const AdsReport = () => {
  const [data, setData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last30');
  const [filters, setFilters] = useState({
    campaignType: 'all',
    status: 'all',
    searchTerm: ''
  });

  const [reportType, setReportType] = useState('daily');
  const [selectedAsin, setSelectedAsin] = useState(null);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);

  const loadAdsData = useCallback(async () => {
    setLoading(true);
    try {
      let startDate;
      const now = new Date();
      let endDate = now.toISOString().split('T')[0]; // Initialize endDate to today's date

      // Create a new Date object for startDate calculation to avoid modifying 'now' before endDate is set
      const startDateCalc = new Date();

      if (dateRange === 'last7') {
        startDate = new Date(startDateCalc.setDate(startDateCalc.getDate() - 7)).toISOString().split('T')[0];
      } else if (dateRange === 'last30') {
        startDate = new Date(startDateCalc.setDate(startDateCalc.getDate() - 30)).toISOString().split('T')[0];
      } else if (dateRange === 'last90') {
        startDate = new Date(startDateCalc.setDate(startDateCalc.getDate() - 90)).toISOString().split('T')[0];
      } else if (dateRange === 'custom' && customStartDate) {
        startDate = customStartDate.toISOString().split('T')[0];
        if (customEndDate) {
          endDate = customEndDate.toISOString().split('T')[0];
        }
      }

      const params = { startDate, endDate, reportType };
      if (selectedAsin) params.asin = selectedAsin;

      const response = await api.get(`/data/ads-report`, params);

      setData(response.data || []);
      setDailyData(response.dailyData || []);
    } catch (error) {
      console.error('Failed to load ads data:', error);
    }
    setLoading(false);
  }, [dateRange, reportType, selectedAsin, customStartDate, customEndDate]);

  useEffect(() => {
    loadAdsData();
  }, [loadAdsData]);

  const kpis = useMemo(() => {
    const totalSpend = data.reduce((sum, item) => sum + (item.ad_spend || 0), 0);
    const totalSales = data.reduce((sum, item) => sum + (item.ad_sales || 0), 0);
    const totalClicks = data.reduce((sum, item) => sum + (item.clicks || 0), 0);
    const totalImpressions = data.reduce((sum, item) => sum + (item.impressions || 0), 0);
    const totalOrders = data.reduce((sum, item) => sum + (item.orders || 0), 0);
    const avgRoas = totalSpend > 0 ? (totalSales / totalSpend).toFixed(2) : '0.00';
    const avgAcos = totalSales > 0 ? ((totalSpend / totalSales) * 100).toFixed(1) : '0.0';
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0.00';

    return [
      { title: 'Total Spend', value: `₹${totalSpend.toLocaleString()}`, icon: IndianRupee, color: '#4F46E5', trend: '' },
      { title: 'Total Sales', value: `₹${totalSales.toLocaleString()}`, icon: TrendingUp, color: '#8B5CF6', trend: '' },
      { title: 'Total Orders', value: totalOrders.toLocaleString(), icon: Layers, color: '#EC4899', trend: '' },
      { title: 'Total Clicks', value: totalClicks.toLocaleString(), icon: Target, color: '#F59E0B', trend: '' },
      { title: 'Impressions', value: totalImpressions.toLocaleString(), icon: Activity, color: '#10B981', trend: '' },
      { title: 'CTR', value: `${ctr}%`, icon: BarChart3, color: '#EF4444', trend: '' },
      { title: 'Avg ROAS', value: `${avgRoas}x`, icon: ArrowUpRight, color: '#06B6D4', trend: '' },
      { title: 'Avg ACoS', value: `${avgAcos}%`, icon: ArrowDownRight, color: '#84CC16', trend: '' },
    ];
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = filters.searchTerm === '' || (item.asin && item.asin.toString().toLowerCase().includes(filters.searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [data, filters]);

  const handleCsvImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reportType', reportType);
    // reportDate? For monthly we might need a monthpicker, but defaults for now
    formData.append('date', new Date().toISOString().split('T')[0]);

    try {
      await api.post('/upload/upload-ads', formData);
      alert('Ads data uploaded successfully');
      loadAdsData();
    } catch (error) {
      console.error('Failed to upload ads data:', error);
      alert('Upload failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Active': 'bg-success-subtle text-success border-success-subtle',
      'Paused': 'bg-warning-subtle text-warning border-warning-subtle',
      'Ended': 'bg-danger-subtle text-danger border-danger-subtle'
    };
    return (
      <span className={`badge border rounded-pill px-2 py-1 smallest fw-700 ${colors[status] || 'bg-light text-muted'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const getAcosColor = (acos) => {
    const val = parseFloat(acos);
    if (val > 35) return '#ef4444';
    if (val > 25) return '#f59e0b';
    return '#10b981';
  };

  const dashboardData = useMemo(() => {
    return data.map((item, idx) => ({
      ...item,
      id: idx,
      asin: <span className="fw-700 text-primary" style={{ fontSize: '12px' }}>{item.asin}</span>,
      acos: (
        <span className="fw-700 badge" style={{
          color: getAcosColor(item.acos),
          backgroundColor: `${getAcosColor(item.acos)}15`
        }}>
          {parseFloat(item.acos || 0).toFixed(1)}%
        </span>
      ),
      roas: (
        <span className="fw-700 text-dark">
          {parseFloat(item.roas || 0).toFixed(2)}x
        </span>
      ),
      spend: <span className="fw-600 text-success">₹{(item.ad_spend || 0).toLocaleString()}</span>,
      sales: <span className="fw-600 text-primary">₹{(item.ad_sales || 0).toLocaleString()}</span>,
      clicks: <span className="fw-600">{(item.clicks || 0).toLocaleString()}</span>,
      impressions: <span className="fw-600">{(item.impressions || 0).toLocaleString()}</span>,
      orders: <span className="fw-600">{(item.orders || 0).toLocaleString()}</span>,
      ctr: <span className="fw-600">{(item.ctr || 0).toFixed(2)}%</span>,
      aov: <span className="fw-600 text-dark">₹{(item.aov || 0).toLocaleString()}</span>
    }));
  }, [data, selectedAsin]);

  // Chart options for Performance Efficiency
  const performanceChartOptions = {
    chart: {
      type: 'line',
      toolbar: { show: true, tools: { download: true, selection: false, zoom: true, pan: true, reset: true } },
      background: 'transparent',
      animations: { enabled: true, easing: 'easeinout', speed: 800 }
    },
    colors: ['#4F46E5', '#10B981'],
    stroke: { curve: 'smooth', width: 3, dashArray: [0, 5] },
    dataLabels: { enabled: false },
    fill: { type: 'solid', opacity: 0.1 },
    xaxis: {
      categories: dailyData.map(d => d.date),
      labels: { show: true, style: { colors: '#64748b', fontSize: '11px' }, rotate: -45 },
      tickPlacement: 'on'
    },
    yaxis: { labels: { show: true, style: { colors: '#64748b' }, formatter: (val) => `₹${val.toLocaleString()}` } },
    tooltip: { theme: 'light', y: { formatter: (val) => `₹${val.toLocaleString()}` } },
    grid: { show: true, borderColor: '#f1f5f9', strokeDashArray: 4 },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '12px' },
    markers: { size: 4, strokeWidth: 0, hover: { size: 6 } }
  };

  const MetricPill = ({ title, value, icon: Icon, color, trend }) => (
    <div className="stat-pill" style={{
      minWidth: '140px',
      flex: '1 1 auto',
      padding: '12px 16px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      border: '1px solid #e2e8f0'
    }}>
      <div className="stat-pill-icon" style={{ backgroundColor: `${color}15`, color: color, width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} />
      </div>
      <div style={{ marginTop: '8px' }}>
        <div className="stat-pill-label" style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
        <div className="stat-pill-value" style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', marginTop: '2px' }}>{value}</div>
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
              <div className="bg-primary text-white p-1 rounded-2"><Megaphone size={18} /></div>
              <h1 className="h4 fw-800 mb-0" style={{ letterSpacing: '-0.02em' }}>Ads Intelligence</h1>
            </div>
            <p className="text-muted small mb-0">Performance Analysis & Product Optimization</p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <input
              type="file"
              id="csvImport"
              accept=".csv"
              onChange={handleCsvImport}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-white btn-sm rounded-pill px-3 py-2 shadow-sm fw-700 d-flex align-items-center gap-2 border border-light"
              onClick={() => document.getElementById('csvImport').click()}
            >
              <FileUp size={14} />
              IMPORT CSV
            </button>
            <div className="glass-card p-1 d-flex gap-1 ms-2" style={{ borderRadius: '50px' }}>
              {['7D', '30D', '90D', 'Custom'].map((range) => (
                <button
                  key={range}
                  className={`btn btn-sm px-3 rounded-pill border-0 transition-base ${dateRange === (range === '7D' ? 'last7' : range === '30D' ? 'last30' : range === '90D' ? 'last90' : 'custom') ? 'btn-primary shadow-sm' : 'btn-light bg-transparent text-muted'}`}
                  style={{ fontSize: '11px', fontWeight: 700 }}
                  onClick={() => setDateRange(range === '7D' ? 'last7' : range === '30D' ? 'last30' : range === '90D' ? 'last90' : 'custom')}
                >
                  {range}
                </button>
              ))}
            </div>
            {dateRange === 'custom' && (
              <div className="ms-2 d-flex align-items-center bg-white border rounded-pill px-3 py-1 shadow-sm" style={{ height: '36px' }}>
                <Calendar size={14} className="text-muted me-2" />
                <DatePicker
                  selectsRange={true}
                  startDate={customStartDate}
                  endDate={customEndDate}
                  onChange={(update) => {
                    const [start, end] = update;
                    setCustomStartDate(start);
                    setCustomEndDate(end);
                  }}
                  className="border-0 bg-transparent smallest fw-600 outline-none"
                  dateFormat="MMM d, yyyy"
                  placeholderText="Select range"
                  isClearable={true}
                  style={{ width: '150px' }}
                />
              </div>
            )}
            <button className="btn btn-dark btn-sm rounded-pill px-3 py-2 shadow-sm fw-700 d-flex align-items-center gap-2 ms-2" onClick={loadAdsData}>
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              SYNC
            </button>
          </div>
        </div>
      </header>

      {/* KPI Bar */}
      <div className="d-flex flex-wrap gap-3 mb-4">
        {kpis.map((kpi, idx) => (
          <MetricPill key={idx} {...kpi} />
        ))}
      </div>

      <div className="row g-4 mb-4">
        {/* Trend Visualization */}
        <div className="col-lg-8">
          <DashboardCard 
            title={selectedAsin ? `Performance: ${selectedAsin}` : "Performance Efficiency"} 
            icon={Activity} 
            extra={
              <div className="d-flex align-items-center gap-2">
                {selectedAsin && (
                  <button 
                    className="btn btn-xs btn-outline-danger rounded-pill px-2 py-1 d-flex align-items-center gap-1 fw-700"
                    onClick={() => setSelectedAsin(null)}
                    style={{ fontSize: '10px' }}
                  >
                    <XCircle size={12} />
                    BACK TO ALL
                  </button>
                )}
                <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 rounded-pill smallest">SPEND VS SALES</span>
              </div>
            }
          >
            <div style={{ height: '320px' }}>
              <Chart
                options={performanceChartOptions}
                series={[
                  { name: 'Ad Spend', data: dailyData.map(d => d.ad_spend) },
                  { name: 'Ad Sales', data: dailyData.map(d => d.ad_sales) }
                ]}
                type="line"
                height="100%"
              />
            </div>
          </DashboardCard>
        </div>

        {/* Campaign Mix */}
        <div className="col-lg-4">
          <DashboardCard title="Product Mix" icon={PieChart}>
            <div className="h-100 d-flex align-items-center justify-content-center">
              <Chart
                options={{
                  labels: data.slice(0, 5).map(d => d.asin),
                  colors: ['#4F46E5', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'],
                  legend: { position: 'bottom', fontSize: '11px' },
                  dataLabels: { enabled: false },
                  plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'TOTAL' } } } } }
                }}
                series={data.slice(0, 5).map(d => d.ad_spend || 1)}
                type="donut"
                width="100%"
              />
            </div>
          </DashboardCard>
        </div>
      </div>

      <div className="row g-4 mb-4">
        {/* Advanced Filters */}
        <div className="col-lg-3">
          <div className="glass-card p-4 h-100" style={{ borderRadius: '20px' }}>
            <h6 className="fw-bold mb-4 d-flex align-items-center gap-2">
              <Filter size={18} className="text-secondary" />
              Optimization Filters
            </h6>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Search Campaigns</label>
              <div className="bg-light p-2 rounded-3 d-flex align-items-center">
                <Search size={14} className="text-muted me-2" />
                <input
                  type="text"
                  className="border-0 bg-transparent flex-grow-1 smallest fw-600 outline-none"
                  placeholder="ASIN..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Ad Type</label>
              <select
                className="form-select border-0 bg-light rounded-3 smallest fw-600"
                value={filters.campaignType}
                onChange={(e) => setFilters(prev => ({ ...prev, campaignType: e.target.value }))}
              >
                <option value="all">All Channels</option>
                <option>Sponsored Products</option>
                <option>Sponsored Brands</option>
                <option>Sponsored Display</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="smallest fw-bolder text-muted mb-2 d-block text-uppercase">Report Type</label>
              <div className="d-flex flex-wrap gap-2">
                {['daily', 'monthly'].map(type => (
                  <button
                    key={type}
                    className={`btn btn-xs rounded-pill px-3 py-1 ${reportType === type ? 'btn-primary' : 'btn-light border'} fw-600`}
                    onClick={() => setReportType(type)}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-auto p-3 rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-10 text-center">
              <Target size={24} className="text-primary mb-2" />
              <div className="text-primary smallest fw-bolder">ACoS Target: 25%</div>
              <div className="text-muted smallest mt-1">Optimization active</div>
            </div>
          </div>
        </div>

        {/* Campaign Performance Ledger */}
        <div className="col-lg-9">
          <div className="glass-card shadow-sm border-0 h-100 overflow-hidden" style={{ borderRadius: '20px' }}>
            <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
              <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                <BarChart3 size={18} className="text-primary" />
                Product Performance Ledger
              </h6>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-white border rounded-pill px-3 shadow-xs smallest fw-700 d-flex align-items-center gap-1"
                  onClick={() => {
                    const csvContent = "data:text/csv;charset=utf-8,Campaign,Type,Status,Spend,Sales,Clicks\nCampaign A,Sponsored Products,Active,1000,5000,800\nCampaign B,Sponsored Brands,Paused,500,2000,400";
                    const encodedUri = encodeURI(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "ads_template.csv");
                    document.body.appendChild(link);
                    link.click();
                  }}
                >
                  <Layers size={12} />
                  TEMPLATE
                </button>
                <button className="btn btn-sm btn-white border rounded-pill px-3 shadow-xs smallest fw-700">EXPORT</button>
              </div>
            </div>
            <div className="p-0 text-nowrap">
              <DataTable
                data={dashboardData}
                columns={['asin', 'spend', 'sales', 'clicks', 'impressions', 'ctr', 'acos', 'roas', 'aov']}
                pagination={true}
                pageSize={8}
                compact={true}
                sortable={true}
                onRowClick={(row) => {
                  // The data row asin column has JSX tags in it, so we need to extract string from data[rowIdx].asin or similar
                  // Actually the data passed to DataTable is 'dashboardData' which has JSX in 'asin' field.
                  // We should use the original 'data' item or find it.
                  const rawItem = data.find(d => d.asin === row.asin.props.children || d.asin === row.asin);
                  if (rawItem) {
                    setSelectedAsin(rawItem.asin);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdsReport;
