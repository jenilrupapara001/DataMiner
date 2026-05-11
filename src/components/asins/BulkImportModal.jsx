import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileDown, FileUp, Store, Check, AlertCircle, RefreshCw, Globe, FileType } from 'lucide-react';
import { sellerApi, bulkApi, asinApi } from '../../services/api';

const BulkImportModal = ({ isOpen, onClose, onComplete }) => {
    const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'tags' | 'global'
    const [sellers, setSellers] = useState([]);
    const [selectedSellerId, setSelectedSellerId] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [marketplace, setMarketplace] = useState('amazon'); // 'amazon' | 'ajio'

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
        } finally {
            setUploading(false);
        }
    };

    const handleDownloadTemplate = async () => {
        try {
            if (activeTab === 'catalog') {
                await bulkApi.downloadCatalogTemplate(marketplace);
            } else {
                await asinApi.downloadTagsTemplate(selectedSellerId || undefined);
            }
        } catch (err) {
            console.error('Template download failed:', err);
        }
    };

    const renderSchemaGuidance = () => {
        const schemas = {
            catalog: {
                ajio: ['Jio Code', 'Brand Name', 'SKU', 'Realeased date', 'Price'],
                amazon: ['ASIN', 'SKU', 'Price', 'Parent ASIN', 'Release Date']
            },
            tags: {
                ajio: ['Jio Code', 'Tags'],
                amazon: ['ASIN', 'Tags']
            },
            global: {
                ajio: ['Brand Name', 'Jio Code', 'SKU', 'Realeased date', 'Price'],
                amazon: ['Seller Name', 'ASIN', 'SKU', 'Parent ASIN', 'Release Date', 'Price']
            }
        };

        const activeSchema = schemas[activeTab][marketplace];

        return (
            <div className="bg-blue-50 border border-blue-100 rounded-3 p-3 mb-3" style={{ fontSize: '12px' }}>
                <span className="fw-bold text-blue-900 d-block mb-2">Required Schema ({marketplace === 'ajio' ? 'Ajio' : 'Amazon'}):</span>
                <div className="d-flex flex-wrap gap-2">
                    {activeSchema.map(col => (
                        <div key={col} style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>{col}</div>
                    ))}
                </div>
            </div>
        );
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }}>
            
            <div className="bg-white rounded-4 shadow-2xl" style={{ width: '100%', maxWidth: '550px', overflow: 'hidden' }}>
                {/* Unified Header from Ads Modal */}
                <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center bg-zinc-50">
                    <div className="d-flex align-items-center gap-2">
                        <div className="p-1.5 bg-zinc-900 rounded-2 text-white">
                            <FileType size={16} />
                        </div>
                        <div>
                            <h6 className="mb-0 fw-bold text-zinc-900">Inventory Bulk Import</h6>
                            <span className="text-zinc-500" style={{ fontSize: '11px' }}>Process Product Manifests</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost p-1 rounded-circle border-0">
                        <X size={20} />
                    </button>
                </div>

                {/* Modern Minimal Tabs */}
                <div className="d-flex border-bottom bg-white p-1">
                    <button
                        className={`flex-grow-1 py-2 border-0 rounded-2 fw-bold transition-all ${activeTab === 'catalog' ? 'bg-zinc-100 text-zinc-900' : 'bg-transparent text-zinc-400 hover-bg-zinc-50'}`}
                        onClick={() => { setActiveTab('catalog'); setFile(null); setResult(null); setError(null); }}
                        style={{ fontSize: '12px' }}
                    >
                        Catalog Sync
                    </button>
                    <button
                        className={`flex-grow-1 py-2 border-0 rounded-2 fw-bold transition-all ${activeTab === 'tags' ? 'bg-zinc-100 text-zinc-900' : 'bg-transparent text-zinc-400 hover-bg-zinc-50'}`}
                        onClick={() => { setActiveTab('tags'); setFile(null); setResult(null); setError(null); }}
                        style={{ fontSize: '12px' }}
                    >
                        Tags Import
                    </button>
                    <button
                        className={`flex-grow-1 py-2 border-0 rounded-2 fw-bold transition-all ${activeTab === 'global' ? 'bg-zinc-100 text-zinc-900' : 'bg-transparent text-zinc-400 hover-bg-zinc-50'}`}
                        onClick={() => { setActiveTab('global'); setFile(null); setResult(null); setError(null); }}
                        style={{ fontSize: '12px' }}
                    >
                        Global Upload
                    </button>
                </div>

                <div className="p-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                    {/* Marketplace Switch */}
                    <div className="mb-3 bg-zinc-100 p-1 rounded-3 d-flex" style={{ gap: '2px' }}>
                        <button
                            type="button"
                            onClick={() => setMarketplace('amazon')}
                            className={`flex-grow-1 py-2 border-0 rounded-2 d-flex align-items-center justify-content-center gap-2 transition-all ${marketplace === 'amazon' ? 'bg-white shadow-sm text-zinc-900 fw-bold' : 'bg-transparent text-zinc-500'}`}
                            style={{ fontSize: '12px' }}
                        >
                            <img src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" style={{ height: '12px', width: 'auto', objectFit: 'contain', filter: marketplace === 'amazon' ? 'none' : 'grayscale(100%) brightness(50%)' }} alt="Amazon" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setMarketplace('ajio')}
                            className={`flex-grow-1 py-2 border-0 rounded-2 d-flex align-items-center justify-content-center gap-2 transition-all ${marketplace === 'ajio' ? 'bg-white shadow-sm text-zinc-900 fw-bold' : 'bg-transparent text-zinc-500'}`}
                            style={{ fontSize: '12px' }}
                        >
                            <img src="https://cdn.brandfetch.io/id78Xj7CCR/w/820/h/238/theme/dark/logo.png?c=1bxid64Mup7aczewSAYMX&t=1776791426160" style={{ height: '14px', width: 'auto', objectFit: 'contain', filter: marketplace === 'ajio' ? 'none' : 'grayscale(100%) brightness(50%)' }} alt="Ajio" />
                        </button>
                    </div>

                    {/* Contextual Schema Guidance */}
                    {renderSchemaGuidance()}

                    {/* Seller Selector */}
                    {activeTab !== 'global' && (
                        <div className="mb-3">
                            <label className="fw-bold mb-1 text-zinc-700 d-flex align-items-center gap-1" style={{ fontSize: '12px' }}>
                                <Store size={14} className="text-zinc-400" /> 
                                {activeTab === 'catalog' ? 'Target Seller (Fallback)' : 'Filter by Seller'}
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

                    {/* Optimized Drag Drop Container */}
                    <div className="mb-4">
                        <div className="border border-dashed rounded-3 p-4 text-center bg-zinc-50 hover-bg-zinc-100 transition-all cursor-pointer"
                            style={{ borderColor: file ? '#10b981' : '#e4e4e7' }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                const droppedFile = e.dataTransfer.files?.[0];
                                if (droppedFile) { setFile(droppedFile); setError(null); }
                            }}>
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                                id="bulk-file-input"
                            />
                            {file ? (
                                <div className="d-flex align-items-center justify-content-center gap-2 py-2">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-circle"><Check size={18} /></div>
                                    <div className="text-start">
                                        <div className="fw-bold text-zinc-800" style={{ fontSize: '13px' }}>{file.name}</div>
                                        <div className="text-zinc-400" style={{ fontSize: '11px' }}>{(file.size/1024).toFixed(1)} KB</div>
                                    </div>
                                    <button type="button" className="btn btn-ghost ms-2 p-1 text-zinc-400" onClick={() => setFile(null)}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <label htmlFor="bulk-file-input" className="w-100 h-100 cursor-pointer m-0 py-2">
                                    <Upload size={28} className="text-zinc-400 mb-2" />
                                    <p className="text-zinc-600 mb-0 fw-semibold" style={{ fontSize: '13px' }}>Choose {activeTab} file</p>
                                    <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>Click or drag file here (CSV, XLSX)</p>
                                </label>
                            )}
                        </div>
                    </div>

                    {/* PROPER SOLID COLOUR BADGES AND ALERTS */}
                    {result && (
                        <div className="rounded-3 p-3 mb-3 text-white shadow-sm" style={{ fontSize: '13px', background: '#059669', border: '1px solid #047857', animation: 'fadeIn 0.2s ease-out' }}>
                            <div className="d-flex align-items-center gap-2 fw-bold mb-3">
                                <div className="bg-white rounded-circle p-0.5 d-flex"><Check size={14} className="text-emerald-700" /></div>
                                <span>{result.message || 'Import Operation Successful'}</span>
                            </div>
                            
                            <div className="d-flex flex-wrap gap-2">
                                {result.updated >= 0 && (
                                    <div style={{ background: '#fff', color: '#065f46', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '11px', border: '1px solid #a7f3d0' }}>
                                        UPDATED: {result.updated}
                                    </div>
                                )}
                                {result.created >= 0 && (
                                    <div style={{ background: '#fff', color: '#065f46', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '11px', border: '1px solid #a7f3d0' }}>
                                        CREATED: {result.created}
                                    </div>
                                )}
                                {result.skipped >= 0 && (
                                    <div style={{ background: '#fff', color: '#854d0e', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '11px', border: '1px solid #fef08a' }}>
                                        SKIPPED: {result.skipped}
                                    </div>
                                )}
                            </div>
                            
                            {result.errors && result.errors.length > 0 && (
                                <div className="mt-3 pt-2 border-top border-white border-opacity-20">
                                    <div className="fw-bold text-white mb-1" style={{ fontSize: '11px' }}>ISSUE LOG (First 5):</div>
                                    <ul className="ps-3 mb-0" style={{ color: '#ecfdf5', fontSize: '11px' }}>
                                        {result.errors.slice(0, 5).map((err, idx) => (
                                            <li key={idx} className="mb-0.5">{err.asin || 'Row'}: {err.reason || err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="rounded-3 p-3 mb-3 text-white shadow-sm" style={{ fontSize: '13px', background: '#dc2626', border: '1px solid #b91c1c', animation: 'fadeIn 0.2s ease-out' }}>
                            <div className="d-flex align-items-center gap-2 fw-bold">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="d-flex gap-3">
                        <button
                            type="button"
                            className="btn btn-light border flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                            onClick={handleDownloadTemplate}
                            style={{ borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}
                        >
                            <FileDown size={15} />
                            Download Template
                        </button>
                        <button
                            type="button"
                            className="btn btn-dark flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            style={{ borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#18181b' }}
                        >
                            {uploading ? (
                                <><RefreshCw size={15} className="spin" /> Processing...</>
                            ) : (
                                <><Upload size={15} /> Start Import</>
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
