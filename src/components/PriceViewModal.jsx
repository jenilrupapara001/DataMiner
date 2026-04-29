import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, TrendingUp, TrendingDown, IndianRupee, Search, Download,
  ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Minus,
  Maximize2, Minimize2, ArrowUpDown, FileSpreadsheet, FileText
} from 'lucide-react';

const PriceViewModal = ({ isOpen, onClose, asins = [] }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('currentPrice');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [timeRange, setTimeRange] = useState('2W');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Process ALL data (not just current page)
  const priceData = useMemo(() => {
    if (!asins || asins.length === 0) return [];
    const now = new Date();
    const timeRanges = { 'TW': 7, '2W': 14, '1M': 30, '3M': 90, 'ALL': 365 };
    const days = timeRanges[timeRange] || 14;
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return asins.map(asin => {
      const currentPrice = asin.currentPrice || 0;
      const mrp = asin.mrp || 0;
      const uploadedPrice = asin.uploadedPrice || 0;
      const history = asin.history || asin.weekHistory || [];
      const sortedHistory = [...history].sort((a, b) => new Date(b.date || b.week) - new Date(a.date || a.week));
      
      const currentWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      let currentWeekPrice = null;
      for (const h of sortedHistory) { if (new Date(h.date || h.week) >= currentWeekStart && h.price > 0) { currentWeekPrice = h.price; break; } }
      currentWeekPrice = currentWeekPrice || currentPrice;

      const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      let lastWeekPrice = null;
      for (const h of sortedHistory) { if (new Date(h.date || h.week) >= lastWeekStart && new Date(h.date || h.week) < currentWeekStart && h.price > 0) { lastWeekPrice = h.price; break; } }
      lastWeekPrice = lastWeekPrice || currentWeekPrice;

      let oldPrice = null;
      for (const h of sortedHistory) { if (new Date(h.date || h.week) <= cutoffDate && h.price > 0) { oldPrice = h.price; break; } }
      if (!oldPrice && sortedHistory.length > 0) oldPrice = sortedHistory[sortedHistory.length - 1].price || currentPrice;
      const previousPrice = oldPrice || currentPrice;

      return {
        ...asin,
        asinCode: asin.asinCode || '', sku: asin.sku || '', title: asin.title || '',
        uploadedPrice, currentPrice, mrp,
        discountPercent: mrp > 0 ? Math.round(((mrp - currentPrice) / mrp) * 100) : 0,
        periodChange: currentPrice - previousPrice,
        periodChangePercent: previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0,
        wowChange: currentWeekPrice - lastWeekPrice,
        wowChangePercent: lastWeekPrice > 0 ? ((currentWeekPrice - lastWeekPrice) / lastWeekPrice) * 100 : 0,
        trend: (currentPrice - previousPrice) > 0 ? 'up' : (currentPrice - previousPrice) < 0 ? 'down' : 'stable',
        wowTrend: (currentWeekPrice - lastWeekPrice) > 0 ? 'up' : (currentWeekPrice - lastWeekPrice) < 0 ? 'down' : 'stable',
      };
    });
  }, [asins, timeRange]);

  // Filter & Sort (ALL data)
  const filteredData = useMemo(() => {
    let data = [...priceData];
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(d => d.asinCode.toLowerCase().includes(q) || (d.sku || '').toLowerCase().includes(q) || (d.title || '').toLowerCase().includes(q));
    }
    if (filterStatus === 'hasPrice') data = data.filter(d => d.currentPrice > 0);
    else if (filterStatus === 'noPrice') data = data.filter(d => d.currentPrice === 0);
    else if (filterStatus === 'priceUp') data = data.filter(d => d.trend === 'up');
    else if (filterStatus === 'priceDown') data = data.filter(d => d.trend === 'down');
    else if (filterStatus === 'hasDiscount') data = data.filter(d => d.discountPercent > 0);

    data.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'currentPrice': valA = a.currentPrice; valB = b.currentPrice; break;
        case 'mrp': valA = a.mrp; valB = b.mrp; break;
        case 'discountPercent': valA = a.discountPercent; valB = b.discountPercent; break;
        case 'periodChange': valA = Math.abs(a.periodChangePercent); valB = Math.abs(b.periodChangePercent); break;
        case 'wowChange': valA = Math.abs(a.wowChangePercent); valB = Math.abs(b.wowChangePercent); break;
        case 'asinCode': return sortOrder === 'asc' ? a.asinCode.localeCompare(b.asinCode) : b.asinCode.localeCompare(a.asinCode);
        default: valA = a.currentPrice; valB = b.currentPrice;
      }
      const aEmpty = !valA || valA === 0;
      const bEmpty = !valB || valB === 0;
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
    return data;
  }, [priceData, search, filterStatus, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);
  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, sortBy, sortOrder, timeRange]);

  const stats = useMemo(() => ({
    total: filteredData.length,
    withPrice: filteredData.filter(d => d.currentPrice > 0).length,
    avgPrice: Math.round(filteredData.filter(d => d.currentPrice > 0).reduce((s, d) => s + d.currentPrice, 0) / (filteredData.filter(d => d.currentPrice > 0).length || 1)),
    up: filteredData.filter(d => d.trend === 'up').length,
    down: filteredData.filter(d => d.trend === 'down').length,
  }), [filteredData]);

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('desc'); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginatedData.map(d => d._id)));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const exportData = (format) => {
    const data = filteredData.map(d => ({
      ASIN: d.asinCode, SKU: d.sku, Title: d.title,
      'Uploaded Price': d.uploadedPrice, 'Live Price': d.currentPrice, MRP: d.mrp,
      'Discount %': d.discountPercent,
      [`${timeRange} Change %`]: d.periodChangePercent.toFixed(1) + '%',
      'WoW Change %': d.wowChangePercent.toFixed(1) + '%'
    }));
    const csv = Object.keys(data[0]).join(',') + '\n' + data.map(r => Object.values(r).join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `price_matrix_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    setShowExportMenu(false);
  };

  const SortIcon = ({ field }) => sortBy !== field ? <ArrowUpDown size={10} className="text-zinc-300" /> : sortOrder === 'asc' ? <ArrowUp size={10} className="text-zinc-700" /> : <ArrowDown size={10} className="text-zinc-700" />;
  const formatPrice = (v) => v > 0 ? '₹' + v.toLocaleString('en-IN') : '₹0';

  if (!isOpen) return null;

  return createPortal(
    <div className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${isFullscreen ? 'p-0' : 'p-3'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999 }}>
      <style>{`
        .modal-table { width: 100%; border-collapse: collapse; }
        .modal-table th { background: #fafafa; position: sticky; top: 0; z-index: 10; padding: 8px 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; border-bottom: 2px solid #e5e7eb; cursor: pointer; white-space: nowrap; }
        .modal-table th:hover { background: #f4f4f5; }
        .modal-table td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; vertical-align: middle; }
        .modal-table tr:hover td { background: #fafafa; }
        .modal-table tr.selected td { background: #eff6ff; }
        .up { color: #dc2626; } .down { color: #059669; } .stable { color: #9ca3af; }
        .chp { padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 600; cursor: pointer; border: 1.5px solid #e5e7eb; background: white; color: #71717a; white-space: nowrap; transition: all 0.15s; }
        .chp:hover { border-color: #18181b; color: #18181b; }
        .chp.act { background: #18181b; color: white; border-color: #18181b; }
        .pg { width: 28px; height: 28px; border: 1.5px solid #e5e7eb; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #52525b; }
        .pg:hover { border-color: #18181b; }
        .pg.ac { background: #18181b; color: white; border-color: #18181b; }
        .pg:disabled { opacity: 0.3; cursor: not-allowed; }
      `}</style>

      <div className={`bg-white shadow-2xl d-flex flex-column ${isFullscreen ? 'w-100 h-100 rounded-0' : ''}`}
        style={{ width: isFullscreen ? '100%' : '98%', maxWidth: isFullscreen ? 'none' : '1500px', height: isFullscreen ? '100%' : '94vh', borderRadius: isFullscreen ? '0' : '16px', overflow: 'hidden' }}>
        
        {/* Header */}
        <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center flex-shrink-0 bg-white">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 rounded-2" style={{ background: '#eef2ff', color: '#4f46e5' }}><IndianRupee size={20} /></div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '14px' }}>Price Trend Matrix</h5>
              <span className="text-zinc-500" style={{ fontSize: '11px' }}>{filteredData.length.toLocaleString()} of {priceData.length.toLocaleString()} units · Avg ₹{stats.avgPrice.toLocaleString()}</span>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {/* Export Button with Dropdown */}
            <div className="position-relative">
              <button className="chp d-flex align-items-center gap-1" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: '#2563eb', color: '#2563eb' }}>
                <Download size={12} /> Export
              </button>
              {showExportMenu && (
                <div className="position-absolute bg-white border rounded-2 shadow-lg p-1" style={{ top: '100%', right: 0, zIndex: 10, marginTop: '4px', minWidth: '160px' }}>
                  <button className="btn btn-sm btn-ghost d-flex align-items-center gap-2 w-100 text-start rounded-1" onClick={() => exportData('csv')} style={{ fontSize: '11px' }}>
                    <FileText size={14} className="text-blue-600" /> Export CSV
                  </button>
                  <button className="btn btn-sm btn-ghost d-flex align-items-center gap-2 w-100 text-start rounded-1" onClick={() => exportData('xlsx')} style={{ fontSize: '11px' }}>
                    <FileSpreadsheet size={14} className="text-green-600" /> Export Excel
                  </button>
                </div>
              )}
            </div>
            <button className="btn btn-ghost p-2 rounded-circle" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 size={16} className="text-zinc-400" /> : <Maximize2 size={16} className="text-zinc-400" />}
            </button>
            <button className="btn btn-ghost p-2 rounded-circle" onClick={onClose}><X size={18} className="text-zinc-400" /></button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-1.5 bg-zinc-50 border-bottom d-flex gap-4 flex-shrink-0" style={{ overflowX: 'auto', fontSize: '11px' }}>
          <span><strong className="text-zinc-700">{stats.total}</strong> <span className="text-zinc-400">Total</span></span>
          <span><strong className="text-red-600">{stats.up}</strong> <span className="text-zinc-400">Up</span></span>
          <span><strong className="text-green-600">{stats.down}</strong> <span className="text-zinc-400">Down</span></span>
          <span><strong className="text-indigo-600">{stats.withPrice}</strong> <span className="text-zinc-400">Priced</span></span>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 bg-white border-bottom d-flex align-items-center gap-2 flex-shrink-0 flex-wrap">
          <div className="position-relative" style={{ width: '180px' }}>
            <Search size={12} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-zinc-400" />
            <input className="form-control form-control-sm ps-4 rounded-2" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: '11px', height: '28px', border: '1.5px solid #e5e7eb' }} />
          </div>
          <div className="d-flex gap-1">
            {['TW', '2W', '1M', '3M', 'ALL'].map(r => (
              <button key={r} className={`chp ${timeRange === r ? 'act' : ''}`} onClick={() => setTimeRange(r)}>{r}</button>
            ))}
          </div>
          <div className="d-flex gap-1">
            {[{ v: 'all', l: 'All' }, { v: 'hasPrice', l: 'Has Price' }, { v: 'noPrice', l: '₹0' }, { v: 'priceUp', l: 'Up' }, { v: 'priceDown', l: 'Down' }, { v: 'hasDiscount', l: 'Discounted' }].map(f => (
              <button key={f.v} className={`chp ${filterStatus === f.v ? 'act' : ''}`} onClick={() => setFilterStatus(f.v)}>{f.l}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-grow-1 overflow-auto">
          <table className="modal-table">
            <thead>
              <tr>
                <th style={{ width: '35px' }}><input type="checkbox" checked={selectedIds.size === paginatedData.length && paginatedData.length > 0} onChange={toggleSelectAll} style={{ width: '13px', height: '13px', cursor: 'pointer' }} /></th>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ minWidth: '120px' }} onClick={() => handleSort('asinCode')}><div className="d-flex align-items-center gap-1">IDENTIFIER <SortIcon field="asinCode" /></div></th>
                <th style={{ minWidth: '70px' }}>SKU</th>
                <th style={{ minWidth: '180px' }}>PRODUCT</th>
                <th style={{ width: '85px', textAlign: 'right' }} onClick={() => handleSort('currentPrice')}><div className="d-flex align-items-center justify-content-end gap-1">LIVE <SortIcon field="currentPrice" /></div></th>
                <th style={{ width: '85px', textAlign: 'right' }} onClick={() => handleSort('mrp')}><div className="d-flex align-items-center justify-content-end gap-1">MRP <SortIcon field="mrp" /></div></th>
                <th style={{ width: '55px', textAlign: 'center' }} onClick={() => handleSort('discountPercent')}><div className="d-flex align-items-center justify-content-center gap-1">D% <SortIcon field="discountPercent" /></div></th>
                <th style={{ width: '110px', textAlign: 'center' }} onClick={() => handleSort('periodChange')}><div className="d-flex align-items-center justify-content-center gap-1">{timeRange} <SortIcon field="periodChange" /></div></th>
                <th style={{ width: '100px', textAlign: 'center', background: '#fefce8' }} onClick={() => handleSort('wowChange')}><div className="d-flex align-items-center justify-content-center gap-1">WoW <SortIcon field="wowChange" /></div></th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, idx) => (
                <tr key={item._id || item.asinCode} className={selectedIds.has(item._id) ? 'selected' : ''}>
                  <td><input type="checkbox" checked={selectedIds.has(item._id)} onChange={() => toggleSelect(item._id)} style={{ width: '13px', height: '13px', cursor: 'pointer' }} /></td>
                  <td className="text-zinc-400 text-center">{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td><span className="fw-bold text-primary" style={{ fontSize: '11px', cursor: 'pointer' }}>{item.asinCode}</span></td>
                  <td className="text-zinc-500" style={{ fontSize: '10px' }}>{item.sku || '—'}</td>
                  <td className="text-zinc-600 text-truncate" style={{ maxWidth: '180px', fontSize: '10px' }} title={item.title}>{item.title || '—'}</td>
                  <td className="text-end fw-bold">{formatPrice(item.currentPrice)}</td>
                  <td className="text-end text-zinc-500">{formatPrice(item.mrp)}</td>
                  <td className="text-center">{item.discountPercent > 0 ? <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', fontSize: '9px' }}>-{item.discountPercent}%</span> : <span className="text-zinc-300">—</span>}</td>
                  <td className="text-center">{item.periodChange !== 0 ? <span className={`fw-bold ${item.trend === 'up' ? 'up' : 'down'}`} style={{ fontSize: '10px' }}>{item.trend === 'up' ? '▲' : '▼'} {Math.abs(item.periodChangePercent).toFixed(1)}%</span> : <span className="stable">● 0%</span>}</td>
                  <td className="text-center" style={{ background: '#fefce8' }}>{item.wowChange !== 0 ? <span className={`fw-bold ${item.wowTrend === 'up' ? 'up' : 'down'}`} style={{ fontSize: '10px' }}>{item.wowTrend === 'up' ? '▲' : '▼'} {Math.abs(item.wowChangePercent).toFixed(1)}%</span> : <span className="stable">● 0%</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && <div className="text-center py-5"><IndianRupee size={40} className="text-zinc-300 mb-2" /><p className="text-zinc-500">No ASINs match your filters</p></div>}
        </div>

        {/* Pagination */}
        <div className="px-4 py-2 bg-white border-top d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-2">
            <span className="text-zinc-500" style={{ fontSize: '11px' }}>{filteredData.length > 0 ? `${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, filteredData.length)} of ${filteredData.length.toLocaleString()}` : 'No results'}</span>
            <select className="form-select form-select-sm" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ width: '70px', fontSize: '10px', height: '26px' }}>
              {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="d-flex gap-1">
            <button className="pg" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>«</button>
            <button className="pg" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={14} /></button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
              const page = start + i;
              if (page > totalPages) return null;
              return <button key={page} className={`pg ${currentPage === page ? 'ac' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>;
            })}
            <button className="pg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={14} /></button>
            <button className="pg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</button>
          </div>
        </div>
      </div>
    </div>, document.body
  );
};

export default PriceViewModal;