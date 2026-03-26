import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import NumberChart from '../components/common/NumberChart';
import Chart from 'react-apexcharts';
import { CHART_COLORS, mergeApexOptions, areaChartOptions } from '../utils/chartTheme';
import {
  Megaphone, TrendingUp, IndianRupee, Activity, Target, ArrowUpRight,
  ArrowDownRight, BarChart3, Layers, Search, RefreshCw, Calendar, FileUp,
  X, MousePointer, Eye, ShoppingCart, DollarSign, Download, ChevronLeft,
  ChevronRight, Copy, Check, ArrowUp, ArrowDown, Minus, Upload, PieChart,
  Filter, BarChart2, Settings, Percent, Zap, XCircle
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import api from '../services/api';
import Card from '../components/common/Card';
import PageHeader from '../components/common/PageHeader';
import KPICard from '../components/KPICard';
import './AdsReport.css';

// ─── Utility Helpers ────────────────────────────────────────────
const fmt = (val, prefix = '₹') => {
  if (!val || val === 0) return '—';
  const n = Number(val);
  if (isNaN(n)) return '—';
  if (n >= 10000000) return `${prefix}${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `${prefix}${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const fmtFull = (val, prefix = '₹') => {
  if (!val || val === 0) return '—';
  return `${prefix}${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

const fmtPct = (val) => {
  if (!val || val === 0) return '—';
  return `${Number(val).toFixed(2)}%`;
};

const fmtX = (val) => {
  if (!val || val === 0) return '—';
  return `${Number(val).toFixed(2)}×`;
};

const fmtNum = (val) => {
  if (!val || val === 0) return '—';
  return Number(val).toLocaleString('en-IN');
};

const getDelta = (curr, prev) => {
  if (!prev || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
};

const getDateRangeMs = (key) => {
  const day = 86400000;
  const map = { '7d': 7, '30d': 30, '90d': 90, '6m': 180, '1y': 365 };
  return map[key] ? map[key] * day : null;
};

const formatDateShort = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};

const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.ceil(Math.abs(new Date(b) - new Date(a)) / 86400000) + 1;
};

// ─── Component ──────────────────────────────────────────────────
const AdsReport = () => {
  const [data, setData] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [prevData, setPrevData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [chartMode, setChartMode] = useState('revenue');
  const [tableSearch, setTableSearch] = useState('');
  const [perfFilter, setPerfFilter] = useState('all');
  const [sortKey, setSortKey] = useState('ad_sales');
  const [sortDir, setSortDir] = useState('desc');
  const [viewMode, setViewMode] = useState('asin'); // 'asin' or 'daily'
  const [tablePage, setTablePage] = useState(1);
  const [drawerAsin, setDrawerAsin] = useState(null);
  const [selectedAsin, setSelectedAsin] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [copiedAsin, setCopiedAsin] = useState(false);
  const fileRef = useRef(null);
  const [reportType] = useState('daily');
  const TABLE_PAGE_SIZE = 15;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1];

  const chartModes = [
    { key: 'revenue', label: 'Revenue & Trend' },
    { key: 'efficiency', label: 'Efficiency' },
  ];

  // ─── Date Computation ───────────────────────────────────────
  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    let start, end;

    if (dateRange === 'custom' && customStart) {
      start = customStart.toISOString().split('T')[0];
      end = customEnd ? customEnd.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    } else {
      // Month-wise
      const firstDay = new Date(selectedYear, selectedMonth, 1);
      const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
      start = firstDay.toISOString().split('T')[0];
      end = lastDay.toISOString().split('T')[0];
    }

    const rangeDays = daysBetween(start, end);
    const pe = new Date(new Date(start).getTime() - 86400000);
    const ps = new Date(pe.getTime() - (rangeDays - 1) * 86400000);
    return { 
      startDate: start, 
      endDate: end, 
      prevStartDate: ps.toISOString().split('T')[0], 
      prevEndDate: pe.toISOString().split('T')[0] 
    };
  }, [dateRange, selectedMonth, selectedYear, customStart, customEnd]);

  // ─── Data Loading ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { startDate, endDate, reportType };
      if (selectedAsin) params.asin = selectedAsin;
      const res = await api.get('/data/ads-report', params);
      setData(res.data || []);
      setDailyData(res.dailyData || []);

      if (compareMode) {
        const prevParams = { startDate: prevStartDate, endDate: prevEndDate, reportType };
        const prevRes = await api.get('/data/ads-report', prevParams);
        setPrevData(prevRes.data || []);
      } else {
        setPrevData([]);
      }
    } catch (e) {
      console.error('Failed to load ads data:', e);
    }
    setLoading(false);
  }, [startDate, endDate, prevStartDate, prevEndDate, compareMode, reportType, selectedAsin]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setTablePage(1); }, [tableSearch, perfFilter, sortKey, sortDir]);

  // ─── KPI Computation ───────────────────────────────────────
  const kpis = useMemo(() => {
    const sum = (arr, k) => arr.reduce((s, i) => s + (i[k] || 0), 0);
    const ts = sum(data, 'ad_spend'), tsa = sum(data, 'ad_sales');
    const tc = sum(data, 'clicks'), ti = sum(data, 'impressions');
    const to = sum(data, 'orders'), os = sum(data, 'organic_sales');

    const pts = sum(prevData, 'ad_spend'), ptsa = sum(prevData, 'ad_sales');
    const ptc = sum(prevData, 'clicks'), pti = sum(prevData, 'impressions');
    const pto = sum(prevData, 'orders'), pos = sum(prevData, 'organic_sales');

    const acos = tsa > 0 ? (ts / tsa) * 100 : 0;
    const roas = ts > 0 ? tsa / ts : 0;
    const ctr = ti > 0 ? (tc / ti) * 100 : 0;

    const pAcos = ptsa > 0 ? (pts / ptsa) * 100 : 0;
    const pRoas = pts > 0 ? ptsa / pts : 0;
    const pCtr = pti > 0 ? (ptc / pti) * 100 : 0;

    return [
      { title: 'Total Spend', value: fmt(ts), icon: IndianRupee, color: 'indigo', trend: ts >= pts ? 'up' : 'down', change: getDelta(ts, pts) ? `${Math.abs(getDelta(ts, pts)).toFixed(1)}%` : null },
      { title: 'Ad Sales', value: fmt(tsa), icon: TrendingUp, color: 'violet', trend: tsa >= ptsa ? 'up' : 'down', change: getDelta(tsa, ptsa) ? `${Math.abs(getDelta(tsa, ptsa)).toFixed(1)}%` : null },
      { title: 'Organic Sales', value: fmt(os), icon: ShoppingCart, color: 'emerald', trend: os >= pos ? 'up' : 'down', change: getDelta(os, pos) ? `${Math.abs(getDelta(os, pos)).toFixed(1)}%` : null },
      { title: 'Total Orders', value: fmtNum(to), icon: Layers, color: 'amber', trend: to >= pto ? 'up' : 'down', change: getDelta(to, pto) ? `${Math.abs(getDelta(to, pto)).toFixed(1)}%` : null },
      { title: 'Total Clicks', value: fmtNum(tc), icon: MousePointer, color: 'cyan', trend: tc >= ptc ? 'up' : 'down', change: getDelta(tc, ptc) ? `${Math.abs(getDelta(tc, ptc)).toFixed(1)}%` : null },
      { title: 'ACoS', value: fmtPct(acos), icon: ArrowDownRight, color: 'rose', trend: acos <= pAcos ? 'up' : 'down', change: pAcos > 0 ? `${Math.abs(getDelta(acos, pAcos)).toFixed(1)}%` : null, inverted: true },
      { title: 'ROAS', value: fmtX(roas), icon: ArrowUpRight, color: 'emerald', trend: roas >= pRoas ? 'up' : 'down', change: pRoas > 0 ? `${Math.abs(getDelta(roas, pRoas)).toFixed(1)}%` : null },
      { title: 'CTR', value: fmtPct(ctr), icon: Target, color: 'indigo', trend: ctr >= pCtr ? 'up' : 'down', change: pCtr > 0 ? `${Math.abs(getDelta(ctr, pCtr)).toFixed(1)}%` : null },
    ];
  }, [data, prevData]);

  // ─── Budget Distribution ────────────────────────────────────
  const budgetDist = useMemo(() => {
    let zero = 0, low = 0, mid = 0, high = 0;
    data.forEach(d => {
      const s = d.ad_spend || 0;
      if (s === 0) zero++;
      else if (s < 100) low++;
      else if (s <= 500) mid++;
      else high++;
    });
    const total = data.length || 1;
    const topSpenders = [...data].sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0));
    const top2pct = Math.max(1, Math.ceil(total * 0.02));
    const topSpend = topSpenders.slice(0, top2pct).reduce((s, d) => s + (d.ad_spend || 0), 0);
    const totalSpend = data.reduce((s, d) => s + (d.ad_spend || 0), 0) || 1;
    const top2share = ((topSpend / totalSpend) * 100).toFixed(0);
    const zeroPct = ((zero / total) * 100).toFixed(0);
    return {
      series: [zero, low, mid, high],
      labels: ['No Spend', '<₹100', '₹100–500', '>₹500'],
      insight: `Top 2% of ASINs consumed ${top2share}% of budget. ${zeroPct}% of catalog had zero ad spend.`
    };
  }, [data]);

  const efficiencyMetrics = useMemo(() => {
    const sum = (k) => data.reduce((s, i) => s + (i[k] || 0), 0);
    const ts = sum('ad_spend'), tsa = sum('ad_sales');
    const tc = sum('clicks'), ti = sum('impressions'), to = sum('orders');
    const roas = ts > 0 ? tsa / ts : 0;
    const acos = tsa > 0 ? (ts / tsa) * 100 : 0;
    const cpc = tc > 0 ? ts / tc : 0;
    const convRate = tc > 0 ? (to / tc) * 100 : 0;
    const ctr = ti > 0 ? (tc / ti) * 100 : 0;
    const aov = to > 0 ? tsa / to : 0;
    const bbArr = data.filter(d => d.buy_box_percentage > 0);
    const bb = bbArr.length > 0 ? bbArr.reduce((s, d) => s + d.buy_box_percentage, 0) / bbArr.length : 0;
    
    // Calculate a visibility/conversion index if not present
    const conversionIndex = tc > 0 ? (to / tc) : 0;
    
    return [
      { 
        label: 'Ad Sales Share', 
        value: fmtPct(tsa > 0 ? (tsa / (sum('total_sales') || 1) * 100) : 0), 
        pct: Math.min(100, (tsa / (sum('total_sales') || 1) * 100) / 0.3), // Benchmark 30%
        color: 'var(--indigo-500)', 
        benchmark: 'Target: 30%' 
      },
      { 
        label: 'Spend Efficacy', 
        value: fmtX(roas), 
        pct: Math.min(100, (roas / 5.0) * 100), // Benchmark 5.0x
        color: 'var(--emerald-500)', 
        benchmark: 'Target: 5.0x' 
      },
      { 
        label: 'Catalog Visibility', 
        value: fmtPct(conversionIndex * 100), 
        pct: Math.min(100, (conversionIndex / 0.02) * 100), // Benchmark 2%
        color: 'var(--amber-500)', 
        benchmark: 'Target: 2.0%' 
      }
    ];
  }, [data]);

  // ─── Chart Config ───────────────────────────────────────────
  const chartConfig = useMemo(() => {
    const dates = dailyData.map(d => d.date);
    const base = {
      chart: { background: 'transparent', toolbar: { show: true, tools: { download: true, selection: false, zoom: true, pan: true, reset: true } }, animations: { enabled: true, easing: 'easeinout', speed: 600 } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      xaxis: {
        categories: dates,
        axisBorder: { show: false }, axisTicks: { show: false },
        labels: { style: { colors: '#64748b', fontSize: '10px' }, rotate: -45, rotateAlways: dates.length > 14 }
      },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', fontWeight: 600, labels: { colors: '#64748b' } },
      tooltip: { theme: 'light' },
      markers: { size: 3, strokeWidth: 0, hover: { size: 5 } },
      dataLabels: { enabled: false },
    };

    switch (chartMode) {
      case 'revenue':
        return {
          options: {
            ...base, chart: { ...base.chart, type: 'line' }, colors: ['#4F46E5', '#10B981', '#8B5CF6'],
            stroke: { curve: 'smooth', width: [2, 2, 2], dashArray: [5, 0, 0] },
            fill: { type: 'solid', opacity: [0, 0.08, 0.08] },
            yaxis: { labels: { style: { colors: '#64748b' }, formatter: v => fmt(v) } }, xaxis: base.xaxis
          },
          series: [
            { name: 'Ad Spend', data: dailyData.map(d => d.ad_spend || 0) },
            { name: 'Ad Sales', data: dailyData.map(d => d.ad_sales || 0) },
            { name: 'Organic Sales', data: dailyData.map(d => d.organic_sales || 0) },
          ],
          type: 'line'
        };
      case 'roas':
        return {
          options: {
            ...base, chart: { ...base.chart, type: 'area' }, colors: ['#10B981'],
            stroke: { curve: 'smooth', width: 2 },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
            yaxis: { labels: { style: { colors: '#64748b' }, formatter: v => `${v.toFixed(1)}×` } },
            annotations: {
              yaxis: [
                { y: 1, borderColor: '#ef4444', strokeDashArray: 4, label: { text: 'Break-even', style: { background: '#ef4444', color: '#fff', fontSize: '10px' } } },
                { y: 5, borderColor: '#10b981', strokeDashArray: 4, label: { text: 'Target', style: { background: '#10b981', color: '#fff', fontSize: '10px' } } },
              ]
            }, xaxis: base.xaxis
          },
          series: [{ name: 'ROAS', data: dailyData.map(d => d.roas || 0) }],
          type: 'area'
        };
      case 'acos':
        return {
          options: {
            ...base, chart: { ...base.chart, type: 'area' }, colors: ['#F59E0B'],
            stroke: { curve: 'smooth', width: 2 },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
            yaxis: { labels: { style: { colors: '#64748b' }, formatter: v => `${v.toFixed(1)}%` } },
            annotations: {
              yaxis: [
                { y: 15, borderColor: '#f59e0b', strokeDashArray: 4, label: { text: 'Target 15%', style: { background: '#f59e0b', color: '#fff', fontSize: '10px' } } },
              ]
            }, xaxis: base.xaxis
          },
          series: [{ name: 'ACoS', data: dailyData.map(d => d.acos || 0) }],
          type: 'area'
        };
      case 'clicks':
        return {
          options: {
            ...base, chart: { ...base.chart, type: 'line' }, colors: ['#4F46E5', '#06b6d4'],
            stroke: { curve: 'smooth', width: [0, 2] },
            plotOptions: { bar: { borderRadius: 3, columnWidth: '50%' } },
            yaxis: [
              { title: { text: 'Clicks', style: { color: '#64748b', fontSize: '11px' } }, labels: { style: { colors: '#64748b' }, formatter: v => fmtNum(v) } },
              { opposite: true, title: { text: 'Impressions', style: { color: '#64748b', fontSize: '11px' } }, labels: { style: { colors: '#64748b' }, formatter: v => fmt(v, '') } }
            ], xaxis: base.xaxis
          },
          series: [
            { name: 'Clicks', type: 'column', data: dailyData.map(d => d.clicks || 0) },
            { name: 'Impressions', type: 'line', data: dailyData.map(d => d.impressions || 0) },
          ],
          type: 'line'
        };
      case 'funnel':
        return {
          options: {
            ...base, chart: { ...base.chart, type: 'area', stacked: true }, colors: ['#e2e8f0', '#4F46E5', '#10B981'],
            stroke: { curve: 'smooth', width: 1 },
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.1 } },
            yaxis: { labels: { style: { colors: '#64748b' }, formatter: v => fmtNum(v) } }, xaxis: base.xaxis
          },
          series: [
            { name: 'Impressions', data: dailyData.map(d => d.impressions || 0) },
            { name: 'Clicks', data: dailyData.map(d => d.clicks || 0) },
            { name: 'Orders', data: dailyData.map(d => d.orders || 0) },
          ],
          type: 'area'
        };
      default:
        return { options: base, series: [], type: 'line' };
    }
  }, [chartMode, dailyData]);

  // ─── Table Data ─────────────────────────────────────────────
  const filteredTableData = useMemo(() => {
    let rows = viewMode === 'asin' ? [...data] : [...dailyData];
    
    if (tableSearch) {
      const q = tableSearch.toLowerCase();
      if (viewMode === 'asin') {
        rows = rows.filter(r => (r.asin && r.asin.toLowerCase().includes(q)) || (r.sku && r.sku.toLowerCase().includes(q)));
      } else {
        rows = rows.filter(r => r.date && r.date.includes(q));
      }
    }

    if (viewMode === 'asin') {
      switch (perfFilter) {
        case 'high_roas': rows = rows.filter(r => (r.roas || 0) > 10); break;
        case 'high_acos': rows = rows.filter(r => (r.acos || 0) > 30); break;
        case 'zero_sales': rows = rows.filter(r => !r.ad_sales || r.ad_sales === 0); break;
        case 'top_spenders': rows = [...rows].sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0)).slice(0, 20); break;
        default: break;
      }
    }

    rows.sort((a, b) => {
      const va = a[sortKey] || 0, vb = b[sortKey] || 0;
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return rows;
  }, [data, dailyData, viewMode, tableSearch, perfFilter, sortKey, sortDir]);

  const pagedData = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return filteredTableData.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredTableData, tablePage]);

  const totalPages = Math.ceil(filteredTableData.length / TABLE_PAGE_SIZE);

  const drawerAsinData = useMemo(() => {
    if (!drawerAsin) return null;
    return data.find(d => d.asin === drawerAsin) || null;
  }, [drawerAsin, data]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleSync = async () => {
    setSyncing(true); await loadData(); setSyncing(false);
    setSyncDone(true); setTimeout(() => setSyncDone(false), 2000);
  };

  const handleExport = () => {
    const headers = ['ASIN', 'Spend', 'Sales', 'Orders', 'Clicks', 'Impressions', 'CTR', 'CPC', 'Conv Rate', 'ROAS', 'ACoS', 'Organic Sales', 'AOV'];
    const csvRows = [headers.join(',')];
    filteredTableData.forEach(r => {
      csvRows.push([r.asin, r.ad_spend || 0, r.ad_sales || 0, r.orders || 0, r.clicks || 0, r.impressions || 0,
      (r.ctr || 0).toFixed(2), (r.cpc || 0).toFixed(2), (r.conversion_rate || 0).toFixed(2),
      (r.roas || 0).toFixed(2), (r.acos || 0).toFixed(2), r.organic_sales || 0, (r.aov || 0).toFixed(2)].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `ads_report_${startDate}_${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reportType', 'daily');
    formData.append('date', new Date().toISOString().split('T')[0]);
    try {
      const result = await api.post('/upload/upload-ads', formData);
      const msg = [
        `✅ Import complete: ${result.processed || 0} rows processed`,
        result.skipped ? `⏭️ ${result.skipped} skipped` : '',
        result.errors ? `❌ ${result.errors} errors` : '',
      ].filter(Boolean).join('\n');
      alert(msg);
      loadData();
    } catch (err) {
      console.error('Upload failed:', err);
      alert(`❌ Upload failed: ${err.message}\n\nMake sure your CSV has columns like: ASIN, Date, Spend, Sales, Clicks, Impressions, Orders`);
    }
    setLoading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const copyAsin = (asin) => { navigator.clipboard.writeText(asin); setCopiedAsin(true); setTimeout(() => setCopiedAsin(false), 1500); };

  // ─── Table Cell Renderer ───────────────────────────────────
  const tableColumns = useMemo(() => {
    if (viewMode === 'asin') {
      return [
        { key: 'asin', label: 'ASIN', align: 'left' },
        { key: 'ad_spend', label: 'Spend', align: 'right' },
        { key: 'ad_sales', label: 'Ad Sales', align: 'right' },
        { key: 'organic_sales', label: 'Org. Sales', align: 'right' },
        { key: 'total_sales', label: 'Total Sales', align: 'right' },
        { key: 'orders', label: 'Orders', align: 'right' },
        { key: 'roas', label: 'ROAS', align: 'right' },
        { key: 'acos', label: 'ACoS', align: 'right' },
        { key: 'aov', label: 'AOV', align: 'right' },
      ];
    }
    return [
      { key: 'date', label: 'Date', align: 'left' },
      { key: 'ad_spend', label: 'Spend', align: 'right' },
      { key: 'ad_sales', label: 'Ad Sales', align: 'right' },
      { key: 'organic_sales', label: 'Org. Sales', align: 'right' },
      { key: 'total_sales', label: 'Total Sales', align: 'right' },
      { key: 'orders', label: 'Orders', align: 'right' },
      { key: 'roas', label: 'ROAS', align: 'right' },
      { key: 'acos', label: 'ACoS', align: 'right' },
      { key: 'cpc', label: 'CPC', align: 'right' },
    ];
  }, [viewMode]);

  const getCellValue = (row, key) => {
    const v = row[key];
    switch (key) {
      case 'asin': return <span className="asin-cell">{v}</span>;
      case 'date': return <span className="fw-bold">{fmtDateShort(v)}</span>;
      case 'ad_spend': case 'ad_sales': case 'organic_sales': case 'total_sales': case 'cpc': case 'aov': return fmtFull(v);
      case 'orders': case 'clicks': case 'impressions': return fmtNum(v);
      case 'ctr': case 'conversion_rate': return fmtPct(v);
      case 'roas': {
        const val = v || 0;
        const barW = Math.min((val / 25) * 100, 100);
        const barColor = val >= 4 ? '#10b981' : val >= 1 ? '#f59e0b' : '#ef4444';
        return (<div className="roas-bar-wrap"><span>{fmtX(val)}</span><div className="roas-bar"><div className="roas-bar-fill" style={{ width: `${barW}%`, background: barColor }} /></div></div>);
      }
      case 'acos': {
        const val = v || 0;
        const cls = val === 0 ? '' : val <= 10 ? 'acos-green' : val <= 20 ? 'acos-amber' : 'acos-red';
        return <span className={cls} style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{val === 0 ? '—' : `${val.toFixed(1)}%`}</span>;
      }
      default: return v || '—';
    }
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="page-container pb-5">
      <div className="page-header mb-4">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <div className="p-2 bg-indigo-subtle text-indigo-600 rounded-3">
                <Megaphone size={20} />
              </div>
              <h1 className="page-title mb-0">Ads Intelligence</h1>
            </div>
            <p className="text-muted small mb-0">Cross-channel Advertising Performance & Attribution</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <div className="d-flex align-items-center gap-2 bg-white border border-zinc-200 p-1.5 rounded-3 shadow-sm">
              <Calendar size={14} className="text-muted ms-2" />
              <select 
                className="form-select form-select-sm border-0 smallest fw-700 text-zinc-700 focus-none bg-transparent"
                style={{ width: '120px' }}
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value));
                  setDateRange('month');
                }}
              >
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select 
                className="form-select form-select-sm border-0 smallest fw-700 text-zinc-700 focus-none bg-transparent"
                style={{ width: '80px' }}
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setDateRange('month');
                }}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
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
            
            <div className="d-flex gap-2">
              <button 
                className={`btn btn-sm rounded-pill px-3 py-1.5 fw-bold transition-all border shadow-sm ${compareMode ? 'btn-primary border-primary' : 'btn-white border-zinc-200 text-zinc-600'}`}
                style={{ fontSize: '11px' }}
                onClick={() => setCompareMode(!compareMode)}
              >
                <Activity size={14} className="me-1" /> Compare
              </button>
              
              <button 
                className="btn btn-white btn-sm rounded-pill px-3 py-1.5 fw-bold transition-all border shadow-sm text-zinc-600" 
                style={{ fontSize: '11px' }} 
                onClick={() => fileRef.current.click()}
                disabled={loading}
              >
                {loading ? <RefreshCw size={14} className="me-1 spin" /> : <Upload size={14} className="me-1" />}
                Import
              </button>
              <input 
                type="file" 
                ref={fileRef} 
                onChange={handleCsvImport} 
                accept=".csv,.xlsx,.xls" 
                style={{ display: 'none' }} 
              />

              <button className="btn btn-white btn-sm rounded-circle p-2 shadow-sm border border-zinc-200" onClick={loadData}>
                <RefreshCw size={14} className={loading ? 'spin text-primary' : 'text-zinc-500'} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="row g-3 mb-4">
        {kpis.map((k, i) => (
          <div key={i} className={i < 4 ? "col-md-3" : "col-md-3 d-none d-lg-block"}>
            <KPICard {...k} />
          </div>
        ))}
      </div>

      <div className="row g-4 mb-4">
        {/* Secondary KPIs / Micro Stats for Mobile/Tablets */}
        <div className="col-12 d-lg-none">
          <div className="d-flex gap-2 overflow-auto pb-2 noscroll">
            {kpis.slice(4).map((k, i) => (
              <div key={i} style={{ minWidth: '180px' }}>
                <KPICard {...k} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ CHARTS ROW ═══════════════════════════════════════════ */}
      <div className="row g-4 mb-4">
        {/* Main Chart */}
        <div className="col-lg-8">
          <Card
            title={selectedAsin ? `Performance: ${selectedAsin}` : "Revenue & Efficiency Trend"}
            headerActions={
              <div className="ads-chart-toggles">
                {chartModes.map(m => (
                  <button key={m.key} className={`ads-chart-toggle ${chartMode === m.key ? 'active' : ''}`} onClick={() => setChartMode(m.key)}>{m.label}</button>
                ))}
              </div>
            }
          >
            <div style={{ height: '320px', width: '100%' }}>
              {dailyData.length > 0 ? (
                chartMode === 'revenue' ? (
                  <Chart
                    options={{
                      ...areaChartOptions(fmt),
                      xaxis: {
                        categories: dailyData.map(d => d.date),
                        labels: { style: { colors: '#64748b', fontSize: '10px' } },
                        axisBorder: { show: false },
                        axisTicks: { show: false }
                      },
                      colors: ['#0f172a', '#10b981', '#6366f1'],
                      stroke: { width: 2, curve: 'smooth' },
                      grid: { borderColor: '#f1f5f9' }
                    }}
                    series={[
                      { name: 'Ad Spend', data: dailyData.map(d => d.ad_spend || 0) },
                      { name: 'Ad Sales', data: dailyData.map(d => d.ad_sales || 0) },
                      { name: 'Organic Sales', data: dailyData.map(d => d.organic_sales || 0) }
                    ]}
                    type="area"
                    height="100%"
                  />
                ) : (
                  <Chart options={chartConfig.options} series={chartConfig.series} type={chartConfig.type} height="100%" />
                )
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-muted smallest fw-600 opacity-50">NO DATA POINTS IN CURRENT RANGE</div>
              )}
            </div>
          </Card>
        </div>

        {/* Donut */}
        <div className="col-lg-4">
          <Card title="Spend Allocation">
            <div className="d-flex flex-column align-items-center justify-content-center" style={{ height: '320px' }}>
              <Chart
                options={{
                  labels: budgetDist.labels,
                  colors: ['#f1f5f9', '#94a3b8', '#0f172a', '#6366f1'],
                  legend: { position: 'bottom', fontSize: '11px', fontWeight: 600, labels: { colors: '#64748b' } },
                  dataLabels: { enabled: false },
                  stroke: { width: 0 },
                  plotOptions: { pie: { donut: { size: '80%', labels: { show: true, total: { show: true, label: 'TOTAL ASINS', color: '#64748b', fontSize: '10px', formatter: () => data.length } } } } },
                  tooltip: { theme: 'light' }
                }}
                series={budgetDist.series}
                type="donut" width="100%" height={260}
              />
              <div className="ads-insight mt-auto border-0 bg-gray-50 p-3 rounded-2 smallest fw-500 text-muted">
                {budgetDist.insight}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ══ SCORECARD + TABLE ROW ════════════════════════════════ */}
      <div className="row g-4 mb-4">
        {/* Efficiency Scorecard */}
        <div className="col-lg-3">
          <Card title="Efficiency Scorecard">
            <div className="py-2">
              {efficiencyMetrics.map((m, i) => (
                <div key={i} className="ads-score-row">
                  <span className="ads-score-label">{m.label}</span>
                  <div className="ads-score-bar-wrap">
                    <div className="ads-score-bar" style={{ width: `${m.pct}%`, background: m.color }} />
                  </div>
                  <span className="ads-score-value">{m.value}</span>
                  <span className="ads-score-benchmark opacity-50">{m.benchmark}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Product Performance Ledger */}
        <div className="col-lg-9">
          <Card
            title="Performance Ledger"
            icon={Layers}
            headerActions={
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex bg-zinc-100 p-0.5 rounded-pill border border-zinc-200">
                  <button
                    className={`btn btn-sm px-3 py-1 rounded-pill smallest border-0 transition-all ${viewMode === 'asin' ? 'bg-white shadow-sm text-zinc-900 border-zinc-200' : 'text-zinc-500'}`}
                    onClick={() => { setViewMode('asin'); setSortKey('ad_sales'); }}
                  >
                    ASIN VIEW
                  </button>
                  <button
                    className={`btn btn-sm px-3 py-1 rounded-pill smallest border-0 transition-all ${viewMode === 'daily' ? 'bg-white shadow-sm text-zinc-900 border-zinc-200' : 'text-zinc-500'}`}
                    onClick={() => { setViewMode('daily'); setSortKey('date'); }}
                  >
                    DAILY BREAKDOWN
                  </button>
                </div>
                <button className="btn btn-sm btn-white border-zinc-200 rounded-pill smallest fw-600 px-3 shadow-none" onClick={handleExport}>
                  <Download size={14} className="text-muted" /> CSV
                </button>
              </div>
            }
          >
            {/* Filter Bar */}
            <div className="ads-filter-bar px-1 mb-2">
              <div className="ads-search-box border-gray-100">
                <Search size={13} className="text-muted" />
                <input 
                  className="form-input border-0 p-0 smallest fw-500" 
                  placeholder={viewMode === 'asin' ? "Filter ASIN/SKU..." : "YYYY-MM-DD..."} 
                  value={tableSearch} 
                  onChange={e => setTableSearch(e.target.value)} 
                />
              </div>
              {viewMode === 'asin' && (
                <select className="form-select ads-select border-gray-100 smallest fw-500" value={perfFilter} onChange={e => setPerfFilter(e.target.value)}>
                  <option value="all">ALL PERFORMANCE</option>
                  <option value="high_roas">HIGH ROAS (&gt;10×)</option>
                  <option value="high_acos">HIGH ACOS (&gt;30%)</option>
                  <option value="zero_sales">ZERO SALES</option>
                  <option value="top_spenders">TOP SPENDERS</option>
                </select>
              )}
            </div>

            <div className="p-3">
              <div className="table-responsive">
                <table className="table table-hover align-middle border-zinc-200">
                  <thead className="bg-zinc-50 border-bottom border-zinc-200">
                    <tr>
                      {tableColumns.map(c => (
                        <th key={c.key} className={`text-uppercase smallest fw-700 text-zinc-500 py-3 px-4 ${c.align === 'right' ? 'text-end' : ''}`} onClick={() => handleSort(c.key)} style={{ cursor: 'pointer' }}>
                          <div className={`d-flex align-items-center gap-1 ${c.align === 'right' ? 'justify-content-end' : ''}`}>
                            {c.label}
                            {sortKey === c.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="border-0">
                    {pagedData.map((row, idx) => (
                      <tr key={idx} className="border-bottom border-zinc-100 hover-bg-light transition-all cursor-pointer" onClick={() => setDrawerAsin(row.asin)}>
                        {tableColumns.map(c => (
                          <td key={c.key} className={`py-3 px-4 fw-600 text-zinc-900 smallest ${c.align === 'right' ? 'text-end' : ''}`}>
                            {getCellValue(row, c.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="d-flex justify-content-between align-items-center mt-4 px-2">
                <div className="smallest text-muted fw-600 uppercase letter-spacing-1">
                  Showing {Math.min(filteredTableData.length, (tablePage - 1) * TABLE_PAGE_SIZE + 1)}–{Math.min(filteredTableData.length, tablePage * TABLE_PAGE_SIZE)} of {filteredTableData.length} records
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-white btn-sm border-zinc-200 rounded-pill px-3 fw-bold shadow-sm" disabled={tablePage === 1} onClick={() => setTablePage(p => p - 1)}>Previous</button>
                  <button className="btn btn-white btn-sm border-zinc-200 rounded-pill px-3 fw-bold shadow-sm" disabled={tablePage === totalPages} onClick={() => setTablePage(p => p + 1)}>Next</button>
                </div>
              </div>
            </div>

            {/* Pagination */}
            {filteredTableData.length > 0 && (
              <div className="ads-pagination border-0 bg-transparent px-1 mt-2">
                <span className="smallest fw-600 text-muted">
                  SHOWING {Math.min(pagedData.length, TABLE_PAGE_SIZE)} OF {filteredTableData.length}
                </span>
                <div className="d-flex align-items-center gap-1">
                  <button className="ads-page-btn border-gray-100 shadow-none" disabled={tablePage <= 1} onClick={() => setTablePage(p => p - 1)}><ChevronLeft size={14} /></button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) page = i + 1;
                    else if (tablePage <= 3) page = i + 1;
                    else if (tablePage >= totalPages - 2) page = totalPages - 4 + i;
                    else page = tablePage - 2 + i;
                    return (<button key={page} className={`ads-page-btn border-gray-100 shadow-none ${tablePage === page ? 'active' : ''}`} onClick={() => setTablePage(page)}>{page}</button>);
                  })}
                  <button className="ads-page-btn border-gray-100 shadow-none" disabled={tablePage >= totalPages} onClick={() => setTablePage(p => p + 1)}><ChevronRight size={14} /></button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ══ ASIN DETAIL DRAWER ═══════════════════════════════════ */}
      <div className={`ads-drawer-overlay ${drawerAsin ? 'open' : ''}`} onClick={() => setDrawerAsin(null)} />
      <div className={`ads-drawer ${drawerAsin ? 'open' : ''}`}>
        {drawerAsinData && (
          <>
            <div className="ads-drawer-header">
              <div className="d-flex align-items-center gap-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-700 text-dark tabular-nums" style={{ fontSize: '16px' }}>{drawerAsin}</span>
                  <button className="btn btn-white border-0 p-1" onClick={() => copyAsin(drawerAsin)}>
                    {copiedAsin ? <Check size={12} className="text-success" /> : <Copy size={12} className="text-muted" />}
                  </button>
                </div>
              </div>
              <button className="btn btn-white border-0 p-1" onClick={() => setDrawerAsin(null)}><X size={18} className="text-muted" /></button>
            </div>

            {/* Sparkline */}
            <div className="px-4 pt-4">
              <div className="smallest fw-700 text-muted text-uppercase mb-3 tracking-wider" style={{ fontSize: '10px' }}>Daily Performance Trend</div>
              <div className="bg-gray-50 p-3 rounded-2 border border-gray-100">
                <Chart
                  options={{
                    chart: { type: 'area', sparkline: { enabled: true }, background: 'transparent' },
                    colors: ['#0f172a', '#10b981'],
                    stroke: { curve: 'smooth', width: 2 },
                    fill: { type: 'gradient', gradient: { opacityFrom: 0.1, opacityTo: 0 } },
                    tooltip: { theme: 'light', x: { show: true }, y: { formatter: v => `₹${v?.toLocaleString() || 0}` } },
                    xaxis: { categories: dailyData.map(d => d.date) }
                  }}
                  series={[
                    { name: 'Spend', data: dailyData.map(d => d.ad_spend || 0) },
                    { name: 'Sales', data: dailyData.map(d => d.ad_sales || 0) },
                  ]}
                  type="area" height="100"
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="ads-drawer-stats px-4 pt-4">
              {[
                { label: 'Total Spend', value: fmtFull(drawerAsinData.ad_spend) },
                { label: 'Total Sales', value: fmtFull(drawerAsinData.ad_sales) },
                { label: 'Units Ordered', value: fmtNum(drawerAsinData.orders) },
                { label: 'Total Clicks', value: fmtNum(drawerAsinData.clicks) },
                { label: 'Impressions', value: fmtNum(drawerAsinData.impressions) },
                { label: 'CTR', value: fmtPct(drawerAsinData.ctr) },
                { label: 'Avg. CPC', value: fmtFull(drawerAsinData.cpc) },
                { label: 'Conv. Rate', value: fmtPct(drawerAsinData.conversion_rate) },
                { label: 'ROAS', value: fmtX(drawerAsinData.roas) },
                { label: 'ACoS', value: fmtPct(drawerAsinData.acos) },
                { label: 'Avg. Order Val', value: fmtFull(drawerAsinData.aov) },
                { label: 'Organic Revenue', value: fmtFull(drawerAsinData.organic_sales) },
              ].map((s, i) => (
                <div key={i} className="ads-drawer-stat border-gray-100">
                  <div className="label">{s.label}</div>
                  <div className="value">{s.value}</div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="p-4 mt-auto">
              <button className="btn btn-dark w-100 py-2 rounded-2 fw-600 smallest" onClick={() => { setSelectedAsin(drawerAsin); setDrawerAsin(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                GENERATE FULL ASIN ANALYSIS
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdsReport;
