import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, BarChart3, Search, Download, Maximize2, Minimize2, 
  ArrowUpDown, ArrowUp, ArrowDown, FileText, Minus, 
  TrendingUp, TrendingDown, SlidersHorizontal
} from 'lucide-react';

const BSRViewModal = ({ isOpen, onClose, asins = [] }) => {
  // ===== FILTER & SORT STATE =====
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('mainBsr');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
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
  }, [search, sortBy, sortOrder, filterStatus]);

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

  // Helper to parse rank from "#123 in Category"
  const parseRank = (str) => {
    if (!str || str === '0') return null;
    const m = String(str).match(/#([\d,]+)/);
    return m ? parseInt(m[1].replace(/,/g, '')) : (typeof str === 'number' ? str : null);
  };

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
  const bsrData = useMemo(() => {
    if (!asins?.length) return [];
    const now = new Date();

    return asins.map(asin => {
      const mainBsr = asin.bsr || 0;
      const history = asin.history || [];

      // Build date-wise BSR map using subBsrHistory
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

      const dateValues = dateColumns.map(d => ({
        date: d,
        rank: bsrByDate[d] || null
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
        asinCode: asin.asinCode || '',
        sku: asin.sku || '',
        title: asin.title || '',
        mainBsr,
        dateValues,
        woWChange,
        woWPercent,
        trend: periodTrend,
        wowTrend: woWChange < 0 ? 'up' : woWChange > 0 ? 'down' : 'stable',
      };
    });
  }, [asins, dateColumns]);

  // ===== FILTER & SORT =====
  const filteredData = useMemo(() => {
    let data = [...bsrData];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(d => 
        d.asinCode.toLowerCase().includes(q) || 
        (d.sku || '').toLowerCase().includes(q) || 
        (d.title || '').toLowerCase().includes(q)
      );
    }

    if (filterStatus === 'top100') data = data.filter(d => d.mainBsr > 0 && d.mainBsr <= 100);
    else if (filterStatus === 'top1000') data = data.filter(d => d.mainBsr > 0 && d.mainBsr <= 1000);
    else if (filterStatus === 'bsrUp') data = data.filter(d => d.trend === 'up');
    else if (filterStatus === 'bsrDown') data = data.filter(d => d.trend === 'down');
    else if (filterStatus === 'wowUp') data = data.filter(d => d.wowTrend === 'up');
    else if (filterStatus === 'wowDown') data = data.filter(d => d.wowTrend === 'down');

    data.sort((a, b) => {
      let va, vb;
      switch (sortBy) {
        case 'mainBsr': va = a.mainBsr; vb = b.mainBsr; break;
        case 'wowPercent': va = Math.abs(a.woWPercent); vb = Math.abs(b.woWPercent); break;
        case 'asinCode': return sortOrder === 'asc' ? a.asinCode.localeCompare(b.asinCode) : b.asinCode.localeCompare(a.asinCode);
        default: va = a.mainBsr; vb = b.mainBsr;
      }
      
      const aE = !va || va === 0, bE = !vb || vb === 0;
      if (aE && bE) return 0;
      if (aE) return 1;
      if (bE) return -1;
      
      return sortOrder === 'asc' ? va - vb : vb - va;
    });

    return data;
  }, [bsrData, search, sortBy, sortOrder, filterStatus]);

  const visibleData = useMemo(() => filteredData.slice(0, visibleCount), [filteredData, visibleCount]);

  // ===== HANDLERS =====
  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
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
    setSortBy('mainBsr');
    setSortOrder('asc');
    setVisibleCount(50);
  };

  const exportData = () => {
    const headers = ['ASIN', 'SKU', 'Title', 'Main BSR', ...dateColumns.map(d => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })), 'WoW %', 'Trend'];
    const rows = filteredData.map(d => [d.asinCode, d.sku, d.title, d.mainBsr, ...d.dateValues.map(v => v.rank || ''), d.woWPercent.toFixed(1) + '%', d.trend]);
    const csv = headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `bsr_trend_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    setShowExportMenu(false);
  };

  if (!isOpen) return null;

  const css = `
    .bt { width:100%; border-collapse:separate; border-spacing:0; }
    .bt th { background:#fafafa; position:sticky; top:0; z-index:10; padding:5px 7px; font-size:8.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#71717a; border-bottom:2px solid #e5e7eb; white-space:nowrap; cursor:pointer; }
    .bt th:hover { background:#f4f4f5; }
    .bt td { padding:4px 7px; border-bottom:1px solid #f1f5f9; font-size:10px; }
    .bt tr:hover td { background:#fafafa; }
    .bt tr.selected td { background:#f0fdf4; }
    .up { color:#059669; } .dn { color:#dc2626; } .st { color:#9ca3af; }
    .chp { padding:3px 10px; border-radius:20px; font-size:10px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:#fff; color:#71717a; white-space:nowrap; transition:all 0.15s; }
    .chp:hover { border-color:#18181b; color:#18181b; }
    .chp.act { background:#18181b; color:#fff; border-color:#18181b; }
    .dd { font-size:9px; padding:1px 4px; border-radius:3px; text-align:center; min-width:50px; }
    .dd-has { background:#f0fdf4; color:#16a34a; font-weight:600; }
    .dd-no { color:#d1d5db; }
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
            <div className="p-1.5 rounded-2" style={{ background: '#ecfdf5', color: '#059669' }}><BarChart3 size={18} /></div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '13px' }}>BSR Trend Matrix</h5>
              <span className="text-zinc-500" style={{ fontSize: '10px' }}>
                Showing {Math.min(visibleCount, filteredData.length).toLocaleString()} of {filteredData.length.toLocaleString()} ASINs · {dateColumns.length} days
              </span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-1">
            <div className="position-relative">
              <button className="chp d-flex align-items-center gap-1" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: '#059669', color: '#059669' }}>
                <Download size={11} /> Export
              </button>
              {showExportMenu && (
                <div className="position-absolute bg-white border rounded-2 shadow-lg p-1" style={{ top: '100%', right: 0, zIndex: 10, marginTop: '4px', minWidth: '130px' }}>
                  <button className="btn btn-sm btn-ghost d-flex align-items-center gap-2 w-100 text-start rounded-1" onClick={exportData} style={{ fontSize: '10px' }}>
                    <FileText size={13} className="text-green-600" /> Export CSV
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
            {[{v:'all',l:'All'},{v:'top100',l:'Top 100'},{v:'top1000',l:'Top 1k'},{v:'bsrUp',l:'BSR ↑'},{v:'bsrDown',l:'BSR ↓'}].map(f => (
              <button key={f.v} className={`chp ${filterStatus === f.v ? 'act' : ''}`} onClick={() => setFilterStatus(f.v === filterStatus ? 'all' : f.v)}>{f.l}</button>
            ))}
          </div>

          <div className="d-flex gap-1">
            {[{f:'mainBsr',l:'Main BSR'},{f:'wowPercent',l:'WoW Change'},{f:'asinCode',l:'ASIN'}].map(s => (
              <button key={s.f} className={`chp ${sortBy === s.f ? 'act' : ''}`} onClick={() => handleSort(s.f)}>
                {s.l} {sortBy === s.f ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>

          {(filterStatus !== 'all' || search) && (
            <button className="chp text-danger border-danger-subtle" onClick={resetAllFilters} style={{ fontSize: '9px' }}>
              <X size={11} className="me-1" /> Reset
            </button>
          )}
        </div>

        {/* TABLE */}
        <div className="flex-grow-1 overflow-auto">
          <table className="bt">
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
                <th style={{ width: '75px', textAlign: 'right' }} onClick={() => handleSort('mainBsr')}>
                  <div className="d-flex align-items-center justify-content-end gap-1">MAIN BSR <Si f="mainBsr" /></div>
                </th>
                {dateColumns.map((date, idx) => (
                  <th key={date} style={{ width: '58px', textAlign: 'center', background: idx === dateColumns.length - 1 ? '#fff7ed' : '#fafafa', fontSize: '8px' }}>
                    {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </th>
                ))}
                <th style={{ width: '65px', textAlign: 'center', background: '#f0fdf4' }} onClick={() => handleSort('wowPercent')}>
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
                  <td className="text-end fw-bold" style={{ fontSize: '10px', color: '#7c3aed' }}>{item.mainBsr > 0 ? `#${item.mainBsr.toLocaleString()}` : '—'}</td>
                  {item.dateValues.map((dv, di) => (
                    <td key={di} className={`dd text-center ${dv.rank ? 'dd-has' : 'dd-no'}`}>
                      {dv.rank ? '#' + dv.rank.toLocaleString() : '·'}
                    </td>
                  ))}
                  <td className="text-center" style={{ background: '#f0fdf4' }}>
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
                  <td colSpan={10 + dateColumns.length} className="text-center py-5">
                    <BarChart3 size={32} className="text-zinc-300 mb-2" />
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

export default BSRViewModal;