import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import DataTable from '../components/DataTable';
import ListView from '../components/common/ListView';
import ProgressBar from '../components/common/ProgressBar';
import KPICard from '../components/KPICard';
import EmptyState from '../components/common/EmptyState';
import BulkImportModal from '../components/asins/BulkImportModal';
import { sellerApi, asinApi, authApi, userApi, marketSyncApi } from '../services/api';
import {
  CheckCircle2,
  PauseCircle,
  Package,
  Search,
  Plus,
  FileUp,
  Upload,
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

const GRADIENTS = [
  'linear-gradient(135deg, #4f46e5, #7c3aed)', // Indigo-Violet
  'linear-gradient(135deg, #2563eb, #3b82f6)', // Blue
  'linear-gradient(135deg, #059669, #10b981)', // Emerald
  'linear-gradient(135deg, #ea580c, #f97316)', // Orange
  'linear-gradient(135deg, #db2777, #ec4899)', // Pink
  'linear-gradient(135deg, #1e1b4b, #312e81)', // Slate
  'linear-gradient(135deg, #0f766e, #14b8a6)', // Teal
];

const getStoreGradient = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
};

const formatTimeAgo = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const SellersPage = () => {
  const { user: currentUser, isAdmin, isGlobalUser, hasPermission } = useAuth();
  const isBrandManager = (currentUser?.role?.name || '').toString().toLowerCase() === 'brand manager' || (currentUser?.role?.displayName || '').toString().toLowerCase() === 'brand manager';
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
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

  const canAccessAmazon = isAdmin || hasPermission('marketplace_amazon');
  const canAccessAjio = isAdmin || hasPermission('marketplace_ajio');
  const canAccessMyntra = isAdmin || hasPermission('marketplace_myntra');

  useEffect(() => {
    if (!canAccessAmazon && canAccessAjio && marketplaceFilter !== 'ajio') {
      setMarketplaceFilter('ajio');
    } else if (canAccessAmazon && !canAccessAjio && (marketplaceFilter === 'ajio' || marketplaceFilter === 'all')) {
      setMarketplaceFilter('amazon.in');
    }
  }, [canAccessAmazon, canAccessAjio, marketplaceFilter]);

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
    return (
      <span
        className="badge fw-bold shadow-sm d-inline-flex align-items-center justify-content-center"
        style={{
          fontSize: '10px',
          padding: '4px 10px',
          borderRadius: '6px',
          backgroundColor: isActive ? '#10b981' : '#6b7280',
          color: '#ffffff',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          minWidth: '64px',
          border: 'none'
        }}
      >
        {status?.toUpperCase() || 'UNKNOWN'}
      </span>
    );
  }, []);

  const getMarketplaceBadge = useCallback((marketplace) => {
    const market = marketplace?.toLowerCase();
    const isIN = market === 'amazon.in';
    const isAjio = market === 'ajio';
    const isMyntra = market === 'myntra';

    let baseStyle = { backgroundColor: '#f4f4f5', color: '#52525b', borderColor: '#e4e4e7' };
    let logo = null;

    if (isIN) {
      baseStyle = { backgroundColor: '#eff6ff', color: '#1d4ed8', borderColor: '#bfdbfe' };
      logo = "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg";
    } else if (isAjio) {
      baseStyle = { backgroundColor: '#f5f3ff', color: '#6d28d9', borderColor: '#ddd6fe' };
      logo = "https://cdn.brandfetch.io/id78Xj7CCR/w/820/h/238/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1776791426160";
    } else if (isMyntra) {
      baseStyle = { backgroundColor: '#fdf2f8', color: '#be185d', borderColor: '#fbcfe8' };
      logo = "https://cdn.brandfetch.io/idDW82Qwj2/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1772274333492";
    }

    return (
      <span
        className="px-2 py-1 smallest fw-bold d-inline-flex align-items-center gap-2 border shadow-sm"
        style={{
          letterSpacing: '0.02em',
          fontSize: '10px',
          borderRadius: '6px',
          height: '24px',
          ...baseStyle
        }}
      >
        {logo && (
          <img
            src={logo}
            style={{
              height: '11px',
              width: 'auto',
              objectFit: 'contain',
              filter: isMyntra ? 'none' : 'none'
            }}
            alt=""
          />
        )}
        <span style={{ textTransform: 'uppercase' }}>{marketplace}</span>
      </span>
    );
  }, []);

  const renderActions = useCallback((seller) => {
    const isActive = seller.status === 'Active';

    if (isBrandManager) {
      return (
        <div className="d-flex align-items-center justify-content-end gap-1.5 w-100">
          <button
            className="btn-white-icon border shadow-sm"
            onClick={() => handleViewAsins(seller)}
            title="View ASINs"
          >
            <Package size={15} className="text-zinc-600" />
          </button>
        </div>
      );
    }
    return (
      <div className="d-flex align-items-center justify-content-end gap-1.5 w-100">
        {isGlobalUser && (
          <button
            className="btn-white-icon shadow-sm border-zinc-200"
            onClick={() => handleEditSeller(seller)}
            title="Edit Details"
          >
            <Edit3 size={14} className="text-zinc-600" />
          </button>
        )}

        <button
          className="btn-white-icon shadow-sm border-zinc-200"
          onClick={() => handleViewAsins(seller)}
          title="Manage Catalog"
        >
          <Package size={14} className="text-zinc-600" />
        </button>

        <button
          className="btn-white-icon shadow-sm border-zinc-200"
          onClick={() => handleSyncSeller(seller._id)}
          title="Sync Store"
        >
          <RefreshCw size={14} className="text-zinc-600" />
        </button>

        <button
          className={`d-flex align-items-center justify-content-center shadow-sm border transition-all ${isActive ? 'bg-white text-zinc-600 border-zinc-200' : 'text-white border-0'}`}
          onClick={() => handleToggleStatus(seller._id)}
          title={isActive ? 'Pause Store' : 'Resume Store'}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: isActive ? '#ffffff' : '#10b981',
            color: isActive ? '#52525b' : '#ffffff'
          }}
        >
          {isActive ? <Pause size={14} /> : <Play size={14} style={{ fill: 'currentColor' }} />}
        </button>

        {hasPermission('sellers_delete') && (
          <button
            className="d-flex align-items-center justify-content-center shadow-sm border border-danger-subtle transition-all hover-bg-danger-subtle"
            onClick={() => handleDeleteSeller(seller._id)}
            title="Delete Store"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              color: '#ef4444'
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    );
  }, [isBrandManager, handleEditSeller, handleViewAsins, handleSyncSeller, handleToggleStatus, handleDeleteSeller, hasPermission, isGlobalUser]);

  const listViewColumns = useMemo(() => [
    {
      label: 'Store Details',
      key: 'name',
      // Width omitted to allow flexible collapse and absorb remaining width
      render: (_, seller) => (
        <div className="d-flex align-items-center gap-3 py-1">
          <div
            className="seller-avatar d-flex align-items-center justify-content-center fw-bold shadow-sm"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: getStoreGradient(seller.name || ''),
              color: '#fff',
              fontSize: '11px',
              letterSpacing: '0.05em'
            }}
          >
            {seller.name?.slice(0, 3).toUpperCase() || 'SEL'}
          </div>
          <div>
            <div className="fw-bold text-zinc-900 d-flex align-items-center gap-2" style={{ fontSize: '13px' }}>
              {seller.name}
            </div>
            {seller.sellerId && (
              <div className="text-zinc-500 d-flex align-items-center gap-1" style={{ fontSize: '11px', marginTop: '2px' }}>
                <span className="font-monospace opacity-75">{seller.sellerId}</span>
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      label: 'Account Manager',
      key: 'managers',
      width: '16%',
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
      width: '14%',
      render: (total, seller) => (
        <div className="d-flex align-items-center justify-content-between group pe-2">
          <div className="d-flex align-items-center gap-2 cursor-pointer" onClick={() => handleViewAsins(seller)}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#f4f4f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#71717a'
              }}
              className="group-hover:bg-primary-50 group-hover:text-primary transition-colors"
            >
              <Package size={16} />
            </div>
            <div>
              <div className="fw-bold text-zinc-900" style={{ fontSize: '12px' }}>{total || 0} Total</div>
              <div className="text-zinc-500 smallest d-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                <div className="bg-success rounded-circle" style={{ width: '4px', height: '4px' }}></div>
                {seller.activeAsins || 0} Active
              </div>
            </div>
          </div>
          {!isBrandManager && (
            <div className="d-flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button
                className="btn btn-xs btn-white border border-zinc-200 shadow-sm d-flex align-items-center gap-1 hover:bg-zinc-50"
                onClick={(e) => { e.stopPropagation(); handleViewAsins(seller); }}
                title="Quick Add ASIN"
                style={{ fontSize: '10px', height: '26px' }}
              >
                <Plus size={12} className="text-zinc-600" />
              </button>
            </div>
          )}
        </div>
      )
    },
    {
      label: 'Last Activity',
      key: 'lastScraped',
      width: '14%',
      render: (lastScraped) => (
        <div className="d-flex flex-column gap-0.5">
          <div className="text-zinc-700 fw-semibold d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
            <Clock size={12} className="text-zinc-400" />
            {formatTimeAgo(lastScraped)}
          </div>
          {lastScraped && (
            <div className="text-zinc-400 smallest" style={{ fontSize: '10px', paddingLeft: '16px' }}>
              {new Date(lastScraped).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )
    },
    {
      label: 'Status',
      key: 'status',
      width: '12%',
      render: (status, seller) => getStatusBadge(status, seller.lastScraped)
    }
  ], [handleViewAsins, getStatusBadge, isBrandManager]);

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
      <div className="page-header border-bottom bg-white" style={{ padding: '16px 24px' }}>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 text-secondary small fw-medium mb-0.5">
              <span>Global</span> <ChevronRight size={12} /> <span className="text-dark fw-semibold">Sellers</span>
            </div>
            <h1 className="page-title mb-0 fw-bold text-dark tracking-tight" style={{ fontSize: '1.35rem' }}>Seller Management</h1>
          </div>
          <div className="d-flex align-items-center gap-2">
            {isGlobalUser && (
              <>
                <button
                  className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 px-3 hover-up-mild"
                  onClick={() => setShowPoolModal(true)}
                  style={{ height: '34px', borderRadius: '6px', fontSize: '11px' }}
                >
                  <LayoutGrid size={14} className="text-zinc-500" />
                  <span className="fw-bold text-zinc-700">Octoparse Pool ({poolStats.available})</span>
                </button>
                <button
                  className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 px-3 hover-up-mild"
                  onClick={handleIngestAll}
                  disabled={loading}
                  title="Force check all Octoparse tasks for results"
                  style={{ height: '34px', borderRadius: '6px', fontSize: '11px' }}
                >
                  <RefreshCw size={14} className={`text-primary ${loading ? 'spin' : ''}`} />
                  <span className="fw-bold text-zinc-700">{loading ? 'Syncing...' : 'Fetch Latest'}</span>
                </button>
              </>
            )}
            {!isBrandManager && (
              <>
                <button
                  className="btn btn-primary btn-sm shadow-sm border-0 d-flex align-items-center gap-2 px-3 hover-up-mild"
                  onClick={() => setShowBulkImportModal(true)}
                  style={{ height: '34px', borderRadius: '6px', fontSize: '11px', backgroundColor: '#4f46e5' }}
                >
                  <Upload size={14} />
                  <span className="fw-bold">Bulk Import</span>
                </button>
                <button
                  className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 px-3 hover-up-mild"
                  onClick={() => setShowImportModal(true)}
                  style={{ height: '34px', borderRadius: '6px', fontSize: '11px' }}
                >
                  <FileUp size={14} className="text-zinc-500" />
                  <span className="fw-bold text-zinc-700">CSV</span>
                </button>
                <button
                  className="btn btn-zinc-900 btn-sm shadow-sm border-0 d-flex align-items-center gap-2 px-3 hover-up-mild"
                  onClick={() => setShowAddModal(true)}
                  style={{ height: '34px', borderRadius: '6px', fontSize: '11px', backgroundColor: '#18181b', color: '#fff' }}
                >
                  <Plus size={14} />
                  <span className="fw-bold">Add Store</span>
                </button>
              </>
            )}
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

          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 border-bottom border-zinc-100" style={{ padding: '12px 24px', backgroundColor: '#ffffff' }}>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {/* STATUS PILLS */}
              <div className="bg-light p-1 rounded-3 border d-flex" style={{ height: '36px' }}>
                {['all', 'Active', 'Paused'].map(tab => (
                  <button
                    key={tab}
                    className={`btn btn-sm px-3 rounded-2 border-0 transition-all fw-bold smallest ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500'}`}
                    style={{ fontSize: '11px' }}
                    onClick={() => {
                      setActiveTab(tab);
                      setStatusFilter('all');
                    }}
                  >
                    {tab === 'all' ? 'All Stores' : tab}
                  </button>
                ))}
              </div>

              {/* MARKETPLACE SWITCHER */}
              <div className="bg-light p-1 rounded-3 border d-flex" style={{ height: '36px' }}>
                <button
                  type="button"
                  onClick={() => setMarketplaceFilter('all')}
                  className={`btn btn-sm px-3 border-0 fw-bold rounded-2 transition-all ${marketplaceFilter === 'all' ? 'bg-white text-dark shadow-sm' : 'text-zinc-500'}`}
                  style={{ fontSize: '11px' }}
                >
                  Markets
                </button>
                {canAccessAmazon && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMarketplaceFilter('amazon.in')}
                      className={`btn btn-sm px-3 border-0 fw-bold rounded-2 d-flex align-items-center transition-all ${marketplaceFilter === 'amazon.in' ? 'bg-white text-primary shadow-sm' : 'text-zinc-500'}`}
                      style={{ fontSize: '11px' }}
                    >
                      <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" style={{ height: '10px', width: 'auto', objectFit: 'contain', marginRight: '5px', filter: marketplaceFilter === 'amazon.in' ? 'none' : 'grayscale(100%) opacity(0.6)' }} alt="IN" />

                    </button>
                  </>
                )}
                {canAccessAjio && (
                  <button
                    type="button"
                    onClick={() => setMarketplaceFilter('ajio')}
                    className={`btn btn-sm px-3 border-0 fw-bold rounded-2 d-flex align-items-center transition-all ${marketplaceFilter === 'ajio' ? 'bg-white text-purple-600 shadow-sm' : 'text-zinc-500'}`}
                    style={{ fontSize: '11px' }}
                  >
                    <img src="https://cdn.brandfetch.io/id78Xj7CCR/w/820/h/238/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1776791426160" style={{ height: '10px', width: 'auto', objectFit: 'contain', marginRight: '6px', filter: marketplaceFilter === 'ajio' ? 'none' : 'grayscale(100%) opacity(0.6)' }} alt="Ajio" />

                  </button>
                )}
                {canAccessMyntra && (
                  <button
                    type="button"
                    onClick={() => setMarketplaceFilter('myntra')}
                    className={`btn btn-sm px-3 border-0 fw-bold rounded-2 d-flex align-items-center transition-all ${marketplaceFilter === 'myntra' ? 'bg-white text-pink-600 shadow-sm' : 'text-zinc-500'}`}
                    style={{ fontSize: '11px' }}
                  >
                    <img src="https://cdn.brandfetch.io/idDW82Qwj2/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1772274333492" style={{ height: '12px', width: 'auto', objectFit: 'contain', marginRight: '5px', filter: marketplaceFilter === 'myntra' ? 'none' : 'grayscale(100%) opacity(0.6)' }} alt="Myntra" />

                  </button>
                )}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <div className="position-relative">
                <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" size={14} />
                <input
                  type="text"
                  className="form-control form-control-sm ps-5 bg-white border border-zinc-200 shadow-sm rounded-3 fw-medium"
                  placeholder="Search storefronts..."
                  style={{ width: '280px', height: '36px', fontSize: '12px' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
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
            actionWidth="220px"
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

        <BulkImportModal
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          onComplete={() => loadSellers(true)}
        />
      </Suspense>
    </>
  );
};

export default React.memo(SellersPage);
