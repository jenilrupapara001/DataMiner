import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileDown, FileUp, Store, Check, AlertCircle, RefreshCw, Globe, CheckCircle, Loader2 } from 'lucide-react';
import { sellerApi, bulkApi, asinApi } from '../../services/api';

const BulkImportModal = ({ isOpen, onClose, onComplete }) => {
    const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'tags' | 'global'
    const [sellers, setSellers] = useState([]);
    const [selectedSellerId, setSelectedSellerId] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) fetchSellers();
    }, [isOpen]);

    const fetchSellers = async () => {
        try {
            const response = await sellerApi.getAll({ limit: 500 });
            if (response.success) setSellers(response.data?.sellers || []);
        } catch (err) {
            console.error('Failed to fetch sellers:', err);
        }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult(null);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file');
            return;
        }

        setUploading(true);
        setError(null);
        setResult(null);

        try {
            let response;
            if (activeTab === 'catalog') {
                response = await bulkApi.catalogSync(file, selectedSellerId);
            } else if (activeTab === 'tags') {
                response = await bulkApi.tagsImport(file, selectedSellerId);
            } else if (activeTab === 'global') {
                response = await asinApi.bulkUploadAllSellers(file);
            }

            if (response.success) {
                setResult(response);
                setFile(null);
                onComplete?.();
            } else {
                setError(response.error || 'Upload failed');
            }
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Upload failed');
        }
        setUploading(false);
    };

    const handleDownloadTemplate = async () => {
        try {
            if (activeTab === 'catalog') {
                await bulkApi.downloadCatalogTemplate();
            } else {
                await asinApi.downloadTagsTemplate(selectedSellerId || undefined);
            }
        } catch (err) {
            console.error('Template download failed:', err);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }}>
            
            <div className="bg-white rounded-4 shadow-2xl" style={{ width: '100%', maxWidth: '550px', overflow: 'hidden' }}>
                {/* Header */}
                <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                        <Upload size={20} className="text-zinc-700" />
                        <h6 className="mb-0 fw-bold">Bulk Import</h6>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost p-1 rounded-circle border-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="d-flex border-bottom">
                    <button
                        className={`flex-grow-1 py-2 border-0 bg-transparent fw-bold ${activeTab === 'catalog' ? 'text-zinc-900 border-bottom border-2 border-zinc-900' : 'text-zinc-400'}`}
                        onClick={() => { setActiveTab('catalog'); setFile(null); setResult(null); setError(null); }}
                        style={{ fontSize: '13px' }}
                    >
                        <FileUp size={14} className="me-1" />
                        Catalog Sync
                    </button>
                    <button
                        className={`flex-grow-1 py-2 border-0 bg-transparent fw-bold ${activeTab === 'tags' ? 'text-zinc-900 border-bottom border-2 border-zinc-900' : 'text-zinc-400'}`}
                        onClick={() => { setActiveTab('tags'); setFile(null); setResult(null); setError(null); }}
                        style={{ fontSize: '13px' }}
                    >
                        <FileUp size={14} className="me-1" />
                        Tags Import
                    </button>
                    <button
                        className={`flex-grow-1 py-2 border-0 bg-transparent fw-bold ${activeTab === 'global' ? 'text-zinc-900 border-bottom border-2 border-zinc-900' : 'text-zinc-400'}`}
                        onClick={() => { setActiveTab('global'); setFile(null); setResult(null); setError(null); }}
                        style={{ fontSize: '13px' }}
                    >
                        <Globe size={14} className="me-1" />
                        Global Upload
                    </button>
                </div>

                <div className="p-4">
                    {/* Instructions */}
                    <div className="bg-zinc-50 rounded-3 p-3 mb-3" style={{ fontSize: '12px' }}>
                        {activeTab === 'catalog' ? (
                            <>
                                <strong>Catalog Sync</strong> — Bulk update or create ASINs.
                                <br />Required Columns: <strong>ASIN, Price, SKU, Parent ASIN, Release Date</strong>.
                                <br />Optional: <strong>Brand</strong> column will automatically map ASINs to sellers.
                            </>
                        ) : activeTab === 'tags' ? (
                            <>
                                <strong>Tags Import</strong> — Upload ASIN codes with tags. Tags are matched by <strong>exact ASIN code</strong>.
                                <br />Only existing ASINs in the database will be updated.
                            </>
                        ) : (
                            <>
                                <strong>Global Bulk Upload</strong> — Direct upload with Seller Name mapping.
                                <br />Required Columns: <strong>Seller Name, ASIN, SKU, Parent ASIN, Release Date, Price</strong>.
                            </>
                        )}
                    </div>

                    {/* Seller Selection */}
                    {activeTab !== 'global' && (
                        <div className="mb-3">
                            <label className="fw-bold mb-1" style={{ fontSize: '12px' }}>
                                <Store size={14} className="me-1" />
                                {activeTab === 'catalog' ? 'Target Seller (Optional if file has Brand)' : 'Filter by Seller (optional)'}
                            </label>
                            <select
                                className="form-select"
                                value={selectedSellerId}
                                onChange={(e) => setSelectedSellerId(e.target.value)}
                                style={{ fontSize: '13px', borderRadius: '8px' }}
                            >
                                <option value="">
                                    {activeTab === 'catalog' ? 'Automatic (Mapping from file)' : 'All Sellers'}
                                </option>
                                {sellers.map(s => (
                                    <option key={s.Id || s._id} value={s.Id || s._id}>{s.name} ({s.sellerId})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* File Upload */}
                    <div className="mb-3">
                        <label className="fw-bold mb-1" style={{ fontSize: '12px' }}>
                            {activeTab === 'catalog' ? 'Inventory Catalog File' : activeTab === 'tags' ? 'Tags CSV File' : 'Inventory Manifest CSV'}
                        </label>
                        <div className="border border-dashed rounded-3 p-4 text-center bg-zinc-50"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                const droppedFile = e.dataTransfer.files?.[0];
                                if (droppedFile) {
                                    setFile(droppedFile);
                                    setResult(null);
                                    setError(null);
                                }
                            }}>
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                                id="bulk-file-input"
                            />
                            {file ? (
                                <div className="d-flex align-items-center justify-content-center gap-2">
                                    <Check size={16} className="text-success" />
                                    <span className="fw-bold text-zinc-700" style={{ fontSize: '13px' }}>{file.name}</span>
                                    <button className="btn btn-ghost p-0 text-zinc-400" onClick={() => setFile(null)}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <label htmlFor="bulk-file-input" className="cursor-pointer">
                                    <Upload size={24} className="text-zinc-400 mb-2" />
                                    <p className="text-zinc-500 mb-0" style={{ fontSize: '12px' }}>Click or drag file here</p>
                                    <p className="text-zinc-400 mb-0" style={{ fontSize: '10px' }}>CSV, XLSX, or XLS</p>
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Result Message */}
                    {result && (
                        <div className="rounded-3 p-3 mb-3 text-white shadow-sm" style={{ fontSize: '13px', background: '#10b981', borderLeft: '5px solid #059669', animation: 'fadeIn 0.2s ease-out' }}>
                            <div className="d-flex align-items-center gap-2 fw-semibold mb-2">
                                <Check size={16} className="bg-white text-emerald-600 rounded-circle p-0.5" style={{ minWidth: '16px', minHeight: '16px' }} />
                                <span>{result.message || 'Import Completed Successfully!'}</span>
                            </div>
                            <div className="d-flex flex-wrap gap-2 mt-2">
                                {result.updated >= 0 && (
                                    <span className="badge bg-white bg-opacity-20 text-white px-2 py-1.5 rounded-2 d-flex align-items-center gap-1">
                                        <span>🔄</span> Updated: <strong className="ms-1">{result.updated}</strong>
                                    </span>
                                )}
                                {result.created >= 0 && (
                                    <span className="badge bg-white bg-opacity-20 text-white px-2 py-1.5 rounded-2 d-flex align-items-center gap-1">
                                        <span>🆕</span> Created: <strong className="ms-1">{result.created}</strong>
                                    </span>
                                )}
                                {result.skipped >= 0 && (
                                    <span className="badge bg-white bg-opacity-20 text-white px-2 py-1.5 rounded-2 d-flex align-items-center gap-1">
                                        <span>⏭️</span> Skipped: <strong className="ms-1">{result.skipped}</strong>
                                    </span>
                                )}
                            </div>
                            
                            {result.errors && result.errors.length > 0 && (
                                <div className="mt-3 pt-2 border-top border-white border-opacity-20 text-white-50" style={{ fontSize: '12px' }}>
                                    <div className="fw-semibold text-white mb-1">Row Errors (first 5):</div>
                                    <ul className="ps-3 mb-0" style={{ color: '#fee2e2' }}>
                                        {result.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx} className="mb-0.5">{err.asin || 'Row'}: {err.reason || err}</li>
                                        ))}
                                        {result.errors.length > 5 && <li>... and {result.errors.length - 5} more</li>}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="rounded-3 p-3 mb-3 text-white d-flex align-items-center gap-2 shadow-sm" style={{ fontSize: '13px', background: '#ef4444', borderLeft: '5px solid #dc2626', animation: 'fadeIn 0.2s ease-out' }}>
                            <AlertCircle size={16} className="bg-white text-rose-600 rounded-circle p-0.5" style={{ minWidth: '16px', minHeight: '16px' }} />
                            <span className="fw-medium">{error}</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="d-flex gap-2">
                        <button
                            className="btn btn-outline-secondary flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                            onClick={handleDownloadTemplate}
                            style={{ borderRadius: '8px', fontSize: '12px' }}
                        >
                            <FileDown size={14} />
                            Download Template
                        </button>
                        <button
                            className="btn btn-dark flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                            onClick={handleUpload}
                            disabled={!file || uploading || (activeTab === 'catalog' && !selectedSellerId)}
                            style={{ borderRadius: '8px', fontSize: '12px', background: '#18181b' }}
                        >
                            {uploading ? (
                                <><RefreshCw size={14} className="spin" /> Uploading...</>
                            ) : (
                                <><Upload size={14} /> Upload & Process</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BulkImportModal;
