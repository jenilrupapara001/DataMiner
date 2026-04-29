import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, TrendingUp, TrendingDown, IndianRupee,
  Search, Download, Activity, Clock,
  ArrowUp, ArrowDown, Minus, Maximize2, Minimize2,
  ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const PriceViewModal = ({ isOpen, onClose, asins = [], selectedAsin = null }) => {
  // ===== STATE =====
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('price');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [timeRange, setTimeRange] = useState('2W');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const loaderRef = useRef(null);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, sortBy, sortOrder, timeRange]);

  // ===== COMPUTED DATA =====
  const priceData = useMemo(() => {
    if (!asins || asins.length === 0) return [];

    const now = new Date();
    const timeRanges = {
      'TW': 7, '2W': 14, '1M': 30, '3M': 90, 'ALL': 365
    };
    const days = timeRanges[timeRange] || 14;
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return asins.map(asin => {
      const currentPrice = asin.currentPrice || asin.uploadedPrice || 0;
      const mrp = asin.mrp || 0;
      const uploadedPrice = asin.uploadedPrice || 0;
      
      // Calculate current week vs last week comparison
      const history = asin.history || asin.weekHistory || [];
      const sortedHistory = [...history].sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
      
      // Current Week (last 7 days)
      const currentWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      let currentWeekPrice = null;
      for (const h of sortedHistory) {
        const hDate = new Date(h.date || h.week);
        if (hDate >= currentWeekStart && h.price > 0) {
          currentWeekPrice = h.price;
          break;
        }
      }
      currentWeekPrice = currentWeekPrice || currentPrice;

      // Last Week (7-14 days ago)
      const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      let lastWeekPrice = null;
      for (const h of sortedHistory) {
        const hDate = new Date(h.date || h.week);
        if (hDate >= lastWeekStart && hDate < currentWeekStart && h.price > 0) {
          lastWeekPrice = h.price;
          break;
        }
      }
      
      // If no last week price, use the oldest available before current week
      if (!lastWeekPrice) {
        for (const h of sortedHistory) {
          const hDate = new Date(h.date || h.week);
          if (hDate < currentWeekStart && h.price > 0) {
            lastWeekPrice = h.price;
            break;
          }
        }
      }
      lastWeekPrice = lastWeekPrice || currentWeekPrice;

      // Calculate week-over-week change
      const wowChange = currentWeekPrice - lastWeekPrice;
      const wowChangePercent = lastWeekPrice > 0 ? ((wowChange / lastWeekPrice) * 100) : 0;

      // Find old price for the selected time range
      let oldPrice = null;
      for (const h of sortedHistory) {
        const hDate = new Date(h.date || h.week);
        if (hDate <= cutoffDate && h.price > 0) {
          oldPrice = h.price;
          break;
        }
      }
      if (!oldPrice && sortedHistory.length > 0) {
        oldPrice = sortedHistory[sortedHistory.length - 1].price || currentPrice;
      }
      const previousPrice = oldPrice || currentPrice;
      const periodChange = currentPrice - previousPrice;
      const periodChangePercent = previousPrice > 0 ? ((periodChange / previousPrice) * 100) : 0;

      // Discount
      const discountPercent = mrp > 0 ? Math.round(((mrp - currentPrice) / mrp) * 100) : 0;

      return {
        ...asin,
        asinCode: asin.asinCode || '',
        sku: asin.sku || '',
        title: asin.title || '',
        uploadedPrice,
        currentPrice,
        mrp,
        discountPercent,
        previousPrice,
        periodChange,
        periodChangePercent,
        currentWeekPrice,
        lastWeekPrice,
        wowChange,
        wowChangePercent,
        trend: periodChange > 0 ? 'up' : periodChange < 0 ? 'down' : 'stable',
        wowTrend: wowChange > 0 ? 'up' : wowChange < 0 ? 'down' : 'stable',
        history: sortedHistory
      };
    });
  }, [asins, timeRange]);

  // Computed dates for history columns
  const historyDates = useMemo(() => {
    const dates = new Set();
    priceData.forEach(item => {
      (item.history || []).forEach(h => {
        if (h.date) dates.add(h.date);
      });
    });
    // Sort descending (newest first) and take last 7 unique days found
    return Array.from(dates).sort((a, b) => new Date(b) - new Date(a)).slice(0, 7);
  }, [priceData]);

  // Filter and sort
  const filteredData = useMemo(() => {
    let data = [...priceData];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(d => 
        (d.asinCode || '').toLowerCase().includes(q) ||
        (d.sku || '').toLowerCase().includes(q) ||
        (d.title || '').toLowerCase().includes(q)
      );
    }

    if (filterStatus === 'active') data = data.filter(d => d.currentPrice > 0);
    else if (filterStatus === 'zero') data = data.filter(d => d.currentPrice === 0);
    else if (filterStatus === 'changed') data = data.filter(d => d.periodChange !== 0);
    else if (filterStatus === 'up') data = data.filter(d => d.trend === 'up');
    else if (filterStatus === 'down') data = data.filter(d => d.trend === 'down');

    data.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'price': comparison = a.currentPrice - b.currentPrice; break;
        case 'change': comparison = Math.abs(a.periodChangePercent) - Math.abs(b.periodChangePercent); break;
        case 'wow': comparison = Math.abs(a.wowChangePercent) - Math.abs(b.wowChangePercent); break;
        case 'mrp': comparison = a.mrp - b.mrp; break;
        case 'discount': comparison = a.discountPercent - b.discountPercent; break;
        case 'name': comparison = (a.asinCode || '').localeCompare(b.asinCode || ''); break;
        default: comparison = a.currentPrice - b.currentPrice;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return data;
  }, [priceData, search, filterStatus, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredData.length;
    const withPrice = filteredData.filter(d => d.currentPrice > 0).length;
    const avgPrice = withPrice > 0 ? filteredData.reduce((s, d) => s + d.currentPrice, 0) / withPrice : 0;
    const upCount = filteredData.filter(d => d.trend === 'up').length;
    const downCount = filteredData.filter(d => d.trend === 'down').length;
    const stableCount = filteredData.filter(d => d.trend === 'stable').length;
    const wowUp = filteredData.filter(d => d.wowTrend === 'up').length;
    const wowDown = filteredData.filter(d => d.wowTrend === 'down').length;

    return { total, withPrice, avgPrice, upCount, downCount, stableCount, wowUp, wowDown };
  }, [filteredData]);

  // Format currency
  const formatPrice = (val) => {
    if (!val || val === 0) return '₹0';
    return '₹' + val.toLocaleString('en-IN');
  };

  const formatChange = (val, percent) => {
    if (!val || val === 0) return <span className="text-zinc-300">—</span>;
    const isUp = val > 0;
    return (
      <span className={`fw-bold d-flex align-items-center gap-1 ${isUp ? 'trend-up' : 'trend-down'}`} style={{ fontSize: '11px' }}>
        {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {isUp ? '+' : ''}{formatPrice(val)} ({isUp ? '+' : ''}{percent.toFixed(1)}%)
      </span>
    );
  };

  const formatWowChange = (val, percent) => {
    if (!val || val === 0) return <span className="text-zinc-300">—</span>;
    const isUp = val > 0;
    return (
      <span className={`fw-bold d-flex align-items-center gap-1 ${isUp ? 'trend-up' : 'trend-down'}`} style={{ fontSize: '10px' }}>
        {isUp ? '▲' : '▼'} {isUp ? '+' : ''}{percent.toFixed(1)}%
      </span>
    );
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        document.getElementById('price-search')?.focus();
      }
      if (e.key === 'ArrowRight' && e.ctrlKey) {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
      }
      if (e.key === 'ArrowLeft' && e.ctrlKey) {
        setCurrentPage(prev => Math.max(prev - 1, 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalPages]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${isFullscreen ? 'p-0' : 'p-3'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        .price-modal { animation: priceSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes priceSlideIn { from { opacity: 0; transform: scale(0.94) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        
        .price-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .price-table th {
          background: #fafafa;
          position: sticky;
          top: 0;
          z-index: 10;
          padding: 10px 12px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #71717a;
          border-bottom: 1.5px solid #e5e7eb;
          white-space: nowrap;
        }
        .price-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
        }
        .price-table tr:hover td { background: #fafafa; }
        .price-table tr.selected td { background: #eff6ff; }
        
        .trend-up { color: #dc2626; }
        .trend-down { color: #059669; }
        .trend-stable { color: #9ca3af; }
        
        .page-btn {
          width: 32px; height: 32px; border: 1.5px solid #e5e7eb;
          background: white; border-radius: 8px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 600; color: #52525b;
          transition: all 0.15s;
        }
        .page-btn:hover { border-color: #18181b; color: #18181b; }
        .page-btn.active { background: #18181b; color: white; border-color: #18181b; }
        .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
      `}</style>

      <div 
        className={`bg-white shadow-2xl price-modal d-flex flex-column ${isFullscreen ? 'w-100 h-100 rounded-0' : ''}`}
        style={{ 
          width: isFullscreen ? '100%' : '98%', 
          maxWidth: isFullscreen ? 'none' : '1500px',
          height: isFullscreen ? '100%' : '94vh',
          borderRadius: isFullscreen ? '0' : '18px',
          overflow: 'hidden'
        }}
      >
        {/* ===== HEADER ===== */}
        <div className="px-4 py-3 border-bottom bg-white d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-zinc-900 text-white rounded-2">
              <IndianRupee size={20} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '15px' }}>Price Trend Matrix</h5>
              <span className="text-zinc-500" style={{ fontSize: '11px' }}>
                {stats.total.toLocaleString()} total units · Avg: {formatPrice(Math.round(stats.avgPrice))}
              </span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-1">
            <button className="btn btn-ghost p-2 rounded-circle" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 size={16} className="text-zinc-400" /> : <Maximize2 size={16} className="text-zinc-400" />}
            </button>
            <button className="btn btn-ghost p-2 rounded-circle" onClick={onClose}>
              <X size={18} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {/* ===== STATS ROW ===== */}
        <div className="px-4 py-2 bg-zinc-50 border-bottom d-flex gap-4 flex-shrink-0" style={{ overflowX: 'auto' }}>
          {[
            { label: 'TOTAL', value: stats.total, icon: Activity, color: '#6366f1' },
            { label: 'PRICE ↑', value: stats.upCount, icon: TrendingUp, color: '#dc2626' },
            { label: 'PRICE ↓', value: stats.downCount, icon: TrendingDown, color: '#059669' },
            { label: 'STABLE', value: stats.stableCount, icon: Minus, color: '#9ca3af' },
            { label: 'WoW ↑', value: stats.wowUp, icon: ArrowUpRight, color: '#dc2626' },
            { label: 'WoW ↓', value: stats.wowDown, icon: ArrowDownRight, color: '#059669' },
            { label: 'AVG PRICE', value: formatPrice(Math.round(stats.avgPrice)), icon: IndianRupee, color: '#7c3aed' },
          ].map((stat, idx) => (
            <div key={idx} className="d-flex align-items-center gap-2 flex-shrink-0">
              <stat.icon size={13} style={{ color: stat.color }} />
              <div>
                <span className="text-zinc-400 fw-bold" style={{ fontSize: '9px', textTransform: 'uppercase' }}>{stat.label}</span>
                <span className="fw-bold text-zinc-800 ms-2" style={{ fontSize: '14px' }}>{stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ===== TOOLBAR ===== */}
        <div className="px-4 py-2 bg-white border-bottom d-flex align-items-center gap-2 flex-shrink-0 flex-wrap">
          <div className="position-relative" style={{ width: '220px' }}>
            <Search size={13} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-zinc-400" />
            <input
              id="price-search"
              type="text"
              className="form-control form-control-sm ps-4 rounded-2"
              placeholder="Search ASIN, SKU, Title..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '11px', height: '32px', border: '1.5px solid #e5e7eb' }}
            />
          </div>

          <div className="d-flex gap-1 bg-zinc-100 p-0.5 rounded-2">
            {['TW', '2W', '1M', '3M', 'ALL'].map(range => (
              <button key={range} className={`btn btn-sm px-3 py-0 fw-bold ${timeRange === range ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`}
                onClick={() => setTimeRange(range)} style={{ fontSize: '10px', height: '28px', borderRadius: '6px', border: 'none' }}>
                {range}
              </button>
            ))}
          </div>

          <select className="form-select form-select-sm rounded-2" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ width: '130px', fontSize: '11px', height: '32px', border: '1.5px solid #e5e7eb' }}>
            <option value="all">All Status</option>
            <option value="active">Has Price</option>
            <option value="zero">₹0 Price</option>
            <option value="up">Price Up</option>
            <option value="down">Price Down</option>
            <option value="changed">Any Change</option>
          </select>

          <select className="form-select form-select-sm rounded-2" value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ width: '140px', fontSize: '11px', height: '32px', border: '1.5px solid #e5e7eb' }}>
            <option value="price">Sort: Price</option>
            <option value="change">Sort: Change %</option>
            <option value="wow">Sort: WoW Change</option>
            <option value="discount">Sort: Discount</option>
            <option value="name">Sort: ASIN</option>
          </select>

          <button className={`btn btn-sm rounded-2 ${sortOrder === 'asc' ? 'bg-zinc-900 text-white' : 'bg-white border'}`}
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            style={{ fontSize: '11px', height: '32px', width: '32px', border: '1.5px solid #e5e7eb', padding: 0 }}>
            {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>

          <div className="flex-grow-1" />

          <button className="btn btn-sm btn-outline-secondary rounded-2 d-flex align-items-center gap-1" style={{ fontSize: '10px', height: '32px' }}>
            <Download size={12} /> Export
          </button>
        </div>

        {/* ===== TABLE ===== */}
        <div className="flex-grow-1 overflow-auto" ref={loaderRef}>
          <table className="price-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ minWidth: '130px' }}>IDENTIFIER</th>
                <th style={{ minWidth: '70px' }}>SKU</th>
                <th style={{ minWidth: '200px' }}>PRODUCT</th>
                <th style={{ width: '90px', textAlign: 'right' }}>UPLOADED</th>
                <th style={{ width: '90px', textAlign: 'right' }}>LIVE</th>
                <th style={{ width: '80px', textAlign: 'right' }}>MRP</th>
                {historyDates.map((date, i) => (
                  <th key={date} style={{ 
                    width: '75px', 
                    textAlign: 'center', 
                    background: i % 2 === 0 ? '#f8fafc' : '#f1f5f9', 
                    fontSize: '9px',
                    borderLeft: i === 0 ? '2px solid #e2e8f0' : 'none'
                  }}>
                    {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </th>
                ))}
                <th style={{ width: '55px', textAlign: 'center' }}>DISC%</th>
                <th style={{ width: '130px', textAlign: 'center' }}>{timeRange} CHANGE</th>
                <th style={{ width: '110px', textAlign: 'center', background: '#fefce8' }}>WoW (Wk vs Wk)</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, idx) => (
                <tr key={item._id || item.asinCode} className={selectedRows.has(item._id) ? 'selected' : ''}>
                  <td className="text-zinc-400 fw-bold text-center">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td>
                    <span className="fw-bold text-primary" style={{ fontSize: '12px', cursor: 'pointer' }}>
                      {item.asinCode}
                    </span>
                  </td>
                  <td className="text-zinc-500 font-monospace" style={{ fontSize: '10px' }}>{item.sku || '—'}</td>
                  <td>
                    <div className="text-truncate text-zinc-600" style={{ maxWidth: '200px', fontSize: '11px' }} title={item.title}>
                      {item.title || '—'}
                    </div>
                  </td>
                  <td className="text-end text-zinc-400">{formatPrice(item.uploadedPrice)}</td>
                  <td className="text-end fw-bold text-zinc-800">{formatPrice(item.currentPrice)}</td>
                  <td className="text-end text-zinc-500">{formatPrice(item.mrp)}</td>
                  {historyDates.map((date, i) => {
                    const historyPoint = (item.history || []).find(h => h.date === date);
                    const price = historyPoint?.price;
                    return (
                      <td key={date} className="text-center" style={{ 
                        fontSize: '10px', 
                        background: i % 2 === 0 ? '#f8fafc' : '#f1f5f9',
                        borderLeft: i === 0 ? '2px solid #e2e8f0' : 'none'
                      }}>
                        {price ? (
                          <span className="fw-bold text-zinc-600">₹{Math.round(price).toLocaleString()}</span>
                        ) : <span className="text-zinc-300">—</span>}
                      </td>
                    );
                  })}
                  <td className="text-center">
                    {item.discountPercent > 0 ? (
                      <span className="badge bg-rose-100 text-rose-700 fw-bold" style={{ fontSize: '10px' }}>-{item.discountPercent}%</span>
                    ) : <span className="text-zinc-300 text-center d-block">—</span>}
                  </td>
                  <td className="text-center">
                    {formatChange(item.periodChange, item.periodChangePercent)}
                  </td>
                  <td className="text-center" style={{ background: '#fefce8' }}>
                    {formatWowChange(item.wowChange, item.wowChangePercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredData.length === 0 && (
            <div className="text-center py-5">
              <IndianRupee size={40} className="text-zinc-300 mb-2" />
              <h6 className="text-zinc-500">No ASINs match your filters</h6>
            </div>
          )}
        </div>

        {/* ===== PAGINATION FOOTER ===== */}
        <div className="px-4 py-2 bg-white border-top d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-3">
            <span className="text-zinc-500" style={{ fontSize: '11px' }}>
              Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length.toLocaleString()}
            </span>
            <select className="form-select form-select-sm" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{ width: '80px', fontSize: '11px', height: '30px' }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span className="text-zinc-400" style={{ fontSize: '10px' }}>per page</span>
          </div>

          <div className="d-flex align-items-center gap-1">
            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)} title="First">
              ««
            </button>
            <button className="page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>
              <ChevronLeft size={14} />
            </button>

            {(() => {
              const pages = [];
              const start = Math.max(1, currentPage - 2);
              const end = Math.min(totalPages, currentPage + 2);
              
              if (start > 1) {
                pages.push(1);
                if (start > 2) pages.push('...');
              }
              for (let i = start; i <= end; i++) pages.push(i);
              if (end < totalPages) {
                if (end < totalPages - 1) pages.push('...');
                pages.push(totalPages);
              }
              
              return pages.map((p, i) => 
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="text-zinc-400 px-1">…</span>
                ) : (
                  <button key={p} className={`page-btn ${currentPage === p ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>
                    {p}
                  </button>
                )
              );
            })()}

            <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>
              <ChevronRight size={14} />
            </button>
            <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)} title="Last">
              »»
            </button>
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <div className="px-4 py-2 bg-zinc-900 text-white d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-3">
            <span style={{ fontSize: '10px' }} className="d-flex align-items-center gap-1">
              <Clock size={11} className="text-zinc-400" />
              Real-time Extraction Pipeline
            </span>
            <span className="text-zinc-500" style={{ fontSize: '9px' }}>BuildRO v2.4</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="text-zinc-400" style={{ fontSize: '10px' }}>
              {new Date().getFullYear()} · W{Math.ceil(new Date().getDate() / 7)}
            </span>
            <button onClick={onClose} className="btn btn-sm btn-outline-light rounded-2 fw-bold" style={{ fontSize: '10px', padding: '2px 12px' }}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PriceViewModal;