import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, Search, Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Maximize2, Minimize2, ArrowUpDown, MessageSquare, FileSpreadsheet, FileText } from 'lucide-react';

const RatingViewModal = ({ isOpen, onClose, asins = [] }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterLevel, setFilterLevel] = useState('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const ratingData = useMemo(() => {
    if (!asins?.length) return [];
    return asins.map(a => ({
      ...a, asinCode: a.asinCode || '', sku: a.sku || '', title: a.title || '',
      rating: parseFloat(a.rating) || 0, reviewCount: parseInt(a.reviewCount) || 0,
      stars: (parseFloat(a.rating) || 0) > 0 ? '★'.repeat(Math.round(parseFloat(a.rating) || 0)) + '☆'.repeat(5 - Math.round(parseFloat(a.rating) || 0)) : '☆☆☆☆☆'
    }));
  }, [asins]);

  const filteredData = useMemo(() => {
    let data = [...ratingData];
    if (search.trim()) { const q = search.toLowerCase(); data = data.filter(d => d.asinCode.toLowerCase().includes(q) || (d.sku || '').toLowerCase().includes(q)); }
    if (filterLevel === 'excellent') data = data.filter(d => d.rating >= 4.0);
    else if (filterLevel === 'good') data = data.filter(d => d.rating >= 3.5 && d.rating < 4.0);
    else if (filterLevel === 'poor') data = data.filter(d => d.rating > 0 && d.rating < 3.5);
    else if (filterLevel === 'noRating') data = data.filter(d => d.rating === 0);
    data.sort((a, b) => {
      let va, vb;
      if (sortBy === 'rating') { va = a.rating; vb = b.rating; } else if (sortBy === 'reviewCount') { va = a.reviewCount; vb = b.reviewCount; } else return sortOrder === 'asc' ? a.asinCode.localeCompare(b.asinCode) : b.asinCode.localeCompare(a.asinCode);
      if ((!va || va === 0) && (!vb || vb === 0)) return 0; if (!va || va === 0) return 1; if (!vb || vb === 0) return -1;
      return sortOrder === 'asc' ? va - vb : vb - va;
    });
    return data;
  }, [ratingData, search, filterLevel, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);

  const handleSort = (f) => { if (sortBy === f) setSortOrder(p => p === 'asc' ? 'desc' : 'asc'); else { setSortBy(f); setSortOrder('desc'); } };
  const Si = ({ f }) => sortBy !== f ? <ArrowUpDown size={10} className="text-zinc-300" /> : sortOrder === 'asc' ? <ArrowUp size={10} className="text-zinc-700" /> : <ArrowDown size={10} className="text-zinc-700" />;

  const rBadge = (v) => {
    if (!v || v === 0) return <span className="text-zinc-300">—</span>;
    const c = v >= 4.0 ? { bg: '#ecfdf5', t: '#059669' } : v >= 3.5 ? { bg: '#fffbeb', t: '#d97706' } : { bg: '#fef2f2', t: '#dc2626' };
    return <span className="badge fw-bold d-inline-flex align-items-center gap-1" style={{ background: c.bg, color: c.t, border: `1px solid ${c.t}30`, fontSize: '10px' }}><Star size={10} fill={c.t} /> {v.toFixed(1)}</span>;
  };

  const exportData = () => {
    const data = filteredData.map(d => ({ ASIN: d.asinCode, SKU: d.sku, Title: d.title, Rating: d.rating || '', Reviews: d.reviewCount || '' }));
    const csv = Object.keys(data[0]).join(',') + '\n' + data.map(r => Object.values(r).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `rating_matrix_${new Date().toISOString().split('T')[0]}.csv`; a.click(); setShowExportMenu(false);
  };

  if (!isOpen) return null;
  const css = `.mt2 { width:100%; border-collapse:collapse; } .mt2 th { background:#fafafa; position:sticky; top:0; z-index:10; padding:8px 10px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#71717a; border-bottom:2px solid #e5e7eb; cursor:pointer; white-space:nowrap; } .mt2 th:hover { background:#f4f4f5; } .mt2 td { padding:6px 10px; border-bottom:1px solid #f1f5f9; font-size:11px; } .mt2 tr:hover td { background:#fafafa; } .pg { width:28px; height:28px; border:1.5px solid #e5e7eb; background:#fff; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:#52525b; } .pg:hover { border-color:#18181b; } .pg.ac { background:#18181b; color:#fff; border-color:#18181b; } .pg:disabled { opacity:.3; cursor:not-allowed; } .chp { padding:3px 10px; border-radius:20px; font-size:10px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:#fff; color:#71717a; white-space:nowrap; } .chp:hover { border-color:#18181b; color:#18181b; } .chp.act { background:#18181b; color:#fff; border-color:#18181b; }`;

  return createPortal(
    <div className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${isFullscreen ? 'p-0' : 'p-3'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999 }}>
      <style>{css}</style>
      <div className={`bg-white shadow-2xl d-flex flex-column ${isFullscreen ? 'w-100 h-100 rounded-0' : ''}`}
        style={{ width: isFullscreen ? '100%' : '95%', maxWidth: isFullscreen ? 'none' : '1200px', height: isFullscreen ? '100%' : '92vh', borderRadius: isFullscreen ? '0' : '16px', overflow: 'hidden' }}>

        <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-3"><div className="p-2 rounded-2" style={{ background: '#fffbeb', color: '#d97706' }}><Star size={20} /></div><div><h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '14px' }}>Rating & Review Matrix</h5><span className="text-zinc-500" style={{ fontSize: '11px' }}>{filteredData.length.toLocaleString()} of {ratingData.length.toLocaleString()} ASINs</span></div></div>
          <div className="d-flex align-items-center gap-2">
            <div className="position-relative"><button className="chp d-flex align-items-center gap-1" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: '#d97706', color: '#d97706' }}><Download size={12} /> Export</button>{showExportMenu && <div className="position-absolute bg-white border rounded-2 shadow-lg p-1" style={{ top: '100%', right: 0, zIndex: 10, marginTop: '4px', minWidth: '140px' }}><button className="btn btn-sm btn-ghost d-flex align-items-center gap-2 w-100 text-start rounded-1" onClick={exportData} style={{ fontSize: '11px' }}><FileText size={14} className="text-blue-600" /> Export CSV</button></div>}</div>
            <button className="btn btn-ghost p-2 rounded-circle" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
            <button className="btn btn-ghost p-2 rounded-circle" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="px-4 py-2 bg-white border-bottom d-flex align-items-center gap-2 flex-shrink-0">
          <div className="position-relative" style={{ width: '200px' }}><Search size={12} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-zinc-400" /><input className="form-control form-control-sm ps-4 rounded-2" placeholder="Search ASIN, SKU..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: '11px', height: '28px', border: '1.5px solid #e5e7eb' }} /></div>
          <div className="d-flex gap-1">{[{ v: 'all', l: 'All' }, { v: 'excellent', l: '★4+' }, { v: 'good', l: '★3.5-4' }, { v: 'poor', l: '<★3.5' }, { v: 'noRating', l: 'No Rating' }].map(f => <button key={f.v} className={`chp ${filterLevel === f.v ? 'act' : ''}`} onClick={() => setFilterLevel(f.v)}>{f.l}</button>)}</div>
          <div className="d-flex gap-1">{[{ v: 'rating', l: 'Rating' }, { v: 'reviewCount', l: 'Reviews' }].map(f => <button key={f.v} className={`chp ${sortBy === f.v ? 'act' : ''}`} onClick={() => handleSort(f.v)}>{f.l} {sortBy === f.v ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</button>)}</div>
        </div>

        <div className="flex-grow-1 overflow-auto">
          <table className="mt2"><thead><tr><th style={{ width: '40px' }}>#</th><th style={{ minWidth: '120px' }} onClick={() => handleSort('asinCode')}><div className="d-flex align-items-center gap-1">ASIN <Si f="asinCode" /></div></th><th style={{ minWidth: '70px' }}>SKU</th><th style={{ minWidth: '160px' }}>PRODUCT</th><th style={{ width: '90px', textAlign: 'center' }} onClick={() => handleSort('rating')}><div className="d-flex align-items-center justify-content-center gap-1">RATING <Si f="rating" /></div></th><th style={{ width: '110px', textAlign: 'center' }}>STARS</th><th style={{ width: '100px', textAlign: 'center' }} onClick={() => handleSort('reviewCount')}><div className="d-flex align-items-center justify-content-center gap-1">REVIEWS <Si f="reviewCount" /></div></th></tr></thead>
          <tbody>
            {paginatedData.map((d, i) => (
              <tr key={d._id || d.asinCode}>
                <td className="text-zinc-400 text-center">{(currentPage - 1) * pageSize + i + 1}</td>
                <td><span className="fw-bold text-primary" style={{ fontSize: '11px' }}>{d.asinCode}</span></td>
                <td className="text-zinc-500" style={{ fontSize: '10px' }}>{d.sku || '—'}</td>
                <td className="text-zinc-600 text-truncate" style={{ maxWidth: '160px', fontSize: '10px' }} title={d.title}>{d.title || '—'}</td>
                <td className="text-center">{rBadge(d.rating)}</td>
                <td className="text-center" style={{ color: d.rating > 0 ? '#f59e0b' : '#d1d5db', fontSize: '13px', letterSpacing: '2px' }}>{d.stars}</td>
                <td className="text-center">{d.reviewCount > 0 ? <span className="d-flex align-items-center justify-content-center gap-1 fw-bold text-zinc-700"><MessageSquare size={12} /> {d.reviewCount.toLocaleString()}</span> : <span className="text-zinc-300">—</span>}</td>
              </tr>
            ))}
          </tbody></table>
          {filteredData.length === 0 && <div className="text-center py-5"><Star size={40} className="text-zinc-300 mb-2" /><p className="text-zinc-500">No results</p></div>}
        </div>

        <div className="px-4 py-2 bg-white border-top d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-2"><span className="text-zinc-500" style={{ fontSize: '11px' }}>{filteredData.length > 0 ? `${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, filteredData.length)} of ${filteredData.length.toLocaleString()}` : 'No results'}</span><select className="form-select form-select-sm" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ width: '70px', fontSize: '10px', height: '26px' }}>{[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
          <div className="d-flex gap-1"><button className="pg" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>«</button><button className="pg" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={14} /></button>{Array.from({ length: Math.min(5, totalPages) }, (_, i) => { const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4)); const page = start + i; if (page > totalPages) return null; return <button key={page} className={`pg ${currentPage === page ? 'ac' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>; })}<button className="pg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={14} /></button><button className="pg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</button></div>
        </div>
      </div>
    </div>, document.body
  );
};

export default RatingViewModal;