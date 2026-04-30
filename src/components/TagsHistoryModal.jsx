import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, History, User, Clock, Info, PlusCircle, MinusCircle, AlertCircle, Loader2, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { asinApi } from '../services/api';

const TagsHistoryModal = ({ isOpen, onClose, asinId, asinCode }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [summary, setSummary] = useState(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen && asinId) {
      fetchHistory(1);
      fetchSummary();
    }
  }, [isOpen, asinId]);

  const fetchHistory = async (page) => {
    setLoading(true);
    try {
      const res = await asinApi.getTagsHistory(asinId, page, pagination.limit);
      if (res.success) {
        setHistory(res.data.history);
        setPagination({
          ...pagination,
          page: res.data.pagination.page,
          total: res.data.pagination.total
        });
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await asinApi.getTagsSummary(asinId);
      if (res.success) {
        setSummary(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-4 ${isClosing ? 'fade-out' : 'fade-in'}`}
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 10000 }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <style>{`
        .fade-in { animation: modalFadeIn 0.25s ease-out; }
        .fade-out { animation: modalFadeOut 0.2s ease-in forwards; }
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes modalFadeOut { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.95) translateY(10px); } }
        
        .history-table th { 
          background: #f8fafc; 
          font-size: 11px; 
          font-weight: 700; 
          color: #64748b; 
          text-transform: uppercase; 
          letter-spacing: 0.05em;
          padding: 12px 16px;
          border-bottom: 2px solid #f1f5f9;
        }
        .history-table td { 
          padding: 16px; 
          vertical-align: middle;
          border-bottom: 1px solid #f1f5f9;
        }
        .tag-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .tag-added { 
          background-color: #10b981; 
          color: #ffffff; 
          border: none; 
        }
        .tag-removed { 
          background-color: #ef4444; 
          color: #ffffff; 
          border: none; 
          text-decoration: line-through; 
          opacity: 0.9; 
        }
        .current-tag-badge {
          background-color: #6366f1;
          color: #ffffff;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
        }
      `}</style>

      <div
        className="bg-white shadow-2xl overflow-hidden"
        style={{
          width: '100%', maxWidth: '850px', maxHeight: '90vh', borderRadius: '24px', display: 'flex', flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-bottom bg-white d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shadow-sm">
              <History size={20} />
            </div>
            <div>
              <h5 className="mb-0 fw-bold text-slate-900">Tags Audit Trail</h5>
              <p className="small text-muted mb-0">History for ASIN: <span className="fw-bold text-slate-700">{asinCode}</span></p>
            </div>
          </div>
          <button onClick={handleClose} className="btn btn-light rounded-circle p-2 border-0 hover:bg-slate-100 transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto" style={{ flex: 1 }}>
          {/* Summary Cards */}
          {summary && (
            <div className="row g-3 mb-4">
              <div className="col-md-8">
                <div className="p-3 bg-slate-50 border rounded-2xl h-100">
                  <span className="text-uppercase tracking-wider text-slate-400 fw-bold" style={{ fontSize: '10px' }}>Current Tags</span>
                  <div className="mt-2 d-flex flex-wrap gap-2">
                    {summary.currentTags?.length > 0 ? (
                      summary.currentTags.map(t => (
                        <span key={t} className="current-tag-badge d-flex align-items-center gap-1.5">
                          <Tag size={10} className="opacity-70" />
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic small">No tags assigned</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="p-3 bg-indigo-600 text-white border rounded-2xl h-100 text-center">
                  <span className="text-uppercase tracking-wider opacity-80 fw-bold" style={{ fontSize: '10px' }}>Total Changes</span>
                  <div className="h3 mb-0 fw-bold mt-1">{summary.totalChanges}</div>
                </div>
              </div>
            </div>
          )}

          {/* History Table */}
          <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
            <table className="table mb-0 history-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Date & User</th>
                  <th style={{ width: '15%' }}>Action</th>
                  <th style={{ width: '45%' }}>Changes</th>
                  <th style={{ width: '15%' }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5">
                      <Loader2 className="animate-spin text-indigo-500 mx-auto" size={32} />
                      <p className="mt-2 text-slate-400 small">Loading history...</p>
                    </td>
                  </tr>
                ) : history.length > 0 ? (
                  history.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <div className="d-flex flex-column">
                          <span className="fw-bold text-slate-700" style={{ fontSize: '12px' }}>
                            <Clock size={12} className="me-1 text-slate-400" />
                            {format(new Date(record.createdAt), 'dd MMM yyyy, HH:mm')}
                          </span>
                          <span className="text-slate-400" style={{ fontSize: '11px' }}>
                            <User size={12} className="me-1" />
                            {record.userName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge rounded-pill text-uppercase px-2 py-1`} style={{ 
                          fontSize: '9px',
                          backgroundColor: record.action === 'add' ? '#ecfdf5' : record.action === 'remove' ? '#fef2f2' : '#eff6ff',
                          color: record.action === 'add' ? '#059669' : record.action === 'remove' ? '#dc2626' : '#2563eb',
                          border: `1px solid ${record.action === 'add' ? '#a7f3d0' : record.action === 'remove' ? '#fecaca' : '#bfdbfe'}`
                        }}>
                          {record.action}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          {record.removedTags?.map(tag => (
                            <span key={`rem-${tag}`} className="tag-badge tag-removed">
                              <MinusCircle size={10} /> {tag}
                            </span>
                          ))}
                          {record.addedTags?.map(tag => (
                            <span key={`add-${tag}`} className="tag-badge tag-added">
                              <PlusCircle size={10} /> {tag}
                            </span>
                          ))}
                          {record.addedTags?.length === 0 && record.removedTags?.length === 0 && (
                            <span className="text-slate-300 italic small">No visible tag changes</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-500 border rounded-pill px-2" style={{ fontSize: '9px' }}>
                          {record.source?.toUpperCase() || 'MANUAL'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="text-center py-5">
                      <div className="text-slate-300 mb-2"><History size={48} /></div>
                      <p className="text-slate-400 small">No audit logs found for this ASIN</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="d-flex justify-content-end mt-4 gap-2">
              <button 
                className="btn btn-sm border bg-white text-slate-600 px-3"
                disabled={pagination.page === 1 || loading}
                onClick={() => fetchHistory(pagination.page - 1)}
              >
                Previous
              </button>
              <div className="d-flex align-items-center px-3 small text-slate-400">
                Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
              </div>
              <button 
                className="btn btn-sm border bg-white text-slate-600 px-3"
                disabled={pagination.page * pagination.limit >= pagination.total || loading}
                onClick={() => fetchHistory(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          )}

          {/* Info Banner */}
          <div className="mt-5 p-3 rounded-2xl d-flex gap-3" style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}>
            <AlertCircle size={20} className="text-amber-500 flex-shrink-0" />
            <p className="mb-0 text-amber-800 small" style={{ lineHeight: 1.5 }}>
              <strong>Permanent Audit Trail:</strong> These logs are immutable and cannot be modified or deleted. 
              All changes, including bulk uploads and automated system updates, are tracked with user attribution.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TagsHistoryModal;
