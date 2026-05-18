import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, FileDown, Check, AlertCircle, RefreshCw, Calendar, FileType } from 'lucide-react';
import axios from 'axios';

const AdsImportModal = ({ isOpen, onClose, onComplete, selectedSeller }) => {
    const [marketplace, setMarketplace] = useState('amazon');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setError(null);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) { setError('Please select a file'); return; }
        if (!selectedDate) { setError('Please select default report date'); return; }

        setUploading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('date', selectedDate);
            formData.append('marketplace', marketplace);
            if (selectedSeller) {
                formData.append('sellerId', selectedSeller);
            }

            const backendUrl = `${import.meta.env.VITE_API_URL || '/api'}/upload/upload-ads`;

            const config = {
                headers: { 'Content-Type': 'multipart/form-data' }
            };
            const token = localStorage.getItem('token');
            if (token) { config.headers.Authorization = `Bearer ${token}`; }

            const response = await axios.post(backendUrl, formData, config);

            if (response.data?.success) {
                setResult(response.data);
                setFile(null);
                if (onComplete) onComplete();
            } else {
                setError(response.data?.error || 'Upload Failed');
            }
        } catch (err) {
            console.error('Ads Upload Error:', err);
            const detailMsg = err.response?.data?.details ? `: ${err.response.data.details}` : '';
            setError((err.response?.data?.error || err.message || 'Upload execution failure.') + detailMsg);
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="position-fixed top-0 bottom-0 start-0 end-0 d-flex align-items-center justify-content-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 9999 }}>

            <div className="bg-white rounded-4 shadow-2xl" style={{ width: '100%', maxWidth: '500px', overflow: 'hidden' }}>
                {/* Header */}
                <div className="px-4 py-3 border-bottom d-flex justify-content-between align-items-center bg-zinc-50">
                    <div className="d-flex align-items-center gap-2">
                        <div className="p-1.5 bg-zinc-900 rounded-2 text-white">
                            <FileType size={16} />
                        </div>
                        <div>
                            <h6 className="mb-0 fw-bold text-zinc-900">Import Advertising Data</h6>
                            <span className="text-zinc-500" style={{ fontSize: '11px' }}>Process Daily Ad Metrics</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="btn btn-ghost p-1 rounded-circle border-0">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    {/* Marketplace Switch */}
                    <div className="mb-4 bg-zinc-100 p-1 rounded-3 d-flex" style={{ gap: '2px' }}>
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

                    {/* Details row */}
                    <div className="row g-3 mb-3">
                        <div className="col-12">
                            <label className="fw-bold mb-1 text-zinc-700 d-flex align-items-center gap-1" style={{ fontSize: '12px' }}>
                                <Calendar size={14} className="text-zinc-400" /> Report Reference Date
                            </label>
                            <input
                                type="date"
                                className="form-control"
                                style={{ borderRadius: '8px', fontSize: '13px' }}
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Visual Guides */}
                    <div className="bg-blue-50 border border-blue-100 rounded-3 p-3 mb-3" style={{ fontSize: '12px' }}>
                        <span className="fw-bold text-blue-900 d-block mb-2">Required Schema ({marketplace === 'ajio' ? 'Ajio' : 'Amazon'}):</span>
                        <div className="d-flex flex-wrap gap-2">
                            {marketplace === 'ajio' ? (
                                <>
                                    <div style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Jio Code</div>
                                    <div style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Spend</div>
                                    <div style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Sales</div>
                                    <div style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Orders</div>
                                </>
                            ) : (
                                <>
                                    <div style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>ASIN</div>
                                    <div style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Spend</div>
                                    <div style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Sales</div>
                                    <div style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Impressions</div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* File Drop Area */}
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
                                id="ads-file-input"
                            />
                            {file ? (
                                <div className="d-flex align-items-center justify-content-center gap-2 py-2">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-circle"><Check size={18} /></div>
                                    <div className="text-start">
                                        <div className="fw-bold text-zinc-800" style={{ fontSize: '13px' }}>{file.name}</div>
                                        <div className="text-zinc-400" style={{ fontSize: '11px' }}>{(file.size / 1024).toFixed(1)} KB</div>
                                    </div>
                                    <button type="button" className="btn btn-ghost ms-2 p-1 text-zinc-400" onClick={() => setFile(null)}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <label htmlFor="ads-file-input" className="w-100 h-100 cursor-pointer m-0 py-2">
                                    <Upload size={28} className="text-zinc-400 mb-2" />
                                    <p className="text-zinc-600 mb-0 fw-semibold" style={{ fontSize: '13px' }}>Choose Advertising Data File</p>
                                    <p className="text-zinc-400 mb-0" style={{ fontSize: '11px' }}>Drag and drop CSV or Excel sheet</p>
                                </label>
                            )}
                        </div>
                    </div>

                    {/* Response Feedbacks - High Contrast SOLID Badges */}
                    {result && (
                        <div className="rounded-3 p-3 mb-3 text-white shadow-sm" style={{ fontSize: '13px', background: '#059669', border: '1px solid #047857', animation: 'fadeIn 0.2s ease-out' }}>
                            <div className="d-flex align-items-center gap-2 fw-bold mb-2">
                                <div className="bg-white rounded-circle p-0.5 d-flex"><Check size={14} className="text-emerald-700" /></div>
                                <span>Aggregation Completed Successfully</span>
                            </div>
                            <div className="mt-1 d-flex">
                                <div style={{ background: '#fff', color: '#065f46', padding: '4px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '11px', border: '1px solid #a7f3d0' }}>
                                    PROCESSED: {result.processed || result.inserted || 0} ROWS
                                </div>
                            </div>
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
                    <div className="d-flex gap-3 mt-2">
                        <button
                            type="button"
                            className="btn btn-light border flex-grow-1"
                            onClick={onClose}
                            style={{ borderRadius: '8px', fontSize: '13px', fontWeight: 500 }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn btn-dark flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            style={{ borderRadius: '8px', fontSize: '13px', fontWeight: 600, background: '#18181b' }}
                        >
                            {uploading ? (
                                <><RefreshCw size={15} className="spin" /> Uploading...</>
                            ) : (
                                <><Upload size={15} /> Run Import</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AdsImportModal;
