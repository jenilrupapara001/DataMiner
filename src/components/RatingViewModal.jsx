import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Star, Search, Download, Maximize2, Minimize2,
  ArrowUpDown, ArrowUp, ArrowDown, FileText, MessageSquare,
  Minus, TrendingUp, TrendingDown, SlidersHorizontal, Loader2, Store
} from 'lucide-react';
import { asinApi, sellerApi } from '../services/api';
import InfiniteScrollSelect from './common/InfiniteScrollSelect';

const RatingViewModal = ({ isOpen, onClose, filters = {}, searchQuery = '', sellerId: initialSellerId = '' }) => {
  // ===== DATA STATE =====
  const [asins, setAsins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentSellerId, setCurrentSellerId] = useState(initialSellerId);
  const [sellers, setSellers] = useState([]);

  // Fetch all sellers once for badge labels
  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const res = await sellerApi.getAll({ page: 1, limit: 1000 });
        if (res.success) setSellers(res.data.sellers || []);
      } catch (err) {
        console.error('Error fetching sellers for labels:', err);
      }
    };
    fetchSellers();
  }, []);

  // Sync with prop if it changes (e.g. parent updates seller)
  useEffect(() => {
    if (isOpen) {
      setCurrentSellerId(initialSellerId);
    }
  }, [isOpen, initialSellerId]);

  // ===== LOCAL UI STATE =====
  const [localSearch, setLocalSearch] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRatingRange, setFilterRatingRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loaderRef = useRef(null);

  // ===== DATA FETCHING =====
  const fetchData = useCallback(async (pageNum, isNew = false) => {
    if (!isOpen || (loading && !isNew) || (!hasMore && !isNew)) return;

    setLoading(true);
    try {
      const params = {
        page: pageNum,
        limit: 50,
        seller: currentSellerId,
        search: searchQuery,
        ...filters,
        sortBy: sortBy === 'asinCode' ? 'asinCode' : 'lastScraped', // Sort by lastScraped by default for trends
        sortOrder: 'desc'
      };

      const res = await asinApi.getAll(params);
      if (res && res.asins) {
        setAsins(prev => isNew ? res.asins : [...prev, ...res.asins]);
        setHasMore(res.pagination.page < res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err) {
      console.error('Error fetching rating trends:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, currentSellerId, searchQuery, filters, sortBy, sortOrder, hasMore, loading]);

  // Reset and fetch when modal opens or primary filters change
  useEffect(() => {
    if (isOpen) {
      setAsins([]);
      setPage(1);
      setHasMore(true);
      fetchData(1, true);
    }
  }, [isOpen, currentSellerId, searchQuery, JSON.stringify(filters)]);

  // Fetch next page when page changes
  useEffect(() => {
    if (page > 1) {
      fetchData(page);
    }
  }, [page]);

  // ===== INFINITE SCROLL OBSERVER =====
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        setPage(prev => prev + 1);
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const fetchSellerDropdownData = useCallback(async (page = 1, search = '') => {
    try {
      const response = await sellerApi.getAll({ page, limit: 20, search });
      if (response.success && response.data) {
        return {
          data: response.data.sellers || [],
          hasMore: response.data.pagination.page < response.data.pagination.totalPages
        };
      }
      return { data: [], hasMore: false };
    } catch (err) {
      console.error('Error fetching sellers:', err);
      return { data: [], hasMore: false };
    }
  }, []);

  // ===== GENERATE DATE COLUMNS FROM HISTORY DATA =====
  const { dateColumns } = useMemo(() => {
    const dates = new Set();
    asins.forEach(a => {
      const h = a.history || [];
      h.forEach(p => { if (p.date) dates.add(p.date.split('T')[0]); });
    });
    // Get last 7 unique dates found in the current dataset
    const sorted = [...dates].sort().slice(-7);
    return { dateColumns: sorted };
  }, [asins]);

  // ===== PROCESS DATA FOR DISPLAY (Trends, WoW) =====
  const processedData = useMemo(() => {
    const now = new Date();

    return asins.map(asin => {
      const currentRating = asin.rating || 0;
      const reviewCount = asin.reviewCount || 0;
      const history = asin.history || [];

      const ratingByDate = {};
      history.forEach(h => {
        if (h.date && h.rating) {
          const d = h.date.split('T')[0];
          ratingByDate[d] = {
            rating: h.rating,
            reviews: h.reviews || h.reviewCount || 0
          };
        }
      });

      const dateValues = dateColumns.map(d => ({
        date: d,
        rating: ratingByDate[d]?.rating || null,
        reviews: ratingByDate[d]?.reviews || null,
      }));

      const currentWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      let currentWeekRating = null, lastWeekRating = null;
      const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

      for (const h of sortedHistory) {
        const hDate = new Date(h.date);
        if (hDate >= currentWeekStart && h.rating > 0 && !currentWeekRating) currentWeekRating = h.rating;
        else if (hDate < currentWeekStart && h.rating > 0 && !lastWeekRating) lastWeekRating = h.rating;
        if (currentWeekRating && lastWeekRating) break;
      }

      const woWChange = currentWeekRating && lastWeekRating ? currentWeekRating - lastWeekRating : 0;
      const woWPercent = lastWeekRating ? ((woWChange / lastWeekRating) * 100) : 0;

      const firstValid = dateValues.find(dv => dv.rating !== null);
      const lastValid = [...dateValues].reverse().find(dv => dv.rating !== null);
      const periodTrend = firstValid && lastValid ? (lastValid.rating > firstValid.rating ? 'up' : lastValid.rating < firstValid.rating ? 'down' : 'stable') : 'stable';

      return {
        ...asin,
        currentRating,
        reviewCount,
        dateValues,
        woWChange,
        woWPercent,
        trend: periodTrend,
        wowTrend: woWChange > 0 ? 'up' : woWChange < 0 ? 'down' : 'stable',
      };
    });
  }, [asins, dateColumns]);

  // ===== LOCAL FILTERING & SORTING =====
  const filteredData = useMemo(() => {
    let data = [...processedData];

    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      data = data.filter(d =>
        (d.asinCode || '').toLowerCase().includes(q) ||
        (d.sku || '').toLowerCase().includes(q) ||
        (d.title || '').toLowerCase().includes(q)
      );
    }

    if (filterStatus === '4starPlus') data = data.filter(d => d.currentRating >= 4);
    else if (filterStatus === 'lowRating') data = data.filter(d => d.currentRating > 0 && d.currentRating < 3.5);
    else if (filterStatus === 'ratingUp') data = data.filter(d => d.trend === 'up');
    else if (filterStatus === 'ratingDown') data = data.filter(d => d.trend === 'down');
    else if (filterStatus === 'hasReviews') data = data.filter(d => d.reviewCount > 0);

    if (filterRatingRange.min !== '') data = data.filter(d => d.currentRating >= Number(filterRatingRange.min));
    if (filterRatingRange.max !== '') data = data.filter(d => d.currentRating <= Number(filterRatingRange.max));

    data.sort((a, b) => {
      let va, vb;
      switch (sortBy) {
        case 'rating': va = a.currentRating; vb = b.currentRating; break;
        case 'reviews': va = a.reviewCount; vb = b.reviewCount; break;
        case 'wowPercent': va = Math.abs(a.woWPercent); vb = Math.abs(b.woWPercent); break;
        case 'asinCode': return sortOrder === 'asc' ? (a.asinCode || '').localeCompare(b.asinCode || '') : (b.asinCode || '').localeCompare(a.asinCode || '');
        default: va = a.currentRating; vb = b.currentRating;
      }

      const aE = !va || va === 0, bE = !vb || vb === 0;
      if (aE && bE) return 0;
      if (aE) return 1;
      if (bE) return -1;

      return sortOrder === 'asc' ? va - vb : vb - va;
    });

    return data;
  }, [processedData, localSearch, sortBy, sortOrder, filterStatus, filterRatingRange]);

  // ===== HANDLERS =====
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredData.map(d => d._id)));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetAllFilters = () => {
    setLocalSearch('');
    setFilterStatus('all');
    setFilterRatingRange({ min: '', max: '' });
    setSortBy('rating');
    setSortOrder('desc');
    // Keep currentSellerId as requested for persistent seller filtering
  };

  const getAppliedFiltersBadges = () => {
    const badges = [];

    if (currentSellerId) {
      const seller = sellers.find(s => s._id === currentSellerId);
      badges.push(
        <div key="seller" className="badge bg-zinc-900 text-white border border-zinc-900 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
          <Store size={10} className="opacity-60" />
          <span className="fw-bold">{seller?.name || 'Selected Seller'}</span>
          <button className="btn btn-link p-0 text-zinc-400 hover-text-white transition-colors" onClick={() => setCurrentSellerId('')}><X size={12} /></button>
        </div>
      );
    }

    if (localSearch) {
      badges.push(
        <div key="search" className="badge bg-amber-50 text-amber-700 border border-amber-200 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
          <Search size={10} className="opacity-60" />
          <span className="fw-bold italic">"{localSearch}"</span>
          <button className="btn btn-link p-0 text-amber-400 hover-text-red-500 transition-colors" onClick={() => setLocalSearch('')}><X size={12} /></button>
        </div>
      );
    }

    if (filterStatus !== 'all') {
      badges.push(
        <div key="status" className="badge bg-zinc-100 text-zinc-700 border border-zinc-200 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
          <span className="fw-bold opacity-60 text-uppercase" style={{ fontSize: '8.5px' }}>Status:</span>
          <span className="fw-bold">{filterStatus}</span>
          <button className="btn btn-link p-0 text-zinc-400 hover-text-red-500 transition-colors" onClick={() => setFilterStatus('all')}><X size={12} /></button>
        </div>
      );
    }

    if (filterRatingRange.min || filterRatingRange.max) {
      const label = `${filterRatingRange.min || 0} - ${filterRatingRange.max || '5'}`;
      badges.push(
        <div key="rating" className="badge bg-zinc-100 text-zinc-700 border border-zinc-200 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
          <span className="fw-bold opacity-60 text-uppercase" style={{ fontSize: '8.5px' }}>Rating:</span>
          <span className="fw-bold">{label} ★</span>
          <button className="btn btn-link p-0 text-zinc-400 hover-text-red-500 transition-colors" onClick={() => setFilterRatingRange({ min: '', max: '' })}><X size={12} /></button>
        </div>
      );
    }

    return badges;
  };

  const exportData = () => {
    const headers = ['ASIN', 'SKU', 'Title', 'Rating', 'Reviews', ...dateColumns.map(d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })), 'WoW %', 'Trend'];
    const rows = filteredData.map(d => [d.asinCode, d.sku, d.title, d.currentRating, d.reviewCount, ...d.dateValues.map(v => v.rating || ''), d.woWPercent.toFixed(1) + '%', d.trend]);
    const csv = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rating_trend_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    setShowExportMenu(false);
  };

  if (!isOpen) return null;

  const css = `
    .rt { width:100%; border-collapse:separate; border-spacing:0; }
    .rt th { background:#fafafa; position:sticky; top:0; z-index:10; padding:6px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#71717a; border-bottom:2px solid #e5e7eb; white-space:nowrap; cursor:pointer; transition: background 0.2s; }
    .rt th:hover { background:#f4f4f5; }
    .rt td { padding:5px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; vertical-align: middle; }
    .rt tr:hover td { background:#fafafa; }
    .rt tr.selected td { background:#fffbeb; }
    .up { color:#059669; } .dn { color:#dc2626; } .st { color:#9ca3af; }
    .chp { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:#fff; color:#71717a; white-space:nowrap; transition:all 0.2s; }
    .chp:hover { border-color:#18181b; color:#18181b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .chp.act { background:#18181b; color:#fff; border-color:#18181b; }
    .dd { font-size:10px; padding:2px 6px; border-radius:4px; text-align:center; min-width:55px; transition: all 0.2s; }
    .dd-has { background:#fffbeb; color:#d97706; font-weight:600; }
    .dd-no { color:#d1d5db; }
    .inp-sm { font-size:11px; height:28px; border:1.5px solid #e5e7eb; border-radius:8px; padding:2px 10px; width:80px; outline: none; transition: border-color 0.2s; }
    .inp-sm:focus { border-color: #18181b; }
    .loader-pulse { height:30px; display:flex; align-items:center; justify-content:center; gap:6px; margin:20px 0; }
    .pulse-dot { width:8px; height:8px; background:#d1d5db; border-radius:50%; animation: pulse 1.5s infinite; }
    .pulse-dot:nth-child(2) { animation-delay: 0.2s; }
    .pulse-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.5); opacity: 1; } }
    .trend-badge { display: inline-flex; align-items:center; gap:3px; padding:2px 6px; border-radius:4px; font-weight:700; font-size:10px; }
    .trend-up { background: #ecfdf5; color: #059669; }
    .trend-dn { background: #fef2f2; color: #dc2626; }
    .trend-st { background: #f4f4f5; color: #71717a; }
  `;

  const Si = ({ f }) => sortBy !== f ? <ArrowUpDown size={10} className="text-zinc-300" /> : sortOrder === 'asc' ? <ArrowUp size={10} className="text-zinc-700" /> : <ArrowDown size={10} className="text-zinc-700" />;

  return createPortal(
    <div className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${isFullscreen ? 'p-0' : 'p-3'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(12px)', zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{css}</style>

      <div className={`bg-white shadow-2xl d-flex flex-column ${isFullscreen ? 'w-100 h-100 rounded-0' : 'rounded-3'}`}
        style={{ width: isFullscreen ? '100%' : '98%', maxWidth: isFullscreen ? 'none' : '1650px', height: isFullscreen ? '100%' : '94vh', overflow: 'hidden', border: '1px solid #e5e7eb' }}>

        {/* HEADER */}
        <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center flex-shrink-0 bg-white flex-wrap gap-3">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 rounded-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', color: '#d97706', border: '1px solid #fde68a' }}>
              <Star size={20} className="fill-current" />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '15px', letterSpacing: '-0.01em' }}>Rating Analytics Matrix</h5>
              <div className="d-flex align-items-center gap-2 mt-0.5">
                <span className="badge bg-zinc-100 text-zinc-600 border fw-medium" style={{ fontSize: '10px' }}>
                  {totalCount.toLocaleString()} Total ASINs
                </span>
                <span className="text-zinc-400" style={{ fontSize: '10px' }}>•</span>
                <span className="text-zinc-500 fw-medium" style={{ fontSize: '10px' }}>
                  Live Data Streamed from DB
                </span>
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="position-relative">
              <button className="chp d-flex align-items-center gap-2" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: '#d97706', color: '#d97706' }}>
                <Download size={13} /> Export Insights
              </button>
              {showExportMenu && (
                <div className="position-absolute bg-white border rounded-3 shadow-xl p-1" style={{ top: '100%', right: 0, zIndex: 100, marginTop: '8px', minWidth: '160px' }}>
                  <button className="btn btn-sm btn-ghost d-flex align-items-center gap-3 w-100 text-start rounded-2 py-2 px-3" onClick={exportData} style={{ fontSize: '11px' }}>
                    <FileText size={15} className="text-amber-600" /> <span>Export to CSV</span>
                  </button>
                </div>
              )}
            </div>
            <div className="vr mx-1 opacity-10" style={{ height: '24px' }}></div>
            <button className="btn btn-ghost p-2 rounded-circle hover-bg-zinc-100 transition-all" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 size={17} className="text-zinc-500" /> : <Maximize2 size={17} className="text-zinc-500" />}
            </button>
            <button className="btn btn-ghost p-2 rounded-circle hover-bg-red-50 transition-all text-zinc-500 hover-text-red-500" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="px-4 py-2 bg-white border-bottom d-flex align-items-center gap-3 flex-shrink-0 flex-wrap">
          <div className="position-relative" style={{ width: '220px' }}>
            <Search size={13} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-zinc-400" />
            <input className="form-control form-control-sm ps-5 rounded-3" placeholder="Filter ASIN, SKU, Title..." value={localSearch}
              onChange={e => setLocalSearch(e.target.value)} style={{ fontSize: '11px', height: '32px', border: '1.5px solid #e5e7eb', background: '#fcfcfc' }} />
          </div>

          <div style={{ width: '200px' }}>
            <InfiniteScrollSelect
              fetchData={fetchSellerDropdownData}
              value={currentSellerId}
              onSelect={setCurrentSellerId}
              placeholder="Filter by Seller..."
            />
          </div>

          <div className="d-flex gap-1.5 flex-wrap">
            {[{ v: 'all', l: 'All' }, { v: '4starPlus', l: '4★+' }, { v: 'lowRating', l: '< 3.5★' }, { v: 'ratingUp', l: 'Improved' }, { v: 'ratingDown', l: 'Dropped' }].map(f => (
              <button key={f.v} className={`chp ${filterStatus === f.v ? 'act' : ''}`} onClick={() => setFilterStatus(f.v === filterStatus ? 'all' : f.v)}>{f.l}</button>
            ))}
          </div>

          <button className={`chp d-flex align-items-center gap-2 ${showFilters ? 'act' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={13} /> <span>Advanced Filters</span>
          </button>

          <div className="vr mx-1 opacity-10" style={{ height: '20px' }}></div>

          <div className="d-flex gap-1.5">
            {[{ f: 'rating', l: 'Rating' }, { f: 'reviews', l: 'Reviews' }, { f: 'asinCode', l: 'ASIN' }].map(s => (
              <button key={s.f} className={`chp ${sortBy === s.f ? 'act' : ''}`} onClick={() => handleSort(s.f)}>
                {s.l} {sortBy === s.f ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>

          {(filterStatus !== 'all' || localSearch || filterRatingRange.min || filterRatingRange.max) && (
            <button className="chp text-red-500 border-red-100 bg-red-50" onClick={resetAllFilters} style={{ fontSize: '10px' }}><X size={12} className="me-1" /> Reset View</button>
          )}

          {loading && <div className="ms-auto d-flex align-items-center gap-2 text-zinc-400" style={{ fontSize: '11px' }}><Loader2 size={14} className="animate-spin" /> Synchronizing...</div>}
        </div>

        {/* APPLIED FILTERS BADGES */}
        {(currentSellerId || localSearch || filterStatus !== 'all' || filterRatingRange.min || filterRatingRange.max) && (
          <div className="px-4 py-2 bg-zinc-50 border-bottom d-flex align-items-center flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
            <span className="text-zinc-400 fw-bold me-2" style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Context Filters
            </span>
            <div className="d-flex flex-wrap gap-2">
              {getAppliedFiltersBadges()}
            </div>
            <button 
              className="btn btn-link btn-xs text-red-500 p-0 ms-auto fw-bold text-decoration-none shadow-none" 
              style={{ fontSize: '10px' }}
              onClick={resetAllFilters}
            >
              CLEAR ALL
            </button>
          </div>
        )}

        {showFilters && (
          <div className="px-4 py-3 bg-zinc-50 border-bottom d-flex gap-4 flex-shrink-0 flex-wrap align-items-center shadow-inner">
            <div className="d-flex align-items-center gap-2">
              <span className="text-zinc-500 fw-bold" style={{ fontSize: '10px', textTransform: 'uppercase' }}>Rating Range:</span>
              <div className="d-flex align-items-center gap-1.5 bg-white p-1 rounded-2 border">
                <input type="number" step="0.1" className="inp-sm border-0 bg-transparent" placeholder="Min" value={filterRatingRange.min} onChange={e => setFilterRatingRange(prev => ({ ...prev, min: e.target.value }))} />
                <span className="text-zinc-300">/</span>
                <input type="number" step="0.1" className="inp-sm border-0 bg-transparent" placeholder="Max" value={filterRatingRange.max} onChange={e => setFilterRatingRange(prev => ({ ...prev, max: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* TABLE */}
        <div className="flex-grow-1 overflow-auto position-relative custom-scrollbar">
          <table className="rt">
            <thead>
              <tr>
                <th style={{ width: '40px', position: 'sticky', left: 0, zIndex: 30, background: '#fafafa', textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.size === filteredData.length && filteredData.length > 0} onChange={toggleSelectAll} style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: '#18181b' }} />
                </th>
                <th style={{ width: '45px', position: 'sticky', left: '40px', zIndex: 30, background: '#fafafa', textAlign: 'center' }}>#</th>
                <th style={{ width: '85px', position: 'sticky', left: '85px', zIndex: 30, background: '#fff' }} onClick={() => handleSort('asinCode')}>
                  <div className="d-flex align-items-center gap-2">ASIN <Si f="asinCode" /></div>
                </th>
                <th style={{ width: '120px' }}>SKU</th>
                <th style={{ width: '80px', textAlign: 'center' }} onClick={() => handleSort('rating')}>
                  <div className="d-flex align-items-center justify-content-center gap-2">SCORE <Si f="rating" /></div>
                </th>
                <th style={{ width: '85px', textAlign: 'center' }} onClick={() => handleSort('reviews')}>
                  <div className="d-flex align-items-center justify-content-center gap-2">VOLUME <Si f="reviews" /></div>
                </th>
                {dateColumns.map((date, idx) => (
                  <th key={date} style={{ width: '65px', textAlign: 'center', background: idx === dateColumns.length - 1 ? '#fff7ed' : '#fafafa', fontSize: '9px' }}>
                    {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </th>
                ))}
                <th style={{ width: '85px', textAlign: 'center', background: '#fffbeb' }} onClick={() => handleSort('wowPercent')}>
                  <div className="d-flex align-items-center justify-content-center gap-2">WoW % <Si f="wowPercent" /></div>
                </th>
                <th style={{ width: '60px', textAlign: 'center' }}>TREND</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? filteredData.map((item, idx) => (
                <tr key={item._id || item.asinCode} className={selectedIds.has(item._id) ? 'selected' : ''}>
                  <td style={{ position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#fafafa', textAlign: 'center', zIndex: 20 }}>
                    <input type="checkbox" checked={selectedIds.has(item._id)} onChange={() => toggleSelect(item._id)} style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: '#18181b' }} />
                  </td>
                  <td className="text-zinc-400 text-center fw-medium" style={{ position: 'sticky', left: '40px', background: idx % 2 === 0 ? '#fff' : '#fafafa', zIndex: 20, fontSize: '10px' }}>{idx + 1}</td>
                  <td style={{ position: 'sticky', left: '85px', background: idx % 2 === 0 ? '#fff' : '#fafafa', zIndex: 20 }}>
                    <span className="fw-bold text-blue-600 hover-underline cursor-pointer" style={{ fontSize: '11px' }}>{item.asinCode}</span>
                  </td>
                  <td className="text-zinc-500 font-mono" style={{ width: '120px', fontSize: '10px' }}>{item.sku || '—'}</td>
                  <td className="text-center">
                    {item.currentRating > 0 ? (
                      <div className="d-inline-flex align-items-center gap-1 px-2 py-0.5 rounded-2 bg-amber-50 text-amber-700 fw-bold border border-amber-100" style={{ fontSize: '11px' }}>
                        <Star size={11} className="fill-amber-500 text-amber-500" /> {item.currentRating.toFixed(1)}
                      </div>
                    ) : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="text-center">
                    {item.reviewCount > 0 ? (
                      <div className="d-inline-flex align-items-center gap-1.5 text-zinc-600 fw-semibold" style={{ fontSize: '11px' }}>
                        <MessageSquare size={12} className="text-zinc-400" /> {item.reviewCount.toLocaleString()}
                      </div>
                    ) : <span className="text-zinc-300">—</span>}
                  </td>
                  {item.dateValues.map((dv, di) => (
                    <td key={di} className="text-center" style={{ padding: '4px 2px', background: di % 2 === 0 ? '#fafafa' : '#fff' }}>
                      <div className="d-flex flex-column align-items-center gap-0.5">
                        {dv.rating ? (
                          <span className="fw-bold text-amber-600" style={{ fontSize: '10px' }}>{dv.rating.toFixed(1)}</span>
                        ) : <span className="text-zinc-300">·</span>}
                        {dv.reviews !== null ? (
                          <span className="text-zinc-500" style={{ fontSize: '9px', fontWeight: 500 }}>{dv.reviews.toLocaleString()}</span>
                        ) : <span className="text-zinc-200" style={{ fontSize: '8px' }}>—</span>}
                      </div>
                    </td>
                  ))}
                  <td className="text-center" style={{ background: '#fffbeb' }}>
                    {item.woWChange !== 0 ? (
                      <div className={`trend-badge ${item.wowTrend === 'up' ? 'trend-up' : 'trend-dn'}`}>
                        {item.wowTrend === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(item.woWPercent).toFixed(1)}%
                      </div>
                    ) : <div className="trend-badge trend-st"><Minus size={11} /> 0.0%</div>}
                  </td>
                  <td className="text-center">
                    {item.trend === 'up' ? <TrendingUp size={16} className="up" /> : item.trend === 'down' ? <TrendingDown size={16} className="dn" /> : <Minus size={16} className="st" />}
                  </td>
                </tr>
              )) : !loading ? (
                <tr>
                  <td colSpan={11 + dateColumns.length} className="text-center py-5">
                    <div className="d-flex flex-column align-items-center opacity-40">
                      <Star size={48} className="text-zinc-200 mb-3" />
                      <p className="text-zinc-500 fw-medium" style={{ fontSize: '14px' }}>No analytical data found for current filters</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {/* LOADING STATE */}
          {(loading || hasMore) && (
            <div ref={loaderRef} className="loader-pulse">
              <div className="pulse-dot"></div>
              <div className="pulse-dot"></div>
              <div className="pulse-dot"></div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-4 py-2.5 bg-zinc-50 border-top d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-4">
            <span className="text-zinc-500 fw-medium" style={{ fontSize: '11px' }}>
              Showing <span className="text-zinc-900 fw-bold">{asins.length.toLocaleString()}</span> of <span className="text-zinc-900 fw-bold">{totalCount.toLocaleString()}</span> global records
            </span>
            {selectedIds.size > 0 && (
              <span className="badge bg-blue-600 text-white rounded-pill px-3 py-1.5" style={{ fontSize: '10px' }}>
                {selectedIds.size} Selected for Batch Action
              </span>
            )}
          </div>
          <div className="d-flex align-items-center gap-2 text-zinc-400" style={{ fontSize: '11px' }}>
            <Loader2 size={12} className={loading ? "animate-spin" : "d-none"} />
            {loading ? 'Fetching records...' : hasMore ? 'Scroll down to load more analytical history' : 'All historical records loaded'}
          </div>
        </div>
      </div>
    </div>, document.body
  );
};

export default RatingViewModal;