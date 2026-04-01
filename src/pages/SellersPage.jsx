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
  Scan
} from 'lucide-react';
import { PageLoader } from '@/components/application/loading-indicator/PageLoader';
import { LoadingIndicator } from '@/components/application/loading-indicator/loading-indicator';

const SellersPage = () => {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAsinModal, setShowAsinModal] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [sellerAsins, setSellerAsins] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [currentUser] = useState(() => authApi.getCurrentUser());
  const [showPoolModal, setShowPoolModal] = useState(false);
  const [poolStats, setPoolStats] = useState({ total: 0, assigned: 0, available: 0 });
  const [editingSeller, setEditingSeller] = useState(null);
  const [showEditAsinModal, setShowEditAsinModal] = useState(false);
  const [editingAsin, setEditingAsin] = useState(null);
  const isAdmin = currentUser?.role?.name === 'admin' || currentUser?.role === 'admin';

  useEffect(() => {
    loadSellers();
    if (isAdmin) {
      fetchPoolStats();
    }
  }, []);

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
    try {
      const response = await sellerApi.getAll();
      if (response && response.data && Array.isArray(response.data.sellers)) {
        setSellers(response.data.sellers);
      } else if (response && Array.isArray(response.sellers)) {
        setSellers(response.sellers);
      } else if (Array.isArray(response)) {
        setSellers(response);
      } else {
        setSellers([]);
      }
    } catch (error) {
      console.error('Failed to load sellers:', error);
    }
    setLoading(false);
  };

  const filteredSellers = useMemo(() => {
    if (!Array.isArray(sellers)) return [];
    if (activeTab === 'all') return sellers;
    return sellers.filter(s => s.status && s.status.toLowerCase() === activeTab);
  }, [sellers, activeTab]);


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
      alert('Failed to save seller: ' + error.message);
    }
  };

  const handleEditSeller = (seller) => {
    setEditingSeller(seller);
    setShowAddModal(true);
  };

  const handleImportSellers = async (csvData) => {
    try {
      const lines = csvData.split('\n').filter(l => l.trim());
      const newSellers = [];
      lines.forEach((line, idx) => {
        if (idx === 0) return; // Skip header
        const [name, marketplace, sellerId, apiKey] = line.split(',').map(s => s.trim());
        if (name && marketplace && sellerId) {
          newSellers.push({
            name,
            marketplace,
            sellerId,
            apiKey: apiKey || '',
            plan: 'Starter',
            scrapeLimit: 100,
            totalAsins: 0,
            activeAsins: 0,
            status: 'Active',
          });
        }
      });

      if (newSellers.length > 0) {
        await sellerApi.import(newSellers);
        await loadSellers();
        setShowImportModal(false);
      }
    } catch (error) {
      alert('Failed to import sellers: ' + error.message);
    }
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
      alert('Failed to update seller: ' + error.message);
    }
  };

  const handleDeleteSeller = async (sellerId) => {
    if (window.confirm('Are you sure you want to delete this seller? All ASINs will also be deleted.')) {
      try {
        await sellerApi.delete(sellerId);
        await loadSellers();
      } catch (error) {
        alert('Failed to delete seller: ' + error.message);
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
      const asins = await asinApi.getBySeller(selectedSeller._id);
      setSellerAsins(asins);
      await loadSellers();
    } catch (error) {
      alert('Failed to add ASIN: ' + error.message);
    }
  };

  const handleDeleteAsin = async (asinId) => {
    try {
      await asinApi.delete(asinId);
      const asins = await asinApi.getBySeller(selectedSeller._id);
      setSellerAsins(asins);
      await loadSellers();
    } catch (error) {
      alert('Failed to delete ASIN: ' + error.message);
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
      alert('Failed to toggle ASIN status: ' + error.message);
    }
  };

  const handleSyncAsin = async (asinId) => {
    try {
      await marketSyncApi.syncAsin(asinId);
      alert('Individual ASIN sync triggered! Data will refresh shortly.');
    } catch (error) {
      alert('Sync failed: ' + error.message);
    }
  };

  const handleUpdateAsin = async (asinId, data) => {
    try {
      await asinApi.update(asinId, data);
      const asins = await asinApi.getBySeller(selectedSeller._id);
      setSellerAsins(asins);
      await loadSellers();
    } catch (error) {
      alert('Failed to update ASIN: ' + error.message);
    }
  };

  const handleFullSync = async (sellerId) => {
    if (window.confirm('⚠️ Full Refresh: This will re-inject ALL ASINs and perform a complete re-scrape. This counts toward your daily limit. Continue?')) {
      setLoading(true);
      try {
        const response = await marketSyncApi.syncSellerAsins(sellerId, true);
        if (response.success) {
          alert('Full Sync successfully triggered! Background monitoring started.');
        }
      } catch (error) {
        alert('Full sync failed: ' + error.message);
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
          alert(`Success! Task ${response.taskId} created and linked.`);
          await loadSellers();
        }
      } catch (error) {
        alert('Failed to setup auto-sync: ' + error.message);
      }
      setLoading(false);
    }
  };

  const handleIngestAll = async () => {
    if (window.confirm('This will immediately check all Octoparse tasks for new results and ingest them into MongoDB. Continue?')) {
      setLoading(true);
      try {
        await marketSyncApi.ingestAllResults();
        alert('Global ingestion started in the background. Metrics will update shortly.');
      } catch (error) {
        alert('Failed to start global ingestion: ' + error.message);
      }
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const isActive = status === 'Active';
    return (
      <span
        className={`px-2 py-1 rounded-pill d-inline-flex align-items-center gap-1 small fw-bold ${isActive ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}
        style={{ fontSize: '11px' }}
      >
        <span className={`rounded-circle ${isActive ? 'bg-success' : 'bg-secondary'}`} style={{ width: '6px', height: '6px' }}></span>
        {status}
      </span>
    );
  };

  const getMarketplaceBadge = (marketplace) => {
    const isIN = marketplace === 'amazon.in';
    return (
      <span
        className={`px-2 py-1 rounded-pill small fw-bold d-inline-block ${isIN ? 'bg-primary-subtle text-primary border border-primary-subtle' : 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'}`}
        style={{ fontSize: '10px', textTransform: 'uppercase' }}
      >
        {marketplace}
      </span>
    );
  };

  const getHealthIndicator = (seller) => {
    const usage = (seller.scrapeUsed || 0) / (seller.scrapeLimit || 100);
    let color = '#22c55e'; // Green
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
        <div style={{ position: 'relative', width: '24px', height: '24px' }}>
          <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
            <circle cx="18" cy="18" r="16" fill="none" stroke="#f3f4f6" strokeWidth="4" />
            <circle
              cx="18" cy="18" r="16" fill="none"
              stroke={color} strokeWidth="4"
              strokeDasharray={`${Math.min(usage * 100, 100)}, 100`}
            />
          </svg>
        </div>
        <span className="smallest fw-bold text-muted text-uppercase" style={{ fontSize: '9px' }}>{status}</span>
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

        {/* Tabs and Search */}
        <div className="d-flex justify-content-between align-items-center mb-4 px-1">
          <div className="nav-pills-container bg-zinc-50 p-1 rounded-pill shadow-sm d-inline-flex border border-zinc-200">
            {['all', 'active', 'paused'].map(tab => (
              <button
                key={tab}
                className={`btn btn-sm px-4 rounded-pill border-0 transition-all fw-bold ${activeTab === tab ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-500'}`}
                style={activeTab === tab ? { backgroundColor: '#18181B' } : {}}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <div className="position-relative">
            <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" size={16} />
            <input
              type="text"
              className="form-control form-control-sm ps-5 bg-white border shadow-sm rounded-3"
              placeholder="Search sellers..."
              style={{ width: '280px', height: '40px' }}
            />
          </div>
        </div>
        <div className="card-body p-0">
          <ListView
            columns={[
              {
                label: 'Store Details',
                key: 'name',
                width: '25%',
                render: (_, seller) => (
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="seller-avatar d-flex align-items-center justify-content-center fw-bold shadow-sm"
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    >
                      {seller.name.charAt(0)}
                    </div>
                    <div>
                      <div className="fw-bold text-dark smallest">{seller.name}</div>
                      <div className="smallest text-muted d-flex align-items-center gap-1" style={{ fontSize: '10px' }}>
                        <span className="font-monospace">{seller.sellerId}</span>
                        <span className="opacity-50">•</span>
                        <span>{seller.plan}</span>
                      </div>
                    </div>
                  </div>
                )
              },
              {
                label: 'Manager',
                key: 'managers',
                width: '15%',
                render: (managers) => (
                  <div className="d-flex flex-column gap-1">
                    {managers?.length > 0 ? (
                      managers.map((m) => (
                        <div key={m._id} className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle border border-white shadow-sm d-flex align-items-center justify-content-center bg-light text-primary smallest fw-bold"
                            style={{ width: '18px', height: '18px', flexShrink: 0, fontSize: '9px' }}
                          >
                            {m.firstName.charAt(0)}
                          </div>
                          <span className="smallest text-dark fw-medium" style={{ fontSize: '10px' }}>
                            {m.firstName} {m.lastName[0]}.
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-muted smallest opacity-50 italic">None</span>
                    )}
                  </div>
                )
              },
              {
                label: 'Health',
                key: 'health',
                width: '10%',
                render: (_, seller) => getHealthIndicator(seller)
              },
              {
                label: 'Resources',
                key: 'totalAsins',
                width: '12%',
                render: (total, seller) => (
                  <div className="d-flex align-items-center gap-2 cursor-pointer" onClick={() => handleViewAsins(seller)}>
                    <Package size={12} className="text-muted" />
                    <div>
                      <div className="fw-bold text-dark smallest">{total || 0} ASINs</div>
                      <div className="text-muted smallest" style={{ fontSize: '9px' }}>{seller.activeAsins || 0} Live</div>
                    </div>
                  </div>
                )
              },
              {
                label: 'Consumption',
                key: 'scrapeUsed',
                width: '18%',
                render: (used, seller) => {
                  const limit = seller.scrapeLimit || 100;
                  const ratio = used / limit;
                  return (
                    <div className="d-flex flex-column gap-1">
                      <ProgressBar
                        value={ratio * 100}
                        label="Daily Scrape"
                        hint
                        color={ratio > 0.8 ? 'danger' : ratio > 0.5 ? 'warning' : 'primary'}
                        size="xs"
                      />
                      <div className="smallest text-muted d-flex align-items-center gap-1 mt-1" style={{ fontSize: '9px' }}>
                        <Clock size={10} />
                        <span>{seller.lastScraped ? new Date(seller.lastScraped).toLocaleDateString() : 'No Scrape'}</span>
                      </div>
                    </div>
                  );
                }
              },
              {
                label: 'Status',
                key: 'status',
                width: '10%',
                render: (status) => getStatusBadge(status)
              }
            ]}
            rows={filteredSellers}
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
              <>
                {isAdmin && (
                  <>
                    <button 
                      className="btn btn-icon btn-white border shadow-sm btn-sm text-primary" 
                      onClick={() => handleSetupAutoSync(seller._id)} 
                      title="Auto-Setup Sync"
                      disabled={seller.marketSyncTaskId}
                    >
                      <Wand2 size={12} className={seller.marketSyncTaskId ? 'text-muted' : 'text-primary'} />
                    </button>
                    <button 
                      className={`btn btn-icon border shadow-sm btn-sm ${seller.marketSyncTaskId ? 'btn-white text-info' : 'btn-white text-muted opacity-50'}`} 
                      onClick={() => seller.marketSyncTaskId && handleFullSync(seller._id)} 
                      title={seller.marketSyncTaskId ? "Force Full Refresh (All ASINs)" : "No task linked"}
                      disabled={!seller.marketSyncTaskId}
                    >
                      <RefreshCw size={12} />
                    </button>
                    <button 
                      className="btn btn-icon btn-white border shadow-sm btn-sm text-primary-emphasis" 
                      onClick={() => handleEditSeller(seller)} 
                      title="Edit Store"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button 
                      className="btn btn-icon btn-white border shadow-sm btn-sm text-danger" 
                      onClick={() => handleDeleteSeller(seller._id)} 
                      title="Delete Store"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
                <button className="btn btn-icon btn-white border shadow-sm btn-sm" onClick={() => handleViewAsins(seller)} title="Inventory">
                  <LayoutGrid size={12} />
                </button>
                <button
                  className={`btn btn-icon border shadow-sm btn-sm ${seller.status === 'Active' ? 'btn-white' : 'btn-soft-success'}`}
                  onClick={() => handleToggleStatus(seller._id)}
                  title={seller.status === 'Active' ? 'Pause' : 'Start'}
                >
                  {seller.status === 'Active' ? <Pause size={12} /> : <Play size={12} />}
                </button>
              </>
            )}
            emptyState={{
              icon: Store,
              title: 'No sellers yet',
              description: 'Add your first Amazon seller account to start tracking performance.',
              action: { label: 'Add Seller', onClick: () => setShowAddModal(true) }
            }}
          />
        </div>
      </div>

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
    apiKey: initialData?.apiKey || '',
    plan: initialData?.plan || 'Starter',
    scrapeLimit: initialData?.scrapeLimit || 100,
    managerId: initialData?.managers?.[0]?._id || '',
  });
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    if (isAdmin) {
      userApi.getManagers()
        .then(data => setManagers(data))
        .catch(() => setManagers([]));
    }
  }, [isAdmin]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const { managerId, ...rest } = formData;
    const payload = { ...rest };
    if (isAdmin && managerId) payload.managerId = managerId;
    onSave(payload);
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(17, 24, 39, 0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '20px' }}>
          <div className="modal-header border-0 px-4 pt-4 pb-0">
            <h5 className="h5 fw-bold mb-0 text-zinc-900 d-flex align-items-center gap-2">
              <div className="p-2 bg-zinc-100 text-zinc-900 rounded-3 border border-zinc-200">
                <Plus size={20} />
              </div>
              Add New Seller
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body px-4 py-4">
              <div className="mb-4">
                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Seller Store Name</label>
                <input
                  type="text"
                  className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                  placeholder="e.g. Retail King"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ borderRadius: '12px' }}
                />
              </div>
              <div className="row">
                <div className="col-md-6 mb-4">
                  <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Marketplace</label>
                  <select
                    className="form-select form-control-lg bg-light border-0 px-3 fs-6"
                    value={formData.marketplace}
                    disabled={true}
                    style={{ borderRadius: '12px', cursor: 'not-allowed' }}
                  >
                    <option value="amazon.in">Amazon India (IN)</option>
                  </select>
                </div>
                <div className="col-md-6 mb-4">
                  <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Seller ID</label>
                  <input
                    type="text"
                    className="form-control form-control-lg bg-light border-0 px-3 fs-6 font-monospace"
                    value={formData.sellerId}
                    onChange={(e) => setFormData({ ...formData, sellerId: e.target.value })}
                    placeholder="A1B2C3D4E5"
                    required
                    style={{ borderRadius: '12px' }}
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="mb-4">
                  <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Assign Manager</label>
                  <select
                    className="form-select form-control-lg bg-light border-0 px-3 fs-6"
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    style={{ borderRadius: '12px' }}
                  >
                    <option value="">— No manager assigned —</option>
                    {managers.map(m => (
                      <option key={m._id} value={m._id}>
                        {m.firstName} {m.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label className="form-label smallest fw-bold text-muted text-uppercase mb-2">Octoparse API Key</label>
                <input
                  type="password"
                  className="form-control form-control-lg bg-light border-0 px-3 fs-6"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Enter API key"
                  style={{ borderRadius: '12px' }}
                />
              </div>
            </div>
            <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
              <button type="button" className="btn btn-white fw-bold px-4 border border-zinc-200 rounded-pill" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-zinc-900 fw-bold px-4 rounded-pill shadow-sm" style={{ backgroundColor: '#18181B', color: '#fff' }}>
                Create Store
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
  const [csvData, setCsvData] = useState('');

  const handleImport = () => {
    if (csvData.trim()) {
      onImport(csvData);
    }
  };

  const downloadTemplate = () => {
    const template = `Seller Name,Marketplace,Seller ID,API Key
TechGear Pro,amazon.in,A1B2C3D4E5F6,oct_xxx123
HomeEssentials,amazon.com,A2B3C4D5E6F7,oct_xxx456`;
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sellers_import_template.csv';
    a.click();
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header border-0 px-4 pt-4 pb-0">
            <h5 className="h5 fw-bold mb-0 text-zinc-900 d-flex align-items-center gap-2">
              <div className="p-2 bg-zinc-100 text-zinc-900 rounded-3 border border-zinc-200">
                <FileUp size={20} />
              </div>
              Import Sellers
            </h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body">
            <div className="alert alert-info mb-3">
              <i className="bi bi-info-circle me-2"></i>
              Upload a CSV file with columns: Name, Marketplace, Seller ID, API Key
            </div>
            <div className="mb-3">
              <button className="btn btn-white btn-sm shadow-sm border border-zinc-200 d-flex align-items-center gap-2 rounded-pill px-3" onClick={downloadTemplate}>
                <Plus size={14} className="text-zinc-500" />
                <span className="fw-bold text-zinc-700">Download Template</span>
              </button>
            </div>
            <div className="mb-3">
              <label className="form-label">Paste CSV Data</label>
              <textarea
                className="form-control"
                rows="8"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                placeholder="Seller Name,Marketplace,Seller ID,API Key&#10;TechGear Pro,amazon.in,A1B2C3D4E5F6,oct_xxx123&#10;HomeEssentials,amazon.com,A2B3C4D5E6F7,oct_xxx456"
              ></textarea>
            </div>
          </div>
          <div className="modal-footer border-0 px-4 pb-4 pt-0 gap-2">
            <button type="button" className="btn btn-white fw-bold px-4 border border-zinc-200 rounded-pill" onClick={onClose}>Cancel</button>
            <button className="btn btn-zinc-900 fw-bold px-4 rounded-pill shadow-sm d-flex align-items-center gap-2" onClick={handleImport} disabled={!csvData.trim()} style={{ backgroundColor: '#18181B', color: '#fff' }}>
              <ShieldCheck size={16} />
              Import Data
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
        alert(result.message || 'Success');
        if (onRefresh) await onRefresh();
      } catch (error) {
        alert('Failed to process JSON: ' + error.message);
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
      await asinApi.createBulk(asinsPayload);

      // Refresh list correctly without window reload
      if (onRefresh) {
        await onRefresh();
      }

      alert(`Successfully added ${asinList.length} ASIN(s)`);
      setNewAsinsText('');
      setShowAddAsinModal(false);

    } catch (error) {
      alert('Failed to add ASINs: ' + error.message);
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
                  onChange={e => setFormData({...formData, asinCode: e.target.value})}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label smallest fw-bold uppercase text-muted">SKU (Internal ID)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={formData.sku} 
                  onChange={e => setFormData({...formData, sku: e.target.value})}
                />
              </div>
              <div className="mb-3">
                <label className="form-label smallest fw-bold uppercase text-muted">Operational Status</label>
                <select 
                  className="form-select" 
                  value={formData.status}
                  onChange={e => setFormData({...formData, status: e.target.value})}
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
                              {asin.currentPrice && asin.mrp ? Math.round((1 - asin.currentPrice/asin.mrp) * 100) : 0}% Off
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
  const [taskIdsText, setTaskIdsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpload = async () => {
    const ids = taskIdsText.split(/[\n,]+/).map(id => id.trim()).filter(id => id.length > 0);
    if (ids.length === 0) return;

    setIsSubmitting(true);
    try {
      const response = await marketSyncApi.uploadPoolTasks(ids);
      if (response.success) {
        alert(response.message);
        setTaskIdsText('');
        onRefresh();
      }
    } catch (error) {
      alert('Upload failed: ' + error.message);
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
