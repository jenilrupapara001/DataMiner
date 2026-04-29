import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Star, Search, Download, Maximize2, Minimize2, 
  ArrowUpDown, ArrowUp, ArrowDown, FileText, MessageSquare, 
  Minus, TrendingUp, TrendingDown, SlidersHorizontal
} from 'lucide-react';

const RatingViewModal = ({ isOpen, onClose, asins = [] }) => {
  // ===== FILTER & SORT STATE =====
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRatingRange, setFilterRatingRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);
  
  // ===== INFINITE SCROLL STATE =====
  const [visibleCount, setVisibleCount] = useState(50);
  const loaderRef = useRef(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ===== RESET VISIBLE COUNT ON FILTER CHANGE =====
  useEffect(() => {
    setVisibleCount(50);
  }, [search, sortBy, sortOrder, filterStatus, filterRatingRange.min, filterRatingRange.max]);

  // ===== INFINITE SCROLL OBSERVER =====
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => prev + 50);
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [isOpen]);

  // ===== GENERATE DATE COLUMNS FROM HISTORY DATA =====
  const { dateColumns } = useMemo(() => {
    const dates = new Set();
    asins.forEach(a => {
      const h = a.history || [];
      h.forEach(p => { if (p.date) dates.add(p.date.split('T')[0]); });
    });
    const sorted = [...dates].sort().slice(-7);
    return { dateColumns: sorted };
  }, [asins]);

  // ===== PROCESS ALL DATA =====
  const ratingData = useMemo(() => {
    if (!asins?.length) return [];
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
        asinCode: asin.asinCode || '',
        sku: asin.sku || '',
        title: asin.title || '',
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

  // ===== FILTER & SORT =====
  const filteredData = useMemo(() => {
    let data = [...ratingData];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(d => 
        d.asinCode.toLowerCase().includes(q) || 
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
        case 'asinCode': return sortOrder === 'asc' ? a.asinCode.localeCompare(b.asinCode) : b.asinCode.localeCompare(a.asinCode);
        default: va = a.currentRating; vb = b.currentRating;
      }
      
      const aE = !va || va === 0, bE = !vb || vb === 0;
      if (aE && bE) return 0;
      if (aE) return 1;
      if (bE) return -1;
      
      return sortOrder === 'asc' ? va - vb : vb - va;
    });

    return data;
  }, [ratingData, search, sortBy, sortOrder, filterStatus, filterRatingRange]);

  const visibleData = useMemo(() => filteredData.slice(0, visibleCount), [filteredData, visibleCount]);

  // ===== HANDLERS =====
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleData.length && visibleData.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(visibleData.map(d => d._id)));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetAllFilters = () => {
    setSearch('');
    setFilterStatus('all');
    setFilterRatingRange({ min: '', max: '' });
    setSortBy('rating');
    setSortOrder('desc');
    setVisibleCount(50);
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
    .rt th { background:#fafafa; position:sticky; top:0; z-index:10; padding:5px 7px; font-size:8.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#71717a; border-bottom:2px solid #e5e7eb; white-space:nowrap; cursor:pointer; }
    .rt th:hover { background:#f4f4f5; }
    .rt td { padding:4px 7px; border-bottom:1px solid #f1f5f9; font-size:10px; }
    .rt tr:hover td { background:#fafafa; }
    .rt tr.selected td { background:#fffbeb; }
    .up { color:#059669; } .dn { color:#dc2626; } .st { color:#9ca3af; }
    .chp { padding:3px 10px; border-radius:20px; font-size:10px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:#fff; color:#71717a; white-space:nowrap; transition:all 0.15s; }
    .chp:hover { border-color:#18181b; color:#18181b; }
    .chp.act { background:#18181b; color:#fff; border-color:#18181b; }
    .dd { font-size:9px; padding:1px 4px; border-radius:3px; text-align:center; min-width:50px; }
    .dd-has { background:#fffbeb; color:#d97706; font-weight:600; }
    .dd-no { color:#d1d5db; }
    .inp-sm { font-size:10px; height:26px; border:1.5px solid #e5e7eb; border-radius:6px; padding:2px 8px; width:70px; }
    .loader-pulse { height:20px; display:flex; align-items:center; justify-content:center; gap:4px; margin:20px 0; }
    .pulse-dot { width:6px; height:6px; background:#d1d5db; border-radius:50%; animation: pulse 1.5s infinite; }
    .pulse-dot:nth-child(2) { animation-delay: 0.2s; }
    .pulse-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.5); opacity: 1; } }
  `;

  const Si = ({ f }) => sortBy !== f ? <ArrowUpDown size={9} className="text-zinc-300" /> : sortOrder === 'asc' ? <ArrowUp size={9} className="text-zinc-700" /> : <ArrowDown size={9} className="text-zinc-700" />;

  return createPortal(
    <div className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${isFullscreen ? 'p-0' : 'p-2'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{css}</style>
      
      <div className={`bg-white shadow-2xl d-flex flex-column ${isFullscreen ? 'w-100 h-100 rounded-0' : ''}`}
        style={{ width: isFullscreen ? '100%' : '98%', maxWidth: isFullscreen ? 'none' : '1600px', height: isFullscreen ? '100%' : '95vh', borderRadius: isFullscreen ? '0' : '12px', overflow: 'hidden' }}>
        
        {/* HEADER */}
        <div className="px-3 py-2.5 border-bottom d-flex justify-content-between align-items-center flex-shrink-0 bg-white">
          <div className="d-flex align-items-center gap-2">
            <div className="p-1.5 rounded-2" style={{ background: '#fffbeb', color: '#d97706' }}><Star size={18} /></div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '13px' }}>Rating Trend Matrix</h5>
              <span className="text-zinc-500" style={{ fontSize: '10px' }}>
                Showing {Math.min(visibleCount, filteredData.length).toLocaleString()} of {filteredData.length.toLocaleString()} ASINs · {dateColumns.length} days
              </span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-1">
            <div className="position-relative">
              <button className="chp d-flex align-items-center gap-1" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: '#d97706', color: '#d97706' }}>
                <Download size={11} /> Export
              </button>
              {showExportMenu && (
                <div className="position-absolute bg-white border rounded-2 shadow-lg p-1" style={{ top: '100%', right: 0, zIndex: 10, marginTop: '4px', minWidth: '130px' }}>
                  <button className="btn btn-sm btn-ghost d-flex align-items-center gap-2 w-100 text-start rounded-1" onClick={exportData} style={{ fontSize: '10px' }}>
                    <FileText size={13} className="text-amber-600" /> Export CSV
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-ghost p-1.5 rounded-circle" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 size={15} className="text-zinc-400" /> : <Maximize2 size={15} className="text-zinc-400" />}
            </button>
            <button className="btn btn-ghost p-1.5 rounded-circle" onClick={onClose}><X size={16} className="text-zinc-400" /></button>
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="px-3 py-1.5 bg-white border-bottom d-flex align-items-center gap-2 flex-shrink-0 flex-wrap">
          <div className="position-relative" style={{ width: '180px' }}>
            <Search size={11} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-zinc-400" />
            <input className="form-control form-control-sm ps-4 rounded-2" placeholder="Search ASIN, SKU..." value={search} 
              onChange={e => setSearch(e.target.value)} style={{ fontSize: '10px', height: '26px', border: '1.5px solid #e5e7eb' }} />
          </div>

          <div className="d-flex gap-1 flex-wrap">
            {[{v:'all',l:'All'},{v:'4starPlus',l:'4★+'},{v:'lowRating',l:'< 3.5★'},{v:'ratingUp',l:'Rating ↑'},{v:'ratingDown',l:'Rating ↓'},{v:'hasReviews',l:'Reviews'}].map(f => (
              <button key={f.v} className={`chp ${filterStatus === f.v ? 'act' : ''}`} onClick={() => setFilterStatus(f.v === filterStatus ? 'all' : f.v)}>{f.l}</button>
            ))}
          </div>

          <button className={`chp d-flex align-items-center gap-1 ${showFilters ? 'act' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={11} /> Filters
          </button>

          <div className="d-flex gap-1">
            {[{f:'rating',l:'Rating'},{f:'reviews',l:'Reviews'},{f:'wowPercent',l:'WoW'},{f:'asinCode',l:'ASIN'}].map(s => (
              <button key={s.f} className={`chp ${sortBy === s.f ? 'act' : ''}`} onClick={() => handleSort(s.f)}>
                {s.l} {sortBy === s.f ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>

          {(filterStatus !== 'all' || search || filterRatingRange.min || filterRatingRange.max) && (
            <button className="chp text-danger border-danger-subtle" onClick={resetAllFilters} style={{ fontSize: '9px' }}><X size={11} className="me-1" /> Reset</button>
          )}
        </div>

        {showFilters && (
          <div className="px-3 py-2 bg-zinc-50 border-bottom d-flex gap-3 flex-shrink-0 flex-wrap align-items-center">
            <div className="d-flex align-items-center gap-1">
              <span className="text-zinc-400" style={{ fontSize: '9px', fontWeight: 600 }}>Rating:</span>
              <input type="number" step="0.1" className="inp-sm" placeholder="Min" value={filterRatingRange.min} onChange={e => setFilterRatingRange(prev => ({ ...prev, min: e.target.value }))} />
              <input type="number" step="0.1" className="inp-sm" placeholder="Max" value={filterRatingRange.max} onChange={e => setFilterRatingRange(prev => ({ ...prev, max: e.target.value }))} />
            </div>
          </div>
        )}

        {/* TABLE */}
        <div className="flex-grow-1 overflow-auto">
          <table className="rt">
            <thead>
              <tr>
                <th style={{ width: '30px', position: 'sticky', left: 0, zIndex: 20, background: '#fafafa', textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.size === visibleData.length && visibleData.length > 0} onChange={toggleSelectAll} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                </th>
                <th style={{ width: '35px', position: 'sticky', left: '30px', zIndex: 20, background: '#fafafa' }}>#</th>
                <th style={{ minWidth: '110px', position: 'sticky', left: '65px', zIndex: 20, background: '#fff' }} onClick={() => handleSort('asinCode')}>
                  <div className="d-flex align-items-center gap-1">ASIN <Si f="asinCode" /></div>
                </th>
                <th style={{ minWidth: '55px' }}>SKU</th>
                <th style={{ minWidth: '130px' }}>PRODUCT</th>
                <th style={{ width: '65px', textAlign: 'center' }} onClick={() => handleSort('rating')}>
                  <div className="d-flex align-items-center justify-content-center gap-1">RATING <Si f="rating" /></div>
                </th>
                <th style={{ width: '65px', textAlign: 'center' }} onClick={() => handleSort('reviews')}>
                  <div className="d-flex align-items-center justify-content-center gap-1">REVIEWS <Si f="reviews" /></div>
                </th>
                {dateColumns.map((date, idx) => (
                  <th key={date} style={{ width: '58px', textAlign: 'center', background: idx === dateColumns.length - 1 ? '#fff7ed' : '#fafafa', fontSize: '8px' }}>
                    {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </th>
                ))}
                <th style={{ width: '65px', textAlign: 'center', background: '#fffbeb' }} onClick={() => handleSort('wowPercent')}>
                  <div className="d-flex align-items-center justify-content-center gap-1">WoW <Si f="wowPercent" /></div>
                </th>
                <th style={{ width: '45px', textAlign: 'center' }}>TREND</th>
              </tr>
            </thead>
            <tbody>
              {visibleData.length > 0 ? visibleData.map((item, idx) => (
                <tr key={item._id || item.asinCode} className={selectedIds.has(item._id) ? 'selected' : ''}>
                  <td style={{ position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#fafafa', textAlign: 'center' }}>
                    <input type="checkbox" checked={selectedIds.has(item._id)} onChange={() => toggleSelect(item._id)} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                  </td>
                  <td className="text-zinc-400 text-center" style={{ position: 'sticky', left: '30px', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>{idx + 1}</td>
                  <td style={{ position: 'sticky', left: '65px', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <span className="fw-bold text-primary" style={{ fontSize: '10px' }}>{item.asinCode}</span>
                  </td>
                  <td className="text-zinc-500" style={{ fontSize: '9px' }}>{item.sku || '—'}</td>
                  <td className="text-zinc-600 text-truncate" style={{ maxWidth: '130px', fontSize: '9px' }} title={item.title}>{item.title || '—'}</td>
                  <td className="text-center fw-bold" style={{ fontSize: '10px' }}>
                    {item.currentRating > 0 ? (
                      <div className="d-flex align-items-center justify-content-center gap-1">
                        <Star size={10} className="text-warning fill-warning" /> {item.currentRating.toFixed(1)}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="text-center text-zinc-500" style={{ fontSize: '9px' }}>
                    {item.reviewCount > 0 ? (
                      <div className="d-flex align-items-center justify-content-center gap-1">
                        <MessageSquare size={10} /> {item.reviewCount.toLocaleString()}
                      </div>
                    ) : '—'}
                  </td>
                  {item.dateValues.map((dv, di) => (
                    <td key={di} className={`dd text-center ${dv.rating ? 'dd-has' : 'dd-no'}`}>
                      {dv.rating ? dv.rating.toFixed(1) : '·'}
                    </td>
                  ))}
                  <td className="text-center" style={{ background: '#fffbeb' }}>
                    {item.woWChange !== 0 ? (
                      <span className={`fw-bold ${item.wowTrend === 'up' ? 'up' : 'dn'}`} style={{ fontSize: '9px' }}>
                        {item.wowTrend === 'up' ? '▲' : '▼'} {Math.abs(item.woWPercent).toFixed(1)}%
                      </span>
                    ) : <span className="st">●</span>}
                  </td>
                  <td className="text-center">
                    {item.trend === 'up' ? <TrendingUp size={12} className="up" /> : item.trend === 'down' ? <TrendingDown size={12} className="dn" /> : <Minus size={12} className="st" />}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11 + dateColumns.length} className="text-center py-5">
                    <Star size={32} className="text-zinc-300 mb-2" />
                    <p className="text-zinc-500" style={{ fontSize: '12px' }}>No ASINs match your filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {visibleCount < filteredData.length && (
            <div ref={loaderRef} className="loader-pulse">
              <div className="pulse-dot"></div>
              <div className="pulse-dot"></div>
              <div className="pulse-dot"></div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-3 py-2 bg-white border-top d-flex justify-content-between align-items-center flex-shrink-0">
          <span className="text-zinc-500" style={{ fontSize: '10px' }}>
            Showing {Math.min(visibleCount, filteredData.length).toLocaleString()} of {filteredData.length.toLocaleString()} ASINs
          </span>
          <span className="text-zinc-400" style={{ fontSize: '10px' }}>Scroll to load more</span>
        </div>
      </div>
    </div>, document.body
  );
};

export default RatingViewModal;