import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, TrendingUp, TrendingDown, IndianRupee, Search, Download,
  ArrowUp, ArrowDown, Minus, Maximize2, Minimize2,
  ArrowUpDown, FileText, SlidersHorizontal, Loader2, Store
} from 'lucide-react';
import { asinApi, sellerApi } from '../services/api';
import InfiniteScrollSelect from './common/InfiniteScrollSelect';

const PriceViewModal = ({ isOpen, onClose, filters = {}, searchQuery = '', sellerId: initialSellerId = '' }) => {
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
  const [sortBy, setSortBy] = useState('uploadedPrice');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriceRange, setFilterPriceRange] = useState({ min: '', max: '' });
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
        sortBy: sortBy === 'asinCode' ? 'asinCode' : 'lastScraped',
        sortOrder: 'desc'
      };

      const res = await asinApi.getAll(params);
      if (res && res.asins) {
        setAsins(prev => isNew ? res.asins : [...prev, ...res.asins]);
        setHasMore(res.pagination.page < res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err) {
      console.error('Error fetching price trends:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, currentSellerId, searchQuery, filters, sortBy, sortOrder, hasMore, loading]);

  useEffect(() => {
    if (isOpen) {
      setAsins([]);
      setPage(1);
      setHasMore(true);
      fetchData(1, true);
    }
  }, [isOpen, currentSellerId, searchQuery, JSON.stringify(filters)]);

  useEffect(() => {
    if (page > 1) fetchData(page);
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
      const response = await sellerApi.getAll({ page, limit: 1000, search });
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
      const h = a.history || a.weekHistory || [];
      h.forEach(p => { if (p.date) dates.add(p.date.split('T')[0]); });
    });
    const sorted = [...dates].sort().slice(-7);
    return { dateColumns: sorted };
  }, [asins]);

  // ===== PROCESS DATA FOR DISPLAY =====
  const processedData = useMemo(() => {
    const now = new Date();

    return asins.map(asin => {
      const currentPrice = asin.currentPrice || 0;
      const mrp = asin.mrp || 0;
      const uploadedPrice = asin.uploadedPrice || 0;
      const history = asin.history || asin.weekHistory || [];

      const priceByDate = {};
      history.forEach(h => {
        if (h.date && h.price) {
          const d = h.date.split('T')[0];
          priceByDate[d] = h.price;
        }
      });

      const dateValues = dateColumns.map(d => ({
        date: d,
        price: priceByDate[d] || null,
      }));

      const currentWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      let currentWeekPrice = null, lastWeekPrice = null;
      const sortedHistory = [...history].sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));

      for (const h of sortedHistory) {
        const hDate = new Date(h.date || h.week);
        if (hDate >= currentWeekStart && h.price > 0 && !currentWeekPrice) currentWeekPrice = h.price;
        else if (hDate >= lastWeekStart && hDate < currentWeekStart && h.price > 0 && !lastWeekPrice) lastWeekPrice = h.price;
        if (currentWeekPrice && lastWeekPrice) break;
      }
      if (!currentWeekPrice) currentWeekPrice = currentPrice;
      if (!lastWeekPrice) lastWeekPrice = currentWeekPrice;

      const woWChange = currentWeekPrice - lastWeekPrice;
      const woWPercent = lastWeekPrice > 0 ? ((woWChange / lastWeekPrice) * 100) : 0;

      const firstValid = dateValues.find(d => d.price !== null);
      const periodChange = firstValid ? currentPrice - firstValid.price : 0;
      const periodPercent = firstValid?.price ? ((periodChange / firstValid.price) * 100) : 0;
      const discountPercent = mrp > 0 ? Math.round(((mrp - currentPrice) / mrp) * 100) : 0;

      return {
        ...asin,
        currentPrice,
        mrp,
        uploadedPrice,
        discountPercent,
        dateValues,
        woWChange,
        woWPercent,
        trend: periodChange > 0 ? 'up' : periodChange < 0 ? 'down' : 'stable',
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

    if (filterStatus === 'hasPrice') data = data.filter(d => d.currentPrice > 0);
    else if (filterStatus === 'priceUp') data = data.filter(d => d.trend === 'up');
    else if (filterStatus === 'priceDown') data = data.filter(d => d.trend === 'down');
    else if (filterStatus === 'hasDiscount') data = data.filter(d => d.discountPercent > 0);
    else if (filterStatus === 'wowUp') data = data.filter(d => d.wowTrend === 'up');
    else if (filterStatus === 'wowDown') data = data.filter(d => d.wowTrend === 'down');

    if (filterPriceRange.min !== '') data = data.filter(d => d.currentPrice >= Number(filterPriceRange.min));
    if (filterPriceRange.max !== '') data = data.filter(d => d.currentPrice <= Number(filterPriceRange.max));

    data.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'currentPrice': valA = a.currentPrice; valB = b.currentPrice; break;
        case 'mrp': valA = a.mrp; valB = b.mrp; break;
        case 'discountPercent': valA = a.discountPercent; valB = b.discountPercent; break;
        case 'wowPercent': valA = Math.abs(a.woWPercent); valB = Math.abs(b.woWPercent); break;
        case 'asinCode': return sortOrder === 'asc' ? (a.asinCode || '').localeCompare(b.asinCode || '') : (b.asinCode || '').localeCompare(a.asinCode || '');
        default: valA = a.currentPrice; valB = b.currentPrice;
      }

      const aE = !valA || valA === 0, bE = !valB || valB === 0;
      if (aE && bE) return 0;
      if (aE) return 1;
      if (bE) return -1;

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return data;
  }, [processedData, localSearch, sortBy, sortOrder, filterStatus, filterPriceRange]);

  const stats = useMemo(() => ({
    avgPrice: Math.round(filteredData.filter(d => d.currentPrice > 0).reduce((s, d) => s + d.currentPrice, 0) / (filteredData.filter(d => d.currentPrice > 0).length || 1)),
  }), [filteredData]);

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
    setFilterPriceRange({ min: '', max: '' });
    setSortBy('currentPrice');
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

    if (filterPriceRange.min || filterPriceRange.max) {
      const label = `${filterPriceRange.min || 0} - ${filterPriceRange.max || '∞'}`;
      badges.push(
        <div key="price" className="badge bg-zinc-100 text-zinc-700 border border-zinc-200 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
          <span className="fw-bold opacity-60 text-uppercase" style={{ fontSize: '8.5px' }}>Price:</span>
          <span className="fw-bold">₹{label}</span>
          <button className="btn btn-link p-0 text-zinc-400 hover-text-red-500 transition-colors" onClick={() => setFilterPriceRange({ min: '', max: '' })}><X size={12} /></button>
        </div>
      );
    }

    return badges;
  };

  const exportData = () => {
    const headers = ['ASIN', 'SKU', 'Title', 'Live Price', 'MRP', 'Discount %', ...dateColumns.map(d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })), 'WoW %', 'Trend'];
    const rows = filteredData.map(d => [d.asinCode, d.sku, d.title, d.currentPrice, d.mrp, d.discountPercent, ...d.dateValues.map(v => v.price || ''), d.woWPercent.toFixed(1) + '%', d.trend]);
    const csv = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `price_trend_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    setShowExportMenu(false);
  };

  if (!isOpen) return null;

  const css = `
    .pt { width:100%; border-collapse:separate; border-spacing:0; }
    .pt th { background:#fafafa; position:sticky; top:0; z-index:10; padding:6px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#71717a; border-bottom:2px solid #e5e7eb; white-space:nowrap; cursor:pointer; }
    .pt th:hover { background:#f4f4f5; }
    .pt td { padding:5px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; vertical-align: middle; }
    .pt tr:hover td { background:#fafafa; }
    .pt tr.selected td { background:#eff6ff; }
    .up { color:#dc2626; } .dn { color:#059669; } .st { color:#9ca3af; }
    .chp { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:#fff; color:#71717a; white-space:nowrap; transition:all 0.2s; }
    .chp:hover { border-color:#18181b; color:#18181b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .chp.act { background:#18181b; color:#fff; border-color:#18181b; }
    .dd { font-size:10px; padding:2px 6px; border-radius:4px; text-align:center; min-width:55px; }
    .dd-has { background:#ecfdf5; color:#059669; font-weight:600; }
    .dd-no { color:#d1d5db; }
    .inp-sm { font-size:11px; height:28px; border:1.5px solid #e5e7eb; border-radius:8px; padding:2px 10px; width:80px; outline: none; }
    .loader-pulse { height:30px; display:flex; align-items:center; justify-content:center; gap:6px; margin:20px 0; }
    .pulse-dot { width:8px; height:8px; background:#d1d5db; border-radius:50%; animation: pulse 1.5s infinite; }
    .pulse-dot:nth-child(2) { animation-delay: 0.2s; }
    .pulse-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.5); opacity: 1; } }
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
            <div className="p-2 rounded-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
              <IndianRupee size={20} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '15px' }}>Price Dynamics Matrix</h5>
              <div className="d-flex align-items-center gap-2 mt-0.5">
                <span className="badge bg-zinc-100 text-zinc-600 border fw-medium" style={{ fontSize: '10px' }}>
                  {totalCount.toLocaleString()} Total ASINs
                </span>
                <span className="text-zinc-400" style={{ fontSize: '10px' }}>•</span>
                <span className="text-zinc-500 fw-medium" style={{ fontSize: '10px' }}>Avg Market Price: ₹{stats.avgPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="position-relative">
              <button className="chp d-flex align-items-center gap-2" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: '#2563eb', color: '#2563eb' }}>
                <Download size={13} /> Export Price Data
              </button>
              {showExportMenu && (
                <div className="position-absolute bg-white border rounded-3 shadow-xl p-1" style={{ top: '100%', right: 0, zIndex: 100, marginTop: '8px', minWidth: '160px' }}>
                  <button className="btn btn-sm btn-ghost d-flex align-items-center gap-3 w-100 text-start rounded-2 py-2 px-3" onClick={exportData} style={{ fontSize: '11px' }}>
                    <FileText size={15} className="text-blue-600" /> Export CSV
                  </button>
                </div>
              )}
            </div>
            <div className="vr mx-1 opacity-10" style={{ height: '24px' }}></div>
            <button className="btn btn-ghost p-2 rounded-circle transition-all" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 size={17} className="text-zinc-500" /> : <Maximize2 size={17} className="text-zinc-500" />}
            </button>
            <button className="btn btn-ghost p-2 rounded-circle text-zinc-500 hover-text-red-500" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="px-4 py-2 bg-white border-bottom d-flex align-items-center gap-3 flex-shrink-0 flex-wrap">
          <div className="position-relative" style={{ width: '220px' }}>
            <Search size={13} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-zinc-400" />
            <input className="form-control form-control-sm ps-5 rounded-3" placeholder="Search ASIN, SKU..." value={localSearch}
              onChange={e => setLocalSearch(e.target.value)} style={{ fontSize: '11px', height: '32px', border: '1.5px solid #e5e7eb' }} />
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
            {[{ v: 'all', l: 'All' }, { v: 'hasPrice', l: 'Live' }, { v: 'priceUp', l: 'Increased' }, { v: 'priceDown', l: 'Decreased' }, { v: 'hasDiscount', l: 'Discounted' }].map(f => (
              <button key={f.v} className={`chp ${filterStatus === f.v ? 'act' : ''}`} onClick={() => setFilterStatus(f.v === filterStatus ? 'all' : f.v)}>{f.l}</button>
            ))}
          </div>

          <button className={`chp d-flex align-items-center gap-2 ${showFilters ? 'act' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={13} /> Filters
          </button>

          <div className="d-flex gap-1.5">
            {[{ f: 'uploadedPrice', l: 'Price' }, { f: 'discountPercent', l: 'Disc%' }, { f: 'asinCode', l: 'ASIN' }].map(s => (
              <button key={s.f} className={`chp ${sortBy === s.f ? 'act' : ''}`} onClick={() => handleSort(s.f)}>
                {s.l} {sortBy === s.f ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>

          {(filterStatus !== 'all' || localSearch || filterPriceRange.min || filterPriceRange.max) && (
            <button className="chp text-red-500 border-red-100 bg-red-50" onClick={resetAllFilters} style={{ fontSize: '10px' }}><X size={12} className="me-1" /> Reset</button>
          )}

          {loading && <div className="ms-auto d-flex align-items-center gap-2 text-zinc-400" style={{ fontSize: '11px' }}><Loader2 size={14} className="animate-spin" /> Updating...</div>}
        </div>

        {/* APPLIED FILTERS BADGES */}
        {(currentSellerId || localSearch || filterStatus !== 'all' || filterPriceRange.min || filterPriceRange.max) && (
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
          <div className="px-4 py-3 bg-zinc-50 border-bottom d-flex gap-4 flex-shrink-0 align-items-center">
            <div className="d-flex align-items-center gap-2">
              <span className="text-zinc-500 fw-bold" style={{ fontSize: '10px' }}>Price Range:</span>
              <div className="d-flex align-items-center gap-1.5 bg-white p-1 rounded-2 border">
                <input type="number" className="inp-sm border-0" placeholder="Min" value={filterPriceRange.min} onChange={e => setFilterPriceRange(prev => ({ ...prev, min: e.target.value }))} />
                <span className="text-zinc-300">/</span>
                <input type="number" className="inp-sm border-0" placeholder="Max" value={filterPriceRange.max} onChange={e => setFilterPriceRange(prev => ({ ...prev, max: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* TABLE */}
        <div className="flex-grow-1 overflow-auto position-relative">
          <table className="pt">
            <thead>
              <tr>
                <th style={{ width: '40px', position: 'sticky', left: 0, zIndex: 30, background: '#fafafa', textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.size === filteredData.length && filteredData.length > 0} onChange={toggleSelectAll} style={{ width: '13px', height: '13px', cursor: 'pointer' }} />
                </th>
                <th style={{ width: '45px', position: 'sticky', left: '40px', zIndex: 30, background: '#fafafa', textAlign: 'center' }}>#</th>
                <th style={{ width: '45px', position: 'sticky', left: '85px', zIndex: 30, background: '#fff' }} onClick={() => handleSort('asinCode')}>
                  <div className="d-flex align-items-center gap-2">ASIN <Si f="asinCode" /></div>
                </th>
                <th style={{ width: '120px' }}>SKU</th>
                <th style={{ width: '100px', textAlign: 'right' }} onClick={() => handleSort('uploadedPrice')}>
                  <div className="d-flex align-items-center justify-content-end gap-2">PRICE <Si f="uploadedPrice" /></div>
                </th>
                <th style={{ width: '65px', textAlign: 'center' }} onClick={() => handleSort('discountPercent')}>
                  <div className="d-flex align-items-center justify-content-center gap-2">D% <Si f="discountPercent" /></div>
                </th>
                {dateColumns.map((date, idx) => (
                  <th key={date} style={{ width: '65px', textAlign: 'center', background: idx === dateColumns.length - 1 ? '#fff7ed' : '#fafafa', fontSize: '9px' }}>
                    {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </th>
                ))}
                <th style={{ width: '85px', textAlign: 'center', background: '#fefce8' }} onClick={() => handleSort('wowPercent')}>
                  <div className="d-flex align-items-center justify-content-center gap-2">WoW % <Si f="wowPercent" /></div>
                </th>
                <th style={{ width: '60px', textAlign: 'center' }}>TREND</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length > 0 ? filteredData.map((item, idx) => (
                <tr key={item._id || item.asinCode} className={selectedIds.has(item._id) ? 'selected' : ''}>
                  <td style={{ position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#fafafa', textAlign: 'center', zIndex: 20 }}>
                    <input type="checkbox" checked={selectedIds.has(item._id)} onChange={() => toggleSelect(item._id)} style={{ width: '13px', height: '13px', cursor: 'pointer' }} />
                  </td>
                  <td className="text-zinc-400 text-center" style={{ position: 'sticky', left: '40px', background: idx % 2 === 0 ? '#fff' : '#fafafa', zIndex: 20 }}>{idx + 1}</td>
                  <td style={{ position: 'sticky', left: '85px', background: idx % 2 === 0 ? '#fff' : '#fafafa', zIndex: 20 }}>
                    <span className="fw-bold text-primary" style={{ fontSize: '11px' }}>{item.asinCode}</span>
                  </td>
                  <td className="text-zinc-500" style={{ width: '120px', fontSize: '10px' }}>{item.sku || '—'}</td>
                  <td className="text-end fw-bold" style={{ fontSize: '11px' }}>
                    <div className="d-flex flex-column align-items-end">
                      <span style={{ color: '#16a34a' }}>
                        ₹{(item.uploadedPrice || item.currentPrice || 0).toLocaleString()}
                      </span>
                      {item.uploadedPrice > 0 && item.currentPrice > 0 && Math.abs(item.uploadedPrice - item.currentPrice) > 0.01 && (
                        <span className="badge bg-danger text-white mt-1" style={{ fontSize: '8px', padding: '1px 4px', fontWeight: 800 }}>
                          PRICE DISPUTE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-center">
                    {item.discountPercent > 0 ? (
                      <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', fontSize: '10px', padding: '2px 8px', borderRadius: '4px' }}>-{item.discountPercent}%</span>
                    ) : <span className="text-zinc-300">—</span>}
                  </td>
                  {item.dateValues.map((dv, di) => (
                    <td key={di} className={`dd text-center ${dv.price ? 'dd-has' : 'dd-no'}`}>
                      {dv.price ? '₹' + dv.price.toLocaleString() : '·'}
                    </td>
                  ))}
                  <td className="text-center" style={{ background: '#fefce8' }}>
                    {item.woWChange !== 0 ? (
                      <div className={`d-inline-flex align-items-center gap-1 fw-bold ${item.wowTrend === 'up' ? 'up' : 'dn'}`} style={{ fontSize: '11px' }}>
                        {item.wowTrend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(item.woWPercent).toFixed(1)}%
                      </div>
                    ) : <span className="st">●</span>}
                  </td>
                  <td className="text-center">
                    {item.trend === 'up' ? <TrendingUp size={16} className="up" /> : item.trend === 'down' ? <TrendingDown size={16} className="dn" /> : <Minus size={16} className="st" />}
                  </td>
                </tr>
              )) : !loading ? (
                <tr>
                  <td colSpan={11 + dateColumns.length} className="text-center py-5">
                    <IndianRupee size={48} className="text-zinc-200 mb-3" />
                    <p className="text-zinc-500 fw-medium">No matching records found</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

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
          <span className="text-zinc-500 fw-medium" style={{ fontSize: '11px' }}>
            Showing {asins.length.toLocaleString()} of {totalCount.toLocaleString()} ASINs
          </span>
          <div className="d-flex align-items-center gap-2 text-zinc-400" style={{ fontSize: '11px' }}>
            <Loader2 size={12} className={loading ? "animate-spin" : "d-none"} />
            {loading ? 'Fetching...' : hasMore ? 'Scroll for more' : 'End of records'}
          </div>
        </div>
      </div>
    </div>, document.body
  );
};

export default PriceViewModal;