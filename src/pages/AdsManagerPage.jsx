import React, { useState, useEffect, useMemo, useCallback, lazy, useRef, Suspense } from 'react';
import {
  Segmented, Select, Button, Input, Tooltip, Typography, Card, Row, Col,
  Modal, Badge, Dropdown, Space, Statistic, Table, Tabs, Tag, message, DatePicker
} from 'antd';
const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const TablePagination = lazy(() => import('@mui/material/TablePagination'));
import {
  Package, Activity, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Download, RefreshCw, Search, Eye, BarChart3, Target,
  Calendar, Layers, TrendingUp as TrendUpIcon,
  FileBarChart, Image as ImageIcon, Filter
} from 'lucide-react';
import { adsApi, sellerApi } from '../services/api';
import InfiniteScrollSelect from '../components/common/InfiniteScrollSelect';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import AdsImportModal from '../components/ads/AdsImportModal';
import Chart from 'react-apexcharts';
import { CHART_COLORS, areaChartOptions } from '../utils/chartTheme';
import { useDateRange } from '../contexts/DateRangeContext';

import { format } from 'date-fns';
import dayjs from 'dayjs';

// ═══════════════════════════════════════════════════════════════
// METRIC MAP
// ═══════════════════════════════════════════════════════════════
const METRIC_MAP = {
  spend: { label: 'Ads Spend', color: '#D32F2F', type: 'currency', seriesType: 'column' },
  sales: { label: 'Ads Sales', color: '#2E7D32', type: 'currency', seriesType: 'column' },
  totalSales: { label: 'Total Sales', color: '#0284c7', type: 'currency', seriesType: 'column' },
  organicSales: { label: 'Organic Sales', color: '#2E7D32', type: 'currency', seriesType: 'column' },
  acos: { label: 'ACOS', color: '#C62828', type: 'percent', seriesType: 'line' },
  tacos: { label: 'TACOS', color: '#0284c7', type: 'percent', seriesType: 'line' },
  roas: { label: 'ROAS', color: '#E65100', type: 'ratio', seriesType: 'line' },
  cvr: { label: 'CVR', color: '#0d9488', type: 'percent', seriesType: 'line' },
  cpc: { label: 'CPC', color: '#ea580c', type: 'currency', seriesType: 'line' },
  ctr: { label: 'CTR', color: '#9C27B0', type: 'percent', seriesType: 'line' },
  orders: { label: 'Ads Orders', color: '#9333ea', type: 'number', seriesType: 'column' },
  organicOrders: { label: 'Organic Orders', color: '#db2777', type: 'number', seriesType: 'column' },
  totalOrders: { label: 'Total Orders', color: '#9C27B0', type: 'number', seriesType: 'column' },
  adSalesPct: { label: 'Ads Sales (%)', color: '#ea580c', type: 'percent', seriesType: 'line' },
  impressions: { label: 'Impressions', color: '#94a3b8', type: 'number', seriesType: 'column' },
  clicks: { label: 'Clicks', color: '#94a3b8', type: 'number', seriesType: 'column' }
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const generateHistoryStructureFromDates = (sortedDates) => {
  if (!sortedDates || sortedDates.length === 0) return [{ label: 'N/A', dates: [] }];
  const recentDates = sortedDates.slice(-7);
  return [{
    label: 'Last 7 Days',
    dates: recentDates.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      return {
        raw: dateStr,
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        day: date.toLocaleDateString('en-IN', { day: '2-digit' }),
        month: date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()
      };
    })
  }];
};

const normalizeDateStr = (dateInput) => {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      if (typeof dateInput === 'string') return dateInput.substring(0, 10);
      return '';
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch (e) {
    return '';
  }
};

const formatCompact = (val) => {
  if (typeof val !== 'number') return '0.00';
  if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(2) + 'K';
  return val.toFixed(2);
};

const getColumnWidth = (column) => {
  if (typeof column.width === 'number') return column.width;
  if (typeof column.width === 'string') {
    const parsed = Number.parseInt(column.width, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 150;
};

const calculateColumnsWidth = (columns) => columns.reduce((total, column) => {
  if (column.children?.length > 0) {
    return total + column.children.reduce((childTotal, child) => childTotal + getColumnWidth(child), 0);
  }
  return total + getColumnWidth(column);
}, 0);

const getColumnDepth = (cols) => {
  let max = 0;
  for (const col of cols) {
    if (col.children?.length > 0) {
      max = Math.max(max, getColumnDepth(col.children));
    }
  }
  return max + 1;
};

const getLeafColumns = (cols) => {
  const result = [];
  for (const col of cols) {
    if (col.children?.length > 0) {
      result.push(...getLeafColumns(col.children));
    } else {
      result.push(col);
    }
  }
  return result;
};

const buildHeaderRows = (cols) => {
  const depth = getColumnDepth(cols);
  const rows = Array.from({ length: depth }, () => []);
  const stickyLeft = {};
  const stickyRight = {};
  let leftAcc = 0;
  let rightAcc = 0;
  for (const col of cols) {
    if (col.fixed === 'left') {
      stickyLeft[col.key] = leftAcc;
      leftAcc += col.width || 0;
    }
    if (col.fixed === 'right') {
      stickyRight[col.key] = rightAcc;
      rightAcc += col.width || 0;
    }
  }
  const walk = (arr, level) => {
    for (const col of arr) {
      if (col.children?.length > 0) {
        const leafCount = getLeafColumns(col.children).length;
        rows[level].push({ ...col, colSpan: leafCount, rowSpan: 1, isGroup: true });
        walk(col.children, level + 1);
      } else {
        rows[level].push({ ...col, colSpan: 1, rowSpan: depth - level });
      }
    }
  };
  walk(cols, 0);
  return { rows, depth, stickyLeft, stickyRight };
};

const TrendBadge = ({ value, prevValue, isInverted = false }) => {
  if (!prevValue) return <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>-</span>;
  const diff = value - prevValue;
  if (Math.abs(diff) < 0.01) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 600, color: '#94a3b8' }}>
      <Activity size={10} /> STABLE
    </div>;
  }
  const isGood = isInverted ? diff < 0 : diff > 0;
  const Icon = isGood ? TrendingUp : TrendingDown;
  const color = isGood ? '#2E7D32' : '#C62828';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 700, color }}>
      <Icon size={10} />
      {isGood ? 'HIGH' : 'LOW'}
    </div>
  );
};

const MiniSpark = ({ data, color }) => {
  if (!data || data.length < 2) return <div style={{ width: '100%', height: 12 }} />;
  const max = Math.max(...data) || 1;
  return (
    <div style={{ width: '100%', height: 14, overflow: 'hidden', opacity: 0.8 }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polyline
          fill="none" stroke={color} strokeWidth="8"
          points={data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v / max) * 90)}`).join(' ')}
        />
      </svg>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// HISTORY MODAL
// ═══════════════════════════════════════════════════════════════
const AdsHistoryModal = ({ isOpen, onClose, rowData }) => {
  if (!rowData) return null;

  const safeFormatDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  };

  const safeFormatDateShort = (dateVal) => {
    if (!dateVal) return 'N/A';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const displayImage = rowData.imageUrl || (rowData.children && rowData.children.find(c => c.imageUrl)?.imageUrl);
  const fullHistory = [...(rowData.history || rowData.weekHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  const columns = [
    {
      title: 'Date', dataIndex: 'date', key: 'date', width: 180,
      render: (dateStr) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569', fontSize: 12 }}>
          {safeFormatDate(dateStr)}
        </span>
      ),
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
    },
    { title: 'Impressions', dataIndex: 'impressions', key: 'impressions', width: 100, align: 'right', render: (val) => Number(val || 0).toLocaleString(), sorter: (a, b) => Number(a.impressions || 0) - Number(b.impressions || 0) },
    { title: 'Clicks', dataIndex: 'clicks', key: 'clicks', width: 90, align: 'right', render: (val) => Number(val || 0).toLocaleString(), sorter: (a, b) => Number(a.clicks || 0) - Number(b.clicks || 0) },
    { title: 'Spend', dataIndex: 'spend', key: 'spend', width: 120, align: 'right', render: (val) => <span style={{ color: '#b91c1c', fontWeight: 600 }}>₹{Number(val || 0).toFixed(2)}</span>, sorter: (a, b) => Number(a.spend || 0) - Number(b.spend || 0) },
    { title: 'Ad Sales', dataIndex: 'sales', key: 'sales', width: 120, align: 'right', render: (val) => <span style={{ color: '#15803d', fontWeight: 700 }}>₹{Number(val || 0).toFixed(2)}</span>, sorter: (a, b) => Number(a.sales || 0) - Number(b.sales || 0) },
    { title: 'ACOS', dataIndex: 'acos', key: 'acos', width: 90, align: 'right', render: (val) => `${Number(val || 0).toFixed(2)}%`, sorter: (a, b) => Number(a.acos || 0) - Number(b.acos || 0) },
    { title: 'TACOS', dataIndex: 'tacos', key: 'tacos', width: 90, align: 'right', render: (val) => `${Number(val || 0).toFixed(2)}%`, sorter: (a, b) => Number(a.tacos || 0) - Number(b.tacos || 0) },
    { title: 'ROAS', dataIndex: 'roas', key: 'roas', width: 80, align: 'right', render: (val) => `${Number(val || 0).toFixed(2)}`, sorter: (a, b) => Number(a.roas || 0) - Number(b.roas || 0) },
    { title: 'Orders', dataIndex: 'orders', key: 'orders', width: 90, align: 'right', render: (val) => Number(val || 0).toLocaleString(), sorter: (a, b) => Number(a.orders || 0) - Number(b.orders || 0) },
    { title: 'Organic Orders', dataIndex: 'organicOrders', key: 'organicOrders', width: 110, align: 'right', render: (val) => Number(val || 0).toLocaleString(), sorter: (a, b) => Number(a.organicOrders || 0) - Number(b.organicOrders || 0) },
    { title: 'Total Orders', dataIndex: 'totalOrders', key: 'totalOrders', width: 110, align: 'right', render: (val) => Number(val || 0).toLocaleString(), sorter: (a, b) => Number(a.totalOrders || 0) - Number(b.totalOrders || 0) },
    { title: 'CVR', dataIndex: 'cvr', key: 'cvr', width: 80, align: 'center', render: (val) => <span style={{ fontWeight: 600, color: '#475569' }}>{Number(val || 0).toFixed(2)}%</span>, sorter: (a, b) => Number(a.cvr || 0) - Number(b.cvr || 0) },
    { title: 'Page Views', dataIndex: 'pageViews', key: 'pageViews', width: 100, align: 'right', render: (val) => Number(val || 0).toLocaleString(), sorter: (a, b) => Number(a.pageViews || 0) - Number(b.pageViews || 0) },
    { title: 'Organic Sales', dataIndex: 'organicSales', key: 'organicSales', width: 120, align: 'right', render: (val) => `₹${Number(val || 0).toFixed(2)}`, sorter: (a, b) => Number(a.organicSales || 0) - Number(b.organicSales || 0) }
  ];

  return (
    <Modal
      open={isOpen} onCancel={onClose} footer={null} width={1200} centered
      styles={{ content: { borderRadius: 8, padding: 0, overflow: 'hidden' }, body: { padding: 0 } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '85vh', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {displayImage ? (
            <img src={displayImage} alt="" style={{ width: 48, height: 48, borderRadius: 6, border: '1px solid #e5e7eb', objectFit: 'contain', background: '#ffffff' }} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <ImageIcon size={20} />
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#f1f5f9', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: 4 }}>
                {rowData.asin || rowData.id}
              </span>
              {rowData.sku && rowData.sku !== 'PARENT' ? (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>SKU: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>{rowData.sku}</span></span>
              ) : (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', background: '#f1f5f9', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: 4, textTransform: 'uppercase' }}>
                  Parent · {rowData.childCount || 0} children
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', maxWidth: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {rowData.title || 'Advertisement Timeline'}
            </div>
          </div>
        </div>

        {/* Chart */}
        {fullHistory.length > 0 && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', height: 200, flexShrink: 0 }}>
            <Chart
              type="area" height="100%"
              series={[
                { name: 'Ad Sales', data: [...fullHistory].reverse().map(d => Number(d.sales || 0).toFixed(0)) },
                { name: 'Ad Spend', data: [...fullHistory].reverse().map(d => Number(d.spend || 0).toFixed(0)) }
              ]}
              options={{
                ...areaChartOptions(val => '₹' + Number(val).toLocaleString('en-IN')),
                colors: ['#15803d', '#b91c1c'],
                chart: { ...areaChartOptions().chart, toolbar: { show: false }, sparkline: { enabled: false } },
                stroke: { curve: 'smooth', width: 2 },
                xaxis: {
                  categories: [...fullHistory].reverse().map(d => safeFormatDateShort(d.date)),
                  labels: { style: { fontSize: '9px', fontWeight: 600 } },
                  axisBorder: { show: false }, axisTicks: { show: false }
                },
                yaxis: { labels: { style: { fontSize: '9px' }, formatter: (v) => v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v } },
                legend: { show: true, position: 'top', horizontalAlign: 'right', fontSize: '10px', fontWeight: 700 }
              }}
            />
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {fullHistory.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Calendar size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>No historical data available</span>
            </div>
          ) : (
            <Table
              dataSource={fullHistory.map((d, idx) => ({ ...d, key: idx }))}
              columns={columns}
              pagination={{ pageSize: 10, showSizeChanger: false, size: 'small', style: { padding: '8px 16px', margin: 0 } }}
              size="small" scroll={{ x: calculateColumnsWidth(columns), y: 'calc(85vh - 330px)' }}
              className="pro-modal-table"
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#fafbfc' }}>
          <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', fontWeight: 500 }}>
            {fullHistory.length} days recorded
          </span>
          <Button onClick={onClose} type="primary" style={{ fontWeight: 600, borderRadius: 6, fontSize: 12 }}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function AdsManagerPage() {
  const { startDate, endDate, updateDateRange } = useDateRange();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  const [chartConfigMetrics, setChartConfigMetrics] = useState(['spend', 'sales', 'acos']);
  const [selectedSeller, setSelectedSeller] = useState(() => localStorage.getItem('selectedSeller') || '');

  useEffect(() => { localStorage.setItem('selectedSeller', selectedSeller); }, [selectedSeller]);

  const fetchSellerDropdownData = useCallback(async (page = 1, search = '') => {
    try {
      const response = await sellerApi.getAll({ page, limit: 1000, search });
      if (response.success) return { data: response.data.sellers || [], hasMore: response.data.pagination?.page < response.data.pagination?.totalPages };
      return { data: [], hasMore: false };
    } catch (err) { return { data: [], hasMore: false }; }
  }, []);

  const fetchSellerItem = useCallback(async (id) => {
    try {
      const response = await sellerApi.getById(id);
      if (response.success && response.seller) return response.seller;
      return null;
    } catch (err) { return null; }
  }, []);

  const summaryData = useMemo(() => {
    const sum = { impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, pageViews: 0, organicSales: 0, organicOrders: 0, totalOrders: 0 };
    data.forEach(d => {
      sum.impressions += Number(d.impressions || 0);
      sum.clicks += Number(d.clicks || 0);
      sum.spend += Number(d.spend || 0);
      sum.sales += Number(d.sales || 0);
      sum.orders += Number(d.orders || 0);
      sum.pageViews += Number(d.pageViews || 0);
      sum.organicSales += Number(d.organicSales || 0);
      sum.organicOrders += Number(d.organicOrders || 0);
    });
    sum.totalSales = sum.sales + sum.organicSales;
    sum.acos = sum.sales > 0 ? (sum.spend / sum.sales) * 100 : 0;
    sum.roas = sum.spend > 0 ? (sum.sales / sum.spend) : 0;
    sum.cvr = sum.clicks > 0 ? (sum.orders / sum.clicks) * 100 : 0;
    sum.cpc = sum.clicks > 0 ? (sum.spend / sum.clicks) : 0;
    sum.ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
    sum.tacos = sum.totalSales > 0 ? (sum.spend / sum.totalSales) * 100 : 0;
    sum.adSalesPct = sum.totalSales > 0 ? (sum.sales / sum.totalSales) * 100 : 0;
    sum.totalOrders = sum.orders + sum.organicOrders;
    return sum;
  }, [data]);

  const [groupBy, setGroupBy] = useState('asin');
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeHistoryRow, setActiveHistoryRow] = useState(null);
  const [showDashboardCharts, setShowDashboardCharts] = useState(true);



  const toggleParentExpand = (parentAsin) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      next.has(parentAsin) ? next.delete(parentAsin) : next.add(parentAsin);
      return next;
    });
  };

  useEffect(() => { setExpandedParents(new Set()); setPage(1); }, [groupBy]);

  const [expandedCols, setExpandedCols] = useState({
    totalSales: false, impressions: false, clicks: false, spend: false,
    sales: false, acos: false, tacos: false, adSalesPct: false,
    roas: false, orders: false, cvr: false, pageViews: false, organicSales: false
  });

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('sales');
  const [sortOrder, setSortOrder] = useState('desc');
  const [globalChartData, setGlobalChartData] = useState([]);

  const toggleCol = (colKey) => { setExpandedCols(prev => ({ ...prev, [colKey]: !prev[colKey] })); };

  const handleChangePage = (event, newPage) => {
    setPage(newPage + 1);
  };

  const handleChangeRowsPerPage = (event) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(1);
  };

  const fetchAdsData = useCallback(async () => {
    try {
      setLoading(true);
      const params = { groupBy, search: searchQuery, page, limit: pageSize, sortBy, sortOrder };
      if (selectedSeller) params.sellerId = selectedSeller;
      if (startDate) params.startDate = format(startDate, 'yyyy-MM-dd');
      if (endDate) params.endDate = format(endDate, 'yyyy-MM-dd');

      const res = await adsApi.getAdsManagerData(params);
      if (res.success) {
        setData(res.data || []);
        setTotalCount(res.total || 0);
        setGlobalChartData(res.globalChartData || []);
      }
    } catch (err) {
      console.error('Failed to fetch ads data:', err);
    } finally {
      setLoading(false);
    }
  }, [groupBy, searchQuery, startDate, endDate, selectedSeller, page, pageSize, sortBy, sortOrder]);

  useEffect(() => { fetchAdsData(); }, [fetchAdsData]);

  const historyStructure = useMemo(() => {
    if (data.length === 0) return [{ label: 'W1', dates: [] }];
    const dateMap = new Map();
    data.forEach(row => {
      if (row.weekHistory) row.weekHistory.forEach(h => { const dk = normalizeDateStr(h.date); if (dk) dateMap.set(dk, true); });
    });
    return generateHistoryStructureFromDates(Array.from(dateMap.keys()).sort());
  }, [data]);

  const activeDates = historyStructure[0]?.dates || [];

  const paginatedData = data;

  // Date picker handler
  const handleDateChange = (dates) => {
    if (dates && dates[0] && dates[1]) {
      updateDateRange({
        startDate: dates[0].toDate(),
        endDate: dates[1].toDate(),
        rangeType: 'custom'
      });
    }
  };

  const dynamicChartState = useMemo(() => {
    if (!globalChartData || globalChartData.length === 0) return { series: [], yaxis: [], colors: [] };
    const series = chartConfigMetrics.map(metricKey => {
      const config = METRIC_MAP[metricKey];
      return {
        name: config.label, type: config.seriesType,
        data: globalChartData.map(d => Number(d[metricKey] || 0).toFixed(config.type === 'currency' ? 2 : config.type === 'number' ? 0 : 2))
      };
    });
    const colors = chartConfigMetrics.map(m => METRIC_MAP[m].color);
    const yaxis = chartConfigMetrics.map((mKey, idx) => {
      const config = METRIC_MAP[mKey];
      const isPercent = ['percent', 'ratio'].includes(config.type);
      const isCurrency = config.type === 'currency';
      const firstNonPctIdx = chartConfigMetrics.findIndex(k => !['percent', 'ratio'].includes(METRIC_MAP[k].type));
      const firstPctIdx = chartConfigMetrics.findIndex(k => ['percent', 'ratio'].includes(METRIC_MAP[k].type));
      const shouldShow = idx === firstNonPctIdx || idx === firstPctIdx;
      return {
        seriesName: config.label, opposite: isPercent, show: shouldShow,
        axisTicks: { show: false }, axisBorder: { show: false },
        title: { style: { fontSize: '9px', fontWeight: 600, color: config.color } },
        labels: {
          show: shouldShow, style: { fontSize: '10px', fontWeight: 500, colors: '#64748b' },
          formatter: (v) => {
            const val = Number(v);
            if (isPercent) return val.toFixed(1) + '%';
            if (isCurrency) { if (val >= 100000) return (val / 100000).toFixed(1) + 'L'; if (val >= 1000) return (val / 1000).toFixed(1) + 'k'; return val.toFixed(0); }
            return val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0);
          }
        }
      };
    });
    return { series, yaxis, colors };
  }, [chartConfigMetrics, globalChartData]);

  // ═══════════════════════════════════════════════════════════════
  // COLUMN BUILDER
  // ═══════════════════════════════════════════════════════════════
  const getAntColumns = () => {
    const fixedLeftCols = [
      {
        title: 'IMAGE', dataIndex: 'imageUrl', key: 'imageUrl', width: 48, fixed: 'left',
        render: (url, record) => (
          <div style={{ width: 36, height: 36, margin: 'auto', background: '#f8fafc', borderRadius: 4, border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => setActiveHistoryRow(record)}>
            {url ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Package size={14} style={{ color: '#cbd5e1' }} />}
          </div>
        )
      },
      {
        title: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Seller Account</span>
            <div style={{ fontWeight: 'normal' }} onClick={(e) => e.stopPropagation()}>
              <InfiniteScrollSelect fetchData={fetchSellerDropdownData} fetchItem={fetchSellerItem} value={selectedSeller} onSelect={(val) => setSelectedSeller(val)} placeholder="All Sellers" />
            </div>
          </div>
        ),
        key: 'identifier', width: 155, fixed: 'left',
        render: (_, record) => {
          const isParentRow = record.isParent === true;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setActiveHistoryRow(record)}>
              {isParentRow && (
                <div onClick={(e) => { e.stopPropagation(); toggleParentExpand(record.asin); }}
                  style={{ width: 18, height: 18, borderRadius: 4, background: '#f1f5f9', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  {expandedParents.has(record.asin) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </div>
              )}
              <div>
                <Text strong code style={{ fontSize: 10, color: '#0f172a', padding: '1px 4px' }}>{record.asin}</Text>
                {isParentRow && <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', background: '#f1f5f9', border: '1px solid #e5e7eb', padding: '1px 6px', borderRadius: 4, width: 'fit-content', marginTop: 2 }}>{record.childCount} CHILDREN</div>}
              </div>
            </div>
          );
        }
      },
      {
        title: 'SKU', dataIndex: 'sku', key: 'sku', width: 80, fixed: 'left',
        render: (sku, record) => record.isParent
          ? <span style={{ fontSize: 9, fontWeight: 700, color: '#64748b', background: '#f1f5f9', border: '1px solid #e5e7eb', padding: '2px 8px', borderRadius: 4 }}>GROUP</span>
          : <span style={{ fontWeight: 600, color: '#475569', fontSize: 10 }}>{sku}</span>
      },
      {
        title: 'PRODUCT DETAILS', key: 'productDetails', width: 170, fixed: 'left',
        render: (_, record) => (
          <Tooltip title={
            <div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{record.title || 'Loading...'}</div>
              {record.brand && <div style={{ fontSize: 11, color: '#cbd5e1' }}>{record.brand}{record.category ? ` · ${record.category}` : ''}</div>}
            </div>
          }>
            <div style={{ width: '100%', overflow: 'hidden' }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {record.title || 'Loading...'}
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {record.brand || ''}{record.brand && record.category ? ' · ' : ''}{record.category || ''}
              </div>
            </div>
          </Tooltip>
        )
      }
    ];

    const monthKeys = data.length > 0 && data[0].monthlyStats ? Object.keys(data[0].monthlyStats).sort() : [];

    const targetColumns = monthKeys.map(monthKey => {
      const [year, month] = monthKey.split('-');
      const date = new Date(year, parseInt(month) - 1);
      const monthName = date.toLocaleString('default', { month: 'short' }).toUpperCase();
      const groupKey = `targets_group_${monthKey}`;
      const valuesWidth = 80;
      const achievedWidth = 88;
      const achievedColumn = expandedCols[groupKey] ? {
        title: <span style={{ fontSize: 8, fontWeight: 700, color: '#64748b' }}>ACHIEVED</span>,
        key: `target_achieved_${monthKey}`, width: achievedWidth, align: 'left',
        render: (_, record) => {
          const stats = record.monthlyStats?.[monthKey];
          if (!stats) return <span style={{ color: '#cbd5e1', fontSize: 9, fontWeight: 600 }}>-</span>;
          const { adsTarget, acosTarget, spend = 0, acos = 0 } = stats;
          if (adsTarget === null && acosTarget === null) return <span style={{ color: '#cbd5e1', fontSize: 9 }}>-</span>;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {adsTarget !== null && <div style={{ fontSize: 9, fontWeight: 600 }}><span style={{ color: spend > adsTarget ? '#b91c1c' : '#15803d' }}>₹{spend >= 1000 ? (spend / 1000).toFixed(1) + 'k' : spend.toFixed(0)}</span> <span style={{ fontSize: 8, color: '#94a3b8' }}>({adsTarget > 0 ? ((spend / adsTarget) * 100).toFixed(0) : 0}%)</span></div>}
              {acosTarget !== null && <div style={{ fontSize: 9, fontWeight: 600 }}><span style={{ color: acos > acosTarget ? '#b91c1c' : '#15803d' }}>{acos.toFixed(1)}%</span> <span style={{ fontSize: 8, color: '#94a3b8' }}>ACOS</span></div>}
            </div>
          );
        }
      } : null;

      return {
        title: (
          <div onClick={() => toggleCol(groupKey)} style={{ cursor: 'pointer', background: '#f8fafc', padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: valuesWidth }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Targets: {monthName} {year}</span>
            <ChevronRight size={11} style={{ color: '#94a3b8', transform: expandedCols[groupKey] ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
        ),
        width: valuesWidth + (achievedColumn ? achievedWidth : 0),
        children: [
          {
            title: <span style={{ fontSize: 8, fontWeight: 700, color: '#64748b' }}>MONTHLY</span>,
            key: `target_values_${monthKey}`, width: valuesWidth, align: 'left',
            render: (_, record) => {
              const stats = record.monthlyStats?.[monthKey];
              if (!stats) return <span style={{ color: '#cbd5e1', fontSize: 9, fontWeight: 600 }}>-</span>;
              const adsTarget = stats.adsTarget;
              const acosTarget = stats.acosTarget;
              if (adsTarget === null && acosTarget === null) return <span style={{ color: '#cbd5e1', fontSize: 9, fontWeight: 600 }}>NOT SET</span>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {adsTarget !== null && <div style={{ fontSize: 9, background: '#fffbeb', color: '#a16207', padding: '2px 6px', borderRadius: 4, fontWeight: 700, width: 'fit-content', border: '1px solid #fde68a' }}>Spend: ₹{adsTarget >= 1000 ? (adsTarget / 1000).toFixed(1) + 'k' : adsTarget}/mo</div>}
                  {acosTarget !== null && <div style={{ fontSize: 9, background: '#fef2f2', color: '#b91c1c', padding: '2px 6px', borderRadius: 4, fontWeight: 700, width: 'fit-content', border: '1px solid #fecaca' }}>ACOS: {acosTarget}%/mo</div>}
                </div>
              );
            }
          },
          ...(achievedColumn ? [achievedColumn] : [])
        ]
      };
    });

    const cols = [...fixedLeftCols, ...targetColumns];

    const buildMetricGroup = (title, key, icon, isCurrency = false, isPercent = false) => {
      const isExpanded = expandedCols[key];
      const avgWidth = 64;
      const trendWidth = 50;
      const dateWidth = 56;
      const children = [
        {
          title: <span style={{ fontSize: 8, fontWeight: 700, color: '#64748b' }}>AVG</span>,
          key, dataIndex: key, width: avgWidth, align: 'right', sorter: true,
          sortOrder: sortBy === key ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null,
          render: (val, record) => {
            const numVal = Number(val || 0);
            let targetValue = null;
            if (key === 'acos') targetValue = record.acosTarget;
            else if (key === 'spend') targetValue = record.adsTarget;
            const formattedVal = isCurrency ? `₹${numVal.toLocaleString('en-IN')}` : isPercent ? `${numVal.toFixed(2)}%` : numVal.toLocaleString();

            if (targetValue !== null && targetValue !== undefined) {
              const formattedTarget = isCurrency ? `₹${targetValue.toLocaleString('en-IN')}` : isPercent ? `${targetValue.toFixed(2)}%` : targetValue.toLocaleString();
              const isOverTarget = numVal > targetValue;
              const color = isOverTarget ? '#b91c1c' : '#15803d';
              return (
                <Tooltip title={`Target: ${formattedTarget}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', cursor: 'help' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0f172a' }}>{formattedVal}</span>
                    <span style={{ fontSize: 8, fontWeight: 700, color, padding: '1px 4px', borderRadius: 4, background: `${color}12`, marginTop: 2 }}>GOAL: {formattedTarget}</span>
                  </div>
                </Tooltip>
              );
            }
            return <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0f172a' }}>{formattedVal}</span>;
          }
        },
        {
          title: <span style={{ fontSize: 8, fontWeight: 700, color: '#64748b' }}>TREND</span>,
          key: `${key}_trn`, width: trendWidth, align: 'center',
          render: (_, record) => {
            const history = record.weekHistory || record.history || [];
            if (history.length === 0) return <span style={{ color: '#cbd5e1' }}>-</span>;
            const values = history.map(h => Number(h[key] || 0));
            if (values.every(v => v === 0)) return <span style={{ color: '#cbd5e1' }}>-</span>;
            const isGood = key === 'acos' ? values[values.length - 1] < values[0] : values[values.length - 1] > values[0];
            return <div style={{ width: 40, margin: 'auto' }}><MiniSpark data={values} color={isGood ? '#15803d' : '#b91c1c'} /></div>;
          }
        }
      ];

      if (isExpanded) {
        activeDates.forEach(d => {
          children.push({
            title: <div style={{ textAlign: 'center', fontSize: 9, lineHeight: 1.1 }}><div style={{ color: '#94a3b8' }}>{d.month}</div><div style={{ fontWeight: 700, color: '#475569' }}>{d.day}</div></div>,
            key: `${key}_${d.raw}`, width: dateWidth, align: 'right',
            render: (_, record) => {
              const hist = record.weekHistory?.find(h => normalizeDateStr(h.date) === d.raw);
              const val = hist ? (hist[key] || 0) : 0;
              if (val === 0) return <span style={{ color: '#cbd5e1' }}>-</span>;
              return <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>
                {isCurrency ? `₹${val.toLocaleString('en-IN')}` : isPercent ? `${val.toFixed(2)}%` : val.toLocaleString()}
              </span>;
            }
          });
        });
      }

      return {
        title: (
          <div onClick={() => toggleCol(key)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
            background: '#f8fafc', border: '1px solid #e5e7eb',
            color: '#475569', transition: 'all 0.15s', minWidth: avgWidth + trendWidth
          }}>
            {icon}
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.03em' }}>{title}</span>
            {isExpanded ? <ChevronLeft size={9} /> : <ChevronRight size={9} />}
          </div>
        ),
        width: avgWidth + trendWidth + (activeDates.length * dateWidth),
        children
      };
    };

    cols.push(buildMetricGroup('TOTAL SALES', 'totalSales', <FileBarChart size={11} />, true, false));
    cols.push(buildMetricGroup('ORDERS', 'orders', <Layers size={11} />, false, false));
    cols.push(buildMetricGroup('SPEND', 'spend', <BarChart3 size={11} />, true, false));
    cols.push(buildMetricGroup('CLICKS', 'clicks', <TrendUpIcon size={11} />, false, false));
    cols.push(buildMetricGroup('IMPRESSIONS', 'impressions', <Eye size={11} />, false, false));
    cols.push(buildMetricGroup('ROAS', 'roas', <RefreshCw size={11} />, false, false));
    cols.push(buildMetricGroup('ACOS', 'acos', <Target size={11} />, false, true));
    cols.push(buildMetricGroup('TACOS', 'tacos', <Target size={11} />, false, true));
    cols.push(buildMetricGroup('AD SALES', 'sales', <FileBarChart size={11} />, true, false));
    cols.push(buildMetricGroup('AD SALES %', 'adSalesPct', <Layers size={11} />, false, true));
    cols.push(buildMetricGroup('CVR', 'cvr', <Activity size={11} />, false, true));
    cols.push(buildMetricGroup('ORGANIC', 'organicSales', <BarChart3 size={11} />, true, false));
    cols.push(buildMetricGroup('VIEWS', 'pageViews', <Eye size={11} />, false, false));

    cols.push({
      title: 'ACTIONS', key: 'actions', fixed: 'right', width: 48, align: 'center',
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button type="text" size="small" icon={<Eye size={13} />}
            onClick={(e) => { e.stopPropagation(); setActiveHistoryRow(record); }} />
        </Tooltip>
      )
    });

    return cols;
  };

  const tableColumns = useMemo(() => getAntColumns(), [activeDates, data, expandedCols, selectedSeller]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="ads-pro-page">
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      <AdsImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        selectedSeller={selectedSeller}
        onComplete={() => { setShowImportModal(false); fetchAdsData(); }}
      />

      {/* HEADER */}
      <div className="ads-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="Search ASIN, SKU..."
            allowClear
            onSearch={setSearchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 220, borderRadius: 8 }}
            size="small"
          />
          <Segmented value={groupBy} onChange={setGroupBy}
            size="small"
            options={[{ label: 'ASIN Level', value: 'asin' }, { label: 'Parent Level', value: 'parent' }]}
          />
          <RangePicker
            value={startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null}
            onChange={handleDateChange}
            format="DD MMM YYYY"
            style={{ borderRadius: 8 }}
            size="small"
            presets={[
              { label: 'Last 7 Days', value: [dayjs().subtract(6, 'day'), dayjs()] },
              { label: 'Last 30 Days', value: [dayjs().subtract(29, 'day'), dayjs()] },
              { label: 'This Month', value: [dayjs().startOf('month'), dayjs()] },
              { label: 'Last Month', value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
            ]}
          />
          <Button onClick={fetchAdsData} loading={loading} icon={<RefreshCw size={13} strokeWidth={2} />}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>
            Refresh
          </Button>
          <Button type="primary" onClick={() => setShowImportModal(true)} icon={<Download size={13} strokeWidth={2} />}
            style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32 }}>
            Import
          </Button>
        </div>
      </div>

      {/* KPI STRIP */}
      <div className="ads-kpi-strip" style={{ maxHeight: showDashboardCharts ? 48 : 0, opacity: showDashboardCharts ? 1 : 0 }}>
        <div className="ads-kpi-scroll">
          {[
            { label: 'Ads Spend', key: 'spend', color: '#D32F2F' },
            { label: 'Ads Sales', key: 'sales', color: '#15803d' },
            { label: 'Organic Sales', key: 'organicSales', color: '#2E7D32' },
            { label: 'ACOS', key: 'acos', color: '#b91c1c' },
            { label: 'TACOS', key: 'tacos', color: '#0891b2' },
            { label: 'ROAS', key: 'roas', color: '#a16207' },
            { label: 'Ads Orders', key: 'orders', color: '#6d28d9' },
            { label: 'Total Orders', key: 'totalOrders', color: '#475569' },
          ].map((kpi, idx) => {
            const meta = METRIC_MAP[kpi.key] || {};
            const val = summaryData[kpi.key] || 0;
            const formatted = meta.type === 'currency' ? '₹' + formatCompact(val) : meta.type === 'ratio' ? val.toFixed(2) : meta.type === 'percent' ? val.toFixed(1) + '%' : formatCompact(val);
            return (
              <div key={idx} style={{
                height: 32, minWidth: 'max-content', flexShrink: 0, borderRadius: 4,
                border: '1px solid #e5e7eb', background: '#ffffff', display: 'flex',
                alignItems: 'center', gap: 8, padding: '0 12px'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: kpi.color }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: kpi.color, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{kpi.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>{formatted}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHART */}
      <div className="ads-chart-area" style={{ maxHeight: showDashboardCharts ? 420 : 0, opacity: showDashboardCharts ? 1 : 0 }}>
        <div style={{ padding: '8px 16px' }}>
          <Card style={{ borderRadius: 6, border: '1px solid #e5e7eb' }} styles={{ body: { padding: '10px 14px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 3, height: 14, background: '#D32F2F', borderRadius: 2 }} />
                <Text strong style={{ color: '#0f172a', fontSize: 13 }}>Campaign Trends</Text>
              </div>
              <Select mode="multiple" value={chartConfigMetrics} onChange={setChartConfigMetrics}
                style={{ minWidth: 200, maxWidth: 320 }} size="small" placeholder="Select metrics"
                maxTagCount="responsive"
                options={Object.keys(METRIC_MAP).map(k => ({ label: METRIC_MAP[k].label, value: k }))}
              />
            </div>
            <div style={{ height: 320 }}>
              {dynamicChartState.series.length > 0 ? (
                <Chart height="100%" type="line" series={dynamicChartState.series}
                  options={{
                    chart: { type: 'line', toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Inter, system-ui, sans-serif' },
                    stroke: { width: dynamicChartState.series.map(s => s.type === 'line' ? 2.5 : 0), curve: 'smooth' },
                    colors: dynamicChartState.colors,
                    plotOptions: { bar: { columnWidth: '45%', borderRadius: 3 } },
                    fill: { opacity: dynamicChartState.series.map(s => s.type === 'line' ? 1 : 0.85) },
                    markers: { size: dynamicChartState.series.map(s => s.type === 'line' ? 3 : 0), strokeWidth: 1 },
                    dataLabels: { enabled: false },
                    xaxis: {
                      categories: globalChartData.map(d => new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
                      axisBorder: { show: false }, axisTicks: { show: false },
                      labels: { style: { colors: '#64748b', fontWeight: 600, fontSize: '10px' } }
                    },
                    yaxis: dynamicChartState.yaxis,
                    grid: { borderColor: '#f1f5f9', strokeDashArray: 4, padding: { top: 5, right: 15, bottom: 10, left: 15 } },
                    legend: { show: true, position: 'top', horizontalAlign: 'center', fontWeight: 700, fontSize: '10px', markers: { radius: 2 } },
                    tooltip: { shared: true, intersect: false, theme: 'light' }
                  }}
                />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: 600, fontSize: 12, background: '#f8fafc', borderRadius: 4 }}>
                  Select metrics to view chart
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* TOGGLE BAR */}
      <div style={{
        background: '#ffffff', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
        padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <Button
          type={showDashboardCharts ? 'primary' : 'default'}
          icon={showDashboardCharts ? <ChevronUp size={13} /> : <BarChart3 size={13} />}
          onClick={() => setShowDashboardCharts(!showDashboardCharts)}
          style={showDashboardCharts ? { fontWeight: 600, fontSize: 11, borderRadius: 8, height: 32 } : { fontWeight: 600, fontSize: 11, borderRadius: 8, height: 32 }}
        >
          {showDashboardCharts ? 'Hide Analytics' : 'View Analytics'}
        </Button>
        <span style={{
          fontSize: 10, fontWeight: 600, color: '#64748b', background: '#f8fafc',
          border: '1px solid #e5e7eb', padding: '4px 12px', borderRadius: 20
        }}>
          Showing <span style={{ color: '#0f172a', fontWeight: 700 }}>{paginatedData.length}</span> of <span style={{ color: '#0f172a', fontWeight: 700 }}>{totalCount}</span>
        </span>
      </div>

      {/* TABLE */}
      <div className="ads-table-wrapper">
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: 600, fontSize: 12 }}>
              Loading data...
            </div>
          ) : paginatedData.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
              <Package size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>No ads data found</span>
            </div>
          ) : (() => {
            const { rows: hRows, stickyLeft, stickyRight } = buildHeaderRows(tableColumns);
            const leafCols = getLeafColumns(tableColumns);
            return (
              <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
                  {hRows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((col) => {
                        const isFixed = stickyLeft[col.key] !== undefined || stickyRight[col.key] !== undefined;
                        const s = {
                          fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                          letterSpacing: '0.04em', color: '#4b5563', padding: '6px 6px',
                          background: '#f8fafc', position: 'sticky', top: 0,
                          border: '1px solid #e5e7eb', whiteSpace: 'nowrap',
                          ...(col.align === 'center' ? { textAlign: 'center' } : col.align === 'right' ? { textAlign: 'right' } : {}),
                        };
                        if (isFixed && col.width) s.width = col.width;
                        if (stickyLeft[col.key] !== undefined) {
                          s.left = stickyLeft[col.key];
                          s.zIndex = ri === 0 ? 22 : 17;
                          s.background = '#f8fafc';
                        }
                        if (stickyRight[col.key] !== undefined) {
                          s.right = stickyRight[col.key];
                          s.zIndex = ri === 0 ? 22 : 17;
                          s.background = '#f8fafc';
                          if (ri === 0) s.borderLeft = '1px solid #d1d5db';
                        }
                        let titleContent = col.title;
                        if (!col.isGroup && col.sorter) {
                          const isActive = sortBy === col.key;
                          titleContent = (
                            <div
                              onClick={() => {
                                const nextOrder = sortBy === col.key && sortOrder === 'desc' ? 'asc' : 'desc';
                                setSortBy(col.key);
                                setSortOrder(nextOrder);
                                setPage(1);
                              }}
                              style={{
                                cursor: 'pointer', userSelect: 'none',
                                display: 'flex', alignItems: 'center',
                                justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'space-between',
                                gap: 3
                              }}
                            >
                              <span>{col.title}</span>
                              <div style={{
                                display: 'flex', flexDirection: 'column',
                                fontSize: '7px', lineHeight: 1,
                                opacity: isActive ? 1 : 0.4
                              }}>
                                <ChevronUp size={8} strokeWidth={4} style={{
                                  color: isActive && sortOrder === 'asc' ? '#1890ff' : '#8c8c8c',
                                  marginBottom: '0px'
                                }} />
                                <ChevronDown size={8} strokeWidth={4} style={{
                                  color: isActive && sortOrder === 'desc' ? '#1890ff' : '#8c8c8c'
                                }} />
                              </div>
                            </div>
                          );
                        }
                        return (
                          <th key={col.key} colSpan={col.colSpan} rowSpan={col.rowSpan} style={s}>
                            {titleContent}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {paginatedData.map((record, idx) => (
                    <tr key={record.id || record.asin || idx} className="table-row-hover">
                      {leafCols.map((col) => {
                        const val = col.dataIndex ? record[col.dataIndex] : undefined;
                        const rendered = col.render ? col.render(val, record, idx) : (val ?? '');
                        const isFixed = stickyLeft[col.key] !== undefined || stickyRight[col.key] !== undefined;
                        const bg = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
                        const s = {
                          padding: '2px 5px', fontSize: '0.65rem',
                          border: '1px solid #f0f0f0', verticalAlign: 'middle',
                          color: '#27272a', background: bg,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          ...(col.align === 'center' ? { textAlign: 'center' } : col.align === 'right' ? { textAlign: 'right' } : {}),
                        };
                        if (isFixed && col.width) {
                          s.minWidth = col.width;
                          s.maxWidth = col.width;
                        }
                        if (stickyLeft[col.key] !== undefined) {
                          s.position = 'sticky';
                          s.left = stickyLeft[col.key];
                          s.zIndex = 5;
                          s.background = bg;
                        }
                        if (stickyRight[col.key] !== undefined) {
                          s.position = 'sticky';
                          s.right = stickyRight[col.key];
                          s.zIndex = 5;
                          s.background = bg;
                        }
                        return (
                          <td key={col.key} style={s}>
                            {rendered}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>

        {/* FOOTER */}
        <div style={{ background: '#f9fafb', borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
          <Suspense fallback={<div className="h-10 w-full animate-pulse bg-zinc-100" />}>
            <TablePagination
              component="div"
              count={totalCount || 0}
              page={(page || 1) - 1}
              onPageChange={handleChangePage}
              rowsPerPage={pageSize || 50}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[25, 50, 100, 200, 300, 500]}
              sx={{
                fontSize: '11px',
                minHeight: '36px',
                '.MuiToolbar-root': {
                  minHeight: '36px', height: '36px',
                  paddingLeft: '12px', paddingRight: '12px'
                },
                '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                  fontSize: '11px', fontWeight: 600, color: '#6b7280', margin: 0
                },
                '.MuiTablePagination-select': { fontSize: '11px', fontWeight: 600 },
                '.MuiTablePagination-actions': {
                  marginLeft: '8px',
                  '& .MuiIconButton-root': { padding: '4px' }
                }
              }}
            />
          </Suspense>
        </div>
      </div>

      {/* STYLES */}
      <style>{`
.ads-pro-page {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    background: #fafafa;
}
.ads-header-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    flex-shrink: 0;
    overflow: visible;
    flex-wrap: wrap;
    gap: 12px;
}
.ads-kpi-strip {
    flex-shrink: 0;
    overflow: hidden;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb;
    transition: all 0.3s ease;
}
.ads-kpi-scroll {
    padding: 8px 16px 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
}
.ads-chart-area {
    flex-shrink: 0;
    overflow: hidden;
    background: #f8fafc;
    transition: all 0.3s ease;
}
.ads-table-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    width: 100%;
    background: #ffffff;
    overflow: hidden;
    position: relative;
}
.ads-table-wrapper::-webkit-scrollbar,
.ads-table-wrapper *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}
.ads-table-wrapper::-webkit-scrollbar-track,
.ads-table-wrapper *::-webkit-scrollbar-track {
    background: #f1f5f9;
}
.ads-table-wrapper::-webkit-scrollbar-thumb,
.ads-table-wrapper *::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
}
.table-row-hover:hover td {
    background: #fef2f2 !important;
}
`}</style>

      <AdsHistoryModal
        isOpen={!!activeHistoryRow}
        onClose={() => setActiveHistoryRow(null)}
        rowData={activeHistoryRow}
      />
    </div>
  );
}