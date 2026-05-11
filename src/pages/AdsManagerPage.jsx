import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import {
  Package,
  Activity,
  TrendingUp,
  TrendingDown,
  Table,
  ChevronDown,
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
  FileBarChart
} from 'lucide-react';
import { adsApi } from '../services/api';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import EmptyState from '../components/common/EmptyState';

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
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
  return val.toString();
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

export default function AdsManagerPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  
  // Filtering and Grouping States
  const [groupBy, setGroupBy] = useState('asin');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Visual Collapsible Columns Tracking
  const [expandedCols, setExpandedCols] = useState({
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

  const toggleCol = (colKey) => {
    setExpandedCols(prev => ({ ...prev, [colKey]: !prev[colKey] }));
  };

  // 1. Fetch Ads Aggregated Data
  const fetchAdsData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        groupBy,
        search: searchQuery
      };
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;

      const res = await adsApi.getAdsManagerData(params);
      if (res.success) {
        setData(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch ads data:', err);
    } finally {
      setLoading(false);
    }
  }, [groupBy, searchQuery, dateRange]);

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
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#71717a', // zinc-500
    padding: '4px 8px',
    background: '#fafafa',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    whiteSpace: 'nowrap',
    border: '0.5px solid #f1f1f1'
  };

  const tdStyle = {
    padding: '4px 8px',
    fontSize: '0.68rem',
    borderBottom: '0.5px solid #f1f5f9',
    verticalAlign: 'middle',
    color: '#27272a', // zinc-800
    height: '28px',
    borderLeft: '0.5px solid #f1f5f9',
    borderRight: '0.5px solid #f1f5f9',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  };

  // Helper to construct dynamic column header grouping
  const renderHeaderGroup = (title, colorHue, icon, expandedKey, width = '80px') => {
    const isExpanded = expandedCols[expandedKey];
    // Total subcols = standard col count + dynamic date subcols if expanded
    // standard is main total + trend/sparkline 
    const baseCols = 2; // Total + Spark
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
        <th style={{ ...thStyle, width: '70px', textAlign: 'right', background: c.bg, color: c.text }}>AVG</th>
        <th style={{ ...thStyle, width: '50px', textAlign: 'center', background: c.bg, color: c.text }}>TRN</th>
        {isExpanded && activeDates.map(d => (
          <th key={d.raw} style={{ ...thStyle, width: '45px', textAlign: 'center', fontSize: '8px', background: c.bg, color: c.text }}>
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

    const textCol = isCurrency ? '#059669' : '#1f2937';

    const formatVal = (v) => {
      if (isPercent) return v.toFixed(1) + '%';
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
        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: textCol, background: '#fff' }}>
          {formatVal(currentVal)}
        </td>
        {/* Trend Cell */}
        <td style={{ ...tdStyle, textAlign: 'center', background: '#fff', padding: '2px' }}>
          <TrendBadge value={lastHistVal} prevValue={prevHistVal} isInverted={isTrendInverted} />
        </td>
        {/* Expandable Day Cells */}
        {isExpanded && activeDates.map(d => {
          const val = dateVals[d.raw] || 0;
          return (
            <td key={d.raw} style={{ ...tdStyle, textAlign: 'center', fontSize: '9px', background: '#fcfcfc', color: '#64748b' }}>
              {formatVal(val)}
            </td>
          );
        })}
      </>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <PageLoader />
        </div>
      )}

      {/* HEADER TOOLBAR */}
      <div className="bg-white border-bottom px-4 py-2.5 shadow-sm d-flex align-items-center justify-content-between" style={{ zIndex: 100 }}>
        <div className="d-flex align-items-center gap-3">
          <div className="bg-gradient-primary p-2 rounded-3 text-white d-flex shadow-sm" 
               style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}>
            <BarChart3 size={22} />
          </div>
          <div>
            <h1 className="h6 mb-0 fw-bold text-zinc-900" style={{ letterSpacing: '-0.01em' }}>ADS MANAGER</h1>
            <p className="mb-0 text-zinc-500 smallest fw-semibold">Daily Campaign Performance Aggregator</p>
          </div>
        </div>

        {/* FILTERS REGION */}
        <div className="d-flex align-items-center gap-3 flex-wrap">
          {/* Group By Selector */}
          <div className="bg-zinc-100 p-1 rounded-2 d-flex align-items-center shadow-inner" style={{ height: '32px' }}>
            <button 
              onClick={() => setGroupBy('asin')}
              className={`btn btn-xs px-3 py-1 rounded-1 fw-bold d-flex align-items-center gap-1.5 transition-all ${groupBy === 'asin' ? 'bg-white text-indigo-600 shadow-sm' : 'btn-link text-zinc-500 hover-bg-zinc-200 no-underline'}`}
              style={{ fontSize: '10px', border: 'none' }}
            >
              <Package size={11} />
              BY ASIN
            </button>
            <button 
              onClick={() => setGroupBy('parent')}
              className={`btn btn-xs px-3 py-1 rounded-1 fw-bold d-flex align-items-center gap-1.5 transition-all ${groupBy === 'parent' ? 'bg-white text-indigo-600 shadow-sm' : 'btn-link text-zinc-500 hover-bg-zinc-200 no-underline'}`}
              style={{ fontSize: '10px', border: 'none' }}
            >
              <Layers size={11} />
              BY PARENT
            </button>
          </div>

          {/* Date Range */}
          <div className="d-flex align-items-center gap-2 border border-zinc-200 bg-white rounded-2 px-2 h-8" style={{ height: '32px' }}>
            <Calendar size={12} className="text-zinc-400" />
            <input 
              type="date" 
              className="border-0 smallest fw-bold text-zinc-700 shadow-none" 
              style={{ outline: 'none', width: '110px', fontSize: '10px' }}
              onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))}
            />
            <span className="text-zinc-300">-</span>
            <input 
              type="date" 
              className="border-0 smallest fw-bold text-zinc-700 shadow-none" 
              style={{ outline: 'none', width: '110px', fontSize: '10px' }}
              onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))}
            />
          </div>

          {/* Search Box */}
          <div className="position-relative">
            <Search size={13} className="position-absolute top-50 translate-middle-y ms-2.5 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search SKU or ASIN..."
              className="form-control form-control-sm bg-white border-zinc-200 shadow-none rounded-2 ps-5"
              style={{ width: '200px', height: '32px', fontSize: '11px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button onClick={fetchAdsData} className="btn btn-indigo btn-sm rounded-2 h-8 px-3 fw-bold d-flex align-items-center gap-1.5" style={{ fontSize: '11px', height: '32px' }}>
            <RefreshCw size={12} className={loading ? 'spin' : ''} />
            REFRESH
          </button>
        </div>
      </div>

      {/* MAIN TABLE CONTAINER */}
      <div className="flex-grow-1 overflow-hidden d-flex flex-column">
        <div style={{ flex: 1, overflow: 'auto', position: 'relative', backgroundColor: '#fff' }}>
          <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 50 }}>
              {/* ROW 1: High-level groups */}
              <tr>
                <th rowSpan={2} style={{ ...thStyle, width: '60px', position: 'sticky', left: 0, zIndex: 55, background: '#fafafa', borderRight: '1px solid #e2e8f0' }}>IMAGE</th>
                <th rowSpan={2} style={{ ...thStyle, width: '130px', position: 'sticky', left: '60px', zIndex: 54, background: '#fff', borderRight: '1px solid #e2e8f0' }}>IDENTIFIER</th>
                <th rowSpan={2} style={{ ...thStyle, width: '110px', textAlign: 'left' }}>SKU</th>
                <th rowSpan={2} style={{ ...thStyle, width: '200px', textAlign: 'left' }}>PRODUCT DETAILS</th>
                <th rowSpan={2} style={{ ...thStyle, width: '70px', textAlign: 'center', background: '#fafafa' }}>TARGET</th>

                {/* DYNAMIC ADS COLUMNS */}
                {renderHeaderGroup('IMPRESSIONS', 'blue', <Eye size={12} />, 'impressions')}
                {renderHeaderGroup('CLICKS', 'cyan', <TrendUpIcon size={12} />, 'clicks')}
                {renderHeaderGroup('SPEND', 'indigo', <BarChart3 size={12} />, 'spend')}
                {renderHeaderGroup('AD SALES', 'emerald', <FileBarChart size={12} />, 'sales')}
                {renderHeaderGroup('ACOS', 'purple', <Target size={12} />, 'acos')}
                {renderHeaderGroup('ROAS', 'amber', <RefreshCw size={12} />, 'roas')}
                {renderHeaderGroup('ORDERS', 'pink', <Layers size={12} />, 'orders')}
                {renderHeaderGroup('CVR', 'slate', <Activity size={12} />, 'cvr')}
                {renderHeaderGroup('ORGANIC SALES', 'emerald', <BarChart3 size={12} />, 'organicSales')}
                {renderHeaderGroup('PAGE VIEWS', 'blue', <Eye size={12} />, 'pageViews')}
              </tr>
              
              {/* ROW 2: Metrics Sub-headers (Avg / Trend / Dates) */}
              <tr>
                {renderSubHeaders('blue', 'impressions')}
                {renderSubHeaders('cyan', 'clicks')}
                {renderSubHeaders('indigo', 'spend')}
                {renderSubHeaders('emerald', 'sales')}
                {renderSubHeaders('purple', 'acos')}
                {renderSubHeaders('amber', 'roas')}
                {renderSubHeaders('pink', 'orders')}
                {renderSubHeaders('slate', 'cvr')}
                {renderSubHeaders('emerald', 'organicSales')}
                {renderSubHeaders('blue', 'pageViews')}
              </tr>
            </thead>

            <tbody>
              {data.length === 0 && !loading ? (
                <tr>
                  <td colSpan={100} style={{ padding: '100px 0' }}>
                    <EmptyState 
                      icon={BarChart3}
                      title="No Advertising Data"
                      description="We couldn't find any matching performance records for your search."
                    />
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => {
                  const isAltRow = idx % 2 === 1;
                  const rowBg = isAltRow ? '#f9fafb' : '#ffffff';
                  
                  return (
                    <tr key={row.id || idx} className="table-row-hover" style={{ background: rowBg }}>
                      {/* Identifiers (Sticky) */}
                      <td style={{ ...tdStyle, padding: '4px', position: 'sticky', left: 0, background: rowBg, zIndex: 20, borderRight: '1px solid #f1f5f9' }}>
                        <div style={{ width: '40px', height: '40px', margin: 'auto', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {row.imageUrl ? (
                            <img src={row.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <Package size={16} className="text-zinc-300" />
                          )}
                        </div>
                      </td>
                      
                      <td style={{ ...tdStyle, position: 'sticky', left: '60px', background: rowBg, zIndex: 19, borderRight: '1px solid #f1f5f9' }}>
                        <div className="d-flex flex-column gap-0.5">
                          <span className="fw-bold text-indigo-600 font-monospace" style={{ fontSize: '10px' }}>
                            {groupBy === 'parent' ? row.parentAsin : row.asin}
                          </span>
                          {groupBy === 'parent' && (
                            <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded smallest fw-bold" style={{ width: 'fit-content', fontSize: '8.5px' }}>
                              {row.childCount} CHILDREN
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ ...tdStyle, fontWeight: 600, color: '#475569' }}>{row.sku}</td>
                      
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
                      {renderCells(row, 'impressions', 'blue', 'impressions')}
                      {renderCells(row, 'clicks', 'cyan', 'clicks')}
                      {renderCells(row, 'spend', 'indigo', 'spend', true)}
                      {renderCells(row, 'sales', 'emerald', 'sales', true)}
                      {renderCells(row, 'acos', 'purple', 'acos', false, true)}
                      {renderCells(row, 'roas', 'amber', 'roas', false, false)}
                      {renderCells(row, 'orders', 'pink', 'orders')}
                      {renderCells(row, 'cvr', 'slate', 'cvr', false, true)}
                      {renderCells(row, 'organicSales', 'emerald', 'organicSales', true)}
                      {renderCells(row, 'pageViews', 'blue', 'pageViews')}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table Footer / Meta Status */}
        <div className="bg-zinc-50 border-top px-4 py-2 d-flex align-items-center justify-content-between">
          <span className="smallest fw-bold text-zinc-500">
            SHOWING {data.length} {groupBy === 'parent' ? 'PARENT GROUPS' : 'ASINs'}
          </span>
          <div className="d-flex gap-3 align-items-center">
             <div className="d-flex align-items-center gap-1.5">
               <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#059669' }} />
               <span className="smallest fw-semibold text-zinc-600">Live Sync Active</span>
             </div>
          </div>
        </div>
      </div>

      <style>{`
        .table-row-hover:hover {
          background-color: #f1f5f9 !important;
        }
        .table-row-hover:hover td {
          background-color: #f1f5f9 !important;
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
        /* Custom small scrollbar */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}
