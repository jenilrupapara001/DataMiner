// pages/SellersPage.tsx — complete fixed version with optimistic updates

import React, {
  useState, useEffect, useMemo, useCallback,
  useRef, Suspense, lazy
} from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { sellerApi, asinApi, marketSyncApi } from '../services/api';
import {
  Table, Button, Input, Segmented, Select, Space,
  Tag, Typography, Tooltip, Avatar, Empty,
  Divider, Badge, Card, Popconfirm
} from 'antd';
import {
  Package, Search, Plus, FileUp, Upload,
  Clock, Trash2, Play, Pause, LayoutGrid,
  RefreshCw, Edit3, ChevronRight
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

// ─── Pure helpers ─────────────────────────────────────────────────────────────

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
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [syncingIds, setSyncingIds] = useState(new Set());

  // Stable toast ref
  const toastRef = useRef(addToast);
  useEffect(() => { toastRef.current = addToast; });

  const debouncedSearch = useDebounce(searchQuery, 500);

  const canAccessAmazon = isAdmin || hasPermission('marketplace_amazon');
  const canAccessAjio = isAdmin || hasPermission('marketplace_ajio');
  const canAccessMyntra = isAdmin || hasPermission('marketplace_myntra');

  // Init marketplace filter once
  const marketplaceInitRef = useRef(false);
  useEffect(() => {
    if (marketplaceInitRef.current) return;
    marketplaceInitRef.current = true;
    if (!canAccessAmazon && canAccessAjio) setMarketplaceFilter('ajio');
    else if (canAccessAmazon && !canAccessAjio) setMarketplaceFilter('amazon.in');
  }, []); // eslint-disable-line

  // ── Core fetch (stable — never changes) ────────────────────────────────
  const loadSellers = useCallback(async (params = {}) => {
    const {
      page: p = 1, limit: l = 50,
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

      let list = [];
      let total = 0;

      if (response?.success && response?.data) {
        list = response.data.sellers || (Array.isArray(response.data) ? response.data : []);
        total = response.data.pagination?.total ?? response.data.total ?? list.length;
      } else if (Array.isArray(response?.sellers)) {
        list = response.sellers;
        total = response.total ?? list.length;
      } else if (Array.isArray(response)) {
        list = response;
        total = list.length;
      } else if (Array.isArray(response?.data)) {
        list = response.data;
        total = list.length;
      }

      setSellers(list);
      setTotalItems(total);
    } catch (error) {
      toastRef.current('Network error: Could not connect to data service', 'error');
      setSellers([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []); // stable forever

  // Trigger on filter change
  useEffect(() => {
    setPage(1);
    void loadSellers({ page: 1, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch });
  }, [activeTab, marketplaceFilter, statusFilter, debouncedSearch, loadSellers]);

  // Trigger on page/limit change only (skip initial render — already handled above)
  const isFirstPageRender = useRef(true);
  useEffect(() => {
    if (isFirstPageRender.current) { isFirstPageRender.current = false; return; }
    void loadSellers({ page, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch });
  }, [page, limit]); // eslint-disable-line

  // Socket: silent refresh via ref
  const loadSellersRef = useRef(loadSellers);
  useEffect(() => { loadSellersRef.current = loadSellers; });

  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      void loadSellersRef.current({
        page, limit, activeTab, marketplaceFilter, statusFilter,
        search: debouncedSearch, silent: true
      });
    };
    socket.on('SELLERS_UPDATED', handler);
    return () => socket.off('SELLERS_UPDATED', handler);
  }, [socket]); // socket only

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

  useEffect(() => {
    setSelectedSellerIds([]);
  }, [page, activeTab, marketplaceFilter, debouncedSearch]);

  // ── OPTIMISTIC: Toggle status (instant — no refetch) ──────────────────
  const handleToggleStatus = useCallback(async (sellerId) => {
    const seller = sellers.find(s => s._id === sellerId);
    if (!seller) return;
    const newStatus = seller.status === 'Active' ? 'Paused' : 'Active';

    // ① Instant UI
    setSellers(prev => prev.map(s =>
      s._id === sellerId ? { ...s, status: newStatus, _saving: true } : s
    ));
    try {
      await sellerApi.update(sellerId, { status: newStatus });
      // ② Confirm
      setSellers(prev => prev.map(s =>
        s._id === sellerId ? { ...s, _saving: false } : s
      ));
    } catch {
      // ③ Rollback
      setSellers(prev => prev.map(s =>
        s._id === sellerId ? { ...s, status: seller.status, _saving: false } : s
      ));
      toastRef.current('Failed to update status', 'error');
    }
  }, [sellers]);

  // ── OPTIMISTIC: Delete seller (instant — no refetch) ──────────────────
  const handleDeleteSeller = useCallback(async (sellerId) => {
    const snapshot = sellers.find(s => s._id === sellerId);
    // ① Remove instantly
    setSellers(prev => prev.filter(s => s._id !== sellerId));
    setTotalItems(prev => prev - 1);
    try {
      await sellerApi.delete(sellerId);
      toastRef.current('Seller deleted.', 'success');
    } catch (error) {
      // ② Rollback
      if (snapshot) setSellers(prev => [snapshot, ...prev]);
      setTotalItems(prev => prev + 1);
      toastRef.current('Failed to delete: ' + error.message, 'error');
    }
  }, [sellers]);

  // ── OPTIMISTIC: Add / Edit seller ─────────────────────────────────────
  const handleAddSeller = useCallback(async (sellerData) => {
    try {
      if (editingSeller) {
        // ① Patch locally right away
        setSellers(prev => prev.map(s =>
          s._id === editingSeller._id ? { ...s, ...sellerData, _saving: true } : s
        ));
        await sellerApi.update(editingSeller._id, sellerData);
        // ② Confirm
        setSellers(prev => prev.map(s =>
          s._id === editingSeller._id ? { ...s, _saving: false } : s
        ));
        toastRef.current('Seller updated.', 'success');
      } else {
        // For creates: call API, then prepend returned record
        const res = await sellerApi.create(sellerData);
        const newSeller = res?.data || res?.seller || { ...sellerData, _id: `tmp_${Date.now()}` };
        setSellers(prev => [newSeller, ...prev]);
        setTotalItems(prev => prev + 1);
        toastRef.current('Seller added.', 'success');
      }
      setShowAddModal(false);
      setEditingSeller(null);
    } catch (error) {
      // Rollback edit
      if (editingSeller) {
        void loadSellers({ page, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch, silent: true });
      }
      toastRef.current('Failed to save: ' + error.message, 'error');
    }
  }, [editingSeller, page, limit, activeTab, marketplaceFilter, statusFilter, debouncedSearch, loadSellers]);

  const handleEditSeller = useCallback((seller) => {
    setEditingSeller(seller);
    setShowAddModal(true);
  }, []);

  // ── Import sellers (batch add to local state) ─────────────────────────
  const handleImportSellers = useCallback(async (sellersData) => {
    try {
      const response = await sellerApi.import(sellersData);
      if (response.success) {
        toastRef.current(`${sellersData.length} storefronts onboarded.`, 'success');
        // Silent refresh to get server-assigned IDs
        void loadSellers({ page: 1, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch, silent: true });
        setShowImportModal(false);
        return true;
      }
    } catch (error) {
      toastRef.current(error.message || 'Check CSV format and try again.', 'error');
    }
    return false;
  }, [limit, activeTab, marketplaceFilter, statusFilter, debouncedSearch, loadSellers]);

  // ── ASIN management ────────────────────────────────────────────────────
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

  // ASIN mutations — patch seller's asin count locally, no full reload
  const refreshAsinList = useCallback(async (sellerId) => {
    const result = await asinApi.getBySeller(sellerId, { page: 1, limit: 50 });
    setSellerAsins(result.asins || []);
    setAsinPagination(result.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 });
    setSellers(prev => prev.map(s =>
      s._id === sellerId ? { ...s, totalAsins: result.pagination?.total ?? s.totalAsins } : s
    ));
  }, []);

  const handleAddAsin = useCallback(async (asinData) => {
    if (!selectedSeller) return;
    try {
      await asinApi.create({ ...asinData, seller: selectedSeller._id, status: 'Active' });
      toastRef.current(`Added ${asinData.asinCode}.`, 'success');
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
      toastRef.current('ASIN sync triggered!', 'success');
    } catch (error) {
      toastRef.current(error.message, 'error');
    }
  }, []);

  // ── Row-level sync (no global loading flash) ──────────────────────────
  const handleSyncSeller = useCallback(async (sellerId) => {
    setSyncingIds(prev => new Set(prev).add(sellerId));
    try {
      const res = await marketSyncApi.syncSellerAsins(sellerId, false);
      if (res.success) toastRef.current('Sync triggered!', 'success');
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

  // ── Bulk sync ──────────────────────────────────────────────────────────
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const handleBulkSync = useCallback(async () => {
    if (!selectedSellerIds.length) return;
    setBulkSyncing(true);
    let ok = 0, fail = 0;
    try {
      await Promise.all(selectedSellerIds.map(async (id) => {
        try { await marketSyncApi.syncSellerAsins(id, false); ok++; }
        catch { fail++; }
      }));
      toastRef.current(`Synced ${ok}.${fail ? ` ${fail} failed.` : ''}`, fail ? 'warning' : 'success');
      setSelectedSellerIds([]);
    } catch (err) {
      toastRef.current(err.message, 'error');
    } finally {
      setBulkSyncing(false);
    }
  }, [selectedSellerIds]);

  const handleIngestAll = useCallback(async () => {
    setLoading(true);
    try {
      await marketSyncApi.ingestAllResults();
      toastRef.current('Global ingestion started.', 'info');
    } catch (error) {
      toastRef.current(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Badges ─────────────────────────────────────────────────────────────
  const getMarketplaceBadge = useCallback((marketplace) => {
    const m = marketplace?.toLowerCase();
    let color = '#52525b', bg = '#f4f4f5', border = '#e4e4e7', logo = null;
    if (m === 'amazon.in') { color = '#1d4ed8'; bg = '#eff6ff'; border = '#bfdbfe'; logo = 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg'; }
    else if (m === 'ajio') { color = '#6d28d9'; bg = '#f5f3ff'; border = '#ddd6fe'; logo = 'https://cdn.brandfetch.io/id78Xj7CCR/w/820/h/238/theme/dark/logo.png'; }
    else if (m === 'myntra') { color = '#be185d'; bg = '#fdf2f8'; border = '#fbcfe8'; logo = 'https://cdn.brandfetch.io/idDW82Qwj2/theme/dark/logo.svg'; }
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
      fontWeight: 700, textTransform: 'uppercase', fontSize: 10, borderRadius: 6, padding: '0 8px', lineHeight: '18px'
    }}>
      {status?.toUpperCase() || 'UNKNOWN'}
    </Tag>
  ), []);

  // ── Row actions ────────────────────────────────────────────────────────
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
            loading={isSyncing}
            onClick={() => handleSyncSeller(seller._id)}
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
              ...(isActive
                ? { color: '#64748b' }
                : { background: '#10b981', borderColor: '#10b981', color: '#fff' })
            }}
          />
        </Tooltip>
        {hasPermission('sellers_delete') && (
          <Popconfirm
            title="Delete this seller?"
            description="All ASINs will also be permanently deleted."
            onConfirm={() => handleDeleteSeller(seller._id)}
            okText="Delete" cancelText="Cancel"
            okButtonProps={{ danger: true }} placement="left"
          >
            <Tooltip title="Delete Store">
              <Button type="text" size="small" danger
                icon={<Trash2 size={14} />} style={{ color: '#ef4444' }} />
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

  // ── Table columns ──────────────────────────────────────────────────────
  const staticColumns = useMemo(() => [
    {
      title: 'STORE DETAILS', dataIndex: 'name', key: 'name', width: 280,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (_, seller) => {
        if (seller?.isGroupHeader) {
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {getMarketplaceBadge(seller.marketplace)}
              <Text type="secondary" style={{ fontSize: 10, fontWeight: 700 }}>
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
              justifyContent: 'center', fontWeight: 800, fontSize: 10
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
            {managers.map((m) => (
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

  const rowSelection = useMemo(() => ({
    selectedRowKeys: selectedSellerIds,
    onChange: (keys) => setSelectedSellerIds(keys),
    getCheckboxProps: (record) => ({ disabled: record.isGroupHeader, name: record.name }),
  }), [selectedSellerIds]);

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

      {/* ── Header ──────────────────────────────────────────────── */}
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

      {/* ── Filters ──────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 24px', background: '#fcfcfd', borderBottom: '1px solid #f1f5f9',
        display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Space wrap size={12}>
          <Segmented
            size="middle"
            options={[{ label: 'All Stores', value: 'all' }, { label: 'Active', value: 'Active' }, { label: 'Paused', value: 'Paused' }]}
            value={activeTab}
            onChange={(v) => { setActiveTab(v); setStatusFilter('all'); }}
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

      {/* ── Bulk action bar ───────────────────────────────────────── */}
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
              description="This triggers scraping for all ASINs under these sellers."
              onConfirm={handleBulkSync}
              okText="Sync" cancelText="Cancel"
            >
              <Button size="small" type="primary" icon={<RefreshCw size={12} />}
                loading={bulkSyncing}
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

      {/* ── Table ─────────────────────────────────────────────────── */}
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
            onRow={(record) => record.isGroupHeader
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
          onComplete={() => loadSellers({ page, limit, activeTab, marketplaceFilter, statusFilter, search: debouncedSearch, silent: true })}
          initialSellerId={bulkImportConfig.sellerId}
          initialTab={bulkImportConfig.tab}
        />
      </Suspense>
    </div>
  );
};

export default React.memo(SellersPage);