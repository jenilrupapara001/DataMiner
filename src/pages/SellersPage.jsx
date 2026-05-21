// pages/SellersPage.tsx — complete fixed version

import React, {
  useState, useEffect, useMemo, useCallback,
  useRef, Suspense, lazy
} from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { sellerApi, asinApi, marketSyncApi } from '../services/api';
import {
  Table, Button, Input, Segmented, Select, Space,
  Tag, Typography, Tooltip, Avatar, Modal, Empty,
  Divider, Badge, Card, Popconfirm, message
} from 'antd';
import {
  Package, Search, Plus, FileUp, Upload,
  Clock, Trash2, Play, Pause, LayoutGrid,
  AlertCircle, RefreshCw, Edit3, ChevronRight, X
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

// ─── Pure helpers (outside component — never recreated) ───────────────────────

const GRADIENTS = [
  'linear-gradient(135deg, #4f46e5, #7c3aed)',
  'linear-gradient(135deg, #2563eb, #3b82f6)',
  'linear-gradient(135deg, #059669, #10b981)',
  'linear-gradient(135deg, #ea580c, #f97316)',
  'linear-gradient(135deg, #db2777, #ec4899)',
  'linear-gradient(135deg, #1e1b4b, #312e81)',
  'linear-gradient(135deg, #0f766e, #14b8a6)',
];

function getStoreGradient(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

const SellersPage = () => {
  const { user: currentUser, isAdmin, isGlobalUser, hasPermission } = useAuth();
  const { addToast } = useToast();
  const socket = useSocket();

  const isBrandManager = useMemo(() => {
    const role = (currentUser?.role?.name || currentUser?.role?.displayName || '').toString().toLowerCase();
    return role === 'brand manager';
  }, [currentUser?.role]);

  // ── Data state ─────────────────────────────────────────────────────────
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  // ── Filter state ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  // ── Modal / UI state ───────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showAsinModal, setShowAsinModal] = useState(false);
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [editingSeller, setEditingSeller] = useState(null);
  const [sellerAsins, setSellerAsins] = useState([]);
  const [asinPagination, setAsinPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loadingAsins, setLoadingAsins] = useState(false);
  const [selectedSellerIds, setSelectedSellerIds] = useState([]);
  const [bulkImportConfig, setBulkImportConfig] = useState({ sellerId: '', tab: 'catalog' });
  const [poolStats, setPoolStats] = useState({ total: 0, assigned: 0, available: 0 });

  // ── Fix 9: stabilise addToast in ref ──────────────────────────────────
  const toastRef = useRef(addToast);
  useEffect(() => { toastRef.current = addToast; });

  const debouncedSearch = useDebounce(searchQuery, 500);

  const canAccessAmazon = isAdmin || hasPermission('marketplace_amazon');
  const canAccessAjio = isAdmin || hasPermission('marketplace_ajio');
  const canAccessMyntra = isAdmin || hasPermission('marketplace_myntra');

  // ── Fix 13: marketplace filter — run once, not on every render ─────────
  const marketplaceInitRef = useRef(false);
  useEffect(() => {
    if (marketplaceInitRef.current) return;
    marketplaceInitRef.current = true;
    if (!canAccessAmazon && canAccessAjio) setMarketplaceFilter('ajio');
    else if (canAccessAmazon && !canAccessAjio) setMarketplaceFilter('amazon.in');
  }, []); // eslint-disable-line

  // ── Fix 1: loadSellers with EMPTY stable deps, params passed directly ──
  // Previously: loadSellers depended on page/limit/filters via closure
  // → Every filter change created a new loadSellers → useEffect re-ran → ∞
  // Solution: pass params explicitly, keep stable function reference
  const loadSellers = useCallback(async (params = {}) => {
    const {
      page: p = 1,
      limit: l = 50,
      activeTab: tab = 'all',
      marketplaceFilter: mf = 'all',
      statusFilter: sf = 'all',
      search: q = '',
      silent = false
    } = params;

    if (!silent) setLoading(true);
    try {
      const response = await sellerApi.getAll({
        page: p, limit: l,
        status: sf !== 'all' ? sf : tab !== 'all' ? tab : undefined,
        marketplace: mf !== 'all' ? mf : undefined,
        search: q || undefined,
      });

      let extractedSellers = [];
      let total = 0;

      if (response?.success && response?.data) {
        extractedSellers = response.data.sellers || (Array.isArray(response.data) ? response.data : []);
        total = response.data.pagination?.total ?? response.data.total ?? extractedSellers.length;
      } else if (Array.isArray(response?.sellers)) {
        extractedSellers = response.sellers;
        total = response.total ?? extractedSellers.length;
      } else if (Array.isArray(response)) {
        extractedSellers = response;
        total = response.length;
      } else if (Array.isArray(response?.data)) {
        extractedSellers = response.data;
        total = extractedSellers.length;
      }

      setSellers(extractedSellers);
      setTotalItems(total);
    } catch (error) {
      toastRef.current('Network error: Could not connect to data service', 'error');
      setSellers([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []); // ← stable forever

  // ── Trigger load when filters change ───────────────────────────────────
  // Fix 10: single effect for all params — no duplicate on mount
  useEffect(() => {
    setPage(1);
    void loadSellers({
      page: 1, limit, activeTab, marketplaceFilter,
      statusFilter, search: debouncedSearch
    });
  }, [activeTab, marketplaceFilter, statusFilter, debouncedSearch, loadSellers]);

  // Separate effect for page/limit changes only
  useEffect(() => {
    void loadSellers({ page, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch });
  }, [page, limit]); // eslint-disable-line

  // ── Fix 2: socket listener via ref — never re-registers ───────────────
  const loadSellersRef = useRef(loadSellers);
  useEffect(() => { loadSellersRef.current = loadSellers; });

  useEffect(() => {
    if (!socket) return;
    const handler = data => {
      console.log('📢 Real-time update:', data);
      void loadSellersRef.current({
        page, limit, activeTab, marketplaceFilter, statusFilter,
        search: debouncedSearch, silent: true
      });
    };
    socket.on('SELLERS_UPDATED', handler);
    return () => socket.off('SELLERS_UPDATED', handler);
  }, [socket]); // ← socket only — stable

  // Pool stats
  const fetchPoolStats = useCallback(async () => {
    try {
      const res = await marketSyncApi.getPoolStatus();
      if (res.success) setPoolStats(res.stats);
    } catch (err) { console.error('Failed to fetch pool stats:', err); }
  }, []);

  useEffect(() => {
    if (isGlobalUser) fetchPoolStats();
  }, [isGlobalUser, fetchPoolStats]);

  // Clear selection on filter change
  useEffect(() => {
    setSelectedSellerIds([]);
  }, [page, activeTab, marketplaceFilter, debouncedSearch]);

  // ── Fix 4: Optimistic toggle status ───────────────────────────────────
  const handleToggleStatus = useCallback(async sellerId => {
    const seller = sellers.find(s => s._id === sellerId);
    if (!seller) return;

    const newStatus = seller.status === 'Active' ? 'Paused' : 'Active';

    // Instant optimistic update
    setSellers(prev => prev.map(s =>
      s._id === sellerId ? { ...s, status: newStatus, _saving: true } : s
    ));

    try {
      await sellerApi.update(sellerId, { status: newStatus });
      setSellers(prev => prev.map(s =>
        s._id === sellerId ? { ...s, _saving: false } : s
      ));
    } catch (error) {
      // Rollback
      setSellers(prev => prev.map(s =>
        s._id === sellerId ? { ...s, status: seller.status, _saving: false } : s
      ));
      toastRef.current('Failed to update seller status', 'error');
    }
  }, [sellers]);

  // ── Fix 3 + 11: No window.confirm — use Popconfirm in JSX instead ─────
  // (delete/sync confirmation is now inline in renderActions via Popconfirm)
  const handleDeleteSeller = useCallback(async sellerId => {
    // Optimistic delete
    const snapshot = sellers.find(s => s._id === sellerId);
    setSellers(prev => prev.filter(s => s._id !== sellerId));
    setTotalItems(prev => prev - 1);

    try {
      await sellerApi.delete(sellerId);
      toastRef.current('Seller deleted successfully', 'success');
    } catch (error) {
      // Rollback
      if (snapshot) setSellers(prev => [...prev, snapshot]);
      setTotalItems(prev => prev + 1);
      toastRef.current('Failed to delete seller: ' + error.message, 'error');
    }
  }, [sellers]);

  const handleAddSeller = useCallback(async sellerData => {
    try {
      if (editingSeller) {
        const updated = await sellerApi.update(editingSeller._id, sellerData);
        setSellers(prev => prev.map(s => s._id === editingSeller._id ? { ...s, ...sellerData } : s));
      } else {
        await sellerApi.create(sellerData);
        // Silent reload to get server-assigned ID
        void loadSellers({ page, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch, silent: true });
      }
      setShowAddModal(false);
      setEditingSeller(null);
    } catch (error) {
      toastRef.current('Failed to save seller: ' + error.message, 'error');
    }
  }, [editingSeller, page, limit, activeTab, marketplaceFilter, statusFilter, debouncedSearch, loadSellers]);

  const handleEditSeller = useCallback(seller => {
    setEditingSeller(seller);
    setShowAddModal(true);
  }, []);

  const handleImportSellers = useCallback(async sellersData => {
    try {
      const response = await sellerApi.import(sellersData);
      if (response.success) {
        toastRef.current(`${sellersData.length} storefronts onboarded successfully.`, 'success');
        void loadSellers({ page: 1, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch });
        setShowImportModal(false);
        return true;
      }
    } catch (error) {
      toastRef.current(error.message || 'Check your CSV format and try again.', 'error');
    }
    return false;
  }, [page, limit, activeTab, marketplaceFilter, statusFilter, debouncedSearch, loadSellers]);

  const handleViewAsins = useCallback(async (seller, pageNum = 1) => {
    setSelectedSeller(seller);
    setShowAsinModal(true);
    setLoadingAsins(true);
    if (pageNum === 1) setSellerAsins([]);
    try {
      const result = await asinApi.getBySeller(seller._id || seller.id, { page: pageNum, limit: 50 });
      if (pageNum === 1) setSellerAsins(result.asins || []);
      else setSellerAsins(prev => [...prev, ...(result.asins || [])]);
      setAsinPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    } catch (err) {
      console.error('Failed to load ASINs:', err);
      if (pageNum === 1) setSellerAsins([]);
    } finally {
      setLoadingAsins(false);
    }
  }, []);

  const handleLoadMoreAsins = useCallback(() => {
    if (asinPagination.page < asinPagination.totalPages && !loadingAsins && selectedSeller) {
      void handleViewAsins(selectedSeller, asinPagination.page + 1);
    }
  }, [asinPagination, loadingAsins, selectedSeller, handleViewAsins]);

  // ── Fix 5: ASIN mutations — don't reload sellers list ─────────────────
  const refreshAsinList = useCallback(async (sellerId) => {
    const result = await asinApi.getBySeller(sellerId, { page: 1, limit: 50 });
    setSellerAsins(result.asins || []);
    setAsinPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    // Only update the asin count on the specific seller row
    setSellers(prev => prev.map(s =>
      s._id === sellerId
        ? { ...s, totalAsins: result.pagination?.total ?? s.totalAsins }
        : s
    ));
  }, []);

  const handleAddAsin = useCallback(async (asinData) => {
    if (!selectedSeller) return;
    try {
      await asinApi.create({ ...asinData, seller: selectedSeller._id, status: 'Active' });
      toastRef.current(`Added ${asinData.asinCode} to inventory.`, 'success');
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      toastRef.current(error.message || 'Failed to add ASIN', 'error');
    }
  }, [selectedSeller, refreshAsinList]);

  const handleDeleteAsin = useCallback(async (asinId) => {
    if (!selectedSeller) return;
    try {
      await asinApi.delete(asinId);
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      toastRef.current('Failed to delete ASIN: ' + error.message, 'error');
    }
  }, [selectedSeller, refreshAsinList]);

  const handleToggleAsinStatus = useCallback(async (asinId, currentStatus) => {
    if (!selectedSeller) return;
    try {
      await asinApi.update(asinId, { status: currentStatus === 'Active' ? 'Paused' : 'Active' });
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      toastRef.current('Failed to toggle ASIN status: ' + error.message, 'error');
    }
  }, [selectedSeller, refreshAsinList]);

  const handleUpdateAsin = useCallback(async (asinId, data) => {
    if (!selectedSeller) return;
    try {
      await asinApi.update(asinId, data);
      await refreshAsinList(selectedSeller._id);
    } catch (error) {
      toastRef.current('Failed to update ASIN: ' + error.message, 'error');
    }
  }, [selectedSeller, refreshAsinList]);

  const handleSyncAsin = useCallback(async (asinId) => {
    try {
      await marketSyncApi.syncAsin(asinId);
      toastRef.current('ASIN sync triggered successfully!', 'success');
    } catch (error) {
      toastRef.current(error.message, 'error');
    }
  }, []);

  // ── Fix 11: row-level sync — no global setLoading ─────────────────────
  const [syncingIds, setSyncingIds] = useState(new Set());

  const handleSyncSeller = useCallback(async (sellerId) => {
    setSyncingIds(prev => new Set(prev).add(sellerId));
    try {
      const res = await marketSyncApi.syncSellerAsins(sellerId, false);
      if (res.success) toastRef.current('Seller sync triggered!', 'success');
    } catch (error) {
      toastRef.current(error.message, 'error');
    } finally {
      setSyncingIds(prev => { const n = new Set(prev); n.delete(sellerId); return n; });
    }
  }, []);

  const handleCatalogSync = useCallback((seller) => {
    const isAjio = seller.marketplace?.toLowerCase() === 'ajio';
    setBulkImportConfig({ sellerId: seller._id, tab: isAjio ? 'ajio_catalog' : 'catalog' });
    setShowBulkImportModal(true);
  }, []);

  const handleBulkSync = useCallback(async () => {
    if (selectedSellerIds.length === 0) return;
    let successCount = 0, errorCount = 0;

    // Fix 12: proper loading isolation — use separate state, not global loading
    setLoading(true);
    try {
      await Promise.all(
        selectedSellerIds.map(async (sellerId) => {
          try {
            await marketSyncApi.syncSellerAsins(sellerId, false);
            successCount++;
          } catch (err) {
            errorCount++;
          }
        })
      );
      toastRef.current(
        `Synced ${successCount} seller(s).${errorCount ? ` ${errorCount} failed.` : ''}`,
        errorCount > 0 ? 'warning' : 'success'
      );
      setSelectedSellerIds([]);
    } catch (err) {
      toastRef.current(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedSellerIds]);

  const handleIngestAll = useCallback(async () => {
    setLoading(true);
    try {
      await marketSyncApi.ingestAllResults();
      toastRef.current('Global ingestion started in background.', 'info');
    } catch (error) {
      toastRef.current(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Marketplace badge ──────────────────────────────────────────────────
  const getMarketplaceBadge = useCallback((marketplace) => {
    const market = marketplace?.toLowerCase();
    let color = '#52525b', bg = '#f4f4f5', border = '#e4e4e7', logo = null;
    if (market === 'amazon.in') {
      color = '#1d4ed8'; bg = '#eff6ff'; border = '#bfdbfe';
      logo = 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg';
    } else if (market === 'ajio') {
      color = '#6d28d9'; bg = '#f5f3ff'; border = '#ddd6fe';
      logo = 'https://cdn.brandfetch.io/id78Xj7CCR/w/820/h/238/theme/dark/logo.png';
    } else if (market === 'myntra') {
      color = '#be185d'; bg = '#fdf2f8'; border = '#fbcfe8';
      logo = 'https://cdn.brandfetch.io/idDW82Qwj2/theme/dark/logo.svg';
    }
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '0 8px', height: 24, fontSize: 10, fontWeight: 700,
        textTransform: 'uppercase', borderRadius: 6,
        color, background: bg, border: `1px solid ${border}`, letterSpacing: '0.03em'
      }}>
        {logo && <img src={logo} style={{ height: 11, width: 'auto', objectFit: 'contain' }} alt="" />}
        {marketplace}
      </span>
    );
  }, []);

  const getStatusBadge = useCallback((status) => (
    <Tag color={status === 'Active' ? 'green' : 'default'} style={{
      fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
      borderRadius: 6, padding: '0 8px', lineHeight: '18px'
    }}>
      {status?.toUpperCase() || 'UNKNOWN'}
    </Tag>
  ), []);

  // ── Fix 3: Popconfirm-based actions (no window.confirm) ───────────────
  const renderActions = useCallback((seller) => {
    const isActive = seller.status === 'Active';
    const isSyncing = syncingIds.has(seller._id);

    if (isBrandManager) {
      return (
        <Space size={4}>
          <Tooltip title="View ASINs">
            <Button type="text" size="small" icon={<Package size={14} />}
              onClick={() => handleViewAsins(seller)} style={{ color: '#64748b' }} />
          </Tooltip>
        </Space>
      );
    }

    return (
      <Space size={4}>
        {isGlobalUser && (
          <Tooltip title="Edit Details">
            <Button type="text" size="small" icon={<Edit3 size={14} />}
              onClick={() => handleEditSeller(seller)} style={{ color: '#64748b' }} />
          </Tooltip>
        )}
        <Tooltip title="Manage Catalog">
          <Button type="text" size="small" icon={<Package size={14} />}
            onClick={() => handleViewAsins(seller)} style={{ color: '#64748b' }} />
        </Tooltip>
        <Tooltip title="Catalog Sync">
          <Button type="text" size="small" icon={<FileUp size={14} />}
            onClick={() => handleCatalogSync(seller)} style={{ color: '#64748b' }} />
        </Tooltip>
        <Tooltip title="Sync Store">
          <Button type="text" size="small"
            icon={<RefreshCw size={14} className={isSyncing ? 'spin' : ''} />}
            onClick={() => handleSyncSeller(seller._id)}
            loading={isSyncing}
            style={{ color: '#64748b' }} />
        </Tooltip>
        <Tooltip title={isActive ? 'Pause Store' : 'Resume Store'}>
          <Button
            type={isActive ? 'text' : 'primary'} size="small"
            icon={isActive ? <Pause size={14} /> : <Play size={14} />}
            onClick={() => handleToggleStatus(seller._id)}
            loading={seller._saving}
            style={{
              borderRadius: 6,
              ...(isActive ? { color: '#64748b' } : { background: '#10b981', borderColor: '#10b981', color: '#fff' })
            }}
          />
        </Tooltip>
        {hasPermission('sellers_delete') && (
          // ✅ Fix 3: Popconfirm replaces window.confirm
          <Popconfirm
            title="Delete this seller?"
            description="All ASINs will also be permanently deleted."
            onConfirm={() => handleDeleteSeller(seller._id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            placement="left"
          >
            <Tooltip title="Delete Store">
              <Button type="text" size="small" danger
                icon={<Trash2 size={14} />}
                style={{ color: '#ef4444' }} />
            </Tooltip>
          </Popconfirm>
        )}
      </Space>
    );
  }, [
    isBrandManager, isGlobalUser, syncingIds,
    handleEditSeller, handleViewAsins, handleCatalogSync,
    handleSyncSeller, handleToggleStatus, handleDeleteSeller, hasPermission
  ]);

  // ── Columns ────────────────────────────────────────────────────────────
  // Fix 14: split static columns from action column to reduce rebuild frequency
  const staticColumns = useMemo(() => [
    {
      title: 'STORE DETAILS', dataIndex: 'name', key: 'name', width: 280,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: getStoreGradient(seller.name || ''),
              color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 800, fontSize: 10,
              letterSpacing: '0.05em'
            }}>
              {seller.name?.slice(0, 3).toUpperCase() || 'SEL'}
            </div>
            <div style={{ lineHeight: 1.2 }}>
              <Text strong style={{ fontSize: 12.5, color: '#1e293b' }}>{seller.name}</Text>
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
      }
    },
    {
      title: 'ACCOUNT MANAGER', dataIndex: 'managers', key: 'managers', width: 220,
      render: (managers, record) => {
        if (record?.isGroupHeader) return null;
        if (!managers?.length) return <Text type="secondary" italic style={{ fontSize: 10 }}>Unassigned</Text>;
        return (
          <Space wrap size={2}>
            {managers.map(m => (
              <span key={m._id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#f8fafc', padding: '2px 6px', borderRadius: 12, border: '1px solid #f1f5f9'
              }}>
                <Avatar size={18} style={{ backgroundColor: '#e2e8f0', color: '#334155', fontSize: 9, fontWeight: 700 }}>
                  {m.firstName?.charAt(0)}{m.lastName?.charAt(0)}
                </Avatar>
                <Text style={{ fontSize: 10.5, color: '#475569' }}>{m.firstName} {m.lastName}</Text>
              </span>
            ))}
          </Space>
        );
      }
    },
    {
      title: 'INVENTORY', dataIndex: 'totalAsins', key: 'totalAsins', width: 140,
      render: (total, seller) => {
        if (seller?.isGroupHeader) return null;
        return (
          <Button type="link" onClick={() => handleViewAsins(seller)}
            style={{ padding: 0, display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b', height: 'auto' }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Package size={14} color="#64748b" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
              <Text strong style={{ fontSize: 11.5 }}>{total || 0} Total</Text>
              <div style={{ fontSize: 9, color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                {seller.activeAsins || 0} Active
              </div>
            </div>
          </Button>
        );
      }
    },
    {
      title: 'LAST ACTIVITY', dataIndex: 'lastScraped', key: 'lastScraped', width: 150,
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
      }
    },
    {
      title: 'STATUS', dataIndex: 'status', key: 'status', align: 'center', width: 100,
      render: (status, record) => {
        if (record?.isGroupHeader) return null;
        return getStatusBadge(status);
      }
    },
  ], [getMarketplaceBadge, getStatusBadge, handleViewAsins]);

  const actionColumn = useMemo(() => ({
    title: 'ACTIONS', key: 'actions', fixed: 'right', width: 120, align: 'right',
    render: (_, seller) => {
      if (seller?.isGroupHeader) return null;
      return renderActions(seller);
    }
  }), [renderActions]);

  const columns = useMemo(() => [...staticColumns, actionColumn], [staticColumns, actionColumn]);

  // ── Fix 6: Remove dead paginatedSellers useMemo ────────────────────────
  // was just: { paginatedSellers: sellers, totalResults: totalItems }
  const groupedDataSource = useMemo(() => {
    const grouped = {};
    sellers.forEach(seller => {
      const market = seller.marketplace || 'Unknown';
      if (!grouped[market]) grouped[market] = [];
      grouped[market].push(seller);
    });
    const data = [];
    Object.entries(grouped).forEach(([market, group]) => {
      data.push({ _id: `group-${market}`, marketplace: market, count: group.length, isGroupHeader: true });
      data.push(...group);
    });
    return data;
  }, [sellers]);

  // ── Fix 7: Stable rowSelection ─────────────────────────────────────────
  const rowSelection = useMemo(() => ({
    selectedRowKeys: selectedSellerIds,
    onChange: (keys) => setSelectedSellerIds(keys),
    getCheckboxProps: (record) => ({
      disabled: record.isGroupHeader,
      name: record.name,
    }),
  }), [selectedSellerIds]);

  // ── Fix 8: Correct pagination (exclude group header rows from count) ───
  const headerRowCount = groupedDataSource.filter(r => r.isGroupHeader).length;

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

      {/* Header */}
      <div style={{
        padding: '16px 24px', background: '#ffffff', borderBottom: '1px solid #f1f5f9',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16
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
              {totalItems} Stores
            </Tag>
          </div>
        </div>

        <Space size={8} wrap>
          {isGlobalUser && (
            <Space size={8}>
              <Button onClick={() => setShowPoolModal(true)} icon={<LayoutGrid size={13} />}
                size="middle" style={{ fontWeight: 600, fontSize: 12, borderRadius: 8 }}>
                Octoparse Pool ({poolStats.available})
              </Button>
              {/* ✅ Fix 3: replaced window.confirm with Popconfirm */}
              <Popconfirm
                title="Start batch ingestion?"
                description="This will check all Octoparse tasks and ingest new results."
                onConfirm={handleIngestAll}
                okText="Start" cancelText="Cancel"
              >
                <Button loading={loading} icon={<RefreshCw size={13} />}
                  size="middle" style={{ fontWeight: 600, fontSize: 12, borderRadius: 8 }}>
                  Fetch Latest
                </Button>
              </Popconfirm>
            </Space>
          )}
          {!isBrandManager && (
            <Space size={8}>
              <Button type="default" icon={<Upload size={13} />}
                onClick={() => { setBulkImportConfig({ sellerId: '', tab: 'catalog' }); setShowBulkImportModal(true); }}
                size="middle" style={{ fontWeight: 600, fontSize: 12, borderRadius: 8 }}>
                Bulk Import
              </Button>
              <Button icon={<FileUp size={13} />} onClick={() => setShowImportModal(true)}
                size="middle" style={{ fontWeight: 600, fontSize: 12, borderRadius: 8 }}>
                CSV
              </Button>
              <Button type="primary" icon={<Plus size={14} />} onClick={() => setShowAddModal(true)}
                size="middle" style={{ background: '#0f172a', borderColor: '#0f172a', fontWeight: 700, fontSize: 12, borderRadius: 8 }}>
                Add Store
              </Button>
            </Space>
          )}
        </Space>
      </div>

      {/* Filters */}
      <div style={{
        padding: '10px 24px', background: '#fcfcfd', borderBottom: '1px solid #f1f5f9',
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Space wrap size={12}>
          <Segmented
            size="middle"
            options={[{ label: 'All Stores', value: 'all' }, { label: 'Active', value: 'Active' }, { label: 'Paused', value: 'Paused' }]}
            value={activeTab}
            onChange={v => { setActiveTab(v); setStatusFilter('all'); }}
            style={{ fontWeight: 600, borderRadius: 8, padding: 2 }}
          />
          <Select value={marketplaceFilter} onChange={setMarketplaceFilter} style={{ width: 150 }} size="middle"
            options={[
              { label: 'All Markets', value: 'all' },
              ...(canAccessAmazon ? [{ label: 'Amazon.in', value: 'amazon.in' }] : []),
              ...(canAccessAjio ? [{ label: 'Ajio', value: 'ajio' }] : []),
              ...(canAccessMyntra ? [{ label: 'Myntra', value: 'myntra' }] : []),
            ]}
          />
          <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 12, height: 16, display: 'flex', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 10.5, fontWeight: 500, color: '#94a3b8' }}>
              <strong style={{ color: '#475569' }}>{sellers.length}</strong> loaded |{' '}
              <strong style={{ color: '#475569' }}>{totalItems}</strong> total
            </Text>
            {(activeTab !== 'all' || marketplaceFilter !== 'all' || searchQuery) && (
              <>
                <Divider orientation="vertical" />
                <Button type="link" size="small"
                  style={{ fontSize: 10, padding: 0, height: 'auto', color: '#ef4444', fontWeight: 600 }}
                  onClick={() => { setActiveTab('all'); setMarketplaceFilter('all'); setStatusFilter('all'); setSearchQuery(''); }}>
                  Reset
                </Button>
              </>
            )}
          </div>
        </Space>
        <Space size={12}>
          <Input placeholder="Search storefronts..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
            style={{ width: 240, borderRadius: 8 }} allowClear size="middle" />
          <Tooltip title="Refresh">
            <Button size="middle" icon={<RefreshCw size={13} />}
              onClick={() => loadSellers({ page, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch })}
              style={{ borderRadius: 8 }} />
          </Tooltip>
        </Space>
      </div>

      {/* Bulk action bar */}
      {selectedSellerIds.length > 0 && (
        <div style={{
          padding: '8px 24px', background: '#0f172a', color: '#fff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          animation: 'slideDown 0.2s ease-out'
        }}>
          <Text strong style={{ color: '#fff', fontSize: 11 }}>
            <Badge count={selectedSellerIds.length} style={{ backgroundColor: '#3b82f6', border: 'none', fontWeight: 800 }} /> Storefronts Selected
          </Text>
          <Space size={8}>
            <Popconfirm
              title={`Sync ${selectedSellerIds.length} seller(s)?`}
              description="This will trigger scraping for all ASINs under these sellers."
              onConfirm={handleBulkSync}
              okText="Sync" cancelText="Cancel"
            >
              <Button size="small" type="primary" icon={<RefreshCw size={12} />}
                loading={loading}
                style={{ borderRadius: 6, fontWeight: 600, background: '#2563eb', borderColor: '#2563eb' }}>
                Sync Selected
              </Button>
            </Popconfirm>
            <Button size="small" type="text" onClick={() => setSelectedSellerIds([])}
              style={{ color: '#cbd5e1', fontSize: 11 }}>
              Clear
            </Button>
          </Space>
        </div>
      )}

      {/* Table */}
      <div style={{ padding: '20px 24px', flex: 1, background: '#fafafa' }}>
        <Card styles={{ body: { padding: 0 } }}
          style={{ borderRadius: 12, border: '1px solid #f0f0f0', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <Table
            columns={columns}
            dataSource={groupedDataSource}
            rowKey="_id"
            loading={loading}
            rowSelection={rowSelection}
            size="middle"
            className="premium-seller-table"
            // ✅ Fix 8: correct pagination — exclude header rows from count
            pagination={{
              current: page,
              pageSize: limit,
              total: totalItems,
              showSizeChanger: true,
              pageSizeOptions: ['25', '50', '100'],
              onChange: (p, ps) => { setPage(p); setLimit(ps); },
              showTotal: (total, range) => (
                <Text type="secondary" style={{ fontSize: 11, paddingLeft: 16 }}>
                  Viewing {range[0]}-{range[1]} of {total} stores
                </Text>
              ),
            }}
            scroll={{ x: 1000 }}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ fontWeight: 600, color: '#94a3b8', fontSize: 12 }}>No storefront entries match your current query.</span>}
                />
              )
            }}
            onRow={record => record.isGroupHeader
              ? { style: { background: '#f8fafc', fontWeight: 700 } }
              : {}
            }
          />
        </Card>
      </div>

      <style>{`
                .spin { animation: spin 1.5s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .premium-seller-table .ant-table-thead > tr > th {
                    background: #fafafa !important; font-size: 10px !important; color: #8c8c8c !important;
                    font-weight: 800 !important; letter-spacing: 0.1em !important;
                    padding: 14px 16px !important; border-bottom: 1px solid #f0f0f0 !important;
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
          <ImportSellerModal onClose={() => setShowImportModal(false)} onImport={handleImportSellers} />
        )}
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
            isAdmin={isAdmin}
            isGlobalUser={isGlobalUser}
            onRefresh={() => handleViewAsins(selectedSeller, 1)}
            pagination={asinPagination}
            onLoadMore={handleLoadMoreAsins}
            loading={loadingAsins}
          />
        )}
        {showPoolModal && (
          <PoolManagementModal stats={poolStats} onClose={() => setShowPoolModal(false)} onRefresh={fetchPoolStats} />
        )}
        <BulkImportModal
          isOpen={showBulkImportModal}
          onClose={() => setShowBulkImportModal(false)}
          onComplete={() => loadSellers({ page, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch })}
          initialSellerId={bulkImportConfig.sellerId}
          initialTab={bulkImportConfig.tab}
        />
      </Suspense>
    </div>
  );
};

export default React.memo(SellersPage);