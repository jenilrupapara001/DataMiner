import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, BarChart3, Search, Download, Maximize2, Minimize2,
  ArrowUpDown, ArrowUp, ArrowDown, FileText, Minus,
  TrendingUp, TrendingDown, SlidersHorizontal, Loader2, Store
} from 'lucide-react';
import { asinApi, sellerApi } from '../services/api';
import InfiniteScrollSelect from './common/InfiniteScrollSelect';

const BSRViewModal = ({ isOpen, onClose, filters = {}, searchQuery = '', sellerId: initialSellerId = '' }) => {
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
  const [sortBy, setSortBy] = useState('mainBsr');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBsrRange, setFilterBsrRange] = useState({ min: '', max: '' });
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
      console.error('Error fetching BSR trends:', err);
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

  // Helper to parse rank from "#123 in Category"
  const parseRank = (str) => {
    if (!str || str === '0') return null;
    const m = String(str).match(/#([\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g, '')) : (typeof str === 'number' ? str : null);
  };

  // ===== GENERATE DATE COLUMNS FROM HISTORY DATA =====
  const { dateColumns, weekGroups } = useMemo(() => {
    const dates = new Set();
    asins.forEach(a => {
      const h = a.history || [];
      h.forEach(p => { if (p.date) dates.add(p.date.split('T')[0]); });
    });
    
    // Sort ascending (oldest first)
    const sorted = [...dates].sort();
    
    const dateColumnsArray = [];
    const groups = [];
    let currentWeek = null;
    let weekCounter = 0;
    let currentGroup = null;

    sorted.forEach(d => {
      const dateObj = new Date(d);
      const day = dateObj.getDay();
      const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(dateObj.setDate(diff)).toISOString().split('T')[0];
      
      if (monday !== currentWeek) {
        currentWeek = monday;
        weekCounter++;
        currentGroup = { name: `W${weekCounter}`, colSpan: 0 };
        groups.push(currentGroup);
      }
      
      currentGroup.colSpan++;
      dateColumnsArray.push({ date: d, weekName: `W${weekCounter}` });
    });
    
    return { dateColumns: dateColumnsArray, weekGroups: groups };
  }, [asins]);

  // ===== PROCESS DATA FOR DISPLAY =====
  const processedData = useMemo(() => {
    const now = new Date();

    return asins.map(asin => {
      const mainBsrStr = asin.bsr || '—';
      const mainBsr = parseRank(mainBsrStr) || 0;
      const history = asin.history || [];

      // Build date-wise BSR map
      const bsrByDate = {};
      const subBsrHistory = asin.subBsrHistory || [];

      subBsrHistory.forEach(h => {
        if (h.date && h.rank > 0) {
          if (!bsrByDate[h.date] || h.rank < bsrByDate[h.date]) {
            bsrByDate[h.date] = h.rank;
          }
        }
      });

      history.forEach(h => {
        if (h.date) {
          const d = h.date.split('T')[0];
          if (!bsrByDate[d] && h.bsr > 0) {
            bsrByDate[d] = h.bsr;
          }
        }
      });

      const dateValues = dateColumns.map(col => ({
        date: col.date,
        rank: bsrByDate[col.date] || null
      }));

      const currentWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      let currentWeekBsr = null, lastWeekBsr = null;
      const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

      for (const h of sortedHistory) {
        const hDate = new Date(h.date);
        const rank = parseRank(h.subBsr) || h.bsr || null;
        if (hDate >= currentWeekStart && rank > 0 && !currentWeekBsr) currentWeekBsr = rank;
        else if (hDate < currentWeekStart && rank > 0 && !lastWeekBsr) lastWeekBsr = rank;
        if (currentWeekBsr && lastWeekBsr) break;
      }

      const woWChange = currentWeekBsr && lastWeekBsr ? currentWeekBsr - lastWeekBsr : 0;
      const woWPercent = lastWeekBsr ? ((woWChange / lastWeekBsr) * 100) : 0;

      const firstValid = dateValues.find(dv => dv.rank !== null);
      const lastValid = [...dateValues].reverse().find(dv => dv.rank !== null);
      const periodTrend = firstValid && lastValid ? (lastValid.rank < firstValid.rank ? 'up' : lastValid.rank > firstValid.rank ? 'down' : 'stable') : 'stable';

      return {
        ...asin,
        mainBsr,
        mainBsrStr,
        dateValues,
        woWChange,
        woWPercent,
        trend: periodTrend,
        wowTrend: woWChange < 0 ? 'up' : woWChange > 0 ? 'down' : 'stable',
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

    if (filterStatus === 'top100') data = data.filter(d => d.mainBsr > 0 && d.mainBsr <= 100);
    else if (filterStatus === 'top1000') data = data.filter(d => d.mainBsr > 0 && d.mainBsr <= 1000);
    else if (filterStatus === 'bsrUp') data = data.filter(d => d.trend === 'up');
    else if (filterStatus === 'bsrDown') data = data.filter(d => d.trend === 'down');

    // Range filtering
    if (filterBsrRange.min) data = data.filter(d => d.mainBsr >= parseInt(filterBsrRange.min));
    if (filterBsrRange.max) data = data.filter(d => d.mainBsr > 0 && d.mainBsr <= parseInt(filterBsrRange.max));

    data.sort((a, b) => {
      let va, vb;
      switch (sortBy) {
        case 'mainBsr': va = a.mainBsr; vb = b.mainBsr; break;
        case 'wowPercent': va = Math.abs(a.woWPercent); vb = Math.abs(b.woWPercent); break;
        case 'asinCode': return sortOrder === 'asc' ? (a.asinCode || '').localeCompare(b.asinCode || '') : (b.asinCode || '').localeCompare(a.asinCode || '');
        default: va = a.mainBsr; vb = b.mainBsr;
      }

      const aE = !va || va === 0, bE = !vb || vb === 0;
      if (aE && bE) return 0;
      if (aE) return 1;
      if (bE) return -1;

      return sortOrder === 'asc' ? va - vb : vb - va;
    });

    return data;
  }, [processedData, localSearch, sortBy, sortOrder, filterStatus, filterBsrRange]);

  // ===== HANDLERS =====
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
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
    setFilterBsrRange({ min: '', max: '' });
    setSortBy('mainBsr');
    setSortOrder('asc');
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

    if (filterBsrRange.min || filterBsrRange.max) {
      const label = `${filterBsrRange.min || 1} - ${filterBsrRange.max || '∞'}`;
      badges.push(
        <div key="bsr" className="badge bg-zinc-100 text-zinc-700 border border-zinc-200 d-flex align-items-center gap-1.5 py-1.5 px-2 rounded-2" style={{ fontSize: '10px' }}>
          <span className="fw-bold opacity-60 text-uppercase" style={{ fontSize: '8.5px' }}>BSR:</span>
          <span className="fw-bold">{label}</span>
          <button className="btn btn-link p-0 text-zinc-400 hover-text-red-500 transition-colors" onClick={() => setFilterBsrRange({ min: '', max: '' })}><X size={12} /></button>
        </div>
      );
    }

    return badges;
  };

  const exportData = () => {
    const headers = ['ASIN', 'SKU', 'Title', 'Main BSR', ...dateColumns.map(c => `${c.weekName} - ${new Date(c.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`), 'WoW %', 'Trend'];
    const rows = filteredData.map(d => [d.asinCode, d.sku, d.title, d.mainBsrStr, ...d.dateValues.map(v => v.rank || ''), d.woWPercent.toFixed(1) + '%', d.trend]);
    const csv = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bsr_trend_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    setShowExportMenu(false);
  };

  if (!isOpen) return null;

  const css = `
    .bt { width:100%; border-collapse:separate; border-spacing:0; }
    .bt th { background:#fafafa; position:sticky; top:0; z-index:10; padding:6px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#71717a; border-bottom:2px solid #e5e7eb; white-space:nowrap; cursor:pointer; }
    .bt th:hover { background:#f4f4f5; }
    .bt td { padding:5px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; vertical-align: middle; }
    .bt tr:hover td { background:#fafafa; }
    .bt tr.selected td { background:#f0fdf4; }
    .up { color:#059669; } .dn { color:#dc2626; } .st { color:#9ca3af; }
    .chp { padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:#fff; color:#71717a; white-space:nowrap; transition:all 0.2s; }
    .chp:hover { border-color:#18181b; color:#18181b; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .chp.act { background:#18181b; color:#fff; border-color:#18181b; }
    .dd { font-size:10px; padding:2px 6px; border-radius:4px; text-align:center; min-width:55px; }
    .dd-has { background:#f0fdf4; color:#16a34a; font-weight:600; }
    .dd-no { color:#d1d5db; }
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
            <div className="p-2 rounded-3 shadow-sm" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', color: '#059669', border: '1px solid #a7f3d0' }}>
              <BarChart3 size={20} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '15px' }}>BSR Ranking Matrix</h5>
              <div className="d-flex align-items-center gap-2 mt-0.5">
                <span className="badge bg-zinc-100 text-zinc-600 border fw-medium" style={{ fontSize: '10px' }}>
                  {totalCount.toLocaleString()} Total ASINs
                </span>
                <span className="text-zinc-400" style={{ fontSize: '10px' }}>•</span>
                <span className="text-zinc-500 fw-medium" style={{ fontSize: '10px' }}>Tracking historical rankings from DB</span>
              </div>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="position-relative">
              <button className="chp d-flex align-items-center gap-2" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: '#059669', color: '#059669' }}>
                <Download size={13} /> Export BSR
              </button>
              {showExportMenu && (
                <div className="position-absolute bg-white border rounded-3 shadow-xl p-1" style={{ top: '100%', right: 0, zIndex: 100, marginTop: '8px', minWidth: '160px' }}>
                  <button className="btn btn-sm btn-ghost d-flex align-items-center gap-3 w-100 text-start rounded-2 py-2 px-3" onClick={exportData} style={{ fontSize: '11px' }}>
                    <FileText size={15} className="text-green-600" /> Export CSV
                  </button>
                </div>
              )}
            </div>
            <div className="vr mx-1 opacity-10 d-none d-sm-block" style={{ height: '24px' }}></div>
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
            {[{ v: 'all', l: 'All' }, { v: 'top100', l: 'Top 100' }, { v: 'top1000', l: 'Top 1k' }, { v: 'bsrUp', l: 'Ranking ↑' }, { v: 'bsrDown', l: 'Ranking ↓' }].map(f => (
              <button key={f.v} className={`chp ${filterStatus === f.v ? 'act' : ''}`} onClick={() => setFilterStatus(f.v === filterStatus ? 'all' : f.v)}>{f.l}</button>
            ))}
          </div>

          <div className="d-flex gap-1.5">
            {[{ f: 'mainBsr', l: 'Main BSR' }, { f: 'wowPercent', l: 'WoW Change' }, { f: 'asinCode', l: 'ASIN' }].map(s => (
              <button key={s.f} className={`chp ${sortBy === s.f ? 'act' : ''}`} onClick={() => handleSort(s.f)}>
                {s.l} {sortBy === s.f ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>

          {(filterStatus !== 'all' || localSearch) && (
            <button className="chp text-red-500 border-red-100 bg-red-50" onClick={resetAllFilters} style={{ fontSize: '10px' }}>
              <X size={12} className="me-1" /> Reset
            </button>
          )}

          {loading && <div className="ms-auto d-flex align-items-center gap-2 text-zinc-400" style={{ fontSize: '11px' }}><Loader2 size={14} className="animate-spin" /> Fetching...</div>}
        </div>

        {/* APPLIED FILTERS BADGES */}
        {(currentSellerId || localSearch || filterStatus !== 'all' || filterBsrRange.min || filterBsrRange.max) && (
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

        {/* TABLE */}
        <div className="flex-grow-1 overflow-auto position-relative">
          <table className="bt">
            <thead>
              <tr>
                <th rowSpan={2} style={{ width: '40px', position: 'sticky', left: 0, zIndex: 40, background: '#fafafa', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>
                  <input type="checkbox" checked={selectedIds.size === filteredData.length && filteredData.length > 0} onChange={toggleSelectAll} style={{ width: '13px', height: '13px', cursor: 'pointer', accentColor: '#18181b' }} />
                </th>
                <th rowSpan={2} style={{ width: '45px', position: 'sticky', left: '40px', zIndex: 40, background: '#fafafa', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>#</th>
                <th rowSpan={2} style={{ width: '85px', position: 'sticky', left: '85px', zIndex: 40, background: '#fff', borderBottom: '1px solid #e5e7eb' }} onClick={() => handleSort('asinCode')}>
                  <div className="d-flex align-items-center gap-2">ASIN <Si f="asinCode" /></div>
                </th>
                <th rowSpan={2} style={{ width: '120px', borderBottom: '1px solid #e5e7eb' }}>SKU</th>
                <th rowSpan={2} style={{ width: '160px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }} onClick={() => handleSort('mainBsr')}>
                  <div className="d-flex align-items-center justify-content-end gap-2">MAIN BSR <Si f="mainBsr" /></div>
                </th>
                {weekGroups.map(grp => (
                  <th key={grp.name} colSpan={grp.colSpan} style={{ textAlign: 'center', background: '#fff7ed', color: '#9a3412', fontSize: '10px', borderBottom: '1px solid #e5e7eb', letterSpacing: '0.05em' }}>
                    {grp.name}
                  </th>
                ))}
                <th rowSpan={2} style={{ width: '85px', textAlign: 'center', background: '#f0fdf4', borderBottom: '1px solid #e5e7eb' }} onClick={() => handleSort('wowPercent')}>
                  <div className="d-flex align-items-center justify-content-center gap-2">WoW % <Si f="wowPercent" /></div>
                </th>
                <th rowSpan={2} style={{ width: '60px', textAlign: 'center', borderBottom: '1px solid #e5e7eb' }}>TREND</th>
              </tr>
              <tr>
                {dateColumns.map((col, idx) => (
                  <th key={col.date} style={{ width: '65px', textAlign: 'center', background: '#fafafa', fontSize: '9px', top: '34px', borderTop: 'none', borderBottom: '1px solid #e5e7eb' }}>
                    {new Date(col.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase()}
                  </th>
                ))}
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
                  <td className="text-end" style={{ width: '160px' }}>
                    <div className="d-flex flex-column align-items-end">
                      <span className="fw-bold" style={{ fontSize: '11px', color: '#7c3aed' }}>{item.mainBsrStr}</span>
                      {item.category && <span className="text-zinc-400" style={{ fontSize: '9px' }}>in {item.category}</span>}
                    </div>
                  </td>
                  {item.dateValues.map((dv, di) => (
                    <td key={di} className={`dd text-center ${dv.rank ? 'dd-has' : 'dd-no'}`}>
                      {dv.rank ? '#' + dv.rank.toLocaleString() : '·'}
                    </td>
                  ))}
                  <td className="text-center" style={{ background: '#f0fdf4' }}>
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
                    <BarChart3 size={48} className="text-zinc-200 mb-3" />
                    <p className="text-zinc-500 fw-medium">No ranking data found</p>
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
            {loading ? 'Fetching rankings...' : hasMore ? 'Scroll for more' : 'All records loaded'}
          </div>
        </div>
      </div>
    </div>, document.body
  );
};

export default BSRViewModal;