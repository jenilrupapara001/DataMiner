import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Chart from 'react-apexcharts';
import { 
  X, TrendingUp, TrendingDown, IndianRupee, Calendar,
  Search, Filter, Download, Eye, EyeOff, ChevronDown,
  ChevronUp, BarChart3, Activity, Zap, Clock,
  ArrowUp, ArrowDown, Minus, Maximize2, Minimize2
} from 'lucide-react';

const PriceViewModal = ({ isOpen, onClose, asins = [], selectedAsin = null }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('price'); // price, change, name
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all'); // all, active, zero, changed
  const [timeRange, setTimeRange] = useState('2W'); // TW, 2W, 1M, 3M, ALL
  const [showChart, setShowChart] = useState(true);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [expandedRow, setExpandedRow] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredAsin, setHoveredAsin] = useState(null);

  // Compute price trends based on timeRange
  const priceData = useMemo(() => {
    if (!asins || asins.length === 0) return [];

    return asins.map(asin => {
      const currentPrice = asin.currentPrice || asin.uploadedPrice || 0;
      const mrp = asin.mrp || 0;
      
      // Calculate price changes from history
      const history = asin.history || asin.weekHistory || [];
      const sortedHistory = [...history].sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
      
      const now = new Date();
      const timeRanges = {
        'TW': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        '2W': new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
        '1M': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        '3M': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        'ALL': new Date(0)
      };

      const cutoffDate = timeRanges[timeRange] || timeRanges['2W'];
      
      // Find price at cutoff date
      let oldPrice = null;
      for (const h of sortedHistory) {
        const hDate = new Date(h.date || h.week);
        if (hDate <= cutoffDate && h.price > 0) {
          oldPrice = h.price;
          break;
        }
      }

      // If no old price found, use the oldest available
      if (!oldPrice && sortedHistory.length > 0) {
        oldPrice = sortedHistory[sortedHistory.length - 1].price || currentPrice;
      }

      const previousPrice = oldPrice || currentPrice;
      const priceChange = currentPrice - previousPrice;
      const priceChangePercent = previousPrice > 0 ? ((priceChange / previousPrice) * 100) : 0;

      return {
        ...asin,
        currentPrice,
        mrp,
        previousPrice,
        priceChange,
        priceChangePercent,
        discountPercent: mrp > 0 ? Math.round(((mrp - currentPrice) / mrp) * 100) : 0,
        trend: priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'stable',
        history: sortedHistory
      };
    });
  }, [asins, timeRange]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let data = [...priceData];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(d => 
        (d.asinCode || '').toLowerCase().includes(q) ||
        (d.sku || '').toLowerCase().includes(q) ||
        (d.title || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (filterStatus === 'active') {
      data = data.filter(d => d.currentPrice > 0);
    } else if (filterStatus === 'zero') {
      data = data.filter(d => d.currentPrice === 0);
    } else if (filterStatus === 'changed') {
      data = data.filter(d => d.priceChange !== 0);
    }

    // Sort
    data.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'price': comparison = a.currentPrice - b.currentPrice; break;
        case 'change': comparison = Math.abs(a.priceChangePercent) - Math.abs(b.priceChangePercent); break;
        case 'mrp': comparison = a.mrp - b.mrp; break;
        case 'name': comparison = (a.asinCode || '').localeCompare(b.asinCode || ''); break;
        default: comparison = a.currentPrice - b.currentPrice;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return data;
  }, [priceData, search, filterStatus, sortBy, sortOrder]);

  // Summary stats
  const stats = useMemo(() => {
    const total = filteredData.length;
    const withPrice = filteredData.filter(d => d.currentPrice > 0).length;
    const avgPrice = withPrice > 0 ? filteredData.reduce((s, d) => s + d.currentPrice, 0) / withPrice : 0;
    const upCount = filteredData.filter(d => d.trend === 'up').length;
    const downCount = filteredData.filter(d => d.trend === 'down').length;
    const stableCount = filteredData.filter(d => d.trend === 'stable').length;
    const maxChange = Math.max(...filteredData.map(d => Math.abs(d.priceChangePercent)), 0);

    return { total, withPrice, avgPrice, upCount, downCount, stableCount, maxChange };
  }, [filteredData]);

  // Chart data for selected trend
  const chartData = useMemo(() => {
    const topChanged = filteredData
      .filter(d => d.priceChange !== 0)
      .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
      .slice(0, 15);

    return {
      series: [{
        name: 'Price Change %',
        data: topChanged.map(d => ({
          x: d.asinCode,
          y: Math.round(d.priceChangePercent * 10) / 10,
          fillColor: d.priceChange > 0 ? '#ef4444' : '#059669'
        }))
      }],
      options: {
        chart: {
          type: 'bar',
          height: 300,
          toolbar: { show: false },
          background: 'transparent'
        },
        plotOptions: {
          bar: {
            borderRadius: 6,
            horizontal: true,
            dataLabels: { position: 'top' }
          }
        },
        colors: ['#7c3aed'],
        dataLabels: {
          enabled: true,
          formatter: (val) => `${val > 0 ? '+' : ''}${val}%`,
          style: { fontSize: '10px', fontWeight: 600 }
        },
        xaxis: {
          categories: topChanged.map(d => d.asinCode),
          labels: { style: { fontSize: '10px' } }
        },
        grid: { borderColor: '#f1f5f9' },
        tooltip: {
          y: { formatter: (val) => `${val > 0 ? '+' : ''}${val}%` }
        }
      }
    };
  }, [filteredData]);

  // Toggle row selection
  const toggleRow = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Toggle row expansion
  const toggleExpand = (id) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  // Toggle all rows
  const toggleAll = () => {
    if (selectedRows.size === filteredData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredData.map(d => d._id)));
    }
  };

  // Format currency
  const formatPrice = (val) => {
    if (!val || val === 0) return '₹0';
    return '₹' + val.toLocaleString('en-IN');
  };

  // Auto-expand selected ASIN
  useEffect(() => {
    if (isOpen && selectedAsin) {
      setExpandedRow(selectedAsin._id || selectedAsin.Id);
    }
  }, [isOpen, selectedAsin]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        document.getElementById('price-search')?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 ${isFullscreen ? 'p-0' : ''}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        .price-modal { animation: priceSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes priceSlideIn { from { opacity: 0; transform: scale(0.92) translateY(30px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        
        .price-row:hover { background: #f8fafc !important; }
        .price-row.selected { background: #eff6ff !important; border-left: 3px solid #2563eb !important; }
        
        .trend-up { color: #ef4444; }
        .trend-down { color: #059669; }
        .trend-stable { color: #9ca3af; }
        
        .stat-card {
          background: white;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s;
        }
        .stat-card:hover { border-color: #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        
        .time-btn {
          padding: 6px 14px;
          border: 1.5px solid #e5e7eb;
          background: white;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          transition: all 0.15s;
        }
        .time-btn:hover { border-color: #18181b; color: #18181b; }
        .time-btn.active { background: #18181b; color: white; border-color: #18181b; }
        
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
      `}</style>

      <div 
        className={`bg-white shadow-2xl price-modal d-flex flex-column ${isFullscreen ? 'w-100 h-100 rounded-0' : ''}`}
        style={{ 
          width: isFullscreen ? '100%' : '95%', 
          maxWidth: isFullscreen ? 'none' : '1400px',
          height: isFullscreen ? '100%' : '92vh',
          borderRadius: isFullscreen ? '0' : '20px',
          overflow: 'hidden'
        }}
      >
        {/* ===== HEADER ===== */}
        <div className="px-5 py-3 border-bottom bg-white d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-2">
              <IndianRupee size={22} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900">Price Trend Matrix</h5>
              <div className="d-flex align-items-center gap-2 mt-0.5">
                <span className="text-zinc-400" style={{ fontSize: '11px' }}>
                  <Activity size={12} className="me-1" />
                  {stats.total.toLocaleString()} total units
                </span>
                <span className="text-zinc-300">•</span>
                <span className="text-zinc-400" style={{ fontSize: '11px' }}>
                  <IndianRupee size={12} className="me-1" />
                  Avg: {formatPrice(Math.round(stats.avgPrice))}
                </span>
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button className="btn btn-ghost p-2 rounded-circle" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen ? <Minimize2 size={18} className="text-zinc-400" /> : <Maximize2 size={18} className="text-zinc-400" />}
            </button>
            <button className="btn btn-ghost p-2 rounded-circle" onClick={onClose}>
              <X size={20} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {/* ===== STATS BAR ===== */}
        <div className="px-5 py-3 bg-zinc-50 border-bottom d-flex gap-3 flex-shrink-0" style={{ overflowX: 'auto' }}>
          <div className="stat-card d-flex align-items-center gap-3 flex-shrink-0">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-2"><TrendingUp size={16} /></div>
            <div>
              <div className="text-zinc-400" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Price Increased</div>
              <div className="fw-bold text-zinc-900" style={{ fontSize: '18px' }}>{stats.upCount}</div>
            </div>
          </div>
          <div className="stat-card d-flex align-items-center gap-3 flex-shrink-0">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-2"><TrendingDown size={16} /></div>
            <div>
              <div className="text-zinc-400" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Price Decreased</div>
              <div className="fw-bold text-zinc-900" style={{ fontSize: '18px' }}>{stats.downCount}</div>
            </div>
          </div>
          <div className="stat-card d-flex align-items-center gap-3 flex-shrink-0">
            <div className="p-2 bg-zinc-100 text-zinc-500 rounded-2"><Minus size={16} /></div>
            <div>
              <div className="text-zinc-400" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Stable</div>
              <div className="fw-bold text-zinc-900" style={{ fontSize: '18px' }}>{stats.stableCount}</div>
            </div>
          </div>
          <div className="stat-card d-flex align-items-center gap-3 flex-shrink-0">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-2"><Zap size={16} /></div>
            <div>
              <div className="text-zinc-400" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Max Change</div>
              <div className="fw-bold text-zinc-900" style={{ fontSize: '18px' }}>{stats.maxChange.toFixed(1)}%</div>
            </div>
          </div>
          <div className="stat-card d-flex align-items-center gap-3 flex-shrink-0">
            <div className="p-2 bg-violet-50 text-violet-600 rounded-2"><IndianRupee size={16} /></div>
            <div>
              <div className="text-zinc-400" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>Avg Price</div>
              <div className="fw-bold text-zinc-900" style={{ fontSize: '18px' }}>{formatPrice(Math.round(stats.avgPrice))}</div>
            </div>
          </div>
          <div className="stat-card d-flex align-items-center gap-3 flex-shrink-0">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-2"><Eye size={16} /></div>
            <div>
              <div className="text-zinc-400" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>With Price</div>
              <div className="fw-bold text-zinc-900" style={{ fontSize: '18px' }}>{stats.withPrice}/{stats.total}</div>
            </div>
          </div>
        </div>

        {/* ===== TOOLBAR ===== */}
        <div className="px-5 py-2 bg-white border-bottom d-flex align-items-center gap-3 flex-shrink-0 flex-wrap">
          {/* Search */}
          <div className="position-relative" style={{ width: '250px' }}>
            <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-zinc-400" />
            <input
              id="price-search"
              type="text"
              className="form-control form-control-sm ps-5 rounded-3"
              placeholder="Search ASIN, SKU, Title... (Ctrl+F)"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '12px', height: '36px', border: '1.5px solid #e5e7eb' }}
            />
          </div>

          {/* Time Range */}
          <div className="d-flex gap-1 bg-zinc-100 p-1 rounded-2">
            {['TW', '2W', '1M', '3M', 'ALL'].map(range => (
              <button
                key={range}
                className={`time-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Filters */}
          <select 
            className="form-select form-select-sm rounded-3"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ width: '140px', fontSize: '12px', height: '36px', border: '1.5px solid #e5e7eb' }}
          >
            <option value="all">All Status</option>
            <option value="active">Has Price</option>
            <option value="zero">Zero Price (₹0)</option>
            <option value="changed">Price Changed</option>
          </select>

          {/* Sort */}
          <select 
            className="form-select form-select-sm rounded-3"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{ width: '130px', fontSize: '12px', height: '36px', border: '1.5px solid #e5e7eb' }}
          >
            <option value="price">Sort by Price</option>
            <option value="change">Sort by Change %</option>
            <option value="mrp">Sort by MRP</option>
            <option value="name">Sort by ASIN</option>
          </select>

          <button 
            className={`btn btn-sm rounded-3 ${sortOrder === 'asc' ? 'bg-zinc-900 text-white' : 'bg-white border'}`}
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            style={{ fontSize: '12px', height: '36px', border: '1.5px solid #e5e7eb' }}
          >
            {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          </button>

          <div className="flex-grow-1" />

          {/* Chart Toggle */}
          <button 
            className={`btn btn-sm rounded-3 d-flex align-items-center gap-2 ${showChart ? 'bg-zinc-900 text-white' : 'bg-white border'}`}
            onClick={() => setShowChart(!showChart)}
            style={{ fontSize: '11px', height: '36px', border: '1.5px solid #e5e7eb', fontWeight: 600 }}
          >
            {showChart ? <Eye size={14} /> : <EyeOff size={14} />}
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </button>

          <button className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-2" style={{ fontSize: '11px', height: '36px' }}>
            <Download size={14} />
            Export
          </button>
        </div>

        {/* ===== CONTENT ===== */}
        <div className="flex-grow-1 d-flex flex-column" style={{ overflow: 'hidden' }}>
          
          {/* Chart Section */}
          {showChart && chartData.series[0].data.length > 0 && (
            <div className="px-5 pt-3 bg-white border-bottom flex-shrink-0">
              <div className="d-flex align-items-center gap-2 mb-2">
                <BarChart3 size={14} className="text-violet-600" />
                <span className="fw-bold text-zinc-700" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Top Price Changes
                </span>
              </div>
              <Chart options={chartData.options} series={chartData.series} type="bar" height={280} />
            </div>
          )}

          {/* Table Section */}
          <div className="flex-grow-1 overflow-auto">
            <table className="table table-hover mb-0" style={{ fontSize: '12px' }}>
              <thead className="bg-zinc-50 position-sticky top-0" style={{ zIndex: 10 }}>
                <tr>
                  <th style={{ width: '40px' }} className="ps-4">
                    <input type="checkbox" checked={selectedRows.size === filteredData.length && filteredData.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                  </th>
                  <th style={{ width: '50px' }}>#</th>
                  <th style={{ minWidth: '130px' }}>ASIN</th>
                  <th style={{ minWidth: '80px' }}>SKU</th>
                  <th style={{ minWidth: '250px' }}>Product Title</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Uploaded</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Live Price</th>
                  <th style={{ width: '90px', textAlign: 'right' }}>MRP</th>
                  <th style={{ width: '70px', textAlign: 'center' }}>Disc %</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Change</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, idx) => (
                  <React.Fragment key={item._id || item.asinCode}>
                    <tr 
                      className={`price-row cursor-pointer ${selectedRows.has(item._id) ? 'selected' : ''}`}
                      onClick={() => toggleExpand(item._id)}
                      onMouseEnter={() => setHoveredAsin(item._id)}
                      onMouseLeave={() => setHoveredAsin(null)}
                    >
                      <td className="ps-4" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedRows.has(item._id)} onChange={(e) => toggleRow(item._id, e)} style={{ cursor: 'pointer' }} />
                      </td>
                      <td className="text-zinc-400 fw-bold">{idx + 1}</td>
                      <td>
                        <span className="fw-bold text-primary cursor-pointer" style={{ fontSize: '12px' }}>
                          {item.asinCode}
                        </span>
                      </td>
                      <td className="text-zinc-500 font-monospace" style={{ fontSize: '11px' }}>{item.sku || '—'}</td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '250px' }} title={item.title}>
                          {item.title || 'Unknown Product'}
                        </div>
                      </td>
                      <td className="text-end text-zinc-400">{formatPrice(item.uploadedPrice || 0)}</td>
                      <td className="text-end fw-bold">{formatPrice(item.currentPrice)}</td>
                      <td className="text-end text-zinc-500">{formatPrice(item.mrp)}</td>
                      <td className="text-center">
                        {item.discountPercent > 0 ? (
                          <span className="badge bg-rose-100 text-rose-700" style={{ fontSize: '10px' }}>
                            -{item.discountPercent}%
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        {item.priceChange !== 0 ? (
                          <span className={`fw-bold ${item.trend === 'up' ? 'trend-up' : 'trend-down'}`} style={{ fontSize: '11px' }}>
                            {item.trend === 'up' ? '+' : ''}{formatPrice(item.priceChange)} ({item.priceChangePercent > 0 ? '+' : ''}{item.priceChangePercent.toFixed(1)}%)
                          </span>
                        ) : (
                          <span className="trend-stable">—</span>
                        )}
                      </td>
                      <td className="text-center">
                        {item.trend === 'up' && <TrendingUp size={16} className="trend-up" />}
                        {item.trend === 'down' && <TrendingDown size={16} className="trend-down" />}
                        {item.trend === 'stable' && <Minus size={16} className="trend-stable" />}
                      </td>
                    </tr>

                    {/* Expanded Row - Price History */}
                    {expandedRow === item._id && item.history && item.history.length > 0 && (
                      <tr>
                        <td colSpan={11} className="bg-zinc-50 p-3">
                          <div className="d-flex gap-2 flex-wrap">
                            {item.history.slice(0, 14).map((h, hIdx) => (
                              <div key={hIdx} className="bg-white border rounded-2 px-3 py-1 text-center" style={{ minWidth: '70px' }}>
                                <div className="text-zinc-400" style={{ fontSize: '9px' }}>
                                  {h.date ? new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : h.week}
                                </div>
                                <div className="fw-bold" style={{ fontSize: '11px' }}>{formatPrice(h.price || 0)}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {filteredData.length === 0 && (
              <div className="text-center py-5">
                <IndianRupee size={48} className="text-zinc-300 mb-3" />
                <h6 className="text-zinc-500">No ASINs match your filters</h6>
                <p className="text-zinc-400" style={{ fontSize: '12px' }}>Try adjusting your search or filter criteria</p>
              </div>
            )}
          </div>
        </div>

        {/* ===== FOOTER ===== */}
        <div className="px-5 py-3 bg-zinc-900 text-white d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-4">
            <span style={{ fontSize: '11px' }} className="d-flex align-items-center gap-2">
              <Clock size={12} className="text-zinc-400" />
              Data synchronized via Real-time Extraction Pipeline
            </span>
            <span className="text-zinc-500" style={{ fontSize: '10px' }}>BuildRO v2.4</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="text-zinc-400" style={{ fontSize: '11px' }}>
              {selectedRows.size > 0 ? `${selectedRows.size} selected` : ''}
            </span>
            <button onClick={onClose} className="btn btn-sm btn-outline-light rounded-3 fw-bold" style={{ fontSize: '11px' }}>
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