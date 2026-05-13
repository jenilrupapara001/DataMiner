import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { sellerApi, asinApi, authApi, userApi, marketSyncApi } from '../services/api';
import {
  Table, Button, Input, Segmented, Select, Space, Tag, Typography, Tooltip, Avatar,
  Modal, Empty, message
} from 'antd';
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
const BulkImportModal = lazy(() => import('../components/asins/BulkImportModal'));

const { Text, Title } = Typography;

const GRADIENTS = [
  'linear-gradient(135deg, #4f46e5, #7c3aed)',
  'linear-gradient(135deg, #2563eb, #3b82f6)',
  'linear-gradient(135deg, #059669, #10b981)',
  'linear-gradient(135deg, #ea580c, #f97316)',
  'linear-gradient(135deg, #db2777, #ec4899)',
  'linear-gradient(135deg, #1e1b4b, #312e81)',
  'linear-gradient(135deg, #0f766e, #14b8a6)',
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
  const isBrandManager = (currentUser?.role?.name || '').toString().toLowerCase() === 'brand manager' ||
    (currentUser?.role?.displayName || '').toString().toLowerCase() === 'brand manager';

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
    if (pageNum === 1) {
      setSellerAsins([]); // Clear stale ASIN data immediately to prevent flicker
    }
    try {
      const result = await asinApi.getBySeller(seller._id || seller.id, { page: pageNum, limit: 50 });
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

  const getStatusBadge = useCallback((status) => {
    const isActive = status === 'Active';
    return (
      <Tag
        color={isActive ? 'green' : 'default'}
        style={{
          fontWeight: 700,
          textTransform: 'uppercase',
          fontSize: 10,
          borderRadius: 6,
          padding: '0 8px',
          lineHeight: '18px',
        }}
      >
        {status?.toUpperCase() || 'UNKNOWN'}
      </Tag>
    );
  }, []);

  const getMarketplaceBadge = useCallback((marketplace) => {
    const market = marketplace?.toLowerCase();
    let color, bg, border, logo;

    if (market === 'amazon.in') {
      color = '#1d4ed8';
      bg = '#eff6ff';
      border = '#bfdbfe';
      logo = "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg";
    } else if (market === 'ajio') {
      color = '#6d28d9';
      bg = '#f5f3ff';
      border = '#ddd6fe';
      logo = "https://cdn.brandfetch.io/id78Xj7CCR/w/820/h/238/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1776791426160";
    } else if (market === 'myntra') {
      color = '#be185d';
      bg = '#fdf2f8';
      border = '#fbcfe8';
      logo = "https://cdn.brandfetch.io/idDW82Qwj2/theme/dark/logo.svg?c=1bxid64Mup7aczewSAYMX&t=1772274333492";
    } else {
      color = '#52525b';
      bg = '#f4f4f5';
      border = '#e4e4e7';
      logo = null;
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px',
          height: 24,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          borderRadius: 6,
          color,
          background: bg,
          border: `1px solid ${border}`,
          letterSpacing: '0.03em',
        }}
      >
        {logo && (
          <img
            src={logo}
            style={{ height: 11, width: 'auto', objectFit: 'contain' }}
            alt=""
          />
        )}
        {marketplace}
      </span>
    );
  }, []);

  const renderActions = useCallback((seller) => {
    const isActive = seller.status === 'Active';

    if (isBrandManager) {
      return (
        <Space size={6}>
          <Tooltip title="View ASINs">
            <Button
              type="text"
              icon={<Package size={14} />}
              onClick={() => handleViewAsins(seller)}
              style={{ color: '#52525b' }}
            />
          </Tooltip>
        </Space>
      );
    }
    return (
      <Space size={6}>
        {isGlobalUser && (
          <Tooltip title="Edit Details">
            <Button
              type="text"
              icon={<Edit3 size={14} />}
              onClick={() => handleEditSeller(seller)}
              style={{ color: '#52525b' }}
            />
          </Tooltip>
        )}
        <Tooltip title="Manage Catalog">
          <Button
            type="text"
            icon={<Package size={14} />}
            onClick={() => handleViewAsins(seller)}
            style={{ color: '#52525b' }}
          />
        </Tooltip>
        <Tooltip title="Sync Store">
          <Button
            type="text"
            icon={<RefreshCw size={14} />}
            onClick={() => handleSyncSeller(seller._id)}
            style={{ color: '#52525b' }}
          />
        </Tooltip>
        <Tooltip title={isActive ? 'Pause Store' : 'Resume Store'}>
          <Button
            type={isActive ? 'default' : 'primary'}
            icon={isActive ? <Pause size={14} /> : <Play size={14} />}
            onClick={() => handleToggleStatus(seller._id)}
            danger={!isActive}
            style={{
              borderColor: isActive ? undefined : '#10b981',
              backgroundColor: isActive ? undefined : '#10b981',
              color: isActive ? '#52525b' : '#fff',
            }}
          />
        </Tooltip>
        {hasPermission('sellers_delete') && (
          <Tooltip title="Delete Store">
            <Button
              type="text"
              danger
              icon={<Trash2 size={14} />}
              onClick={() => handleDeleteSeller(seller._id)}
              style={{ color: '#ef4444' }}
            />
          </Tooltip>
        )}
      </Space>
    );
  }, [isBrandManager, handleEditSeller, handleViewAsins, handleSyncSeller, handleToggleStatus, handleDeleteSeller, hasPermission, isGlobalUser]);

  // Column definitions for Ant Design Table (with grouping handled separately)
  const columns = useMemo(() => [
    {
      title: 'Store Details',
      dataIndex: 'name',
      key: 'name',
      render: (_, seller) => {
        if (seller?.isGroupHeader) {
          // Render marketplace group header
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {getMarketplaceBadge(seller.marketplace)}
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600 }}>
                {seller.count} STORES
              </Text>
            </div>
          );
        }
        return (
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: getStoreGradient(seller.name || ''),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.05em',
                flexShrink: 0,
              }}
            >
              {seller.name?.slice(0, 3).toUpperCase() || 'SEL'}
            </div>
            <div>
              <Text strong style={{ fontSize: 13 }}>{seller.name}</Text>
              {seller.sellerId && (
                <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                  <Text code style={{ fontSize: 11 }}>{seller.sellerId}</Text>
                </div>
              )}
            </div>
          </div>
        );
      },
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Account Manager',
      dataIndex: 'managers',
      key: 'managers',
      render: (managers, record) => {
        if (record?.isGroupHeader) return null;
        if (!managers?.length) {
          return <Text type="secondary" italic style={{ fontSize: 10 }}>Unassigned</Text>;
        }
        return (
          <Space wrap size={4}>
            {managers.map((m) => (
              <span key={m._id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Avatar
                  size={20}
                  style={{
                    backgroundColor: '#f4f4f5',
                    color: '#18181b',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {m.firstName?.charAt(0)}{m.lastName?.charAt(0)}
                </Avatar>
                <Text style={{ fontSize: 11 }}>{m.firstName} {m.lastName}</Text>
              </span>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Inventory',
      dataIndex: 'totalAsins',
      key: 'totalAsins',
      render: (total, seller) => {
        if (seller?.isGroupHeader) return null;
        return (
          <Button
            type="link"
            onClick={() => handleViewAsins(seller)}
            style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 8, color: '#18181b' }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: '#f4f4f5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Package size={16} color="#71717a" />
            </div>
            <div>
              <Text strong style={{ fontSize: 12 }}>{total || 0} Total</Text>
              <div style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  display: 'inline-block',
                }} />
                {seller.activeAsins || 0} Active
              </div>
            </div>
          </Button>
        );
      },
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastScraped',
      key: 'lastScraped',
      render: (lastScraped, record) => {
        if (record?.isGroupHeader) return null;
        return (
          <div>
            <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} style={{ color: '#a1a1aa' }} />
              {formatTimeAgo(lastScraped)}
            </div>
            {lastScraped && (
              <div style={{ fontSize: 10, color: '#a1a1aa', paddingLeft: 16 }}>
                {new Date(lastScraped).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status, record) => {
        if (record?.isGroupHeader) return null;
        return getStatusBadge(status);
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, seller) => {
        if (seller?.isGroupHeader) return null;
        return renderActions(seller);
      },
    },
  ], [handleViewAsins, getStatusBadge, getMarketplaceBadge, renderActions]);

  // Group sellers by marketplace for the table dataSource (client-side grouping)
  const groupedDataSource = useMemo(() => {
    const grouped = {};
    paginatedSellers.forEach(seller => {
      const market = seller.marketplace || 'Unknown';
      if (!grouped[market]) grouped[market] = [];
      grouped[market].push(seller);
    });

    const data = [];
    Object.entries(grouped).forEach(([market, sellersInGroup]) => {
      data.push({
        // Group header row
        _id: `group-${market}`,
        marketplace: market,
        count: sellersInGroup.length,
        isGroupHeader: true,
      });
      data.push(...sellersInGroup);
    });
    return data;
  }, [paginatedSellers]);

  const rowSelection = {
    selectedRowKeys: selectedSellerIds,
    onChange: (selectedRowKeys) => {
      setSelectedSellerIds(selectedRowKeys);
    },
    getCheckboxProps: (record) => ({
      disabled: record.isGroupHeader,
      name: record.name,
    }),
  };

  // Clear selection when data changes (page, filters)
  useEffect(() => {
    setSelectedSellerIds([]);
  }, [page, activeTab, marketplaceFilter, debouncedSearchQuery]);

  if (loading && sellers.length === 0) {
    return <PageLoader message="Loading Sellers..." />;
  }

  return (
    <>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      {/* Page Header */}
      <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
        <Space direction="vertical" size={0}>
          <Space size={4} style={{ color: '#8c8c8c', fontSize: 12 }}>
            <Text type="secondary">Global</Text>
            <ChevronRight size={12} />
            <Text strong>Sellers</Text>
          </Space>
          <Title level={4} style={{ margin: 0, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Seller Management
          </Title>
        </Space>
        <Space style={{ marginTop: 12 }}>
          {isGlobalUser && (
            <>
              <Button
                onClick={() => setShowPoolModal(true)}
                icon={<LayoutGrid size={14} />}
              >
                Octoparse Pool ({poolStats.available})
              </Button>
              <Button
                onClick={handleIngestAll}
                loading={loading}
                icon={<RefreshCw size={14} />}
              >
                {loading ? 'Syncing...' : 'Fetch Latest'}
              </Button>
            </>
          )}
          {!isBrandManager && (
            <>
              <Button
                type="primary"
                icon={<Upload size={14} />}
                onClick={() => setShowBulkImportModal(true)}
                style={{ background: '#4f46e5', borderColor: '#4f46e5' }}
              >
                Bulk Import
              </Button>
              <Button
                icon={<FileUp size={14} />}
                onClick={() => setShowImportModal(true)}
              >
                CSV
              </Button>
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={() => setShowAddModal(true)}
                style={{ background: '#18181b', borderColor: '#18181b' }}
              >
                Add Store
              </Button>
            </>
          )}
        </Space>
      </div>

      {/* Filters & Search Bar */}
      <div style={{ padding: '12px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <Space wrap>
          <Segmented
            options={[
              { label: 'All Stores', value: 'all' },
              { label: 'Active', value: 'Active' },
              { label: 'Paused', value: 'Paused' },
            ]}
            value={activeTab}
            onChange={(value) => {
              setActiveTab(value);
              setStatusFilter('all'); // reset status filter when using main tabs
            }}
            style={{ fontWeight: 600, fontSize: 11 }}
          />
          <Select
            value={marketplaceFilter}
            onChange={setMarketplaceFilter}
            style={{ width: 160 }}
            options={[
              { label: 'All Markets', value: 'all' },
              ...(canAccessAmazon ? [{ label: 'Amazon.in', value: 'amazon.in' }] : []),
              ...(canAccessAjio ? [{ label: 'Ajio', value: 'ajio' }] : []),
              ...(canAccessMyntra ? [{ label: 'Myntra', value: 'myntra' }] : []),
            ]}
          />
        </Space>
        <Input.Search
          placeholder="Search storefronts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
      </div>

      {/* Global Cache / Stats Bar */}
      <div style={{ padding: '8px 24px', background: '#18181b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Text style={{ color: '#a1a1aa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Global Cache</Text>
          <Text strong style={{ fontSize: 12, color: '#fff' }}>{sellers.length} records found</Text>
          <Text style={{ color: '#a1a1aa', fontSize: 12 }}>|</Text>
          <Text strong style={{ fontSize: 12, color: '#fff' }}>{totalResults} shown</Text>
        </Space>
        <Space>
          <Button
            type="link"
            size="small"
            style={{ color: '#a1a1aa', fontSize: 10, fontWeight: 700, padding: 0 }}
            onClick={() => {
              setActiveTab('all');
              setMarketplaceFilter('all');
              setStatusFilter('all');
              setSearchQuery('');
            }}
          >
            Emergency Reset Filters
          </Button>
          <Button size="small" onClick={() => loadSellers()}>
            Force Refresh
          </Button>
        </Space>
      </div>

      {/* Bulk Action Bar (when selection is active) */}
      {selectedSellerIds.length > 0 && (
        <div style={{
          padding: '8px 24px',
          background: '#18181b',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Text strong style={{ color: '#fff', fontSize: 12 }}>
            {selectedSellerIds.length} selected
          </Text>
          <Space>
            <Button
              size="small"
              type="primary"
              icon={<RefreshCw size={14} />}
              onClick={handleBulkSync}
              loading={loading}
            >
              Sync Selected
            </Button>
            <Button size="small" onClick={() => setSelectedSellerIds([])}>
              Clear
            </Button>
          </Space>
        </div>
      )}

      <div style={{ padding: 24 }}>
        <Table
          columns={columns}
          dataSource={groupedDataSource}
          rowKey="_id"
          loading={loading}
          rowSelection={rowSelection}
          pagination={{
            current: page,
            pageSize: limit,
            total: totalResults,
            showSizeChanger: true,
            pageSizeOptions: ['25', '50', '100'],
            onChange: (page, pageSize) => {
              setPage(page);
              setLimit(pageSize);
            },
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} stores`,
          }}
          scroll={{ x: 900 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span style={{ fontWeight: 600, color: '#94a3b8' }}>
                    No sellers yet — add your first store to begin tracking.
                  </span>
                }
              />
            ),
          }}
          onRow={(record) => {
            if (record.isGroupHeader) {
              return {
                style: { background: '#fafafa', fontWeight: 600 },
              };
            }
            return {};
          }}
        />
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
              loadSellers(true);
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
              loadSellers(true);
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