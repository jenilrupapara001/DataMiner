import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Download, FileSpreadsheet, FileText, Calendar, 
  Store, ListChecks, Check, Search, Tag, FileDown, 
  RefreshCw, AlertCircle, Database, ArrowRight, ChevronDown,
  CheckSquare, Square, Layers
} from 'lucide-react';
import { sellerApi, asinApi, exportApi } from '../../services/api';

const ALL_ASIN_FIELDS = [
  { key: 'asinCode', label: 'ASIN Code', category: 'Basic' },
  { key: 'parentAsin', label: 'Parent ASIN', category: 'Basic' },
  { key: 'sku', label: 'SKU', category: 'Basic' },
  { key: 'title', label: 'Product Title', category: 'Basic' },
  { key: 'brand', label: 'Brand', category: 'Basic' },
  { key: 'category', label: 'Category', category: 'Basic' },
  { key: 'status', label: 'Status', category: 'Basic' },
  { key: 'tags', label: 'Tags', category: 'Basic' },
  { key: 'releaseDate', label: 'Release Date', category: 'Basic' },
  { key: 'currentPrice', label: 'Current Price (₹)', category: 'Pricing' },
  { key: 'mrp', label: 'MRP (₹)', category: 'Pricing' },
  { key: 'dealBadge', label: 'Deal Badge', category: 'Pricing' },
  { key: 'priceDispute', label: 'Price Dispute', category: 'Pricing' },
  { key: 'discountPercentage', label: 'Discount %', category: 'Pricing' },
  { key: 'secondAsp', label: 'Second ASP (₹)', category: 'Pricing' },
  { key: 'bsr', label: 'BSR', category: 'Performance' },
  { key: 'subBsr', label: 'Sub BSR', category: 'Performance' },
  { key: 'rating', label: 'Rating', category: 'Performance' },
  { key: 'reviewCount', label: 'Review Count', category: 'Performance' },
  { key: 'ratingBreakdown', label: 'Rating Breakdown', category: 'Performance' },
  { key: 'lqs', label: 'LQS Score', category: 'Performance' },
  { key: 'titleScore', label: 'Title Score', category: 'LQS' },
  { key: 'bulletScore', label: 'Bullet Score', category: 'LQS' },
  { key: 'imageScore', label: 'Image Score', category: 'LQS' },
  { key: 'descriptionScore', label: 'Desc Score', category: 'LQS' },
  { key: 'cdq', label: 'CDQ Score', category: 'LQS' },
  { key: 'cdqGrade', label: 'CDQ Grade', category: 'LQS' },
  { key: 'buyBoxWin', label: 'BuyBox Winner', category: 'BuyBox' },
  { key: 'soldBy', label: 'Current BuyBox Seller', category: 'BuyBox' },
  { key: 'soldBySec', label: 'Other BuyBox Seller', category: 'BuyBox' },
  { key: 'hasAplus', label: 'A+ Content', category: 'Content' },
  { key: 'imagesCount', label: 'Image Count', category: 'Content' },
  { key: 'videoCount', label: 'Video Count', category: 'Content' },
  { key: 'bulletPoints', label: 'Bullet Points Count', category: 'Content' },
  { key: 'bulletPointsText', label: 'Bullet Points Text', category: 'Content' },
  { key: 'availabilityStatus', label: 'Availability', category: 'Inventory' },
  { key: 'stockLevel', label: 'Stock Level', category: 'Inventory' },
  { key: 'aplusAbsentSince', label: 'A+ Days Absent', category: 'Content' },
  { key: 'lastScraped', label: 'Last Scraped', category: 'Dates' },
  { key: 'createdAt', label: 'Created At', category: 'Dates' },
  { key: 'updatedAt', label: 'Updated At', category: 'Dates' },
];

const FIELD_CATEGORIES = [...new Set(ALL_ASIN_FIELDS.map(f => f.category))];

const ExportAsinModal = ({ isOpen, onClose, currentFilters = {}, searchQuery = '', selectedSeller = null, selectedIds = [] }) => {
  // ===== STATE =====
  const [activeTab, setActiveTab] = useState('export');
  const [step, setStep] = useState(1);
  
  // Sellers
  const [sellers, setSellers] = useState([]);
  const [selectedSellerIds, setSelectedSellerIds] = useState(selectedSeller ? [selectedSeller] : []);
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerDropdownOpen, setSellerDropdownOpen] = useState(false);
  const sellerDropdownRef = useRef(null);
  
  // Fields
  const [selectedFields, setSelectedFields] = useState([
    'asinCode', 'parentAsin', 'sku', 'title', 'brand', 'category',
    'currentPrice', 'mrp', 'bsr', 'rating', 'reviewCount', 'lqs', 'soldBy', 'tags'
  ]);
  const [fieldCategoryFilter, setFieldCategoryFilter] = useState('All');
  const [fieldSearch, setFieldSearch] = useState('');
  
  // Format
  const [exportFormat, setExportFormat] = useState('csv');
  const [dateOption, setDateOption] = useState('all');
  
  // Processing
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState(null);
  const [exportType, setExportType] = useState(selectedIds.length > 0 ? 'selected' : 'filtered');
  
  // ===== EFFECTS =====
  useEffect(() => {
    if (isOpen) {
      fetchSellers();
      setStep(1); setError(null); setExportProgress(0);
      setSelectedSellerIds(selectedSeller ? [selectedSeller] : []);
    }
  }, [isOpen, selectedSeller]);

  // Close seller dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (sellerDropdownRef.current && !sellerDropdownRef.current.contains(e.target)) {
        setSellerDropdownOpen(false);
      }
    };
    if (sellerDropdownOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sellerDropdownOpen]);

  const fetchSellers = async () => {
    try {
      const response = await sellerApi.getAll({ limit: 500, page: 1 });
      if (response.success) setSellers(response.data?.sellers || []);
    } catch (err) { console.error(err); }
  };

  // ===== COMPUTED =====
  const filteredSellers = useMemo(() => {
    if (!sellerSearch.trim()) return sellers;
    const q = sellerSearch.toLowerCase();
    return sellers.filter(s => (s.name || '').toLowerCase().includes(q) || (s.sellerId || '').toLowerCase().includes(q));
  }, [sellers, sellerSearch]);

  const filteredFields = useMemo(() => {
    let fields = fieldCategoryFilter === 'All' ? ALL_ASIN_FIELDS : ALL_ASIN_FIELDS.filter(f => f.category === fieldCategoryFilter);
    if (fieldSearch.trim()) {
      const q = fieldSearch.toLowerCase();
      fields = fields.filter(f => f.label.toLowerCase().includes(q));
    }
    return fields;
  }, [fieldCategoryFilter, fieldSearch]);

  const isAllSellersSelected = sellers.length > 0 && selectedSellerIds.length === sellers.length;
  const isAllFieldsSelected = selectedFields.length === ALL_ASIN_FIELDS.length;

  // ===== HANDLERS =====
  const toggleSeller = (id) => setSelectedSellerIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  const toggleAllSellers = () => isAllSellersSelected ? setSelectedSellerIds([]) : setSelectedSellerIds(sellers.map(s => s._id || s.Id));
  const toggleField = (key) => setSelectedFields(p => p.includes(key) ? (p.length === 1 ? p : p.filter(f => f !== key)) : [...p, key]);
  const toggleAllFields = () => isAllFieldsSelected ? setSelectedFields(['asinCode','title','currentPrice']) : setSelectedFields(ALL_ASIN_FIELDS.map(f => f.key));
  const selectCategory = (cat) => {
    const catKeys = ALL_ASIN_FIELDS.filter(f => f.category === cat).map(f => f.key);
    setSelectedFields(p => [...new Set([...p, ...catKeys])]);
  };

  // ===== EXPORT =====
  const handleExport = async () => {
    // Only require seller selection if we're not exporting specific selected IDs
    if (exportType === 'filtered' && selectedSellerIds.length === 0) {
      setError('Please select at least one seller for filtered export');
      return;
    }
    
    if (exportType === 'selected' && selectedIds.length === 0) {
      setError('No items selected to export');
      return;
    }

    if (selectedFields.length === 0) { setError('Please select at least one field'); return; }

    setExporting(true); setStep(2); setError(null); setExportProgress(0);

    try {
      // Merge all parameters
      const exportParams = {
        fields: selectedFields,
        format: exportFormat,
        dateRange: dateOption,
        sellerIds: selectedSellerIds,
        allSellers: isAllSellersSelected,
      };

      if (exportType === 'selected' && selectedIds.length > 0) {
        exportParams.asinIds = selectedIds;
      } else {
        // Map currentFilters to match backend expectation
        exportParams.search = searchQuery;
        
        // Flatten filters
        if (currentFilters) {
          if (currentFilters.status) exportParams.status = currentFilters.status;
          if (currentFilters.category) exportParams.category = currentFilters.category;
          if (currentFilters.brand) exportParams.brand = currentFilters.brand;
          if (currentFilters.minPrice) exportParams.minPrice = currentFilters.minPrice;
          if (currentFilters.maxPrice) exportParams.maxPrice = currentFilters.maxPrice;
          if (currentFilters.minBSR) exportParams.minBSR = currentFilters.minBSR;
          if (currentFilters.maxBSR) exportParams.maxBSR = currentFilters.maxBSR;
          if (currentFilters.minLQS) exportParams.minLQS = currentFilters.minLQS;
          if (currentFilters.maxLQS) exportParams.maxLQS = currentFilters.maxLQS;
          if (currentFilters.scrapeStatus) exportParams.scrapeStatus = currentFilters.scrapeStatus;
          if (currentFilters.buyBoxWin) exportParams.buyBoxWin = currentFilters.buyBoxWin;
          if (currentFilters.hasAplus) exportParams.hasAplus = currentFilters.hasAplus;
          if (currentFilters.parentAsin) exportParams.parentAsin = currentFilters.parentAsin;
          if (currentFilters.subBsrCategory) exportParams.subBsrCategory = currentFilters.subBsrCategory;
          if (currentFilters.selectedTags) exportParams.tags = currentFilters.selectedTags;
          if (currentFilters.sku) exportParams.sku = currentFilters.sku;
          if (currentFilters.minRating) exportParams.minRating = currentFilters.minRating;
          if (currentFilters.maxRating) exportParams.maxRating = currentFilters.maxRating;
          if (currentFilters.minReviewCount) exportParams.minReviewCount = currentFilters.minReviewCount;
          if (currentFilters.maxReviewCount) exportParams.maxReviewCount = currentFilters.maxReviewCount;
          if (currentFilters.priceDispute) exportParams.priceDispute = currentFilters.priceDispute;
        }

        // If a specific seller was selected in the main page and none selected in modal, use that
        if (selectedSeller && selectedSellerIds.length === 0) {
          exportParams.sellerIds = [selectedSeller];
        }
      }

      const res = await exportApi.startExport(exportParams);

      if (res.success) {
        const downloadId = res.downloadId;
        
        // Polling function
        const pollExportStatus = async () => {
          try {
            const statusRes = await exportApi.getExportStatus(downloadId);
            if (statusRes.success) {
              const { Status, Progress, ErrorMessage } = statusRes.data;
              
              setExportProgress(Progress || 0);
              
              if (Status === 'completed') {
                setExportProgress(100);
                setTimeout(async () => {
                  try {
                    const blob = await exportApi.downloadFile(downloadId);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = statusRes.data.FileName || `asin_export_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    
                    setExporting(false);
                    setTimeout(onClose, 800);
                  } catch (downloadErr) {
                    console.error('Download failed:', downloadErr);
                    setError('File ready, but download failed. You can find it in the Downloads drawer.');
                    setStep(1);
                    setExporting(false);
                  }
                }, 500);
              } else if (Status === 'failed') {
                setError(ErrorMessage || 'Export generation failed');
                setStep(1);
                setExporting(false);
              } else {
                // Still processing, poll again
                setTimeout(pollExportStatus, 2000);
              }
            }
          } catch (pollErr) {
            console.error('Polling error:', pollErr);
            setError('Lost connection to server. Check your downloads later.');
            setStep(1);
            setExporting(false);
          }
        };

        // Start polling
        pollExportStatus();
      }
    } catch (err) {
      setError(err.message);
      setStep(1);
      setExporting(false);
    }
  };

  // ===== TAGS TEMPLATE =====
  const handleDownloadTemplate = async () => {
    try { await asinApi.downloadTagsTemplate(); } catch (err) { console.error(err); }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', zIndex: 9999 }}
      onClick={(e) => { if (e.target === e.currentTarget && !exporting) onClose(); }}>
      
      <style>{`
        .em { animation: emIn 0.25s cubic-bezier(0.16,1,0.3,1); }
        @keyframes emIn { from { opacity:0; transform:scale(0.93) translateY(30px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .chk { width:18px; height:18px; border-radius:5px; border:2px solid #d1d5db; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.15s; flex-shrink:0; background:white; }
        .chk.ck { background:#18181b; border-color:#18181b; color:white; }
        .chk:hover { border-color:#18181b; }
        .tab-e { padding:10px 24px; font-size:13px; font-weight:600; border:none; background:transparent; color:#9ca3af; cursor:pointer; border-bottom:2px solid transparent; transition:all 0.2s; }
        .tab-e.ac { color:#18181b; border-bottom-color:#18181b; }
        .tab-e:hover { color:#52525b; }
        .btn-p { padding:10px 24px; font-size:13px; font-weight:700; border-radius:10px; border:none; cursor:pointer; transition:all 0.2s; background:#18181b; color:white; display:flex; align-items:center; gap:8px; }
        .btn-p:hover { background:#27272a; transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.15); }
        .btn-p:disabled { background:#d4d4d8; cursor:not-allowed; transform:none; box-shadow:none; }
        .btn-o { padding:10px 24px; font-size:13px; font-weight:600; border-radius:10px; border:1.5px solid #e5e7eb; cursor:pointer; background:white; color:#52525b; transition:all 0.2s; }
        .btn-o:hover { border-color:#18181b; color:#18181b; }
        .cat-p { padding:5px 12px; border-radius:20px; font-size:10px; font-weight:600; cursor:pointer; border:1.5px solid #e5e7eb; background:white; color:#71717a; transition:all 0.15s; white-space:nowrap; }
        .cat-p:hover { border-color:#18181b; color:#18181b; }
        .cat-p.ac { background:#18181b; color:white; border-color:#18181b; }
        .fl { padding:7px 12px; border-radius:8px; font-size:11px; cursor:pointer; transition:all 0.1s; display:flex; align-items:center; gap:8px; border:1.5px solid transparent; }
        .fl:hover { background:#f4f4f5; }
        .fl.sel { background:#f4f4f5; border-color:#d1d5db; }
        .inp { height:42px; border:1.5px solid #e5e7eb; border-radius:10px; padding:0 14px; font-size:13px; width:100%; transition:border-color 0.2s; }
        .inp:focus { outline:none; border-color:#18181b; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:10px; }
      `}</style>

      <div className="bg-white shadow-2xl em d-flex flex-column" 
        style={{ width: '100%', maxWidth: '700px', maxHeight: '90vh', borderRadius: '20px', overflow: 'hidden' }}>

        {/* === HEADER === */}
        <div className="px-5 py-4 border-bottom d-flex justify-content-between align-items-center bg-white">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2.5 rounded-2" style={{ background: '#f4f4f5', color: '#18181b' }}>
              <Download size={20} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900" style={{ fontSize: '15px' }}>Export Data</h5>
              <p className="text-zinc-500 mb-0" style={{ fontSize: '12px' }}>Configure parameters and download</p>
            </div>
          </div>
          <button className="btn btn-ghost p-2 rounded-circle border-0" onClick={onClose} disabled={exporting}>
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* === TABS === */}
        <div className="px-5 pt-3 bg-white border-bottom d-flex gap-0">
          <button className={`tab-e ${activeTab === 'export' ? 'ac' : ''}`} onClick={() => setActiveTab('export')}>
            <Database size={14} className="me-2" /> Data Export
          </button>
          <button className={`tab-e ${activeTab === 'tags' ? 'ac' : ''}`} onClick={() => setActiveTab('tags')}>
            <Tag size={14} className="me-2" /> Tags Template
          </button>
        </div>

        {/* === CONTENT === */}
        <div className="flex-grow-1 overflow-auto" style={{ background: '#fafafa' }}>
          
          {/* ===== EXPORT TAB ===== */}
          {activeTab === 'export' && (
            <>
              {step === 1 ? (
                <div className="p-5 d-flex flex-column gap-4">
                  
                  {/* EXPORT MODE SELECTION */}
                  <div className="bg-white rounded-3 border p-4">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <Layers size={16} className="text-zinc-500" />
                      <span className="fw-bold text-zinc-800" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Export Mode
                      </span>
                    </div>
                    <div className="d-flex gap-2">
                      <button 
                        className={`btn-o flex-grow-1 d-flex flex-column align-items-center gap-2 py-3 ${exportType === 'filtered' ? 'border-zinc-900 text-zinc-900 bg-zinc-50' : 'opacity-60'}`}
                        onClick={() => setExportType('filtered')}>
                        <ListChecks size={18} />
                        <div className="d-flex flex-column">
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>Filtered Dataset</span>
                          <span style={{ fontSize: '10px', fontWeight: 500 }} className="text-zinc-500">Respects all active filters</span>
                        </div>
                      </button>
                      <button 
                        className={`btn-o flex-grow-1 d-flex flex-column align-items-center gap-2 py-3 ${exportType === 'selected' ? 'border-zinc-900 text-zinc-900 bg-zinc-50' : 'opacity-60'} ${selectedIds.length === 0 ? 'disabled' : ''}`}
                        onClick={() => selectedIds.length > 0 && setExportType('selected')}
                        disabled={selectedIds.length === 0}>
                        <CheckSquare size={18} />
                        <div className="d-flex flex-column">
                          <span style={{ fontSize: '12px', fontWeight: 700 }}>Selected Only</span>
                          <span style={{ fontSize: '10px', fontWeight: 500 }} className="text-zinc-500">{selectedIds.length} ASINs checked</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {exportType === 'filtered' && (
                  <div className="bg-white rounded-3 border p-4">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <Store size={16} className="text-zinc-500" />
                      <span className="fw-bold text-zinc-800" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Select Sellers <span className="text-danger">*</span>
                      </span>
                      <span className="badge bg-zinc-100 text-zinc-500 ms-auto" style={{ fontSize: '10px' }}>
                        {selectedSellerIds.length} selected
                      </span>
                    </div>
                    
                    {/* Seller Dropdown */}
                    <div className="position-relative" ref={sellerDropdownRef}>
                      <div className="inp d-flex align-items-center justify-content-between cursor-pointer" 
                        onClick={() => setSellerDropdownOpen(!sellerDropdownOpen)}
                        style={{ background: 'white' }}>
                        <span className={selectedSellerIds.length === 0 ? 'text-zinc-400' : 'text-zinc-700'} style={{ fontSize: '13px' }}>
                          {isAllSellersSelected ? `All Sellers (${sellers.length})` : 
                           selectedSellerIds.length === 0 ? 'Choose sellers...' : 
                           `${selectedSellerIds.length} seller${selectedSellerIds.length > 1 ? 's' : ''} selected`}
                        </span>
                        <ChevronDown size={16} className="text-zinc-400" style={{ transform: sellerDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </div>

                      {/* Selected seller tags */}
                      {selectedSellerIds.length > 0 && selectedSellerIds.length <= 5 && (
                        <div className="d-flex flex-wrap gap-1 mt-2">
                          {sellers.filter(s => selectedSellerIds.includes(s._id || s.Id)).map(s => (
                            <span key={s._id || s.Id} className="badge bg-zinc-100 text-zinc-600 d-flex align-items-center gap-1" style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '6px' }}>
                              {s.name}
                              <X size={10} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); toggleSeller(s._id || s.Id); }} />
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Dropdown Menu */}
                      {sellerDropdownOpen && (
                        <div className="position-absolute bg-white border rounded-3 shadow-xl" style={{ top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '6px', maxHeight: '280px', overflow: 'hidden' }}>
                          {/* Select All + Search */}
                          <div className="p-2 border-bottom bg-zinc-50">
                            <div className="d-flex align-items-center gap-2 p-2 rounded-2 cursor-pointer hover-bg-white" onClick={toggleAllSellers}>
                              <div className={`chk ${isAllSellersSelected ? 'ck' : ''}`} style={{ width: '16px', height: '16px' }}>
                                {isAllSellersSelected && <Check size={10} />}
                              </div>
                              <span className="fw-bold text-zinc-700" style={{ fontSize: '12px' }}>
                                {isAllSellersSelected ? 'DESELECT ALL' : 'SELECT ALL SELLERS'}
                              </span>
                            </div>
                            <div className="position-relative mt-1">
                              <Search size={13} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-zinc-400" />
                              <input className="form-control form-control-sm ps-4 border-1 rounded-2" placeholder="Search sellers..." 
                                value={sellerSearch} onChange={e => setSellerSearch(e.target.value)}
                                onClick={e => e.stopPropagation()} style={{ fontSize: '11px', height: '30px' }} />
                            </div>
                          </div>
                          {/* Seller List */}
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {filteredSellers.length === 0 ? (
                              <div className="text-center py-3 text-zinc-400" style={{ fontSize: '11px' }}>No sellers found</div>
                            ) : (
                              filteredSellers.map(seller => {
                                const isSelected = selectedSellerIds.includes(seller._id || seller.Id);
                                return (
                                  <div key={seller._id || seller.Id} 
                                    className={`fl ${isSelected ? 'sel' : ''}`}
                                    onClick={() => toggleSeller(seller._id || seller.Id)}>
                                    <div className={`chk ${isSelected ? 'ck' : ''}`} style={{ width: '16px', height: '16px' }}>
                                      {isSelected && <Check size={10} />}
                                    </div>
                                    <div className="flex-grow-1 min-w-0">
                                      <div className="fw-medium text-zinc-700 text-truncate" style={{ fontSize: '12px' }}>{seller.name}</div>
                                      <div className="text-zinc-400" style={{ fontSize: '10px' }}>{seller.marketplace || 'amazon.in'} · {seller.sellerId}</div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* 2. FIELD SELECTION */}
                  <div className="bg-white rounded-3 border p-4">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <ListChecks size={16} className="text-zinc-500" />
                      <span className="fw-bold text-zinc-800" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Select Fields
                      </span>
                      <span className="badge bg-zinc-100 text-zinc-500 ms-auto" style={{ fontSize: '10px' }}>
                        {selectedFields.length}/{ALL_ASIN_FIELDS.length}
                      </span>
                    </div>

                    {/* Category Pills */}
                    <div className="d-flex flex-wrap gap-1 mb-2">
                      <button className={`cat-p ${fieldCategoryFilter === 'All' ? 'ac' : ''}`} onClick={() => setFieldCategoryFilter('All')}>All</button>
                      {FIELD_CATEGORIES.map(cat => (
                        <button key={cat} className={`cat-p ${fieldCategoryFilter === cat ? 'ac' : ''}`} 
                          onClick={() => setFieldCategoryFilter(cat)}
                          onDoubleClick={() => selectCategory(cat)}
                          title="Double-click to select all in category">
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Field Search */}
                    <div className="position-relative mb-2">
                      <Search size={13} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-zinc-400" />
                      <input className="form-control form-control-sm ps-4 rounded-2" placeholder="Search fields..." 
                        value={fieldSearch} onChange={e => setFieldSearch(e.target.value)}
                        style={{ fontSize: '11px', height: '30px', border: '1.5px solid #e5e7eb' }} />
                    </div>

                    {/* Select All Fields */}
                    <div className="fl mb-1" onClick={toggleAllFields} style={{ background: '#fafafa' }}>
                      <div className={`chk ${isAllFieldsSelected ? 'ck' : ''}`} style={{ width: '16px', height: '16px' }}>
                        {isAllFieldsSelected && <Check size={10} />}
                      </div>
                      <span className="fw-bold text-zinc-700" style={{ fontSize: '11px' }}>
                        {isAllFieldsSelected ? 'DESELECT ALL' : 'SELECT ALL FIELDS'}
                      </span>
                    </div>

                    {/* Fields Grid */}
                    <div className="row g-1" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {filteredFields.map(field => {
                        const isSelected = selectedFields.includes(field.key);
                        return (
                          <div key={field.key} className="col-6">
                            <div className={`fl ${isSelected ? 'sel' : ''}`} onClick={() => toggleField(field.key)}>
                              <div className={`chk ${isSelected ? 'ck' : ''}`} style={{ width: '15px', height: '15px' }}>
                                {isSelected && <Check size={9} />}
                              </div>
                              <span className="text-zinc-700 text-truncate" style={{ fontSize: '11px' }}>{field.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. DATA RANGE */}
                  <div className="bg-white rounded-3 border p-4 mb-3">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <Calendar size={16} className="text-zinc-500" />
                      <span className="fw-bold text-zinc-800" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Data Range
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      {[
                        { label: 'All Time', value: 'all' },
                        { label: 'Today', value: 'today' },
                        { label: 'Yesterday', value: 'yesterday' },
                        { label: 'Last 7 Days', value: '7days' },
                        { label: 'Last 30 Days', value: '30days' }
                      ].map(opt => (
                        <button key={opt.value} 
                          className={`btn btn-sm rounded-pill px-3 py-1.5 transition-all ${dateOption === opt.value ? 'bg-zinc-900 text-white shadow-sm' : 'bg-zinc-100 text-zinc-600 border border-zinc-200 hover-bg-zinc-200'}`}
                          style={{ fontSize: '12px' }}
                          onClick={() => setDateOption(opt.value)}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. FORMAT */}
                  <div className="bg-white rounded-3 border p-4">
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <FileSpreadsheet size={16} className="text-zinc-500" />
                      <span className="fw-bold text-zinc-800" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Export Format
                      </span>
                    </div>
                    <div className="d-flex gap-3">
                      <button className={`btn-o flex-grow-1 d-flex align-items-center justify-content-center gap-2 py-3 ${exportFormat === 'csv' ? 'border-zinc-900 text-zinc-900 bg-zinc-50' : ''}`}
                        onClick={() => setExportFormat('csv')}>
                        <FileText size={18} /> CSV
                      </button>
                      <button className={`btn-o flex-grow-1 d-flex align-items-center justify-content-center gap-2 py-3 ${exportFormat === 'xlsx' ? 'border-zinc-900 text-zinc-900 bg-zinc-50' : ''}`}
                        onClick={() => setExportFormat('xlsx')}>
                        <FileSpreadsheet size={18} /> Excel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Processing */
                <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-4" style={{ minHeight: '300px' }}>
                  {!error ? (
                    <>
                      <div className="spinner-border text-zinc-800" role="status" style={{ width: '44px', height: '44px' }} />
                      <div className="text-center">
                        <h6 className="fw-bold text-zinc-900 mb-1">Generating Your File</h6>
                        <p className="text-zinc-500 small mb-3">{selectedSellerIds.length} seller(s) · {selectedFields.length} fields</p>
                        <div className="progress rounded-pill bg-zinc-100" style={{ width: '280px', height: '6px' }}>
                          <div className="progress-bar bg-zinc-800 rounded-pill" style={{ width: `${Math.min(exportProgress, 100)}%`, transition: 'width 0.3s ease' }} />
                        </div>
                        <span className="text-zinc-400 mt-2" style={{ fontSize: '11px' }}>{Math.round(exportProgress)}%</span>
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <AlertCircle size={40} className="text-danger mb-3" />
                      <h6 className="fw-bold text-zinc-900">Export Failed</h6>
                      <p className="text-zinc-500 small">{error}</p>
                      <button className="btn-p mt-3 mx-auto" onClick={() => { setStep(1); setError(null); }}>Try Again</button>
                    </div>
                  )}
                </div>
              )}

              {/* Error at step 1 */}
              {step === 1 && error && (
                <div className="mx-5 mb-4 p-3 bg-danger-subtle text-danger rounded-3 d-flex align-items-center gap-2" style={{ fontSize: '12px' }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}
            </>
          )}

          {/* ===== TAGS TEMPLATE TAB ===== */}
          {activeTab === 'tags' && (
            <div className="p-5 d-flex flex-column gap-4">
              <div className="bg-indigo-50 rounded-3 border border-indigo-100 p-4 text-center">
                <FileDown size={32} className="text-indigo-500 mb-2" />
                <h6 className="fw-bold text-indigo-900">Bulk Tags Template</h6>
                <p className="text-indigo-700 mb-0" style={{ fontSize: '12px' }}>Download a pre-filled Excel file with all your ASINs for bulk tag editing.</p>
              </div>
              <button className="btn-p w-100 justify-content-center py-3" onClick={handleDownloadTemplate} style={{ background: '#4f46e5' }}>
                <FileDown size={16} /> Download Tags Template (Excel)
              </button>
            </div>
          )}
        </div>

        {/* === FOOTER === */}
        {activeTab === 'export' && step === 1 && (
          <div className="px-5 py-4 border-top bg-white d-flex justify-content-between align-items-center">
            <button className="btn-o px-4 py-2" onClick={onClose}>Cancel</button>
            <button className="btn-p px-6 py-2" onClick={handleExport}
              disabled={selectedSellerIds.length === 0 || selectedFields.length === 0 || exporting}>
              {exporting ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
              {exporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
            </button>
          </div>
        )}
      </div>
    </div>, document.body
  );
};

export default ExportAsinModal;
