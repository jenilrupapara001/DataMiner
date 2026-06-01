import React, { useState, useEffect, useMemo } from 'react';
import { 
  Drawer, Tabs, Button, Select, Checkbox, Row, Col, 
  Radio, Progress, Alert, Tag as AntTag, Space, 
  Typography, Segmented, Divider, Input, Tooltip, Card,
  DatePicker
} from 'antd';
import { 
  Download, FileSpreadsheet, FileText, Calendar, 
  Store, ListChecks, Database, Tag as TagIcon, 
  RefreshCw, FileDown, Layers, CheckCircle2, 
  AlertCircle, Search, Trash2, X
} from 'lucide-react';
import { sellerApi, asinApi, exportApi } from '../../services/api';

const { Text, Title, Paragraph } = Typography;
const { RangePicker } = DatePicker;

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
  { key: 'uploadedPrice', label: 'Master Price (₹)', category: 'Pricing' },
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
  const [step, setStep] = useState(1); // 1: Config, 2: Progress
  
  // Sellers
  const [sellers, setSellers] = useState([]);
  const [selectedSellerIds, setSelectedSellerIds] = useState(selectedSeller ? [selectedSeller] : []);
  
  // Fields
  const [selectedFields, setSelectedFields] = useState([
    'asinCode', 'parentAsin', 'sku', 'title', 'brand', 'category',
    'currentPrice', 'mrp', 'bsr', 'rating', 'reviewCount', 'lqs', 'soldBy', 'tags'
  ]);
  const [fieldCategoryFilter, setFieldCategoryFilter] = useState('All');
  const [fieldSearch, setFieldSearch] = useState('');
  
  // Format & Options
  const [exportFormat, setExportFormat] = useState('csv');
  const [dateOption, setDateOption] = useState('all');
  const [customDateRange, setCustomDateRange] = useState(null);
  const [exportType, setExportType] = useState(selectedIds.length > 0 ? 'selected' : 'filtered');
  const [marketplace, setMarketplace] = useState('amazon');
  
  // Processing
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [error, setError] = useState(null);

  // ===== EFFECTS =====
  useEffect(() => {
    if (isOpen) {
      fetchSellers();
      setStep(1); 
      setError(null); 
      setExportProgress(0);
      setExporting(false);
      setSelectedSellerIds(selectedSeller ? [selectedSeller] : []);
      setMarketplace('amazon');
      setExportType(selectedIds.length > 0 ? 'selected' : 'filtered');

      // Auto-select fields based on active filters
      let baseFields = new Set([
        'asinCode', 'parentAsin', 'sku', 'title', 'brand', 'category',
        'currentPrice', 'mrp', 'bsr', 'rating', 'reviewCount', 'lqs', 'soldBy', 'tags'
      ]);
      
      if (currentFilters) {
        if (currentFilters.priceDispute) {
          ['uploadedPrice', 'dealBadge', 'priceDispute', 'discountPercentage', 'secondAsp'].forEach(f => baseFields.add(f));
        }
        if (currentFilters.buyBoxWin) {
          ['buyBoxWin', 'soldBy', 'soldBySec'].forEach(f => baseFields.add(f));
        }
        if (currentFilters.hasAplus) {
          baseFields.add('hasAplus');
        }
        if (currentFilters.scrapeStatus) {
          ['scrapeStatus', 'lastScraped'].forEach(f => baseFields.add(f));
        }
        if (currentFilters.bsrTrend) {
          ['bsr', 'subBsr'].forEach(f => baseFields.add(f));
        }
        if (currentFilters.ratingTrend) {
          ['rating', 'reviewCount'].forEach(f => baseFields.add(f));
        }
        if (currentFilters.hasVideo) {
          baseFields.add('videoCount');
        }
        if (currentFilters.hasDeal) {
          baseFields.add('dealBadge');
        }
        if (currentFilters.minTitleScore || currentFilters.minBulletScore || currentFilters.minImageScore || currentFilters.minDescriptionScore) {
          ['titleScore', 'bulletScore', 'imageScore', 'descriptionScore'].forEach(f => baseFields.add(f));
        }
      }
      setSelectedFields(Array.from(baseFields));
    }
  }, [isOpen, selectedSeller, selectedIds, currentFilters]);

  const fetchSellers = async () => {
    try {
      const response = await sellerApi.getAll({ limit: 500, page: 1 });
      if (response.success) setSellers(response.data?.sellers || []);
    } catch (err) { console.error(err); }
  };

  const sellerOptions = useMemo(() => {
    const filteredSellers = sellers.filter(s => {
      if (marketplace === 'all') return true;
      const m = (s.marketplace || '').toLowerCase();
      return marketplace === 'ajio' ? m === 'ajio' : m !== 'ajio';
    });

    const options = filteredSellers.map(s => ({
      label: (
        <div className="d-flex flex-column">
          <Text strong style={{ fontSize: '13px' }}>{s.name}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>{s.sellerId} • {s.marketplace || 'amazon.in'}</Text>
        </div>
      ),
      value: s._id || s.Id,
      searchText: `${s.name} ${s.sellerId}`.toLowerCase()
    }));

    if (options.length > 0) {
      options.unshift({
        label: (
          <div className="d-flex align-items-center gap-2">
            <ListChecks size={14} className="text-primary" />
            <Text strong className="text-primary">Select All Brands</Text>
          </div>
        ),
        value: 'SELECT_ALL',
        searchText: 'select all brands'
      });
    }

    return options;
  }, [sellers, marketplace]);

  const filteredFields = useMemo(() => {
    let fields = fieldCategoryFilter === 'All' ? ALL_ASIN_FIELDS : ALL_ASIN_FIELDS.filter(f => f.category === fieldCategoryFilter);
    if (fieldSearch.trim()) {
      const q = fieldSearch.toLowerCase();
      fields = fields.filter(f => f.label.toLowerCase().includes(q));
    }
    return fields;
  }, [fieldCategoryFilter, fieldSearch]);

  const isAllFieldsSelected = selectedFields.length === ALL_ASIN_FIELDS.length;

  // ===== HANDLERS =====
  const toggleAllFields = () => {
    if (isAllFieldsSelected) {
      setSelectedFields(['asinCode', 'title', 'currentPrice']);
    } else {
      setSelectedFields(ALL_ASIN_FIELDS.map(f => f.key));
    }
  };

  const selectCategory = (cat) => {
    const catKeys = ALL_ASIN_FIELDS.filter(f => f.category === cat).map(f => f.key);
    setSelectedFields(prev => [...new Set([...prev, ...catKeys])]);
  };

  const getAppliedFiltersBadges = () => {
    const badges = [];
    const mapping = {
      sku: 'SKU',
      parentAsin: 'Parent ASIN',
      scrapeStatus: 'Scrape Status',
      brand: 'Brand',
      category: 'Category',
      subBsrCategory: 'Sub BSR',
      buyBoxWin: 'BuyBox Winner',
      hasAplus: 'A+ Content',
      hasVideo: 'Video',
      hasDeal: 'Deal',
      minPrice: 'Min Price',
      maxPrice: 'Max Price',
      minBSR: 'Min BSR',
      maxBSR: 'Max BSR',
      minRating: 'Min Rating',
      maxRating: 'Max Rating',
      ageFilter: 'Age',
      minReleaseDate: 'From',
      maxReleaseDate: 'To',
      priceDispute: 'Price Dispute',
      bsrTrend: 'BSR Trend',
      ratingTrend: 'Rating Trend',
      historyDays: 'History Range',
      status: 'Status'
    };

    if (currentFilters) {
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value && mapping[key]) {
          let label = value;
          if (value === 'true') label = 'Yes';
          if (value === 'false') label = 'No';

          badges.push(
            <div key={key} className="d-flex align-items-center gap-1.5 px-2 border shadow-sm" style={{ height: '26px', fontSize: '10px', backgroundColor: '#f4f4f5', color: '#3f3f46', borderColor: '#e4e4e7', borderRadius: '6px' }}>
              <span className="fw-bold opacity-70 text-uppercase" style={{ fontSize: '8px', letterSpacing: '0.02em' }}>{mapping[key]}:</span>
              <span className="fw-bold">{label}</span>
            </div>
          );
        }
      });

      if (currentFilters.selectedTags?.length > 0) {
        currentFilters.selectedTags.forEach(tag => {
          badges.push(
            <div key={`tag-${tag}`} className="d-flex align-items-center gap-1.5 px-2 border shadow-sm" style={{ height: '26px', fontSize: '10px', backgroundColor: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe', borderRadius: '6px' }}>
              <TagIcon size={10} className="opacity-80" />
              <span className="fw-bold">{tag}</span>
            </div>
          );
        });
      }
    }

    if (searchQuery) {
      badges.unshift(
        <div key="search" className="d-flex align-items-center gap-1.5 px-2 border shadow-sm" style={{ height: '26px', fontSize: '10px', backgroundColor: '#fffbeb', color: '#b45309', borderColor: '#fcd34d', borderRadius: '6px' }}>
          <Search size={10} className="opacity-80" />
          <span className="fw-bold italic">"{searchQuery}"</span>
        </div>
      );
    }

    return badges;
  };

  const handleExport = async () => {
    if (exportType === 'selected' && selectedIds.length === 0) {
      setError('No items selected to export');
      return;
    }

    if (selectedFields.length === 0) {
      setError('Please select at least one field');
      return;
    }

    setExporting(true);
    setStep(2);
    setError(null);
    setExportProgress(0);

    try {
      const exportParams = {
        fields: selectedFields,
        format: exportFormat,
        dateRange: dateOption === 'custom' && customDateRange 
          ? { start: customDateRange[0].toISOString(), end: customDateRange[1].toISOString() } 
          : dateOption,
        sellerIds: selectedSellerIds,
      };

      if (dateOption === 'custom' && customDateRange) {
        // Check if multiple dates are selected (start and end are not on the same day)
        const startDay = customDateRange[0].toISOString().split('T')[0];
        const endDay = customDateRange[1].toISOString().split('T')[0];
        if (startDay !== endDay) {
          exportParams.isHistorical = true;
        }
      }

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
        if (selectedSeller && selectedSellerIds.length === 0) {
          exportParams.sellerIds = [selectedSeller];
        }
      }

      const res = await exportApi.startExport(exportParams);

      if (res.success) {
        const downloadId = res.downloadId;
        
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
                    setError('File ready, but download failed. Check Downloads drawer.');
                    setStep(1);
                    setExporting(false);
                  }
                }, 500);
              } else if (Status === 'failed') {
                setError(ErrorMessage || 'Export generation failed');
                setStep(1);
                setExporting(false);
              } else {
                setTimeout(pollExportStatus, 2000);
              }
            }
          } catch (pollErr) {
            setError('Lost connection to server. Check your downloads later.');
            setStep(1);
            setExporting(false);
          }
        };
        pollExportStatus();
      }
    } catch (err) {
      setError(err.message);
      setStep(1);
      setExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try { await asinApi.downloadTagsTemplate(); } catch (err) { console.error(err); }
  };

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      size={750}
      maskClosable={!exporting}
      closable={!exporting}
      className="premium-export-drawer"
      styles={{ 
        body: { padding: 0, background: '#f8fafc' },
        footer: { padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: 'white' }
      }}
      title={
        <Space size={16}>
          <div className="title-icon-container">
            <Download size={20} />
          </div>
          <div>
            <Title level={5} style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Export Center</Title>
            <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '-2px' }}>
              Configure and download your product inventory
            </Text>
          </div>
        </Space>
      }
      footer={step === 1 && activeTab === 'export' ? (
        <div className="d-flex justify-content-between align-items-center">
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {selectedFields.length} fields selected for export
          </Text>
          <Space size={12}>
            <Button size="large" onClick={onClose} disabled={exporting}>Cancel</Button>
            <Button 
              type="primary" 
              size="large" 
              icon={exporting ? <RefreshCw size={16} className="spin" /> : <Download size={16} />}
              onClick={handleExport}
              loading={exporting}
              disabled={selectedFields.length === 0}
              style={{ minWidth: '160px' }}
              className="export-primary-btn"
            >
              {exporting ? 'Generating...' : `Generate ${exportFormat.toUpperCase()}`}
            </Button>
          </Space>
        </div>
      ) : null}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        className="custom-tabs"
        items={[
          {
            key: 'export',
            label: <Space><Database size={16} />Data Export</Space>,
            children: (
              <div style={{ background: '#fafafa', minHeight: '400px' }}>
                {step === 1 ? (
                  <div className="p-4 d-flex flex-column gap-4">
                    
                    {/* SECTION 1: EXPORT SCOPE */}
                    <Card size="small" className="config-card">
                      <div className="d-flex align-items-center gap-2 mb-4">
                        <div className="section-dot" />
                        <Text strong className="section-title">Step 1: Export Scope</Text>
                      </div>
                      
                      <Row gutter={24}>
                        <Col span={24}>
                          <div className="mb-3">
                            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>Select dataset source</Text>
                            <Segmented
                              block
                              value={exportType}
                              onChange={setExportType}
                              className="modern-segmented"
                              options={[
                                {
                                  value: 'filtered',
                                  label: (
                                    <div className="compact-segmented-item px-2">
                                      <div className="d-flex align-items-center gap-3">
                                        <div className="p-1.5 rounded-2 bg-white d-flex align-items-center justify-content-center shadow-sm">
                                          <ListChecks size={14} className="text-primary" />
                                        </div>
                                        <div className="text-start">
                                          <div className="item-main-text">Filtered View</div>
                                          <div className="item-sub-text">Current board state</div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                },
                                {
                                  value: 'selected',
                                  disabled: selectedIds.length === 0,
                                  label: (
                                    <div className="compact-segmented-item px-2">
                                      <div className="d-flex align-items-center gap-3">
                                        <div className="p-1.5 rounded-2 bg-white d-flex align-items-center justify-content-center shadow-sm">
                                          <CheckCircle2 size={14} className="text-success" />
                                        </div>
                                        <div className="text-start">
                                          <div className="item-main-text">Selection ({selectedIds.length})</div>
                                          <div className="item-sub-text">Checked items</div>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                }
                              ]}
                            />
                          </div>
                        </Col>

                        {exportType === 'filtered' && (
                          <Col span={24}>
                            <Divider style={{ margin: '16px 0' }} />
                            <div className="mb-3">
                              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '12px' }}>Filter by Marketplace & Seller</Text>
                              <div className="marketplace-selector mb-3">
                                <Segmented
                                  block
                                  value={marketplace}
                                  onChange={(val) => { setMarketplace(val); setSelectedSellerIds([]); }}
                                  options={[
                                    { 
                                      value: 'all', 
                                      label: (
                                        <div className="marketplace-logo-wrapper">
                                          <Text strong style={{ fontSize: '14px', letterSpacing: '1px', color: '#1e293b' }}>ALL</Text>
                                        </div>
                                      )
                                    },
                                    { 
                                      value: 'amazon', 
                                      label: (
                                        <div className="marketplace-logo-wrapper">
                                          <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" style={{ height: '14px', filter: 'brightness(0.2)' }} alt="Amazon" />
                                        </div>
                                      )
                                    },
                                    { 
                                      value: 'ajio', 
                                      label: (
                                        <div className="marketplace-logo-wrapper">
                                          <Text strong style={{ fontSize: '14px', letterSpacing: '1px', color: '#1e293b' }}>AJIO</Text>
                                        </div>
                                      )
                                    }
                                  ]}
                                />
                              </div>
                              <Select
                                mode="multiple"
                                style={{ width: '100%' }}
                                placeholder="Select sellers to include..."
                                value={selectedSellerIds}
                                onChange={(vals) => {
                                  if (vals.includes('SELECT_ALL')) {
                                    const allIds = sellerOptions.filter(o => o.value !== 'SELECT_ALL').map(o => o.value);
                                    setSelectedSellerIds(allIds);
                                  } else {
                                    setSelectedSellerIds(vals);
                                  }
                                }}
                                options={sellerOptions}
                                optionFilterProp="searchText"
                                maxTagCount="responsive"
                                size="large"
                                showSearch
                                className="modern-select"
                              />
                            </div>

                            {getAppliedFiltersBadges().length > 0 && (
                              <div className="mt-3">
                                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>Active Filters Applied to Export</Text>
                                <div className="d-flex flex-wrap gap-2">
                                  {getAppliedFiltersBadges()}
                                </div>
                              </div>
                            )}
                          </Col>
                        )}
                      </Row>
                    </Card>

                    {/* SECTION 2: FIELDS */}
                    <Card size="small" className="config-card">
                      <div className="d-flex align-items-center justify-content-between mb-4">
                        <div className="d-flex align-items-center gap-2">
                          <div className="section-dot" />
                          <Text strong className="section-title">Step 2: Data Fields</Text>
                        </div>
                        <AntTag color="blue" variant="filled" style={{ borderRadius: '12px', fontSize: '11px', padding: '0 10px' }}>
                          {selectedFields.length} selected
                        </AntTag>
                      </div>

                      <div className="field-filter-bar mb-3">
                        <div className="d-flex flex-wrap gap-2 mb-3">
                          <Button 
                            size="small" 
                            className={`cat-pill ${fieldCategoryFilter === 'All' ? 'active' : ''}`}
                            onClick={() => setFieldCategoryFilter('All')}
                          >
                            All Fields
                          </Button>
                          {FIELD_CATEGORIES.map(cat => (
                            <Button 
                              key={cat}
                              size="small" 
                              className={`cat-pill ${fieldCategoryFilter === cat ? 'active' : ''}`}
                              onClick={() => setFieldCategoryFilter(cat)}
                            >
                              {cat}
                            </Button>
                          ))}
                        </div>

                        <div className="d-flex gap-2">
                          <Input 
                            prefix={<Search size={14} className="text-muted" />} 
                            placeholder="Find specific fields..." 
                            value={fieldSearch}
                            onChange={e => setFieldSearch(e.target.value)}
                            className="search-input-modern"
                            allowClear
                          />
                          <Button 
                            icon={isAllFieldsSelected ? <Trash2 size={14} /> : <ListChecks size={14} />}
                            onClick={toggleAllFields}
                          >
                            {isAllFieldsSelected ? 'Clear' : 'Select All'}
                          </Button>
                        </div>
                      </div>

                      <div className="field-grid-container">
                        <Checkbox.Group 
                          style={{ width: '100%' }} 
                          value={selectedFields} 
                          onChange={setSelectedFields}
                        >
                          <Row gutter={[12, 12]}>
                            {filteredFields.map(field => (
                              <Col span={12} key={field.key}>
                                <div className={`field-checkbox-wrapper ${selectedFields.includes(field.key) ? 'selected' : ''}`}>
                                  <Checkbox value={field.key}>
                                    <Text style={{ fontSize: '13px' }}>{field.label}</Text>
                                  </Checkbox>
                                </div>
                              </Col>
                            ))}
                          </Row>
                        </Checkbox.Group>
                      </div>
                    </Card>

                    {/* SECTION 3: FORMATTING */}
                    <Card size="small" className="config-card">
                      <div className="d-flex align-items-center gap-2 mb-4">
                        <div className="section-dot" />
                        <Text strong className="section-title">Step 3: Output Format</Text>
                      </div>
                      
                      <Row gutter={20}>
                        <Col span={12}>
                          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '10px', textTransform: 'uppercase' }}>Timeframe</Text>
                          <Radio.Group value={dateOption} onChange={e => setDateOption(e.target.value)} className="w-100 modern-radio-group">
                            <div className="d-flex flex-column gap-2">
                              <Radio value="all" className="radio-pill">Lifetime Data</Radio>
                              <div className="d-flex gap-2">
                                <Radio value="today" className="radio-pill flex-grow-1">Today</Radio>
                                <Radio value="yesterday" className="radio-pill flex-grow-1">Yesterday</Radio>
                              </div>
                              <div className="d-flex gap-2">
                                <Radio value="7days" className="radio-pill flex-grow-1">Last 7d</Radio>
                                <Radio value="30days" className="radio-pill flex-grow-1">Last 30d</Radio>
                              </div>
                              <Radio value="custom" className="radio-pill">Custom Range</Radio>
                            </div>
                          </Radio.Group>
                          
                          {dateOption === 'custom' && (
                            <div className="mt-3 fade-in">
                              <RangePicker 
                                style={{ width: '100%', borderRadius: '8px' }} 
                                value={customDateRange}
                                onChange={setCustomDateRange}
                                size="large"
                              />
                            </div>
                          )}
                        </Col>
                        <Col span={12}>
                          <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: '10px', textTransform: 'uppercase' }}>File Type</Text>
                          <Radio.Group value={exportFormat} onChange={e => setExportFormat(e.target.value)} className="w-100">
                            <Space direction="vertical" className="w-100">
                              <Radio value="csv" className="format-option-box">
                                <Space size={12}>
                                  <div className="format-icon csv"><FileText size={16} /></div>
                                  <div>
                                    <Text strong style={{ fontSize: '13px' }}>CSV</Text>
                                    <div className="format-desc">Best for raw data imports</div>
                                  </div>
                                </Space>
                              </Radio>
                              <Radio value="xlsx" className="format-option-box">
                                <Space size={12}>
                                  <div className="format-icon excel"><FileSpreadsheet size={16} /></div>
                                  <div>
                                    <Text strong style={{ fontSize: '13px' }}>Excel</Text>
                                    <div className="format-desc">Formatted with styling</div>
                                  </div>
                                </Space>
                              </Radio>
                            </Space>
                          </Radio.Group>
                        </Col>
                      </Row>
                    </Card>

                    {error && (
                      <Alert
                        message="Configuration Requirement"
                        description={error}
                        type="error"
                        showIcon
                        icon={<AlertCircle size={18} />}
                        closable
                        onClose={() => setError(null)}
                        style={{ borderRadius: '12px' }}
                      />
                    )}
                  </div>
                ) : (
                  /* PROGRESS STEP */
                  <div className="d-flex flex-column align-items-center justify-content-center p-5 gap-4" style={{ minHeight: '400px' }}>
                    <div className="text-center">
                      <Progress 
                        type="circle" 
                        percent={Math.round(exportProgress)} 
                        strokeColor={{ '0%': '#18181b', '100%': '#52525b' }}
                        width={120}
                      />
                      <div className="mt-4">
                        <Title level={4} style={{ marginBottom: '4px' }}>Generating Your File</Title>
                        <Paragraph type="secondary">
                          {exportType === 'selected' ? `Exporting ${selectedIds.length} selected items` : `Exporting filtered dataset`}
                        </Paragraph>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          This may take a minute depending on the volume of data...
                        </Text>
                      </div>
                    </div>
                    {error && (
                      <div className="text-center">
                        <Alert
                          type="error"
                          message="Export Failed"
                          description={error}
                          showIcon
                          className="mb-3"
                        />
                        <Button size="large" type="primary" onClick={() => { setStep(1); setError(null); }}>
                          Adjust Configuration
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          },
          {
            key: 'tags',
            label: <Space><TagIcon size={16} />Tags Template</Space>,
            children: (
              <div className="p-5 d-flex flex-column align-items-center justify-content-center gap-4" style={{ minHeight: '400px', background: '#fcfcfc' }}>
                <div className="p-5 bg-white border rounded-4 text-center shadow-sm" style={{ maxWidth: '450px' }}>
                  <div className="mb-4 d-inline-flex p-4 rounded-circle" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                    <FileDown size={48} />
                  </div>
                  <Title level={4}>Bulk Tags Template</Title>
                  <Paragraph type="secondary">
                    Download a pre-filled Excel file containing all your ASINs. You can edit tags in bulk and re-upload the file to update your inventory.
                  </Paragraph>
                  <Button 
                    type="primary" 
                    size="large" 
                    icon={<Download size={18} />}
                    onClick={handleDownloadTemplate}
                    style={{ background: '#4f46e5', borderColor: '#4f46e5', height: '50px', width: '100%', marginTop: '10px' }}
                  >
                    Download Template (Excel)
                  </Button>
                </div>
              </div>
            )
          }
        ]}
      />
      
      <style>{`
        .premium-export-drawer .ant-drawer-header {
          padding: 20px 24px;
          border-bottom: 1px solid #f1f5f9;
        }
        .title-icon-container {
          padding: 10px;
          border-radius: 10px;
          background: #f1f5f9;
          color: #0f172a;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .custom-tabs .ant-tabs-nav {
          padding: 0 24px;
          margin-bottom: 0;
          background: white;
          border-bottom: 1px solid #f1f5f9;
        }
        .config-card {
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        }
        .section-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3b82f6;
        }
        .section-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          color: #475569;
        }
        .modern-segmented {
          padding: 3px;
          background: #f1f5f9;
          border-radius: 8px;
        }
        .compact-segmented-item {
          padding: 6px 4px;
          display: flex;
          align-items: center;
        }
        .item-main-text {
          font-size: 13px;
          font-weight: 600;
          line-height: 1.2;
          color: #1e293b;
        }
        .item-sub-text {
          font-size: 10px;
          color: #64748b;
          line-height: 1;
        }
        .marketplace-logo-wrapper {
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 12px;
        }
          border-radius: 100px;
          font-size: 11px;
          border: 1px solid #e2e8f0;
          background: white;
          transition: all 0.2s;
        }
        .cat-pill.active {
          background: #0f172a;
          color: white;
          border-color: #0f172a;
        }
        .search-input-modern {
          border-radius: 8px;
        }
        .field-grid-container {
          max-height: 250px;
          overflow-y: auto;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
        }
        .field-checkbox-wrapper {
          padding: 8px 12px;
          border-radius: 8px;
          background: white;
          border: 1px solid #f1f5f9;
          transition: all 0.2s;
        }
        .field-checkbox-wrapper:hover {
          border-color: #cbd5e1;
          background: #fcfcfc;
        }
        .field-checkbox-wrapper.selected {
          border-color: #3b82f6;
          background: #eff6ff;
        }
        .radio-pill {
          padding: 6px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: white;
          width: 100%;
          margin: 0 !important;
        }
        .ant-radio-wrapper-checked .radio-pill {
          border-color: #3b82f6;
          background: #eff6ff;
        }
        .format-option-box {
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          display: block;
          margin: 0 !important;
          transition: all 0.2s;
        }
        .format-option-box:hover {
          border-color: #cbd5e1;
        }
        .ant-radio-wrapper-checked .format-option-box {
          border-color: #0f172a;
          background: #f8fafc;
        }
        .format-icon {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .format-icon.csv { background: #e0f2fe; color: #0369a1; }
        .format-icon.excel { background: #dcfce7; color: #15803d; }
        .format-desc { font-size: 10px; color: #64748b; }
        .export-primary-btn {
          background: #0f172a;
          border-color: #0f172a;
          border-radius: 8px;
        }
        .spin {
          animation: rotate 2s linear infinite;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Drawer>
  );
};

export default ExportAsinModal;
