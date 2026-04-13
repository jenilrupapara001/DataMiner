import React, { useState, useEffect, useMemo } from 'react';
import { X, Package, IndianRupee, Star, Award, Store, Activity, BarChart3, TrendingUp, TrendingDown, Eye, ExternalLink, Calendar, ListChecks, Image } from 'lucide-react';
import { createPortal } from 'react-dom';
import Chart from 'react-apexcharts';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';
import AdvancedDateRangePicker from '../contexts/DateRangeContext';

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

  // Price History Chart Config
  const priceSeries = [{
    name: 'Price (₹)',
    data: history.map(h => h.price || h.currentPrice)
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

  // BSR Trend Chart Config
  const bsrSeries = [{
    name: 'Main BSR',
    data: history.map(h => h.bsr)
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

  // Rating History Chart Config
  const ratingSeries = [{
    name: 'Rating',
    data: history.map(h => h.rating)
  }];

  const ratingOptions = {
    ...commonOptions,
    chart: { ...commonOptions.chart, type: 'line', height: 250 },
    dataLabels: {
      enabled: history.length <= 15,
      formatter: (val) => val ? `${Number(val).toFixed(1)}` : '',
      offsetY: -10,
      style: { fontSize: '10px', colors: ['#f59e0b'] },
      background: { enabled: true, borderWidth: 0, borderRadius: 4, padding: 4, opacity: 0.9 }
    },
    stroke: { curve: 'straight', width: 3, colors: ['#f59e0b'] },
    yaxis: {
      min: 0, max: 5, tickAmount: 5,
      labels: { style: { fontSize: '10px', colors: '#64748b' }, formatter: (val) => val?.toFixed(1) || '' }
    },
    markers: { size: 4, strokeWidth: 2, strokeColors: '#fff', colors: ['#f59e0b'] },
    colors: ['#f59e0b']
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
                {(asin.category || asin.status) && (
                  <span className="badge border rounded-pill px-3 py-2"
                    style={{
                      backgroundColor: '#f8f9fa',
                      color: '#374151',
                      fontSize: '12px',
                      fontWeight: '500',
                      border: '1px solid #e5e7eb'
                    }}
                  >
                    {asin.category || asin.status}
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
                <div className="stat-item flex-fill"><div className="stat-label">Price</div><div className="stat-value text-indigo-600">₹{asin.currentPrice?.toLocaleString() || 0}</div></div>
                <div className="stat-item flex-fill"><div className="stat-label">Buy Box</div><div className="stat-value"><Store size={16} className="text-slate-400 me-2" /><span className="truncate">{asin.soldBy || 'Amazon.in'}</span></div></div>
                <div className="stat-item flex-fill"><div className="stat-label">Main BSR</div><div className="stat-value text-emerald-600">#{asin.bsr?.toLocaleString() || '-'}</div></div>
                <div className="stat-item flex-fill"><div className="stat-label">Rating</div><div className="stat-value"><Star size={16} className="text-amber-400 fill-amber-400 me-1" />{asin.rating || 0}</div></div>
                <div className="stat-item flex-fill"><div className="stat-label">Reviews</div><div className="stat-value">{asin.reviewCount?.toLocaleString() || 0}</div></div>
              </div>
            </div>
          </div>

          {/* Visualizations Stack (Full Width) */}
          <div className="d-flex flex-column gap-5">
            {/* Bullet Points Cards - Always show if there's data */}
            <div className="bg-white border p-4 rounded-3xl shadow-sm">
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="p-2 bg-violet-50 text-violet-600 rounded-lg"><ListChecks size={20} /></div>
                <h6 className="mb-0 fw-bold text-slate-800">PRODUCT FEATURES ({asin.bulletPoints || asin.bulletPointsText?.length || 0})</h6>
              </div>
              {(() => {
                // Determine the best source for bullet points
                const bullets = asin.bulletPointsText || asin.bulletPointsList || asin.bullets || [];
                
                if (bullets.length > 0) {
                  return (
                    <div className="d-flex flex-column gap-3">
                      {bullets.map((bullet, idx) => (
                        <div
                          key={idx}
                          className="d-flex gap-3 p-3 bg-slate-50 rounded-2xl border-start border-4 border-indigo-200"
                          style={{ fontSize: '0.9rem', backgroundColor: '#f8fafc' }}
                        >
                          <div className="d-flex align-items-center justify-content-center flex-shrink-0" 
                               style={{ width: 24, height: 24, borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: '10px', fontWeight: 700 }}>
                            {idx + 1}
                          </div>
                          <div className="text-slate-700 leading-relaxed" style={{ lineHeight: '1.6' }}>{bullet}</div>
                        </div>
                      ))}
                    </div>
                  );
                }
                
                // Fallback for raw bullet_points HTML or single string
                if (asin.bullet_points && typeof asin.bullet_points === 'string') {
                  return (
                    <div className="p-3 bg-slate-50 rounded-2xl border Leading-relaxed text-slate-700" style={{ fontSize: '0.9rem' }}>
                      <div dangerouslySetInnerHTML={{ __html: asin.bullet_points }} />
                    </div>
                  );
                }

                return (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-dashed text-center">
                    <p className="text-muted small mb-0">No bullet points discovered for this listing yet.</p>
                  </div>
                );
              })()}
            </div>

            {/* Rating Breakdown - Always show */}
            <div className="bg-white border p-4 rounded-3xl shadow-sm">
              <div className="d-flex align-items-center gap-2 mb-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Star size={20} /></div>
                <h6 className="mb-0 fw-bold text-slate-800">RATING BREAKDOWN</h6>
              </div>
              <div className="row g-3">
                {[
                  { stars: 5, key: 'fiveStar', color: '#22c55e' },
                  { stars: 4, key: 'fourStar', color: '#84cc16' },
                  { stars: 3, key: 'threeStar', color: '#eab308' },
                  { stars: 2, key: 'twoStar', color: '#f97316' },
                  { stars: 1, key: 'oneStar', color: '#ef4444' }
                ].map(({ stars, key, color }) => {
                  const percentage = asin.ratingBreakdown?.[key] || 0;
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
                        <span className="text-slate-600 fw-medium" style={{ minWidth: '45px', textAlign: 'right' }}>{percentage}%</span>
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