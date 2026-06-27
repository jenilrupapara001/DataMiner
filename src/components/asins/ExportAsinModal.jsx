import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Drawer, Tabs, Button, Select, Checkbox, Row, Col,
  Radio, Progress, Alert, Tag as AntTag, Space,
  Typography, Segmented, Divider, Input, Card, DatePicker,
} from 'antd';
import {
  Download, FileSpreadsheet, FileText, ListChecks,
  Database, Tag as TagIcon, FileDown, CheckCircle2,
  AlertCircle, Search, Trash2, CheckSquare,
  Package, ShoppingBag, BarChart2, Star, Shield,
  Image as ImageIcon, Layers, Clock,
} from 'lucide-react';
import { sellerApi, asinApi, exportApi } from '../../services/api';

const { Text, Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;

// ─── Category metadata (icon + colour) ──────────────────────────────────────
const CATEGORY_META = {
  Basic:       { icon: <Package size={11} />,      color: '#6366f1', bg: '#ede9fe' },
  Pricing:     { icon: <ShoppingBag size={11} />,  color: '#d97706', bg: '#fef3c7' },
  Performance: { icon: <BarChart2 size={11} />,    color: '#059669', bg: '#d1fae5' },
  LQS:         { icon: <Star size={11} />,          color: '#7c3aed', bg: '#f5f3ff' },
  BuyBox:      { icon: <Shield size={11} />,        color: '#2563eb', bg: '#dbeafe' },
  Content:     { icon: <ImageIcon size={11} />,    color: '#db2777', bg: '#fce7f3' },
  Inventory:   { icon: <Layers size={11} />,        color: '#ea580c', bg: '#ffedd5' },
  Dates:       { icon: <Clock size={11} />,         color: '#475569', bg: '#f1f5f9' },
};

const ALL_ASIN_FIELDS = [
  { key: 'asinCode',           label: 'ASIN Code',            category: 'Basic' },
  { key: 'parentAsin',         label: 'Parent ASIN',          category: 'Basic' },
  { key: 'sku',                label: 'SKU',                  category: 'Basic' },
  { key: 'title',              label: 'Product Title',        category: 'Basic' },
  { key: 'brand',              label: 'Brand',                category: 'Basic' },
  { key: 'category',           label: 'Category',             category: 'Basic' },
  { key: 'status',             label: 'Status',               category: 'Basic' },
  { key: 'tags',               label: 'Tags',                 category: 'Basic' },
  { key: 'releaseDate',        label: 'Release Date',         category: 'Basic' },
  { key: 'uploadedPrice',      label: 'Master Price (₹)',     category: 'Pricing' },
  { key: 'currentPrice',       label: 'Current Price (₹)',    category: 'Pricing' },
  { key: 'mrp',                label: 'MRP (₹)',              category: 'Pricing' },
  { key: 'dealBadge',          label: 'Deal Badge',           category: 'Pricing' },
  { key: 'priceDispute',       label: 'Price Dispute',        category: 'Pricing' },
  { key: 'discountPercentage', label: 'Discount %',           category: 'Pricing' },
  { key: 'secondAsp',          label: 'Second ASP (₹)',       category: 'Pricing' },
  { key: 'bsr',                label: 'BSR',                  category: 'Performance' },
  { key: 'totalOrders',        label: 'Total Orders',         category: 'Performance' },
  { key: 'subBsr',             label: 'Sub BSR',              category: 'Performance' },
  { key: 'rating',             label: 'Rating',               category: 'Performance' },
  { key: 'reviewCount',        label: 'Review Count',         category: 'Performance' },
  { key: 'ratingBreakdown',    label: 'Rating Breakdown',     category: 'Performance' },
  { key: 'lqs',                label: 'LQS Score',            category: 'Performance' },
  { key: 'titleScore',         label: 'Title Score',          category: 'LQS' },
  { key: 'bulletScore',        label: 'Bullet Score',         category: 'LQS' },
  { key: 'imageScore',         label: 'Image Score',          category: 'LQS' },
  { key: 'descriptionScore',   label: 'Desc Score',           category: 'LQS' },
  { key: 'buyBoxWin',          label: 'BuyBox Winner',        category: 'BuyBox' },
  { key: 'soldBy',             label: 'BuyBox Seller',        category: 'BuyBox' },
  { key: 'soldBySec',          label: 'Other BuyBox Seller',  category: 'BuyBox' },
  { key: 'hasAplus',           label: 'A+ Content',           category: 'Content' },
  { key: 'imagesCount',        label: 'Image Count',          category: 'Content' },
  { key: 'videoCount',         label: 'Video Count',          category: 'Content' },
  { key: 'bulletPoints',       label: 'Bullet Points Count',  category: 'Content' },
  { key: 'bulletPointsText',   label: 'Bullet Points Text',   category: 'Content' },
  { key: 'aplusAbsentSince',   label: 'A+ Days Absent',       category: 'Content' },
  { key: 'availabilityStatus', label: 'Availability',         category: 'Inventory' },
  { key: 'stockLevel',         label: 'Stock Level',          category: 'Inventory' },
  { key: 'lastScraped',        label: 'Last Scraped',         category: 'Dates' },
  { key: 'createdAt',          label: 'Created At',           category: 'Dates' },
  { key: 'updatedAt',          label: 'Updated At',           category: 'Dates' },
];

const FIELD_CATEGORIES = [...new Set(ALL_ASIN_FIELDS.map(f => f.category))];

const FILTER_LABEL_MAP = {
  sku: 'SKU', parentAsin: 'Parent ASIN', scrapeStatus: 'Scrape Status',
  brand: 'Brand', category: 'Category', subBsrCategory: 'Sub BSR',
  buyBoxWin: 'BuyBox', hasAplus: 'A+', hasVideo: 'Video', hasDeal: 'Deal',
  minPrice: 'Min ₹', maxPrice: 'Max ₹', minBSR: 'Min BSR', maxBSR: 'Max BSR',
  minRating: 'Min ⭐', maxRating: 'Max ⭐', priceDispute: 'Price Dispute',
  bsrTrend: 'BSR Trend', ratingTrend: 'Rating Trend', status: 'Status',
};

const getProgressLabel = (pct) => {
  if (pct >= 95) return 'Finalizing file…';
  if (pct >= 30) return 'Processing records…';
  if (pct >= 20) return 'Applying filters…';
  if (pct >= 5)  return 'Starting export…';
  return 'Initializing…';
};

// ─── Component ───────────────────────────────────────────────────────────────
const ExportAsinModal = ({
  isOpen, onClose,
  currentFilters = {}, searchQuery = '',
  selectedSeller = null, selectedIds = [],
}) => {

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeTab,         setActiveTab]         = useState('export');
  const [step,              setStep]              = useState(1);

  const [sellers,           setSellers]           = useState([]);
  const [selectedSellerIds, setSelectedSellerIds] = useState(selectedSeller ? [selectedSeller] : []);

  const [selectedFields,    setSelectedFields]    = useState([
    'asinCode', 'parentAsin', 'sku', 'title', 'brand', 'category',
    'currentPrice', 'mrp', 'bsr', 'rating', 'reviewCount', 'lqs', 'soldBy', 'tags',
  ]);
  const [fieldCatFilter,    setFieldCatFilter]    = useState('All');
  const [fieldSearch,       setFieldSearch]       = useState('');

  const [exportFormat,      setExportFormat]      = useState('csv');
  const [dateOption,        setDateOption]        = useState('all');
  const [customDateRange,   setCustomDateRange]   = useState(null);
  const [exportType,        setExportType]        = useState(selectedIds.length > 0 ? 'selected' : 'filtered');
  const [marketplace,       setMarketplace]       = useState('amazon');

  const [exporting,         setExporting]         = useState(false);
  const [exportProgress,    setExportProgress]    = useState(0);
  const [error,             setError]             = useState(null);
  const pollCancelledRef = useRef(false);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { return () => { pollCancelledRef.current = true; }; }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchSellers();
    setStep(1); setError(null); setExportProgress(0); setExporting(false);
    setFieldSearch(''); setFieldCatFilter('All');
    setSelectedSellerIds(selectedSeller ? [selectedSeller] : []);
    setMarketplace('amazon');
    setExportType(selectedIds.length > 0 ? 'selected' : 'filtered');

    const base = new Set([
      'asinCode', 'parentAsin', 'sku', 'title', 'brand', 'category',
      'currentPrice', 'mrp', 'bsr', 'rating', 'reviewCount', 'lqs', 'soldBy', 'tags',
    ]);
    if (currentFilters) {
      if (currentFilters.priceDispute)
        ['uploadedPrice', 'dealBadge', 'priceDispute', 'discountPercentage', 'secondAsp'].forEach(f => base.add(f));
      if (currentFilters.buyBoxWin)
        ['buyBoxWin', 'soldBy', 'soldBySec'].forEach(f => base.add(f));
      if (currentFilters.hasAplus)   base.add('hasAplus');
      if (currentFilters.scrapeStatus) ['scrapeStatus', 'lastScraped'].forEach(f => base.add(f));
      if (currentFilters.bsrTrend)   ['bsr', 'subBsr'].forEach(f => base.add(f));
      if (currentFilters.ratingTrend) ['rating', 'reviewCount'].forEach(f => base.add(f));
      if (currentFilters.hasVideo)   base.add('videoCount');
      if (currentFilters.hasDeal)    base.add('dealBadge');
      if (currentFilters.minTitleScore || currentFilters.minBulletScore ||
          currentFilters.minImageScore  || currentFilters.minDescriptionScore)
        ['titleScore', 'bulletScore', 'imageScore', 'descriptionScore'].forEach(f => base.add(f));
    }
    setSelectedFields(Array.from(base));
  }, [isOpen, selectedSeller, selectedIds, currentFilters]);

  const fetchSellers = async () => {
    try {
      const res = await sellerApi.getAll({ limit: 500, page: 1 });
      if (res.success) setSellers(res.data?.sellers || []);
    } catch (e) { console.error(e); }
  };

  // ── Computed ───────────────────────────────────────────────────────────────
  const sellerOptions = useMemo(() => {
    const list = sellers.filter(s => {
      if (marketplace === 'all') return true;
      const m = (s.marketplace || '').toLowerCase();
      return marketplace === 'ajio' ? m === 'ajio' : m !== 'ajio';
    });
    const opts = list.map(s => ({
      label: `${s.name} ${s.sellerId}`,
      value: s._id || s.Id,
      meta: { name: s.name, sellerId: s.sellerId, marketplace: s.marketplace || 'amazon.in' },
    }));
    if (opts.length > 0) {
      opts.unshift({
        label: 'Select All Sellers',
        value: 'SELECT_ALL',
        meta: null,
      });
    }
    return opts;
  }, [sellers, marketplace]);

  // Fields matching the search query (null = no search)
  const searchKeys = useMemo(() => {
    if (!fieldSearch.trim()) return null;
    const q = fieldSearch.toLowerCase();
    return new Set(ALL_ASIN_FIELDS.filter(f => f.label.toLowerCase().includes(q)).map(f => f.key));
  }, [fieldSearch]);

  // Flat list of visible fields (for single-category view)
  const visibleFields = useMemo(() => {
    const base = fieldCatFilter === 'All'
      ? ALL_ASIN_FIELDS
      : ALL_ASIN_FIELDS.filter(f => f.category === fieldCatFilter);
    return searchKeys ? base.filter(f => searchKeys.has(f.key)) : base;
  }, [fieldCatFilter, searchKeys]);

  // Grouped fields for the "All" view
  const fieldGroups = useMemo(() => {
    if (fieldCatFilter !== 'All') return null;
    const map = {};
    visibleFields.forEach(f => { (map[f.category] = map[f.category] || []).push(f); });
    return FIELD_CATEGORIES.map(cat => ({ cat, fields: map[cat] || [] })).filter(g => g.fields.length > 0);
  }, [fieldCatFilter, visibleFields]);

  const isAllSelected = selectedFields.length === ALL_ASIN_FIELDS.length;

  // Active filter tags
  const activeFilterTags = useMemo(() => {
    const items = [];
    if (searchQuery) items.push({ key: '_q', label: `"${searchQuery}"`, color: 'gold' });
    if (currentFilters) {
      Object.entries(FILTER_LABEL_MAP).forEach(([k, lbl]) => {
        const v = currentFilters[k];
        if (v !== undefined && v !== null && v !== '' && v !== false) {
          const display = v === 'true' || v === true ? 'Yes' : v === 'false' || v === false ? 'No' : v;
          items.push({ key: k, label: `${lbl}: ${display}`, color: 'default' });
        }
      });
      (currentFilters.selectedTags || []).forEach(t =>
        items.push({ key: `tag_${t}`, label: t, color: 'purple' })
      );
    }
    return items;
  }, [currentFilters, searchQuery]);

  const isHistoricalRange = dateOption === '7days' || dateOption === '30days' ||
    (dateOption === 'custom' && customDateRange &&
      customDateRange[0]?.toISOString().split('T')[0] !== customDateRange[1]?.toISOString().split('T')[0]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleField = (key) => {
    setSelectedFields(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const toggleCategory = (cat) => {
    const keys = ALL_ASIN_FIELDS.filter(f => f.category === cat).map(f => f.key);
    const allSel = keys.every(k => selectedFields.includes(k));
    setSelectedFields(prev => allSel ? prev.filter(k => !keys.includes(k)) : [...new Set([...prev, ...keys])]);
  };

  const toggleAll = () => {
    if (isAllSelected) setSelectedFields(['asinCode', 'title', 'currentPrice']);
    else setSelectedFields(ALL_ASIN_FIELDS.map(f => f.key));
  };

  const handleExport = async () => {
    if (exportType === 'selected' && selectedIds.length === 0) {
      setError('No items selected to export'); return;
    }
    if (selectedFields.length === 0) {
      setError('Please select at least one field'); return;
    }

    setExporting(true); setStep(2); setError(null); setExportProgress(0);

    try {
      const now = new Date();
      const toISODate = d => d.toISOString().split('T')[0];
      let exportDateRange = dateOption;
      let isHistorical = false;

      if (dateOption === '7days') {
        const s = new Date(now); s.setDate(s.getDate() - 7);
        exportDateRange = { start: s.toISOString(), end: now.toISOString() };
        isHistorical = true;
      } else if (dateOption === '30days') {
        const s = new Date(now); s.setDate(s.getDate() - 30);
        exportDateRange = { start: s.toISOString(), end: now.toISOString() };
        isHistorical = true;
      } else if (dateOption === 'custom' && customDateRange) {
        exportDateRange = { start: customDateRange[0].toISOString(), end: customDateRange[1].toISOString() };
        if (toISODate(customDateRange[0]) !== toISODate(customDateRange[1])) isHistorical = true;
      }

      const exportParams = { fields: selectedFields, format: exportFormat, dateRange: exportDateRange, sellerIds: selectedSellerIds, isHistorical };

      if (exportType === 'selected') {
        exportParams.asinIds = selectedIds;
      } else {
        exportParams.search = searchQuery;
        if (currentFilters) {
          Object.keys(currentFilters).forEach(key => {
            if (currentFilters[key] !== undefined && currentFilters[key] !== '') {
              if (key === 'selectedTags') exportParams.tags = currentFilters[key];
              else exportParams[key] = currentFilters[key];
            }
          });
        }
        if (selectedSeller && selectedSellerIds.length === 0) exportParams.sellerIds = [selectedSeller];
      }

      const res = await exportApi.startExport(exportParams);
      if (!res.success) throw new Error(res.error || 'Failed to start export');

      const { downloadId } = res;
      pollCancelledRef.current = false;
      let pollCount = 0;
      const MAX_POLLS = 150;

      const poll = async () => {
        if (pollCancelledRef.current) return;
        if (pollCount >= MAX_POLLS) {
          setError('Export timed out. Check Downloads for status.');
          setStep(1); setExporting(false); return;
        }
        pollCount++;
        try {
          const statusRes = await exportApi.getExportStatus(downloadId);
          if (pollCancelledRef.current) return;
          if (statusRes.success) {
            const { Status, Progress, ErrorMessage } = statusRes.data;
            setExportProgress(Progress || 0);
            if (Status === 'completed') {
              setExportProgress(100);
              setTimeout(async () => {
                if (pollCancelledRef.current) return;
                try {
                  const blob = await exportApi.downloadFile(downloadId);
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = statusRes.data.FileName || `asin_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                  setExporting(false); setTimeout(onClose, 800);
                } catch {
                  setError('File ready but download failed. Check Downloads drawer.');
                  setStep(1); setExporting(false);
                }
              }, 500);
            } else if (Status === 'failed') {
              setError(ErrorMessage || 'Export generation failed');
              setStep(1); setExporting(false);
            } else {
              setTimeout(poll, 2000);
            }
          }
        } catch {
          setError('Lost connection. Check Downloads drawer for status.');
          setStep(1); setExporting(false);
        }
      };
      poll();
    } catch (err) {
      setError(err.message); setStep(1); setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try { await asinApi.downloadTagsTemplate(); } catch (e) { console.error(e); }
  };

  // ── Field chip renderer ────────────────────────────────────────────────────
  const FieldChip = ({ field }) => {
    const active = selectedFields.includes(field.key);
    return (
      <div className={`field-chip${active ? ' selected' : ''}`} onClick={() => toggleField(field.key)}>
        <Checkbox checked={active} style={{ pointerEvents: 'none' }} tabIndex={-1} />
        <span className="field-chip-label">{field.label}</span>
      </div>
    );
  };

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <Drawer
      open={isOpen}
      onClose={() => { if (!exporting) onClose(); }}
      closable={!exporting}
      className="export-drawer-v2"
      styles={{
        wrapper: { width: 820 },
        header: { padding: '14px 20px', borderBottom: '1px solid #e2e8f0' },
        body:   { padding: 0, background: '#f8fafc', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
        footer: { padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: 'white' },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Space size={12}>
            <div className="drawer-icon"><Download size={17} /></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>Export Center</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Configure and download your product data</div>
            </div>
          </Space>
          {step === 1 && (
            <Space size={6}>
              <div className="stat-chip">
                <span className="stat-num">{selectedFields.length}</span>
                <span className="stat-lbl">fields</span>
              </div>
              {exportType === 'selected' && (
                <div className="stat-chip accent">
                  <span className="stat-num">{selectedIds.length}</span>
                  <span className="stat-lbl">selected</span>
                </div>
              )}
            </Space>
          )}
        </div>
      }
      footer={step === 1 && activeTab === 'export' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {selectedFields.length} fields · {exportType === 'selected' ? `${selectedIds.length} items` : 'filtered view'} · {exportFormat.toUpperCase()}
          </Text>
          <Space>
            <Button onClick={onClose} disabled={exporting}>Cancel</Button>
            <Button
              type="primary"
              icon={<Download size={14} />}
              onClick={handleExport}
              loading={exporting}
              disabled={selectedFields.length === 0}
              style={{ minWidth: 160, background: '#0f172a', borderColor: '#0f172a' }}
            >
              {exporting ? 'Generating…' : `Export ${exportFormat.toUpperCase()}`}
            </Button>
          </Space>
        </div>
      ) : null}
    >
      <Tabs
        activeKey={activeTab}
        onChange={k => { if (!exporting) setActiveTab(k); }}
        className="export-tabs"
        items={[

          /* ══════════════════════════════════════════════════════ DATA EXPORT */
          {
            key: 'export',
            label: <Space size={6}><Database size={13} />Data Export</Space>,
            children: step === 1 ? (

              <div className="config-scroll">

                {/* ─── 1 · SCOPE ───────────────────────────────────────────── */}
                <Card className="ecard" size="small">
                  <div className="card-hdr">
                    <div className="step-dot">1</div>
                    <span className="card-title">Export Scope</span>
                  </div>

                  <Segmented
                    block
                    value={exportType}
                    onChange={setExportType}
                    className="scope-seg"
                    options={[
                      {
                        value: 'filtered',
                        label: (
                          <div className="seg-opt">
                            <ListChecks size={14} style={{ color: '#0288D1', flexShrink: 0 }} />
                            <div>
                              <div className="seg-main">Filtered View</div>
                              <div className="seg-sub">Current board state</div>
                            </div>
                          </div>
                        ),
                      },
                      {
                        value: 'selected',
                        disabled: selectedIds.length === 0,
                        label: (
                          <div className="seg-opt">
                            <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                            <div>
                              <div className="seg-main">
                                Selection
                                {selectedIds.length > 0 && <span className="count-badge">{selectedIds.length}</span>}
                              </div>
                              <div className="seg-sub">{selectedIds.length > 0 ? 'Checked rows' : 'No rows checked'}</div>
                            </div>
                          </div>
                        ),
                      },
                    ]}
                  />

                  {exportType === 'filtered' && (
                    <>
                      <Divider style={{ margin: '14px 0' }} />

                      {/* Marketplace */}
                      <div style={{ marginBottom: 10 }}>
                        <div className="field-label">Marketplace</div>
                        <Segmented
                          block
                          value={marketplace}
                          onChange={v => { setMarketplace(v); setSelectedSellerIds([]); }}
                          className="mkt-seg"
                          options={[
                            { value: 'all',    label: <span className="mkt-label">ALL</span> },
                            { value: 'amazon', label: <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" style={{ height: 13, filter: 'brightness(0.15)' }} alt="Amazon" /> },
                            { value: 'ajio',   label: <span className="mkt-label">AJIO</span> },
                          ]}
                        />
                      </div>

                      {/* Sellers */}
                      <div style={{ marginBottom: 10 }}>
                        <div className="field-label">
                          Sellers
                          {selectedSellerIds.length > 0 && (
                            <span className="inline-badge">{selectedSellerIds.length}</span>
                          )}
                        </div>
                        <Select
                          mode="multiple"
                          style={{ width: '100%' }}
                          placeholder="All sellers included by default"
                          value={selectedSellerIds}
                          onChange={vals => {
                            if (vals.includes('SELECT_ALL'))
                              setSelectedSellerIds(sellerOptions.filter(o => o.value !== 'SELECT_ALL').map(o => o.value));
                            else
                              setSelectedSellerIds(vals);
                          }}
                          options={sellerOptions}
                          optionRender={opt => opt.data.meta ? (
                            <div style={{ lineHeight: 1.35 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{opt.data.meta.name}</div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{opt.data.meta.sellerId} · {opt.data.meta.marketplace}</div>
                            </div>
                          ) : (
                            <Text strong style={{ color: '#0288D1' }}><ListChecks size={12} style={{ marginRight: 5 }} />Select All Sellers</Text>
                          )}
                          maxTagCount="responsive"
                          showSearch
                        />
                      </div>

                      {/* Active filters */}
                      {activeFilterTags.length > 0 && (
                        <div>
                          <div className="field-label">Active filters on this export</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {activeFilterTags.map(b => (
                              <AntTag key={b.key} color={b.color} style={{ fontSize: 11, margin: 0 }}>{b.label}</AntTag>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Card>

                {/* ─── 2 · FIELDS ──────────────────────────────────────────── */}
                <Card className="ecard" size="small">
                  <div className="card-hdr" style={{ marginBottom: 12 }}>
                    <div className="step-dot">2</div>
                    <span className="card-title">Data Fields</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AntTag color="blue" style={{ borderRadius: 12, fontSize: 11, margin: 0, padding: '0 8px' }}>
                        {selectedFields.length} / {ALL_ASIN_FIELDS.length}
                      </AntTag>
                      <Button
                        size="small"
                        icon={isAllSelected ? <Trash2 size={12} /> : <CheckSquare size={12} />}
                        onClick={toggleAll}
                      >
                        {isAllSelected ? 'Clear' : 'Select All'}
                      </Button>
                    </div>
                  </div>

                  {/* Search + category pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    <Input
                      prefix={<Search size={13} style={{ color: '#94a3b8' }} />}
                      placeholder="Search fields…"
                      value={fieldSearch}
                      onChange={e => setFieldSearch(e.target.value)}
                      allowClear
                      size="small"
                    />
                    <div className="cat-pills">
                      <button
                        className={`cpill${fieldCatFilter === 'All' ? ' active' : ''}`}
                        onClick={() => setFieldCatFilter('All')}
                      >All</button>
                      {FIELD_CATEGORIES.map(cat => {
                        const meta = CATEGORY_META[cat] || {};
                        const sel = ALL_ASIN_FIELDS.filter(f => f.category === cat && selectedFields.includes(f.key)).length;
                        return (
                          <button
                            key={cat}
                            className={`cpill${fieldCatFilter === cat ? ' active' : ''}`}
                            onClick={() => setFieldCatFilter(cat)}
                          >
                            <span style={{ color: meta.color, display: 'flex' }}>{meta.icon}</span>
                            {cat}
                            {sel > 0 && (
                              <span className="cpill-count" style={{ background: meta.color }}>{sel}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Field grid */}
                  <div className="field-grid">
                    {fieldGroups ? (
                      // ── Grouped by category ──
                      fieldGroups.map(({ cat, fields }) => {
                        const meta = CATEGORY_META[cat] || {};
                        const allKeys = ALL_ASIN_FIELDS.filter(f => f.category === cat).map(f => f.key);
                        const selCount = allKeys.filter(k => selectedFields.includes(k)).length;
                        const allSel = allKeys.every(k => selectedFields.includes(k));
                        return (
                          <div key={cat} className="field-group">
                            <div className="fg-hdr" style={{ borderLeftColor: meta.color }}>
                              <span className="fg-icon" style={{ color: meta.color, background: meta.bg }}>{meta.icon}</span>
                              <span className="fg-name">{cat}</span>
                              <span className="fg-count">{selCount}/{allKeys.length}</span>
                              <button className="fg-toggle" onClick={() => toggleCategory(cat)}>
                                {allSel ? 'Clear' : 'All'}
                              </button>
                            </div>
                            <Row gutter={[6, 6]}>
                              {fields.map(f => (
                                <Col span={8} key={f.key}><FieldChip field={f} /></Col>
                              ))}
                            </Row>
                          </div>
                        );
                      })
                    ) : (
                      // ── Single category flat ──
                      <Row gutter={[6, 6]}>
                        {visibleFields.map(f => (
                          <Col span={8} key={f.key}><FieldChip field={f} /></Col>
                        ))}
                      </Row>
                    )}
                    {visibleFields.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>
                        No fields match "{fieldSearch}"
                      </div>
                    )}
                  </div>
                </Card>

                {/* ─── 3 · FORMAT ──────────────────────────────────────────── */}
                <Card className="ecard" size="small">
                  <div className="card-hdr" style={{ marginBottom: 16 }}>
                    <div className="step-dot">3</div>
                    <span className="card-title">Output Format</span>
                  </div>

                  <Row gutter={20}>
                    {/* Date range */}
                    <Col span={14}>
                      <div className="field-label" style={{ marginBottom: 8 }}>Timeframe</div>
                      <Radio.Group
                        value={dateOption}
                        onChange={e => setDateOption(e.target.value)}
                        optionType="button"
                        buttonStyle="outline"
                        size="small"
                        className="date-btns"
                      >
                        <Radio.Button value="all">All Time</Radio.Button>
                        <Radio.Button value="today">Today</Radio.Button>
                        <Radio.Button value="yesterday">Yesterday</Radio.Button>
                        <Radio.Button value="7days">7 Days</Radio.Button>
                        <Radio.Button value="30days">30 Days</Radio.Button>
                        <Radio.Button value="custom">Custom</Radio.Button>
                      </Radio.Group>
                      {dateOption === 'custom' && (
                        <RangePicker
                          style={{ width: '100%', marginTop: 10, borderRadius: 8 }}
                          value={customDateRange}
                          onChange={setCustomDateRange}
                        />
                      )}
                      {isHistoricalRange && (
                        <AntTag color="orange" style={{ marginTop: 8, fontSize: 11 }}>
                          Historical mode — exports day-by-day snapshot data
                        </AntTag>
                      )}
                    </Col>

                    {/* File format */}
                    <Col span={10}>
                      <div className="field-label" style={{ marginBottom: 8 }}>File Type</div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[
                          { val: 'csv',  icon: <FileText size={22} />,        name: 'CSV',   desc: 'Fast · Universal', cls: 'csv'   },
                          { val: 'xlsx', icon: <FileSpreadsheet size={22} />, name: 'Excel', desc: 'Styled · Formatted', cls: 'excel' },
                        ].map(fmt => (
                          <div
                            key={fmt.val}
                            className={`fmt-card${exportFormat === fmt.val ? ' selected' : ''}`}
                            onClick={() => setExportFormat(fmt.val)}
                          >
                            <div className={`fmt-icon ${fmt.cls}`}>{fmt.icon}</div>
                            <div className="fmt-name">{fmt.name}</div>
                            <div className="fmt-desc">{fmt.desc}</div>
                          </div>
                        ))}
                      </div>
                    </Col>
                  </Row>
                </Card>

                {error && (
                  <Alert
                    type="error"
                    showIcon
                    description={error}
                    closable={{ onClose: () => setError(null) }}
                    style={{ borderRadius: 10 }}
                  />
                )}
              </div>

            ) : (
              /* ══════════════════════════ PROGRESS SCREEN */
              <div className="progress-screen">
                {!error ? (
                  <>
                    <Progress
                      type="circle"
                      percent={Math.round(exportProgress)}
                      strokeColor={{ '0%': '#0288D1', '100%': '#0f172a' }}
                      strokeWidth={7}
                      size={108}
                      format={pct => (
                        <span style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{pct}%</span>
                      )}
                    />
                    <Title level={4} style={{ margin: '18px 0 4px' }}>
                      {exportProgress >= 100 ? 'Download Starting…' : 'Generating Your Export'}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 13 }}>{getProgressLabel(exportProgress)}</Text>
                    <div className="progress-summary">
                      <span>{selectedFields.length} fields</span>
                      <span className="psep">·</span>
                      <span>{exportType === 'selected' ? `${selectedIds.length} items` : 'filtered view'}</span>
                      <span className="psep">·</span>
                      <span>{exportFormat.toUpperCase()}</span>
                    </div>
                    <Text type="secondary" style={{ fontSize: 11, marginTop: 10, display: 'block' }}>
                      Keep this window open while the file is being prepared
                    </Text>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: 360, textAlign: 'center' }}>
                    <AlertCircle size={44} style={{ color: '#ef4444', marginBottom: 14 }} />
                    <Title level={4} style={{ color: '#ef4444', margin: '0 0 8px' }}>Export Failed</Title>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>{error}</Text>
                    <Button
                      type="primary" size="large"
                      onClick={() => { setStep(1); setError(null); }}
                      style={{ background: '#0f172a', borderColor: '#0f172a' }}
                    >
                      Back to Configuration
                    </Button>
                  </div>
                )}
              </div>
            ),
          },

          /* ══════════════════════════════════════════════ TAGS TEMPLATE */
          {
            key: 'tags',
            label: <Space size={6}><TagIcon size={13} />Tags Template</Space>,
            children: (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#f8fafc' }}>
                <div className="tags-card">
                  <div className="tags-icon"><FileDown size={34} /></div>
                  <Title level={4} style={{ margin: '16px 0 8px' }}>Bulk Tags Template</Title>
                  <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 24 }}>
                    Download a pre-filled Excel file with all your ASINs. Edit tags in bulk and re-upload to update inventory.
                  </Paragraph>
                  <Button type="primary" size="large" icon={<Download size={15} />} block
                    onClick={handleDownloadTemplate}
                    style={{ background: '#0288D1', borderColor: '#0288D1' }}>
                    Download Template
                  </Button>
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* ─────────────────────────────────────────── STYLES */}
      <style>{`
        /* Drawer shell */
        .export-drawer-v2 .ant-drawer-header-title { flex: 1; min-width: 0; }
        .export-drawer-v2 .ant-drawer-body { display: flex; flex-direction: column; overflow: hidden; }
        .drawer-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: #f1f5f9; display: flex;
          align-items: center; justify-content: center; color: #0f172a; flex-shrink: 0;
        }

        /* Stat chips in header */
        .stat-chip {
          display: flex; flex-direction: column; align-items: center;
          padding: 4px 10px; background: #f1f5f9; border-radius: 8px; line-height: 1;
        }
        .stat-chip.accent { background: #e0f2fe; }
        .stat-chip .stat-num { font-size: 15px; font-weight: 800; color: #0f172a; }
        .stat-chip.accent .stat-num { color: #0288D1; }
        .stat-chip .stat-lbl { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 1px; }

        /* Tabs */
        .export-tabs { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
        .export-tabs .ant-tabs-nav { margin: 0; background: white; padding: 0 20px; border-bottom: 1px solid #f1f5f9; flex-shrink: 0; }
        .export-tabs .ant-tabs-content-holder { flex: 1; overflow: hidden; }
        .export-tabs .ant-tabs-content { height: 100%; }
        .export-tabs .ant-tabs-tabpane { height: 100%; display: flex; flex-direction: column; }

        /* Config scroll */
        .config-scroll {
          flex: 1; overflow-y: auto; padding: 14px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .config-scroll::-webkit-scrollbar { width: 4px; }
        .config-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

        /* Cards */
        .ecard { border-radius: 12px; border: 1px solid #e2e8f0; background: white; }
        .ecard .ant-card-body { padding: 16px; }
        .card-hdr { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
        .step-dot {
          width: 20px; height: 20px; border-radius: 50%;
          background: #0f172a; color: white; font-size: 10px; font-weight: 800;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .card-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
        .field-label { font-size: 11px; color: #64748b; margin-bottom: 6px; }
        .inline-badge {
          display: inline-flex; align-items: center; justify-content: center;
          background: #0288D1; color: white; border-radius: 10px;
          font-size: 10px; font-weight: 700; padding: 0 5px; margin-left: 5px; line-height: 15px;
        }

        /* Scope segmented */
        .scope-seg .ant-segmented-item-selected { background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
        .seg-opt { display: flex; align-items: center; gap: 10px; padding: 7px 4px; text-align: left; }
        .seg-main { font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.2; }
        .seg-sub  { font-size: 10px; color: #94a3b8; }
        .count-badge {
          display: inline-flex; align-items: center; justify-content: center;
          background: #10b981; color: white; border-radius: 8px;
          font-size: 9px; font-weight: 700; padding: 0 5px; margin-left: 4px;
        }

        /* Marketplace seg */
        .mkt-seg .ant-segmented-item { padding: 4px 16px; }
        .mkt-label { font-size: 12px; font-weight: 700; letter-spacing: 0.04em; color: #1e293b; }

        /* Category pills */
        .cat-pills { display: flex; flex-wrap: wrap; gap: 5px; }
        .cpill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 9px; border-radius: 100px;
          border: 1px solid #e2e8f0; background: white;
          font-size: 11px; color: #64748b; cursor: pointer;
          transition: all 0.13s; white-space: nowrap; font-family: inherit;
        }
        .cpill:hover { border-color: #94a3b8; color: #1e293b; }
        .cpill.active { background: #0f172a; color: white; border-color: #0f172a; }
        .cpill.active .cpill-count { background: rgba(255,255,255,0.3); }
        .cpill-count {
          display: inline-flex; align-items: center; justify-content: center;
          color: white; border-radius: 8px; font-size: 9px; font-weight: 700;
          padding: 0 4px; min-width: 14px; line-height: 15px;
        }

        /* Field grid */
        .field-grid {
          max-height: 340px; overflow-y: auto;
          padding: 10px; background: #f8fafc;
          border: 1px solid #e2e8f0; border-radius: 8px;
        }
        .field-grid::-webkit-scrollbar { width: 4px; }
        .field-grid::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }

        /* Field groups */
        .field-group { margin-bottom: 14px; }
        .field-group:last-child { margin-bottom: 0; }
        .fg-hdr {
          display: flex; align-items: center; gap: 7px;
          margin-bottom: 8px; padding: 5px 8px;
          background: white; border-radius: 6px; border-left: 3px solid #e2e8f0;
        }
        .fg-icon {
          width: 18px; height: 18px; border-radius: 4px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .fg-name  { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #374151; }
        .fg-count { font-size: 10px; color: #94a3b8; margin-left: auto; }
        .fg-toggle {
          font-size: 10px; font-weight: 700; color: #0288D1;
          cursor: pointer; border: none; background: none; padding: 0; font-family: inherit;
        }
        .fg-toggle:hover { text-decoration: underline; }

        /* Field chips */
        .field-chip {
          display: flex; align-items: center; gap: 7px;
          padding: 6px 8px; border-radius: 6px;
          border: 1px solid #e2e8f0; background: white;
          cursor: pointer; transition: border-color 0.12s, background 0.12s;
          user-select: none; font-size: 11.5px; color: #374151;
        }
        .field-chip:hover { border-color: #94a3b8; background: #f8fafc; }
        .field-chip.selected { border-color: #0288D1; background: #e0f2fe; color: #0369a1; }
        .field-chip .ant-checkbox { flex-shrink: 0; }
        .field-chip-label { line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* Date buttons */
        .date-btns { display: flex; flex-wrap: wrap; gap: 4px; }
        .date-btns .ant-radio-button-wrapper {
          border-radius: 6px !important; border: 1px solid #e2e8f0 !important;
          font-size: 11px; padding: 0 10px; height: 28px; line-height: 26px;
          background: white; color: #475569; box-shadow: none !important;
        }
        .date-btns .ant-radio-button-wrapper::before { display: none !important; }
        .date-btns .ant-radio-button-wrapper:hover { border-color: #94a3b8 !important; color: #1e293b; }
        .date-btns .ant-radio-button-wrapper-checked {
          background: #0f172a !important; border-color: #0f172a !important; color: white !important;
        }

        /* Format cards */
        .fmt-card {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          padding: 14px 10px; border: 2px solid #e2e8f0; border-radius: 12px;
          background: white; cursor: pointer; transition: all 0.15s; text-align: center; gap: 5px;
        }
        .fmt-card:hover { border-color: #94a3b8; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
        .fmt-card.selected { border-color: #0288D1; background: #e0f2fe; box-shadow: 0 0 0 3px rgba(2,136,209,0.1); }
        .fmt-icon {
          width: 44px; height: 44px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .fmt-icon.csv   { background: #e0f2fe; color: #0369a1; }
        .fmt-icon.excel { background: #dcfce7; color: #15803d; }
        .fmt-name { font-size: 13px; font-weight: 700; color: #1e293b; }
        .fmt-card.selected .fmt-name { color: #0288D1; }
        .fmt-desc { font-size: 10px; color: #94a3b8; }

        /* Progress screen */
        .progress-screen {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 40px 24px; text-align: center; gap: 4px;
        }
        .progress-summary {
          display: inline-flex; align-items: center; gap: 8px;
          background: #f1f5f9; border-radius: 100px; padding: 6px 16px;
          font-size: 12px; color: #475569; margin-top: 16px;
        }
        .psep { color: #cbd5e1; }

        /* Tags template */
        .tags-card {
          display: flex; flex-direction: column; align-items: center; text-align: center;
          max-width: 380px; padding: 40px 32px;
          background: white; border: 1px solid #e2e8f0; border-radius: 16px;
        }
        .tags-icon {
          width: 72px; height: 72px; border-radius: 18px;
          background: #dbeafe; color: #2563eb;
          display: flex; align-items: center; justify-content: center;
        }
      `}</style>
    </Drawer>
  );
};

export default ExportAsinModal;
