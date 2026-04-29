import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, TrendingUp, TrendingDown, IndianRupee, Search, Download,
  ArrowUp, ArrowDown, Minus, Maximize2, Minimize2, 
  ArrowUpDown, FileText, SlidersHorizontal
} from 'lucide-react';

const PriceViewModal = ({ isOpen, onClose, asins = [] }) => {
  // ===== FILTER & SORT STATE =====
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('currentPrice');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriceRange, setFilterPriceRange] = useState({ min: '', max: '' });
  const [filterDiscountRange, setFilterDiscountRange] = useState({ min: '', max: '' });
  const [timeRange, setTimeRange] = useState('ALL');
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
  }, [search, sortBy, sortOrder, filterStatus, filterPriceRange.min, filterPriceRange.max, filterDiscountRange.min, filterDiscountRange.max, timeRange]);

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
      const h = a.history || a.weekHistory || [];
      h.forEach(p => { if (p.date) dates.add(p.date.split('T')[0]); });
    });
    const sorted = [...dates].sort().slice(-7);
    return { dateColumns: sorted };
  }, [asins]);

  // ===== PROCESS ALL DATA =====
  const priceData = useMemo(() => {
    if (!asins?.length) return [];
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
        asinCode: asin.asinCode || '',
        sku: asin.sku || '',
        title: asin.title || '',
        currentPrice,
        mrp,
        uploadedPrice,
        discountPercent,
        dateValues,
        woWChange,
        woWPercent,
        periodChange,
        periodPercent,
        trend: periodChange > 0 ? 'up' : periodChange < 0 ? 'down' : 'stable',
        wowTrend: woWChange > 0 ? 'up' : woWChange < 0 ? 'down' : 'stable',
      };
    });
  }, [asins, dateColumns]);

  // ===== FILTER & SORT =====
  const filteredData = useMemo(() => {
    let data = [...priceData];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(d => 
        d.asinCode.toLowerCase().includes(q) || 
        (d.sku || '').toLowerCase().includes(q) || 
        (d.title || '').toLowerCase().includes(q)
      );
    }

    if (filterStatus === 'hasPrice') data = data.filter(d => d.currentPrice > 0);
    else if (filterStatus === 'noPrice') data = data.filter(d => d.currentPrice === 0);
    else if (filterStatus === 'priceUp') data = data.filter(d => d.trend === 'up');
    else if (filterStatus === 'priceDown') data = data.filter(d => d.trend === 'down');
    else if (filterStatus === 'priceChanged') data = data.filter(d => d.periodChange !== 0);
    else if (filterStatus === 'hasDiscount') data = data.filter(d => d.discountPercent > 0);
    else if (filterStatus === 'wowUp') data = data.filter(d => d.wowTrend === 'up');
    else if (filterStatus === 'wowDown') data = data.filter(d => d.wowTrend === 'down');

    if (filterPriceRange.min !== '') data = data.filter(d => d.currentPrice >= Number(filterPriceRange.min));
    if (filterPriceRange.max !== '') data = data.filter(d => d.currentPrice <= Number(filterPriceRange.max));

    if (filterDiscountRange.min !== '') data = data.filter(d => d.discountPercent >= Number(filterDiscountRange.min));
    if (filterDiscountRange.max !== '') data = data.filter(d => d.discountPercent <= Number(filterDiscountRange.max));

    data.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'currentPrice': valA = a.currentPrice; valB = b.currentPrice; break;
        case 'mrp': valA = a.mrp; valB = b.mrp; break;
        case 'uploadedPrice': valA = a.uploadedPrice; valB = b.uploadedPrice; break;
        case 'discountPercent': valA = a.discountPercent; valB = b.discountPercent; break;
        case 'periodPercent': valA = Math.abs(a.periodPercent); valB = Math.abs(b.periodPercent); break;
        case 'wowPercent': valA = Math.abs(a.woWPercent); valB = Math.abs(b.woWPercent); break;
        case 'asinCode': return sortOrder === 'asc' ? a.asinCode.localeCompare(b.asinCode) : b.asinCode.localeCompare(a.asinCode);
        default: valA = a.currentPrice; valB = b.currentPrice;
      }
      
      const aE = !valA || valA === 0, bE = !valB || valB === 0;
      if (aE && bE) return 0;
      if (aE) return 1;
      if (bE) return -1;
      
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return data;
  }, [priceData, search, sortBy, sortOrder, filterStatus, filterPriceRange, filterDiscountRange, timeRange]);

  const visibleData = useMemo(() => filteredData.slice(0, visibleCount), [filteredData, visibleCount]);

  // ===== STATS =====
  const stats = useMemo(() => ({
    total: filteredData.length,
    avgPrice: Math.round(filteredData.filter(d => d.currentPrice > 0).reduce((s, d) => s + d.currentPrice, 0) / (filteredData.filter(d => d.currentPrice > 0).length || 1)),
    up: filteredData.filter(d => d.trend === 'up').length,
    down: filteredData.filter(d => d.trend === 'down').length,
  }), [filteredData]);

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
    setFilterPriceRange({ min: '', max: '' });
    setFilterDiscountRange({ min: '', max: '' });
    setSortBy('currentPrice');
    setSortOrder('desc');
    setTimeRange('ALL');
    setVisibleCount(50);
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
    .pt th { background:#fafafa; position:sticky; top:0; z-index:10; padding:5px 7px; font-size:8.5px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#71717a; border-bottom:2px solid #e5e7eb; white-space:nowrap; cursor:pointer; }
    .pt th:hover { background:#f4f4f5; }
    .pt td { padding:4px 7px; border-bottom:1px solid #f1f5f9; font-size:10px; }
    .pt tr:hover td { background:#fafafa; }
    .pt tr.selected td { background:#eff6ff; }
    .up { color:#dc2626; } .dn { color:#059669; } .st { color:#9ca3af; }
    .chp { padding:3px 10px; border-radius:20px; font-size:10px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:#fff; color:#71717a; white-space:nowrap; transition:all 0.15s; }
    .chp:hover { border-color:#18181b; color:#18181b; }
    .chp.act { background:#18181b; color:#fff; border-color:#18181b; }
    .dd { font-size:9px; padding:1px 4px; border-radius:3px; text-align:center; min-width:50px; }
    .dd-has { background:#ecfdf5; color:#059669; font-weight:600; }
    .dd-no { color:#d1d5db; }
    .inp-sm { font-size:10px; height:26px; border:1.5px solid #e5e7eb; border-radius:6px; padding:2px 8px; width:70px; }
    .loader-pulse { height:20px; display:flex; align-items:center; justify-content:center; gap:4px; margin:20px 0; }
    .pulse-dot { width:6px; height:6px; background:#d1d5db; border-radius:50%; animation: pulse 1.5s infinite; }
    .pulse-dot:nth-child(2) { animation-delay: 0.2s; }
    .pulse-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.5); opacity: 1; } }
  `;

  const SortIcon = ({ field }) => sortBy !== field ? <ArrowUpDown size={9} className="text-zinc-300" /> : sortOrder === 'asc' ? <ArrowUp size={9} className="text-zinc-700" /> : <ArrowDown size={9} className="text-zinc-700" />;

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
            <div className="p-1.5 rounded-2" style={{ background: '#eef2ff', color: '#4f46e5' }}><IndianRupee size={18} /></div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '13px' }}>Price Trend Matrix</h5>
              <span className="text-zinc-500" style={{ fontSize: '10px' }}>
                Showing {Math.min(visibleCount, filteredData.length).toLocaleString()} of {filteredData.length.toLocaleString()} ASINs · Avg ₹{stats.avgPrice.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-1">
            <div className="position-relative">
              <button className="chp d-flex align-items-center gap-1" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: '#2563eb', color: '#2563eb' }}>
                <Download size={11} /> Export
              </button>
              {showExportMenu && (
                <div className="position-absolute bg-white border rounded-2 shadow-lg p-1" style={{ top: '100%', right: 0, zIndex: 10, marginTop: '4px', minWidth: '130px' }}>
                  <button className="btn btn-sm btn-ghost d-flex align-items-center gap-2 w-100 text-start rounded-1" onClick={exportData} style={{ fontSize: '10px' }}>
                    <FileText size={13} className="text-blue-600" /> Export CSV
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
            {[{v:'all',l:'All'},{v:'hasPrice',l:'Live'},{v:'priceUp',l:'Price ↑'},{v:'priceDown',l:'Price ↓'},{v:'hasDiscount',l:'Disc.'},{v:'wowUp',l:'WoW ↑'},{v:'wowDown',l:'WoW ↓'}].map(f => (
              <button key={f.v} className={`chp ${filterStatus === f.v ? 'act' : ''}`} onClick={() => setFilterStatus(f.v === filterStatus ? 'all' : f.v)}>{f.l}</button>
            ))}
          </div>

          <button className={`chp d-flex align-items-center gap-1 ${showFilters ? 'act' : ''}`} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={11} /> Filters
          </button>

          <div className="d-flex gap-1">
            {[{f:'currentPrice',l:'Price'},{f:'discountPercent',l:'Disc%'},{f:'wowPercent',l:'WoW'},{f:'asinCode',l:'ASIN'}].map(s => (
              <button key={s.f} className={`chp ${sortBy === s.f ? 'act' : ''}`} onClick={() => handleSort(s.f)}>
                {s.l} {sortBy === s.f ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </button>
            ))}
          </div>

          {(filterStatus !== 'all' || search || filterPriceRange.min || filterPriceRange.max) && (
            <button className="chp text-danger border-danger-subtle" onClick={resetAllFilters} style={{ fontSize: '9px' }}><X size={11} className="me-1" /> Reset</button>
          )}
        </div>

        {showFilters && (
          <div className="px-3 py-2 bg-zinc-50 border-bottom d-flex gap-3 flex-shrink-0 flex-wrap align-items-center">
            <div className="d-flex align-items-center gap-1">
              <span className="text-zinc-400" style={{ fontSize: '9px', fontWeight: 600 }}>Price:</span>
              <input type="number" className="inp-sm" placeholder="Min" value={filterPriceRange.min} onChange={e => setFilterPriceRange(prev => ({ ...prev, min: e.target.value }))} />
              <input type="number" className="inp-sm" placeholder="Max" value={filterPriceRange.max} onChange={e => setFilterPriceRange(prev => ({ ...prev, max: e.target.value }))} />
            </div>
          </div>
        )}

        {/* TABLE */}
        <div className="flex-grow-1 overflow-auto">
          <table className="pt">
            <thead>
              <tr>
                <th style={{ width: '30px', position: 'sticky', left: 0, zIndex: 20, background: '#fafafa', textAlign: 'center' }}>
                  <input type="checkbox" checked={selectedIds.size === visibleData.length && visibleData.length > 0} onChange={toggleSelectAll} style={{ width: '12px', height: '12px', cursor: 'pointer' }} />
                </th>
                <th style={{ width: '35px', position: 'sticky', left: '30px', zIndex: 20, background: '#fafafa' }}>#</th>
                <th style={{ minWidth: '110px', position: 'sticky', left: '65px', zIndex: 20, background: '#fff' }} onClick={() => handleSort('asinCode')}>
                  <div className="d-flex align-items-center gap-1">ASIN <SortIcon field="asinCode" /></div>
                </th>
                <th style={{ minWidth: '55px' }}>SKU</th>
                <th style={{ minWidth: '130px' }}>PRODUCT</th>
                <th style={{ width: '70px', textAlign: 'right' }} onClick={() => handleSort('currentPrice')}>
                  <div className="d-flex align-items-center justify-content-end gap-1">LIVE <SortIcon field="currentPrice" /></div>
                </th>
                <th style={{ width: '45px', textAlign: 'center' }} onClick={() => handleSort('discountPercent')}>
                  <div className="d-flex align-items-center justify-content-center gap-1">D% <SortIcon field="discountPercent" /></div>
                </th>
                {dateColumns.map((date, idx) => (
                  <th key={date} style={{ width: '58px', textAlign: 'center', background: idx === dateColumns.length - 1 ? '#fff7ed' : '#fafafa', fontSize: '8px' }}>
                    {new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </th>
                ))}
                <th style={{ width: '65px', textAlign: 'center', background: '#fefce8' }} onClick={() => handleSort('wowPercent')}>
                  <div className="d-flex align-items-center justify-content-center gap-1">WoW <SortIcon field="wowPercent" /></div>
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
                  <td className="text-end fw-bold" style={{ fontSize: '10px' }}>{item.currentPrice > 0 ? '₹' + item.currentPrice.toLocaleString() : '₹0'}</td>
                  <td className="text-center">
                    {item.discountPercent > 0 ? (
                      <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', fontSize: '8px', padding: '1px 5px' }}>-{item.discountPercent}%</span>
                    ) : <span className="text-zinc-300">—</span>}
                  </td>
                  {item.dateValues.map((dv, di) => (
                    <td key={di} className={`dd text-center ${dv.price ? 'dd-has' : 'dd-no'}`}>
                      {dv.price ? '₹' + dv.price.toLocaleString() : '·'}
                    </td>
                  ))}
                  <td className="text-center" style={{ background: '#fefce8' }}>
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
                    <IndianRupee size={32} className="text-zinc-300 mb-2" />
                    <p className="text-zinc-500" style={{ fontSize: '12px' }}>No ASINs match your filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
          {/* LOADER TARGET */}
          {visibleCount < filteredData.length && (
            <div ref={loaderRef} className="loader-pulse">
              <div className="pulse-dot"></div>
              <div className="pulse-dot"></div>
              <div className="pulse-dot"></div>
            </div>
          )}
        </div>

        {/* FOOTER (Simple Info) */}
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

export default PriceViewModal;