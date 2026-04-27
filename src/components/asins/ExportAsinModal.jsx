import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Download, FileSpreadsheet, FileText, Calendar, 
  Store, ListChecks, Filter, Check, ChevronDown, Search,
  Users, Tag, FileDown, Database, RefreshCw
} from 'lucide-react';
import { sellerApi, asinApi } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Available ASIN fields for export
const ALL_ASIN_FIELDS = [
  { key: 'asinCode', label: 'ASIN Code', category: 'Basic' },
  { key: 'parentAsin', label: 'Parent ASIN', category: 'Basic' },
  { key: 'sku', label: 'SKU', category: 'Basic' },
  { key: 'title', label: 'Product Title', category: 'Basic' },
  { key: 'brand', label: 'Brand', category: 'Basic' },
  { key: 'category', label: 'Category', category: 'Basic' },
  { key: 'status', label: 'Status', category: 'Basic' },
  { key: 'tags', label: 'Tags', category: 'Basic' },
  { key: 'currentPrice', label: 'Current Price (₹)', category: 'Pricing' },
  { key: 'mrp', label: 'MRP (₹)', category: 'Pricing' },
  { key: 'dealBadge', label: 'Deal Badge', category: 'Pricing' },
  { key: 'priceType', label: 'Price Type', category: 'Pricing' },
  { key: 'discountPercentage', label: 'Discount %', category: 'Pricing' },
  { key: 'secondAsp', label: 'Second ASP (₹)', category: 'Pricing' },
  { key: 'aspDifference', label: 'ASP Difference (₹)', category: 'Pricing' },
  { key: 'bsr', label: 'Best Seller Rank', category: 'Performance' },
  { key: 'subBsr', label: 'Sub BSR', category: 'Performance' },
  { key: 'subBSRs', label: 'Sub BSRs (All)', category: 'Performance' },
  { key: 'rating', label: 'Rating', category: 'Performance' },
  { key: 'reviewCount', label: 'Review Count', category: 'Performance' },
  { key: 'ratingBreakdown', label: 'Rating Breakdown', category: 'Performance' },
  { key: 'lqs', label: 'LQS Score', category: 'Performance' },
  { key: 'titleScore', label: 'Title Score', category: 'Performance' },
  { key: 'bulletScore', label: 'Bullet Score', category: 'Performance' },
  { key: 'imageScore', label: 'Image Score', category: 'Performance' },
  { key: 'descriptionScore', label: 'Description Score', category: 'Performance' },
  { key: 'cdq', label: 'CDQ Score', category: 'Performance' },
  { key: 'cdqGrade', label: 'CDQ Grade', category: 'Performance' },
  { key: 'buyBoxWin', label: 'BuyBox Winner', category: 'BuyBox' },
  { key: 'soldBy', label: 'Sold By (Current BuyBox)', category: 'BuyBox' },
  { key: 'soldBySec', label: 'Sold By (Other BuyBox)', category: 'BuyBox' },
  { key: 'allOffers', label: 'All Offers', category: 'BuyBox' },
  { key: 'hasAplus', label: 'Has A+ Content', category: 'Content' },
  { key: 'imagesCount', label: 'Image Count', category: 'Content' },
  { key: 'videoCount', label: 'Video Count', category: 'Content' },
  { key: 'bulletPoints', label: 'Bullet Points Count', category: 'Content' },
  { key: 'bulletPointsText', label: 'Bullet Points Text', category: 'Content' },
  { key: 'descLength', label: 'Description Length', category: 'Content' },
  { key: 'availabilityStatus', label: 'Availability Status', category: 'Inventory' },
  { key: 'stockLevel', label: 'Stock Level', category: 'Inventory' },
  { key: 'aplusAbsentSince', label: 'A+ Absent Since', category: 'Content' },
  { key: 'aplusPresentSince', label: 'A+ Present Since', category: 'Content' },
  { key: 'lastScraped', label: 'Last Scraped', category: 'Dates' },
  { key: 'createdAt', label: 'Created At', category: 'Dates' },
  { key: 'updatedAt', label: 'Updated At', category: 'Dates' },
];

const FIELD_CATEGORIES = [...new Set(ALL_ASIN_FIELDS.map(f => f.category))];

const ExportAsinModal = ({ isOpen, onClose }) => {
  const { user, isGlobalUser } = useAuth();
  
  // ---- State ----
  const [activeTab, setActiveTab] = useState('export'); // 'export' | 'tags'
  const [step, setStep] = useState(1);
  const [sellers, setSellers] = useState([]);
  const [selectedSellerIds, setSelectedSellerIds] = useState([]);
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerDropdownOpen, setSellerDropdownOpen] = useState(false);
  const [loadingSellers, setLoadingSellers] = useState(false);
  
  // Date range
  const [dateOption, setDateOption] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Fields
  const [selectedFields, setSelectedFields] = useState([
    'asinCode', 'parentAsin', 'sku', 'title', 'brand', 'category',
    'currentPrice', 'bsr', 'rating', 'reviewCount', 'lqs', 'soldBy', 'tags'
  ]);
  const [fieldsDropdownOpen, setFieldsDropdownOpen] = useState(false);
  const [fieldCategoryFilter, setFieldCategoryFilter] = useState('All');
  
  // Manager filter
  const [managerFilter, setManagerFilter] = useState('all');
  const [managers, setManagers] = useState([]);
  
  // Export format
  const [exportFormat, setExportFormat] = useState('csv');
  
  // Processing
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportComplete, setExportComplete] = useState(false);
  
  // Tags template
  const [tagsTemplateSeller, setTagsTemplateSeller] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  
  // ---- Effects ----
  useEffect(() => {
    if (isOpen) fetchSellers();
    if (isOpen && isGlobalUser) fetchManagers();
  }, [isOpen]);
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
  
  const fetchSellers = async () => {
    setLoadingSellers(true);
    try {
      const response = await sellerApi.getAll({ limit: 500, page: 1 });
      if (response.success) {
        setSellers(response.data?.sellers || []);
      }
    } catch (err) {
      console.error('Failed to fetch sellers:', err);
    }
    setLoadingSellers(false);
  };
  
  const fetchManagers = async () => {
    try {
      const { default: userApi } = await import('../../services/api');
      const response = await userApi.getManagers();
      if (response.success) setManagers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch managers:', err);
    }
  };
  
  // ---- Helpers ----
  const filteredSellers = useMemo(() => {
    if (!sellerSearch) return sellers;
    const q = sellerSearch.toLowerCase();
    return sellers.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.sellerId || '').toLowerCase().includes(q)
    );
  }, [sellers, sellerSearch]);
  
  const filteredFields = useMemo(() => {
    if (fieldCategoryFilter === 'All') return ALL_ASIN_FIELDS;
    return ALL_ASIN_FIELDS.filter(f => f.category === fieldCategoryFilter);
  }, [fieldCategoryFilter]);
  
  const isAllSellersSelected = selectedSellerIds.length === sellers.length && sellers.length > 0;
  const isAllFieldsSelected = selectedFields.length === ALL_ASIN_FIELDS.length;
  
  const toggleSeller = (sellerId) => {
    setSelectedSellerIds(prev => 
      prev.includes(sellerId) ? prev.filter(id => id !== sellerId) : [...prev, sellerId]
    );
  };
  
  const toggleAllSellers = () => {
    isAllSellersSelected ? setSelectedSellerIds([]) : setSelectedSellerIds(sellers.map(s => s._id));
  };
  
  const toggleField = (fieldKey) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldKey)) {
        if (prev.length === 1) return prev;
        return prev.filter(f => f !== fieldKey);
      }
      return [...prev, fieldKey];
    });
  };
  
  const toggleAllFields = () => {
    isAllFieldsSelected 
      ? setSelectedFields(['asinCode', 'title', 'currentPrice']) 
      : setSelectedFields(ALL_ASIN_FIELDS.map(f => f.key));
  };
  
  // ---- Export Logic ----
  const handleExport = async () => {
    setExporting(true);
    setStep(2);
    setExportProgress(0);
    
    try {
      const payload = {
        sellerIds: selectedSellerIds,
        allSellers: isAllSellersSelected,
        fields: selectedFields,
        dateRange: dateOption === 'custom' 
          ? { start: customStartDate, end: customEndDate } 
          : dateOption,
        managerFilter: managerFilter,
        format: exportFormat,
      };
      
      const progressInterval = setInterval(() => {
        setExportProgress(prev => Math.min(prev + Math.random() * 20, 90));
      }, 400);
      
      const response = await asinApi.exportData(payload);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      if (response.success) {
        setExportComplete(true);
        setStep(3);
        setTimeout(() => onClose(), 2000);
      } else {
        throw new Error(response.error || 'Export failed');
      }
    } catch (err) {
      console.error('Export failed:', err);
      setStep(1);
      alert('Export failed: ' + err.message);
    }
    setExporting(false);
  };
  
  // ---- Tags Template Download ----
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await asinApi.downloadTagsTemplate(tagsTemplateSeller || undefined);
    } catch (err) {
      console.error('Template download failed:', err);
      alert('Failed to download template');
    }
    setDownloadingTemplate(false);
  };
  
  // ---- Render ----
  if (!isOpen) return null;
  
  return createPortal(
    <div
      className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 9999 }}
      onClick={(e) => e.target === e.currentTarget && !exporting && onClose()}
    >
      <style>{`
        .export-modal { animation: exportSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes exportSlideIn { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        
        .checkbox-custom {
          width: 18px; height: 18px; border-radius: 5px; border: 2px solid #d1d5db;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: all 0.15s; flex-shrink: 0;
        }
        .checkbox-custom.checked { background: #18181b; border-color: #18181b; color: white; }
        .checkbox-custom:hover { border-color: #18181b; }
        
        .tab-btn { padding: 8px 20px; font-size: 13px; font-weight: 600; border: none; background: transparent; color: #9ca3af; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .tab-btn.active { color: #18181b; border-bottom-color: #18181b; }
        .tab-btn:hover { color: #52525b; }
        
        .btn-export {
          padding: 10px 24px; font-size: 13px; font-weight: 700; border-radius: 10px;
          border: none; cursor: pointer; transition: all 0.2s;
          background: #18181b; color: white;
          display: flex; align-items: center; gap: 8px;
        }
        .btn-export:hover { background: #27272a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .btn-export:disabled { background: #d4d4d8; cursor: not-allowed; transform: none; box-shadow: none; }
        
        .btn-outline {
          padding: 10px 24px; font-size: 13px; font-weight: 600; border-radius: 10px;
          border: 1.5px solid #e5e7eb; cursor: pointer; background: white; color: #52525b;
          transition: all 0.2s;
        }
        .btn-outline:hover { border-color: #18181b; color: #18181b; }
        
        .step-indicator { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; }
        .step-indicator.active { background: #18181b; color: white; }
        .step-indicator.completed { background: #059669; color: white; }
        .step-indicator.pending { background: #f3f4f6; color: #9ca3af; }
      `}</style>

      <div 
        className="bg-white shadow-2xl export-modal"
        style={{ width: '100%', maxWidth: '750px', maxHeight: '90vh', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-bottom d-flex justify-content-between align-items-center bg-white">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-zinc-900 text-white rounded-2">
              {activeTab === 'export' ? <Download size={20} /> : <FileDown size={20} />}
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-zinc-900">
                {activeTab === 'export' ? 'Export ASIN Data' : 'Download Tags Template'}
              </h5>
              <p className="small text-zinc-500 mb-0">
                {activeTab === 'export' ? 'Configure export settings' : 'Get template file for bulk tag updates'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-2 rounded-circle border-0" disabled={exporting}>
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 bg-white border-bottom d-flex gap-0">
          <button
            className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => { setActiveTab('export'); setStep(1); }}
          >
            <Download size={14} className="me-2" />
            Data Export
          </button>
          <button
            className={`tab-btn ${activeTab === 'tags' ? 'active' : ''}`}
            onClick={() => setActiveTab('tags')}
          >
            <Tag size={14} className="me-2" />
            Tags Template
          </button>
        </div>

        {/* Step Indicator (Export only) */}
        {activeTab === 'export' && (
          <div className="px-5 py-3 bg-zinc-50 border-bottom d-flex align-items-center gap-2">
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <div className={`step-indicator ${step === s ? 'active' : step > s ? 'completed' : 'pending'}`}>
                  {step > s ? <Check size={14} /> : s}
                </div>
                {s < 3 && <div className="flex-grow-1" style={{ height: '2px', background: step > s ? '#059669' : '#e5e7eb' }} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-grow-1 overflow-auto p-5">
          {/* ===== EXPORT TAB ===== */}
          {activeTab === 'export' && (
            <>
              {step === 1 && (
                <div className="d-flex flex-column gap-4">
                  {/* [1] Seller Selection */}
                  <div>
                    <label className="fw-bold text-zinc-800 mb-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                      <Store size={16} className="text-zinc-500" />
                      Select Sellers
                    </label>
                    <div className="position-relative">
                      <button
                        className="form-select text-start d-flex align-items-center justify-content-between"
                        onClick={() => setSellerDropdownOpen(!sellerDropdownOpen)}
                        style={{ height: '42px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '13px' }}
                      >
                        <span className="text-zinc-700">
                          {isAllSellersSelected 
                            ? `All Sellers (${sellers.length})` 
                            : selectedSellerIds.length === 0 
                              ? 'Select sellers...' 
                              : `${selectedSellerIds.length} seller(s) selected`}
                        </span>
                        <ChevronDown size={16} className="text-zinc-400" />
                      </button>
                      
                      {sellerDropdownOpen && (
                        <div className="position-absolute bg-white border rounded-3 shadow-lg" style={{ top: '100%', left: 0, right: 0, zIndex: 50, marginTop: '4px' }}>
                          <div className="p-2 border-bottom">
                            <div className="d-flex align-items-center gap-2 p-2 rounded-2 hover-bg-zinc-50 cursor-pointer" onClick={toggleAllSellers}>
                              <div className={`checkbox-custom ${isAllSellersSelected ? 'checked' : ''}`}>
                                {isAllSellersSelected && <Check size={12} />}
                              </div>
                              <span className="fw-bold text-zinc-700" style={{ fontSize: '12px' }}>SELECT ALL SELLERS</span>
                            </div>
                            <div className="position-relative mt-1">
                              <Search size={14} className="position-absolute top-50 start-0 translate-middle-y ms-2 text-zinc-400" />
                              <input
                                type="text"
                                className="form-control form-control-sm ps-4 border-0 bg-zinc-50 rounded-2"
                                placeholder="Search sellers..."
                                value={sellerSearch}
                                onChange={(e) => setSellerSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: '12px' }}
                              />
                            </div>
                          </div>
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {filteredSellers.map(seller => (
                              <div
                                key={seller._id}
                                className="d-flex align-items-center gap-2 px-3 py-2 hover-bg-zinc-50 cursor-pointer border-bottom border-zinc-50"
                                onClick={() => toggleSeller(seller._id)}
                              >
                                <div className={`checkbox-custom ${selectedSellerIds.includes(seller._id) ? 'checked' : ''}`} style={{ width: '16px', height: '16px' }}>
                                  {selectedSellerIds.includes(seller._id) && <Check size={10} />}
                                </div>
                                <div>
                                  <div className="fw-medium text-zinc-700" style={{ fontSize: '12px' }}>{seller.name}</div>
                                  <div className="text-zinc-400" style={{ fontSize: '10px' }}>{seller.sellerId}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* [2] Manager Filter */}
                  {isGlobalUser && managers.length > 0 && (
                    <div>
                      <label className="fw-bold text-zinc-800 mb-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                        <Users size={16} className="text-zinc-500" />
                        Brand Manager Filter
                      </label>
                      <select
                        className="form-select"
                        value={managerFilter}
                        onChange={(e) => setManagerFilter(e.target.value)}
                        style={{ height: '42px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '13px' }}
                      >
                        <option value="all">All Managers</option>
                        <option value="mine">My Sellers Only</option>
                        <option value="unassigned">Unassigned Sellers</option>
                        {managers.map(m => (
                          <option key={m._id} value={m._id}>{m.firstName} {m.lastName}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* [3] Date Range */}
                  <div>
                    <label className="fw-bold text-zinc-800 mb-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                      <Calendar size={16} className="text-zinc-500" />
                      Date Range
                    </label>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {[
                        { value: 'all', label: 'All Time' },
                        { value: 'today', label: 'Today' },
                        { value: 'yesterday', label: 'Yesterday' },
                        { value: '7days', label: 'Last 7 Days' },
                        { value: '30days', label: 'Last 30 Days' },
                        { value: '90days', label: 'Last 90 Days' },
                        { value: 'custom', label: 'Custom Range' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          className={`btn btn-sm rounded-pill px-3 py-1 fw-bold ${dateOption === opt.value ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 border'}`}
                          onClick={() => setDateOption(opt.value)}
                          style={{ fontSize: '11px' }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {dateOption === 'custom' && (
                      <div className="d-flex gap-3 align-items-center">
                        <input type="date" className="form-control form-control-sm" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} style={{ borderRadius: '8px', fontSize: '12px' }} />
                        <span className="text-zinc-400">to</span>
                        <input type="date" className="form-control form-control-sm" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} style={{ borderRadius: '8px', fontSize: '12px' }} />
                      </div>
                    )}
                  </div>

                  {/* [4] Fields Selection */}
                  <div>
                    <label className="fw-bold text-zinc-800 mb-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                      <ListChecks size={16} className="text-zinc-500" />
                      Select Fields ({selectedFields.length}/{ALL_ASIN_FIELDS.length})
                    </label>
                    
                    <div className="d-flex flex-wrap gap-1 mb-3">
                      <button className={`btn btn-sm rounded-pill px-2 py-0 ${fieldCategoryFilter === 'All' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`} onClick={() => setFieldCategoryFilter('All')} style={{ fontSize: '10px' }}>All</button>
                      {FIELD_CATEGORIES.map(cat => (
                        <button key={cat} className={`btn btn-sm rounded-pill px-2 py-0 ${fieldCategoryFilter === cat ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`} onClick={() => setFieldCategoryFilter(cat)} style={{ fontSize: '10px' }}>{cat}</button>
                      ))}
                    </div>

                    <div className="d-flex align-items-center gap-2 p-2 mb-2 rounded-2 hover-bg-zinc-50 cursor-pointer" onClick={toggleAllFields}>
                      <div className={`checkbox-custom ${isAllFieldsSelected ? 'checked' : ''}`}>{isAllFieldsSelected && <Check size={12} />}</div>
                      <span className="fw-bold text-zinc-700" style={{ fontSize: '12px' }}>SELECT ALL FIELDS</span>
                    </div>

                    <div className="row g-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {filteredFields.map(field => (
                        <div key={field.key} className="col-6">
                          <div className="d-flex align-items-center gap-2 p-2 rounded-2 hover-bg-zinc-50 cursor-pointer" onClick={() => toggleField(field.key)}>
                            <div className={`checkbox-custom ${selectedFields.includes(field.key) ? 'checked' : ''}`} style={{ width: '16px', height: '16px' }}>
                              {selectedFields.includes(field.key) && <Check size={10} />}
                            </div>
                            <span className="text-zinc-700" style={{ fontSize: '12px' }}>{field.label}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* [5] Export Format */}
                  <div>
                    <label className="fw-bold text-zinc-800 mb-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                      <FileSpreadsheet size={16} className="text-zinc-500" />
                      Export Format
                    </label>
                    <div className="d-flex gap-2">
                      <button className={`btn d-flex align-items-center gap-2 px-4 py-2 rounded-3 fw-bold ${exportFormat === 'csv' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 border'}`} onClick={() => setExportFormat('csv')} style={{ fontSize: '12px' }}>
                        <FileText size={16} /> CSV
                      </button>
                      <button className={`btn d-flex align-items-center gap-2 px-4 py-2 rounded-3 fw-bold ${exportFormat === 'xlsx' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 border'}`} onClick={() => setExportFormat('xlsx')} style={{ fontSize: '12px' }}>
                        <FileSpreadsheet size={16} /> Excel (XLSX)
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-4">
                  <div className="spinner-border text-zinc-900" role="status" style={{ width: '48px', height: '48px' }} />
                  <div className="text-center">
                    <h6 className="fw-bold text-zinc-900 mb-1">Generating Export File</h6>
                    <p className="text-zinc-500 small mb-3">Please wait while we compile your data...</p>
                    <div className="progress rounded-pill" style={{ width: '300px', height: '6px' }}>
                      <div className="progress-bar bg-zinc-900 rounded-pill" style={{ width: `${Math.min(exportProgress, 100)}%` }} />
                    </div>
                    <span className="text-zinc-400 smallest mt-2">{Math.round(exportProgress)}%</span>
                  </div>
                </div>
              )}

              {step === 3 && exportComplete && (
                <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-4">
                  <div className="p-4 bg-success-subtle rounded-circle">
                    <Check size={48} className="text-success" />
                  </div>
                  <div className="text-center">
                    <h6 className="fw-bold text-zinc-900 mb-1">Export Complete!</h6>
                    <p className="text-zinc-500 small mb-0">File downloaded successfully</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== TAGS TEMPLATE TAB ===== */}
          {activeTab === 'tags' && (
            <div className="d-flex flex-column gap-4 py-3">
              <div className="p-4 bg-indigo-50 rounded-3 border border-indigo-100">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <Tag size={18} className="text-indigo-600" />
                  <h6 className="mb-0 fw-bold text-indigo-900">Bulk Tags Update Template</h6>
                </div>
                <p className="text-indigo-700 mb-0" style={{ fontSize: '13px' }}>
                  Download a pre-filled template with all your ASINs. Edit the Tags column, then upload the file using the import button on the ASIN Manager page.
                </p>
              </div>

              <div>
                <label className="fw-bold text-zinc-800 mb-2 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
                  <Store size={16} className="text-zinc-500" />
                  Select Seller (Optional)
                </label>
                <select
                  className="form-select"
                  value={tagsTemplateSeller}
                  onChange={(e) => setTagsTemplateSeller(e.target.value)}
                  style={{ height: '42px', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '13px' }}
                >
                  <option value="">All Sellers</option>
                  {sellers.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.sellerId})</option>
                  ))}
                </select>
              </div>

              <div className="bg-zinc-50 rounded-3 p-4">
                <h6 className="fw-bold text-zinc-800 mb-3" style={{ fontSize: '13px' }}>Template Columns</h6>
                <div className="d-flex gap-3 flex-wrap">
                  {['Parent ASIN', 'Child ASIN', 'Seller Name', 'Tags', 'Title'].map(col => (
                    <span key={col} className="badge bg-white border text-zinc-700 px-3 py-2 rounded-2" style={{ fontSize: '11px' }}>
                      {col}
                    </span>
                  ))}
                </div>
                <div className="mt-3">
                  <span className="text-zinc-500" style={{ fontSize: '11px' }}>
                    <strong>Available Tags:</strong> Best Seller, Low Margin, High Margin, Needs Optimization, 
                    A+ Content Missing, Low LQS, BuyBox Lost, Price Drop, New Launch, Seasonal, Clearance, 
                    Replenishment, Ad Active, No Ads, Review Alert, Competitor Alert
                  </span>
                </div>
              </div>

              <button
                className="btn-export justify-content-center w-100"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
              >
                {downloadingTemplate ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <FileDown size={16} />
                    Download Tags Template (Excel)
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'export' && step === 1 && (
          <div className="px-5 py-4 border-top bg-white d-flex justify-content-between align-items-center">
            <button onClick={onClose} className="btn-outline px-4 py-2">
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedSellerIds.length === 0 || selectedFields.length === 0}
              className="btn-export px-5 py-2"
            >
              <Download size={16} />
              Export {exportFormat.toUpperCase()}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ExportAsinModal;
