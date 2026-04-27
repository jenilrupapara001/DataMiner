import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import {
  Package, X, RefreshCw, FileJson, Plus, Database,
  CheckCircle2, PauseCircle, Eye, Edit3, Trash2,
  CheckSquare, Square, Trash, AlertCircle, Loader2,
  FileUp, FileSpreadsheet
} from 'lucide-react';
import { asinApi, marketSyncApi } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import ProgressBar from '../common/ProgressBar';

const AddBulkAsinModal = lazy(() => import('./AddBulkAsinModal'));
const EditAsinModal = lazy(() => import('./EditAsinModal'));
const AsinDetailsModal = lazy(() => import('./AsinDetailsModal'));

const SellerAsinsModal = ({
  seller,
  asins,
  onClose,
  onAddAsin,
  onDeleteAsin,
  onToggleStatus,
  onUpdateAsin,
  onSyncAsin,
  isAdmin,
  isGlobalUser,
  onRefresh,
  pagination = { page: 1, limit: 50, total: 0, totalPages: 0 },
  onLoadMore,
  loading
}) => {
  const { addToast } = useToast();
  const [showAddAsinModal, setShowAddAsinModal] = useState(false);
  const [showEditAsinModal, setShowEditAsinModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingAsin, setEditingAsin] = useState(null);
  const [detailedAsin, setDetailedAsin] = useState(null);
  const [newAsinsText, setNewAsinsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);

  // Selection Logic
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.size === asins.length && asins.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(asins.map(a => a._id)));
    }
  };

  const toggleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected ASINs? This action will permanently remove all associated historical data.`)) {
      return;
    }

    setIsBulkDeleting(true);
    setIsSubmitting(true);
    setSubmitProgress(30);

    try {
      const result = await asinApi.bulkDelete(Array.from(selectedIds));
      setSubmitProgress(100);

      addToast({
        title: 'Bulk Action Success',
        message: result.message || `Successfully deleted ${selectedIds.size} selected items.`,
        type: 'success'
      });

      setSelectedIds(new Set());
      if (onRefresh) await onRefresh();
    } catch (error) {
      addToast({
        title: 'Bulk Action Failed',
        message: error.message,
        type: 'error'
      });
    } finally {
      setIsBulkDeleting(false);
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!isValidExtension) {
      addToast({
        title: 'Invalid File',
        message: 'Please upload a CSV or Excel file (.csv, .xlsx, .xls)',
        type: 'error'
      });
      return;
    }

    let pInterval;
    setIsSubmitting(true);
    setSubmitProgress(10);

    pInterval = setInterval(() => {
      setSubmitProgress(prev => Math.min(prev + 5, 90));
    }, 400);

    try {
      const result = await asinApi.importCsv(file, seller._id);
      setSubmitProgress(100);

      addToast({
        title: 'Catalog Sync Success',
        message: result.message || 'Catalog processed successfully.',
        type: 'success'
      });

      if (onRefresh) await onRefresh();
    } catch (error) {
      addToast({
        title: 'Import Failed',
        message: error.message || 'Failed to process file',
        type: 'error'
      });
    } finally {
      if (pInterval) clearInterval(pInterval);
      setIsSubmitting(false);
      setSubmitProgress(0);
      e.target.value = '';
    }
  };

  const handleOctoparseUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      addToast({
        title: 'Invalid File',
        message: 'Please upload a JSON file.',
        type: 'error'
      });
      return;
    }

    let pInterval;
    setIsSubmitting(true);
    setSubmitProgress(10);

    pInterval = setInterval(() => {
      setSubmitProgress(prev => Math.min(prev + 5, 90));
    }, 400);

    try {
      const result = await marketSyncApi.uploadOctoparseJson(file, seller._id);
      setSubmitProgress(100);

      addToast({
        title: 'Octoparse Data Ingested',
        message: result.message || 'JSON data processed successfully.',
        type: 'success'
      });

      if (onRefresh) await onRefresh();
    } catch (error) {
      addToast({
        title: 'Upload Failed',
        message: error.message || 'Failed to process JSON file',
        type: 'error'
      });
    } finally {
      if (pInterval) clearInterval(pInterval);
      setIsSubmitting(false);
      setSubmitProgress(0);
      e.target.value = '';
    }
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

    let sInterval;
    setIsSubmitting(true);
    setSubmitProgress(10);

    try {
      const asinList = newAsinsText.split(/[,\s\n]+/).map(a => a.trim().toUpperCase()).filter(a => a.length > 0);
      const asinsPayload = asinList.map(code => ({
        asinCode: code,
        seller: seller._id,
        status: 'Active'
      }));

      setSubmitProgress(20);
      sInterval = setInterval(() => {
        setSubmitProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const result = await asinApi.createBulk(asinsPayload);
      setSubmitProgress(100);

      if (onRefresh) await onRefresh();

      if (result.duplicatesCount > 0) {
        addToast({
          title: 'Partial Success',
          message: `${result.insertedCount} added. ${result.duplicatesCount} skipped.`,
          type: 'warning',
          duration: 10000
        });
      } else {
        addToast({
          title: 'Success',
          message: `Successfully added ${result.insertedCount} ASIN(s).`,
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
      if (sInterval) clearInterval(sInterval);
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(9, 9, 11, 0.7)', backdropFilter: 'blur(16px)', zIndex: 1060 }}>
      <div className="modal-dialog modal-xl modal-dialog-centered" style={{ maxWidth: '1200px' }}>
        <div className="modal-content border-0 shadow-2xl rounded-4 overflow-hidden" style={{ background: '#fff', maxHeight: '92vh', transition: 'all 0.3s ease' }}>

          {/* Enhanced Header */}
          <div className="modal-header border-0 px-4 pt-4 pb-3 d-flex align-items-center justify-content-between bg-white sticky-top" style={{ zIndex: 1070 }}>
            <div className="d-flex align-items-center gap-3">
              <div className="p-2 bg-zinc-900 text-white rounded-3 shadow-lg">
                <Package size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h5 className="modal-title text-zinc-900 fw-black mb-0" style={{ fontSize: '18px', letterSpacing: '-0.02em' }}>
                  ASIN Inventory — {seller.name}
                </h5>
                <div className="d-flex align-items-center gap-2 mt-1">
                  <span className="badge bg-zinc-100 text-zinc-500 rounded-pill px-2 border border-zinc-200 smallest fw-bold uppercase">{seller.marketplace}</span>
                  <span className="text-zinc-400 smaller fw-medium">{pagination.total} Total ASINs Tracked</span>
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn-white-icon border border-zinc-200 shadow-sm hover-bg-zinc-100 transition-colors"
                onClick={onRefresh}
                title="Refresh List"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button type="button" className="btn-white-icon border border-zinc-200 shadow-sm hover-bg-zinc-100 transition-colors" onClick={onClose}>
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="modal-body p-0 d-flex flex-column" style={{ overflow: 'hidden' }}>
            {/* Bulk Action Bar (Sticky) */}
            {selectedIds.size > 0 && isAdmin && (
              <div className="px-4 py-3 bg-zinc-900 text-white d-flex align-items-center justify-content-between sticky-top animate-in fade-in slide-in-from-top-4 duration-300" style={{ zIndex: 1065 }}>
                <div className="d-flex align-items-center gap-3">
                  <div className="d-flex align-items-center justify-content-center bg-zinc-800 text-white rounded-2 px-2 py-1 smallest fw-bold font-monospace">
                    {selectedIds.size} Selected
                  </div>
                  <span className="smaller fw-medium text-zinc-400">Perform bulk actions on the selected ASIN records</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-danger d-flex align-items-center gap-2 px-3 fw-bold smallest rounded-pill transition-all hover-scale"
                    onClick={handleBulkDelete}
                    disabled={isBulkDeleting}
                  >
                    {isBulkDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash size={14} />}
                    DELETE SELECTED
                  </button>
                  <button
                    className="btn btn-sm btn-outline-light d-flex align-items-center gap-2 px-3 fw-bold smallest rounded-pill opacity-60 hover-opacity-100 transition-all border-0"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    CLEAR
                  </button>
                </div>
              </div>
            )}

            {isSubmitting && (
              <div className="px-4 py-2 bg-zinc-50 border-bottom border-zinc-100">
                <ProgressBar value={submitProgress} label="Processing operation..." size="xs" color="primary" />
              </div>
            )}

            <div className="px-1 py-4 flex-grow-1 overflow-auto bg-white">
              <div className="px-3">
                <div className="d-flex justify-content-between align-items-center mb-4 px-2">
                  <div className="d-flex align-items-center gap-2">
                    <div className="p-1 px-2 bg-blue-50 text-blue-600 rounded-pill border border-blue-100 smallest fw-bold uppercase tracking-widest">
                      Catalog View
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {/* Catalog Management Group */}
                    <div className="d-flex align-items-center bg-zinc-100/50 p-1 rounded-pill border border-zinc-200">
                      <input type="file" id="catalogUpload" hidden accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
                      <button
                        className="btn btn-white btn-sm border-0 shadow-none d-flex align-items-center gap-2 px-3 rounded-pill hover-bg-white transition-all"
                        onClick={() => document.getElementById('catalogUpload').click()}
                        disabled={isSubmitting}
                        style={{ height: '32px', fontSize: '10px' }}
                        title="Upload CSV/Excel with ASIN and SKU columns"
                      >
                        <FileSpreadsheet size={13} className="text-zinc-500" />
                        <span className="fw-black uppercase tracking-wider">Bulk ASIN/SKU Sync</span>
                      </button>
                    </div>

                    {/* Market Data Group */}
                    <div className="d-flex align-items-center bg-zinc-100/50 p-1 rounded-pill border border-zinc-200">
                      <input type="file" id="octoparseUpload" hidden accept=".json" onChange={handleOctoparseUpload} />
                      <button
                        className="btn btn-white btn-sm border-0 shadow-none d-flex align-items-center gap-2 px-3 rounded-pill hover-bg-white transition-all"
                        onClick={() => document.getElementById('octoparseUpload').click()}
                        disabled={isSubmitting}
                        style={{ height: '32px', fontSize: '10px' }}
                        title="Upload Octoparse JSON results (Price, Rank, etc.)"
                      >
                        <FileJson size={13} className="text-zinc-500" />
                        <span className="fw-black uppercase tracking-wider">Data Ingest</span>
                      </button>
                    </div>

                    <div className="vr mx-1 opacity-10"></div>

                    <button
                      className="btn btn-zinc-900 btn-sm shadow-lg d-flex align-items-center gap-2 px-4 rounded-pill hover-scale transition-all"
                      onClick={() => setShowAddAsinModal(true)}
                      style={{ height: '34px', fontSize: '11px', background: '#18181B', color: '#fff' }}
                    >
                      <Plus size={14} />
                      <span className="fw-black uppercase tracking-wider">Add ASIN(s)</span>
                    </button>
                  </div>
                </div>

                <div className="table-responsive border border-zinc-100 rounded-4 overflow-hidden shadow-sm">
                  <table className="table data-table mb-0 align-middle">
                    <thead className="sticky-top bg-zinc-50/80" style={{ zIndex: 10, top: '-1px', backdropFilter: 'blur(8px)' }}>
                      <tr className="border-bottom border-zinc-100">
                        {isAdmin && (
                          <th className="py-3 px-3 text-start" style={{ width: '40px' }}>
                            <button className="btn btn-link p-0 text-zinc-400 hover-text-zinc-900 shadow-none" onClick={toggleSelectAll}>
                              {(selectedIds.size === asins.length && asins.length > 0) ? <CheckSquare size={18} className="text-zinc-900" /> : <Square size={18} />}
                            </button>
                          </th>
                        )}
                        <th className="py-3 text-zinc-400 smallest fw-black uppercase tracking-widest text-start" style={{ fontSize: '10px' }}>Identifier</th>
                        <th className="py-3 text-zinc-400 smallest fw-black uppercase tracking-widest text-start" style={{ fontSize: '10px' }}>Identity & Specs</th>
                        <th className="py-3 text-zinc-400 smallest fw-black uppercase tracking-widest text-start" style={{ fontSize: '10px' }}>Commercials</th>
                        <th className="py-3 text-zinc-400 smallest fw-black uppercase tracking-widest text-start" style={{ fontSize: '10px' }}>Inventory</th>
                        <th className="py-3 text-zinc-400 smallest fw-black uppercase tracking-widest text-start" style={{ fontSize: '10px' }}>Status</th>
                        <th className="py-3 text-zinc-400 smallest fw-black uppercase tracking-widest text-end pe-4" style={{ fontSize: '10px' }}>Control</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asins.length === 0 && !loading ? (
                        <tr>
                          <td colSpan={isAdmin ? "7" : "6"} className="text-center py-5 bg-zinc-50/30">
                            <div className="d-flex flex-column align-items-center opacity-40">
                              <Database size={48} strokeWidth={1.5} className="mb-3 text-zinc-300" />
                              <span className="fw-bold text-zinc-500 uppercase tracking-widest smaller">No ASINs tracked for this store yet</span>
                              <p className="smallest text-zinc-400 mt-2">Start by adding your product catalog manually or via JSON.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <>
                          {asins.map(asin => (
                            <tr key={asin._id} className={`border-bottom border-zinc-50 hover-bg-zinc-50 transition-all ${selectedIds.has(asin._id) ? 'bg-zinc-50/80 shadow-inner' : ''}`}>
                              {isAdmin && (
                                <td className="py-3 px-3">
                                  <button className="btn btn-link p-0 text-zinc-300 hover-text-zinc-600 shadow-none transition-colors" onClick={() => toggleSelectOne(asin._id)}>
                                    {selectedIds.has(asin._id) ? <CheckSquare size={18} className="text-zinc-900" /> : <Square size={18} />}
                                  </button>
                                </td>
                              )}
                              <td className="py-3">
                                <div className="d-flex flex-column">
                                  <span className="fw-black text-zinc-900 font-monospace tracking-tight" style={{ fontSize: '12px' }}>{asin.asinCode}</span>
                                  {asin.lastScraped && (
                                    <span className="text-zinc-400 smallest mt-0.5" style={{ fontSize: '9px' }}>Synced {new Date(asin.lastScraped).toLocaleDateString()}</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="d-flex flex-column gap-0.5">
                                  <span className="fw-bold text-zinc-800 tracking-tight" style={{ fontSize: '11px' }}>{asin.sku || 'UNASSIGNED-SKU'}</span>
                                  <span className="text-zinc-400 truncate opacity-80" style={{ maxWidth: '280px', fontSize: '10px' }}>{asin.title || 'Loading title from marketplace...'}</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className="d-flex flex-column gap-0.5">
                                  <div className="d-flex align-items-center gap-1.5">
                                    <span className="fw-black text-zinc-900" style={{ fontSize: '11px' }}>₹{asin.currentPrice?.toLocaleString() || '0'}</span>
                                    {asin.buyBoxWin && (
                                      <span className="badge bg-zinc-900 text-white rounded-pill px-1.5 py-0.5 smallest" style={{ fontSize: '8px' }}>WINNER</span>
                                    )}
                                  </div>
                                  <span className="text-zinc-400 smallest fw-medium opacity-80 uppercase font-monospace">Rank: #{asin.bsr || 'N/A'}</span>
                                </div>
                              </td>
                              <td className="py-3">
                                <div className={`d-inline-flex px-2 py-0.5 rounded-pill fw-black smallest border ${asin.stockLevel > 20 ? 'bg-zinc-50 text-zinc-700 border-zinc-200' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                  {asin.stockLevel || 0}
                                </div>
                              </td>
                              <td className="py-3">
                                <button
                                  className={`btn btn-sm p-0 border-0 d-flex align-items-center gap-1.5 transition-all ${asin.status === 'Active' ? 'text-zinc-900' : 'text-zinc-300'}`}
                                  onClick={() => onToggleStatus(asin._id, asin.status)}
                                >
                                  {asin.status === 'Active' ? <CheckCircle2 size={15} /> : <PauseCircle size={15} />}
                                  <span className="fw-black uppercase tracking-widest" style={{ fontSize: '9px' }}>{asin.status}</span>
                                </button>
                              </td>
                              <td className="py-3 pe-4">
                                <div className="d-flex gap-1 justify-content-end">
                                  <button onClick={() => handleViewDetails(asin)} className="btn-white-icon smaller border-zinc-200 shadow-sm hover-scale transition-all" title="Details">
                                    <Eye size={13} />
                                  </button>
                                  <button onClick={() => onSyncAsin(asin._id)} className="btn-white-icon smaller border-zinc-200 shadow-sm hover-scale transition-all" title="Sync">
                                    <RefreshCw size={13} />
                                  </button>
                                  <button onClick={() => handleEditAsin(asin)} className="btn-white-icon smaller border-zinc-200 shadow-sm hover-scale transition-all" title="Modify">
                                    <Edit3 size={13} />
                                  </button>
                                  {isAdmin && (
                                    <button onClick={() => onDeleteAsin(asin._id)} className="btn-white-icon smaller border-zinc-200 text-danger shadow-sm hover-scale transition-all" title="Delete">
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {pagination.page < pagination.totalPages && (
                  <div className="py-4 d-flex justify-content-center">
                    <button
                      className="btn btn-white border-zinc-200 px-5 rounded-pill fw-black smallest text-zinc-900 shadow-sm hover-bg-zinc-50 transition-all uppercase tracking-widest"
                      onClick={onLoadMore}
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="d-flex align-items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          <span>FETCHING DATA...</span>
                        </div>
                      ) : (
                        <span>Load More ({pagination.total - asins.length} remaining)</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer border-0 px-4 py-3 bg-zinc-50/50 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2 text-zinc-400 smaller fw-medium">
              <AlertCircle size={14} />
              <span>Select multiple records to perform batch operations</span>
            </div>
            <button className="btn btn-zinc-900 fw-black px-5 border-0 rounded-pill shadow-lg transition-all hover-scale" onClick={onClose} style={{ fontSize: '12px', background: '#18181B', color: '#fff' }}>CLOSE PANEL</button>
          </div>
        </div>
      </div>

      <Suspense fallback={null}>
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

        {showDetailsModal && detailedAsin && (
          <AsinDetailsModal
            asin={detailedAsin}
            onClose={() => { setShowDetailsModal(false); setDetailedAsin(null); }}
          />
        )}
      </Suspense>

      <style>{`
        .hover-scale:hover {
          transform: translateY(-1px) scale(1.02);
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .data-table tr.hover-bg-zinc-50:hover {
          background-color: #fafafa !important;
        }
      `}</style>
    </div>
  );
};

export default React.memo(SellerAsinsModal);



