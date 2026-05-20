import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { sellerApi, asinApi, authApi, userApi, marketSyncApi } from '../services/api';
import {
  Table, Button, Input, Segmented, Select, Space, Tag, Typography, Tooltip, Avatar,
  Modal, Empty, message, Divider, Badge, Card
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
  const [bulkImportConfig, setBulkImportConfig] = useState({ sellerId: '', tab: 'catalog' });
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

  const handleCatalogSync = useCallback((seller) => {
    const isAjio = seller.marketplace?.toLowerCase() === 'ajio';
    setBulkImportConfig({
      sellerId: seller._id,
      tab: isAjio ? 'ajio_catalog' : 'catalog'
    });
    setShowBulkImportModal(true);
  }, []);

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
        <Space size={4}>
          <Tooltip title="View ASINs">
            <Button
              type="text"
              size="small"
              icon={<Package size={14} />}
              onClick={() => handleViewAsins(seller)}
              style={{ color: '#64748b' }}
            />
          </Tooltip>
        </Space>
      );
    }
    return (
      <Space size={4}>
        {isGlobalUser && (
          <Tooltip title="Edit Details">
            <Button
              type="text"
              size="small"
              icon={<Edit3 size={14} />}
              onClick={() => handleEditSeller(seller)}
              style={{ color: '#64748b' }}
            />
          </Tooltip>
        )}
        <Tooltip title="Manage Catalog">
          <Button
            type="text"
            size="small"
            icon={<Package size={14} />}
            onClick={() => handleViewAsins(seller)}
            style={{ color: '#64748b' }}
          />
        </Tooltip>
        <Tooltip title="Catalog Sync">
          <Button
            type="text"
            size="small"
            icon={<FileUp size={14} />}
            onClick={() => handleCatalogSync(seller)}
            style={{ color: '#64748b' }}
          />
        </Tooltip>
        <Tooltip title="Sync Store">
          <Button
            type="text"
            size="small"
            icon={<RefreshCw size={14} />}
            onClick={() => handleSyncSeller(seller._id)}
            style={{ color: '#64748b' }}
          />
        </Tooltip>
        <Tooltip title={isActive ? 'Pause Store' : 'Resume Store'}>
          <Button
            type={isActive ? 'text' : 'primary'}
            size="small"
            icon={isActive ? <Pause size={14} /> : <Play size={14} />}
            onClick={() => handleToggleStatus(seller._id)}
            danger={!isActive}
            style={{
              borderRadius: '6px',
              borderColor: isActive ? undefined : '#10b981',
              backgroundColor: isActive ? undefined : '#10b981',
              color: isActive ? '#64748b' : '#fff',
            }}
          />
        </Tooltip>
        {hasPermission('sellers_delete') && (
          <Tooltip title="Delete Store">
            <Button
              type="text"
              size="small"
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

  // Column definitions for Ant Design Table
  const columns = useMemo(() => [
    {
      title: 'STORE DETAILS',
      dataIndex: 'name',
      key: 'name',
      width: 280,
      render: (_, seller) => {
        if (seller?.isGroupHeader) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {getMarketplaceBadge(seller.marketplace)}
              <Text type="secondary" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.02em' }}>
                {seller.count} STORES
              </Text>
            </div>
          );
        }
        return (
          <div className="d-flex align-items-center gap-2">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: getStoreGradient(seller.name || ''),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 10,
                letterSpacing: '0.05em',
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
              }}
            >
              {seller.name?.slice(0, 3).toUpperCase() || 'SEL'}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <Text strong style={{ fontSize: '12.5px', color: '#1e293b' }}>{seller.name}</Text>
              {seller.sellerId && (
                <div style={{ marginTop: 1 }}>
                  <Text style={{ fontSize: 9, fontFamily: 'monospace', background: '#f1f5f9', padding: '1px 4px', borderRadius: 4, color: '#64748b' }}>
                    {seller.sellerId}
                  </Text>
                </div>
              )}
            </div>
          </div>
        );
      },
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'ACCOUNT MANAGER',
      dataIndex: 'managers',
      key: 'managers',
      width: 220,
      render: (managers, record) => {
        if (record?.isGroupHeader) return null;
        if (!managers?.length) {
          return <Text type="secondary" italic style={{ fontSize: 10 }}>Unassigned</Text>;
        }
        return (
          <Space wrap size={2}>
            {managers.map((m) => (
              <span key={m._id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f8fafc', padding: '2px 6px', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                <Avatar
                  size={18}
                  style={{
                    backgroundColor: '#e2e8f0',
                    color: '#334155',
                    fontSize: 9,
                    fontWeight: 700,
                  }}
                >
                  {m.firstName?.charAt(0)}{m.lastName?.charAt(0)}
                </Avatar>
                <Text style={{ fontSize: 10.5, color: '#475569' }}>{m.firstName} {m.lastName}</Text>
              </span>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'INVENTORY',
      dataIndex: 'totalAsins',
      key: 'totalAsins',
      width: 140,
      render: (total, seller) => {
        if (seller?.isGroupHeader) return null;
        return (
          <Button
            type="link"
            onClick={() => handleViewAsins(seller)}
            style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b', height: 'auto' }}
          >
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Package size={14} color="#64748b" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
              <Text strong style={{ fontSize: '11.5px' }}>{total || 0} Total</Text>
              <div style={{ fontSize: 9, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{
                  width: 5,
                  height: 5,
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
      title: 'LAST ACTIVITY',
      dataIndex: 'lastScraped',
      key: 'lastScraped',
      width: 150,
      render: (lastScraped, record) => {
        if (record?.isGroupHeader) return null;
        return (
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} style={{ color: '#94a3b8' }} />
              {formatTimeAgo(lastScraped)}
            </div>
            {lastScraped && (
              <div style={{ fontSize: 9, color: '#94a3b8', paddingLeft: 15 }}>
                {new Date(lastScraped).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      width: 100,
      render: (status, record) => {
        if (record?.isGroupHeader) return null;
        return getStatusBadge(status);
      },
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      fixed: 'right',
      width: 120,
      align: 'right',
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
    <div style={{ margin: '-1.5rem -2rem', display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100%' }}>
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
          <LoadingIndicator type="line-simple" size="md" />
        </div>
      )}

      {/* Integrated Header Dashboard View */}
      <div style={{ 
        padding: '16px 24px', 
        background: '#ffffff', 
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <Space size={4} style={{ color: '#94a3b8', fontSize: 11, marginBottom: 2 }}>
            <Text style={{ color: '#94a3b8' }}>Global</Text>
            <ChevronRight size={10} />
            <Text strong style={{ color: '#64748b' }}>Sellers</Text>
          </Space>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Title level={4} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a' }}>
              Seller Management
            </Title>
            <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, border: 'none', margin: 0, background: '#eff6ff', color: '#1d4ed8' }}>
              {totalResults} Stores
            </Tag>
          </div>
        </div>

        {/* Action belt */}
        <Space size={8} wrap>
          {isGlobalUser && (
            <Space size={8}>
              <Button
                onClick={() => setShowPoolModal(true)}
                icon={<LayoutGrid size={13} />}
                size="middle"
                style={{ fontWeight: 600, fontSize: 12, borderRadius: 8 }}
              >
                Octoparse Pool ({poolStats.available})
              </Button>
              <Button
                onClick={handleIngestAll}
                loading={loading}
                icon={<RefreshCw size={13} />}
                size="middle"
                style={{ fontWeight: 600, fontSize: 12, borderRadius: 8 }}
              >
                Fetch Latest
              </Button>
            </Space>
          )}
          {!isBrandManager && (
            <Space size={8}>
              <Button
                type="default"
                icon={<Upload size={13} />}
                onClick={() => {
                  setBulkImportConfig({ sellerId: '', tab: 'catalog' });
                  setShowBulkImportModal(true);
                }}
                size="middle"
                style={{ fontWeight: 600, fontSize: 12, borderRadius: 8 }}
              >
                Bulk Import
              </Button>
              <Button
                icon={<FileUp size={13} />}
                onClick={() => setShowImportModal(true)}
                size="middle"
                style={{ fontWeight: 600, fontSize: 12, borderRadius: 8 }}
              >
                CSV
              </Button>
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={() => setShowAddModal(true)}
                size="middle"
                style={{ 
                  background: '#0f172a', 
                  borderColor: '#0f172a', 
                  fontWeight: 700, 
                  fontSize: 12,
                  borderRadius: 8,
                  boxShadow: '0 2px 4px rgba(15, 23, 42, 0.1)'
                }}
              >
                Add Store
              </Button>
            </Space>
          )}
        </Space>
      </div>

      {/* Consolidated High-Density Filters Belt */}
      <div style={{ 
        padding: '10px 24px', 
        background: '#fcfcfd', 
        borderBottom: '1px solid #f1f5f9', 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: 12, 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <Space wrap size={12}>
          <Segmented
            size="middle"
            options={[
              { label: 'All Stores', value: 'all' },
              { label: 'Active', value: 'Active' },
              { label: 'Paused', value: 'Paused' },
            ]}
            value={activeTab}
            onChange={(value) => {
              setActiveTab(value);
              setStatusFilter('all');
            }}
            style={{ fontWeight: 600, borderRadius: 8, padding: 2 }}
          />
          <Select
            value={marketplaceFilter}
            onChange={setMarketplaceFilter}
            style={{ width: 150 }}
            size="middle"
            options={[
              { label: 'All Markets', value: 'all' },
              ...(canAccessAmazon ? [{ label: 'Amazon.in', value: 'amazon.in' }] : []),
              ...(canAccessAjio ? [{ label: 'Ajio', value: 'ajio' }] : []),
              ...(canAccessMyntra ? [{ label: 'Myntra', value: 'myntra' }] : []),
            ]}
          />
          {/* Inline stats tracker & reset - entirely removing the standalone black cache bar */}
          <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 12, height: 16, display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 10.5, fontWeight: 500, color: '#94a3b8' }}>
              Cache: <strong style={{ color: '#475569' }}>{sellers.length}</strong> records | <strong style={{ color: '#475569' }}>{totalResults}</strong> total
            </Text>
            {(activeTab !== 'all' || marketplaceFilter !== 'all' || searchQuery) && (
              <>
                <Divider orientation="vertical" />
                <Button 
                  type="link" 
                  size="small" 
                  style={{ fontSize: 10, padding: 0, height: 'auto', color: '#ef4444', fontWeight: 600 }}
                  onClick={() => {
                    setActiveTab('all');
                    setMarketplaceFilter('all');
                    setStatusFilter('all');
                    setSearchQuery('');
                  }}
                >
                  Reset
                </Button>
              </>
            )}
          </div>
        </Space>
        <Space size={12}>
          <Input
            placeholder="Search storefronts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
            style={{ width: 240, borderRadius: 8 }}
            allowClear
            size="middle"
          />
          <Tooltip title="Force synchronization reload">
            <Button 
              size="middle" 
              icon={<RefreshCw size={13} />} 
              onClick={() => loadSellers()}
              style={{ borderRadius: 8 }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Bulk Action Bar */}
      {selectedSellerIds.length > 0 && (
        <div style={{
          padding: '8px 24px',
          background: '#0f172a',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'slideDown 0.2s ease-out'
        }}>
          <Text strong style={{ color: '#fff', fontSize: 11 }}>
            <Badge count={selectedSellerIds.length} overflowCount={999} style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', fontWeight: 800 }} /> Storefronts Selected
          </Text>
          <Space size={8}>
            <Button
              size="small"
              type="primary"
              icon={<RefreshCw size={12} />}
              onClick={handleBulkSync}
              loading={loading}
              style={{ borderRadius: 6, fontWeight: 600, background: '#2563eb', borderColor: '#2563eb' }}
            >
              Sync Selected
            </Button>
            <Button size="small" type="text" onClick={() => setSelectedSellerIds([])} style={{ color: '#cbd5e1', fontSize: 11 }}>
              Clear
            </Button>
          </Space>
        </div>
      )}

      {/* Primary Data Body */}
      <div style={{ padding: '20px 24px', flex: 1, background: '#fafafa' }}>
        <Card variant="borderless" styles={{ body: { padding: 0 } }} style={{ borderRadius: 12, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <Table
            columns={columns}
            dataSource={groupedDataSource}
            rowKey="_id"
            loading={loading}
            rowSelection={rowSelection}
            size="middle"
            className="premium-seller-table"
            pagination={{
              current: page,
              pageSize: limit + (groupedDataSource.length - paginatedSellers.length),
              total: totalResults + (groupedDataSource.length - paginatedSellers.length),
              showSizeChanger: true,
              pageSizeOptions: ['25', '50', '100'],
              onChange: (page, pageSize) => {
                setPage(page);
                setLimit(pageSize);
              },
              showTotal: (total, range) => (
                <Text type="secondary" style={{ fontSize: 11, paddingLeft: 16 }}>
                  Viewing {range[0]}-{range[1]} of {total} items
                </Text>
              ),
            }}
            scroll={{ x: 1000 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <span style={{ fontWeight: 600, color: '#94a3b8', fontSize: 12 }}>
                      No storefront entries match your current query.
                    </span>
                  }
                />
              ),
            }}
            onRow={(record) => {
              if (record.isGroupHeader) {
                return {
                  style: { background: '#f8fafc', fontWeight: 700 },
                };
              }
              return {};
            }}
          />
        </Card>
      </div>

      <style>{`
        .premium-seller-table .ant-table-thead > tr > th { 
          background: #fafafa !important; 
          font-size: 10px !important; 
          color: #8c8c8c !important; 
          font-weight: 800 !important; 
          letter-spacing: 0.1em !important; 
          padding: 14px 16px !important; 
          border-bottom: 1px solid #f0f0f0 !important;
        }
        .premium-seller-table .ant-table-row:hover > td { background: #fdfdfd !important; }
        .premium-seller-table .ant-table-cell { padding: 12px 16px !important; border-bottom: 1px solid #f0f0f0 !important; }
        .premium-seller-table .ant-table-pagination { margin: 16px !important; }
        @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

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
          onComplete={loadSellers}
          initialSellerId={bulkImportConfig.sellerId}
          initialTab={bulkImportConfig.tab}
        />
      </Suspense>
    </div>
  );
};

export default React.memo(SellersPage);