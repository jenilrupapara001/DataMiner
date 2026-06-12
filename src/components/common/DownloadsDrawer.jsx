import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
    Drawer, Typography, Tag, Button, Empty, Spin, Tooltip, message,
    ConfigProvider, Segmented
} from 'antd';
import {
    Download, FileText, FileSpreadsheet, Clock, CheckCircle2,
    AlertTriangle, RefreshCw, Calendar, Info, DownloadCloud,
    Archive, Activity, XCircle, Loader2, Search, Trash2,
    FileJson, FileCode2, File, Sparkles, ArrowUpRight,
    Database, Zap, Filter, HardDrive, TrendingUp
} from 'lucide-react';
import { exportApi } from '../../services/api';

const { Text, Paragraph } = Typography;

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const b = Number(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatRelativeTime = (dateString) => {
    if (!dateString) return 'just now';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 30) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const getFileIcon = (format) => {
    const f = String(format || '').toLowerCase();
    if (f.includes('csv')) return { Icon: FileText, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' };
    if (f.includes('xls') || f.includes('xlsx')) return { Icon: FileSpreadsheet, color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
    if (f.includes('json')) return { Icon: FileJson, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' };
    if (f.includes('xml')) return { Icon: FileCode2, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' };
    if (f.includes('pdf')) return { Icon: FileText, color: '#ef4444', bg: '#fef2f2', border: '#fecaca' };
    if (f.includes('zip')) return { Icon: Archive, color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' };
    return { Icon: File, color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' };
};

const getStatusConfig = (status) => {
    const s = String(status || '').toLowerCase();
    switch (s) {
        case 'completed':
        case 'success':
            return {
                label: 'READY',
                color: '#10b981',
                bg: '#ecfdf5',
                border: '#a7f3d0',
                icon: CheckCircle2
            };
        case 'processing':
        case 'in_progress':
            return {
                label: 'PROCESSING',
                color: '#3b82f6',
                bg: '#eff6ff',
                border: '#bfdbfe',
                icon: Loader2,
                animated: true
            };
        case 'failed':
        case 'error':
            return {
                label: 'FAILED',
                color: '#ef4444',
                bg: '#fef2f2',
                border: '#fecaca',
                icon: XCircle
            };
        case 'pending':
        case 'queued':
            return {
                label: 'QUEUED',
                color: '#f59e0b',
                bg: '#fffbeb',
                border: '#fde68a',
                icon: Clock
            };
        default:
            return {
                label: 'PENDING',
                color: '#64748b',
                bg: '#f1f5f9',
                border: '#cbd5e1',
                icon: Clock
            };
    }
};

// ═══════════════════════════════════════════════════════════════
// STAT MINI CARD
// ═══════════════════════════════════════════════════════════════
const StatMiniCard = memo(({ icon: Icon, label, value, color, animate }) => (
    <div style={{
        flex: 1,
        padding: '10px 12px',
        background: `${color}08`,
        border: `1px solid ${color}20`,
        borderRadius: 10,
        minWidth: 0
    }}>
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 3
        }}>
            <Icon
                size={11}
                style={{ color }}
                strokeWidth={2.5}
                className={animate ? 'spin-animation' : ''}
            />
            <span style={{
                fontSize: 9,
                fontWeight: 800,
                color,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {label}
            </span>
        </div>
        <div style={{
            fontSize: 16,
            fontWeight: 800,
            color: '#0f172a',
            letterSpacing: '-0.3px',
            lineHeight: 1
        }}>
            {value}
        </div>
    </div>
));

// ═══════════════════════════════════════════════════════════════
// DOWNLOAD ITEM CARD
// ═══════════════════════════════════════════════════════════════
const DownloadItem = memo(({ item, onDownload }) => {
    const fileConfig = getFileIcon(item.format);
    const statusConfig = getStatusConfig(item.status);
    const FileIcon = fileConfig.Icon;
    const StatusIcon = statusConfig.icon;
    const isClickable = item.status === 'completed';
    const progress = Math.round(item.progress || 0);

    return (
        <div
            className={`download-card-item ${isClickable ? 'clickable' : ''}`}
            onClick={() => isClickable && onDownload(item)}
            style={{
                padding: '14px 16px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: `3px solid ${statusConfig.color}`,
                borderRadius: 12,
                marginBottom: 10,
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Background pattern for processing */}
            {item.status === 'processing' && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: `linear-gradient(135deg, ${statusConfig.color}04 0%, transparent 100%)`,
                    pointerEvents: 'none'
                }} />
            )}

            <div style={{
                position: 'relative',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start'
            }}>
                {/* File Type Icon */}
                <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: fileConfig.bg,
                    border: `1px solid ${fileConfig.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: fileConfig.color,
                    flexShrink: 0
                }}>
                    <FileIcon size={18} strokeWidth={2} />
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Top: Filename + Status */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 8,
                        marginBottom: 6
                    }}>
                        <Tooltip title={item.fileName}>
                            <div style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#0f172a',
                                lineHeight: 1.3,
                                wordBreak: 'break-word',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                flex: 1,
                                minWidth: 0
                            }}>
                                {item.fileName}
                            </div>
                        </Tooltip>

                        {/* Status Badge */}
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            background: statusConfig.bg,
                            border: `1px solid ${statusConfig.border}`,
                            borderRadius: 12,
                            fontSize: 9,
                            fontWeight: 800,
                            color: statusConfig.color,
                            letterSpacing: '0.05em',
                            flexShrink: 0,
                            whiteSpace: 'nowrap'
                        }}>
                            <StatusIcon
                                size={10}
                                strokeWidth={2.5}
                                className={statusConfig.animated ? 'spin-animation' : ''}
                            />
                            {statusConfig.label}
                        </div>
                    </div>

                    {/* Metadata Row */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginBottom: item.status === 'processing' || (item.status === 'failed' && item.errorMessage) ? 8 : 0
                    }}>
                        {/* File format tag */}
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 9,
                            fontWeight: 700,
                            color: fileConfig.color,
                            background: fileConfig.bg,
                            padding: '2px 7px',
                            borderRadius: 6,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            border: `1px solid ${fileConfig.border}`
                        }}>
                            {item.format || 'FILE'}
                        </span>

                        {/* Row count */}
                        {item.rowCount !== undefined && item.rowCount !== null && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 10,
                                fontWeight: 600,
                                color: '#64748b'
                            }}>
                                <Database size={10} strokeWidth={2.5} />
                                {item.rowCount.toLocaleString('en-IN')}
                            </span>
                        )}

                        {/* File size */}
                        {item.fileSize ? (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontSize: 10,
                                fontWeight: 600,
                                color: '#64748b'
                            }}>
                                <HardDrive size={10} strokeWidth={2.5} />
                                {formatSize(item.fileSize)}
                            </span>
                        ) : null}

                        {/* Time */}
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#94a3b8',
                            marginLeft: 'auto'
                        }}>
                            <Clock size={10} strokeWidth={2.5} />
                            {formatRelativeTime(item.createdAt)}
                        </span>
                    </div>

                    {/* Progress Bar (processing) */}
                    {item.status === 'processing' && (
                        <div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 4
                            }}>
                                <span style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: '#64748b',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em'
                                }}>
                                    Generating
                                </span>
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 800,
                                    color: statusConfig.color
                                }}>
                                    {progress}%
                                </span>
                            </div>
                            <div style={{
                                height: 5,
                                background: '#f1f5f9',
                                borderRadius: 3,
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <div
                                    className="progress-shimmer"
                                    style={{
                                        height: '100%',
                                        width: `${progress}%`,
                                        background: `linear-gradient(90deg, ${statusConfig.color}80 0%, ${statusConfig.color} 100%)`,
                                        borderRadius: 3,
                                        transition: 'width 0.6s ease',
                                        boxShadow: `0 0 8px ${statusConfig.color}50`
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Error message (failed) */}
                    {item.status === 'failed' && item.errorMessage && (
                        <div style={{
                            padding: '6px 10px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 6,
                            display: 'flex',
                            gap: 6,
                            alignItems: 'flex-start'
                        }}>
                            <AlertTriangle
                                size={12}
                                style={{ color: '#ef4444', flexShrink: 0, marginTop: 1 }}
                                strokeWidth={2.5}
                            />
                            <span style={{
                                fontSize: 10,
                                color: '#991b1b',
                                fontWeight: 600,
                                lineHeight: 1.4
                            }}>
                                {item.errorMessage}
                            </span>
                        </div>
                    )}

                    {/* Download CTA (completed) */}
                    {isClickable && (
                        <div style={{
                            marginTop: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6
                        }}>
                            <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#10b981'
                            }}>
                                <Sparkles size={10} strokeWidth={2.5} />
                                Ready to download
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDownload(item);
                                }}
                                className="download-action-btn"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '5px 12px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: 8,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px -2px rgba(99,102,241,0.4)',
                                    letterSpacing: '0.02em'
                                }}
                            >
                                <Download size={11} strokeWidth={2.5} />
                                Download
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const DownloadsDrawer = ({ isOpen, onClose }) => {
    const [downloads, setDownloads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterStatus, setFilterStatus] = useState('all');

    // Normalize schema
    const normalize = useCallback((d) => {
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
    }, []);

    const fetchDownloads = useCallback(async () => {
        try {
            const res = await exportApi.getDownloads();
            if (res && res.success) {
                setDownloads(res.data || []);
            }
        } catch (err) {
            console.error('Downloads sync error:', err);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            fetchDownloads().finally(() => setLoading(false));
        }
    }, [isOpen, fetchDownloads]);

    // Real-time poll
    useEffect(() => {
        if (!isOpen) return;
        const normalized = downloads.map(normalize);
        const hasProcessing = normalized.some(d => d.status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(fetchDownloads, 3500);
        return () => clearInterval(interval);
    }, [isOpen, downloads, fetchDownloads, normalize]);

    // Normalize all downloads
    const normalizedDownloads = useMemo(() => {
        return downloads.map(normalize);
    }, [downloads, normalize]);

    // Compute stats
    const stats = useMemo(() => {
        const total = normalizedDownloads.length;
        const completed = normalizedDownloads.filter(d => d.status === 'completed').length;
        const processing = normalizedDownloads.filter(d => d.status === 'processing').length;
        const failed = normalizedDownloads.filter(d => d.status === 'failed').length;
        const totalSize = normalizedDownloads
            .filter(d => d.fileSize)
            .reduce((sum, d) => sum + Number(d.fileSize), 0);
        return { total, completed, processing, failed, totalSize };
    }, [normalizedDownloads]);

    // Filter downloads
    const filteredDownloads = useMemo(() => {
        if (filterStatus === 'all') return normalizedDownloads;
        return normalizedDownloads.filter(d => {
            if (filterStatus === 'processing') return d.status === 'processing';
            if (filterStatus === 'completed') return d.status === 'completed';
            if (filterStatus === 'failed') return d.status === 'failed';
            return true;
        });
    }, [normalizedDownloads, filterStatus]);

    const handleDownloadTrigger = async (item) => {
        if (item.status !== 'completed') return;

        const key = `dnld-${item.id}`;
        message.loading({ content: `Preparing ${item.fileName}...`, key, duration: 0 });

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
            message.success({ content: '✨ Download complete!', key, duration: 2 });
        } catch (err) {
            console.error('Download failed:', err);
            message.error({ content: 'Failed to download file', key, duration: 3 });
        }
    };

    const handleRefresh = () => {
        setLoading(true);
        fetchDownloads().finally(() => setLoading(false));
    };

    return (
        <ConfigProvider
            theme={{
                token: {
                    borderRadius: 10,
                    colorPrimary: '#6366f1'
                }
            }}
        >
            <Drawer
                title={null}
                placement="right"
                onClose={onClose}
                open={isOpen}
                size={420}
                closable={false}
                styles={{
                    body: { padding: 0, background: '#fafbfc' },
                    header: { display: 'none' },
                    content: { boxShadow: '-8px 0 32px -8px rgba(0,0,0,0.12)' }
                }}
            >
                <Spin spinning={loading} wrapperClassName="h-100">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        background: '#fafbfc'
                    }}>
                        {/* ═══════════════════════════════════════════════════
                            HEADER
                        ═══════════════════════════════════════════════════ */}
                        <div style={{
                            padding: '18px 20px',
                            background: 'linear-gradient(135deg, #ffffff 0%, #fafbff 100%)',
                            borderBottom: '1px solid #e2e8f0',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Decorative gradient */}
                            <div style={{
                                position: 'absolute',
                                top: -30,
                                right: -30,
                                width: 120,
                                height: 120,
                                background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
                                borderRadius: '50%',
                                pointerEvents: 'none'
                            }} />

                            <div style={{
                                position: 'relative',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                marginBottom: 14
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 11,
                                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        boxShadow: '0 4px 12px -2px rgba(99,102,241,0.4)'
                                    }}>
                                        <DownloadCloud size={20} strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <div style={{
                                            fontSize: 15,
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            letterSpacing: '-0.01em',
                                            lineHeight: 1.2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8
                                        }}>
                                            Downloads
                                            {stats.processing > 0 && (
                                                <span className="live-pulse-dot" style={{
                                                    width: 7,
                                                    height: 7,
                                                    borderRadius: '50%',
                                                    background: '#3b82f6',
                                                    display: 'inline-block'
                                                }} />
                                            )}
                                        </div>
                                        <div style={{
                                            fontSize: 11,
                                            color: '#94a3b8',
                                            fontWeight: 500,
                                            marginTop: 1
                                        }}>
                                            Export center & file history
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Tooltip title="Refresh">
                                        <button
                                            onClick={handleRefresh}
                                            disabled={loading}
                                            className="header-icon-btn"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 8,
                                                background: '#ffffff',
                                                border: '1px solid #e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: loading ? 'wait' : 'pointer',
                                                color: '#64748b',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <RefreshCw
                                                size={14}
                                                strokeWidth={2.5}
                                                className={loading ? 'spin-animation' : ''}
                                            />
                                        </button>
                                    </Tooltip>
                                    <Tooltip title="Close">
                                        <button
                                            onClick={onClose}
                                            className="header-icon-btn"
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 8,
                                                background: '#ffffff',
                                                border: '1px solid #e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                color: '#64748b',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <XCircle size={14} strokeWidth={2.5} />
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>

                            {/* Stats Cards */}
                            {stats.total > 0 && (
                                <div style={{
                                    display: 'flex',
                                    gap: 8,
                                    marginBottom: 12
                                }}>
                                    <StatMiniCard
                                        icon={Database}
                                        label="Total"
                                        value={stats.total}
                                        color="#6366f1"
                                    />
                                    {stats.processing > 0 && (
                                        <StatMiniCard
                                            icon={Loader2}
                                            label="Active"
                                            value={stats.processing}
                                            color="#3b82f6"
                                            animate
                                        />
                                    )}
                                    {stats.completed > 0 && (
                                        <StatMiniCard
                                            icon={CheckCircle2}
                                            label="Ready"
                                            value={stats.completed}
                                            color="#10b981"
                                        />
                                    )}
                                    {stats.failed > 0 && (
                                        <StatMiniCard
                                            icon={XCircle}
                                            label="Failed"
                                            value={stats.failed}
                                            color="#ef4444"
                                        />
                                    )}
                                </div>
                            )}

                            {/* Filter Tabs */}
                            {stats.total > 0 && (
                                <Segmented
                                    value={filterStatus}
                                    onChange={setFilterStatus}
                                    size="small"
                                    block
                                    options={[
                                        { label: `All (${stats.total})`, value: 'all' },
                                        { label: `Active (${stats.processing})`, value: 'processing' },
                                        { label: `Ready (${stats.completed})`, value: 'completed' },
                                        { label: `Failed (${stats.failed})`, value: 'failed' }
                                    ]}
                                    style={{
                                        background: '#f1f5f9',
                                        fontWeight: 600
                                    }}
                                />
                            )}
                        </div>

                        {/* ═══════════════════════════════════════════════════
                            DOWNLOADS LIST
                        ═══════════════════════════════════════════════════ */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: filteredDownloads.length > 0 ? '14px 16px' : 0
                        }}>
                            {filteredDownloads.length === 0 ? (
                                stats.total === 0 ? (
                                    /* No downloads at all */
                                    <div style={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '40px 24px'
                                    }}>
                                        <div style={{
                                            width: 80,
                                            height: 80,
                                            borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: 16,
                                            border: '2px solid #c7d2fe'
                                        }}>
                                            <DownloadCloud size={32} style={{ color: '#6366f1' }} strokeWidth={2} />
                                        </div>
                                        <div style={{
                                            fontSize: 15,
                                            fontWeight: 800,
                                            color: '#0f172a',
                                            marginBottom: 6,
                                            textAlign: 'center'
                                        }}>
                                            No Downloads Yet
                                        </div>
                                        <div style={{
                                            fontSize: 12,
                                            color: '#64748b',
                                            textAlign: 'center',
                                            maxWidth: 260,
                                            lineHeight: 1.5
                                        }}>
                                            Your scheduled exports and report downloads will appear here once generated.
                                        </div>
                                        <div style={{
                                            marginTop: 16,
                                            padding: '8px 14px',
                                            background: '#eef2ff',
                                            border: '1px solid #c7d2fe',
                                            borderRadius: 20,
                                            fontSize: 10,
                                            fontWeight: 700,
                                            color: '#4f46e5',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5
                                        }}>
                                            <Info size={11} strokeWidth={2.5} />
                                            Trigger an export from any module
                                        </div>
                                    </div>
                                ) : (
                                    /* Filtered empty */
                                    <div style={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '40px 24px'
                                    }}>
                                        <Filter size={32} style={{ color: '#cbd5e1', marginBottom: 12 }} />
                                        <div style={{
                                            fontSize: 13,
                                            fontWeight: 700,
                                            color: '#475569',
                                            marginBottom: 4
                                        }}>
                                            No {filterStatus} downloads
                                        </div>
                                        <div style={{
                                            fontSize: 11,
                                            color: '#94a3b8',
                                            textAlign: 'center'
                                        }}>
                                            Try selecting a different filter
                                        </div>
                                    </div>
                                )
                            ) : (
                                filteredDownloads.map((item) => (
                                    <DownloadItem
                                        key={item.id}
                                        item={item}
                                        onDownload={handleDownloadTrigger}
                                    />
                                ))
                            )}
                        </div>

                        {/* ═══════════════════════════════════════════════════
                            FOOTER (Total size + count)
                        ═══════════════════════════════════════════════════ */}
                        {stats.total > 0 && (
                            <div style={{
                                padding: '12px 20px',
                                background: '#ffffff',
                                borderTop: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8
                            }}>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    fontSize: 10,
                                    fontWeight: 600,
                                    color: '#64748b'
                                }}>
                                    <Archive size={11} strokeWidth={2.5} />
                                    Showing {filteredDownloads.length} of {stats.total}
                                </div>
                                {stats.totalSize > 0 && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        background: '#f1f5f9',
                                        padding: '4px 10px',
                                        borderRadius: 10
                                    }}>
                                        <HardDrive size={11} strokeWidth={2.5} style={{ color: '#6366f1' }} />
                                        Total: {formatSize(stats.totalSize)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Spin>

                <style>{`
                    .download-card-item.clickable:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08);
                        border-color: #cbd5e1 !important;
                    }
                    .header-icon-btn:hover:not(:disabled) {
                        background: #f1f5f9 !important;
                        border-color: #cbd5e1 !important;
                        color: #4f46e5 !important;
                        transform: scale(1.05);
                    }
                    .download-action-btn:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px -2px rgba(99, 102, 241, 0.5) !important;
                    }
                    .download-action-btn:active {
                        transform: translateY(0);
                    }
                    @keyframes spin-animation {
                        to { transform: rotate(360deg); }
                    }
                    .spin-animation {
                        animation: spin-animation 1.2s linear infinite;
                    }
                    @keyframes pulse-dot {
                        0%, 100% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.3); opacity: 0.6; }
                    }
                    .live-pulse-dot {
                        animation: pulse-dot 1.5s ease-in-out infinite;
                    }
                    @keyframes shimmer-progress {
                        0% { background-position: -200px 0; }
                        100% { background-position: 200px 0; }
                    }
                    .progress-shimmer {
                        background-size: 200px 100%;
                        animation: shimmer-progress 1.5s linear infinite;
                    }
                    /* Custom scrollbar */
                    ::-webkit-scrollbar {
                        width: 6px;
                    }
                    ::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: #cbd5e1;
                        border-radius: 3px;
                    }
                    ::-webkit-scrollbar-thumb:hover {
                        background: #94a3b8;
                    }
                `}</style>
            </Drawer>
        </ConfigProvider>
    );
};

export default memo(DownloadsDrawer);