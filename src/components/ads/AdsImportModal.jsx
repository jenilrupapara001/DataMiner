import React, { useState } from 'react';
import { Modal, Segmented, DatePicker, Upload, Alert, Button, Typography, Space } from 'antd';
import { FileType, Loader2, X } from 'lucide-react';
import axios from 'axios';
import dayjs from 'dayjs';
import { InboxOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Dragger } = Upload;

const AdsImportModal = ({ isOpen, onClose, onComplete, selectedSeller }) => {
    const [marketplace, setMarketplace] = useState('amazon');
    const [fileList, setFileList] = useState([]);
    const [statuses, setStatuses] = useState({}); // mapping: file.uid -> { status: 'pending'|'uploading'|'success'|'error', progress: 0-100, rows?: number, error?: string }
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [selectedDate, setSelectedDate] = useState(dayjs());

    const handleUpload = async () => {
        if (fileList.length === 0) { setError('Please select at least one file'); return; }
        if (!selectedDate) { setError('Please select default report date'); return; }

        setUploading(true);
        setError(null);
        setResult(null);

        // Initialize statuses
        const initialStatuses = {};
        fileList.forEach(file => {
            initialStatuses[file.uid] = { status: 'uploading', progress: 0 };
        });
        setStatuses(initialStatuses);

        let successCount = 0;
        let failCount = 0;
        let totalRows = 0;
        let firstErrorMessage = '';

        for (const file of fileList) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('date', selectedDate.format('YYYY-MM-DD'));
                formData.append('marketplace', marketplace);
                if (selectedSeller) {
                    formData.append('sellerId', selectedSeller);
                }

                const backendUrl = `${import.meta.env.VITE_API_URL || '/api'}/upload/upload-ads`;
                const config = {
                    headers: { 'Content-Type': 'multipart/form-data' },
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setStatuses(prev => ({
                            ...prev,
                            [file.uid]: { ...prev[file.uid], progress: percentCompleted }
                        }));
                    }
                };

                const token = localStorage.getItem('token');
                if (token) { config.headers.Authorization = `Bearer ${token}`; }

                const response = await axios.post(backendUrl, formData, config);

                if (response.data?.success) {
                    successCount++;
                    const rows = response.data.processed || response.data.inserted || 0;
                    totalRows += rows;
                    setStatuses(prev => ({
                        ...prev,
                        [file.uid]: { status: 'success', progress: 100, rows }
                    }));
                } else {
                    failCount++;
                    const errMsg = response.data?.error || 'Upload Failed';
                    if (!firstErrorMessage) firstErrorMessage = errMsg;
                    setStatuses(prev => ({
                        ...prev,
                        [file.uid]: { status: 'error', progress: 100, error: errMsg }
                    }));
                }
            } catch (err) {
                failCount++;
                console.error('Ads Upload Error:', err);
                const detailMsg = err.response?.data?.details ? `: ${err.response.data.details}` : '';
                const errMsg = (err.response?.data?.error || err.message || 'Upload execution failure.') + detailMsg;
                if (!firstErrorMessage) firstErrorMessage = errMsg;
                setStatuses(prev => ({
                    ...prev,
                    [file.uid]: { status: 'error', progress: 100, error: errMsg }
                }));
            }
        }

        setUploading(false);

        if (successCount > 0) {
            setResult({ success: true, processed: totalRows, count: successCount });
            if (onComplete) onComplete();
        }

        if (failCount > 0) {
            setError(`Failed to import ${failCount} of ${fileList.length} report(s). ${firstErrorMessage}`);
        } else {
            // All succeeded, clear file list
            setFileList([]);
        }
    };

    const uploadProps = {
        name: 'file',
        multiple: true,
        beforeUpload: (file) => {
            setFileList(prev => [...prev, file]);
            setError(null);
            setResult(null);
            return false; // Prevent auto upload
        },
        onRemove: (file) => {
            setFileList(prev => prev.filter(f => f.uid !== file.uid));
            setStatuses(prev => {
                const next = { ...prev };
                delete next[file.uid];
                return next;
            });
        },
        fileList,
        accept: '.csv,.xlsx,.xls',
        showUploadList: false // We will render our own list
    };

    return (
        <Modal
            title={
                <Space>
                    <div className="p-1.5 bg-zinc-900 rounded-2 text-white d-flex">
                        <FileType size={16} />
                    </div>
                    <div className="d-flex flex-column" style={{ lineHeight: '1.2' }}>
                        <Text strong style={{ fontSize: '15px' }}>Import Advertising Data</Text>
                        <Text type="secondary" style={{ fontSize: '11px' }}>Process Daily Ad Metrics</Text>
                    </div>
                </Space>
            }
            open={isOpen}
            onCancel={onClose}
            footer={[
                <Button key="cancel" onClick={onClose} disabled={uploading}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={uploading}
                    onClick={handleUpload}
                    disabled={fileList.length === 0}
                    style={{ backgroundColor: '#18181b', borderColor: '#18181b' }}
                >
                    Run Import
                </Button>
            ]}
            width={550}
            destroyOnHidden
            centered
        >
            <div className="py-3">
                <Segmented
                    block
                    value={marketplace}
                    onChange={setMarketplace}
                    options={[
                        { label: 'Amazon', value: 'amazon' },
                        { label: 'Ajio', value: 'ajio' },
                    ]}
                    className="mb-4"
                />

                <div className="mb-4">
                    <Text strong className="d-block mb-1 text-zinc-700">
                        Report Reference Date
                    </Text>
                    <DatePicker
                        value={selectedDate}
                        onChange={setSelectedDate}
                        style={{ width: '100%', height: '38px', borderRadius: '6px' }}
                        format="YYYY-MM-DD"
                        allowClear={false}
                        disabled={uploading}
                    />
                </div>

                {/* Visual Guides */}
                <div className="bg-blue-50 border border-blue-100 rounded-3 p-3 mb-4" style={{ fontSize: '12px' }}>
                    <Text strong className="text-blue-900 d-block mb-2">Required Schema ({marketplace === 'ajio' ? 'Ajio' : 'Amazon'}):</Text>
                    <Space wrap size={[8, 8]}>
                        {marketplace === 'ajio' ? (
                            <>
                                <span style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Jio Code</span>
                                <span style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Spend</span>
                                <span style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Sales</span>
                                <span style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Orders</span>
                            </>
                        ) : (
                            <>
                                <span style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>ASIN</span>
                                <span style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Spend</span>
                                <span style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Sales</span>
                                <span style={{ background: '#fff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>Impressions</span>
                            </>
                        )}
                    </Space>
                </div>

                <div className="mb-4">
                    <Dragger {...uploadProps} disabled={uploading} style={{ padding: '20px 0', background: '#f8fafc', borderColor: '#e2e8f0' }}>
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined style={{ color: '#1976D2' }} />
                        </p>
                        <p className="ant-upload-text fw-bold" style={{ fontSize: '13px' }}>Choose Advertising Data Files</p>
                        <p className="ant-upload-hint text-zinc-400" style={{ fontSize: '11px' }}>Support for multiple uploads (CSV or Excel).</p>
                    </Dragger>
                </div>

                {/* Custom File List with status and progress */}
                {fileList.length > 0 && (
                    <div className="mb-4">
                        <Text strong className="d-block mb-2 text-zinc-700">
                            Selected Files ({fileList.length})
                        </Text>
                        <div className="d-flex flex-column gap-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {fileList.map((file) => {
                                const fileStatus = statuses[file.uid] || { status: 'pending' };
                                return (
                                    <div
                                        key={file.uid}
                                        className="d-flex align-items-center justify-content-between p-2.5 rounded-3 border"
                                        style={{
                                            background: '#f8fafc',
                                            borderColor: fileStatus.status === 'success' ? '#bbf7d0' : fileStatus.status === 'error' ? '#fecaca' : '#e2e8f0'
                                        }}
                                    >
                                        <div className="d-flex align-items-center gap-2.5 flex-grow-1 min-w-0">
                                            <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-center text-zinc-500 shadow-xs">
                                                <FileType size={16} />
                                            </div>
                                            <div className="flex-grow-1 min-w-0" style={{ lineHeight: '1.3' }}>
                                                <div className="fw-semibold text-zinc-700 text-truncate" style={{ fontSize: '12.5px' }} title={file.name}>
                                                    {file.name}
                                                </div>
                                                <div className="text-zinc-400" style={{ fontSize: '10.5px' }}>
                                                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                                                </div>
                                            </div>
                                        </div>

                                        <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                                            {fileStatus.status === 'pending' && (
                                                <button
                                                    className="btn btn-link p-1 text-zinc-400 hover-text-red-500 border-0 bg-transparent shadow-none"
                                                    onClick={() => uploadProps.onRemove(file)}
                                                    disabled={uploading}
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                            {fileStatus.status === 'uploading' && (
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="text-primary fw-bold" style={{ fontSize: '11px' }}>{fileStatus.progress}%</span>
                                                    <Loader2 size={12} className="animate-spin text-primary" />
                                                </div>
                                            )}
                                            {fileStatus.status === 'success' && (
                                                <span
                                                    className="badge"
                                                    style={{ backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', fontSize: '10px', padding: '3px 6px', fontWeight: 600, borderRadius: '4px' }}
                                                    title={`Processed ${fileStatus.rows} rows`}
                                                >
                                                    Success ({fileStatus.rows.toLocaleString()})
                                                </span>
                                            )}
                                            {fileStatus.status === 'error' && (
                                                <span
                                                    className="badge"
                                                    style={{ backgroundColor: '#fef2f2', color: '#C62828', border: '1px solid #fecaca', fontSize: '10px', padding: '3px 6px', fontWeight: 600, borderRadius: '4px' }}
                                                    title={fileStatus.error}
                                                >
                                                    Failed
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {result && (
                    <Alert
                        message={`Successfully imported ${result.count} report(s)`}
                        description={`Aggregated total: ${result.processed.toLocaleString()} rows ingested successfully.`}
                        type="success"
                        showIcon
                        className="mb-3 fw-bold"
                    />
                )}

                {error && (
                    <Alert
                        message="Import Results Alert"
                        description={error}
                        type="error"
                        showIcon
                        className="mb-3 fw-bold"
                    />
                )}
            </div>
        </Modal>
    );
};

export default AdsImportModal;
