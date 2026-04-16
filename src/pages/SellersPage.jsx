import React, { useState, useEffect, useMemo } from 'react';
import DataTable from '../components/DataTable';
import ListView from '../components/common/ListView';
import ProgressBar from '../components/common/ProgressBar';
import KPICard from '../components/KPICard';
import EmptyState from '../components/common/EmptyState';
import { sellerApi, asinApi, authApi, userApi, marketSyncApi } from '../services/api';
import {
  CheckCircle2,
  PauseCircle,
  Package,
  Search,
  Plus,
  FileUp,
  MoreHorizontal,
  ExternalLink,
  ShieldCheck,
  Zap,
  Clock,
  Trash2,
  Play,
  Pause,
  LayoutGrid,
  List,
  AlertCircle,
  Store,
  Wand2,
  RefreshCw,
  Database,
  Edit3,
  Trash,
  Eye,
  EyeOff,
  FileJson,
  Scan,
  Globe,
  Key,
  Users,
  Layers,
  Settings,
  ChevronRight,
  X,
  Upload as UploadIcon,
  FileCheck
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';

const SellersPage = () => {
  const { user: currentUser, isAdmin, hasPermission } = useAuth();
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAsinModal, setShowAsinModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerAsins, setSellerAsins] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalItems, setTotalItems] = useState(0);

  const [showPoolModal, setShowPoolModal] = useState(false);
  const [poolStats, setPoolStats] = useState({ total: 0, assigned: 0, available: 0 });
  const [editingSeller, setEditingSeller] = useState(null);
  const [showEditAsinModal, setShowEditAsinModal] = useState(false);
  const [editingAsin, setEditingAsin] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadSellers();
    if (isAdmin) {
      fetchPoolStats();
    }
  }, [isAdmin, currentUser]); // Only re-fetch when user identity changes

  // Reset page to 1 on ANY filter change
  useEffect(() => {
    setPage(1);
  }, [activeTab, marketplaceFilter, statusFilter, searchQuery]);

  const fetchPoolStats = async () => {
    try {
      const response = await marketSyncApi.getPoolStatus();
      if (response.success) {
        setPoolStats(response.stats);
      }
    } catch (error) {
      console.error('Failed to fetch pool stats:', error);
    }
  };

  const loadSellers = async () => {
    setLoading(true);
    console.debug('[DIAGNOSTIC] SellersPage: Fetching full dataset (Limit: 10000)...');
    try {
      // Fetch everything with zero filtering on backend
      const response = await sellerApi.getAll({ limit: 10000 });

      console.debug('[DIAGNOSTIC] SellersPage: Raw API Response:', response);

      let extractedSellers = [];

      // Robust multi-path extraction
      if (response) {
        if (response.success && response.data) {
          extractedSellers = response.data.sellers || (Array.isArray(response.data) ? response.data : []);
        } else if (response.sellers && Array.isArray(response.sellers)) {
          extractedSellers = response.sellers;
        } else if (Array.isArray(response)) {
          extractedSellers = response;
        } else if (response.data && Array.isArray(response.data)) {
          extractedSellers = response.data;
        }
      }

      console.debug(`[DIAGNOSTIC] SellersPage: Extracted ${extractedSellers.length} sellers.`);
      if (extractedSellers.length > 0) {
        console.table(extractedSellers.slice(0, 5).map(s => ({
          Name: s.name,
          ID: s.sellerId,
          Status: s.status,
          Market: s.marketplace
        })));
      }

      setSellers(extractedSellers);
    } catch (error) {
      console.error('[DIAGNOSTIC] SellersPage: Fetch Failed:', error);
      addToast('Network error: Could not connect to data service', 'error');
      setSellers([]);
    } finally {
      setLoading(false);
    }
  };

  const { filteredSellers, paginatedSellers, totalResults } = useMemo(() => {
    if (!Array.isArray(sellers)) {
      return { filteredSellers: [], paginatedSellers: [], totalResults: 0 };
    }

    let filtered = [...sellers];

    // 1. Tab Status Filter (Case-Insensitive)
    if (activeTab !== 'all') {
      const target = activeTab.toLowerCase();
      filtered = filtered.filter(s =>
        s.status?.toLowerCase() === target
      );
    }

    // 2. Marketplace Filter
    if (marketplaceFilter !== 'all') {
      filtered = filtered.filter(s => s.marketplace === marketplaceFilter);
    }

    // 3. Status Dropdown (Secondary)
    if (statusFilter !== 'all') {
      const target = statusFilter.toLowerCase();
      filtered = filtered.filter(s =>
        s.status?.toLowerCase() === target
      );
    }

    // 4. Global Search
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      filtered = filtered.filter(seller =>
        (seller.name || '').toLowerCase().includes(search) ||
        (seller.sellerId || '').toLowerCase().includes(search)
      );
    }

    // 5. Slice and Count
    const count = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    console.debug(`SellersPage: Filtering complete. Total: ${sellers.length}, Filtered: ${count}, Page size: ${paginated.length}`);

    return {
      filteredSellers: filtered,
      paginatedSellers: paginated,
      totalResults: count
    };
  }, [sellers, searchQuery, page, limit, activeTab, marketplaceFilter, statusFilter]);


  const handleAddSeller = async (sellerData) => {
    try {
      if (editingSeller) {
        await sellerApi.update(editingSeller._id, sellerData);
      } else {
        await sellerApi.create(sellerData);
      }
      await loadSellers();
      setShowAddModal(false);
      setEditingSeller(null);
    } catch (error) {
      addToast({
        title: 'Operation Failed',
        message: 'Failed to save seller: ' + error.message,
        type: 'error'
      });
    }
  };

  const handleEditSeller = (seller) => {
    setEditingSeller(seller);
    setShowAddModal(true);
  };

  const handleImportSellers = async (sellers) => {
    setLoading(true);
    try {
      const response = await sellerApi.import(sellers);
      if (response.success) {
        addToast({
          title: 'Import Successful',
          message: `${sellers.length} storefronts have been successfully onboarded.`,
          type: 'success'
        });
        await loadSellers();
        setShowImportModal(false);
      }
    } catch (error) {
      addToast({
        title: 'Import Failed',
        message: error.message || 'Check your CSV format and try again.',
        type: 'error'
      });
    }
    setLoading(false);
  };

  const handleToggleStatus = async (sellerId) => {
    try {
      const seller = sellers.find(s => s._id === sellerId);
      if (seller) {
        await sellerApi.update(sellerId, {
          status: seller.status === 'Active' ? 'Paused' : 'Active'
        });
        await loadSellers();
      }
    } catch (error) {
      addToast({
        title: 'Status Update Failed',
        message: 'Failed to update seller: ' + error.message,
        type: 'error'
      });
    }
  };

  const handleDeleteSeller = async (sellerId) => {
    if (window.confirm('Are you sure you want to delete this seller? All ASINs will also be deleted.')) {
      try {
        await sellerApi.delete(sellerId);
        await loadSellers();
      } catch (error) {
        addToast({
          title: 'Delete Failed',
          message: 'Failed to delete seller: ' + error.message,
          type: 'error'
        });
      }
    }
  };

  const handleViewAsins = async (seller) => {
    setSelectedSeller(seller);
    setShowAsinModal(true);
    try {
      const asins = await asinApi.getBySeller(seller._id);
      setSellerAsins(asins);
    } catch (error) {
      console.error('Failed to load ASINs:', error);
      setSellerAsins([]);
    }
  };

  const handleAddAsin = async (asinData) => {
    try {
      await asinApi.create({
        ...asinData,
        seller: selectedSeller._id,
        status: 'Active',
      });
      addToast({
        title: 'ASIN Added',
        message: `Successfully added ${asinData.asinCode} to inventory.`,
        type: 'success'
      });
      const asins = await asinApi.getBySeller(selectedSeller._id);
      setSellerAsins(asins);
      await loadSellers();
    } catch (error) {
      addToast({
        title: 'Add Failed',
        message: error.message || 'Failed to add ASIN',
        type: 'error'
      });
    }
  };

  const handleDeleteAsin = async (asinId) => {
    try {
      await asinApi.delete(asinId);
      const asins = await asinApi.getBySeller(selectedSeller._id);
      setSellerAsins(asins);
      await loadSellers();
    } catch (error) {
      addToast({
        title: 'Delete Failed',
        message: 'Failed to delete ASIN: ' + error.message,
        type: 'error'
      });
    }
  };

  const handleToggleAsinStatus = async (asinId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
      await asinApi.update(asinId, { status: newStatus });
      const asins = await asinApi.getBySeller(selectedSeller._id);
      setSellerAsins(asins);
      await loadSellers();
    } catch (error) {
      addToast({
        title: 'Status Update Failed',
        message: 'Failed to toggle ASIN status: ' + error.message,
        type: 'error'
      });
    }
  };

  const handleSyncAsin = async (asinId) => {
    try {
      await marketSyncApi.syncAsin(asinId);
      addToast({
        title: 'Sync Initiated',
        message: 'Individual ASIN sync triggered successfully!',
        type: 'success'
      });
    } catch (error) {
      addToast({
        title: 'Sync Failed',
        message: error.message,
        type: 'error'
      });
    }
  };

  const handleUpdateAsin = async (asinId, data) => {
    try {
      await asinApi.update(asinId, data);
      const asins = await asinApi.getBySeller(selectedSeller._id);
      setSellerAsins(asins);
      await loadSellers();
    } catch (error) {
      addToast({
        title: 'Update Failed',
        message: 'Failed to update ASIN: ' + error.message,
        type: 'error'
      });
    }
  };

  const handleFullSync = async (sellerId) => {
    if (window.confirm('⚠️ Full Refresh: This will re-inject ALL ASINs and perform a complete re-scrape. This counts toward your daily limit. Continue?')) {
      setLoading(true);
      try {
        const response = await marketSyncApi.syncSellerAsins(sellerId, true);
        if (response.success) {
          addToast({
            title: 'Full Sync Initiated',
            message: 'Seller full refresh successfully triggered!',
            type: 'success'
          });
        }
      } catch (error) {
        addToast({
          title: 'Sync Failed',
          message: error.message,
          type: 'error'
        });
      }
      setLoading(false);
    }
  };

  const handleSetupAutoSync = async (sellerId) => {
    if (window.confirm('Do you want to automatically create an Octoparse task for this seller? This will clone your master template and link it to this store.')) {
      setLoading(true);
      try {
        const response = await marketSyncApi.setupAutoSync(sellerId);
        if (response.success) {
          addToast({
            title: 'Auto-Sync Active',
            message: `Task ${response.taskId} created and linked.`,
            type: 'success'
          });
          await loadSellers();
        }
      } catch (error) {
        addToast({
          title: 'Setup Failed',
          message: error.message,
          type: 'error'
        });
      }
      setLoading(false);
    }
  };

  const handleIngestAll = async () => {
    if (window.confirm('This will immediately check all Octoparse tasks for new results and ingest them into MongoDB. Continue?')) {
      setLoading(true);
      try {
        await marketSyncApi.ingestAllResults();
        addToast({
          title: 'Batch Ingestion',
          message: 'Global ingestion started in background.',
          type: 'info'
        });
      } catch (error) {
        addToast({
          title: 'Ingestion Failed',
          message: error.message,
          type: 'error'
        });
      }
      setLoading(false);
    }
  };

  const getStatusBadge = (status, lastScraped) => {
    const isActive = status === 'Active';
    // If scraped in last 5 minutes, consider it "Syncing/Active"
    const isRecentlyActive = lastScraped && (new Date() - new Date(lastScraped) < 5 * 60 * 1000);

    return (
      <div className="d-flex align-items-center gap-2">
        <div
          className={`rounded-circle shadow-sm ${isActive ? 'bg-success' : 'bg-secondary'} ${isRecentlyActive ? 'pulse-green' : ''}`}
          style={{ width: '8px', height: '8px', border: '1px solid white' }}
        ></div>
        <span className={`fw-semibold ${isActive ? 'text-success' : 'text-muted'}`} style={{ fontSize: '11px' }}>
          {status}
        </span>
      </div>
    );
  };

  const getMarketplaceBadge = (marketplace) => {
    const isIN = marketplace === 'amazon.in';
    const isCOM = marketplace === 'amazon.com';
    return (
      <span
        className={`px-3 py-1 rounded-pill smallest fw-bold d-inline-block border ${isIN ? 'bg-blue-50 text-blue-600 border-blue-100' :
          isCOM ? 'bg-orange-50 text-orange-600 border-orange-100' :
            'bg-zinc-50 text-zinc-600 border-zinc-100'
          }`}
        style={{ letterSpacing: '0.02em', fontSize: '10px' }}
      >
        {marketplace}
      </span>
    );
  };

  const getHealthIndicator = (seller) => {
    const usage = (seller.scrapeUsed || 0) / (seller.scrapeLimit || 100);
    let color = '#22c55e'; // Emerald/Green 
    let status = 'Healthy';

    if (usage > 0.8) {
      color = '#ef4444'; // Red 
      status = 'Risk';
    } else if (usage > 0.5) {
      color = '#f59e0b'; // Amber 
      status = 'Warning';
    }

    return (
      <div className="d-flex align-items-center gap-2">
        <div className="d-flex align-items-center justify-content-center" style={{ width: '18px', height: '18px' }}>
          <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
            <circle cx="18" cy="18" r="16" fill="none" stroke="#f1f5f9" strokeWidth="4" />
            <circle
              cx="18" cy="18" r="16" fill="none"
              stroke={color} strokeWidth="5"
              strokeDasharray={`${Math.min(usage * 100, 100)}, 100`}
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="fw-bold text-muted text-uppercase" style={{ fontSize: '9px', letterSpacing: '0.02em' }}>{status}</span>
      </div>
    );
  };

  if (loading && sellers.length === 0) { return <PageLoader message="Loading Sellers..." />; }

  return (
    <>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <h1 className="page-title mb-1">Seller Management</h1>
            <p className="text-muted small mb-0">Monitor and manage your connected storefronts</p>
          </div>
          <div className="d-flex gap-2">
            {isAdmin && (
              <>
                <button
                  className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 rounded-pill px-3"
                  onClick={() => setShowPoolModal(true)}
                >
                  <LayoutGrid size={16} className="text-zinc-500" />
                  <span className="fw-bold text-zinc-700">Octoparse Pool ({poolStats.available})</span>
                </button>
                <button
                  className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 rounded-pill px-3"
                  onClick={handleIngestAll}
                  title="Force check all Octoparse tasks for results"
                >
                  <RefreshCw size={16} className="text-primary" />
                  <span className="fw-bold text-zinc-700">Fetch Latest Data</span>
                </button>
              </>
            )}
            <button className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 rounded-pill px-3" onClick={() => setShowImportModal(true)}>
              <FileUp size={16} className="text-zinc-500" />
              <span className="fw-bold text-zinc-700">Import CSV</span>
            </button>
            <button className="btn btn-zinc-900 btn-sm shadow-sm border-0 d-flex align-items-center gap-2 px-4 rounded-pill" onClick={() => setShowAddModal(true)} style={{ backgroundColor: '#18181B', color: '#fff' }}>
              <Plus size={16} />
              <span className="fw-bold">Add Seller</span>
            </button>
          </div>
        </div>
      </div>
      <div className="page-content">

        {/* Tabs and Advanced Filters */}
        <div className="bg-white border border-zinc-200 rounded-4 shadow-sm mb-4 overflow-hidden">
          {/* Diagnostic Banner */}
          <div className="bg-zinc-900 text-white px-4 py-2 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-3">
              <div className="smallest fw-bold text-zinc-400 text-uppercase tracking-widest">Global Cache</div>
              <div className="smallest fw-black">{sellers.length} records found</div>
              <div className="smallest text-zinc-500 font-monospace">|</div>
              <div className="smallest fw-black">{totalResults} shown</div>
            </div>
            <div className="d-flex align-items-center gap-3">
              <button
                className="btn btn-sm btn-link text-zinc-400 smallest p-0 fw-bold hover-text-white border-0 shadow-none"
                onClick={() => {
                  setActiveTab('all');
                  setMarketplaceFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
              >
                Emergency Reset Filters
              </button>
              <button className="btn btn-sm btn-zinc-800 py-1 px-3 rounded-pill smallest fw-bold" onClick={loadSellers}>
                Force Refresh
              </button>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between p-3 border-bottom border-zinc-100 flex-wrap gap-3">
            <div className="nav-pills-container bg-zinc-100 p-1 rounded-pill d-inline-flex border border-zinc-200">
              {['all', 'active', 'paused'].map(tab => (
                <button
                  key={tab}
                  className={`btn btn-sm px-4 rounded-pill border-0 transition-all fw-bold smallest ${activeTab === tab ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500'}`}
                  style={activeTab === tab ? { backgroundColor: '#18181B' } : {}}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="d-flex align-items-center gap-2">
              <div className="position-relative">
                <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" size={14} />
                <input
                  type="text"
                  className="form-control form-control-sm ps-5 bg-white border border-zinc-200 shadow-none rounded-3 smallest"
                  placeholder="Search by name or ID..."
                  style={{ width: '240px', height: '36px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="form-select form-select-sm border-zinc-200 rounded-3 smallest fw-semibold text-zinc-600 shadow-none"
                style={{ width: '140px', height: '36px' }}
                value={marketplaceFilter}
                onChange={(e) => setMarketplaceFilter(e.target.value)}
              >
                <option value="all">All Markets</option>
                <option value="amazon.in">Amazon.in</option>
                <option value="amazon.com">Amazon.com</option>
              </select>

              <select
                className="form-select form-select-sm border-zinc-200 rounded-3 smallest fw-semibold text-zinc-600 shadow-none"
                style={{ width: '120px', height: '36px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card-body p-0 min-h-400 position-relative">
          {loading ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 gap-3" style={{ minHeight: '300px' }}>
              <ProgressBar indeterminate />
              <div className="smallest fw-bold text-zinc-400 text-uppercase tracking-widest mt-2">Loading Storefronts...</div>
            </div>
          ) : (
            <ListView
              columns={[
                {
                  label: 'Store Details',
                  key: 'name',
                  width: '30%',
                  render: (_, seller) => (
                    <div className="d-flex align-items-center gap-3 py-1">
                      <div
                        className="seller-avatar d-flex align-items-center justify-content-center fw-bold shadow-sm"
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #0145f2, #0138cc)',
                          color: '#fff',
                          fontSize: '11px',
                          letterSpacing: '0.05em'
                        }}
                      >
                        {seller.name.slice(0, 3).toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-bold text-zinc-900" style={{ fontSize: '13px' }}>{seller.name}</div>
                        <div className="text-zinc-500 d-flex align-items-center gap-1" style={{ fontSize: '11px', marginTop: '2px' }}>
                          <span className="font-monospace opacity-75">{seller.sellerId}</span>
                          <span className="opacity-30">•</span>
                          <span className="fw-medium text-zinc-400">{seller.plan}</span>
                        </div>
                      </div>
                    </div>
                  )
                },
                {
                  label: 'Account Manager',
                  key: 'managers',
                  width: '18%',
                  render: (managers) => (
                    <div className="d-flex flex-column gap-1">
                      {managers?.length > 0 ? (
                        managers.map((m) => (
                          <div key={m._id} className="d-flex align-items-center gap-2">
                            <div
                              className="rounded-circle border border-white shadow-sm d-flex align-items-center justify-content-center bg-zinc-100 text-zinc-900 fw-bold"
                              style={{ width: '22px', height: '22px', flexShrink: 0, fontSize: '9px' }}
                            >
                              {m.firstName.charAt(0)}
                            </div>
                            <span className="text-zinc-700 fw-medium" style={{ fontSize: '11px' }}>
                              {m.firstName} {m.lastName[0]}.
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className="text-zinc-400 smallest italic opacity-50">Unassigned</span>
                      )}
                    </div>
                  )
                },
                {
                  label: 'Health / Limit',
                  key: 'health',
                  width: '10%',
                  render: (_, seller) => getHealthIndicator(seller)
                },
                {
                  label: 'Inventory',
                  key: 'totalAsins',
                  width: '10%',
                  render: (total, seller) => (
                    <div className="d-flex align-items-center gap-2 cursor-pointer group" onClick={() => handleViewAsins(seller)}>
                      <Package size={14} className="text-zinc-500 group-hover:text-primary transition-colors" />
                      <div>
                        <div className="fw-bold text-zinc-900" style={{ fontSize: '12px' }}>{total || 0}</div>
                        <div className="text-zinc-500 smallest" style={{ fontSize: '10px' }}>{seller.activeAsins || 0} Live</div>
                      </div>
                    </div>
                  )
                },
                {
                  label: 'Quota Usage',
                  key: 'scrapeUsed',
                  width: '10%',
                  render: (used, seller) => {
                    const limit = seller.scrapeLimit || 100;
                    const ratio = used / limit;
                    return (
                      <div className="d-flex flex-column gap-1 pe-2">
                        <ProgressBar
                          value={ratio * 100}
                          color={ratio > 0.8 ? 'danger' : ratio > 0.5 ? 'warning' : 'primary'}
                          size="xs"
                        />
                        <div className="text-zinc-500 d-flex align-items-center gap-1 mt-1" style={{ fontSize: '10px' }}>
                          <Clock size={10} />
                          <span>{seller.lastScraped ? new Date(seller.lastScraped).toLocaleDateString() : 'Never'}</span>
                        </div>
                      </div>
                    );
                  }
                },
                {
                  label: 'Status',
                  key: 'status',
                  width: '10%',
                  render: (status, seller) => getStatusBadge(status, seller.lastScraped)
                }
              ]}
              rows={paginatedSellers}
              groupBy="marketplace"
              rowKey="_id"
              options={{ selectable: true }}
              renderGroupHeader={({ group, rows }) => (
                <div className="d-flex align-items-center gap-2">
                  {getMarketplaceBadge(group)}
                  <span className="text-muted smallest fw-bold">{rows.length} STORES</span>
                </div>
              )}
              actions={(seller) => (
                <div className="d-flex align-items-center gap-1">
                  <button
                    className="btn-white-icon"
                    onClick={() => handleEditSeller(seller)}
                    title="Edit Seller Details"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    className="btn-white-icon"
                    onClick={() => handleViewAsins(seller)}
                    title="Manage ASINs"
                  >
                    <Package size={16} />
                  </button>
                  <button
                    className="btn-white-icon"
                    onClick={() => handleSyncResults(seller._id)}
                    title="Sync Global Data"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    className={seller.status === 'Active' ? 'btn-white-icon' : 'btn-white-icon btn-success-icon bg-success border-success text-white'}
                    onClick={() => handleToggleStatus(seller._id)}
                    title={seller.status === 'Active' ? 'Pause Store' : 'Resume Store'}
                    style={seller.status !== 'Active' ? { background: 'var(--green)', border: 'none', color: '#fff' } : {}}
                  >
                    {seller.status === 'Active' ? <Pause size={16} /> : <Play size={16} />}
                  </button>

                  <div className="dropdown">
                    <button
                      className="btn-white-icon border-0 bg-transparent text-zinc-400 hover-text-zinc-900"
                      type="button"
                      data-bs-toggle="dropdown"
                      aria-expanded="false"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end border-0 shadow-xl rounded-4 p-2 bg-white" style={{ minWidth: '180px', zIndex: 1060 }}>
                      <div className="px-3 py-2 border-bottom border-zinc-100 mb-2">
                        <div className="smallest fw-bold text-zinc-500 text-uppercase tracking-widest">Management</div>
                      </div>
                      {isAdmin && (
                        <>
                          <li>
                            <button className="dropdown-item rounded-3 d-flex align-items-center gap-3 py-2" onClick={() => handleEditSeller(seller)}>
                              <Edit3 size={16} strokeWidth={2} className="text-zinc-600" />
                              <span className="text-zinc-700 fw-medium">Edit Details</span>
                            </button>
                          </li>
                          <li>
                            <button className="dropdown-item rounded-3 d-flex align-items-center gap-3 py-2 text-danger" onClick={() => handleDeleteSeller(seller._id)}>
                              <Trash2 size={16} strokeWidth={2} />
                              <span className="fw-semibold">Delete Store</span>
                            </button>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              )}
              pagination={{
                page,
                limit,
                total: totalResults,
                onPageChange: setPage,
                onLimitChange: (newLimit) => {
                  setLimit(newLimit);
                  setPage(1); // Reset to first page on limit change
                }
              }}
              actionWidth="100px"
              emptyState={{
                icon: Store,
                title: 'No sellers yet',
                description: 'Add your first Amazon seller account to start tracking performance.',
                action: { label: 'Add Seller', onClick: () => setShowAddModal(true) }
              }}
            />
          )}
        </div></div>

      {/* Add Seller Modal */}
      {showAddModal && (
        <AddSellerModal
          onClose={() => { setShowAddModal(false); setEditingSeller(null); }}
          onSave={handleAddSeller}
          isAdmin={isAdmin}
          initialData={editingSeller}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportSellerModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportSellers}
        />
      )}

      {/* ASINs Modal */}
      {showAsinModal && selectedSeller && (
        <SellerAsinsModal
          seller={selectedSeller}
          asins={sellerAsins}
          onClose={() => { setShowAsinModal(false); setSelectedSeller(null); }}
          onAddAsin={handleAddAsin}
          onDeleteAsin={handleDeleteAsin}
          onToggleStatus={handleToggleAsinStatus}
          onUpdateAsin={handleUpdateAsin}
          onSyncAsin={handleSyncAsin}
          onRefresh={() => handleViewAsins(selectedSeller)}
        />
      )}
      {/* Task Pool Management Modal */}
      {showPoolModal && (
        <PoolManagementModal
          stats={poolStats}
          onClose={() => setShowPoolModal(false)}
          onRefresh={fetchPoolStats}
        />
      )}
    </>
  );
};

// Add Seller Modal Component
const AddSellerModal = ({ onClose, onSave, isAdmin, initialData }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    marketplace: initialData?.marketplace || 'amazon.in',
    sellerId: initialData?.sellerId || '',
    apiKey: initialData?.apiKey || 'Default',
    plan: initialData?.plan || 'Starter',
    scrapeLimit: initialData?.scrapeLimit || 100,
    managerId: initialData?.managers?.[0]?._id || '',
  });
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      userApi.getManagers()
        .then(data => setManagers(data))
        .catch(() => setManagers([]));
    }
  }, [isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { managerId, ...rest } = formData;
    const payload = { ...rest };
    if (isAdmin && managerId) payload.managerId = managerId;

    try {
      await onSave(payload);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.6)', backdropFilter: 'blur(12px)', zIndex: 1070 }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '520px' }}>
        <div className="modal-content border border-zinc-200 shadow-2xl overflow-hidden" style={{ borderRadius: '16px', background: '#fff' }}>
          <div className="modal-header border-0 px-4 pt-4 pb-0 d-flex align-items-center justify-content-between">
            <h5 className="modal-title d-flex align-items-center gap-2 text-zinc-900 fw-bold" style={{ fontSize: '15px' }}>
              <div className="p-1.5 bg-zinc-900 text-white rounded-2 shadow-sm">
                <Store size={18} strokeWidth={2.5} />
              </div>
              {initialData ? 'Edit Seller Details' : 'Configure New Store'}
            </h5>
            <button type="button" className="btn-white-icon border-0 shadow-none" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-4">
              {/* store Profile Section */}
              <div className="mb-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div className="p-1 bg-zinc-100 rounded text-zinc-500"><LayoutGrid size={12} /></div>
                  <label className="form-label smallest fw-bold text-zinc-400 text-uppercase tracking-widest mb-0">Brand Name</label>
                </div>
                <input
                  type="text"
                  className="form-control bg-zinc-50 border-zinc-200 px-3 fw-bold text-zinc-900 shadow-sm focus-border-primary"
                  placeholder="e.g. RetailOps Storefront"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ borderRadius: '10px', fontSize: '13px', height: '42px' }}
                />
              </div>

              <div className="row g-3">
                <div className="col-md-6 mb-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="p-1 bg-zinc-100 rounded text-zinc-500"><Globe size={12} /></div>
                    <label className="form-label smallest fw-bold text-zinc-400 text-uppercase tracking-widest mb-0">Marketplace</label>
                  </div>
                  <select
                    className="form-select bg-zinc-50 border-zinc-200 px-3 fw-semibold text-zinc-700 shadow-sm"
                    value={formData.marketplace}
                    onChange={(e) => setFormData({ ...formData, marketplace: e.target.value })}
                    style={{ borderRadius: '10px', fontSize: '13px', height: '42px' }}
                  >
                    <option value="amazon.in">Amazon.in</option>
                    {/* <option value="amazon.com">USA (COM)</option>
                    <option value="amazon.co.uk">UK (CO.UK)</option>
                    <option value="amazon.ca">Canada (CA)</option> */}
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="p-1 bg-zinc-100 rounded text-zinc-500"><Key size={12} /></div>
                    <label className="form-label smallest fw-bold text-zinc-400 text-uppercase tracking-widest mb-0">SELLER ID</label>
                  </div>
                  <input
                    type="text"
                    className="form-control bg-zinc-50 border-zinc-200 px-3 font-monospace fw-bold text-primary shadow-sm"
                    value={formData.sellerId}
                    onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                    placeholder="Merchant ID"
                    required
                    style={{ borderRadius: '10px', fontSize: '12px', height: '42px' }}
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="mb-4">
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <div className="p-1 bg-zinc-100 rounded text-zinc-500"><Users size={12} /></div>
                    <label className="form-label smallest fw-bold text-zinc-400 text-uppercase tracking-widest mb-0">ACCOUNT MANAGER</label>
                  </div>
                  <select
                    className="form-select bg-white border-zinc-200 px-3 fw-bold text-zinc-900 shadow-sm"
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    style={{ borderRadius: '10px', fontSize: '13px', height: '42px' }}
                  >
                    <option value="">— Unassigned (Public Pool) —</option>
                    {managers.map(m => (
                      <option key={m._id} value={m._id}>
                        {m.firstName} {m.lastName} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* <div className="p-4 bg-zinc-50 rounded-4 border border-zinc-100">
                <div className="row g-3">
                  <div className="col-md-6 mb-0">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <div className="p-1 bg-white rounded shadow-xs text-zinc-500"><Layers size={11} /></div>
                      <label className="form-label smallest fw-bold text-zinc-500 text-uppercase mb-0">Tiers</label>
                    </div>
                    <select
                      className="form-select border-zinc-200 px-3 fw-bold text-zinc-700 bg-white"
                      value={formData.plan}
                      onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                      style={{ borderRadius: '8px', fontSize: '12px' }}
                    >
                      <option value="Starter">Starter</option>
                      <option value="Professional">Professional</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div className="col-md-6 mb-0">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <div className="p-1 bg-white rounded shadow-xs text-zinc-500"><Settings size={11} /></div>
                      <label className="form-label smallest fw-bold text-zinc-500 text-uppercase mb-0">Limit</label>
                    </div>
                    <input
                      type="number"
                      className="form-control border-zinc-200 px-3 fw-bold text-zinc-900 bg-white"
                      value={formData.scrapeLimit}
                      onChange={(e) => setFormData({ ...formData, scrapeLimit: e.target.value })}
                      style={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                  </div>
                </div>
              </div> */}
            </div>

            <div className="modal-footer border-0 px-4 pb-4 pt-1 gap-2">
              <button type="button" className="btn-prism shadow-none border-0 text-zinc-500" onClick={onClose} disabled={loading}>
                Dismiss
              </button>
              <button
                type="submit"
                className="btn-prism btn-prism-primary"
                disabled={loading}
              >
                {loading ? <RefreshCw size={16} className="spin" /> : <ChevronRight size={16} />}
                <span>{initialData ? 'Update Account' : 'Initialize Account'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};


// Import Seller Modal Component
const ImportSellerModal = ({ onClose, onImport }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [fileStats, setFileStats] = useState(null);
  const [managers, setManagers] = useState([]);
  const { addToast } = useToast();

  useEffect(() => {
    userApi.getManagers()
      .then(data => setManagers(data))
      .catch(() => setManagers([]));
  }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      addToast({ title: 'Invalid File', message: 'Please upload a CSV file.', type: 'error' });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) throw new Error('CSV is empty or missing data rows.');

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const dataLines = lines.slice(1);

        const nameIdx = headers.findIndex(h => h.includes('name'));
        const idIdx = headers.findIndex(h => h.includes('id'));
        const managerIdx = headers.findIndex(h => h.includes('manager'));
        const marketIdx = headers.findIndex(h => h.includes('market'));

        if (nameIdx === -1 || idIdx === -1) {
          throw new Error('CSV must contain "Store Name" and "Seller ID" columns.');
        }

        const parsedSellers = dataLines.map(line => {
          const cells = line.split(',').map(c => c.trim());
          const name = cells[nameIdx];
          const sellerId = cells[idIdx];
          const managerSearch = managerIdx !== -1 ? cells[managerIdx] : '';
          const marketplace = marketIdx !== -1 ? (cells[marketIdx] || 'amazon.in') : 'amazon.in';

          // Try to match manager by email or name
          let managerId = '';
          if (managerSearch) {
            const match = managers.find(m =>
              m.email?.toLowerCase() === managerSearch.toLowerCase() ||
              `${m.firstName} ${m.lastName}`.toLowerCase().includes(managerSearch.toLowerCase())
            );
            if (match) managerId = match._id;
          }

          return { name, sellerId, marketplace, managerId, plan: 'Starter' };
        }).filter(s => s.name && s.sellerId);

        setFileStats({
          name: file.name,
          count: parsedSellers.length,
          data: parsedSellers
        });
      } catch (err) {
        addToast({ title: 'Parse Error', message: err.message, type: 'error' });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleImportComplete = () => {
    if (fileStats?.data) {
      onImport(fileStats.data);
    }
  };

  const downloadTemplate = () => {
    const template = `Store Name,Seller ID,Manager Name or Email,Marketplace\nSample Store,A1B2C3D4E5,manager@example.com,amazon.in`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sellers_import_template.csv';
    a.click();
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1070 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-2xl overflow-hidden" style={{ borderRadius: '24px' }}>
          <div className="modal-header border-0 px-5 pt-5 pb-0">
            <h5 className="h4 fw-black mb-0 text-zinc-900 d-flex align-items-center gap-3">
              <div className="p-2 bg-zinc-900 text-white rounded-3 shadow-lg">
                <FileUp size={24} />
              </div>
              Bulk Store Onboarding
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body px-5 py-4">
            <p className="text-zinc-500 smallest mb-4">Upload a CSV file to add multiple Amazon storefronts at once. Managers will be auto-assigned based on their name or email.</p>

            {!fileStats ? (
              <div className="upload-zone border-2 border-dashed border-zinc-200 rounded-4 p-5 text-center transition-all hover-border-primary hover-bg-zinc-50 position-relative">
                <input
                  type="file"
                  accept=".csv"
                  className="position-absolute inset-0 opacity-0 cursor-pointer"
                  style={{ width: '100%', height: '100%', top: 0, left: 0 }}
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <div className="mb-3 d-flex justify-content-center">
                  <div className="p-3 bg-zinc-100 rounded-circle"><UploadIcon size={32} className="text-zinc-400" /></div>
                </div>
                <div className="fw-black text-zinc-900 mb-1">{isUploading ? 'Analyzing File...' : 'Choose CSV File'}</div>
                <div className="smallest text-zinc-400">or drag and drop your file here</div>
              </div>
            ) : (
              <div className="p-4 bg-zinc-900 rounded-4 text-white d-flex align-items-center justify-content-between shadow-lg">
                <div className="d-flex align-items-center gap-3">
                  <div className="p-2 bg-zinc-800 rounded-3"><FileCheck size={20} className="text-success" /></div>
                  <div>
                    <div className="fw-bold smallest">{fileStats.name}</div>
                    <div className="smallest opacity-60">{fileStats.count} accounts ready for import</div>
                  </div>
                </div>
                <button className="btn btn-sm btn-zinc-800 text-white border-0 px-3 rounded-pill smallest fw-bold" onClick={() => setFileStats(null)}>Change</button>
              </div>
            )}

            <div className="mt-4 d-flex align-items-center justify-content-between">
              <button className="btn btn-white btn-sm border border-zinc-200 rounded-pill px-3 d-flex align-items-center gap-2 transition-all hover-bg-zinc-50" onClick={downloadTemplate}>
                <Plus size={14} className="text-zinc-400" />
                <span className="fw-bold text-zinc-700 smallest">Get Template</span>
              </button>
              <span className="smallest text-zinc-400 font-monospace">Supports: UTF-8 CSV</span>
            </div>
          </div>
          <div className="modal-footer border-0 px-5 pb-5 pt-0 gap-2">
            <button type="button" className="btn-prism shadow-none border-0 text-zinc-500" onClick={onClose}>Dismiss</button>
            <button
              className="btn-prism btn-prism-primary"
              disabled={!fileStats || isUploading}
              onClick={handleImportComplete}
            >
              {isUploading ? <RefreshCw size={16} className="spin" /> : <ChevronRight size={16} />}
              <span>Begin Import</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Seller ASINs Modal Component
const SellerAsinsModal = ({
  seller,
  asins,
  onClose,
  onAddAsin,
  onDeleteAsin,
  onToggleStatus,
  onUpdateAsin,
  onSyncAsin,
  onRefresh
}) => {
  const { addToast } = useToast();
  const [showAddAsinModal, setShowAddAsinModal] = useState(false);
  const [showEditAsinModal, setShowEditAsinModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingAsin, setEditingAsin] = useState(null);
  const [detailedAsin, setDetailedAsin] = useState(null);
  const [newAsinsText, setNewAsinsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleJsonUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      alert("Please upload a valid JSON file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        setIsSubmitting(true);
        const result = await marketSyncApi.bulkInjectJson(seller._id, jsonData);

        addToast({
          title: 'Import Success',
          message: result.message || 'Data injected successfully',
          type: 'success'
        });

        if (onRefresh) await onRefresh();
      } catch (error) {
        addToast({
          title: 'Import Failed',
          message: 'Failed to process JSON: ' + error.message,
          type: 'error'
        });
      } finally {
        setIsSubmitting(false);
        e.target.value = ''; // Reset file input
      }
    };
    reader.readAsText(file);
  };

  const handleEditAsin = (asin) => {
    setEditingAsin(asin);
    setShowEditAsinModal(true);
  };

  const handleViewDetails = (asin) => {
    setDetailedAsin(asin);
    setShowDetailsModal(true);
  };

  const handleBulkAddAsins = async () => {
    if (!newAsinsText.trim()) return;

    setIsSubmitting(true);
    try {
      // Parse input (comma or newline separated), strip whitespace, filter empty, ensure 10 chars (basic validation)
      const asinList = newAsinsText
        .split(/[,\s]+/)
        .map(a => a.trim().toUpperCase())
        .filter(a => a.length > 0);

      if (asinList.length === 0) {
        alert('No valid ASINs found.');
        setIsSubmitting(false);
        return;
      }

      const asinsPayload = asinList.map(code => ({
        asinCode: code,
        seller: seller._id,
        status: 'Active'
      }));

      // Call the bulk API method
      const result = await asinApi.createBulk(asinsPayload);

      // Refresh list correctly without window reload
      if (onRefresh) {
        await onRefresh();
      }

      // Show specific toast for duplicates if any
      if (result.duplicatesCount > 0) {
        addToast({
          title: 'Partial Success',
          message: `${result.insertedCount} added. ${result.duplicatesCount} skipped as they already exist: ${result.duplicates.join(', ')}`,
          type: 'warning',
          duration: 10000 // Show longer for user to read lists
        });
      } else {
        addToast({
          title: 'Success',
          message: `Successfully added ${result.insertedCount} ASIN(s) to inventory.`,
          type: 'success'
        });
      }

      setNewAsinsText('');
      setShowAddAsinModal(false);

    } catch (error) {
      addToast({
        title: 'Bulk Add Failed',
        message: error.message || 'Failed to process ASINs',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header border-0 px-4 pt-4 pb-0">
            <h5 className="h5 fw-bold mb-0 text-zinc-900 d-flex align-items-center gap-2">
              <div className="p-2 bg-zinc-100 text-zinc-900 rounded-3 border border-zinc-200">
                <Package size={20} />
              </div>
              ASIN Inventory - {seller.name}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <span className="text-zinc-400 smallest fw-bold uppercase">{asins.length} ASINs Cataloged</span>
              <div className="d-flex gap-2">
                <input
                  type="file"
                  id="jsonUpload"
                  hidden
                  accept=".json"
                  onChange={(e) => handleJsonUpload(e)}
                />
                <button
                  className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 px-3 rounded-pill"
                  onClick={() => document.getElementById('jsonUpload').click()}
                  disabled={isSubmitting}
                >
                  <FileJson size={16} className="text-primary" />
                  <span className="fw-bold text-zinc-700">Sync JSON Results</span>
                </button>
                <button className="btn btn-zinc-900 btn-sm shadow-sm border-0 d-flex align-items-center gap-2 px-3 rounded-pill" onClick={() => setShowAddAsinModal(true)} style={{ backgroundColor: '#18181B', color: '#fff' }}>
                  <Plus size={16} />
                  <span className="fw-bold">Add ASIN(s)</span>
                </button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table data-table mb-0">
                <thead>
                  <tr>
                    <th>ASIN Code</th>
                    <th>SKU / Title</th>
                    <th>Price / Rank</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {asins.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        <i className="bi bi-inbox d-block mb-2" style={{ fontSize: '24px' }}></i>
                        No ASINs added yet. Click "Add ASIN(s)" to add one or more.
                      </td>
                    </tr>
                  ) : (
                    asins.map(asin => (
                      <tr key={asin._id}>
                        <td className="fw-bold text-dark smallest">{asin.asinCode}</td>
                        <td>
                          <div className="d-flex flex-column">
                            <span className="fw-medium text-primary smallest" style={{ fontSize: '10px' }}>{asin.sku || 'No SKU'}</span>
                            <span className="text-muted smallest truncate" style={{ maxWidth: '180px', fontSize: '10px' }}>{asin.title || 'No Title'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex flex-column">
                            <span className="fw-bold smallest">₹{asin.currentPrice?.toFixed(2) || '0.00'}</span>
                            <span className="text-muted smallest" style={{ fontSize: '9px' }}>Rank: #{asin.bsr || asin.currentRank || 'N/A'}</span>
                          </div>
                        </td>
                        <td>
                          <div className={`smallest fw-bold ${asin.stockLevel > 10 ? 'text-success' : 'text-danger'}`}>
                            {asin.stockLevel || 0}
                          </div>
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm p-0 border-0 d-flex align-items-center gap-1 ${asin.status === 'Active' ? 'text-success' : 'text-zinc-400'}`}
                            onClick={() => onToggleStatus(asin._id, asin.status)}
                            title={asin.status === 'Active' ? 'Deactivate' : 'Activate'}
                          >
                            {asin.status === 'Active' ? <CheckCircle2 size={16} /> : <PauseCircle size={16} />}
                            <span className="fw-bold" style={{ fontSize: '10px' }}>{asin.status}</span>
                          </button>
                        </td>
                        <td>
                          <div className="d-flex gap-1 justify-content-end">
                            <button
                              className="btn btn-icon btn-white border shadow-sm btn-sm"
                              onClick={() => handleViewDetails(asin)}
                              title="View Details"
                            >
                              <Eye size={10} />
                            </button>
                            <button
                              className="btn btn-icon btn-white border shadow-sm btn-sm"
                              onClick={() => onSyncAsin(asin._id)}
                              title="Sync Data"
                            >
                              <RefreshCw size={10} />
                            </button>
                            <button
                              className="btn btn-icon btn-white border shadow-sm btn-sm"
                              onClick={() => handleEditAsin(asin)}
                              title="Edit"
                            >
                              <Edit3 size={10} />
                            </button>
                            <button
                              className="btn btn-icon btn-white border shadow-sm btn-sm text-danger"
                              onClick={() => onDeleteAsin(asin._id)}
                              title="Delete"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer border-0 px-4 pb-4 pt-0">
            <button className="btn btn-white fw-bold px-4 border border-zinc-200 rounded-pill" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>

      {/* Add Bulk ASIN Modal */}
      {showAddAsinModal && (
        <AddBulkAsinModal
          seller={seller}
          onClose={() => setShowAddAsinModal(false)}
          onAdd={handleBulkAddAsins}
          isSubmitting={isSubmitting}
          text={newAsinsText}
          setText={setNewAsinsText}
        />
      )}

      {/* Edit ASIN Modal */}
      {showEditAsinModal && editingAsin && (
        <EditAsinModal
          asin={editingAsin}
          onClose={() => { setShowEditAsinModal(false); setEditingAsin(null); }}
          onSave={(data) => {
            onUpdateAsin(editingAsin._id, data);
            setShowEditAsinModal(false);
          }}
        />
      )}

      {/* Details ASIN Modal */}
      {showDetailsModal && detailedAsin && (
        <AsinDetailsModal
          asin={detailedAsin}
          onClose={() => { setShowDetailsModal(false); setDetailedAsin(null); }}
        />
      )}
    </div>
  );
};

// Sub-component for editing ASIN details
const EditAsinModal = ({ asin, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    asinCode: asin.asinCode,
    sku: asin.sku || '',
    status: asin.status
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1070 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content rounded-4 shadow-lg border-0">
          <form onSubmit={handleSubmit}>
            <div className="modal-header border-0 p-4 pb-0">
              <h5 className="fw-bold mb-0">Edit Product: {asin.asinCode}</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>
            <div className="modal-body p-4">
              <div className="mb-3">
                <label className="form-label smallest fw-bold uppercase text-muted">ASIN Code</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.asinCode}
                  onChange={e => setFormData({ ...formData, asinCode: e.target.value })}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label smallest fw-bold uppercase text-muted">SKU (Internal ID)</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.sku}
                  onChange={e => setFormData({ ...formData, sku: e.target.value })}
                />
              </div>
              <div className="mb-3">
                <label className="form-label smallest fw-bold uppercase text-muted">Operational Status</label>
                <select
                  className="form-select"
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                >
                  <option value="Active">Active (Tracking)</option>
                  <option value="Paused">Paused (Inactive)</option>
                </select>
              </div>
            </div>
            <div className="modal-footer border-0 p-4 pt-0 gap-2">
              <button type="button" className="btn btn-white rounded-pill px-4" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-zinc-900 rounded-pill px-4 text-white">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Sub-component for adding bulk ASINs
const AddBulkAsinModal = ({ seller, onClose, onAdd, isSubmitting, text, setText }) => {
  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.7)', backdropFilter: 'blur(4px)', zIndex: 1080 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content rounded-4 shadow-2xl border-0 overflow-hidden">
          <div className="modal-header border-0 px-4 pt-4 pb-0">
            <h5 className="h5 fw-bold mb-0 text-zinc-900 d-flex align-items-center gap-2">
              <div className="p-2 bg-zinc-100 text-zinc-900 rounded-3 border border-zinc-200">
                <Plus size={20} />
              </div>
              Add ASINs to {seller.name}
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            <p className="text-muted smallest mb-4">Enter Amazon Standard Identification Numbers (ASINs) separated by commas or new lines. Our sync agents will start tracking them immediately.</p>
            <div className="mb-0">
              <label className="form-label smallest fw-bold uppercase text-zinc-400 mb-2 d-flex align-items-center gap-2">
                <Scan size={14} className="text-zinc-400" /> Target ASIN List
              </label>
              <textarea
                className="form-control border-zinc-200 shadow-sm font-monospace"
                rows="6"
                style={{ borderRadius: '12px', fontSize: '11px', padding: '12px' }}
                placeholder="Enter ASINs here (one per line or comma separated)..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              ></textarea>
              <div className="mt-2 smallest text-zinc-400 italic">
                Valid ASINs are 10-character alphanumeric codes.
              </div>
            </div>
          </div>
          <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
            <button type="button" className="btn btn-white fw-bold rounded-pill px-4 border border-zinc-200" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="btn btn-zinc-900 fw-bold rounded-pill px-4 shadow-sm text-white d-flex align-items-center gap-2"
              onClick={onAdd}
              disabled={isSubmitting || !text.trim()}
              style={{ backgroundColor: '#18181B' }}
            >
              {isSubmitting ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />}
              <span>{isSubmitting ? 'Adding...' : 'Add to Inventory'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Detailed ASIN Modal for Market Intelligence
const AsinDetailsModal = ({ asin, onClose }) => {
  if (!asin) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.8)', backdropFilter: 'blur(8px)', zIndex: 1100 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-2xl overflow-hidden" style={{ borderRadius: '24px', backgroundColor: '#fff' }}>

          {/* Header */}
          <div className="px-5 py-4 border-bottom border-zinc-100 d-flex justify-content-between align-items-center bg-white sticky-top">
            <div className="d-flex align-items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-4 shadow-xl border border-zinc-800 rotate-hover">
                <Package size={28} className="text-white" />
              </div>
              <div>
                <div className="d-flex align-items-center gap-3 mb-1">
                  <h3 className="fw-black text-zinc-900 mb-0 tracking-tight" style={{ fontSize: '24px' }}>{asin.asinCode}</h3>
                  <span className={`badge rounded-pill ${asin.status === 'Active' ? 'bg-success-subtle text-success' : 'bg-zinc-100 text-zinc-500'} px-2 py-1`}>
                    {asin.status}
                  </span>
                  {asin.priceType === 'Deal Price' && (
                    <span className="badge rounded-pill bg-danger-subtle text-danger border border-danger-subtle px-2 py-1">
                      <Zap size={10} className="me-1" /> DEAL
                    </span>
                  )}
                </div>
                <div className="text-muted smallest fw-semibold uppercase tracking-wider d-flex align-items-center gap-2">
                  <span>{asin.category || 'Uncategorized'}</span>
                  <span className="opacity-30">•</span>
                  <span>SKU: {asin.sku || 'N/A'}</span>
                </div>
              </div>
            </div>
            <button className="btn btn-icon btn-light rounded-circle" onClick={onClose}>
              <MoreHorizontal size={20} />
            </button>
          </div>

          <div className="modal-body p-0">
            <div className="row g-0">

              {/* Left Column: Visuals & Gallery */}
              <div className="col-lg-5 p-4 border-end border-zinc-100 bg-white">
                <div className="position-relative mb-4 bg-zinc-50 rounded-4 p-4 border border-zinc-100 overflow-hidden text-center">
                  <img
                    src={asin.mainImageUrl || asin.imageUrl || 'https://via.placeholder.com/400x400?text=No+Image'}
                    alt={asin.title}
                    className="img-fluid rounded-3"
                    style={{ maxHeight: '350px', objectFit: 'contain' }}
                  />
                  <div className="position-absolute top-0 end-0 p-3">
                    <div className="bg-white/80 backdrop-blur rounded-pill px-3 py-1 border border-zinc-200 shadow-sm smallest fw-bold">
                      {asin.images?.length || 0} Images
                    </div>
                  </div>
                </div>

                {/* Gallery Grid */}
                {asin.images?.length > 0 && (
                  <div className="row g-2">
                    {asin.images.slice(0, 8).map((img, idx) => (
                      <div key={idx} className="col-3">
                        <div className="ratio ratio-1x1 bg-zinc-50 rounded-3 border border-zinc-100 overflow-hidden cursor-pointer hover-scale transition-all">
                          <img src={img} alt={`Gallery ${idx}`} style={{ objectFit: 'cover' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rating Summary */}
                <div className="mt-5 p-4 bg-zinc-900 rounded-4 text-white shadow-lg">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="smallest fw-bold uppercase opacity-60">Customer Sentiment</div>
                    <div className="d-flex align-items-center gap-1">
                      <div className="text-warning"><Zap size={14} fill="currentColor" /></div>
                      <span className="fw-black">{asin.rating || '0.0'}</span>
                    </div>
                  </div>
                  <div className="h4 fw-bold mb-1">{asin.reviewCount?.toLocaleString() || '0'} Reviews</div>
                  <div className="smallest opacity-80">Based on global marketplace feedback</div>
                </div>
              </div>

              {/* Right Column: Intelligence & Data */}
              <div className="col-lg-7 p-4 bg-zinc-50/30">

                {/* Title Section */}
                <div className="mb-5">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <label className="smallest fw-bold uppercase text-muted tracking-widest">Product Title</label>
                    <span className={`badge rounded-pill ${asin.titleLength > 150 ? 'bg-success-subtle text-success' : 'bg-warning-subtle text-warning'} px-2 fw-bold`}>
                      {asin.titleLength || 0} Chars
                    </span>
                  </div>
                  <h5 className="lh-base text-zinc-900 fw-bold">{asin.title || 'Product title not yet synced.'}</h5>
                </div>

                {/* KPI Grid */}
                <div className="row g-3 mb-5">
                  <div className="col-md-4">
                    <div className="bg-white p-4 rounded-4 shadow-sm border border-zinc-100 h-100">
                      <div className="smallest fw-bold uppercase text-muted mb-2">Pricing Intel</div>
                      <div className="d-flex align-items-end gap-2 mb-1">
                        <div className="h3 fw-black text-zinc-900 mb-0">₹{asin.currentPrice?.toLocaleString() || '0'}</div>
                        <div className="text-muted text-decoration-line-through mb-1">₹{asin.mrp?.toLocaleString() || '0'}</div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="smallest fw-bold text-success">
                          {asin.currentPrice && asin.mrp ? Math.round((1 - asin.currentPrice / asin.mrp) * 100) : 0}% Off
                        </span>
                        <span className="opacity-20">•</span>
                        <span className="smallest fw-medium text-muted">{asin.priceType || 'Standard'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="bg-white p-4 rounded-4 shadow-sm border border-zinc-100 h-100">
                      <div className="smallest fw-bold uppercase text-muted mb-2">Core Visibility</div>
                      <div className="h3 fw-black text-primary mb-0">#{asin.bsr?.toLocaleString() || '---'}</div>
                      <div className="smallest fw-medium text-muted mt-1">Main Category BSR</div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="bg-white p-4 rounded-4 shadow-sm border border-zinc-100 h-100">
                      <div className="smallest fw-bold uppercase text-muted mb-2">Stock Inventory</div>
                      <div className={`h3 fw-black mb-0 ${asin.stockLevel > 10 ? 'text-success' : 'text-danger'}`}>
                        {asin.stockLevel || 0}
                      </div>
                      <div className="smallest fw-medium text-muted mt-1">Units Available</div>
                    </div>
                  </div>
                </div>

                {/* Sub BSRs */}
                {asin.subBSRs?.length > 0 && (
                  <div className="mb-5">
                    <label className="smallest fw-bold uppercase text-muted tracking-widest mb-3 d-block">Sub-Category Ranks</label>
                    <div className="d-flex flex-wrap gap-2">
                      {asin.subBSRs.map((rank, idx) => (
                        <div key={idx} className="bg-white border border-zinc-200 rounded-pill px-3 py-1 smallest fw-bold shadow-sm d-flex align-items-center gap-2">
                          <div className="bg-primary rounded-circle" style={{ width: '6px', height: '6px' }}></div>
                          {rank}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bullet Points */}
                <div className="mb-5">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <label className="smallest fw-bold uppercase text-muted tracking-widest">Enhanced bullet points</label>
                    <span className="smallest fw-black text-zinc-400">{asin.bulletPointsList?.length || 0} Points</span>
                  </div>
                  <div className="bg-white rounded-4 border border-zinc-100 p-4 shadow-sm">
                    {asin.bulletPointsList?.length > 0 ? (
                      <ul className="list-unstyled mb-0 d-flex flex-column gap-3">
                        {asin.bulletPointsList.map((point, idx) => (
                          <li key={idx} className="d-flex gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <CheckCircle2 size={16} className="text-success" />
                            </div>
                            <span className="smallest fw-medium text-zinc-600 lh-sm">{point}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center py-3">
                        <AlertCircle size={24} className="text-zinc-200 mb-2" />
                        <div className="smallest text-muted italic">No bullet points extracted yet.</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Secondary Intel */}
                <div className="row g-4">
                  <div className="col-md-6">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-2 bg-zinc-100 rounded-3"><Store size={18} className="text-zinc-600" /></div>
                      <div>
                        <div className="smallest fw-bold text-muted uppercase">Sold By</div>
                        <div className="fw-bold text-zinc-900">{asin.soldBy || 'Unknown Seller'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <a href={`https://amazon.in/dp/${asin.asinCode}`} target="_blank" rel="noreferrer" className="btn btn-white btn-sm rounded-pill border border-zinc-200 shadow-sm px-4 fw-bold text-zinc-700">
                      View on Amazon <ExternalLink size={14} className="ms-1" />
                    </a>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <div className="modal-footer border-0 p-4 bg-zinc-50/50">
            <button className="btn btn-zinc-900 rounded-pill px-5 py-2 fw-black shadow-xl" onClick={onClose} style={{ backgroundColor: '#18181B', color: '#fff' }}>
              Close Pipeline Intel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellersPage;

const PoolManagementModal = ({ stats, onClose, onRefresh }) => {
  const { addToast } = useToast();
  const [taskIdsText, setTaskIdsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpload = async () => {
    const ids = taskIdsText.split(/[\n,]+/).map(id => id.trim()).filter(id => id.length > 0);
    if (ids.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await marketSyncApi.uploadPoolTasks(ids);
      if (response.success) {
        addToast({
          title: 'Success',
          message: response.message,
          type: 'success'
        });
        setTaskIdsText('');
        onRefresh();
      }
    } catch (error) {
      addToast({
        title: 'Upload Failed',
        message: error.message,
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-4">
          <div className="modal-header border-0 p-4 pb-0">
            <h5 className="fw-bold mb-0 text-zinc-900 d-flex align-items-center gap-2">
              <div className="p-2 bg-zinc-100 rounded-3 border border-zinc-200">
                <Database size={20} className="text-zinc-600" />
              </div>
              Octoparse Task Pool
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4">
            <div className="row g-3 mb-4">
              <div className="col-4">
                <div className="bg-zinc-50 p-3 rounded-3 border border-zinc-100 text-center">
                  <div className="smallest text-zinc-400 fw-bold uppercase mb-1">Total</div>
                  <div className="h4 fw-bold mb-0">{stats.total}</div>
                </div>
              </div>
              <div className="col-4">
                <div className="bg-success-subtle p-3 rounded-3 border border-success-subtle text-center">
                  <div className="smallest text-success-emphasis fw-bold uppercase mb-1">Available</div>
                  <div className="h4 fw-bold mb-0 text-success">{stats.available}</div>
                </div>
              </div>
              <div className="col-4">
                <div className="bg-zinc-100 p-3 rounded-3 border border-zinc-200 text-center">
                  <div className="smallest text-zinc-500 fw-bold uppercase mb-1">Assigned</div>
                  <div className="h4 fw-bold mb-0">{stats.assigned}</div>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Import New Task IDs</label>
              <textarea
                className="form-control form-control-sm border-zinc-200 font-monospace"
                rows="8"
                placeholder="c6ebbaff-448f-3c6d-92d2-5caa10ea5db5&#10;74be0547-1adc-4c46-a31d-011d759d672d..."
                value={taskIdsText}
                onChange={(e) => setTaskIdsText(e.target.value)}
                style={{ fontSize: '11px' }}
              ></textarea>
              <div className="form-text smallest text-muted mt-2">
                Paste one or more Octoparse Task IDs (one per line). These will be stored in the pool and automatically allocated to sellers when you click the magic wand.
              </div>
            </div>
          </div>
          <div className="modal-footer border-0 p-4 pt-0 gap-2">
            <button className="btn btn-white fw-bold px-4 border border-zinc-200 rounded-pill" onClick={onClose}>Close</button>
            <button
              className="btn btn-zinc-900 fw-bold px-4 rounded-pill shadow-sm d-flex align-items-center gap-2"
              onClick={handleUpload}
              disabled={isSubmitting || !taskIdsText.trim()}
              style={{ backgroundColor: '#18181B', color: '#fff' }}
            >
              {isSubmitting ? <RefreshCw size={16} className="spin" /> : <Plus size={16} />}
              <span>Import to Pool</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
