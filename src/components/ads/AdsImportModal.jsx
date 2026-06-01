import React, { useState } from 'react';
import { Modal, Segmented, DatePicker, Upload, Alert, Button, Typography, Space } from 'antd';
import { FileType } from 'lucide-react';
import axios from 'axios';
import dayjs from 'dayjs';
import { InboxOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Dragger } = Upload;

const AdsImportModal = ({ isOpen, onClose, onComplete, selectedSeller }) => {
    const [marketplace, setMarketplace] = useState('amazon');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);
    const [selectedDate, setSelectedDate] = useState(dayjs());

    const handleUpload = async () => {
        if (!file) { setError('Please select a file'); return; }
        if (!selectedDate) { setError('Please select default report date'); return; }

        setUploading(true);
        setError(null);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('date', selectedDate.format('YYYY-MM-DD'));
            formData.append('marketplace', marketplace);
            if (selectedSeller) {
                formData.append('sellerId', selectedSeller);
            }

            const backendUrl = `${import.meta.env.VITE_API_URL || '/api'}/upload/upload-ads`;
            const config = { headers: { 'Content-Type': 'multipart/form-data' } };
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

    const uploadProps = {
        name: 'file',
        multiple: false,
        beforeUpload: (f) => {
            setFile(f);
            setError(null);
            setResult(null);
            return false;
        },
        onRemove: () => {
            setFile(null);
        },
        fileList: file ? [file] : [],
        accept: '.csv,.xlsx,.xls'
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
                <Button key="cancel" onClick={onClose}>
                    Cancel
                </Button>,
                <Button key="submit" type="primary" loading={uploading} onClick={handleUpload} disabled={!file} style={{ backgroundColor: '#18181b', borderColor: '#18181b' }}>
                    Run Import
                </Button>
            ]}
            width={500}
            destroyOnClose
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
                    <Dragger {...uploadProps} style={{ padding: '20px 0', background: '#f8fafc', borderColor: '#e2e8f0' }}>
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined style={{ color: '#4f46e5' }} />
                        </p>
                        <p className="ant-upload-text fw-bold" style={{ fontSize: '13px' }}>Choose Advertising Data File</p>
                        <p className="ant-upload-hint text-zinc-400" style={{ fontSize: '11px' }}>Support for a single upload (CSV or Excel).</p>
                    </Dragger>
                </div>

                {result && (
                    <Alert
                        message="Aggregation Completed Successfully"
                        description={`PROCESSED: ${result.processed || result.inserted || 0} ROWS`}
                        type="success"
                        showIcon
                        className="mb-3 fw-bold"
                    />
                )}

                {error && (
                    <Alert
                        message={error}
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
