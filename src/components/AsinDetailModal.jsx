import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, IndianRupee, Star, Award, Store, Activity, BarChart3, TrendingUp, TrendingDown, Eye, ExternalLink, Calendar, ListChecks, Image, AlertCircle, Trophy, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
import Chart from 'react-apexcharts';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import AdvancedDateRangePicker from '../contexts/DateRangeContext';
import Popover from './common/Popover';

// Helper to get last valid data from history fallback
const getLastValidData = (asin, field, defaultValue = 0) => {
  // First check current field
  if (asin[field] && asin[field] > 0) {
    return { value: asin[field], source: 'current' };
  }
  
  // Fallback to most recent history with valid data
  const history = asin.history || asin.weekHistory || [];
  if (history.length > 0) {
    const sorted = [...history].sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
    for (const h of sorted) {
      if (h[field] && h[field] > 0) {
        return { value: h[field], source: 'history', date: h.date || h.week };
      }
    }
  }
  
  return { value: defaultValue, source: 'none' };
};

const ScoreCard = ({ title, score, grade, issues = [], recommendations = [], color = '#6366f1' }) => {
  const parsedIssues = typeof issues === 'string' ? (issues.startsWith('[') ? JSON.parse(issues) : issues.split(',').filter(Boolean)) : (issues || []);
  const parsedRecs = typeof recommendations === 'string' ? (recommendations.startsWith('[') ? JSON.parse(recommendations) : recommendations.split(',').filter(Boolean)) : (recommendations || []);

  return (
    <div className="bg-white border rounded-2xl p-4 shadow-sm h-100 transition-all hover:shadow-md">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <h6 className="mb-0 fw-bold text-slate-800">{title}</h6>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge rounded-pill px-2 py-1" style={{ backgroundColor: color + '15', color: color, fontWeight: 700, fontSize: '10px' }}>
            Grade {grade || 'N/A'}
          </span>
          <span className="fw-bold text-slate-900" style={{ fontSize: '13px' }}>{score || 0}/100</span>
        </div>
      </div>
      
      <div className="mb-3">
        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${score || 0}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
        </div>
      </div>

      <div className="d-flex flex-column gap-3">
        {parsedIssues.length > 0 && (
          <div>
            <p className="smallest fw-bold text-slate-400 text-uppercase mb-2 tracking-wider d-flex align-items-center gap-1" style={{ fontSize: '9px' }}>
              <AlertTriangle size={10} className="text-danger" /> Issues Found
            </p>
            <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
              {parsedIssues.slice(0, 3).map((issue, idx) => (
                <li key={idx} className="d-flex align-items-start gap-2 text-slate-600" style={{ fontSize: '11px', lineHeight: 1.4 }}>
                  <span className="text-danger mt-1" style={{ fontSize: '8px' }}>●</span>
                  <span>{issue}</span>
                </li>
              ))}
              {parsedIssues.length > 3 && <li className="smallest text-muted ps-3">+{parsedIssues.length - 3} more issues</li>}
            </ul>
          </div>
        )}

        {parsedRecs.length > 0 ? (
          <div>
            <p className="smallest fw-bold text-indigo-400 text-uppercase mb-2 tracking-wider d-flex align-items-center gap-1" style={{ fontSize: '9px' }}>
              <Sparkles size={10} className="text-amber-500" /> Optimization Tasks
            </p>
            <ul className="list-unstyled mb-0 d-flex flex-column gap-1">
              {parsedRecs.slice(0, 3).map((rec, idx) => (
                <li key={idx} className="d-flex align-items-start gap-2 text-slate-700" style={{ fontSize: '11px', lineHeight: 1.4 }}>
                  <CheckCircle2 size={11} className="text-emerald-500 mt-1 flex-shrink-0" />
                  <span className="fw-medium">{rec}</span>
                </li>
              ))}
              {parsedRecs.length > 3 && <li className="smallest text-muted ps-4">+{parsedRecs.length - 3} more suggestions</li>}
            </ul>
          </div>
        ) : (
          <div className="py-2 px-3 bg-emerald-50 rounded-xl border border-emerald-100 d-flex align-items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <span className="smallest text-emerald-700 fw-bold">Optimized Perfect!</span>
          </div>
        )}
      </div>
    </div>
  );
};

const AsinDetailModal = ({ asin, isOpen, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState({
    start: subDays(endOfDay(new Date()), 7),
    end: endOfDay(new Date())
  });

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // All hooks above this line - called unconditionally every render
  
  // Compute current values with history fallback
  const { currentData, bsrData, ratingData, ratingBreakdownData } = useMemo(() => {
    if (!asin) return { currentData: {}, bsrData: {}, ratingData: {}, ratingBreakdownData: {} };
    
    const priceInfo = getLastValidData(asin, 'currentPrice') || getLastValidData(asin, 'price');
    const bsrInfo = getLastValidData(asin, 'bsr');
    const ratingInfo = getLastValidData(asin, 'rating');
    
    // Get rating breakdown from current or history
    let breakdownData = asin.ratingBreakdown;
    let breakdownDate = null;
    if (!breakdownData) {
      const history = asin.history || asin.weekHistory || [];
      if (history.length > 0) {
        const sorted = [...history].sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
        for (const h of sorted) {
          if (h.ratingBreakdown) {
            breakdownData = h.ratingBreakdown;
            breakdownDate = h.date || h.week;
            break;
          }
        }
      }
    }
    
    return {
      currentData: { value: priceInfo.value, source: priceInfo.source, date: priceInfo.date },
      bsrData: { value: bsrInfo.value, source: bsrInfo.source, date: bsrInfo.date },
      ratingData: { value: ratingInfo.value, source: ratingInfo.source, date: ratingInfo.date },
      ratingBreakdownData: { data: breakdownData, date: breakdownDate }
    };
  }, [asin]);

  // Helper to display data source badge
  const SourceBadge = ({ source, date }) => {
    if (source === 'current') return null;
    if (source === 'history') {
      return (
        <span className="badge ms-2 px-2 py-1" style={{ 
          backgroundColor: '#fef3c7', 
          color: '#b45309', 
          fontSize: '10px',
          fontWeight: 500 
        }}>
          <AlertCircle size={10} className="me-1" />
          From {date ? new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : 'history'}
        </span>
      );
    }
    return null;
  };

  const history = useMemo(() => {
    if (!asin) return [];

    let rawHistory = asin.history || asin.weekHistory || [];
    if (rawHistory.length === 0) return [];

    const sorted = [...rawHistory].sort((a, b) => new Date(a.date || a.week) - new Date(b.date || b.week));

    return sorted.filter(h => {
      const itemDate = new Date(h.date || h.week);
      return itemDate >= dateRange.start && itemDate <= dateRange.end;
    });
  }, [asin, dateRange]);

  const chartCategories = history.map(h => {
    if (!h.date && !h.week) return '';
    const d = new Date(h.date || h.week);
    return d.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
  });

  // Common Chart Base Options
  const commonOptions = {
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent'
    },
    xaxis: {
      categories: chartCategories,
      labels: { style: { fontSize: '10px', fontWeight: 500, colors: '#64748b' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    grid: { show: true, borderColor: '#f1f5f9', strokeDashArray: 4 },
    tooltip: { theme: 'light' }
  };

  // Price History Chart Config - Forward fill with last valid price
  const processedPriceHistory = useMemo(() => {
    if (!asin || !history) return [];
    let lastValidPrice = null;
    
    // Find baseline: last valid price before the first filtered date
    if (history.length > 0) {
      const fullHistory = asin.history || asin.weekHistory || [];
      const firstDate = new Date(history[0].date || history[0].week);
      const beforeHistory = fullHistory
        .filter(h => new Date(h.date || h.week) < firstDate)
        .sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
      
      if (beforeHistory.length > 0) {
        for (const h of beforeHistory) {
          const p = h.price || h.currentPrice;
          if (p && p > 0) {
            lastValidPrice = p;
            break;
          }
        }
      }
      
      // If still null, use current data as a coarse fallback only if it's the only data we have
      if (lastValidPrice === null) lastValidPrice = currentData.value;
    }

    return history.map(h => {
      const price = h.price || h.currentPrice;
      if (price && price > 0) {
        lastValidPrice = price;
        return price;
      }
      return lastValidPrice;
    });
  }, [history, asin, currentData]);

  const priceSeries = [{
    name: 'Price (₹)',
    data: processedPriceHistory
  }];

  const priceOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'area', height: 250 },
    dataLabels: {
      enabled: history.length <= 15, // Hide labels if too many points
      formatter: (val) => val ? `₹${Number(val).toLocaleString()}` : '',
      offsetY: -10,
      style: { fontSize: '10px', colors: ['#6366f1'] },
      background: { enabled: true, borderWidth: 0, borderRadius: 4, padding: 4, opacity: 0.9 }
    },
    stroke: { curve: 'smooth', width: 3, colors: ['#6366f1'] },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [20, 100],
        colorStops: [{ offset: 0, color: '#6366f1', opacity: 0.4 }, { offset: 100, color: '#6366f1', opacity: 0 }]
      }
    },
    yaxis: {
      labels: { style: { fontSize: '10px', colors: '#64748b' }, formatter: (val) => val ? `₹${Number(val).toLocaleString()}` : '' }
    },
    markers: { size: 4, strokeWidth: 2, strokeColors: '#fff', colors: ['#6366f1'] }
  };

  // BSR Trend Chart Config - Forward fill with last valid BSR
  const processedBsrHistory = useMemo(() => {
    if (!asin || !history) return [];
    let lastValidBsr = null;
    
    if (history.length > 0) {
      const fullHistory = asin.history || asin.weekHistory || [];
      const firstDate = new Date(history[0].date || history[0].week);
      const beforeHistory = fullHistory
        .filter(h => new Date(h.date || h.week) < firstDate)
        .sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
      
      if (beforeHistory.length > 0) {
        for (const h of beforeHistory) {
          if (h.bsr && h.bsr > 0) {
            lastValidBsr = h.bsr;
            break;
          }
        }
      }
      if (lastValidBsr === null) lastValidBsr = bsrData.value;
    }

    return history.map(h => {
      if (h.bsr && h.bsr > 0) {
        lastValidBsr = h.bsr;
        return h.bsr;
      }
      return lastValidBsr;
    });
  }, [history, asin, bsrData]);

  const bsrSeries = [{
    name: 'Main BSR',
    data: processedBsrHistory
  }];

  const bsrOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'line', height: 250 },
    dataLabels: {
      enabled: history.length <= 15,
      formatter: (val) => val ? `#${Number(val).toLocaleString()}` : '',
      offsetY: -10,
      style: { fontSize: '10px', colors: ['#10b981'] },
      background: { enabled: true, borderWidth: 0, borderRadius: 4, padding: 4, opacity: 0.9 }
    },
    stroke: { curve: 'smooth', width: 3, colors: ['#10b981'] },
    yaxis: {
      reversed: true, // Lower BSR is better
      labels: { style: { fontSize: '10px', colors: '#64748b' }, formatter: (val) => val ? `#${Number(val).toLocaleString()}` : '' }
    },
    markers: { size: 4, strokeWidth: 2, strokeColors: '#fff', colors: ['#10b981'] }
  };

  // Rating History Chart Config - Forward fill with last valid rating and star breakdown
  const { ratingSeries, hasBreakdownHistory } = useMemo(() => {
    if (!asin || !history) return { ratingSeries: [], hasBreakdownHistory: false };
    let lastValidRating = null;
    let lastValidBreakdown = { fiveStar: null, fourStar: null, threeStar: null, twoStar: null, oneStar: null };
    
    const fullHistory = asin.history || asin.weekHistory || [];
    const firstDate = history.length > 0 ? new Date(history[0].date || history[0].week) : null;
    
    // Baselines
    if (firstDate) {
      const beforeHistory = fullHistory
        .filter(h => new Date(h.date || h.week) < firstDate)
        .sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
      
      if (beforeHistory.length > 0) {
        for (const h of beforeHistory) {
          if (lastValidRating === null && h.rating && h.rating > 0) lastValidRating = h.rating;
          if (h.ratingBreakdown) {
            Object.keys(lastValidBreakdown).forEach(key => {
              if (lastValidBreakdown[key] === null && h.ratingBreakdown[key] !== undefined) {
                lastValidBreakdown[key] = h.ratingBreakdown[key];
              }
            });
          }
          if (lastValidRating !== null && Object.values(lastValidBreakdown).every(v => v !== null)) break;
        }
      }
    }
    
    // Fallback baselines from current data
    if (lastValidRating === null) lastValidRating = ratingData.value;
    Object.keys(lastValidBreakdown).forEach(key => {
      if (lastValidBreakdown[key] === null) lastValidBreakdown[key] = ratingBreakdownData.data?.[key] || 0;
    });

    const avgSeries = [];
    const breakdownSeries = {
      fiveStar: [], fourStar: [], threeStar: [], twoStar: [], oneStar: []
    };

    let foundAnyBreakdown = false;

    history.forEach(h => {
      // Average Rating
      if (h.rating && h.rating > 0) lastValidRating = h.rating;
      avgSeries.push(lastValidRating);

      // Star Breakdown
      if (h.ratingBreakdown) {
        foundAnyBreakdown = true;
        Object.keys(breakdownSeries).forEach(key => {
          if (h.ratingBreakdown[key] !== undefined) {
            lastValidBreakdown[key] = h.ratingBreakdown[key];
          }
          breakdownSeries[key].push(lastValidBreakdown[key]);
        });
      } else {
        Object.keys(breakdownSeries).forEach(key => {
          breakdownSeries[key].push(lastValidBreakdown[key]);
        });
      }
    });

    const series = [{
      name: 'Avg Rating',
      type: 'line',
      data: avgSeries
    }];

    if (foundAnyBreakdown) {
      series.push(
        { name: '5★ %', type: 'line', data: breakdownSeries.fiveStar },
        { name: '4★ %', type: 'line', data: breakdownSeries.fourStar },
        { name: '3★ %', type: 'line', data: breakdownSeries.threeStar },
        { name: '2★ %', type: 'line', data: breakdownSeries.twoStar },
        { name: '1★ %', type: 'line', data: breakdownSeries.oneStar }
      );
    }

    return { ratingSeries: series, hasBreakdownHistory: foundAnyBreakdown };
  }, [history, asin, ratingData, ratingBreakdownData]);

  const ratingOptions = {
    ...commonOptions,
    chart: { 
      ...commonOptions.chart, 
      type: 'line', 
      height: 300,
      fontFamily: 'Inter, sans-serif'
    },
    colors: hasBreakdownHistory 
      ? ['#f59e0b', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']
      : ['#f59e0b'],
    stroke: {
      width: hasBreakdownHistory ? [4, 2, 2, 2, 2, 2] : [3],
      curve: 'smooth',
      dashArray: hasBreakdownHistory ? [0, 0, 0, 0, 0, 0] : [0]
    },
    dataLabels: {
      enabled: history.length <= 10,
      formatter: (val, opts) => {
        if (opts.seriesIndex === 0) return val?.toFixed(1);
        return `${val}%`;
      },
      style: { fontSize: '9px', fontWeight: 600 }
    },
    yaxis: hasBreakdownHistory ? [
      {
        seriesName: 'Avg Rating',
        min: 0, max: 5, tickAmount: 5,
        title: { text: 'Rating (0-5)', style: { color: '#f59e0b', fontWeight: 600 } },
        labels: { style: { colors: '#f59e0b', fontWeight: 500 }, formatter: (v) => v?.toFixed(1) }
      },
      {
        opposite: true,
        min: 0, max: 100, tickAmount: 5,
        title: { text: 'Breakdown (%)', style: { color: '#64748b', fontWeight: 600 } },
        labels: { style: { colors: '#64748b', fontWeight: 500 }, formatter: (v) => `${v}%` }
      }
    ] : {
      min: 0, max: 5, tickAmount: 5,
      labels: { style: { fontSize: '10px', colors: '#64748b' }, formatter: (val) => val?.toFixed(1) || '' }
    },
    legend: {
      show: hasBreakdownHistory,
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '11px',
      fontWeight: 500,
      markers: { radius: 12 },
      itemMargin: { horizontal: 10, vertical: 5 }
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (val, opts) => {
          if (opts.seriesIndex === 0) return `${val?.toFixed(2)} ★`;
          return `${val}%`;
        }
      }
    },
    markers: {
      size: hasBreakdownHistory ? [4, 0, 0, 0, 0, 0] : [4],
      strokeWidth: 2,
      strokeColors: '#fff',
      hover: { sizeOffset: 2 }
    }
  };

  if (!isOpen || !asin) return null;

  return createPortal(
    <div
      className={`position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-4 ${isClosing ? 'fade-out' : 'fade-in'}`}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(12px)', zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <style>{`
        .fade-in { animation: fadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        .fade-out { animation: fadeOut 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes fadeOut { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.95) translateY(10px); } }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
        
        .filter-btn { border: 1px solid #e2e8f0; background: #fff; color: #64748b; font-size: 0.75rem; font-weight: 600; padding: 0.5rem 1rem; transition: all 0.2s ease; }
        .filter-btn:hover { background: #f8fafc; color: #1e293b; }
        .filter-btn.active { background: #1e293b; color: #fff; border-color: #1e293b; }
        .filter-btn:first-child { border-top-left-radius: 10px; border-bottom-left-radius: 10px; }
        .filter-btn:last-child { border-top-right-radius: 10px; border-bottom-right-radius: 10px; }
        
        .stat-item { padding: 1rem; border-right: 1px solid #f1f5f9; }
        .stat-item:last-child { border-right: none; }
        .stat-label { color: #64748b; font-size: 0.75rem; font-weight: 500; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.025em; }
        .stat-value { font-weight: 700; color: #1e293b; font-size: 1rem; }
        
        .truncate-lines-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

      <div
        className="bg-white shadow-2xl overflow-hidden"
        style={{
          width: '100%', maxWidth: '1280px', maxHeight: '95vh', borderRadius: '24px', display: 'flex', flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-bottom bg-white d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shadow-sm">
              <Package size={24} />
            </div>
            <div>
              <div className="d-flex align-items-center gap-2">
                <h4 className="mb-0 fw-bold text-slate-900">{asin.asinCode}</h4>
                {(asin.category) && (
                  <div className="d-flex flex-wrap gap-1 align-items-center mt-2" style={{ fontSize: '11px', color: '#64748b' }}>
                    {asin.category.split('›').map((node, i, arr) => (
                      <React.Fragment key={i}>
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }}>{node.trim()}</span>
                        {i < arr.length - 1 && <span>›</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {asin.status && !asin.category && (
                  <span className="badge border rounded-pill px-3 py-2 mt-2"
                    style={{
                      backgroundColor: '#f8f9fa',
                      color: '#374151',
                      fontSize: '12px',
                      fontWeight: '500',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    {asin.status}
                  </span>
                )}
              </div>
              <p className="text-secondary small mb-0 d-flex align-items-center gap-1">
                <Store size={14} /> Sold By: {asin.soldBy || 'Direct Seller'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="btn btn-light rounded-circle p-2 border-0 hover:bg-slate-100 transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-auto bg-slate-50/50" style={{ flex: 1 }}>

          {/* Filters Bar */}
          <div className="d-flex justify-content-between align-items-center mb-5 bg-white p-3 rounded-2xl border shadow-sm">
            <div className="d-flex align-items-center gap-2 text-slate-600 fw-medium">
              <Calendar size={18} className="text-indigo-600" />
              <span>Historical Range</span>
            </div>
            <button
              className="d-flex align-items-center gap-2 px-3 py-1 border rounded-3"
              style={{ backgroundColor: '#f8fafc', borderColor: '#e2e8f0', height: '32px' }}
              onClick={() => setIsPickerOpen(true)}
            >
              <Calendar size={14} className="text-zinc-500" />
              <span className="small fw-semibold text-zinc-700">
                {format(dateRange.start, 'MMM dd, yyyy')} - {format(dateRange.end, 'MMM dd, yyyy')}
              </span>
            </button>
            <AdvancedDateRangePicker
              isOpen={isPickerOpen}
              onClose={() => setIsPickerOpen(false)}
              onApply={(range) => {
                setDateRange({ start: range.startDate, end: range.endDate });
              }}
              initialStartDate={dateRange.start}
              initialEndDate={dateRange.end}
              initialRangeType="last7"
            />
          </div>

          {/* Horizontal Product Details Bar */}
          <div className="bg-white border rounded-3xl p-4 shadow-sm mb-5 d-flex align-items-center gap-4">
            {/* Product Thumbnail */}
            <div
              className="flex-shrink-0"
              style={{ width: '180px', height: '180px', borderRadius: '20px', border: '1px solid #2547ddff', overflow: 'hidden', backgroundColor: '#f8fafc', }}
            >
              {asin.imageUrl ? (
                <img src={asin.imageUrl} alt={asin.asinCode} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <div className="d-flex align-items-center justify-content-center h-100 text-slate-200"><Package size={60} /></div>
              )}
            </div>

            {/* Info and Stats */}
            <div className="flex-grow-1 overflow-hidden">
              <div className="mb-4">
                <h5 className="fw-bold text-slate-800 mb-2 truncate-2-lines" style={{ lineHeight: '1.4' }}>{asin.title}</h5>
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="badge px-3 py-2 rounded-lg font-monospace border"
                    style={{
                      backgroundColor: '#eef2ff',
                      color: '#334155',
                      border: '1px solid #c7d2fe',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      letterSpacing: '0.025em'
                    }}
                  >
                    {asin.asinCode}
                  </span>
                  <a href={`https://www.amazon.in/dp/${asin.asinCode}`} target="_blank" rel="noopener noreferrer" className="btn btn-link p-0 text-slate-400 hover:text-indigo-600"><ExternalLink size={16} /></a>
                </div>
              </div>

               {/* Stats Row */}
               <div className="d-flex bg-slate-50 rounded-2xl border overflow-hidden">
                 <div className="stat-item flex-fill">
                   <div className="stat-label">Price</div>
                   <div className="stat-value text-indigo-600 d-flex align-items-center">
                     ₹{currentData.value?.toLocaleString() || 0}
                     <SourceBadge source={currentData.source} date={currentData.date} />
                   </div>
                 </div>
                 <div className="stat-item flex-fill">
                   <div className="stat-label">MRP</div>
                   <div className="stat-value text-muted">
                     {asin.mrp ? `₹${asin.mrp.toLocaleString()}` : '-'}
                   </div>
                 </div>
                  <div className="stat-item flex-fill">
                    <div className="stat-label">Buy Box</div>
                    <div className="stat-value">
                      <Popover
                        trigger="click"
                        placement="bottom"
                        content={
                          <div style={{ minWidth: '220px' }}>
                            <div className="text-uppercase smallest fw-bold mb-3 pb-2 border-bottom" style={{ color: '#64748b', letterSpacing: '0.05em' }}>
                              Seller Hierarchy
                            </div>
                            <div className="d-flex flex-column gap-2">
                              {(asin.allOffers && asin.allOffers.length > 0 ? asin.allOffers : [
                                { seller: asin.soldBy, price: currentData.value, isBuyBoxWinner: true },
                                { seller: asin.soldBySec, price: asin.secondAsp, isBuyBoxWinner: false }
                              ].filter(o => o.seller || o.price > 0)).map((offer, idx) => (
                                <div key={idx} className="p-2 rounded-xl d-flex justify-content-between align-items-center hover:bg-slate-50" style={{ transition: 'background 0.2s' }}>
                                  <div className="d-flex flex-column">
                                    <span className="fw-bold small text-slate-800 d-flex align-items-center">
                                      {offer.seller || 'Unknown'}
                                      {offer.isBuyBoxWinner && <Trophy size={11} className="ms-1 text-amber-500" />}
                                    </span>
                                    <span className="smallest text-slate-400">{offer.isBuyBoxWinner ? 'Buy Box Winner' : 'Secondary Offer'}</span>
                                  </div>
                                  <span className="fw-bold text-indigo-600">₹{offer.price?.toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        }
                      >
                        <div className="d-flex align-items-center cursor-pointer">
                          <Store size={16} className="text-slate-400 me-2" />
                          <span className="truncate" style={{ maxWidth: '120px' }}>{asin.soldBy || 'Amazon.in'}</span>
                          {asin.allOffers && asin.allOffers.length > 1 && (
                            <span className="badge bg-slate-100 text-slate-500 ms-2" style={{ fontSize: '10px' }}>+{asin.allOffers.length - 1}</span>
                          )}
                        </div>
                      </Popover>
                    </div>
                  </div>
                 <div className="stat-item flex-fill">
                   <div className="stat-label">Main BSR</div>
                   <div className="stat-value text-emerald-600 d-flex align-items-center">
                     #{bsrData.value?.toLocaleString() || '-'}
                     <SourceBadge source={bsrData.source} date={bsrData.date} />
                  </div>
                </div>
                <div className="stat-item flex-fill">
                  <div className="stat-label">Rating</div>
                  <div className="stat-value d-flex align-items-center">
                    <Star size={16} className="text-amber-400 fill-amber-400 me-1" />
                    {ratingData.value?.toFixed(1) || 0}
                    <SourceBadge source={ratingData.source} date={ratingData.date} />
                  </div>
                </div>
                <div className="stat-item flex-fill"><div className="stat-label">Reviews</div><div className="stat-value">{asin.reviewCount?.toLocaleString() || 0}</div></div>
              </div>
            </div>
          </div>

          {/* LQS Detailed Analysis Row */}
          <div className="mb-5">
            <div className="d-flex align-items-center justify-content-between mb-4">
              <div className="d-flex align-items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm"><Activity size={20} /></div>
                <div>
                  <h5 className="mb-0 fw-bold text-slate-900">LISTING QUALITY SCORE (LQS)</h5>
                  <p className="small text-muted mb-0">Deep analysis based on Amazon's listing requirements</p>
                </div>
              </div>
              <div className="d-flex align-items-center gap-4 bg-white px-4 py-2 border rounded-2xl shadow-sm">
                 <div className="text-center">
                   <div className="smallest fw-bold text-slate-400 text-uppercase tracking-wider">Overall LQS</div>
                   <div className="h4 mb-0 fw-bold" style={{ color: (asin.lqs || 0) > 80 ? '#059669' : (asin.lqs || 0) > 60 ? '#d97706' : '#dc2626' }}>
                     {asin.lqs || 0}%
                   </div>
                 </div>
                 <div className="vr" style={{ height: '30px' }} />
                 <div className="text-center">
                   <div className="smallest fw-bold text-slate-400 text-uppercase tracking-wider">Status</div>
                   <div className="badge rounded-pill px-3" style={{ 
                     backgroundColor: (asin.lqs || 0) > 80 ? '#ecfdf5' : (asin.lqs || 0) > 60 ? '#fffbeb' : '#fef2f2',
                     color: (asin.lqs || 0) > 80 ? '#059669' : (asin.lqs || 0) > 60 ? '#d97706' : '#dc2626',
                     fontWeight: 700,
                     fontSize: '11px'
                   }}>
                     {(asin.lqs || 0) > 80 ? 'EXCELLENT' : (asin.lqs || 0) > 60 ? 'GOOD' : 'CRITICAL'}
                   </div>
                 </div>
              </div>
            </div>
            
            <div className="row g-4">
              <div className="col-md-3">
                <ScoreCard 
                  title="Product Title" 
                  score={asin.titleScore} 
                  grade={asin.titleGrade} 
                  issues={asin.titleIssues} 
                  recommendations={asin.titleRecommendations}
                  color="#4f46e5"
                />
              </div>
              <div className="col-md-3">
                <ScoreCard 
                  title="Bullet Points" 
                  score={asin.bulletScore} 
                  grade={asin.bulletGrade} 
                  issues={asin.bulletIssues} 
                  recommendations={asin.bulletRecommendations}
                  color="#8b5cf6"
                />
              </div>
              <div className="col-md-3">
                <ScoreCard 
                  title="Images & Video" 
                  score={asin.imageScore} 
                  grade={asin.imageGrade} 
                  issues={asin.imageIssues} 
                  recommendations={asin.imageRecommendations}
                  color="#ec4899"
                />
              </div>
              <div className="col-md-3">
                <ScoreCard 
                  title="Description / A+" 
                  score={asin.descriptionScore} 
                  grade={asin.descriptionGrade} 
                  issues={asin.descriptionIssues} 
                  recommendations={asin.descriptionRecommendations}
                  color="#06b6d4"
                />
              </div>
            </div>
          </div>

          {/* Visualizations Stack (Full Width) */}
          <div className="d-flex flex-column gap-5">
            {/* Bullet Points Cards - Always show if there's data */}
            <div className="bg-white border p-4 rounded-3xl shadow-sm">
                <div className="d-flex align-items-center gap-2 mb-3">
                    <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
                        <ListChecks size={20} />
                    </div>
                    <h6 className="mb-0 fw-bold text-slate-800">
                        PRODUCT FEATURES ({asin.bulletPoints || asin.bulletPointsText?.length || 0})
                    </h6>
                </div>
                {(() => {
                    // Determine best source for bullet points
                    const bullets = (() => {
                        // If bulletPointsText is an array with strings
                        if (Array.isArray(asin.bulletPointsText) && asin.bulletPointsText.length > 0) {
                            return asin.bulletPointsText.filter(b => typeof b === 'string' && b.trim().length > 0);
                        }
                        // If bulletPointsText is a string (HTML or single text)
                        if (typeof asin.bulletPointsText === 'string' && asin.bulletPointsText.length > 10) {
                            // Try to parse as JSON first
                            try {
                                const parsed = JSON.parse(asin.bulletPointsText);
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                    return parsed.filter(b => typeof b === 'string' && b.trim().length > 0);
                                }
                            } catch (e) {}
                            
                            // Check if it's HTML
                            if (asin.bulletPointsText.includes('<li') || asin.bulletPointsText.includes('<span')) {
                                // Extract text from HTML
                                const tempDiv = document.createElement('div');
                                tempDiv.innerHTML = asin.bulletPointsText;
                                const items = Array.from(tempDiv.querySelectorAll('li, .a-list-item'))
                                    .map(el => el.textContent.trim())
                                    .filter(t => t.length > 3);
                                if (items.length > 0) return items;
                            }
                            
                            // Return as single item
                            return [asin.bulletPointsText.replace(/<[^>]+>/g, '').trim()];
                        }
                        // Fallback: check legacy fields
                        if (asin.bulletPointsList && Array.isArray(asin.bulletPointsList)) {
                            return asin.bulletPointsList;
                        }
                        if (asin.bullets && Array.isArray(asin.bullets)) {
                            return asin.bullets;
                        }
                        return [];
                    })();

                    if (bullets.length > 0) {
                        return (
                            <div className="row g-3">
                                {bullets.map((bullet, idx) => (
                                    <div key={idx} className="col-md-6">
                                        <div
                                            className="d-flex gap-3 p-3 bg-slate-50 rounded-xl border-start border-4 border-indigo-400 hover:border-indigo-600 transition-all"
                                            style={{ fontSize: '0.85rem', minHeight: '50px' }}
                                        >
                                            <div 
                                                className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle"
                                                style={{ 
                                                    width: '26px', 
                                                    height: '26px', 
                                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)', 
                                                    color: '#fff', 
                                                    fontSize: '11px', 
                                                    fontWeight: 700 
                                                }}
                                            >
                                                {idx + 1}
                                            </div>
                                            <div className="text-slate-700" style={{ lineHeight: '1.5', fontSize: '0.85rem' }}>
                                                {bullet}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    }

                    // Fallback for raw HTML string
                    if (typeof asin.bullet_points === 'string' && asin.bullet_points.length > 20) {
                        return (
                            <div 
                                className="p-4 bg-slate-50 rounded-2xl border leading-relaxed text-slate-700" 
                                style={{ fontSize: '0.9rem' }}
                                dangerouslySetInnerHTML={{ __html: asin.bullet_points }} 
                            />
                        );
                    }

                    return (
                        <div className="p-5 bg-slate-50 rounded-2xl border border-dashed text-center">
                            <ListChecks size={32} className="text-slate-300 mb-2" />
                            <p className="text-muted small mb-0">No bullet points discovered for this listing yet.</p>
                            <p className="text-muted smallest mt-1">Scrape the ASIN to extract product features.</p>
                        </div>
                    );
                })()}
            </div>

            {/* Rating Breakdown - Uses fallback from history if current missing */}
            <div className="bg-white border p-4 rounded-3xl shadow-sm">
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Star size={20} /></div>
                <h6 className="mb-0 fw-bold text-slate-800">RATING BREAKDOWN</h6>
                {ratingBreakdownData.date && (
                  <SourceBadge source="history" date={ratingBreakdownData.date} />
                )}
              </div>
              <div className="row g-3">
                {[
                  { stars: 5, key: 'fiveStar', color: '#22c55e' },
                  { stars: 4, key: 'fourStar', color: '#84cc16' },
                  { stars: 3, key: 'threeStar', color: '#eab308' },
                  { stars: 2, key: 'twoStar', color: '#f97316' },
                  { stars: 1, key: 'oneStar', color: '#ef4444' }
                ].map(({ stars, key, color }) => {
                  const percentage = ratingBreakdownData.data?.[key] || asin.ratingBreakdown?.[key] || 0;
                  return (
                    <div key={stars} className="col-md-6 col-lg-4">
                      <div className="d-flex align-items-center gap-2">
                        <span className="fw-bold text-slate-700" style={{ minWidth: '30px' }}>{stars}★</span>
                        <div className="flex-grow-1">
                          <div className="progress rounded-pill" style={{ height: '12px', backgroundColor: '#e2e8f0' }}>
                            <div
                              className="progress-bar rounded-pill"
                              style={{ width: `${percentage}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                        <div className="d-flex flex-column align-items-end" style={{ minWidth: '65px' }}>
                          <span className="text-slate-600 fw-bold" style={{ fontSize: '0.85rem' }}>{percentage}%</span>
                          <span className="text-slate-400" style={{ fontSize: '0.7rem' }}>
                            ({Math.round((percentage / 100) * (asin.reviewCount || 0)).toLocaleString()})
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Price History Chart */}
            <div className="bg-white border rounded-4 p-4 shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <IndianRupee size={18} className="text-emerald-600" />
                  </div>
                  <h6 className="mb-0 fw-semibold" style={{ color: '#1e293b', fontSize: '0.938rem' }}>
                    PRICE HISTORY
                  </h6>
                </div>
                <span className="small" style={{ color: '#64748b', fontWeight: 500 }}>
                  Snapshot Count: {history.length}
                </span>
              </div>
              <div style={{ minHeight: '280px' }}>
                <Chart options={priceOptions} series={priceSeries} type="line" height={280} />
              </div>
            </div>
            {/* BSR Trend Chart */}
            <div className="bg-white border rounded-4 p-4 shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <BarChart3 size={18} className="text-emerald-600" />
                  </div>
                  <h6 className="mb-0 fw-semibold text-slate-800">BEST SELLERS RANK TREND</h6>
                </div>
                <div className="d-flex align-items-center gap-1 text-slate-500 small fw-medium">
                  <Eye size={14} />
                  <span>Interactive View</span>
                </div>
              </div>
              <div style={{ minHeight: '280px' }}>
                <Chart options={bsrOptions} series={bsrSeries} type="line" height={280} />
              </div>
            </div>

            {/* Rating History Chart */}
            <div className="bg-white border rounded-4 p-4 shadow-sm">
              <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <Star size={18} className="text-amber-600" />
                  </div>
                  <h6 className="mb-0 fw-semibold text-slate-800">RATING PROGRESSION</h6>
                </div>
                <span className="text-slate-500 small fw-medium">Scale (0 - 5)</span>
              </div>
              <div style={{ minHeight: '280px' }}>
                <Chart options={ratingOptions} series={ratingSeries} type="line" height={280} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-white border-top d-flex justify-content-end">
          <button onClick={handleClose} className="btn btn-dark fw-bold px-5 py-2 rounded-xl transition-all hover:scale-105" style={{ borderRadius: '12px' }}>CLOSE</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AsinDetailModal;