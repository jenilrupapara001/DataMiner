import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../services/db';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import {
    Table, Input, Select, Badge, Space, DatePicker,
    Typography, Button, Tag, Tooltip, Modal, Descriptions, Segmented
} from 'antd';
import {
    Clock, Search, RefreshCw, Eye, User, Shield, Activity,
    Cpu, Zap, Trash2, Edit3, LogIn, LogOut, XCircle, AlertTriangle,
    PlusCircle, ClipboardList, Filter, Mail, Target, Box, Info, Database
} from 'lucide-react';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const IMPORTANT_TYPES = [
    'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE',
    'AUTH_SUCCESS', 'AUTH_FAILURE', 'AUTH_LOGOUT',
    'SYSTEM_ERROR', 'IMPORT', 'LIVE_SYNC', 'LIVE_SYNC_TEST',
    'AUTOMATION_TASK', 'TARGET_UPDATE', 'TARGET_IMPORT', 'TARGET_DELETE'
];

const TYPE_STYLES = {
    CREATE: { icon: <PlusCircle size={13} />, color: '#10b981', label: 'Created' },
    UPDATE: { icon: <Edit3 size={13} />, color: '#3b82f6', label: 'Updated' },
    DELETE: { icon: <Trash2 size={13} />, color: '#ef4444', label: 'Deleted' },
    STATUS_CHANGE: { icon: <Activity size={13} />, color: '#f59e0b', label: 'Status Change' },
    AUTH_SUCCESS: { icon: <LogIn size={13} />, color: '#10b981', label: 'Login' },
    AUTH_FAILURE: { icon: <XCircle size={13} />, color: '#ef4444', label: 'Login Failed' },
    AUTH_LOGOUT: { icon: <LogOut size={13} />, color: '#64748b', label: 'Logout' },
    SYSTEM_ERROR: { icon: <AlertTriangle size={13} />, color: '#dc2626', label: 'Error' },
    IMPORT: { icon: <ClipboardList size={13} />, color: '#06b6d4', label: 'Import' },
    LIVE_SYNC: { icon: <Zap size={13} />, color: '#7c3aed', label: 'Live Sync' },
    LIVE_SYNC_TEST: { icon: <Zap size={13} />, color: '#7c3aed', label: 'Sync Test' },
    AUTOMATION_TASK: { icon: <Cpu size={13} />, color: '#6366f1', label: 'Automation' },
    TARGET_UPDATE: { icon: <Edit3 size={13} />, color: '#0284c7', label: 'Target Update' },
    TARGET_IMPORT: { icon: <ClipboardList size={13} />, color: '#0d9488', label: 'Target Import' },
    TARGET_DELETE: { icon: <Trash2 size={13} />, color: '#e11d48', label: 'Target Delete' },
};

const ENTITY_STYLES = {
    OBJECTIVE: { color: 'blue', icon: <Target size={11} /> },
    ACTION: { color: 'orange', icon: <PlusCircle size={11} /> },
    USER: { color: 'purple', icon: <User size={11} /> },
    SELLER: { color: 'green', icon: <Box size={11} /> },
    ASIN: { color: 'geekblue', icon: <Box size={11} /> },
    SYSTEM: { color: 'default', icon: <Database size={11} /> },
};

function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function relativeTime(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return formatTime(dateStr);
}

function renderMetadata(metadata) {
    if (!metadata) return <Text type="secondary" style={{ fontSize: 12 }}>No additional data.</Text>;
    let data = metadata;
    if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return <pre style={{ margin: 0, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 11 }}>{data}</pre>; }
    }
    if (typeof data !== 'object') return <pre style={{ margin: 0, padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 11 }}>{String(data)}</pre>;
    return (
        <Descriptions bordered size="small" column={1}>
            {Object.entries(data).map(([key, value]) => (
                <Descriptions.Item key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
                    {typeof value === 'object' ? (
                        <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(value, null, 2)}</pre>
                    ) : String(value)}
                </Descriptions.Item>
            ))}
        </Descriptions>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

const ActivityLog = () => {
    const socket = useSocket();

    // Tab state
    const [activeTab, setActiveTab] = useState('activity');

    // Activity logs state (server-side)
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [total, setTotal] = useState(0);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [dateRange, setDateRange] = useState(null);
    const [showAllEvents, setShowAllEvents] = useState(false);

    // Detail modal
    const [selectedLog, setSelectedLog] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // OTP state
    const [otpLogs, setOtpLogs] = useState([]);
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpStats, setOtpStats] = useState({});
    const [otpPage, setOtpPage] = useState(1);
    const [otpTotal, setOtpTotal] = useState(0);
    const [otpActionFilter, setOtpActionFilter] = useState('');
    const [otpEmailFilter, setOtpEmailFilter] = useState('');

    // Real-time socket
    useEffect(() => {
        if (!socket) return;
        const handler = (data) => {
            if (!data) return;
            setLogs(prev => [{ ...data, _id: data.Id, createdAt: data.CreatedAt }, ...prev]);
        };
        socket.on('new_system_log', handler);
        return () => socket.off('new_system_log', handler);
    }, [socket]);

    // Fetch logs with server-side filtering
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                page, limit: pageSize,
                hideNoise: showAllEvents ? 'false' : 'true'
            };
            if (filterType !== 'ALL') params.type = filterType;
            if (searchQuery) params.search = searchQuery;
            if (dateRange?.[0]) params.startDate = dateRange[0].toISOString();
            if (dateRange?.[1]) params.endDate = dateRange[1].toISOString();

            const res = await db.getSystemLogs(params);
            if (res?.success) {
                setLogs(res.data || []);
                setTotal(res.pagination?.total || 0);
            }
        } catch (e) {
            console.error('Failed to load logs:', e);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, filterType, searchQuery, dateRange, showAllEvents]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // OTP logs
    const fetchOtpLogs = useCallback(async (p = 1) => {
        setOtpLoading(true);
        try {
            const params = { page: p, limit: 20 };
            if (otpActionFilter) params.action = otpActionFilter;
            if (otpEmailFilter) params.email = otpEmailFilter;
            const res = await api.securityApi.getOtpLogs(params);
            if (res?.success) {
                setOtpLogs(res.data || []);
                setOtpTotal(res.total || 0);
                setOtpStats(res.stats || {});
                setOtpPage(p);
            }
        } catch (e) { console.error('OTP logs error:', e); }
        finally { setOtpLoading(false); }
    }, [otpActionFilter, otpEmailFilter]);

    useEffect(() => { if (activeTab === 'otp') fetchOtpLogs(1); }, [activeTab, fetchOtpLogs]);

    const clearFilters = () => {
        setSearchQuery('');
        setFilterType('ALL');
        setDateRange(null);
        setPage(1);
    };
    const hasFilters = searchQuery || filterType !== 'ALL' || dateRange;

    // ── Activity table columns ────────────────────────────────────────────
    const columns = [
        {
            title: 'Event',
            key: 'event',
            width: 150,
            render: (_, r) => {
                const s = TYPE_STYLES[r.type] || { icon: <Info size={13} />, color: '#64748b', label: r.type || 'Event' };
                return (
                    <Tag style={{
                        background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}25`,
                        borderRadius: 8, fontWeight: 600, fontSize: 10, padding: '3px 10px',
                        display: 'inline-flex', alignItems: 'center', gap: 5, textTransform: 'uppercase', letterSpacing: '0.03em'
                    }}>
                        {s.icon} {s.label}
                    </Tag>
                );
            }
        },
        {
            title: 'Details',
            key: 'details',
            render: (_, r) => (
                <div style={{ cursor: 'pointer' }} onClick={() => { setSelectedLog(r); setDetailOpen(true); }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>
                        {r.entityTitle || r.entityType || 'System Activity'}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.4, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.description || 'No description'}
                    </div>
                </div>
            )
        },
        {
            title: 'Entity',
            dataIndex: 'entityType',
            key: 'entityType',
            width: 110,
            render: (type) => {
                const s = ENTITY_STYLES[type] || { color: 'default', icon: <Info size={11} /> };
                return (
                    <Tag style={{ borderRadius: 6, fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}
                        color={s.color}>
                        {s.icon} {type || 'SYSTEM'}
                    </Tag>
                );
            }
        },
        {
            title: 'User',
            key: 'user',
            width: 160,
            render: (_, r) => {
                const name = r.user?.firstName ? `${r.user.firstName} ${r.user.lastName || ''}` : 'System';
                const email = r.user?.email || '';
                const isSystem = name === 'System' || !r.user?.firstName;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            width: 26, height: 26, borderRadius: 8,
                            background: isSystem ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'linear-gradient(135deg, #ec4899, #d946ef)',
                            color: '#fff', fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {name.charAt(0)}
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{name}</div>
                            {email && <div style={{ fontSize: 10, color: '#94a3b8' }}>{email}</div>}
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Time',
            key: 'time',
            width: 130,
            sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
            render: (_, r) => (
                <Tooltip title={formatTime(r.createdAt)}>
                    <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{relativeTime(r.createdAt)}</div>
                </Tooltip>
            )
        },
        {
            title: '',
            key: 'action',
            width: 40,
            render: (_, r) => (
                <Tooltip title="View details">
                    <Button type="text" size="small" icon={<Eye size={13} />}
                        style={{ color: '#6366f1' }}
                        onClick={() => { setSelectedLog(r); setDetailOpen(true); }} />
                </Tooltip>
            )
        }
    ];

    // ── OTP columns ────────────────────────────────────────────────────────
    const otpColumns = [
        {
            title: 'Time', dataIndex: 'CreatedAt', key: 'CreatedAt', width: 150,
            sorter: (a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt),
            render: (v) => <span style={{ fontSize: 12, color: '#475569' }}>{formatTime(v)}</span>
        },
        {
            title: 'User', key: 'user', width: 180,
            render: (_, r) => {
                const name = [r.FirstName, r.LastName].filter(Boolean).join(' ') || r.Email;
                const initial = (r.FirstName || r.Email || 'U')[0].toUpperCase();
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 8, background: '#4f46e5', color: '#fff', fontWeight: 700, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initial}</div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{r.Email}</div>
                        </div>
                    </div>
                );
            }
        },
        {
            title: 'Action', dataIndex: 'Action', key: 'Action', width: 130,
            render: (v) => {
                const m = { 'OTP_SENT': { color: '#3b82f6', label: 'Sent' }, 'OTP_VERIFIED': { color: '#10b981', label: 'Verified' }, 'OTP_FAILED': { color: '#ef4444', label: 'Failed' } };
                const s = m[v] || { color: '#64748b', label: v };
                return <Tag style={{ background: `${s.color}10`, color: s.color, border: `1px solid ${s.color}25`, borderRadius: 6, fontWeight: 600, fontSize: 10 }}>{s.label}</Tag>;
            }
        },
        {
            title: 'Status', dataIndex: 'Status', key: 'Status', width: 90,
            render: (v) => (
                <Tag style={{ borderRadius: 6, fontWeight: 600, fontSize: 10, background: v === 'SUCCESS' ? '#dcfce7' : '#fee2e2', color: v === 'SUCCESS' ? '#16a34a' : '#dc2626', border: `1px solid ${v === 'SUCCESS' ? '#bbf7d0' : '#fecaca'}` }}>
                    {v}
                </Tag>
            )
        },
        { title: 'Reason', dataIndex: 'Reason', key: 'Reason', width: 160, ellipsis: true, render: (v) => <span style={{ fontSize: 12, color: v ? '#475569' : '#d4d4d8' }}>{v || '—'}</span> },
        { title: 'IP', dataIndex: 'IpAddress', key: 'IpAddress', width: 120, render: (v) => <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#64748b' }}>{v || '—'}</span> },
    ];

    return (
        <div style={{ background: '#fafbfc', minHeight: 'calc(100vh - 60px)' }}>
            {/* Header */}
            <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '20px 28px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                                {activeTab === 'activity' ? 'Activity Log' : 'OTP Audit'}
                            </h2>
                            {activeTab === 'activity' && total > 0 && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                    {total.toLocaleString()} events
                                </span>
                            )}
                        </div>
                        <p style={{ fontSize: 13, color: '#64748b', margin: 0, marginTop: 4, lineHeight: 1.5 }}>
                            {activeTab === 'activity' ? 'Track system events, user actions, and automation logs.' : 'OTP verification attempts and security events.'}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Segmented
                            value={activeTab}
                            onChange={setActiveTab}
                            options={[
                                { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}><Activity size={12} /> System Logs</span>, value: 'activity' },
                                { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}><Shield size={12} /> OTP Audit</span>, value: 'otp' },
                            ]}
                        />
                        <Button icon={<RefreshCw size={13} />} onClick={activeTab === 'activity' ? fetchLogs : () => fetchOtpLogs(1)} loading={loading || otpLoading}
                            style={{ borderRadius: 8, fontWeight: 600, fontSize: 11, height: 32, border: '1px solid #e2e8f0' }}>
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            <div style={{ padding: '20px 28px' }}>
                {/* Activity Tab */}
                {activeTab === 'activity' && (
                    <>
                        {/* Filters */}
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
                            <Input prefix={<Search size={13} style={{ color: '#94a3b8' }} />} size="small" allowClear
                                placeholder="Search events..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                                style={{ width: 240, borderRadius: 8 }} />
                            <Select size="small" value={filterType} onChange={v => { setFilterType(v); setPage(1); }}
                                style={{ width: 150, borderRadius: 8 }}
                                options={[
                                    { value: 'ALL', label: 'All Events' },
                                    ...IMPORTANT_TYPES.map(t => ({ value: t, label: TYPE_STYLES[t]?.label || t }))
                                ]} />
                            <RangePicker size="small" value={dateRange} onChange={v => { setDateRange(v); setPage(1); }}
                                style={{ width: 230, borderRadius: 8 }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Show all</span>
                                <input type="checkbox" checked={showAllEvents}
                                    onChange={e => { setShowAllEvents(e.target.checked); setPage(1); }}
                                    style={{ accentColor: '#4f46e5' }} />
                            </div>
                            {hasFilters && (
                                <Button size="small" danger onClick={clearFilters} style={{ borderRadius: 6, fontSize: 11 }}>Clear</Button>
                            )}
                        </div>

                        {/* Table */}
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <Table className="activity-table" columns={columns} dataSource={logs} rowKey={r => r._id || Math.random().toString()}
                                loading={loading} size="small" scroll={{ x: 'max-content' }}
                                pagination={{
                                    current: page, pageSize, total,
                                    showSizeChanger: true, pageSizeOptions: ['25', '50', '100'],
                                    showTotal: (t, range) => (
                                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                                            Showing <span style={{ fontWeight: 700, color: '#0f172a' }}>{range[0]}-{range[1]}</span> of <span style={{ fontWeight: 700, color: '#0f172a' }}>{t.toLocaleString()}</span> events
                                        </span>
                                    ),
                                    onChange: (p, ps) => { setPage(p); if (ps !== pageSize) setPageSize(ps); }
                                }}
                            />
                        </div>
                    </>
                )}

                {/* OTP Tab */}
                {activeTab === 'otp' && (
                    <>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Select size="small" allowClear placeholder="Action" value={otpActionFilter || undefined}
                                onChange={v => setOtpActionFilter(v || '')} style={{ width: 140, borderRadius: 8 }}
                                options={[{ value: 'OTP_SENT', label: 'Sent' }, { value: 'OTP_VERIFIED', label: 'Verified' }, { value: 'OTP_FAILED', label: 'Failed' }]} />
                            <Input prefix={<Search size={12} />} size="small" placeholder="Email..." allowClear value={otpEmailFilter}
                                onChange={e => setOtpEmailFilter(e.target.value)} style={{ width: 200, borderRadius: 8 }} />
                        </div>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                            <Table className="activity-table" columns={otpColumns} dataSource={otpLogs} rowKey={r => r.Id || r.id}
                                loading={otpLoading} size="small" scroll={{ x: 'max-content' }}
                                pagination={{ current: otpPage, pageSize: 20, total: otpTotal, onChange: fetchOtpLogs,
                                    showTotal: t => <span style={{ fontSize: 12, color: '#64748b' }}>{t} records</span> }} />
                        </div>
                    </>
                )}
            </div>

            {/* Detail Modal */}
            <Modal open={detailOpen} onCancel={() => setDetailOpen(false)} centered width={620} destroyOnClose
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Activity size={15} style={{ color: '#fff' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Event Details</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{selectedLog?.type || 'Activity'}</div>
                        </div>
                    </div>
                }
                footer={<Button type="primary" onClick={() => setDetailOpen(false)} style={{ borderRadius: 8, fontWeight: 600, fontSize: 11 }}>Close</Button>}
            >
                {selectedLog && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Descriptions bordered size="small" column={2}>
                            <Descriptions.Item label="Type">
                                {(() => { const s = TYPE_STYLES[selectedLog.type] || {}; return <Tag color={s.color || 'default'}>{s.label || selectedLog.type}</Tag>; })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="Entity">{selectedLog.entityType || 'SYSTEM'}</Descriptions.Item>
                            <Descriptions.Item label="Time" span={2}>{formatTime(selectedLog.createdAt)}</Descriptions.Item>
                            <Descriptions.Item label="User" span={2}>
                                {selectedLog.user?.firstName ? `${selectedLog.user.firstName} ${selectedLog.user.lastName || ''}` : 'System'}
                                {selectedLog.user?.email && <Text type="secondary" style={{ marginLeft: 6, fontSize: 11 }}>({selectedLog.user.email})</Text>}
                            </Descriptions.Item>
                        </Descriptions>
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 6, color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>Description</Text>
                            <div style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.6, color: '#1e293b' }}>
                                {selectedLog.description || 'No description available.'}
                            </div>
                        </div>
                        <div>
                            <Text strong style={{ display: 'block', marginBottom: 6, color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>Metadata</Text>
                            <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                                {renderMetadata(selectedLog.metadata)}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <style>{`
                .activity-table .ant-table-thead > tr > th { background: #fafbfc !important; font-size: 11px !important; font-weight: 700 !important; color: #475569 !important; text-transform: uppercase !important; letter-spacing: 0.04em !important; border-bottom: 2px solid #e2e8f0 !important; }
                .activity-table .ant-table-tbody > tr > td { border-bottom: 1px solid #f1f5f9 !important; }
                .activity-table .ant-table-tbody > tr:hover > td { background: #f8fafc !important; }
            `}</style>
        </div>
    );
};

export default ActivityLog;
