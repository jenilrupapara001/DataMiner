import React, { useState, useEffect, useCallback } from 'react';
import { 
    Drawer, 
    List, 
    Avatar, 
    Typography, 
    Tag, 
    Progress, 
    Button, 
    Empty, 
    Spin, 
    Space, 
    Tooltip, 
    message, 
    ConfigProvider 
} from 'antd';
import { 
    Download, 
    FileText, 
    FileSpreadsheet, 
    Clock, 
    CheckCircle, 
    AlertTriangle, 
    RefreshCw, 
    Calendar, 
    Info,
    DownloadCloud
} from 'lucide-react';
import { exportApi } from '../../services/api';

const { Text, Paragraph } = Typography;

const DownloadsDrawer = ({ isOpen, onClose }) => {
    const [downloads, setDownloads] = useState([]);
    const [loading, setLoading] = useState(false);

    // SQL / Mongo Robust Schema Mapper
    const normalize = (d) => {
        if (!d) return {};
        return {
            id: d.Id || d.id || d._id,
            status: (d.Status || d.status || 'completed').toLowerCase(),
            fileName: d.FileName || d.fileName || 'unnamed_export',
            format: (d.Format || d.format || 'csv').toLowerCase(),
            rowCount: d.RowCount !== undefined ? d.RowCount : d.rowCount,
            fileSize: d.FileSize !== undefined ? d.FileSize : d.fileSize,
            createdAt: d.CreatedAt || d.createdAt,
            progress: d.Progress !== undefined ? d.Progress : d.progress,
            errorMessage: d.ErrorMessage || d.errorMessage
        };
    };

    const fetchDownloads = useCallback(async () => {
        try {
            const res = await exportApi.getDownloads();
            if (res && res.success) {
                setDownloads(res.data || []);
            }
        } catch (err) {
            console.error('Downloads Grid sync error:', err);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchDownloads().finally(() => setLoading(false));
        }
    }, [isOpen, fetchDownloads]);

    // Real-time poll for background telemetry parsing
    useEffect(() => {
        if (!isOpen) return;
        const normalized = downloads.map(normalize);
        const hasProcessing = normalized.some(d => d.status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(fetchDownloads, 3500);
        return () => clearInterval(interval);
    }, [isOpen, downloads, fetchDownloads]);

    const handleDownloadTrigger = async (rawDownload) => {
        const item = normalize(rawDownload);
        if (item.status !== 'completed') return;

        const key = `dnld-${item.id}`;
        message.loading({ content: `Extracting ${item.fileName}...`, key, duration: 0 });
        
        try {
            const blob = await exportApi.downloadFile(item.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = item.fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            message.success({ content: 'Extraction complete.', key, duration: 2 });
        } catch (err) {
            console.error('Telemetry payload extraction aborted:', err);
            message.error({ content: 'Failed to download file payload.', key, duration: 3 });
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'processing': return '#2563eb'; // processing blue
            case 'completed': return '#16a34a';  // success green
            case 'failed': return '#dc2626';     // error red
            default: return '#64748b';           // neutral
        }
    };

    const getStatusTag = (status) => {
        switch (status) {
            case 'processing': 
                return <Tag color="processing" style={{ borderRadius: 4, fontSize: 10, fontWeight: 650 }}>PROCESSING</Tag>;
            case 'completed': 
                return <Tag color="success" style={{ borderRadius: 4, fontSize: 10, fontWeight: 650 }}>COMPLETED</Tag>;
            case 'failed': 
                return <Tag color="error" style={{ borderRadius: 4, fontSize: 10, fontWeight: 650 }}>FAILED</Tag>;
            default: 
                return <Tag style={{ borderRadius: 4, fontSize: 10, fontWeight: 650 }}>PENDING</Tag>;
        }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '';
        const b = Number(bytes);
        if (b < 1024) return `${b} B`;
        if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
        return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatCreated = (dateString) => {
        if (!dateString) return '--';
        const d = new Date(dateString);
        return isNaN(d.getTime()) ? '--' : d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    borderRadius: 6,
                    colorPrimary: '#0f172a'
                }
            }}
        >
            <Drawer
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <DownloadCloud size={18} style={{ color: '#475569' }} />
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', letterSpacing: '-0.01em' }}>
                            Export Matrix
                        </span>
                    </div>
                }
                placement="right"
                onClose={onClose}
                open={isOpen}
                size={380}
                styles={{
                    body: { padding: 0, backgroundColor: '#fcfcfd' },
                    header: { borderBottom: '1px solid #f1f5f9' }
                }}
                extra={
                    <Space>
                        <Button 
                            type="text" 
                            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
                            onClick={() => {
                                setLoading(true);
                                fetchDownloads().finally(() => setLoading(false));
                            }}
                            disabled={loading}
                        />
                    </Space>
                }
            >
                <Spin spinning={loading} wrapperClassName="h-100">
                    {downloads.length === 0 && !loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', padding: 24 }}>
                            <Empty 
                                image={Empty.PRESENTED_IMAGE_SIMPLE} 
                                description={
                                    <div style={{ marginTop: 12 }}>
                                        <Text strong style={{ color: '#475569', fontSize: 14 }}>Empty Export Buffer</Text>
                                        <Paragraph style={{ fontSize: 12, color: '#64748b', marginTop: 4, maxWidth: 220 }}>
                                            Your scheduled reports and direct telemetry downloads will populate this stream.
                                        </Paragraph>
                                    </div>
                                }
                            />
                        </div>
                    ) : (
                        <List
                            itemLayout="horizontal"
                            dataSource={downloads}
                            renderItem={(rawItem) => {
                                const item = normalize(rawItem);
                                const isClickable = item.status === 'completed';
                                
                                return (
                                    <div
                                        style={{
                                            padding: '16px 20px',
                                            borderBottom: '1px solid #f1f5f9',
                                            backgroundColor: '#fff',
                                            transition: 'all 0.2s',
                                            cursor: isClickable ? 'pointer' : 'default'
                                        }}
                                        className="download-row-hover"
                                        onClick={() => isClickable && handleDownloadTrigger(rawItem)}
                                    >
                                        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                                            {/* Avatar Block with Type Decoration */}
                                            <Avatar
                                                shape="square"
                                                size={38}
                                                style={{
                                                    backgroundColor: item.format === 'csv' ? '#eff6ff' : '#f0fdf4',
                                                    color: item.format === 'csv' ? '#2563eb' : '#16a34a',
                                                    border: `1px solid ${item.format === 'csv' ? '#dbeafe' : '#dcfce7'}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    marginTop: 2,
                                                    flexShrink: 0
                                                }}
                                                icon={item.format === 'csv' ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
                                            />

                                            {/* Telemetry Metadata */}
                                            <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                    <Text 
                                                        strong 
                                                        ellipsis 
                                                        style={{ 
                                                            fontSize: 13, 
                                                            color: '#0f172a', 
                                                            fontWeight: 650,
                                                            letterSpacing: '-0.01em'
                                                        }}
                                                    >
                                                        {item.fileName}
                                                    </Text>
                                                    {getStatusTag(item.status)}
                                                </div>

                                                {/* Operational Size Metrics */}
                                                <Space size="middle" split={<span style={{ color: '#e2e8f0' }}>•</span>} style={{ fontSize: 11, color: '#64748b' }}>
                                                    {item.rowCount !== undefined && item.rowCount !== null && (
                                                        <span>{item.rowCount.toLocaleString()} rows</span>
                                                    )}
                                                    {item.fileSize ? <span>{formatSize(item.fileSize)}</span> : null}
                                                </Space>

                                                {/* Timeline Data */}
                                                <Space size={4} style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                                                    <Calendar size={10} />
                                                    <span>{formatCreated(item.createdAt)}</span>
                                                </Space>

                                                {/* Dynamic Processing Bar */}
                                                {item.status === 'processing' && (
                                                    <div style={{ marginTop: 8 }}>
                                                        <Progress 
                                                            percent={Math.round(item.progress || 0)} 
                                                            size="small" 
                                                            strokeColor="#2563eb"
                                                            trailColor="#f1f5f9"
                                                            style={{ margin: 0 }}
                                                        />
                                                    </div>
                                                )}

                                                {/* Exception Vector Alert */}
                                                {item.status === 'failed' && item.errorMessage && (
                                                    <div style={{ 
                                                        marginTop: 8, 
                                                        padding: '6px 10px', 
                                                        backgroundColor: '#fef2f2', 
                                                        border: '1px solid #fee2e2',
                                                        borderRadius: 4,
                                                        display: 'flex',
                                                        gap: 6,
                                                        alignItems: 'center'
                                                    }}>
                                                        <AlertTriangle size={12} style={{ color: '#ef4444', flexShrink: 0 }} />
                                                        <Text type="danger" style={{ fontSize: 11, fontWeight: 500 }} ellipsis>
                                                            {item.errorMessage}
                                                        </Text>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Single Action Module Trigger */}
                                            {isClickable && (
                                                <div style={{ alignSelf: 'center', marginLeft: 4, flexShrink: 0 }}>
                                                    <Button 
                                                        type="text" 
                                                        size="small" 
                                                        shape="circle"
                                                        icon={<Download size={14} style={{ color: '#475569' }} />}
                                                        style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            }}
                        />
                    )}
                </Spin>

                <style>{`
                    .download-row-hover:hover {
                        background-color: #f8fafc !important;
                    }
                    .animate-spin {
                        animation: spin 1.2s linear infinite;
                    }
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </Drawer>
        </ConfigProvider>
    );
};

export default DownloadsDrawer;
