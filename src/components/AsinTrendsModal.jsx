import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Chart from 'react-apexcharts';
import { X, TrendingUp, TrendingDown, IndianRupee, Star, Award, Activity, BarChart3, Clock, LayoutGrid, PlayCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Skeleton, Box } from '@mui/material';

const AsinTrendsModal = ({ asin, isOpen, onClose }) => {
  const [dateFilter, setDateFilter] = useState('30days');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Set loading state when processing data or changing asin
  useEffect(() => {
    if (isOpen && asin) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, asin?.asinCode]);

  if (!isOpen || !asin) return null;

  const history = asin.history || asin.weekHistory || [];

  const getCategoryLabel = (h) => {
    if (h.date) {
      return new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }
    return h.week || '';
  };

  // Generate complete date range for consistent x-axis
  const dateRange = useMemo(() => {
    if (!history || history.length === 0) return [];
    
    const dates = history.map(h => h.date || h.week).filter(Boolean).map(d => new Date(d));
    if (dates.length === 0) return [];

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(); // Go up to today for better perspective

    const range = [];
    let curr = new Date(minDate);
    while (curr <= maxDate) {
      range.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
    return range;
  }, [history]);

  // Filter based on dateFilter
  const filteredDateRange = useMemo(() => {
    if (dateFilter === 'all') return dateRange;
    const now = new Date();
    const days = dateFilter === '7days' ? 7 : dateFilter === '14days' ? 14 : dateFilter === '30days' ? 30 : 90;
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return dateRange.filter(d => d >= cutoff);
  }, [dateRange, dateFilter]);

  const historyMap = useMemo(() => {
    const map = new Map();
    history.forEach(h => {
      const d = h.date || h.week;
      if (d) map.set(new Date(d).toISOString().split('T')[0], h);
    });
    return map;
  }, [history]);

  // Chart Series Generation with Forward-Filling for Price/Rating
  const generateSeriesData = (metricKey, shouldForwardFill = true) => {
    let lastKnownValue = null;
    return filteredDateRange.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const data = historyMap.get(dateStr);
      const val = data ? data[metricKey] : null;
      
      if (val !== null && val !== undefined) {
        lastKnownValue = val;
        return val;
      }
      return shouldForwardFill ? lastKnownValue : null;
    });
  };

  const chartOptions = (color, type = 'area') => ({
    chart: {
      toolbar: { show: false },
      zoom: { enabled: false },
      sparkline: { enabled: false },
      fontFamily: 'Inter, sans-serif',
      animations: { enabled: true, easing: 'easeinout', speed: 800 }
    },
    colors: [color],
    stroke: { curve: 'smooth', width: 3, lineCap: 'round' },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: type === 'area' ? 0.6 : 0,
        opacityTo: 0.05,
        stops: [0, 90, 100]
      }
    },
    xaxis: {
      categories: filteredDateRange.map(d => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      labels: { 
        show: true, 
        style: { fontSize: '10px', fontWeight: 600, colors: '#64748b' },
        offsetY: 0
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false }
    },
    yaxis: {
      labels: { 
        style: { fontSize: '10px', fontWeight: 700, colors: '#475569' },
        formatter: (val) => val?.toLocaleString()
      }
    },
    markers: { 
      size: 4, 
      colors: ['#fff'], 
      strokeColors: color, 
      strokeWidth: 2,
      hover: { size: 6, strokeWidth: 3 } 
    },
    grid: { 
      borderColor: '#f1f5f9', 
      strokeDashArray: 3, 
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
      padding: { top: 10, bottom: 10, left: 20, right: 20 } 
    },
    tooltip: {
      theme: 'dark',
      custom: ({ series, seriesIndex, dataPointIndex, w }) => {
        const val = series[seriesIndex][dataPointIndex];
        const date = w.globals.categoryLabels[dataPointIndex];
        return `
          <div class="px-3 py-2 bg-slate-900 border-0 rounded-3 shadow-xl">
            <div class="extra-small text-slate-400 fw-bold mb-1">${date}</div>
            <div class="d-flex align-items-center gap-2">
              <div class="w-2 h-2 rounded-circle" style="background: ${color}"></div>
              <div class="fw-bold text-white small">${val?.toLocaleString() || 'N/A'}</div>
            </div>
          </div>
        `;
      }
    }
  });

  const SkeletonTrend = () => (
    <div className="bg-white rounded-4 shadow-sm border p-4 mb-4 trend-fade-in" style={{ width: '100%', maxWidth: '1000px' }}>
       <div className="d-flex justify-content-between mb-4">
          <div className="d-flex gap-3 align-items-center">
             <Skeleton variant="circular" width={40} height={40} />
             <div>
                <Skeleton width={120} height={20} />
                <Skeleton width={80} height={14} />
             </div>
          </div>
          <div className="d-flex gap-2">
             <Skeleton width={40} height={30} />
             <Skeleton width={40} height={30} />
             <Skeleton width={40} height={30} />
          </div>
       </div>
       <div className="row g-3 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="col-md-4">
               <Skeleton variant="rounded" height={100} className="w-100" />
            </div>
          ))}
       </div>
       <Skeleton variant="rectangular" height={300} className="w-100 rounded-3" />
    </div>
  );

  return createPortal(
    <div 
      className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        .trend-fade-in { animation: trendFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes trendFadeIn { from { opacity: 0; transform: scale(0.98) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .chart-container:hover { border-color: #e2e8f0 !important; }
        .btn-period { border: 1px solid transparent; transition: all 0.2s; }
        .btn-period.active { background: #0f172a; color: white; border-color: #0f172a; }
        .btn-period:not(.active):hover { background: #f8fafc; border-color: #e2e8f0; }
      `}</style>

      {isLoading ? <SkeletonTrend /> : (
        <div 
          className="bg-white rounded-4 shadow-2xl overflow-hidden trend-fade-in"
          style={{ width: '100%', maxWidth: '1000px', maxHeight: '95vh', display: 'flex', flexDirection: 'column' }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center bg-white shadow-sm" style={{ zIndex: 10 }}>
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-3 shadow-md">
                <BarChart3 size={20} />
              </div>
              <div>
                <h6 className="mb-0 fw-bold text-slate-900">Historical Trend DNA</h6>
                <div className="d-flex align-items-center gap-2">
                   <span className="font-monospace extra-small text-indigo-600 fw-bold">{asin.asinCode}</span>
                   <span className="text-slate-300">•</span>
                   <span className="text-slate-500 extra-small text-truncate" style={{ maxWidth: '200px' }}>{asin.title}</span>
                </div>
              </div>
            </div>
            
            <div className="d-flex align-items-center gap-3">
               <div className="d-flex p-1 bg-slate-100 rounded-2 gap-1">
                  {['7days', '30days', '90days', 'all'].map(p => (
                    <button 
                      key={p} 
                      onClick={() => setDateFilter(p)}
                      className={`btn-period px-3 py-1 rounded-1 extra-small fw-bold ${dateFilter === p ? 'active' : 'text-slate-500'}`}
                    >
                      {p.toUpperCase()}
                    </button>
                  ))}
               </div>
               <button onClick={onClose} className="btn btn-ghost-slate p-1.5 rounded-circle">
                 <X size={20} className="text-slate-400" />
               </button>
            </div>
          </div>

          {/* Flowable Content */}
          <div className="flex-grow-1 overflow-auto p-4 bg-slate-50/30">
             {/* Key Info Cards */}
             <div className="row g-3 mb-4">
                <div className="col-md-4">
                   <div className="bg-white border rounded-3 p-3 shadow-sm chart-container transition-all">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                         <div className="p-2 bg-blue-50 text-blue-600 rounded-2"><IndianRupee size={16} /></div>
                         <div className="text-end">
                            <div className="extra-small text-slate-400 fw-bold uppercase">Price Position</div>
                            <div className="h5 mb-0 fw-bold text-slate-800">₹{asin.currentPrice?.toLocaleString()}</div>
                         </div>
                      </div>
                      <div className="d-flex align-items-center gap-1 mt-2">
                         <TrendingUp size={12} className="text-emerald-500" />
                         <span className="extra-small text-slate-500 fw-medium">Last 30d stable</span>
                      </div>
                   </div>
                </div>
                <div className="col-md-4">
                   <div className="bg-white border rounded-3 p-3 shadow-sm chart-container transition-all">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                         <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2"><Award size={16} /></div>
                         <div className="text-end">
                            <div className="extra-small text-slate-400 fw-bold uppercase">Category Rank</div>
                            <div className="h5 mb-0 fw-bold text-slate-800">#{asin.bsr?.toLocaleString() || 'N/A'}</div>
                         </div>
                      </div>
                      <div className="d-flex align-items-center gap-1 mt-2">
                         <TrendingDown size={12} className="text-emerald-500" />
                         <span className="extra-small text-slate-500 fw-medium">Climbing in Category</span>
                      </div>
                   </div>
                </div>
                <div className="col-md-4">
                   <div className="bg-white border rounded-3 p-3 shadow-sm chart-container transition-all">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                         <div className="p-2 bg-amber-50 text-amber-600 rounded-2"><Star size={16} fill="currentColor" /></div>
                         <div className="text-end">
                            <div className="extra-small text-slate-400 fw-bold uppercase">Public Sentiment</div>
                            <div className="h5 mb-0 fw-bold text-slate-800">{asin.rating?.toFixed(1) || 'N/A'} ★</div>
                         </div>
                      </div>
                      <div className="d-flex align-items-center gap-1 mt-2">
                         <span className="extra-small text-slate-500 fw-bold">{asin.reviewCount?.toLocaleString() || 0} REVIEWS</span>
                      </div>
                   </div>
                </div>
             </div>

             {/* Dynamic Multi-Axis DNA Chart */}
             <div className="bg-white border rounded-4 p-4 shadow-sm mb-4">
                <div className="d-flex align-items-center justify-content-between mb-4">
                   <h6 className="mb-0 fw-bold text-slate-800 d-flex align-items-center gap-2">
                      <Activity size={16} className="text-indigo-600" />
                      Composite Trend Visualization
                   </h6>
                   <div className="extra-small text-slate-400 d-flex gap-3">
                      <span className="d-flex align-items-center gap-1"><span className="w-2 h-2 rounded-circle bg-blue-600 d-inline-block"></span> Price</span>
                      <span className="d-flex align-items-center gap-1"><span className="w-2 h-2 rounded-circle bg-emerald-600 d-inline-block"></span> BSR</span>
                      <span className="d-flex align-items-center gap-1"><span className="w-2 h-2 rounded-circle bg-amber-500 d-inline-block"></span> Rating</span>
                   </div>
                </div>
                
                <div className="mb-5">
                   <Chart 
                      options={chartOptions('#2563eb', 'area')} 
                      series={[{ name: 'Price', data: generateSeriesData('price', true) }]} 
                      type="area" 
                      height={200} 
                   />
                </div>
                
                <div className="mb-5">
                   <Chart 
                      options={{
                        ...chartOptions('#10b981', 'line'),
                        yaxis: { 
                          reversed: true,
                          labels: { 
                            style: { fontSize: '10px', fontWeight: 700, colors: '#10b981' },
                            formatter: (val) => `#${val?.toLocaleString()}`
                          }
                        }
                      }} 
                      series={[{ name: 'BSR Rank', data: generateSeriesData('bsr', false) }]} 
                      type="line" 
                      height={200} 
                   />
                </div>

                <div>
                   <Chart 
                      options={chartOptions('#f59e0b', 'area')} 
                      series={[{ name: 'Rating', data: generateSeriesData('rating', true) }]} 
                      type="area" 
                      height={180} 
                   />
                </div>

                <div className="mt-5 row g-4">
                   <div className="col-md-6">
                      <h6 className="mb-3 fw-bold text-slate-800 d-flex align-items-center gap-2">
                         <LayoutGrid size={16} className="text-violet-600" />
                         Image History
                      </h6>
                      <div className="bg-slate-50 p-2 rounded-3">
                         <Chart 
                            options={chartOptions('#8b5cf6', 'line')} 
                            series={[{ name: 'Images', data: generateSeriesData('imageCount', true) }]} 
                            type="line" 
                            height={150} 
                         />
                      </div>
                   </div>
                   <div className="col-md-6">
                      <h6 className="mb-3 fw-bold text-slate-800 d-flex align-items-center gap-2">
                         <PlayCircle size={16} className="text-rose-600" />
                         Video History
                      </h6>
                      <div className="bg-slate-50 p-2 rounded-3">
                         <Chart 
                            options={chartOptions('#e11d48', 'line')} 
                            series={[{ name: 'Videos', data: generateSeriesData('videoCount', true) }]} 
                            type="line" 
                            height={150} 
                         />
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-slate-900 text-white d-flex justify-content-between align-items-center">
             <div className="d-flex align-items-center gap-4">
                <div className="d-flex align-items-center gap-2">
                   <Clock size={14} className="text-slate-400" />
                   <span className="extra-small fw-bold text-slate-400 uppercase tracking-tighter">Last Sync: {asin.lastScraped ? new Date(asin.lastScraped).toLocaleString() : 'Just now'}</span>
                </div>
             </div>
             <button onClick={onClose} className="btn btn-white btn-sm px-4 fw-bold rounded-2">
                DISMISS
             </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

export default AsinTrendsModal;