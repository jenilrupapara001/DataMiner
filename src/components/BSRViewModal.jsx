import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X, BarChart3, Search, Download, Maximize2, Minimize2,
  ArrowUpDown, ArrowUp, ArrowDown, FileText, Minus,
  TrendingUp, TrendingDown, SlidersHorizontal, Loader2, Store, Calendar
} from 'lucide-react';
import { asinApi, sellerApi } from '../services/api';
import InfiniteScrollSelect from './common/InfiniteScrollSelect';
import { Modal, Tag, Typography, Space, Badge } from 'antd';

const { Text } = Typography;

const C = {
  primary: '#fb4f40', primaryLight: '#fce8e6', dark: '#121b1e',
  text: '#27272a', textSecondary: '#71717a', border: '#e4e4e7',
  borderLight: '#f0f0f3', bg: '#f4f5f7', white: '#fff',
  success: '#22c55e', successBg: '#f0fdf4',
  warning: '#f59e0b', warningBg: '#fffbeb',
  danger: '#ef4444', dangerBg: '#fef2f2',
};

const parseRank = (str) => {
  if (!str || str === '0') return null;
  const m = String(str).match(/#([\d,]+)/);
  return m ? parseInt(m[1].replace(/,/g, '')) : (typeof str === 'number' ? str : null);
};

const BSRViewModal = ({ isOpen, onClose, filters = {}, searchQuery = '', sellerId: initialSellerId = '' }) => {
  const [asins, setAsins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentSellerId, setCurrentSellerId] = useState(initialSellerId);
  const [sellers, setSellers] = useState([]);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchSellers = async () => {
      try {
        const res = await sellerApi.getAll({ page: 1, limit: 1000 });
        if (res.success) setSellers(res.data.sellers || []);
      } catch (err) { console.error('Error fetching sellers for labels:', err); }
    };
    if (isOpen) fetchSellers();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setCurrentSellerId(initialSellerId);
  }, [isOpen, initialSellerId]);

  const [localSearch, setLocalSearch] = useState('');
  const [sortBy, setSortBy] = useState('mainBsr');
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterBsrRange, setFilterBsrRange] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const loaderRef = useRef(null);

  const filterKey = useMemo(() => JSON.stringify(filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters?.category, filters?.marketplace, filters?.seller, filters?.priceDispute, filters?.bsrTrend]
  );

  const fetchData = useCallback(async (pageNum, isNew = false) => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const params = {
        page: pageNum, limit: 50, seller: currentSellerId || undefined,
        search: searchQuery || undefined, ...filters,
        sortBy: 'lastScraped', sortOrder: 'desc',
        startDate: dateRange.startDate || undefined, endDate: dateRange.endDate || undefined,
      };
      const res = await asinApi.getAll(params);
      if (res && res.asins) {
        setAsins(prev => isNew ? res.asins : [...prev, ...res.asins]);
        setHasMore(res.pagination.page < res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err) { console.error('Error fetching BSR trends:', err); }
    finally { setLoading(false); }
  }, [isOpen, currentSellerId, searchQuery, filters, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    if (isOpen) { setAsins([]); setPage(1); setHasMore(true); fetchData(1, true); }
  }, [isOpen, currentSellerId, searchQuery, filterKey, dateRange.startDate, dateRange.endDate, fetchData]);

  useEffect(() => { if (page > 1) fetchData(page); }, [page, fetchData]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) setPage(prev => prev + 1);
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const fetchSellerDropdownData = useCallback(async (p = 1, s = '') => {
    try {
      const response = await sellerApi.getAll({ page: p, limit: 1000, search: s });
      if (response.success && response.data)
        return { data: response.data.sellers || [], hasMore: response.data.pagination.page < response.data.pagination.totalPages };
      return { data: [], hasMore: false };
    } catch (err) { return { data: [], hasMore: false }; }
  }, []);

  const { dateColumns, weekGroups } = useMemo(() => {
    const dates = new Set();
    asins.forEach(a => {
      const h = a.history || [];
      h.forEach(p => { if (p.date) dates.add(p.date.split('T')[0]); });
    });
    const sorted = [...dates].sort();
    const dateColumnsArray = [];
    const groups = [];
    let currentWeek = null, weekCounter = 0, currentGroup = null;
    sorted.forEach(d => {
      const dateObj = new Date(d);
      const day = dateObj.getDay();
      const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(dateObj.setDate(diff)).toISOString().split('T')[0];
      if (monday !== currentWeek) {
        currentWeek = monday; weekCounter++;
        currentGroup = { name: `W${weekCounter}`, colSpan: 0 };
        groups.push(currentGroup);
      }
      currentGroup.colSpan++;
      dateColumnsArray.push({ date: d, weekName: `W${weekCounter}`, isLastOfWeek: false });
    });
    for (let i = 0; i < dateColumnsArray.length; i++) {
      if (i === dateColumnsArray.length - 1 || dateColumnsArray[i].weekName !== dateColumnsArray[i + 1].weekName)
        dateColumnsArray[i].isLastOfWeek = true;
    }
    return { dateColumns: dateColumnsArray, weekGroups: groups };
  }, [asins]);

  const processedData = useMemo(() => {
    const now = new Date();
    return asins.map(asin => {
      const mainBsrStr = asin.bsr || '—';
      const mainBsr = parseRank(mainBsrStr) || 0;
      const history = asin.history || [];
      const bsrByDate = {};
      const subBsrHistory = asin.subBsrHistory || [];
      subBsrHistory.forEach(h => {
        if (h.date && h.rank > 0) {
          if (!bsrByDate[h.date] || h.rank < bsrByDate[h.date]) bsrByDate[h.date] = h.rank;
        }
      });
      history.forEach(h => {
        if (h.date) {
          const d = h.date.split('T')[0];
          if (!bsrByDate[d] && h.bsr > 0) bsrByDate[d] = h.bsr;
        }
      });
      const dateValues = dateColumns.map(col => ({ date: col.date, rank: bsrByDate[col.date] || null }));
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
      return { ...asin, mainBsr, mainBsrStr, dateValues, woWChange, woWPercent, trend: periodTrend, wowTrend: woWChange < 0 ? 'up' : woWChange > 0 ? 'down' : 'stable' };
    });
  }, [asins, dateColumns]);

  const filteredData = useMemo(() => {
    let data = [...processedData];
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      data = data.filter(d => (d.asinCode || '').toLowerCase().includes(q) || (d.sku || '').toLowerCase().includes(q) || (d.title || '').toLowerCase().includes(q));
    }
    if (filterStatus === 'top100') data = data.filter(d => d.mainBsr > 0 && d.mainBsr <= 100);
    else if (filterStatus === 'top1000') data = data.filter(d => d.mainBsr > 0 && d.mainBsr <= 1000);
    else if (filterStatus === 'bsrUp') data = data.filter(d => d.trend === 'up');
    else if (filterStatus === 'bsrDown') data = data.filter(d => d.trend === 'down');
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
      if (aE && bE) return 0; if (aE) return 1; if (bE) return -1;
      return sortOrder === 'asc' ? va - vb : vb - va;
    });
    return data;
  }, [processedData, localSearch, sortBy, sortOrder, filterStatus, filterBsrRange]);

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredData.length && filteredData.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredData.map(d => d._id)));
  };
  const toggleSelect = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const resetAllFilters = () => {
    setLocalSearch(''); setFilterStatus('all'); setFilterBsrRange({ min: '', max: '' });
    setSortBy('mainBsr'); setSortOrder('asc'); setDateRange({ startDate: '', endDate: '' });
  };

  const filterBadges = useMemo(() => {
    const badges = [];
    if (currentSellerId) {
      const seller = sellers.find(s => s._id === currentSellerId);
      badges.push({ key: 'seller', label: seller?.name || 'Selected Seller', icon: <Store size={10} />, onRemove: () => setCurrentSellerId('') });
    }
    if (dateRange.startDate || dateRange.endDate)
      badges.push({ key: 'date', label: `${dateRange.startDate || 'Any'} → ${dateRange.endDate || 'Any'}`, icon: <Calendar size={10} />, onRemove: () => setDateRange({ startDate: '', endDate: '' }) });
    if (localSearch)
      badges.push({ key: 'search', label: `"${localSearch}"`, icon: <Search size={10} />, onRemove: () => setLocalSearch('') });
    if (filterStatus !== 'all')
      badges.push({ key: 'status', label: filterStatus, icon: null, onRemove: () => setFilterStatus('all') });
    if (filterBsrRange.min || filterBsrRange.max)
      badges.push({ key: 'bsr', label: `${filterBsrRange.min || 1} - ${filterBsrRange.max || '∞'}`, icon: null, onRemove: () => setFilterBsrRange({ min: '', max: '' }) });
    return badges;
  }, [currentSellerId, sellers, dateRange, localSearch, filterStatus, filterBsrRange]);

  const exportAllData = async (format = 'excel') => {
    setExporting(true); setShowExportMenu(false);
    try {
      let allAsins = []; let currentPage = 1; let totalPages = 1;
      while (currentPage <= totalPages) {
        const res = await asinApi.getAll({ page: currentPage, limit: 200, seller: currentSellerId || undefined, search: searchQuery, ...filters, startDate: dateRange.startDate, endDate: dateRange.endDate });
        if (res && res.asins) { allAsins = [...allAsins, ...res.asins]; totalPages = res.pagination.totalPages; currentPage++; } else break;
      }
      const allDatesSet = new Set();
      allAsins.forEach(asin => {
        (asin.history || []).forEach(h => { if (h.date) allDatesSet.add(h.date.split('T')[0]); });
        (asin.subBsrHistory || []).forEach(h => { if (h.date) allDatesSet.add(h.date.split('T')[0]); });
      });
      const sortedDates = Array.from(allDatesSet).sort();
      const headers = ['ASIN', 'Parent ASIN', 'SKU', 'Brand Name', ...sortedDates];
      const rows = allAsins.map(asin => {
        const rankMap = new Map();
        (asin.history || []).forEach(h => { if (h.date && h.bsr) { const d = h.date.split('T')[0]; if (!rankMap.has(d) || rankMap.get(d) > h.bsr) rankMap.set(d, h.bsr); } });
        (asin.subBsrHistory || []).forEach(h => { if (h.date && h.rank) { const d = h.date.split('T')[0]; if (!rankMap.has(d) || rankMap.get(d) > h.rank) rankMap.set(d, h.rank); } });
        const row = [asin.asinCode || '', asin.parentAsin || '', asin.sku || '', asin.brand || asin.seller?.name || ''];
        sortedDates.forEach(date => { const r = rankMap.get(date); row.push(r ? `#${r.toLocaleString()}` : ''); });
        return row;
      });
      const sheetData = [headers, ...rows];
      const fileName = `bsr_trend_${new Date().toISOString().split('T')[0]}`;
      if (format === 'csv') {
        const csvContent = sheetData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `${fileName}.csv`; a.click(); URL.revokeObjectURL(url);
      } else {
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = headers.map(() => ({ wch: 15 }));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'BSRTrend'); XLSX.writeFile(wb, `${fileName}.xlsx`);
      }
    } catch (err) { console.error('Export failed', err); alert('Export failed: ' + err.message); }
    finally { setExporting(false); }
  };

  const SortIcon = ({ field }) => (
    sortBy !== field ? <ArrowUpDown size={10} style={{ color: C.border }} /> :
      sortOrder === 'asc' ? <ArrowUp size={10} style={{ color: C.primary }} /> : <ArrowDown size={10} style={{ color: C.primary }} />
  );

  if (!isOpen) return null;

  const css = `
    .bt { width:100%; border-collapse:separate; border-spacing:0; }
    .bt th { background:#fafafa; position:sticky; top:0; z-index:10; padding:5px 8px; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:${C.textSecondary}; border-bottom:2px solid #e5e7eb; white-space:nowrap; cursor:pointer; user-select:none; }
    .bt th:hover { background:#f4f4f5; }
    .bt td { padding:4px 8px; border-bottom:1px solid #f1f5f9; font-size:11px; vertical-align:middle; }
    .bt tr:hover td { background:#fafafa; }
    .bt tr.selected td { background:${C.successBg}; }
    .up { color:${C.success}; } .dn { color:${C.danger}; } .st { color:#9ca3af; }
    .chp { padding:2px 10px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:#fff; color:${C.textSecondary}; white-space:nowrap; transition:all 0.15s; line-height:26px; display:inline-flex; align-items:center; gap:4px; }
    .chp:hover { border-color:${C.dark}; color:${C.dark}; }
    .chp.act { background:${C.primary}; color:#fff; border-color:${C.primary}; }
    .dd { font-size:10px; padding:2px 6px; border-radius:4px; text-align:center; min-width:48px; }
    .dd-has { background:${C.successBg}; color:#059669; font-weight:600; }
    .dd-no { color:#d1d5db; }
    .loader-pulse { height:30px; display:flex; align-items:center; justify-content:center; gap:6px; margin:16px 0; }
    .pulse-dot { width:6px; height:6px; background:${C.primary}; border-radius:50%; animation:pulse 1.5s infinite; }
    .pulse-dot:nth-child(2) { animation-delay:0.2s; }
    .pulse-dot:nth-child(3) { animation-delay:0.4s; }
    @keyframes pulse { 0%,100% { transform:scale(1); opacity:0.3; } 50% { transform:scale(1.5); opacity:1; } }
    .bt input[type="checkbox"] { width:13px; height:13px; cursor:pointer; accent-color:${C.primary}; }
  `;

  const hasActiveFilters = filterStatus !== 'all' || localSearch || filterBsrRange.min || filterBsrRange.max || dateRange.startDate || dateRange.endDate || currentSellerId;

  return (
    <Modal
      open={isOpen} onCancel={onClose} footer={null} width={1650} centered destroyOnHidden
      closeIcon={<X size={18} />}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: 32 }}>
          <Space size={12}>
            <div style={{ background: C.successBg, padding: 8, borderRadius: 8, color: C.success, display: 'flex' }}>
              <BarChart3 size={18} />
            </div>
            <div>
              <Text strong style={{ fontSize: 15, color: C.dark }}>BSR Ranking Matrix</Text>
              <Space size={8} style={{ marginTop: 2 }}>
                <Badge count={totalCount.toLocaleString()} style={{ backgroundColor: C.border, color: C.text, fontSize: 10, fontWeight: 600, boxShadow: 'none' }} overflowCount={999999} />
                <Text type="secondary" style={{ fontSize: 11 }}>·</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>Tracking historical rankings from DB</Text>
              </Space>
            </div>
          </Space>
          <Space size={8}>
            <button className="chp" onClick={() => setShowExportMenu(!showExportMenu)} style={{ borderColor: C.success, color: C.success }} disabled={exporting}>
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Export
            </button>
            {showExportMenu && !exporting && (
              <div className="position-absolute bg-white border rounded-lg shadow-xl p-1" style={{ top: '100%', right: 0, zIndex: 100, marginTop: 4, minWidth: 160 }}>
                <button className="btn btn-sm btn-ghost d-flex align-items-center gap-3 w-100 text-start py-2 px-3" onClick={() => exportAllData('excel')} style={{ fontSize: 11, border: 'none', background: 'transparent' }}>
                  <FileText size={14} style={{ color: C.success }} /> Export Excel (.xlsx)
                </button>
                <button className="btn btn-sm btn-ghost d-flex align-items-center gap-3 w-100 text-start py-2 px-3" onClick={() => exportAllData('csv')} style={{ fontSize: 11, border: 'none', background: 'transparent' }}>
                  <FileText size={14} color="#2563eb" /> Export CSV (.csv)
                </button>
              </div>
            )}
          </Space>
        </div>
      }
      styles={{
        body: { padding: 0, background: C.white },
        mask: { backdropFilter: 'blur(6px)', background: 'rgba(15,23,42,0.3)' },
        header: { borderBottom: `1px solid ${C.borderLight}`, padding: '14px 24px', borderRadius: 0, marginBottom: 0 },
      }}
    >
      <style>{css}</style>

      <div className="px-3 py-2 border-bottom d-flex align-items-center gap-2 flex-shrink-0 flex-wrap" style={{ background: C.bg }}>
        <div className="position-relative" style={{ width: 200 }}>
          <Search size={13} className="position-absolute top-50 start-0 translate-middle-y ms-2.5 text-zinc-400" style={{ marginLeft: 10 }} />
          <input className="form-control form-control-sm ps-5 rounded-3" placeholder="Search ASIN, SKU..." value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            style={{ fontSize: 11, height: 30, border: `1.5px solid ${C.border}`, borderRadius: 6, paddingLeft: 28 }} />
        </div>
        <div style={{ width: 180 }}>
          <InfiniteScrollSelect fetchData={fetchSellerDropdownData} value={currentSellerId}
            onSelect={(sellerId) => { setCurrentSellerId(sellerId); setDateRange({ startDate: '', endDate: '' }); }}
            placeholder="Filter by Seller..." />
        </div>
        <div className="d-flex align-items-center gap-1">
          <Calendar size={12} style={{ color: C.textSecondary }} />
          <input type="date" className="form-control form-control-sm rounded-3"
            style={{ fontSize: 11, height: 30, border: `1.5px solid ${C.border}`, width: 120, borderRadius: 6 }}
            value={dateRange.startDate} onChange={e => setDateRange(prev => ({ ...prev, startDate: e.target.value }))} />
          <span style={{ color: C.border }}>–</span>
          <input type="date" className="form-control form-control-sm rounded-3"
            style={{ fontSize: 11, height: 30, border: `1.5px solid ${C.border}`, width: 120, borderRadius: 6 }}
            value={dateRange.endDate} onChange={e => setDateRange(prev => ({ ...prev, endDate: e.target.value }))} />
        </div>
        <div className="d-flex gap-1 flex-wrap">
          {[{ v: 'all', l: 'All' }, { v: 'top100', l: 'Top 100' }, { v: 'top1000', l: 'Top 1k' }, { v: 'bsrUp', l: 'Ranking ↑' }, { v: 'bsrDown', l: 'Ranking ↓' }].map(f => (
            <button key={f.v} className={`chp ${filterStatus === f.v ? 'act' : ''}`} onClick={() => setFilterStatus(f.v === filterStatus ? 'all' : f.v)}>{f.l}</button>
          ))}
        </div>
        <button className={`chp ${showFilters ? 'act' : ''}`} onClick={() => setShowFilters(!showFilters)}>
          <SlidersHorizontal size={12} /> BSR Range
        </button>
        <div className="d-flex gap-1">
          {[{ f: 'mainBsr', l: 'Main BSR' }, { f: 'wowPercent', l: 'WoW Δ' }, { f: 'asinCode', l: 'ASIN' }].map(s => (
            <button key={s.f} className={`chp ${sortBy === s.f ? 'act' : ''}`} onClick={() => handleSort(s.f)}>
              {s.l} {sortBy === s.f ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
            </button>
          ))}
        </div>
        {hasActiveFilters && (
          <button className="chp" style={{ borderColor: C.dangerBg, color: C.danger, background: C.dangerBg }} onClick={resetAllFilters}>
            <X size={12} /> Reset
          </button>
        )}
        {loading && (
          <span className="d-flex align-items-center gap-1 ms-auto" style={{ fontSize: 11, color: C.textSecondary }}>
            <Loader2 size={13} className="animate-spin" /> Fetching...
          </span>
        )}
      </div>

      {filterBadges.length > 0 && (
        <div className="px-3 py-1.5 d-flex align-items-center flex-wrap gap-1.5" style={{ background: C.bg, borderBottom: `1px solid ${C.borderLight}` }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: C.textSecondary, marginRight: 4 }}>Context</span>
          {filterBadges.map(b => (
            <div key={b.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: C.white, border: `1px solid ${C.border}`, color: C.text }}>
              {b.icon}{b.label}
              <button className="btn btn-link p-0" onClick={b.onRemove} style={{ color: C.textSecondary, lineHeight: 1, border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={10} />
              </button>
            </div>
          ))}
          <button className="btn btn-link p-0 ms-auto" onClick={resetAllFilters} style={{ fontSize: 9, fontWeight: 700, color: C.danger, textDecoration: 'none', border: 'none', background: 'transparent', cursor: 'pointer' }}>
            CLEAR ALL
          </button>
        </div>
      )}

      {showFilters && (
        <div className="px-3 py-2 d-flex gap-3 align-items-center flex-shrink-0" style={{ background: C.bg, borderBottom: `1px solid ${C.borderLight}` }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary }}>BSR Range:</span>
          <div className="d-flex align-items-center gap-1 bg-white p-1 rounded-2 border" style={{ borderColor: C.border }}>
            <input type="number" className="inp-sm border-0" placeholder="Min" value={filterBsrRange.min}
              onChange={e => setFilterBsrRange(prev => ({ ...prev, min: e.target.value }))}
              style={{ fontSize: 11, height: 28, border: 'none', borderRadius: 6, padding: '2px 10px', width: 80, outline: 'none' }} />
            <span style={{ color: C.border }}>/</span>
            <input type="number" className="inp-sm border-0" placeholder="Max" value={filterBsrRange.max}
              onChange={e => setFilterBsrRange(prev => ({ ...prev, max: e.target.value }))}
              style={{ fontSize: 11, height: 28, border: 'none', borderRadius: 6, padding: '2px 10px', width: 80, outline: 'none' }} />
          </div>
        </div>
      )}

      <div className="flex-grow-1 overflow-auto position-relative">
        <table className="bt">
          <thead>
            <tr>
              <th rowSpan={2} style={{ width: 36, position: 'sticky', left: 0, zIndex: 40, background: '#fafafa', textAlign: 'center' }}>
                <input type="checkbox" checked={selectedIds.size === filteredData.length && filteredData.length > 0} onChange={toggleSelectAll} />
              </th>
              <th rowSpan={2} style={{ width: 36, position: 'sticky', left: 36, zIndex: 40, background: '#fafafa', textAlign: 'center' }}>#</th>
              <th rowSpan={2} style={{ width: 100, position: 'sticky', left: 72, zIndex: 40, background: '#fff' }} onClick={() => handleSort('asinCode')}>
                <div className="d-flex align-items-center gap-1">ASIN <SortIcon field="asinCode" /></div>
              </th>
              <th rowSpan={2} style={{ width: 120 }}>SKU</th>
              <th rowSpan={2} style={{ width: 130, textAlign: 'right' }} onClick={() => handleSort('mainBsr')}>
                <div className="d-flex align-items-center justify-content-end gap-1">MAIN BSR <SortIcon field="mainBsr" /></div>
              </th>
              {weekGroups.map((grp, idx) => (
                <th key={grp.name} colSpan={grp.colSpan} style={{
                  textAlign: 'center', background: C.warningBg, color: '#9a3412', fontSize: 10,
                  borderRight: idx !== weekGroups.length - 1 ? `2px solid ${C.border}` : `1px solid ${C.border}`,
                  letterSpacing: '0.05em'
                }}>{grp.name}</th>
              ))}
              <th rowSpan={2} style={{ width: 75, textAlign: 'center', background: C.successBg, borderLeft: `1px solid ${C.border}` }} onClick={() => handleSort('wowPercent')}>
                <div className="d-flex align-items-center justify-content-center gap-1">WoW % <SortIcon field="wowPercent" /></div>
              </th>
              <th rowSpan={2} style={{ width: 55, textAlign: 'center' }}>TREND</th>
            </tr>
            <tr>
              {dateColumns.map((col, idx) => (
                <th key={col.date} style={{ width: 58, textAlign: 'center', background: '#fafafa', fontSize: 9, top: 32, borderRight: col.isLastOfWeek && idx !== dateColumns.length - 1 ? `2px solid ${C.border}` : 'none' }}>
                  {new Date(col.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length > 0 ? filteredData.map((item, idx) => (
              <tr key={item._id || item.asinCode} className={selectedIds.has(item._id) ? 'selected' : ''}>
                <td style={{ position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#fafafa', textAlign: 'center', zIndex: 20 }}>
                  <input type="checkbox" checked={selectedIds.has(item._id)} onChange={() => toggleSelect(item._id)} />
                </td>
                <td style={{ position: 'sticky', left: 36, background: idx % 2 === 0 ? '#fff' : '#fafafa', zIndex: 20, textAlign: 'center', color: C.textSecondary }}>{idx + 1}</td>
                <td style={{ position: 'sticky', left: 72, background: idx % 2 === 0 ? '#fff' : '#fafafa', zIndex: 20 }}>
                  <a href={item.marketplace === 'ajio' ? (item.pageUrl || `https://www.ajio.com/p/${item.asinCode}`) : item.marketplace === 'myntra' ? (item.pageUrl || 'https://www.myntra.com') : `https://www.amazon.in/dp/${item.asinCode}`}
                    target="_blank" rel="noopener noreferrer" style={{ color: C.primary, fontWeight: 600, fontSize: 11, textDecoration: 'none' }}>
                    {item.asinCode}
                  </a>
                </td>
                <td style={{ maxWidth: 120, fontSize: 10, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.sku || ''}>{item.sku || '—'}</td>
                <td className="text-end">
                  <div className="d-flex flex-column align-items-end">
                    <span className="fw-bold" style={{ fontSize: 11, color: C.success }}>{item.mainBsrStr}</span>
                    {item.category && <span style={{ color: C.textSecondary, fontSize: 9 }}>in {item.category}</span>}
                  </div>
                </td>
                {item.dateValues.map((dv, di) => {
                  const col = dateColumns[di];
                  return (
                    <td key={di} className={`dd text-center ${dv.rank ? 'dd-has' : 'dd-no'}`} style={{ borderRight: col.isLastOfWeek && di !== dateColumns.length - 1 ? `2px solid ${C.border}` : 'none' }}>
                      {dv.rank ? `#${dv.rank.toLocaleString()}` : '·'}
                    </td>
                  );
                })}
                <td className="text-center" style={{ background: C.successBg, borderLeft: `1px solid ${C.border}` }}>
                  {item.woWChange !== 0 ? (
                    <span className={`d-inline-flex align-items-center gap-1 fw-bold ${item.wowTrend === 'up' ? 'up' : 'dn'}`} style={{ fontSize: 11 }}>
                      {item.wowTrend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {Math.abs(item.woWPercent).toFixed(1)}%
                    </span>
                  ) : <span className="st">●</span>}
                </td>
                <td className="text-center">
                  {item.trend === 'up' ? <TrendingUp size={15} className="up" /> : item.trend === 'down' ? <TrendingDown size={15} className="dn" /> : <Minus size={15} className="st" />}
                </td>
              </tr>
            )) : !loading ? (
              <tr><td colSpan={11 + dateColumns.length} className="text-center py-5" style={{ color: C.textSecondary }}>
                <BarChart3 size={40} style={{ color: C.border, marginBottom: 12, opacity: 0.4 }} />
                <div style={{ fontWeight: 500 }}>No ranking data found</div>
              </td></tr>
            ) : null}
          </tbody>
        </table>
        {(loading || hasMore) && (
          <div ref={loaderRef} className="loader-pulse"><div className="pulse-dot" /><div className="pulse-dot" /><div className="pulse-dot" /></div>
        )}
      </div>

      <div className="px-3 py-2 d-flex justify-content-between align-items-center flex-shrink-0 border-top" style={{ background: C.bg }}>
        <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 500 }}>
          Showing {asins.length.toLocaleString()} of {totalCount.toLocaleString()} ASINs
        </span>
        <span style={{ fontSize: 11, color: C.textSecondary }}>
          {loading ? 'Fetching rankings...' : hasMore ? 'Scroll for more' : 'All records loaded'}
        </span>
      </div>
    </Modal>
  );
};

export default BSRViewModal;
