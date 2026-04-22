import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useDebounce } from '../hooks/useDebounce';
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
import { useSocket } from '../contexts/SocketContext';

const AddSellerModal = lazy(() => import('../components/sellers/AddSellerModal'));
const ImportSellerModal = lazy(() => import('../components/sellers/ImportSellerModal'));
const SellerAsinsModal = lazy(() => import('../components/sellers/SellerAsinsModal'));
const PoolManagementModal = lazy(() => import('../components/sellers/PoolManagementModal'));

const SellersPage = () => {
  const { user: currentUser, isAdmin, isGlobalUser, hasPermission } = useAuth();
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

   const [page, setPage] = useState(1);
   const [limit, setLimit] = useState(50);
   const [totalItems, setTotalItems] = useState(0);

   const [showPoolModal, setShowPoolModal] = useState(false);
   const [poolStats, setPoolStats] = useState({ total: 0, assigned: 0, available: 0 });
   const [editingSeller, setEditingSeller] = useState(null);
   const [asinPagination, setAsinPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
   const [loadingAsins, setLoadingAsins] = useState(false);
   const [selectedSellerIds, setSelectedSellerIds] = useState([]);
   const { addToast } = useToast();
   const socket = useSocket();

  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  useEffect(() => {
    setPage(1);
  }, [activeTab, marketplaceFilter, statusFilter, debouncedSearchQuery]);


  const fetchPoolStats = useCallback(async () => {
    try {
      const response = await marketSyncApi.getPoolStatus();
      if (response.success) {
        setPoolStats(response.stats);
      }
    } catch (error) {
      console.error('Failed to fetch pool stats:', error);
    }
  }, []);

  const loadSellers = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await sellerApi.getAll({
        page,
        limit,
        status: statusFilter !== 'all' ? statusFilter : activeTab !== 'all' ? activeTab : undefined,
        marketplace: marketplaceFilter !== 'all' ? marketplaceFilter : undefined,
        search: debouncedSearchQuery || undefined
      });

      let extractedSellers = [];
      let total = 0;

      if (response) {
        if (response.success && response.data) {
          extractedSellers = response.data.sellers || (Array.isArray(response.data) ? response.data : []);
          // Support both backend formats (paginated and legacy)
          total = response.data.pagination?.total || response.data.total || extractedSellers.length;
        } else if (response.sellers && Array.isArray(response.sellers)) {
          extractedSellers = response.sellers;
          total = response.total || extractedSellers.length;
        } else if (Array.isArray(response)) {
          extractedSellers = response;
          total = response.length;
        } else if (response.data && Array.isArray(response.data)) {
          extractedSellers = response.data;
          total = extractedSellers.length;
        }
      }
      setSellers(extractedSellers);
      setTotalItems(total);
    } catch (error) {
      addToast('Network error: Could not connect to data service', 'error');
      setSellers([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, activeTab, marketplaceFilter, statusFilter, debouncedSearchQuery, addToast]);

  useEffect(() => {
    loadSellers();
  }, [page, limit, activeTab, marketplaceFilter, statusFilter, debouncedSearchQuery, loadSellers]);

  useEffect(() => {
    if (isGlobalUser) {
      fetchPoolStats();
    }
  }, [isGlobalUser, fetchPoolStats]);

  // Real-time seller updates
  useEffect(() => {
    if (socket) {
      const handleSellersUpdate = (data) => {
        console.log('📢 Real-time update received:', data);
        loadSellers(true);
      };

      socket.on('SELLERS_UPDATED', handleSellersUpdate);
      return () => socket.off('SELLERS_UPDATED', handleSellersUpdate);
    }
  }, [socket, loadSellers]);

  const { paginatedSellers, totalResults } = useMemo(() => {
    return {
      paginatedSellers: sellers || [],
      totalResults: totalItems || 0
    };
  }, [sellers, totalItems]);


  const handleAddSeller = useCallback(async (sellerData) => {
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
  }, [editingSeller, loadSellers, addToast]);

  const handleEditSeller = useCallback((seller) => {
    setEditingSeller(seller);
    setShowAddModal(true);
  }, []);

  const handleImportSellers = useCallback(async (sellersData) => {
    try {
      const response = await sellerApi.import(sellersData);
      if (response.success) {
        addToast({
          title: 'Import Successful',
          message: `${sellersData.length} storefronts have been successfully onboarded.`,
          type: 'success'
        });
        await loadSellers();
        setShowImportModal(false);
        return true;
      }
    } catch (error) {
      addToast({
        title: 'Import Failed',
        message: error.message || 'Check your CSV format and try again.',
        type: 'error'
      });
      return false;
    }
  }, [loadSellers, addToast]);

  const handleToggleStatus = useCallback(async (sellerId) => {
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
  }, [sellers, loadSellers, addToast]);

  const handleDeleteSeller = useCallback(async (sellerId) => {
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
  }, [loadSellers, addToast]);

  const handleViewAsins = useCallback(async (seller, pageNum = 1) => {
    setSelectedSeller(seller);
    setShowAsinModal(true);
    setLoadingAsins(true);
    try {
      const result = await asinApi.getBySeller(seller._id, { page: pageNum, limit: 50 });
      if (pageNum === 1) {
        setSellerAsins(result.asins || []);
      } else {
        setSellerAsins(prev => [...prev, ...(result.asins || [])]);
      }
      setAsinPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (error) {
      console.error('Failed to load ASINs:', error);
      if (pageNum === 1) setSellerAsins([]);
    } finally {
      setLoadingAsins(false);
    }
  }, []);

  const handleLoadMoreAsins = useCallback(() => {
    if (asinPagination.page < asinPagination.totalPages && !loadingAsins) {
      handleViewAsins(selectedSeller, asinPagination.page + 1);
    }
  }, [asinPagination, loadingAsins, selectedSeller, handleViewAsins]);


  const handleAddAsin = useCallback(async (asinData) => {
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
      const result = await asinApi.getBySeller(selectedSeller._id, { page: 1, limit: 50 });
      setSellerAsins(result.asins);
      setAsinPagination(result.pagination);

      await loadSellers();
    } catch (error) {
      addToast({
        title: 'Add Failed',
        message: error.message || 'Failed to add ASIN',
        type: 'error'
      });
    }
  }, [selectedSeller, loadSellers, addToast]);

  const handleDeleteAsin = useCallback(async (asinId) => {
    try {
      await asinApi.delete(asinId);
      const result = await asinApi.getBySeller(selectedSeller._id, { page: 1, limit: 50 });
      setSellerAsins(result.asins);
      setAsinPagination(result.pagination);

      await loadSellers();
    } catch (error) {
      addToast({
        title: 'Delete Failed',
        message: 'Failed to delete ASIN: ' + error.message,
        type: 'error'
      });
    }
  }, [selectedSeller, loadSellers, addToast]);

  const handleToggleAsinStatus = useCallback(async (asinId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
      await asinApi.update(asinId, { status: newStatus });
      const result = await asinApi.getBySeller(selectedSeller._id, { page: 1, limit: 50 });
      setSellerAsins(result.asins);
      setAsinPagination(result.pagination);

      await loadSellers();
    } catch (error) {
      addToast({
        title: 'Status Update Failed',
        message: 'Failed to toggle ASIN status: ' + error.message,
        type: 'error'
      });
    }
  }, [selectedSeller, loadSellers, addToast]);

  const handleSyncAsin = useCallback(async (asinId) => {
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
  }, [addToast]);

  const handleUpdateAsin = useCallback(async (asinId, data) => {
    try {
      await asinApi.update(asinId, data);
      const result = await asinApi.getBySeller(selectedSeller._id, { page: 1, limit: 50 });
      setSellerAsins(result.asins);
      setAsinPagination(result.pagination);

      await loadSellers();
    } catch (error) {
      addToast({
        title: 'Update Failed',
        message: 'Failed to update ASIN: ' + error.message,
        type: 'error'
      });
    }
  }, [selectedSeller, loadSellers, addToast]);

   const handleFullSync = useCallback(async (sellerId) => {
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
   }, [addToast]);

   const handleSyncSeller = useCallback(async (sellerId) => {
     setLoading(true);
     try {
       const response = await marketSyncApi.syncSellerAsins(sellerId, false);
       if (response.success) {
         addToast({
           title: 'Sync Initiated',
           message: 'Seller ASIN data sync triggered successfully!',
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
   }, [addToast]);

   const handleBulkSync = useCallback(async () => {
     if (selectedSellerIds.length === 0) return;
     if (!window.confirm(`Sync ${selectedSellerIds.length} seller(s) with Octoparse? This will trigger scraping for all ASINs under these sellers.`)) return;
     
     setLoading(true);
     let successCount = 0;
     let errorCount = 0;
     
     try {
       // Sync all selected sellers concurrently
       await Promise.all(
         selectedSellerIds.map(async (sellerId) => {
           try {
             await marketSyncApi.syncSellerAsins(sellerId, false);
             successCount++;
           } catch (err) {
             errorCount++;
             console.error(`Sync failed for seller ${sellerId}:`, err.message);
           }
         })
       );
       
       addToast({
         title: 'Bulk Sync Complete',
         message: `Successfully synced ${successCount} seller(s). ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
         type: errorCount > 0 ? 'warning' : 'success'
       });
       setSelectedSellerIds([]);
     } catch (error) {
       addToast({
         title: 'Bulk Sync Failed',
         message: error.message,
         type: 'error'
       });
     }
     setLoading(false);
   }, [selectedSellerIds, addToast]);

  const handleIngestAll = useCallback(async () => {
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
  }, [addToast]);

  const getStatusBadge = useCallback((status, lastScraped) => {
    const isActive = status === 'Active';
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
  }, []);

  const getMarketplaceBadge = useCallback((marketplace) => {
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
  }, []);

   // Memoized Actions for ListView
   const renderActions = useCallback((seller) => (
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
         onClick={() => handleSyncSeller(seller._id)}
         title="Sync to Octoparse (Scrape ASINs)"
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

       {hasPermission('sellers_delete') && (
         <button
           className="btn-white-icon text-danger border-danger-subtle hover-bg-danger-subtle"
           onClick={() => handleDeleteSeller(seller._id)}
           title="Delete Seller & ASINs"
           style={{ color: '#ef4444' }}
         >
           <Trash2 size={16} />
         </button>
       )}

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
          {isGlobalUser && (
            <li>
              <button className="dropdown-item rounded-3 d-flex align-items-center gap-3 py-2" onClick={() => handleEditSeller(seller)}>
                <Edit3 size={16} strokeWidth={2} className="text-zinc-600" />
                <span className="text-zinc-700 fw-medium">Edit Details</span>
              </button>
            </li>
          )}
          {hasPermission('sellers_delete') && (
            <li>
              <button className="dropdown-item rounded-3 d-flex align-items-center gap-3 py-2 text-danger" onClick={() => handleDeleteSeller(seller._id)}>
                <Trash2 size={16} strokeWidth={2} />
                <span className="fw-semibold">Delete Store</span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
   ), [handleEditSeller, handleViewAsins, handleSyncSeller, handleToggleStatus, handleDeleteSeller, hasPermission, isGlobalUser]);

  const listViewColumns = useMemo(() => [
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
            {seller.name?.slice(0, 3).toUpperCase() || 'SEL'}
          </div>
          <div>
            <div className="fw-bold text-zinc-900" style={{ fontSize: '13px' }}>{seller.name}</div>
            <div className="text-zinc-500 d-flex align-items-center gap-1" style={{ fontSize: '11px', marginTop: '2px' }}>
              <span className="font-monospace opacity-75">{seller.sellerId}</span>
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
                  {m.firstName?.charAt(0)}{m.lastName?.charAt(0)}
                </div>
                <span className="text-zinc-700 fw-medium" style={{ fontSize: '11px' }}>
                  {m.firstName} {m.lastName}
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
      label: 'Inventory',
      key: 'totalAsins',
      width: '15%',
      render: (total, seller) => (
        <div className="d-flex align-items-center justify-content-between group pe-2">
          <div className="d-flex align-items-center gap-2 cursor-pointer" onClick={() => handleViewAsins(seller)}>
            <div 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-secondary)'
              }}
              className="group-hover:bg-primary-50 group-hover:text-primary transition-colors"
            >
              <Package size={16} />
            </div>
            <div>
              <div className="fw-bold text-zinc-900" style={{ fontSize: '12px' }}>{total || 0}</div>
              <div className="text-zinc-500 smallest" style={{ fontSize: '10px' }}>{seller.activeAsins || 0} Live</div>
            </div>
          </div>
          <div className="d-flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button 
              className="btn btn-xs btn-white border border-zinc-200 shadow-sm d-flex align-items-center gap-1 hover:bg-zinc-50"
              onClick={(e) => { e.stopPropagation(); setShowAsinModal(true); setSelectedSeller(seller); }}
              title="Quick Add ASIN"
              style={{ fontSize: '10px', height: '26px' }}
            >
              <Plus size={12} className="text-zinc-600" />
              <span className="fw-bold">ADD</span>
            </button>
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
  ], [handleViewAsins, getStatusBadge]);

  const renderGroupHeader = useCallback(({ group, rows }) => (
    <div className="d-flex align-items-center gap-2">
      {getMarketplaceBadge(group)}
      <span className="text-muted smallest fw-bold">{rows.length} STORES</span>
    </div>
  ), [getMarketplaceBadge]);

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
            {isGlobalUser && (
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
                  disabled={loading}
                  title="Force check all Octoparse tasks for results"
                >
                  <RefreshCw size={16} className={`text-primary ${loading ? 'spin' : ''}`} />
                  <span className="fw-bold text-zinc-700">{loading ? 'Fetching...' : 'Fetch Latest Data'}</span>
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

        <div className="bg-white border border-zinc-200 rounded-4 shadow-sm mb-4 overflow-hidden">
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
              {['all', 'Active', 'Paused'].map(tab => (
                <button
                  key={tab}
                  className={`btn btn-sm px-4 rounded-pill border-0 transition-all fw-bold smallest ${activeTab === tab ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500'}`}
                  style={activeTab === tab ? { backgroundColor: '#18181B' } : {}}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'all' ? 'All' : tab}
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
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card-body p-0 min-h-400 position-relative">
          <ListView
            columns={listViewColumns}
            rows={paginatedSellers}
            loading={loading && sellers.length === 0}
            groupBy="marketplace"
            rowKey="_id"
            options={{ selectable: true }}
            renderGroupHeader={renderGroupHeader}
            actions={renderActions}
            pagination={{
              page,
              limit,
              total: totalResults,
              onPageChange: setPage,
              onLimitChange: (newLimit) => {
                setLimit(newLimit);
                setPage(1);
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
        </div>
      </div>

      <Suspense fallback={null}>
        {showAddModal && (
          <AddSellerModal
            onClose={() => { setShowAddModal(false); setEditingSeller(null); }}
            onSave={handleAddSeller}
            isAdmin={isAdmin}
            isGlobalUser={isGlobalUser}
            initialData={editingSeller}
          />
        )}

        {showImportModal && (
          <ImportSellerModal
            onClose={() => setShowImportModal(false)}
            onImport={handleImportSellers}
          />
        )}

        {showAsinModal && selectedSeller && (
          <SellerAsinsModal
            seller={selectedSeller}
            asins={sellerAsins}
            onClose={() => { 
              setShowAsinModal(false); 
              setSelectedSeller(null); 
              loadSellers(true); // Silent update on close
            }}
            onAddAsin={handleAddAsin}
            onDeleteAsin={handleDeleteAsin}
            onToggleStatus={handleToggleAsinStatus}
            onUpdateAsin={handleUpdateAsin}
            onSyncAsin={handleSyncAsin}
            isAdmin={isAdmin}
            isGlobalUser={isGlobalUser}
            onRefresh={() => {
              handleViewAsins(selectedSeller, 1);
              loadSellers(true); // Silent update on internal changes
            }}
            pagination={asinPagination}
            onLoadMore={handleLoadMoreAsins}
            loading={loadingAsins}
          />
        )}

        {showPoolModal && (
          <PoolManagementModal
            stats={poolStats}
            onClose={() => setShowPoolModal(false)}
            onRefresh={fetchPoolStats}
          />
        )}
      </Suspense>
    </>
  );
};

export default React.memo(SellersPage);
