import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, BarChart3, Search, Download, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Maximize2, Minimize2, ArrowUpDown, Trophy, Medal, FileSpreadsheet, FileText } from 'lucide-react';

const BSRViewModal = ({ isOpen, onClose, asins = [] }) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('mainBsr');
  const [sortOrder, setSortOrder] = useState('asc');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Process ALL data
  const bsrData = useMemo(() => {
    if (!asins?.length) return [];
    return asins.map(asin => {
      let subBsrRank = 0, subBsrCategory = '';
      if (asin.subBsr) {
        const m = String(asin.subBsr).match(/#([\d,]+)\s+in\s+(.+)/);
        if (m) { subBsrRank = parseInt(m[1].replace(/,/g, '')); subBsrCategory = m[2].trim(); }
      }
      if (!subBsrRank && asin.subBSRs) {
        try { const p = typeof asin.subBSRs === 'string' ? JSON.parse(asin.subBSRs) : asin.subBSRs; if (Array.isArray(p) && p.length > 0) { const m = String(p[0]).match(/#([\d,]+)\s+in\s+(.+)/); if (m) { subBsrRank = parseInt(m[1].replace(/,/g, '')); subBsrCategory = m[2].trim(); } } } catch {}
      }
      return { ...asin, asinCode: asin.asinCode || '', sku: asin.sku || '', title: asin.title || '', mainBsr: asin.bsr || 0, subBsrRank, subBsrCategory };
    });
  }, [asins]);

  const filteredData = useMemo(() => {
    let data = [...bsrData];
    if (search.trim()) { const q = search.toLowerCase(); data = data.filter(d => d.asinCode.toLowerCase().includes(q) || (d.sku || '').toLowerCase().includes(q) || d.subBsrCategory.toLowerCase().includes(q)); }
    data.sort((a, b) => {
      let va, vb;
      if (sortBy === 'mainBsr') { va = a.mainBsr; vb = b.mainBsr; } else if (sortBy === 'subBsrRank') { va = a.subBsrRank; vb = b.subBsrRank; } else return sortOrder === 'asc' ? a.asinCode.localeCompare(b.asinCode) : b.asinCode.localeCompare(a.asinCode);
      if ((!va || va === 0) && (!vb || vb === 0)) return 0;
      if (!va || va === 0) return 1;
      if (!vb || vb === 0) return -1;
      return sortOrder === 'asc' ? va - vb : vb - va;
    });
    return data;
  }, [bsrData, search, sortBy, sortOrder]);

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = useMemo(() => filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredData, currentPage, pageSize]);

  const handleSort = (f) => { if (sortBy === f) setSortOrder(p => p === 'asc' ? 'desc' : 'asc'); else { setSortBy(f); setSortOrder('asc'); } };
  const Si = ({ f }) => sortBy !== f ? <ArrowUpDown size={10} className="text-zinc-300" /> : sortOrder === 'asc' ? <ArrowUp size={10} className="text-zinc-700" /> : <ArrowDown size={10} className="text-zinc-700" />;

  const badge = (v, unit = '') => {
    if (!v || v === 0) return <span className="text-zinc-300">—</span>;
    const c = v <= 100 ? { bg: '#ecfdf5', t: '#059669', i: <Trophy size={10} /> } : v <= 1000 ? { bg: '#f0fdf4', t: '#16a34a', i: <Medal size={10} /> } : v <= 5000 ? { bg: '#fffbeb', t: '#d97706' } : { bg: '#f8fafc', t: '#64748b' };
    return <span className="badge fw-bold d-inline-flex align-items-center gap-1" style={{ background: c.bg, color: c.t, border: `1px solid ${c.t}30`, fontSize: '10px' }}>{c.i}{unit}{v.toLocaleString()}</span>;
  };

  const exportData = () => {
    const data = filteredData.map(d => ({ ASIN: d.asinCode, SKU: d.sku, Title: d.title, 'Main BSR': d.mainBsr || '', 'Sub BSR Rank': d.subBsrRank || '', 'Sub BSR Category': d.subBsrCategory || '' }));
    const csv = Object.keys(data[0]).join(',') + '\n' + data.map(r => Object.values(r).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `bsr_matrix_${new Date().toISOString().split('T')[0]}.csv`; a.click(); setShowExportMenu(false);
  };

  if (!isOpen) return null;
  const css = `.mt { width:100%; border-collapse:collapse; } .mt th { background:#fafafa; position:sticky; top:0; z-index:10; padding:8px 10px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:#71717a; border-bottom:2px solid #e5e7eb; cursor:pointer; white-space:nowrap; } .mt th:hover { background:#f4f4f5; } .mt td { padding:6px 10px; border-bottom:1px solid #f1f5f9; font-size:11px; } .mt tr:hover td { background:#fafafa; } .pg { width:28px; height:28px; border:1.5px solid #e5e7eb; background:#fff; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:600; color:#52525b; } .pg:hover { border-color:#18181b; } .pg.ac { background:#18181b; color:#fff; border-color:#18181b; } .pg:disabled { opacity:.3; cursor:not-allowed; } .chp { padding:3px 10px; border-radius:20px; font-size:10px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:#fff; color:#71717a; white-space:nowrap; } .chp:hover { border-color:#18181b; color:#18181b; }`;

  return createPortal(
    <div className={`position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center ${isFullscreen ? 'p-0' : 'p-3'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 9999 }}>
      <style>{css}</style>
      <div className={`bg-white shadow-2xl d-flex flex-column ${isFullscreen ? 'w-100 h-100 rounded-0' : ''}`}
        style={{ width: isFullscreen ? '100%' : '95%', maxWidth: isFullscreen ? 'none' : '1300px', height: isFullscreen ? '100%' : '92vh', borderRadius: isFullscreen ? '0' : '16px', overflow: 'hidden' }}>
        
        <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-3"><div className="p-2 rounded-2" style={{ background: '#ecfdf5', color: '#059669' }}><BarChart3 size={20} /></div><div><h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '14px' }}>BSR & Sub BSR Matrix</h5><span className="text-zinc-500" style={{ fontSize: '11px' }}>{filteredData.length.toLocaleString()} of {bsrData.length.toLocaleString()} ASINs</span></div></div>
          <div className="d-flex align-items-center gap-2">
            <div className="position-relative"><button className="chp d-flex align-items-center gap-1" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: '#059669', color: '#059669' }}><Download size={12} /> Export</button>{showExportMenu && <div className="position-absolute bg-white border rounded-2 shadow-lg p-1" style={{ top: '100%', right: 0, zIndex: 10, marginTop: '4px', minWidth: '140px' }}><button className="btn btn-sm btn-ghost d-flex align-items-center gap-2 w-100 text-start rounded-1" onClick={exportData} style={{ fontSize: '11px' }}><FileText size={14} className="text-blue-600" /> Export CSV</button></div>}</div>
            <button className="btn btn-ghost p-2 rounded-circle" onClick={() => setIsFullscreen(!isFullscreen)}>{isFullscreen ? <Minimize2 size={16} className="text-zinc-400" /> : <Maximize2 size={16} className="text-zinc-400" />}</button>
            <button className="btn btn-ghost p-2 rounded-circle" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="px-4 py-2 bg-white border-bottom d-flex align-items-center gap-2 flex-shrink-0">
          <div className="position-relative" style={{ width: '250px' }}><Search size={12} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-zinc-400" /><input className="form-control form-control-sm ps-4 rounded-2" placeholder="Search ASIN, SKU, Sub BSR..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: '11px', height: '28px', border: '1.5px solid #e5e7eb' }} /></div>
          <div className="d-flex gap-1">{[{ v: 'mainBsr', l: 'Main BSR' }, { v: 'subBsrRank', l: 'Sub BSR Rank' }].map(f => <button key={f.v} className={`chp ${sortBy === f.v ? 'act' : ''}`} onClick={() => handleSort(f.v)}>{f.l} {sortBy === f.v ? (sortOrder === 'asc' ? '↑' : '↓') : ''}</button>)}</div>
        </div>

        <div className="flex-grow-1 overflow-auto">
          <table className="mt"><thead><tr><th style={{ width: '40px' }}>#</th><th style={{ minWidth: '120px' }} onClick={() => handleSort('asinCode')}><div className="d-flex align-items-center gap-1">ASIN <Si f="asinCode" /></div></th><th style={{ minWidth: '70px' }}>SKU</th><th style={{ minWidth: '160px' }}>PRODUCT</th><th style={{ width: '90px', textAlign: 'center' }} onClick={() => handleSort('mainBsr')}><div className="d-flex align-items-center justify-content-center gap-1">MAIN BSR <Si f="mainBsr" /></div></th><th style={{ width: '100px', textAlign: 'center' }} onClick={() => handleSort('subBsrRank')}><div className="d-flex align-items-center justify-content-center gap-1">SUB BSR <Si f="subBsrRank" /></div></th><th style={{ minWidth: '200px' }}>SUB BSR CATEGORY</th></tr></thead>
          <tbody>
            {paginatedData.map((d, i) => (
              <tr key={d._id || d.asinCode}>
                <td className="text-zinc-400 text-center">{(currentPage - 1) * pageSize + i + 1}</td>
                <td><span className="fw-bold text-primary" style={{ fontSize: '11px' }}>{d.asinCode}</span></td>
                <td className="text-zinc-500" style={{ fontSize: '10px' }}>{d.sku || '—'}</td>
                <td className="text-zinc-600 text-truncate" style={{ maxWidth: '160px', fontSize: '10px' }} title={d.title}>{d.title || '—'}</td>
                <td className="text-center">{badge(d.mainBsr, '#')}</td>
                <td className="text-center">{badge(d.subBsrRank, '#')}</td>
                <td className="text-zinc-600" style={{ fontSize: '11px' }}>{d.subBsrCategory || <span className="text-zinc-300">—</span>}</td>
              </tr>
            ))}
          </tbody></table>
          {filteredData.length === 0 && <div className="text-center py-5"><BarChart3 size={40} className="text-zinc-300 mb-2" /><p className="text-zinc-500">No results</p></div>}
        </div>

        <div className="px-4 py-2 bg-white border-top d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-2"><span className="text-zinc-500" style={{ fontSize: '11px' }}>{filteredData.length > 0 ? `${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, filteredData.length)} of ${filteredData.length.toLocaleString()}` : 'No results'}</span><select className="form-select form-select-sm" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} style={{ width: '70px', fontSize: '10px', height: '26px' }}>{[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
          <div className="d-flex gap-1"><button className="pg" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>«</button><button className="pg" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={14} /></button>{Array.from({ length: Math.min(5, totalPages) }, (_, i) => { const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4)); const page = start + i; if (page > totalPages) return null; return <button key={page} className={`pg ${currentPage === page ? 'ac' : ''}`} onClick={() => setCurrentPage(page)}>{page}</button>; })}<button className="pg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={14} /></button><button className="pg" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>»</button></div>
        </div>
      </div>
    </div>, document.body
  );
};

export default BSRViewModal;