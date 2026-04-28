import React, { useState, useEffect, useCallback } from 'react';
import { X, Download, FileText, FileSpreadsheet, Clock, Check, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { exportApi } from '../../services/api';

const DownloadsDrawer = ({ isOpen, onClose }) => {
    const [downloads, setDownloads] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchDownloads = useCallback(async () => {
        try {
            const res = await exportApi.getDownloads();
            if (res.success) setDownloads(res.data || []);
        } catch (err) {
            console.error('Failed to fetch downloads:', err);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchDownloads().finally(() => setLoading(false));
        }
    }, [isOpen, fetchDownloads]);

    // Auto-refresh for processing items
    useEffect(() => {
        if (!isOpen) return;
        const hasProcessing = downloads.some(d => d.Status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(fetchDownloads, 3000);
        return () => clearInterval(interval);
    }, [isOpen, downloads, fetchDownloads]);

    const handleDownload = async (download) => {
        try {
            const blob = await exportApi.downloadFile(download.Id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = download.FileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download failed:', err);
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'processing': return <RefreshCw size={14} className="spin text-blue-500" />;
            case 'completed': return <Check size={14} className="text-success" />;
            case 'failed': return <AlertCircle size={14} className="text-danger" />;
            default: return <Clock size={14} className="text-zinc-400" />;
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (!isOpen) return null;

    return (
        <div className="position-fixed top-0 end-0 h-100 bg-white border-start shadow-2xl d-flex flex-column"
            style={{ width: '380px', zIndex: 1050, animation: 'slideIn 0.2s ease-out' }}>
            
            {/* Header */}
            <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-zinc-900 text-white">
                <div className="d-flex align-items-center gap-2">
                    <Download size={18} />
                    <span className="fw-bold" style={{ fontSize: '14px' }}>Downloads</span>
                </div>
                <button className="btn btn-ghost p-1 text-white opacity-75" onClick={onClose}>
                    <X size={20} />
                </button>
            </div>

            {/* Downloads List */}
            <div className="flex-grow-1 overflow-auto">
                {loading ? (
                    <div className="d-flex justify-content-center py-5">
                        <RefreshCw size={24} className="spin text-zinc-400" />
                    </div>
                ) : downloads.length === 0 ? (
                    <div className="text-center py-5 px-4">
                        <Download size={40} className="text-zinc-300 mb-3" />
                        <h6 className="text-zinc-500">No downloads yet</h6>
                        <p className="text-zinc-400" style={{ fontSize: '12px' }}>
                            Exported files will appear here
                        </p>
                    </div>
                ) : (
                    <div className="d-flex flex-column">
                        {downloads.map(download => (
                            <div key={download.Id}
                                className="p-3 border-bottom hover-bg-zinc-50 transition-all"
                                style={{ cursor: download.Status === 'completed' ? 'pointer' : 'default' }}
                                onClick={() => download.Status === 'completed' && handleDownload(download)}>
                                
                                <div className="d-flex align-items-start gap-3">
                                    {/* Icon */}
                                    <div className="p-2 rounded-2 flex-shrink-0" style={{
                                        background: download.Format === 'csv' ? '#eff6ff' : '#ecfdf5',
                                        color: download.Format === 'csv' ? '#2563eb' : '#059669'
                                    }}>
                                        {download.Format === 'csv' ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-grow-1 min-w-0">
                                        <div className="d-flex align-items-center gap-2">
                                            <span className="fw-bold text-truncate" style={{ fontSize: '12px' }}>
                                                {download.FileName}
                                            </span>
                                            {getStatusIcon(download.Status)}
                                        </div>
                                        
                                        <div className="mt-1 d-flex align-items-center gap-3" style={{ fontSize: '10px', color: '#71717a' }}>
                                            {download.RowCount && <span>{download.RowCount.toLocaleString()} rows</span>}
                                            {download.FileSize && <span>{formatSize(download.FileSize)}</span>}
                                            <span>{new Date(download.CreatedAt).toLocaleDateString()}</span>
                                        </div>

                                        {/* Progress Bar */}
                                        {download.Status === 'processing' && (
                                            <div className="mt-2">
                                                <div className="progress rounded-pill" style={{ height: '4px' }}>
                                                    <div className="progress-bar bg-primary rounded-pill"
                                                        style={{ width: `${download.Progress || 0}%`, transition: 'width 0.3s ease' }} />
                                                </div>
                                            </div>
                                        )}

                                        {/* Error Message */}
                                        {download.Status === 'failed' && download.ErrorMessage && (
                                            <p className="mt-2 mb-0 text-danger" style={{ fontSize: '10px' }}>
                                                {download.ErrorMessage}
                                            </p>
                                        )}

                                        {/* Status Badge */}
                                        <div className="mt-1">
                                            <span className={`badge ${
                                                download.Status === 'completed' ? 'bg-success-subtle text-success' :
                                                download.Status === 'processing' ? 'bg-primary-subtle text-primary' :
                                                download.Status === 'failed' ? 'bg-danger-subtle text-danger' :
                                                'bg-zinc-100 text-zinc-500'
                                            }`} style={{ fontSize: '9px' }}>
                                                {download.Status.charAt(0).toUpperCase() + download.Status.slice(1)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default DownloadsDrawer;
