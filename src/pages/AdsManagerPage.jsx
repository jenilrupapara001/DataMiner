import React, { useState, useEffect, useMemo, useCallback, lazy, useRef } from 'react';
import {
  Segmented, Select, Button, Input, Tooltip, Typography, Card, Row, Col, Modal, Badge, Dropdown, Space, Statistic, Table, Tabs, Tag, message
} from 'antd';
const { Title, Text } = Typography;
import axios from 'axios';
import {
  Package,
  Activity,
  TrendingUp,
  TrendingDown,
  Table as TableIcon,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Search,
  Eye,
  LayoutGrid,
  BarChart3,
  Target,
  Calendar,
  Layers,
  TrendingUp as TrendUpIcon,
  FileBarChart,
  X,
  Image as ImageIcon,
  CheckSquare,
  Square,
  Filter,
  Store
} from 'lucide-react';
import { adsApi, sellerApi } from '../services/api';
import InfiniteScrollSelect from '../components/common/InfiniteScrollSelect';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import EmptyState from '../components/common/EmptyState';
import AdsImportModal from '../components/ads/AdsImportModal';
import Chart from 'react-apexcharts';
import { CHART_COLORS, areaChartOptions } from '../utils/chartTheme';
import DateRangePicker from '../components/common/DateRangePicker';
import { useDateRange } from '../contexts/DateRangeContext';
import { usePageTitle } from '../contexts/PageTitleContext';
import { format } from 'date-fns';

// Define canonical metrics dictionary for custom dashboard selector from screenshot
const METRIC_MAP = {
  spend: { label: 'Ad Spend', color: '#6366f1', type: 'currency', seriesType: 'column' },
  sales: { label: 'Ad Sales', color: '#10b981', type: 'currency', seriesType: 'column' },
  totalSales: { label: 'Total Sales', color: '#3b82f6', type: 'currency', seriesType: 'column' },
  acos: { label: 'ACOS', color: '#f43f5e', type: 'percent', seriesType: 'line' },
  roas: { label: 'ROAS', color: '#f59e0b', type: 'ratio', seriesType: 'line' },
  cvr: { label: 'CVR', color: '#8b5cf6', type: 'percent', seriesType: 'line' },
  cpc: { label: 'CPC', color: '#14b8a6', type: 'currency', seriesType: 'line' },
  ctr: { label: 'CTR', color: '#ec4899', type: 'percent', seriesType: 'line' },
  orders: { label: 'Orders', color: '#64748b', type: 'number', seriesType: 'column' },
  impressions: { label: 'Impressions', color: '#94a3b8', type: 'number', seriesType: 'column' },
  clicks: { label: 'Clicks', color: '#94a3b8', type: 'number', seriesType: 'column' }
};

// Utility helper: generate history matrix for the dynamic table headers
const generateHistoryStructureFromDates = (sortedDates) => {
  if (!sortedDates || sortedDates.length === 0) return [{ label: 'N/A', dates: [] }];

  // Cap to maximum 7-10 recent dates
  const recentDates = sortedDates.slice(-7);

  return [{
    label: 'Last 7 Days',
    dates: recentDates.map(dateStr => {
      const date = new Date(dateStr + 'T00:00:00');
      return {
        raw: dateStr,
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      };
    })
  }];
};

const normalizeDateStr = (dateInput) => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') return dateInput.substring(0, 10);
  try { return new Date(dateInput).toISOString().substring(0, 10); } catch (e) { return ''; }
};

const formatCurrency = (val) => {
  if (typeof val !== 'number') return '-';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(val);
};

const formatCompact = (val) => {
  if (typeof val !== 'number') return '0.00';
  if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(2) + 'K';
  return val.toFixed(2);
};

// Generic Trend Badge
const TrendBadge = ({ value, prevValue, isInverted = false }) => {
  if (!prevValue) return <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>-</span>;

  const diff = value - prevValue;
  if (Math.abs(diff) < 0.01) {
    return <div className="d-flex align-items-center gap-1 text-zinc-400" style={{ fontSize: '9px', fontWeight: 600 }}>
      <Activity size={10} />
      <span>STABLE</span>
    </div>;
  }

  const isGood = isInverted ? diff < 0 : diff > 0;
  const Icon = isGood ? TrendingUp : TrendingDown;
  const color = isGood ? '#059669' : '#dc2626';

  return (
    <div className="d-flex align-items-center gap-0.5 fw-bold" style={{ fontSize: '9px', color }}>
      <Icon size={10} />
      <span>{isGood ? 'HIGH' : 'LOW'}</span>
    </div>
  );
};

// Standard mini sparkline helper using simple CSS linear-gradient for visualization mock or basic visual indicator
const MiniSpark = ({ data, color }) => {
  if (!data || data.length < 2) return <div style={{ width: '100%', height: '12px' }} />;
  const max = Math.max(...data) || 1;
  const points = data.map((val, i) => `${(i / (data.length - 1)) * 100}% ${100 - (val / max * 100)}%`).join(', ');

  return (
    <div style={{ width: '100%', height: '14px', overflow: 'hidden', opacity: 0.8 }}>
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="8"
          points={data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - ((v / max) * 90)}`).join(' ')}
        />
      </svg>
    </div>
  );
};

// ---------------------------------------------------------
// Analytics History Modal for viewing full historical breakdown
// ---------------------------------------------------------
const AdsHistoryModal = ({ isOpen, onClose, rowData }) => {
  if (!rowData) return null;

  // Try to find a valid image in child ASINs if parent doesn't have one
  const displayImage = rowData.imageUrl || (rowData.children && rowData.children.find(c => c.imageUrl)?.imageUrl);

  // Sort history descending (newest first)
  const fullHistory = [...(rowData.history || rowData.weekHistory || [])].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Compute aggregated stats
  const totalSpend = Number(rowData.spend || 0);
  const totalSales = Number(rowData.sales || 0);
  const totalClicks = Number(rowData.clicks || 0);
  const totalImpressions = Number(fullHistory.reduce((sum, d) => sum + Number(d.impressions || 0), 0));
  const totalOrders = Number(rowData.orders || 0);

  const blendedAcos = totalSales > 0 ? (totalSpend / totalSales) * 100 : 0;
  const blendedRoas = totalSpend > 0 ? totalSales / totalSpend : 0;
  const blendedCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const blendedCvr = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;

  // Table columns definition for Ant Design Table
  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: '180px',
      render: (dateStr) => {
        const d = new Date(dateStr);
        return (
          <div className="d-flex align-items-center gap-2">
            <Calendar size={13} className="text-indigo-500" />
            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
              {d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        );
      },
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
    },
    {
      title: 'Impressions',
      dataIndex: 'impressions',
      key: 'impressions',
      align: 'right',
      render: (val) => Number(val || 0).toLocaleString(),
      sorter: (a, b) => Number(a.impressions || 0) - Number(b.impressions || 0),
    },
    {
      title: 'Clicks',
      dataIndex: 'clicks',
      key: 'clicks',
      align: 'right',
      render: (val) => Number(val || 0).toLocaleString(),
      sorter: (a, b) => Number(a.clicks || 0) - Number(b.clicks || 0),
    },
    {
      title: 'Spend',
      dataIndex: 'spend',
      key: 'spend',
      align: 'right',
      render: (val) => (
        <span style={{ color: '#ef4444', fontWeight: 600 }}>
          ₹{Number(val || 0).toFixed(2)}
        </span>
      ),
      sorter: (a, b) => Number(a.spend || 0) - Number(b.spend || 0),
    },
    {
      title: 'Ad Sales',
      dataIndex: 'sales',
      key: 'sales',
      align: 'right',
      render: (val) => (
        <span style={{ color: '#10b981', fontWeight: 700 }}>
          ₹{Number(val || 0).toFixed(2)}
        </span>
      ),
      sorter: (a, b) => Number(a.sales || 0) - Number(b.sales || 0),
    },
    {
      title: 'ACOS',
      dataIndex: 'acos',
      key: 'acos',
      align: 'right',
      render: (val) => {
        const v = Number(val || 0);
        return `${v.toFixed(2)}%`;
      },
      sorter: (a, b) => Number(a.acos || 0) - Number(b.acos || 0),
    },
    {
      title: 'ROAS',
      dataIndex: 'roas',
      key: 'roas',
      align: 'right',
      render: (val) => {
        const v = Number(val || 0);
        return `${v.toFixed(2)}`;
      },
      sorter: (a, b) => Number(a.roas || 0) - Number(b.roas || 0),
    },
    {
      title: 'Orders',
      dataIndex: 'orders',
      key: 'orders',
      align: 'right',
      render: (val) => Number(val || 0).toLocaleString(),
      sorter: (a, b) => Number(a.orders || 0) - Number(b.orders || 0),
    },
    {
      title: 'CVR',
      dataIndex: 'cvr',
      key: 'cvr',
      align: 'center',
      render: (val) => (
        <span style={{ fontWeight: 600, color: '#6366f1' }}>
          {Number(val || 0).toFixed(2)}%
        </span>
      ),
      sorter: (a, b) => Number(a.cvr || 0) - Number(b.cvr || 0),
    },
    {
      title: 'Page Views',
      dataIndex: 'pageViews',
      key: 'pageViews',
      align: 'right',
      render: (val) => Number(val || 0).toLocaleString(),
      sorter: (a, b) => Number(a.pageViews || 0) - Number(b.pageViews || 0),
    },
    {
      title: 'Organic Sales',
      dataIndex: 'organicSales',
      key: 'organicSales',
      align: 'right',
      render: (val) => `₹${Number(val || 0).toFixed(2)}`,
      sorter: (a, b) => Number(a.organicSales || 0) - Number(b.organicSales || 0),
    }
  ];

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      footer={null}
      width={1200}
      centered
      style={{ top: 20 }}
      styles={{
        content: { borderRadius: '16px', padding: 0, overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' },
        body: { padding: 0 }
      }}
    >
      <div className="d-flex flex-column" style={{ height: '85vh', overflow: 'hidden' }}>
        {/* Modal Header */}
        <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center bg-white shrink-0">
          <div className="d-flex align-items-center gap-3">
            {displayImage ? (
              <img
                src={displayImage}
                alt=""
                className="rounded-3 border object-fit-contain bg-white"
                style={{ width: '52px', height: '52px', padding: '2px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              />
            ) : (
              <div className="rounded-3 border bg-light d-flex align-items-center justify-content-center text-zinc-400" style={{ width: '52px', height: '52px' }}>
                <ImageIcon size={22} />
              </div>
            )}
            <div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-zinc-900 text-white fw-bold px-2 rounded-2" style={{ fontSize: '11px' }}>
                  {rowData.asin || rowData.id}
                </span>
                {rowData.sku && rowData.sku !== 'PARENT' ? (
                  <Text type="secondary" style={{ fontSize: '12px', fontWeight: 500 }}>
                    SKU: <span className="font-monospace fw-bold text-zinc-800">{rowData.sku}</span>
                  </Text>
                ) : (
                  <span className="badge bg-indigo-50 text-indigo-700 fw-bold px-2 rounded-2" style={{ fontSize: '10px' }}>
                    PARENT GROUP • {rowData.childCount || 0} CHILDREN
                  </span>
                )}
              </div>
              <h5 className="mb-0 fw-bold text-dark text-truncate mt-1" style={{ maxWidth: '800px', fontSize: '15px', letterSpacing: '-0.01em' }}>
                {rowData.title || 'Detailed Advertisement Timeline'}
              </h5>
            </div>
          </div>
        </div>

        {/* Modal Chart Visualizer (Fixed at 220px to match old design vertical flow) */}
        {fullHistory.length > 0 && (
          <div className="px-4 py-2 border-bottom bg-white shrink-0" style={{ height: '220px' }}>
            <Chart
              type="area"
              height="100%"
              series={[
                { name: 'Ad Sales', data: [...fullHistory].reverse().map(d => Number(d.sales || 0).toFixed(0)) },
                { name: 'Ad Spend', data: [...fullHistory].reverse().map(d => Number(d.spend || 0).toFixed(0)) }
              ]}
              options={{
                ...areaChartOptions(val => '₹' + Number(val).toLocaleString('en-IN')),
                colors: ['#10B981', '#EF4444'], // green for sales, red for spend
                chart: { ...areaChartOptions().chart, toolbar: { show: false }, sparkline: { enabled: false } },
                stroke: { curve: 'smooth', width: 2.2 },
                xaxis: {
                  categories: [...fullHistory].reverse().map(d => new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
                  labels: { style: { fontSize: '9px', fontWeight: 600 } },
                  axisBorder: { show: false },
                  axisTicks: { show: false }
                },
                yaxis: {
                  labels: {
                    style: { fontSize: '9px', fontWeight: 500 },
                    formatter: (v) => v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v
                  }
                },
                legend: { show: true, position: 'top', horizontalAlign: 'right', fontSize: '10px', fontWeight: 700 }
              }}
            />
          </div>
        )}


        {/* Modal Table Body (Scrollable, just like the old design!) */}
        <div className="flex-grow-1 overflow-auto bg-white position-relative p-3">
          {fullHistory.length === 0 ? (
            <div className="h-100 d-flex flex-column align-items-center justify-content-center text-zinc-400">
              <Calendar size={48} className="mb-3 opacity-20" />
              <span className="fw-medium">No historical tracking available for this period.</span>
            </div>
          ) : (
            <div className="border rounded-3 overflow-hidden shadow-sm bg-white">
              <Table
                dataSource={fullHistory.map((d, idx) => ({ ...d, key: idx }))}
                columns={columns}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: false,
                  size: 'small',
                  style: { padding: '8px 16px', margin: 0, borderTop: '1px solid #f0f0f0' }
                }}
                size="small"
                className="modern-timeline-table"
                rowClassName="ah-tr"
                scroll={{ x: 'max-content' }}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-top bg-light d-flex justify-content-between align-items-center shrink-0" style={{ backgroundColor: '#f8fafc' }}>
          <div className="text-zinc-500 font-monospace" style={{ fontSize: '11px', fontWeight: 500 }}>
            {fullHistory.length} Days Recorded Timeline
          </div>
          <Button onClick={onClose} type="primary" style={{ backgroundColor: '#18181b', borderColor: '#18181b', fontWeight: 700, borderRadius: '6px' }}>
            Close Window
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default function AdsManagerPage() {
  const { startDate, endDate, updateDateRange } = useDateRange();
  const { setPageTitle } = usePageTitle();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  useEffect(() => {
    setPageTitle('Ads Manager');
  }, [setPageTitle]);

  // State for dynamic multi-metric chart customization from screenshot
  const [chartConfigMetrics, setChartConfigMetrics] = useState(['spend', 'sales', 'acos']);

  // Seller selection state
  const [selectedSeller, setSelectedSeller] = useState(() => localStorage.getItem('selectedSeller') || '');

  useEffect(() => {
    localStorage.setItem('selectedSeller', selectedSeller);
  }, [selectedSeller]);

  const fetchSellerDropdownData = useCallback(async (page = 1, search = '') => {
    try {
      const response = await sellerApi.getAll({ page, limit: 1000, search });
      if (response.success) {
        return {
          data: response.data.sellers || [],
          hasMore: response.data.pagination?.page < response.data.pagination?.totalPages
        };
      }
      return { data: [], hasMore: false };
    } catch (err) {
      console.error('Error fetching sellers for dropdown:', err);
      return { data: [], hasMore: false };
    }
  }, []);

  // 0. Aggregated summary for Top View
  const summaryData = useMemo(() => {
    const sum = {
      impressions: 0, clicks: 0, spend: 0, sales: 0, orders: 0, pageViews: 0, organicSales: 0
    };
    data.forEach(d => {
      sum.impressions += Number(d.impressions || 0);
      sum.clicks += Number(d.clicks || 0);
      sum.spend += Number(d.spend || 0);
      sum.sales += Number(d.sales || 0);
      sum.orders += Number(d.orders || 0);
      sum.pageViews += Number(d.pageViews || 0);
      sum.organicSales += Number(d.organicSales || 0);
    });

    // Extended Derived Metrics
    sum.totalSales = sum.sales + sum.organicSales;
    sum.acos = sum.sales > 0 ? (sum.spend / sum.sales) * 100 : 0;
    sum.roas = sum.spend > 0 ? (sum.sales / sum.spend) : 0;
    sum.cvr = sum.clicks > 0 ? (sum.orders / sum.clicks) * 100 : 0;
    sum.cpc = sum.clicks > 0 ? (sum.spend / sum.clicks) : 0;
    sum.ctr = sum.impressions > 0 ? (sum.clicks / sum.impressions) * 100 : 0;
    sum.tacos = sum.totalSales > 0 ? (sum.spend / sum.totalSales) * 100 : 0;
    sum.adSalesPct = sum.totalSales > 0 ? (sum.sales / sum.totalSales) * 100 : 0;

    return sum;
  }, [data]);

  // Filtering and Grouping States
  const [groupBy, setGroupBy] = useState('asin');
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [activeHistoryRow, setActiveHistoryRow] = useState(null);
  const [showDashboardCharts, setShowDashboardCharts] = useState(true);

  const toggleParentExpand = (parentAsin) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentAsin)) {
        next.delete(parentAsin);
      } else {
        next.add(parentAsin);
      }
      return next;
    });
  };

  useEffect(() => {
    setExpandedParents(new Set());
    setPage(1);
  }, [groupBy]);

  // Aggregate timeseries history across all loaded items for global chart
  const globalChartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    const dateMap = {};
    data.forEach(item => {
      const hist = item.weekHistory || item.history || [];
      hist.forEach(day => {
        const key = normalizeDateStr(day.date);
        if (!key) return;
        if (!dateMap[key]) {
          dateMap[key] = { date: key, spend: 0, sales: 0, clicks: 0, impressions: 0, orders: 0, organicSales: 0 };
        }
        dateMap[key].spend += Number(day.spend || 0);
        dateMap[key].sales += Number(day.sales || 0);
        dateMap[key].clicks += Number(day.clicks || 0);
        dateMap[key].impressions += Number(day.impressions || 0);
        dateMap[key].orders += Number(day.orders || 0);
        dateMap[key].organicSales += Number(day.organicSales || 0);
      });
    });

    // After raw aggregation, calculate runtime daily derived fields needed for chart lines
    const results = Object.values(dateMap).map(day => {
      const totalS = day.sales + day.organicSales;
      return {
        ...day,
        acos: day.sales > 0 ? (day.spend / day.sales) * 100 : 0,
        roas: day.spend > 0 ? (day.sales / day.spend) : 0,
        cvr: day.clicks > 0 ? (day.orders / day.clicks) * 100 : 0,
        cpc: day.clicks > 0 ? (day.spend / day.clicks) : 0,
        ctr: day.impressions > 0 ? (day.clicks / day.impressions) * 100 : 0,
        totalSales: totalS
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    return results;
  }, [data]);

  // Visual Collapsible Columns Tracking
  const [expandedCols, setExpandedCols] = useState({
    totalSales: false,
    impressions: false,
    clicks: false,
    spend: false,
    sales: false,
    acos: false,
    roas: false,
    orders: false,
    cvr: false,
    pageViews: false,
    organicSales: false
  });

  // Pagination state for performance optimization
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const toggleCol = (colKey) => {
    setExpandedCols(prev => ({ ...prev, [colKey]: !prev[colKey] }));
  };

  // 1. Fetch Ads Aggregated Data
  const fetchAdsData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        groupBy: 'asin', // ALWAYS fetch at ASIN level for high-fidelity client-side tree construction
        search: searchQuery
      };
      if (selectedSeller) params.sellerId = selectedSeller;
      if (startDate) params.startDate = format(startDate, 'yyyy-MM-dd');
      if (endDate) params.endDate = format(endDate, 'yyyy-MM-dd');

      const res = await adsApi.getAdsManagerData(params);
      if (res.success) {
        const mapped = (res.data || []).map(item => {
          const totalSales = (item.sales || 0) + (item.organicSales || 0);
          const weekHistory = (item.weekHistory || []).map(h => ({
            ...h,
            totalSales: (h.sales || 0) + (h.organicSales || 0)
          }));
          return {
            ...item,
            totalSales,
            weekHistory
          };
        });
        setData(mapped);
        setPage(1); // Reset page on fresh fetch
      }
    } catch (err) {
      console.error('Failed to fetch ads data:', err);
    } finally {
      setLoading(false);
    }
  }, [groupBy, searchQuery, startDate, endDate, selectedSeller]);

  useEffect(() => {
    fetchAdsData();
  }, [fetchAdsData]);

  // 2. Determine historical date header structure based on available dataset
  const historyStructure = useMemo(() => {
    if (data.length === 0) return [{ label: 'W1', dates: [] }];

    const dateMap = new Map();
    data.forEach(row => {
      if (row.weekHistory) {
        row.weekHistory.forEach(h => {
          const dk = normalizeDateStr(h.date);
          if (dk) dateMap.set(dk, true);
        });
      }
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    return generateHistoryStructureFromDates(sortedDates);
  }, [data]);

  const activeDates = historyStructure[0]?.dates || [];

  // Table styles derived from AsinManagerPage design
  const thStyle = {
    fontSize: '0.66rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#18181b', // Zinc-900 for super sharp contrast
    padding: '6px 8px',
    background: '#ffffff',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    whiteSpace: 'nowrap',
    border: '1px solid #f1f5f9'
  };

  const tdStyle = {
    padding: '6px 8px',
    fontSize: '0.7rem',
    borderBottom: '1px solid #f1f5f9',
    verticalAlign: 'middle',
    color: '#000000', // Perfect black text
    fontWeight: 500,
    height: '32px',
    borderLeft: '1px solid #f1f5f9',
    borderRight: '1px solid #f1f5f9',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  // Helper to construct dynamic column header grouping
  const renderHeaderGroup = (title, colorHue, icon, expandedKey, width = '80px') => {
    const isExpanded = expandedCols[expandedKey];
    // Total subcols = AVG + TRN = 2 cols. Reverted as requested.
    const baseCols = 2;
    const activeDays = activeDates.length;
    const colSpan = isExpanded ? baseCols + activeDays : baseCols;

    const colors = {
      slate: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
      blue: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
      emerald: { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' },
      amber: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
      indigo: { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
      cyan: { bg: '#ecfeff', text: '#0891b2', border: '#a5f3fc' },
      purple: { bg: '#faf5ff', text: '#7c3aed', border: '#e9d5ff' },
      pink: { bg: '#fdf2f8', text: '#db2777', border: '#fbcfe8' }
    };

    const c = colors[colorHue] || colors.slate;

    return (
      <th colSpan={colSpan} style={{ ...thStyle, textAlign: 'center', background: c.bg, color: c.text, borderBottom: `2px solid ${c.border}` }}>
        <div className="d-flex align-items-center justify-content-center gap-1.5 py-0.5">
          {icon}
          <span style={{ fontWeight: 800 }}>{title}</span>
          <button
            onClick={() => toggleCol(expandedKey)}
            className="btn p-0 border-0 d-flex align-items-center justify-content-center hover-scale"
            style={{ color: c.text, cursor: 'pointer', opacity: 0.7, transition: 'all 0.2s' }}
          >
            {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </th>
    );
  };

  // Small sub-header cell builder (Row 2 of table header)
  const renderSubHeaders = (colorHue, expandedKey) => {
    const isExpanded = expandedCols[expandedKey];
    const colors = {
      slate: { bg: '#f1f5f9', text: '#475569' },
      blue: { bg: '#eff6ff', text: '#2563eb' },
      emerald: { bg: '#ecfdf5', text: '#059669' },
      amber: { bg: '#fffbeb', text: '#b45309' },
      indigo: { bg: '#eef2ff', text: '#4338ca' },
      cyan: { bg: '#ecfeff', text: '#0891b2' },
      purple: { bg: '#faf5ff', text: '#7c3aed' },
      pink: { bg: '#fdf2f8', text: '#db2777' }
    };
    const c = colors[colorHue] || colors.slate;

    return (
      <>
        <th style={{ ...thStyle, width: '68px', textAlign: 'right', background: c.bg, color: c.text }}>AVG</th>
        <th style={{ ...thStyle, width: '52px', textAlign: 'center', background: c.bg, color: c.text }}>TRN</th>
        {isExpanded && activeDates.map(d => (
          <th key={d.raw} className="dynamic-col-cell premium-ads-th" style={{ ...thStyle, width: '50px', textAlign: 'center', fontSize: '8px', background: c.bg, color: c.text }}>
            {d.label}
          </th>
        ))}
      </>
    );
  };

  // RENDER Row Data Cells dynamically
  const renderCells = (row, dataKey, colorHue, expandedKey, isCurrency = false, isPercent = false) => {
    const isExpanded = expandedCols[expandedKey];
    const history = row.weekHistory || [];

    // Extract values map keyed by date
    const dateVals = {};
    history.forEach(h => { dateVals[normalizeDateStr(h.date)] = Number(h[dataKey] || 0); });

    const currentVal = row[dataKey] || 0;

    // Calculate a naive avg of history for the Trend Check
    const pastVals = Object.values(dateVals);
    const avg = pastVals.length > 0 ? pastVals.reduce((a, b) => a + b, 0) / pastVals.length : 0;

    const textCol = isCurrency ? '#047857' : '#000000';

    const formatVal = (v) => {
      if (isPercent) return v.toFixed(2) + '%';
      if (isCurrency) return '₹' + formatCompact(v);
      return formatCompact(v);
    };

    // Determine trend simply by comparing current (last entry in pastVals or row val) vs Avg
    const lastHistVal = pastVals.length > 0 ? pastVals[pastVals.length - 1] : currentVal;
    const prevHistVal = pastVals.length > 1 ? pastVals[pastVals.length - 2] : avg;

    // Inverted logic: For ACOS and Spend, "LOWER IS BETTER". But user wanted HIGH/LOW badges anyway based on sheer trend.
    const isTrendInverted = (dataKey === 'acos' || dataKey === 'spend');

    return (
      <>
        {/* Main Stat Cell */}
        <td
          style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: textCol, background: '#fff', cursor: 'pointer' }}
          onClick={() => setActiveHistoryRow(row)}
          title="Click to view full history"
        >
          {formatVal(currentVal)}
        </td>
        {/* Trend Status Cell */}
        <td
          style={{ ...tdStyle, textAlign: 'center', background: '#fff', padding: '2px', cursor: 'pointer' }}
          onClick={() => setActiveHistoryRow(row)}
          title="Click to view full history"
        >
          <TrendBadge value={lastHistVal} prevValue={prevHistVal} isInverted={isTrendInverted} />
        </td>

        {/* Expandable Day Cells */}
        {isExpanded && activeDates.map(d => {
          const val = dateVals[d.raw] || 0;
          return (
            <td
              key={d.raw}
              className="dynamic-col-cell"
              style={{ ...tdStyle, textAlign: 'center', fontSize: '9px', background: '#fcfcfc', color: '#64748b', cursor: 'pointer' }}
              onClick={() => setActiveHistoryRow(row)}
              title="Click to view full history"
            >
              {formatVal(val)}
            </td>
          );
        })}
      </>
    );
  };

  // Construct parent-child tree hierarchy when groupBy is 'parent'
  const processedData = useMemo(() => {
    if (groupBy === 'asin') {
      return data;
    }

    const parents = {};
    data.forEach(row => {
      const pid = row.parentAsin || row.asin;
      if (!parents[pid]) {
        parents[pid] = {
          id: pid,
          asin: pid,
          parentAsin: pid,
          isParent: true,
          sku: 'PARENT',
          title: `Parent Group: ${pid}`,
          imageUrl: row.imageUrl || '',
          brand: row.brand || '',
          category: row.category || '',

          impressions: 0,
          clicks: 0,
          spend: 0,
          sales: 0,
          orders: 0,
          conversions: 0,
          organicSales: 0,
          organicOrders: 0,
          pageViews: 0,
          sessions: 0,

          children: [],
          weekHistory: []
        };
      }

      const p = parents[pid];
      p.children.push(row);
      p.impressions += Number(row.impressions || 0);
      p.clicks += Number(row.clicks || 0);
      p.spend += Number(row.spend || 0);
      p.sales += Number(row.sales || 0);
      p.orders += Number(row.orders || 0);
      p.conversions += Number(row.conversions || 0);
      p.organicSales += Number(row.organicSales || 0);
      p.organicOrders += Number(row.organicOrders || 0);
      p.pageViews += Number(row.pageViews || 0);
      p.sessions += Number(row.sessions || 0);

      if (!p.imageUrl && row.imageUrl) p.imageUrl = row.imageUrl;
      if (!p.brand && row.brand) p.brand = row.brand;
      if (!p.category && row.category) p.category = row.category;
    });

    const parentsList = Object.values(parents).map(p => {
      p.acos = p.sales > 0 ? (p.spend / p.sales) * 100 : 0;
      p.roas = p.spend > 0 ? (p.sales / p.spend) : 0;
      p.cvr = p.clicks > 0 ? (p.orders / p.clicks) * 100 : 0;
      p.ctr = p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0;
      p.cpc = p.clicks > 0 ? (p.spend / p.clicks) : 0;

      const dailyMap = {};
      p.children.forEach(child => {
        const hist = child.weekHistory || child.history || [];
        hist.forEach(h => {
          const d = h.date;
          if (!dailyMap[d]) {
            dailyMap[d] = {
              date: d,
              spend: 0,
              sales: 0,
              orders: 0,
              clicks: 0,
              impressions: 0,
              organicSales: 0,
              pageViews: 0,
              conversions: 0
            };
          }
          dailyMap[d].spend += Number(h.spend || 0);
          dailyMap[d].sales += Number(h.sales || 0);
          dailyMap[d].orders += Number(h.orders || 0);
          dailyMap[d].clicks += Number(h.clicks || 0);
          dailyMap[d].impressions += Number(h.impressions || 0);
          dailyMap[d].organicSales += Number(h.organicSales || 0);
          dailyMap[d].pageViews += Number(h.pageViews || 0);
          dailyMap[d].conversions += Number(h.conversions || 0);
        });
      });

      const sortedHistory = Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date));
      sortedHistory.forEach(h => {
        h.acos = h.sales > 0 ? (h.spend / h.sales) * 100 : 0;
        h.roas = h.spend > 0 ? (h.sales / h.spend) : 0;
        h.cvr = h.clicks > 0 ? (h.orders / h.clicks) * 100 : 0;
      });

      p.weekHistory = sortedHistory;
      p.history = sortedHistory;
      p.childCount = p.children.length;
      return p;
    });

    return parentsList;
  }, [data, groupBy]);

  // Compute paginated subset for this frame
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, page, pageSize]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      // Scroll to top of table container
      const tableContainer = document.getElementById('ads-table-container');
      if (tableContainer) tableContainer.scrollTop = 0;
    }
  };

  // Generate dynamic Dual-Axis series mapping based on selected metrics from toolbar
  const dynamicChartState = useMemo(() => {
    if (!globalChartData || globalChartData.length === 0) return { series: [], yaxis: [], colors: [] };

    const series = chartConfigMetrics.map(metricKey => {
      const config = METRIC_MAP[metricKey];
      return {
        name: config.label,
        type: config.seriesType,
        data: globalChartData.map(d => Number(d[metricKey] || 0).toFixed(config.type === 'currency' ? 2 : config.type === 'number' ? 0 : 2))
      };
    });

    const colors = chartConfigMetrics.map(m => METRIC_MAP[m].color);

    // ApexCharts requires a matching config per series to align dual axes correctly
    const yaxis = chartConfigMetrics.map((mKey, idx) => {
      const config = METRIC_MAP[mKey];
      const isPercent = ['percent', 'ratio'].includes(config.type);
      const isCurrency = config.type === 'currency';

      // We only want to SHOW one logical Axis label on the left and one on the right
      // To avoid 5 axes cluttering the screen, we hide all except the first left and first right one.
      const firstNonPctIdx = chartConfigMetrics.findIndex(k => !['percent', 'ratio'].includes(METRIC_MAP[k].type));
      const firstPctIdx = chartConfigMetrics.findIndex(k => ['percent', 'ratio'].includes(METRIC_MAP[k].type));
      const shouldShow = idx === firstNonPctIdx || idx === firstPctIdx;

      return {
        seriesName: config.label,
        opposite: isPercent,
        show: shouldShow,
        axisTicks: { show: false },
        axisBorder: { show: false },
        title: {
          style: { fontSize: '9px', fontWeight: 600, color: config.color }
        },
        labels: {
          show: shouldShow,
          style: { fontSize: '10px', fontWeight: 500, colors: '#64748b' },
          formatter: (v) => {
            const val = Number(v);
            if (isPercent) return val.toFixed(1) + '%';
            if (isCurrency) {
              if (val >= 100000) return (val / 100000).toFixed(1) + 'L';
              if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
              return val.toFixed(0);
            }
            return val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0);
          }
        }
      };
    });

    return { series, yaxis, colors };
  }, [chartConfigMetrics, globalChartData]);

  return (
    <div className="ads-page-container">
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}
      <AdsImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        selectedSeller={selectedSeller}
        onComplete={() => {
          setShowImportModal(false);
          fetchAdsData();
        }}
      />

      {/* COMPACT DASHBOARD FILTERS HEADER */}
      <div className="ads-top-header py-2">
        <div className="d-flex align-items-center gap-3">
          <h1 className="m-0 fw-bolder text-dark d-none d-md-block" style={{ fontSize: '18px', letterSpacing: '-0.01em' }}>Ads Manager</h1>
          <div className="p-2 bg-indigo-50 rounded-3 text-indigo-600 shadow-sm d-flex align-items-center justify-content-center" style={{ border: '1px solid #e0e7ff', width: '36px', height: '36px' }}>
            <Activity size={18} />
          </div>
          <Input.Search
            placeholder="Search ASIN, SKU or Title..."
            allowClear
            onSearch={setSearchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240 }}
            className="modern-search"
          />
        </div>

        <Space className="ads-header-right" size={12}>
          {/* Modern Ant Segmented Tab */}
          <Segmented
            value={groupBy}
            onChange={(val) => setGroupBy(val)}
            options={[
              { label: 'ASIN Level', value: 'asin' },
              { label: 'Parent Level', value: 'parent' }
            ]}
          />

          {/* Elegant Shared DateRangePicker from Header */}
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onDateChange={(type, s, e) => updateDateRange({ startDate: s, endDate: e, rangeType: type })}
          />

          <Button
            onClick={fetchAdsData}
            loading={loading}
            icon={<RefreshCw size={14} />}
            className="fw-bold"
          >
            REFRESH
          </Button>

          <Button
            type="primary"
            onClick={() => setShowImportModal(true)}
            icon={<Download size={14} />}
            className="fw-bold d-flex align-items-center justify-content-center gap-2"
            style={{
              backgroundColor: '#4f46e5',
              borderColor: '#4f46e5',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.15)'
            }}
          >
            IMPORT ADS
          </Button>
        </Space>
      </div>

      {/* ANALYTICS MODULE AREA - COMPACT RECTANGULAR PILLS STYLE */}
      <div className="flex-shrink-0 overflow-hidden bg-light border-bottom" style={{ maxHeight: showDashboardCharts ? '48px' : '0px', transition: 'all 0.3s ease', opacity: showDashboardCharts ? 1 : 0 }}>
        <div className="px-3 pt-2 pb-1 d-flex align-items-center gap-2 overflow-x-auto custom-scrollbar" style={{ width: '100%' }}>
          {[
            { label: 'Ad Spend', key: 'spend', color: '#4F46E5' },
            { label: 'Ad Sales', key: 'sales', color: '#16a34a' },
            { label: 'Total Sales', key: 'totalSales', color: '#0284c7' },
            { label: 'ACOS', key: 'acos', color: '#dc2626' },
            { label: 'ROAS', key: 'roas', color: '#d97706' },
            { label: 'Orders', key: 'orders', color: '#9333EA' },
            { label: 'CPC', key: 'cpc', color: '#ea580c' },
            { label: 'CVR %', key: 'cvr', color: '#0d9488' }
          ].map((kpi, idx) => {
            const meta = METRIC_MAP[kpi.key] || {};
            const val = summaryData[kpi.key] || 0;
            const isCurr = meta.type === 'currency';
            const isPct = meta.type === 'percent';
            const isRatio = meta.type === 'ratio';
            const formattedVal = isCurr ? '₹' + formatCompact(val) : isRatio ? val.toFixed(2) : isPct ? val.toFixed(1) + '%' : formatCompact(val);

            return (
              <div
                key={idx}
                className="bg-white border shadow-sm d-flex align-items-center gap-2 px-3 hover-up-mild"
                style={{
                  height: '32px',
                  minWidth: 'max-content',
                  flexShrink: 0,
                  borderRadius: '6px',
                  borderColor: '#e4e4e7'
                }}
              >
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: kpi.color,
                    flexShrink: 0
                  }}
                />
                <span className="text-uppercase fw-bold" style={{ fontSize: '10px', letterSpacing: '0.03em', color: kpi.color, whiteSpace: 'nowrap' }}>
                  {kpi.label}
                </span>
                <span className="fw-bolder ms-1" style={{ fontSize: '11px', color: '#09090b' }}>
                  {formattedVal}
                </span>
              </div>
            );
          })}


        </div>
      </div>

      {/* CHART WRAPPER - COMPACT VERTICAL FOOTPRINT */}
      <div className="flex-shrink-0 overflow-hidden bg-light" style={{ maxHeight: showDashboardCharts ? '420px' : '0px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', opacity: showDashboardCharts ? 1 : 0 }}>
        <div className="px-3 py-2">
          <Card
            styles={{ body: { padding: '10px 12px 12px 12px' } }}
            style={{ borderRadius: '12px', boxShadow: '0 4px 12px -2px rgba(0,0,0,0.04)', overflow: 'hidden' }}
          >
            <div className="px-1 py-1 d-flex align-items-center justify-content-between border-bottom mb-2">
              <div className="d-flex align-items-center gap-2">
                <div style={{ width: '4px', height: '14px', background: '#4F46E5', borderRadius: '4px' }}></div>
                <Text strong style={{ color: '#1e293b', fontSize: '13px' }}>Campaign Trends & Breakdown</Text>
              </div>

              <Select
                mode="multiple"
                value={chartConfigMetrics}
                onChange={(val) => setChartConfigMetrics(val)}
                style={{ minWidth: 220, maxWidth: 320 }}
                size="small"
                placeholder="Select active metrics"
                maxTagCount="responsive"
                classNames={{ popup: { root: "premium-chart-dropdown" } }}
                options={Object.keys(METRIC_MAP).map(k => ({
                  label: METRIC_MAP[k].label,
                  value: k
                }))}
              />
            </div>

            <div style={{ height: '320px' }}>
              {dynamicChartState.series.length > 0 ? (
                <Chart
                  height="100%"
                  type="line"
                  series={dynamicChartState.series}
                  options={{
                    chart: {
                      type: 'line',
                      toolbar: { show: true, tools: { download: false } },
                      zoom: { enabled: false },
                      fontFamily: 'inherit'
                    },
                    stroke: {
                      width: dynamicChartState.series.map(s => s.type === 'line' ? 2.5 : 0),
                      curve: 'smooth'
                    },
                    colors: dynamicChartState.colors,
                    plotOptions: {
                      bar: { columnWidth: '45%', borderRadius: 4 }
                    },
                    fill: {
                      opacity: dynamicChartState.series.map(s => s.type === 'line' ? 1 : 0.85)
                    },
                    markers: { size: dynamicChartState.series.map(s => s.type === 'line' ? 3 : 0), strokeWidth: 1 },
                    dataLabels: { enabled: false },
                    xaxis: {
                      categories: globalChartData.map(d => new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
                      axisBorder: { show: false },
                      axisTicks: { show: false },
                      labels: { style: { colors: '#64748b', fontWeight: 600, fontSize: '10px' } }
                    },
                    yaxis: dynamicChartState.yaxis,
                    grid: { borderColor: '#f1f5f9', strokeDashArray: 4, padding: { top: 5, right: 15, bottom: 10, left: 15 } },
                    legend: { show: true, position: 'top', horizontalAlign: 'center', fontWeight: 700, fontSize: '10px', markers: { radius: 12 }, height: 25 },
                    tooltip: { shared: true, intersect: false, theme: 'light' }
                  }}
                />
              ) : (
                <div className="h-100 d-flex align-items-center justify-content-center text-muted fw-bold small bg-light rounded-3">SELECT METRICS TO VIEW CHART</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* TABULAR / DASHBOARD TOGGLE CONTROLS */}
      <div className="bg-white border-top border-bottom px-3 py-2 d-flex align-items-center justify-content-between" style={{ zIndex: 10, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
        <div className="d-flex align-items-center gap-3">
          <Button
            type={showDashboardCharts ? 'primary' : 'default'}
            icon={showDashboardCharts ? <ChevronUp size={14} /> : <BarChart3 size={14} />}
            onClick={() => setShowDashboardCharts(!showDashboardCharts)}
            className="fw-bold d-flex align-items-center justify-content-center gap-1.5"
            style={showDashboardCharts ? { background: '#4F46E5', border: 'none' } : {}}
          >
            {showDashboardCharts ? 'HIDE ANALYTICS' : 'VIEW ANALYTICS'}
          </Button>
        </div>

        <div className="small text-muted fw-bold bg-light px-3 py-1 rounded-pill border" style={{ fontSize: '10px', letterSpacing: '0.05em' }}>
          Showing <span className="text-indigo-600 fw-bolder">{paginatedData.length}</span> results of <span className="text-dark fw-bolder">{data.length}</span>
        </div>
      </div>

      {/* MAIN TABLE CONTAINER */}
      <div className="flex-grow-1 overflow-hidden d-flex flex-column">
        <div id="ads-table-container" style={{ flex: 1, overflow: 'auto', position: 'relative', backgroundColor: '#fff' }}>
          <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 4, background: '#fff' }}>
              {/* ROW 1: High-level groups */}
              <tr>
                {/* --- STICKY CORNER CELL (IMAGE) --- */}
                <th
                  rowSpan={2}
                  style={{
                    ...thStyle,
                    width: '60px',
                    position: 'sticky',
                    left: 0,
                    top: 0,
                    zIndex: 5,
                    background: '#fafafa',
                    borderRight: '1px solid #e2e8f0',
                  }}
                >
                  IMAGE
                </th>

                {/* --- STICKY CORNER CELL (IDENTIFIER / SELLER DROPDOWN) --- */}
                <th
                  rowSpan={2}
                  style={{
                    ...thStyle,
                    width: '185px',
                    position: 'sticky',
                    left: '60px',
                    top: 0,
                    zIndex: 5,
                    background: '#fff',
                    borderRight: '1px solid #e2e8f0',
                    padding: '6px 10px',
                  }}
                >
                  <div className="d-flex flex-column align-items-stretch gap-1">
                    <span className="text-zinc-500 smallest fw-bold text-start" style={{ letterSpacing: '0.05em', fontSize: '9px' }}>SELLER ACCOUNT</span>
                    <div style={{ width: '100%', fontWeight: 'normal' }} onClick={(e) => e.stopPropagation()}>
                      <InfiniteScrollSelect
                        fetchData={fetchSellerDropdownData}
                        value={selectedSeller}
                        onSelect={(val) => setSelectedSeller(val)}
                        placeholder="All Sellers"
                      />
                    </div>
                  </div>
                </th>

                {/* --- REMAINING HEADERS (inherit top via thead sticky) --- */}
                <th rowSpan={2} style={{ ...thStyle, width: '110px', textAlign: 'left' }}>SKU</th>
                <th rowSpan={2} style={{ ...thStyle, width: '200px', textAlign: 'left' }}>PRODUCT DETAILS</th>
                <th rowSpan={2} style={{ ...thStyle, width: '70px', textAlign: 'center', background: '#fafafa' }}>TARGET</th>

                {/* DYNAMIC ADS COLUMNS */}
                {renderHeaderGroup('TOTAL SALES(AD + ORG)', 'blue', <FileBarChart size={12} />, 'totalSales')}
                {renderHeaderGroup('ORDERED UNITS', 'pink', <Layers size={12} />, 'orders')}
                {renderHeaderGroup('SPEND', 'indigo', <BarChart3 size={12} />, 'spend')}
                {renderHeaderGroup('CLICKS', 'cyan', <TrendUpIcon size={12} />, 'clicks')}
                {renderHeaderGroup('IMPRESSIONS', 'blue', <Eye size={12} />, 'impressions')}
                {renderHeaderGroup('ROAS', 'amber', <RefreshCw size={12} />, 'roas')}
                {renderHeaderGroup('ACOS', 'purple', <Target size={12} />, 'acos')}
                {renderHeaderGroup('AD SALES', 'emerald', <FileBarChart size={12} />, 'sales')}
                {renderHeaderGroup('CVR', 'slate', <Activity size={12} />, 'cvr')}
                {renderHeaderGroup('ORGANIC SALES', 'emerald', <BarChart3 size={12} />, 'organicSales')}
                {renderHeaderGroup('PAGE VIEWS', 'blue', <Eye size={12} />, 'pageViews')}
              </tr>

              {/* ROW 2: Metrics Sub-headers (Avg / Trend / Dates) */}
              <tr>
                {renderSubHeaders('blue', 'totalSales')}
                {renderSubHeaders('pink', 'orders')}
                {renderSubHeaders('indigo', 'spend')}
                {renderSubHeaders('cyan', 'clicks')}
                {renderSubHeaders('blue', 'impressions')}
                {renderSubHeaders('amber', 'roas')}
                {renderSubHeaders('purple', 'acos')}
                {renderSubHeaders('emerald', 'sales')}
                {renderSubHeaders('slate', 'cvr')}
                {renderSubHeaders('emerald', 'organicSales')}
                {renderSubHeaders('blue', 'pageViews')}
              </tr>
            </thead>

            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={100} style={{ padding: '100px 0', textAlign: 'center', backgroundColor: '#fff' }}>
                    {loading ? (
                      <div className="d-flex flex-column align-items-center gap-2 py-5">
                        <div className="spinner-border spinner-border-sm text-indigo-600" role="status"></div>
                        <span className="text-zinc-500 smallest fw-bold" style={{ letterSpacing: '0.05em' }}>LOADING PERFORMANCE DATA...</span>
                      </div>
                    ) : (
                      <EmptyState
                        icon={BarChart3}
                        title="No Advertising Data"
                        description="We couldn't find any matching performance records for your search."
                      />
                    )}
                  </td>
                </tr>
              ) : (
                paginatedData.flatMap((row, idx) => {
                  const isAltRow = idx % 2 === 1;
                  const rowBg = isAltRow ? '#f9fafb' : '#ffffff';
                  const isParentRow = row.isParent === true;

                  const mainRow = (
                    <tr key={row.id || idx} className="table-row-hover" style={{ background: rowBg }}>
                      {/* Identifiers (Sticky) */}
                      {/* IMAGE CELL */}
                      <td
                        style={{
                          ...tdStyle,
                          padding: '4px',
                          position: 'sticky',
                          left: 0,
                          zIndex: 3,
                          background: rowBg,
                          borderRight: '1px solid #f1f5f9',
                          cursor: 'pointer',
                        }}
                        onClick={() => setActiveHistoryRow(row)}
                        title="View Detail History"
                      >
                        <div style={{ width: '40px', height: '40px', margin: 'auto', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {row.imageUrl ? (
                            <img src={row.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <Package size={16} className="text-zinc-300" />
                          )}
                        </div>
                      </td>

                      {/* IDENTIFIER CELL */}
                      <td
                        style={{
                          ...tdStyle,
                          position: 'sticky',
                          left: '60px',
                          zIndex: 3,
                          background: rowBg,
                          borderRight: '1px solid #f1f5f9',
                          cursor: 'pointer',
                        }}
                        onClick={() => setActiveHistoryRow(row)}
                        title="View Detail History"
                      >
                        <div className="d-flex align-items-center gap-2">
                          {isParentRow && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleParentExpand(row.asin);
                              }}
                              className="d-flex align-items-center justify-content-center bg-zinc-100 hover-bg-zinc-200 rounded text-zinc-600"
                              style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                            >
                              {expandedParents.has(row.asin) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </div>
                          )}
                          <div className="d-flex flex-column gap-0.5">
                            <span className="fw-bold text-indigo-600 font-monospace" style={{ fontSize: '10px' }}>
                              {row.asin}
                            </span>
                            {isParentRow && (
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded smallest fw-bold" style={{ width: 'fit-content', fontSize: '8.5px' }}>
                                {row.childCount} CHILDREN
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td style={{ ...tdStyle, fontWeight: 600, color: '#475569' }}>
                        {isParentRow ? (
                          <span className="badge bg-zinc-100 text-zinc-600 border px-2 py-1 rounded" style={{ fontSize: '9px' }}>GROUP</span>
                        ) : row.sku}
                      </td>

                      <td style={{ ...tdStyle }}>
                        <div className="d-flex flex-column" style={{ maxWidth: '200px' }}>
                          <span className="fw-bold text-zinc-800 text-truncate" title={row.title}>{row.title}</span>
                          <span className="smallest text-zinc-400 fw-semibold">{row.brand} • {row.category}</span>
                        </div>
                      </td>

                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span style={{ color: '#cbd5e1', fontSize: '9px', fontWeight: 600 }}>NOT SET</span>
                      </td>

                      {/* --- CORE METRIC CELLS --- */}
                      {renderCells(row, 'totalSales', 'blue', 'totalSales', true)}
                      {renderCells(row, 'orders', 'pink', 'orders')}
                      {renderCells(row, 'spend', 'indigo', 'spend', true)}
                      {renderCells(row, 'clicks', 'cyan', 'clicks')}
                      {renderCells(row, 'impressions', 'blue', 'impressions')}
                      {renderCells(row, 'roas', 'amber', 'roas', false, false)}
                      {renderCells(row, 'acos', 'purple', 'acos', false, true)}
                      {renderCells(row, 'sales', 'emerald', 'sales', true)}
                      {renderCells(row, 'cvr', 'slate', 'cvr', false, true)}
                      {renderCells(row, 'organicSales', 'emerald', 'organicSales', true)}
                      {renderCells(row, 'pageViews', 'blue', 'pageViews')}
                    </tr>
                  );

                  if (isParentRow && expandedParents.has(row.asin)) {
                    const childrenRows = row.children.map((child, cIdx) => {
                      const childBg = '#fcfdff';
                      return (
                        <tr key={`${row.id}-child-${child.id || cIdx}`} className="table-row-hover" style={{ background: childBg, borderLeft: '3px solid #6366f1' }}>
                          {/* IMAGE CELL */}
                          <td
                            style={{
                              ...tdStyle,
                              padding: '4px',
                              position: 'sticky',
                              left: 0,
                              zIndex: 3,
                              background: childBg,
                              borderRight: '1px solid #f1f5f9',
                              cursor: 'pointer',
                            }}
                            onClick={() => setActiveHistoryRow(child)}
                            title="View Detail History"
                          >
                            <div style={{ width: '32px', height: '32px', margin: 'auto', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {child.imageUrl ? (
                                <img src={child.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                              ) : (
                                <Package size={14} className="text-zinc-300" />
                              )}
                            </div>
                          </td>

                          {/* IDENTIFIER CELL */}
                          <td
                            style={{
                              ...tdStyle,
                              position: 'sticky',
                              left: '60px',
                              zIndex: 3,
                              background: childBg,
                              borderRight: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              paddingLeft: '16px'
                            }}
                            onClick={() => setActiveHistoryRow(child)}
                            title="View Detail History"
                          >
                            <div className="d-flex align-items-center gap-1">
                              <span className="text-zinc-400 fw-bold font-monospace" style={{ fontSize: '10px' }}>↳</span>
                              <span className="fw-semibold text-zinc-700 font-monospace" style={{ fontSize: '10px' }}>
                                {child.asin}
                              </span>
                            </div>
                          </td>

                          <td style={{ ...tdStyle, fontWeight: 600, color: '#475569', fontSize: '9.5px' }}>{child.sku}</td>

                          <td style={{ ...tdStyle }}>
                            <div className="d-flex flex-column" style={{ maxWidth: '200px' }}>
                              <span className="text-zinc-700 text-truncate" style={{ fontSize: '10px' }} title={child.title}>{child.title}</span>
                              <span className="smallest text-zinc-400 fw-semibold">{child.brand} • {child.category}</span>
                            </div>
                          </td>

                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <span style={{ color: '#cbd5e1', fontSize: '9px', fontWeight: 600 }}>NOT SET</span>
                          </td>

                          {/* --- CORE METRIC CELLS --- */}
                          {renderCells(child, 'totalSales', 'blue', 'totalSales', true)}
                          {renderCells(child, 'orders', 'pink', 'orders')}
                          {renderCells(child, 'spend', 'indigo', 'spend', true)}
                          {renderCells(child, 'clicks', 'cyan', 'clicks')}
                          {renderCells(child, 'impressions', 'blue', 'impressions')}
                          {renderCells(child, 'roas', 'amber', 'roas', false, false)}
                          {renderCells(child, 'acos', 'purple', 'acos', false, true)}
                          {renderCells(child, 'sales', 'emerald', 'sales', true)}
                          {renderCells(child, 'cvr', 'slate', 'cvr', false, true)}
                          {renderCells(child, 'organicSales', 'emerald', 'organicSales', true)}
                          {renderCells(child, 'pageViews', 'blue', 'pageViews')}
                        </tr>
                      );
                    });
                    return [mainRow, ...childrenRows];
                  }

                  return [mainRow];
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Meta Status & PAGINATION */}
        <div className="bg-white border-top px-3 py-2 d-flex align-items-center justify-content-between" style={{ flexShrink: 0 }}>
          <div className="d-flex align-items-center gap-3">
            <span className="smallest fw-bold text-zinc-500">
              TOTAL {data.length.toLocaleString()} {groupBy === 'parent' ? 'ENTRIES' : 'ASINs'}
            </span>

            <div style={{ height: '12px', width: '1px', background: '#e2e8f0' }}></div>

            <div className="d-flex align-items-center gap-2">
              <span className="smallest fw-semibold text-zinc-500">Rows per page:</span>
              <select
                className="form-select form-select-sm border-0 bg-transparent fw-bold"
                style={{ fontSize: '0.7rem', width: 'auto', paddingRight: '20px', cursor: 'pointer' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn btn-sm border-0 bg-zinc-100 text-zinc-600 d-flex align-items-center justify-content-center"
                style={{ width: '24px', height: '24px', padding: 0, opacity: page === 1 ? 0.5 : 1 }}
                disabled={page === 1}
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft size={14} />
              </button>

              <div className="d-flex align-items-center gap-1">
                <span className="smallest fw-bold text-indigo-600">PAGE {page}</span>
                <span className="smallest fw-semibold text-zinc-400">OF {totalPages}</span>
              </div>

              <button
                className="btn btn-sm border-0 bg-zinc-100 text-zinc-600 d-flex align-items-center justify-content-center"
                style={{ width: '24px', height: '24px', padding: 0, opacity: page === totalPages ? 0.5 : 1 }}
                disabled={page === totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}

          <div className="d-flex gap-3 align-items-center">
            <div className="d-flex align-items-center gap-1.5">
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669' }} />
              <span className="smallest fw-semibold text-zinc-500" style={{ fontSize: '9px', letterSpacing: '0.02em' }}>LIVE SYNC</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .table-row-hover:hover {
          background-color: #f8fafc !important;
        }
        .table-row-hover:hover td {
          background-color: #f8fafc !important;
        }
        .bg-gradient-primary {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
        }
        .hover-scale:hover {
          transform: scale(1.2);
        }
        .shadow-inner {
          box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06);
        }
        .smallest {
          font-size: 0.65rem;
        }
        .hover-up-mild {
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .hover-up-mild:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -10px rgba(79,70,229,0.15), 0 4px 6px -2px rgba(0,0,0,0.02) !important;
        }
        .hover-bg-light:hover {
          background-color: #f8fafc !important;
        }
        .premium-chart-dropdown .ant-select-item-option-selected {
          background-color: #EEF2FF !important;
          font-weight: bold;
        }
        .premium-ads-th {
          transition: background-color 0.2s ease, border 0.2s ease;
        }
        /* Silky Smooth Fade-In For Expanded Grid Columns */
        .dynamic-col-cell {
          animation: slideFadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes slideFadeIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        /* Custom sleek system scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .ads-page-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
          background-color: #f4f7fe;
          /* Counteract parent padding (1.5rem top, 2rem sides) from .routes-container in App.css */
          margin: -1.5rem -2rem -1.5rem -2rem; 
        }
        .ads-top-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 2rem;
          position: sticky;
          top: -1.5rem; /* Offset the negative margin of container */
          z-index: 50;
          background: #fff;
          border-bottom: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          flex-shrink: 0;
          overflow-x: auto;
          scrollbar-width: none; /* Hide scrollbar for Firefox */
        }
        .ads-top-header::-webkit-scrollbar {
          display: none; /* Hide scrollbar for Chrome, Safari, and Opera */
        }
        .ads-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .ads-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: nowrap;
        }
      `}</style>

      {/* Detailed View Model Portal */}
      <AdsHistoryModal
        isOpen={!!activeHistoryRow}
        onClose={() => setActiveHistoryRow(null)}
        rowData={activeHistoryRow}
      />
    </div>
  );
}
